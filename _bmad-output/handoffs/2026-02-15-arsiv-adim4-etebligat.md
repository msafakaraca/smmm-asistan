# Handoff: Sorgulama Arşivi ADIM 4 — E-Tebligat Entegrasyonu
**Tarih:** 2026-02-15 23:30
**Durum:** ✅ Tamamlandı (2026-02-15)

## Görev Tanımı
> E-Tebligat sorgulama modülüne Sorgulama Arşivi entegrasyonu ekle.
> Diğer 5 modül (POS, OKC, Tahsilat, E-Defter, E-Arşiv) zaten entegre.
> E-Tebligat özel çözüm gerektirir: dönem seçimi yok, tüm kayıtları çeker.

## Araştırma Bulguları

### E-Tebligat Modülünün Farklılıkları
1. **Dönem seçimi yok** — `startQuery(customerId)` sadece customerId alır, ay/yıl yok
2. **Tüm tebligatları çeker** — GİB API tüm tebligatları döner (dönem filtresi yok)
3. **Tarih alanları**: `kayitZamani`, `tebligZamani`, `gonderimZamani`, `mukellefOkumaZamani`
4. **Tarih formatı**: `"DD.MM.YYYY HH:mm:ss"` veya ISO `"YYYY-MM-DDTHH:mm:ss"` — mevcut `parseToDate()` fonksiyonu her ikisini de handle ediyor (`etebligat-table.tsx:45-57`)
5. **Ek özellikler**: zarfLoading, pdfLoading, openZarf, viewPdf — arşivlemeyi etkilemez
6. **Dedup**: `tebligId` bazlı (zaten reducer'da var, `etebligat-query.ts:122`)

### Özel Çözüm Stratejisi
- **Arşivleme**: `tebligZamani`'nden ay/yıl çıkar, aya dağıtımlı arşivle (Tahsilat pattern'i)
- **Overlap**: Mevcut ay için kontrol et. Eğer bu müşterinin bu ay arşivde `etebligat` kaydı varsa overlap göster.
- **showArchiveData**: Standart pattern — tek bir ay/yıl'ın tebligatlarını gösterir
- **Filter panel**: `queryType="etebligat"`, `showAmount={false}`

### Tarih Parse Mantığı (Arşivleme İçin)
`tebligZamani` formatı:
- `"31.08.2024 00:00:00"` → ay=8, yıl=2024
- `"2026-01-15T11:21:35"` → ay=1, yıl=2026

Parse fonksiyonu:
```typescript
function parseTebligMonth(dateStr: string): { ay: number; yil: number } | null {
  if (!dateStr) return null;
  // ISO format: "YYYY-MM-DD..."
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) return { yil: parseInt(isoMatch[1], 10), ay: parseInt(isoMatch[2], 10) };
  // DD.MM.YYYY format
  const trMatch = dateStr.match(/^\d{2}[./](\d{2})[./](\d{4})/);
  if (trMatch) return { yil: parseInt(trMatch[2], 10), ay: parseInt(trMatch[1], 10) };
  return null;
}
```

### Mevcut Dosya Yapıları

**Hook (`use-etebligat-query.ts`)**:
- State interface: `EtebligatState` (satır 48-62)
- Action type: satır 75-87
- initialState: satır 89-100
- reducer: satır 102-207
- Hook: satır 213-479
- Return interface: `UseEtebligatQueryReturn` (satır 64-69)
- WS events: `etebligat:query-progress`, `etebligat:query-results`, `etebligat:query-complete`, `etebligat:query-error`
- Ek events: `etebligat:zarf-detay-result/error`, `etebligat:pdf-result/error`

**Client (`etebligat-client.tsx`)**:
- Import'lar: satır 9-31
- Component state: satır 49-77
- handleQuery: satır 118-122
- UI yapısı: Form (satır 174-269), Progress (satır 288-296), Hata (satır 298-317), Sayı kartları (satır 319-344), Tablo (satır 346-355), Boş durum (satır 357-366), Zarf dialog (satır 368-387)

**Tablo (`etebligat-table.tsx`)**: Değişiklik GEREKMEZ — sadece tebligatlar[] prop'u alır

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `src/components/e-tebligat/hooks/use-etebligat-query.ts` | Düzenleme | isFromArchive, SHOW_ARCHIVE, pendingQueryRef, arşivleme, showArchiveData |
| `src/components/e-tebligat/etebligat-client.tsx` | Düzenleme | Filtre panel, overlap dialog, badge, arşiv butonu |

## Uygulama Planı

### Adım 1: Hook Güncelleme (`use-etebligat-query.ts`)

