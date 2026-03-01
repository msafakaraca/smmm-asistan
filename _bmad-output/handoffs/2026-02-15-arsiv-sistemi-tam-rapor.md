# Handoff: Sorgulama Arşivi Sistemi — Tam Kod Raporu

**Tarih:** 2026-02-15 23:00 (Güncelleme: 2026-02-16)
**Durum:** Rapor oluşturuldu — Diğer sayfalara implement için referans
**Referans uygulama:** OKC Bildirim Arşivi (`/dashboard/okc-bildirim/arsiv`)

---

## 1. Genel Bakış

OKC Bildirim Arşivi sayfası, tüm GİB sorgulama modülleri için şablon teşkil eden bağımsız bir arşiv sayfasıdır. Bu rapor, arşiv sistemiyle ilgili **tüm dosyaları**, **mimariyi** ve **diğer sayfalara entegre ederken kullanılacak pattern**'leri belgelemektedir.

### Mimari Diyagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND KATMANI                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Paylaşılan Bileşenler (src/components/query-archive/)      │   │
│  │  ├── query-archive-filter.tsx — Filtre + Tablo + Yıllık     │   │
│  │  │   müşteri tıklama (tüm ayları yükle + dönem etiketle)    │   │
│  │  ├── archive-overlap-dialog.tsx — Çakışma uyarı             │   │
│  │  └── hooks/use-query-archives.ts — Ana hook                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│         ▲ import                    ▲ import                        │
│         │                           │                               │
│  ┌──────┴──────────┐  ┌────────────┴────────────────────────────┐ │
│  │ Bağımsız Arşiv  │  │ Gömülü Arşiv Tab (Ana sayfa içi)       │ │
│  │ Sayfası          │  │                                         │ │
│  │ ┌──────────────┐│  │ ┌───────────┐ ┌───────────┐ ┌────────┐│ │
│  │ │ OKC Arşiv    ││  │ │ POS       │ │ Tahsilat  │ │ E-Teb. ││ │
│  │ │ Client ✅    ││  │ │ Client    │ │ Client    │ │ Client ││ │
│  │ │ (virtual     ││  │ │ (embed)   │ │ (embed)   │ │(embed) ││ │
│  │ │  scroll +    ││  │ └───────────┘ └───────────┘ └────────┘│ │
│  │ │  section hdr)││  │ ┌───────────┐ ┌───────────┐           │ │
│  │ └──────────────┘│  │ │ E-Arşiv   │ │ E-Defter  │           │ │
│  └─────────────────┘  │ │ (embed)   │ │ (embed)   │           │ │
│                        │ └───────────┘ └───────────┘           │ │
│                        └────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          API KATMANI                                │
├─────────────────────────────────────────────────────────────────────┤
│  GET  /api/query-archives              — Listele/filtrele          │
│  POST /api/query-archives              — Kaydet/merge              │
│  GET  /api/query-archives/[id]         — Detay (resultData dahil)  │
│  DELETE /api/query-archives/[id]       — Sil                       │
│  POST /api/query-archives/check-overlap — Çakışma kontrolü         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       VERİTABANI KATMANI                           │
├─────────────────────────────────────────────────────────────────────┤
│  query_archives tablosu                                             │
│  UNIQUE: (tenantId, customerId, queryType, month, year)            │
│  queryType: "tahsilat"|"edefter"|"earsiv"|"pos"|"okc"|"etebligat"  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Dosya Envanteri

### 2.1 Paylaşılan Altyapı (Tüm modüller kullanır — DEĞİŞTİRME!)

| # | Dosya | Açıklama |
|---|-------|----------|
| 1 | `src/components/query-archive/hooks/use-query-archives.ts` | Ana hook: loadArchives, loadArchiveDetail, checkOverlap, saveOrMerge, deleteArchive, clearArchives |
| 2 | `src/components/query-archive/query-archive-filter.tsx` | Filtre paneli + sonuç tablosu. Multi-select mükellef, aylık/yıllık dönem, müşteri gruplu accordion görünüm, **yıllık müşteri tıklama (tüm ayları paralel yükle + dönem etiketle)** |
| 3 | `src/components/query-archive/archive-overlap-dialog.tsx` | Çakışma uyarı dialog'u: "Arşivden Göster" / "Yeniden Sorgula" seçenekleri |
| 4 | `src/app/api/query-archives/route.ts` | GET (listele/filtrele) + POST (kaydet/merge) |
| 5 | `src/app/api/query-archives/[id]/route.ts` | GET (detay) + DELETE (sil) |
| 6 | `src/app/api/query-archives/check-overlap/route.ts` | POST (çakışma kontrol) |
| 7 | `prisma/schema.prisma` (satır 1271-1301) | `query_archives` model tanımı |

