# Handoff: Sorgulama Arşivi ADIM 2 — OKC + Tahsilat Entegrasyonu
**Tarih:** 2026-02-15 23:30
**Durum:** ✅ Tamamlandı (2026-02-15)

## Görev Tanımı
> Sorgulama Arşivi & Filtreleme özelliğinin ADIM 2'si: Epic 5 (OKC) ve Epic 1 (Tahsilat) modüllerine arşiv entegrasyonu.

## Tamamlanan Çalışma (ADIM 1)
ADIM 1 başarıyla tamamlandı. Altyapı (Epic 0) + POS pilot (Epic 4) hazır:

### Oluşturulan Altyapı Dosyaları
1. **prisma/schema.prisma** — `query_archives` modeli eklendi + relation'lar
2. **src/app/api/query-archives/route.ts** — GET (liste/filtre) + POST (kaydet/merge)
3. **src/app/api/query-archives/check-overlap/route.ts** — POST (çakışma kontrolü)
4. **src/app/api/query-archives/[id]/route.ts** — GET (detay) + DELETE (sil)
5. **src/components/query-archive/hooks/use-query-archives.ts** — Ortak hook
6. **src/components/query-archive/query-archive-filter.tsx** — Inline filtre paneli
7. **src/components/query-archive/archive-overlap-dialog.tsx** — Çakışma uyarı dialog'u

### POS Pilot Entegrasyonu (Referans Pattern!)
- **src/components/pos/hooks/use-pos-query.ts** — Arşivleme + showArchiveData
- **src/components/pos/pos-client.tsx** — Filtre paneli, overlap dialog, badge

## Uygulama Planı

### GÖREV 1: OKC Hook Güncelleme
**Dosya:** `src/components/okc/hooks/use-okc-query.ts`

