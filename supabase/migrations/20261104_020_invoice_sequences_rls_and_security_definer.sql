-- ========================================================================
-- SMART SALON LK - MIGRATION 020: INVOICE SEQUENCES RLS & SECURITY DEFINER
-- ========================================================================

-- 1. Ensure RLS Policy for invoice_sequences
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_invoice_sequences_all ON invoice_sequences;
CREATE POLICY policy_invoice_sequences_all ON invoice_sequences
    FOR ALL
    USING (true)
    WITH CHECK (true);

GRANT ALL ON TABLE invoice_sequences TO authenticated, anon, service_role;

-- 2. Mark sequence generator as SECURITY DEFINER
CREATE OR REPLACE FUNCTION fn_generate_invoice_number(p_branch_id UUID, p_is_tax_invoice BOOLEAN DEFAULT FALSE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
    v_prefix TEXT;
    v_next_val INTEGER;
    v_result TEXT;
BEGIN
    IF p_is_tax_invoice THEN
        v_prefix := 'TAX-';
    ELSE
        SELECT COALESCE(invoice_prefix, 'INV-') INTO v_prefix
        FROM business_settings
        WHERE branch_id = p_branch_id
        LIMIT 1;

        IF v_prefix IS NULL THEN
            v_prefix := 'INV-';
        END IF;
    END IF;

    IF NOT v_prefix LIKE '%-' THEN
        v_prefix := v_prefix || '-';
    END IF;

    INSERT INTO invoice_sequences (branch_id, year_prefix, current_val, updated_at)
    VALUES (p_branch_id, v_year, 1, now())
    ON CONFLICT (branch_id, year_prefix)
    DO UPDATE SET 
        current_val = invoice_sequences.current_val + 1,
        updated_at = now()
    RETURNING current_val INTO v_next_val;

    v_result := v_prefix || v_year::TEXT || '-' || LPAD(v_next_val::TEXT, 6, '0');
    RETURN v_result;
END;
$$;

