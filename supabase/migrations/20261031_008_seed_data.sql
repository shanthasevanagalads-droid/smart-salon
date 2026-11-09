-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 08: PRODUCTION SEED DATA (SRI LANKAN MEN'S SALON CONTEXT)
-- IDEMPOTENT: Relaxes legacy NOT NULL constraints and synchronizes all columns
-- ========================================================================

-- Enable core extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------
-- 0. GUARANTEE SCHEMA CONVERGENCE & RELAX LEGACY CONSTRAINTS
-- ------------------------------------------------------------------------

-- 0.1 Drop legacy NOT NULL constraints from 001 draft schema
DO $$
BEGIN
    -- services legacy columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'salon_id') THEN
        ALTER TABLE services ALTER COLUMN salon_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'price_lkr') THEN
        ALTER TABLE services ALTER COLUMN price_lkr DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'duration_minutes') THEN
        ALTER TABLE services ALTER COLUMN duration_minutes DROP NOT NULL;
    END IF;

    -- customers legacy columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'salon_id') THEN
        ALTER TABLE customers ALTER COLUMN salon_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'phone') THEN
        ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'full_name') THEN
        ALTER TABLE customers ALTER COLUMN full_name DROP NOT NULL;
    END IF;

    -- appointments legacy columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'salon_id') THEN
        ALTER TABLE appointments ALTER COLUMN salon_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'start_time') THEN
        ALTER TABLE appointments ALTER COLUMN start_time DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'end_time') THEN
        ALTER TABLE appointments ALTER COLUMN end_time DROP NOT NULL;
    END IF;

    -- invoices legacy columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'salon_id') THEN
        ALTER TABLE invoices ALTER COLUMN salon_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'subtotal_lkr') THEN
        ALTER TABLE invoices ALTER COLUMN subtotal_lkr DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'total_lkr') THEN
        ALTER TABLE invoices ALTER COLUMN total_lkr DROP NOT NULL;
    END IF;

    -- whatsapp_logs legacy columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'salon_id') THEN
        ALTER TABLE whatsapp_logs ALTER COLUMN salon_id DROP NOT NULL;
    END IF;
END $$;

-- 0.2 Services table convergence & unique conflict index
ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
ALTER TABLE services ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE services ADD COLUMN IF NOT EXISTS icon_name VARCHAR(50) DEFAULT 'content_cut';
ALTER TABLE services ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 1;
ALTER TABLE services ADD COLUMN IF NOT EXISTS active_status BOOLEAN DEFAULT true;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) DEFAULT 'b0000000-0000-0000-0000-000000000001';

DO $$
BEGIN
    UPDATE services SET branch_id = 'b0000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'price_lkr') THEN
        UPDATE services SET price = price_lkr WHERE price IS NULL;
    END IF;
    UPDATE services SET price = 1000.00 WHERE price IS NULL;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'duration_minutes') THEN
        UPDATE services SET duration = duration_minutes WHERE duration IS NULL;
    END IF;
    UPDATE services SET duration = 30 WHERE duration IS NULL;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'sort_order') THEN
        UPDATE services SET display_order = sort_order WHERE display_order IS NULL;
    END IF;
    UPDATE services SET display_order = 1 WHERE display_order IS NULL;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'is_active') THEN
        UPDATE services SET active_status = is_active WHERE active_status IS NULL;
    END IF;
    UPDATE services SET active_status = true WHERE active_status IS NULL;

    -- Deduplicate services if duplicate (branch_id, code) exists before creating unique index
    DELETE FROM services a USING services b
    WHERE a.id > b.id AND a.branch_id = b.branch_id AND a.code = b.code;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_service_code ON services (branch_id, code);

-- 0.3 Customers & Walk-in Customers convergence
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spending NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_barber_id UUID;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_number VARCHAR(30);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS mobile VARCHAR(25);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(25);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) DEFAULT 'b0000000-0000-0000-0000-000000000001';