### 2.2 OKC'ye Özel Dosyalar (Referans uygulama)

| # | Dosya | Açıklama |
|---|-------|----------|
| 8 | `src/components/okc/okc-arsiv-client.tsx` | Bağımsız arşiv sayfası client bileşeni — **virtual scrolling + ay bazlı section header'lar** |
| 9 | `src/components/okc/okc-shared.tsx` | Paylaşılan OKC helper'ları (export, detay dialog, MONTHS_TR) |
| 10 | `src/app/(dashboard)/dashboard/okc-bildirim/arsiv/page.tsx` | Next.js sayfa rotası (dynamic import, ssr: false) |

### 2.3 Diğer Modüllerin Mevcut Arşiv Entegrasyonu (Gömülü tab)

Bu modüller arşivi **ana sayfa içine gömülü tab** olarak kullanıyor — ayrı arşiv sayfası yok:

| # | Modül | Ana Sayfa Dosyası | queryType | showAmount |
|---|-------|-------------------|-----------|------------|
| 11 | POS | `src/components/pos/pos-client.tsx` | `"pos"` | `true` |
| 12 | Tahsilat | `src/components/tahsilat/tahsilat-client.tsx` | `"tahsilat"` | `true` |
| 13 | E-Tebligat | `src/components/e-tebligat/etebligat-client.tsx` | `"etebligat"` | `false` |
| 14 | E-Arşiv | `src/components/e-arsiv-fatura/e-arsiv-fatura-page.tsx` | `"earsiv"` | `false` |
| 15 | E-Defter | `src/components/e-defter/e-defter-kontrol-page.tsx` | `"edefter"` | `false` |

---

## 3. Paylaşılan Bileşenlerin Detaylı Açıklamaları

### 3.1 `use-query-archives.ts` — Ana Hook

**Export edilen tipler:**

```typescript
// Arşiv listesi satırı (resultData hariç)
export interface ArchiveSummary {
  id: string;
  customerId: string;
  customerName: string;   // kisaltma || unvan
  customerVkn: string;
  month: number;          // 1-12
  year: number;
  queryType: string;
  totalCount: number;     // Kayıt sayısı
  totalAmount: number;    // Tutar (POS/Tahsilat için)
  lastQueriedAt: string;  // ISO date
  queryCount: number;     // Kaç kez sorgulandı
  createdAt: string;
}

// Arşiv detayı (resultData dahil)
export interface ArchiveDetail {
  id: string;
  customerId: string;
  queryType: string;
  month: number;
  year: number;
  resultData: unknown[];   // <-- Asıl veriler burada
  resultMeta: Record<string, unknown> | null;
  queryHistory: Array<{ date: string; params: Record<string, unknown>; addedCount: number }>;
  lastQueriedAt: string;
  customers: { unvan: string; kisaltma: string | null; vknTckn: string };
}

// Çakışma bilgisi
export interface OverlapInfo {
  hasOverlap: boolean;
  archiveId?: string;
  month?: number;
  year?: number;
  totalCount?: number;
  totalAmount?: number;
  lastQueriedAt?: string;
  customerName?: string;
}

// Filtre parametreleri
export interface ArchiveFilter {
  queryType: string;
  customerIds?: string[];
  startMonth?: number;
  startYear?: number;
  endMonth?: number;
  endYear?: number;
}

// Kaydetme sonucu
export interface SaveResult {
  action: "created" | "merged";
  id: string;
  totalCount: number;
  addedCount: number;
}
```

**Hook fonksiyonları:**

