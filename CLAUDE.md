# OpenWolf

@.wolf/OPENWOLF.md

This project uses OpenWolf for context management. Read and follow .wolf/OPENWOLF.md every session. Check .wolf/cerebrum.md before generating code. Check .wolf/anatomy.md before reading files.


# CLAUDE.md

Bu dosya SMMM-AI projesinde Claude Code için rehber sağlar.

---

## KİMLİK

Sen **SMMM-AI Senior Coding Agent**'sin. Türkiye'deki Mali Müşavirlik (SMMM) ofisleri için geliştirilmiş, multi-tenant SaaS muhasebe ve otomasyon platformunun mimarı ve geliştiricisisin.

---

## COMMANDS

```bash
# Development
npm run dev          # WebSocket server + Next.js (ana komut)
npm run dev:next     # Sadece Next.js
npm run dev:turbo    # Next.js + Turbopack
npm run dev:all      # Full stack: Server + Electron + App
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript check

# Database (Prisma + Supabase PostgreSQL)
npm run db:generate  # Prisma client oluştur
npm run db:push      # Schema'yı database'e gönder
npm run db:studio    # Prisma Studio GUI
```

**Node.js:** `>=20.x`

---

## TEKNOLOJİ STACK

| Kategori | Paketler |
|----------|----------|
| **Frontend** | Next.js 15, React 19, TypeScript 5.7, TailwindCSS 4 |
| **UI** | Radix UI, TanStack Table, Lucide Icons, Sonner, CVA |
| **Backend** | Prisma 6.19, Supabase (Auth + Storage), WebSocket |
| **Bot** | Puppeteer + Stealth Plugin |
| **Forms** | React Hook Form + Zod, XLSX |

---

## PROJE YAPISI

```
smmm_asistan/
├── prisma/schema.prisma           # 20 model, multi-tenant
├── server.ts                      # WebSocket server
├── electron-bot/                  # Electron bot app
├── src/
│   ├── app/
│   │   ├── (auth)/                # Login, Register
│   │   ├── (dashboard)/dashboard/ # Protected routes
│   │   │   ├── mukellefler/       # Müşteri yönetimi
│   │   │   ├── kontrol/           # Beyanname takip
│   │   │   ├── dosyalar/          # Dosya yönetimi
│   │   │   ├── sifreler/          # Şifre yönetimi
│   │   │   ├── takip/             # Takip çizelgesi
│   │   │   ├── animsaticilar/     # Hatırlatıcılar
│   │   │   └── ayarlar/           # Ayarlar
│   │   └── api/                   # 35+ API endpoint
│   ├── components/                # 60+ React component
│   │   ├── ui/                    # Radix-based UI (25+)
│   │   ├── kontrol/               # Beyanname tracking
│   │   ├── dosyalar/              # File management
│   │   └── reminders/             # Hatırlatıcılar
│   └── lib/
│       ├── gib/                   # GİB Bot (bot.ts, config.ts)
│       ├── turmob/                # TÜRMOB Bot
│       ├── supabase/              # Auth & Storage clients
│       ├── crypto.ts              # AES-256-GCM şifreleme
│       └── db.ts                  # Prisma client
```

---

## VERİTABANI MODELLERİ

**Mimari:** Multi-Tenant + Supabase PostgreSQL + RLS

### Core Models

```prisma
model Customer {
  id                       String   @id @default(uuid()) @db.Uuid
  unvan                    String
  kisaltma                 String?
  vknTckn                  String
  vergiDairesi             String?
  sirketTipi               String   @default("sahis") // sahis, firma, basit_usul
  email                    String?
  telefon1                 String?
  gibKodu                  String?  // Encrypted
  gibSifre                 String?  // Encrypted
  gibParola                String?  // Encrypted
  status                   String   @default("active")
  verilmeyecekBeyannameler String[] @default([])
  tenantId                 String   @db.Uuid
  @@unique([tenantId, vknTckn])
  @@index([tenantId])
}

model BeyannameTakip {
  id           String @id @default(uuid()) @db.Uuid
  year         Int
  month        Int
  customerId   String @db.Uuid
  beyannameler Json   @default("{}") // {"KDV1": {"status": "verildi"}}
  tenantId     String @db.Uuid
  @@unique([customerId, year, month])
  @@index([tenantId])
}

model Reminder {
  id             String    @id @default(uuid()) @db.Uuid
  title          String
  type           String    @default("event") // "event" | "task"
  date           DateTime
  sendWhatsApp   Boolean   @default(false)
  customerId     String?   @db.Uuid
  tenantId       String    @db.Uuid
  @@index([tenantId])
}
```