DO $$
BEGIN
    UPDATE customers SET branch_id = 'b0000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'phone') THEN
        UPDATE customers SET mobile = phone WHERE mobile IS NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'full_name') THEN
        UPDATE customers SET name = full_name WHERE name IS NULL;
    END IF;

    UPDATE customers SET whatsapp = mobile WHERE whatsapp IS NULL;

    WITH numbered AS (
        SELECT id, 'CUST-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 5, '0') AS gen_num
        FROM customers
        WHERE customer_number IS NULL
    )
    UPDATE customers c
    SET customer_number = n.gen_num
    FROM numbered n
    WHERE c.id = n.id AND c.customer_number IS NULL;
END $$;

CREATE TABLE IF NOT EXISTS walk_in_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    walk_in_number VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL DEFAULT 'Walk-in Guest',
    mobile VARCHAR(25),
    whatsapp_number VARCHAR(25),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- 0.4 Staff & Queue convergence & unique targets
ALTER TABLE staff ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS staff_number VARCHAR(30);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS position VARCHAR(50) DEFAULT 'Senior Stylist';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS chair_number INTEGER DEFAULT 1;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2) DEFAULT 30.00;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) DEFAULT 4.9;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE queue ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE queue ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS walk_in_id UUID REFERENCES walk_in_customers(id) ON DELETE SET NULL;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS ticket_code VARCHAR(30);
ALTER TABLE queue ADD COLUMN IF NOT EXISTS estimated_waiting_time INTEGER DEFAULT 15;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_daily_queue_number ON queue (branch_id, queue_date, queue_number);

-- 0.5 Branches & Business Settings convergence & unique targets
ALTER TABLE branches ADD COLUMN IF NOT EXISTS branch_number VARCHAR(20) DEFAULT 'BR-001';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS sinhala_name VARCHAR(200);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT 'Ampitiya';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS district VARCHAR(50) DEFAULT 'Kandy';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(25);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS email VARCHAR(100);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_main_branch BOOLEAN DEFAULT true;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_settings_branch ON business_settings (branch_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_working_day ON working_hours (branch_id, day_name);

-- ------------------------------------------------------------------------
-- 1. SEED SYSTEM ROLES
-- ------------------------------------------------------------------------
INSERT INTO roles (id, name, display_name, description, permissions)
VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'owner',
    'Salon Owner',
    'Full administrative control over salon operations, billing, staff, and financial analytics.',
    '["salon:manage", "staff:manage", "services:manage", "billing:manage", "reports:view", "queue:manage", "appointments:manage"]'::jsonb
),
(
    '22222222-2222-2222-2222-222222222222',
    'staff',
    'Barber / Staff',
    'Manage operational live queue, advance queue tickets, complete haircuts, and record cash/LankaQR bills.',
    '["queue:manage", "appointments:view", "appointments:update", "billing:create", "services:view"]'::jsonb
),
(
    '33333333-3333-3333-3333-333333333333',
    'customer',
    'Customer',
    'Browse services, book chair appointments, join live queue, and receive WhatsApp receipts.',
    '["queue:join", "appointments:create", "appointments:view_own", "invoices:view_own"]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    display_name = EXCLUDED.display_name,
    permissions = EXCLUDED.permissions;

-- ------------------------------------------------------------------------
-- 2. SEED MAIN BRANCH (AMPITIYA)
-- ------------------------------------------------------------------------
INSERT INTO branches (id, branch_number, name, sinhala_name, slug, address, city, district, phone, whatsapp_number, email, is_main_branch, is_active)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'BR-001',
    'Smart Salon LK - Ampitiya',
    'ස්මාර්ට් සැලූන් - අම්පිටිය',
    'smart-salon-Ampitiya',
    'Kandy Road, Ampitiya (Near Ampitiya Bus Stand)',
    'Ampitiya',
    'Kandy',
    '+94722759020',
    '+94722759020',
    'info@smartsallon.lk',
    true,
    true
)
ON CONFLICT (id) DO UPDATE SET
    branch_number = EXCLUDED.branch_number,
    name = EXCLUDED.name,
    sinhala_name = EXCLUDED.sinhala_name,
    slug = EXCLUDED.slug,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    district = EXCLUDED.district,
    phone = EXCLUDED.phone,
    whatsapp_number = EXCLUDED.whatsapp_number,
    email = EXCLUDED.email,
    is_main_branch = EXCLUDED.is_main_branch,
    is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------------------
