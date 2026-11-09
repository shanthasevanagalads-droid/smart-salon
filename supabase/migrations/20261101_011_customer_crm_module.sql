-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 11: COMPLETE CUSTOMER MANAGEMENT & CRM MODULE
-- Features:
--   1. Schema Enhancements on customers (status, address, language, photo)
--   2. High-Performance Search Indexes (Phone, WhatsApp, Customer No, Trigram Name)
--   3. One Phone = One Customer Deduplication Procedure (upsert_customer)
--   4. Comprehensive Fast Customer Search Engine
--   5. Full Customer Profile & Visit History Query
--   6. CRM Analytics (Most Valuable, Most Frequent, Retention Rates)
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. SCHEMA ENHANCEMENTS ON CUSTOMERS TABLE
-- ------------------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_language app_language_type NOT NULL DEFAULT 'si';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ------------------------------------------------------------------------
-- 2. HIGH-PERFORMANCE CRM INDEXES
-- ------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customers_search_phone ON customers(branch_id, mobile) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_search_whatsapp ON customers(branch_id, whatsapp) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_search_num ON customers(branch_id, customer_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin (name gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_spending ON customers(branch_id, total_spending DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_visits ON customers(branch_id, total_visits DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(branch_id, status) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------------------
-- 3. ONE PHONE = ONE CUSTOMER DEDUPLICATION (UPSERT)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_salon_customer(
    p_branch_id UUID,
    p_name TEXT,
    p_phone TEXT,
    p_whatsapp TEXT DEFAULT NULL,
    p_preferred_barber_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_date_of_birth DATE DEFAULT NULL,
    p_language app_language_type DEFAULT 'si',
    p_status VARCHAR DEFAULT 'active'
)
RETURNS JSONB AS $$
DECLARE
    v_norm_phone TEXT;
    v_norm_whatsapp TEXT;
    v_existing_id UUID;
    v_customer_record RECORD;
    v_is_new BOOLEAN := FALSE;
BEGIN
    -- Normalize Sri Lankan phone numbers
    v_norm_phone := normalize_sl_phone(p_phone);
    IF v_norm_phone IS NULL OR v_norm_phone = '' THEN
        RAISE EXCEPTION 'A valid phone number is required for customer registration.';
    END IF;

    IF p_whatsapp IS NOT NULL AND TRIM(p_whatsapp) <> '' THEN
        v_norm_whatsapp := normalize_sl_phone(p_whatsapp);
    ELSE
        v_norm_whatsapp := v_norm_phone;
    END IF;

    -- Check if customer already exists by phone
    SELECT id INTO v_existing_id
    FROM customers
    WHERE branch_id = p_branch_id
      AND (mobile = v_norm_phone OR whatsapp = v_norm_phone)
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        -- Update existing customer details while preserving transaction history
        UPDATE customers
        SET name = COALESCE(NULLIF(TRIM(p_name), ''), name),
            whatsapp = COALESCE(v_norm_whatsapp, whatsapp),
            preferred_barber_id = COALESCE(p_preferred_barber_id, preferred_barber_id),
            notes = COALESCE(p_notes, notes),
            address = COALESCE(p_address, address),
            date_of_birth = COALESCE(p_date_of_birth, date_of_birth),
            preferred_language = COALESCE(p_language, preferred_language),
            status = COALESCE(p_status, status),
            updated_at = now()
        WHERE id = v_existing_id
        RETURNING * INTO v_customer_record;
    ELSE
        -- Insert brand new customer
        v_is_new := TRUE;
        INSERT INTO customers (
            branch_id,
            name,
            mobile,
            whatsapp,
            preferred_barber_id,
            notes,
            address,
            date_of_birth,
            preferred_language,
            status,
            created_by
        )
        VALUES (
            p_branch_id,
            TRIM(p_name),
            v_norm_phone,
            v_norm_whatsapp,
            p_preferred_barber_id,
            p_notes,
            p_address,
            p_date_of_birth,
            p_language,
            p_status,
            auth.uid()
        )
        RETURNING * INTO v_customer_record;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'is_new', v_is_new,
        'customer', jsonb_build_object(
            'id', v_customer_record.id,
            'customer_number', v_customer_record.customer_number,
            'name', v_customer_record.name,
            'mobile', v_customer_record.mobile,
            'whatsapp', v_customer_record.whatsapp,
            'status', v_customer_record.status,
            'total_visits', v_customer_record.total_visits,
            'total_spending', v_customer_record.total_spending,
            'last_visit', v_customer_record.last_visit,
            'preferred_barber_id', v_customer_record.preferred_barber_id
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------
-- 4. FAST MULTI-ATTRIBUTE CUSTOMER SEARCH
-- Searches by: Customer Number, Mobile, WhatsApp, or Full Name
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_salon_customers(
    p_branch_id UUID,
    p_query TEXT,
    p_status VARCHAR DEFAULT NULL,
    p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
    id UUID,
    customer_number VARCHAR,
    name VARCHAR,
    mobile VARCHAR,
    whatsapp VARCHAR,
    status VARCHAR,
    total_visits INTEGER,
    total_spending NUMERIC,
    last_visit TIMESTAMPTZ,
    preferred_barber_name VARCHAR,
    notes TEXT,
    is_vip BOOLEAN
) AS $$
DECLARE
    v_clean_query TEXT;
    v_phone_query TEXT;
BEGIN
    v_clean_query := TRIM(COALESCE(p_query, ''));
    v_phone_query := REGEXP_REPLACE(v_clean_query, '[^0-9+]', '', 'g');

    RETURN QUERY
    SELECT
        c.id,
        c.customer_number,
        c.name,
        c.mobile,
        c.whatsapp,
        c.status,
        c.total_visits,
        c.total_spending,
        c.last_visit,
        s.full_name AS preferred_barber_name,
        c.notes,
        c.is_vip
    FROM customers c
    LEFT JOIN staff s ON s.id = c.preferred_barber_id
    WHERE c.branch_id = p_branch_id
      AND c.deleted_at IS NULL
      AND (p_status IS NULL OR c.status = p_status)
      AND (
          v_clean_query = ''
          OR c.customer_number ILIKE '%' || v_clean_query || '%'
          OR c.name ILIKE '%' || v_clean_query || '%'
          OR (v_phone_query <> '' AND (c.mobile LIKE '%' || v_phone_query || '%' OR c.whatsapp LIKE '%' || v_phone_query || '%'))
      )
    ORDER BY
        CASE WHEN v_clean_query <> '' AND c.name ILIKE v_clean_query || '%' THEN 1 ELSE 2 END,
        c.total_spending DESC,
        c.total_visits DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------
-- 5. COMPREHENSIVE CUSTOMER DASHBOARD PROFILE & HISTORY
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_customer_dashboard_profile(p_customer_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_customer RECORD;
    v_barber_name VARCHAR;
    v_favourite_service_name VARCHAR;
    v_upcoming_count INTEGER;
    v_completed_count INTEGER;
    v_cancelled_count INTEGER;
    v_visits_history JSONB;
BEGIN
    -- 1. Fetch customer core record
    SELECT c.*, s.full_name AS barber_name
    INTO v_customer
    FROM customers c
    LEFT JOIN staff s ON s.id = c.preferred_barber_id
    WHERE c.id = p_customer_id AND c.deleted_at IS NULL;

    IF v_customer.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Customer not found.');
    END IF;

    -- 2. Appointment counts
    SELECT COUNT(*) INTO v_upcoming_count
    FROM appointments
    WHERE customer_id = p_customer_id
      AND appointment_date >= CURRENT_DATE
      AND status IN ('pending', 'confirmed')
      AND deleted_at IS NULL;

    SELECT COUNT(*) INTO v_completed_count
    FROM appointments
    WHERE customer_id = p_customer_id
      AND status = 'completed'
      AND deleted_at IS NULL;

    SELECT COUNT(*) INTO v_cancelled_count
    FROM appointments
    WHERE customer_id = p_customer_id
      AND status IN ('cancelled', 'no_show')
      AND deleted_at IS NULL;

    -- 3. Favourite service calculation
    SELECT s.name INTO v_favourite_service_name
    FROM appointment_services asrv
    JOIN appointments a ON a.id = asrv.appointment_id
    JOIN services s ON s.id = asrv.service_id
    WHERE a.customer_id = p_customer_id
    GROUP BY s.name
    ORDER BY COUNT(*) DESC
    LIMIT 1;

    -- 4. Detailed Visit & Service History
    SELECT COALESCE(jsonb_agg(v_history), '[]'::jsonb) INTO v_visits_history
    FROM (
        SELECT
            i.id AS invoice_id,
            i.invoice_number,
            i.created_at AS visit_date,
            i.grand_total,
            p.payment_method,
            COALESCE(st.full_name, 'Stylist') AS barber_name,
            COALESCE(
                (SELECT jsonb_agg(item_name) FROM invoice_items WHERE invoice_id = i.id),
                '["Hair Cut"]'::jsonb
            ) AS services
        FROM invoices i
        LEFT JOIN payments p ON p.invoice_id = i.id
        LEFT JOIN staff st ON st.id = i.staff_id
        WHERE i.customer_id = p_customer_id
          AND i.deleted_at IS NULL
        ORDER BY i.created_at DESC
        LIMIT 20
    ) v_history;

    RETURN jsonb_build_object(
        'profile', jsonb_build_object(
            'id', v_customer.id,
            'customer_number', v_customer.customer_number,
            'name', v_customer.name,
            'mobile', v_customer.mobile,
            'whatsapp', v_customer.whatsapp,
            'date_of_birth', v_customer.date_of_birth,
            'address', v_customer.address,
            'preferred_language', v_customer.preferred_language,
            'status', v_customer.status,
            'notes', v_customer.notes,
            'is_vip', v_customer.is_vip,
            'preferred_barber_id', v_customer.preferred_barber_id,
            'preferred_barber_name', v_customer.barber_name,
            'created_at', v_customer.created_at
        ),
        'metrics', jsonb_build_object(
            'total_spending', v_customer.total_spending,
            'total_visits', v_customer.total_visits,
            'last_visit', v_customer.last_visit,
            'upcoming_appointments', v_upcoming_count,
            'completed_visits', v_completed_count,
            'cancelled_visits', v_cancelled_count,
            'favourite_service', COALESCE(v_favourite_service_name, 'Adult Hair Cut')
        ),
        'visit_history', v_visits_history
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------
-- 6. CRM REPORTING & CUSTOMER ANALYTICS
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_crm_customer_analytics(p_branch_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_total_customers INTEGER;
    v_new_this_month INTEGER;
    v_returning_customers INTEGER;
    v_active_count INTEGER;
    v_inactive_count INTEGER;
    v_blocked_count INTEGER;
    v_most_valuable JSONB;
    v_most_frequent JSONB;
BEGIN
    -- Customer Totals
    SELECT COUNT(*) INTO v_total_customers
    FROM customers
    WHERE branch_id = p_branch_id AND deleted_at IS NULL;

    -- New This Month
    SELECT COUNT(*) INTO v_new_this_month
    FROM customers
    WHERE branch_id = p_branch_id
      AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
      AND deleted_at IS NULL;

    -- Returning Customers (2 or more visits)
    SELECT COUNT(*) INTO v_returning_customers
    FROM customers
    WHERE branch_id = p_branch_id
      AND total_visits >= 2
      AND deleted_at IS NULL;

    -- Status Counts
    SELECT COUNT(*) INTO v_active_count FROM customers WHERE branch_id = p_branch_id AND status = 'active' AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_inactive_count FROM customers WHERE branch_id = p_branch_id AND status = 'inactive' AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_blocked_count FROM customers WHERE branch_id = p_branch_id AND status = 'blocked' AND deleted_at IS NULL;

    -- Top 5 Most Valuable Customers (Total Spending)
    SELECT COALESCE(jsonb_agg(val_cust), '[]'::jsonb) INTO v_most_valuable
    FROM (
        SELECT id, customer_number, name, mobile, total_spending, total_visits, last_visit
        FROM customers
        WHERE branch_id = p_branch_id AND deleted_at IS NULL
        ORDER BY total_spending DESC
        LIMIT 5
    ) val_cust;

    -- Top 5 Most Frequent Customers (Total Visits)
    SELECT COALESCE(jsonb_agg(freq_cust), '[]'::jsonb) INTO v_most_frequent
    FROM (
        SELECT id, customer_number, name, mobile, total_visits, total_spending, last_visit
        FROM customers
        WHERE branch_id = p_branch_id AND deleted_at IS NULL
        ORDER BY total_visits DESC
        LIMIT 5
    ) freq_cust;

    RETURN jsonb_build_object(
        'overview', jsonb_build_object(
            'total_customers', v_total_customers,
            'new_this_month', v_new_this_month,
            'returning_customers', v_returning_customers,
            'retention_rate_pct', CASE WHEN v_total_customers > 0 THEN ROUND((v_returning_customers::NUMERIC / v_total_customers::NUMERIC) * 100, 1) ELSE 0.0 END,
            'active_customers', v_active_count,
            'inactive_customers', v_inactive_count,
            'blocked_customers', v_blocked_count
        ),
        'most_valuable_customers', v_most_valuable,
        'most_frequent_customers', v_most_frequent
    );
END;
$$ LANGUAGE plpgsql STABLE;