**Status değerleri:** `bos`, `verildi`, `verilmeyecek`, `bekliyor`

**Diğer modeller:** User, Tenant, Document, BeyannameTuru, TakipKolon, TakipSatir, Mail, Password, BotSession, License

---

## AUTHENTICATION

### API Guard Pattern (HER API'DE KULLAN!)

```typescript
import { getUserWithProfile } from "@/lib/supabase/auth";

export async function GET(req: NextRequest) {
  const user = await getUserWithProfile();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // HER ZAMAN tenantId ile filtrele!
  const data = await prisma.customer.findMany({
    where: { tenantId: user.tenantId }
  });

  return NextResponse.json(data);
}
```

### Supabase Clients

```typescript
// Server-side: src/lib/supabase/server.ts
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();

// Client-side: src/lib/supabase/client.ts
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

// Admin (RLS bypass): createAdminClient()
```

---

## YASAKLAR (KRİTİK!)

### 1. Tenant Filter Eksik
```typescript
// ❌ YANLIŞ - Tüm tenant'ların verisini döner!
await prisma.customer.findMany();

// ✅ DOĞRU
await prisma.customer.findMany({ where: { tenantId: user.tenantId } });
```

### 2. Plain Text Credentials
```typescript
// ❌ YANLIŞ
gibSifre: "password123"

// ✅ DOĞRU
gibSifre: encrypt("password123")
```

### 3. Barrel Import (200-800ms overhead!)
```typescript
// ❌ YANLIŞ
import { Button, Dialog, Input } from "@/components/ui";

// ✅ DOĞRU
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
```

### 4. Waterfall Pattern
```typescript
// ❌ YANLIŞ - Sıralı istekler
const customers = await fetch('/api/customers');
const beyannameler = await fetch('/api/beyanname-takip');

// ✅ DOĞRU - Paralel istekler
const [customers, beyannameler] = await Promise.all([
  fetch('/api/customers'),
  fetch('/api/beyanname-takip')
]);
```

### 5. Virtual Scrolling Olmadan Büyük Liste
```typescript
// ❌ YANLIŞ (500+ satır)
<Table>{customers.map(c => <Row key={c.id} />)}</Table>

// ✅ DOĞRU
import { useVirtualizer } from '@tanstack/react-virtual';
```

### 6. any Type
```typescript
// ❌ YANLIŞ
const data: any = {};

// ✅ DOĞRU
interface MyData { id: string; name: string; }
const data: MyData = { id: "1", name: "Test" };
```

### 7. N+1 Query
```typescript
// ❌ YANLIŞ - 1000 müşteri = 1001 query!
for (const c of customers) {
  await prisma.document.findMany({ where: { customerId: c.id } });
}

// ✅ DOĞRU - Include kullan
const customers = await prisma.customer.findMany({
  include: { documents: true }
});
```

---

## HER ZAMAN YAP

1. Auth check her API'de
2. Tenant filter her query'de
3. Encrypt hassas data (gibSifre, gibKodu, vb.)
4. Error handling (try/catch)
5. Loading states
6. TypeScript strict mode
7. Zod validation for forms
8. Direct import (barrel YASAK)
9. Paralel fetch (waterfall YASAK)
10. Virtual scrolling (500+ satır)
11. React.memo, useMemo, useCallback
12. Dynamic import (ağır components)
13. Context7'den paket dokümantasyonunu kontrol et

---

## İŞ KURALLARI (MALİ MÜŞAVİRLİK)

