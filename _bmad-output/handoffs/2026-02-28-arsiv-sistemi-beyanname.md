# Handoff: Arşiv Sistemi — Core Altyapı + Beyanname Modülü

**Tarih:** 2026-02-28
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor
**Referans:** `2026-02-15-arsiv-sistemi-tam-rapor.md` (orijinal mimari)

---

## Görev Tanımı

> Genel arşiv modülü altyapısını sıfırdan oluştur ve ilk uygulama olarak `/dashboard/beyannameler/arsiv` sayfasını kodla. Diğer modüller (OKC, POS, Tahsilat, E-Tebligat, E-Arşiv, E-Defter) sonra aynı pattern ile eklenecek.

**Mevcut durum:** Arşiv sistemi 26.02.2026 veri kaybında tamamen silindi. Prisma model yok, API yok, paylaşılan bileşen yok. Her şey sıfırdan kodlanacak.

---

## Araştırma Bulguları

### Beyanname Modülü Analizi

**Mevcut dosyalar:**
- `src/components/beyannameler/beyanname-client.tsx` (700 satır) — Ana UI
- `src/components/beyannameler/hooks/use-beyanname-query.ts` (366 satır) — WS hook

**BeyannameItem tipi:**
```typescript
interface BeyannameItem {
  turKodu: string;        // "KDV1", "GELIR", "KURUMLAR"
  turAdi: string;         // "KDV1 Beyannamesi"
  donem: string;          // "202501202503" (12 char) veya "202501" (6 char)
  donemFormatli: string;  // "01/2025-03/2025"
  versiyon: string;       // "39"
  kaynak: string;         // "GİB"
  aciklama: string;       // Düzeltme gerekçesi
  beyoid: string;         // PDF görüntüleme için unique ID
}
```

**WS Event'leri:**
- `intvrg:beyanname-progress` → İlerleme durumu
- `intvrg:beyanname-results` → Sonuçlar (BeyannameItem[])
- `intvrg:beyanname-complete` → Sorgulama tamamlandı
- `intvrg:beyanname-error` → Hata

**Sorgu parametreleri:** `customerId, basAy, basYil, bitAy, bitYil`

**Dönem formatı:**
- 12 char: `"YYYYMMYYYYMM"` → basYil+basAy + bitYil+bitAy
- 6 char: `"YYYYMM"` → tekil ay
- `formatDonemSlash()` fonksiyonu zaten mevcut (beyanname-client.tsx:68-83)

**PDF görüntüleme:** `viewPdf(customerId, beyoid, turAdi)` — Base64 → Blob → yeni sekme

### Prisma Schema Durumu

- Son satır: 1259
- Son model: `recurring_expense_logs`
- `query_archives` model **mevcut değil**
- `customers` modeli satır 178-246 (relation eklenecek)
- `tenants` modeli satır 877-945 (relation eklenecek)
- `user_profiles` modeli satır 947-973 (relation eklenecek)

### Paylaşılan UI Bileşenleri

Mevcut UI pattern'leri:
- Combobox: `Popover + Input` (beyanname-client.tsx:333-401)
- Select: Radix `Select` (beyanname-client.tsx:409-466)
- Tablo: `<table>` + `sticky thead` (beyanname-client.tsx:604-651)
- Export: CSV (BOM) + Browser print PDF

---

## Etkilenecek Dosyalar

### Yeni Dosyalar (9 adet)

| # | Dosya | Açıklama |
|---|-------|----------|
| 1 | `prisma/schema.prisma` (güncelleme) | `query_archives` model + relations |
| 2 | `src/app/api/query-archives/route.ts` | GET (listele/filtrele) + POST (kaydet/merge) |
| 3 | `src/app/api/query-archives/[id]/route.ts` | GET (detay) + DELETE (sil) |
| 4 | `src/app/api/query-archives/check-overlap/route.ts` | POST (çakışma kontrol) |
| 5 | `src/components/query-archive/hooks/use-query-archives.ts` | Ana hook |
| 6 | `src/components/query-archive/query-archive-filter.tsx` | Filtre paneli + sonuç tablosu |
| 7 | `src/components/query-archive/archive-overlap-dialog.tsx` | Çakışma uyarı dialog |
| 8 | `src/components/beyannameler/beyanname-arsiv-client.tsx` | Bağımsız arşiv sayfası |
| 9 | `src/app/(dashboard)/dashboard/beyannameler/arsiv/page.tsx` | Next.js sayfa rotası |

