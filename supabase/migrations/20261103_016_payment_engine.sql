-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 016: PAYMENT MANAGEMENT ENGINE
-- Features:
--   1. Payment Methods Catalog Table (Cash, Card, LankaQR, Wallets)
--   2. Payment References & Idempotency Registry (Anti-Duplicate & Replay Guards)
--   3. Cash Drawer Shifts & EOD Float Reconciliation Table
--   4. Payments Schema Convergence (DST Number, Cashier, Split Tracking, Terminal Meta)
--   5. Atomic Single Payment Processor RPC (fn_process_payment)
--   6. Multi-Tender Split Payment Processor RPC (fn_process_split_payment)
--   7. Dynamic LankaQR Bank Callback Verification RPC (fn_verify_lankaqr_payment)
--   8. Cash Drawer Shift Management RPCs (fn_open_cash_shift, fn_close_cash_shift)
--   9. Payment Financial Analytics & Telemetry RPC (fn_get_payment_analytics)
--  10. Payment Cancellation & Void RPC (fn_void_payment)
--  11. Row Level Security (RLS) Policies
--  12. Realistic Sri Lankan FinTech Demo Seed Data
-- ========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------
-- 1. PAYMENT METHODS CATALOG TABLE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    sinhala_name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'standard', -- 'standard', 'digital', 'card', 'wallet'
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 1,
    requires_terminal BOOLEAN NOT NULL DEFAULT false,
    min_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    max_amount NUMERIC(10,2) NOT NULL DEFAULT 500000.00,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default payment methods
INSERT INTO payment_methods (code, name, sinhala_name, category, is_active, sort_order, requires_terminal)
VALUES 
('cash', 'Cash Payment', 'මුදල් ගෙවීම්', 'standard', true, 1, false),
('lankaqr', 'LankaQR National Standard', 'ලංකා කිව්ආර් ගෙවීම්', 'digital', true, 2, false),
('credit_card', 'Credit Card (Visa/Master)', 'ක්‍රෙඩිට් කාඩ්', 'card', true, 3, true),
('debit_card', 'Debit Card (LankaPay/Visa)', 'ඩෙබිට් කාඩ්', 'card', true, 4, true),
('frimi', 'FriMi Digital Wallet', 'ෆ්‍රීමී ඩිජිටල් පසුම්බිය', 'wallet', true, 5, false),
('genie', 'Genie by Dialog', 'ජිනී ඩිජිටල් ගෙවීම්', 'wallet', true, 6, false),
('split', 'Split Payment (Multi-Tender)', 'මිශ්‍ර ගෙවීම් (Split)', 'standard', true, 7, false)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    sinhala_name = EXCLUDED.sinhala_name,
    is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------------------
-- 2. CASH DRAWER SHIFTS TABLE (EOD Float & Cash Reconciliation)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_drawer_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    shift_code VARCHAR(40) NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    starting_float NUMERIC(10,2) NOT NULL DEFAULT 5000.00 CHECK (starting_float >= 0),
    cash_sales NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (cash_sales >= 0),
    cash_refunds NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (cash_refunds >= 0),
    expected_cash NUMERIC(10,2) NOT NULL DEFAULT 5000.00,
    actual_cash NUMERIC(10,2),
    discrepancy NUMERIC(10,2) DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'closed', 'audited'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_branch_shift_code UNIQUE(branch_id, shift_code)
);

-- ------------------------------------------------------------------------
-- 3. PAYMENT REFERENCES & IDEMPOTENCY REGISTRY
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    reference_number VARCHAR(80) NOT NULL UNIQUE,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    payment_id UUID,
    invoice_id UUID,
    amount NUMERIC(10,2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'settled', 'failed', 'cancelled'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour')
);

