-- ========================================================================
-- Smart Salon LK - Initial Production Database Schema (PostgreSQL / Supabase)
-- Target: Version 1 Core Modules (Rural Men's Barbershop Operating System)
-- Best Practices: 3NF Normalization, UUID Keys, RLS, Indexes, Constraints
-- ========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean schema teardown (safe for re-runs)
DROP TABLE IF EXISTS whatsapp_logs CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS queue_tickets CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS barber_schedules CASCADE;
DROP TABLE IF EXISTS barbers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS salons CASCADE;

-- ------------------------------------------------------------------------
-- 1. SALONS TABLE
-- ------------------------------------------------------------------------
CREATE TABLE salons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    sinhala_name VARCHAR(200),
    slug VARCHAR(100) UNIQUE NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Kiribathgoda',
    phone VARCHAR(20) NOT NULL,
    whatsapp_number VARCHAR(20) NOT NULL,
    opening_time TIME NOT NULL DEFAULT '06:00:00',
    closing_time TIME NOT NULL DEFAULT '20:00:00',
    is_open BOOLEAN NOT NULL DEFAULT true,
    lankaqr_merchant_id VARCHAR(50),
    lankaqr_account_number VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------
-- 2. USER PROFILES TABLE (Linked with Supabase auth.users if available)
-- ------------------------------------------------------------------------
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID REFERENCES salons(id) ON DELETE SET NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('owner', 'staff', 'customer')),
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'si' CHECK (preferred_language IN ('si', 'en')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------
-- 3. BARBERS TABLE (V1 supports Min 1, Max 2 barbers per salon)
-- ------------------------------------------------------------------------
CREATE TABLE barbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    sinhala_name VARCHAR(100),
    chair_number INTEGER NOT NULL CHECK (chair_number BETWEEN 1 AND 2),
    role_title VARCHAR(50) NOT NULL DEFAULT 'Senior Barber',
    phone VARCHAR(20),
    avatar_url TEXT,
    rating NUMERIC(2,1) NOT NULL DEFAULT 4.9,
    reviews_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_on_duty BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_barber_chair UNIQUE (salon_id, chair_number)
);

-- ------------------------------------------------------------------------
-- 4. BARBER SCHEDULES TABLE
-- ------------------------------------------------------------------------
CREATE TABLE barber_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday...
    start_time TIME NOT NULL DEFAULT '06:00:00',
    end_time TIME NOT NULL DEFAULT '20:00:00',
    break_start TIME,
    break_end TIME,
    is_working_day BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_barber_day UNIQUE (barber_id, day_of_week)
);

-- ------------------------------------------------------------------------
-- 5. SERVICES TABLE (8 Default Grooming Services)
-- ------------------------------------------------------------------------
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    sinhala_name VARCHAR(150) NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('haircut', 'beard', 'treatment', 'combo')),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    price_lkr NUMERIC(10,2) NOT NULL CHECK (price_lkr >= 0),
    icon_name VARCHAR(50) NOT NULL DEFAULT 'content_cut',
    is_popular BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_salon_service_code UNIQUE (salon_id, code)
);

-- ------------------------------------------------------------------------
-- 6. CUSTOMERS TABLE (WhatsApp First Customer CRM)
-- ------------------------------------------------------------------------
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
    total_visits INTEGER NOT NULL DEFAULT 0,
    last_visit_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_salon_customer_phone UNIQUE (salon_id, phone)
);

-- ------------------------------------------------------------------------
-- 7. APPOINTMENTS TABLE
-- ------------------------------------------------------------------------
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'confirmed', 'in_chair', 'completed', 'cancelled', 'no_show')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------
-- 8. QUEUE TICKETS TABLE (Live Queue Management & Token Tracking)
-- ------------------------------------------------------------------------
CREATE TABLE queue_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    ticket_date DATE NOT NULL DEFAULT CURRENT_DATE,
    token_number INTEGER NOT NULL,
    ticket_code VARCHAR(30) NOT NULL,
    ticket_type VARCHAR(20) NOT NULL DEFAULT 'walk_in' CHECK (ticket_type IN ('walk_in', 'appointment')),
    status VARCHAR(20) NOT NULL DEFAULT 'waiting' 
        CHECK (status IN ('waiting', 'called', 'in_chair', 'completed', 'cancelled', 'skipped')),
    estimated_wait_minutes INTEGER NOT NULL DEFAULT 15,
    called_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    grace_period_extended_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_daily_salon_token UNIQUE (salon_id, ticket_date, token_number)
);

