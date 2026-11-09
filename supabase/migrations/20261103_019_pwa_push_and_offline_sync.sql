-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 019: PROGRESSIVE WEB APP (PWA), WEB PUSH & OFFLINE RESILIENCE ENGINE
-- Features:
--   1. Table: pwa_push_subscriptions (Web Push endpoints, p256dh, auth keys)
--   2. Table: pwa_offline_sync_log (Client idempotency keys, replayed mutations)
--   3. RPC: fn_register_push_subscription (Upsert subscriber tokens)
--   4. RPC: fn_process_pwa_offline_batch (Reconciles offline queue & invoices)
--   5. RPC: fn_get_pwa_health_metrics (Diagnostic dashboard metrics)
--   6. Row Level Security (RLS) & Performance Indexes
--   7. Sample Test Seed Data for Zero-Downtime Diagnostics
-- ========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------
-- 1. TABLE: pwa_push_subscriptions
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pwa_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    device_type VARCHAR(30) DEFAULT 'mobile', -- 'mobile', 'tablet', 'desktop'
    platform VARCHAR(50) DEFAULT 'Unknown',   -- 'Android', 'iOS', 'Windows', 'macOS'
    notification_preferences JSONB DEFAULT '{"queue_turn": true, "appointment_reminder": true, "promotions": false}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwa_sub_branch ON pwa_push_subscriptions(branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pwa_sub_user ON pwa_push_subscriptions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pwa_sub_customer ON pwa_push_subscriptions(customer_id) WHERE customer_id IS NOT NULL;

-- ------------------------------------------------------------------------
-- 2. TABLE: pwa_offline_sync_log
-- Stores client-generated mutation idempotency keys and reconciliation outcomes
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pwa_offline_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    client_action_id VARCHAR(100) NOT NULL UNIQUE, -- Client idempotency UUID
    action_type VARCHAR(50) NOT NULL, -- 'quick_walk_in', 'record_payment', 'update_queue_status', 'save_invoice'
    payload JSONB NOT NULL,
    sync_status VARCHAR(30) DEFAULT 'processed', -- 'processed', 'conflict_resolved', 'rejected'
    resolved_entity_id UUID, -- Created or updated entity ID
    client_timestamp TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_pwa_sync_branch_status ON pwa_offline_sync_log(branch_id, sync_status);
CREATE INDEX IF NOT EXISTS idx_pwa_sync_client_action ON pwa_offline_sync_log(client_action_id);
CREATE INDEX IF NOT EXISTS idx_pwa_sync_processed_at ON pwa_offline_sync_log(processed_at DESC);

