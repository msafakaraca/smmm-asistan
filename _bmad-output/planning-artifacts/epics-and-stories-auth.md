---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd-auth-system.md'
  - '_bmad-output/planning-artifacts/architecture-auth.md'
  - '_bmad-output/planning-artifacts/auth-master-execution-plan.md'
  - 'docs/data-models.md'
---

# Auth Sistemi — Epic & Story Breakdown

## Overview

Bu doküman, Auth Sistemi PRD'si (FR1-FR39) ve Mimari Kararlar dokümanından türetilen epic ve story'leri içerir. Brownfield bir projede (mevcut SMMM-AI kod tabanı) auth sisteminin Supabase Auth merkezli yapıya dönüştürülmesini kapsar.

## Requirements Inventory

### Functional Requirements

- FR1: Kullanıcı, email adresi ve şifre ile yeni hesap oluşturabilir
- FR2: Kullanıcı, Google hesabı ile yeni hesap oluşturabilir
- FR3: Google ile kayıt olan kullanıcı, platform şifresi belirleyebilir
- FR4: Kayıt sırasında kullanıcı, ofis adı ve ad-soyad bilgilerini girebilir
- FR5: Kayıt sırasında kullanıcı için otomatik olarak bir tenant oluşturulur
- FR6: Şifre belirleme sırasında sistem, minimum güvenlik kurallarını uygular (min 8 karakter)
- FR7: Sistem, aynı email adresiyle mükerrer kayıt oluşturulmasını engeller
- FR8: Kayıt sonrası sistem, kullanıcının email adresine doğrulama linki gönderir
- FR9: Kullanıcı, email doğrulamasını tamamlamadan korumalı sayfalara erişemez
- FR10: Kullanıcı, doğrulama emailinin tekrar gönderilmesini talep edebilir
- FR11: Kullanıcı, doğrulama linkine tıklayarak email adresini onaylayabilir
- FR12: Doğrulama tamamlandığında kullanıcı otomatik olarak dashboard'a yönlendirilir
- FR13: Kullanıcı, email ve şifre ile giriş yapabilir
- FR14: Kullanıcı, Google hesabı ile giriş yapabilir
- FR15: Sistem, başarılı giriş sonrası kullanıcıyı dashboard'a yönlendirir
- FR16: Kullanıcı, oturumunu sonlandırabilir
- FR17: Sistem, oturum bilgilerini güvenli çerezlerde saklar
- FR18: Doğrulanmamış kullanıcılar korumalı sayfalara erişmeye çalışırsa giriş sayfasına yönlendirilir
- FR19: Kullanıcı, giriş sayfasından şifre sıfırlama akışını başlatabilir
- FR20: Sistem, şifre sıfırlama linki içeren email gönderir
- FR21: Kullanıcı, sıfırlama linkiyle yeni şifre belirleyebilir
- FR22: Şifre güncellendikten sonra kullanıcı giriş sayfasına yönlendirilir
- FR23: Sistem, ardışık başarısız giriş denemelerinde geçici erişim kısıtlaması uygular
- FR24: Sistem, tüm giriş ve çıkış denemelerini loglar
- FR25: Her API isteğinde oturum geçerliliği ve tenant yetkisi doğrulanır
- FR26: Bir tenant'ın verileri başka tenant'lar tarafından erişilemez
- FR27: Kayıt formunda kullanıcı, KVKK Aydınlatma Metni'ni okuduğunu ayrı onay kutusuyla belirtir
- FR28: Onay kutusu önceden işaretli olmadan sunulur
- FR29: KVKK Aydınlatma Metni'ne kayıt formundan erişilebilir
- FR30: Gizlilik Politikası sayfası tüm sayfalardan erişilebilir
- FR31: Çerez Politikası sayfası tüm sayfalardan erişilebilir
- FR32: Kullanıcının KVKK onay tarihi ve versiyonu kayıt altına alınır
- FR33: Tüm auth hata mesajları Türkçe ve anlaşılır
- FR34: Geçersiz email/şifre durumunda bilgilendirici mesaj gösterilir
- FR35: Email doğrulama bekleme ekranında süreç hakkında bilgi verilir
- FR36: Şifre sıfırlama email gönderiminden sonra onay mesajı gösterilir
- FR37: NextAuth kalıntıları (dead code) temizlenir
- FR38: Kırık kayıt akışı Supabase Auth merkezli yapıya dönüştürülür
- FR39: Auth callback route, OAuth ve email doğrulama redirect'lerini yönetir

