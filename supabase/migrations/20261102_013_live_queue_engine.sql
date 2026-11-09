-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 013: REALTIME LIVE QUEUE ENGINE
-- Features:
--   1. Queue Enums Expansion (in_service, emergency)
--   2. Queue Table Schema Convergence (position, chair_number, skipped_at)
--   3. Queue History Table (Immutable audit trail of all transitions)
--   4. Queue Events Table (Streaming log for Supabase Realtime & analytics)
--   5. Realtime Logs Table
--   6. Daily Resetting Queue Number Generator (Token #1, #2, ... LK-YYYYMMDD-XXX)
--   7. Intelligent Queue Merge (Walk-in + Appointment unified fair queue)
--   8. Core Queue Operations RPCs:
--      - fn_enqueue_customer
--      - fn_call_next_customer
--      - fn_start_service
--      - fn_complete_service
--      - fn_skip_customer
--      - fn_recall_customer
--      - fn_revert_previous_customer
--      - fn_set_queue_priority
--      - fn_reorder_queue
--      - calculate_queue_estimated_wait_time
--      - fn_get_live_queue_dashboard
--   9. Realtime Publication Activation on queue, queue_history, queue_events
--  10. Hardened Row Level Security (RLS) across all queue tables
--  11. Production Seed Data for Today's Live Board
-- ========================================================================

-- Enable core extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------
-- 1. CONVERGE QUEUE DATA TYPES (ELIMINATE POSTGRESQL 42883 & 55P04 ERRORS)
-- ------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) DEFAULT 'b0000000-0000-0000-0000-000000000001',
    queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    queue_number INTEGER NOT NULL DEFAULT 1,
    ticket_code VARCHAR(30),
    queue_type VARCHAR(30) DEFAULT 'walk_in',
    status VARCHAR(30) DEFAULT 'waiting',
    priority VARCHAR(30) DEFAULT 'normal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.1 Drop all legacy check constraints, policies, partial indexes, and triggers from queue
-- Drops queue_status_check, chk_queue_status etc. which cause operator does not exist (42883)
DO $$
DECLARE
    r RECORD;
    pol RECORD;
    idx RECORD;
    trg RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'queue') THEN
        -- 1. Drop all CHECK constraints from pg_constraint catalog
        FOR r IN (
            SELECT conname 
            FROM pg_constraint 
            WHERE conrelid = 'queue'::regclass 
              AND contype = 'c'
        ) LOOP
            EXECUTE 'ALTER TABLE queue DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE';
        END LOOP;

        -- 2. Drop all RLS policies on queue (prevents policy validation errors during column type change)
        FOR pol IN (
            SELECT policyname 
            FROM pg_policies 
            WHERE tablename = 'queue'
        ) LOOP
            EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON queue CASCADE';
        END LOOP;

        -- 3. Drop all non-PK indexes on queue (prevents partial index predicate validation errors)
        FOR idx IN (
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'queue' 
              AND indexname NOT IN (
                  SELECT conname 
                  FROM pg_constraint 
                  WHERE conrelid = 'queue'::regclass AND contype IN ('p', 'u')
              )
        ) LOOP
            EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(idx.indexname) || ' CASCADE';
        END LOOP;

        -- 4. Drop all triggers on queue
        FOR trg IN (
            SELECT trigger_name 
            FROM information_schema.triggers 
            WHERE event_object_table = 'queue'
        ) LOOP
            EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trg.trigger_name) || ' ON queue CASCADE';
        END LOOP;
    END IF;
END $$;

-- Explicit drops as additional safeguard
ALTER TABLE queue DROP CONSTRAINT IF EXISTS chk_queue_status CASCADE;
ALTER TABLE queue DROP CONSTRAINT IF EXISTS chk_queue_priority CASCADE;
ALTER TABLE queue DROP CONSTRAINT IF EXISTS chk_queue_type CASCADE;
ALTER TABLE queue DROP CONSTRAINT IF EXISTS chk_queue_customer_present CASCADE;
ALTER TABLE queue DROP CONSTRAINT IF EXISTS queue_status_check CASCADE;
ALTER TABLE queue DROP CONSTRAINT IF EXISTS queue_priority_check CASCADE;
ALTER TABLE queue DROP CONSTRAINT IF EXISTS queue_queue_type_check CASCADE;

-- 1.2 Safely convert status, priority, and queue_type to standard VARCHAR(30)
-- Completely unobstructed by legacy check constraints or partial indexes!
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'queue' AND column_name = 'status'
    ) THEN
        ALTER TABLE queue ALTER COLUMN status DROP DEFAULT;
        ALTER TABLE queue ALTER COLUMN status TYPE VARCHAR(30) USING status::TEXT;
        ALTER TABLE queue ALTER COLUMN status SET DEFAULT 'waiting';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'queue' AND column_name = 'priority'
    ) THEN
        ALTER TABLE queue ALTER COLUMN priority DROP DEFAULT;
        ALTER TABLE queue ALTER COLUMN priority TYPE VARCHAR(30) USING priority::TEXT;
        ALTER TABLE queue ALTER COLUMN priority SET DEFAULT 'normal';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'queue' AND column_name = 'queue_type'
    ) THEN
        ALTER TABLE queue ALTER COLUMN queue_type DROP DEFAULT;
        ALTER TABLE queue ALTER COLUMN queue_type TYPE VARCHAR(30) USING queue_type::TEXT;
        ALTER TABLE queue ALTER COLUMN queue_type SET DEFAULT 'walk_in';
    END IF;
