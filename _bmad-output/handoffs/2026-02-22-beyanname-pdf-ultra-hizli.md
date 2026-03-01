# Handoff: Beyanname PDF Dialog Ultra Hızlı Yükleme
**Tarih:** 2026-02-22 11:45
**Durum:** ✅ Tamamlandı

## Görev Tanımı
> Beyanname arşivinden bir beyannameye tıkladığımda PDF dialog açılıyor ama PDF'in yüklenmesi çok uzun sürüyor. 3 katmanlı optimizasyon ile ultra hızlı yapılacak.

## Mevcut Durum Analizi

### Mevcut Akış (Arşiv Sayfası — YAVAŞ)
```
Tıkla → Dialog açılır → GET /api/intvrg/beyanname-pdf →
  Server: Prisma query → Supabase Storage download → Buffer → Response →
Client: blob() → createObjectURL → iframe render
```
**Toplam gecikme: ~500-900ms** (double-hop: client→server→supabase→server→client)

### Sorgulama Sayfası (HIZLI — referans pattern)
```
Sorgu tamamlanır → preloadPdfs() arka planda çalışır →
  POST /api/intvrg/beyanname-pdf → signed URL'ler alınır →
  3'er batch halinde fetch → blob URL cache'e yazılır →
Tıkla → cachedBlobUrl ile dialog anında açılır (0ms)
```

### Kritik Fark
- **Sorgulama sayfası**: `cachedBlobUrl` prop'u dialog'a geçiliyor (satır 1407) ✅
- **Arşiv sayfası**: `cachedBlobUrl` prop'u **geçilmiyor** (satır 1023-1035) ❌
- Arşiv sayfasında preload mekanizması **hiç yok** ❌

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `src/components/beyannameler/beyanname-arsiv-client.tsx` | Büyük | Preload + cache + hover intent ekleme |
| `src/components/beyannameler/beyanname-pdf-dialog.tsx` | Küçük | Signed URL direct mode + expire fallback |
| `src/app/api/intvrg/beyanname-pdf/route.ts` | Küçük | Tek beyoid signed URL endpoint'i ekleme |

## Uygulama Planı

### Katman 1: Signed URL ile Proxy Bypass (En Büyük Kazanç)
**Hedef:** ~500-900ms → ~100-200ms (4-5x hızlanma)

#### Adım 1.1: Tek beyoid signed URL endpoint'i
`src/app/api/intvrg/beyanname-pdf/route.ts` — GET handler'ında signed URL modu ekle.

Mevcut GET handler binary stream döndürüyor. Yeni: `?mode=signed` parametresi ile signed URL JSON döndürsün.

```typescript
// GET handler'ına eklenecek (satır 27 civarı, searchParams alındıktan sonra)
const mode = searchParams.get("mode"); // "signed" veya null

// ... doc bulunduktan sonra (satır 49 sonrası):
if (mode === "signed") {
  const signedUrl = await getSignedUrl(doc.path, 600); // 10 dk TTL
  return NextResponse.json({ signedUrl, fileName: doc.name });
}
// ... mevcut binary stream devam eder (fallback)
```

#### Adım 1.2: Dialog'da signed URL desteği
`src/components/beyannameler/beyanname-pdf-dialog.tsx` — Props'a `signedUrl` ekle, varsa direkt fetch et.

Dialog'un mevcut fetch akışı (satır 65-94):
```
// MEVCUT: /api/intvrg/beyanname-pdf?customerId=x&beyoid=y → binary proxy
// YENİ: cachedBlobUrl varsa → anında göster (değişiklik yok)
//        signedUrl varsa → direkt fetch + blob (tek hop)
//        hiçbiri yoksa → ?mode=signed ile signed URL al, sonra fetch
```

