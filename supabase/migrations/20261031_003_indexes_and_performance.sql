-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 03: INDEXES & PERFORMANCE OPTIMIZATION
-- Optimized for high-throughput mobile POS, realtime queue polling & low latency
-- IDEMPOTENT: Guarantees branch_id, deleted_at and all indexed columns exist before indexing
-- ========================================================================

-- Enable core extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ------------------------------------------------------------------------
-- 0. GUARANTEE BRANCHES TABLE & DEFAULT BRANCH EXISTENCE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_number VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    sinhala_name VARCHAR(200),
    slug VARCHAR(100) NOT NULL UNIQUE,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Kiribathgoda',
    district VARCHAR(50) NOT NULL DEFAULT 'Gampaha',
    phone VARCHAR(25) NOT NULL,
    whatsapp_number VARCHAR(25) NOT NULL,
    email VARCHAR(100),
    is_main_branch BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

INSERT INTO branches (id, branch_number, name, sinhala_name, slug, address, city, district, phone, whatsapp_number, email, is_main_branch, is_active)
VALUES ('b0000000-0000-0000-0000-000000000001', 'BR-001', 'Smart Salon LK - Kiribathgoda', 'ස්මාර්ට් සැලූන් - කිරිබත්ගොඩ', 'smart-salon-kiribathgoda', 'No. 42, Kandy Road, Kiribathgoda (Opposite Keells Super)', 'Kiribathgoda', 'Gampaha', '+94112918844', '+94770000000', 'info@smartsallon.lk', true, true)
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------------------
-- 0.1 GUARANTEE branch_id COLUMN ON ALL TABLES
-- ------------------------------------------------------------------------
DO $$
BEGIN
    ALTER TABLE queue ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
    ALTER TABLE staff ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
    ALTER TABLE services ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
    ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
    ALTER TABLE working_hours ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
    ALTER TABLE holidays ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
    ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
    ALTER TABLE reports_cache ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- Backfill NULL branch_ids with default branch
DO $$
BEGIN
    UPDATE queue SET branch_id = 'b0000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;
    UPDATE appointments SET branch_id = 'b0000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;
    UPDATE invoices SET branch_id = 'b0000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;
    UPDATE customers SET branch_id = 'b0000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;
    UPDATE payments SET branch_id = 'b0000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;
    UPDATE staff SET branch_id = 'b0000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;
    UPDATE services SET branch_id = 'b0000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;
    UPDATE reports_cache SET branch_id = 'b0000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- ------------------------------------------------------------------------
-- 0.2 GUARANTEE deleted_at COLUMN INTEGRITY
-- ------------------------------------------------------------------------
DO $$
BEGIN
    ALTER TABLE queue ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE staff ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE services ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE reports_cache ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- ------------------------------------------------------------------------
-- 0.3 GUARANTEE APPOINTMENTS SCHEMA CONVERGENCE (appointment_time, expected_end_time, appointment_number)
-- ------------------------------------------------------------------------
DO $$
BEGIN
    -- 1. appointment_time
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_time TIME;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'start_time') THEN
        EXECUTE 'UPDATE appointments SET appointment_time = start_time WHERE appointment_time IS NULL';
    END IF;
    UPDATE appointments SET appointment_time = '09:00:00'::TIME WHERE appointment_time IS NULL;

    -- Also guarantee start_time exists for reverse compatibility
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS start_time TIME;
    UPDATE appointments SET start_time = appointment_time WHERE start_time IS NULL;

    -- 2. expected_end_time
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS expected_end_time TIME;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'end_time') THEN
        EXECUTE 'UPDATE appointments SET expected_end_time = end_time WHERE expected_end_time IS NULL';
    END IF;
    UPDATE appointments SET expected_end_time = (appointment_time + interval '30 minutes')::TIME WHERE expected_end_time IS NULL;

    -- Also guarantee end_time exists for reverse compatibility
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS end_time TIME;
    UPDATE appointments SET end_time = expected_end_time WHERE end_time IS NULL;

    -- 3. appointment_number
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_number VARCHAR(40);
    UPDATE appointments 
    SET appointment_number = 'APT-' || to_char(created_at, 'YYYYMMDD') || '-' || SUBSTRING(id::text, 1, 6)
    WHERE appointment_number IS NULL;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- ------------------------------------------------------------------------
-- 0.4 GUARANTEE CUSTOMERS SCHEMA CONVERGENCE (mobile, name, customer_number, whatsapp)
-- ------------------------------------------------------------------------
DO $$
BEGIN
    -- 1. mobile & phone
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS mobile VARCHAR(25);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'phone') THEN
        EXECUTE 'UPDATE customers SET mobile = phone WHERE mobile IS NULL';
    END IF;

    ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone VARCHAR(25);
    UPDATE customers SET phone = mobile WHERE phone IS NULL;

    -- 2. whatsapp
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(25);
    UPDATE customers SET whatsapp = mobile WHERE whatsapp IS NULL;

    -- 3. name & full_name
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS name VARCHAR(150);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'full_name') THEN
        EXECUTE 'UPDATE customers SET name = full_name WHERE name IS NULL';
    END IF;

    ALTER TABLE customers ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);
    UPDATE customers SET full_name = name WHERE full_name IS NULL;

    -- 4. customer_number
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_number VARCHAR(30);
    WITH numbered AS (
        SELECT id, 'CUST-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 5, '0') AS gen_num
        FROM customers
        WHERE customer_number IS NULL
    )
    UPDATE customers c
    SET customer_number = n.gen_num
    FROM numbered n
    WHERE c.id = n.id AND c.customer_number IS NULL;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- ------------------------------------------------------------------------
