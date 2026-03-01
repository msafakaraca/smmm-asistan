---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd-auth-system.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/auth-master-execution-plan.md'
  - 'docs/architecture-main.md'
  - 'docs/data-models.md'
  - 'docs/development-guide.md'
  - 'docs/project-overview.md'
  - 'docs/index.md'
workflowType: 'architecture'
project_name: 'smmm_asistan'
user_name: 'Safa'
date: '2026-02-09'
---

# Architecture Decision Document — Auth Sistemi

_Bu doküman, Auth sistemi için mimari kararları adım adım keşif yoluyla oluşturur. Her bölüm mimari karar sürecinde eklenir._

## Project Context Analysis

### Requirements Overview

**Fonksiyonel Gereksinimler:**
Auth sistemi PRD'si 39 fonksiyonel gereksinim (FR1-FR39) içermektedir. Bu gereksinimler 7 ana kategoriye ayrılır:

1. **Hesap Oluşturma (FR1-FR7):** Email/şifre ve Google OAuth ile kayıt, şifre belirleme, tenant oluşturma, mükerrer kayıt engelleme
2. **Email Doğrulama (FR8-FR12):** Zorunlu doğrulama, tekrar gönderme, doğrulama sonrası yönlendirme
3. **Oturum Yönetimi (FR13-FR18):** Giriş/çıkış, session cookies, doğrulanmamış kullanıcı yönlendirmesi
4. **Şifre Kurtarma (FR19-FR22):** Sıfırlama emaili, yeni şifre belirleme, giriş'e yönlendirme
5. **Güvenlik (FR23-FR26):** Rate limiting, audit log, tenant izolasyon, cross-tenant engelleme
6. **KVKK Uyumluluk (FR27-FR32):** Aydınlatma metni, onay kutusu, gizlilik politikası, çerez politikası, onay kaydı
7. **Hata Yönetimi ve Bakım (FR33-FR39):** Türkçe hata mesajları, dead code temizliği, auth callback

**Fonksiyonel Olmayan Gereksinimler:**

| NFR Kategorisi | Mimari Etkisi |
|----------------|---------------|
| **Performans** | Auth API < 500ms (p95), OAuth < 3s, LCP < 2s |
| **Güvenlik** | HTTPS, bcrypt hash, HttpOnly cookies, PKCE, CSRF, rate limiting |
| **Güvenilirlik** | %99.5 uptime (Supabase SLA), graceful degradation |
| **KVKK** | Aydınlatma yükümlülüğü, veri minimizasyonu, yurt dışı aktarım, kullanıcı hakları |
| **Erişilebilirlik** | WCAG 2.1 AA, klavye navigasyonu, ekran okuyucu desteği |

**Scale & Complexity:**

- Primary domain: Full-stack Multi-tenant SaaS (Brownfield)
- Complexity level: Yüksek
- Estimated architectural components: 8 ana bileşen grubu

### Technical Constraints & Dependencies

**Sabit Kısıtlamalar (Mevcut Stack):**
- Next.js 15 App Router + React 19
- Supabase Auth (SSR cookies, `@supabase/ssr`)
- Supabase PostgreSQL + Prisma 6.19 + RLS
- TypeScript strict mode
- TailwindCSS 4 + Radix UI

**Auth Altyapısı (Mevcut, Çalışıyor):**
- `src/middleware.ts` — SSR session refresh + Upstash rate limiting
- `src/lib/supabase/auth.ts` — `getUserWithProfile()` cache ile optimize
- `src/lib/supabase/server.ts` — SSR client + Admin client
- `src/lib/supabase/client.ts` — Browser client
- `src/lib/actions/auth-supabase.ts` — Doğru Supabase action'lar (kullanılmıyor)

**Brownfield Temizlik Gereksinimleri:**
- `src/app/api/auth/register/route.ts` — Kırık kayıt (Prisma-only, Supabase Auth yok) → yeniden yazılacak
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth stub → silinecek
- `src/components/auth/login-form.tsx` — NextAuth yorum kalıntıları → temizlenecek
- `src/lib/actions/auth.ts` — Duplicate loginAction → auth-supabase.ts'e konsolide
- `user_profiles.hashedPassword` alanı → kaldırılacak (Supabase Auth hash yönetiyor)

**Dış Bağımlılıklar:**
- Google Cloud Platform — OAuth 2.0 consent screen + client credentials
- Supabase SMTP — Doğrulama/sıfırlama emailleri (30/saat limit)
- Upstash Redis — Rate limiting (mevcut, çalışıyor)

### Cross-Cutting Concerns Identified

1. **Multi-tenant Isolation**
   - Etki: Kayıt akışında tenant oluşturma, tüm auth query'lerde tenantId filtresi
   - Mevcut çözüm: `getUserWithProfile()` → tenantId döndürüyor, her API guard'da kontrol
   - Auth etkisi: Yeni tenant + user_profiles oluşturma atomik olmalı

