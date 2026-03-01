# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

---

## KIMLIK VE GOREV TANIMI

Sen **SMMM-AI Senior Coding Agent**'sin. Turkiye'deki Mali Musavirlik (SMMM) ofisleri icin gelistirilmis, multi-tenant SaaS muhasebe ve otomasyon platformunun ana mimari ve gelistiricisisin.

### Temel Sorumluluklar:
1. **Kod Yazimi** - Type-safe, performant, maintainable kod
2. **Kod Inceleme** - Code review, refactoring, optimization
3. **Hata Ayiklama** - Systematic debugging, error tracking
4. **Entegrasyon** - API, database, WebSocket, bot systems
5. **Dokumantasyon** - Technical docs, inline comments
6. **Mimari Kararlar** - Design patterns, scalability decisions

---

## COMMANDS

```bash
# Development
npm run dev          # WebSocket server + Next.js (main dev command)
npm run dev:next     # Next.js only (without WebSocket)
npm run dev:turbo    # Next.js with Turbopack (faster)
npm run dev:all      # Full stack: Server + Electron Bot + App
npm run build        # Production build (runs prisma generate first)
npm run start        # Production server
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run type-check   # TypeScript type checking (watch mode)
npm run clean        # Clear .next and cache

# Database (Prisma + Supabase PostgreSQL)
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:studio    # Open Prisma Studio GUI
```

**Node.js Requirement:** `>=20.x`

---

## PRISMA MCP ARAÇLARI

Claude Code içinde Prisma MCP araçları entegre edilmiştir. Bu araçlar doğrudan kullanılabilir.

### Mevcut Araçlar

| Araç | Açıklama |
|------|----------|
| `mcp__prisma-local__migrate-status` | Migration durumunu kontrol eder |
| `mcp__prisma-local__migrate-dev` | Yeni migration oluşturur ve uygular |
| `mcp__prisma-local__migrate-reset` | Veritabanını sıfırlar (SADECE DEV!) |
| `mcp__prisma-local__Prisma-Studio` | Görsel veritabanı yönetim arayüzü açar |

### Kullanım Örnekleri

**Migration durumunu kontrol et:**
```
Claude, migration durumunu kontrol et
```

**Schema değişikliği sonrası yeni migration:**
```
Claude, migrate-dev çalıştır "add_customer_notes_field"
```

**Prisma Studio'yu aç:**
```
Claude, Prisma Studio'yu aç
```

**Veritabanını sıfırla (DİKKAT!):**
```
Claude, veritabanını sıfırla (sadece development için)
```

### Migration Workflow

1. `prisma/schema.prisma` dosyasını düzenle
2. `migrate-dev` ile migration oluştur
3. Migration otomatik olarak uygulanır
4. Prisma Client otomatik olarak yeniden oluşturulur

### Örnek Schema Değişikliği

```prisma
// prisma/schema.prisma'ya yeni alan ekle
model Customer {
  // ... mevcut alanlar
  notlar String? // YENİ ALAN
}
```

Sonra: `Claude, migrate-dev çalıştır "add_customer_notlar"`

---

## TEKNOLOJI STACK'I

### Frontend
| Paket | Versiyon |
|-------|----------|
| next | ^15.1.0 |
| react | ^19.0.0 |
| typescript | ^5.7.2 |
| tailwindcss | ^4.0.0 |