-- 0.5 GUARANTEE SERVICES SCHEMA CONVERGENCE (active_status, display_order)
-- ------------------------------------------------------------------------
DO $$
BEGIN
    ALTER TABLE services ADD COLUMN IF NOT EXISTS active_status BOOLEAN DEFAULT true;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'is_active') THEN
        EXECUTE 'UPDATE services SET active_status = is_active WHERE active_status IS NULL';
    END IF;
    UPDATE services SET active_status = true WHERE active_status IS NULL;

    ALTER TABLE services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    UPDATE services SET is_active = active_status WHERE is_active IS NULL;

    ALTER TABLE services ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 1;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'sort_order') THEN
        EXECUTE 'UPDATE services SET display_order = sort_order WHERE display_order IS NULL';
    END IF;
    UPDATE services SET display_order = 1 WHERE display_order IS NULL;

    ALTER TABLE services ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 1;
    UPDATE services SET sort_order = display_order WHERE sort_order IS NULL;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- ------------------------------------------------------------------------
-- 0.6 GUARANTEE PAYMENTS SCHEMA CONVERGENCE (paid_time, reference_number)
-- ------------------------------------------------------------------------
DO $$
BEGIN
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_time TIMESTAMPTZ DEFAULT now();
    UPDATE payments SET paid_time = now() WHERE paid_time IS NULL;

    ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_number VARCHAR(60);
    UPDATE payments 
    SET reference_number = 'PAY-' || to_char(created_at, 'YYYYMMDD') || '-' || SUBSTRING(id::text, 1, 6)
    WHERE reference_number IS NULL;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- ------------------------------------------------------------------------
-- 0.7 GUARANTEE WHATSAPP_LOGS SCHEMA CONVERGENCE (recipient, timestamp)
-- ------------------------------------------------------------------------
DO $$
BEGIN
    ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS recipient VARCHAR(25);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'recipient_phone') THEN
        EXECUTE 'UPDATE whatsapp_logs SET recipient = recipient_phone WHERE recipient IS NULL';
    END IF;

    ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(25);
    UPDATE whatsapp_logs SET recipient_phone = recipient WHERE recipient_phone IS NULL;

    ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT now();
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'created_at') THEN
        EXECUTE 'UPDATE whatsapp_logs SET timestamp = created_at WHERE timestamp IS NULL';
    END IF;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

-- ------------------------------------------------------------------------
-- 1. QUEUE TABLE INDEXES (Hot path for real-time customer polling)
-- ------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_queue_live_polling 
    ON queue (branch_id, queue_date, status, queue_number) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_queue_active_waiting 
    ON queue (branch_id, queue_date, priority) 
    WHERE status IN ('waiting', 'called', 'in_chair') AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_queue_ticket_code 
    ON queue (ticket_code) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_queue_customer 
    ON queue (customer_id) 
    WHERE customer_id IS NOT NULL;

-- ------------------------------------------------------------------------
-- 2. APPOINTMENTS TABLE INDEXES
-- ------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_appointments_schedule 
    ON appointments (branch_id, appointment_date, appointment_time, status) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_barber_date 
    ON appointments (barber_id, appointment_date, status) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_customer 
    ON appointments (customer_id, appointment_date DESC) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_number 
    ON appointments (appointment_number);

-- ------------------------------------------------------------------------
-- 3. INVOICES TABLE INDEXES
-- ------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_daily_sales 
    ON invoices (branch_id, created_at, payment_status) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_customer 
    ON invoices (customer_id, created_at DESC) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_barcode 
    ON invoices (barcode_value);

CREATE INDEX IF NOT EXISTS idx_invoices_number 
    ON invoices (invoice_number);

-- ------------------------------------------------------------------------
-- 4. CUSTOMERS TABLE INDEXES (Fast lookups during appointment booking & POS)
-- ------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customers_branch_mobile 
    ON customers (branch_id, mobile) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_number 
    ON customers (customer_number);

-- PostgreSQL Trigram index for fuzzy searching Sri Lankan customer names (e.g., Nuwan, Kasun, Dinesh)
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm 
    ON customers USING gin (name gin_trgm_ops) 
    WHERE deleted_at IS NULL;

-- ------------------------------------------------------------------------
-- 5. PAYMENTS TABLE INDEXES
-- ------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payments_invoice 
    ON payments (invoice_id, status) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_audit_method 
    ON payments (branch_id, payment_method, paid_time DESC) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_reference 
    ON payments (reference_number);

-- ------------------------------------------------------------------------
-- 6. STAFF & SERVICES INDEXES
-- ------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_staff_active_chair 
    ON staff (branch_id, chair_number, availability) 
    WHERE is_active = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_services_catalog_display 
    ON services (branch_id, active_status, display_order) 
    WHERE deleted_at IS NULL;

-- ------------------------------------------------------------------------
-- 7. NOTIFICATIONS & AUDIT INDEXES
-- ------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_customer_pending 
    ON notifications (customer_id, status, created_at DESC) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_recipient 
    ON whatsapp_logs (recipient, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_record 
    ON audit_logs (table_name, record_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_cache_lookup 
    ON reports_cache (branch_id, report_type, report_date, report_period);