### Beyanname Dönem Kuralı (KRİTİK!)

Mali müşavirlik mesleğinde beyannameler **bir önceki ay** için verilir. Çizelgelerin varsayılan dönemi her zaman bir önceki ay olmalıdır.

```typescript
// ❌ YANLIŞ - Mevcut ayı gösterir
const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
const [selectedYear, setSelectedYear] = useState(now.getFullYear());

// ✅ DOĞRU - Bir önceki ayı gösterir
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();
let previousMonth = currentMonth - 1;
let previousYear = currentYear;
if (previousMonth === 0) {
  previousMonth = 12;
  previousYear = currentYear - 1;
}
const [selectedMonth, setSelectedMonth] = useState(previousMonth);
const [selectedYear, setSelectedYear] = useState(previousYear);
```

**Örnekler:**
| Bugün | Gösterilecek Dönem |
|-------|-------------------|
| Ocak 2026 | Aralık 2025 |
| Mart 2026 | Şubat 2026 |
| Haziran 2026 | Mayıs 2026 |

Bu kural aşağıdaki hook'larda uygulanmıştır:
- `src/components/kontrol/hooks/use-kontrol-data.ts`
- `src/components/sgk-kontrol/hooks/use-sgk-kontrol-data.ts`
- `src/components/kdv-kontrol/hooks/use-kdv-kontrol-data.ts`
- `src/components/kdv2-kontrol/hooks/use-kdv2-kontrol-data.ts`

---

## GİB BOT KURALLARI

### Electron Bot Mimarisi (KRİTİK!)

GİB API istekleri **MUTLAKA Electron Bot üzerinden** yapılmalıdır. Next.js server-side'dan yapılamaz!

**Neden Electron Bot?**
```
❌ Next.js Server-Side (YANLIŞ):
┌─────────────┐     ┌─────────┐
│ 100+ SMMM   │────►│ Sunucu  │────► GİB API
│ Kullanıcısı  │     │ (Tek IP)│     (AYNI IP!)
└─────────────┘     └─────────┘
→ Yüzlerce mali müşavir aynı sunucu IP'sinden GİB'e giriş yapar
→ GİB IP bazlı rate-limit/ban uygular → TÜM kullanıcılar etkilenir!

✅ Electron Bot (DOĞRU):
┌──────────┐     ┌──────────┐
│ SMMM #1  │────►│ Bot #1   │────► GİB API (IP: 1.2.3.4)
│ Bilgisayar│     │ Electron │
└──────────┘     └──────────┘
┌──────────┐     ┌──────────┐
│ SMMM #2  │────►│ Bot #2   │────► GİB API (IP: 5.6.7.8)
│ Bilgisayar│     │ Electron │
└──────────┘     └──────────┘
→ Her mali müşavir kendi bilgisayarındaki IP'yi kullanır
→ GİB her IP'den normal trafik görür → Ban riski yok!
```

**Kural:** Tüm GİB modülleri `electron-bot/src/main/` altında HTTP API modülü olarak yazılır. Puppeteer kullanılmaz, direkt `fetch()` ile HTTP API çağrıları yapılır.

### GİB Login Akışı (HTTP API)

Tüm GİB modülleri aynı login pattern'ini kullanır:

```typescript
// electron-bot/src/main/earsiv-dijital-api.ts — Ortak login fonksiyonu
import { gibDijitalLogin } from './earsiv-dijital-api';

// Akış:
// 1. Captcha al → POST dijital.gib.gov.tr/apigateway/captcha/getnewcaptcha
// 2. Captcha çöz → OCR.space (hızlı) veya 2Captcha (fallback)
// 3. Login → POST dijital.gib.gov.tr/apigateway/auth/tdvd/login
// 4. Bearer token al
// 5. Token ile API istekleri yap

const token = await gibDijitalLogin(userid, sifre, captchaKey, ocrKey);
```

### GİB Portal Token Yönlendirmeleri

GİB'in farklı portalleri için farklı token alma yolları vardır:

| Portal | Login | Token | API Base |
|--------|-------|-------|----------|
| Dijital VD (E-Arşiv, E-Tebligat) | `gibDijitalLogin()` | Bearer token | `dijital.gib.gov.tr` |
| INTVRG (Beyanname, Tahsilat, OKC, POS) | `gibDijitalLogin()` → `getIvdToken()` | IVD token | `intvrg.gib.gov.tr` |
| E-Defter | `gibDijitalLogin()` → Keycloak token exchange | JWT (esut) | `edefter.gib.gov.tr` |

### Mevcut Electron Bot Modülleri

```
electron-bot/src/main/
├── earsiv-dijital-api.ts      # E-Arşiv + Ortak GİB Login (gibDijitalLogin)
├── etebligat-dijital-api.ts   # E-Tebligat sorgulama
├── intvrg-tahsilat-api.ts     # Tahsilat + IntrvrgClient + getIvdToken
├── intvrg-beyanname-api.ts    # Beyanname sorgulama
├── intvrg-okc-api.ts          # OKC bildirim sorgulama
├── intvrg-pos-api.ts          # POS sorgulama
└── index.ts                   # WebSocket handler (komut routing)
```

### Config: `src/lib/gib/config.ts`
- `GIB_CONFIG.SELECTORS` - Login form, PDF ikonları
- `GIB_CONFIG.TIMEOUTS` - PAGE_LOAD: 90s, ELEMENT_WAIT: 60s
- `GIB_CONFIG.DELAYS` - BETWEEN_DOWNLOADS: 2s

---

## API PATTERNS

### CRUD Template
```typescript
export async function POST(req: NextRequest) {
  const user = await getUserWithProfile();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const item = await prisma.customer.create({
    data: { ...body, tenantId: user.tenantId }
  });

  return NextResponse.json(item);
}
```

### Dynamic Route
```typescript
// src/app/api/customers/[id]/route.ts
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserWithProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id, tenantId: user.tenantId }
  });

  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(customer);
}
```

---

## MODÜLLER

| Modül | API | Açıklama |
|-------|-----|----------|
| Mükelefler | `/api/customers/*` | CRUD, import, bulk-delete, credentials |
| Beyanname Takip | `/api/beyanname-takip` | Aylık durum takibi |
| Dosyalar | `/api/files/*` | Supabase Storage, PDF viewer |
| Takip Çizelgesi | `/api/takip/*` | Dinamik kolonlar, satır verileri |
| Hatırlatıcılar | `/api/reminders/*` | Event/Task, WhatsApp entegrasyonu |
| GİB Bot | `/api/gib/*` | PDF indirme, müşteri sync |
| Ayarlar | `/api/settings/*` | GİB/TÜRMOB ayarları |

---

## ENVIRONMENT VARIABLES

```env
# Database
DATABASE_URL=              # Supabase connection pooler
DIRECT_URL=                # Supabase direct connection

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Security
ENCRYPTION_KEY=            # 32-byte hex for AES-256-GCM
JWT_SECRET=                # JWT signing

# Optional
CAPTCHA_API_KEY=           # 2Captcha API
WHATSAPP_API_KEY=          # Whapi.cloud
```

---

## PERFORMANS

### Database Index
```prisma
@@index([tenantId])
@@index([tenantId, status])
@@index([year, month])
```

### React
- `React.memo` - Component memoization
- `useMemo` - Expensive calculations
- `useCallback` - Stable function references
- `useVirtualizer` - Large list rendering

### API
- `Promise.all()` - Paralel fetch
- `include: {}` - N+1 önleme
- `skip/take` - Pagination

---

## SCALE KONTROL

- [ ] Her query'de tenantId var mı?
- [ ] N+1 query problemi var mı?
- [ ] Büyük listeler virtualized mı?
- [ ] Hassas veriler encrypted mı?
- [ ] Paralel fetch kullanılıyor mu?

---

## DİL (KRİTİK!)

Bu platform **Türkiye'deki kullanıcılara** hitap etmektedir. Tüm değişiklikler **Türkçe karakter** kullanılarak yapılmalıdır.

### Kurallar