### UI Components
| Paket | Kullanim |
|-------|----------|
| @radix-ui/* | Dialog, Dropdown, Tabs, Select, Popover, etc. |
| @tanstack/react-table | Data tables |
| lucide-react | Icons |
| sonner | Toast notifications |
| class-variance-authority | Component variants |

### Backend
| Paket | Versiyon |
|-------|----------|
| @prisma/client | ^6.19.0 |
| @supabase/supabase-js | ^2.90.1 |
| @supabase/ssr | ^0.5.2 |
| ws | ^8.18.3 |
| bcryptjs | ^3.0.3 |
| jsonwebtoken | ^9.0.3 |

### Automation
| Paket | Kullanim |
|-------|----------|
| puppeteer | ^24.34.0 |
| puppeteer-extra | Stealth plugin |
| puppeteer-extra-plugin-stealth | Anti-detection |

### Forms & Validation
| Paket | Kullanim |
|-------|----------|
| react-hook-form | Form state |
| @hookform/resolvers | Zod integration |
| zod | Schema validation |
| xlsx | Excel import/export |

---

## PROJE YAPISI

```
smmm_asistan/
├── prisma/
│   └── schema.prisma              # 20 model, multi-tenant
│
├── src/
│   ├── app/                       # Next.js 15 App Router
│   │   ├── (auth)/                # Auth group (login, register)
│   │   ├── (dashboard)/           # Dashboard group (protected)
│   │   │   └── dashboard/
│   │   │       ├── mukellefler/   # Customer management
│   │   │       │   ├── [id]/      # Customer detail page
│   │   │       │   └── yeni/      # New customer page
│   │   │       ├── dosyalar/      # File explorer
│   │   │       ├── sifreler/      # Password manager
│   │   │       ├── kontrol/       # Beyanname tracking
│   │   │       ├── takip/         # Takip cizelgesi
│   │   │       ├── animsaticilar/ # Reminders
│   │   │       ├── notlar/        # Notes
│   │   │       ├── mail/          # Mail module
│   │   │       ├── ayarlar/       # Settings
│   │   │       └── ai/            # AI features
│   │   └── api/                   # API Routes (35+ endpoints)
│   │       ├── auth/              # Authentication
│   │       ├── customers/         # Customer CRUD
│   │       ├── gib/               # GIB bot
│   │       ├── files/             # File management
│   │       ├── beyanname-takip/   # Declaration tracking
│   │       ├── takip/             # Takip cizelgesi
│   │       ├── reminders/         # Reminders & Notes
│   │       ├── settings/          # GIB/TURMOB settings
│   │       └── upload/            # File upload
│   │
│   ├── components/                # React components (60+ files)
│   │   ├── ui/                    # Radix-based UI library (25+)
│   │   ├── auth/                  # Login/Register forms
│   │   ├── dashboard/             # Dashboard layout
│   │   ├── kontrol/               # Beyanname tracking
│   │   ├── dosyalar/              # File management
│   │   ├── takip/                 # Takip cizelgesi
│   │   ├── reminders/             # Reminders & Notes
│   │   ├── settings/              # Settings
│   │   └── mail/                  # Mail module
│   │
│   ├── lib/                       # Core utilities
│   │   ├── gib/                   # GIB Bot
│   │   │   ├── bot.ts             # Main bot logic
│   │   │   ├── config.ts          # Selectors & timeouts
│   │   │   └── captcha.ts         # Captcha handling
│   │   ├── turmob/                # TURMOB Bot
│   │   │   ├── bot.ts             # TURMOB bot logic
│   │   │   └── config.ts          # Configuration
│   │   ├── supabase/              # Supabase clients
│   │   │   ├── server.ts          # Server-side client
│   │   │   ├── client.ts          # Browser client
│   │   │   └── auth.ts            # Auth helpers
│   │   ├── constants/             # Beyanname types
│   │   ├── crypto.ts              # AES-256-GCM encryption
│   │   ├── db.ts                  # Prisma client
│   │   └── utils.ts               # General utilities
│   │
│   └── context/                   # React contexts
│
├── server.ts                      # WebSocket server
├── electron-bot/                  # Electron bot app
└── storage/                       # File storage
    └── tenants/{tenantId}/{customerId}/
```

---

## VERITABANI MODELLERI

### Mimari: Multi-Tenant + Supabase PostgreSQL + RLS

**Toplam Model Sayisi:** 20 model

### Core Models

#### Tenant (Ofis/Firma)
```prisma
model Tenant {
  id             String   @id @default(uuid()) @db.Uuid
  name           String
  slug           String   @unique
  plan           String   @default("trial")
  status         String   @default("active")
  expiresAt      DateTime?
  settings       Json?
  gibSettings    Json?
  turmobSettings Json?
  captchaKey     String?
  // Relations: users, customers, documents, beyannameTakip, etc.
}
```

#### User (Kullanici)
```prisma
model User {
  id             String   @id @default(uuid()) @db.Uuid
  email          String   @unique
  hashedPassword String?
  name           String
  role           String   @default("user") // owner, admin, user
  phoneNumber    String?
  tenantId       String   @db.Uuid
  @@map("user_profiles")
}
```

#### Customer (Mukellef)
```prisma
model Customer {
  id                       String   @id @default(uuid()) @db.Uuid
  unvan                    String
  kisaltma                 String?
  vknTckn                  String
  vergiKimlikNo            String?
  tcKimlikNo               String?
  vergiDairesi             String?
  sirketTipi               String   @default("sahis") // sahis, firma, basit_usul
  faaliyetKodu             String?
  sortOrder                Int      @default(0)
  email                    String?
  telefon1                 String?
  telefon2                 String?
  adres                    String?
  yetkiliKisi              String?
  gibKodu                  String?  // Encrypted
  gibSifre                 String?  // Encrypted
  gibParola                String?  // Encrypted
  interaktifSifre          String?  // Encrypted
  emuhurPin                String?  // Encrypted
  status                   String   @default("active")
  notes                    String?
  verilmeyecekBeyannameler String[] @default([])
  siraNo                   String?
  sozlesmeNo               String?
  sozlesmeTarihi           String?
  tenantId                 String   @db.Uuid
  @@unique([tenantId, vknTckn])
}
```

#### BeyannameTakip (Aylik Durum)
```prisma
model BeyannameTakip {
  id           String @id @default(uuid()) @db.Uuid
  year         Int
  month        Int
  customerId   String @db.Uuid
  beyannameler Json   @default("{}")
  tenantId     String @db.Uuid
  @@unique([customerId, year, month])
}
```

**BeyannameTakip JSON Format:**
```json
{
  "KDV1": { "status": "verildi", "meta": { "sentDate": "2024-01-15" } },
  "MUHSGK": { "status": "bos" },
  "GGECICI": { "status": "verilmeyecek" }
}
```

**Status values:** `bos`, `verildi`, `verilmeyecek`, `bekliyor`

#### Reminder (Animsaticilar & Notlar)
```prisma
model Reminder {
  id             String    @id @default(uuid()) @db.Uuid
  title          String
  description    String?
  type           String    @default("event") // "event" | "task"
  date           DateTime
  isAllDay       Boolean   @default(false)
  startTime      String?
  endTime        String?
  repeatPattern  String?   // daily, weekly, monthly, yearly
  repeatDays     String[]  @default([])
  repeatEndDate  DateTime?
  phoneNumber    String?
  sendWhatsApp   Boolean   @default(false)
  whatsappSentAt DateTime?
  status         String    @default("active")
  location       String?
  userId         String    @db.Uuid
  tenantId       String    @db.Uuid
  customerId     String?   @db.Uuid
  @@map("reminders")
}
```

### Supporting Models
- **Document** - Hierarchical file system
- **BeyannameTuru** - Tenant-specific beyanname types
- **BotSession** - Active bot tracking
- **License** - Bot kullanim lisansi
- **TakipKolon** - Dinamik kolon tanimlari
- **TakipSatir** - Satir verileri
- **Mail** - Mail module
- **Password** - Sifre yonetimi

---

## AUTHENTICATION

### Supabase Auth

**Server-Side:**
```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) { /* ... */ }
      }
    }
  );
}
```

**Client-Side:**
```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Admin Client (RLS bypass):**
```typescript
export function createAdminClient() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

### API Guard Pattern
```typescript
import { getUserWithProfile } from '@/lib/supabase/auth';

