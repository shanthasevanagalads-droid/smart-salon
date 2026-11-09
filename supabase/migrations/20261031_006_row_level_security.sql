-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 06: ROW LEVEL SECURITY (RLS) & ACCESS CONTROL POLICIES
-- Roles: Salon Owner, Staff, Customer
-- IDEMPOTENT: Uses DROP POLICY IF EXISTS before CREATE POLICY
-- GUARANTEED: Synchronizes profiles.user_id, role_id, and foreign keys before applying policies
-- ========================================================================

-- Enable core extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------
-- 0. GUARANTEE SCHEMA CONVERGENCE FOR PROFILES, ROLES & FOREIGN KEYS
-- ------------------------------------------------------------------------
-- 0.1 Roles table and base records
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name user_role_type NOT NULL UNIQUE,
    display_name VARCHAR(50) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

INSERT INTO roles (id, name, display_name, description, permissions)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'owner', 'Salon Owner', 'Full owner access', '["*"]'::jsonb),
    ('22222222-2222-2222-2222-222222222222', 'staff', 'Barber / Staff', 'Staff access', '["queue:*", "appointments:*"]'::jsonb),
    ('33333333-3333-3333-3333-333333333333', 'customer', 'Customer', 'Customer access', '["appointments:create", "queue:join"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- 0.2 Guarantee columns on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE RESTRICT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(25);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(25);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status user_status_type DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Sync legacy profile role to role_id if role exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
        UPDATE profiles p
        SET role_id = r.id
        FROM roles r
        WHERE p.role_id IS NULL AND p.role::text = r.name::text;
    END IF;
    UPDATE profiles SET role_id = '33333333-3333-3333-3333-333333333333' WHERE role_id IS NULL;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
        UPDATE profiles SET phone_number = phone WHERE phone_number IS NULL;
    END IF;
END $$;

-- 0.3 Guarantee profile_id & references on dependent tables
ALTER TABLE staff ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS active_status BOOLEAN DEFAULT true;

-- Enable RLS across all 26 tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE walk_in_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------
-- SECURITY HELPER FUNCTIONS
-- ------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_auth_role()
RETURNS user_role_type AS $$
DECLARE
    v_role user_role_type;
BEGIN
    SELECT COALESCE(r.name, 'customer'::user_role_type) INTO v_role
    FROM profiles p
    LEFT JOIN roles r ON r.id = p.role_id
    WHERE p.user_id = auth.uid()
    LIMIT 1;

    RETURN COALESCE(v_role, 'customer'::user_role_type);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (get_auth_role() = 'owner');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_staff_or_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (get_auth_role() IN ('owner', 'staff'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------
-- 1. BRANCHES POLICIES
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read active branches" ON branches;
CREATE POLICY "Public read active branches" ON branches
    FOR SELECT USING (is_active = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Owner manage branches" ON branches;
CREATE POLICY "Owner manage branches" ON branches
    FOR ALL USING (is_owner());

-- ------------------------------------------------------------------------
-- 2. ROLES POLICIES
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read roles" ON roles;
CREATE POLICY "Public read roles" ON roles
    FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Owner manage roles" ON roles;
CREATE POLICY "Owner manage roles" ON roles
    FOR ALL USING (is_owner());

-- ------------------------------------------------------------------------
-- 3. PROFILES POLICIES
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
CREATE POLICY "Users read own profile" ON profiles
    FOR SELECT USING (user_id = auth.uid() OR is_staff_or_owner());

DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff Owner manage profiles" ON profiles;
CREATE POLICY "Staff Owner manage profiles" ON profiles
    FOR ALL USING (is_staff_or_owner());

-- ------------------------------------------------------------------------
-- 4. STAFF POLICIES
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read active staff" ON staff;
CREATE POLICY "Public read active staff" ON staff
    FOR SELECT USING (is_active = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Staff update own availability" ON staff;
CREATE POLICY "Staff update own availability" ON staff
    FOR UPDATE USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR is_owner());

DROP POLICY IF EXISTS "Owner manage staff" ON staff;
CREATE POLICY "Owner manage staff" ON staff
    FOR ALL USING (is_owner());

-- ------------------------------------------------------------------------
-- 5. SERVICES POLICIES
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read active services" ON services;
CREATE POLICY "Public read active services" ON services
    FOR SELECT USING (active_status = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Owner manage services" ON services;
CREATE POLICY "Owner manage services" ON services
    FOR ALL USING (is_owner());

-- ------------------------------------------------------------------------
-- 6. CUSTOMERS POLICIES
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers read own record" ON customers;
CREATE POLICY "Customers read own record" ON customers
    FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR is_staff_or_owner());

DROP POLICY IF EXISTS "Customers update own record" ON customers;
CREATE POLICY "Customers update own record" ON customers
    FOR UPDATE USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Public create customer" ON customers;
CREATE POLICY "Public create customer" ON customers
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Staff Owner manage customers" ON customers;
CREATE POLICY "Staff Owner manage customers" ON customers
    FOR ALL USING (is_staff_or_owner());

-- ------------------------------------------------------------------------
-- 7. APPOINTMENTS POLICIES
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers read own appointments" ON appointments;
CREATE POLICY "Customers read own appointments" ON appointments
    FOR SELECT USING (
        customer_id IN (SELECT id FROM customers WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
        OR is_staff_or_owner()
    );

DROP POLICY IF EXISTS "Public insert appointments" ON appointments;
CREATE POLICY "Public insert appointments" ON appointments
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Staff Owner manage appointments" ON appointments;
CREATE POLICY "Staff Owner manage appointments" ON appointments
    FOR ALL USING (is_staff_or_owner());

-- ------------------------------------------------------------------------
-- 8. APPOINTMENT_SERVICES POLICIES
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Read appointment services" ON appointment_services;
CREATE POLICY "Read appointment services" ON appointment_services
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insert appointment services" ON appointment_services;
CREATE POLICY "Insert appointment services" ON appointment_services
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Owner staff manage appointment services" ON appointment_services;
CREATE POLICY "Owner staff manage appointment services" ON appointment_services
    FOR ALL USING (is_staff_or_owner());

-- ------------------------------------------------------------------------
-- 9. WALK_IN_CUSTOMERS POLICIES
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff Owner manage walk ins" ON walk_in_customers;
CREATE POLICY "Staff Owner manage walk ins" ON walk_in_customers
    FOR ALL USING (true);

-- ------------------------------------------------------------------------
-- 10. QUEUE POLICIES (Live Public Waitboard)
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read live queue" ON queue;
CREATE POLICY "Public read live queue" ON queue
    FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Public join queue" ON queue;
CREATE POLICY "Public join queue" ON queue
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Staff Owner manage queue" ON queue;
CREATE POLICY "Staff Owner manage queue" ON queue
    FOR ALL USING (is_staff_or_owner());

-- ------------------------------------------------------------------------
-- 11. INVOICES & INVOICE_ITEMS POLICIES
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers read own invoices" ON invoices;
CREATE POLICY "Customers read own invoices" ON invoices
    FOR SELECT USING (
        customer_id IN (SELECT id FROM customers WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
        OR is_staff_or_owner()
    );

DROP POLICY IF EXISTS "Staff Owner manage invoices" ON invoices;
CREATE POLICY "Staff Owner manage invoices" ON invoices
    FOR ALL USING (is_staff_or_owner());

DROP POLICY IF EXISTS "Read invoice items" ON invoice_items;
CREATE POLICY "Read invoice items" ON invoice_items
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff Owner manage invoice items" ON invoice_items;
CREATE POLICY "Staff Owner manage invoice items" ON invoice_items
    FOR ALL USING (is_staff_or_owner());

-- ------------------------------------------------------------------------
-- 12. PAYMENTS POLICIES
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers read own payments" ON payments;
CREATE POLICY "Customers read own payments" ON payments
    FOR SELECT USING (
        invoice_id IN (
            SELECT id FROM invoices WHERE customer_id IN (
                SELECT id FROM customers WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
            )
        )
        OR is_staff_or_owner()
    );

DROP POLICY IF EXISTS "Staff Owner manage payments" ON payments;
CREATE POLICY "Staff Owner manage payments" ON payments
    FOR ALL USING (is_staff_or_owner());

-- ------------------------------------------------------------------------
-- 13. SETTINGS, WORKING_HOURS & HOLIDAYS
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read settings" ON business_settings;
CREATE POLICY "Public read settings" ON business_settings
    FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Owner manage settings" ON business_settings;
CREATE POLICY "Owner manage settings" ON business_settings
    FOR ALL USING (is_owner());

DROP POLICY IF EXISTS "Public read working hours" ON working_hours;
CREATE POLICY "Public read working hours" ON working_hours
    FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Owner manage working hours" ON working_hours;
CREATE POLICY "Owner manage working hours" ON working_hours
    FOR ALL USING (is_owner());

DROP POLICY IF EXISTS "Public read holidays" ON holidays;
CREATE POLICY "Public read holidays" ON holidays
    FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Owner manage holidays" ON holidays;
CREATE POLICY "Owner manage holidays" ON holidays
    FOR ALL USING (is_owner());

-- ------------------------------------------------------------------------
-- 14. NOTIFICATIONS & WHATSAPP_LOGS
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
CREATE POLICY "Users read own notifications" ON notifications
    FOR SELECT USING (
        user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR is_staff_or_owner()
    );

DROP POLICY IF EXISTS "Staff Owner manage notifications" ON notifications;
CREATE POLICY "Staff Owner manage notifications" ON notifications
    FOR ALL USING (is_staff_or_owner());

DROP POLICY IF EXISTS "Staff Owner view whatsapp logs" ON whatsapp_logs;
CREATE POLICY "Staff Owner view whatsapp logs" ON whatsapp_logs
    FOR ALL USING (is_staff_or_owner());

-- ------------------------------------------------------------------------
-- 15. REPORTS & AUDIT LOGS (Owner Only)
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owner view reports" ON reports_cache;
CREATE POLICY "Owner view reports" ON reports_cache
    FOR ALL USING (is_owner());

DROP POLICY IF EXISTS "Owner view audit logs" ON audit_logs;
CREATE POLICY "Owner view audit logs" ON audit_logs
    FOR ALL USING (is_owner());

-- ------------------------------------------------------------------------
-- 16. FUTURE TABLES POLICIES (Memberships, Loyalty, Inventory, Expenses)
-- ------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff Owner manage inventory" ON inventory;
CREATE POLICY "Staff Owner manage inventory" ON inventory FOR ALL USING (is_staff_or_owner());

DROP POLICY IF EXISTS "Staff Owner manage suppliers" ON suppliers;
CREATE POLICY "Staff Owner manage suppliers" ON suppliers FOR ALL USING (is_staff_or_owner());

DROP POLICY IF EXISTS "Staff Owner manage purchases" ON purchases;
CREATE POLICY "Staff Owner manage purchases" ON purchases FOR ALL USING (is_staff_or_owner());

DROP POLICY IF EXISTS "Owner manage expenses" ON expenses;
CREATE POLICY "Owner manage expenses" ON expenses FOR ALL USING (is_owner());

DROP POLICY IF EXISTS "Read memberships" ON memberships;
CREATE POLICY "Read memberships" ON memberships FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner manage memberships" ON memberships;
CREATE POLICY "Owner manage memberships" ON memberships FOR ALL USING (is_owner());

DROP POLICY IF EXISTS "Read loyalty points" ON loyalty_points;
CREATE POLICY "Read loyalty points" ON loyalty_points FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner manage loyalty points" ON loyalty_points;
CREATE POLICY "Owner manage loyalty points" ON loyalty_points FOR ALL USING (is_owner());
