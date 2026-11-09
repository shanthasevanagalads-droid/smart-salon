-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 11: BARBER & WORKFORCE MANAGEMENT ENGINE
-- Features:
--   1. Version 1 Dual-Barber Operational Enforcement (Chair 1 & Chair 2)
--   2. Staff Extended Profile (Staff Number, Sinhala Name, Phone, WhatsApp, Status)
--   3. Service Assignments per Barber (Haircut, Beard, Treatments)
--   4. 7-Day Shift Schedules & Lunch Break Hours
--   5. Leave Management (Annual, Medical, Personal)
--   6. Real-time Availability & Chair Status Toggles (Available, Busy, Break, Leave, Off Duty)
--   7. Commission Calculation & Monthly Revenue Performance RPCs
--   8. Live Barber Station Dashboard RPC for Mobile / Tablet POS
-- ========================================================================

-- Enable core extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------
-- 1. ENUMS & STAFF TABLE EXTENSIONS
-- ------------------------------------------------------------------------

-- Expand staff_availability_type to include 'on_leave'
DO $$ BEGIN
    ALTER TYPE staff_availability_type ADD VALUE IF NOT EXISTS 'on_leave';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Guarantee columns on staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone VARCHAR(25);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(25);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS joining_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'));
ALTER TABLE staff ADD COLUMN IF NOT EXISTS chair_number INTEGER NOT NULL DEFAULT 1;

-- V1 Chair Constraints: Enforces Min 1, Max 2 barbers for Version 1 scope
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_staff_v1_chair'
    ) THEN
        ALTER TABLE staff ADD CONSTRAINT chk_staff_v1_chair CHECK (chair_number BETWEEN 1 AND 2);
    END IF;
END $$;

-- ------------------------------------------------------------------------
-- 2. STAFF SERVICES ASSIGNMENT TABLE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_staff_service UNIQUE(staff_id, service_id)
);

-- ------------------------------------------------------------------------
-- 3. STAFF 7-DAY SHIFTS & WORKING SCHEDULES TABLE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday...
    day_name VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL DEFAULT '06:00:00',
    end_time TIME NOT NULL DEFAULT '20:00:00',
    break_start TIME DEFAULT '13:00:00',
    break_end TIME DEFAULT '14:00:00',
    is_working_day BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_staff_day UNIQUE(staff_id, day_of_week)
);