2. **KVKK Uyumluluk**
   - Etki: Kayıt formu (onay kutusu), 3 statik sayfa, onay kaydı
   - Cezai risk: 85K-17M TL aralığında para cezaları
   - Mimari etki: Yeni rotalar, veritabanında onay kaydı, footer bileşeni

3. **Güvenlik Katmanları (Defense-in-Depth)**
   - Mevcut: Middleware session → API Guard → RLS → Encryption
   - Eksik: Email doğrulama zorlaması, Google OAuth PKCE, auth audit log
   - Auth etkisi: Middleware'e email doğrulama kontrolü eklenmeli

4. **Session Yönetimi**
   - Mevcut: Supabase SSR cookies (HttpOnly, Secure, SameSite)
   - Durum: Middleware'de `getSession()` ile hızlı kontrol (API call yok)
   - Auth etkisi: OAuth callback'te session oluşturma, email doğrulama sonrası session

5. **Electron Bot Entegrasyonu**
   - Auth etkisi: `electron-login` route mevcut — WebSocket JWT token ile çalışıyor
   - Brownfield koruması: Bot auth akışı değiştirilmemeli

## Technology Stack Evaluation (Brownfield)

### Proje Durumu: Brownfield (Mevcut Kod Tabanı)

Bu proje mevcut bir kod tabanına sahiptir. Yeni starter template seçimi gerekli değildir — mevcut teknoloji stack'i auth sistemi güncellemesi için zaten uygundur.

### Mevcut Teknik Tercihler

**Dil & Runtime:**
- TypeScript 5.7 (strict mode) — sabit
- Node.js >= 20.x — sabit

**Framework:**
- Next.js 15 App Router — sabit
- React 19 — sabit

**Auth Altyapısı (Auth Sistemi İçin Kritik):**
- `@supabase/ssr` — SSR cookie management (mevcut, çalışıyor)
- `@supabase/supabase-js` — Auth API client (mevcut)
- Supabase Auth — email/password, OAuth providers desteği (mevcut ama eksik kullanılıyor)

**Styling:**
- TailwindCSS 4 — sabit
- Radix UI primitives — sabit
- CVA (Class Variance Authority) — sabit

**Form & Validation:**
- React Hook Form — sabit (auth formlarında zaten kullanılıyor)
- Zod — sabit (login/register schema'ları mevcut)

**Database:**
- Prisma 6.19 + Supabase PostgreSQL + RLS — sabit

**State Management:**
- SWR (server state) — sabit
- React Context (UI state) — sabit

**Rate Limiting:**
- Upstash Redis (`@upstash/ratelimit`) — mevcut, middleware'de aktif

### Auth Güncellemesi İçin Gerekli Yeni Bağımlılıklar

| Paket | Amaç | Durum |
|-------|-------|-------|
| `@supabase/ssr` | SSR cookie yönetimi | Mevcut |
| `@supabase/supabase-js` | Auth API | Mevcut |
| Google OAuth | GCP Console'da yapılandırma | Yeni (paket gerekmez, Supabase Dashboard'dan) |

**Ek paket gerekmez** — Supabase Auth, Google OAuth dahil tüm auth ihtiyaçlarını karşılar. Google OAuth, Supabase Dashboard'dan provider olarak eklenir; uygulamada `supabase.auth.signInWithOAuth({ provider: 'google' })` çağrısı yeterlidir.

### Mimari Kararlar (Mevcut Stack Tarafından Belirlenmiş)

**Kod Organizasyonu:**
- Next.js 15 App Router (route groups: `(auth)`, `(dashboard)`)
- Feature-based component organization
- Layered architecture (Presentation → API → Service → Data)

**Component Architecture:**
- Radix UI headless primitives
- Direct import (barrel yasak)
- Feature modules with co-located hooks/dialogs

**API Layer:**
- Next.js Route Handlers + Server Actions
- Auth guard pattern (`getUserWithProfile`)
- Tenant isolation her query'de

### Technology Constraints for Auth Development

**Zorunlu Kurallar:**
- Auth formları React Hook Form + Zod ile
- Yeni sayfalar App Router route groups içinde
- Server Actions `'use server'` ile
- KVKK sayfaları statik route olarak (`/kvkk-aydinlatma-metni`, `/gizlilik-politikasi`, `/cerez-politikasi`)
- Google OAuth callback'i `/auth/callback` route'unda

**Yasaklar:**
- Barrel exports (performans etkisi)
- Client-side auth kararları (server-first)
- `any` type kullanımı
- NextAuth veya başka auth kütüphanesi (Supabase Auth tek kaynak)

## Core Architectural Decisions

