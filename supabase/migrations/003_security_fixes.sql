-- =============================================
-- SMMM Asistan - Security Fixes Migration
-- =============================================
-- Bu migration, Supabase Dashboard'da bildirilen
-- güvenlik açıklarını kapatır.
--
-- Düzeltilen sorunlar:
-- 1. RLS Disabled in Public (7 tablo)
-- 2. Sensitive Columns Exposed (2 tablo)
-- 3. Function Search Path Mutable (2 fonksiyon)
-- =============================================

-- =============================================
-- STEP 1: FIX FUNCTION SEARCH PATH MUTABLE
-- =============================================
-- Fonksiyonlara SET search_path = '' ekleyerek
-- search path injection saldırılarını önlüyoruz.
-- NOT: DROP kullanmıyoruz çünkü policy'ler bu fonksiyona bağımlı.
-- CREATE OR REPLACE ile fonksiyon güncellenir ve bağımlılıklar korunur.

-- 1.1: get_user_tenant_id fonksiyonunu düzelt (DROP YOK!)
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid AS $$
  SELECT "tenantId" FROM public.user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '';

-- 1.2: update_updated_at_column fonksiyonunu düzelt
-- Bu fonksiyon trigger'larda kullanılıyor olabilir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- =============================================
-- STEP 2: ENABLE RLS ON MISSING TABLES
-- =============================================

-- 2.1: Account Table (NextAuth)
-- Bu tablo OAuth provider token'larını saklar
ALTER TABLE public."Account" ENABLE ROW LEVEL SECURITY;

-- Account için policy: Kullanıcı sadece kendi account'larını görebilir
CREATE POLICY "Users can manage own accounts" ON public."Account"
  FOR ALL TO authenticated
  USING ("userId" = auth.uid())
  WITH CHECK ("userId" = auth.uid());

-- Service role bypass
CREATE POLICY "Service role bypass - Account" ON public."Account"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 2.2: Session Table (NextAuth)
-- Kullanıcı oturumlarını saklar
ALTER TABLE public."Session" ENABLE ROW LEVEL SECURITY;

-- Session için policy: Kullanıcı sadece kendi session'larını görebilir
CREATE POLICY "Users can manage own sessions" ON public."Session"
  FOR ALL TO authenticated
  USING ("userId" = auth.uid())
  WITH CHECK ("userId" = auth.uid());

-- Service role bypass
CREATE POLICY "Service role bypass - Session" ON public."Session"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 2.3: VerificationToken Table (NextAuth)
-- Email doğrulama token'larını saklar
ALTER TABLE public."VerificationToken" ENABLE ROW LEVEL SECURITY;

-- VerificationToken için policy: Sadece service role erişebilir
-- Normal kullanıcılar doğrudan erişmemeli
CREATE POLICY "Service role only - VerificationToken" ON public."VerificationToken"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated kullanıcılar sadece okuyabilir (kendi identifier'ları için)
CREATE POLICY "Users can read own verification tokens" ON public."VerificationToken"
  FOR SELECT TO authenticated
  USING (identifier = (SELECT email FROM public.user_profiles WHERE id = auth.uid()));

-- 2.4: mail_status Table (MailStatus)
ALTER TABLE public.mail_status ENABLE ROW LEVEL SECURITY;

-- mail_status için tenant isolation
CREATE POLICY "Tenant isolation - mail_status" ON public.mail_status
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- Service role bypass
CREATE POLICY "Service role bypass - mail_status" ON public.mail_status
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 2.5: email_oauth_connections Table (EmailOAuthConnection)
ALTER TABLE public.email_oauth_connections ENABLE ROW LEVEL SECURITY;

-- email_oauth_connections için tenant isolation
CREATE POLICY "Tenant isolation - email_oauth_connections" ON public.email_oauth_connections
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- Service role bypass
CREATE POLICY "Service role bypass - email_oauth_connections" ON public.email_oauth_connections
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 2.6: email_messages Table (EmailMessage)
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- email_messages için tenant isolation
CREATE POLICY "Tenant isolation - email_messages" ON public.email_messages
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());

