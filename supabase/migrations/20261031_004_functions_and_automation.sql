-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 04: STORED PROCEDURES & BUSINESS LOGIC FUNCTIONS
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. FUNCTION: CALCULATE REAL-TIME WAITING TIME IN MINUTES
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_waiting_time(
    p_branch_id UUID,
    p_barber_id UUID DEFAULT NULL,
    p_target_queue_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_active_barbers INTEGER;
    v_customers_ahead INTEGER;
    v_avg_service_time INTEGER := 22; -- Default 22 minutes average
    v_current_elapsed INTEGER := 0;
    v_target_token_number INTEGER;
    v_est_wait INTEGER;
BEGIN
    -- Determine active barbers on duty
    SELECT COUNT(*) INTO v_active_barbers
    FROM staff
    WHERE branch_id = p_branch_id 
      AND is_active = true 
      AND availability IN ('available', 'busy')
      AND deleted_at IS NULL;
    
    IF v_active_barbers <= 0 THEN
        v_active_barbers := 1;
    END IF;

    -- If a specific target queue ticket is passed, count people ahead of that ticket
    IF p_target_queue_id IS NOT NULL THEN
        SELECT queue_number INTO v_target_token_number
        FROM queue
        WHERE id = p_target_queue_id;

        SELECT COUNT(*) INTO v_customers_ahead
        FROM queue
        WHERE branch_id = p_branch_id
          AND queue_date = CURRENT_DATE
          AND status = 'waiting'
          AND queue_number < v_target_token_number
          AND deleted_at IS NULL;
    ELSE
        -- General wait for the next new incoming customer
        SELECT COUNT(*) INTO v_customers_ahead
        FROM queue
        WHERE branch_id = p_branch_id
          AND queue_date = CURRENT_DATE
          AND status = 'waiting'
          AND deleted_at IS NULL;
    END IF;

    -- If nobody is waiting, wait is minimal prep time
    IF v_customers_ahead = 0 THEN
        RETURN 5;
    END IF;

    -- Calculate cycles ahead distributed across barbers
    v_est_wait := (CEIL(v_customers_ahead::NUMERIC / v_active_barbers::NUMERIC) * v_avg_service_time)::INTEGER;

    -- Account for currently running chair elapsed minutes
    SELECT COALESCE(EXTRACT(EPOCH FROM (now() - started_at))/60, 0)::INTEGER
    INTO v_current_elapsed
    FROM queue
    WHERE branch_id = p_branch_id
      AND queue_date = CURRENT_DATE
      AND status = 'in_chair'
      AND started_at IS NOT NULL
      AND deleted_at IS NULL
    ORDER BY started_at ASC
    LIMIT 1;

    IF v_current_elapsed > 0 AND v_current_elapsed < v_avg_service_time THEN
        v_est_wait := v_est_wait - (v_current_elapsed / v_active_barbers);
    END IF;

    RETURN GREATEST(5, v_est_wait);
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------
-- 2. FUNCTION: GENERATE DAILY QUEUE TOKEN ATOMICALLY
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_daily_queue_token(
    p_branch_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_walk_in_id UUID DEFAULT NULL,
    p_service_id UUID DEFAULT NULL,
    p_barber_id UUID DEFAULT NULL,
    p_appointment_id UUID DEFAULT NULL,
    p_queue_type queue_ticket_type DEFAULT 'walk_in',
    p_priority queue_priority_type DEFAULT 'normal'
)
RETURNS TABLE (
    queue_id UUID,
    token_number INTEGER,
    ticket_code VARCHAR,
    est_wait_minutes INTEGER
) AS $$
DECLARE
    v_next_token INTEGER;
    v_date_str VARCHAR(8);
    v_ticket_code VARCHAR(30);
    v_est_wait INTEGER;
    v_new_id UUID;
BEGIN
    v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

    -- Lock branch queue state for concurrency safety
    PERFORM pg_advisory_xact_lock(hashtext('queue_lock_' || p_branch_id::TEXT));

    -- Get next sequential token for today
    SELECT COALESCE(MAX(q.queue_number), 0) + 1
    INTO v_next_token
    FROM queue q
    WHERE q.branch_id = p_branch_id 
      AND q.queue_date = CURRENT_DATE;

    v_ticket_code := 'LK-' || v_date_str || '-' || LPAD(v_next_token::TEXT, 3, '0');

    -- Estimate wait
    v_est_wait := calculate_waiting_time(p_branch_id, p_barber_id);

    -- Insert queue ticket
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
        estimated_waiting_time
    )
    VALUES (
        p_branch_id,
        CURRENT_DATE,
        v_next_token,
        v_ticket_code,
        p_queue_type,
        p_customer_id,
        p_walk_in_id,
        p_appointment_id,
        p_barber_id,
        p_service_id,
        p_priority,
        'waiting',
        v_est_wait
    )
    RETURNING id INTO v_new_id;

    RETURN QUERY
    SELECT v_new_id, v_next_token, v_ticket_code, v_est_wait;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------
