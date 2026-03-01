# Finansal Islemler Modulu - Mimari Dokumani

**Version:** 1.0.0
**Tarih:** 2026-02-12
**PRD Referansi:** prd-finansal-islemler.md
**Mimar:** Winston (BMAD Architect)

---

## 1. Mimari Genel Bakis

### 1.1 Sistem Mimarisi

```
┌──────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 15)              │
│                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐   │
│  │ Muhasebe    │ │ Tahsilatlar │ │ Hizmetler    │   │
│  │ Ucretleri   │ │             │ │              │   │
│  └──────┬──────┘ └──────┬──────┘ └──────┬───────┘   │
│  ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴───────┐   │
│  │ Giderler    │ │ Istatistik  │ │ Hesap Dokumu │   │
│  └──────┬──────┘ └──────┬──────┘ └──────┬───────┘   │
│         └───────────────┼───────────────┘            │
│                         ▼                            │
│              ┌─────────────────────┐                 │
│              │    Finance Hooks    │                 │
│              │  (React Query/SWR)  │                 │
│              └──────────┬──────────┘                 │
│                         │                            │
├─────────────────────────┼────────────────────────────┤
│                    API LAYER                         │
│                         ▼                            │
│  ┌─────────────────────────────────────────────┐     │
│  │        /api/finance/* (35+ endpoint)        │     │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ │     │
│  │  │categories │ │cost-defs  │ │transactions│ │     │
│  │  └───────────┘ └───────────┘ └───────────┘ │     │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ │     │
│  │  │  checks   │ │ expenses  │ │   stats   │ │     │
│  │  └───────────┘ └───────────┘ └───────────┘ │     │
│  │  ┌───────────┐ ┌───────────┐               │     │
│  │  │ settings  │ │  export   │               │     │
│  │  └───────────┘ └───────────┘               │     │
│  └──────────────────┬──────────────────────────┘     │
│                     │                                │
├─────────────────────┼────────────────────────────────┤
│                DATA LAYER                            │
│                     ▼                                │
│  ┌──────────────────────────────────────────┐        │
│  │          Prisma ORM (6 yeni model)       │        │
│  │                                          │        │
│  │  FinanceCategory  CostDefinition         │        │
│  │  FinancialTransaction  Check             │        │
│  │  Expense  AutoChargeLog                  │        │
│  └──────────────────┬───────────────────────┘        │
│                     │                                │
│  ┌──────────────────┼───────────────────────┐        │
│  │     Supabase PostgreSQL + RLS            │        │
│  │                  │                       │        │
│  │     pg_cron ─────┘ (otomatik borclndirma)│        │
│  └──────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────┘
```

### 1.2 Tasarim Prensipleri

| Prensip | Aciklama |
|---------|----------|
| **Merkezi Ledger** | Tum para hareketleri FinancialTransaction'a duser |
| **Dinamik Kategori** | Sabit enum yerine veritabani bazli kategoriler |
| **Template-Instance** | CostDefinition = sablon, FinancialTransaction = instance |
| **State Machine** | Cek durum gecisleri kontrol altinda |
| **Idempotent Cron** | Otomatik borclndirma tekrar calistirmada cift kayit olmaz |
| **Contextual Settings** | Ayarlar ilgili sayfada, global ayar yok |
| **Multi-Tenant** | Her query'de tenantId filtresi |

---

## 2. Veri Modeli (Prisma Schema)

### 2.1 Enum Tanimlari

```prisma
enum Currency {
  TRY
  USD
  EUR
}

enum Frequency {
  MONTHLY
  QUARTERLY
  BIANNUAL
  ANNUAL
  ONE_TIME
}

enum ChargeStrategy {
  FULL
  DISTRIBUTED
}

enum TransactionType {
  DEBIT   // borc (mukellefe yansitilan)
  CREDIT  // alacak (tahsilat)
}

enum TransactionStatus {
  PENDING
  COMPLETED
  PARTIAL
  CANCELLED
}

enum PaymentMethod {
  CASH
  BANK_TRANSFER
  EFT
  CHECK
  CREDIT_CARD
}

enum CheckStatus {
  IN_PORTFOLIO
  COLLECTED
  BOUNCED
  RETURNED
}

enum FinanceCategoryType {
  INCOME
  EXPENSE
}

enum AutoChargeStatus {
  SUCCESS
  FAILED
}

enum RecurringFrequency {
  MONTHLY
  QUARTERLY
  ANNUAL
}
```