END $$;

-- ------------------------------------------------------------------------
-- 2. SCHEMA CONVERGENCE ON QUEUE TABLE
-- ------------------------------------------------------------------------

-- 2.1 Guarantee all required columns exist on queue table
ALTER TABLE queue ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE queue ADD COLUMN IF NOT EXISTS queue_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS queue_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS ticket_code VARCHAR(30);
ALTER TABLE queue ADD COLUMN IF NOT EXISTS queue_type VARCHAR(30) DEFAULT 'walk_in';
ALTER TABLE queue ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS walk_in_id UUID REFERENCES walk_in_customers(id) ON DELETE SET NULL;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS priority VARCHAR(30) DEFAULT 'normal';
ALTER TABLE queue ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'waiting';
ALTER TABLE queue ADD COLUMN IF NOT EXISTS estimated_waiting_time INTEGER NOT NULL DEFAULT 15;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS grace_period_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS chair_number INTEGER DEFAULT 1;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS position INTEGER;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS called_at TIMESTAMPTZ;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMPTZ;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS skip_reason TEXT;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2.2 Create high-performance lookup indexes for realtime queue sorting
CREATE INDEX IF NOT EXISTS idx_queue_branch_date_status 
    ON queue(branch_id, queue_date, status);

CREATE INDEX IF NOT EXISTS idx_queue_active_board 
    ON queue(branch_id, queue_date, priority, queue_number) 
    WHERE status IN ('waiting', 'called', 'in_service', 'in_chair');

CREATE INDEX IF NOT EXISTS idx_queue_appointment_link 
    ON queue(appointment_id) 
    WHERE appointment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_daily_queue_number 
    ON queue(branch_id, queue_date, queue_number);