### NonFunctional Requirements

- NFR1: Auth API yanıt süresi < 500ms (p95)
- NFR2: Google OAuth toplam akış < 3 saniye
- NFR3: Email doğrulama linki teslimi < 30 saniye
- NFR4: Dashboard yönlendirme (giriş sonrası) < 2 saniye
- NFR5: Client-side form validation < 100ms
- NFR6: Auth sayfaları LCP < 2 saniye
- NFR7: HTTPS/TLS zorunlu — tüm iletişim şifreli
- NFR8: Şifreler Supabase bcrypt ile hash'lenir
- NFR9: Oturum çerezleri: HttpOnly, Secure, SameSite=Lax
- NFR10: Rate limiting: 5 başarısız giriş → 15 dakika kilitleme
- NFR11: Auth token'lar yalnızca HttpOnly cookie'de — localStorage yasak
- NFR12: Google OAuth: PKCE flow
- NFR13: Auth sistemi %99.5 uptime
- NFR14: Auth formları klavye ile kullanılabilir (Tab, Enter, Escape)
- NFR15: Hata mesajları görsel + metin (yalnızca renk bağımlı değil)
- NFR16: Renk kontrastı WCAG 2.1 AA (min 4.5:1)

### Additional Requirements (Architecture)

- AR1: Brownfield temizlik: NextAuth kalıntıları silinecek, auth dosyaları konsolide edilecek
- AR2: Schema migration: user_profiles.hashedPassword kaldır, kvkkConsentAt/kvkkConsentVersion ekle
- AR3: Server Action orkestrasyonu: signUp → tenant oluştur → user_profiles oluştur (ADR-AUTH-001)
- AR4: Google OAuth: PKCE + post-OAuth şifre belirleme (ADR-AUTH-002)
- AR5: Email doğrulama: Middleware'de zorlama (ADR-AUTH-003)
- AR6: Tek auth/callback route: OAuth + email doğrulama + şifre sıfırlama (ADR-AUTH-004)
- AR7: Auth rate limiting: Endpoint-bazlı Upstash genişletme (ADR-AUTH-005)
- AR8: auth-supabase.ts tek kaynak, auth.ts silinecek
- AR9: Supabase Dashboard: Google OAuth provider, Türkçe email templates, redirect URLs
- AR10: NEXT_PUBLIC_APP_URL environment variable eklenmeli

### FR Coverage Map

| FR | Epic | Story |
|----|------|-------|
| FR37, FR38 | E1 | S1 |
| AR1, AR2, AR8 | E1 | S1 |
| FR39, AR6 | E1 | S2 |
| FR9, FR18, AR5 | E1 | S2 |
| FR1, FR4, FR5, FR6, FR7 | E2 | S1 |
| AR3 | E2 | S1 |
| FR27, FR28, FR29, FR32 | E2 | S2 |
| FR13, FR15, FR16, FR17 | E3 | S1 |
| FR19, FR20, FR21, FR22 | E3 | S2 |
| FR34, FR33, FR36 | E3 | S1, S2 |
| FR2, FR3, FR14 | E4 | S1 |
| AR4, AR9 | E4 | S1 |
| FR8, FR10, FR11, FR12, FR35 | E5 | S1 |
| FR30, FR31 | E6 | S1 |
| FR23, FR24, AR7 | E7 | S1 |
| FR25, FR26 | Mevcut (API Guard) | — |
| NFR1-NFR16 | E7 | S2 |

## Epic List

| Epic | Başlık | Story Sayısı | Bağımlılık |
|------|--------|-------------|------------|
| E1 | Altyapı & Brownfield Temizlik | 2 | — |
| E2 | Email/Şifre Kayıt Akışı | 2 | E1 |
| E3 | Giriş & Şifre Kurtarma | 2 | E1 |
| E4 | Google OAuth Entegrasyonu | 1 | E1, E2 |
| E5 | Email Doğrulama Akışı | 1 | E1, E2 |
| E6 | KVKK Uyumluluk Sayfaları | 1 | — |
| E7 | Güvenlik & Polish | 2 | E1-E6 |