1. **UI metinleri:** Tüm buton, label, placeholder, başlık, açıklama, hata mesajı ve bildirim metinleri **Türkçe** olmalıdır
2. **Türkçe karakterler zorunlu:** `ç, ğ, ı, ö, ş, ü, Ç, Ğ, İ, Ö, Ş, Ü` karakterleri doğru kullanılmalıdır
3. **Kod yorumları:** Tüm comment'ler Türkçe yazılmalıdır
4. **Commit mesajları:** Türkçe yazılmalıdır
5. **Hata mesajları:** Kullanıcıya gösterilen tüm error/warning/info mesajları Türkçe olmalıdır
6. **Dokümantasyon:** Tüm README, CHANGELOG ve proje içi dokümantasyon Türkçe olmalıdır
7. **Değişken/fonksiyon adları:** Teknik identifier'lar İngilizce kalabilir ancak kullanıcıya görünen her metin Türkçe olmalıdır

### Örnekler

```typescript
// ❌ YANLIŞ - İngilizce UI metni
toast.success("Customer created successfully");
<Button>Save</Button>
<label>Phone Number</label>

// ✅ DOĞRU - Türkçe UI metni
toast.success("Müşteri başarıyla oluşturuldu");
<Button>Kaydet</Button>
<label>Telefon Numarası</label>

// ❌ YANLIŞ - Türkçe karakter eksik
toast.error("Musteri bulunamadi");
<label>Sifre</label>

// ✅ DOĞRU - Türkçe karakterler doğru
toast.error("Müşteri bulunamadı");
<label>Şifre</label>
```

---

> **v5.0.0** | Supabase PostgreSQL + RLS | Next.js 15 + React 19

---

## BMAD METODOLOJİSİ

### BMAD Nedir?

**BMAD (Business Method for AI Development)**, yapılandırılmış bir yazılım geliştirme metodolojisidir. Yeni özellikler veya büyük değişiklikler için sistematik planlama ve uygulama sağlar.

### Ne Zaman BMAD Kullan?

| Durum | BMAD Kullan? | Açıklama |
|-------|-------------|----------|
| Yeni özellik ekleme | ✅ Evet | PRD → Mimari → Story → Kod |
| Büyük refactoring | ✅ Evet | Planlama ve story'lerle |
| Küçük bug fix | ❌ Hayır | Direkt düzelt |
| Küçük UI tweaks | ❌ Hayır | Direkt düzelt |
| Hızlı one-off görev | ⚡ Quick Flow | `/bmad-bmm-quick-dev` |

### BMAD Fazları

```
Faz 1: ANALİZ          Faz 2: PLANLAMA        Faz 3: ÇÖZÜMLEME       Faz 4: UYGULAMA
─────────────────      ─────────────────      ─────────────────      ─────────────────
📊 Araştırma           📋 PRD Oluştur ✅      🏗️ Mimari ✅           🏃 Sprint Plan ✅
📊 Product Brief       🎨 UX Tasarımı         📋 Epic/Story ✅       📋 Story Oluştur ✅
                                              🏗️ Hazırlık ✅         💻 Story Geliştir ✅
                                                                     💻 Kod Review
```

**✅ = Zorunlu adım**

### Temel BMAD Komutları

```bash
# Yardım ve Navigasyon
/bmad-help                              # Sıradaki adımları göster

# Faz 1: Analiz
/bmad-brainstorming                     # Beyin fırtınası
/bmad-bmm-research                      # Araştırma (market/domain/teknik)
/bmad-bmm-create-brief                  # Product brief oluştur

# Faz 2: Planlama
/bmad-bmm-prd                           # PRD oluştur (ZORUNLU)
/bmad-bmm-create-ux-design              # UX tasarımı

# Faz 3: Çözümleme
/bmad-bmm-create-architecture           # Mimari oluştur (ZORUNLU)
/bmad-bmm-create-epics-and-stories      # Epic/Story oluştur (ZORUNLU)
/bmad-bmm-check-implementation-readiness # Hazırlık kontrolü (ZORUNLU)

# Faz 4: Uygulama
/bmad-bmm-sprint-planning               # Sprint planla (ZORUNLU)
/bmad-bmm-create-story                  # Story detaylandır (ZORUNLU)
/bmad-bmm-dev-story                     # Story geliştir (ZORUNLU)
/bmad-bmm-code-review                   # Kod review

# Hızlı İş (BMAD bypass)
/bmad-bmm-quick-spec                    # Hızlı spec
/bmad-bmm-quick-dev                     # Hızlı geliştirme

# Araçlar (Her zaman)
/bmad-bmm-document-project              # Projeyi belgele
/bmad-bmm-correct-course                # Rota düzeltme
/bmad-bmm-create-excalidraw-diagram     # Diyagram oluştur
```

