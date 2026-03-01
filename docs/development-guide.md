# SMMM-AI Geliştirme Kılavuzu

> **Son Güncelleme:** 2026-01-29
> **Node.js Gereksinimi:** >= 20.x

---

## 🚀 Hızlı Başlangıç

### Gereksinimler

- Node.js >= 20.x
- npm veya yarn
- PostgreSQL (Supabase)
- Git

### Kurulum

```bash
# Repository'yi klonla
git clone <repo-url>
cd smmm_asistan

# Bağımlılıkları yükle
npm install

# Prisma client oluştur
npm run db:generate

# .env dosyasını oluştur
cp .env.example .env
# .env dosyasını düzenle
```

### Ortam Değişkenleri

```env
# Database (Supabase)
DATABASE_URL=postgresql://...?pgbouncer=true
DIRECT_URL=postgresql://...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Security
ENCRYPTION_KEY=32-byte-hex-string
JWT_SECRET=your-jwt-secret

# Optional
CAPTCHA_API_KEY=           # 2Captcha
WHATSAPP_API_KEY=          # Whapi.cloud
```

---

## 💻 Geliştirme Komutları

### Ana Komutlar

```bash
# Development server (WebSocket + Next.js)
npm run dev

# Sadece Next.js
npm run dev:next

# Turbopack ile (daha hızlı)
npm run dev:turbo

# Full stack (Server + Electron + App)
npm run dev:all

# Production build
npm run build

# Production server
npm run start

# Type check (watch mode)
npm run type-check

# Linting
npm run lint
npm run lint:fix
```

### Veritabanı Komutları

```bash
# Prisma client oluştur
npm run db:generate

# Schema'yı database'e gönder
npm run db:push

# Prisma Studio GUI
npm run db:studio
```

### Temizlik

```bash
# Cache temizle
npm run clean

# Sadece Prisma cache
npm run clean:prisma
```

---

## 📁 Proje Yapısı

```
smmm_asistan/
├── prisma/
│   └── schema.prisma          # Veritabanı şeması
├── server.ts                  # WebSocket server
├── src/
│   ├── app/
│   │   ├── (auth)/            # Auth sayfaları
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/       # Dashboard sayfaları
│   │   │   └── dashboard/
│   │   │       ├── mukellefler/
│   │   │       ├── kontrol/
│   │   │       ├── dosyalar/
│   │   │       └── ...
│   │   ├── api/               # API Route Handlers
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Global stiller
│   ├── components/
│   │   ├── ui/                # Radix UI primitives
│   │   └── [feature]/         # Feature bileşenleri
│   ├── lib/
│   │   ├── supabase/          # Auth clients
│   │   ├── crypto.ts          # Şifreleme
│   │   └── db.ts              # Prisma client
│   ├── hooks/                 # Custom hooks
│   ├── context/               # React contexts
│   ├── providers/             # Global providers
│   └── types/                 # TypeScript types
├── electron-bot/              # Electron bot (ayrı proje)
└── docs/                      # Dokümantasyon
```

---

## 🔧 Kod Standartları

### 1. Import Kuralları

```typescript
// ❌ YANLIŞ - Barrel import (yavaş)
import { Button, Dialog, Input } from "@/components/ui";

// ✅ DOĞRU - Direct import
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
```

### 2. API Route Pattern

```typescript
// src/app/api/[resource]/route.ts
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // 1. Auth check - HER ZAMAN!
  const user = await getUserWithProfile();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Tenant filter - HER ZAMAN!
  const data = await prisma.customers.findMany({
    where: { tenantId: user.tenantId }
  });

  return NextResponse.json(data);
}
```

### 3. Dynamic Route Pattern

```typescript
// src/app/api/customers/[id]/route.ts
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserWithProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;  // Next.js 15'te Promise

  const customer = await prisma.customers.findFirst({
    where: { id, tenantId: user.tenantId }  // Tenant filter!
  });

  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(customer);
}
```

### 4. Supabase Client Kullanımı