| Fonksiyon | Parametreler | Dönüş | Kullanım |
|-----------|-------------|-------|----------|
| `loadArchives(filter)` | `ArchiveFilter` | `ArchiveListResponse \| null` | Filtre panelinden çağrılır |
| `loadArchiveDetail(id)` | `string` | `ArchiveDetail \| null` | "Göster" butonundan çağrılır |
| `checkOverlap(queryType, customerId, month, year)` | 4 param | `OverlapInfo` | Sorgulama öncesi çakışma kontrolü |
| `saveOrMerge(queryType, customerId, month, year, results, queryParams, dedupKey?, meta?)` | 8 param | `SaveResult \| null` | Sorgulama sonrası kaydetme |
| `deleteArchive(id)` | `string` | `boolean` | "Sil" butonundan çağrılır |
| `clearArchives()` | — | `void` | State temizleme |

### 3.2 `query-archive-filter.tsx` — Filtre Paneli

**Props:**

```typescript
interface QueryArchiveFilterProps {
  queryType: string;          // "okc" | "pos" | "tahsilat" | "etebligat" | "earsiv" | "edefter"
  customers: Array<{
    id: string;
    unvan: string;
    kisaltma: string | null;
    vknTckn: string;
  }>;
  onShowArchiveData: (archiveId: string, data: unknown[], customerName?: string) => void;
  onClearArchiveData?: () => void;  // Filtre değiştiğinde üst bileşendeki detay verisini temizle
  showAmount?: boolean;       // Tutar sütunu göster (default: false)
  amountLabel?: string;       // Tutar başlığı (default: "Toplam")
}
```

**Önemli Değişiklikler (2026-02-16):**

1. **`onShowArchiveData` 3. parametre:** Opsiyonel `customerName` eklendi — tekil ay "Göster" ve yıllık müşteri tıklama'dan müşteri adı aktarılıyor.

2. **`onClearArchiveData` prop:** Her "Filtrele" tıklamasında (`handleFilter` başında) çağrılır. Üst bileşendeki önceki detay verisini (yıllık tablo vb.) temizler. Yıllık → aylık geçişte eski veri kalmamasını sağlar.

3. **Yıllık müşteri tıklama (`handleYearlyCustomerClick`):** Yıllık modda müşteri grup satırına tıklandığında:
   - Tüm aylık arşivleri **paralel** yükler (`Promise.all` ile `fetch`)
   - Her kayda `_donemAy` ve `_donemYil` alanları ekler (arşivin ait olduğu ay/yıl)
   - Birleştirilmiş veriyi `onShowArchiveData` ile üst bileşene gönderir
   - Yükleme sırasında `loadingCustomerId` state ile satırda Loader2 spinner gösterir
   - Yıllık modda ikon: `Eye` (tıkla-göster), aylık modda: `ChevronRight` (expand/collapse)

**Eklenen state ve callback'ler:**

```typescript
// State
const [loadingCustomerId, setLoadingCustomerId] = useState<string | null>(null);

// Yıllık müşteri tıklama handler
const handleYearlyCustomerClick = useCallback(async (group: CustomerGroup) => {
  if (loadingCustomerId) return;
  setLoadingCustomerId(group.customerId);
  try {
    // Tüm aylık arşivleri paralel yükle (arşiv bilgisiyle eşleştir)
    const detailPromises = group.archives.map(async (a) => {
      const res = await fetch(`/api/query-archives/${a.id}`);
      if (!res.ok) return { archive: a, data: null };
      const json = await res.json();
      return { archive: a, data: json };
    });
    const results = await Promise.all(detailPromises);

    // Tüm resultData'ları birleştir — her kayda dönem bilgisi ekle
    const allData: unknown[] = [];
    for (const { archive, data } of results) {
      if (data && Array.isArray(data.resultData)) {
        const tagged = data.resultData.map((item: unknown) => ({
          ...(item as Record<string, unknown>),
          _donemAy: archive.month,
          _donemYil: archive.year,
        }));
        allData.push(...tagged);
      }
    }

    if (allData.length > 0) {
      onShowArchiveData(group.customerId, allData, group.customerName);
      toast.success(`${group.customerName} — ${startYear} yılı arşivi yüklendi (${allData.length} kayıt)`);
    }
  } finally {
    setLoadingCustomerId(null);
  }
}, [onShowArchiveData, loadingCustomerId, startYear]);
```

**Müşteri grup satırı tıklama davranışı:**

```typescript
// Yıllık modda → handleYearlyCustomerClick (tüm verileri yükle)
// Aylık modda → toggleCustomerExpansion (accordion aç/kapa)
onClick={() =>
  filterMode === "yearly"
    ? handleYearlyCustomerClick(group)
    : toggleCustomerExpansion(group.customerId)
}

// İkon:
// loadingCustomerId === group.customerId → Loader2 (animate-spin)
// filterMode === "yearly" → Eye
// filterMode === "monthly" → ChevronRight (rotate-90 animasyonlu)
```

