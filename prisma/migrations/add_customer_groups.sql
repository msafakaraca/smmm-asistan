-- Add Customer Groups Tables
-- Run this in Supabase SQL Editor

-- CustomerGroup tablosu
CREATE TABLE IF NOT EXISTS public.customer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT,
  "sirketTipiFilter" TEXT,
  "tenantId" UUID NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("tenantId", name)
);

-- CustomerGroupMember tablosu (many-to-many)
CREATE TABLE IF NOT EXISTS public.customer_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "groupId" UUID NOT NULL REFERENCES public.customer_groups(id) ON DELETE CASCADE,
  "customerId" UUID NOT NULL REFERENCES public."Customer"(id) ON DELETE CASCADE,
  "addedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("groupId", "customerId")
);

-- Indexes
CREATE INDEX IF NOT EXISTS customer_groups_tenant_id_idx ON public.customer_groups("tenantId");
CREATE INDEX IF NOT EXISTS customer_group_members_group_id_idx ON public.customer_group_members("groupId");
CREATE INDEX IF NOT EXISTS customer_group_members_customer_id_idx ON public.customer_group_members("customerId");

-- RLS Policies
ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_group_members ENABLE ROW LEVEL SECURITY;

-- CustomerGroups RLS
DROP POLICY IF EXISTS "customer_groups_tenant_isolation" ON public.customer_groups;
CREATE POLICY "customer_groups_tenant_isolation" ON public.customer_groups
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- CustomerGroupMembers RLS (grup üzerinden tenant isolation)
DROP POLICY IF EXISTS "customer_group_members_tenant_isolation" ON public.customer_group_members;
CREATE POLICY "customer_group_members_tenant_isolation" ON public.customer_group_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_groups g
      WHERE g.id = "groupId" AND g."tenantId" = public.get_user_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customer_groups g
      WHERE g.id = "groupId" AND g."tenantId" = public.get_user_tenant_id()
    )
  );

-- Updated trigger for updatedAt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_customer_groups_updated_at ON public.customer_groups;
CREATE TRIGGER update_customer_groups_updated_at
    BEFORE UPDATE ON public.customer_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