### 2.2 Model Tanimlari

```prisma
model FinanceCategory {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  type      FinanceCategoryType
  isDefault Boolean  @default(false)
  color     String?
  icon      String?
  tenantId  String   @db.Uuid

  costDefinitions       CostDefinition[]
  financialTransactions FinancialTransaction[]
  expenses              Expense[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, name, type])
  @@index([tenantId])
}

model CostDefinition {
  id              String         @id @default(uuid()) @db.Uuid
  customerId      String         @db.Uuid
  categoryId      String         @db.Uuid
  description     String?
  amount          Decimal        @db.Decimal(12, 2)
  currency        Currency       @default(TRY)
  frequency       Frequency
  chargeStrategy  ChargeStrategy @default(FULL)
  hasSMM          Boolean        @default(true)
  kdvRate         Decimal?       @db.Decimal(5, 2)
  stopajRate      Decimal?       @db.Decimal(5, 2)
  startDate       DateTime
  endDate         DateTime?
  isActive        Boolean        @default(true)
  tenantId        String         @db.Uuid

  customer        Customer         @relation(fields: [customerId], references: [id])
  category        FinanceCategory  @relation(fields: [categoryId], references: [id])
  transactions    FinancialTransaction[]
  autoChargeLogs  AutoChargeLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId, customerId])
  @@index([tenantId, isActive])
}

model FinancialTransaction {
  id                  String            @id @default(uuid()) @db.Uuid
  customerId          String?           @db.Uuid
  costDefinitionId    String?           @db.Uuid
  categoryId          String            @db.Uuid
  type                TransactionType
  amount              Decimal           @db.Decimal(12, 2)
  currency            Currency          @default(TRY)
  exchangeRate        Decimal?          @db.Decimal(10, 4)
  originalAmount      Decimal?          @db.Decimal(12, 2)
  grossAmount         Decimal?          @db.Decimal(12, 2)
  kdvAmount           Decimal?          @db.Decimal(12, 2)
  stopajAmount        Decimal?          @db.Decimal(12, 2)
  netAmount           Decimal           @db.Decimal(12, 2)
  description         String?
  date                DateTime
  dueDate             DateTime?
  paymentMethod       PaymentMethod?
  checkId             String?           @db.Uuid
  status              TransactionStatus @default(PENDING)
  parentTransactionId String?           @db.Uuid
  autoGenerated       Boolean           @default(false)
  tenantId            String            @db.Uuid

  customer         Customer?              @relation(fields: [customerId], references: [id])
  costDefinition   CostDefinition?        @relation(fields: [costDefinitionId], references: [id])
  category         FinanceCategory        @relation(fields: [categoryId], references: [id])
  check            Check?                 @relation(fields: [checkId], references: [id])
  parentTransaction FinancialTransaction? @relation("PartialPayments", fields: [parentTransactionId], references: [id])
  childTransactions FinancialTransaction[] @relation("PartialPayments")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId, customerId, date])
  @@index([tenantId, status])
  @@index([tenantId, type, date])
  @@index([tenantId, categoryId])
}

model Check {
  id          String      @id @default(uuid()) @db.Uuid
  checkNumber String?
  bankName    String?
  amount      Decimal     @db.Decimal(12, 2)
  currency    Currency    @default(TRY)
  issueDate   DateTime
  dueDate     DateTime
  status      CheckStatus @default(IN_PORTFOLIO)
  customerId  String      @db.Uuid
  note        String?
  tenantId    String      @db.Uuid

  customer     Customer              @relation(fields: [customerId], references: [id])
  transactions FinancialTransaction[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId, dueDate])
  @@index([tenantId, status])
}

model Expense {
  id                  String              @id @default(uuid()) @db.Uuid
  categoryId          String              @db.Uuid
  amount              Decimal             @db.Decimal(12, 2)
  currency            Currency            @default(TRY)
  date                DateTime
  description         String?
  isRecurring         Boolean             @default(false)
  recurringFrequency  RecurringFrequency?
  tenantId            String              @db.Uuid

  category FinanceCategory @relation(fields: [categoryId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId, date])
  @@index([tenantId, categoryId])
}

model AutoChargeLog {
  id               String           @id @default(uuid()) @db.Uuid
  costDefinitionId String           @db.Uuid
  transactionId    String?          @db.Uuid
  period           String           // "2026-02"
  status           AutoChargeStatus
  errorMessage     String?
  executedAt       DateTime         @default(now())
  tenantId         String           @db.Uuid

  costDefinition CostDefinition @relation(fields: [costDefinitionId], references: [id])

  @@unique([costDefinitionId, period])
  @@index([tenantId])
}
```