**Müşteri gruplama (mevcut):**

- Çok müşteri seçildiğinde: Accordion tarzı gruplu görünüm
- Tek müşteri seçildiğinde: Düz tablo görünümü
- Müşteriler Türkçe alfabetik sıralı (`localeCompare("tr")`)
- Aylar yeni→eski sıralı (grup içi)

### 3.3 `archive-overlap-dialog.tsx` — Çakışma Uyarı Dialog'u

**Props:**

```typescript
interface ArchiveOverlapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overlapInfo: {
    month: number;
    year: number;
    totalCount: number;
    lastQueriedAt: string;
    customerName: string;
    archiveId: string;
  } | null;
  onShowArchive: () => void;  // "Arşivden Göster" tıklandığında
  onRequery: () => void;       // "Yeniden Sorgula" tıklandığında
}
```

---

## 4. OKC Referans Uygulama — Bağımsız Arşiv Sayfası Pattern'i

### 4.1 Sayfa Rotası (`page.tsx`)

```typescript
// src/app/(dashboard)/dashboard/okc-bildirim/arsiv/page.tsx
"use client";
import dynamic from "next/dynamic";

const OkcArsivClient = dynamic(
  () => import("@/components/okc/okc-arsiv-client"),
  { ssr: false }
);

export default function OkcArsivPage() {
  return <OkcArsivClient />;
}
```

### 4.2 Client Bileşeni (`okc-arsiv-client.tsx`) — Temel Yapı

```
OkcArsivClient
├── Types
│   ├── OkcBildirimWithDonem extends OkcBildirim  — _donemAy?, _donemYil?
│   └── RenderItem = "header" | "row"              — Virtual scroll karma satır tipi
│
├── Sabitler
│   ├── COL_COUNT = 9
│   ├── ROW_HEIGHT = 40
│   └── HEADER_HEIGHT = 44
│
├── State
│   ├── customers: Customer[]                      — useEffect ile yüklenir
│   ├── archiveBildirimler: OkcBildirimWithDonem[] — Arşivden yüklenen veriler
│   ├── archiveCustomerName: string                — Müşteri adı (export için)
│   └── selectedBildirim + detayDialogOpen         — Detay dialog durumu
│
├── Computed
│   ├── hasDonemInfo: boolean                      — İlk kayıtta _donemAy var mı?
│   ├── renderItems: RenderItem[]                  — Section header + data satırları
│   │   (hasDonemInfo true ise ay bazlı gruplama + Ocak→Aralık sıralama)
│   └── archiveMeta: OkcMeta | null                — Export için meta bilgisi
│
├── Virtual Scrolling
│   ├── tableContainerRef: RefObject<HTMLDivElement>
│   └── rowVirtualizer: useVirtualizer({
│         count: renderItems.length,
│         estimateSize: header=44px / row=40px,
│         overscan: 20
│       })
│
├── Callbacks
│   ├── handleShowArchiveData(id, data, customerName?)  — QueryArchiveFilter'dan
│   ├── handleClear()                                    — Verileri temizle
│   └── handleShowDetail(bildirim)                       — Detay dialog'unu aç
│
├── UI Layout
│   ├── Başlık (ArrowLeft + Archive ikonu + "ÖKC Bildirim Arşivi")
│   ├── QueryArchiveFilter (queryType="okc", showAmount=false,
│   │   onClearArchiveData={handleClear})
│   ├── Arşiv Sonuçları (archiveBildirimler.length > 0)
│   │   ├── Badge + Export butonları (Excel, PDF, Temizle)
│   │   └── Sonuç tablosu (Virtual Scrolling + Section Headers)
│   │       ├── Sticky thead
│   │       ├── Üst boşluk (virtual spacer)
│   │       ├── RenderItem loop:
│   │       │   ├── "header" → Dönem ayırıcı satır (CalendarDays + "Ocak 2026 — 15 kayıt")
│   │       │   └── "row"    → Veri satırı (modüle özel sütunlar)
│   │       ├── Alt boşluk (virtual spacer)
│   │       └── Sticky footer (Archive ikonu + "Toplam Kayıt: N", opak bg-muted + gölge)
│   ├── Boş durum
│   └── Detay Dialog (OkcDetayDialog)
```

