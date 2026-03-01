---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - docs/index.md
  - docs/project-overview.md
  - docs/architecture-main.md
  - docs/data-models.md
  - docs/development-guide.md
  - docs/hattat-musavir-analiz.md
  - docs/hattat-musavir-analiz-v2.md
workflowType: 'architecture'
project_name: 'smmm_asistan'
user_name: 'Safa'
date: '2026-01-29'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
Bu proje SMMM (Serbest Muhasebeci Mali Müşavir) ofisleri için kapsamlı bir SaaS platformudur:

1. **Mükellef Yönetimi**
   - Müşteri CRUD işlemleri
   - Excel import/export
   - Grup/etiket sistemi
   - GİB/SGK credential yönetimi (şifrelenmiş)

2. **Beyanname Takibi**
   - Aylık beyanname durumları (KDV, SGK, Muhtasar, vb.)
   - JSON tabanlı esnek durum yapısı
   - "Bir önceki ay" iş kuralı

3. **Kontrol Çizelgeleri**
   - SGK hizmet/tahakkuk takibi
   - KDV/KDV2 beyanname takibi
   - Dinamik kolon sistemi
   - Toplu işlem (bulk operations)

4. **Dosya Yönetimi**
   - Hiyerarşik klasör yapısı
   - Supabase Storage entegrasyonu
   - Beyanname PDF'leri ile ilişkilendirme

5. **Bot Entegrasyonu**
   - GİB portalı otomasyon
   - TÜRMOB otomasyon
   - Electron + Puppeteer mimarisi
   - WebSocket ile real-time progress

6. **İletişim Modülü**
   - Gmail/Outlook OAuth bağlantıları
   - Toplu email/SMS/WhatsApp gönderimi
   - Zamanlanmış duyurular
   - Müşteri eşleştirme

7. **Görev Yönetimi**
   - Task oluşturma ve atama
   - Yorum ve ek dosya
   - Müşteriye bağlı görevler

**Non-Functional Requirements:**

| NFR | Uygulama |
|-----|----------|
| **Multi-tenancy** | Her query'de tenantId filtresi, unique constraint'ler |
| **Security** | AES-256-GCM encryption, Supabase RLS, JWT auth |
| **Performance** | Virtual scrolling, paralel fetch, direct import |
| **Real-time** | WebSocket server (port 3001) |
| **Accessibility** | Radix UI headless components |
| **Regulatory** | GİB, SGK Türkiye regülasyonları |

**Scale & Complexity:**

- Primary domain: Full-stack Multi-tenant SaaS + Desktop Bot
- Complexity level: Enterprise
- Estimated architectural components: 15+ major modules

### Technical Constraints & Dependencies

**Framework Constraints:**
- Next.js 15 App Router (pages değil)
- React 19 (concurrent features)
- TypeScript strict mode zorunlu
- Prisma 6.19+ (PostgreSQL)

**Infrastructure Constraints:**
- Supabase PostgreSQL (RLS aktif)
- Supabase Auth (cookie-based sessions)
- Supabase Storage (dosya depolama)
- WebSocket server (ayrı port)

**Security Constraints:**
- Tenant isolation her katmanda zorunlu
- Credential'lar şifrelenmiş saklanmalı
- API route'larda auth guard pattern

**Performance Constraints:**
- Barrel import YASAK
- 500+ satır için virtual scrolling zorunlu
- N+1 query pattern YASAK

### Cross-Cutting Concerns Identified

1. **Tenant Isolation**
   - Etki: Tüm modeller, API'ler, query'ler
   - Çözüm: `tenantId` filtresi + RLS

2. **Credential Encryption**
   - Etki: Customer, Tenant, EmailOAuth modelleri
   - Çözüm: AES-256-GCM (src/lib/crypto.ts)

3. **Real-time Updates**
   - Etki: Bot progress, batch results
   - Çözüm: WebSocket server + BotProvider context

