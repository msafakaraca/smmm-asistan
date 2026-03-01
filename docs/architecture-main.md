# SMMM-AI Ana Web Uygulaması - Mimari Dokümantasyonu

> **Parça:** main (kök dizin)
> **Tip:** Web Uygulaması
> **Framework:** Next.js 15 + React 19

---

## 📐 Mimari Genel Bakış

### Mimari Desen

**Layered Architecture + Component-Based UI**

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Pages     │  │ Components  │  │   UI Primitives     │ │
│  │  (App Dir)  │  │  (Feature)  │  │    (Radix UI)       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      API Layer (Route Handlers)              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  /api/customers  /api/files  /api/gib  /api/tasks  ... ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                      Service Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Auth Lib   │  │  Crypto     │  │   Storage           │ │
│  │  (Supabase) │  │  (AES-256)  │  │   (Supabase)        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │         Prisma ORM + Supabase PostgreSQL + RLS          ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                   Integration Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  WebSocket  │  │ Electron    │  │   External APIs     │ │
│  │   Server    │  │    Bot      │  │  (Gmail, Outlook)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏛️ Katman Detayları

### 1. Presentation Layer

#### App Router Yapısı

```
src/app/
├── (auth)/                    # Auth route grubu
│   ├── login/page.tsx         # Login sayfası
│   └── register/page.tsx      # Kayıt sayfası
├── (dashboard)/               # Dashboard route grubu
│   └── dashboard/
│       ├── layout.tsx         # Dashboard layout
│       ├── page.tsx           # Ana dashboard
│       ├── mukellefler/       # Mükellef yönetimi
│       ├── kontrol/           # Beyanname kontrol
│       ├── dosyalar/          # Dosya yönetimi
│       ├── takip/             # Takip çizelgesi
│       ├── animsaticilar/     # Hatırlatıcılar
│       ├── ayarlar/           # Ayarlar
│       └── gorevler/          # Görev yönetimi
├── api/                       # API Route Handlers
├── layout.tsx                 # Root layout
├── page.tsx                   # Landing page
└── globals.css                # Global stiller
```

#### Component Mimarisi

```
src/components/
├── ui/                        # Radix UI Primitives (28 bileşen)
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── table.tsx
│   └── ...
├── [feature]/                 # Feature bileşenleri
│   ├── [feature]-module.tsx   # Ana modül bileşeni
│   ├── dialogs/               # Modal dialoglar
│   ├── forms/                 # Form bileşenleri
│   └── hooks/                 # Feature-specific hooks
└── shared/                    # Paylaşılan bileşenler
```

### 2. API Layer

#### Route Handler Pattern

```typescript
// src/app/api/customers/route.ts
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  // 1. Auth check
  const user = await getUserWithProfile();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Tenant isolation
  const customers = await prisma.customers.findMany({
    where: { tenantId: user.tenantId }
  });

  return NextResponse.json(customers);
}
```

#### Dynamic Routes

```typescript
// src/app/api/customers/[id]/route.ts
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserWithProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const customer = await prisma.customers.findFirst({
    where: { id, tenantId: user.tenantId }
  });

  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(customer);
}
```

### 3. Service Layer

#### Authentication (Supabase)

```
src/lib/supabase/
├── server.ts      # Server-side client (SSR)
├── client.ts      # Client-side client (browser)
└── auth.ts        # Auth helper functions
```

**Auth Flow:**
1. Middleware (`src/middleware.ts`) session kontrolü
2. API'lerde `getUserWithProfile()` ile kullanıcı + tenant bilgisi
3. Her query'de `tenantId` filtresi

#### Encryption (AES-256-GCM)

```typescript
// src/lib/crypto.ts
encrypt(text: string): string    // Hassas veri şifreleme
decrypt(encryptedJson: string): string  // Şifre çözme
```

**Şifrelenen Alanlar:**
- `customers.gibKodu`
- `customers.gibSifre`
- `customers.gibParola`
- `customers.sgkSistemSifresi`
- Ve diğer credential alanları

### 4. Data Layer

#### Prisma Client

```typescript
// src/lib/db.ts
export const prisma = new PrismaClient({
  log: ["error"],
});
```

#### Multi-tenant Pattern

```prisma
model customers {
  id        String  @id @default(uuid()) @db.Uuid
  tenantId  String  @db.Uuid
  // ... fields
  tenants   tenants @relation(...)

  @@index([tenantId])
  @@unique([tenantId, vknTckn])
}
```

**Her query'de:**
```typescript
where: { tenantId: user.tenantId }
```

### 5. Integration Layer

#### WebSocket Server