### 4.3 Virtual Scrolling + Section Header Detayı

Yıllık birleştirilmiş veride dönemler **section header satırlarıyla** ayrılır:

```
┌──────────────────────────────────────────────────────────────────┐
│ # │ Firma Kodu │ Firma Adı │ Marka │ Model │ Sicil │ ... │ Detay│  ← Sticky thead
├──────────────────────────────────────────────────────────────────┤
│ 📅 Ocak 2026 — 5 kayıt                                          │  ← Section header
│ 1 │ 1234       │ Firma A   │ ...                          │ Göster│     bg-primary/10
│ 2 │ 1234       │ Firma A   │ ...                          │ Göster│     border-primary/30
│ ...                                                              │
│ 📅 Şubat 2026 — 8 kayıt                                         │  ← Section header
│ 6 │ 1234       │ Firma A   │ ...                          │ Göster│
│ ...                                                              │
│ 📅 Mart 2026 — 14 kayıt                                         │  ← Section header
│ 14│ 1234       │ Firma A   │ ...                          │ Göster│
│ ...                                                              │
├──────────────────────────────────────────────────────────────────┤
│ 📦 Toplam Kayıt: 27                                              │  ← Sticky footer
└──────────────────────────────────────────────────────────────────┘     bg-muted + gölge
```

**RenderItem oluşturma mantığı (`renderItems` useMemo):**

```typescript
type RenderItem =
  | { type: "header"; donemAy: number; donemYil: number; count: number }
  | { type: "row"; globalIndex: number; bildirim: OkcBildirimWithDonem };

// hasDonemInfo false (tekil ay) → sadece row'lar, header yok
// hasDonemInfo true (yıllık birleştirilmiş) →
//   1. Ay bazlı sırala (Ocak → Aralık)
//   2. Her ay değişiminde header ekle
//   3. globalIndex ile sürekli numaralama
```

**Virtual scrolling yapılandırması:**

```typescript
const rowVirtualizer = useVirtualizer({
  count: renderItems.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: (index) =>
    renderItems[index]?.type === "header" ? HEADER_HEIGHT : ROW_HEIGHT,
  overscan: 20,
});
```

**Section header render:**

```tsx
<tr className="border-b-2 border-primary/30 bg-primary/10 dark:bg-primary/5">
  <td colSpan={COL_COUNT} className="px-4 py-2.5">
    <div className="flex items-center gap-2">
      <CalendarDays className="h-4 w-4 text-primary" />
      <span className="font-semibold text-primary">
        {MONTHS_TR[item.donemAy - 1]} {item.donemYil}
      </span>
      <span className="text-xs text-muted-foreground">
        — {item.count} kayıt
      </span>
    </div>
  </td>
</tr>
```

**Footer render (opak, belirgin):**

```tsx
<tr className="border-t-2 border-border bg-muted font-semibold sticky bottom-0 shadow-[0_-2px_6px_rgba(0,0,0,0.06)]">
  <td className="px-3 py-3 text-center text-foreground" colSpan={1}>
    <Archive className="h-4 w-4 inline-block" />
  </td>
  <td className="px-3 py-3 text-foreground" colSpan={COL_COUNT - 2}>
    Toplam Kayıt: <span className="tabular-nums">{archiveBildirimler.length}</span>
  </td>
  <td className="px-3 py-3" />
</tr>
```

### 4.4 Shared Helper (`okc-shared.tsx`) — Modüle Özel

Her modülün kendi shared helper dosyası olmalı (eğer yoksa oluşturulmalı):

```
okc-shared.tsx
├── MONTHS_TR              — Ay adları dizisi (export ediliyor!)
├── parseNumber()          — "23.139,76" → 23139.76 TR format parse
├── formatCurrency()       — Sayıyı TR para formatına çevir
├── formatNum()            — toLocaleString("tr-TR") wrapper
├── exportToExcel()        — CSV export (UTF-8 BOM, ; ayıraç)
├── exportToPdf()          — jsPDF + autoTable ile PDF
├── getOkcDetayRows()      — Detay satırlarını section bazlı gruplama
├── DetayRow               — Tekil satır bileşeni
├── DetayAdetRow           — Tutar + adet satırı
├── DetaySection           — Başlıklı bölüm wrapper
└── OkcDetayDialog         — Detay dialog bileşeni
```