4. **Domain Rules**
   - Etki: Tüm çizelge modülleri
   - Çözüm: "Bir önceki ay" varsayılan dönem

5. **PDF Processing**
   - Etki: GİB bot, dosya yönetimi
   - Çözüm: page.evaluate() + cookie session

### Architecture Decision Records (ADR)

| ADR | Karar | Gerekçe |
|-----|-------|---------|
| ADR-001 | Shared DB + tenantId + RLS | Maliyet/güvenlik optimal dengesi |
| ADR-002 | WebSocket bot iletişimi | Real-time progress zorunlu |
| ADR-003 | AES-256-GCM credential şifreleme | Bot decrypt ihtiyacı |
| ADR-004 | Desktop bot (Electron) | Kullanıcı IP'si ile GİB erişimi |

**ADR-001: Multi-tenant Stratejisi**

| Seçenek | Avantaj | Dezavantaj | Karar |
|---------|---------|------------|-------|
| Shared DB + tenantId | Basit, maliyet düşük | Veri sızıntısı riski | ✅ Seçildi |
| Schema-per-tenant | Güçlü izolasyon | Karmaşık migration | ❌ |
| DB-per-tenant | En güçlü izolasyon | Yüksek maliyet | ❌ |

**ADR-002: Bot İletişim Stratejisi**

| Seçenek | Avantaj | Dezavantaj | Karar |
|---------|---------|------------|-------|
| REST Polling | Basit | Gecikme, kaynak israfı | ❌ |
| WebSocket | Real-time | Bağlantı yönetimi | ✅ Seçildi |
| Server-Sent Events | Tek yönlü basit | Bidirectional yok | ❌ |

**ADR-003: Credential Depolama**

| Seçenek | Avantaj | Dezavantaj | Karar |
|---------|---------|------------|-------|
| Plain text | - | Güvenlik felaketi | ❌ |
| Hashing | Tek yönlü güvenli | Decrypt edilemez | ❌ |
| AES-256-GCM | Güvenli + decrypt | Key yönetimi kritik | ✅ Seçildi |

**ADR-004: Bot Mimarisi**

| Seçenek | Avantaj | Dezavantaj | Karar |
|---------|---------|------------|-------|
| Server-side Puppeteer | Merkezi yönetim | GİB IP engellemesi riski | ❌ |
| Desktop Bot (Electron) | Kullanıcı IP'si | Dağıtım karmaşıklığı | ✅ Seçildi |

### Risk Analizi (Pre-mortem)

| Risk | Olasılık | Etki | Önlem |
|------|----------|------|-------|
| Tenant veri sızıntısı | Orta | Kritik | Middleware auto-filter, code review checklist |
| Encryption key sızıntısı | Düşük | Kritik | Key rotation, audit log, HSM (uzun vadeli) |
| GİB portal değişikliği | Yüksek | Yüksek | Selector config, portal monitoring |
| N+1 query performans | Orta | Orta | APM, load testing, Prisma include |
| Bot session replay | Orta | Orta | Session timeout, JWT expiry |

**Risk Senaryoları ve Önlemler:**

1. **Veri Sızıntısı Senaryosu**
   - Geliştirici tenantId filtresini unutur
   - Müşteri A'nın verileri Müşteri B'ye gösterilir
   - **Önlem:** Prisma middleware ile otomatik tenant filter, code review checklist

2. **Encryption Key Sızıntısı**
   - ENCRYPTION_KEY env variable sızar
   - Tüm credential'lar decrypt edilebilir
   - **Önlem:** Key rotation mekanizması, audit log, uzun vadede HSM/Vault

3. **GİB Portal Değişikliği**
   - GİB portalı selector'ları değişir
   - Bot çalışmayı durdurur
   - **Önlem:** Selector'lar config'de (✅ mevcut), portal değişiklik monitoring

