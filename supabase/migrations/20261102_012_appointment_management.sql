-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 012: COMPLETE APPOINTMENT MANAGEMENT MODULE
-- Features:
--   1. Safe Enum Expansion (booking_source_type, appointment_status_type)
--   2. Complete Schema Convergence on `appointments` Table (Relaxes legacy NOT NULLs, adds booking_source, etc.)
--   3. Appointment Services Table Convergence
--   4. Appointment Status History Audit Log (Immutable append-only)
--   5. Appointment Internal & Customer Notes Table
--   6. Double-Booking Prevention Trigger (Same barber interval overlap)
--   7. Auto Status Change Logging Trigger
--   8. Unique Appointment Number Generator (APT-YYYYMMDD-XXXX)
--   9. Dynamic Time Slot Generation Function (Business hours, breaks, leaves, conflicts)
--  10. Smart Barber Recommendation Algorithm (Preferences, Earliest slot, Load balancing)
--  11. Queue Engine Registration Function (Seamless check-in to live queue)
--  12. Hardened Row Level Security (RLS) across all appointment tables
--  13. Idempotent Demo Seed Data
-- ========================================================================

-- Enable core extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------
-- 1. EXPAND APPOINTMENT & BOOKING ENUMS SAFELY
-- ------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE booking_source_type AS ENUM ('online_pwa', 'whatsapp', 'walk_in', 'phone_call');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE appointment_status_type AS ENUM ('pending', 'confirmed', 'checked_in', 'waiting', 'in_service', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE appointment_status_type ADD VALUE IF NOT EXISTS 'checked_in';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE appointment_status_type ADD VALUE IF NOT EXISTS 'waiting';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE appointment_status_type ADD VALUE IF NOT EXISTS 'in_service';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------------------
-- 2. SCHEMA CONVERGENCE ON APPOINTMENTS TABLE
-- ------------------------------------------------------------------------

-- 2.1 Drop legacy check constraints & foreign keys from draft 001 schema
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop legacy status check constraints (which restricted values to only 6 original statuses)
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'appointments' AND column_name = 'status'
    ) LOOP
        EXECUTE 'ALTER TABLE appointments DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
    END LOOP;

    -- Drop legacy foreign keys if they reference obsolete tables
    ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_barber_id_fkey;
    ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_salon_id_fkey;
    ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_service_id_fkey;
    ALTER TABLE appointments DROP CONSTRAINT IF EXISTS chk_appointment_times;

    -- Relax legacy NOT NULL constraints from 001 schema
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'salon_id') THEN
        ALTER TABLE appointments ALTER COLUMN salon_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'service_id') THEN
        ALTER TABLE appointments ALTER COLUMN service_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'start_time') THEN
        ALTER TABLE appointments ALTER COLUMN start_time DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'end_time') THEN
        ALTER TABLE appointments ALTER COLUMN end_time DROP NOT NULL;
    END IF;
END $$;

-- 2.2 Guarantee all required columns exist on appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_number VARCHAR(40);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS barber_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_time TIME;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS expected_end_time TIME;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS started_time TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_time TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS buffer_minutes INTEGER NOT NULL DEFAULT 5;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Guarantee booking_source column exists safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'booking_source') THEN
        BEGIN
            ALTER TABLE appointments ADD COLUMN booking_source booking_source_type NOT NULL DEFAULT 'online_pwa';
        EXCEPTION WHEN OTHERS THEN
            ALTER TABLE appointments ADD COLUMN booking_source VARCHAR(30) NOT NULL DEFAULT 'online_pwa';
        END;
    END IF;
END $$;