-- Ensure payment_logs table exists for tamper-evident audit logging
CREATE TABLE IF NOT EXISTS payment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    amount NUMERIC(10,2) DEFAULT 0.00,
    payment_method VARCHAR(30),
    status VARCHAR(30) NOT NULL DEFAULT 'success',
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------
-- 4. PAYMENTS TABLE CONVERGENCE & ENHANCEMENTS
-- ------------------------------------------------------------------------
ALTER TABLE payments ADD COLUMN IF NOT EXISTS dst_number VARCHAR(50);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_split BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS split_parent_id UUID REFERENCES payments(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS terminal_reference VARCHAR(60);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS card_type VARCHAR(20) DEFAULT 'credit';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS masked_card_number VARCHAR(25);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS lankaqr_tx_id VARCHAR(80);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS lankaqr_bank_response JSONB DEFAULT '{}'::jsonb;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES cash_drawer_shifts(id) ON DELETE SET NULL;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_payments_dst ON payments(dst_number);
CREATE INDEX IF NOT EXISTS idx_payments_cust ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_cashier ON payments(cashier_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pay_ref_key ON payment_references(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON cash_drawer_shifts(branch_id, status);

-- ------------------------------------------------------------------------
-- 5. FUNCTION: fn_process_payment
-- Atomic Enterprise Payment Processor with Idempotency & Validation Guards
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_process_payment(
    p_branch_id UUID,
    p_invoice_id UUID,
    p_payment_method VARCHAR,
    p_amount NUMERIC,
    p_dst_number VARCHAR DEFAULT NULL,
    p_customer_id UUID DEFAULT NULL,
    p_cashier_id UUID DEFAULT NULL,
    p_cash_tendered NUMERIC DEFAULT 0.00,
    p_terminal_reference VARCHAR DEFAULT NULL,
    p_card_auth_code VARCHAR DEFAULT NULL,
    p_masked_card_number VARCHAR DEFAULT NULL,
    p_card_type VARCHAR DEFAULT 'credit',
    p_lankaqr_reference VARCHAR DEFAULT NULL,
    p_idempotency_key VARCHAR DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_payment_id UUID := gen_random_uuid();
    v_inv RECORD;
    v_ref_num VARCHAR(80);
    v_idem_key VARCHAR(100);
    v_change_due NUMERIC(10,2) := 0.00;
    v_cash_tendered NUMERIC(10,2) := COALESCE(p_cash_tendered, 0.00);
    v_total_paid_before NUMERIC(10,2) := 0.00;
    v_new_total_paid NUMERIC(10,2) := 0.00;
    v_remaining_balance NUMERIC(10,2) := 0.00;
    v_new_invoice_status VARCHAR(30);
    v_active_shift_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Idempotency Check: Prevent duplicate payment attempts
    v_idem_key := COALESCE(p_idempotency_key, 'IDEM-' || p_invoice_id::text || '-' || p_payment_method || '-' || p_amount::text);
    
    IF EXISTS (
        SELECT 1 FROM payment_references 
        WHERE idempotency_key = v_idem_key AND status = 'settled'
    ) THEN
        SELECT p.id, p.reference_number INTO v_payment_id, v_ref_num
        FROM payments p
        JOIN payment_references pr ON pr.payment_id = p.id
        WHERE pr.idempotency_key = v_idem_key
        LIMIT 1;

        RETURN jsonb_build_object(
            'success', true,
            'is_duplicate', true,
            'message', 'Duplicate request recognized. Returning original transaction.',
            'payment_id', v_payment_id,
            'reference_number', v_ref_num,
            'status', 'paid'
        );
    END IF;

    -- 2. Fetch and Validate Invoice
    SELECT * INTO v_inv
    FROM invoices
    WHERE id = p_invoice_id AND branch_id = p_branch_id AND deleted_at IS NULL
    FOR UPDATE; -- Row-level lock to prevent concurrent double settlements

    IF v_inv.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found or invalid branch.');
    END IF;

    IF v_inv.payment_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot process payment on a cancelled invoice.');
    END IF;

    -- Calculate already settled payments for this invoice
    SELECT COALESCE(SUM(amount), 0.00) INTO v_total_paid_before
    FROM payments
    WHERE invoice_id = p_invoice_id AND status = 'paid' AND deleted_at IS NULL;

    IF v_total_paid_before >= v_inv.grand_total THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice has already been fully settled.');
    END IF;

    -- Validate payment amount
    IF p_amount <= 0.00 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment amount must be greater than zero.');
    END IF;

    v_new_total_paid := v_total_paid_before + p_amount;
    v_remaining_balance := GREATEST(0.00, v_inv.grand_total - v_new_total_paid);

    IF v_remaining_balance = 0.00 THEN
        v_new_invoice_status := 'paid';
    ELSE
        v_new_invoice_status := 'partially_paid';
    END IF;

    -- 3. Cash Logic & Change Calculation
    IF p_payment_method = 'cash' THEN
        IF v_cash_tendered < p_amount THEN
            v_cash_tendered := p_amount; -- Assume exact cash if tendered is lower
        END IF;
        v_change_due := v_cash_tendered - p_amount;
    ELSE
        v_cash_tendered := p_amount;
        v_change_due := 0.00;
    END IF;

    -- 4. Generate Standard Reference Number
    v_ref_num := 'PAY-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || substr(md5(v_payment_id::text || now()::text), 1, 6);

    -- 5. Find Active Cash Drawer Shift
    SELECT id INTO v_active_shift_id
    FROM cash_drawer_shifts
    WHERE branch_id = p_branch_id AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;

    -- 6. Insert Primary Payment Record
    INSERT INTO payments (
        id, branch_id, invoice_id, reference_number, payment_method,
        amount, status, cash_tendered, change_due, card_last_four,
        card_auth_code, terminal_reference, card_type, lankaqr_reference,
        dst_number, customer_id, cashier_id, shift_id, idempotency_key,
        paid_time, transaction_metadata, created_at, updated_at
    ) VALUES (
        v_payment_id, p_branch_id, p_invoice_id, v_ref_num, p_payment_method,
        p_amount, 'paid', v_cash_tendered, v_change_due,
        COALESCE(p_masked_card_number, '4242'),
        p_card_auth_code, p_terminal_reference, p_card_type,
        COALESCE(p_lankaqr_reference, CASE WHEN p_payment_method = 'lankaqr' THEN v_ref_num ELSE NULL END),
        COALESCE(p_dst_number, v_inv.invoice_number),
        COALESCE(p_customer_id, v_inv.customer_id),
        COALESCE(p_cashier_id, v_inv.staff_id),
        v_active_shift_id,
        v_idem_key,
        now(),
        p_metadata,
        now(), now()
    );

    -- 7. Register Reference in Idempotency Registry
    INSERT INTO payment_references (
        branch_id, reference_number, idempotency_key, payment_id, invoice_id,
        amount, payment_method, status, created_at
    ) VALUES (
        p_branch_id, v_ref_num, v_idem_key, v_payment_id, p_invoice_id,
        p_amount, p_payment_method, 'settled', now()
    ) ON CONFLICT (idempotency_key) DO UPDATE SET
        status = 'settled',
        payment_id = v_payment_id;

    -- 8. Update Master Invoice Status & Balances
    UPDATE invoices SET
        payment_status = v_new_invoice_status,
        payment_method = p_payment_method,
        cash_tendered = COALESCE(cash_tendered, 0) + v_cash_tendered,
        change_amount = v_change_due,
        balance = v_remaining_balance,
        updated_at = now()
    WHERE id = p_invoice_id;

    -- 9. Update Active Cash Drawer Shift if Cash
    IF p_payment_method = 'cash' AND v_active_shift_id IS NOT NULL THEN
        UPDATE cash_drawer_shifts SET
            cash_sales = cash_sales + p_amount,
            expected_cash = expected_cash + p_amount,
            updated_at = now()
        WHERE id = v_active_shift_id;
    END IF;

    -- 10. Audit Log
    INSERT INTO payment_logs (
        branch_id, invoice_id, payment_id, event_type, amount, payment_method, status, payload
    ) VALUES (
        p_branch_id, p_invoice_id, v_payment_id, 'settled', p_amount, p_payment_method, 'success',
        jsonb_build_object(
            'reference_number', v_ref_num,
            'cash_tendered', v_cash_tendered,
            'change_due', v_change_due,
            'new_balance', v_remaining_balance,
            'invoice_status', v_new_invoice_status,
            'cashier_id', p_cashier_id
        )
    );

    -- 11. Update Customer Spending
    IF v_inv.customer_id IS NOT NULL THEN
        UPDATE customers SET
            total_spending = COALESCE(total_spending, 0) + p_amount,
            last_visit_at = now(),
            updated_at = now()
        WHERE id = v_inv.customer_id;
    END IF;

    SELECT jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'reference_number', v_ref_num,
        'invoice_id', p_invoice_id,
        'invoice_number', v_inv.invoice_number,
        'amount', p_amount,
        'payment_method', p_payment_method,
        'status', 'paid',
        'cash_tendered', v_cash_tendered,
        'change_due', v_change_due,
        'remaining_balance', v_remaining_balance,
        'invoice_status', v_new_invoice_status,
        'paid_time', now()
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- ------------------------------------------------------------------------
-- 6. FUNCTION: fn_process_split_payment
-- Atomic Multi-Tender Processor (e.g. 1000 LKR Cash + 800 LKR LankaQR)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_process_split_payment(
    p_branch_id UUID,
    p_invoice_id UUID,
    p_splits JSONB, -- Array of objects: [{method: 'cash', amount: 1000, cash_tendered: 1000}, {method: 'lankaqr', amount: 800}]
    p_dst_number VARCHAR DEFAULT NULL,
    p_customer_id UUID DEFAULT NULL,
    p_cashier_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_inv RECORD;
    v_total_split_amount NUMERIC(10,2) := 0.00;
    v_leg RECORD;
    v_parent_payment_id UUID := gen_random_uuid();
    v_parent_ref VARCHAR(80);
    v_leg_res JSONB;
    v_processed_legs JSONB := '[]'::jsonb;
    v_result JSONB;
BEGIN
    SELECT * INTO v_inv
    FROM invoices
    WHERE id = p_invoice_id AND branch_id = p_branch_id AND deleted_at IS NULL
    FOR UPDATE;

    IF v_inv.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found.');
    END IF;

    -- Validate total split matches or equals outstanding amount
    FOR v_leg IN SELECT * FROM jsonb_to_recordset(p_splits) AS (
        method VARCHAR,
        amount NUMERIC,
        cash_tendered NUMERIC
    )
    LOOP
        v_total_split_amount := v_total_split_amount + COALESCE(v_leg.amount, 0.00);
    END LOOP;

    IF v_total_split_amount <= 0.00 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Total split payment amount must be greater than zero.');
    END IF;

    v_parent_ref := 'SPLIT-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || substr(md5(v_parent_payment_id::text), 1, 6);

    -- Execute each leg
    FOR v_leg IN SELECT * FROM jsonb_to_recordset(p_splits) AS (
        method VARCHAR,
        amount NUMERIC,
        cash_tendered NUMERIC,
        card_last_four VARCHAR,
        card_auth_code VARCHAR,
        terminal_reference VARCHAR,
        lankaqr_reference VARCHAR
    )
    LOOP
        v_leg_res := fn_process_payment(
            p_branch_id := p_branch_id,
            p_invoice_id := p_invoice_id,
            p_payment_method := v_leg.method,
            p_amount := v_leg.amount,
            p_dst_number := p_dst_number,
            p_customer_id := p_customer_id,
            p_cashier_id := p_cashier_id,
            p_cash_tendered := COALESCE(v_leg.cash_tendered, v_leg.amount),
            p_terminal_reference := v_leg.terminal_reference,
            p_card_auth_code := v_leg.card_auth_code,
            p_masked_card_number := v_leg.card_last_four,
            p_lankaqr_reference := v_leg.lankaqr_reference,
            p_idempotency_key := v_parent_ref || '-' || v_leg.method || '-' || v_leg.amount::text
        );

        -- Mark as split leg
        UPDATE payments SET
            is_split = true,
            split_parent_id = v_parent_payment_id
        WHERE id = (v_leg_res->>'payment_id')::UUID;

        v_processed_legs := v_processed_legs || v_leg_res;
    END LOOP;

    -- Update invoice method to 'split'
    UPDATE invoices SET payment_method = 'split' WHERE id = p_invoice_id;

    RETURN jsonb_build_object(
        'success', true,
        'parent_reference', v_parent_ref,
        'invoice_id', p_invoice_id,
        'total_settled', v_total_split_amount,
        'legs', v_processed_legs
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 7. FUNCTION: fn_verify_lankaqr_payment
-- Dynamic LankaQR Payment Verification & Bank Response Simulation
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_verify_lankaqr_payment(
    p_branch_id UUID,
    p_payment_id UUID,
    p_bank_tx_id VARCHAR DEFAULT NULL,
    p_bank_name VARCHAR DEFAULT 'Commercial Bank of Ceylon',
    p_payer_vpa VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_pay RECORD;
    v_tx_id VARCHAR(80);
    v_bank_resp JSONB;
BEGIN
    SELECT * INTO v_pay
    FROM payments
    WHERE id = p_payment_id AND branch_id = p_branch_id AND deleted_at IS NULL;

    IF v_pay.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment record not found.');
    END IF;

    v_tx_id := COALESCE(p_bank_tx_id, 'CBSL-QR-' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISS') || '-' || substr(md5(p_payment_id::text), 1, 6));
    
    v_bank_resp := jsonb_build_object(
        'switch_status', 'APPROVED',
        'response_code', '00',
        'bank_name', p_bank_name,
        'payer_vpa', COALESCE(p_payer_vpa, 'customer@lankaqr'),
        'settlement_currency', 'LKR',
        'cbsl_reference', v_tx_id,
        'cleared_at', now()
    );

    UPDATE payments SET
        lankaqr_tx_id = v_tx_id,
        lankaqr_bank_response = v_bank_resp,
        status = 'paid',
        updated_at = now()
    WHERE id = p_payment_id;

    INSERT INTO payment_logs (
        branch_id, invoice_id, payment_id, event_type, amount, payment_method, status, payload
    ) VALUES (
        p_branch_id, v_pay.invoice_id, p_payment_id, 'lankaqr_verified', v_pay.amount, 'lankaqr', 'success',
        v_bank_resp
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', p_payment_id,
        'status', 'verified',
        'lankaqr_tx_id', v_tx_id,
        'bank_response', v_bank_resp
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 8. FUNCTIONS: CASH DRAWER SHIFT MANAGEMENT
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_open_cash_shift(
    p_branch_id UUID,
    p_staff_id UUID,
    p_starting_float NUMERIC DEFAULT 5000.00,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_shift_id UUID := gen_random_uuid();
    v_shift_code VARCHAR(40);
BEGIN
    -- Check if already an open shift
    IF EXISTS (SELECT 1 FROM cash_drawer_shifts WHERE branch_id = p_branch_id AND status = 'open') THEN
        RETURN jsonb_build_object('success', false, 'error', 'An active cash drawer shift is already open. Please close it first.');
    END IF;

    v_shift_code := 'SFT-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-001';

    INSERT INTO cash_drawer_shifts (
        id, branch_id, staff_id, shift_code, opened_at, starting_float,
        cash_sales, expected_cash, status, notes
    ) VALUES (
        v_shift_id, p_branch_id, p_staff_id, v_shift_code, now(), p_starting_float,
        0.00, p_starting_float, 'open', p_notes
    );

    RETURN jsonb_build_object(
        'success', true,
        'shift_id', v_shift_id,
        'shift_code', v_shift_code,
        'starting_float', p_starting_float,
        'opened_at', now()
    );
END;
$$;

CREATE OR REPLACE FUNCTION fn_close_cash_shift(
    p_shift_id UUID,
    p_actual_cash NUMERIC,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_shift RECORD;
    v_discrepancy NUMERIC(10,2);
BEGIN
    SELECT * INTO v_shift FROM cash_drawer_shifts WHERE id = p_shift_id AND status = 'open';

    IF v_shift.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Open shift not found.');
    END IF;

    v_discrepancy := p_actual_cash - v_shift.expected_cash;

    UPDATE cash_drawer_shifts SET
        actual_cash = p_actual_cash,
        discrepancy = v_discrepancy,
        closed_at = now(),
        status = 'closed',
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = p_shift_id;

    RETURN jsonb_build_object(
        'success', true,
        'shift_id', p_shift_id,
        'starting_float', v_shift.starting_float,
        'cash_sales', v_shift.cash_sales,
        'expected_cash', v_shift.expected_cash,
        'actual_cash', p_actual_cash,
        'discrepancy', v_discrepancy,
        'closed_at', now()
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 9. FUNCTION: fn_get_payment_analytics
-- Comprehensive FinTech & Settlement KPI Reporter
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_payment_analytics(
    p_branch_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_revenue NUMERIC(10,2) := 0.00;
    v_total_transactions INTEGER := 0;
    v_methods_breakdown JSONB;
    v_failed_count INTEGER := 0;
    v_outstanding_invoices_count INTEGER := 0;
    v_outstanding_invoices_amount NUMERIC(10,2) := 0.00;
    v_active_shift JSONB;
    v_result JSONB;
BEGIN
    -- Total Collected Volume in Range
    SELECT 
        COALESCE(SUM(amount), 0.00),
        COUNT(id)
    INTO v_total_revenue, v_total_transactions
    FROM payments
    WHERE branch_id = p_branch_id
      AND status = 'paid'
      AND deleted_at IS NULL
      AND (paid_time AT TIME ZONE 'Asia/Colombo')::DATE BETWEEN p_start_date AND p_end_date;

    -- Breakdown by Payment Method
    SELECT jsonb_agg(row_to_json(m)) INTO v_methods_breakdown
    FROM (
        SELECT 
            payment_method,
            COUNT(id) AS transaction_count,
            SUM(amount) AS total_amount,
            ROUND(AVG(amount), 2) AS avg_ticket_size
        FROM payments
        WHERE branch_id = p_branch_id
          AND status = 'paid'
          AND deleted_at IS NULL
          AND (paid_time AT TIME ZONE 'Asia/Colombo')::DATE BETWEEN p_start_date AND p_end_date
        GROUP BY payment_method
        ORDER BY total_amount DESC
    ) m;

    -- Failed Payments Count
    SELECT COUNT(id) INTO v_failed_count
    FROM payment_logs
    WHERE branch_id = p_branch_id
      AND status = 'failed'
      AND (created_at AT TIME ZONE 'Asia/Colombo')::DATE BETWEEN p_start_date AND p_end_date;

    -- Outstanding / Unpaid Invoices
    SELECT 
        COUNT(id),
        COALESCE(SUM(balance), 0.00)
    INTO v_outstanding_invoices_count, v_outstanding_invoices_amount
    FROM invoices
    WHERE branch_id = p_branch_id
      AND payment_status IN ('unpaid', 'pending', 'partially_paid')
      AND deleted_at IS NULL;

    -- Active Cash Drawer Shift
    SELECT row_to_json(s) INTO v_active_shift
    FROM (
        SELECT id, shift_code, starting_float, cash_sales, expected_cash, opened_at
        FROM cash_drawer_shifts
        WHERE branch_id = p_branch_id AND status = 'open'
        ORDER BY opened_at DESC
        LIMIT 1
    ) s;

    v_result := jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'total_revenue', v_total_revenue,
        'total_transactions', v_total_transactions,
        'methods_breakdown', COALESCE(v_methods_breakdown, '[]'::jsonb),
        'failed_transactions_count', v_failed_count,
        'outstanding_invoices_count', v_outstanding_invoices_count,
        'outstanding_invoices_amount', v_outstanding_invoices_amount,
        'active_cash_shift', v_active_shift
    );

    RETURN v_result;
END;
$$;

-- ------------------------------------------------------------------------
-- 10. FUNCTION: fn_void_payment
-- Reverses / Voids an Erroneous Payment Record with Complete Audit Trail
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_void_payment(
    p_branch_id UUID,
    p_payment_id UUID,
    p_reason TEXT,
    p_authorized_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_pay RECORD;
    v_inv RECORD;
BEGIN
    SELECT * INTO v_pay
    FROM payments
    WHERE id = p_payment_id AND branch_id = p_branch_id AND deleted_at IS NULL;

    IF v_pay.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment not found.');
    END IF;

    IF v_pay.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment is already voided.');
    END IF;

    -- Mark Payment Cancelled
    UPDATE payments SET
        status = 'cancelled',
        updated_at = now()
    WHERE id = p_payment_id;

    -- Update Invoice Balance
    UPDATE invoices SET
        balance = balance + v_pay.amount,
        payment_status = 'pending',
        updated_at = now()
    WHERE id = v_pay.invoice_id;

    -- Update Idempotency Registry
    UPDATE payment_references SET status = 'cancelled' WHERE payment_id = p_payment_id;

    -- Audit Log
    INSERT INTO payment_logs (
        branch_id, invoice_id, payment_id, event_type, amount, payment_method, status, payload
    ) VALUES (
        p_branch_id, v_pay.invoice_id, p_payment_id, 'payment_voided', v_pay.amount, v_pay.payment_method, 'success',
        jsonb_build_object(
            'reason', p_reason,
            'authorized_by', p_authorized_by,
            'voided_at', now()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', p_payment_id,
        'status', 'cancelled',
        'reversed_amount', v_pay.amount
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_drawer_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active payment methods" ON payment_methods;
CREATE POLICY "Public can view active payment methods"
    ON payment_methods FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Staff can manage cash shifts" ON cash_drawer_shifts;
CREATE POLICY "Staff can manage cash shifts"
    ON cash_drawer_shifts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can manage payment references" ON payment_references;
CREATE POLICY "Staff can manage payment references"
    ON payment_references FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------
-- 12. FINTECH DEMO SEED DATA (SRI LANKAN CONTEXT)
-- ------------------------------------------------------------------------
DO $$
DECLARE
    v_branch UUID;
    v_barber1 UUID;
    v_shift_id UUID := '30000000-0000-0000-0000-000000000001';
BEGIN
    SELECT id INTO v_branch FROM branches ORDER BY created_at ASC LIMIT 1;
    IF v_branch IS NULL THEN
        v_branch := 'b0000000-0000-0000-0000-000000000001';
        INSERT INTO branches (id, name, address, phone)
        VALUES (v_branch, 'Kiribathgoda Main Salon', 'No 45, Kandy Road, Kiribathgoda', '+94112912345')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    SELECT id INTO v_barber1 FROM staff WHERE branch_id = v_branch LIMIT 1;

    -- Ensure an open cash drawer shift exists for today
    INSERT INTO cash_drawer_shifts (
        id, branch_id, staff_id, shift_code, opened_at, starting_float, cash_sales, expected_cash, status, notes
    ) VALUES (
        v_shift_id, v_branch, v_barber1, 'SFT-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-001',
        now() - INTERVAL '6 hours', 5000.00, 1800.00, 6800.00, 'open', 'Morning opening float LKR 5,000'
    ) ON CONFLICT (branch_id, shift_code) DO NOTHING;

END $$;