---

## Epic 1: Altyapı & Brownfield Temizlik

**Hedef:** Kırık auth altyapısını temizle, dead code'u kaldır, yeni auth akışları için temel altyapıyı kur. Bu epic'teki story'ler diğer tüm epic'lerin ön koşuludur.

### Story 1.1: NextAuth Kalıntılarını Temizle ve Auth Dosyalarını Konsolide Et

As a **geliştirici**,
I want **NextAuth kalıntılarını temizlemek ve auth dosyalarını tek kaynakta toplamak**,
So that **kod tabanı tutarlı olsun ve yeni auth akışları sağlam bir temel üzerine inşa edilsin**.

**Acceptance Criteria:**

**Given** mevcut kod tabanında NextAuth kalıntıları var
**When** temizlik işlemi tamamlandığında
**Then** `src/app/api/auth/[...nextauth]/route.ts` dosyası silinmiş olmalı
**And** `src/lib/actions/auth.ts` dosyası silinmiş olmalı (duplicate)
**And** `src/lib/actions/auth-supabase.ts` tek auth action kaynağı olmalı
**And** `src/components/auth/login-form.tsx` içindeki NextAuth yorumları temizlenmiş olmalı
**And** Prisma schema'da `user_profiles.hashedPassword` alanı kaldırılmış olmalı
**And** `user_profiles.kvkkConsentAt` (DateTime?) alanı eklenmiş olmalı
**And** `user_profiles.kvkkConsentVersion` (String?) alanı eklenmiş olmalı
**And** `npm run db:push` başarıyla çalışmalı
**And** `npm run type-check` hata vermemeli
**And** `NEXT_PUBLIC_APP_URL` environment variable tanımlanmalı

**Teknik Görevler:**
1. `src/app/api/auth/[...nextauth]/route.ts` sil
2. `src/lib/actions/auth.ts` sil
3. `login-form.tsx` içindeki NextAuth referanslarını temizle
4. `auth-supabase.ts`'i `loginAction` için import eden yerleri güncelle
5. `prisma/schema.prisma`'da `hashedPassword` kaldır, KVKK alanları ekle
6. `npm run db:push` ile migration uygula
7. `.env.example`'a `NEXT_PUBLIC_APP_URL` ekle
8. Type-check ile doğrula

### Story 1.2: Auth Callback Route ve Middleware Email Doğrulama Güncellemesi

As a **kullanıcı**,
I want **OAuth, email doğrulama ve şifre sıfırlama callback'lerinin tek noktadan yönetilmesini**,
So that **tüm auth redirect'leri güvenilir şekilde çalışsın**.

**Acceptance Criteria:**

**Given** bir auth callback isteği geldiğinde (`/auth/callback?code=...`)
**When** `code` parametresi mevcutsa
**Then** `exchangeCodeForSession()` çağrılmalı
**And** `type` parametresine göre doğru sayfaya yönlendirmeli:
  - `signup` → `/auth/verify-email`
  - `recovery` → `/auth/reset-password`
  - `email` (doğrulama) → `/dashboard`
  - OAuth (type yok, user_profiles kontrol) → profile varsa `/dashboard`, yoksa `/auth/set-password`

**Given** kullanıcı oturum açmış ama email doğrulanmamış
**When** dashboard'a erişmeye çalıştığında
**Then** middleware `/auth/verify-email` sayfasına yönlendirmeli
**And** `/auth/verify-email`, `/auth/callback`, `/api/auth/*`, KVKK sayfaları middleware'den muaf olmalı

**Teknik Görevler:**
1. `src/app/auth/callback/route.ts` oluştur (GET handler)
2. `src/middleware.ts`'e email doğrulama kontrolü ekle
3. Middleware matcher'a yeni route'ları ekle
4. İstisna listesini (verify-email, callback, KVKK sayfaları) tanımla

---

## Epic 2: Email/Şifre Kayıt Akışı