-- 3. SEED BUSINESS SETTINGS
-- ------------------------------------------------------------------------
INSERT INTO business_settings (
    branch_id, salon_name, sinhala_name, address, city, phone, whatsapp, email,
    opening_time, closing_time, currency, time_zone, invoice_prefix, queue_prefix,
    barcode_prefix, tax_percentage, enable_card_payments, enable_lankaqr, enable_walk_ins,
    enable_notifications, language, lankaqr_merchant_id, lankaqr_account_number
)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'Smart Salon LK',
    'ස්මාර්ට් සැලූන්',
    'Kandy Road, Ampitiya',
    'Ampitiya',
    '+94722759020',
    '+94722759020',
    'Ampitiya@smartsallon.lk',
    '06:00:00',
    '20:00:00',
    'LKR',
    'Asia/Colombo',
    'INV-',
    'LK-',
    'SSLK-',
    0.00,
    true,
    true,
    true,
    true,
    'si',
    'LKQR-9021-SMART',
    '800123456789'
)
ON CONFLICT (branch_id) DO UPDATE SET
    salon_name = EXCLUDED.salon_name,
    sinhala_name = EXCLUDED.sinhala_name,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    phone = EXCLUDED.phone,
    whatsapp = EXCLUDED.whatsapp,
    email = EXCLUDED.email,
    opening_time = EXCLUDED.opening_time,
    closing_time = EXCLUDED.closing_time,
    time_zone = EXCLUDED.time_zone;

-- ------------------------------------------------------------------------
-- 4. SEED 7-DAY WORKING HOURS
-- ------------------------------------------------------------------------
INSERT INTO working_hours (branch_id, day_name, day_index, opening_time, closing_time, is_closed)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'Monday', 1, '06:00:00', '20:00:00', false),
    ('b0000000-0000-0000-0000-000000000001', 'Tuesday', 2, '06:00:00', '20:00:00', false),
    ('b0000000-0000-0000-0000-000000000001', 'Wednesday', 3, '06:00:00', '20:00:00', false),
    ('b0000000-0000-0000-0000-000000000001', 'Thursday', 4, '06:00:00', '20:00:00', false),
    ('b0000000-0000-0000-0000-000000000001', 'Friday', 5, '06:00:00', '20:00:00', false),
    ('b0000000-0000-0000-0000-000000000001', 'Saturday', 6, '06:00:00', '20:00:00', false),
    ('b0000000-0000-0000-0000-000000000001', 'Sunday', 0, '06:00:00', '20:00:00', false)
ON CONFLICT (branch_id, day_name) DO UPDATE SET
    opening_time = EXCLUDED.opening_time,
    closing_time = EXCLUDED.closing_time,
    is_closed = EXCLUDED.is_closed;