### 2.3 Mevcut Model Degisiklikleri

```prisma
// Tenant modeline ekleme
model Tenant {
  // ... mevcut alanlar
  financialDefaults Json? // { hasSMM, defaultKdvRate, defaultStopajRate, autoChargeEnabled, autoChargeDay }
}

// Customer modeline ekleme (iliskiler)
model Customer {
  // ... mevcut alanlar
  costDefinitions       CostDefinition[]
  financialTransactions FinancialTransaction[]
  checks                Check[]
}
```

---

## 3. API Mimarisi

### 3.1 Dizin Yapisi

```
src/app/api/finance/
├── categories/
│   ├── route.ts                    # GET (list), POST (create)
│   └── [id]/
│       └── route.ts                # GET, PUT, DELETE
├── cost-definitions/
│   ├── route.ts                    # GET (list), POST (create)
│   ├── bulk/
│   │   └── route.ts                # POST (toplu maliyet tanimi)
│   └── [id]/
│       └── route.ts                # GET, PUT, DELETE
├── transactions/
│   ├── route.ts                    # GET (list), POST (create)
│   ├── collect/
│   │   └── route.ts                # POST (coklu tahsilat)
│   ├── pending/
│   │   └── [customerId]/
│   │       └── route.ts            # GET (bekleyen borclar)
│   └── [id]/
│       └── route.ts                # GET, PUT, DELETE
├── checks/
│   ├── route.ts                    # GET (list), POST (create)
│   └── [id]/
│       ├── route.ts                # GET
│       └── status/
│           └── route.ts            # PUT (durum guncelle)
├── expenses/
│   ├── route.ts                    # GET (list), POST (create)
│   └── [id]/
│       └── route.ts                # GET, PUT, DELETE
├── stats/
│   ├── summary/
│   │   └── route.ts                # GET
│   ├── income-distribution/
│   │   └── route.ts                # GET
│   ├── monthly-comparison/
│   │   └── route.ts                # GET
│   ├── collection-performance/
│   │   └── route.ts                # GET
│   └── top-debtors/
│       └── route.ts                # GET
├── account-statement/
│   ├── route.ts                    # GET
│   └── export/
│       └── route.ts                # GET (Excel/PDF)
└── settings/
    └── route.ts                    # GET, PUT
```

### 3.2 API Pattern (Her Endpoint)

```typescript
// Standart API pattern
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const user = await getUserWithProfile();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 });
  }

  const data = await prisma.financeCategory.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(data);
}
```

### 3.3 Tahsilat (Collect) API - Ozel Endpoint

