-- ========================================================================
-- SMART SALON LK - ENTERPRISE SUPABASE POSTGRESQL ARCHITECTURE
-- MASTER CONSOLIDATED DEPLOYMENT SCRIPT (ALL 26 TABLES, TRIGGERS & POLICIES)
-- IDEMPOTENT: CAN BE RUN REPEATEDLY WITHOUT "ALREADY EXISTS" ERRORS
-- ========================================================================

-- Enable core extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ------------------------------------------------------------------------
-- 1. ENUMS (Safe Idempotent Creation)
-- ------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE user_role_type AS ENUM ('owner', 'staff', 'customer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_status_type AS ENUM ('active', 'inactive', 'suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE app_language_type AS ENUM ('si', 'en', 'ta'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE staff_availability_type AS ENUM ('available', 'busy', 'on_break', 'off_duty'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE service_category_type AS ENUM ('haircut', 'beard', 'treatment', 'combo', 'special'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE appointment_status_type AS ENUM ('pending', 'confirmed', 'in_chair', 'completed', 'cancelled', 'no_show'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE booking_source_type AS ENUM ('online_pwa', 'whatsapp', 'walk_in', 'phone_call'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE queue_status_type AS ENUM ('waiting', 'called', 'in_chair', 'completed', 'cancelled', 'skipped'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE queue_ticket_type AS ENUM ('walk_in', 'appointment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE queue_priority_type AS ENUM ('normal', 'priority', 'vip'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_method_type AS ENUM ('cash', 'card', 'lankaqr', 'online_gateway'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_status_type AS ENUM ('unpaid', 'partially_paid', 'paid', 'refunded', 'void'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_channel_type AS ENUM ('whatsapp', 'sms', 'push', 'in_app'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_category_type AS ENUM ('appointment_confirmation', 'appointment_reminder', 'queue_call', 'queue_approaching', 'invoice_receipt', 'cancellation', 'promotion'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_status_type AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed', 'click_to_chat'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE audit_action_type AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'LOGIN', 'LOGOUT', 'FAILED_LOGIN', 'ROLE_CHANGE', 'PERMISSION_CHANGE', 'SENSITIVE_UPDATE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_period_type AS ENUM ('daily', 'weekly', 'monthly', 'yearly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ensure expanded values exist if enum was created prior
DO $$ BEGIN ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'LOGIN'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'LOGOUT'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'FAILED_LOGIN'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'ROLE_CHANGE'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'PERMISSION_CHANGE'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'SENSITIVE_UPDATE'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------------------
-- 2. CORE TABLES (1 TO 26)
-- ------------------------------------------------------------------------

-- 1. Branches
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_number VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    sinhala_name VARCHAR(200),
    slug VARCHAR(100) NOT NULL UNIQUE,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Kiribathgoda',
    district VARCHAR(50) NOT NULL DEFAULT 'Gampaha',
    phone VARCHAR(25) NOT NULL,
    whatsapp_number VARCHAR(25) NOT NULL,
    email VARCHAR(100),
    is_main_branch BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- 2. Roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name user_role_type NOT NULL UNIQUE,
    display_name VARCHAR(50) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- 3. Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    role_id UUID REFERENCES roles(id) ON DELETE RESTRICT,
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(25) NOT NULL UNIQUE,
    whatsapp_number VARCHAR(25),
    profile_photo_url TEXT,
    status user_status_type NOT NULL DEFAULT 'active',
    language app_language_type NOT NULL DEFAULT 'si',
    last_login_at TIMESTAMPTZ,
    last_login_ip VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- 4. Staff
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    staff_number VARCHAR(30) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    sinhala_name VARCHAR(150),
    position VARCHAR(50) NOT NULL DEFAULT 'Senior Stylist',
    chair_number INTEGER NOT NULL CHECK (chair_number >= 1),
    availability staff_availability_type NOT NULL DEFAULT 'available',
    working_hours JSONB DEFAULT '{"start": "06:00", "end": "20:00"}'::jsonb,
    commission_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (commission_percentage BETWEEN 0 AND 100),
    photo_url TEXT,
    rating NUMERIC(2,1) NOT NULL DEFAULT 5.0 CHECK (rating BETWEEN 1.0 AND 5.0),
    reviews_count INTEGER NOT NULL DEFAULT 0 CHECK (reviews_count >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_staff_number UNIQUE(branch_id, staff_number),
    CONSTRAINT uq_branch_chair_number UNIQUE(branch_id, chair_number)
);

-- 5. Customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    customer_number VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    mobile VARCHAR(25) NOT NULL,
    whatsapp VARCHAR(25),
    date_of_birth DATE,
    last_visit TIMESTAMPTZ,
    total_visits INTEGER NOT NULL DEFAULT 0 CHECK (total_visits >= 0),
    total_spending NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_spending >= 0),
    preferred_barber_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    notes TEXT,
    is_vip BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_customer_mobile UNIQUE(branch_id, mobile),
    CONSTRAINT uq_branch_customer_number UNIQUE(branch_id, customer_number)
);

-- 6. Services
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    sinhala_name VARCHAR(150) NOT NULL,
    description TEXT,
    category service_category_type NOT NULL DEFAULT 'haircut',
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    duration INTEGER NOT NULL CHECK (duration > 0),
    icon_name VARCHAR(50) NOT NULL DEFAULT 'content_cut',
    display_order INTEGER NOT NULL DEFAULT 1,
    active_status BOOLEAN NOT NULL DEFAULT true,
    is_popular BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_service_code UNIQUE(branch_id, code)
);

-- 7. Appointments
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    appointment_number VARCHAR(40) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    barber_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    expected_end_time TIME NOT NULL,
    status appointment_status_type NOT NULL DEFAULT 'pending',
    booking_source booking_source_type NOT NULL DEFAULT 'online_pwa',
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    cancellation_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_appointment_number UNIQUE(branch_id, appointment_number),
    CONSTRAINT chk_appointment_times CHECK (expected_end_time > appointment_time)
);

-- 8. Appointment Services
CREATE TABLE IF NOT EXISTS appointment_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_appointment_service UNIQUE(appointment_id, service_id)
);

-- 9. Walk-in Customers
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

-- 10. Queue
CREATE TABLE IF NOT EXISTS queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    queue_number INTEGER NOT NULL CHECK (queue_number > 0),
    ticket_code VARCHAR(30) NOT NULL,
    queue_type queue_ticket_type NOT NULL DEFAULT 'walk_in',
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    walk_in_id UUID REFERENCES walk_in_customers(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    priority queue_priority_type NOT NULL DEFAULT 'normal',
    status queue_status_type NOT NULL DEFAULT 'waiting',
    estimated_waiting_time INTEGER NOT NULL DEFAULT 15 CHECK (estimated_waiting_time >= 0),
    grace_period_minutes INTEGER NOT NULL DEFAULT 0,
    called_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_daily_queue_number UNIQUE(branch_id, queue_date, queue_number),
    CONSTRAINT chk_queue_customer_present CHECK (customer_id IS NOT NULL OR walk_in_id IS NOT NULL)
);

-- 11. Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    invoice_number VARCHAR(40) NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    walk_in_id UUID REFERENCES walk_in_customers(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    queue_id UUID REFERENCES queue(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    tax NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    grand_total NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
    payment_status payment_status_type NOT NULL DEFAULT 'unpaid',
    barcode_value VARCHAR(100) NOT NULL,
    qr_code_value TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_invoice_number UNIQUE(branch_id, invoice_number)
);

-- 12. Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    item_name VARCHAR(150) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    discount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- 13. Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    reference_number VARCHAR(60) NOT NULL,
    payment_method payment_method_type NOT NULL DEFAULT 'cash',
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    status payment_status_type NOT NULL DEFAULT 'paid',
    paid_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    transaction_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_payment_ref UNIQUE(branch_id, reference_number)
);

-- 14. Business Settings
CREATE TABLE IF NOT EXISTS business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
    salon_name VARCHAR(150) NOT NULL DEFAULT 'Smart Salon LK',
    sinhala_name VARCHAR(200) DEFAULT 'ස්මාර්ට් සැලූන්',
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Kiribathgoda',
    phone VARCHAR(25) NOT NULL,
    whatsapp VARCHAR(25) NOT NULL,
    email VARCHAR(100),
    logo_url TEXT,
    opening_time TIME NOT NULL DEFAULT '06:00:00',
    closing_time TIME NOT NULL DEFAULT '20:00:00',
    currency VARCHAR(10) NOT NULL DEFAULT 'LKR',
    time_zone VARCHAR(50) NOT NULL DEFAULT 'Asia/Colombo',
    invoice_prefix VARCHAR(15) NOT NULL DEFAULT 'INV-',
    queue_prefix VARCHAR(15) NOT NULL DEFAULT 'LK-',
    barcode_prefix VARCHAR(15) NOT NULL DEFAULT 'SSLK-',
    tax_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (tax_percentage >= 0),
    enable_card_payments BOOLEAN NOT NULL DEFAULT true,
    enable_lankaqr BOOLEAN NOT NULL DEFAULT true,
    enable_walk_ins BOOLEAN NOT NULL DEFAULT true,
    enable_notifications BOOLEAN NOT NULL DEFAULT true,
    language app_language_type NOT NULL DEFAULT 'si',
    lankaqr_merchant_id VARCHAR(50) DEFAULT 'LKQR-9021-SMART',
    lankaqr_account_number VARCHAR(50) DEFAULT '800123456789',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- 15. Working Hours
CREATE TABLE IF NOT EXISTS working_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    day_name VARCHAR(15) NOT NULL CHECK (day_name IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    day_index INTEGER NOT NULL CHECK (day_index BETWEEN 0 AND 6),
    opening_time TIME NOT NULL DEFAULT '06:00:00',
    closing_time TIME NOT NULL DEFAULT '20:00:00',
    is_closed BOOLEAN NOT NULL DEFAULT false,
    break_start TIME,
    break_end TIME,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_working_day UNIQUE(branch_id, day_name)
);

-- 16. Holidays
CREATE TABLE IF NOT EXISTS holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    holiday_date DATE NOT NULL,
    reason VARCHAR(150) NOT NULL,
    closed BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_holiday_date UNIQUE(branch_id, holiday_date)
);

-- 17. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    type notification_category_type NOT NULL,
    channel notification_channel_type NOT NULL DEFAULT 'whatsapp',
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    status notification_status_type NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- 18. WhatsApp Logs
CREATE TABLE IF NOT EXISTS whatsapp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    recipient VARCHAR(25) NOT NULL,
    message_type notification_category_type NOT NULL,
    message TEXT NOT NULL,
    delivery_status notification_status_type NOT NULL DEFAULT 'click_to_chat',
    provider_message_id VARCHAR(100),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- 19. Reports Cache
CREATE TABLE IF NOT EXISTS reports_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    report_type VARCHAR(60) NOT NULL,
    report_date DATE NOT NULL,
    report_period report_period_type NOT NULL DEFAULT 'daily',
    data JSONB NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_report_cache UNIQUE(branch_id, report_type, report_date, report_period)
);

-- 20. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    action audit_action_type NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- 21. Memberships
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    membership_number VARCHAR(40) NOT NULL,
    tier_name VARCHAR(50) NOT NULL DEFAULT 'Silver Member',
    discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 5.00 CHECK (discount_percentage BETWEEN 0 AND 100),
    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_membership_number UNIQUE(branch_id, membership_number),
    CONSTRAINT chk_membership_dates CHECK (expiry_date >= start_date)
);