**Hedef:** Kırık kayıt akışını Supabase Auth merkezli olarak yeniden yaz. Kullanıcı email/şifre ile kayıt olabilmeli, tenant otomatik oluşturulmalı, KVKK onayı alınmalı.

### Story 2.1: Supabase Auth ile Email/Şifre Kayıt

As a **mali müşavir (SMMM)**,
I want **email ve şifremle yeni hesap oluşturabilmek**,
So that **platformu kullanmaya başlayabileyim**.

**Acceptance Criteria:**

**Given** kullanıcı `/register` sayfasındayken
**When** ofis adı, ad-soyad, email ve şifre (min 8 karakter) girip formu gönderdiğinde
**Then** Supabase Auth'da yeni kullanıcı oluşturulmalı (`supabase.auth.signUp()`)
**And** yeni `tenants` kaydı oluşturulmalı (ofis adı, slug, plan: "trial")
**And** yeni `user_profiles` kaydı oluşturulmalı (role: "owner", tenantId bağlı)
**And** email doğrulama linki gönderilmeli
**And** kullanıcı `/auth/verify-email` sayfasına yönlendirilmeli

**Given** zaten kayıtlı bir email adresi girildiğinde
**When** form gönderildiğinde
**Then** "Bu email adresi zaten kullanılıyor" hatası gösterilmeli

**Given** şifre 8 karakterden kısa girildiğinde
**When** form gönderildiğinde
**Then** "Şifre en az 8 karakter olmalıdır" hatası gösterilmeli

**Teknik Görevler:**
1. `auth-supabase.ts`'e `registerAction()` ekle (signUp + tenant + profile oluşturma)
2. `register-form.tsx`'i yeniden yaz (Server Action çağrısı, Zod validation güncelle)
3. `src/app/api/auth/register/route.ts`'i sil (eski kırık API)
4. Zod schema: ofis adı (min 2), ad-soyad (min 2), email, şifre (min 8)
5. Hata durumunda rollback: auth kullanıcısını sil

### Story 2.2: KVKK Onay Kutusu ve Kayıt Entegrasyonu

As a **mali müşavir**,
I want **KVKK aydınlatma metnini okuyup onayladıktan sonra kayıt olabilmek**,
So that **yasal gereksinimlere uygun şekilde hesap oluşturulmuş olsun**.

**Acceptance Criteria:**

**Given** kullanıcı kayıt formundayken
**When** form yüklendiğinde
**Then** "KVKK Aydınlatma Metni'ni okudum ve anladım" checkbox'ı görünür olmalı
**And** checkbox önceden işaretli OLMAMALI
**And** "KVKK Aydınlatma Metni" metni tıklanabilir link olmalı → `/kvkk-aydinlatma-metni`

**Given** KVKK checkbox işaretlenmeden form gönderildiğinde
**When** submit tıklandığında
**Then** "KVKK aydınlatma metni onayı gereklidir" hatası gösterilmeli
**And** form gönderilmemeli

**Given** KVKK checkbox işaretlenip form başarıyla gönderildiğinde
**When** kayıt tamamlandığında
**Then** `user_profiles.kvkkConsentAt` alanı kaydedilmeli (timestamp)
**And** `user_profiles.kvkkConsentVersion` alanı kaydedilmeli ("v1.0")

**Teknik Görevler:**
1. `register-form.tsx`'e KVKK checkbox ekle (önceden işaretli OLMAYAN)
2. Zod schema'ya `kvkkConsent: z.literal(true)` ekle
3. `registerAction`'a KVKK verilerini (tarih, versiyon) kaydet
4. Link: `/kvkk-aydinlatma-metni` rotasına yönlendirme

---

## Epic 3: Giriş & Şifre Kurtarma

**Hedef:** Email/şifre giriş akışını düzelt ve şifremi unuttum akışını oluştur.

### Story 3.1: Email/Şifre Giriş Akışını Güncelle

As a **mali müşavir**,
I want **email ve şifremle giriş yapabilmek**,
So that **platformdaki verilerime erişebileyim**.

**Acceptance Criteria:**

