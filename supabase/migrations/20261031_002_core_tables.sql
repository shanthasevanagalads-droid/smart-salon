-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 02: COMPLETE 26-TABLE SCHEMA (3NF NORMALIZATION)
-- Every table includes: id (UUID), created_at, updated_at, created_by, updated_by, deleted_at
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. BRANCHES TABLE (Supports Single Salon in V1, Multi-branch in V2)
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 2. ROLES TABLE
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 3. PROFILES TABLE (Extends Supabase auth.users)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE, -- REFERENCES auth.users(id) ON DELETE CASCADE
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

-- ------------------------------------------------------------------------
-- 4. STAFF TABLE (Barbers & Salon Operators)
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 5. CUSTOMERS TABLE (Customer CRM Ledger)
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 6. SERVICES TABLE (Grooming Catalog)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    sinhala_name VARCHAR(150) NOT NULL,
    description TEXT,
    category service_category_type NOT NULL DEFAULT 'haircut',
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    duration INTEGER NOT NULL CHECK (duration > 0), -- duration in minutes
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

-- ------------------------------------------------------------------------
-- 7. APPOINTMENTS TABLE
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 8. APPOINTMENT_SERVICES TABLE (3NF Normalization for Multi-Service Bookings)
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 9. WALK_IN_CUSTOMERS TABLE (Quick Unregistered Walk-In Registration)
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 10. QUEUE TABLE (Realtime Salon Waitlist Board)
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 11. INVOICES TABLE (Format: INV-YYYY-000001)
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 12. INVOICE_ITEMS TABLE
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 13. PAYMENTS TABLE (Cash, Card, LankaQR, Online)
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 14. BUSINESS_SETTINGS TABLE (Full Configurable Salon Engine)
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 15. WORKING_HOURS TABLE (Day-by-Day Dashboard Editable)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS working_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    day_name VARCHAR(15) NOT NULL CHECK (day_name IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    day_index INTEGER NOT NULL CHECK (day_index BETWEEN 0 AND 6), -- 0=Sun, 1=Mon...
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

-- ------------------------------------------------------------------------
-- 16. HOLIDAYS TABLE
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 17. NOTIFICATIONS TABLE
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 18. WHATSAPP_LOGS TABLE (Complete WhatsApp Communication History)
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 19. REPORTS_CACHE TABLE (Pre-computed Aggregated Analytics)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    report_type VARCHAR(60) NOT NULL, -- 'daily_revenue', 'monthly_revenue', 'service_sales', 'barber_performance', etc.
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

-- ------------------------------------------------------------------------
-- 20. AUDIT_LOGS TABLE (Enterprise Compliance Trail)
-- ------------------------------------------------------------------------
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

-- ========================================================================
-- FUTURE-READY TABLES (21 TO 26)
-- ========================================================================

-- ------------------------------------------------------------------------
-- 21. MEMBERSHIPS TABLE
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 22. LOYALTY_POINTS TABLE
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 23. INVENTORY TABLE
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    item_code VARCHAR(40) NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'hair_product', -- 'blade', 'cream', 'dye', 'oil', 'shampoo'
    unit VARCHAR(20) NOT NULL DEFAULT 'pcs', -- 'pcs', 'ml', 'bottles', 'box'
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

-- ------------------------------------------------------------------------
-- 24. SUPPLIERS TABLE
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 25. PURCHASES TABLE
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 26. EXPENSES TABLE (Rent, Utilities, Snacks, Blade Disposals)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    expense_number VARCHAR(40) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'operational', -- 'rent', 'electricity', 'water', 'tea_snacks', 'maintenance'
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