4. **Performans Çöküşü**
   - 100+ mükellefli ofiste sistem yavaşlar
   - **Önlem:** APM monitoring, load testing, virtual scrolling

### Güvenlik Durumu

| Katman | Uygulama | Durum |
|--------|----------|-------|
| Authentication | Supabase Auth + JWT | ✅ Aktif |
| Authorization | API Guard + tenantId | ✅ Aktif |
| Data Isolation | RLS + Query filter | ✅ Aktif |
| Encryption at-rest | Supabase managed | ✅ Aktif |
| Encryption in-transit | HTTPS | ✅ Aktif |
| Credential Encryption | AES-256-GCM | ✅ Aktif |
| WebSocket Auth | JWT validation | ✅ Aktif |
| Audit Logging | Partial logging | ⚠️ Kısmi |
| Rate Limiting | Yok | ⚠️ Eksik |
| KVKK Compliance | Değerlendirilmeli | ⚠️ Belirsiz |

**Güvenlik Katmanları (Defense-in-Depth):**

```
Katman 1: Supabase Auth (JWT) ─────────────────────────────┐
Katman 2: Middleware (session check) ──────────────────────┤
Katman 3: API Guard (tenantId validation) ─────────────────┤ Defense
Katman 4: RLS (database level) ────────────────────────────┤ in
Katman 5: Encryption (credential'lar) ─────────────────────┘ Depth
```

### First Principles Doğrulaması

| Mimari Kararı | Temel Gerçek | Doğrulama |
|---------------|--------------|-----------|
| Multi-tenant | Yasal gizlilik zorunluluğu (Mali müşavirlik yasası) | ✅ Şart |
| Desktop Bot | GİB API yok, manuel portal tek yol | ✅ Zorunluluk |
| Credential şifreleme | Bot çalışırken erişim gerekli + güvenlik | ✅ Doğru denge |
| WebSocket | Real-time UX gereksinimi (bot progress) | ✅ Optimal |
| Electron | Kullanıcı IP'si ile çalışma (GİB güvenliği) | ✅ Stratejik |

**Varsayım Doğrulamaları:**

1. **"Her ofis kendi verilerini görmeli"**
   - Temel Gerçek: Mali müşavirlik yasası gereği gizlilik zorunlu
   - Sonuç: Multi-tenant isolation şart, alternatif yok

2. **"Bot GİB portalına girip beyanname indirmeli"**
   - Temel Gerçek: GİB resmi API sunmuyor
   - Alternatif Analiz: GİB e-Beyanname API'si olsa bot gereksiz olurdu
   - Sonuç: Puppeteer zorunluluk, GİB bağımlılığı kabul edilmeli

3. **"Credential'lar veritabanında saklanmalı"**
   - Temel Gerçek: Bot çalışırken credential'lara erişmeli
   - Alternatif Analiz: Her seferinde kullanıcıdan isteme? → UX kötü
   - Sonuç: Şifrelenmiş saklama doğru, key yönetimi kritik

4. **"Web app + Desktop bot ayrı olmalı"**
   - Temel Gerçek: GİB IP tabanlı güvenlik uyguluyor
   - Alternatif Analiz: Server-side Puppeteer? → Tek IP, engelleme riski
   - Sonuç: Desktop bot kullanıcı IP'si ile çalışır → daha güvenli

### Cross-Functional Trade-offs

| Konu | Fizibilite (Teknik) | Arzu Edilirlik (UX) | Uygulanabilirlik (İş) |
|------|---------------------|---------------------|----------------------|
| Multi-tenant | ✅ Mevcut stack uygun | ✅ Güvenli hissettiriyor | ✅ RLS ile zorunlu |
| WebSocket Bot | ⚠️ Bağlantı yönetimi karmaşık | ✅ Real-time UX için şart | ✅ Çalışıyor |
| Domain Rules | ✅ Basit implementasyon | ✅ Kullanıcı beklentisi | ⚠️ Hardcoded |
| Desktop Bot | ⚠️ Dağıtım karmaşık | ✅ Güvenilir çalışma | ✅ IP güvenliği |