```typescript
// POST /api/finance/transactions/collect
// Coklu borc tahsilati - transaction icinde calisir
interface CollectRequest {
  customerId: string;
  transactionIds: string[];       // secilen borc ID'leri
  amount: number;                 // tahsil edilen tutar
  paymentMethod: PaymentMethod;
  currency: Currency;
  exchangeRate?: number;
  checkData?: {
    checkNumber?: string;
    bankName?: string;
    dueDate: string;
    amount: number;
  };
  date: string;
  note?: string;
}

// Mantik:
// 1. Secilen borclarin toplamini hesapla
// 2. Tutar == toplam: Tum borclari COMPLETED yap
// 3. Tutar < toplam: Son borcu PARTIAL yap, geri kalani COMPLETED
// 4. Cek varsa: Check kaydi olustur, transaction'a bagla
// 5. Tum islemler Prisma $transaction icinde
```

---

## 4. Frontend Mimarisi

### 4.1 Sayfa ve Component Yapisi

```
src/app/(dashboard)/dashboard/finansal-islemler/
├── layout.tsx                          # Finansal islemler layout
├── page.tsx                            # Ana sayfa (redirect veya ozet)
├── muhasebe-ucretleri/
│   └── page.tsx                        # Muhasebe ucretleri sayfasi
├── tahsilatlar/
│   └── page.tsx                        # Tahsilatlar sayfasi
├── hizmetler/
│   └── page.tsx                        # Hizmetler sayfasi
├── giderler/
│   └── page.tsx                        # Giderler sayfasi
├── istatistikler/
│   └── page.tsx                        # Istatistikler sayfasi
└── hesap-dokumu/
    └── page.tsx                        # Hesap dokumu sayfasi

src/components/finansal-islemler/
├── muhasebe-ucretleri/
│   ├── cost-definition-table.tsx       # Maliyet kalemleri tablosu
│   ├── cost-definition-form.tsx        # Yeni maliyet kalemi formu
│   ├── bulk-cost-form.tsx              # Toplu ucret belirleme
│   ├── smm-calculator.tsx              # KDV/Stopaj canli hesaplama
│   └── default-settings-panel.tsx      # Varsayilan ayarlar paneli
├── tahsilatlar/
│   ├── collection-table.tsx            # Tahsilat tablosu
│   ├── collection-form.tsx             # Tahsilat kayit formu
│   ├── pending-debts-selector.tsx      # Coklu borc secimi
│   ├── check-form.tsx                  # Cek bilgi formu
│   └── auto-charge-settings.tsx        # Otomatik borclndirma ayar
├── hizmetler/
│   ├── service-table.tsx               # Hizmet tablosu
│   └── service-form.tsx                # Hizmet ekleme formu
├── giderler/
│   ├── expense-table.tsx               # Gider tablosu
│   └── expense-form.tsx                # Gider ekleme formu
├── istatistikler/
│   ├── summary-cards.tsx               # 4 ozet karti
│   ├── income-distribution-chart.tsx   # Pasta grafik
│   ├── monthly-comparison-chart.tsx    # Cubuk grafik
│   ├── collection-performance.tsx      # Tahsilat performansi
│   └── top-debtors-list.tsx            # En borclu mukellefler
├── hesap-dokumu/
│   ├── account-statement-table.tsx     # Hesap dokumu tablosu
│   └── export-buttons.tsx              # Excel/PDF export
├── shared/
│   ├── category-selector.tsx           # Kategori secim componenti
│   ├── category-manager.tsx            # Kategori CRUD dialog
│   ├── currency-input.tsx              # Para birimi girisi
│   ├── period-selector.tsx             # Donem secici
│   └── finance-types.ts               # TypeScript tipleri
└── hooks/
    ├── use-categories.ts               # Kategori verileri
    ├── use-cost-definitions.ts         # Maliyet tanimlari
    ├── use-transactions.ts             # Islem verileri
    ├── use-checks.ts                   # Cek verileri
    ├── use-expenses.ts                 # Gider verileri
    ├── use-finance-stats.ts            # Istatistik verileri
    ├── use-account-statement.ts        # Hesap dokumu
    └── use-finance-settings.ts         # Finansal ayarlar
```

### 4.2 State Management