### Decision Priority Analysis

**Kritik Kararlar (Uygulamayı Bloklar):**
1. Tenant + user oluşturma stratejisi
2. Google OAuth akış tasarımı
3. Email doğrulama zorlama mekanizması
4. Auth callback route tasarımı

**Önemli Kararlar (Mimariyi Şekillendirir):**
5. Schema değişiklikleri (KVKK alanları, hashedPassword kaldırma)
6. Server Actions vs Route Handlers seçimi
7. Auth sayfa rotalama yapısı
8. Auth rate limiting konfigürasyonu

**Ertelenen Kararlar (Post-MVP):**
- MFA/2FA implementasyonu
- Oturum yönetimi UI (aktif oturumlar)
- Custom SMTP entegrasyonu
- Genişletilmiş RBAC (owner, accountant, assistant)
- Kullanıcı davet sistemi

### ADR-AUTH-001: Kayıt Sırasında Tenant + User Oluşturma

| Seçenek | Avantaj | Dezavantaj | Karar |
|---------|---------|------------|-------|
| A: Supabase Auth Trigger | Native, her method'da çalışır | Hata yönetimi zor, tenant karmaşık | ❌ |
| **B: Server Action Orkestrasyonu** | **Tam kontrol, kolay hata yönetimi** | **İki sistem arası tam transaction yok** | **✅ Seçildi** |
| C: Hibrit (Trigger + API) | OAuth sorunsuz | İki aşamalı UX karmaşık | ❌ |

**Akış:**
1. `supabase.auth.signUp()` → Supabase Auth kullanıcısı oluştur
2. Admin client ile `tenants` tablosuna yeni tenant oluştur
3. Admin client ile `user_profiles` tablosuna profil oluştur (role: "owner")
4. Hata durumunda: Auth kullanıcısını sil (rollback)

**Google OAuth İçin:**
1. `supabase.auth.signInWithOAuth({ provider: 'google' })` → Google'a yönlendir
2. `/auth/callback` route'unda `exchangeCodeForSession()` → session oluştur
3. `user_profiles` kontrol et → yoksa `/auth/set-password` sayfasına yönlendir
4. Şifre belirleme + tenant oluşturma → dashboard

### ADR-AUTH-002: Google OAuth Akış Tasarımı

| Seçenek | Avantaj | Dezavantaj | Karar |
|---------|---------|------------|-------|
| **A: OAuth + Şifre Belirleme** | **Kullanıcı Google dışında da giriş yapabilir** | **Ek adım** | **✅ Seçildi (PRD uyumlu)** |
| B: Şifresiz OAuth | Hızlı kayıt | Google kaybedilirse erişim yok | ❌ |

**PKCE Flow:**
- Supabase Auth native olarak PKCE destekliyor
- `signInWithOAuth()` çağrısı otomatik PKCE kullanır
- Ek konfigürasyon gerekmez

### ADR-AUTH-003: Email Doğrulama Zorlaması

| Seçenek | Avantaj | Dezavantaj | Karar |
|---------|---------|------------|-------|
| **A: Middleware'de Zorlama** | **Tek noktada kontrol, bypass edilemez** | **Middleware'e ek kontrol** | **✅ Seçildi** |
| B: API Guard'da Zorlama | API seviyesinde koruma | Her API'de kontrol gerekli | ❌ |

**Middleware Akışı:**
```
Request → Session var mı?
  ├─ Hayır → /login'e yönlendir
  └─ Evet → email_confirmed_at var mı?
       ├─ Hayır → /auth/verify-email'e yönlendir
       └─ Evet → İsteği geçir
```

**İstisnalar:** `/auth/verify-email`, `/auth/callback`, `/api/auth/*`, KVKK sayfaları middleware kontrolünden muaf.

### ADR-AUTH-004: Auth Callback Route

**Tek `/auth/callback` route'u tüm auth redirect'leri yönetir:**

```typescript
// src/app/auth/callback/route.ts
// Supabase code parametresi ile session oluşturma
// type parametresine göre yönlendirme:
//   - signup → /auth/verify-email
//   - recovery → /auth/reset-password
//   - oauth → user_profiles kontrol → set-password veya dashboard
//   - email_change → /dashboard (ayarlar)
```

### ADR-AUTH-005: Auth Rate Limiting

| Endpoint | Limit | Süre | Gerekçe |
|----------|-------|------|---------|
| Register | 3 istek | 15 dk | Spam kayıt engelleme |
| Login | 5 istek | 15 dk | Brute force koruması (PRD: FR23) |
| Password Reset | 3 istek | 60 dk | Email spam engelleme |
| Resend Verification | 3 istek | 15 dk | SMTP limit koruması (30/saat) |

Mevcut Upstash middleware'i genişletilecek, endpoint-bazlı limit konfigürasyonu.