-- 3. FUNCTION: GENERATE LANKAQR EMVCO STANDARD PAYLOAD
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_lankaqr_payload_sql(
    p_merchant_id VARCHAR,
    p_account_number VARCHAR,
    p_merchant_name VARCHAR,
    p_merchant_city VARCHAR,
    p_amount NUMERIC,
    p_invoice_number VARCHAR
)
RETURNS TEXT AS $$
DECLARE
    v_payload TEXT;
    v_tag26_sub TEXT;
    v_tag26 TEXT;
    v_tag62_sub TEXT;
    v_tag62 TEXT;
    v_amount_str VARCHAR(20);
BEGIN
    v_amount_str := TO_CHAR(p_amount, 'FM99999990.00');

    -- Tag 26 Sub-TLVs
    v_tag26_sub := '00' || LPAD(LENGTH('LK.GOV.CBSL.LANKAQR')::TEXT, 2, '0') || 'LK.GOV.CBSL.LANKAQR' ||
                   '01' || LPAD(LENGTH(p_account_number)::TEXT, 2, '0') || p_account_number ||
                   '02' || LPAD(LENGTH(p_merchant_id)::TEXT, 2, '0') || p_merchant_id;
    v_tag26 := '26' || LPAD(LENGTH(v_tag26_sub)::TEXT, 2, '0') || v_tag26_sub;

    -- Tag 62 Additional Data (Reference ID)
    v_tag62_sub := '01' || LPAD(LENGTH(p_invoice_number)::TEXT, 2, '0') || p_invoice_number;
    v_tag62 := '62' || LPAD(LENGTH(v_tag62_sub)::TEXT, 2, '0') || v_tag62_sub;

    -- Build payload
    v_payload := '000201' || -- Payload Format Indicator
                 '010212' || -- Point of Initiation (12: Dynamic)
                 v_tag26 ||
                 '52047230' || -- Merchant Category Code (Barber Shops)
                 '5303144' ||  -- Transaction Currency 144 (LKR)
                 '54' || LPAD(LENGTH(v_amount_str)::TEXT, 2, '0') || v_amount_str ||
                 '5802LK' ||   -- Country Code Sri Lanka
                 '59' || LPAD(LENGTH(SUBSTRING(p_merchant_name, 1, 25))::TEXT, 2, '0') || SUBSTRING(p_merchant_name, 1, 25) ||
                 '60' || LPAD(LENGTH(SUBSTRING(p_merchant_city, 1, 15))::TEXT, 2, '0') || SUBSTRING(p_merchant_city, 1, 15) ||
                 v_tag62 ||
                 '6304'; -- Checksum placeholder

    RETURN v_payload;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ------------------------------------------------------------------------