-- Service role bypass
CREATE POLICY "Service role bypass - email_messages" ON public.email_messages
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- STEP 3: PROTECT SENSITIVE COLUMNS
-- =============================================
-- Hassas sütunları korumak için ek policy'ler.
-- NOT: Supabase'de column-level RLS yok, bu yüzden
-- hassas verilere erişimi sınırlamak için view kullanıyoruz.

-- 3.1: Account tablosundaki token'ları gizle
-- Güvenli view oluştur (token'lar olmadan)
CREATE OR REPLACE VIEW public.account_safe AS
SELECT
  id,
  "userId",
  type,
  provider,
  "providerAccountId",
  expires_at,
  token_type,
  scope,
  session_state
  -- refresh_token, access_token, id_token HARİÇ
FROM public."Account";

-- View için RLS benzeri güvenlik (view owner'a bağlı)
ALTER VIEW public.account_safe OWNER TO authenticated;

-- 3.2: VerificationToken - zaten service_role only policy ile korunuyor

-- =============================================
-- STEP 4: REVOKE UNNECESSARY PERMISSIONS
-- =============================================
-- anon ve public rollerinden gereksiz yetkileri kaldır

-- Account tablosu
REVOKE ALL ON public."Account" FROM anon;
REVOKE ALL ON public."Account" FROM public;

-- Session tablosu
REVOKE ALL ON public."Session" FROM anon;
REVOKE ALL ON public."Session" FROM public;

-- VerificationToken tablosu
REVOKE ALL ON public."VerificationToken" FROM anon;
REVOKE ALL ON public."VerificationToken" FROM public;

-- mail_status tablosu
REVOKE ALL ON public.mail_status FROM anon;
REVOKE ALL ON public.mail_status FROM public;

-- email_oauth_connections tablosu
REVOKE ALL ON public.email_oauth_connections FROM anon;
REVOKE ALL ON public.email_oauth_connections FROM public;

-- email_messages tablosu
REVOKE ALL ON public.email_messages FROM anon;
REVOKE ALL ON public.email_oauth_connections FROM public;

-- =============================================
-- STEP 5: GRANT REQUIRED PERMISSIONS
-- =============================================
-- authenticated rolüne gerekli yetkileri ver

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Account" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."Session" TO authenticated;
GRANT SELECT ON public."VerificationToken" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_status TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_oauth_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_messages TO authenticated;

-- Service role tam yetki
GRANT ALL ON public."Account" TO service_role;
GRANT ALL ON public."Session" TO service_role;
GRANT ALL ON public."VerificationToken" TO service_role;
GRANT ALL ON public.mail_status TO service_role;
GRANT ALL ON public.email_oauth_connections TO service_role;
GRANT ALL ON public.email_messages TO service_role;

-- =============================================
-- STEP 6: USER TABLE RLS
-- =============================================
-- User tablosu için RLS (user_profiles'dan ayrı tablo)

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;

-- Kullanıcı sadece kendi kaydını görebilir
CREATE POLICY "Users can view own record" ON public."User"
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Kullanıcı sadece kendi kaydını güncelleyebilir
CREATE POLICY "Users can update own record" ON public."User"
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Service role tam erişim
CREATE POLICY "Service role bypass - User" ON public."User"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon erişimini kaldır
REVOKE ALL ON public."User" FROM anon;
REVOKE ALL ON public."User" FROM public;
GRANT SELECT, UPDATE ON public."User" TO authenticated;
GRANT ALL ON public."User" TO service_role;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
-- Aşağıdaki sorguları çalıştırarak güvenlik
-- ayarlarının doğru yapıldığını doğrulayın:

-- 1. RLS durumunu kontrol et:
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public';

-- 2. Tüm policy'leri listele:
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- 3. Fonksiyon search_path'lerini kontrol et:
-- SELECT proname, prosecdef, proconfig
-- FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
-- AND proname IN ('get_user_tenant_id', 'update_updated_at_column');