**Given** kullanıcı `/login` sayfasındayken
**When** doğru email ve şifre girip gönderdiğinde
**Then** `supabase.auth.signInWithPassword()` çağrılmalı
**And** başarılı giriş sonrası `/dashboard`'a yönlendirilmeli
**And** "Giriş başarılı!" toast mesajı gösterilmeli

**Given** yanlış email veya şifre girildiğinde
**When** form gönderildiğinde
**Then** "Email veya şifre hatalı" hatası gösterilmeli

**Given** kullanıcı giriş sayfasındayken
**When** sayfa yüklendiğinde
**Then** "Şifrenizi mi Unuttunuz?" linki görünür olmalı → şifre sıfırlama akışına yönlendirmeli
**And** "Google ile Giriş Yap" butonu görünür olmalı (E4 bağımlılığı, placeholder olabilir)

**Given** kullanıcı çıkış yaptığında
**When** "Çıkış Yap" tıklandığında
**Then** `supabase.auth.signOut()` çağrılmalı
**And** `/login` sayfasına yönlendirilmeli

**Teknik Görevler:**
1. `login-form.tsx`'i güncelle: `auth-supabase.ts`'teki `loginAction` kullan
2. "Şifrenizi mi Unuttunuz?" linki ekle
3. Google OAuth butonu placeholder ekle (E4'te aktif olacak)
4. NextAuth yorum kalıntılarını temizle (E1'de yapıldıysa skip)

### Story 3.2: Şifremi Unuttum & Şifre Sıfırlama Akışı

As a **mali müşavir**,
I want **şifremi unuttuğumda sıfırlayabilmek**,
So that **hesabıma tekrar erişebileyim**.

**Acceptance Criteria:**

**Given** kullanıcı "Şifrenizi mi Unuttunuz?" linkine tıkladığında
**When** email adresini girip "Şifre Sıfırlama Linki Gönder" butonuna bastığında
**Then** `supabase.auth.resetPasswordForEmail()` çağrılmalı
**And** "Şifre sıfırlama linki email adresinize gönderildi" mesajı gösterilmeli
**And** email gönderimi başarısız olsa bile aynı mesaj gösterilmeli (güvenlik)

**Given** kullanıcı sıfırlama emailindeki linke tıkladığında
**When** `/auth/callback?type=recovery` üzerinden yönlendirildiğinde
**Then** `/auth/reset-password` sayfasına yönlendirilmeli
**And** yeni şifre ve şifre tekrar alanları gösterilmeli

**Given** kullanıcı yeni şifresini girdiğinde
**When** yeni şifre (min 8 karakter) ve şifre tekrar eşleşiyorsa
**Then** `supabase.auth.updateUser({ password })` çağrılmalı
**And** "Şifreniz güncellendi" mesajı gösterilmeli
**And** `/login` sayfasına yönlendirilmeli

**Teknik Görevler:**
1. Login sayfasına "Şifremi Unuttum" modal/sayfa ekle (inline form veya ayrı sayfa)
2. `src/app/auth/reset-password/page.tsx` oluştur
3. `src/components/auth/reset-password-form.tsx` oluştur
4. `auth-supabase.ts`'teki mevcut `resetPasswordAction` ve `updatePasswordAction` kullan
5. Zod schema: yeni şifre (min 8) + şifre tekrar eşleşme

---

## Epic 4: Google OAuth Entegrasyonu

**Hedef:** Google hesabı ile kayıt ve giriş akışını oluştur. OAuth sonrası platform şifresi belirleme.

### Story 4.1: Google OAuth Kayıt & Giriş

As a **mali müşavir**,
I want **Google hesabımla kayıt olup giriş yapabilmek**,
So that **hızlıca platforma erişebileyim**.

**Acceptance Criteria:**

**Given** kullanıcı `/register` sayfasında "Google ile Kayıt Ol" butonuna tıkladığında
**When** Google hesabını seçip onay verdiğinde
**Then** `/auth/callback` route'una yönlendirilmeli
**And** session oluşturulmalı
**And** `user_profiles` kontrol edilmeli:
  - Profil yoksa → `/auth/set-password` sayfasına yönlendir
  - Profil varsa → `/dashboard`'a yönlendir

**Given** kullanıcı `/auth/set-password` sayfasındayken
**When** platform şifresi (min 8 karakter) ve ofis adı girip gönderdiğinde
**Then** `supabase.auth.updateUser({ password })` ile şifre eklenmeli
**And** yeni tenant ve user_profiles oluşturulmalı
**And** KVKK onayı kaydedilmeli (checkbox zorunlu)
**And** `/auth/verify-email` veya `/dashboard`'a yönlendirilmeli (Google email zaten doğrulanmış ise direkt dashboard)

**Given** kullanıcı `/login` sayfasında "Google ile Giriş Yap" butonuna tıkladığında
**When** Google hesabını seçtiğinde
**Then** `supabase.auth.signInWithOAuth({ provider: 'google' })` çağrılmalı
**And** mevcut kullanıcı ise → `/dashboard`'a yönlendirilmeli

**Teknik Görevler:**
1. `src/components/auth/oauth-button.tsx` oluştur (Google butonu)
2. `src/app/auth/set-password/page.tsx` oluştur
3. `src/components/auth/set-password-form.tsx` oluştur (şifre + ofis adı + KVKK)
4. `auth-supabase.ts`'e `completeOAuthRegistration()` action ekle
5. `register-form.tsx` ve `login-form.tsx`'e OAuth butonu ekle
6. `auth/callback/route.ts`'e OAuth flow handling ekle
7. Supabase Dashboard'da Google OAuth provider yapılandır (GCP client ID/secret)

---

## Epic 5: Email Doğrulama Akışı

**Hedef:** Zorunlu email doğrulama bekleme sayfası ve tekrar gönderme.

### Story 5.1: Email Doğrulama Bekleme Sayfası

As a **yeni kayıt olan kullanıcı**,
I want **email doğrulama sürecini takip edebilmek ve gerekirse tekrar gönderim isteyebilmek**,
So that **hesabımı aktifleştirip platforma erişebileyim**.

**Acceptance Criteria:**

**Given** kullanıcı kayıt sonrası `/auth/verify-email` sayfasına yönlendirildiğinde
**When** sayfa yüklendiğinde
**Then** "Email adresinize doğrulama linki gönderildi" bilgi mesajı gösterilmeli
**And** kayıtlı email adresi (kısmen maskelenmiş) gösterilmeli
**And** "Tekrar Gönder" butonu görünür olmalı
**And** "Farklı email ile kayıt ol" linki bulunmalı

**Given** kullanıcı "Tekrar Gönder" butonuna tıkladığında
**When** son gönderimden 60 saniye geçmişse
**Then** doğrulama emaili tekrar gönderilmeli
**And** "Doğrulama emaili tekrar gönderildi" mesajı gösterilmeli

**Given** kullanıcı doğrulama linkine tıkladığında
**When** `/auth/callback` üzerinden email doğrulandığında
**Then** kullanıcı otomatik olarak `/dashboard`'a yönlendirilmeli

**Teknik Görevler:**
1. `src/app/auth/verify-email/page.tsx` oluştur
2. `src/components/auth/verify-email-card.tsx` oluştur
3. `auth-supabase.ts`'e `resendVerificationEmail()` action ekle
4. 60 saniye cooldown mekanizması (client-side timer)
5. Middleware'den muaf olarak işaretlenmiş olduğunu doğrula (E1.S2'de yapıldı)

---

## Epic 6: KVKK Uyumluluk Sayfaları

**Hedef:** Yasal gereklilik olan KVKK aydınlatma metni, gizlilik politikası ve çerez politikası sayfalarını oluştur. Footer'a linkler ekle.

### Story 6.1: KVKK Sayfaları ve Footer Linkleri

As a **platform kullanıcısı**,
I want **KVKK aydınlatma metni, gizlilik politikası ve çerez politikasına erişebilmek**,
So that **kişisel verilerimin nasıl işlendiğini bilip yasal haklarımı kullanabileyim**.

**Acceptance Criteria:**

**Given** kullanıcı `/kvkk-aydinlatma-metni` rotasına gittiğinde
**When** sayfa yüklendiğinde
**Then** KVKK aydınlatma metni gösterilmeli (veri sorumlusu, amaç, aktarım, haklar)
**And** auth gerekmeden erişilebilir olmalı

**Given** kullanıcı `/gizlilik-politikasi` rotasına gittiğinde
**When** sayfa yüklendiğinde
**Then** gizlilik politikası gösterilmeli
**And** auth gerekmeden erişilebilir olmalı

**Given** kullanıcı `/cerez-politikasi` rotasına gittiğinde
**When** sayfa yüklendiğinde
**Then** çerez politikası gösterilmeli (zorunlu çerezler, analitik)
**And** auth gerekmeden erişilebilir olmalı

**Given** herhangi bir sayfa yüklendiğinde
**When** footer görüntülendiğinde
**Then** "Gizlilik Politikası" ve "Çerez Politikası" linkleri bulunmalı

**Teknik Görevler:**
1. `src/app/kvkk-aydinlatma-metni/page.tsx` oluştur (statik içerik)
2. `src/app/gizlilik-politikasi/page.tsx` oluştur (statik içerik)
3. `src/app/cerez-politikasi/page.tsx` oluştur (statik içerik)
4. Footer component'ine gizlilik ve çerez politikası linkleri ekle
5. Middleware'de bu rotaları auth kontrolünden muaf tut
6. İçerikler placeholder olarak Türkçe yazılacak (gerçek hukuki metin sonra eklenebilir)

---

## Epic 7: Güvenlik & Polish

**Hedef:** Auth rate limiting'i genişlet, hata mesajlarını standardize et, erişilebilirlik kontrollerini yap.

### Story 7.1: Auth Rate Limiting Genişletme

As a **sistem yöneticisi**,
I want **auth endpoint'lerine özel rate limiting uygulamak**,
So that **brute force saldırıları ve spam kayıtlar engellensin**.

**Acceptance Criteria:**

**Given** bir kullanıcı 5 başarısız giriş denemesi yaptığında
**When** 6. denemeyi yaptığında
**Then** "Çok fazla deneme yaptınız. Lütfen 15 dakika bekleyin" mesajı gösterilmeli
**And** 15 dakika boyunca giriş denemeleri engellenmeli

**Given** kayıt endpoint'ine 3'ten fazla istek geldiğinde (15 dk içinde)
**When** 4. istek geldiğinde
**Then** 429 Too Many Requests yanıtı dönmeli

**Given** şifre sıfırlama endpoint'ine 3'ten fazla istek geldiğinde (60 dk içinde)
**When** 4. istek geldiğinde
**Then** 429 Too Many Requests yanıtı dönmeli

**Teknik Görevler:**
1. `src/lib/ratelimit.ts`'e auth-specific rate limit konfigürasyonu ekle
2. Middleware'de auth rotaları için özel limitleri uygula
3. Rate limit aşıldığında Türkçe hata mesajı döndür

### Story 7.2: Hata Mesajları Standardizasyonu ve Erişilebilirlik

As a **platform kullanıcısı**,
I want **tüm auth hatalarının Türkçe ve anlaşılır olmasını**,
So that **bir sorun olduğunda ne yapmam gerektiğini anlayabileyim**.

**Acceptance Criteria:**

**Given** herhangi bir auth işleminde hata oluştuğunda
**When** hata mesajı gösterildiğinde
**Then** mesaj Türkçe olmalı
**And** Türkçe karakterler doğru kullanılmalı (ç, ğ, ı, ö, ş, ü)
**And** mesaj kullanıcının anlayacağı dilde olmalı (teknik terim yok)

**Given** auth formları yüklendiğinde
**When** klavye ile navigasyon yapıldığında
**Then** tüm form alanları Tab ile erişilebilir olmalı
**And** Enter ile form gönderilebilir olmalı
**And** Form alanlarında uygun `aria-label` ve `label` bulunmalı
**And** Hata mesajları `aria-live` ile duyurulmalı

**Teknik Görevler:**
1. Tüm auth action'lardaki hata mesajlarını Türkçe standardize et
2. Auth form component'lerine aria attribute'ları ekle
3. Hata gösterimlerini `aria-live="polite"` ile sarmalala
4. Renk kontrastı kontrolü (WCAG 2.1 AA)
5. Tüm akışları uçtan uca test et