**Yeni akış (satır 46-99 arası değişecek):**
```typescript
useEffect(() => {
  if (!open || !customerId || !beyoid) return;

  // 1. Cache'de varsa anında göster
  if (cachedBlobUrl) {
    setBlobUrl(cachedBlobUrl);
    setLoading(false);
    setError(null);
    blobUrlRef.current = null;
    return;
  }

  let cancelled = false;
  setLoading(true);
  setError(null);
  setBlobUrl(null);

  (async () => {
    try {
      // 2. Signed URL al (proxy bypass — tek hop)
      const params = new URLSearchParams({ customerId, beyoid, mode: "signed" });
      const metaRes = await fetch(`/api/intvrg/beyanname-pdf?${params}`);
      if (!metaRes.ok) {
        const errData = await metaRes.json().catch(() => null);
        throw new Error(errData?.error || `HTTP ${metaRes.status}`);
      }
      const { signedUrl } = await metaRes.json();
      if (cancelled) return;

      // 3. Supabase'den direkt indir (server proxy yok)
      const pdfRes = await fetch(signedUrl);
      if (!pdfRes.ok) throw new Error("PDF indirilemedi");
      if (cancelled) return;

      const blob = await pdfRes.blob();
      if (cancelled) return;

      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setBlobUrl(url);
    } catch (err) {
      if (!cancelled) {
        const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
        setError(`PDF yüklenemedi: ${msg}`);
      }
    } finally {
      if (!cancelled) setLoading(false);
    }
  })();

  return () => { cancelled = true; };
}, [open, customerId, beyoid, cachedBlobUrl]);
```

**Not:** `signedUrl` prop kaldırıldı, dialog kendi signed URL'ini alıyor. `cachedBlobUrl` hâlâ öncelikli.

### Katman 2: Eager Preload (Filtre Sonrası)
**Hedef:** ~100-200ms → ~0ms (cache hit ile anında)

#### Adım 2.1: Arşiv sayfasına preload + cache state'i ekle
`src/components/beyannameler/beyanname-arsiv-client.tsx`

**Eklenecek state'ler** (mevcut state'lerin yanına, satır ~490 civarı):
```typescript
// PDF preload cache — beyoid → blobUrl
const [pdfCache, setPdfCache] = useState<Record<string, string>>({});
const pdfCacheRef = useRef<Record<string, string>>({});
pdfCacheRef.current = pdfCache;
const preloadAbortRef = useRef<AbortController | null>(null);
```

**Eklenecek preload fonksiyonu** (handleFilter sonrası):
```typescript
const preloadPdfs = useCallback((custId: string, beyoids: string[]) => {
  if (preloadAbortRef.current) preloadAbortRef.current.abort();

  const uncached = beyoids.filter(bid => !pdfCacheRef.current[bid]);
  if (uncached.length === 0) return;

  const controller = new AbortController();
  preloadAbortRef.current = controller;
  const signal = controller.signal;

  (async () => {
    try {
      // Toplu signed URL al
      const res = await fetch("/api/intvrg/beyanname-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: custId, beyoids: uncached }),
        signal,
      });
      if (!res.ok || signal.aborted) return;
      const { signedUrls } = await res.json() as { signedUrls: Record<string, string> };
      if (!signedUrls || signal.aborted) return;

      // 3'er batch halinde paralel indir
      const entries = Object.entries(signedUrls);
      const CONCURRENCY = 3;
      for (let i = 0; i < entries.length; i += CONCURRENCY) {
        if (signal.aborted) return;
        const batch = entries.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map(async ([beyoid, signedUrl]) => {
            if (signal.aborted) return;
            try {
              const pdfRes = await fetch(signedUrl, { signal });
              if (pdfRes.ok && !signal.aborted) {
                const blob = await pdfRes.blob();
                const blobUrl = URL.createObjectURL(blob);
                setPdfCache(prev => ({ ...prev, [beyoid]: blobUrl }));
              }
            } catch { /* abort veya network — sessiz geç */ }
          })
        );
      }
    } catch { /* API hatası — sessiz geç */ }
  })();
}, []);
```

#### Adım 2.2: Filtre sonrası preload tetikleme
`handleFilter` fonksiyonunda, data yüklendikten sonra:

```typescript
// handleFilter içinde, toast.success satırından sonra (satır ~603):
// Kaydedilmiş PDF'leri preload et
if (savedRes.ok) {
  const savedData = await savedRes.json();
  const beyoids = savedData.savedBeyoids || [];
  setSavedBeyoids(beyoids);
  // Preload başlat (arka planda)
  if (beyoids.length > 0) {
    preloadPdfs(selectedCustomerId, beyoids);
  }
}
```

**DİKKAT:** Mevcut kodda savedRes zaten paralel çekiliyor. `setSavedBeyoids` çağrısından sonra preload eklenmeli. Mevcut kodu düzenlerken `handleFilter` içindeki saved kısmını şöyle değiştir:

```typescript
// Kaydedilmiş beyoid'leri yükle ve preload başlat
let loadedBeyoids: string[] = [];
if (savedRes.ok) {
  const savedData = await savedRes.json();
  loadedBeyoids = savedData.savedBeyoids || [];
  setSavedBeyoids(loadedBeyoids);
}

// ... allItems sort ve set ...

// Preload başlat
if (loadedBeyoids.length > 0) {
  preloadPdfs(selectedCustomerId, loadedBeyoids);
}
```

#### Adım 2.3: Dialog'a cachedBlobUrl geçir
`beyanname-arsiv-client.tsx` satır 1023-1035 arası BeyannamePdfDialog:

```tsx
<BeyannamePdfDialog
  open={pdfDialogOpen}
  onOpenChange={(open) => {
    if (!open) {
      setPdfDialogOpen(false);
      setPdfLoading(null);
    }
  }}
  customerId={selectedCustomerId || null}
  beyoid={pdfDialogBeyoid}
  title={pdfDialogTitle}
  customerName={selectedCustomer?.kisaltma || selectedCustomer?.unvan}
  cachedBlobUrl={pdfDialogBeyoid ? pdfCache[pdfDialogBeyoid] ?? null : null}
/>
```

#### Adım 2.4: Cleanup (component unmount)
```typescript
useEffect(() => {
  return () => {
    if (preloadAbortRef.current) preloadAbortRef.current.abort();
    for (const url of Object.values(pdfCacheRef.current)) {
      URL.revokeObjectURL(url);
    }
  };
}, []);
```

#### Adım 2.5: Temizle işlemlerinde cache'i sıfırla
`handleClear` ve `handleClearArchive` içinde:
```typescript
// Mevcut cache blob URL'lerini temizle
for (const url of Object.values(pdfCacheRef.current)) {
  URL.revokeObjectURL(url);
}
setPdfCache({});
```

### Katman 3: Hover Intent Preload (Bonus)
**Hedef:** Cache miss durumunda bile ~200ms kazanç

#### Adım 3.1: BeyannameRow'a onHover callback ekle
`beyanname-arsiv-client.tsx` — `BeyannameRow` component'ı:

```tsx
const BeyannameRow = React.memo(function BeyannameRow({
  item,
  isSaved,
  isPdfLoading,
  onViewPdf,
  onHoverStart, // YENİ
}: {
  item: BeyannameItem;
  isSaved: boolean;
  isPdfLoading: boolean;
  onViewPdf: (b: BeyannameItem) => void;
  onHoverStart?: (b: BeyannameItem) => void; // YENİ
}) {
  return (
    <div
      // ... mevcut props ...
      onMouseEnter={() => isSaved && onHoverStart?.(item)} // YENİ
    >
      {/* ... mevcut içerik ... */}
    </div>
  );
});
```

#### Adım 3.2: BeyannameGroupList'e onHoverStart geçir
```tsx
// BeyannameGroupList props'una ekle:
onHoverStart?: (b: BeyannameItem) => void;

// BeyannameRow'a geçir:
<BeyannameRow
  key={item.beyoid}
  item={item}
  isSaved={savedSet.has(item.beyoid)}
  isPdfLoading={pdfLoading === item.beyoid}
  onViewPdf={onViewPdf}
  onHoverStart={onHoverStart} // YENİ
/>
```