```
server.ts - WebSocket Server
├── Port: 3001 (WS_PORT)
├── JWT Authentication
├── Tenant-based broadcast
└── Message Types:
    ├── BOT_PROGRESS      # Bot ilerleme
    ├── bot:mukellef-data # Mükellef import
    ├── bot:batch-results # Beyanname sonuçları
    ├── bot:complete      # İşlem tamamlandı
    └── bot:error         # Hata
```

#### Electron Bot Entegrasyonu

```
Web App <---> WebSocket Server <---> Electron Bot
   │                                      │
   │  bot:start-download                  │
   │  ─────────────────────────────────>  │
   │                                      │
   │  BOT_PROGRESS                        │
   │  <─────────────────────────────────  │
   │                                      │
   │  bot:batch-results                   │
   │  <─────────────────────────────────  │
```

---

## 🔐 Güvenlik Mimarisi

### 1. Authentication Flow

```
User ──> Login Page ──> Supabase Auth ──> Session Cookie
                                              │
API Request ──> Middleware ──> Session Check ──┘
                    │
                    └──> getUserWithProfile() ──> API Handler
```

### 2. Authorization Model

```
Tenant (Ofis)
    │
    ├── Admin (role: admin)
    │   └── Tüm yetkiler
    │
    └── User (role: user)
        └── permissions[] ile kısıtlı yetkiler
```

### 3. Data Isolation

```
Request ──> Auth ──> tenantId extraction ──> Query with filter
                          │
                          └── RLS Policy (Supabase seviyesinde)
```

---

## 📡 State Management

### Client State

```typescript
// SWR ile data fetching
const { data, error, mutate } = useSWR('/api/customers', fetcher);

// React Context
<BotProvider>     # Bot durumu
<ThemeProvider>   # Tema
<ToasterProvider> # Bildirimler
```

### Server State

```typescript
// API Route'larda Prisma ile
await prisma.customers.findMany({ where: { tenantId } });
```

---

## 🔄 Data Flow

### Örnek: Mükellef Ekleme

```
1. User fills form
   └── CustomerForm component
       └── React Hook Form + Zod validation

2. Submit
   └── POST /api/customers
       └── getUserWithProfile()
       └── prisma.customers.create({ ...data, tenantId })
       └── encrypt(gibSifre) if provided

3. Response
   └── 201 Created
       └── SWR mutate() → UI update
```

### Örnek: GİB Bot İşlemi

```
1. User clicks "Beyanname İndir"
   └── POST /api/internal/trigger-bot
       └── WebSocket broadcast to tenant

2. Electron Bot receives command
   └── Puppeteer GİB login
   └── Download beyannameler
   └── WebSocket: BOT_PROGRESS

3. Bot completes
   └── WebSocket: bot:batch-results
   └── Server processes results
       └── prisma.documents.create()
       └── prisma.beyanname_takip.update()
   └── WebSocket: bot:batch-processed
       └── UI updates automatically
```

---

## 📊 Performance Patterns

### 1. Import Optimization

```typescript
// ❌ YANLIŞ - Barrel import
import { Button, Dialog, Input } from "@/components/ui";

// ✅ DOĞRU - Direct import
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
```

### 2. Parallel Fetching

```typescript
// ❌ YANLIŞ - Waterfall
const customers = await fetch('/api/customers');
const beyannameler = await fetch('/api/beyanname-takip');

// ✅ DOĞRU - Parallel
const [customers, beyannameler] = await Promise.all([
  fetch('/api/customers'),
  fetch('/api/beyanname-takip')
]);
```

### 3. Virtual Scrolling

```typescript
// 500+ satır için
import { useVirtualizer } from '@tanstack/react-virtual';
```

### 4. Memoization

```typescript
// Expensive calculations
const sortedData = useMemo(() => sortData(data), [data]);

// Stable callbacks
const handleClick = useCallback(() => { ... }, [deps]);

// Component memoization
export default React.memo(MyComponent);
```

---

## 🧪 Test Stratejisi

*(Henüz implement edilmemiş)*

**Önerilen:**
- Unit Tests: Vitest
- Component Tests: React Testing Library
- E2E Tests: Playwright

---

## 📦 Build & Deploy

### Development

```bash
npm run dev          # Next.js + WebSocket server
npm run dev:turbo    # Turbopack ile
```

### Production

```bash
npm run build        # Production build
npm run start        # Production server
```

### Environment

```
Development: localhost:3000 (HTTP) + localhost:3001 (WS)
Production: Vercel + Supabase
```

---

## 📚 İlgili Dokümantasyon

- [Proje Genel Bakışı](./project-overview.md)
- [API Kontratları](./api-contracts.md)
- [Veri Modelleri](./data-models.md)
- [Bileşen Envanteri](./component-inventory.md)
- [Geliştirme Kılavuzu](./development-guide.md)