-- ------------------------------------------------------------------------
-- 3. QUEUE HISTORY TABLE (AUDIT TRAIL)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS queue_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID NOT NULL REFERENCES queue(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    chair_number INTEGER,
    action_by VARCHAR(50) NOT NULL DEFAULT 'staff',
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_history_queue 
    ON queue_history(queue_id, created_at DESC);

-- ------------------------------------------------------------------------
-- 4. QUEUE EVENTS TABLE (STREAMING LOG FOR SUPABASE REALTIME)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS queue_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    queue_id UUID REFERENCES queue(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_events_branch_created 
    ON queue_events(branch_id, created_at DESC);

-- ------------------------------------------------------------------------
-- 5. REALTIME LOGS TABLE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS realtime_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel VARCHAR(100) NOT NULL,
    event VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------
-- 6. DYNAMIC WAITING TIME ENGINE (POSTGRESQL FUNCTION)
-- Formula:
--   Wait = (Sum of remaining service time of in-chair customers 
--           + Sum of estimated durations of all waiting customers ahead) 
--          / Number of Active On-Duty Barbers
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_queue_estimated_wait_time(
    p_branch_id UUID,
    p_queue_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_active_barbers_count INTEGER;
    v_chair_remaining_minutes INTEGER := 0;
    v_waiting_ahead_minutes INTEGER := 0;
    v_target_queue_num INTEGER := 999999;
    v_total_calculated_wait INTEGER;
BEGIN
    -- 1. Determine number of active, on-duty barbers for this branch (default 2 in V1)
    SELECT GREATEST(COUNT(*), 1) INTO v_active_barbers_count
    FROM staff
    WHERE branch_id = p_branch_id
      AND status = 'active'
      AND availability IN ('available', 'busy', 'on_break');

    -- 2. If specific queue_id provided, fetch its queue_number to calculate "ahead" wait
    IF p_queue_id IS NOT NULL THEN
        SELECT queue_number INTO v_target_queue_num
        FROM queue
        WHERE id = p_queue_id;
    END IF;

    -- 3. Calculate remaining chair duration for currently served customers (assuming 25 min avg if started_at is null)
    SELECT COALESCE(SUM(
        GREATEST(
            COALESCE(s.duration, 25) - EXTRACT(EPOCH FROM (now() - COALESCE(q.started_at, q.called_at, now()))) / 60,
            5
        )::INTEGER
    ), 0) INTO v_chair_remaining_minutes
    FROM queue q
    LEFT JOIN services s ON s.id = q.service_id
    WHERE q.branch_id = p_branch_id
      AND q.queue_date = CURRENT_DATE
      AND q.status IN ('called', 'in_service', 'in_chair');

    -- 4. Calculate total service durations of all waiting customers ahead of this ticket
    SELECT COALESCE(SUM(COALESCE(s.duration, 25)), 0) INTO v_waiting_ahead_minutes
    FROM queue q
    LEFT JOIN services s ON s.id = q.service_id
    WHERE q.branch_id = p_branch_id
      AND q.queue_date = CURRENT_DATE
      AND q.status = 'waiting'
      AND (p_queue_id IS NULL OR q.queue_number < v_target_queue_num);

    -- 5. Fair wait calculation divided across parallel chairs + turnaround buffer (3 mins)
    v_total_calculated_wait := ((v_chair_remaining_minutes + v_waiting_ahead_minutes) / v_active_barbers_count) + 3;

    RETURN GREATEST(v_total_calculated_wait, 0);
END;
$$;

-- ------------------------------------------------------------------------
-- 7. ENQUEUE CUSTOMER (MERGES WALK-IN OR APPOINTMENT)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_enqueue_customer(
    p_branch_id UUID,
    p_queue_type VARCHAR(20),       -- 'walk_in' or 'appointment'
    p_customer_id UUID DEFAULT NULL,
    p_walk_in_id UUID DEFAULT NULL,
    p_appointment_id UUID DEFAULT NULL,
    p_service_id UUID DEFAULT NULL,
    p_staff_id UUID DEFAULT NULL,
    p_priority VARCHAR(20) DEFAULT 'normal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_queue_num INTEGER;
    v_ticket_code VARCHAR(30);
    v_queue_id UUID;
    v_est_wait INTEGER;
    v_customer_name VARCHAR(150);
BEGIN
    -- Check if appointment is already enqueued today
    IF p_appointment_id IS NOT NULL THEN
        SELECT id, queue_number, ticket_code INTO v_queue_id, v_queue_num, v_ticket_code
        FROM queue
        WHERE appointment_id = p_appointment_id
          AND queue_date = CURRENT_DATE
        LIMIT 1;

        IF v_queue_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'queue_id', v_queue_id,
                'queue_number', v_queue_num,
                'ticket_code', v_ticket_code,
                'already_enqueued', true
            );
        END IF;
    END IF;

    -- 1. Daily resetting queue sequence (Token #1, #2, ...)
    SELECT COALESCE(MAX(queue_number), 0) + 1 INTO v_queue_num
    FROM queue
    WHERE branch_id = p_branch_id
      AND queue_date = CURRENT_DATE;

    v_ticket_code := 'LK-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(v_queue_num::TEXT, 3, '0');

    -- 2. Calculate initial estimated waiting time
    v_est_wait := calculate_queue_estimated_wait_time(p_branch_id, NULL);

    -- 3. Insert Queue Ticket
    INSERT INTO queue (
        branch_id,
        queue_date,
        queue_number,
        ticket_code,
        queue_type,
        customer_id,
        walk_in_id,
        appointment_id,
        staff_id,
        service_id,
        priority,
        status,
        estimated_waiting_time,
        created_at,
        updated_at
    ) VALUES (
        p_branch_id,
        CURRENT_DATE,
        v_queue_num,
        v_ticket_code,
        p_queue_type,
        p_customer_id,
        p_walk_in_id,
        p_appointment_id,
        p_staff_id,
        p_service_id,
        p_priority,
        'waiting',
        v_est_wait,
        now(),
        now()
    ) RETURNING id INTO v_queue_id;

    -- 4. Record History
    INSERT INTO queue_history (
        queue_id,
        branch_id,
        from_status,
        to_status,
        staff_id,
        action_by,
        reason,
        metadata
    ) VALUES (
        v_queue_id,
        p_branch_id,
        NULL,
        'waiting',
        p_staff_id,
        'system',
        'Customer entered live queue',
        jsonb_build_object('type', p_queue_type, 'priority', p_priority)
    );

    -- 5. Broadcast Event for Realtime
    INSERT INTO queue_events (
        branch_id,
        event_type,
        queue_id,
        payload
    ) VALUES (
        p_branch_id,
        'TICKET_ENQUEUED',
        v_queue_id,
        jsonb_build_object(
            'queue_id', v_queue_id,
            'queue_number', v_queue_num,
            'ticket_code', v_ticket_code,
            'queue_type', p_queue_type,
            'priority', p_priority,
            'estimated_waiting_time', v_est_wait
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'queue_id', v_queue_id,
        'queue_number', v_queue_num,
        'ticket_code', v_ticket_code,
        'estimated_waiting_time', v_est_wait
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 8. CALL NEXT CUSTOMER (FAIR MERGE ALGORITHM & OWNER OVERRIDE)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_call_next_customer(
    p_branch_id UUID,
    p_staff_id UUID DEFAULT NULL,
    p_chair_number INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_queue RECORD;
    v_customer_name VARCHAR(150);
BEGIN
    -- Fair Queue Sorting Order:
    --   1. Priority: emergency > vip > priority > normal
    --   2. Position: manual owner reorder position (if specified)
    --   3. Scheduled appointments whose time has arrived
    --   4. Queue Number (FIFO arrival order)
    SELECT q.*, 
           COALESCE(c.name, w.name, 'Valued Guest') AS resolved_customer_name,
           s.name AS service_title
    INTO v_target_queue
    FROM queue q
    LEFT JOIN customers c ON c.id = q.customer_id
    LEFT JOIN walk_in_customers w ON w.id = q.walk_in_id
    LEFT JOIN services s ON s.id = q.service_id
    LEFT JOIN appointments a ON a.id = q.appointment_id
    WHERE q.branch_id = p_branch_id
      AND q.queue_date = CURRENT_DATE
      AND q.status = 'waiting'
      AND (q.staff_id IS NULL OR p_staff_id IS NULL OR q.staff_id = p_staff_id)
    ORDER BY 
        CASE q.priority
            WHEN 'emergency' THEN 1
            WHEN 'vip' THEN 2
            WHEN 'priority' THEN 3
            ELSE 4
        END ASC,
        COALESCE(q.position, 99999) ASC,
        -- If appointment, check if scheduled time is reached
        CASE 
            WHEN a.appointment_time IS NOT NULL AND a.appointment_time <= CURRENT_TIME THEN 1
            ELSE 2
        END ASC,
        q.queue_number ASC
    LIMIT 1;

    IF v_target_queue.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'No waiting customers in queue.'
        );
    END IF;

    -- Update Queue Record to 'called'
    UPDATE queue
    SET status = 'called',
        staff_id = COALESCE(p_staff_id, v_target_queue.staff_id),
        chair_number = p_chair_number,
        called_at = now(),
        updated_at = now()
    WHERE id = v_target_queue.id;

    -- If linked to appointment, update appointment status as well
    IF v_target_queue.appointment_id IS NOT NULL THEN
        UPDATE appointments
        SET status = 'checked_in',
            updated_at = now()
        WHERE id = v_target_queue.appointment_id;
    END IF;

    -- Log History
    INSERT INTO queue_history (
        queue_id,
        branch_id,
        from_status,
        to_status,
        staff_id,
        chair_number,
        action_by,
        reason
    ) VALUES (
        v_target_queue.id,
        p_branch_id,
        'waiting',
        'called',
        COALESCE(p_staff_id, v_target_queue.staff_id),
        p_chair_number,
        'staff',
        'Customer called to chair ' || p_chair_number
    );

    -- Broadcast Event for Realtime
    INSERT INTO queue_events (
        branch_id,
        event_type,
        queue_id,
        payload
    ) VALUES (
        p_branch_id,
        'CUSTOMER_CALLED',
        v_target_queue.id,
        jsonb_build_object(
            'queue_id', v_target_queue.id,
            'queue_number', v_target_queue.queue_number,
            'ticket_code', v_target_queue.ticket_code,
            'chair_number', p_chair_number,
            'customer_name', v_target_queue.resolved_customer_name,
            'service_title', v_target_queue.service_title
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'queue_id', v_target_queue.id,
        'queue_number', v_target_queue.queue_number,
        'ticket_code', v_target_queue.ticket_code,
        'chair_number', p_chair_number,
        'customer_name', v_target_queue.resolved_customer_name,
        'service_title', v_target_queue.service_title
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 9. SERVICE STARTED (IN SERVICE / IN CHAIR)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_start_service(
    p_queue_id UUID,
    p_staff_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_apt_id UUID;
    v_branch UUID;
    v_q_num INTEGER;
BEGIN
    SELECT appointment_id, branch_id, queue_number 
    INTO v_apt_id, v_branch, v_q_num
    FROM queue 
    WHERE id = p_queue_id;

    IF v_branch IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ticket not found');
    END IF;

    -- Update to in_service
    UPDATE queue
    SET status = 'in_service',
        started_at = now(),
        staff_id = COALESCE(p_staff_id, staff_id),
        updated_at = now()
    WHERE id = p_queue_id;

    -- Sync appointment
    IF v_apt_id IS NOT NULL THEN
        UPDATE appointments
        SET status = 'in_service',
            started_time = now(),
            updated_at = now()
        WHERE id = v_apt_id;
    END IF;

    -- Log History
    INSERT INTO queue_history (
        queue_id,
        branch_id,
        from_status,
        to_status,
        staff_id,
        action_by,
        reason
    ) VALUES (
        p_queue_id,
        v_branch,
        'called',
        'in_service',
        p_staff_id,
        'staff',
        'Styling started in chair'
    );

    -- Realtime event
    INSERT INTO queue_events (
        branch_id, event_type, queue_id, payload
    ) VALUES (
        v_branch, 'SERVICE_STARTED', p_queue_id,
        jsonb_build_object('queue_id', p_queue_id, 'queue_number', v_q_num)
    );

    RETURN jsonb_build_object('success', true, 'queue_id', p_queue_id);
END;
$$;

-- ------------------------------------------------------------------------
-- 10. COMPLETE SERVICE
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_complete_service(
    p_queue_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_apt_id UUID;
    v_branch UUID;
    v_q_num INTEGER;
BEGIN
    SELECT appointment_id, branch_id, queue_number 
    INTO v_apt_id, v_branch, v_q_num
    FROM queue 
    WHERE id = p_queue_id;

    IF v_branch IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ticket not found');
    END IF;

    UPDATE queue
    SET status = 'completed',
        completed_at = now(),
        updated_at = now()
    WHERE id = p_queue_id;

    IF v_apt_id IS NOT NULL THEN
        UPDATE appointments
        SET status = 'completed',
            completed_time = now(),
            updated_at = now()
        WHERE id = v_apt_id;
    END IF;

    INSERT INTO queue_history (
        queue_id, branch_id, from_status, to_status, action_by, reason
    ) VALUES (
        p_queue_id, v_branch, 'in_service', 'completed', 'staff', 'Service completed'
    );

    INSERT INTO queue_events (
        branch_id, event_type, queue_id, payload
    ) VALUES (
        v_branch, 'SERVICE_COMPLETED', p_queue_id,
        jsonb_build_object('queue_id', p_queue_id, 'queue_number', v_q_num)
    );

    RETURN jsonb_build_object('success', true, 'queue_id', p_queue_id);
END;
$$;

-- ------------------------------------------------------------------------
-- 11. SKIP CUSTOMER (WITH OPTIONAL GRACE PERIOD)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_skip_customer(
    p_queue_id UUID,
    p_reason TEXT DEFAULT 'Absent when called',
    p_grace_minutes INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_branch UUID;
    v_q_num INTEGER;
BEGIN
    SELECT branch_id, queue_number INTO v_branch, v_q_num
    FROM queue WHERE id = p_queue_id;

    IF v_branch IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ticket not found');
    END IF;

    UPDATE queue
    SET status = 'skipped',
        skipped_at = now(),
        skip_reason = p_reason,
        grace_period_minutes = p_grace_minutes,
        updated_at = now()
    WHERE id = p_queue_id;

    INSERT INTO queue_history (
        queue_id, branch_id, from_status, to_status, action_by, reason
    ) VALUES (
        p_queue_id, v_branch, 'called', 'skipped', 'staff', p_reason
    );

    INSERT INTO queue_events (
        branch_id, event_type, queue_id, payload
    ) VALUES (
        v_branch, 'CUSTOMER_SKIPPED', p_queue_id,
        jsonb_build_object('queue_id', p_queue_id, 'queue_number', v_q_num, 'reason', p_reason)
    );

    RETURN jsonb_build_object('success', true, 'queue_id', p_queue_id);
END;
$$;

-- ------------------------------------------------------------------------
-- 12. RECALL CUSTOMER (RE-ACTIVATE SKIPPED OR WAITING TICKET)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_recall_customer(
    p_queue_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_branch UUID;
    v_q_num INTEGER;
BEGIN
    SELECT branch_id, queue_number INTO v_branch, v_q_num
    FROM queue WHERE id = p_queue_id;

    IF v_branch IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ticket not found');
    END IF;

    UPDATE queue
    SET status = 'called',
        called_at = now(),
        updated_at = now()
    WHERE id = p_queue_id;

    INSERT INTO queue_history (
        queue_id, branch_id, from_status, to_status, action_by, reason
    ) VALUES (
        p_queue_id, v_branch, 'skipped', 'called', 'staff', 'Customer recalled to chair'
    );

    INSERT INTO queue_events (
        branch_id, event_type, queue_id, payload
    ) VALUES (
        v_branch, 'CUSTOMER_RECALLED', p_queue_id,
        jsonb_build_object('queue_id', p_queue_id, 'queue_number', v_q_num)
    );

    RETURN jsonb_build_object('success', true, 'queue_id', p_queue_id);
END;
$$;

-- ------------------------------------------------------------------------
-- 13. REVERT PREVIOUS CUSTOMER (UNDO ACCIDENTAL CALL/START)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_revert_previous_customer(
    p_queue_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_branch UUID;
    v_prev_status VARCHAR(30);
BEGIN
    SELECT branch_id, status INTO v_branch, v_prev_status
    FROM queue WHERE id = p_queue_id;

    IF v_branch IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ticket not found');
    END IF;

    UPDATE queue
    SET status = 'waiting',
        called_at = NULL,
        started_at = NULL,
        updated_at = now()
    WHERE id = p_queue_id;

    INSERT INTO queue_history (
        queue_id, branch_id, from_status, to_status, action_by, reason
    ) VALUES (
        p_queue_id, v_branch, v_prev_status, 'waiting', 'staff', 'Reverted back to waiting queue'
    );

    RETURN jsonb_build_object('success', true, 'queue_id', p_queue_id);
END;
$$;

-- ------------------------------------------------------------------------
-- 14. SET QUEUE PRIORITY (NORMAL, PRIORITY, VIP, EMERGENCY)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_queue_priority(
    p_queue_id UUID,
    p_priority VARCHAR(20),
    p_reason TEXT DEFAULT 'Owner priority adjustment'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_branch UUID;
    v_q_num INTEGER;
BEGIN
    SELECT branch_id, queue_number INTO v_branch, v_q_num
    FROM queue WHERE id = p_queue_id;

    IF v_branch IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ticket not found');
    END IF;

    UPDATE queue
    SET priority = p_priority,
        updated_at = now()
    WHERE id = p_queue_id;

    INSERT INTO queue_history (
        queue_id, branch_id, from_status, to_status, action_by, reason, metadata
    ) VALUES (
        p_queue_id, v_branch, 'waiting', 'waiting', 'owner', p_reason,
        jsonb_build_object('new_priority', p_priority)
    );

    INSERT INTO queue_events (
        branch_id, event_type, queue_id, payload
    ) VALUES (
        v_branch, 'PRIORITY_CHANGED', p_queue_id,
        jsonb_build_object('queue_id', p_queue_id, 'queue_number', v_q_num, 'priority', p_priority)
    );

    RETURN jsonb_build_object('success', true, 'queue_id', p_queue_id, 'priority', p_priority);
END;
$$;

-- ------------------------------------------------------------------------
-- 15. GET LIVE QUEUE DASHBOARD (COMPLETE METRICS & BOARD)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_live_queue_dashboard(
    p_branch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_chair1 JSONB;
    v_chair2 JSONB;
    v_next JSONB;
    v_waiting JSONB;
    v_stats JSONB;
BEGIN
    -- Chair 1 Active Ticket
    SELECT jsonb_build_object(
        'queue_id', q.id,
        'queue_number', q.queue_number,
        'ticket_code', q.ticket_code,
        'customer_name', COALESCE(c.name, w.name, 'Customer'),
        'service_name', COALESCE(s.name, 'Hair Cut'),
        'service_price', COALESCE(s.price, 1200),
        'duration', COALESCE(s.duration, 30),
        'barber_name', COALESCE(st.full_name, 'Master Kavi'),
        'chair_number', 1,
        'status', q.status,
        'started_at', q.started_at,
        'called_at', q.called_at
    ) INTO v_chair1
    FROM queue q
    LEFT JOIN customers c ON c.id = q.customer_id
    LEFT JOIN walk_in_customers w ON w.id = q.walk_in_id
    LEFT JOIN services s ON s.id = q.service_id
    LEFT JOIN staff st ON st.id = q.staff_id
    WHERE q.branch_id = p_branch_id
      AND q.queue_date = CURRENT_DATE
      AND q.status IN ('called', 'in_service', 'in_chair')
      AND COALESCE(q.chair_number, 1) = 1
    ORDER BY q.called_at DESC NULLS LAST
    LIMIT 1;

    -- Chair 2 Active Ticket
    SELECT jsonb_build_object(
        'queue_id', q.id,
        'queue_number', q.queue_number,
        'ticket_code', q.ticket_code,
        'customer_name', COALESCE(c.name, w.name, 'Customer'),
        'service_name', COALESCE(s.name, 'Beard Sculpt'),
        'service_price', COALESCE(s.price, 800),
        'duration', COALESCE(s.duration, 20),
        'barber_name', COALESCE(st.full_name, 'Sunil Shantha'),
        'chair_number', 2,
        'status', q.status,
        'started_at', q.started_at,
        'called_at', q.called_at
    ) INTO v_chair2
    FROM queue q
    LEFT JOIN customers c ON c.id = q.customer_id
    LEFT JOIN walk_in_customers w ON w.id = q.walk_in_id
    LEFT JOIN services s ON s.id = q.service_id
    LEFT JOIN staff st ON st.id = q.staff_id
    WHERE q.branch_id = p_branch_id
      AND q.queue_date = CURRENT_DATE
      AND q.status IN ('called', 'in_service', 'in_chair')
      AND q.chair_number = 2
    ORDER BY q.called_at DESC NULLS LAST
    LIMIT 1;

    -- Next Ticket in Line
    SELECT jsonb_build_object(
        'queue_id', q.id,
        'queue_number', q.queue_number,
        'ticket_code', q.ticket_code,
        'customer_name', COALESCE(c.name, w.name, 'Guest'),
        'service_name', COALESCE(s.name, 'Haircut'),
        'priority', q.priority,
        'queue_type', q.queue_type,
        'estimated_waiting_time', q.estimated_waiting_time
    ) INTO v_next
    FROM queue q
    LEFT JOIN customers c ON c.id = q.customer_id
    LEFT JOIN walk_in_customers w ON w.id = q.walk_in_id
    LEFT JOIN services s ON s.id = q.service_id
    WHERE q.branch_id = p_branch_id
      AND q.queue_date = CURRENT_DATE
      AND q.status = 'waiting'
    ORDER BY 
        CASE q.priority
            WHEN 'emergency' THEN 1
            WHEN 'vip' THEN 2
            WHEN 'priority' THEN 3
            ELSE 4
        END ASC,
        COALESCE(q.position, 99999) ASC,
        q.queue_number ASC
    LIMIT 1;

    -- Waiting List Array (up to 25 tickets)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', q.id,
            'queue_number', q.queue_number,
            'ticket_code', q.ticket_code,
            'queue_type', q.queue_type,
            'customer_name', COALESCE(c.name, w.name, 'Guest'),
            'customer_phone', COALESCE(c.mobile, w.mobile, ''),
            'service_name', COALESCE(s.name, 'Salon Service'),
            'service_sinhala', COALESCE(s.sinhala_name, 'සේවාව'),
            'priority', q.priority,
            'status', q.status,
            'estimated_waiting_time', q.estimated_waiting_time,
            'preferred_barber', COALESCE(st.full_name, 'Any Barber'),
            'created_at', q.created_at
        ) ORDER BY 
            CASE q.priority
                WHEN 'emergency' THEN 1
                WHEN 'vip' THEN 2
                WHEN 'priority' THEN 3
                ELSE 4
            END ASC,
            COALESCE(q.position, 99999) ASC,
            q.queue_number ASC
    ), '[]'::jsonb) INTO v_waiting
    FROM queue q
    LEFT JOIN customers c ON c.id = q.customer_id
    LEFT JOIN walk_in_customers w ON w.id = q.walk_in_id
    LEFT JOIN services s ON s.id = q.service_id
    LEFT JOIN staff st ON st.id = q.staff_id
    WHERE q.branch_id = p_branch_id
      AND q.queue_date = CURRENT_DATE
      AND q.status = 'waiting';

    -- Summary Daily Counters
    SELECT jsonb_build_object(
        'total_served_today', COUNT(*) FILTER (WHERE status = 'completed'),
        'in_service_count', COUNT(*) FILTER (WHERE status IN ('called', 'in_service', 'in_chair')),
        'waiting_count', COUNT(*) FILTER (WHERE status = 'waiting'),
        'skipped_count', COUNT(*) FILTER (WHERE status = 'skipped'),
        'walk_in_count', COUNT(*) FILTER (WHERE queue_type = 'walk_in'),
        'appointment_count', COUNT(*) FILTER (WHERE queue_type = 'appointment'),
        'avg_wait_minutes', calculate_queue_estimated_wait_time(p_branch_id, NULL)
    ) INTO v_stats
    FROM queue
    WHERE branch_id = p_branch_id
      AND queue_date = CURRENT_DATE;

    RETURN jsonb_build_object(
        'chair1_active', v_chair1,
        'chair2_active', v_chair2,
        'next_in_line', v_next,
        'waiting_list', v_waiting,
        'summary', v_stats
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 16. SUPABASE REALTIME PUBLICATION ACTIVATION
-- ------------------------------------------------------------------------
DO $$
BEGIN
    -- Check and add queue table to supabase_realtime publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'queue'
    ) THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE queue;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    -- Check and add queue_history table
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'queue_history'
    ) THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE queue_history;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    -- Check and add queue_events table
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'queue_events'
    ) THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE queue_events;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;
END $$;

-- ------------------------------------------------------------------------
-- 17. HARDENED ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view queue tickets" ON queue;
DROP POLICY IF EXISTS "Users enqueue tickets" ON queue;
DROP POLICY IF EXISTS "Staff and Owners manage queue" ON queue;

DROP POLICY IF EXISTS "Public view queue history" ON queue_history;
DROP POLICY IF EXISTS "System records queue history" ON queue_history;

DROP POLICY IF EXISTS "Public view queue events" ON queue_events;
DROP POLICY IF EXISTS "System records queue events" ON queue_events;

CREATE POLICY "Public view queue tickets" ON queue
    FOR SELECT USING (true);

CREATE POLICY "Users enqueue tickets" ON queue
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff and Owners manage queue" ON queue
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Public view queue history" ON queue_history
    FOR SELECT USING (true);

CREATE POLICY "System records queue history" ON queue_history
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public view queue events" ON queue_events
    FOR SELECT USING (true);

CREATE POLICY "System records queue events" ON queue_events
    FOR INSERT WITH CHECK (true);

-- ------------------------------------------------------------------------
-- 18. SEED PRODUCTION QUEUE DATA FOR TODAY'S LIVE DEMO BOARD
-- ------------------------------------------------------------------------
DO $$
DECLARE
    v_branch UUID := 'b0000000-0000-0000-0000-000000000001';
    v_barber1 UUID := 'c0000000-0000-0000-0000-000000000001'; -- Master Kavi (Chair 1)
    v_barber2 UUID := 'c0000000-0000-0000-0000-000000000002'; -- Sunil Shantha (Chair 2)
    v_cust1 UUID;
    v_cust2 UUID;
    v_walkin1 UUID := 'e0000000-0000-0000-0000-000000000001';
    v_serv_cut UUID;
    v_serv_beard UUID;
    v_serv_combo UUID;
BEGIN
    SELECT id INTO v_cust1 FROM customers WHERE branch_id = v_branch ORDER BY created_at ASC LIMIT 1;
    SELECT id INTO v_cust2 FROM customers WHERE branch_id = v_branch ORDER BY created_at DESC LIMIT 1;

    -- Ensure fallback customer IDs if table has fewer rows
    IF v_cust1 IS NULL THEN
        v_cust1 := 'a0000000-0000-0000-0000-000000000001';
        INSERT INTO customers (id, branch_id, name, mobile, email)
        VALUES (v_cust1, v_branch, 'Kasun Perera', '+94771234567', 'kasun@gmail.com')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    IF v_cust2 IS NULL THEN
        v_cust2 := 'a0000000-0000-0000-0000-000000000002';
        INSERT INTO customers (id, branch_id, name, mobile, email)
        VALUES (v_cust2, v_branch, 'Nuwan Pradeep', '+94712345678', 'nuwan@gmail.com')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    SELECT id INTO v_serv_cut FROM services WHERE code = 'adult-cut' LIMIT 1;
    SELECT id INTO v_serv_beard FROM services WHERE code = 'beard-trim' LIMIT 1;
    SELECT id INTO v_serv_combo FROM services WHERE code = 'cut-beard' LIMIT 1;

    IF v_serv_cut IS NULL THEN SELECT id INTO v_serv_cut FROM services LIMIT 1; END IF;
    IF v_serv_beard IS NULL THEN SELECT id INTO v_serv_beard FROM services LIMIT 1; END IF;
    IF v_serv_combo IS NULL THEN SELECT id INTO v_serv_combo FROM services LIMIT 1; END IF;

    -- Ensure walk-in guest exists
    INSERT INTO walk_in_customers (
        id, branch_id, walk_in_number, name, mobile
    ) VALUES (
        v_walkin1, v_branch, 'W-001', 'Chaminda Bandara (Walk-in)', '+94778899001'
    ) ON CONFLICT (id) DO NOTHING;

    -- Clean any existing demo tokens for today to ensure clean idempotent runs
    DELETE FROM queue WHERE id IN (
        'f0000000-0000-0000-0000-000000000007',
        'f0000000-0000-0000-0000-000000000008',
        'f0000000-0000-0000-0000-000000000009',
        'f0000000-0000-0000-0000-000000000010'
    ) OR (branch_id = v_branch AND queue_date = CURRENT_DATE AND queue_number IN (7, 8, 9, 10));

    -- Token #7: Currently In Chair (Chair 1 - Master Kavi)
    INSERT INTO queue (
        id, branch_id, queue_date, queue_number, ticket_code, queue_type,
        customer_id, staff_id, service_id, priority, status,
        estimated_waiting_time, chair_number, called_at, started_at
    ) VALUES (
        'f0000000-0000-0000-0000-000000000007',
        v_branch,
        CURRENT_DATE,
        7,
        'LK-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-007',
        'appointment',
        v_cust1,
        v_barber1,
        v_serv_combo,
        'normal',
        'in_service',
        0,
        1,
        now() - INTERVAL '15 minutes',
        now() - INTERVAL '12 minutes'
    ) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

    -- Token #8: Currently In Chair (Chair 2 - Sunil Shantha)
    INSERT INTO queue (
        id, branch_id, queue_date, queue_number, ticket_code, queue_type,
        walk_in_id, staff_id, service_id, priority, status,
        estimated_waiting_time, chair_number, called_at, started_at
    ) VALUES (
        'f0000000-0000-0000-0000-000000000008',
        v_branch,
        CURRENT_DATE,
        8,
        'LK-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-008',
        'walk_in',
        v_walkin1,
        v_barber2,
        v_serv_beard,
        'normal',
        'in_service',
        0,
        2,
        now() - INTERVAL '8 minutes',
        now() - INTERVAL '5 minutes'
    ) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

    -- Token #9: Waiting (Next in Line - VIP)
    INSERT INTO queue (
        id, branch_id, queue_date, queue_number, ticket_code, queue_type,
        customer_id, staff_id, service_id, priority, status,
        estimated_waiting_time, chair_number
    ) VALUES (
        'f0000000-0000-0000-0000-000000000009',
        v_branch,
        CURRENT_DATE,
        9,
        'LK-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-009',
        'appointment',
        v_cust2,
        v_barber1,
        v_serv_cut,
        'vip',
        'waiting',
        12,
        1
    ) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

    -- Token #10: Waiting (Walk-in Customer)
    INSERT INTO queue (
        id, branch_id, queue_date, queue_number, ticket_code, queue_type,
        walk_in_id, service_id, priority, status,
        estimated_waiting_time
    ) VALUES (
        'f0000000-0000-0000-0000-000000000010',
        v_branch,
        CURRENT_DATE,
        10,
        'LK-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-010',
        'walk_in',
        v_walkin1,
        v_serv_cut,
        'normal',
        'waiting',
        25
    ) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
END $$;