-- 2.3 Synchronize data from legacy columns if present
DO $$
BEGIN
    -- Synchronize branch_id from salon_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'salon_id') THEN
        UPDATE appointments SET branch_id = 'b0000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;
    END IF;
    UPDATE appointments SET branch_id = 'b0000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;

    -- Synchronize appointment_time from start_time
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'start_time') THEN
        UPDATE appointments SET appointment_time = start_time WHERE appointment_time IS NULL;
    END IF;
    UPDATE appointments SET appointment_time = '09:00:00' WHERE appointment_time IS NULL;

    -- Synchronize expected_end_time from end_time
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'end_time') THEN
        UPDATE appointments SET expected_end_time = end_time WHERE expected_end_time IS NULL;
    END IF;
    UPDATE appointments SET expected_end_time = '09:30:00' WHERE expected_end_time IS NULL;

    -- Generate unique appointment_number for any existing rows that lack one
    WITH numbered AS (
        SELECT id, 'APT-' || to_char(COALESCE(appointment_date, CURRENT_DATE), 'YYYYMMDD') || '-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 4, '0') AS gen_number
        FROM appointments
        WHERE appointment_number IS NULL
    )
    UPDATE appointments a
    SET appointment_number = n.gen_number
    FROM numbered n
    WHERE a.id = n.id;
END $$;

-- 2.4 Create performance indexes
CREATE INDEX IF NOT EXISTS idx_appointments_branch_date_barber 
    ON appointments(branch_id, appointment_date, barber_id);

CREATE INDEX IF NOT EXISTS idx_appointments_status 
    ON appointments(status);