**Değişiklikler (POS hook pattern'ini takip et):**

1. State'e `isFromArchive: boolean` ekle (initialState + interface)
2. Action tipine `SHOW_ARCHIVE` ekle
3. Reducer'a `SHOW_ARCHIVE` case ekle
4. `pendingQueryRef` ekle (customerId, ay, yil, bildirimler, meta tutar ref)
5. WS `intvrg:okc-results` handler'ında: pendingQueryRef'e bildirimler/meta sakla
6. WS `intvrg:okc-complete` handler'ında: arşivleme fetch çağrısı ekle
7. WS `intvrg:okc-error` handler'ında: pendingQueryRef null'la
8. `startQuery`'de: pendingQueryRef'i set et
9. `showArchiveData` callback ekle
10. Return'e `showArchiveData` ve `isFromArchive` ekle
11. Interface'e (`UseOkcQueryReturn`) `showArchiveData` ve `isFromArchive` ekle

**Arşivleme Parametreleri:**
```typescript
{
  customerId: pq.customerId,
  queryType: "okc",
  month: parseInt(pq.ay, 10),
  year: parseInt(pq.yil, 10),
  newResults: pq.bildirimler,
  queryParams: { ay: parseInt(pq.ay, 10), yil: parseInt(pq.yil, 10) },
  dedupKey: ["sicilNo", "bildirimTarih"],
  meta: { totalCount: pq.bildirimler.length },
}
```

### GÖREV 2: OKC Client Güncelleme
**Dosya:** `src/components/okc/okc-client.tsx`

**Import eklemeleri:**
```typescript
import { Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQueryArchives, type OverlapInfo } from "@/components/query-archive/hooks/use-query-archives";
import QueryArchiveFilter from "@/components/query-archive/query-archive-filter";
import ArchiveOverlapDialog from "@/components/query-archive/archive-overlap-dialog";
```

**State eklemeleri (OkcClient component içinde):**
```typescript
const [filterOpen, setFilterOpen] = useState(false);
const [overlapOpen, setOverlapOpen] = useState(false);
const [overlapInfo, setOverlapInfo] = useState<OverlapInfo | null>(null);
```

**Hook kullanımı:**
```typescript
const { checkOverlap, loadArchiveDetail } = useQueryArchives();
// + usePosQuery'den isFromArchive ve showArchiveData al
```

**handleQuery güncelleme:**
- Sorgula'dan önce `checkOverlap("okc", selectedCustomerId, parseInt(ay,10), parseInt(yil,10))` çağır
- Overlap varsa: setOverlapInfo → setOverlapOpen(true) → return
- Yoksa: devam et

**Yeni handler'lar:**
- `handleShowFromArchive`: loadArchiveDetail → showArchiveData
- `handleRequery`: setOverlapInfo(null) → startQuery
- `handleShowArchiveData`: filtreden gelen veriyi göster

**UI eklemeleri:**
1. Sorgula butonunun yanına "Arşiv" butonu ekle (Archive ikonu)
2. Sonuç tablosunun üstüne `isFromArchive` ise `<Badge>Arşivden gösteriliyor</Badge>` ekle
3. Filtre panelini butonların altına koşullu render et
4. `ArchiveOverlapDialog` component'ini ekle
5. `QueryArchiveFilter` props: `queryType="okc"`, `customerId`, `showAmount={false}`

### GÖREV 3: Tahsilat Hook Güncelleme
**Dosya:** `src/components/tahsilat/hooks/use-tahsilat-query.ts`

**Değişiklikler (POS hook pattern'ini takip et):**

**ÖNEMLİ FARK: Tahsilat tarih aralığı sorgulaması yapar (basAy-basYil / bitAy-bitYil)**
Arşivleme mantığı: Tahsilat'ta `vergidonem` alanından ay/yıl çıkarılır ve her aya ayrı arşivlenir.

1. State'e `isFromArchive: boolean` ekle
2. Action tipine `SHOW_ARCHIVE` ekle (payload: `{ tahsilatlar: TahsilatFis[] }`)
3. Reducer'a `SHOW_ARCHIVE` case ekle
4. `pendingQueryRef` ekle (customerId, basAy, basYil, bitAy, bitYil, tahsilatlar, meta)
5. WS `intvrg:tahsilat-results` handler'ında: pendingQueryRef'e sakla
6. WS `intvrg:tahsilat-complete` handler'ında: **aya dağıtımlı arşivleme**
7. WS `intvrg:tahsilat-error` handler'ında: pendingQueryRef null'la
8. `showArchiveData`, `clearResults` callback'leri
9. Return ve interface güncelle

**Aya Dağıtım Mantığı (COMPLETE handler'da):**
```typescript
// Tahsilat'ta vergidonem formatı: "2025/01", "2025/02" gibi
// Her tahsilat kaydını vergidonem'den çıkarılan ay/yıl'a göre grupla
// Her grup için ayrı arşivleme isteği gönder

if (pendingQueryRef.current) {
  const pq = pendingQueryRef.current;
  if (pq.tahsilatlar.length > 0) {
    // Aya göre grupla
    const byMonth = new Map<string, TahsilatFis[]>();
    for (const fis of pq.tahsilatlar) {
      // vergidonem formatı: "2025/01" → yil=2025, ay=1
      const parts = fis.vergidonem?.split("/");
      if (parts && parts.length === 2) {
        const key = `${parts[0]}-${parts[1]}`;
        if (!byMonth.has(key)) byMonth.set(key, []);
        byMonth.get(key)!.push(fis);
      }
    }

    // Her ay için ayrı arşivleme
    for (const [key, items] of byMonth) {
      const [yilStr, ayStr] = key.split("-");
      const archiveMonth = parseInt(ayStr, 10);
      const archiveYear = parseInt(yilStr, 10);

      fetch("/api/query-archives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: pq.customerId,
          queryType: "tahsilat",
          month: archiveMonth,
          year: archiveYear,
          newResults: items,
          queryParams: { basAy: pq.basAy, basYil: pq.basYil, bitAy: pq.bitAy, bitYil: pq.bitYil },
          dedupKey: ["tahsilatoid"],
          meta: { totalCount: items.length },
        }),
      })
        .then((res) => res.ok ? res.json() : null)
        .then((result) => {
          if (result) {
            console.log(`[TAHSILAT] Arşivlendi (${archiveMonth}/${archiveYear}): ${result.action}`);
          }
        })
        .catch(() => { /* sessiz */ });
    }
  }
  pendingQueryRef.current = null;
}
```

**Dedup key:** `["tahsilatoid"]` — her tahsilat fişinin benzersiz ID'si

### GÖREV 4: Tahsilat Client Güncelleme
**Dosya:** `src/components/tahsilat/tahsilat-client.tsx`

**Import eklemeleri:**
```typescript
import { Archive } from "lucide-react"; // Filter zaten import'ta
import { Badge } from "@/components/ui/badge";
import { useQueryArchives, type OverlapInfo } from "@/components/query-archive/hooks/use-query-archives";
import QueryArchiveFilter from "@/components/query-archive/query-archive-filter";
import ArchiveOverlapDialog from "@/components/query-archive/archive-overlap-dialog";
```

**State eklemeleri:**
```typescript
const [filterOpen, setFilterOpen] = useState(false);
const [overlapOpen, setOverlapOpen] = useState(false);
const [overlapInfo, setOverlapInfo] = useState<OverlapInfo | null>(null);
```

**ÖNEMLİ FARK: Tahsilat'ta overlap kontrolü birden fazla ay için yapılmalı**
Tahsilat tarih aralığı seçiyor (basAy/basYil - bitAy/bitYil).
Overlap kontrolü: bitAy/bitYil için tek kontrol yapılabilir veya basit yaklaşım olarak
sadece tek ay kontrolü yapılır. Basit yaklaşım önerisi:
```typescript
// En basit: bitiş ayı için overlap kontrolü yap
const month = parseInt(bitAy, 10);
const year = parseInt(bitYil, 10);
const overlap = await checkOverlap("tahsilat", selectedCustomerId, month, year);
```

**handleQuery güncelleme:**
- Overlap kontrolü ekle (yukarıdaki gibi)
- Overlap varsa dialog göster

**Yeni handler'lar:**
- `handleShowFromArchive`: loadArchiveDetail → showArchiveData
- `handleRequery`: setOverlapInfo(null) → startQuery(selectedCustomerId, basAy, basYil, bitAy, bitYil)
- `handleShowArchiveData`: filtreden gelen veriyi göster, filterOpen kapat

**UI eklemeleri:**
1. Butonlar arasına "Arşiv" butonu (Archive ikonu)
2. `isFromArchive` ise `<Badge>Arşivden gösteriliyor</Badge>`
3. QueryArchiveFilter: `queryType="tahsilat"`, `customerId`, `showAmount={true}`, `amountLabel="Toplam Ödenen"`
4. ArchiveOverlapDialog

### GÖREV 5: Type Check
- `npx tsc --noEmit` ile tüm dosyaları kontrol et
- Hata varsa düzelt

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `src/components/okc/hooks/use-okc-query.ts` | Düzenleme | Arşivleme + showArchiveData + isFromArchive |
| `src/components/okc/okc-client.tsx` | Düzenleme | Filtre panel, overlap dialog, badge |
| `src/components/tahsilat/hooks/use-tahsilat-query.ts` | Düzenleme | Arşivleme (aya dağıtımlı) + showArchiveData |
| `src/components/tahsilat/tahsilat-client.tsx` | Düzenleme | Filtre panel, overlap dialog, badge |

## Teknik Notlar

### OKC vs POS Farkları
- OKC: `bildirimler` (POS: `posBilgileri`), `OkcBildirim` tipi
- OKC dedup: `["sicilNo", "bildirimTarih"]`
- OKC WS event'leri: `intvrg:okc-*` (POS: `intvrg:pos-*`)
- OKC tek ay sorgusu (POS gibi)

### Tahsilat vs POS Farkları
- Tahsilat: `tahsilatlar`, `TahsilatFis` tipi
- Tahsilat dedup: `["tahsilatoid"]`
- Tahsilat WS event'leri: `intvrg:tahsilat-*`
- **KRİTİK:** Tahsilat tarih aralığı sorgusu (basAy-basYil / bitAy-bitYil)
- **KRİTİK:** Aya dağıtım gerekiyor — vergidonem alanından (format: "2025/01") ay/yıl çıkarılır
- Tahsilat client'ta zaten `Filter` import'u var (vergi türü filtresi)

### Referans Dosya: POS Hook + Client
POS entegrasyonu ADIM 1'de tamamlandı ve çalışıyor. Tam pattern'i takip et:
- `src/components/pos/hooks/use-pos-query.ts` — Hook pattern
- `src/components/pos/pos-client.tsx` — Client pattern (satır 280-400 arşiv state'leri ve handler'lar)

## Doğrulama
Her görev tamamlandıktan sonra:
1. `npx tsc --noEmit` — tip hatası olmamalı
2. OKC sorgulama → query_archives'da kayıt oluşmalı
3. Tahsilat sorgulama → vergidonem'e göre aylara dağıtılmış arşiv kayıtları oluşmalı
4. Aynı dönem tekrar sorgulanınca → overlap dialog görünmeli
5. "Arşivden Göster" → veri yüklenmeli
6. "Yeniden Sorgula" → merge çalışmalı
7. Arşiv filtre paneli açılmalı ve sonuçlar gösterilmeli