---

## 5. Diğer Sayfalara Bağımsız Arşiv Sayfası Ekleme Planı

### 5.1 Genel Strateji

Her modül için **3 dosya** oluşturulacak:

```
1. src/app/(dashboard)/dashboard/<modül>/arsiv/page.tsx       — Sayfa rotası
2. src/components/<modül>/<modül>-arsiv-client.tsx             — Client bileşeni
3. src/components/<modül>/<modül>-shared.tsx                   — Shared helpers (yoksa)
```

**Yeni arşiv client bileşeni oluştururken OKC referansından kopyalanacak pattern'ler:**

- `OkcBildirimWithDonem` → `<Modül>DataWithDonem` (modüle özel tip + `_donemAy?`, `_donemYil?`)
- `RenderItem` tip tanımı (header + row)
- `renderItems` useMemo (ay bazlı section header gruplama)
- `useVirtualizer` yapılandırması (değişken yükseklik)
- `onClearArchiveData={handleClear}` prop'u
- Section header render (CalendarDays + ay adı + kayıt sayısı)
- Opak footer (bg-muted + gölge + Archive ikonu)

### 5.2 Modül Bazlı Uygulama Sırası

| Sıra | Modül | queryType | showAmount | Shared Dosya Var mı? | Zorluk |
|------|-------|-----------|-----------|---------------------|--------|
| 1 | POS | `"pos"` | `true` (amountLabel="Toplam Tutar") | Oluşturulmalı | Orta |
| 2 | Tahsilat | `"tahsilat"` | `true` (amountLabel="Toplam Tutar") | Oluşturulmalı | Orta |
| 3 | E-Tebligat | `"etebligat"` | `false` | Oluşturulmalı | Kolay |
| 4 | E-Arşiv | `"earsiv"` | `false` | Oluşturulmalı | Orta |
| 5 | E-Defter | `"edefter"` | `false` | Oluşturulmalı | Kolay |

### 5.3 Her Modül İçin Yapılacaklar Şablonu

```
Adım 1: Ana sayfa client'ını oku — Modüle özel type'ları ve tablo sütunlarını öğren
Adım 2: <modül>-shared.tsx oluştur — Export (Excel/PDF), DetayDialog, helper fonksiyonları ayır
Adım 3: <modül>-arsiv-client.tsx oluştur — OKC referansını takip et
         → WithDonem extended tip + RenderItem + renderItems + useVirtualizer
         → Section headers + opak footer
         → onClearArchiveData={handleClear}
Adım 4: arsiv/page.tsx oluştur — Dynamic import, ssr: false
Adım 5: Ana sayfada "Arşiv" butonunu/link'ini ekle
Adım 6: TypeScript kontrolü
```

---

## 6. API Endpoint'leri Detayları

### 6.1 GET `/api/query-archives`

**Query params:**
- `queryType` (zorunlu): `"okc"` | `"pos"` | `"tahsilat"` | `"etebligat"` | `"earsiv"` | `"edefter"`
- `customerIds` (opsiyonel): UUID'ler virgülle ayrılmış (max 100)
- `startMonth`, `startYear`, `endMonth`, `endYear` (opsiyonel): Dönem aralığı

**Response:**
```json
{
  "archives": [
    {
      "id": "uuid",
      "customerId": "uuid",
      "customerName": "Firma A",
      "customerVkn": "1234567890",
      "month": 1,
      "year": 2026,
      "queryType": "okc",
      "totalCount": 15,
      "totalAmount": 0,
      "lastQueriedAt": "2026-02-15T10:00:00Z",
      "queryCount": 2,
      "createdAt": "2026-02-01T08:00:00Z"
    }
  ],
  "summary": {
    "totalArchives": 1,
    "grandTotalCount": 15,
    "grandTotalAmount": 0
  }
}
```

### 6.2 POST `/api/query-archives` (Kaydet/Merge)

**Body:**
```json
{
  "customerId": "uuid",
  "queryType": "okc",
  "month": 1,
  "year": 2026,
  "newResults": [...],
  "queryParams": { "ay": "01", "yil": "2026" },
  "dedupKey": ["sicilNo", "bildirimTarih"],
  "meta": { "totalAmount": 45230.50 }
}
```