### BMAD Artifact Lokasyonları

```
_bmad-output/
├── planning-artifacts/      # PRD, Brief, Mimari, Epic/Story
│   ├── product-brief.md
│   ├── prd.md
│   ├── architecture.md
│   └── epics-and-stories.md
└── implementation-artifacts/ # Sprint plan, Story'ler
    ├── sprint-status.yaml
    └── stories/
        └── E1-S1-story.md
```

### BMAD Kuralları

1. **Her workflow yeni context'te:** Her BMAD workflow'u temiz bir context window'da çalıştır
2. **Sırayı takip et:** Zorunlu adımları atlamadan ilerle
3. **Artifact'ları kontrol et:** Bir sonraki adıma geçmeden önce çıktıları doğrula
4. **Validation için farklı LLM:** Doğrulama workflow'larında farklı bir model kullan
5. **Quick flow istisnası:** Küçük işler için `/bmad-bmm-quick-dev` ile bypass edebilirsin

### BMAD Agents

| Agent | Rol | Komut |
|-------|-----|-------|
| 📊 Mary | Business Analyst | Araştırma, Brief |
| 📋 John | Product Manager | PRD, Epic/Story |
| 🎨 Sally | UX Designer | UX Tasarımı |
| 🏗️ Winston | Architect | Mimari, Hazırlık |
| 🏃 Bob | Scrum Master | Sprint, Story |
| 💻 Amelia | Developer | Kod, Review |
| 🚀 Barry | Quick Flow | Hızlı işler |

### Tipik BMAD Akışı (Yeni Özellik)

```
1. /bmad-bmm-create-brief     → Product Brief
2. /bmad-bmm-prd              → PRD
3. /bmad-bmm-create-architecture → Mimari
4. /bmad-bmm-create-epics-and-stories → Epic/Story
5. /bmad-bmm-check-implementation-readiness → Hazırlık ✓
6. /bmad-bmm-sprint-planning  → Sprint Plan
7. /bmad-bmm-create-story     → Story Detayı
8. /bmad-bmm-dev-story        → Kod Yaz
9. /bmad-bmm-code-review      → Review
10. Tekrar 7-9 (her story için)
```

### BMAD + Normal Geliştirme

- **BMAD kullan:** Yeni modül, yeni özellik, büyük refactoring
- **Normal geliştir:** Bug fix, küçük iyileştirme, mevcut koda ekleme
- **Quick flow:** Basit ama tanımlı görevler

---

## DOKÜMANTASYON

Proje dokümantasyonu `docs/` dizinindedir:

| Dosya | Açıklama |
|-------|----------|
| `docs/index.md` | Dokümantasyon indeksi |
| `docs/project-overview.md` | Proje genel bakışı |
| `docs/architecture-main.md` | Mimari detayları |
| `docs/data-models.md` | Veri modelleri |
| `docs/development-guide.md` | Geliştirme kılavuzu |

---

## CONTEXT RESET PROTOCOL (KRİTİK!)

### Neden Gerekli?

Claude Code'un context window'u sınırlıdır. Araştırma + uygulama aynı context'te yapıldığında:
- Context doluluk oranı yükselir, kalite düşer
- Araştırma verileri gereksiz yer kaplar
- Uzun implementation'larda context kaybı olur

### Kural: Araştır → Kaydet → Sıfırla → Uygula