-- ------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------
ALTER TABLE pwa_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pwa_offline_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public and authenticated can manage push subscriptions" ON pwa_push_subscriptions;
CREATE POLICY "Public and authenticated can manage push subscriptions"
    ON pwa_push_subscriptions
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated and staff can view and manage offline sync logs" ON pwa_offline_sync_log;
CREATE POLICY "Authenticated and staff can view and manage offline sync logs"
    ON pwa_offline_sync_log
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------
-- 4. RPC: fn_register_push_subscription
-- Idempotently saves or reactivates a Web Push subscription
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_register_push_subscription(
    p_branch_id UUID,
    p_endpoint TEXT,
    p_p256dh TEXT,
    p_auth TEXT,
    p_user_agent TEXT DEFAULT NULL,
    p_device_type VARCHAR(30) DEFAULT 'mobile',
    p_platform VARCHAR(50) DEFAULT 'Unknown',
    p_user_id UUID DEFAULT NULL,
    p_customer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub_id UUID;
BEGIN
    INSERT INTO pwa_push_subscriptions (
        branch_id, endpoint, p256dh_key, auth_key,
        user_agent, device_type, platform, user_id, customer_id,
        is_active, last_used_at
    ) VALUES (
        p_branch_id, p_endpoint, p_p256dh, p_auth,
        p_user_agent, p_device_type, p_platform, p_user_id, p_customer_id,
        TRUE, NOW()
    )
    ON CONFLICT (endpoint) DO UPDATE SET
        branch_id = EXCLUDED.branch_id,
        p256dh_key = EXCLUDED.p256dh_key,
        auth_key = EXCLUDED.auth_key,
        user_agent = COALESCE(EXCLUDED.user_agent, pwa_push_subscriptions.user_agent),
        device_type = COALESCE(EXCLUDED.device_type, pwa_push_subscriptions.device_type),
        platform = COALESCE(EXCLUDED.platform, pwa_push_subscriptions.platform),
        user_id = COALESCE(EXCLUDED.user_id, pwa_push_subscriptions.user_id),
        customer_id = COALESCE(EXCLUDED.customer_id, pwa_push_subscriptions.customer_id),
        is_active = TRUE,
        last_used_at = NOW()
    RETURNING id INTO v_sub_id;

    RETURN jsonb_build_object(
        'success', true,
        'subscription_id', v_sub_id,
        'message', 'Web Push subscription registered successfully'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 5. RPC: fn_process_pwa_offline_batch
-- Accepts an array of client offline actions, executes them idempotently,
-- and records reconciliation logs with conflict handling
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_process_pwa_offline_batch(
    p_branch_id UUID,
    p_actions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_action JSONB;
    v_action_id VARCHAR(100);
    v_type VARCHAR(50);
    v_payload JSONB;
    v_client_ts TIMESTAMPTZ;
    v_processed_count INT := 0;
    v_skipped_count INT := 0;
    v_results JSONB := '[]'::jsonb;
    v_target_id UUID;
    v_invoice_num VARCHAR(50);
BEGIN
    FOR v_action IN SELECT * FROM jsonb_array_elements(p_actions)
    LOOP
        v_action_id := v_action->>'actionId';
        v_type := v_action->>'type';
        v_payload := v_action->'payload';
        v_client_ts := COALESCE((v_action->>'clientTimestamp')::timestamptz, NOW());

        -- Check if already processed (idempotency guard)
        IF EXISTS (SELECT 1 FROM pwa_offline_sync_log WHERE client_action_id = v_action_id) THEN
            v_skipped_count := v_skipped_count + 1;
            v_results := v_results || jsonb_build_object(
                'actionId', v_action_id,
                'status', 'already_processed',
                'type', v_type
            );
            CONTINUE;
        END IF;

        -- Process mutation depending on action type
        BEGIN
            IF v_type = 'quick_walk_in' THEN
                -- Trigger walk-in registration
                v_target_id := gen_random_uuid();
                INSERT INTO queue (
                    id, branch_id, customer_name, customer_phone,
                    queue_type, status, queue_date, queue_number,
                    staff_id, created_at, updated_at
                ) VALUES (
                    v_target_id,
                    p_branch_id,
                    COALESCE(v_payload->>'customerName', 'Walk-in Guest'),
                    COALESCE(v_payload->>'customerPhone', '+94770000000'),
                    'walk_in',
                    'waiting',
                    CURRENT_DATE,
                    COALESCE((v_payload->>'queueNumber')::int, 1),
                    (v_payload->>'staffId')::uuid,
                    v_client_ts,
                    NOW()
                );

                INSERT INTO pwa_offline_sync_log (
                    branch_id, client_action_id, action_type, payload,
                    sync_status, resolved_entity_id, client_timestamp
                ) VALUES (
                    p_branch_id, v_action_id, v_type, v_payload,
                    'processed', v_target_id, v_client_ts
                );

            ELSIF v_type = 'update_queue_status' THEN
                v_target_id := (v_payload->>'ticketId')::uuid;
                UPDATE queue
                SET status = v_payload->>'status',
                    updated_at = NOW()
                WHERE id = v_target_id;

                INSERT INTO pwa_offline_sync_log (
                    branch_id, client_action_id, action_type, payload,
                    sync_status, resolved_entity_id, client_timestamp
                ) VALUES (
                    p_branch_id, v_action_id, v_type, v_payload,
                    'processed', v_target_id, v_client_ts
                );

            ELSIF v_type = 'record_payment' OR v_type = 'save_invoice' THEN
                v_target_id := gen_random_uuid();
                v_invoice_num := COALESCE(v_payload->>'invoiceNumber', 'INV-OFFLINE-' || to_char(NOW(), 'HH24MISS'));

                INSERT INTO invoices (
                    id, branch_id, invoice_number, subtotal, discount, tax,
                    grand_total, payment_status, payment_method, notes,
                    created_at, updated_at
                ) VALUES (
                    v_target_id,
                    p_branch_id,
                    v_invoice_num,
                    COALESCE((v_payload->>'grandTotal')::numeric, (v_payload->>'subtotal')::numeric, 0),
                    COALESCE((v_payload->>'discount')::numeric, 0),
                    0,
                    COALESCE((v_payload->>'grandTotal')::numeric, 0),
                    COALESCE(v_payload->>'paymentStatus', 'paid'),
                    COALESCE(v_payload->>'paymentMethod', 'cash'),
                    'Reconciled from PWA Offline Outbox at ' || NOW()::text,
                    v_client_ts,
                    NOW()
                );

                INSERT INTO pwa_offline_sync_log (
                    branch_id, client_action_id, action_type, payload,
                    sync_status, resolved_entity_id, client_timestamp
                ) VALUES (
                    p_branch_id, v_action_id, v_type, v_payload,
                    'processed', v_target_id, v_client_ts
                );

            ELSE
                -- Generic fallback action record
                INSERT INTO pwa_offline_sync_log (
                    branch_id, client_action_id, action_type, payload,
                    sync_status, client_timestamp
                ) VALUES (
                    p_branch_id, v_action_id, v_type, v_payload,
                    'processed', v_client_ts
                );
            END IF;

            v_processed_count := v_processed_count + 1;
            v_results := v_results || jsonb_build_object(
                'actionId', v_action_id,
                'status', 'success',
                'type', v_type,
                'entityId', v_target_id
            );

        EXCEPTION WHEN OTHERS THEN
            INSERT INTO pwa_offline_sync_log (
                branch_id, client_action_id, action_type, payload,
                sync_status, client_timestamp, error_message
            ) VALUES (
                p_branch_id, v_action_id, v_type, v_payload,
                'rejected', v_client_ts, SQLERRM
            );

            v_results := v_results || jsonb_build_object(
                'actionId', v_action_id,
                'status', 'error',
                'type', v_type,
                'error', SQLERRM
            );
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'processedCount', v_processed_count,
        'skippedCount', v_skipped_count,
        'results', v_results
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 6. RPC: fn_get_pwa_health_metrics
-- Diagnostics for Salon Owner PWA Operations Cockpit
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_pwa_health_metrics(
    p_branch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_subs INT;
    v_mobile_subs INT;
    v_desktop_subs INT;
    v_recent_syncs INT;
    v_failed_syncs INT;
    v_last_sync_at TIMESTAMPTZ;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE device_type = 'mobile'),
        COUNT(*) FILTER (WHERE device_type = 'desktop')
    INTO v_total_subs, v_mobile_subs, v_desktop_subs
    FROM pwa_push_subscriptions
    WHERE branch_id = p_branch_id AND is_active = TRUE;

    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE sync_status = 'rejected'),
        MAX(processed_at)
    INTO v_recent_syncs, v_failed_syncs, v_last_sync_at
    FROM pwa_offline_sync_log
    WHERE branch_id = p_branch_id
      AND processed_at >= NOW() - INTERVAL '24 hours';

    RETURN jsonb_build_object(
        'branchId', p_branch_id,
        'pushSubscribersTotal', COALESCE(v_total_subs, 0),
        'pushSubscribersMobile', COALESCE(v_mobile_subs, 0),
        'pushSubscribersDesktop', COALESCE(v_desktop_subs, 0),
        'syncEventsLast24h', COALESCE(v_recent_syncs, 0),
        'syncErrorsLast24h', COALESCE(v_failed_syncs, 0),
        'lastSyncTimestamp', v_last_sync_at,
        'serviceWorkerStatus', 'active',
        'cacheTier', 'production-v2'
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 7. SEED AUDIT & SUBSCRIBER DEMO RECORDS (IDEMPOTENT)
-- ------------------------------------------------------------------------
DO $$
DECLARE
    v_branch UUID := 'b0000000-0000-0000-0000-000000000001';
BEGIN
    IF EXISTS (SELECT 1 FROM branches WHERE id = v_branch) THEN
        -- Seed demo push subscriber for Chair 01 Mobile Terminal
        INSERT INTO pwa_push_subscriptions (
            branch_id, endpoint, p256dh_key, auth_key,
            user_agent, device_type, platform, is_active
        ) VALUES (
            v_branch,
            'https://fcm.googleapis.com/fcm/send/demo-smart-salon-chair1-device',
            'BNcRdreALRF8M_demo_key_smart_salon_lk_p256dh_chair01_master_kavi',
            'auth_key_smart_salon_secret_sample',
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36',
            'mobile',
            'Android',
            TRUE
        ) ON CONFLICT (endpoint) DO NOTHING;

        -- Seed initial demo offline sync log
        INSERT INTO pwa_offline_sync_log (
            branch_id, client_action_id, action_type, payload,
            sync_status, client_timestamp, processed_at
        ) VALUES (
            v_branch,
            'sync-demo-init-001',
            'quick_walk_in',
            '{"customerName": "Dinesh Perera", "customerPhone": "+94771239999", "queueNumber": 12, "staffId": "c0000000-0000-0000-0000-000000000001"}'::jsonb,
            'processed',
            NOW() - INTERVAL '35 minutes',
            NOW() - INTERVAL '35 minutes'
        ) ON CONFLICT (client_action_id) DO NOTHING;
    END IF;
END $$;

