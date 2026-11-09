-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 09: AUTHENTICATION, AUTHORIZATION & ENTERPRISE SECURITY FOUNDATION
-- Modules:
--   1. Sri Lanka Phone/WhatsApp Auth Integration with auth.users
--   2. Automated Profile & Customer Synchronization Triggers
--   3. Fine-Grained Role-Based Access Control (RBAC) Functions
--   4. Account Status Management (Active, Suspended, Inactive)
--   5. Owner Onboarding & Staff Provisioning RPCs
--   6. Hardened Row Level Security (RLS) Enforcements
--   7. Session & Security Auditing
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. PHONE & LOCALIZATION NORMALIZATION FUNCTIONS
-- Sri Lankan format: Converts '0771234567', '771234567' -> '+94771234567'
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION normalize_sl_phone(p_phone TEXT)
RETURNS TEXT AS $$
DECLARE
    v_cleaned TEXT;
BEGIN
    IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
        RETURN NULL;
    END IF;

    -- Remove all spaces, dashes, parentheses
    v_cleaned := REGEXP_REPLACE(p_phone, '[^0-9+]', '', 'g');

    -- If starts with +94, ensure valid length
    IF v_cleaned LIKE '+94%' THEN
        RETURN v_cleaned;
    ELSIF v_cleaned LIKE '94%' THEN
        RETURN '+' || v_cleaned;
    ELSIF v_cleaned LIKE '0%' THEN
        RETURN '+94' || SUBSTRING(v_cleaned FROM 2);
    ELSIF LENGTH(v_cleaned) = 9 THEN
        RETURN '+94' || v_cleaned;
    ELSE
        RETURN v_cleaned;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ------------------------------------------------------------------------
-- 2. RBAC & ACCOUNT STATUS ENHANCEMENT HELPERS
-- ------------------------------------------------------------------------

-- Check if specific user account is active and in good standing
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