### Data Architecture — Schema Değişiklikleri

**Kaldırılacak:**
- `user_profiles.hashedPassword` — Supabase Auth şifre yönetiyor
- `accounts` tablosu — NextAuth kalıntısı (varsa schema'da)

**Eklenecek:**
- `user_profiles.kvkkConsentAt` — DateTime? — KVKK onay tarihi
- `user_profiles.kvkkConsentVersion` — String? — Onaylanan metin versiyonu

**Korunacak:**
- `user_profiles.id` = Supabase Auth user.id (UUID eşleştirme)
- `user_profiles.tenantId` ilişkisi
- `user_profiles.role`, `permissions`, `status` alanları
- Tüm mevcut indeksler ve constraint'ler

### Authentication & Security

**Server Actions Konsolidasyonu:**
- `src/lib/actions/auth.ts` → **silinecek** (duplicate)
- `src/lib/actions/auth-supabase.ts` → **tek kaynak** (genişletilecek)
- Route Handlers: Sadece `electron-login` ve `token` için (bot entegrasyonu)

**Auth Hata Kodları (Standardize, Türkçe):**

| Hata Kodu | Kullanıcıya Gösterilen Mesaj |
|-----------|------|
| `auth/invalid-credentials` | Email veya şifre hatalı |
| `auth/email-exists` | Bu email adresi zaten kullanılıyor |
| `auth/weak-password` | Şifre en az 8 karakter olmalıdır |
| `auth/email-not-verified` | Email adresinizi doğrulamanız gerekiyor |
| `auth/rate-limited` | Çok fazla deneme yaptınız. Lütfen bekleyin |
| `auth/kvkk-required` | KVKK aydınlatma metni onayı gereklidir |

### Frontend Architecture — Sayfa Rotalama

```
src/app/
├── (auth)/                              # Auth layout (login/register)
│   ├── login/page.tsx                   # Giriş (GÜNCELLE)
│   ├── register/page.tsx                # Kayıt (GÜNCELLE)
│   └── layout.tsx                       # Auth layout (mevcut)
├── auth/                                # Auth utility sayfaları
│   ├── callback/route.ts               # OAuth + doğrulama callback (YENİ)
│   ├── verify-email/page.tsx           # Email doğrulama bekleme (YENİ)
│   ├── set-password/page.tsx           # OAuth sonrası şifre belirleme (YENİ)
│   └── reset-password/page.tsx         # Şifre sıfırlama (YENİ)
├── kvkk-aydinlatma-metni/page.tsx      # KVKK Aydınlatma (YENİ)
├── gizlilik-politikasi/page.tsx        # Gizlilik Politikası (YENİ)
└── cerez-politikasi/page.tsx           # Çerez Politikası (YENİ)
```

### Frontend Architecture — Component Yapısı

```
src/components/auth/
├── login-form.tsx          # GÜNCELLE (Google buton + şifremi unuttum)
├── register-form.tsx       # GÜNCELLE (KVKK checkbox + Google kayıt)
├── set-password-form.tsx   # YENİ (OAuth sonrası)
├── reset-password-form.tsx # YENİ
├── verify-email-card.tsx   # YENİ (bekleme + tekrar gönder)
└── oauth-button.tsx        # YENİ (Google ile Giriş/Kayıt)
```

### Infrastructure & Deployment

**Supabase Dashboard Yapılandırması:**
- Google OAuth Provider aktif (GCP client ID + secret)
- Email Templates: Türkçe özelleştirilmiş (doğrulama, sıfırlama)
- Redirect URLs: `localhost:3000/auth/callback`, `production-url/auth/callback`
- Email Rate Limit: 30/saat (Supabase default SMTP)

**Environment Variables (Yeni):**
- `NEXT_PUBLIC_APP_URL` — Callback redirect'ler için (localhost:3000 / production URL)

### Decision Impact Analysis

**Uygulama Sırası:**
1. Brownfield temizlik (NextAuth kalıntıları, duplicate dosyalar)
2. Schema değişiklikleri (Prisma migration)
3. Auth callback route + middleware güncelleme
4. Kayıt akışı (email/şifre + tenant oluşturma)
5. Giriş akışı güncelleme
6. Google OAuth entegrasyonu
7. Email doğrulama akışı
8. Şifre sıfırlama akışı
9. KVKK sayfaları
10. Rate limiting genişletme + güvenlik polish

**Cross-Component Bağımlılıklar:**
- Auth callback → hem OAuth hem email doğrulama için gerekli (önce yapılmalı)
- Middleware email doğrulama → verify-email sayfası hazır olmalı
- Register form KVKK checkbox → KVKK sayfaları hazır olmalı
- Server Actions konsolidasyonu → tüm form'lar güncellenecek