**Response:**
```json
{
  "action": "created | merged",
  "id": "uuid",
  "totalCount": 25,
  "addedCount": 10
}
```

### 6.3 GET `/api/query-archives/[id]`

Tam arşiv kaydı (`resultData` dahil) döner.

### 6.4 DELETE `/api/query-archives/[id]`

`{ success: true }` döner.

### 6.5 POST `/api/query-archives/check-overlap`

**Body:** `{ customerId, queryType, month, year }`
**Response:** `{ hasOverlap: true/false, archiveId?, month?, year?, totalCount?, ... }`

---

## 7. Veritabanı Modeli

```prisma
model query_archives {
  id            String   @id @default(uuid()) @db.Uuid
  customerId    String   @db.Uuid
  tenantId      String   @db.Uuid
  userId        String   @db.Uuid
  queryType     String   // "tahsilat"|"edefter"|"earsiv"|"pos"|"okc"|"etebligat"

  month         Int      // 1-12
  year          Int      // 2025, 2026, ...

  resultData    Json     // Merge edilmiş tüm sonuçlar
  resultMeta    Json?    // { totalCount, totalAmount, lastQueryDate, queryCount }
  queryHistory  Json     @default("[]")
  lastQueriedAt DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  customers     customers     @relation(...)
  tenants       tenants       @relation(...)
  user_profiles user_profiles @relation(...)

  @@unique([tenantId, customerId, queryType, month, year])
  @@index([tenantId, queryType])
  @@index([tenantId, customerId])
  @@index([tenantId, year, month])
}
```

---

## 8. Mevcut Gömülü Arşiv Entegrasyonu (Ana sayfalardaki tab)

Şu modüller arşiv bileşenlerini **kendi ana sayfalarına tab olarak** gömmüş:

### Kullanım Pattern'i (Her modülde aynı)

```typescript
// Import'lar
import { useQueryArchives, type OverlapInfo } from "@/components/query-archive/hooks/use-query-archives";
import QueryArchiveFilter from "@/components/query-archive/query-archive-filter";
import ArchiveOverlapDialog from "@/components/query-archive/archive-overlap-dialog";

// Hook kullanımı (sadece checkOverlap ve loadArchiveDetail kullanılır)
const { checkOverlap, loadArchiveDetail } = useQueryArchives();

// Çakışma kontrolü (sorgulama öncesi)
const overlap = await checkOverlap(queryType, customerId, month, year);
if (overlap.hasOverlap) {
  setOverlapInfo(overlap);
  setOverlapDialogOpen(true);
  return;
}

// Arşivden göster
const detail = await loadArchiveDetail(archiveId);
onShowArchiveData(archiveId, detail.resultData, customerName);

// Tab içinde QueryArchiveFilter kullanımı
<QueryArchiveFilter
  queryType="pos"
  customers={customers}
  onShowArchiveData={handleShowArchiveData}
  onClearArchiveData={handleClear}  // ← YENİ: Filtre değiştiğinde eski veriyi temizle
  showAmount={true}
  amountLabel="Toplam Tutar"
/>

// Çakışma dialog'u
<ArchiveOverlapDialog
  open={overlapDialogOpen}
  onOpenChange={setOverlapDialogOpen}
  overlapInfo={overlapInfo}
  onShowArchive={handleShowFromArchive}
  onRequery={handleRequery}
/>
```

---

## 9. Yıllık Görünüm Akışı (Tam Döngü)

```
1. Kullanıcı "Yıllık" tercihini seçer
2. "Filtrele" butonuna tıklar
   → onClearArchiveData() çağrılır (önceki detay tablosu temizlenir)
   → loadArchives() ile arşiv listesi yüklenir
   → Müşteriler gruplu olarak listelenir

3. Müşteri satırına tıklar
   → handleYearlyCustomerClick(group) tetiklenir
   → Loader2 spinner gösterilir
   → Tüm aylık arşivler paralel fetch edilir (Promise.all)
   → Her kayda _donemAy + _donemYil eklenir
   → Birleştirilmiş veri onShowArchiveData ile üst bileşene gönderilir
   → toast.success("Firma A — 2026 yılı arşivi yüklendi (27 kayıt)")

4. Üst bileşen (okc-arsiv-client.tsx) veriyi alır
   → hasDonemInfo = true (ilk kayıtta _donemAy var)
   → renderItems: Ocak→Aralık sıralama + section header ekleme
   → Virtual scrolling ile render
   → Section header: bg-primary/10 + CalendarDays + "Ocak 2026 — 5 kayıt"
   → Opak footer: bg-muted + gölge + "Toplam Kayıt: 27"

5. Kullanıcı "Aylık" tercihine geçer ve tekrar "Filtrele" yapar
   → onClearArchiveData() çağrılır → yıllık detay tablosu kapanır
   → Yeni aylık filtre sonuçları gösterilir
```