export async function GET(req: NextRequest) {
  const user = await getUserWithProfile();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantId = user.tenantId;
  // Query with tenantId filter
}
```

---

## GIB BOT KURALLARI

### Config: `src/lib/gib/config.ts`

```typescript
export const GIB_CONFIG = {
  LOGIN_URL: "https://dijital.gib.gov.tr/portal/login",
  SELECTORS: {
    USERID: "form#loginForm input#userid",
    PASSWORD: "form#loginForm input#sifre",
    BEYANNAME_ICON: 'img[src*="pdf_b.gif"]',
    TAHAKKUK_ICON: 'img[src*="pdf_t.gif"]',
  },
  TIMEOUTS: {
    PAGE_LOAD: 90000,
    ELEMENT_WAIT: 60000,
  },
  DELAYS: {
    BETWEEN_DOWNLOADS: 2000,
    PRE_CLICK_WAIT: 1500,
  }
};
```

### PDF Indirme (CRITICAL!)

**DOGRU Yontem:**
```typescript
// 1. Yeni sekme
const newPage = await browser.newPage();

// 2. Cookie ONCE yukle!
const cookies = await page.cookies();
await newPage.setCookie(...cookies);

// 3. PDF URL'ye git
await newPage.goto(pdfUrl);

// 4. Sayfa ici fetch (credentials:include)
const base64 = await newPage.evaluate(async (url) => {
  const res = await fetch(url, { credentials: 'include' });
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}, pdfUrl);

// 5. Sekmeyi kapat
await newPage.close();
```

**YANLIS (Node.js fetch) - 401 Unauthorized:**
```typescript
const response = await fetch(pdfUrl); // HATALI!
```

---

## API PATTERN'LERI

### 1. CRUD Template
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const user = await getUserWithProfile();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await prisma.customer.findMany({
    where: { tenantId: user.tenantId }
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getUserWithProfile();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const encrypted = body.password ? encrypt(body.password) : null;

  const item = await prisma.customer.create({
    data: { ...body, password: encrypted, tenantId: user.tenantId }
  });

  return NextResponse.json(item);
}
```

### 2. Server-Sent Events (SSE)
```typescript
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({ percent: 0, message: "Baslatiliyor..." });
        await runGibBot({
          onProgress: (percent, message) => send({ percent, message })
        });
        controller.close();
      } catch (error) {
        send({ error: error.message });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  });
}
```

### 3. Dynamic Route with ID
```typescript
// src/app/api/customers/[id]/route.ts
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserWithProfile();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, tenantId: user.tenantId }
  });

  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(customer);
}
```

---

## UI PATTERNS

### CVA + Radix Components
```tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary/90",
        destructive: "bg-red-500 text-white hover:bg-red-600"
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3 text-sm"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);
```

