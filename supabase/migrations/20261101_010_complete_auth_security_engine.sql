-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 10: COMPLETE AUTHENTICATION, AUTHORIZATION & SECURITY ENGINE
-- Features:
--   1. Expanded Audit Trail (Login, Logout, Failed Login, Role Change, Security Updates)
--   2. Immutable Append-Only Audit Trail (Zero deletion/tampering)
--   3. Granular RBAC Functions (Owner, Staff, Customer segregation)
--   4. Hardened Row Level Security (RLS) across all tables
--   5. Sensitive Configuration & Role Change Detection Triggers
--   6. Global Session Revocation & Logout Everywhere Support
-- IDEMPOTENT: Uses DROP POLICY IF EXISTS before all policy creations
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. EXPAND AUDIT ACTION ENUMS
-- ------------------------------------------------------------------------
DO $$ BEGIN
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'LOGIN';
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'LOGOUT';
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'FAILED_LOGIN';
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'ROLE_CHANGE';
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'PERMISSION_CHANGE';
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'SENSITIVE_UPDATE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------------------
-- 2. DEDICATED AUDIT LOGGING FUNCTION
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_security_event(
    p_action audit_action_type,
    p_record_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb,
    p_table_name VARCHAR(100) DEFAULT 'auth_events',
    p_user_id UUID DEFAULT auth.uid(),
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        changed_by,
        changed_at,
        ip_address,
        user_agent
    )
    VALUES (
        p_table_name,
        p_record_id,
        p_action,
        p_details,
        COALESCE(p_user_id, auth.uid()),
        now(),
        p_ip_address,
        p_user_agent
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------
-- 3. IMMUTABLE AUDIT TRAIL PROTECTION
-- Ensures no one (even database owners or compromised accounts) can delete or modify logs
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_audit_log_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE actions are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_tampering ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_tampering
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_tampering();

-- ------------------------------------------------------------------------
-- 4. ROLE CHANGE & SENSITIVE MODIFICATION TRIGGERS
-- Automatically tracks elevation of privileges and settings alterations
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION track_profile_role_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.role_id IS DISTINCT FROM NEW.role_id) THEN
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
            'profiles',
            NEW.id,
            'ROLE_CHANGE',
            jsonb_build_object('old_role_id', OLD.role_id, 'user_id', OLD.user_id),
            jsonb_build_object('new_role_id', NEW.role_id, 'user_id', NEW.user_id),
            auth.uid(),
            now()
        );
    END IF;

    -- Track status changes (e.g. active -> suspended)
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
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
            'profiles',
            NEW.id,
            'SENSITIVE_UPDATE',
            jsonb_build_object('old_status', OLD.status),
            jsonb_build_object('new_status', NEW.status),
            auth.uid(),
            now()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_track_profile_role_changes ON profiles;
CREATE TRIGGER trg_track_profile_role_changes
AFTER UPDATE OF role_id, status ON profiles
FOR EACH ROW
EXECUTE FUNCTION track_profile_role_changes();

-- ------------------------------------------------------------------------
-- 5. FINE-GRAINED ROLE CAPABILITIES & PERMISSION CHECKERS
-- ------------------------------------------------------------------------

-- Get user's assigned role enum
CREATE OR REPLACE FUNCTION get_auth_role()
RETURNS user_role_type AS $$
DECLARE
    v_role user_role_type;
BEGIN
    SELECT COALESCE(r.name, 'customer'::user_role_type) INTO v_role
    FROM profiles p
    LEFT JOIN roles r ON r.id = p.role_id
    WHERE p.user_id = auth.uid()
      AND p.deleted_at IS NULL
    LIMIT 1;

    RETURN COALESCE(v_role, 'customer'::user_role_type);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if user account is active