-- ------------------------------------------------------------------------
-- 9. INVOICES TABLE (POS Billing Module: Cash, Card, LankaQR)
-- ------------------------------------------------------------------------
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    queue_ticket_id UUID REFERENCES queue_tickets(id) ON DELETE SET NULL,
    barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    subtotal_lkr NUMERIC(10,2) NOT NULL CHECK (subtotal_lkr >= 0),
    discount_lkr NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (discount_lkr >= 0),
    total_lkr NUMERIC(10,2) NOT NULL CHECK (total_lkr >= 0),
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'lankaqr')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'refunded', 'void')),
    barcode_value VARCHAR(100) NOT NULL,
    lankaqr_reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------
-- 10. INVOICE ITEMS TABLE
-- ------------------------------------------------------------------------
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    service_name VARCHAR(100) NOT NULL,
    unit_price_lkr NUMERIC(10,2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    total_lkr NUMERIC(10,2) NOT NULL
);

-- ------------------------------------------------------------------------
-- 11. WHATSAPP LOGS TABLE
-- ------------------------------------------------------------------------
CREATE TABLE whatsapp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    message_type VARCHAR(30) NOT NULL 
        CHECK (message_type IN ('booking_confirm', 'reminder', 'queue_call', 'receipt', 'cancellation')),
    message_body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'click_to_chat' 
        CHECK (status IN ('click_to_chat', 'dispatched', 'delivered', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ========================================================================
CREATE INDEX idx_customers_phone ON customers(salon_id, phone);
CREATE INDEX idx_appointments_date_status ON appointments(salon_id, appointment_date, status);
CREATE INDEX idx_queue_tickets_live ON queue_tickets(salon_id, ticket_date, status);
CREATE INDEX idx_invoices_created_at ON invoices(salon_id, created_at);
CREATE INDEX idx_services_active ON services(salon_id, is_active, sort_order);

-- ========================================================================
-- TRIGGER FUNCTIONS: AUTO-INCREMENT TOKEN NUMBER PER DAY PER SALON
-- ========================================================================
CREATE OR REPLACE FUNCTION generate_daily_token_number()
RETURNS TRIGGER AS $$
DECLARE
    next_token INTEGER;
BEGIN
    IF NEW.token_number IS NULL OR NEW.token_number <= 0 THEN
        SELECT COALESCE(MAX(token_number), 0) + 1
        INTO next_token
        FROM queue_tickets
        WHERE salon_id = NEW.salon_id 
          AND ticket_date = NEW.ticket_date;
        
        NEW.token_number := next_token;
    END IF;

    IF NEW.ticket_code IS NULL OR NEW.ticket_code = '' THEN
        NEW.ticket_code := 'LK-' || TO_CHAR(NEW.ticket_date, 'YYYYMMDD') || '-' || LPAD(NEW.token_number::TEXT, 3, '0');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_daily_token
BEFORE INSERT ON queue_tickets
FOR EACH ROW
EXECUTE FUNCTION generate_daily_token_number();

-- ========================================================================
-- TRIGGER FUNCTION: AUTO-INCREMENT INVOICE NUMBER
-- ========================================================================
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    today_str VARCHAR(8);
    seq_num INTEGER;
BEGIN
    today_str := TO_CHAR(now(), 'YYYYMMDD');
    
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        SELECT COALESCE(COUNT(*), 0) + 1
        INTO seq_num
        FROM invoices
        WHERE salon_id = NEW.salon_id 
          AND TO_CHAR(created_at, 'YYYYMMDD') = today_str;

        NEW.invoice_number := 'INV-' || today_str || '-' || LPAD(seq_num::TEXT, 4, '0');
    END IF;

    IF NEW.barcode_value IS NULL OR NEW.barcode_value = '' THEN
        NEW.barcode_value := NEW.invoice_number;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_invoice_number
BEFORE INSERT ON invoices
FOR EACH ROW
EXECUTE FUNCTION generate_invoice_number();

-- ========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================================
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Public can view active salons, barbers, and active services
CREATE POLICY "Public read salons" ON salons FOR SELECT USING (true);
CREATE POLICY "Public read active barbers" ON barbers FOR SELECT USING (is_active = true);
CREATE POLICY "Public read active services" ON services FOR SELECT USING (is_active = true);

-- Public can insert queue tickets and appointments (Customer flow)
CREATE POLICY "Public create appointment" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read queue" ON queue_tickets FOR SELECT USING (true);
CREATE POLICY "Public insert queue" ON queue_tickets FOR INSERT WITH CHECK (true);

-- Salon Owner / Staff full management access
CREATE POLICY "Owner salon manage" ON salons FOR ALL USING (true);
CREATE POLICY "Owner barbers manage" ON barbers FOR ALL USING (true);
CREATE POLICY "Owner services manage" ON services FOR ALL USING (true);
CREATE POLICY "Owner customers manage" ON customers FOR ALL USING (true);
CREATE POLICY "Owner appointments manage" ON appointments FOR ALL USING (true);
CREATE POLICY "Owner queue manage" ON queue_tickets FOR ALL USING (true);
CREATE POLICY "Owner invoices manage" ON invoices FOR ALL USING (true);
CREATE POLICY "Owner invoice items manage" ON invoice_items FOR ALL USING (true);

-- ========================================================================
-- SEED DATA: SMART SALON LK (KIRIBATHGODA)
-- ========================================================================
INSERT INTO salons (id, name, sinhala_name, slug, address, city, phone, whatsapp_number, lankaqr_merchant_id, lankaqr_account_number)
VALUES (
    'a1111111-1111-1111-1111-111111111111',
    'Smart Salon LK',
    'ස්මාර්ට් සැලූන්',
    'smart-salon-kiribathgoda',
    'No. 42, Kandy Road, Kiribathgoda (Opposite Keells Super)',
    'Kiribathgoda',
    '+94112918844',
    '+94770000000',
    'LKQR-9021-SMART',
    '800123456789'
) ON CONFLICT DO NOTHING;

-- Seed 2 Barbers (V1 Max Limit: 2 Barbers)
INSERT INTO barbers (id, salon_id, name, sinhala_name, chair_number, role_title, phone, rating, reviews_count)
VALUES 
(
    'b1111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    'Master Kavi',
    'කවිඳු',
    1,
    'Chief Stylist',
    '+94771112233',
    4.9,
    180
),
(
    'b2222222-2222-2222-2222-222222222222',
    'a1111111-1111-1111-1111-111111111111',
    'Sunil Shantha',
    'සුනිල්',
    2,
    'Beard Artisan',
    '+94772223344',
    4.8,
    95
) ON CONFLICT DO NOTHING;

-- Seed Default 8 Services
INSERT INTO services (salon_id, code, name, sinhala_name, category, duration_minutes, price_lkr, icon_name, is_popular, sort_order)
VALUES
('a1111111-1111-1111-1111-111111111111', 'adult-cut', 'Adult Hair Cut', 'වැඩිහිටි කොණ්ඩ කැපීම', 'haircut', 30, 1200.00, 'content_cut', false, 1),
('a1111111-1111-1111-1111-111111111111', 'cut-beard-combo', 'Hair Cut + Beard Grooming', 'කොණ්ඩය සහ රැවුල සම්පූර්ණ සත්කාරය', 'combo', 45, 1800.00, 'face', true, 2),
('a1111111-1111-1111-1111-111111111111', 'child-cut', 'Child Hair Cut', 'ළමා කොණ්ඩ කැපීම (Below 12 yrs)', 'haircut', 20, 900.00, 'child_care', false, 3),
('a1111111-1111-1111-1111-111111111111', 'beard-trim', 'Beard Trim', 'රැවුල හැඩගැන්වීම සහ රේසර් ලයින්', 'beard', 20, 800.00, 'dry_cleaning', false, 4),
('a1111111-1111-1111-1111-111111111111', 'style-cut', 'Hair Style Cut', 'නවීන විලාසිතා කොණ්ඩ කැපීම', 'haircut', 35, 1400.00, 'auto_fix_high', false, 5),
('a1111111-1111-1111-1111-111111111111', 'hair-dye', 'Hair Dye', 'කොණ්ඩය ඩයි කිරීම සහ කන්ඩිෂනර්', 'treatment', 40, 2200.00, 'palette', false, 6),
('a1111111-1111-1111-1111-111111111111', 'hair-massage', 'Hair Massage', 'හිස සම්බාහනය', 'treatment', 20, 1200.00, 'spa', false, 7),
('a1111111-1111-1111-1111-111111111111', 'oil-massage', 'Oil Massage', 'ආයුර්වේද තෙල් සම්බාහනය', 'treatment', 25, 1500.00, 'self_improvement', false, 8)
ON CONFLICT DO NOTHING;