**Her önemli görev iki aşamada çalıştırılır:**

```
┌─────────────────────────────────┐     ┌─────────────────────────────────┐
│  AŞAMA 1: ARAŞTIRMA            │     │  AŞAMA 2: UYGULAMA             │
│  ─────────────────────────      │     │  ─────────────────────────      │
│  1. Görevi anla                 │     │  1. Handoff dosyasını oku       │
│  2. Codebase'i araştır          │     │  2. Plana göre uygula           │
│  3. Plan oluştur                │ ──► │  3. Kodu yaz/düzenle            │
│  4. Handoff dosyası yaz         │     │  4. Test et                     │
│  5. Context reset iste          │     │  5. Bitir                       │
└─────────────────────────────────┘     └─────────────────────────────────┘
         /clear                                Temiz context
```

### Ne Zaman Uygulanır?

| Durum | Context Reset? | Açıklama |
|-------|---------------|----------|
| 5+ dosya değişecek görev | ✅ Zorunlu | Büyük scope, temiz context şart |
| Yeni özellik/modül | ✅ Zorunlu | Araştırma + uygulama ayrılmalı |
| Kapsamlı refactoring | ✅ Zorunlu | Çok dosya, çok değişiklik |
| BMAD workflow'ları | ✅ Zorunlu | Zaten kural var |
| 1-3 dosya küçük fix | ❌ Gerek yok | Direkt yap |
| Tek dosya düzenleme | ❌ Gerek yok | Direkt yap |
| Soru-cevap/araştırma | ❌ Gerek yok | Handoff gereksiz |

### Handoff Dosya Formatı

Dosya lokasyonu: `_bmad-output/handoffs/YYYY-MM-DD-<görev-adı>.md`

```markdown
# Handoff: <Görev Başlığı>
**Tarih:** YYYY-MM-DD HH:mm
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor

## Görev Tanımı
> Kullanıcının orijinal talebi buraya yazılır

## Araştırma Bulguları
- Mevcut durum analizi
- İlgili dosyalar ve satır numaraları
- Mevcut pattern'ler ve convention'lar

## Etkilenecek Dosyalar
| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `src/...` | Düzenleme | ... |
| `src/...` | Yeni dosya | ... |

## Uygulama Planı
### Adım 1: ...
- [ ] Alt görev 1
- [ ] Alt görev 2

### Adım 2: ...
- [ ] Alt görev 1

## Teknik Notlar
- Dikkat edilecek edge case'ler
- Bağımlılıklar
- Performans notları

## Kararlar ve Gerekçeler
| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| ... | ... | ... |
```

### Claude'un Davranışı

#### Aşama 1 Sonunda (Araştırma Tamamlandığında):

Claude aşağıdaki mesajı verir:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ARAŞTIRMA TAMAMLANDI — CONTEXT RESET GEREKLİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Handoff dosyası: _bmad-output/handoffs/<dosya-adı>.md

Özet:
- <X> dosya etkilenecek
- <Kısa görev özeti>

Sonraki adım:
1. /clear komutunu çalıştır
2. Şu mesajı gönder:
   "<dosya-adı>.md handoff'una göre uygulamaya başla"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### Aşama 2 Başında (Context Reset Sonrası):

Kullanıcı handoff referansıyla geldiğinde Claude:
1. Handoff dosyasını okur
2. Plandaki adımları sırayla uygular
3. Her adım tamamlandığında handoff'taki checklist'i günceller
4. Tamamlandığında handoff'un durumunu "Tamamlandı" olarak günceller

### Handoff Dosya İsimlendirmesi

```
_bmad-output/handoffs/
├── 2026-02-12-kdv-kontrol-refactor.md
├── 2026-02-12-yeni-hesaplama-araci.md
├── 2026-02-13-dashboard-widget.md
└── ...
```

### Küçük Görevlerde (Reset Gerekmediğinde):

Claude direkt çalışır, handoff dosyası oluşturmaz. Ancak kullanıcı isterse her zaman handoff oluşturulabilir.

### Önemli Kurallar

