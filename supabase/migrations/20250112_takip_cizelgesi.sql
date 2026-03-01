-- Takip Çizelgesi Tabloları
-- Bu scripti Supabase SQL Editor'da çalıştırın

-- =====================================================
-- 1. TakipKolon Tablosu (Kolon Tanımları)
-- =====================================================
CREATE TABLE IF NOT EXISTS public."TakipKolon" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kod VARCHAR(50) NOT NULL,
    baslik VARCHAR(100) NOT NULL,
    tip VARCHAR(20) NOT NULL DEFAULT 'boolean',
    "siraNo" INTEGER NOT NULL DEFAULT 0,
    aktif BOOLEAN NOT NULL DEFAULT true,
    sistem BOOLEAN NOT NULL DEFAULT false,
    "tenantId" UUID NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "TakipKolon_tenantId_kod_key" UNIQUE ("tenantId", kod)
);

-- Index'ler
CREATE INDEX IF NOT EXISTS "TakipKolon_tenantId_idx" ON public."TakipKolon"("tenantId");
CREATE INDEX IF NOT EXISTS "TakipKolon_tenantId_aktif_idx" ON public."TakipKolon"("tenantId", aktif);

-- =====================================================
-- 2. TakipSatir Tablosu (Satır Verileri)
-- =====================================================
CREATE TABLE IF NOT EXISTS public."TakipSatir" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no VARCHAR(20) NOT NULL DEFAULT '',
    isim VARCHAR(255) NOT NULL DEFAULT '',
    "siraNo" INTEGER NOT NULL DEFAULT 0,
    degerler JSONB NOT NULL DEFAULT '{}',
    year INTEGER,
    month INTEGER,
    "tenantId" UUID NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS "TakipSatir_tenantId_idx" ON public."TakipSatir"("tenantId");
CREATE INDEX IF NOT EXISTS "TakipSatir_tenantId_year_month_idx" ON public."TakipSatir"("tenantId", year, month);
CREATE INDEX IF NOT EXISTS "TakipSatir_siraNo_idx" ON public."TakipSatir"("siraNo");

-- =====================================================
-- 3. Updated_at Trigger'ları
-- =====================================================

-- Trigger fonksiyonu (eğer yoksa oluştur)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TakipKolon için trigger
DROP TRIGGER IF EXISTS "update_TakipKolon_updatedAt" ON public."TakipKolon";
CREATE TRIGGER "update_TakipKolon_updatedAt"
    BEFORE UPDATE ON public."TakipKolon"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- TakipSatir için trigger
DROP TRIGGER IF EXISTS "update_TakipSatir_updatedAt" ON public."TakipSatir";
CREATE TRIGGER "update_TakipSatir_updatedAt"
    BEFORE UPDATE ON public."TakipSatir"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 4. Row Level Security (RLS) Policies
-- =====================================================

-- RLS'yi etkinleştir
ALTER TABLE public."TakipKolon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TakipSatir" ENABLE ROW LEVEL SECURITY;

-- TakipKolon politikaları
DROP POLICY IF EXISTS "Tenant members can view their kolonlar" ON public."TakipKolon";
CREATE POLICY "Tenant members can view their kolonlar" ON public."TakipKolon"
    FOR SELECT
    USING (
        "tenantId" IN (
            SELECT "tenantId" FROM public.user_profiles
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant admins can insert kolonlar" ON public."TakipKolon";
CREATE POLICY "Tenant admins can insert kolonlar" ON public."TakipKolon"
    FOR INSERT
    WITH CHECK (
        "tenantId" IN (
            SELECT "tenantId" FROM public.user_profiles
            WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
        )
    );

DROP POLICY IF EXISTS "Tenant admins can update kolonlar" ON public."TakipKolon";
CREATE POLICY "Tenant admins can update kolonlar" ON public."TakipKolon"
    FOR UPDATE
    USING (
        "tenantId" IN (
            SELECT "tenantId" FROM public.user_profiles
            WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
        )
    );

DROP POLICY IF EXISTS "Tenant admins can delete kolonlar" ON public."TakipKolon";
CREATE POLICY "Tenant admins can delete kolonlar" ON public."TakipKolon"
    FOR DELETE
    USING (
        "tenantId" IN (
            SELECT "tenantId" FROM public.user_profiles
            WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
        )
    );

-- TakipSatir politikaları
DROP POLICY IF EXISTS "Tenant members can view their satirlar" ON public."TakipSatir";
CREATE POLICY "Tenant members can view their satirlar" ON public."TakipSatir"
    FOR SELECT
    USING (
        "tenantId" IN (
            SELECT "tenantId" FROM public.user_profiles
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant members can insert satirlar" ON public."TakipSatir";
CREATE POLICY "Tenant members can insert satirlar" ON public."TakipSatir"
    FOR INSERT
    WITH CHECK (
        "tenantId" IN (
            SELECT "tenantId" FROM public.user_profiles
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant members can update satirlar" ON public."TakipSatir";
CREATE POLICY "Tenant members can update satirlar" ON public."TakipSatir"
    FOR UPDATE
    USING (
        "tenantId" IN (
            SELECT "tenantId" FROM public.user_profiles
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant admins can delete satirlar" ON public."TakipSatir";
CREATE POLICY "Tenant admins can delete satirlar" ON public."TakipSatir"
    FOR DELETE
    USING (
        "tenantId" IN (
            SELECT "tenantId" FROM public.user_profiles
            WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
        )
    );

-- =====================================================
-- 5. Service Role için bypass (Prisma kullanımı için)
-- =====================================================
DROP POLICY IF EXISTS "Service role bypass for TakipKolon" ON public."TakipKolon";
CREATE POLICY "Service role bypass for TakipKolon" ON public."TakipKolon"
    FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role bypass for TakipSatir" ON public."TakipSatir";
CREATE POLICY "Service role bypass for TakipSatir" ON public."TakipSatir"
    FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- Tamamlandı!
-- =====================================================
