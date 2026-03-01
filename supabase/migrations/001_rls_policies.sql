-- =============================================
-- SMMM Asistan - Row Level Security Policies
-- =============================================
-- This migration enables RLS and creates tenant isolation policies
-- for all tenant-scoped tables.

-- =============================================
-- STEP 1: Create User Profiles Table
-- =============================================
-- This table extends auth.users with tenant information
-- Required for the RLS helper function

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  "tenantId" uuid NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast tenant lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_id ON public.user_profiles("tenantId");

-- RLS for user_profiles (users can only see their own profile)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Service role can manage all profiles" ON public.user_profiles
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- STEP 2: Create Helper Function
-- =============================================
-- This function returns the tenant_id of the current user
-- Used in all RLS policies for automatic tenant filtering
-- Note: Created in public schema to avoid auth schema permission issues

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid AS $$
  SELECT "tenantId" FROM public.user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================
-- STEP 3: Enable RLS on All Tenant Tables
-- =============================================

-- Customer Table
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - Customer" ON "Customer"
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- Document Table
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - Document" ON "Document"
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- Row Table
ALTER TABLE "Row" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - Row" ON "Row"
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- Kontrol Table
ALTER TABLE "Kontrol" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - Kontrol" ON "Kontrol"
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- Mail Table
ALTER TABLE "Mail" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - Mail" ON "Mail"
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- Password Table
ALTER TABLE "Password" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - Password" ON "Password"
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- Reminder Table
ALTER TABLE "Reminder" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - Reminder" ON "Reminder"
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- BeyannameTakip Table
ALTER TABLE "BeyannameTakip" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - BeyannameTakip" ON "BeyannameTakip"
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- BeyannameTuru Table
ALTER TABLE "BeyannameTuru" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - BeyannameTuru" ON "BeyannameTuru"
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- Job Table
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - Job" ON "Job"
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- BotSession Table
ALTER TABLE "BotSession" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - BotSession" ON "BotSession"
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- License Table
ALTER TABLE "License" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - License" ON "License"
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- =============================================
-- STEP 4: Service Role Bypass
-- =============================================
-- Allow service role to bypass RLS for admin operations

CREATE POLICY "Service role bypass - Customer" ON "Customer"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass - Document" ON "Document"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass - Row" ON "Row"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass - Kontrol" ON "Kontrol"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass - Mail" ON "Mail"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass - Password" ON "Password"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass - Reminder" ON "Reminder"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass - BeyannameTakip" ON "BeyannameTakip"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass - BeyannameTuru" ON "BeyannameTuru"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass - Job" ON "Job"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass - BotSession" ON "BotSession"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass - License" ON "License"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- STEP 5: Tenant Table RLS
-- =============================================
-- Tenants can only see their own tenant record

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tenant" ON "Tenant"
  FOR SELECT TO authenticated
  USING (id = public.get_user_tenant_id());

CREATE POLICY "Service role can manage all tenants" ON "Tenant"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
-- Run these queries to verify RLS is working:

-- 1. Check RLS is enabled on all tables:
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = true;

-- 2. List all policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public';

-- 3. Test tenant isolation (as authenticated user):
-- SELECT COUNT(*) FROM "Customer"; -- Should only see own tenant's customers

-- 4. Test service role bypass:
-- SET ROLE service_role;
-- SELECT COUNT(*) FROM "Customer"; -- Should see all customers
-- RESET ROLE;