#### 1.1 State'e `isFromArchive` ekle
- `EtebligatState` interface'ine `isFromArchive: boolean` ekle (satır 62'den sonra)
- `initialState`'e `isFromArchive: false` ekle (satır 99'dan sonra)

#### 1.2 Action'a `SHOW_ARCHIVE` ekle
- Action type'a ekle: `| { type: "SHOW_ARCHIVE"; payload: { tebligatlar: TebligatItem[] } }` (satır 81'den sonra)

#### 1.3 Reducer güncellemeleri
- `RESULTS` case'ine `isFromArchive: false` ekle (satır 131 civarı, return objesine)
- `CLEAR` case'inden önce `SHOW_ARCHIVE` case ekle:
```typescript
case "SHOW_ARCHIVE":
  return {
    ...initialState,
    tebligatlar: action.payload.tebligatlar,
    totalCount: action.payload.tebligatlar.length,
    isFromArchive: true,
  };
```

#### 1.4 Return interface güncelle
- `UseEtebligatQueryReturn`'e ekle: `showArchiveData: (data: unknown[]) => void;`

#### 1.5 `pendingQueryRef` ekle
Hook fonksiyonunun başına (satır 217 civarı, `userIdRef`'den sonra):
```typescript
const pendingQueryRef = useRef<{
  customerId: string;
  tebligatlar: TebligatItem[];
} | null>(null);
```

#### 1.6 WS `etebligat:query-results` handler'ında sakla
Satır 268-273 — dispatch'ten sonra:
```typescript
// Arşivleme için sonuçları biriktir
if (pendingQueryRef.current) {
  pendingQueryRef.current.tebligatlar = pendingQueryRef.current.tebligatlar.concat(
    data.tebligatlar
  );
}
```

#### 1.7 WS `etebligat:query-complete` handler'ında arşivle
Satır 276-294 — toast'tan sonra, break'ten önce:
```typescript
// Arşivle — tebligZamani'nden aya dağıtımlı (arka planda)
if (pendingQueryRef.current) {
  const pq = pendingQueryRef.current;
  if (pq.tebligatlar.length > 0) {
    // tebligZamani'nden ay/yıl çıkar ve grupla
    const byMonth = new Map<string, TebligatItem[]>();
    for (const tebligat of pq.tebligatlar) {
      const parsed = parseTebligMonth(tebligat.tebligZamani);
      if (parsed) {
        const key = `${parsed.yil}-${String(parsed.ay).padStart(2, "0")}`;
        if (!byMonth.has(key)) byMonth.set(key, []);
        byMonth.get(key)!.push(tebligat);
      }
    }

    for (const [key, items] of byMonth) {
      const [yilStr, ayStr] = key.split("-");
      const archiveMonth = parseInt(ayStr, 10);
      const archiveYear = parseInt(yilStr, 10);

      fetch("/api/query-archives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: pq.customerId,
          queryType: "etebligat",
          month: archiveMonth,
          year: archiveYear,
          newResults: items,
          queryParams: { queryDate: new Date().toISOString() },
          dedupKey: ["tebligId"],
          meta: {
            totalCount: items.length,
            okunmus: items.filter(t => t.mukellefOkumaZamani !== null).length,
            okunmamis: items.filter(t => t.mukellefOkumaZamani === null).length,
          },
        }),
      })
        .then((res) => res.ok ? res.json() : null)
        .then((result) => {
          if (result) {
            console.log(`[ETEBLIGAT] Arşivlendi (${archiveMonth}/${archiveYear}): ${result.action}`);
          }
        })
        .catch(() => { /* Arşivleme hatası kritik değil */ });
    }
  }
  pendingQueryRef.current = null;
}
```

#### 1.8 `parseTebligMonth` helper fonksiyonu ekle
Reducer bölümünün üstüne (types'ın altına):
```typescript
/** tebligZamani'nden ay/yıl çıkar — "DD.MM.YYYY" veya "YYYY-MM-DD" */
function parseTebligMonth(dateStr: string): { ay: number; yil: number } | null {
  if (!dateStr) return null;
  // ISO: "2026-01-15T11:21:35" veya "2026-01-15"
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) return { yil: parseInt(isoMatch[1], 10), ay: parseInt(isoMatch[2], 10) };
  // TR: "31.08.2024 00:00:00" veya "31/08/2024"
  const trMatch = dateStr.match(/^\d{2}[./](\d{2})[./](\d{4})/);
  if (trMatch) return { yil: parseInt(trMatch[2], 10), ay: parseInt(trMatch[1], 10) };
  return null;
}
```

#### 1.9 WS `etebligat:query-error` handler'ında temizle
Satır 296-305 — toast.error'dan sonra:
```typescript
pendingQueryRef.current = null;
```

#### 1.10 `startQuery`'de pendingQueryRef set et
Satır 380 — `dispatch({ type: "QUERY_START" });`'den önce:
```typescript
pendingQueryRef.current = {
  customerId,
  tebligatlar: [],
};
```

#### 1.11 API hata durumunda pendingQueryRef temizle
Satır 391-398 ve 400-408 catch bloklarına:
```typescript
pendingQueryRef.current = null;
```

#### 1.12 `showArchiveData` callback ekle
`clearResults`'ın üstüne:
```typescript
const showArchiveData = useCallback((data: unknown[]) => {
  dispatch({
    type: "SHOW_ARCHIVE",
    payload: { tebligatlar: data as TebligatItem[] },
  });
}, []);
```

#### 1.13 Return objesine ekle
```typescript
return {
  ...state,
  startQuery,
  openZarf,
  viewPdf,
  clearResults,
  showArchiveData,  // YENİ
};
```

---

### Adım 2: Client Güncelleme (`etebligat-client.tsx`)

#### 2.1 Import eklemeleri
Satır 10 — mevcut lucide import'a `Archive` ekle:
```typescript
import { MailOpen, Loader2, AlertTriangle, ExternalLink, Info, ChevronsUpDown, Check, Mail, Archive } from "lucide-react";
```

Satır 29-31 — import'ların sonuna:
```typescript
import { Badge } from "@/components/ui/badge";
import { useQueryArchives, type OverlapInfo } from "@/components/query-archive/hooks/use-query-archives";
import QueryArchiveFilter from "@/components/query-archive/query-archive-filter";
import ArchiveOverlapDialog from "@/components/query-archive/archive-overlap-dialog";
```

#### 2.2 State eklemeleri
Satır 60-61 — pendingZarf state'inden sonra:
```typescript
// Arşiv filtre paneli
const [filterOpen, setFilterOpen] = useState(false);

// Overlap dialog
const [overlapOpen, setOverlapOpen] = useState(false);
const [overlapInfo, setOverlapInfo] = useState<OverlapInfo | null>(null);
```

#### 2.3 Hook destructuring güncelle
Satır 63-77 — `useEtebligatQuery()`'den `isFromArchive` ve `showArchiveData` ekle:
```typescript
const {
  tebligatlar,
  isLoading,
  progress,
  error,
  errorCode,
  totalCount,
  sayilar,
  zarfLoading,
  pdfLoading,
  isFromArchive,      // YENİ
  startQuery,
  openZarf,
  viewPdf,
  clearResults,
  showArchiveData,    // YENİ
} = useEtebligatQuery();

const { checkOverlap, loadArchiveDetail } = useQueryArchives();
```

#### 2.4 handleQuery güncelle — overlap kontrolü
Mevcut handleQuery'yi değiştir (satır 118-122):
```typescript
const handleQuery = useCallback(async () => {
  if (!selectedCustomerId || isLoading) return;

  // Overlap kontrolü — mevcut ay üzerinden
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const overlap = await checkOverlap("etebligat", selectedCustomerId, currentMonth, currentYear);

  if (overlap.hasOverlap) {
    setOverlapInfo({
      ...overlap,
      customerName: overlap.customerName || selectedCustomer?.kisaltma || selectedCustomer?.unvan,
    });
    setOverlapOpen(true);
    return;
  }

  clearResults();
  await startQuery(selectedCustomerId);
}, [selectedCustomerId, selectedCustomer, isLoading, startQuery, clearResults, checkOverlap]);
```

#### 2.5 Yeni handler'lar ekle
handleQuery'den sonra (handleOpenZarf'tan önce):
```typescript
// Overlap — arşivden göster
const handleShowFromArchive = useCallback(async () => {
  if (!overlapInfo?.archiveId) return;

  const detail = await loadArchiveDetail(overlapInfo.archiveId);
  if (detail && Array.isArray(detail.resultData)) {
    showArchiveData(detail.resultData);
    toast.success(`Arşivden ${detail.resultData.length} tebligat yüklendi`);
  }
  setOverlapInfo(null);
}, [overlapInfo, loadArchiveDetail, showArchiveData]);

// Overlap — yeniden sorgula
const handleRequery = useCallback(async () => {
  setOverlapInfo(null);
  clearResults();
  await startQuery(selectedCustomerId);
}, [selectedCustomerId, startQuery, clearResults]);

// Arşiv filtresinden veri göster
const handleShowArchiveData = useCallback(
  (_archiveId: string, data: unknown[]) => {
    showArchiveData(data);
    setFilterOpen(false);
  },
  [showArchiveData]
);
```

#### 2.6 hasQueried güncelle
Satır 148 — `isFromArchive` da ekle:
```typescript
const hasQueried = tebligatlar.length > 0 || error !== null || isFromArchive || (totalCount === 0 && !isLoading && progress.status === "Sorgulama tamamlandı");
```

#### 2.7 UI — Sorgula butonunun yanına Arşiv butonu
Satır 267 — `</Button>` (Sorgula)'dan sonra:
```tsx
{/* Arşiv Filtre Butonu */}
<Button
  variant={filterOpen ? "secondary" : "outline"}
  onClick={() => setFilterOpen(!filterOpen)}
  disabled={isLoading}
  className="h-9"
>
  <Archive className="h-4 w-4 mr-2" />
  Arşiv
</Button>
```

#### 2.8 UI — Filtre paneli + Overlap dialog
Form bölümünün kapanış div'inden (`</div>` satır 269) sonra, GİB uyarısından önce:
```tsx
{/* Arşiv Filtre Paneli (Inline) */}
{filterOpen && (
  <QueryArchiveFilter
    queryType="etebligat"
    customerId={selectedCustomerId || undefined}
    customerName={selectedCustomer?.kisaltma || selectedCustomer?.unvan}
    onShowArchiveData={handleShowArchiveData}
    onClose={() => setFilterOpen(false)}
    showAmount={false}
  />
)}

{/* Overlap Dialog */}
<ArchiveOverlapDialog
  open={overlapOpen}
  onOpenChange={setOverlapOpen}
  overlapInfo={overlapInfo ? {
    month: overlapInfo.month!,
    year: overlapInfo.year!,
    totalCount: overlapInfo.totalCount!,
    lastQueriedAt: overlapInfo.lastQueriedAt!,
    customerName: overlapInfo.customerName!,
    archiveId: overlapInfo.archiveId!,
  } : null}
  onShowArchive={handleShowFromArchive}
  onRequery={handleRequery}
/>
```

#### 2.9 UI — Arşivden Badge
Sayı kartlarından önce (satır 319'dan önce):
```tsx
{/* Arşivden Badge */}
{isFromArchive && tebligatlar.length > 0 && (
  <div className="flex items-center gap-2">
    <Badge variant="secondary" className="gap-1">
      <Archive className="h-3 w-3" />
      Arşivden gösteriliyor ({tebligatlar.length} tebligat)
    </Badge>
  </div>
)}
```

---

### Adım 3: Type Check + Doğrulama
- `npx tsc --noEmit` — tip hatası olmamalı

## Teknik Notlar

### E-Tebligat'a Özel Durumlar
1. **Tarih parse**: `tebligZamani` "DD.MM.YYYY HH:mm:ss" veya ISO format olabilir — `parseTebligMonth()` her ikisini handle eder
2. **Overlap kontrolü**: E-Tebligat'ta dönem seçimi olmadığı için mevcut ay üzerinden kontrol yapılır
3. **Aya dağıtım**: Tüm tebligatlar `tebligZamani`'ne göre aylara gruplanır, her grup ayrı arşiv kaydı olur
4. **dedupKey**: `["tebligId"]` — GİB'den gelen benzersiz tebligat ID'si
5. **meta**: `{ totalCount, okunmus, okunmamis }` — her ay grubu için ayrı sayılar
6. **Chunked sonuçlar**: E-Tebligat da chunk'lı gelebilir (RESULTS birden fazla kez tetiklenebilir), bu yüzden pendingQueryRef'e `.concat()` ile biriktiriyoruz
7. **Zarf/PDF işlemleri**: Arşivden gösterilen verilerde zarf açma ve PDF görüntüleme çalışmaya devam eder (GİB'e canlı istek atar)

### Referans Pattern Dosyaları (değişiklik YOK)
- `src/components/query-archive/hooks/use-query-archives.ts`
- `src/components/query-archive/query-archive-filter.tsx`
- `src/components/query-archive/archive-overlap-dialog.tsx`
- `src/app/api/query-archives/route.ts` (GET/POST)
- `src/components/tahsilat/hooks/use-tahsilat-query.ts` (aya dağıtım referansı)
- `src/components/pos/pos-client.tsx` (client UI referansı)

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| `tebligZamani` kullan (arşiv ay/yıl) | Tebligatın gerçek tarihi, kullanıcı beklentisiyle uyumlu | `kayitZamani` (sistem kayıt tarihi — daha az anlamlı) |
| Mevcut ay overlap kontrolü | Dönem seçimi yok, en mantıklı default | Tüm ayları kontrol et (karmaşık), overlap'i kaldır (UX kaybı) |
| Chunked concat | RESULTS birden fazla kez tetiklenebilir | Tek seferde saklama (chunk kayıp riski) |
| `showAmount={false}` | Tebligatların tutarı yok | N/A |