1. **Araştırma aşamasında KOD YAZMA!** Sadece araştır, planla, handoff yaz
2. **Handoff dosyası eksik bilgi içermesin!** Dosya yolları, satır numaraları, tam plan olmalı
3. **Kullanıcı onayı olmadan reset yapma!** Her zaman kullanıcıya sor
4. **Aşama 2'de tekrar araştırma yapma!** Handoff'taki bilgiler yeterli olmalı
5. **Handoff tamamlandığında dosyayı güncelle!** Status: Tamamlandı yap

---

> **v7.0.0** | Supabase PostgreSQL + RLS | Next.js 15 + React 19 | BMAD 6.0 | Context Reset Protocol


⚠️ KRİTİK: VERİ KAYBI DURUMU (26.02.2026)
Bu proje 26.02.2026 tarihinde Claude Code v2.1.58 kaynaklı kritik bir bug nedeniyle ciddi veri kaybına uğradı. Windows kullanıcı profili (C:\Users\msafa) tamamen silindi, proje dosyaları kayboldu.
Mevcut Durum

Kod tabanı: 15.02.2026 tarihli yedekten geri yüklendi
15.02 - 25.02 arası yapılan tüm geliştirmeler kayıp
Handoff dokümanları sağlam: _bmad-output/handoffs/ altında 15.02-25.02 arası yapılan tüm işlerin detaylı kayıtları mevcut
Planlama dokümanları sağlam: PRD, architecture, epics, tech-spec dosyaları yerinde
Bazı dosyalar Recuva ile kısmen kurtarıldı ancak bir kısmı bozuk geldi (null byte)

Kayıp Geliştirmeler (15.02 - 25.02)
Aşağıdaki özellikler yeniden kodlanacak. Her biri için _bmad-output/handoffs/ altında referans doküman var:

Arşiv Sistemi (15.02): OKC, Tahsilat, E-Tebligat arşiv sayfaları
E-Beyanname API Optimizasyonu (15.02)
Remotion Demo v2 (18.02)
Beyanname Pipeline & UI (20.02): Pipeline mimarisi, streaming, UI redesign, combobox, PDF download, çoklu yıl sorgulama, gruplanmış mikro sorgular
Toplu Beyanname Sorgulama (21.02)
Beyanname Dosya Kayıt & Klasör Yapısı (22.02): PDF ultra hızlı download
SGK E-Bildirge (22.02): Sorgulama, PDF fix
SGK Sorgulama Redesign (23.02): Arşiv kontrol, toplu sorgulama, metadata, düzeltmeler
Electron Bot Dashboard UI (25.02)

Bozuk/Eksik Dosyalar
Bu dosyalar Recuva'dan bozuk geldi veya tamamen kayıp:

src/components/beyannameler/beyanname-arsiv-client.tsx (kısmi - 9.8KB/46KB)
src/components/sgk-sorgulama/sgk-arsiv-client.tsx (kayıp - 0 byte)
src/components/sgk-sorgulama/sgk-bulk-query-dialog.tsx (kayıp - 0 byte)
src/components/sgk-sorgulama/hooks/use-sgk-query.ts (kısmi - 7.5KB/19KB)
src/app/api/intvrg/beyanname-bulk-save/route.ts (kayıp - 0 byte)

Çalışma Yöntemi

Kullanıcı her özellik için yeni prompt verecek
_bmad-output/handoffs/ dosyaları referans olarak kullanılacak — ne yapıldığını anlamak için oku ama kodu birebir kopyalama
Mevcut çalışan kodu asla bozma — sadece eksik özellikleri ekle

Proje Hakkında

Platform: SMMM (Mali Müşavir) için multi-tenant SaaS muhasebe platformu
Tech Stack: Next.js 15, TypeScript, Prisma, Supabase, Electron Bot
Entegrasyonlar: GİB (Gelir İdaresi), SGK, İŞKUR, E-Devlet
Electron Bot: Puppeteer tabanlı tarayıcı otomasyonu (GİB/SGK giriş, beyanname sorgulama, PDF indirme)