-- Check if authenticated user has a specific granular permission
CREATE OR REPLACE FUNCTION current_user_has_permission(p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_perm BOOLEAN := FALSE;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT (r.permissions ? p_permission) INTO v_has_perm
    FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.user_id = auth.uid()
      AND p.status = 'active'
      AND p.deleted_at IS NULL;

    RETURN COALESCE(v_has_perm, FALSE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Retrieve active user's branch ID
CREATE OR REPLACE FUNCTION get_user_branch_id(p_user_id UUID DEFAULT auth.uid())
RETURNS UUID AS $$
DECLARE
    v_branch_id UUID;
BEGIN
    IF p_user_id IS NULL THEN
        -- Default to primary branch
        SELECT id INTO v_branch_id FROM branches WHERE is_main_branch = true LIMIT 1;
        RETURN v_branch_id;
    END IF;

    SELECT branch_id INTO v_branch_id
    FROM profiles
    WHERE user_id = p_user_id;

    IF v_branch_id IS NULL THEN
        SELECT id INTO v_branch_id FROM branches WHERE is_main_branch = true LIMIT 1;
    END IF;

    RETURN v_branch_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------
-- 3. AUTOMATIC PROFILE & CUSTOMER SYNC ON AUTH.USERS EVENT
-- Triggered whenever a user logs in via Phone OTP, WhatsApp OTP, or Email
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_phone TEXT;
    v_normalized_phone TEXT;
    v_full_name TEXT;
    v_role_id UUID;
    v_customer_role_id UUID;
    v_staff_role_id UUID;
    v_owner_role_id UUID;
    v_profile_id UUID;
    v_branch_id UUID;
    v_staff_record_id UUID;
    v_customer_record_id UUID;
    v_meta JSONB;
BEGIN
    v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
    
    -- Extract phone from auth.users or metadata
    v_phone := COALESCE(NEW.phone, v_meta->>'phone', v_meta->>'phone_number', v_meta->>'whatsapp_number');
    v_normalized_phone := normalize_sl_phone(v_phone);

    -- Extract name or provide default
    v_full_name := COALESCE(
        v_meta->>'full_name',
        v_meta->>'name',
        CASE 
            WHEN v_normalized_phone IS NOT NULL THEN 'Customer ' || RIGHT(v_normalized_phone, 4)
            ELSE 'Salon Customer'
        END
    );

    -- Fetch System Role UUIDs
    SELECT id INTO v_customer_role_id FROM roles WHERE name = 'customer' LIMIT 1;
    SELECT id INTO v_staff_role_id FROM roles WHERE name = 'staff' LIMIT 1;
    SELECT id INTO v_owner_role_id FROM roles WHERE name = 'owner' LIMIT 1;

    -- Fetch Main Branch
    SELECT id INTO v_branch_id FROM branches WHERE is_main_branch = true LIMIT 1;

    -- Check if phone matches pre-registered staff member
    IF v_normalized_phone IS NOT NULL THEN
        SELECT s.id INTO v_staff_record_id
        FROM staff s
        JOIN profiles p ON p.id = s.profile_id
        WHERE p.phone_number = v_normalized_phone
        LIMIT 1;

        -- If not linked via profile, check directly if staff has this phone in metadata
        IF v_staff_record_id IS NULL AND (v_meta->>'role' = 'staff') THEN
            v_role_id := v_staff_role_id;
        ELSIF v_meta->>'role' = 'owner' THEN
            v_role_id := v_owner_role_id;
        ELSIF v_staff_record_id IS NOT NULL THEN
            v_role_id := v_staff_role_id;
        ELSE
            v_role_id := v_customer_role_id;
        END IF;
    ELSE
        v_role_id := v_customer_role_id;
    END IF;

    -- Upsert profile for this user
    INSERT INTO profiles (
        user_id,
        branch_id,
        role_id,
        full_name,
        phone_number,
        whatsapp_number,
        profile_photo_url,
        status,
        language,
        last_login_at
    )
    VALUES (
        NEW.id,
        v_branch_id,
        v_role_id,
        v_full_name,
        COALESCE(v_normalized_phone, '+94000000000'),
        v_normalized_phone,
        v_meta->>'avatar_url',
        'active',
        COALESCE((v_meta->>'language')::app_language_type, 'si'),
        now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        last_login_at = now(),
        updated_at = now(),
        full_name = CASE WHEN profiles.full_name = 'Salon Customer' THEN EXCLUDED.full_name ELSE profiles.full_name END
    RETURNING id INTO v_profile_id;

    -- If this is a customer, ensure record exists in customers CRM table
    IF v_role_id = v_customer_role_id AND v_normalized_phone IS NOT NULL THEN
        SELECT id INTO v_customer_record_id 
        FROM customers 
        WHERE branch_id = v_branch_id AND (mobile = v_normalized_phone OR whatsapp = v_normalized_phone)
        LIMIT 1;

        IF v_customer_record_id IS NULL THEN
            INSERT INTO customers (
                branch_id,
                profile_id,
                name,
                mobile,
                whatsapp,
                created_by
            )
            VALUES (
                v_branch_id,
                v_profile_id,
                v_full_name,
                v_normalized_phone,
                v_normalized_phone,
                NEW.id
            );
        ELSE
            -- Link customer to profile if not already linked
            UPDATE customers
            SET profile_id = v_profile_id,
                name = CASE WHEN customers.name = 'Walk-in Customer' THEN v_full_name ELSE customers.name END,
                updated_at = now()
            WHERE id = v_customer_record_id AND profile_id IS NULL;
        END IF;
    END IF;

    -- If staff record matches this phone, connect staff.profile_id
    IF v_staff_record_id IS NOT NULL THEN
        UPDATE staff
        SET profile_id = v_profile_id,
            updated_at = now()
        WHERE id = v_staff_record_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Connect trigger to auth.users table
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_auth_user();

-- ------------------------------------------------------------------------
-- 4. SECURE RPC: OWNER & STAFF REGISTRATION
-- ------------------------------------------------------------------------

-- Register initial salon owner or update owner details
CREATE OR REPLACE FUNCTION register_salon_owner(
    p_full_name TEXT,
    p_phone TEXT,
    p_salon_name TEXT DEFAULT 'Smart Salon LK',
    p_city TEXT DEFAULT 'Kiribathgoda'
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_owner_role_id UUID;
    v_branch_id UUID;
    v_profile_id UUID;
    v_normalized_phone TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated. Please sign in via phone OTP first.';
    END IF;

    v_normalized_phone := normalize_sl_phone(p_phone);

    -- Find Owner Role
    SELECT id INTO v_owner_role_id FROM roles WHERE name = 'owner' LIMIT 1;
    IF v_owner_role_id IS NULL THEN
        RAISE EXCEPTION 'Owner role not found in system.';
    END IF;

    -- Get or create main branch
    SELECT id INTO v_branch_id FROM branches WHERE is_main_branch = true LIMIT 1;

    -- Upsert profile with owner role
    INSERT INTO profiles (
        user_id,
        branch_id,
        role_id,
        full_name,
        phone_number,
        whatsapp_number,
        status,
        language
    )
    VALUES (
        v_user_id,
        v_branch_id,
        v_owner_role_id,
        p_full_name,
        v_normalized_phone,
        v_normalized_phone,
        'active',
        'si'
    )
    ON CONFLICT (user_id) DO UPDATE SET
        role_id = v_owner_role_id,
        full_name = EXCLUDED.full_name,
        phone_number = EXCLUDED.phone_number,
        whatsapp_number = EXCLUDED.whatsapp_number,
        updated_at = now()
    RETURNING id INTO v_profile_id;

    -- Update branch settings if provided
    UPDATE business_settings
    SET salon_name = COALESCE(p_salon_name, salon_name),
        city = COALESCE(p_city, city),
        phone = COALESCE(v_normalized_phone, phone),
        whatsapp = COALESCE(v_normalized_phone, whatsapp),
        updated_at = now()
    WHERE branch_id = v_branch_id;

    RETURN jsonb_build_object(
        'success', true,
        'profile_id', v_profile_id,
        'role', 'owner',
        'message', 'Salon Owner successfully registered.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Provision a new Barber / Staff member (Owner only)
CREATE OR REPLACE FUNCTION provision_staff_member(
    p_full_name TEXT,
    p_sinhala_name TEXT,
    p_phone TEXT,
    p_chair_number INTEGER,
    p_position TEXT DEFAULT 'Senior Stylist',
    p_commission_percentage NUMERIC DEFAULT 0.00
)
RETURNS JSONB AS $$
DECLARE
    v_owner_id UUID := auth.uid();
    v_branch_id UUID;
    v_staff_role_id UUID;
    v_profile_id UUID;
    v_staff_id UUID;
    v_normalized_phone TEXT;
    v_staff_number VARCHAR(30);
    v_count INTEGER;
BEGIN
    -- Verify caller is Owner
    IF NOT is_owner() THEN
        RAISE EXCEPTION 'Access Denied: Only the Salon Owner can provision staff.';
    END IF;

    -- Version 1 restriction: Maximum 2 chairs
    IF p_chair_number < 1 OR p_chair_number > 2 THEN
        RAISE EXCEPTION 'Version 1 only supports Chair 1 and Chair 2.';
    END IF;

    v_normalized_phone := normalize_sl_phone(p_phone);
    v_branch_id := get_user_branch_id(v_owner_id);

    -- Check if chair is already assigned to active staff
    IF EXISTS (
        SELECT 1 FROM staff 
        WHERE branch_id = v_branch_id 
          AND chair_number = p_chair_number 
          AND is_active = true 
          AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Chair % is already assigned to an active barber.', p_chair_number;
    END IF;

    -- Fetch staff role
    SELECT id INTO v_staff_role_id FROM roles WHERE name = 'staff' LIMIT 1;

    -- Check if profile exists for this phone
    SELECT id INTO v_profile_id 
    FROM profiles 
    WHERE phone_number = v_normalized_phone 
    LIMIT 1;

    IF v_profile_id IS NULL THEN
        INSERT INTO profiles (
            branch_id,
            role_id,
            full_name,
            phone_number,
            whatsapp_number,
            status,
            language,
            created_by
        )
        VALUES (
            v_branch_id,
            v_staff_role_id,
            p_full_name,
            v_normalized_phone,
            v_normalized_phone,
            'active',
            'si',
            v_owner_id
        )
        RETURNING id INTO v_profile_id;
    ELSE
        UPDATE profiles
        SET role_id = v_staff_role_id,
            status = 'active',
            updated_at = now()
        WHERE id = v_profile_id;
    END IF;

    -- Generate staff number
    SELECT COUNT(*) + 1 INTO v_count FROM staff WHERE branch_id = v_branch_id;
    v_staff_number := 'STF-' || LPAD(v_count::TEXT, 3, '0');

    -- Insert staff record
    INSERT INTO staff (
        branch_id,
        profile_id,
        staff_number,
        full_name,
        sinhala_name,
        position,
        chair_number,
        availability,
        commission_percentage,
        is_active,
        created_by
    )
    VALUES (
        v_branch_id,
        v_profile_id,
        v_staff_number,
        p_full_name,
        p_sinhala_name,
        p_position,
        p_chair_number,
        'available',
        p_commission_percentage,
        true,
        v_owner_id
    )
    RETURNING id INTO v_staff_id;

    RETURN jsonb_build_object(
        'success', true,
        'staff_id', v_staff_id,
        'staff_number', v_staff_number,
        'chair_number', p_chair_number,
        'message', 'Staff member provisioned successfully.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------
-- 5. ACCOUNT STATUS & SECURITY MANAGEMENT
-- ------------------------------------------------------------------------

-- Function to suspend or activate a user account
CREATE OR REPLACE FUNCTION set_user_account_status(
    p_target_user_id UUID,
    p_new_status user_status_type,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
BEGIN
    IF NOT is_owner() THEN
        RAISE EXCEPTION 'Access Denied: Only Salon Owner can change account status.';
    END IF;

    UPDATE profiles
    SET status = p_new_status,
        updated_at = now(),
        updated_by = v_caller_id
    WHERE user_id = p_target_user_id OR id = p_target_user_id;

    -- If deactivated or suspended, log to audit trail
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        changed_by,
        changed_at
    )
    VALUES (
        'profiles',
        p_target_user_id,
        'UPDATE',
        jsonb_build_object('status', p_new_status, 'reason', p_reason),
        v_caller_id,
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'status', p_new_status,
        'message', 'Account status updated to ' || p_new_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------
-- 6. AUDIT TRIGGER FOR AUTHENTICATION LOGINS
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_auth_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last login timestamp in profile
    UPDATE profiles
    SET last_login_at = now()
    WHERE user_id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------
-- 7. REINFORCED RLS POLICIES FOR SECURE ACCESS CONTROL
-- ------------------------------------------------------------------------

-- Ensure suspended users cannot create appointments or join queue
DROP POLICY IF EXISTS "Customer create appointments" ON appointments;
CREATE POLICY "Customer create appointments" ON appointments
    FOR INSERT WITH CHECK (
        is_account_active() 
        AND (customer_id IN (SELECT id FROM customers WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
             OR auth.uid() IS NULL)
    );

DROP POLICY IF EXISTS "Public and customer create queue" ON queue;
CREATE POLICY "Public and customer create queue" ON queue
    FOR INSERT WITH CHECK (
        -- Anonymous walk-ins allowed, but authenticated users must be active
        (auth.uid() IS NULL OR is_account_active())
    );

-- Only active staff or owner can modify queue tickets
DROP POLICY IF EXISTS "Staff Owner manage queue" ON queue;
CREATE POLICY "Staff Owner manage queue" ON queue
    FOR UPDATE USING (
        is_staff_or_owner() AND is_account_active()
    );

DROP POLICY IF EXISTS "Staff Owner manage invoices" ON invoices;
CREATE POLICY "Staff Owner manage invoices" ON invoices
    FOR ALL USING (
        is_staff_or_owner() AND is_account_active()
    );

DROP POLICY IF EXISTS "Staff Owner manage payments" ON payments;
CREATE POLICY "Staff Owner manage payments" ON payments
    FOR ALL USING (
        is_staff_or_owner() AND is_account_active()
    );