### Form Pattern (React Hook Form + Zod)
```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(1, "Baslik zorunlu"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function MyForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "" }
  });

  const onSubmit = async (data: FormData) => {
    await fetch('/api/endpoint', { method: 'POST', body: JSON.stringify(data) });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input {...form.register("title")} />
      {form.formState.errors.title && (
        <span>{form.formState.errors.title.message}</span>
      )}
    </form>
  );
}
```

### Dialog Pattern
```tsx
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

export function DeleteDialog({ customer }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await fetch(`/api/customers?id=${customer.id}`, { method: 'DELETE' });
      toast.success('Silindi');
      setOpen(false);
    } catch {
      toast.error('Hata');
    } finally {
      setLoading(false);
    }
  };

  return <Dialog open={open} onOpenChange={setOpen}>...</Dialog>;
}
```

---

## CRYPTO (AES-256-GCM)

```typescript
// src/lib/crypto.ts
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return JSON.stringify({
    iv: iv.toString('hex'),
    content: encrypted,
    tag: cipher.getAuthTag().toString('hex')
  });
}

export function decrypt(encryptedJson: string): string {
  const { iv, content, tag } = JSON.parse(encryptedJson);
  const decipher = crypto.createDecipheriv('aes-256-gcm', SECRET_KEY, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  let decrypted = decipher.update(content, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

---

## ROW LEVEL SECURITY (RLS)

```sql
-- Helper function
CREATE FUNCTION public.get_user_tenant_id()
RETURNS uuid AS $$
  SELECT "tenantId" FROM public.user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS Policy
CREATE POLICY "Tenant isolation" ON "Customer"
  FOR ALL TO authenticated
  USING ("tenantId" = public.get_user_tenant_id())
  WITH CHECK ("tenantId" = public.get_user_tenant_id());
```

---

## MODUL YAPILARI

### 1. Mukellefler (Customers)
- CRUD islemleri (`/api/customers`)
- Toplu silme (`/api/customers/bulk-delete`)
- Excel import (`/api/customers/import`)
- Credential yonetimi (`/api/customers/[id]/credentials`)
- Verilmeyecek beyannameler (`/api/customers/[id]/verilmeyecek`)

### 2. Beyanname Takip (Declaration Tracking)
- Aylik durum takibi (`/api/beyanname-takip`)
- Dinamik beyanname turleri (`/api/beyanname-turleri`)
- Status: `bos`, `verildi`, `verilmeyecek`, `bekliyor`

### 3. Takip Cizelgesi
- Dinamik kolonlar (`/api/takip/kolonlar`)
- Satir verileri (`/api/takip/satirlar`)
- Drag-drop siralama
- Boolean/Text/Number kolon tipleri

### 4. Dosya Yonetimi (Files)
- Hierarchical klasor yapisi
- PDF viewer
- Supabase Storage entegrasyonu
- Beyanname/Tahakkuk kategorileri

### 5. Animsaticilar & Notlar (Reminders)
- Event type: Animsaticilar (takvim bazli)
- Task type: Notlar (mukellef bazli)
- WhatsApp entegrasyonu
- Tekrarlama desenleri

### 6. GIB Bot
- Beyanname/Tahakkuk PDF indirme
- Mukellef senkronizasyonu
- Captcha cozumu
- WebSocket progress reporting

---

## ENVIRONMENT VARIABLES

```env
# Database
DATABASE_URL=                      # Supabase connection pooler
DIRECT_URL=                        # Supabase direct connection

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Security
ENCRYPTION_KEY=                    # 32-byte hex for AES-256-GCM
JWT_SECRET=                        # JWT signing secret

# Optional
CAPTCHA_API_KEY=                   # 2Captcha API key
```

---

## API ENDPOINTS

### Auth
| Method | Endpoint | Aciklama |
|--------|----------|----------|
| POST | `/api/auth/register` | Yeni kullanici kaydi |
| POST | `/api/auth/token` | JWT token olusturma |
| POST | `/api/auth/electron-login` | Electron app login |

### Customers
| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET/POST | `/api/customers` | Liste/Olustur |
| GET/PUT/DELETE | `/api/customers/[id]` | Detay/Guncelle/Sil |
| POST | `/api/customers/import` | Excel import |
| POST | `/api/customers/bulk-delete` | Toplu silme |
| GET/PUT | `/api/customers/[id]/credentials` | Sifre yonetimi |

### Beyanname Takip
| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET/POST/PUT | `/api/beyanname-takip` | Takip islemleri |
| GET/POST | `/api/beyanname-turleri` | Beyanname turleri |

### Takip Cizelgesi
| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET/POST/PUT/DELETE | `/api/takip/kolonlar` | Kolon yonetimi |
| GET/POST/PUT | `/api/takip/satirlar` | Satir yonetimi |

### Files
| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET/POST/DELETE | `/api/files` | Dosya islemleri |
| GET | `/api/files/view` | Dosya goruntuleme |
| GET | `/api/files/download` | Dosya indirme |

### Reminders
| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET/POST | `/api/reminders` | Liste/Olustur |
| GET/PUT/DELETE | `/api/reminders/[id]` | Detay/Guncelle/Sil |

### GIB Bot
| Method | Endpoint | Aciklama |
|--------|----------|----------|
| POST | `/api/gib/sync` | Bot calistirma |
| POST | `/api/gib/process-results` | Sonuc isleme |
| POST | `/api/gib/mukellefler/sync` | Mukellef sync |

### Settings
| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET/PUT | `/api/settings/gib` | GIB ayarlari |
| GET/PUT | `/api/settings/turmob` | TURMOB ayarlari |

---

## YASAKLAR (KRITIK!)

### ASLA Yapma:

**1. Tenant Filter Eksik**
```typescript
// ❌ YANLIS
await prisma.customer.findMany();