-- ------------------------------------------------------------------------
-- 4. STAFF LEAVE MANAGEMENT TABLE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    leave_type VARCHAR(20) NOT NULL CHECK (leave_type IN ('annual', 'medical', 'personal')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count NUMERIC(3,1) NOT NULL DEFAULT 1.0 CHECK (days_count > 0),
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------
-- 5. HIGH-PERFORMANCE INDEXES
-- ------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_staff_active_availability 
    ON staff (branch_id, availability, chair_number) 
    WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_staff_services_lookup 
    ON staff_services (staff_id, service_id);

CREATE INDEX IF NOT EXISTS idx_staff_schedules_lookup 
    ON staff_schedules (staff_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_staff_leaves_lookup 
    ON staff_leaves (staff_id, start_date, end_date) 
    WHERE deleted_at IS NULL;

-- ------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------
ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_leaves ENABLE ROW LEVEL SECURITY;

-- STAFF SERVICES:
DROP POLICY IF EXISTS "Public read staff services" ON staff_services;
DROP POLICY IF EXISTS "Owner manage staff services" ON staff_services;
CREATE POLICY "Public read staff services" ON staff_services FOR SELECT USING (true);
CREATE POLICY "Owner manage staff services" ON staff_services FOR ALL USING (is_owner()) WITH CHECK (is_owner());

-- STAFF SCHEDULES:
DROP POLICY IF EXISTS "Public read staff schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Owner manage staff schedules" ON staff_schedules;
CREATE POLICY "Public read staff schedules" ON staff_schedules FOR SELECT USING (true);
CREATE POLICY "Owner manage staff schedules" ON staff_schedules FOR ALL USING (is_owner()) WITH CHECK (is_owner());

-- STAFF LEAVES:
DROP POLICY IF EXISTS "Staff read own leaves" ON staff_leaves;
DROP POLICY IF EXISTS "Owner manage staff leaves" ON staff_leaves;
CREATE POLICY "Staff read own leaves" ON staff_leaves FOR SELECT USING (
    staff_id IN (SELECT id FROM staff WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR is_owner()
);
CREATE POLICY "Owner manage staff leaves" ON staff_leaves FOR ALL USING (is_owner()) WITH CHECK (is_owner());

-- ------------------------------------------------------------------------
-- 7. WORKFORCE STORED PROCEDURES & DASHBOARD RPCS
-- ------------------------------------------------------------------------

-- 7.1 Real-Time Barber Availability Switcher
CREATE OR REPLACE FUNCTION update_staff_availability(
    p_staff_id UUID,
    p_availability staff_availability_type
)
RETURNS JSONB AS $$
DECLARE
    v_staff_name TEXT;
    v_chair INTEGER;
BEGIN
    UPDATE staff
    SET availability = p_availability,
        updated_at = now()
    WHERE id = p_staff_id
    RETURNING full_name, chair_number INTO v_staff_name, v_chair;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Staff member with ID % not found.', p_staff_id;
    END IF;

    -- Audit log event
    PERFORM log_security_event(
        'SENSITIVE_UPDATE',
        p_staff_id,
        jsonb_build_object('field', 'availability', 'new_value', p_availability, 'chair', v_chair),
        'staff'
    );

    RETURN jsonb_build_object(
        'success', true,
        'staff_id', p_staff_id,
        'full_name', v_staff_name,
        'chair_number', v_chair,
        'availability', p_availability,
        'message', 'Staff availability updated to ' || p_availability
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.2 Dedicated Barber Station Live Dashboard RPC (Mobile & Tablet POS Operator Screen)
CREATE OR REPLACE FUNCTION get_barber_station_dashboard(p_staff_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_staff RECORD;
    v_active_ticket JSONB := NULL;
    v_waiting_queue JSONB := '[]'::jsonb;
    v_today_appointments JSONB := '[]'::jsonb;
    v_completed_count INTEGER := 0;
    v_total_revenue NUMERIC(10,2) := 0.00;
    v_cash_revenue NUMERIC(10,2) := 0.00;
    v_lankaqr_revenue NUMERIC(10,2) := 0.00;
    v_commission_earned NUMERIC(10,2) := 0.00;
    v_avg_chair_minutes NUMERIC(5,1) := 22.0;
BEGIN
    -- 1. Staff Profile
    SELECT id, branch_id, staff_number, full_name, sinhala_name, position, chair_number,
           availability, commission_percentage, photo_url, rating, reviews_count
    INTO v_staff
    FROM staff
    WHERE id = p_staff_id;

    IF v_staff.id IS NULL THEN
        RAISE EXCEPTION 'Staff member not found.';
    END IF;

    -- 2. Active Customer Currently in Chair (Hot Path)
    SELECT jsonb_build_object(
        'queue_id', q.id,
        'ticket_number', q.queue_number,
        'ticket_code', q.ticket_code,
        'customer_name', COALESCE(c.name, w.name, 'Valued Guest'),
        'customer_phone', COALESCE(c.mobile, w.mobile, ''),
        'service_name', COALESCE(s.name, 'Adult Hair Cut'),
        'service_sinhala', COALESCE(s.sinhala_name, 'වැඩිහිටි කොණ්ඩ කැපීම'),
        'price_lkr', COALESCE(s.price, 1200.00),
        'duration_minutes', COALESCE(s.duration, 30),
        'started_at', q.started_at,
        'elapsed_minutes', GREATEST(0, ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(q.started_at, now()))) / 60)::INTEGER),
        'is_vip', COALESCE(c.is_vip, false)
    ) INTO v_active_ticket
    FROM queue q
    LEFT JOIN customers c ON c.id = q.customer_id
    LEFT JOIN walk_in_customers w ON w.id = q.walk_in_id
    LEFT JOIN services s ON s.id = q.service_id
    WHERE q.staff_id = p_staff_id
      AND q.queue_date = CURRENT_DATE
      AND q.status = 'in_chair'
    LIMIT 1;

    -- 3. Next in Live Queue (Assigned or waiting for this Barber)
    SELECT COALESCE(jsonb_agg(q_row), '[]'::jsonb) INTO v_waiting_queue
    FROM (
        SELECT q.id AS queue_id,
               q.queue_number AS ticket_number,
               q.ticket_code,
               COALESCE(c.name, w.name, 'Walk-in Guest') AS customer_name,
               COALESCE(s.name, 'Haircut') AS service_name,
               q.estimated_waiting_time AS estimated_wait_minutes,
               (q.queue_type = 'appointment') AS is_appointment
        FROM queue q
        LEFT JOIN customers c ON c.id = q.customer_id
        LEFT JOIN walk_in_customers w ON w.id = q.walk_in_id
        LEFT JOIN services s ON s.id = q.service_id
        WHERE q.queue_date = CURRENT_DATE
          AND q.status = 'waiting'
          AND (q.staff_id = p_staff_id OR q.staff_id IS NULL)
        ORDER BY q.queue_number ASC
        LIMIT 6
    ) q_row;

    -- 4. Today's Appointments
    SELECT COALESCE(jsonb_agg(apt_row), '[]'::jsonb) INTO v_today_appointments
    FROM (
        SELECT a.id,
               a.appointment_number,
               TO_CHAR(a.appointment_time, 'HH12:MI AM') AS time,
               c.name AS customer_name,
               c.mobile AS customer_phone,
               COALESCE(s.name, 'Grooming Service') AS service_name,
               a.status
        FROM appointments a
        JOIN customers c ON c.id = a.customer_id
        LEFT JOIN appointment_services asv ON asv.appointment_id = a.id
        LEFT JOIN services s ON s.id = asv.service_id
        WHERE a.barber_id = p_staff_id
          AND a.appointment_date = CURRENT_DATE
          AND a.status NOT IN ('cancelled', 'no_show')
        ORDER BY a.appointment_time ASC
    ) apt_row;

    -- 5. Today's Performance Metrics (Completed Invoices)
    SELECT COUNT(DISTINCT i.id),
           COALESCE(SUM(i.total_lkr), 0.00),
           COALESCE(SUM(CASE WHEN p.payment_method = 'cash' THEN p.amount ELSE 0 END), 0.00),
           COALESCE(SUM(CASE WHEN p.payment_method = 'lankaqr' THEN p.amount ELSE 0 END), 0.00)
    INTO v_completed_count, v_total_revenue, v_cash_revenue, v_lankaqr_revenue
    FROM invoices i
    LEFT JOIN payments p ON p.invoice_id = i.id
    WHERE i.barber_id = p_staff_id
      AND i.invoice_date = CURRENT_DATE
      AND i.payment_status = 'paid';

    -- Commission calculated on barber's agreed commission percentage
    v_commission_earned := ROUND((v_total_revenue * (v_staff.commission_percentage / 100.0)), 2);

    RETURN jsonb_build_object(
        'staff', jsonb_build_object(
            'id', v_staff.id,
            'branch_id', v_staff.branch_id,
            'staff_number', v_staff.staff_number,
            'full_name', v_staff.full_name,
            'sinhala_name', v_staff.sinhala_name,
            'position', v_staff.position,
            'chair_number', v_staff.chair_number,
            'availability', v_staff.availability,
            'commission_percentage', v_staff.commission_percentage,
            'photo_url', v_staff.photo_url,
            'rating', v_staff.rating,
            'reviews_count', v_staff.reviews_count
        ),
        'active_ticket', v_active_ticket,
        'waiting_queue', v_waiting_queue,
        'today_appointments', v_today_appointments,
        'today_stats', jsonb_build_object(
            'completed_jobs', v_completed_count,
            'revenue_lkr', v_total_revenue,
            'commission_lkr', v_commission_earned,
            'avg_chair_duration_minutes', v_avg_chair_minutes,
            'cash_collected_lkr', v_cash_revenue,
            'lankaqr_collected_lkr', v_lankaqr_revenue
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 7.3 Monthly Commission & Productivity Breakdown RPC
CREATE OR REPLACE FUNCTION calculate_monthly_staff_commission(
    p_staff_id UUID,
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
    p_month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_staff RECORD;
    v_start_date DATE;
    v_end_date DATE;
    v_services_count INTEGER := 0;
    v_gross_revenue NUMERIC(12,2) := 0.00;
    v_net_commission NUMERIC(12,2) := 0.00;
    v_service_breakdown JSONB := '[]'::jsonb;
BEGIN
    SELECT id, staff_number, full_name, position, chair_number, commission_percentage
    INTO v_staff
    FROM staff
    WHERE id = p_staff_id;

    IF v_staff.id IS NULL THEN
        RAISE EXCEPTION 'Staff member not found.';
    END IF;

    v_start_date := MAKE_DATE(p_year, p_month, 1);
    v_end_date := (v_start_date + INTERVAL '1 month - 1 day')::DATE;

    -- Aggregate completed bills
    SELECT COUNT(ii.id),
           COALESCE(SUM(ii.line_total), 0.00)
    INTO v_services_count, v_gross_revenue
    FROM invoices i
    JOIN invoice_items ii ON ii.invoice_id = i.id
    WHERE i.barber_id = p_staff_id
      AND i.invoice_date BETWEEN v_start_date AND v_end_date
      AND i.payment_status = 'paid';

    v_net_commission := ROUND(v_gross_revenue * (v_staff.commission_percentage / 100.0), 2);

    -- Breakdown by individual service
    SELECT COALESCE(jsonb_agg(s_break), '[]'::jsonb) INTO v_service_breakdown
    FROM (
        SELECT s.name AS service_name,
               COUNT(ii.id) AS count,
               SUM(ii.line_total) AS revenue_lkr,
               ROUND(SUM(ii.line_total) * (v_staff.commission_percentage / 100.0), 2) AS commission_lkr
        FROM invoices i
        JOIN invoice_items ii ON ii.invoice_id = i.id
        JOIN services s ON s.id = ii.service_id
        WHERE i.barber_id = p_staff_id
          AND i.invoice_date BETWEEN v_start_date AND v_end_date
          AND i.payment_status = 'paid'
        GROUP BY s.name
        ORDER BY count DESC
    ) s_break;

    RETURN jsonb_build_object(
        'staff_id', v_staff.id,
        'staff_number', v_staff.staff_number,
        'staff_name', v_staff.full_name,
        'position', v_staff.position,
        'chair_number', v_staff.chair_number,
        'commission_percentage', v_staff.commission_percentage,
        'month', TO_CHAR(v_start_date, 'YYYY-MM'),
        'total_services_count', v_services_count,
        'gross_revenue_lkr', v_gross_revenue,
        'net_commission_earned_lkr', v_net_commission,
        'breakdown_by_service', v_service_breakdown
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------
-- 8. INITIAL WORKFORCE SEED DATA (CHAIR 1 & CHAIR 2 ENFORCEMENT)
-- ------------------------------------------------------------------------

-- 8.1 Ensure Master Kavi and Sunil Shantha have phone and chair details
UPDATE staff
SET phone = '+94771112233',
    whatsapp = '+94771112233',
    status = 'active',
    chair_number = 1,
    position = 'Chief Stylist',
    commission_percentage = 35.00
WHERE id = 'c0000000-0000-0000-0000-000000000001';

UPDATE staff
SET phone = '+94772223344',
    whatsapp = '+94772223344',
    status = 'active',
    chair_number = 2,
    position = 'Beard Artisan',
    commission_percentage = 30.00
WHERE id = 'c0000000-0000-0000-0000-000000000002';

-- 8.2 Seed 7-Day Shift Schedules for Chair 1 & Chair 2
INSERT INTO staff_schedules (branch_id, staff_id, day_of_week, day_name, start_time, end_time, break_start, break_end, is_working_day)
SELECT 'b0000000-0000-0000-0000-000000000001',
       'c0000000-0000-0000-0000-000000000001',
       d.day_index,
       d.day_name,
       '06:00:00'::TIME,
       '20:00:00'::TIME,
       '13:00:00'::TIME,
       '14:00:00'::TIME,
       true
FROM (VALUES
    (1, 'Monday'), (2, 'Tuesday'), (3, 'Wednesday'), (4, 'Thursday'), (5, 'Friday'), (6, 'Saturday'), (0, 'Sunday')
) AS d(day_index, day_name)
ON CONFLICT (staff_id, day_of_week) DO NOTHING;

INSERT INTO staff_schedules (branch_id, staff_id, day_of_week, day_name, start_time, end_time, break_start, break_end, is_working_day)
SELECT 'b0000000-0000-0000-0000-000000000001',
       'c0000000-0000-0000-0000-000000000002',
       d.day_index,
       d.day_name,
       '06:00:00'::TIME,
       '20:00:00'::TIME,
       '13:30:00'::TIME,
       '14:30:00'::TIME,
       true
FROM (VALUES
    (1, 'Monday'), (2, 'Tuesday'), (3, 'Wednesday'), (4, 'Thursday'), (5, 'Friday'), (6, 'Saturday'), (0, 'Sunday')
) AS d(day_index, day_name)
ON CONFLICT (staff_id, day_of_week) DO NOTHING;

-- 8.3 Assign Services to Barbers
-- Master Kavi (All 8 grooming services)
INSERT INTO staff_services (branch_id, staff_id, service_id, is_primary)
SELECT 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', s.id, true
FROM services s
WHERE s.branch_id = 'b0000000-0000-0000-0000-000000000001'
ON CONFLICT (staff_id, service_id) DO NOTHING;

-- Sunil Shantha (Beard, Haircut, and Combos)
INSERT INTO staff_services (branch_id, staff_id, service_id, is_primary)
SELECT 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', s.id, true
FROM services s
WHERE s.branch_id = 'b0000000-0000-0000-0000-000000000001'
  AND s.code IN ('beard-trim', 'cut-beard', 'adult-cut', 'oil-massage')
ON CONFLICT (staff_id, service_id) DO NOTHING;