```typescript
// Server-side (API routes, Server Components)
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();

// Client-side (Client Components)
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

// Admin (RLS bypass - dikkatli kullan!)
import { createAdminClient } from "@/lib/supabase/server";
const supabase = createAdminClient();
```

### 5. Şifreleme

```typescript
import { encrypt, decrypt } from "@/lib/crypto";

// Kayıt ederken
const encryptedPassword = encrypt(plainPassword);

// Okurken
const plainPassword = decrypt(encryptedPassword);
```

---

## ⚠️ Yasaklar (Kritik!)

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

### 3. N+1 Query
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

### 5. any Type
```typescript
// ❌ YANLIŞ
const data: any = {};

// ✅ DOĞRU
interface MyData { id: string; name: string; }
const data: MyData = { id: "1", name: "Test" };
```

---

## 🎯 İş Kuralları

### Beyanname Dönem Kuralı

Mali müşavirlik mesleğinde beyannameler **bir önceki ay** için verilir.

```typescript
// ❌ YANLIŞ - Mevcut ayı gösterir
const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

// ✅ DOĞRU - Bir önceki ayı gösterir
let previousMonth = now.getMonth();  // 0-indexed, yani bir önceki ay
let previousYear = now.getFullYear();
if (previousMonth === 0) {
  previousMonth = 12;
  previousYear -= 1;
}
const [selectedMonth, setSelectedMonth] = useState(previousMonth);
```

### GİB Bot PDF İndirme

```typescript
// ❌ YANLIŞ - 401 Unauthorized!
const response = await fetch(pdfUrl);

// ✅ DOĞRU - Cookie + page.evaluate
const newPage = await browser.newPage();
const cookies = await page.cookies();
await newPage.setCookie(...cookies);
await newPage.goto(pdfUrl);

const base64 = await newPage.evaluate(async (url) => {
  const res = await fetch(url, { credentials: 'include' });
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}, pdfUrl);

await newPage.close();
```

---

## 🧩 Component Oluşturma

### Yeni Feature Module

```typescript
// src/components/[feature]/[feature]-module.tsx
"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FeatureData {
  id: string;
  name: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function FeatureModule() {
  const { data, error, isLoading, mutate } = useSWR<FeatureData[]>(
    '/api/feature',
    fetcher
  );

  if (isLoading) return <div>Yükleniyor...</div>;
  if (error) return <div>Hata oluştu</div>;

  return (
    <Card>
      {/* Content */}
    </Card>
  );
}
```

### Yeni API Route

```typescript
// src/app/api/feature/route.ts
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const user = await getUserWithProfile();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await prisma.feature.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Feature GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserWithProfile();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const item = await prisma.feature.create({
      data: { ...body, tenantId: user.tenantId }
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Feature POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

---

## 📊 Performans Optimizasyonu

### React Memoization

```typescript
// Component memoization
export default React.memo(MyComponent);

// Expensive calculations
const sortedData = useMemo(() => sortData(data), [data]);

// Stable callbacks
const handleClick = useCallback(() => { ... }, [deps]);
```

### Virtual Scrolling (500+ satır)

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 35,
});
```

### Dynamic Import

```typescript
// Ağır component'ler için
const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <Skeleton />,
  ssr: false
});
```

---

## 🐛 Debug

### Server Logs

```bash
# Development server logları
npm run dev

# WebSocket mesajları [WS] prefix ile
# API hataları console.error ile
```

### Prisma Debug

```bash
# Prisma query logging
DATABASE_URL="..." npx prisma studio
```

### Browser DevTools

- Network tab: API istekleri
- Console: Client-side hatalar
- Application > Cookies: Session

---

## 📚 İlgili Dokümantasyon

- [Proje Genel Bakışı](./project-overview.md)
- [Mimari](./architecture-main.md)
- [Veri Modelleri](./data-models.md)
- [API Kontratları](./api-contracts.md)
- [CLAUDE.md](../CLAUDE.md) - Detaylı kodlama rehberi
