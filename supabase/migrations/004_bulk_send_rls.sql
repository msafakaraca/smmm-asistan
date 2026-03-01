-- =============================================
-- SMMM Asistan - Bulk Send RLS Policies
-- =============================================
-- Bu migration, BulkSendLog, CustomerGroup ve
-- CustomerGroupMember tablolarına RLS policy'leri ekler.
--
-- BulkSendLog tablosu için RLS eksikliği,
-- Toplu Gönderim sayfasında dosyaların
-- görüntülenememesine neden oluyordu.
-- =============================================

-- =============================================
-- STEP 1: BulkSendLog RLS
-- =============================================

-- RLS'i etkinleştir
ALTER TABLE public."BulkSendLog" ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY "Tenant isolation - BulkSendLog" ON public."BulkSendLog"
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- Service role bypass
CREATE POLICY "Service role bypass - BulkSendLog" ON public."BulkSendLog"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- STEP 2: CustomerGroup RLS
-- =============================================

-- RLS'i etkinleştir
ALTER TABLE public."CustomerGroup" ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY "Tenant isolation - CustomerGroup" ON public."CustomerGroup"
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- Service role bypass
CREATE POLICY "Service role bypass - CustomerGroup" ON public."CustomerGroup"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- STEP 3: CustomerGroupMember RLS
-- =============================================

-- RLS'i etkinleştir
ALTER TABLE public."CustomerGroupMember" ENABLE ROW LEVEL SECURITY;

-- CustomerGroupMember için tenant kontrolü yapmak için
-- parent group'un tenantId'sine bakmalıyız
CREATE POLICY "Tenant isolation - CustomerGroupMember" ON public."CustomerGroupMember"
  FOR ALL TO authenticated
  USING (
    "groupId" IN (
      SELECT id FROM public."CustomerGroup"
      WHERE "tenantId" = public.get_user_tenant_id()
    )
  )
  WITH CHECK (
    "groupId" IN (
      SELECT id FROM public."CustomerGroup"
      WHERE "tenantId" = public.get_user_tenant_id()
    )
  );

-- Service role bypass
CREATE POLICY "Service role bypass - CustomerGroupMember" ON public."CustomerGroupMember"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- VERIFICATION
-- =============================================
-- Aşağıdaki sorguları çalıştırarak RLS policy'lerini doğrulayın:
--
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename IN ('BulkSendLog', 'CustomerGroup', 'CustomerGroupMember')
-- ORDER BY tablename, policyname;