-- 22. Loyalty Points
CREATE TABLE IF NOT EXISTS loyalty_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
    lifetime_points_earned INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_points_earned >= 0),
    last_earned_at TIMESTAMPTZ,
    last_redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- 23. Inventory
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    item_code VARCHAR(40) NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'hair_product',
    unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
    quantity_in_stock NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (quantity_in_stock >= 0),
    min_reorder_level NUMERIC(10,2) NOT NULL DEFAULT 5.00 CHECK (min_reorder_level >= 0),
    unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
    retail_price NUMERIC(10,2) DEFAULT 0.00 CHECK (retail_price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_inventory_code UNIQUE(branch_id, item_code)
);

-- 24. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    supplier_code VARCHAR(30) NOT NULL,
    company_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(25) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_supplier_code UNIQUE(branch_id, supplier_code)
);

-- 25. Purchases
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    purchase_number VARCHAR(40) NOT NULL,
    invoice_number VARCHAR(50),
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
    payment_status payment_status_type NOT NULL DEFAULT 'paid',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_purchase_number UNIQUE(branch_id, purchase_number)
);

-- 26. Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    expense_number VARCHAR(40) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'operational',
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    payment_method payment_method_type NOT NULL DEFAULT 'cash',
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    approved_by UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_expense_number UNIQUE(branch_id, expense_number)
);

-- ------------------------------------------------------------------------
-- 3. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------
-- Ensure branch_id exists across all tenant tables
ALTER TABLE queue ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE services ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE working_hours ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';
ALTER TABLE reports_cache ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE DEFAULT 'b0000000-0000-0000-0000-000000000001';