-- ------------------------------------------------------------------------
-- 5. SEED 8 DEFAULT GROOMING SERVICES
-- ------------------------------------------------------------------------
INSERT INTO services (branch_id, code, name, sinhala_name, description, category, price, duration, icon_name, is_popular, display_order)
VALUES
('b0000000-0000-0000-0000-000000000001', 'child-cut', 'Child Hair Cut', 'ළමා කොණ්ඩ කැපීම', 'Haircut for boys under 12 years with warm gentle care', 'haircut', 900.00, 20, 'child_care', false, 1),
('b0000000-0000-0000-0000-000000000001', 'adult-cut', 'Adult Hair Cut', 'වැඩිහිටි කොණ්ඩ කැපීම', 'Classic executive haircut tailored to face structure with wash and finish', 'haircut', 1200.00, 30, 'content_cut', false, 2),
('b0000000-0000-0000-0000-000000000001', 'beard-trim', 'Beard Trim', 'රැවුල හැඩගැන්වීම', 'Precision scissor sculpt, razor lineup and soothing aftershave tonic', 'beard', 800.00, 20, 'dry_cleaning', false, 3),
('b0000000-0000-0000-0000-000000000001', 'cut-beard', 'Hair Cut + Beard', 'කොණ්ඩය සහ රැවුල', 'Full gentleman grooming combo: haircut, beard sculpting & hot towel finish', 'combo', 1800.00, 45, 'face', true, 4),
('b0000000-0000-0000-0000-000000000001', 'style-cut', 'Hair Style Cut', 'නවීන විලාසිතා කොණ්ඩ කැපීම', 'Modern textured fade, taper, pompadour or custom scissor styling', 'haircut', 1400.00, 35, 'auto_fix_high', false, 5),
('b0000000-0000-0000-0000-000000000001', 'hair-dye', 'Hair Dye', 'කොණ්ඩය ඩයි කිරීම', 'Natural herbal black dye or color tint with protective conditioning', 'treatment', 2200.00, 40, 'palette', false, 6),
('b0000000-0000-0000-0000-000000000001', 'hair-massage', 'Hair Massage', 'හිස සම්බාහනය', 'Invigorating scalp acupressure massage to stimulate hair growth & relieve stress', 'treatment', 1200.00, 20, 'spa', false, 7),
('b0000000-0000-0000-0000-000000000001', 'oil-massage', 'Oil Massage', 'ආයුර්වේද තෙල් සම්බාහනය', 'Traditional Ayurvedic herbal oil head and shoulder wellness massage', 'treatment', 1500.00, 25, 'self_improvement', false, 8)
ON CONFLICT (branch_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    sinhala_name = EXCLUDED.sinhala_name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    duration = EXCLUDED.duration,
    icon_name = EXCLUDED.icon_name,
    is_popular = EXCLUDED.is_popular,
    display_order = EXCLUDED.display_order;

-- Sync legacy columns on services if present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'price_lkr') THEN
        UPDATE services SET price_lkr = price WHERE price_lkr IS NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'duration_minutes') THEN
        UPDATE services SET duration_minutes = duration WHERE duration_minutes IS NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'sort_order') THEN
        UPDATE services SET sort_order = display_order WHERE sort_order IS NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'is_active') THEN
        UPDATE services SET is_active = active_status WHERE is_active IS NULL;
    END IF;
END $$;

-- ------------------------------------------------------------------------
-- 6. SEED 2 STAFF BARBERS (VERSION 1 SCOPE: CHAIR 01 & CHAIR 02)
-- ------------------------------------------------------------------------
INSERT INTO staff (
    id, branch_id, staff_number, full_name, sinhala_name, position, chair_number,
    availability, working_hours, commission_percentage, photo_url, rating, reviews_count, is_active
)
VALUES
(
    'c0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'STF-001',
    'Master Kavi',
    'කවිඳු පෙරේරා',
    'Chief Stylist',
    1,
    'available',
    '{"start": "06:00", "end": "20:00"}'::jsonb,
    35.00,
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDdYsmqEToWqkhLyMB8Y2bFHS95FzmiIje__Q5F57JwDnjqvRoa62_OAlePc_dNjxMI1lb5HkhAwm9QyuRxGUXuCxXTP0qI_gZR96IgkpBiYd0OOfbyd6rSzkcBj44_OJR7ZpB8e9DPSWObbYhtmf7RpoVDy0G22Hfk_Dsa9tnGt3_r-KC8p3pm7W_zzKQKbPF4iX5LqebNt8E_wjLS2aVev5MFYMfOdYodRwwx4DQ',
    4.9,
    180,
    true
),
(
    'c0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000001',
    'STF-002',
    'Sunil Shantha',
    'සුනිල් ශාන්ත',
    'Beard Artisan',
    2,
    'busy',
    '{"start": "06:00", "end": "20:00"}'::jsonb,
    30.00,
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCsFnPnMzYxJ6xwVclhW0_CLiqeTfBaORMEOpfZGsEvL_nWkHooK6M3cYwxLqbj6TZd48qR0hWLjDHeAJWmmr5FKuBcIhyMXDGkY7aqpHgiKBX0PvkGtK9pTAmBVVf9wSIJzs95aQiAmjN24vrgl4llavZaWDqjKEduTj-DCEkuLv7svp5QrxLseoYLlzbFbKlAYooHQL6fU9tU7_wbAhT1H3uAMIwX6hD2KKcVU-s',
    4.8,
    95,
    true
)
ON CONFLICT (id) DO UPDATE SET
    staff_number = EXCLUDED.staff_number,
    full_name = EXCLUDED.full_name,
    sinhala_name = EXCLUDED.sinhala_name,
    position = EXCLUDED.position,
    chair_number = EXCLUDED.chair_number,
    availability = EXCLUDED.availability,
    working_hours = EXCLUDED.working_hours,
    commission_percentage = EXCLUDED.commission_percentage,
    photo_url = EXCLUDED.photo_url,
    rating = EXCLUDED.rating,
    reviews_count = EXCLUDED.reviews_count,
    is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------------------