```
Her sayfa icin fetch-on-mount + SWR/React Query pattern:

useCategories()         → GET /api/finance/categories
useCostDefinitions()    → GET /api/finance/cost-definitions
useTransactions()       → GET /api/finance/transactions
useChecks()            → GET /api/finance/checks
useExpenses()          → GET /api/finance/expenses
useFinanceStats()      → GET /api/finance/stats/*
useAccountStatement()  → GET /api/finance/account-statement
useFinanceSettings()   → GET /api/finance/settings
```

### 4.3 Form Validation (Zod)

```typescript
// Maliyet tanimi validation
const costDefinitionSchema = z.object({
  customerId: z.string().uuid(),
  categoryId: z.string().uuid(),
  description: z.string().optional(),
  amount: z.number().positive("Tutar sifirdan buyuk olmali"),
  currency: z.enum(["TRY", "USD", "EUR"]),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "BIANNUAL", "ANNUAL", "ONE_TIME"]),
  chargeStrategy: z.enum(["FULL", "DISTRIBUTED"]),
  hasSMM: z.boolean(),
  kdvRate: z.number().min(0).max(100).optional(),
  stopajRate: z.number().min(0).max(100).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
});

// Tahsilat validation
const collectionSchema = z.object({
  customerId: z.string().uuid(),
  transactionIds: z.array(z.string().uuid()).min(1, "En az bir borc secin"),
  amount: z.number().positive("Tutar sifirdan buyuk olmali"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "EFT", "CHECK", "CREDIT_CARD"]),
  currency: z.enum(["TRY", "USD", "EUR"]),
  exchangeRate: z.number().positive().optional(),
  date: z.string().datetime(),
  note: z.string().optional(),
});

// Cek validation
const checkSchema = z.object({
  checkNumber: z.string().optional(),
  bankName: z.string().optional(),
  amount: z.number().positive(),
  dueDate: z.string().datetime(),
});
```

### 4.4 Grafik Kutuphanesi

Istatistikler sayfasi icin **Recharts** (mevcut projede kullaniliyorsa) veya **Chart.js** (lightweight):

```
Pasta Grafik: Kategori bazli gelir dagilimi
  → FinanceCategory.color ile renklendirme
  → Yeni kategori = otomatik yeni dilim

Cubuk Grafik: Aylik gelir-gider karsilastirma
  → 12 ay geri
  → Yesil: Gelir (CREDIT transactions toplami)
  → Kirmizi: Gider (Expense toplami)

Progress Bar: Tahsilat performansi
  → (COMPLETED transactions / Tum DEBIT transactions) * 100
```

---

## 5. Otomatik Borclndirma Mimarisi

### 5.1 pg_cron Yapilandirmasi

```sql
-- Supabase'de pg_cron extension aktif et
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Her gece 00:01'de calisan cron job
SELECT cron.schedule(
  'auto-charge-job',
  '1 0 * * *',  -- Her gun 00:01
  $$
  SELECT auto_charge_tenants();
  $$
);
```

### 5.2 Otomatik Borclndirma Fonksiyonu