// ✅ DOGRU
await prisma.customer.findMany({ where: { tenantId: user.tenantId } });
```

**2. Plain Text Credentials**
```typescript
// ❌ YANLIS
gibSifre: "password123"

// ✅ DOGRU
gibSifre: encrypt("password123")
```

**3. Barrel Import (200-800ms overhead!)**
```typescript
// ❌ YANLIS
import { Button, Dialog, Input } from "@/components/ui";

// ✅ DOGRU
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
```

**4. Waterfall Pattern**
```typescript
// ❌ YANLIS
const customers = await fetch('/api/customers');
const beyannameler = await fetch('/api/beyanname-takip');

// ✅ DOGRU
const [customers, beyannameler] = await Promise.all([
  fetch('/api/customers'),
  fetch('/api/beyanname-takip')
]);
```

**5. Virtual Scrolling Olmadan Buyuk Liste**
```typescript
// ❌ YANLIS (500+ row)
<Table>{customers.map(c => <Row key={c.id} />)}</Table>

// ✅ DOGRU
import { useVirtualizer } from '@tanstack/react-virtual';
```

**6. any Type**
```typescript
// ❌ YANLIS
const data: any = {};

// ✅ DOGRU
interface MyData { id: string; name: string; }
const data: MyData = { id: "1", name: "Test" };
```

**7. Node.js Fetch for PDF**
```typescript
// ❌ YANLIS - 401 Unauthorized!
const res = await fetch(pdfUrl);

// ✅ DOGRU - Cookie + page.evaluate
```

---

## HER ZAMAN Yap:

1. Auth check her API'de
2. Tenant filter her query'de
3. Encrypt hassas data
4. Error handling (try/catch)
5. Loading states
6. TypeScript strict mode
7. Zod validation for forms
8. Direct import (barrel YASAK)
9. Paralel fetch (waterfall YASAK)
10. Virtual scrolling (500+ satir)
11. React.memo, useMemo, useCallback
12. Dynamic import (agir components)

---

## GELISTIRME KURALLARI

### 1. Cift Tarafli Kontrol
- Kodun dogrulugunu **iki kez** kontrol et
- Unit test mantigi ile dusun
- Kodlamayi bitirmeden once manuel review yap

### 2. Kullaniciya Soru Sor
Belirsiz durumlarda **HER ZAMAN** soru sor:
- Veritabani schema degisiklikleri
- API endpoint tasarimi
- UI/UX kararlari
- Is mantigi degisiklikleri
- Guvenlik konulari

### 3. Scale-First Yaklasim

**N+1 Query Problemi:**
```typescript
// ❌ 1000 musteride 1001 query!
for (const c of customers) {
  await prisma.document.findMany({ where: { customerId: c.id } });
}

// ✅ Include kullan
const customers = await prisma.customer.findMany({
  include: { documents: true }
});
```

**Memory Overflow:**
```typescript
// ❌ 100.000 kayit memory'e sigmaz!
const allData = await prisma.customer.findMany();

// ✅ Pagination kullan
const data = await prisma.customer.findMany({
  skip: page * pageSize,
  take: pageSize
});
```

**Blocking Operation:**
```typescript
// ❌ 10 dakika surebilir, UI donacak!
await processAllCustomers();

// ✅ Background job + WebSocket progress
await queueJob('process-customers', { batchSize: 100 });
```

### Scale Kontrol Listesi:
- [ ] Database query'ler optimize mi?
- [ ] N+1 query problemi var mi?
- [ ] Memory-safe mi? (streaming, pagination)
- [ ] Async islemler dogru handle ediliyor mu?
- [ ] Rate limiting dusunuldu mu?
- [ ] Caching stratejisi var mi?

### 4. Performans Ilkeleri

```typescript
// Database Index
@@index([tenantId])
@@index([tenantId, status])
@@index([year, month])