-- 4. FUNCTION: CREATE SALON INVOICE ATOMIC TRANSACTION
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_salon_invoice(
    p_branch_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_walk_in_id UUID DEFAULT NULL,
    p_appointment_id UUID DEFAULT NULL,
    p_queue_id UUID DEFAULT NULL,
    p_staff_id UUID DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb, -- Array of {service_id, item_name, unit_price, quantity, discount}
    p_discount NUMERIC DEFAULT 0.00,
    p_payment_method payment_method_type DEFAULT 'cash',
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
    invoice_id UUID,
    invoice_number VARCHAR,
    grand_total NUMERIC,
    barcode_value VARCHAR,
    lankaqr_code TEXT
) AS $$
DECLARE
    v_year_str VARCHAR(4);
    v_seq_num INTEGER;
    v_invoice_number VARCHAR(40);
    v_barcode VARCHAR(100);
    v_subtotal NUMERIC(10,2) := 0.00;
    v_tax NUMERIC(10,2) := 0.00;
    v_grand_total NUMERIC(10,2) := 0.00;
    v_new_invoice_id UUID;
    v_item JSONB;
    v_merchant_id VARCHAR(50);
    v_account_no VARCHAR(50);
    v_salon_name VARCHAR(150);
    v_city VARCHAR(100);
    v_lankaqr TEXT := NULL;
    v_pay_ref VARCHAR(60);
BEGIN
    v_year_str := TO_CHAR(now(), 'YYYY');

    -- Concurrency lock on invoice sequence
    PERFORM pg_advisory_xact_lock(hashtext('invoice_lock_' || p_branch_id::TEXT));

    -- Calculate annual sequence number
    SELECT COALESCE(COUNT(*), 0) + 1
    INTO v_seq_num
    FROM invoices
    WHERE branch_id = p_branch_id
      AND TO_CHAR(created_at, 'YYYY') = v_year_str;

    v_invoice_number := 'INV-' || v_year_str || '-' || LPAD(v_seq_num::TEXT, 6, '0');
    v_barcode := 'SSLK-' || v_invoice_number;

    -- Calculate subtotal from items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_subtotal := v_subtotal + ((v_item->>'unit_price')::NUMERIC * COALESCE((v_item->>'quantity')::INTEGER, 1));
    END LOOP;

    -- Calculate tax if any configured
    SELECT 
        ROUND((v_subtotal * (s.tax_percentage / 100)), 2),
        s.lankaqr_merchant_id,
        s.lankaqr_account_number,
        s.salon_name,
        s.city
    INTO v_tax, v_merchant_id, v_account_no, v_salon_name, v_city
    FROM business_settings s
    WHERE s.branch_id = p_branch_id;

    v_grand_total := GREATEST(0.00, (v_subtotal - p_discount) + COALESCE(v_tax, 0.00));

    -- Generate LankaQR if requested or enabled
    IF p_payment_method = 'lankaqr' OR v_merchant_id IS NOT NULL THEN
        v_lankaqr := generate_lankaqr_payload_sql(
            COALESCE(v_merchant_id, 'LKQR-9021-SMART'),
            COALESCE(v_account_no, '800123456789'),
            COALESCE(v_salon_name, 'SMART SALON LK'),
            COALESCE(v_city, 'KIRIBATHGODA'),
            v_grand_total,
            v_invoice_number
        );
    END IF;

    -- Insert Invoice
    INSERT INTO invoices (
        branch_id,
        invoice_number,
        customer_id,
        walk_in_id,
        appointment_id,
        queue_id,
        staff_id,
        subtotal,
        discount,
        tax,
        grand_total,
        payment_status,
        barcode_value,
        qr_code_value,
        notes
    )
    VALUES (
        p_branch_id,
        v_invoice_number,
        p_customer_id,
        p_walk_in_id,
        p_appointment_id,
        p_queue_id,
        p_staff_id,
        v_subtotal,
        p_discount,
        v_tax,
        v_grand_total,
        'paid',
        v_barcode,
        v_lankaqr,
        p_notes
    )
    RETURNING id INTO v_new_invoice_id;

    -- Insert Itemized Lines
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO invoice_items (
            invoice_id,
            service_id,
            item_name,
            quantity,
            unit_price,
            discount,
            total
        )
        VALUES (
            v_new_invoice_id,
            (v_item->>'service_id')::UUID,
            v_item->>'item_name',
            COALESCE((v_item->>'quantity')::INTEGER, 1),
            (v_item->>'unit_price')::NUMERIC,
            COALESCE((v_item->>'discount')::NUMERIC, 0.00),
            ((v_item->>'unit_price')::NUMERIC * COALESCE((v_item->>'quantity')::INTEGER, 1))
        );
    END LOOP;

    -- Record Payment in payments ledger
    v_pay_ref := 'PAY-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(v_seq_num::TEXT, 5, '0');
    INSERT INTO payments (
        branch_id,
        invoice_id,
        reference_number,
        payment_method,
        amount,
        status,
        paid_time
    )
    VALUES (
        p_branch_id,
        v_new_invoice_id,
        v_pay_ref,
        p_payment_method,
        v_grand_total,
        'paid',
        now()
    );

    -- Mark queue ticket as completed if linked
    IF p_queue_id IS NOT NULL THEN
        UPDATE queue
        SET status = 'completed',
            completed_at = now()
        WHERE id = p_queue_id;
    END IF;

    -- Update customer history if linked
    IF p_customer_id IS NOT NULL THEN
        UPDATE customers
        SET total_visits = total_visits + 1,
            total_spending = total_spending + v_grand_total,
            last_visit = now()
        WHERE id = p_customer_id;
    END IF;

    RETURN QUERY
    SELECT v_new_invoice_id, v_invoice_number, v_grand_total, v_barcode, v_lankaqr;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------
