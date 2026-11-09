-- ========================================================================
-- SMART SALON LK - SUPABASE POSTGRESQL BACKEND ARCHITECTURE
-- SCRIPT 07: SUPABASE STORAGE BUCKETS & REALTIME PUBLICATIONS
-- IDEMPOTENT: Safe re-runs without "already exists" or publication member errors
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. CREATE STORAGE BUCKETS
-- ------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('profile-images', 'profile-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('service-images', 'service-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
    ('invoice-pdf', 'invoice-pdf', false, 10485760, ARRAY['application/pdf']),
    ('business-logo', 'business-logo', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ------------------------------------------------------------------------
-- 2. STORAGE ROW LEVEL SECURITY POLICIES (IDEMPOTENT)
-- ------------------------------------------------------------------------

-- Public Read for profile-images, service-images, business-logo
DROP POLICY IF EXISTS "Public read public buckets" ON storage.objects;
CREATE POLICY "Public read public buckets" ON storage.objects
    FOR SELECT USING (bucket_id IN ('profile-images', 'service-images', 'business-logo'));

-- Authenticated Users Upload to profile-images
DROP POLICY IF EXISTS "Authenticated upload profile photo" ON storage.objects;
CREATE POLICY "Authenticated upload profile photo" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'profile-images' 
        AND auth.role() = 'authenticated'
    );

-- Staff / Owner Manage service images and logos
DROP POLICY IF EXISTS "Staff Owner manage assets" ON storage.objects;
CREATE POLICY "Staff Owner manage assets" ON storage.objects
    FOR ALL USING (
        bucket_id IN ('service-images', 'business-logo', 'invoice-pdf')
        AND (
            auth.uid() IN (SELECT user_id FROM profiles p JOIN roles r ON r.id = p.role_id WHERE r.name IN ('owner', 'staff'))
        )
    );

-- Customers Download Own Invoices
DROP POLICY IF EXISTS "Customers download invoice PDF" ON storage.objects;
CREATE POLICY "Customers download invoice PDF" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'invoice-pdf'
        AND (
            auth.uid() IN (SELECT user_id FROM profiles p JOIN roles r ON r.id = p.role_id WHERE r.name IN ('owner', 'staff'))
            OR auth.uid()::text = (storage.foldername(name))[1]
        )
    );

-- ------------------------------------------------------------------------
-- 3. ENABLE SUPABASE REALTIME PUBLICATION (IDEMPOTENT LOOP)
-- ------------------------------------------------------------------------

DO $$
DECLARE
    tbl text;
    realtime_tables text[] := ARRAY['queue', 'appointments', 'staff', 'invoices', 'business_settings'];
BEGIN
    -- Check if publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add each table only if not already a member
    FOREACH tbl IN ARRAY realtime_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            IF NOT EXISTS (
                SELECT 1 
                FROM pg_publication_tables 
                WHERE pubname = 'supabase_realtime' 
                  AND schemaname = 'public' 
                  AND tablename = tbl
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
            END IF;
        END IF;
    END LOOP;
END $$;