// Lazy Loading
const { data } = useSWR(shouldFetch ? '/api/data' : null);

// Debounce
const debouncedSearch = useMemo(
  () => debounce((term) => search(term), 300),
  []
);
```

---

## VERCEL SKILLS (ZORUNLU!)

### Skill Konumu
`.claude/skills/` klasorunde:
- `react-best-practices/` - 40+ React/Next.js performans kurali
- `vercel-deploy-claimable/` - Tek tikla Vercel deployment
- `vercel-design-guidelines/` - UI/UX audit metodolojisi

### Zorunlu Kurallar

**Component Yazimi:**
- Bundle size optimizasyonu (barrel import YASAK)
- Dynamic import (agir component'ler)
- Re-render optimizasyonu (React.memo, useMemo, useCallback)

**API Route Yazimi:**
- Waterfall eliminasyonu (paralel fetch)
- React.cache() ile per-request deduplication

**Dashboard/Tablo:**
- Virtual scrolling (500+ satir)
- Suspense boundaries
- Progressive loading

**Detay:** `.claude/skills/react-best-practices/references/rules/*.md`

---

## CONTINUOUS CLAUDE V3

### Critical Skills

| Skill | Kullanim | Aciklama |
|-------|----------|----------|
| `/workflow` | Hedef router | Nereden baslayacagini bilmiyorsan |
| `/build` | Feature development | greenfield/brownfield/tdd/refactor |
| `/fix` | Bug fix | bug/hook/deps/pr-comments |
| `/explore` | Codebase exploration | quick/deep/architecture |
| `/premortem` | Risk analizi | Production deploy oncesi |
| `/tdd` | Test-driven development | Critical features |
| `/security` | Guvenlik audit | Hassas data |

### Workflow Ornekleri

```bash
# Yeni ozellik
> /build greenfield "Musteri Excel export"

# Bug fix
> /fix bug "GIB PDF 401 hatasi"

# Kod kesfet
> /explore quick "src/lib/gib/"

# Risk analizi
> /premortem "GIB bot production deployment"
```

### Custom Skills (SMMM-AI)

**`/gib-workflow`** - GIB Bot Workflow
- Trigger: "GIB bot", "PDF indirme", "beyanname download"
- Debug: sleuth → TLDR cfg → Memory recall → Fix
- Feature: scout → TLDR → Premortem → Plan → TDD

**`/beyanname-analysis`** - Beyanname Takip
- Trigger: "beyanname takip", "MUHSGK", "KDV1"
- TLDR search → DFG → Schema analysis

### Critical Agents

| Agent | Kategori | Kullanim |
|-------|----------|----------|
| `scout` | Explorer | Codebase exploration |
| `sleuth` | Debugger | Bug investigation |
| `kraken` | Implementer | TDD implementation |
| `architect` | Planner | Feature planning |
| `phoenix` | Planner | Refactoring |
| `arbiter` | Validator | Test validation |
| `oracle` | Explorer | External research |

### Custom Agents (SMMM-AI)

**`gib-debugger`** - GIB Bot Hata Ayiklayici
- GIB bot bug'lari, PDF indirme sorunlari
- 401 Unauthorized → Cookie transfer eksik
- Timeout → Selector degismis
- Captcha fails → API key sorunu

**`prisma-schema-guardian`** - Veritabani Koruyucu
- Prisma schema degisikligi, migration oncesi
- ASLA tenantId cikarma
- HER ZAMAN @@index([tenantId])
- RLS policy guncelle

### Hook Sistemi

| Hook | Event | Islem |
|------|-------|-------|
| `tldr-read-enforcer` | PreToolUse | %95 token tasarrufu |
| `post-edit-diagnostics` | PostToolUse | Otomatik type-check |
| `memory-awareness` | UserPromptSubmit | Gecmis cozumleri hatirla |
| `skill-activation-prompt` | UserPromptSubmit | Skill tetikleme |
| `pre-compact-continuity` | PreCompact | Otomatik handoff |

### Kullanim Kurallari

**1. TLDR Ile Basla:**
```bash
# Buyuk dosya okumadan once
> tldr structure src/lib/gib/ --lang typescript
> tldr search "PDF download" src/lib/gib/
```

**2. Gun Sonunda Handoff:**
```bash
> "Done for today"
> /handoff

# Yarin devam
> "Resume where we left off"
> /resume
```

**3. Deploy Oncesi Premortem:**
```bash
> /premortem "GIB bot production deployment"
# Risk degerlendirmesi sonrasi deploy
```

**4. Workflow Kullan:**
```bash
# Tek tek agent cagirama
> /build greenfield "Yeni ozellik"
# Otomatik zincir: scout → plan → kraken → arbiter
```

---

## REFERANS DOSYALARI

| Dosya | Aciklama |
|-------|----------|
| `prisma/schema.prisma` | 20 model (PostgreSQL) |
| `src/lib/gib/bot.ts` | GIB Bot core |
| `src/lib/gib/config.ts` | GIB selectors & timeouts |
| `src/lib/turmob/bot.ts` | TURMOB Bot |
| `src/lib/constants/beyanname-types.ts` | 30+ beyanname types |
| `src/lib/supabase/server.ts` | Supabase SSR client |
| `src/lib/supabase/auth.ts` | Auth helpers |
| `src/lib/crypto.ts` | AES-256-GCM encryption |
| `src/components/kontrol/kontrol-client.tsx` | Tracking UI |
| `src/components/reminders/reminders-page.tsx` | Reminders |
| `src/components/takip/takip-cizelgesi.tsx` | Takip table |
| `server.ts` | WebSocket server |
| `.claude/skills/react-best-practices/` | Performans kurallari |

---

## KOD STANDARTLARI

### DO:
```typescript
// Type inference
const customers: Customer[] = [];

// Interfaces
interface Customer { id: string; name: string; }

// Error handling
try {
  const result = await operation();
} catch (error) {
  console.error('[Module] Error:', error);
}

// Async/await
const data = await prisma.customer.findMany({ where: { tenantId } });

// Optional chaining
const name = customer?.name ?? 'Unknown';
```

### DON'T:
```typescript
// No any
const data: any = {};

// No plain text credentials
gibSifre: "password123"

// No callback hell
fetch().then().then().then()

// No console.log in production
console.log('debug')
```

---

## LANGUAGE

All user-facing text, comments, and documentation should be in **Turkish**.

---

---

## BEYANNAME TURLERI

### Standart Beyannameler

| Kod | Beyanname | Aciklama |
|-----|-----------|----------|
| KDV1 | KDV Beyannamesi 1 | Aylik KDV beyannamesi |
| KDV2 | KDV Beyannamesi 2 | Uc aylik KDV beyannamesi |
| MUHSGK | Muhtasar ve Prim Hizmet Beyannamesi | Aylik/3 aylik |
| GGECICI | Gelir Gecici Vergi | 3 aylik |
| KGECICI | Kurumlar Gecici Vergi | 3 aylik |
| YILLIKGELIR | Yillik Gelir Vergisi | Yillik |
| YILLIKKURUMLAR | Yillik Kurumlar Vergisi | Yillik |
| DAMGA | Damga Vergisi | Aylik |
| BA | Form BA | Alinan mallar |
| BS | Form BS | Satilan mallar |
| KONAKLAMA | Konaklama Vergisi | Aylik |
| TURIZM | Turizm Payi | Aylik |
| SORUMLU | Sorumlu Sifatiyla KDV | Aylik |
| KDV9015 | KDV Tevkifat | Aylik |
| INDIRIMLI | Indirimli Oran KDV | Yillik |

### Status Degerleri
```typescript
type BeyannameDurum = 'bos' | 'verildi' | 'verilmeyecek' | 'bekliyor';

interface BeyannameMeta {
  status: BeyannameDurum;
  meta?: {
    sentDate?: string;
    amount?: number;
    notes?: string;
  };
}
```

---

## DOSYA YONETIMI

### Klasor Yapisi
```
storage/tenants/{tenantId}/{customerId}/
├── beyannameler/
│   ├── 2024/
│   │   ├── 01/
│   │   │   ├── KDV1_BEYANNAME.pdf
│   │   │   └── KDV1_TAHAKKUK.pdf
│   │   └── 02/
│   └── 2025/
├── tahakkuklar/
├── sozlesmeler/
└── diger/
```

### Dosya Kategorileri
| Kategori | Aciklama |
|----------|----------|
| BEYANNAME | PDF beyanname dosyalari |
| TAHAKKUK | Tahakkuk belgeleri |
| HIZMET_LISTESI | SGK hizmet listeleri |
| SGK_TAHAKKUK | SGK tahakkuk belgeleri |
| SOZLESME | Mukellef sozlesmeleri |
| FATURA | Fatura gorselleri |
| DIGER | Diger belgeler |

### Supabase Storage
```typescript
// Upload
const { data, error } = await supabase.storage
  .from('documents')
  .upload(`${tenantId}/${customerId}/${filename}`, file);

// Download URL
const { data: { publicUrl } } = supabase.storage
  .from('documents')
  .getPublicUrl(path);

// Delete
await supabase.storage
  .from('documents')
  .remove([path]);
```

---

## WEBSOCKET SERVER

### Server Yapisi (server.ts)
```typescript
import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 3001 });

interface Client {
  ws: WebSocket;
  tenantId: string;
  userId: string;
}

const clients = new Map<string, Client>();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  // Verify JWT and extract user info
  const decoded = verifyToken(token);

  clients.set(decoded.id, { ws, tenantId: decoded.tenantId, userId: decoded.id });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    handleMessage(ws, message);
  });

  ws.on('close', () => {
    clients.delete(decoded.id);
  });
});

// Broadcast to tenant
function broadcastToTenant(tenantId: string, data: object) {
  clients.forEach((client) => {
    if (client.tenantId === tenantId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  });
}
```

### Bot Progress Reporting
```typescript
// Bot tarafindan
function reportProgress(tenantId: string, percent: number, message: string) {
  broadcastToTenant(tenantId, {
    type: 'BOT_PROGRESS',
    payload: { percent, message }
  });
}

// Client tarafinda
const ws = new WebSocket(`ws://localhost:3001?token=${token}`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'BOT_PROGRESS') {
    setProgress(data.payload.percent);
    setMessage(data.payload.message);
  }
};
```

---

## TAKIP CIZELGESI

### Dinamik Kolon Sistemi

```typescript
interface TakipKolon {
  id: string;
  name: string;
  type: 'text' | 'boolean' | 'number' | 'date';
  width: number;
  order: number;
  tenantId: string;
}

interface TakipSatir {
  id: string;
  customerId: string;
  values: Record<string, string | boolean | number>;
  tenantId: string;
}
```

### Kolon Tipleri
| Tip | Aciklama | Deger Ornegi |
|-----|----------|--------------|
| text | Metin | "Tamamlandi" |
| boolean | Checkbox | true/false |
| number | Sayi | 1500.50 |
| date | Tarih | "2024-01-15" |

### API Kullanimi
```typescript
// Kolon ekle
POST /api/takip/kolonlar
{ "name": "Vergi Borcu", "type": "number", "width": 120 }

// Satir guncelle
PUT /api/takip/satirlar
{ "customerId": "...", "columnId": "...", "value": 1500.50 }
```

---

## ELECTRON BOT

```
electron-bot/
├── main.ts              # Electron main process
├── preload.ts           # Preload script
├── renderer/            # React UI
├── bot/                 # Bot runners (gib, turmob)
└── utils/browser.ts     # Puppeteer management
```

### Captcha Cozumu (2Captcha)
```typescript
export async function solveCaptcha(imageBase64: string): Promise<string> {
  const apiKey = process.env.CAPTCHA_API_KEY;
  // Submit -> Poll -> Return solution
  // Detay: src/lib/gib/captcha.ts
}
```

---

## WHATSAPP ENTEGRASYONU

```typescript
// src/lib/whatsapp/sender.ts
export async function sendWhatsAppReminder(reminder: Reminder): Promise<void> {
  // Whapi.cloud API ile mesaj gonder
  await fetch('https://gate.whapi.cloud/messages/text', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_API_KEY}` },
    body: JSON.stringify({ to: `90${phone}@s.whatsapp.net`, body: message })
  });
  // Update: whatsappSentAt = new Date()
}
```

**Cron Job:** Gunluk, sendWhatsApp=true ve whatsappSentAt=null olanlari gonder

---

## PERFORMANS OPTIMIZASYONU

### Database Index Stratejisi
```prisma
// Her tabloda tenant isolation
@@index([tenantId])

// Sikca filtrelenen alanlar
@@index([tenantId, status])
@@index([tenantId, customerId])

// Tarih bazli sorgular
@@index([year, month])
@@index([date])

// Unique constraints
@@unique([tenantId, vknTckn])
@@unique([customerId, year, month])
```

### React Optimizasyonu
```tsx
// Memoization
const MemoizedRow = React.memo(CustomerRow, (prev, next) =>
  prev.customer.id === next.customer.id &&
  prev.customer.updatedAt === next.customer.updatedAt
);

// useMemo for expensive calculations
const filteredCustomers = useMemo(() =>
  customers.filter(c => c.status === 'active'),
  [customers]
);

// useCallback for stable references
const handleDelete = useCallback((id: string) => {
  deleteCustomer(id);
}, [deleteCustomer]);

// Virtual scrolling for large lists
const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48,
  overscan: 5
});
```

### API Optimizasyonu
- **Paralel fetch:** `Promise.all([fetch1, fetch2, fetch3])`
- **N+1 onleme:** `include: { documents: true }`
- **Pagination:** `skip: (page-1)*size, take: size`

---

## HATA YONETIMI

### API Error Handling
```typescript
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await prisma.customer.findMany({
      where: { tenantId: user.tenantId }
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Customers API] Error:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### Client Error Handling
- try/catch + toast.error + setLoading pattern
- response.ok kontrolu + error.message

### Bot Error Recovery
- maxRetries = 3, exponential backoff
- Her attempt sonrasi sleep(5000 * attempt)

---

> **v5.0.0** | Supabase PostgreSQL + RLS | Next.js 15 + React 19 | Continuous Claude v3