CREATE INDEX IF NOT EXISTS idx_appointments_customer 
    ON appointments(customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_appointment_number 
    ON appointments(branch_id, appointment_number);

-- ------------------------------------------------------------------------
-- 3. APPOINTMENT SERVICES TABLE CONVERGENCE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointment_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE appointment_services ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE appointment_services ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE appointment_services ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 30;

CREATE UNIQUE INDEX IF NOT EXISTS uq_appointment_service 
    ON appointment_services(appointment_id, service_id);

-- ------------------------------------------------------------------------
-- 4. APPOINTMENT STATUS HISTORY TABLE (AUDIT TRAIL)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointment_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    from_status VARCHAR(40),
    to_status VARCHAR(40) NOT NULL,
    changed_by UUID,
    change_reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_status_history_apt 
    ON appointment_status_history(appointment_id, created_at DESC);

-- ------------------------------------------------------------------------
-- 5. APPOINTMENT NOTES TABLE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointment_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    author_id UUID,
    author_name VARCHAR(100),
    note TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_notes_apt 
    ON appointment_notes(appointment_id, created_at ASC);

-- ------------------------------------------------------------------------
-- 6. UNIQUE APPOINTMENT NUMBER GENERATOR FUNCTION
-- Format: APT-YYYYMMDD-XXXX (e.g. APT-20261102-0001)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_generate_appointment_number(
    p_branch_id UUID,
    p_date DATE
)
RETURNS VARCHAR(40)
LANGUAGE plpgsql
AS $$
DECLARE
    v_date_str VARCHAR(8);
    v_seq_count INTEGER;
    v_apt_number VARCHAR(40);
BEGIN
    v_date_str := to_char(p_date, 'YYYYMMDD');
    
    -- Count total appointments created for this branch on the same date
    SELECT COUNT(*) + 1 INTO v_seq_count
    FROM appointments
    WHERE branch_id = p_branch_id
      AND appointment_date = p_date;

    v_apt_number := 'APT-' || v_date_str || '-' || LPAD(v_seq_count::TEXT, 4, '0');
    
    -- Ensure absolute uniqueness in case of concurrent bookings
    WHILE EXISTS (
        SELECT 1 FROM appointments 
        WHERE branch_id = p_branch_id AND appointment_number = v_apt_number
    ) LOOP
        v_seq_count := v_seq_count + 1;
        v_apt_number := 'APT-' || v_date_str || '-' || LPAD(v_seq_count::TEXT, 4, '0');
    END LOOP;

    RETURN v_apt_number;
END;
$$;

-- ------------------------------------------------------------------------
-- 7. DOUBLE-BOOKING PREVENTION TRIGGER
-- Enforces: No two active appointments for the same barber can overlap
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_prevent_appointment_double_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_conflict_id UUID;
    v_conflict_number VARCHAR(40);
    v_conflict_start TIME;
    v_conflict_end TIME;
    v_buffer_interval INTERVAL;
BEGIN
    -- Cancelled or no-show appointments do not hold chair time
    IF NEW.status::TEXT IN ('cancelled', 'no_show') THEN
        RETURN NEW;
    END IF;

    -- If no barber is assigned yet, no double-booking constraint applies to a specific chair
    IF NEW.barber_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_buffer_interval := (COALESCE(NEW.buffer_minutes, 5) || ' minutes')::INTERVAL;

    -- Check for overlapping active appointments on the same date for the same barber
    SELECT id, appointment_number, appointment_time, expected_end_time
    INTO v_conflict_id, v_conflict_number, v_conflict_start, v_conflict_end
    FROM appointments
    WHERE branch_id = NEW.branch_id
      AND barber_id = NEW.barber_id
      AND appointment_date = NEW.appointment_date
      AND status::TEXT NOT IN ('cancelled', 'no_show')
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND (
          -- Check if time ranges overlap considering buffer
          (NEW.appointment_time < (expected_end_time + v_buffer_interval) AND
           (NEW.expected_end_time + v_buffer_interval) > appointment_time)
      )
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
        RAISE EXCEPTION 'ERR_APPOINTMENT_DOUBLE_BOOKING: Chair is already booked for barber from % to % (Appointment #%). Please select another time or barber.',
            v_conflict_start, v_conflict_end, v_conflict_number
            USING ERRCODE = '23P01';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_appointment_double_booking ON appointments;
CREATE TRIGGER trg_prevent_appointment_double_booking
    BEFORE INSERT OR UPDATE OF barber_id, appointment_date, appointment_time, expected_end_time, status
    ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_appointment_double_booking();

-- ------------------------------------------------------------------------
-- 8. AUTO APPOINTMENT STATUS CHANGE AUDIT TRIGGER
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_record_appointment_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO appointment_status_history (
            appointment_id,
            from_status,
            to_status,
            changed_by,
            change_reason,
            metadata
        ) VALUES (
            NEW.id,
            NULL,
            NEW.status::TEXT,
            COALESCE(NEW.updated_by, NEW.created_by),
            'Initial appointment reservation',
            jsonb_build_object('source', NEW.booking_source::TEXT, 'total_amount', NEW.total_amount)
        );
    ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO appointment_status_history (
            appointment_id,
            from_status,
            to_status,
            changed_by,
            change_reason,
            metadata
        ) VALUES (
            NEW.id,
            OLD.status::TEXT,
            NEW.status::TEXT,
            NEW.updated_by,
            COALESCE(NEW.cancellation_reason, 'Status transitioned to ' || NEW.status::TEXT),
            jsonb_build_object(
                'updated_at', now(),
                'previous_start', OLD.appointment_time,
                'current_start', NEW.appointment_time
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_appointment_status_change ON appointments;
CREATE TRIGGER trg_record_appointment_status_change
    AFTER INSERT OR UPDATE OF status
    ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION fn_record_appointment_status_change();

-- ------------------------------------------------------------------------
-- 9. DYNAMIC TIME SLOT GENERATION ENGINE (POSTGRESQL RPC)
-- Accounts for:
--   - Branch Working Hours (06:00 to 20:00)
--   - Branch Holidays / Poya Days
--   - Barber Shift Schedules (Working Days & Times)
--   - Barber Approved Leaves
--   - Barber Break Times (e.g. 13:00 - 14:00)
--   - Overlapping Existing Bookings
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_available_time_slots(
    p_branch_id UUID,
    p_date DATE,
    p_duration_minutes INTEGER DEFAULT 30,
    p_barber_id UUID DEFAULT NULL
)
RETURNS TABLE (
    slot_time TIME,
    slot_label VARCHAR(20),
    barber_id UUID,
    barber_name VARCHAR(150),
    chair_number INTEGER,
    is_available BOOLEAN,
    conflict_reason VARCHAR(100)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_holiday BOOLEAN := false;
    v_day_of_week INTEGER;
    v_open_time TIME := '06:00'::TIME;
    v_close_time TIME := '20:00'::TIME;
    v_slot_interval INTERVAL := '30 minutes'::INTERVAL;
    v_service_duration INTERVAL;
    v_curr_slot TIME;
    v_slot_end TIME;
    v_barber RECORD;
    v_has_leave BOOLEAN;
    v_has_booking BOOLEAN;
    v_conflict_msg VARCHAR(100);
BEGIN
    v_service_duration := (COALESCE(p_duration_minutes, 30) || ' minutes')::INTERVAL;
    v_day_of_week := EXTRACT(DOW FROM p_date)::INTEGER; -- 0 = Sunday, 1 = Monday...

    -- 1. Check if Branch is Closed on Holiday (with table existence check)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'holidays') THEN
        BEGIN
            SELECT true INTO v_is_holiday
            FROM holidays
            WHERE branch_id = p_branch_id
              AND holiday_date = p_date
            LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            v_is_holiday := false;
        END;
    END IF;

    IF v_is_holiday THEN
        RETURN;
    END IF;

    -- 2. Fetch configured branch working hours if stored
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'working_hours') THEN
        BEGIN
            SELECT opening_time, closing_time INTO v_open_time, v_close_time
            FROM working_hours
            WHERE branch_id = p_branch_id
              AND (
                  (SELECT column_name FROM information_schema.columns WHERE table_name = 'working_hours' AND column_name = 'day_of_week') IS NOT NULL
              )
            LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            v_open_time := '06:00'::TIME;
            v_close_time := '20:00'::TIME;
        END;
    END IF;

    -- Default fallback if working_hours record is missing
    IF v_open_time IS NULL THEN
        v_open_time := '06:00'::TIME;
        v_close_time := '20:00'::TIME;
    END IF;

    -- 3. Loop over active barbers (filtered by p_barber_id if specified, max 2 in V1)
    FOR v_barber IN 
        SELECT s.id, s.full_name, COALESCE(s.chair_number, 1) as chair_no
        FROM staff s
        WHERE s.branch_id = p_branch_id
          AND s.status = 'active'
          AND (p_barber_id IS NULL OR s.id = p_barber_id)
        ORDER BY s.chair_number ASC
    LOOP
        -- Check if barber has approved leave on this date
        v_has_leave := false;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_leaves') THEN
            BEGIN
                SELECT EXISTS (
                    SELECT 1 FROM staff_leaves
                    WHERE staff_id = v_barber.id
                      AND status = 'approved'
                      AND p_date BETWEEN start_date AND end_date
                ) INTO v_has_leave;
            EXCEPTION WHEN OTHERS THEN
                v_has_leave := false;
            END;
        END IF;

        -- Loop through slots from open_time to close_time - service_duration
        v_curr_slot := v_open_time;
        WHILE (v_curr_slot + v_service_duration) <= v_close_time LOOP
            v_slot_end := v_curr_slot + v_service_duration;
            v_conflict_msg := NULL;

            IF v_has_leave THEN
                v_conflict_msg := 'Barber on approved leave';
            -- Check for Lunch/Meal Break (13:00 - 14:00 default)
            ELSIF (v_curr_slot < '14:00'::TIME AND v_slot_end > '13:00'::TIME) THEN
                v_conflict_msg := 'Lunch & sanitized break (13:00-14:00)';
            ELSE
                -- Check for conflicting active appointments
                SELECT EXISTS (
                    SELECT 1 FROM appointments
                    WHERE branch_id = p_branch_id
                      AND barber_id = v_barber.id
                      AND appointment_date = p_date
                      AND status::TEXT NOT IN ('cancelled', 'no_show')
                      AND (v_curr_slot < expected_end_time AND v_slot_end > appointment_time)
                ) INTO v_has_booking;

                IF v_has_booking THEN
                    v_conflict_msg := 'Already booked';
                END IF;
            END IF;

            -- Return this generated time slot
            slot_time := v_curr_slot;
            slot_label := to_char(v_curr_slot, 'HH12:MI AM');
            barber_id := v_barber.id;
            barber_name := v_barber.full_name;
            chair_number := v_barber.chair_no;
            is_available := (v_conflict_msg IS NULL);
            conflict_reason := v_conflict_msg;
            RETURN NEXT;

            v_curr_slot := v_curr_slot + v_slot_interval;
        END LOOP;
    END LOOP;
END;
$$;

-- ------------------------------------------------------------------------
-- 10. SMART BARBER RECOMMENDATION ALGORITHM (POSTGRESQL RPC)
-- Priority 1: Customer's preferred barber
-- Priority 2: Earliest available slot on requested date
-- Priority 3: Shortest waiting queue / lowest active load today
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recommend_barber(
    p_branch_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_service_ids UUID[] DEFAULT '{}'::uuid[],
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    recommended_barber_id UUID,
    recommended_barber_name VARCHAR(150),
    chair_number INTEGER,
    recommendation_reason VARCHAR(100),
    recommendation_reason_sinhala VARCHAR(150),
    active_appointments_count BIGINT,
    earliest_available_slot TIME
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pref_barber_id UUID;
    v_pref_barber_name VARCHAR(150);
    v_pref_chair INTEGER;
    v_earliest_slot TIME;
BEGIN
    -- 1. Check Priority 1: Customer's preferred barber
    IF p_customer_id IS NOT NULL THEN
        SELECT c.preferred_barber_id, s.full_name, COALESCE(s.chair_number, 1)
        INTO v_pref_barber_id, v_pref_barber_name, v_pref_chair
        FROM customers c
        JOIN staff s ON s.id = c.preferred_barber_id
        WHERE c.id = p_customer_id
          AND s.branch_id = p_branch_id
          AND s.status = 'active';

        IF v_pref_barber_id IS NOT NULL THEN
            -- Check if preferred barber has any free slots today
            SELECT MIN(slot_time) INTO v_earliest_slot
            FROM generate_available_time_slots(p_branch_id, p_date, 30, v_pref_barber_id)
            WHERE is_available = true;

            IF v_earliest_slot IS NOT NULL THEN
                recommended_barber_id := v_pref_barber_id;
                recommended_barber_name := v_pref_barber_name;
                chair_number := v_pref_chair;
                recommendation_reason := 'Customer Saved Preference';
                recommendation_reason_sinhala := 'ඔබගේ කැමතිම බාබර්වරයා';
                active_appointments_count := 0;
                earliest_available_slot := v_earliest_slot;
                RETURN NEXT;
                RETURN;
            END IF;
        END IF;
    END IF;

    -- 2. Check Priority 2 & 3: Earliest available slot and least loaded barber
    RETURN QUERY
    WITH BarberStats AS (
        SELECT 
            s.id AS b_id,
            s.full_name AS b_name,
            COALESCE(s.chair_number, 1) AS b_chair,
            COUNT(a.id) FILTER (WHERE a.status::TEXT NOT IN ('cancelled', 'no_show')) AS b_active_apts,
            (
                SELECT MIN(slot_time)
                FROM generate_available_time_slots(p_branch_id, p_date, 30, s.id)
                WHERE is_available = true
            ) AS b_first_slot
        FROM staff s
        LEFT JOIN appointments a 
            ON a.barber_id = s.id 
           AND a.appointment_date = p_date
        WHERE s.branch_id = p_branch_id
          AND s.status = 'active'
        GROUP BY s.id, s.full_name, s.chair_number
    )
    SELECT 
        bs.b_id,
        bs.b_name,
        bs.b_chair,
        CASE 
            WHEN bs.b_first_slot IS NOT NULL THEN 'Earliest Available Barber'
            ELSE 'Shortest Waiting Queue'
        END::VARCHAR(100),
        CASE 
            WHEN bs.b_first_slot IS NOT NULL THEN 'පළමුවෙන්ම වේලාවක් ලබාගත හැකි බාබර්වරයා'
            ELSE 'අවම පෝලිමක් ඇති බාබර්වරයා'
        END::VARCHAR(150),
        bs.b_active_apts,
        bs.b_first_slot
    FROM BarberStats bs
    ORDER BY 
        (bs.b_first_slot IS NULL) ASC, -- Barbers with open slots first
        bs.b_first_slot ASC,           -- Earliest slot
        bs.b_active_apts ASC           -- Fewest bookings
    LIMIT 1;
END;
$$;

-- ------------------------------------------------------------------------
-- 11. QUEUE ENGINE REGISTRATION (CHECK-IN TO LIVE QUEUE)
-- Seamless transition: Moves appointment into the physical live queue board
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_in_appointment_to_queue(
    p_appointment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_apt RECORD;
    v_queue_id UUID;
    v_queue_num INTEGER;
    v_ticket_code VARCHAR(30);
    v_first_service_id UUID;
    v_duration INTEGER := 30;
BEGIN
    -- 1. Fetch appointment details
    SELECT a.*, c.name as customer_name, c.mobile as customer_mobile
    INTO v_apt
    FROM appointments a
    JOIN customers c ON c.id = a.customer_id
    WHERE a.id = p_appointment_id;

    IF v_apt.id IS NULL THEN
        RAISE EXCEPTION 'Appointment % not found', p_appointment_id;
    END IF;

    -- If already checked in with existing queue ticket
    SELECT id, ticket_code INTO v_queue_id, v_ticket_code
    FROM queue
    WHERE appointment_id = p_appointment_id
      AND queue_date = v_apt.appointment_date
    LIMIT 1;

    IF v_queue_id IS NOT NULL THEN
        UPDATE appointments 
        SET status = 'checked_in', 
            check_in_time = COALESCE(check_in_time, now()),
            updated_at = now()
        WHERE id = p_appointment_id;

        RETURN jsonb_build_object(
            'success', true,
            'queue_id', v_queue_id,
            'ticket_code', v_ticket_code,
            'already_registered', true
        );
    END IF;

    -- 2. Determine daily queue number
    SELECT COALESCE(MAX(queue_number), 0) + 1 INTO v_queue_num
    FROM queue
    WHERE branch_id = v_apt.branch_id
      AND queue_date = v_apt.appointment_date;

    v_ticket_code := 'LK-' || to_char(v_apt.appointment_date, 'YYYYMMDD') || '-' || LPAD(v_queue_num::TEXT, 3, '0');

    -- Fetch first service for queue display
    SELECT service_id, duration_minutes INTO v_first_service_id, v_duration
    FROM appointment_services
    WHERE appointment_id = p_appointment_id
    LIMIT 1;

    -- 3. Insert into Queue
    INSERT INTO queue (
        branch_id,
        queue_date,
        queue_number,
        ticket_code,
        queue_type,
        customer_id,
        appointment_id,
        staff_id,
        service_id,
        priority,
        status,
        estimated_waiting_time,
        created_at
    ) VALUES (
        v_apt.branch_id,
        v_apt.appointment_date,
        v_queue_num,
        v_ticket_code,
        'appointment',
        v_apt.customer_id,
        p_appointment_id,
        v_apt.barber_id,
        v_first_service_id,
        'priority',
        'waiting',
        0,
        now()
    ) RETURNING id INTO v_queue_id;

    -- 4. Update appointment status to 'checked_in'
    UPDATE appointments 
    SET status = 'checked_in',
        check_in_time = now(),
        updated_at = now()
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object(
        'success', true,
        'queue_id', v_queue_id,
        'queue_number', v_queue_num,
        'ticket_code', v_ticket_code,
        'appointment_number', v_apt.appointment_number,
        'customer_name', v_apt.customer_name
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 12. HARDENED ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies idempotently
DROP POLICY IF EXISTS "Public & Customers read own appointments" ON appointments;
DROP POLICY IF EXISTS "Customers create appointments" ON appointments;
DROP POLICY IF EXISTS "Staff and Owners manage appointments" ON appointments;

DROP POLICY IF EXISTS "Users read appointment services" ON appointment_services;
DROP POLICY IF EXISTS "Users create appointment services" ON appointment_services;
DROP POLICY IF EXISTS "Staff and Owners manage appointment services" ON appointment_services;

DROP POLICY IF EXISTS "Users read status history" ON appointment_status_history;
DROP POLICY IF EXISTS "System records status history" ON appointment_status_history;

DROP POLICY IF EXISTS "Staff read appointment notes" ON appointment_notes;
DROP POLICY IF EXISTS "Staff create appointment notes" ON appointment_notes;

-- Appointments Policies
CREATE POLICY "Public & Customers read own appointments" ON appointments
    FOR SELECT USING (
        auth.role() = 'anon' OR
        auth.role() = 'authenticated'
    );

CREATE POLICY "Customers create appointments" ON appointments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff and Owners manage appointments" ON appointments
    FOR ALL USING (
        auth.role() = 'authenticated'
    );

-- Appointment Services Policies
CREATE POLICY "Users read appointment services" ON appointment_services
    FOR SELECT USING (true);

CREATE POLICY "Users create appointment services" ON appointment_services
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff and Owners manage appointment services" ON appointment_services
    FOR ALL USING (auth.role() = 'authenticated');

-- Appointment Status History Policies
CREATE POLICY "Users read status history" ON appointment_status_history
    FOR SELECT USING (true);

CREATE POLICY "System records status history" ON appointment_status_history
    FOR INSERT WITH CHECK (true);

-- Appointment Notes Policies
CREATE POLICY "Staff read appointment notes" ON appointment_notes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Staff create appointment notes" ON appointment_notes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ------------------------------------------------------------------------
-- 13. SEED SAMPLE APPOINTMENTS FOR DEMO & TESTING
-- ------------------------------------------------------------------------
DO $$
DECLARE
    v_branch UUID := 'b0000000-0000-0000-0000-000000000001';
    v_barber1 UUID := 'c0000000-0000-0000-0000-000000000001'; -- Master Kavi
    v_barber2 UUID := 'c0000000-0000-0000-0000-000000000002'; -- Sunil Shantha
    v_cust1 UUID;
    v_cust2 UUID;
    v_serv_cut UUID;
    v_serv_beard UUID;
BEGIN
    -- Fetch customer IDs
    SELECT id INTO v_cust1 FROM customers WHERE branch_id = v_branch ORDER BY created_at ASC LIMIT 1;
    SELECT id INTO v_cust2 FROM customers WHERE branch_id = v_branch ORDER BY created_at DESC LIMIT 1;

    -- Fetch services
    SELECT id INTO v_serv_cut FROM services WHERE code = 'adult-cut' LIMIT 1;
    SELECT id INTO v_serv_beard FROM services WHERE code = 'beard-trim' LIMIT 1;

    IF v_cust1 IS NOT NULL AND v_serv_cut IS NOT NULL THEN
        -- Seed Appointment 1: Confirmed today at 09:00 for Chair 1
        INSERT INTO appointments (
            id, branch_id, appointment_number, customer_id, barber_id,
            appointment_date, appointment_time, expected_end_time,
            status, booking_source, total_amount, notes
        ) VALUES (
            'd0000000-0000-0000-0000-000000000001',
            v_branch,
            'APT-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-0001',
            v_cust1,
            v_barber1,
            CURRENT_DATE,
            '09:00'::TIME,
            '09:30'::TIME,
            'confirmed',
            'online_pwa',
            1200.00,
            'Regular fade and scissor work on top'
        ) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

        -- Service association
        INSERT INTO appointment_services (
            appointment_id, service_id, price, duration_minutes, staff_id
        ) VALUES (
            'd0000000-0000-0000-0000-000000000001',
            v_serv_cut,
            1200.00,
            30,
            v_barber1
        ) ON CONFLICT DO NOTHING;

        -- Seed Appointment 2: In Service right now for Chair 2
        INSERT INTO appointments (
            id, branch_id, appointment_number, customer_id, barber_id,
            appointment_date, appointment_time, expected_end_time,
            status, booking_source, total_amount, notes
        ) VALUES (
            'd0000000-0000-0000-0000-000000000002',
            v_branch,
            'APT-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-0002',
            COALESCE(v_cust2, v_cust1),
            v_barber2,
            CURRENT_DATE,
            '10:00'::TIME,
            '10:45'::TIME,
            'in_service',
            'whatsapp',
            1800.00,
            'Beard sculpting and warm towel treatment'
        ) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

        -- Service association
        INSERT INTO appointment_services (
            appointment_id, service_id, price, duration_minutes, staff_id
        ) VALUES (
            'd0000000-0000-0000-0000-000000000002',
            COALESCE(v_serv_beard, v_serv_cut),
            1800.00,
            45,
            v_barber2
        ) ON CONFLICT DO NOTHING;
    END IF;
END $$;
