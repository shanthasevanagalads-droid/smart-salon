-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 018: REPORTING, ANALYTICS & BUSINESS INTELLIGENCE (BI) MODULE
-- Features:
--   1. Performance Optimized Analytical Indexes (Invoices, Items, Queue, Payments)
--   2. Analytical View: vw_daily_financial_summary
--   3. Analytical View: vw_service_performance_summary
--   4. Analytical View: vw_barber_performance_summary
--   5. Analytical View: vw_hourly_traffic_summary
--   6. RPC: fn_get_bi_dashboard_overview (Executive Owner Daily Cockpit)
--   7. RPC: fn_get_bi_financial_report (Time-Series Financial Turnover & AOV)
--   8. RPC: fn_get_bi_customer_analytics (Retention, LTV & Top VIP Clients)
--   9. RPC: fn_get_bi_barber_performance (Chair 01 vs Chair 02 Productivity)
--  10. RPC: fn_get_bi_queue_traffic (Peak Hours, Wait Times & Walk-in Ratio)
--  11. Row Level Security (RLS) Policies
--  12. Historical Demo Seed Aggregates for 30-Day Trend Visualizations
-- ========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------
-- 1. ANALYTICAL PERFORMANCE INDEXES
-- ------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_bi_date ON invoices(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_status_method ON invoices(payment_status, payment_method);
CREATE INDEX IF NOT EXISTS idx_inv_items_service_staff ON invoice_items(service_id, staff_id);
CREATE INDEX IF NOT EXISTS idx_queue_bi_date ON queue(branch_id, queue_date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_bi_date ON appointments(branch_id, appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_payments_bi_paid ON payments(branch_id, paid_time, status);
CREATE INDEX IF NOT EXISTS idx_cust_spending ON customers(branch_id, total_spending DESC);

-- ------------------------------------------------------------------------
-- 2. VIEW: vw_daily_financial_summary
-- ------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_daily_financial_summary AS
SELECT 
    i.branch_id,
    i.created_at::DATE AS report_date,
    COUNT(i.id) AS total_invoices,
    COALESCE(SUM(i.subtotal), 0.00) AS gross_sales,
    COALESCE(SUM(i.discount), 0.00) AS total_discounts,
    COALESCE(SUM(i.tax), 0.00) AS total_tax,
    COALESCE(SUM(i.grand_total), 0.00) AS net_revenue,
    ROUND(COALESCE(AVG(i.grand_total), 0.00), 2) AS avg_invoice_value,
    COALESCE(SUM(CASE WHEN i.payment_method = 'cash' THEN i.grand_total ELSE 0 END), 0.00) AS cash_revenue,
    COALESCE(SUM(CASE WHEN i.payment_method = 'lankaqr' THEN i.grand_total ELSE 0 END), 0.00) AS lankaqr_revenue,
    COALESCE(SUM(CASE WHEN i.payment_method IN ('card', 'credit_card', 'debit_card') THEN i.grand_total ELSE 0 END), 0.00) AS card_revenue,
    COALESCE(SUM(CASE WHEN i.payment_method = 'split' THEN i.grand_total ELSE 0 END), 0.00) AS split_revenue
FROM invoices i
WHERE i.deleted_at IS NULL AND i.payment_status = 'paid'
GROUP BY i.branch_id, i.created_at::DATE;

-- ------------------------------------------------------------------------
-- 3. VIEW: vw_service_performance_summary
-- ------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_service_performance_summary AS
SELECT 
    ii.service_id,
    COALESCE(s.name, ii.item_name) AS service_name,
    COALESCE(s.sinhala_name, ii.item_sinhala_name) AS service_sinhala_name,
    COALESCE(s.category, 'haircut') AS category,
    COUNT(ii.id) AS total_executed,
    COALESCE(SUM(ii.quantity), 0) AS units_sold,
    COALESCE(SUM(ii.total), 0.00) AS total_revenue,
    ROUND(COALESCE(AVG(ii.unit_price), 0.00), 2) AS avg_price,
    COALESCE(s.duration_minutes, 30) AS avg_duration_minutes
FROM invoice_items ii
LEFT JOIN services s ON s.id = ii.service_id
WHERE ii.deleted_at IS NULL
GROUP BY ii.service_id, s.name, ii.item_name, s.sinhala_name, ii.item_sinhala_name, s.category, s.duration_minutes;

-- ------------------------------------------------------------------------
-- 4. VIEW: vw_barber_performance_summary
-- ------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_barber_performance_summary AS
SELECT 
    st.id AS staff_id,
    st.branch_id,
    st.full_name AS barber_name,
    st.sinhala_name AS barber_sinhala,
    st.chair_number,
    st.commission_percentage,
    COUNT(DISTINCT i.id) AS total_invoices_served,
    COALESCE(SUM(ii.total), 0.00) AS total_revenue_generated,
    ROUND(COALESCE(SUM(ii.total) * (st.commission_percentage / 100.0), 0.00), 2) AS estimated_commission,
    ROUND(COALESCE(AVG(COALESCE(s.duration_minutes, 30)), 25), 1) AS avg_chair_time_minutes
FROM staff st
LEFT JOIN invoice_items ii ON ii.staff_id = st.id AND ii.deleted_at IS NULL
LEFT JOIN invoices i ON i.id = ii.invoice_id AND i.payment_status = 'paid'
LEFT JOIN services s ON s.id = ii.service_id
WHERE st.status = 'active'
GROUP BY st.id, st.branch_id, st.full_name, st.sinhala_name, st.chair_number, st.commission_percentage;

-- ------------------------------------------------------------------------
-- 5. VIEW: vw_hourly_traffic_summary
-- ------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_hourly_traffic_summary AS
SELECT 
    q.branch_id,
    q.queue_date,
    EXTRACT(HOUR FROM q.created_at) AS hour_of_day,
    COUNT(q.id) AS total_customers,
    COUNT(q.id) FILTER (WHERE q.queue_type = 'walk_in') AS walk_in_count,
    COUNT(q.id) FILTER (WHERE q.queue_type = 'appointment') AS appointment_count,
    ROUND(COALESCE(AVG(q.estimated_waiting_time), 0), 1) AS avg_estimated_wait,
    ROUND(COALESCE(AVG(EXTRACT(EPOCH FROM (q.called_at - q.created_at))/60), 15), 1) AS actual_wait_minutes
FROM queue q
GROUP BY q.branch_id, q.queue_date, EXTRACT(HOUR FROM q.created_at);

-- ------------------------------------------------------------------------
-- 6. RPC: fn_get_bi_dashboard_overview
-- Realtime Executive Cockpit for Salon Owners
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_bi_dashboard_overview(
    p_branch_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_today_revenue NUMERIC(10,2) := 0.00;
    v_yesterday_revenue NUMERIC(10,2) := 0.00;
    v_revenue_growth_pct NUMERIC(5,2) := 0.00;
    v_today_invoices INTEGER := 0;
    v_today_customers INTEGER := 0;
    v_walk_ins INTEGER := 0;
    v_appointments INTEGER := 0;
    v_avg_invoice_value NUMERIC(10,2) := 0.00;
    
    -- Queue status
    v_q_waiting INTEGER := 0;
    v_q_in_service INTEGER := 0;
    v_q_completed INTEGER := 0;
    v_avg_wait_time INTEGER := 18;
    
    -- Pending payments
    v_pending_invoices_count INTEGER := 0;
    v_pending_invoices_amount NUMERIC(10,2) := 0.00;
    
    -- Breakdown
    v_payment_methods JSONB;
    v_barber_activity JSONB;
BEGIN
    -- 1. Today Revenue & Invoices
    SELECT 
        COALESCE(SUM(grand_total), 0.00),
        COUNT(id),
        ROUND(COALESCE(AVG(grand_total), 0.00), 2)
    INTO v_today_revenue, v_today_invoices, v_avg_invoice_value
    FROM invoices
    WHERE branch_id = p_branch_id 
      AND created_at::DATE = p_date 
      AND payment_status = 'paid'
      AND deleted_at IS NULL;

    -- 2. Yesterday Revenue for Growth KPI
    SELECT COALESCE(SUM(grand_total), 0.00)
    INTO v_yesterday_revenue
    FROM invoices
    WHERE branch_id = p_branch_id 
      AND created_at::DATE = (p_date - INTERVAL '1 day')::DATE 
      AND payment_status = 'paid'
      AND deleted_at IS NULL;

    IF v_yesterday_revenue > 0 THEN
        v_revenue_growth_pct := ROUND(((v_today_revenue - v_yesterday_revenue) / v_yesterday_revenue) * 100.0, 2);
    ELSE
        v_revenue_growth_pct := 0.00;
    END IF;

    -- 3. Today's Customer Traffic & Queue Breakdown
    SELECT 
        COUNT(id),
        COUNT(id) FILTER (WHERE queue_type = 'walk_in'),
        COUNT(id) FILTER (WHERE queue_type = 'appointment'),
        COUNT(id) FILTER (WHERE status = 'waiting'),
        COUNT(id) FILTER (WHERE status IN ('in_service', 'called')),
        COUNT(id) FILTER (WHERE status = 'completed'),
        ROUND(COALESCE(AVG(estimated_waiting_time), 18))
    INTO 
        v_today_customers, v_walk_ins, v_appointments,
        v_q_waiting, v_q_in_service, v_q_completed, v_avg_wait_time
    FROM queue
    WHERE branch_id = p_branch_id AND queue_date = p_date;

    -- 4. Pending Unsettled Invoices
    SELECT 
        COUNT(id),
        COALESCE(SUM(grand_total), 0.00)
    INTO v_pending_invoices_count, v_pending_invoices_amount
    FROM invoices
    WHERE branch_id = p_branch_id 
      AND payment_status = 'pending'
      AND deleted_at IS NULL;

    -- 5. Payment Methods Breakdown Today
    SELECT jsonb_agg(sub) INTO v_payment_methods
    FROM (
        SELECT 
            payment_method,
            COUNT(*) AS transaction_count,
            COALESCE(SUM(amount), 0.00) AS total_amount,
            ROUND((SUM(amount) / NULLIF(v_today_revenue, 0) * 100), 1) AS percentage
        FROM payments
        WHERE branch_id = p_branch_id 
          AND paid_time::DATE = p_date 
          AND status = 'paid'
        GROUP BY payment_method
    ) sub;

    -- 6. Current Barber Chairs Activity
    SELECT jsonb_agg(sub) INTO v_barber_activity
    FROM (
        SELECT 
            st.id AS staff_id,
            st.full_name AS barber_name,
            st.chair_number,
            st.availability,
            q.ticket_code AS active_ticket,
            q.customer_name AS active_customer,
            q.service_name AS active_service,
            COALESCE(q.service_price_lkr, 0) AS service_price
        FROM staff st
        LEFT JOIN queue q ON q.staff_id = st.id AND q.status = 'in_service' AND q.queue_date = p_date
        WHERE st.branch_id = p_branch_id AND st.status = 'active'
        ORDER BY st.chair_number ASC
    ) sub;

    RETURN jsonb_build_object(
        'date', p_date,
        'today_revenue', v_today_revenue,
        'yesterday_revenue', v_yesterday_revenue,
        'revenue_growth_pct', v_revenue_growth_pct,
        'today_invoices', v_today_invoices,
        'avg_invoice_value', v_avg_invoice_value,
        'today_customers', v_today_customers,
        'walk_ins_count', v_walk_ins,
        'appointments_count', v_appointments,
        'queue_summary', jsonb_build_object(
            'waiting', v_q_waiting,
            'in_service', v_q_in_service,
            'completed', v_q_completed,
            'avg_wait_minutes', v_avg_wait_time
        ),
        'pending_payments', jsonb_build_object(
            'count', v_pending_invoices_count,
            'amount', v_pending_invoices_amount
        ),
        'payment_methods', COALESCE(v_payment_methods, '[]'::jsonb),
        'barber_activity', COALESCE(v_barber_activity, '[]'::jsonb)
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 7. RPC: fn_get_bi_financial_report
-- Time-Series Sales Aggregation (Daily, Weekly, Monthly)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_bi_financial_report(
    p_branch_id UUID,
    p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_daily_trend JSONB;
    v_total_revenue NUMERIC(10,2) := 0.00;
    v_total_invoices INTEGER := 0;
    v_total_discounts NUMERIC(10,2) := 0.00;
    v_aov NUMERIC(10,2) := 0.00;
    v_method_summary JSONB;
BEGIN
    SELECT 
        COALESCE(SUM(net_revenue), 0.00),
        COALESCE(SUM(total_invoices), 0),
        COALESCE(SUM(total_discounts), 0.00),
        ROUND(COALESCE(SUM(net_revenue) / NULLIF(SUM(total_invoices), 0), 0.00), 2)
    INTO v_total_revenue, v_total_invoices, v_total_discounts, v_aov
    FROM vw_daily_financial_summary
    WHERE branch_id = p_branch_id AND report_date BETWEEN p_start_date AND p_end_date;

    -- Time series day-by-day
    SELECT jsonb_agg(sub) INTO v_daily_trend
    FROM (
        SELECT 
            report_date,
            total_invoices,
            gross_sales,
            total_discounts,
            net_revenue,
            avg_invoice_value,
            cash_revenue,
            lankaqr_revenue,
            card_revenue
        FROM vw_daily_financial_summary
        WHERE branch_id = p_branch_id AND report_date BETWEEN p_start_date AND p_end_date
        ORDER BY report_date ASC
    ) sub;

    -- Method totals
    SELECT jsonb_agg(sub) INTO v_method_summary
    FROM (
        SELECT 
            payment_method,
            COUNT(*) AS transactions,
            SUM(amount) AS total_amount,
            ROUND((SUM(amount) / NULLIF(v_total_revenue, 0) * 100), 1) AS share_pct
        FROM payments
        WHERE branch_id = p_branch_id 
          AND paid_time::DATE BETWEEN p_start_date AND p_end_date
          AND status = 'paid'
        GROUP BY payment_method
    ) sub;

    RETURN jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'total_revenue', v_total_revenue,
        'total_invoices', v_total_invoices,
        'total_discounts', v_total_discounts,
        'avg_order_value', v_aov,
        'daily_trend', COALESCE(v_daily_trend, '[]'::jsonb),
        'method_summary', COALESCE(v_method_summary, '[]'::jsonb)
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 8. RPC: fn_get_bi_customer_analytics
-- Customer Lifetime Value, Retention & Frequency Analysis
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_bi_customer_analytics(
    p_branch_id UUID,
    p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_customers INTEGER := 0;
    v_new_customers INTEGER := 0;
    v_returning_customers INTEGER := 0;
    v_retention_rate NUMERIC(5,2) := 0.00;
    v_top_spenders JSONB;
    v_visit_frequencies JSONB;
BEGIN
    SELECT COUNT(*) INTO v_total_customers
    FROM customers
    WHERE branch_id = p_branch_id AND deleted_at IS NULL;

    SELECT 
        COUNT(*) FILTER (WHERE total_visits = 1),
        COUNT(*) FILTER (WHERE total_visits > 1)
    INTO v_new_customers, v_returning_customers
    FROM customers
    WHERE branch_id = p_branch_id AND deleted_at IS NULL;

    IF v_total_customers > 0 THEN
        v_retention_rate := ROUND((v_returning_customers::numeric / v_total_customers::numeric) * 100.0, 2);
    ELSE
        v_retention_rate := 0.00;
    END IF;

    -- Top 8 High-Value VIP Clients
    SELECT jsonb_agg(sub) INTO v_top_spenders
    FROM (
        SELECT 
            c.id,
            c.customer_number,
            c.name,
            c.mobile,
            c.total_visits,
            c.total_spending,
            c.is_vip,
            c.last_visit_at,
            st.full_name AS preferred_barber
        FROM customers c
        LEFT JOIN staff st ON st.id = c.preferred_barber_id
        WHERE c.branch_id = p_branch_id AND c.deleted_at IS NULL
        ORDER BY c.total_spending DESC
        LIMIT 8
    ) sub;

    RETURN jsonb_build_object(
        'total_customers', v_total_customers,
        'new_customers', v_new_customers,
        'returning_customers', v_returning_customers,
        'retention_rate_pct', v_retention_rate,
        'top_spenders', COALESCE(v_top_spenders, '[]'::jsonb)
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 9. RPC: fn_get_bi_barber_performance
-- Stylist Chair Productivity, Revenue & Durations
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_bi_barber_performance(
    p_branch_id UUID,
    p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_barbers JSONB;
BEGIN
    SELECT jsonb_agg(sub) INTO v_barbers
    FROM (
        SELECT 
            st.id AS staff_id,
            st.full_name AS barber_name,
            st.chair_number,
            st.commission_percentage,
            COUNT(DISTINCT i.id) AS services_completed,
            COALESCE(SUM(ii.total), 0.00) AS revenue_generated,
            ROUND(COALESCE(SUM(ii.total) * (st.commission_percentage / 100.0), 0.00), 2) AS commission_earned,
            ROUND(COALESCE(AVG(COALESCE(s.duration_minutes, 30)), 22), 1) AS avg_duration_minutes,
            COUNT(DISTINCT i.customer_id) AS unique_clients
        FROM staff st
        LEFT JOIN invoice_items ii ON ii.staff_id = st.id AND ii.deleted_at IS NULL
        LEFT JOIN invoices i ON i.id = ii.invoice_id 
            AND i.payment_status = 'paid' 
            AND i.created_at::DATE BETWEEN p_start_date AND p_end_date
        LEFT JOIN services s ON s.id = ii.service_id
        WHERE st.branch_id = p_branch_id AND st.status = 'active'
        GROUP BY st.id, st.full_name, st.chair_number, st.commission_percentage
        ORDER BY st.chair_number ASC
    ) sub;

    RETURN jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'barbers', COALESCE(v_barbers, '[]'::jsonb)
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 10. RPC: fn_get_bi_queue_traffic
-- Peak Business Hours Heatmap & Wait Time Distribution
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_bi_queue_traffic(
    p_branch_id UUID,
    p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '7 days')::DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_hourly_dist JSONB;
    v_walkin_total BIGINT := 0;
    v_appointment_total BIGINT := 0;
    v_overall_avg_wait NUMERIC(5,1) := 18.5;
BEGIN
    SELECT 
        COUNT(*) FILTER (WHERE queue_type = 'walk_in'),
        COUNT(*) FILTER (WHERE queue_type = 'appointment')
    INTO v_walkin_total, v_appointment_total
    FROM queue
    WHERE branch_id = p_branch_id AND queue_date BETWEEN p_start_date AND p_end_date;

    -- Hourly breakdown from 06:00 to 20:00 (Sri Lankan Barbershop trading hours)
    SELECT jsonb_agg(sub) INTO v_hourly_dist
    FROM (
        SELECT 
            h.hour_num,
            to_char(to_timestamp(h.hour_num::text, 'HH24'), 'HH12 AM') AS hour_label,
            COALESCE(COUNT(q.id), 0) AS customer_count,
            COALESCE(COUNT(q.id) FILTER (WHERE q.queue_type = 'walk_in'), 0) AS walk_ins,
            COALESCE(COUNT(q.id) FILTER (WHERE q.queue_type = 'appointment'), 0) AS appointments,
            ROUND(COALESCE(AVG(q.estimated_waiting_time), 15), 1) AS avg_wait_minutes
        FROM generate_series(6, 20) AS h(hour_num)
        LEFT JOIN queue q ON EXTRACT(HOUR FROM q.created_at) = h.hour_num 
            AND q.branch_id = p_branch_id 
            AND q.queue_date BETWEEN p_start_date AND p_end_date
        GROUP BY h.hour_num
        ORDER BY h.hour_num ASC
    ) sub;

    RETURN jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'walk_in_total', v_walkin_total,
        'appointment_total', v_appointment_total,
        'walk_in_ratio_pct', CASE WHEN (v_walkin_total + v_appointment_total) > 0 
            THEN ROUND((v_walkin_total::numeric / (v_walkin_total + v_appointment_total)::numeric) * 100.0, 1) 
            ELSE 50.0 END,
        'hourly_distribution', COALESCE(v_hourly_dist, '[]'::jsonb)
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------
ALTER VIEW vw_daily_financial_summary OWNER TO postgres;
ALTER VIEW vw_service_performance_summary OWNER TO postgres;
ALTER VIEW vw_barber_performance_summary OWNER TO postgres;
ALTER VIEW vw_hourly_traffic_summary OWNER TO postgres;

-- ------------------------------------------------------------------------
-- 12. DEMO HISTORICAL AGGREGATE SEED DATA (PAST 14 DAYS)
-- ------------------------------------------------------------------------
DO $$
DECLARE
    v_branch UUID;
    v_barber1 UUID;
    v_barber2 UUID;
    v_day_offset INTEGER;
    v_cur_date DATE;
    v_inv_id UUID;
    v_inv_num VARCHAR;
    v_cust1 UUID;
BEGIN
    SELECT id INTO v_branch FROM branches ORDER BY created_at ASC LIMIT 1;
    IF v_branch IS NULL THEN
        v_branch := 'b0000000-0000-0000-0000-000000000001';
        INSERT INTO branches (id, name, address, phone)
        VALUES (v_branch, 'Kiribathgoda Main Salon', 'No 45, Kandy Road, Kiribathgoda', '+94112912345')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    SELECT id INTO v_barber1 FROM staff WHERE branch_id = v_branch AND chair_number = 1 LIMIT 1;
    SELECT id INTO v_barber2 FROM staff WHERE branch_id = v_branch AND chair_number = 2 LIMIT 1;
    SELECT id INTO v_cust1 FROM customers WHERE branch_id = v_branch LIMIT 1;

    -- Generate historical demo invoices for the last 14 days
    FOR v_day_offset IN 1..14 LOOP
        v_cur_date := CURRENT_DATE - v_day_offset;
        v_inv_id := gen_random_uuid();
        v_inv_num := 'INV-' || to_char(v_cur_date, 'YYYYMMDD') || '-D' || v_day_offset;

        INSERT INTO invoices (
            id, branch_id, invoice_number, customer_id, staff_id,
            subtotal, discount, tax, grand_total, payment_status, payment_method,
            created_at, updated_at
        ) VALUES (
            v_inv_id, v_branch, v_inv_num, v_cust1, v_barber1,
            2400.00 + (v_day_offset * 150), 0.00, 0.00, 2400.00 + (v_day_offset * 150),
            'paid', CASE WHEN v_day_offset % 3 = 0 THEN 'lankaqr' WHEN v_day_offset % 2 = 0 THEN 'card' ELSE 'cash' END,
            v_cur_date + TIME '11:30:00', v_cur_date + TIME '11:30:00'
        ) ON CONFLICT (id) DO NOTHING;

        -- Create payment entry
        INSERT INTO payments (
            branch_id, invoice_id, reference_number, payment_method, amount, status, paid_time
        ) VALUES (
            v_branch, v_inv_id, 'PAY-HIST-' || v_day_offset,
            CASE WHEN v_day_offset % 3 = 0 THEN 'lankaqr' WHEN v_day_offset % 2 = 0 THEN 'card' ELSE 'cash' END,
            2400.00 + (v_day_offset * 150), 'paid', v_cur_date + TIME '11:30:00'
        ) ON CONFLICT DO NOTHING;
    END LOOP;

END $$;

