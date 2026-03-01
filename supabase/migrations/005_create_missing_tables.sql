-- =============================================
-- SMMM Asistan - Create Missing Tables
-- =============================================
-- Bu migration, Prisma schema'da tanımlı ancak
-- veritabanında henüz oluşturulmamış tabloları ekler.
-- =============================================

-- =============================================
-- STEP 1: BulkSendLog Tablosu
-- =============================================

CREATE TABLE IF NOT EXISTS public."BulkSendLog" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dosya bilgisi
  "documentId" UUID NOT NULL REFERENCES public."Document"(id) ON DELETE CASCADE,

  -- Musteri bilgisi
  "customerId" UUID NOT NULL REFERENCES public."Customer"(id) ON DELETE CASCADE,

  -- Mail gonderim durumu
  "mailSent" BOOLEAN NOT NULL DEFAULT false,
  "mailSentAt" TIMESTAMPTZ,
  "mailSentTo" TEXT,
  "mailError" TEXT,

  -- WhatsApp gonderim durumu
  "whatsappSent" BOOLEAN NOT NULL DEFAULT false,
  "whatsappSentAt" TIMESTAMPTZ,
  "whatsappSentTo" TEXT,
  "whatsappType" TEXT,
  "whatsappError" TEXT,

  -- SMS gonderim durumu
  "smsSent" BOOLEAN NOT NULL DEFAULT false,
  "smsSentAt" TIMESTAMPTZ,
  "smsSentTo" TEXT,
  "smsError" TEXT,

  -- Beyanname meta bilgileri
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  "beyannameTuru" TEXT NOT NULL,
  "dosyaTipi" TEXT NOT NULL,

  -- Gonderen kullanici
  "sentBy" UUID,

  -- Tenant relation
  "tenantId" UUID NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "BulkSendLog_documentId_tenantId_key" UNIQUE ("documentId", "tenantId")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "BulkSendLog_tenantId_idx" ON public."BulkSendLog"("tenantId");
CREATE INDEX IF NOT EXISTS "BulkSendLog_customerId_idx" ON public."BulkSendLog"("customerId");
CREATE INDEX IF NOT EXISTS "BulkSendLog_year_month_idx" ON public."BulkSendLog"(year, month);
CREATE INDEX IF NOT EXISTS "BulkSendLog_tenantId_year_month_idx" ON public."BulkSendLog"("tenantId", year, month);

-- Updated at trigger
CREATE TRIGGER "update_BulkSendLog_updatedAt"
  BEFORE UPDATE ON public."BulkSendLog"
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- STEP 2: CustomerGroup Tablosu
-- =============================================

CREATE TABLE IF NOT EXISTS public."CustomerGroup" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT,

  -- Sirket tipi filtresi (opsiyonel)
  "sirketTipiFilter" TEXT,

  -- Tenant relation
  "tenantId" UUID NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "CustomerGroup_tenantId_name_key" UNIQUE ("tenantId", name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS "CustomerGroup_tenantId_idx" ON public."CustomerGroup"("tenantId");

-- Updated at trigger
CREATE TRIGGER "update_CustomerGroup_updatedAt"
  BEFORE UPDATE ON public."CustomerGroup"
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Map to customer_groups
COMMENT ON TABLE public."CustomerGroup" IS '@map: customer_groups';

-- =============================================
-- STEP 3: CustomerGroupMember Tablosu
-- =============================================

CREATE TABLE IF NOT EXISTS public."CustomerGroupMember" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Group relation
  "groupId" UUID NOT NULL REFERENCES public."CustomerGroup"(id) ON DELETE CASCADE,

  -- Customer relation
  "customerId" UUID NOT NULL REFERENCES public."Customer"(id) ON DELETE CASCADE,

  -- Ekleme tarihi
  "addedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "CustomerGroupMember_groupId_customerId_key" UNIQUE ("groupId", "customerId")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "CustomerGroupMember_groupId_idx" ON public."CustomerGroupMember"("groupId");
CREATE INDEX IF NOT EXISTS "CustomerGroupMember_customerId_idx" ON public."CustomerGroupMember"("customerId");

-- Map to customer_group_members
COMMENT ON TABLE public."CustomerGroupMember" IS '@map: customer_group_members';

-- =============================================
-- VERIFICATION
-- =============================================
-- Tabloların oluştuğunu kontrol edin:
--
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('BulkSendLog', 'CustomerGroup', 'CustomerGroupMember')
-- ORDER BY table_name;