```sql
CREATE OR REPLACE FUNCTION auto_charge_tenants()
RETURNS void AS $$
DECLARE
  v_today INT := EXTRACT(DAY FROM CURRENT_DATE);
  v_current_period TEXT := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  v_tenant RECORD;
  v_cost_def RECORD;
  v_charge_amount DECIMAL(12,2);
  v_should_charge BOOLEAN;
BEGIN
  -- autoChargeDay = bugun olan tenant'lari bul
  FOR v_tenant IN
    SELECT id, "financialDefaults"
    FROM "Tenant"
    WHERE ("financialDefaults"->>'autoChargeEnabled')::boolean = true
      AND ("financialDefaults"->>'autoChargeDay')::int = v_today
  LOOP
    -- Bu tenant'in aktif CostDefinition'larini isle
    FOR v_cost_def IN
      SELECT *
      FROM "CostDefinition"
      WHERE "tenantId" = v_tenant.id
        AND "isActive" = true
        AND "startDate" <= CURRENT_DATE
        AND ("endDate" IS NULL OR "endDate" >= CURRENT_DATE)
    LOOP
      -- Bu donem icin zaten borclandirilmis mi?
      IF NOT EXISTS (
        SELECT 1 FROM "AutoChargeLog"
        WHERE "costDefinitionId" = v_cost_def.id
          AND period = v_current_period
      ) THEN
        -- Periyot kontrolu
        v_should_charge := check_frequency(v_cost_def.frequency, v_cost_def."startDate");

        IF v_should_charge THEN
          -- Dagitim stratejisine gore tutar hesapla
          IF v_cost_def."chargeStrategy" = 'DISTRIBUTED' AND v_cost_def.frequency = 'ANNUAL' THEN
            v_charge_amount := v_cost_def.amount / 12;
          ELSIF v_cost_def."chargeStrategy" = 'DISTRIBUTED' AND v_cost_def.frequency = 'BIANNUAL' THEN
            v_charge_amount := v_cost_def.amount / 6;
          ELSIF v_cost_def."chargeStrategy" = 'DISTRIBUTED' AND v_cost_def.frequency = 'QUARTERLY' THEN
            v_charge_amount := v_cost_def.amount / 3;
          ELSE
            v_charge_amount := v_cost_def.amount;
          END IF;

          -- FinancialTransaction olustur (DEBIT)
          -- AutoChargeLog olustur (SUCCESS)
          -- ... (detayli insert)
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### 5.3 Periyot Kontrol Fonksiyonu

```sql
CREATE OR REPLACE FUNCTION check_frequency(
  p_frequency TEXT,
  p_start_date DATE
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_month INT := EXTRACT(MONTH FROM CURRENT_DATE);
  v_start_month INT := EXTRACT(MONTH FROM p_start_date);
BEGIN
  CASE p_frequency
    WHEN 'MONTHLY' THEN RETURN true;
    WHEN 'QUARTERLY' THEN RETURN (v_current_month - v_start_month) % 3 = 0;
    WHEN 'BIANNUAL' THEN RETURN (v_current_month - v_start_month) % 6 = 0;
    WHEN 'ANNUAL' THEN RETURN v_current_month = v_start_month;
    WHEN 'ONE_TIME' THEN RETURN true; -- isActive = false yapilir sonra
    ELSE RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Cek State Machine

### 6.1 Gecerli Gecisler

```typescript
const VALID_CHECK_TRANSITIONS: Record<CheckStatus, CheckStatus[]> = {
  IN_PORTFOLIO: ["COLLECTED", "BOUNCED", "RETURNED"],
  COLLECTED: [],     // final state
  BOUNCED: [],       // final state
  RETURNED: [],      // final state
};

function validateCheckTransition(
  currentStatus: CheckStatus,
  newStatus: CheckStatus
): boolean {
  return VALID_CHECK_TRANSITIONS[currentStatus].includes(newStatus);
}
```

### 6.2 Cek Durumu Degistiginde

```
IN_PORTFOLIO -> COLLECTED:
  → Ilgili FinancialTransaction status = COMPLETED

IN_PORTFOLIO -> BOUNCED:
  → Ilgili FinancialTransaction status = PENDING (tekrar borclu)
  → Bildirim: "Cek karslksz cikti"

IN_PORTFOLIO -> RETURNED:
  → Ilgili FinancialTransaction status = PENDING (tekrar borclu)
  → Bildirim: "Cek iade edildi"
```

---

## 7. Guvenlik Mimarisi

### 7.1 Multi-Tenant Izolasyon

```
Her API endpoint'inde:
1. getUserWithProfile() -> user.tenantId al
2. Tum Prisma query'lerinde where: { tenantId: user.tenantId }
3. Create islemlerinde data: { ...body, tenantId: user.tenantId }
4. ASLA tenantId'siz query YASAK
```

### 7.2 Finansal Veri Guvenligi

```
- Silme: Soft delete (status = CANCELLED, deletedAt timestamp)
- Degistirme: Tamamlanmis islemler duzenlenemez (COMPLETED status lock)
- Para: Decimal(12,2) - float/double YASAK
- Cek gecisi: State machine validation zorunlu
- Cron: AutoChargeLog unique constraint ile cift kayit engeli
```

### 7.3 Validation Katmani

```
Frontend: Zod schema validation (form submit oncesi)
Backend: Zod schema validation (API handler icinde)
Database: Prisma type safety + constraints
```

---

## 8. Performans Stratejisi

### 8.1 Database Index'leri

```prisma
// Zaten model tanimlarina eklendi:
@@index([tenantId])                    // Tum modeller
@@index([tenantId, customerId])        // CostDefinition
@@index([tenantId, customerId, date])  // FinancialTransaction
@@index([tenantId, status])            // FinancialTransaction, Check
@@index([tenantId, type, date])        // FinancialTransaction
@@index([tenantId, categoryId])        // FinancialTransaction
@@index([tenantId, dueDate])           // Check
@@index([tenantId, date])              // Expense
```

### 8.2 Query Optimizasyonu

```
- Istatistik sorgulari: PostgreSQL aggregate functions (SUM, COUNT, GROUP BY)
- N+1 onleme: Prisma include kullanimi
- Hesap dokumu: Cursor-based pagination
- Buyuk listeler: TanStack Virtual scrolling
```

### 8.3 Frontend Optimizasyon

```
- React.memo: Tablo satirlari
- useMemo: Istatistik hesaplamalari
- useCallback: Form handler'lar
- Dynamic import: Grafik componentleri (lazy load)
- SWR/React Query: Otomatik cache + revalidation
```

---

## 9. Seed Data

### 9.1 Varsayilan Kategoriler

```typescript
const DEFAULT_INCOME_CATEGORIES = [
  { name: "Muhasebe Ucreti", color: "#3B82F6", icon: "calculator" },
  { name: "Beyanname Hizmeti", color: "#10B981", icon: "file-text" },
  { name: "SGK Hizmeti", color: "#F59E0B", icon: "shield" },
  { name: "Sirket Kurulusu", color: "#8B5CF6", icon: "building" },
  { name: "Sermaye Artirimi", color: "#92400E", icon: "trending-up" },
  { name: "Adres Degisikligi", color: "#F97316", icon: "map-pin" },
  { name: "Defter Saklama", color: "#6B7280", icon: "archive" },
  { name: "Danismanlik", color: "#EF4444", icon: "message-circle" },
  { name: "Diger Hizmetler", color: "#1F2937", icon: "more-horizontal" },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Personel Gideri", color: "#3B82F6", icon: "users" },
  { name: "Kira", color: "#10B981", icon: "home" },
  { name: "Elektrik", color: "#F59E0B", icon: "zap" },
  { name: "Su", color: "#06B6D4", icon: "droplet" },
  { name: "Internet/Telefon", color: "#8B5CF6", icon: "wifi" },
  { name: "Kirtasiye", color: "#F97316", icon: "paperclip" },
  { name: "Demirbas", color: "#6B7280", icon: "monitor" },
  { name: "Yazilim Lisansi", color: "#EC4899", icon: "code" },
  { name: "Ulasim", color: "#92400E", icon: "car" },
  { name: "Diger Giderler", color: "#1F2937", icon: "more-horizontal" },
];
```

---

## 10. Teknoloji Kararlari

| Karar | Secim | Neden |
|-------|-------|-------|
| ORM | Prisma 6.x | Mevcut projede kullaniliyor |
| DB | Supabase PostgreSQL | Mevcut altyapi |
| Cron | pg_cron | Ek altyapi maliyeti yok |
| Grafik | Recharts veya Chart.js | Lightweight, React uyumlu |
| Form | React Hook Form + Zod | Mevcut pattern |
| Tablo | TanStack Table | Mevcut pattern |
| Export | xlsx + jspdf | Mevcut pattern |
| State | fetch + SWR pattern | Mevcut pattern |
| Para | Decimal(12,2) | Finansal hassasiyet |

---

> **Mimari v1.0.0** | Finansal Islemler Modulu | 2026-02-12