## Technology Stack Evaluation (Brownfield)

### Project Status: Brownfield (Existing Codebase)

Bu proje mevcut bir kod tabanına sahiptir. Yeni starter template seçimi yerine mevcut teknoloji stack'i doğrulanmıştır.

### Established Technology Stack

| Katman | Teknoloji | Sürüm | Karar Durumu |
|--------|-----------|-------|--------------|
| **Frontend Framework** | Next.js | 15.3.0 | ✅ Sabit |
| **UI Library** | React | 19.0.0 | ✅ Sabit |
| **Language** | TypeScript | 5.7.2 | ✅ Sabit |
| **Styling** | TailwindCSS | 4.0.0 | ✅ Sabit |
| **UI Components** | Radix UI | Latest | ✅ Sabit |
| **ORM** | Prisma | 6.19.0 | ✅ Sabit |
| **Database** | Supabase PostgreSQL | - | ✅ Sabit |
| **Auth** | Supabase Auth | 2.90.1 | ✅ Sabit |
| **Storage** | Supabase Storage | - | ✅ Sabit |
| **Real-time** | WebSocket (ws) | 8.18.3 | ✅ Sabit |
| **Table** | TanStack Table | 8.21.3 | ✅ Sabit |
| **Virtualization** | TanStack Virtual | 3.13.18 | ✅ Sabit |
| **Forms** | React Hook Form | 7.69.0 | ✅ Sabit |
| **Validation** | Zod | 3.25.76 | ✅ Sabit |
| **Icons** | Lucide React | 0.556.0 | ✅ Sabit |
| **Toast** | Sonner | 2.0.7 | ✅ Sabit |
| **Animation** | Framer Motion | 12.28.1 | ✅ Sabit |
| **Desktop Bot** | Electron | 34.0.0 | ✅ Sabit |
| **Browser Automation** | Puppeteer + Stealth | 24.0.0 | ✅ Sabit |

### Architectural Patterns Established

**Code Organization:**
- Next.js 15 App Router (route groups: auth, dashboard)
- Feature-based component organization
- Layered architecture (Presentation → API → Service → Data)

**Component Architecture:**
- Radix UI headless primitives
- CVA (Class Variance Authority) for component variants
- Feature modules with co-located hooks/dialogs

**Data Layer:**
- Prisma ORM with PostgreSQL
- Multi-tenant with tenantId filter
- Row Level Security (RLS)

**API Layer:**
- Next.js Route Handlers
- Auth guard pattern (getUserWithProfile)
- Tenant isolation on every query

**State Management:**
- SWR for server state
- React Context for UI state (Bot, Theme)
- No Redux/Zustand needed

**Development Experience:**
- TypeScript strict mode
- ESLint configuration
- Direct imports (no barrel exports)
- Turbopack for fast development

### Rationale for Current Stack

| Seçim | Gerekçe |
|-------|---------|
| Next.js 15 | App Router, RSC desteği, production-ready |
| React 19 | Concurrent features, improved hydration |
| Supabase | Auth + DB + Storage tek platformda, RLS |
| Prisma | Type-safe ORM, migration desteği |
| Radix UI | Accessible, headless, customizable |
| TailwindCSS 4 | Utility-first, fast iteration |
| WebSocket | Real-time bot iletişimi için zorunlu |
| Electron | GİB için masaüstü bot zorunluluğu |

### Technology Constraints for Future Development

**Must Follow:**
- New features must use existing stack (no new frameworks)
- API routes must follow auth guard pattern
- All queries must include tenantId filter
- New components must use Radix + Tailwind
- Forms must use React Hook Form + Zod

**Prohibited:**
- Barrel exports (performance impact)
- Direct database access without Prisma
- Client-side auth decisions
- `any` type usage
- N+1 query patterns