### Güncellenecek Dosyalar (2 adet)

| # | Dosya | Değişiklik |
|---|-------|-----------|
| 10 | `src/components/beyannameler/hooks/use-beyanname-query.ts` | isFromArchive, SHOW_ARCHIVE, pendingQueryRef, arşivleme, showArchiveData |
| 11 | `src/components/beyannameler/beyanname-client.tsx` | Arşiv butonu, overlap dialog, badge |

---

## Uygulama Planı

### ADIM 1: Prisma Schema — query_archives Model

**Dosya:** `prisma/schema.prisma` (satır 1259'dan sonra ekle)

```prisma
// ============================================
// SORGULAMA ARŞİVİ
// ============================================
model query_archives {
  id            String   @id @default(uuid()) @db.Uuid
  customerId    String   @db.Uuid
  tenantId      String   @db.Uuid
  userId        String   @db.Uuid
  queryType     String   // "beyanname"|"tahsilat"|"edefter"|"earsiv"|"pos"|"okc"|"etebligat"

  month         Int      // 1-12
  year          Int      // 2025, 2026, ...

  resultData    Json     // Merge edilmiş tüm sonuçlar
  resultMeta    Json?    // { totalCount, ... }
  queryHistory  Json     @default("[]") // Array<{ date, params, addedCount }>
  totalCount    Int      @default(0)
  totalAmount   Decimal? @db.Decimal(15, 2)

  lastQueriedAt DateTime @default(now())
  queryCount    Int      @default(1)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  customers     customers     @relation(fields: [customerId], references: [id], onDelete: Cascade)
  tenants       tenants       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user_profiles user_profiles @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([tenantId, customerId, queryType, month, year])
  @@index([tenantId, queryType])
  @@index([tenantId, customerId])
  @@index([tenantId, year, month])
}
```

**Relation eklemeleri:**
- `customers` modeline (satır 234 civarı): `query_archives query_archives[]`
- `tenants` modeline (satır 943 civarı): `query_archives query_archives[]`
- `user_profiles` modeline (satır 968 civarı): `query_archives query_archives[]`

**Sonra çalıştır:** `npm run db:generate && npm run db:push`

---

### ADIM 2: API — GET + POST `/api/query-archives`

**Dosya:** `src/app/api/query-archives/route.ts`

**GET — Listele/Filtrele:**
```
Query params:
- queryType (zorunlu): "beyanname"|"tahsilat"|...
- customerIds (opsiyonel): UUID'ler virgülle ayrılmış
- startMonth, startYear, endMonth, endYear (opsiyonel): Dönem aralığı

Response: {
  archives: ArchiveSummary[],
  summary: { totalArchives, grandTotalCount, grandTotalAmount }
}
```

Prisma query:
```typescript
const archives = await prisma.query_archives.findMany({
  where: {
    tenantId: user.tenantId,
    queryType,
    ...(customerIds && { customerId: { in: customerIds } }),
    ...(startYear && startMonth && {
      OR: [
        { year: { gt: startYear } },
        { year: startYear, month: { gte: startMonth } },
      ]
    }),
    ...(endYear && endMonth && {
      OR: [
        { year: { lt: endYear } },
        { year: endYear, month: { lte: endMonth } },
      ]
    }),
  },
  select: {
    id: true, customerId: true, month: true, year: true,
    queryType: true, totalCount: true, totalAmount: true,
    lastQueriedAt: true, queryCount: true, createdAt: true,
    customers: { select: { unvan: true, kisaltma: true, vknTckn: true } },
  },
  orderBy: [{ year: "desc" }, { month: "desc" }],
});
```

**POST — Kaydet/Merge:**
```
Body: {
  customerId, queryType, month, year,
  newResults: unknown[],
  queryParams: Record<string, unknown>,
  dedupKey?: string[],  // ["beyoid"] için beyanname
  meta?: Record<string, unknown>
}

Mantık:
1. Mevcut kayıt var mı? (tenantId + customerId + queryType + month + year)
2. Yoksa → create (resultData = newResults)
3. Varsa → merge:
   a. Mevcut resultData'yı oku
   b. dedupKey varsa: yeni kayıtlardan mevcut olanları çıkar
   c. Birleştir: [...existingData, ...uniqueNewResults]
   d. queryHistory'e yeni entry ekle
   e. queryCount++, lastQueriedAt = now()
   f. update

Response: { action: "created"|"merged", id, totalCount, addedCount }
```

---

### ADIM 3: API — GET + DELETE `/api/query-archives/[id]`

**Dosya:** `src/app/api/query-archives/[id]/route.ts`

**GET:** Tam arşiv kaydı (resultData dahil) döner.
```typescript
const archive = await prisma.query_archives.findFirst({
  where: { id, tenantId: user.tenantId },
  include: { customers: { select: { unvan: true, kisaltma: true, vknTckn: true } } },
});
```

**DELETE:** Arşiv kaydını siler.
```typescript
await prisma.query_archives.delete({
  where: { id, tenantId: user.tenantId },
});
```

---

### ADIM 4: API — POST `/api/query-archives/check-overlap`

**Dosya:** `src/app/api/query-archives/check-overlap/route.ts`

```
Body: { customerId, queryType, month, year }

Mantık: Aynı müşteri + queryType + ay + yıl için kayıt var mı?

Response: {
  hasOverlap: boolean,
  archiveId?, month?, year?, totalCount?,
  totalAmount?, lastQueriedAt?, customerName?
}
```

---

### ADIM 5: Hook — `use-query-archives.ts`

**Dosya:** `src/components/query-archive/hooks/use-query-archives.ts`

**Export edilen tipler:**
```typescript
export interface ArchiveSummary {
  id: string;
  customerId: string;
  customerName: string;
  customerVkn: string;
  month: number;
  year: number;
  queryType: string;
  totalCount: number;
  totalAmount: number;
  lastQueriedAt: string;
  queryCount: number;
  createdAt: string;
}

export interface ArchiveDetail {
  id: string;
  customerId: string;
  queryType: string;
  month: number;
  year: number;
  resultData: unknown[];
  resultMeta: Record<string, unknown> | null;
  queryHistory: Array<{ date: string; params: Record<string, unknown>; addedCount: number }>;
  lastQueriedAt: string;
  customers: { unvan: string; kisaltma: string | null; vknTckn: string };
}

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

export interface ArchiveFilter {
  queryType: string;
  customerIds?: string[];
  startMonth?: number;
  startYear?: number;
  endMonth?: number;
  endYear?: number;
}

export interface SaveResult {
  action: "created" | "merged";
  id: string;
  totalCount: number;
  addedCount: number;
}
```

**Hook fonksiyonları:**
```typescript
export function useQueryArchives() {
  const [archives, setArchives] = useState<ArchiveSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{...} | null>(null);

  const loadArchives = useCallback(async (filter: ArchiveFilter) => {...}, []);
  const loadArchiveDetail = useCallback(async (id: string) => {...}, []);
  const checkOverlap = useCallback(async (queryType, customerId, month, year) => {...}, []);
  const saveOrMerge = useCallback(async (queryType, customerId, month, year, results, params, dedupKey?, meta?) => {...}, []);
  const deleteArchive = useCallback(async (id: string) => {...}, []);
  const clearArchives = useCallback(() => {...}, []);

  return { archives, loading, summary, loadArchives, loadArchiveDetail, checkOverlap, saveOrMerge, deleteArchive, clearArchives };
}
```

---

### ADIM 6: Bileşen — `query-archive-filter.tsx`

**Dosya:** `src/components/query-archive/query-archive-filter.tsx`

**Props:**
```typescript
interface QueryArchiveFilterProps {
  queryType: string;
  customers: Array<{ id: string; unvan: string; kisaltma: string | null; vknTckn: string }>;
  onShowArchiveData: (archiveId: string, data: unknown[], customerName?: string) => void;
  onClearArchiveData?: () => void;
  showAmount?: boolean;
  amountLabel?: string;
}
```

**Özellikler:**
1. Multi-select mükellef (checkbox listesi veya combobox)
2. Dönem seçimi: Aylık (tek ay) / Yıllık (tüm yıl)
3. "Filtrele" butonu → `loadArchives(filter)` çağırır
4. Sonuç tablosu: Müşteriler gruplu accordion görünüm
5. Yıllık modda müşteri tıklama → Tüm aylık arşivleri paralel yükle + `_donemAy`/`_donemYil` ekle
6. Aylık modda müşteri tıklama → accordion aç/kapa
7. Her arşiv satırında "Göster" + "Sil" butonları

---

### ADIM 7: Bileşen — `archive-overlap-dialog.tsx`

**Dosya:** `src/components/query-archive/archive-overlap-dialog.tsx`

**Props:**
```typescript
interface ArchiveOverlapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overlapInfo: {
    month: number; year: number; totalCount: number;
    lastQueriedAt: string; customerName: string; archiveId: string;
  } | null;
  onShowArchive: () => void;
  onRequery: () => void;
}
```

İki buton: "Arşivden Göster" + "Yeniden Sorgula"

---

### ADIM 8: Beyanname Arşiv Sayfası

**Sayfa rotası:** `src/app/(dashboard)/dashboard/beyannameler/arsiv/page.tsx`
```typescript
"use client";
import dynamic from "next/dynamic";
const BeyannameArsivClient = dynamic(
  () => import("@/components/beyannameler/beyanname-arsiv-client"),
  { ssr: false }
);
export default function BeyannameArsivPage() {
  return <BeyannameArsivClient />;
}
```

**Client bileşeni:** `src/components/beyannameler/beyanname-arsiv-client.tsx`

```
BeyannameArsivClient
├── Types
│   ├── BeyannameWithDonem extends BeyannameItem + _donemAy?, _donemYil?
│   └── RenderItem = "header" | "row"
│
├── State
│   ├── customers: Customer[]
│   ├── archiveBeyannameler: BeyannameWithDonem[]
│   ├── archiveCustomerName: string
│   └── turFilter: string (beyanname türü filtresi)
│
├── Computed
│   ├── hasDonemInfo → ilk kayıtta _donemAy var mı?
│   ├── filteredBeyannameler → turFilter uygulanmış
│   ├── renderItems → section header + data satırları
│   └── beyannameTurleri → filtre seçenekleri
│
├── Virtual Scrolling
│   ├── useVirtualizer (header=44px / row=40px, overscan=20)
│   └── tableContainerRef
│
├── Callbacks
│   ├── handleShowArchiveData(id, data, customerName?)
│   ├── handleClear()
│   └── viewPdf integrasyonu (arşivden PDF görüntüleme)
│
├── UI Layout
│   ├── Başlık: ArrowLeft + Archive + "Beyanname Arşivi"
│   ├── QueryArchiveFilter (queryType="beyanname", showAmount=false)
│   ├── Beyanname Türü Filtresi (mevcuttaki gibi chip'ler)
│   ├── Sonuç Tablosu (Virtual Scrolling)
│   │   ├── Sticky thead: Tür, Dönem, Açıklama, Kaynak, PDF
│   │   ├── Section headers: CalendarDays + "Ocak 2026 — 15 kayıt"
│   │   ├── Data rows
│   │   └── Sticky footer: "Toplam Kayıt: N"
│   ├── Export butonları (Excel, PDF)
│   └── Boş durum
```

**Sütunlar:** Beyanname Türü | Vergilendirme Dönemi | Düzeltme Gerekçesi | Kaynak | PDF Görüntüle

**PDF görüntüleme:** Arşivden gösterilen beyannamenin `beyoid` alanı ile `viewPdf()` çağrılır. Bunun için `useBeyannameQuery` hook'ından sadece `viewPdf` fonksiyonu kullanılır VEYA ayrı bir `viewBeyannamePdf` fonksiyonu yazılır.

**DİKKAT:** PDF görüntüleme GİB'e canlı istek atar (IVD token gerektirir). Arşivden gösterilen beyanname için token'ın aktif olması gerekir. Token yoksa "Önce sorgulama yapın" uyarısı gösterilir.

---

### ADIM 9: Hook Güncelleme — `use-beyanname-query.ts`

**Dosya:** `src/components/beyannameler/hooks/use-beyanname-query.ts`

1. **State'e `isFromArchive` ekle:**
   - `BeyannameQueryState` interface'ine: `isFromArchive: boolean`
   - `initialState`'e: `isFromArchive: false`

2. **Action'a `SHOW_ARCHIVE` ekle:**
   ```typescript
   | { type: "SHOW_ARCHIVE"; payload: { beyannameler: BeyannameItem[] } }
   ```

3. **Reducer'a `SHOW_ARCHIVE` case:**
   ```typescript
   case "SHOW_ARCHIVE":
     return {
       ...initialState,
       beyannameler: action.payload.beyannameler,
       queryDone: true,
       isFromArchive: true,
     };
   ```

4. **`RESULTS` case'ine `isFromArchive: false` ekle**

5. **`pendingQueryRef` ekle** (hook fonksiyonu başında):
   ```typescript
   const pendingQueryRef = useRef<{
     customerId: string;
     basAy: string;
     basYil: string;
     bitAy: string;
     bitYil: string;
     beyannameler: BeyannameItem[];
   } | null>(null);
   ```

6. **WS `intvrg:beyanname-results` handler'ında biriktir:**
   ```typescript
   if (pendingQueryRef.current && data.beyannameler) {
     pendingQueryRef.current.beyannameler = data.beyannameler;
   }
   ```

7. **WS `intvrg:beyanname-complete` handler'ında arşivle:**
   ```typescript
   if (pendingQueryRef.current) {
     const pq = pendingQueryRef.current;
     if (pq.beyannameler.length > 0) {
       // donem alanından ay/yıl çıkar ve grupla
       const byMonth = new Map<string, BeyannameItem[]>();
       for (const b of pq.beyannameler) {
         const parsed = parseBeyannamePeriod(b.donem);
         if (parsed) {
           // Her beyanname'nin başlangıç ayı arşiv ayı olur
           const key = `${parsed.basYil}-${String(parsed.basAy).padStart(2, "0")}`;
           if (!byMonth.has(key)) byMonth.set(key, []);
           byMonth.get(key)!.push(b);
         }
       }

       for (const [key, items] of byMonth) {
         const [yilStr, ayStr] = key.split("-");
         fetch("/api/query-archives", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             customerId: pq.customerId,
             queryType: "beyanname",
             month: parseInt(ayStr, 10),
             year: parseInt(yilStr, 10),
             newResults: items,
             queryParams: { basAy: pq.basAy, basYil: pq.basYil, bitAy: pq.bitAy, bitYil: pq.bitYil },
             dedupKey: ["beyoid"],
             meta: { totalCount: items.length },
           }),
         })
           .then(r => r.ok ? r.json() : null)
           .then(result => {
             if (result) console.log(`[BEYANNAME] Arşivlendi (${ayStr}/${yilStr}): ${result.action}`);
           })
           .catch(() => {});
       }
     }
     pendingQueryRef.current = null;
   }
   ```

8. **`parseBeyannamePeriod` helper:**
   ```typescript
   function parseBeyannamePeriod(donem: string): { basAy: number; basYil: number } | null {
     if (!donem) return null;
     if (donem.length === 12) {
       return {
         basYil: parseInt(donem.substring(0, 4), 10),
         basAy: parseInt(donem.substring(4, 6), 10),
       };
     }
     if (donem.length === 6) {
       return {
         basYil: parseInt(donem.substring(0, 4), 10),
         basAy: parseInt(donem.substring(4, 6), 10),
       };
     }
     return null;
   }
   ```

9. **WS error handler'ında temizle:** `pendingQueryRef.current = null;`

10. **`startQuery`'de set et:**
    ```typescript
    pendingQueryRef.current = {
      customerId, basAy, basYil, bitAy, bitYil, beyannameler: [],
    };
    ```

11. **`showArchiveData` callback ekle:**
    ```typescript
    const showArchiveData = useCallback((data: unknown[]) => {
      dispatch({ type: "SHOW_ARCHIVE", payload: { beyannameler: data as BeyannameItem[] } });
    }, []);
    ```

12. **Return ve interface güncelle:** `showArchiveData`, `isFromArchive` ekle

---

### ADIM 10: Client Güncelleme — `beyanname-client.tsx`

1. **Import eklemeleri:**
   ```typescript
   import { Archive } from "lucide-react";
   import { Badge } from "@/components/ui/badge";
   import { useQueryArchives, type OverlapInfo } from "@/components/query-archive/hooks/use-query-archives";
   import ArchiveOverlapDialog from "@/components/query-archive/archive-overlap-dialog";
   ```

2. **Hook'tan `isFromArchive` ve `showArchiveData` al**

3. **State ekle:**
   ```typescript
   const [overlapOpen, setOverlapOpen] = useState(false);
   const [overlapInfo, setOverlapInfo] = useState<OverlapInfo | null>(null);
   const { checkOverlap, loadArchiveDetail } = useQueryArchives();
   ```

4. **handleQuery güncelle — overlap kontrolü:**
   ```typescript
   // Bitiş ayı için overlap kontrolü
   const month = parseInt(bitAy, 10);
   const year = parseInt(bitYil, 10);
   const overlap = await checkOverlap("beyanname", selectedCustomerId, month, year);
   if (overlap.hasOverlap) {
     setOverlapInfo({ ...overlap, customerName: ... });
     setOverlapOpen(true);
     return;
   }
   ```

5. **Yeni handler'lar:**
   ```typescript
   handleShowFromArchive: loadArchiveDetail → showArchiveData
   handleRequery: setOverlapInfo(null) → startQuery
   ```

6. **UI:**
   - Sorgula butonunun yanına: `<Link href="/dashboard/beyannameler/arsiv">` ile "Arşiv" butonu
   - `isFromArchive` ise: `<Badge>Arşivden gösteriliyor</Badge>`
   - `<ArchiveOverlapDialog>` ekle

---

### ADIM 11: Type Check + DB Push

```bash
npm run db:generate && npm run db:push
npx tsc --noEmit
```

---

## Teknik Notlar

### Beyanname'ye Özel Durumlar

1. **Dönem dağıtımı:** Beyanname sorgusu tarih aralığı kullanır (basAy-basYil / bitAy-bitYil). Sonuçlar `donem` alanından aya dağıtılır.
2. **dedupKey:** `["beyoid"]` — her beyanname versiyonun benzersiz ID'si
3. **showAmount:** `false` — beyannamelerin tutarı yok
4. **PDF görüntüleme:** Arşivden gösterilen beyannameler için de çalışır (canlı GİB token gerektirir)
5. **Beyanname türü filtresi:** Arşiv sayfasında da turFilter chip'leri olacak

### Diğer Modüller İçin Şablon

Bu uygulama tamamlandığında diğer modüller için pattern:
1. `<modül>-arsiv-client.tsx` — BeyannameArsivClient'ı referans al
2. `arsiv/page.tsx` — Aynı pattern
3. Hook güncellemesi — Aynı pattern (pendingQueryRef + arşivleme + showArchiveData)
4. Client güncellemesi — Aynı pattern (Arşiv butonu + overlap dialog)

### queryType Değerleri

| Modül | queryType | showAmount |
|-------|-----------|------------|
| **Beyanname** | `"beyanname"` | `false` |
| OKC | `"okc"` | `false` |
| POS | `"pos"` | `true` |
| Tahsilat | `"tahsilat"` | `true` |
| E-Tebligat | `"etebligat"` | `false` |
| E-Arşiv | `"earsiv"` | `false` |
| E-Defter | `"edefter"` | `false` |

---

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| `beyoid` dedupKey | Her beyanname versiyonu benzersiz | `turKodu+donem+versiyon` (daha karmaşık) |
| Dönem'den ay/yıl çıkar | `donem` alanı zaten ay bilgisi içeriyor | Manuel ay seçimi (UX kaybı) |
| Bağımsız arşiv sayfası | Handoff tasarımıyla uyumlu, virtual scroll | Gömülü tab (alan kısıtı) |
| viewPdf arşivden de çalışır | Kullanıcı beklentisi | Sadece canlı sorgudan PDF (UX kaybı) |
| Link butonu (sayfaya yönlendirme) | SPA navigasyon, temiz URL | Toggle panel (karmaşık state) |