---

## 10. Kullanım Notları

### QueryArchiveFilter Props Rehberi

| Prop | OKC | POS | Tahsilat | E-Tebligat | E-Arşiv | E-Defter |
|------|-----|-----|----------|------------|---------|---------|
| queryType | `"okc"` | `"pos"` | `"tahsilat"` | `"etebligat"` | `"earsiv"` | `"edefter"` |
| showAmount | `false` | `true` | `true` | `false` | `false` | `false` |
| amountLabel | — | `"Toplam Tutar"` | `"Toplam Tutar"` | — | — | — |
| onClearArchiveData | `handleClear` | `handleClear` | `handleClear` | `handleClear` | `handleClear` | `handleClear` |

### Dikkat Edilecek Noktalar

1. **Paylaşılan bileşenleri değiştirme** — `query-archive-filter.tsx`, `use-query-archives.ts`, `archive-overlap-dialog.tsx` tüm modüller tarafından kullanılır. Değişiklik tüm modülleri etkiler.

2. **queryType değeri** — API'de ve veritabanında `queryType` olarak saklanır. Her modül kendi benzersiz queryType'ını kullanmalı.

3. **dedupKey** — `saveOrMerge` çağırılırken modüle özel duplikasyon anahtarı belirlenmeli:
   - OKC: `["sicilNo", "bildirimTarih"]`
   - POS: İlgili unique field'lar
   - Tahsilat: İlgili unique field'lar

4. **Müşteri listesi** — Bağımsız arşiv sayfasında `/api/customers?fields=minimal` ile yüklenir. Gömülü tab'da üst bileşenden props olarak gelir.

5. **resultData** — JSON olarak saklanır. Her modülün kendi data yapısı var. `onShowArchiveData(archiveId, data, customerName)` callback'inde `data as ModulType[]` şeklinde cast edilir.

6. **Dönem etiketleme** — Yıllık birleştirilmiş veride her kayda `_donemAy` ve `_donemYil` eklenir. Bu alanlar `query-archive-filter.tsx` tarafından eklenir, orijinal veri yapısında yoktur. Client bileşeninde `WithDonem` extended tip ile kullanılır.

7. **onClearArchiveData** — Her yeni modülün arşiv client bileşeninde `handleClear` fonksiyonunu `onClearArchiveData` prop'u olarak geçirmesi **zorunlu**. Aksi halde yıllık→aylık geçişte eski detay tablosu ekranda kalır.

---

## 11. Sonraki Adımlar

Bu handoff dosyası referans alınarak sırasıyla uygulanacak:

```
1. POS Arşiv Sayfası oluştur
   → pos-shared.tsx (export, dialog ayır)
   → pos-arsiv-client.tsx (WithDonem + RenderItem + virtual scroll + section headers)
   → /dashboard/pos/arsiv/page.tsx

2. Tahsilat Arşiv Sayfası oluştur
   → tahsilat-shared.tsx
   → tahsilat-arsiv-client.tsx
   → /dashboard/tahsilat/arsiv/page.tsx

3. E-Tebligat Arşiv Sayfası oluştur
   → etebligat-shared.tsx
   → etebligat-arsiv-client.tsx
   → /dashboard/e-tebligat/arsiv/page.tsx

4. E-Arşiv Fatura Arşiv Sayfası oluştur
   → earsiv-shared.tsx
   → earsiv-arsiv-client.tsx
   → /dashboard/e-arsiv-fatura/arsiv/page.tsx

5. E-Defter Arşiv Sayfası oluştur
   → edefter-shared.tsx
   → edefter-arsiv-client.tsx
   → /dashboard/e-defter/arsiv/page.tsx
```

Her modül için ayrı handoff oluşturulacak ve sırayla implement edilecek.