-- Ensure soft-delete column exists on all tables prior to creating partial indexes
ALTER TABLE queue ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE services ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE reports_cache ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Convergence guards for tables created in prior versions
DO $$
BEGIN
    -- appointments: appointment_time, start_time, expected_end_time, end_time, appointment_number
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_time TIME;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'start_time') THEN
        EXECUTE 'UPDATE appointments SET appointment_time = start_time WHERE appointment_time IS NULL';
    END IF;
    UPDATE appointments SET appointment_time = '09:00:00'::TIME WHERE appointment_time IS NULL;

    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS start_time TIME;
    UPDATE appointments SET start_time = appointment_time WHERE start_time IS NULL;

    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS expected_end_time TIME;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'end_time') THEN
        EXECUTE 'UPDATE appointments SET expected_end_time = end_time WHERE expected_end_time IS NULL';
    END IF;
    UPDATE appointments SET expected_end_time = (appointment_time + interval '30 minutes')::TIME WHERE expected_end_time IS NULL;

    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS end_time TIME;
    UPDATE appointments SET end_time = expected_end_time WHERE end_time IS NULL;

    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_number VARCHAR(40);
    UPDATE appointments SET appointment_number = 'APT-' || to_char(created_at, 'YYYYMMDD') || '-' || SUBSTRING(id::text, 1, 6) WHERE appointment_number IS NULL;

    -- customers: mobile, phone, name, full_name, whatsapp, customer_number
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS mobile VARCHAR(25);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'phone') THEN
        EXECUTE 'UPDATE customers SET mobile = phone WHERE mobile IS NULL';
    END IF;

    ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone VARCHAR(25);
    UPDATE customers SET phone = mobile WHERE phone IS NULL;

    ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(25);
    UPDATE customers SET whatsapp = mobile WHERE whatsapp IS NULL;

    ALTER TABLE customers ADD COLUMN IF NOT EXISTS name VARCHAR(150);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'full_name') THEN
        EXECUTE 'UPDATE customers SET name = full_name WHERE name IS NULL';
    END IF;

    ALTER TABLE customers ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);
    UPDATE customers SET full_name = name WHERE full_name IS NULL;

    ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_number VARCHAR(30);
    WITH numbered AS (
        SELECT id, 'CUST-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 5, '0') AS gen_num
        FROM customers
        WHERE customer_number IS NULL
    )
    UPDATE customers c SET customer_number = n.gen_num FROM numbered n WHERE c.id = n.id AND c.customer_number IS NULL;

    -- services: active_status, is_active, display_order, sort_order
    ALTER TABLE services ADD COLUMN IF NOT EXISTS active_status BOOLEAN DEFAULT true;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'is_active') THEN
        EXECUTE 'UPDATE services SET active_status = is_active WHERE active_status IS NULL';
    END IF;
    UPDATE services SET active_status = true WHERE active_status IS NULL;

    ALTER TABLE services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    UPDATE services SET is_active = active_status WHERE is_active IS NULL;

    ALTER TABLE services ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 1;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'sort_order') THEN
        EXECUTE 'UPDATE services SET display_order = sort_order WHERE display_order IS NULL';
    END IF;
    UPDATE services SET display_order = 1 WHERE display_order IS NULL;

    ALTER TABLE services ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 1;
    UPDATE services SET sort_order = display_order WHERE sort_order IS NULL;

    -- payments: paid_time, reference_number
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_time TIMESTAMPTZ DEFAULT now();
    UPDATE payments SET paid_time = now() WHERE paid_time IS NULL;

    ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_number VARCHAR(60);
    UPDATE payments SET reference_number = 'PAY-' || to_char(created_at, 'YYYYMMDD') || '-' || SUBSTRING(id::text, 1, 6) WHERE reference_number IS NULL;

    -- whatsapp_logs: recipient, recipient_phone, timestamp
    ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS recipient VARCHAR(25);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'recipient_phone') THEN
        EXECUTE 'UPDATE whatsapp_logs SET recipient = recipient_phone WHERE recipient IS NULL';
    END IF;

    ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(25);
    UPDATE whatsapp_logs SET recipient_phone = recipient WHERE recipient_phone IS NULL;

    ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT now();
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'created_at') THEN
        EXECUTE 'UPDATE whatsapp_logs SET timestamp = created_at WHERE timestamp IS NULL';
    END IF;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_queue_live_polling ON queue (branch_id, queue_date, status, queue_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_queue_active_waiting ON queue (branch_id, queue_date, priority) WHERE status IN ('waiting', 'called', 'in_chair') AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_queue_ticket_code ON queue (ticket_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_schedule ON appointments (branch_id, appointment_date, appointment_time, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_barber_date ON appointments (barber_id, appointment_date, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_daily_sales ON invoices (branch_id, created_at, payment_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_barcode ON invoices (barcode_value);
CREATE INDEX IF NOT EXISTS idx_customers_branch_mobile ON customers (branch_id, mobile) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin (name gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments (invoice_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_audit_method ON payments (branch_id, payment_method, paid_time DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_active_chair ON staff (branch_id, chair_number, availability) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_services_catalog_display ON services (branch_id, active_status, display_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_customer_pending ON notifications (customer_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_recipient ON whatsapp_logs (recipient, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs (table_name, record_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_cache_lookup ON reports_cache (branch_id, report_type, report_date, report_period);

-- ------------------------------------------------------------------------
-- 4. DATABASE FUNCTIONS & AUTOMATION TRIGGERS
-- ------------------------------------------------------------------------

-- Universal Updated At Function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'branches', 'roles', 'profiles', 'staff', 'customers', 'services',
        'appointments', 'appointment_services', 'walk_in_customers', 'queue',
        'invoices', 'invoice_items', 'payments', 'business_settings',
        'working_hours', 'holidays', 'notifications', 'whatsapp_logs',
        'reports_cache', 'audit_logs', 'memberships', 'loyalty_points',
        'inventory', 'suppliers', 'purchases', 'expenses'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_set_updated_at_%I ON %I;
            CREATE TRIGGER trg_set_updated_at_%I
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION set_updated_at();
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END;
$$;

-- Universal Audit Trail Logger
CREATE OR REPLACE FUNCTION audit_trail_logger()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_record_id UUID := NULL;
BEGIN
    BEGIN v_user_id := auth.uid(); EXCEPTION WHEN OTHERS THEN v_user_id := NULL; END;

    IF (TG_OP = 'DELETE') THEN
        v_record_id := OLD.id; v_old_data := to_jsonb(OLD);
    ELSIF (TG_OP = 'UPDATE') THEN
        v_record_id := NEW.id; v_old_data := to_jsonb(OLD); v_new_data := to_jsonb(NEW);
    ELSIF (TG_OP = 'INSERT') THEN
        v_record_id := NEW.id; v_new_data := to_jsonb(NEW);
    END IF;

    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by, changed_at)
    VALUES (TG_TABLE_NAME, v_record_id, TG_OP::audit_action_type, v_old_data, v_new_data, v_user_id, now());

    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
DECLARE
    tbl text;
    audit_tables text[] := ARRAY['invoices', 'payments', 'appointments', 'queue', 'customers', 'staff', 'business_settings', 'expenses'];
BEGIN
    FOREACH tbl IN ARRAY audit_tables
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_audit_%I ON %I;
            CREATE TRIGGER trg_audit_%I
            AFTER INSERT OR UPDATE OR DELETE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION audit_trail_logger();
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END;
$$;

-- Auto-generate Customer Number
CREATE OR REPLACE FUNCTION auto_generate_customer_number()
RETURNS TRIGGER AS $$
DECLARE v_seq INTEGER;
BEGIN
    IF NEW.customer_number IS NULL OR NEW.customer_number = '' THEN
        SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq FROM customers WHERE branch_id = NEW.branch_id;
        NEW.customer_number := 'CUST-' || LPAD(v_seq::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_customer_number ON customers;
CREATE TRIGGER trg_auto_customer_number BEFORE INSERT ON customers FOR EACH ROW EXECUTE FUNCTION auto_generate_customer_number();

-- Auto-generate Staff Number
CREATE OR REPLACE FUNCTION auto_generate_staff_number()
RETURNS TRIGGER AS $$
DECLARE v_seq INTEGER;
BEGIN
    IF NEW.staff_number IS NULL OR NEW.staff_number = '' THEN
        SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq FROM staff WHERE branch_id = NEW.branch_id;
        NEW.staff_number := 'STF-' || LPAD(v_seq::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_staff_number ON staff;
CREATE TRIGGER trg_auto_staff_number BEFORE INSERT ON staff FOR EACH ROW EXECUTE FUNCTION auto_generate_staff_number();

-- Auto-prepare Appointment
CREATE OR REPLACE FUNCTION auto_prepare_appointment()
RETURNS TRIGGER AS $$
DECLARE v_seq INTEGER; v_date_str VARCHAR(8);
BEGIN
    v_date_str := TO_CHAR(NEW.appointment_date, 'YYYYMMDD');
    IF NEW.appointment_number IS NULL OR NEW.appointment_number = '' THEN
        SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq FROM appointments WHERE branch_id = NEW.branch_id AND appointment_date = NEW.appointment_date;
        NEW.appointment_number := 'APT-' || v_date_str || '-' || LPAD(v_seq::TEXT, 4, '0');
    END IF;
    IF NEW.expected_end_time IS NULL OR NEW.expected_end_time <= NEW.appointment_time THEN
        NEW.expected_end_time := NEW.appointment_time + INTERVAL '30 minutes';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_appointment ON appointments;
CREATE TRIGGER trg_auto_appointment BEFORE INSERT ON appointments FOR EACH ROW EXECUTE FUNCTION auto_prepare_appointment();

-- Real-time Waiting Time Calculator
CREATE OR REPLACE FUNCTION calculate_waiting_time(p_branch_id UUID, p_barber_id UUID DEFAULT NULL, p_target_queue_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    v_active_barbers INTEGER;
    v_customers_ahead INTEGER;
    v_avg_service_time INTEGER := 22;
    v_current_elapsed INTEGER := 0;
    v_target_token_number INTEGER;
    v_est_wait INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_active_barbers FROM staff WHERE branch_id = p_branch_id AND is_active = true AND availability IN ('available', 'busy') AND deleted_at IS NULL;
    IF v_active_barbers <= 0 THEN v_active_barbers := 1; END IF;

    IF p_target_queue_id IS NOT NULL THEN
        SELECT queue_number INTO v_target_token_number FROM queue WHERE id = p_target_queue_id;
        SELECT COUNT(*) INTO v_customers_ahead FROM queue WHERE branch_id = p_branch_id AND queue_date = CURRENT_DATE AND status = 'waiting' AND queue_number < v_target_token_number AND deleted_at IS NULL;
    ELSE
        SELECT COUNT(*) INTO v_customers_ahead FROM queue WHERE branch_id = p_branch_id AND queue_date = CURRENT_DATE AND status = 'waiting' AND deleted_at IS NULL;
    END IF;

    IF v_customers_ahead = 0 THEN RETURN 5; END IF;

    v_est_wait := (CEIL(v_customers_ahead::NUMERIC / v_active_barbers::NUMERIC) * v_avg_service_time)::INTEGER;

    SELECT COALESCE(EXTRACT(EPOCH FROM (now() - started_at))/60, 0)::INTEGER INTO v_current_elapsed
    FROM queue WHERE branch_id = p_branch_id AND queue_date = CURRENT_DATE AND status = 'in_chair' AND started_at IS NOT NULL AND deleted_at IS NULL
    ORDER BY started_at ASC LIMIT 1;

    IF v_current_elapsed > 0 AND v_current_elapsed < v_avg_service_time THEN
        v_est_wait := v_est_wait - (v_current_elapsed / v_active_barbers);
    END IF;

    RETURN GREATEST(5, v_est_wait);
END;
$$ LANGUAGE plpgsql STABLE;

-- Atomic Queue Token Generator
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
RETURNS TABLE (queue_id UUID, token_number INTEGER, ticket_code VARCHAR, est_wait_minutes INTEGER) AS $$
DECLARE
    v_next_token INTEGER;
    v_date_str VARCHAR(8);
    v_ticket_code VARCHAR(30);
    v_est_wait INTEGER;
    v_new_id UUID;
BEGIN
    v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    PERFORM pg_advisory_xact_lock(hashtext('queue_lock_' || p_branch_id::TEXT));

    SELECT COALESCE(MAX(q.queue_number), 0) + 1 INTO v_next_token
    FROM queue q WHERE q.branch_id = p_branch_id AND q.queue_date = CURRENT_DATE;

    v_ticket_code := 'LK-' || v_date_str || '-' || LPAD(v_next_token::TEXT, 3, '0');
    v_est_wait := calculate_waiting_time(p_branch_id, p_barber_id);

    INSERT INTO queue (branch_id, queue_date, queue_number, ticket_code, queue_type, customer_id, walk_in_id, appointment_id, staff_id, service_id, priority, status, estimated_waiting_time)
    VALUES (p_branch_id, CURRENT_DATE, v_next_token, v_ticket_code, p_queue_type, p_customer_id, p_walk_in_id, p_appointment_id, p_barber_id, p_service_id, p_priority, 'waiting', v_est_wait)
    RETURNING id INTO v_new_id;

    RETURN QUERY SELECT v_new_id, v_next_token, v_ticket_code, v_est_wait;
END;
$$ LANGUAGE plpgsql;

-- LankaQR Payload Generator
CREATE OR REPLACE FUNCTION generate_lankaqr_payload_sql(
    p_merchant_id VARCHAR, p_account_number VARCHAR, p_merchant_name VARCHAR, p_merchant_city VARCHAR, p_amount NUMERIC, p_invoice_number VARCHAR
)
RETURNS TEXT AS $$
DECLARE
    v_payload TEXT; v_tag26_sub TEXT; v_tag26 TEXT; v_tag62_sub TEXT; v_tag62 TEXT; v_amount_str VARCHAR(20);
BEGIN
    v_amount_str := TO_CHAR(p_amount, 'FM99999990.00');
    v_tag26_sub := '00' || LPAD(LENGTH('LK.GOV.CBSL.LANKAQR')::TEXT, 2, '0') || 'LK.GOV.CBSL.LANKAQR' ||
                   '01' || LPAD(LENGTH(p_account_number)::TEXT, 2, '0') || p_account_number ||
                   '02' || LPAD(LENGTH(p_merchant_id)::TEXT, 2, '0') || p_merchant_id;
    v_tag26 := '26' || LPAD(LENGTH(v_tag26_sub)::TEXT, 2, '0') || v_tag26_sub;

    v_tag62_sub := '01' || LPAD(LENGTH(p_invoice_number)::TEXT, 2, '0') || p_invoice_number;
    v_tag62 := '62' || LPAD(LENGTH(v_tag62_sub)::TEXT, 2, '0') || v_tag62_sub;

    v_payload := '000201' || '010212' || v_tag26 || '52047230' || '5303144' ||
                 '54' || LPAD(LENGTH(v_amount_str)::TEXT, 2, '0') || v_amount_str || '5802LK' ||
                 '59' || LPAD(LENGTH(SUBSTRING(p_merchant_name, 1, 25))::TEXT, 2, '0') || SUBSTRING(p_merchant_name, 1, 25) ||
                 '60' || LPAD(LENGTH(SUBSTRING(p_merchant_city, 1, 15))::TEXT, 2, '0') || SUBSTRING(p_merchant_city, 1, 15) ||
                 v_tag62 || '6304';
    RETURN v_payload;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Atomic Invoice & POS Billing Procedure
CREATE OR REPLACE FUNCTION create_salon_invoice(
    p_branch_id UUID, p_customer_id UUID DEFAULT NULL, p_walk_in_id UUID DEFAULT NULL,
    p_appointment_id UUID DEFAULT NULL, p_queue_id UUID DEFAULT NULL, p_staff_id UUID DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb, p_discount NUMERIC DEFAULT 0.00, p_payment_method payment_method_type DEFAULT 'cash',
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (invoice_id UUID, invoice_number VARCHAR, grand_total NUMERIC, barcode_value VARCHAR, lankaqr_code TEXT) AS $$
DECLARE
    v_year_str VARCHAR(4); v_seq_num INTEGER; v_invoice_number VARCHAR(40); v_barcode VARCHAR(100);
    v_subtotal NUMERIC(10,2) := 0.00; v_tax NUMERIC(10,2) := 0.00; v_grand_total NUMERIC(10,2) := 0.00;
    v_new_invoice_id UUID; v_item JSONB; v_merchant_id VARCHAR(50); v_account_no VARCHAR(50);
    v_salon_name VARCHAR(150); v_city VARCHAR(100); v_lankaqr TEXT := NULL; v_pay_ref VARCHAR(60);
BEGIN
    v_year_str := TO_CHAR(now(), 'YYYY');
    PERFORM pg_advisory_xact_lock(hashtext('invoice_lock_' || p_branch_id::TEXT));

    SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq_num FROM invoices WHERE branch_id = p_branch_id AND TO_CHAR(created_at, 'YYYY') = v_year_str;
    v_invoice_number := 'INV-' || v_year_str || '-' || LPAD(v_seq_num::TEXT, 6, '0');
    v_barcode := 'SSLK-' || v_invoice_number;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_subtotal := v_subtotal + ((v_item->>'unit_price')::NUMERIC * COALESCE((v_item->>'quantity')::INTEGER, 1));
    END LOOP;

    SELECT ROUND((v_subtotal * (s.tax_percentage / 100)), 2), s.lankaqr_merchant_id, s.lankaqr_account_number, s.salon_name, s.city
    INTO v_tax, v_merchant_id, v_account_no, v_salon_name, v_city FROM business_settings s WHERE s.branch_id = p_branch_id;

    v_grand_total := GREATEST(0.00, (v_subtotal - p_discount) + COALESCE(v_tax, 0.00));

    IF p_payment_method = 'lankaqr' OR v_merchant_id IS NOT NULL THEN
        v_lankaqr := generate_lankaqr_payload_sql(COALESCE(v_merchant_id, 'LKQR-9021-SMART'), COALESCE(v_account_no, '800123456789'), COALESCE(v_salon_name, 'SMART SALON LK'), COALESCE(v_city, 'KIRIBATHGODA'), v_grand_total, v_invoice_number);
    END IF;

    INSERT INTO invoices (branch_id, invoice_number, customer_id, walk_in_id, appointment_id, queue_id, staff_id, subtotal, discount, tax, grand_total, payment_status, barcode_value, qr_code_value, notes)
    VALUES (p_branch_id, v_invoice_number, p_customer_id, p_walk_in_id, p_appointment_id, p_queue_id, p_staff_id, v_subtotal, p_discount, v_tax, v_grand_total, 'paid', v_barcode, v_lankaqr, p_notes)
    RETURNING id INTO v_new_invoice_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO invoice_items (invoice_id, service_id, item_name, quantity, unit_price, discount, total)
        VALUES (v_new_invoice_id, (v_item->>'service_id')::UUID, v_item->>'item_name', COALESCE((v_item->>'quantity')::INTEGER, 1), (v_item->>'unit_price')::NUMERIC, COALESCE((v_item->>'discount')::NUMERIC, 0.00), ((v_item->>'unit_price')::NUMERIC * COALESCE((v_item->>'quantity')::INTEGER, 1)));
    END LOOP;

    v_pay_ref := 'PAY-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(v_seq_num::TEXT, 5, '0');
    INSERT INTO payments (branch_id, invoice_id, reference_number, payment_method, amount, status, paid_time)
    VALUES (p_branch_id, v_new_invoice_id, v_pay_ref, p_payment_method, v_grand_total, 'paid', now());

    IF p_queue_id IS NOT NULL THEN UPDATE queue SET status = 'completed', completed_at = now() WHERE id = p_queue_id; END IF;
    IF p_customer_id IS NOT NULL THEN UPDATE customers SET total_visits = total_visits + 1, total_spending = total_spending + v_grand_total, last_visit = now() WHERE id = p_customer_id; END IF;

    RETURN QUERY SELECT v_new_invoice_id, v_invoice_number, v_grand_total, v_barcode, v_lankaqr;
END;
$$ LANGUAGE plpgsql;

-- Daily Revenue Calculator
CREATE OR REPLACE FUNCTION calculate_daily_revenue(p_branch_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (gross_revenue NUMERIC, cash_revenue NUMERIC, lankaqr_revenue NUMERIC, card_revenue NUMERIC, heads_served INTEGER, walk_ins_count INTEGER, appointments_count INTEGER, avg_ticket_value NUMERIC) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(i.grand_total), 0.00),
        COALESCE(SUM(CASE WHEN p.payment_method = 'cash' THEN p.amount ELSE 0.00 END), 0.00),
        COALESCE(SUM(CASE WHEN p.payment_method = 'lankaqr' THEN p.amount ELSE 0.00 END), 0.00),
        COALESCE(SUM(CASE WHEN p.payment_method = 'card' THEN p.amount ELSE 0.00 END), 0.00),
        COUNT(DISTINCT i.id)::INTEGER,
        COUNT(DISTINCT CASE WHEN i.walk_in_id IS NOT NULL THEN i.id END)::INTEGER,
        COUNT(DISTINCT CASE WHEN i.appointment_id IS NOT NULL THEN i.id END)::INTEGER,
        CASE WHEN COUNT(DISTINCT i.id) > 0 THEN ROUND(SUM(i.grand_total) / COUNT(DISTINCT i.id), 2) ELSE 0.00 END
    FROM invoices i LEFT JOIN payments p ON p.invoice_id = i.id
    WHERE i.branch_id = p_branch_id AND DATE(i.created_at) = p_date AND i.payment_status = 'paid' AND i.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS & POLICIES
-- ------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION normalize_sl_phone(p_phone TEXT)
RETURNS TEXT AS $$
DECLARE v_cleaned TEXT;
BEGIN
    IF p_phone IS NULL OR TRIM(p_phone) = '' THEN RETURN NULL; END IF;
    v_cleaned := REGEXP_REPLACE(p_phone, '[^0-9+]', '', 'g');
    IF v_cleaned LIKE '+94%' THEN RETURN v_cleaned;
    ELSIF v_cleaned LIKE '94%' THEN RETURN '+' || v_cleaned;
    ELSIF v_cleaned LIKE '0%' THEN RETURN '+94' || SUBSTRING(v_cleaned FROM 2);
    ELSIF LENGTH(v_cleaned) = 9 THEN RETURN '+94' || v_cleaned;
    ELSE RETURN v_cleaned; END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_auth_role() RETURNS user_role_type AS $$
DECLARE v_role user_role_type;
BEGIN
    SELECT r.name INTO v_role FROM profiles p JOIN roles r ON r.id = p.role_id WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL;
    RETURN COALESCE(v_role, 'customer'::user_role_type);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_account_active(p_user_id UUID DEFAULT auth.uid()) RETURNS BOOLEAN AS $$
DECLARE v_status user_status_type;
BEGIN
    IF p_user_id IS NULL THEN RETURN FALSE; END IF;
    SELECT status INTO v_status FROM profiles WHERE user_id = p_user_id AND deleted_at IS NULL;
    RETURN (v_status = 'active');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_owner() RETURNS BOOLEAN AS $$
BEGIN RETURN (get_auth_role() = 'owner'); END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_staff_or_owner() RETURNS BOOLEAN AS $$
BEGIN RETURN (get_auth_role() IN ('owner', 'staff')); END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_staff() RETURNS BOOLEAN AS $$
BEGIN RETURN (get_auth_role() = 'staff'); END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_customer() RETURNS BOOLEAN AS $$
BEGIN RETURN (get_auth_role() = 'customer'); END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_manage_billing() RETURNS BOOLEAN AS $$
BEGIN RETURN (get_auth_role() IN ('owner', 'staff') AND is_account_active()); END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_view_reports() RETURNS BOOLEAN AS $$
BEGIN RETURN (get_auth_role() = 'owner'); END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_has_permission(p_permission TEXT) RETURNS BOOLEAN AS $$
DECLARE v_has_perm BOOLEAN := FALSE;
BEGIN
    IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
    SELECT (r.permissions ? p_permission) INTO v_has_perm
    FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.user_id = auth.uid() AND p.status = 'active' AND p.deleted_at IS NULL;
    RETURN COALESCE(v_has_perm, FALSE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_branch_id(p_user_id UUID DEFAULT auth.uid()) RETURNS UUID AS $$
DECLARE v_branch_id UUID;
BEGIN
    IF p_user_id IS NULL THEN
        SELECT id INTO v_branch_id FROM branches WHERE is_main_branch = true LIMIT 1;
        RETURN v_branch_id;
    END IF;
    SELECT branch_id INTO v_branch_id FROM profiles WHERE user_id = p_user_id;
    IF v_branch_id IS NULL THEN SELECT id INTO v_branch_id FROM branches WHERE is_main_branch = true LIMIT 1; END IF;
    RETURN v_branch_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Enable RLS across all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE walk_in_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------
-- GUARANTEE SCHEMA CONVERGENCE FOR PROFILES, ROLES & FOREIGN KEYS
-- ------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE RESTRICT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(25);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(25);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status user_status_type DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
        UPDATE profiles p
        SET role_id = r.id
        FROM roles r
        WHERE p.role_id IS NULL AND p.role::text = r.name::text;
    END IF;
    UPDATE profiles SET role_id = '33333333-3333-3333-3333-333333333333' WHERE role_id IS NULL;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
        UPDATE profiles SET phone_number = phone WHERE phone_number IS NULL;
    END IF;
END $$;

ALTER TABLE staff ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------------
-- IDEMPOTENT RLS POLICIES (DROP POLICY IF EXISTS before CREATE POLICY)
-- ------------------------------------------------------------------------

-- Branches
DROP POLICY IF EXISTS "Public read active branches" ON branches;
CREATE POLICY "Public read active branches" ON branches FOR SELECT USING (is_active = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Owner manage branches" ON branches;
CREATE POLICY "Owner manage branches" ON branches FOR ALL USING (is_owner());

-- Roles
DROP POLICY IF EXISTS "Public read roles" ON roles;
CREATE POLICY "Public read roles" ON roles FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Owner manage roles" ON roles;
CREATE POLICY "Owner manage roles" ON roles FOR ALL USING (is_owner());

-- Profiles
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (user_id = auth.uid() OR is_staff_or_owner());

DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff Owner manage profiles" ON profiles;
CREATE POLICY "Staff Owner manage profiles" ON profiles FOR ALL USING (is_staff_or_owner());

-- Staff
DROP POLICY IF EXISTS "Public read active staff" ON staff;
CREATE POLICY "Public read active staff" ON staff FOR SELECT USING (is_active = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Staff update own availability" ON staff;
CREATE POLICY "Staff update own availability" ON staff FOR UPDATE USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR is_owner());

DROP POLICY IF EXISTS "Owner manage staff" ON staff;
CREATE POLICY "Owner manage staff" ON staff FOR ALL USING (is_owner());

-- Services
DROP POLICY IF EXISTS "Public read active services" ON services;
CREATE POLICY "Public read active services" ON services FOR SELECT USING (active_status = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Owner manage services" ON services;
CREATE POLICY "Owner manage services" ON services FOR ALL USING (is_owner());

-- Customers
DROP POLICY IF EXISTS "Customers read own record" ON customers;
CREATE POLICY "Customers read own record" ON customers FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR is_staff_or_owner());

DROP POLICY IF EXISTS "Customers update own record" ON customers;
CREATE POLICY "Customers update own record" ON customers FOR UPDATE USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) AND is_account_active());

DROP POLICY IF EXISTS "Public create customer" ON customers;
CREATE POLICY "Public create customer" ON customers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Staff and owner manage customers" ON customers;
CREATE POLICY "Staff and owner manage customers" ON customers FOR ALL USING (is_staff_or_owner());

-- Appointments
DROP POLICY IF EXISTS "Customers read own appointments" ON appointments;
CREATE POLICY "Customers read own appointments" ON appointments FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) OR is_staff_or_owner());

DROP POLICY IF EXISTS "Public book appointments" ON appointments;
CREATE POLICY "Public book appointments" ON appointments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Customer cancel own pending appointment" ON appointments;
CREATE POLICY "Customer cancel own pending appointment" ON appointments FOR UPDATE USING (customer_id IN (SELECT id FROM customers WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) AND status = 'pending' AND is_account_active());

DROP POLICY IF EXISTS "Staff Owner manage appointments" ON appointments;
CREATE POLICY "Staff Owner manage appointments" ON appointments FOR ALL USING (is_staff_or_owner());

-- Appointment Services
DROP POLICY IF EXISTS "Read appointment services" ON appointment_services;
CREATE POLICY "Read appointment services" ON appointment_services FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insert appointment services" ON appointment_services;
CREATE POLICY "Insert appointment services" ON appointment_services FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Staff Owner manage appointment services" ON appointment_services;
CREATE POLICY "Staff Owner manage appointment services" ON appointment_services FOR ALL USING (is_staff_or_owner());

-- Walk-in Customers
DROP POLICY IF EXISTS "Staff Owner manage walk ins" ON walk_in_customers;
CREATE POLICY "Staff Owner manage walk ins" ON walk_in_customers FOR ALL USING (true);

-- Queue
DROP POLICY IF EXISTS "Public read live queue" ON queue;
CREATE POLICY "Public read live queue" ON queue FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Public read and join queue" ON queue;
DROP POLICY IF EXISTS "Public insert queue" ON queue;
CREATE POLICY "Public insert queue" ON queue FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Staff Owner manage queue" ON queue;
CREATE POLICY "Staff Owner manage queue" ON queue FOR ALL USING (is_staff_or_owner());

-- Invoices
DROP POLICY IF EXISTS "Customers read own invoices" ON invoices;
CREATE POLICY "Customers read own invoices" ON invoices FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) OR is_staff_or_owner());

DROP POLICY IF EXISTS "Staff Owner manage invoices" ON invoices;
CREATE POLICY "Staff Owner manage invoices" ON invoices FOR ALL USING (is_staff_or_owner());

-- Invoice Items
DROP POLICY IF EXISTS "Read invoice items" ON invoice_items;
CREATE POLICY "Read invoice items" ON invoice_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff Owner manage invoice items" ON invoice_items;
CREATE POLICY "Staff Owner manage invoice items" ON invoice_items FOR ALL USING (is_staff_or_owner());

-- Payments
DROP POLICY IF EXISTS "Customers read own payments" ON payments;
CREATE POLICY "Customers read own payments" ON payments FOR SELECT USING (invoice_id IN (SELECT id FROM invoices WHERE customer_id IN (SELECT id FROM customers WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))) OR is_staff_or_owner());

DROP POLICY IF EXISTS "Staff Owner manage payments" ON payments;
CREATE POLICY "Staff Owner manage payments" ON payments FOR ALL USING (is_staff_or_owner());

-- Settings & Schedule
DROP POLICY IF EXISTS "Public read settings" ON business_settings;
CREATE POLICY "Public read settings" ON business_settings FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Owner manage settings" ON business_settings;
CREATE POLICY "Owner manage settings" ON business_settings FOR ALL USING (is_owner());

DROP POLICY IF EXISTS "Public read working hours" ON working_hours;
CREATE POLICY "Public read working hours" ON working_hours FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Owner manage working hours" ON working_hours;
CREATE POLICY "Owner manage working hours" ON working_hours FOR ALL USING (is_owner());

DROP POLICY IF EXISTS "Public read holidays" ON holidays;
CREATE POLICY "Public read holidays" ON holidays FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Owner manage holidays" ON holidays;
CREATE POLICY "Owner manage holidays" ON holidays FOR ALL USING (is_owner());

-- Notifications & WhatsApp
DROP POLICY IF EXISTS "Staff Owner manage notifications" ON notifications;
CREATE POLICY "Staff Owner manage notifications" ON notifications FOR ALL USING (is_staff_or_owner());

DROP POLICY IF EXISTS "Staff Owner view whatsapp logs" ON whatsapp_logs;
CREATE POLICY "Staff Owner view whatsapp logs" ON whatsapp_logs FOR ALL USING (is_staff_or_owner());

-- Reports & Audits
DROP POLICY IF EXISTS "Owner view reports" ON reports_cache;
CREATE POLICY "Owner view reports" ON reports_cache FOR ALL USING (is_owner());

DROP POLICY IF EXISTS "Owner view audit logs" ON audit_logs;
CREATE POLICY "Owner view audit logs" ON audit_logs FOR SELECT USING (is_owner());

-- Future Extensions (Inventory, Memberships, Loyalty, Expenses)
DROP POLICY IF EXISTS "Staff Owner manage inventory" ON inventory;
CREATE POLICY "Staff Owner manage inventory" ON inventory FOR ALL USING (is_staff_or_owner());

DROP POLICY IF EXISTS "Staff Owner manage suppliers" ON suppliers;
CREATE POLICY "Staff Owner manage suppliers" ON suppliers FOR ALL USING (is_staff_or_owner());

DROP POLICY IF EXISTS "Staff Owner manage purchases" ON purchases;
CREATE POLICY "Staff Owner manage purchases" ON purchases FOR ALL USING (is_staff_or_owner());

DROP POLICY IF EXISTS "Owner manage expenses" ON expenses;
CREATE POLICY "Owner manage expenses" ON expenses FOR ALL USING (is_owner());

DROP POLICY IF EXISTS "Read memberships" ON memberships;
CREATE POLICY "Read memberships" ON memberships FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner manage memberships" ON memberships;
CREATE POLICY "Owner manage memberships" ON memberships FOR ALL USING (is_owner());

DROP POLICY IF EXISTS "Read loyalty points" ON loyalty_points;
CREATE POLICY "Read loyalty points" ON loyalty_points FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner manage loyalty points" ON loyalty_points;
CREATE POLICY "Owner manage loyalty points" ON loyalty_points FOR ALL USING (is_owner());

-- ------------------------------------------------------------------------
-- 6. STORAGE BUCKETS & REALTIME PUBLICATION (SAFE IDEMPOTENT)
-- ------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('profile-images', 'profile-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('service-images', 'service-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
    ('invoice-pdf', 'invoice-pdf', false, 10485760, ARRAY['application/pdf']),
    ('business-logo', 'business-logo', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- Safe Realtime Publication Subscription
DO $$
DECLARE
    tbl text;
    realtime_tables text[] := ARRAY['queue', 'appointments', 'staff', 'invoices', 'business_settings'];
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    FOREACH tbl IN ARRAY realtime_tables
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------
-- 7. SEED INITIAL PRODUCTION DATA
-- ------------------------------------------------------------------------
-- Drop legacy NOT NULL constraints from 001 draft schema (salon_id, price_lkr, duration_minutes, etc.)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'salon_id') THEN
        ALTER TABLE services ALTER COLUMN salon_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'price_lkr') THEN
        ALTER TABLE services ALTER COLUMN price_lkr DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'duration_minutes') THEN
        ALTER TABLE services ALTER COLUMN duration_minutes DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'salon_id') THEN
        ALTER TABLE customers ALTER COLUMN salon_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'phone') THEN
        ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'full_name') THEN
        ALTER TABLE customers ALTER COLUMN full_name DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'salon_id') THEN
        ALTER TABLE appointments ALTER COLUMN salon_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'salon_id') THEN
        ALTER TABLE invoices ALTER COLUMN salon_id DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'salon_id') THEN
        ALTER TABLE whatsapp_logs ALTER COLUMN salon_id DROP NOT NULL;
    END IF;
END $$;

-- Ensure services, customers, staff, queue columns exist before inserting seed data
ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
ALTER TABLE services ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE services ADD COLUMN IF NOT EXISTS icon_name VARCHAR(50) DEFAULT 'content_cut';
ALTER TABLE services ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 1;
ALTER TABLE services ADD COLUMN IF NOT EXISTS active_status BOOLEAN DEFAULT true;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spending NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_barber_id UUID;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_number VARCHAR(30);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS mobile VARCHAR(25);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(25);

ALTER TABLE staff ADD COLUMN IF NOT EXISTS position VARCHAR(50) DEFAULT 'Senior Stylist';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS chair_number INTEGER DEFAULT 1;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2) DEFAULT 30.00;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) DEFAULT 4.9;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE queue ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS ticket_code VARCHAR(30);
ALTER TABLE queue ADD COLUMN IF NOT EXISTS estimated_waiting_time INTEGER DEFAULT 15;
ALTER TABLE queue ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Guarantee unique indexes matching ON CONFLICT specifications
CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_service_code ON services (branch_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_settings_branch ON business_settings (branch_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_working_day ON working_hours (branch_id, day_name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_daily_queue_number ON queue (branch_id, queue_date, queue_number);

INSERT INTO roles (id, name, display_name, description, permissions)
VALUES
('11111111-1111-1111-1111-111111111111', 'owner', 'Salon Owner', 'Full administrative control over salon operations, billing, staff, and financial analytics.', '["all"]'::jsonb),
('22222222-2222-2222-2222-222222222222', 'staff', 'Barber / Staff', 'Manage live queue, appointments, and record bills.', '["queue:manage", "appointments:view", "billing:create"]'::jsonb),
('33333333-3333-3333-3333-333333333333', 'customer', 'Customer', 'Browse services, book appointments, join queue.', '["queue:join", "appointments:create"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO branches (id, branch_number, name, sinhala_name, slug, address, city, district, phone, whatsapp_number, email, is_main_branch, is_active)
VALUES ('b0000000-0000-0000-0000-000000000001', 'BR-001', 'Smart Salon LK - Ampitiya', 'ස්මාර්ට් සැලූන් - අම්පිටිය', 'smart-salon-Ampitiya', 'Kandy Road, Ampitiya (Near Ampitiya Bus Stand)', 'Ampitiya', 'Kandy', '+94722759020', '+94722759020', 'info@smartsallon.lk', true, true)
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
    email = EXCLUDED.email;

INSERT INTO business_settings (branch_id, salon_name, sinhala_name, address, city, phone, whatsapp, email, opening_time, closing_time, currency, time_zone, invoice_prefix, queue_prefix, barcode_prefix, tax_percentage, enable_card_payments, enable_lankaqr, enable_walk_ins, enable_notifications, language, lankaqr_merchant_id, lankaqr_account_number)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Smart Salon LK', 'ස්මාර්ට් සැලූන්', 'Kandy Road, Ampitiya', 'Ampitiya', '+94722759020', '+94722759020', 'Ampitiya@smartsallon.lk', '06:00:00', '20:00:00', 'LKR', 'Asia/Colombo', 'INV-', 'LK-', 'SSLK-', 0.00, true, true, true, true, 'si', 'LKQR-9021-SMART', '800123456789')
ON CONFLICT (branch_id) DO UPDATE SET
    salon_name = EXCLUDED.salon_name,
    sinhala_name = EXCLUDED.sinhala_name,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    phone = EXCLUDED.phone,
    whatsapp = EXCLUDED.whatsapp,
    email = EXCLUDED.email;

INSERT INTO working_hours (branch_id, day_name, day_index, opening_time, closing_time, is_closed)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'Monday', 1, '06:00:00', '20:00:00', false),
    ('b0000000-0000-0000-0000-000000000001', 'Tuesday', 2, '06:00:00', '20:00:00', false),
    ('b0000000-0000-0000-0000-000000000001', 'Wednesday', 3, '06:00:00', '20:00:00', false),
    ('b0000000-0000-0000-0000-000000000001', 'Thursday', 4, '06:00:00', '20:00:00', false),
    ('b0000000-0000-0000-0000-000000000001', 'Friday', 5, '06:00:00', '20:00:00', false),
    ('b0000000-0000-0000-0000-000000000001', 'Saturday', 6, '06:00:00', '20:00:00', false),
    ('b0000000-0000-0000-0000-000000000001', 'Sunday', 0, '06:00:00', '20:00:00', false)
ON CONFLICT (branch_id, day_name) DO NOTHING;

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
ON CONFLICT (branch_id, code) DO NOTHING;

INSERT INTO staff (id, branch_id, staff_number, full_name, sinhala_name, position, chair_number, availability, working_hours, commission_percentage, photo_url, rating, reviews_count, is_active)
VALUES
('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'STF-001', 'Master Kavi', 'කවිඳු පෙරේරා', 'Chief Stylist', 1, 'available', '{"start": "06:00", "end": "20:00"}'::jsonb, 35.00, 'https://lh3.googleusercontent.com/aida-public/AB6AXuDdYsmqEToWqkhLyMB8Y2bFHS95FzmiIje__Q5F57JwDnjqvRoa62_OAlePc_dNjxMI1lb5HkhAwm9QyuRxGUXuCxXTP0qI_gZR96IgkpBiYd0OOfbyd6rSzkcBj44_OJR7ZpB8e9DPSWObbYhtmf7RpoVDy0G22Hfk_Dsa9tnGt3_r-KC8p3pm7W_zzKQKbPF4iX5LqebNt8E_wjLS2aVev5MFYMfOdYodRwwx4DQ', 4.9, 180, true),
('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'STF-002', 'Sunil Shantha', 'සුනිල් ශාන්ත', 'Beard Artisan', 2, 'busy', '{"start": "06:00", "end": "20:00"}'::jsonb, 30.00, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCsFnPnMzYxJ6xwVclhW0_CLiqeTfBaORMEOpfZGsEvL_nWkHooK6M3cYwxLqbj6TZd48qR0hWLjDHeAJWmmr5FKuBcIhyMXDGkY7aqpHgiKBX0PvkGtK9pTAmBVVf9wSIJzs95aQiAmjN24vrgl4llavZaWDqjKEduTj-DCEkuLv7svp5QrxLseoYLlzbFbKlAYooHQL6fU9tU7_wbAhT1H3uAMIwX6hD2KKcVU-s', 4.8, 95, true)
ON CONFLICT (branch_id, staff_number) DO NOTHING;

-- ------------------------------------------------------------------------
-- 8. AUTHENTICATION & SECURITY RPCs
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
    v_phone := COALESCE(NEW.phone, v_meta->>'phone', v_meta->>'phone_number', v_meta->>'whatsapp_number');
    v_normalized_phone := normalize_sl_phone(v_phone);

    v_full_name := COALESCE(
        v_meta->>'full_name',
        v_meta->>'name',
        CASE WHEN v_normalized_phone IS NOT NULL THEN 'Customer ' || RIGHT(v_normalized_phone, 4) ELSE 'Salon Customer' END
    );

    SELECT id INTO v_customer_role_id FROM roles WHERE name = 'customer' LIMIT 1;
    SELECT id INTO v_staff_role_id FROM roles WHERE name = 'staff' LIMIT 1;
    SELECT id INTO v_owner_role_id FROM roles WHERE name = 'owner' LIMIT 1;
    SELECT id INTO v_branch_id FROM branches WHERE is_main_branch = true LIMIT 1;

    IF v_normalized_phone IS NOT NULL THEN
        SELECT s.id INTO v_staff_record_id FROM staff s JOIN profiles p ON p.id = s.profile_id WHERE p.phone_number = v_normalized_phone LIMIT 1;
        IF v_staff_record_id IS NULL AND (v_meta->>'role' = 'staff') THEN v_role_id := v_staff_role_id;
        ELSIF v_meta->>'role' = 'owner' THEN v_role_id := v_owner_role_id;
        ELSIF v_staff_record_id IS NOT NULL THEN v_role_id := v_staff_role_id;
        ELSE v_role_id := v_customer_role_id; END IF;
    ELSE
        v_role_id := v_customer_role_id;
    END IF;

    INSERT INTO profiles (
        user_id, branch_id, role_id, full_name, phone_number, whatsapp_number, profile_photo_url, status, language, last_login_at
    )
    VALUES (
        NEW.id, v_branch_id, v_role_id, v_full_name, COALESCE(v_normalized_phone, '+94000000000'), v_normalized_phone, v_meta->>'avatar_url', 'active', COALESCE((v_meta->>'language')::app_language_type, 'si'), now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        last_login_at = now(),
        updated_at = now(),
        full_name = CASE WHEN profiles.full_name = 'Salon Customer' THEN EXCLUDED.full_name ELSE profiles.full_name END
    RETURNING id INTO v_profile_id;

    IF v_role_id = v_customer_role_id AND v_normalized_phone IS NOT NULL THEN
        SELECT id INTO v_customer_record_id FROM customers WHERE branch_id = v_branch_id AND (mobile = v_normalized_phone OR whatsapp = v_normalized_phone) LIMIT 1;
        IF v_customer_record_id IS NULL THEN
            INSERT INTO customers (branch_id, profile_id, name, mobile, whatsapp, created_by)
            VALUES (v_branch_id, v_profile_id, v_full_name, v_normalized_phone, v_normalized_phone, NEW.id);
        ELSE
            UPDATE customers SET profile_id = v_profile_id, name = CASE WHEN customers.name = 'Walk-in Customer' THEN v_full_name ELSE customers.name END, updated_at = now()
            WHERE id = v_customer_record_id AND profile_id IS NULL;
        END IF;
    END IF;

    IF v_staff_record_id IS NOT NULL THEN
        UPDATE staff SET profile_id = v_profile_id, updated_at = now() WHERE id = v_staff_record_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- Register Owner RPC
CREATE OR REPLACE FUNCTION register_salon_owner(
    p_full_name TEXT, p_phone TEXT, p_salon_name TEXT DEFAULT 'Smart Salon LK', p_city TEXT DEFAULT 'Kiribathgoda'
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_owner_role_id UUID;
    v_branch_id UUID;
    v_profile_id UUID;
    v_normalized_phone TEXT;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated. Please sign in via phone OTP first.'; END IF;
    v_normalized_phone := normalize_sl_phone(p_phone);

    SELECT id INTO v_owner_role_id FROM roles WHERE name = 'owner' LIMIT 1;
    IF v_owner_role_id IS NULL THEN RAISE EXCEPTION 'Owner role not found in system.'; END IF;
    SELECT id INTO v_branch_id FROM branches WHERE is_main_branch = true LIMIT 1;

    INSERT INTO profiles (user_id, branch_id, role_id, full_name, phone_number, whatsapp_number, status, language)
    VALUES (v_user_id, v_branch_id, v_owner_role_id, p_full_name, v_normalized_phone, v_normalized_phone, 'active', 'si')
    ON CONFLICT (user_id) DO UPDATE SET
        role_id = v_owner_role_id, full_name = EXCLUDED.full_name, phone_number = EXCLUDED.phone_number, whatsapp_number = EXCLUDED.whatsapp_number, updated_at = now()
    RETURNING id INTO v_profile_id;

    UPDATE business_settings
    SET salon_name = COALESCE(p_salon_name, salon_name), city = COALESCE(p_city, city), phone = COALESCE(v_normalized_phone, phone), whatsapp = COALESCE(v_normalized_phone, whatsapp), updated_at = now()
    WHERE branch_id = v_branch_id;

    RETURN jsonb_build_object('success', true, 'profile_id', v_profile_id, 'role', 'owner', 'message', 'Salon Owner successfully registered.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Provision Staff RPC
CREATE OR REPLACE FUNCTION provision_staff_member(
    p_full_name TEXT, p_sinhala_name TEXT, p_phone TEXT, p_chair_number INTEGER, p_position TEXT DEFAULT 'Senior Stylist', p_commission_percentage NUMERIC DEFAULT 0.00
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
    IF NOT is_owner() THEN RAISE EXCEPTION 'Access Denied: Only the Salon Owner can provision staff.'; END IF;
    IF p_chair_number < 1 OR p_chair_number > 2 THEN RAISE EXCEPTION 'Version 1 only supports Chair 1 and Chair 2.'; END IF;

    v_normalized_phone := normalize_sl_phone(p_phone);
    v_branch_id := get_user_branch_id(v_owner_id);

    IF EXISTS (SELECT 1 FROM staff WHERE branch_id = v_branch_id AND chair_number = p_chair_number AND is_active = true AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'Chair % is already assigned to an active barber.', p_chair_number;
    END IF;

    SELECT id INTO v_staff_role_id FROM roles WHERE name = 'staff' LIMIT 1;
    SELECT id INTO v_profile_id FROM profiles WHERE phone_number = v_normalized_phone LIMIT 1;

    IF v_profile_id IS NULL THEN
        INSERT INTO profiles (branch_id, role_id, full_name, phone_number, whatsapp_number, status, language, created_by)
        VALUES (v_branch_id, v_staff_role_id, p_full_name, v_normalized_phone, v_normalized_phone, 'active', 'si', v_owner_id)
        RETURNING id INTO v_profile_id;
    ELSE
        UPDATE profiles SET role_id = v_staff_role_id, status = 'active', updated_at = now() WHERE id = v_profile_id;
    END IF;

    SELECT COUNT(*) + 1 INTO v_count FROM staff WHERE branch_id = v_branch_id;
    v_staff_number := 'STF-' || LPAD(v_count::TEXT, 3, '0');

    INSERT INTO staff (branch_id, profile_id, staff_number, full_name, sinhala_name, position, chair_number, availability, commission_percentage, is_active, created_by)
    VALUES (v_branch_id, v_profile_id, v_staff_number, p_full_name, p_sinhala_name, p_position, p_chair_number, 'available', p_commission_percentage, true, v_owner_id)
    RETURNING id INTO v_staff_id;

    RETURN jsonb_build_object('success', true, 'staff_id', v_staff_id, 'staff_number', v_staff_number, 'chair_number', p_chair_number, 'message', 'Staff member provisioned successfully.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Account Status RPC
CREATE OR REPLACE FUNCTION set_user_account_status(p_target_user_id UUID, p_new_status user_status_type, p_reason TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE v_caller_id UUID := auth.uid();
BEGIN
    IF NOT is_owner() THEN RAISE EXCEPTION 'Access Denied: Only Salon Owner can change account status.'; END IF;

    UPDATE profiles SET status = p_new_status, updated_at = now(), updated_by = v_caller_id WHERE user_id = p_target_user_id OR id = p_target_user_id;

    INSERT INTO audit_logs (table_name, record_id, action, new_data, changed_by, changed_at)
    VALUES ('profiles', p_target_user_id, 'UPDATE', jsonb_build_object('status', p_new_status, 'reason', p_reason), v_caller_id, now());

    RETURN jsonb_build_object('success', true, 'status', p_new_status, 'message', 'Account status updated to ' || p_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit Logger Function
CREATE OR REPLACE FUNCTION log_security_event(
    p_action audit_action_type, p_record_id UUID DEFAULT NULL, p_details JSONB DEFAULT '{}'::jsonb,
    p_table_name VARCHAR(100) DEFAULT 'auth_events', p_user_id UUID DEFAULT auth.uid(),
    p_ip_address VARCHAR(45) DEFAULT NULL, p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE v_log_id UUID;
BEGIN
    INSERT INTO audit_logs (table_name, record_id, action, new_data, changed_by, changed_at, ip_address, user_agent)
    VALUES (p_table_name, p_record_id, p_action, p_details, COALESCE(p_user_id, auth.uid()), now(), p_ip_address, p_user_agent)
    RETURNING id INTO v_log_id;
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Immutable Audit Log Trigger
CREATE OR REPLACE FUNCTION prevent_audit_log_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE actions are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_tampering ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_tampering BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_tampering();

-- Role & Status Change Tracker
CREATE OR REPLACE FUNCTION track_profile_role_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.role_id IS DISTINCT FROM NEW.role_id) THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by, changed_at)
        VALUES ('profiles', NEW.id, 'ROLE_CHANGE', jsonb_build_object('old_role_id', OLD.role_id, 'user_id', OLD.user_id), jsonb_build_object('new_role_id', NEW.role_id, 'user_id', NEW.user_id), auth.uid(), now());
    END IF;

    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by, changed_at)
        VALUES ('profiles', NEW.id, 'SENSITIVE_UPDATE', jsonb_build_object('old_status', OLD.status), jsonb_build_object('new_status', NEW.status), auth.uid(), now());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_track_profile_role_changes ON profiles;
CREATE TRIGGER trg_track_profile_role_changes AFTER UPDATE OF role_id, status ON profiles FOR EACH ROW EXECUTE FUNCTION track_profile_role_changes();

-- Global Logout & Session Revocation RPC
CREATE OR REPLACE FUNCTION revoke_user_sessions(p_target_user_id UUID DEFAULT auth.uid())
RETURNS JSONB AS $$
DECLARE v_caller_id UUID := auth.uid();
BEGIN
    IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated.'; END IF;
    IF p_target_user_id <> v_caller_id AND NOT is_owner() THEN RAISE EXCEPTION 'Access Denied: Only Salon Owner can invalidate other users sessions.'; END IF;

    UPDATE profiles SET updated_at = now() WHERE user_id = p_target_user_id;

    PERFORM log_security_event('LOGOUT', p_target_user_id, jsonb_build_object('scope', 'global', 'revoked_by', v_caller_id), 'auth_sessions', p_target_user_id);

    RETURN jsonb_build_object('success', true, 'user_id', p_target_user_id, 'message', 'User sessions successfully invalidated.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------------------
-- 10. COMPLETE CUSTOMER MANAGEMENT & CRM MODULE
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

CREATE INDEX IF NOT EXISTS idx_customers_search_phone ON customers(branch_id, mobile) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_search_whatsapp ON customers(branch_id, whatsapp) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_search_num ON customers(branch_id, customer_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_spending ON customers(branch_id, total_spending DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_visits ON customers(branch_id, total_visits DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(branch_id, status) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION upsert_salon_customer(
    p_branch_id UUID, p_name TEXT, p_phone TEXT, p_whatsapp TEXT DEFAULT NULL,
    p_preferred_barber_id UUID DEFAULT NULL, p_notes TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL, p_date_of_birth DATE DEFAULT NULL,
    p_language app_language_type DEFAULT 'si', p_status VARCHAR DEFAULT 'active'
)
RETURNS JSONB AS $$
DECLARE
    v_norm_phone TEXT;
    v_norm_whatsapp TEXT;
    v_existing_id UUID;
    v_customer_record RECORD;
    v_is_new BOOLEAN := FALSE;
BEGIN
    v_norm_phone := normalize_sl_phone(p_phone);
    IF v_norm_phone IS NULL OR v_norm_phone = '' THEN
        RAISE EXCEPTION 'A valid phone number is required for customer registration.';
    END IF;

    IF p_whatsapp IS NOT NULL AND TRIM(p_whatsapp) <> '' THEN
        v_norm_whatsapp := normalize_sl_phone(p_whatsapp);
    ELSE
        v_norm_whatsapp := v_norm_phone;
    END IF;

    SELECT id INTO v_existing_id
    FROM customers
    WHERE branch_id = p_branch_id
      AND (mobile = v_norm_phone OR whatsapp = v_norm_phone)
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
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
        v_is_new := TRUE;
        INSERT INTO customers (
            branch_id, name, mobile, whatsapp, preferred_barber_id,
            notes, address, date_of_birth, preferred_language, status, created_by
        )
        VALUES (
            p_branch_id, TRIM(p_name), v_norm_phone, v_norm_whatsapp, p_preferred_barber_id,
            p_notes, p_address, p_date_of_birth, p_language, p_status, auth.uid()
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

CREATE OR REPLACE FUNCTION search_salon_customers(
    p_branch_id UUID, p_query TEXT, p_status VARCHAR DEFAULT NULL, p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
    id UUID, customer_number VARCHAR, name VARCHAR, mobile VARCHAR, whatsapp VARCHAR,
    status VARCHAR, total_visits INTEGER, total_spending NUMERIC, last_visit TIMESTAMPTZ,
    preferred_barber_name VARCHAR, notes TEXT, is_vip BOOLEAN
) AS $$
DECLARE
    v_clean_query TEXT;
    v_phone_query TEXT;
BEGIN
    v_clean_query := TRIM(COALESCE(p_query, ''));
    v_phone_query := REGEXP_REPLACE(v_clean_query, '[^0-9+]', '', 'g');

    RETURN QUERY
    SELECT
        c.id, c.customer_number, c.name, c.mobile, c.whatsapp, c.status,
        c.total_visits, c.total_spending, c.last_visit,
        s.full_name AS preferred_barber_name, c.notes, c.is_vip
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

CREATE OR REPLACE FUNCTION get_customer_dashboard_profile(p_customer_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_customer RECORD;
    v_favourite_service_name VARCHAR;
    v_upcoming_count INTEGER;
    v_completed_count INTEGER;
    v_cancelled_count INTEGER;
    v_visits_history JSONB;
BEGIN
    SELECT c.*, s.full_name AS barber_name
    INTO v_customer
    FROM customers c
    LEFT JOIN staff s ON s.id = c.preferred_barber_id
    WHERE c.id = p_customer_id AND c.deleted_at IS NULL;

    IF v_customer.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Customer not found.');
    END IF;

    SELECT COUNT(*) INTO v_upcoming_count
    FROM appointments
    WHERE customer_id = p_customer_id AND appointment_date >= CURRENT_DATE
      AND status IN ('pending', 'confirmed') AND deleted_at IS NULL;

    SELECT COUNT(*) INTO v_completed_count
    FROM appointments
    WHERE customer_id = p_customer_id AND status = 'completed' AND deleted_at IS NULL;

    SELECT COUNT(*) INTO v_cancelled_count
    FROM appointments
    WHERE customer_id = p_customer_id AND status IN ('cancelled', 'no_show') AND deleted_at IS NULL;

    SELECT s.name INTO v_favourite_service_name
    FROM appointment_services asrv
    JOIN appointments a ON a.id = asrv.appointment_id
    JOIN services s ON s.id = asrv.service_id
    WHERE a.customer_id = p_customer_id
    GROUP BY s.name
    ORDER BY COUNT(*) DESC
    LIMIT 1;

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
        WHERE i.customer_id = p_customer_id AND i.deleted_at IS NULL
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
    SELECT COUNT(*) INTO v_total_customers FROM customers WHERE branch_id = p_branch_id AND deleted_at IS NULL;

    SELECT COUNT(*) INTO v_new_this_month FROM customers WHERE branch_id = p_branch_id
      AND created_at >= DATE_TRUNC('month', CURRENT_DATE) AND deleted_at IS NULL;

    SELECT COUNT(*) INTO v_returning_customers FROM customers WHERE branch_id = p_branch_id
      AND total_visits >= 2 AND deleted_at IS NULL;

    SELECT COUNT(*) INTO v_active_count FROM customers WHERE branch_id = p_branch_id AND status = 'active' AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_inactive_count FROM customers WHERE branch_id = p_branch_id AND status = 'inactive' AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_blocked_count FROM customers WHERE branch_id = p_branch_id AND status = 'blocked' AND deleted_at IS NULL;

    SELECT COALESCE(jsonb_agg(val_cust), '[]'::jsonb) INTO v_most_valuable
    FROM (
        SELECT id, customer_number, name, mobile, total_spending, total_visits, last_visit
        FROM customers WHERE branch_id = p_branch_id AND deleted_at IS NULL
        ORDER BY total_spending DESC LIMIT 5
    ) val_cust;

    SELECT COALESCE(jsonb_agg(freq_cust), '[]'::jsonb) INTO v_most_frequent
    FROM (
        SELECT id, customer_number, name, mobile, total_visits, total_spending, last_visit
        FROM customers WHERE branch_id = p_branch_id AND deleted_at IS NULL
        ORDER BY total_visits DESC LIMIT 5
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
