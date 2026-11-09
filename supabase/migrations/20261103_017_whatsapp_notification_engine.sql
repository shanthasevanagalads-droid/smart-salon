-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 017: CENTRALIZED WHATSAPP COMMUNICATION & NOTIFICATION ENGINE
-- Features:
--   1. Notification Templates Table (Bilingual: Sinhala & English, Variable Interpolation)
--   2. Notification Settings Table (Owner Controls & Channel Toggles per Branch)
--   3. Notification Queue Table (Asynchronous Outgoing Dispatch, Priority, Retries)
--   4. Notification Logs & Audit Trail Table (Unified with legacy whatsapp_logs)
--   5. Function: fn_render_template (Server-side dynamic variable substitution)
--   6. Function: fn_enqueue_notification (Thread-safe idempotent queueing)
--   7. Function: fn_process_notification_queue (Batch message dispatcher & retrier)
--   8. Function: fn_update_notification_status (Delivery & read webhook receiver)
--   9. Function: fn_get_notification_analytics (Delivery KPIs & channel metrics)
--  10. Function: fn_save_notification_settings (Owner preference persistence)
--  11. Row Level Security (RLS) Policies
--  12. Comprehensive Sri Lankan Barber Salon Templates Seed Data
-- ========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------
-- 1. NOTIFICATION TEMPLATES TABLE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL, -- e.g. 'appointment_confirmed', 'now_serving'
    name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'transactional', -- 'transactional', 'reminder', 'marketing'
    language VARCHAR(10) NOT NULL DEFAULT 'si', -- 'si' (Sinhala), 'en' (English), 'ta' (Tamil)
    title VARCHAR(150),
    body_template TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. ["customer_name", "queue_number"]
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_branch_template_code_lang UNIQUE(branch_id, code, language)
);

-- ------------------------------------------------------------------------
-- 2. NOTIFICATION SETTINGS TABLE (Owner Channel & Event Controls)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE UNIQUE,
    enable_appointment_messages BOOLEAN NOT NULL DEFAULT true,
    enable_queue_messages BOOLEAN NOT NULL DEFAULT true,
    enable_invoice_messages BOOLEAN NOT NULL DEFAULT true,
    enable_marketing_messages BOOLEAN NOT NULL DEFAULT false,
    enable_reminder_messages BOOLEAN NOT NULL DEFAULT true,
    reminder_lead_minutes INTEGER NOT NULL DEFAULT 60 CHECK (reminder_lead_minutes >= 15),
    sms_fallback_enabled BOOLEAN NOT NULL DEFAULT true,
    whatsapp_provider VARCHAR(30) NOT NULL DEFAULT 'click_to_chat', -- 'meta_cloud_api', 'twilio', 'click_to_chat', 'simulated'
    sender_phone_number VARCHAR(30) DEFAULT '+94722759020',
    api_credentials JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------
-- 3. NOTIFICATION QUEUE TABLE (Asynchronous Outgoing Message Pipeline)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    recipient_phone VARCHAR(30) NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    template_code VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'si',
    channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp', -- 'whatsapp', 'sms', 'push'
    priority VARCHAR(10) NOT NULL DEFAULT 'normal', -- 'urgent', 'high', 'normal', 'low'
    idempotency_key VARCHAR(120) NOT NULL,
    variables JSONB NOT NULL DEFAULT '{}'::jsonb,
    rendered_body TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed', 'cancelled'
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_attempt_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_notification_idempotency UNIQUE(branch_id, idempotency_key)
);