-- 7. SEED INITIAL CUSTOMERS & WALK-IN GUEST
-- ------------------------------------------------------------------------
INSERT INTO customers (
    id, branch_id, customer_number, name, mobile, whatsapp, total_visits, total_spending, is_vip, preferred_barber_id
)
VALUES
(
    'd0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'CUST-00001',
    'Nuwan Silva',
    '+94771234567',
    '+94771234567',
    12,
    19200.00,
    true,
    'c0000000-0000-0000-0000-000000000001'
),
(
    'd0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000001',
    'CUST-00002',
    'Kasun Perera',
    '+94772458901',
    '+94772458901',
    4,
    7200.00,
    false,
    'c0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO UPDATE SET
    customer_number = EXCLUDED.customer_number,
    name = EXCLUDED.name,
    mobile = EXCLUDED.mobile,
    whatsapp = EXCLUDED.whatsapp,
    total_visits = EXCLUDED.total_visits,
    total_spending = EXCLUDED.total_spending,
    is_vip = EXCLUDED.is_vip,
    preferred_barber_id = EXCLUDED.preferred_barber_id;

-- Seed default Walk-in Guest record for walk-in queue tickets
INSERT INTO walk_in_customers (
    id, branch_id, walk_in_number, name, mobile
)
VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'WLK-001',
    'Walk-in Guest (Nimal)',
    '+94711112233'
)
ON CONFLICT (id) DO NOTHING;

-- Sync legacy columns on customers if present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'phone') THEN
        UPDATE customers SET phone = mobile WHERE phone IS NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'full_name') THEN
        UPDATE customers SET full_name = name WHERE full_name IS NULL;
    END IF;
END $$;

-- ------------------------------------------------------------------------
-- 8. SEED LIVE QUEUE TOKENS (SATISFIES chk_queue_customer_present)
-- ------------------------------------------------------------------------
INSERT INTO queue (
    branch_id, queue_date, queue_number, ticket_code, queue_type, customer_id, walk_in_id, staff_id,
    service_id, priority, status, estimated_waiting_time, started_at
)
VALUES
(
    'b0000000-0000-0000-0000-000000000001',
    CURRENT_DATE,
    7,
    'LK-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-007',
    'appointment',
    'd0000000-0000-0000-0000-000000000001',
    NULL,
    'c0000000-0000-0000-0000-000000000001',
    (SELECT id FROM services WHERE code = 'adult-cut' AND branch_id = 'b0000000-0000-0000-0000-000000000001' LIMIT 1),
    'normal',
    'in_chair',
    0,
    now() - INTERVAL '12 minutes'
),
(
    'b0000000-0000-0000-0000-000000000001',
    CURRENT_DATE,
    8,
    'LK-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-008',
    'walk_in',
    NULL,
    'e0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002',
    (SELECT id FROM services WHERE code = 'beard-trim' AND branch_id = 'b0000000-0000-0000-0000-000000000001' LIMIT 1),
    'normal',
    'waiting',
    8,
    NULL
),
(
    'b0000000-0000-0000-0000-000000000001',
    CURRENT_DATE,
    10,
    'LK-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-010',
    'appointment',
    'd0000000-0000-0000-0000-000000000002',
    NULL,
    'c0000000-0000-0000-0000-000000000001',
    (SELECT id FROM services WHERE code = 'cut-beard' AND branch_id = 'b0000000-0000-0000-0000-000000000001' LIMIT 1),
    'normal',
    'waiting',
    22,
    NULL
)
ON CONFLICT (branch_id, queue_date, queue_number) DO NOTHING;
