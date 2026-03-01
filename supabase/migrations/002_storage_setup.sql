-- =============================================
-- SMMM Asistan - Supabase Storage Setup
-- =============================================
-- This migration sets up storage buckets and policies for file management

-- =============================================
-- STEP 1: Create Storage Bucket
-- =============================================
-- Create bucket for PDF documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('smmm-documents', 'smmm-documents', false)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- STEP 2: Storage RLS Policies
-- =============================================
-- Allow authenticated users to upload files to their tenant folder

-- Upload policy (INSERT)
CREATE POLICY "Users can upload to own tenant folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'smmm-documents' AND
  (storage.foldername(name))[1] = (
    SELECT "tenantId"::text
    FROM public.user_profiles
    WHERE id = auth.uid()
  )
);

-- Read policy (SELECT)
CREATE POLICY "Users can read from own tenant folder"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'smmm-documents' AND
  (storage.foldername(name))[1] = (
    SELECT "tenantId"::text
    FROM public.user_profiles
    WHERE id = auth.uid()
  )
);

-- Update policy (UPDATE)
CREATE POLICY "Users can update own tenant files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'smmm-documents' AND
  (storage.foldername(name))[1] = (
    SELECT "tenantId"::text
    FROM public.user_profiles
    WHERE id = auth.uid()
  )
);

-- Delete policy (DELETE)
CREATE POLICY "Users can delete own tenant files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'smmm-documents' AND
  (storage.foldername(name))[1] = (
    SELECT "tenantId"::text
    FROM public.user_profiles
    WHERE id = auth.uid()
  )
);

-- Service role bypass (for admin operations)
CREATE POLICY "Service role has full access"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'smmm-documents')
WITH CHECK (bucket_id = 'smmm-documents');

-- =============================================
-- STEP 3: Bucket Configuration
-- =============================================
-- Update bucket settings (file size limits, allowed MIME types)

UPDATE storage.buckets
SET
  file_size_limit = 52428800,  -- 50MB limit
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
  ]
WHERE id = 'smmm-documents';

-- =============================================
-- VERIFICATION
-- =============================================
-- Check bucket exists:
-- SELECT * FROM storage.buckets WHERE id = 'smmm-documents';

-- Check policies:
-- SELECT * FROM pg_policies WHERE tablename = 'objects';

-- =============================================
-- FOLDER STRUCTURE
-- =============================================
/*
 * Files will be organized as:
 *
 * smmm-documents/
 *   {tenantId}/
 *     {customerId}/
 *       {year}/
 *         {month}/
 *           {filename}.pdf
 *
 * Example:
 * smmm-documents/
 *   84b0cb72-ab4a-45d0-99df-13e66fd38df6/
 *     4491d01c-2fac-4338-a7ff-3e16c6961967/
 *       2024/
 *         01/
 *           kdv1-beyanname.pdf
 */