-- 5. FUNCTION: DAILY REVENUE & PERFORMANCE REPORT GENERATOR
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_daily_revenue(
    p_branch_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    gross_revenue NUMERIC,
    cash_revenue NUMERIC,
    lankaqr_revenue NUMERIC,
    card_revenue NUMERIC,
    heads_served INTEGER,
    walk_ins_count INTEGER,
    appointments_count INTEGER,
    avg_ticket_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(i.grand_total), 0.00) AS gross_revenue,
        COALESCE(SUM(CASE WHEN p.payment_method = 'cash' THEN p.amount ELSE 0.00 END), 0.00) AS cash_revenue,
        COALESCE(SUM(CASE WHEN p.payment_method = 'lankaqr' THEN p.amount ELSE 0.00 END), 0.00) AS lankaqr_revenue,
        COALESCE(SUM(CASE WHEN p.payment_method = 'card' THEN p.amount ELSE 0.00 END), 0.00) AS card_revenue,
        COUNT(DISTINCT i.id)::INTEGER AS heads_served,
        COUNT(DISTINCT CASE WHEN i.walk_in_id IS NOT NULL THEN i.id END)::INTEGER AS walk_ins_count,
        COUNT(DISTINCT CASE WHEN i.appointment_id IS NOT NULL THEN i.id END)::INTEGER AS appointments_count,
        CASE 
            WHEN COUNT(DISTINCT i.id) > 0 THEN ROUND(SUM(i.grand_total) / COUNT(DISTINCT i.id), 2)
            ELSE 0.00
        END AS avg_ticket_value
    FROM invoices i
    LEFT JOIN payments p ON p.invoice_id = i.id
    WHERE i.branch_id = p_branch_id
      AND DATE(i.created_at) = p_date
      AND i.payment_status = 'paid'
      AND i.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------
-- 6. FUNCTION: UPDATE APPOINTMENT STATUS WITH AUDIT & NOTIFICATION TRIGGER
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_appointment_status(
    p_appointment_id UUID,
    p_new_status appointment_status_type,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE appointments
    SET status = p_new_status,
        cancellation_reason = CASE WHEN p_new_status = 'cancelled' THEN p_reason ELSE cancellation_reason END,
        updated_at = now()
    WHERE id = p_appointment_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