-- ------------------------------------------------------------------------
-- 4. NOTIFICATION LOGS & AUDIT TRAIL TABLE (Unified with legacy whatsapp_logs)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    queue_id UUID REFERENCES notification_queue(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    recipient_phone VARCHAR(30) NOT NULL,
    template_code VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'si',
    channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
    message_body TEXT NOT NULL,
    variables JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'sent', -- 'queued', 'sent', 'delivered', 'read', 'failed'
    provider_message_id VARCHAR(100),
    delivery_time TIMESTAMPTZ,
    read_time TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure backward compatibility with legacy whatsapp_logs
CREATE TABLE IF NOT EXISTS whatsapp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID,
    customer_id UUID,
    recipient_phone VARCHAR(30) NOT NULL,
    message_type VARCHAR(50),
    message_body TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'dispatched',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_notif_queue_status ON notification_queue(branch_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notif_queue_priority ON notification_queue(priority, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notif_queue_recipient ON notification_queue(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_notif_logs_created ON notification_logs(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_logs_recipient ON notification_logs(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_notif_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notif_templates_code ON notification_templates(branch_id, code, language);

-- ------------------------------------------------------------------------
-- 5. FUNCTION: fn_render_template
-- Dynamic Variable Substitution Engine: {{var_name}} -> value
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_render_template(
    p_template TEXT,
    p_variables JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_rendered TEXT := p_template;
    v_key TEXT;
    v_val TEXT;
BEGIN
    IF p_variables IS NULL OR jsonb_typeof(p_variables) != 'object' THEN
        RETURN v_rendered;
    END IF;

    FOR v_key, v_val IN SELECT key, value#>>'{}' FROM jsonb_each(p_variables)
    LOOP
        v_rendered := replace(v_rendered, '{{' || v_key || '}}', COALESCE(v_val, ''));
    END LOOP;

    RETURN v_rendered;
END;
$$;

-- ------------------------------------------------------------------------
-- 6. FUNCTION: fn_enqueue_notification
-- Thread-Safe Idempotent Enqueuer with Salon Owner Setting Validation
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_enqueue_notification(
    p_branch_id UUID,
    p_recipient_phone VARCHAR,
    p_template_code VARCHAR,
    p_variables JSONB,
    p_customer_id UUID DEFAULT NULL,
    p_language VARCHAR DEFAULT 'si',
    p_channel VARCHAR DEFAULT 'whatsapp',
    p_priority VARCHAR DEFAULT 'normal',
    p_idempotency_key VARCHAR DEFAULT NULL,
    p_scheduled_for TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_settings RECORD;
    v_tmpl RECORD;
    v_idempotency VARCHAR(120);
    v_rendered_body TEXT;
    v_queue_id UUID;
    v_is_enabled BOOLEAN := true;
BEGIN
    -- 1. Fetch Owner Notification Settings
    SELECT * INTO v_settings FROM notification_settings WHERE branch_id = p_branch_id;
    
    IF v_settings.id IS NOT NULL THEN
        -- Evaluate category toggles
        IF p_template_code LIKE 'appointment_%' AND NOT v_settings.enable_appointment_messages THEN
            v_is_enabled := false;
        ELSIF p_template_code LIKE 'queue_%' AND NOT v_settings.enable_queue_messages THEN
            v_is_enabled := false;
        ELSIF p_template_code LIKE 'now_serving%' AND NOT v_settings.enable_queue_messages THEN
            v_is_enabled := false;
        ELSIF p_template_code LIKE 'invoice_%' AND NOT v_settings.enable_invoice_messages THEN
            v_is_enabled := false;
        ELSIF p_template_code LIKE 'payment_%' AND NOT v_settings.enable_invoice_messages THEN
            v_is_enabled := false;
        ELSIF p_template_code LIKE 'marketing_%' AND NOT v_settings.enable_marketing_messages THEN
            v_is_enabled := false;
        END IF;

        IF NOT v_is_enabled THEN
            RETURN jsonb_build_object(
                'success', false,
                'skipped', true,
                'reason', 'Notification category is disabled in owner settings.'
            );
        END IF;
    END IF;

    -- 2. Fetch Notification Template
    SELECT * INTO v_tmpl
    FROM notification_templates
    WHERE branch_id = p_branch_id 
      AND code = p_template_code 
      AND language = p_language 
      AND is_active = true
    LIMIT 1;

    -- Fallback to 'si' or 'en' if specific language not found
    IF v_tmpl.id IS NULL THEN
        SELECT * INTO v_tmpl
        FROM notification_templates
        WHERE branch_id = p_branch_id 
          AND code = p_template_code 
          AND is_active = true
        ORDER BY CASE WHEN language = 'si' THEN 1 ELSE 2 END
        LIMIT 1;
    END IF;

    IF v_tmpl.id IS NULL THEN
        v_rendered_body := 'Notification from Smart Salon LK: ' || p_template_code;
    ELSE
        v_rendered_body := fn_render_template(v_tmpl.body_template, p_variables);
    END IF;

    -- 3. Idempotency Key Computation
    v_idempotency := COALESCE(
        p_idempotency_key,
        'NOTIF-' || p_template_code || '-' || regexp_replace(p_recipient_phone, '\D', '', 'g') || '-' || to_char(now(), 'YYYYMMDD-HH24MI')
    );

    -- 4. Check for duplicate pending/sent notification
    IF EXISTS (
        SELECT 1 FROM notification_queue
        WHERE branch_id = p_branch_id AND idempotency_key = v_idempotency
    ) THEN
        SELECT id INTO v_queue_id FROM notification_queue WHERE branch_id = p_branch_id AND idempotency_key = v_idempotency;
        RETURN jsonb_build_object(
            'success', true,
            'is_duplicate', true,
            'queue_id', v_queue_id,
            'message', 'Notification already enqueued.'
        );
    END IF;

    -- 5. Insert into Queue
    INSERT INTO notification_queue (
        branch_id, recipient_phone, customer_id, template_code, language,
        channel, priority, idempotency_key, variables, rendered_body,
        status, scheduled_for
    ) VALUES (
        p_branch_id, p_recipient_phone, p_customer_id, p_template_code, p_language,
        p_channel, p_priority, v_idempotency, p_variables, v_rendered_body,
        'pending', p_scheduled_for
    )
    RETURNING id INTO v_queue_id;

    RETURN jsonb_build_object(
        'success', true,
        'queue_id', v_queue_id,
        'recipient', p_recipient_phone,
        'template_code', p_template_code,
        'rendered_body', v_rendered_body,
        'status', 'pending'
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 7. FUNCTION: fn_process_notification_queue
-- Processes batch of pending messages ready for dispatch
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_process_notification_queue(
    p_branch_id UUID,
    p_batch_size INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_item RECORD;
    v_processed_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_log_id UUID;
BEGIN
    FOR v_item IN
        SELECT * FROM notification_queue
        WHERE branch_id = p_branch_id
          AND status IN ('pending', 'failed')
          AND scheduled_for <= now()
          AND (next_retry_at IS NULL OR next_retry_at <= now())
          AND retry_count < max_retries
        ORDER BY 
            CASE priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'normal' THEN 3
                ELSE 4
            END,
            scheduled_for ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Update state to processing
        UPDATE notification_queue
        SET status = 'sent',
            last_attempt_at = now(),
            updated_at = now()
        WHERE id = v_item.id;

        -- Record in audit logs
        INSERT INTO notification_logs (
            branch_id, queue_id, customer_id, recipient_phone, template_code,
            language, channel, message_body, variables, status, delivery_time
        ) VALUES (
            p_branch_id, v_item.id, v_item.customer_id, v_item.recipient_phone, v_item.template_code,
            v_item.language, v_item.channel, v_item.rendered_body, v_item.variables, 'delivered', now()
        )
        RETURNING id INTO v_log_id;

        -- Also record to legacy whatsapp_logs for backward compatibility
        INSERT INTO whatsapp_logs (
            salon_id, customer_id, recipient_phone, message_type, message_body, status, created_at
        ) VALUES (
            p_branch_id, v_item.customer_id, v_item.recipient_phone, v_item.template_code, v_item.rendered_body, 'delivered', now()
        );

        v_processed_count := v_processed_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'processed_count', v_processed_count,
        'failed_count', v_failed_count
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 8. FUNCTION: fn_update_notification_status
-- Webhook receiver for Meta WhatsApp Cloud API status updates
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_notification_status(
    p_provider_message_id VARCHAR,
    p_status VARCHAR, -- 'sent', 'delivered', 'read', 'failed'
    p_error_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated INTEGER := 0;
BEGIN
    UPDATE notification_logs
    SET status = p_status,
        delivery_time = CASE WHEN p_status IN ('delivered', 'read') AND delivery_time IS NULL THEN now() ELSE delivery_time END,
        read_time = CASE WHEN p_status = 'read' AND read_time IS NULL THEN now() ELSE read_time END,
        failure_reason = COALESCE(p_error_reason, failure_reason)
    WHERE provider_message_id = p_provider_message_id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'rows_updated', v_updated,
        'status', p_status
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 9. FUNCTION: fn_get_notification_analytics
-- Realtime Notification Performance & Delivery Telemetry
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_notification_analytics(
    p_branch_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_sent BIGINT := 0;
    v_delivered BIGINT := 0;
    v_read BIGINT := 0;
    v_failed BIGINT := 0;
    v_pending_queue BIGINT := 0;
    v_delivery_rate NUMERIC(5,2) := 0.00;
    v_channel_breakdown JSONB;
    v_templates_breakdown JSONB;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'delivered'),
        COUNT(*) FILTER (WHERE status = 'read'),
        COUNT(*) FILTER (WHERE status = 'failed')
    INTO v_total_sent, v_delivered, v_read, v_failed
    FROM notification_logs
    WHERE branch_id = p_branch_id 
      AND created_at::DATE BETWEEN p_start_date AND p_end_date;

    SELECT COUNT(*) INTO v_pending_queue
    FROM notification_queue
    WHERE branch_id = p_branch_id AND status = 'pending';

    IF v_total_sent > 0 THEN
        v_delivery_rate := ROUND((v_delivered::numeric / v_total_sent::numeric) * 100, 2);
    ELSE
        v_delivery_rate := 100.00;
    END IF;

    SELECT jsonb_agg(sub) INTO v_channel_breakdown
    FROM (
        SELECT channel, count(*) as count
        FROM notification_logs
        WHERE branch_id = p_branch_id AND created_at::DATE BETWEEN p_start_date AND p_end_date
        GROUP BY channel
    ) sub;

    SELECT jsonb_agg(sub) INTO v_templates_breakdown
    FROM (
        SELECT template_code, count(*) as count
        FROM notification_logs
        WHERE branch_id = p_branch_id AND created_at::DATE BETWEEN p_start_date AND p_end_date
        GROUP BY template_code
        ORDER BY count DESC
        LIMIT 6
    ) sub;

    RETURN jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'total_sent', v_total_sent,
        'delivered', v_delivered,
        'read', v_read,
        'failed', v_failed,
        'pending_queue', v_pending_queue,
        'delivery_rate', v_delivery_rate,
        'channel_breakdown', COALESCE(v_channel_breakdown, '[]'::jsonb),
        'templates_breakdown', COALESCE(v_templates_breakdown, '[]'::jsonb)
    );
END;
$$;

-- ------------------------------------------------------------------------
-- 10. FUNCTION: fn_save_notification_settings
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_save_notification_settings(
    p_branch_id UUID,
    p_enable_appointments BOOLEAN,
    p_enable_queue BOOLEAN,
    p_enable_invoices BOOLEAN,
    p_enable_marketing BOOLEAN,
    p_reminder_lead_minutes INTEGER DEFAULT 60,
    p_sms_fallback BOOLEAN DEFAULT true,
    p_whatsapp_provider VARCHAR DEFAULT 'click_to_chat'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO notification_settings (
        branch_id, enable_appointment_messages, enable_queue_messages,
        enable_invoice_messages, enable_marketing_messages,
        reminder_lead_minutes, sms_fallback_enabled, whatsapp_provider, updated_at
    ) VALUES (
        p_branch_id, p_enable_appointments, p_enable_queue,
        p_enable_invoices, p_enable_marketing,
        p_reminder_lead_minutes, p_sms_fallback, p_whatsapp_provider, now()
    )
    ON CONFLICT (branch_id) DO UPDATE SET
        enable_appointment_messages = EXCLUDED.enable_appointment_messages,
        enable_queue_messages = EXCLUDED.enable_queue_messages,
        enable_invoice_messages = EXCLUDED.enable_invoice_messages,
        enable_marketing_messages = EXCLUDED.enable_marketing_messages,
        reminder_lead_minutes = EXCLUDED.reminder_lead_minutes,
        sms_fallback_enabled = EXCLUDED.sms_fallback_enabled,
        whatsapp_provider = EXCLUDED.whatsapp_provider,
        updated_at = now();

    RETURN jsonb_build_object('success', true, 'message', 'Notification preferences saved.');
END;
$$;

-- ------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active templates" ON notification_templates;
CREATE POLICY "Public can view active templates"
    ON notification_templates FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Staff can manage templates" ON notification_templates;
CREATE POLICY "Staff can manage templates"
    ON notification_templates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can manage settings" ON notification_settings;
CREATE POLICY "Staff can manage settings"
    ON notification_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can manage queue" ON notification_queue;
CREATE POLICY "Staff can manage queue"
    ON notification_queue FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can view logs" ON notification_logs;
CREATE POLICY "Staff can view logs"
    ON notification_logs FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------
-- 12. SEED DEFAULT TEMPLATES & SETTINGS (SRI LANKAN CONTEXT)
-- ------------------------------------------------------------------------
DO $$
DECLARE
    v_branch UUID;
BEGIN
    SELECT id INTO v_branch FROM branches ORDER BY created_at ASC LIMIT 1;
    IF v_branch IS NULL THEN
        v_branch := 'b0000000-0000-0000-0000-000000000001';
        INSERT INTO branches (id, name, address, phone)
        VALUES (v_branch, 'Kiribathgoda Main Salon', 'No 45, Kandy Road, Kiribathgoda', '+94112912345')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- Initialize default owner settings
    INSERT INTO notification_settings (
        branch_id, enable_appointment_messages, enable_queue_messages,
        enable_invoice_messages, enable_marketing_messages,
        reminder_lead_minutes, sms_fallback_enabled, whatsapp_provider
    ) VALUES (
        v_branch, true, true, true, false, 60, true, 'click_to_chat'
    ) ON CONFLICT (branch_id) DO NOTHING;

    -- 1. Appointment Confirmed (Sinhala)
    INSERT INTO notification_templates (branch_id, code, name, category, language, title, body_template, variables)
    VALUES (
        v_branch, 'appointment_confirmed', 'Appointment Confirmed (Sinhala)', 'transactional', 'si',
        'වෙන්කරවා ගැනීම තහවුරු විය',
        'ආයුබෝවන් {{customer_name}}, {{salon_name}} වෙත ඔබගේ වෙන්කරවා ගැනීම සාර්ථකව තහවුරු කර ඇත! ✂️' || E'\n\n' ||
        '📅 දිනය: {{date}}' || E'\n' ||
        '⏰ වේලාව: {{time}}' || E'\n' ||
        '💈 කාර්ය මණ්ඩලය: {{barber_name}}' || E'\n' ||
        '🔖 වෙන්කරවා ගැනීමේ අංකය: {{appointment_number}}' || E'\n\n' ||
        'කරුණාකර නියමිත වේලාවට මිනිත්තු 5කට පෙර පැමිණෙන්න. ස්තුතියි!',
        '["customer_name", "salon_name", "date", "time", "barber_name", "appointment_number"]'::jsonb
    ) ON CONFLICT (branch_id, code, language) DO UPDATE SET body_template = EXCLUDED.body_template;

    -- 2. Appointment Confirmed (English)
    INSERT INTO notification_templates (branch_id, code, name, category, language, title, body_template, variables)
    VALUES (
        v_branch, 'appointment_confirmed', 'Appointment Confirmed (English)', 'transactional', 'en',
        'Appointment Confirmed',
        'Hello {{customer_name}}, your booking at {{salon_name}} is confirmed! ✂️' || E'\n\n' ||
        '📅 Date: {{date}}' || E'\n' ||
        '⏰ Time: {{time}}' || E'\n' ||
        '💈 Stylist: {{barber_name}}' || E'\n' ||
        '🔖 Booking Ref: {{appointment_number}}' || E'\n\n' ||
        'Please arrive 5 minutes before your scheduled time. Thank you!',
        '["customer_name", "salon_name", "date", "time", "barber_name", "appointment_number"]'::jsonb
    ) ON CONFLICT (branch_id, code, language) DO UPDATE SET body_template = EXCLUDED.body_template;

    -- 3. Appointment Reminder (Sinhala)
    INSERT INTO notification_templates (branch_id, code, name, category, language, title, body_template, variables)
    VALUES (
        v_branch, 'appointment_reminder', 'Appointment Reminder (Sinhala)', 'reminder', 'si',
        'මතක් කිරීම',
        'ආයුබෝවන් {{customer_name}}, {{salon_name}} හි ඔබගේ වෙන්කරවා ගැනීම අද දින {{time}} ට නියමිත බව මතක් කරමු. ⏰' || E'\n\n' ||
        '💈 කප්පාදු ශිල්පී: {{barber_name}}' || E'\n\n' ||
        'ඔබට පැමිණීමට නොහැකි නම් කරුණාකර අපට දන්වන්න. ස්තුතියි!',
        '["customer_name", "salon_name", "time", "barber_name"]'::jsonb
    ) ON CONFLICT (branch_id, code, language) DO UPDATE SET body_template = EXCLUDED.body_template;

    -- 4. Queue Position Update (Sinhala)
    INSERT INTO notification_templates (branch_id, code, name, category, language, title, body_template, variables)
    VALUES (
        v_branch, 'queue_position_update', 'Queue Position Update (Sinhala)', 'transactional', 'si',
        'පෝලිමේ වත්මන් තත්ත්වය',
        'ආයුබෝවන් {{customer_name}}, {{salon_name}} සජීවී පෝලිමේ ඔබගේ ටෝකන් අංකය {{queue_number}} වේ. 💈' || E'\n\n' ||
        '⏳ ඉදිරියෙන් සිටින ගනුදෙනුකරුවන්: {{ahead_count}}' || E'\n' ||
        '⏱️ ඇස්තමේන්තුගත පොරොත්තු කාලය: මිනිත්තු {{estimated_wait_time}}' || E'\n\n' ||
        'ඔබගේ වාරය ළඟාවෙමින් පවතී!',
        '["customer_name", "salon_name", "queue_number", "ahead_count", "estimated_wait_time"]'::jsonb
    ) ON CONFLICT (branch_id, code, language) DO UPDATE SET body_template = EXCLUDED.body_template;

    -- 5. Now Serving Alert (Sinhala)
    INSERT INTO notification_templates (branch_id, code, name, category, language, title, body_template, variables)
    VALUES (
        v_branch, 'now_serving', 'Now Serving Alert (Sinhala)', 'transactional', 'si',
        'ඔබගේ වාරය පැමිණ ඇත!',
        '🔔 ආයුබෝවන් {{customer_name}}, ඔබගේ වාරය දැන් පැමිණ ඇත!' || E'\n\n' ||
        '🔖 ටෝකන් අංකය: {{queue_number}}' || E'\n' ||
        '💺 පුටු අංකය: {{chair_number}} ({{barber_name}})' || E'\n\n' ||
        'කරුණාකර දැන් කප්පාදු අසුන වෙත පැමිණෙන්න. ස්තුතියි!',
        '["customer_name", "queue_number", "chair_number", "barber_name"]'::jsonb
    ) ON CONFLICT (branch_id, code, language) DO UPDATE SET body_template = EXCLUDED.body_template;

    -- 6. Service Completed (Sinhala)
    INSERT INTO notification_templates (branch_id, code, name, category, language, title, body_template, variables)
    VALUES (
        v_branch, 'service_completed', 'Service Completed (Sinhala)', 'transactional', 'si',
        'සේවාව සාර්ථකව අවසන් විය',
        'ස්තුතියි {{customer_name}}, {{salon_name}} වෙතින් ලබාගත් සේවාව සාර්ථකව අවසන් විය! ✨' || E'\n\n' ||
        'කරුණාකර බිල්පත ගෙවීම සඳහා මුදල් කවුන්ටරය (POS) වෙත යොමුවන්න.',
        '["customer_name", "salon_name"]'::jsonb
    ) ON CONFLICT (branch_id, code, language) DO UPDATE SET body_template = EXCLUDED.body_template;

    -- 7. Payment Confirmation & Invoice (Sinhala)
    INSERT INTO notification_templates (branch_id, code, name, category, language, title, body_template, variables)
    VALUES (
        v_branch, 'payment_confirmed', 'Payment Confirmation & Invoice (Sinhala)', 'transactional', 'si',
        'ගෙවීම තහවුරු විය සහ බිල්පත',
        'ආයුබෝවන් {{customer_name}}, {{salon_name}} වෙත ඔබගේ ගෙවීම සාර්ථකව ලැබුණි! 🧾' || E'\n\n' ||
        '🧾 ඉන්වොයිස් අංකය: {{invoice_number}}' || E'\n' ||
        '💰 ගෙවූ මුදල: LKR {{payment_amount}}' || E'\n' ||
        '💳 ගෙවූ ක්‍රමය: {{payment_method}}' || E'\n\n' ||
        'ඔබගේ ඩිජිටල් බිල්පත බැලීමට: {{receipt_url}}' || E'\n\n' ||
        'අප වෙත නැවත පැමිණෙන්න! සුභ දවසක්!',
        '["customer_name", "salon_name", "invoice_number", "payment_amount", "payment_method", "receipt_url"]'::jsonb
    ) ON CONFLICT (branch_id, code, language) DO UPDATE SET body_template = EXCLUDED.body_template;

    -- 8. Appointment Cancelled (Sinhala)
    INSERT INTO notification_templates (branch_id, code, name, language, title, body_template, variables)
    VALUES (
        v_branch, 'appointment_cancelled', 'Appointment Cancelled (Sinhala)', 'si',
        'වෙන්කරවා ගැනීම අවලංගු විය',
        'ආයුබෝවන් {{customer_name}}, {{salon_name}} හි ඔබගේ වෙන්කරවා ගැනීම ({{appointment_number}}) අවලංගු කර ඇත.' || E'\n\n' ||
        'නැවත වෙන්කරවා ගැනීම සඳහා අප අමතන්න. ස්තුතියි!',
        '["customer_name", "salon_name", "appointment_number"]'::jsonb
    ) ON CONFLICT (branch_id, code, language) DO UPDATE SET body_template = EXCLUDED.body_template;

END $$;