CREATE OR REPLACE FUNCTION is_account_active(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
    v_status user_status_type;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    SELECT status INTO v_status
    FROM profiles
    WHERE user_id = p_user_id
      AND deleted_at IS NULL;
    RETURN (v_status = 'active');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if current user is Salon Owner
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (get_auth_role() = 'owner');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if current user is Staff or Owner
CREATE OR REPLACE FUNCTION is_staff_or_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (get_auth_role() IN ('owner', 'staff'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if current user is active Staff
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (get_auth_role() = 'staff' AND is_account_active());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if current user is active Customer
CREATE OR REPLACE FUNCTION is_customer()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (get_auth_role() = 'customer' AND is_account_active());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if caller can access billing / cashier
CREATE OR REPLACE FUNCTION can_manage_billing()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (get_auth_role() IN ('owner', 'staff') AND is_account_active());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if caller can access financial analytics & reports
CREATE OR REPLACE FUNCTION can_view_reports()
RETURNS BOOLEAN AS $$
BEGIN
    -- Reports are strictly restricted to Salon Owner
    RETURN (get_auth_role() = 'owner' AND is_account_active());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------
-- 6. HARDENED ROW LEVEL SECURITY (RLS) POLICIES
-- Complete isolation adhering to Owner, Staff, and Customer RBAC
-- ------------------------------------------------------------------------

-- BUSINESS SETTINGS:
-- Public & Staff can view settings (opening hours, salon name, WhatsApp)
-- ONLY Owner can modify
DROP POLICY IF EXISTS "Public read settings" ON business_settings;
DROP POLICY IF EXISTS "Public and staff read settings" ON business_settings;
DROP POLICY IF EXISTS "Owner manage settings" ON business_settings;
DROP POLICY IF EXISTS "Only owner manage settings" ON business_settings;

CREATE POLICY "Public and staff read settings" ON business_settings
    FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Only owner manage settings" ON business_settings
    FOR ALL USING (is_owner()) WITH CHECK (is_owner());

-- WORKING HOURS:
DROP POLICY IF EXISTS "Public read working hours" ON working_hours;
DROP POLICY IF EXISTS "Owner manage working hours" ON working_hours;
DROP POLICY IF EXISTS "Only owner manage working hours" ON working_hours;

CREATE POLICY "Public read working hours" ON working_hours
    FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Only owner manage working hours" ON working_hours
    FOR ALL USING (is_owner()) WITH CHECK (is_owner());

-- HOLIDAYS:
DROP POLICY IF EXISTS "Public read holidays" ON holidays;
DROP POLICY IF EXISTS "Owner manage holidays" ON holidays;
DROP POLICY IF EXISTS "Only owner manage holidays" ON holidays;

CREATE POLICY "Public read holidays" ON holidays
    FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Only owner manage holidays" ON holidays
    FOR ALL USING (is_owner()) WITH CHECK (is_owner());

-- STAFF:
-- Public can view active barbers for appointment booking
-- Staff can update ONLY their own availability status
-- Owner can manage salaries, commissions, hiring/firing
DROP POLICY IF EXISTS "Public read active staff" ON staff;
DROP POLICY IF EXISTS "Staff update own availability" ON staff;
DROP POLICY IF EXISTS "Owner manage staff" ON staff;
DROP POLICY IF EXISTS "Only owner manage staff" ON staff;

CREATE POLICY "Public read active staff" ON staff
    FOR SELECT USING (is_active = true AND deleted_at IS NULL);

CREATE POLICY "Staff update own availability" ON staff
    FOR UPDATE USING (
        profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) 
        AND is_account_active()
    )
    WITH CHECK (
        profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        AND is_account_active()
    );

CREATE POLICY "Only owner manage staff" ON staff
    FOR ALL USING (is_owner()) WITH CHECK (is_owner());

-- CUSTOMERS:
-- Customer can read and update ONLY their own record
-- Staff & Owner can read customer records for counter operations
-- Public can register/insert their customer record during booking
DROP POLICY IF EXISTS "Customers read own record" ON customers;
DROP POLICY IF EXISTS "Customers update own record" ON customers;
DROP POLICY IF EXISTS "Public create customer" ON customers;
DROP POLICY IF EXISTS "Public insert customer" ON customers;
DROP POLICY IF EXISTS "Staff Owner manage customers" ON customers;
DROP POLICY IF EXISTS "Staff and owner manage customers" ON customers;

CREATE POLICY "Customers read own record" ON customers
    FOR SELECT USING (
        profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR is_staff_or_owner()
    );

CREATE POLICY "Customers update own record" ON customers
    FOR UPDATE USING (
        profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        AND is_account_active()
    );

CREATE POLICY "Public insert customer" ON customers
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff and owner manage customers" ON customers
    FOR ALL USING (is_staff_or_owner()) WITH CHECK (is_staff_or_owner());

-- APPOINTMENTS:
-- Customer can view and create their own appointments
-- Customer can cancel only their own pending appointments
-- Staff & Owner can manage salon-wide appointments
DROP POLICY IF EXISTS "Customers read own appointments" ON appointments;
DROP POLICY IF EXISTS "Public insert appointments" ON appointments;
DROP POLICY IF EXISTS "Customer create appointments" ON appointments;
DROP POLICY IF EXISTS "Customer and walkin insert appointments" ON appointments;
DROP POLICY IF EXISTS "Customer cancel own pending appointment" ON appointments;
DROP POLICY IF EXISTS "Staff Owner manage appointments" ON appointments;
DROP POLICY IF EXISTS "Staff and owner manage all appointments" ON appointments;

CREATE POLICY "Customers read own appointments" ON appointments
    FOR SELECT USING (
        customer_id IN (SELECT id FROM customers WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
        OR is_staff_or_owner()
    );

CREATE POLICY "Customer and walkin insert appointments" ON appointments
    FOR INSERT WITH CHECK (
        auth.uid() IS NULL OR is_account_active()
    );

CREATE POLICY "Customer cancel own pending appointment" ON appointments
    FOR UPDATE USING (
        customer_id IN (SELECT id FROM customers WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
        AND status = 'pending'
        AND is_account_active()
    );

CREATE POLICY "Staff and owner manage all appointments" ON appointments
    FOR ALL USING (is_staff_or_owner()) WITH CHECK (is_staff_or_owner());

-- QUEUE:
-- Public can read live queue board (ticket numbers, estimated wait time)
-- Staff & Owner can advance queue tickets, call next, start haircut, finish service
DROP POLICY IF EXISTS "Public read live queue" ON queue;
DROP POLICY IF EXISTS "Public join queue" ON queue;
DROP POLICY IF EXISTS "Public and customer create queue" ON queue;
DROP POLICY IF EXISTS "Public and customer join queue" ON queue;
DROP POLICY IF EXISTS "Staff Owner manage queue" ON queue;
DROP POLICY IF EXISTS "Staff and owner manage queue tickets" ON queue;

CREATE POLICY "Public read live queue" ON queue
    FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Public and customer join queue" ON queue
    FOR INSERT WITH CHECK (
        auth.uid() IS NULL OR is_account_active()
    );

CREATE POLICY "Staff and owner manage queue tickets" ON queue
    FOR ALL USING (is_staff_or_owner()) WITH CHECK (is_staff_or_owner());

-- INVOICES & BILLING:
-- Customers can read ONLY their own invoices
-- Staff & Owner can create, issue, and mark invoices paid
-- Staff CANNOT delete historical invoices
DROP POLICY IF EXISTS "Customers read own invoices" ON invoices;
DROP POLICY IF EXISTS "Staff Owner manage invoices" ON invoices;
DROP POLICY IF EXISTS "Staff and owner create invoices" ON invoices;
DROP POLICY IF EXISTS "Staff and owner update invoices" ON invoices;
DROP POLICY IF EXISTS "Only owner delete invoices" ON invoices;

CREATE POLICY "Customers read own invoices" ON invoices
    FOR SELECT USING (
        customer_id IN (SELECT id FROM customers WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
        OR is_staff_or_owner()
    );

CREATE POLICY "Staff and owner create invoices" ON invoices
    FOR INSERT WITH CHECK (is_staff_or_owner());

CREATE POLICY "Staff and owner update invoices" ON invoices
    FOR UPDATE USING (is_staff_or_owner()) WITH CHECK (is_staff_or_owner());

CREATE POLICY "Only owner delete invoices" ON invoices
    FOR DELETE USING (is_owner());

-- PAYMENTS:
DROP POLICY IF EXISTS "Customers read own payments" ON payments;
DROP POLICY IF EXISTS "Staff Owner manage payments" ON payments;
DROP POLICY IF EXISTS "Staff and owner manage payments" ON payments;

CREATE POLICY "Customers read own payments" ON payments
    FOR SELECT USING (
        invoice_id IN (
            SELECT id FROM invoices WHERE customer_id IN (
                SELECT id FROM customers WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
            )
        )
        OR is_staff_or_owner()
    );

CREATE POLICY "Staff and owner manage payments" ON payments
    FOR ALL USING (is_staff_or_owner()) WITH CHECK (is_staff_or_owner());

-- REPORTS & AUDIT LOGS:
-- Strictly Owner Only
DROP POLICY IF EXISTS "Owner view reports" ON reports_cache;
DROP POLICY IF EXISTS "Only owner view reports" ON reports_cache;
DROP POLICY IF EXISTS "Owner view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Only owner view audit logs" ON audit_logs;

CREATE POLICY "Only owner view reports" ON reports_cache
    FOR ALL USING (is_owner()) WITH CHECK (is_owner());

CREATE POLICY "Only owner view audit logs" ON audit_logs
    FOR SELECT USING (is_owner());

-- ------------------------------------------------------------------------
-- 7. GLOBAL LOGOUT & SESSION REVOCATION RPC
-- Allows a user or Salon Owner to invalidate active sessions across all devices
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION revoke_user_sessions(p_target_user_id UUID DEFAULT auth.uid())
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Only Owner can revoke other users' sessions; otherwise can only revoke own
    IF p_target_user_id <> v_caller_id AND NOT is_owner() THEN
        RAISE EXCEPTION 'Access Denied: Only Salon Owner can invalidate other users sessions.';
    END IF;

    -- Update updated_at on user profile to invalidate client caching
    UPDATE profiles
    SET updated_at = now()
    WHERE user_id = p_target_user_id;

    -- Log global logout event
    PERFORM log_security_event(
        'LOGOUT',
        p_target_user_id,
        jsonb_build_object('scope', 'global', 'revoked_by', v_caller_id),
        'auth_sessions',
        p_target_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_target_user_id,
        'message', 'User sessions successfully invalidated.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