#### Adım 3.3: Hover handler
`BeyannameArsivClientInner` içinde:

```typescript
// Hover'da tek PDF preload — cache'de yoksa signed URL al ve indir
const hoverPreloadRef = useRef<string | null>(null);
const handleHoverStart = useCallback((b: BeyannameItem) => {
  if (!b.beyoid || !selectedCustomerId) return;
  if (pdfCacheRef.current[b.beyoid]) return; // zaten cache'de
  if (hoverPreloadRef.current === b.beyoid) return; // zaten yükleniyor

  hoverPreloadRef.current = b.beyoid;

  (async () => {
    try {
      const params = new URLSearchParams({
        customerId: selectedCustomerId,
        beyoid: b.beyoid,
        mode: "signed",
      });
      const metaRes = await fetch(`/api/intvrg/beyanname-pdf?${params}`);
      if (!metaRes.ok) return;
      const { signedUrl } = await metaRes.json();
      if (!signedUrl) return;

      const pdfRes = await fetch(signedUrl);
      if (!pdfRes.ok) return;
      const blob = await pdfRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPdfCache(prev => ({ ...prev, [b.beyoid]: blobUrl }));
    } catch { /* sessiz */ }
    finally { hoverPreloadRef.current = null; }
  })();
}, [selectedCustomerId]);
```

#### Adım 3.4: BeyannameGroupList'e handler'ı geçir
Tüm `<BeyannameGroupList ... />` kullanımlarına `onHoverStart={handleHoverStart}` ekle.

## Teknik Notlar

### Signed URL Güvenliği
- Supabase signed URL'ler 10 dakika (600s) TTL ile oluşturuluyor
- `getSignedUrl(doc.path, 600)` — mevcut POST handler'da zaten bu değer kullanılıyor
- Dialog açılırken expire olmuş signed URL → fetch hatası → dialog kendi fallback signed URL'ini alır

### Preload Limitleri
- Bir mükellefin 100+ PDF'i olabilir. Hepsini preload etmek aşırı olur.
- CONCURRENCY = 3 ile sıralı batch yeterli
- Kullanıcı sayfadan çıkarsa `AbortController` ile iptal edilir

### Memory Yönetimi
- Blob URL'ler `URL.createObjectURL()` ile oluşturuluyor
- Component unmount'ta `URL.revokeObjectURL()` ile temizlenmeli
- `pdfCacheRef` ile cleanup sırasında güncel cache'e erişim

### CORS/CSP
- Supabase signed URL'leri `*.supabase.co` domain'inden gelir
- Client-side fetch → blob URL → iframe = same-origin, CSP sorunu yok
- Bu pattern sorgulama sayfasında (`use-beyanname-query.ts:779`) zaten çalışıyor

## Performans Beklentisi

| Senaryo | Önce | Katman 1 | Katman 2 | Katman 3 |
|---------|------|----------|----------|----------|
| İlk tıklama (cache miss) | ~800ms | ~200ms | ~200ms | ~0ms (hover hit) |
| Tekrar tıklama | ~800ms | ~200ms | ~0ms | ~0ms |
| Preload tamamlandıktan sonra | ~800ms | - | ~0ms | ~0ms |

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Signed URL + client fetch | Double-hop'u kaldırır, 4-5x hızlanma | iframe src=signedUrl (CSP riski) |
| Sorgulama sayfası pattern'ini kopyala | Kanıtlanmış çalışan mekanizma | Yeni hook yazma (gereksiz) |
| CONCURRENCY = 3 | Bandwidth/CPU dengesi | 5+ (mobilde sorun olur) |
| Hover intent preload | Cache miss'te bile hızlı | Intersection Observer (daha karmaşık) |
| cachedBlobUrl öncelikli | 0ms latency, en iyi UX | Signed URL direkt iframe (CORS riski) |
