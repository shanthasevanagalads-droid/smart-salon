-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 05: TRIGGERS & AUDIT LOG AUTOMATION
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. UNIVERSAL TIMESTAMP UPDATE FUNCTION
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply set_updated_at across all 26 tables
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'branches', 'roles', 'profiles', 'staff', 'customers', 'services',
        'appointments', 'appointment_services', 'walk_in_customers', 'queue',
        'invoices', 'invoice_items', 'payments', 'business_settings',
        'working_hours', 'holidays', 'notifications', 'whatsapp_logs',
        'reports_cache', 'audit_logs', 'memberships', 'loyalty_points',
        'inventory', 'suppliers', 'purchases', 'expenses'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_set_updated_at_%I ON %I;
            CREATE TRIGGER trg_set_updated_at_%I
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION set_updated_at();
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END;
$$;

-- ------------------------------------------------------------------------
-- 2. UNIVERSAL AUDIT TRAIL LOGGING TRIGGER
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_trail_logger()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_record_id UUID := NULL;
BEGIN
    -- Extract active Supabase authenticated user if available
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF (TG_OP = 'DELETE') THEN
        v_record_id := OLD.id;
        v_old_data := to_jsonb(OLD);
    ELSIF (TG_OP = 'UPDATE') THEN
        v_record_id := NEW.id;
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
    ELSIF (TG_OP = 'INSERT') THEN
        v_record_id := NEW.id;
        v_new_data := to_jsonb(NEW);
    END IF;

    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_by,
        changed_at
    )
    VALUES (
        TG_TABLE_NAME,
        v_record_id,
        TG_OP::audit_action_type,
        v_old_data,
        v_new_data,
        v_user_id,
        now()
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit trigger on high-security transactional tables
DO $$
DECLARE
    tbl text;
    audit_tables text[] := ARRAY[
        'invoices', 'payments', 'appointments', 'queue', 
        'customers', 'staff', 'business_settings', 'expenses'
    ];
BEGIN
    FOREACH tbl IN ARRAY audit_tables
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_audit_%I ON %I;
            CREATE TRIGGER trg_audit_%I
            AFTER INSERT OR UPDATE OR DELETE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION audit_trail_logger();
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END;
$$;

-- ------------------------------------------------------------------------
-- 3. AUTO-GENERATE CUSTOMER NUMBER (CUST-00001)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_generate_customer_number()
RETURNS TRIGGER AS $$
DECLARE
    v_seq INTEGER;
BEGIN
    IF NEW.customer_number IS NULL OR NEW.customer_number = '' THEN
        SELECT COALESCE(COUNT(*), 0) + 1
        INTO v_seq
        FROM customers
        WHERE branch_id = NEW.branch_id;

        NEW.customer_number := 'CUST-' || LPAD(v_seq::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_customer_number ON customers;
CREATE TRIGGER trg_auto_customer_number
BEFORE INSERT ON customers
FOR EACH ROW
EXECUTE FUNCTION auto_generate_customer_number();

-- ------------------------------------------------------------------------
-- 4. AUTO-GENERATE STAFF NUMBER (STF-001)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_generate_staff_number()
RETURNS TRIGGER AS $$
DECLARE
    v_seq INTEGER;
BEGIN
    IF NEW.staff_number IS NULL OR NEW.staff_number = '' THEN
        SELECT COALESCE(COUNT(*), 0) + 1
        INTO v_seq
        FROM staff
        WHERE branch_id = NEW.branch_id;

        NEW.staff_number := 'STF-' || LPAD(v_seq::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_staff_number ON staff;
CREATE TRIGGER trg_auto_staff_number
BEFORE INSERT ON staff
FOR EACH ROW
EXECUTE FUNCTION auto_generate_staff_number();

-- ------------------------------------------------------------------------
-- 5. AUTO-GENERATE APPOINTMENT NUMBER & EXPECTED END TIME
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_prepare_appointment()
RETURNS TRIGGER AS $$
DECLARE
    v_seq INTEGER;
    v_date_str VARCHAR(8);
    v_primary_duration INTEGER := 30;
BEGIN
    v_date_str := TO_CHAR(NEW.appointment_date, 'YYYYMMDD');

    -- Auto-generate appointment number if missing
    IF NEW.appointment_number IS NULL OR NEW.appointment_number = '' THEN
        SELECT COALESCE(COUNT(*), 0) + 1
        INTO v_seq
        FROM appointments
        WHERE branch_id = NEW.branch_id
          AND appointment_date = NEW.appointment_date;

        NEW.appointment_number := 'APT-' || v_date_str || '-' || LPAD(v_seq::TEXT, 4, '0');
    END IF;

    -- Calculate expected_end_time if not supplied
    IF NEW.expected_end_time IS NULL OR NEW.expected_end_time <= NEW.appointment_time THEN
        NEW.expected_end_time := NEW.appointment_time + (v_primary_duration || ' minutes')::INTERVAL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_appointment ON appointments;
CREATE TRIGGER trg_auto_appointment
BEFORE INSERT ON appointments
FOR EACH ROW
EXECUTE FUNCTION auto_prepare_appointment();

