# Handoff: Beyanname Sorgulama + PDF İndirme Pipeline Mimarisi
**Tarih:** 2026-02-20 14:30
**Durum:** ✅ Tamamlandı (2026-02-20)

## Görev Tanımı
> Beyanname sorgulama sayfasında (`/dashboard/beyannameler`) sorgulama yapıldığında, mevcut sıralı akışı (sorgu → bekle → indir) tamamen pipeline mimarisine çevir. Electron Bot beyanname listesini aldığı anda PDF indirmeye paralel başlasın. Frontend ve bot senkronize çalışsın, 0 delay.

## Mevcut Mimari (SORUN)

```
MEVCUT AKIŞ (Sıralı — Yavaş):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1] Kullanıcı "Sorgula" tıklar
    └─► POST /api/intvrg/beyanname → _internal/bot-command → WS → Electron Bot

[2] Electron Bot: queryBeyannameler()
    └─► GİB Login (captcha + auth) → Bearer Token → IVD Token → INTVRG Sorgu
    └─► WS: intvrg:beyanname-results (beyanname listesi)
    └─► WS: intvrg:beyanname-complete ← ★ BİTTİ SINYALI

[3] Frontend: queryDone = true
    ├─► [Effect A] loadSavedBeyoids() → GET /api/intvrg/beyanname-save
    ├─► [Effect B] saveOrMerge() × N ay → POST /api/query-archives × N  ← 1.4s/istek
    └─► [Effect C] 500ms setTimeout → downloadAll()
                    └─► POST /api/intvrg/beyanname-bulk-download
                        └─► _internal/bot-command → WS → Electron Bot

[4] Electron Bot: intvrg:beyanname-bulk-download handler
    └─► ivdTokenCache kontrolü
    └─► PDF indir (5 concurrent) → Her biri WS: bulk-pdf-result
    └─► WS: beyanname-bulk-complete

[5] Frontend: bulk-complete
    └─► Buffer'daki PDF'leri batch kaydet → POST /api/intvrg/beyanname-bulk-save × N batch

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOPLAM GECİKME:
- savedBeyoids yükleme: ~200ms
- saveOrMerge × N ay: ~1.4s × N (fire-and-forget ama log'da görünüyor)
- 500ms setTimeout bekleme
- POST /api/intvrg/beyanname-bulk-download round-trip: ~100ms
- ivdTokenCache kontrolü + WS round-trip: ~50ms
───────────────────────────────────────────────────
≈ 2-3 saniye boşa geçen süre (sorgu bitti → PDF indirme başladı arası)
```

## Hedef Mimari (PIPELINE)

```
YENİ AKIŞ (Pipeline — Anında):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1] Kullanıcı "Sorgula" tıklar
    └─► POST /api/intvrg/beyanname → _internal/bot-command → WS → Electron Bot
        ★ savedBeyoids da komutle birlikte gönderilir!

[2] Electron Bot: TEK KOMUT (intvrg:beyanname-query-and-download)
    ├─► GİB Login → Bearer Token → IVD Token
    ├─► INTVRG Beyanname Sorgusu → Beyanname listesi
    │
    ├─► WS: intvrg:beyanname-results (beyanname listesi)  ← ★ ANINDA
    │
    ├─► savedBeyoids filtreleme (bot tarafında)
    │
    ├─► PDF indirme başlar (10 concurrent) ← ★ 0 DELAY!
    │   ├─► Her PDF → WS: intvrg:beyanname-bulk-pdf-result
    │   ├─► Her PDF → WS: intvrg:beyanname-bulk-pdf-result
    │   └─► ...
    │
    └─► WS: intvrg:beyanname-pipeline-complete (tüm istatistikler)

[3] Frontend: Eş zamanlı
    ├─► beyanname-results → Tabloyu göster + arşive kaydet (fire & forget)
    ├─► bulk-pdf-result → PDF cache + progress bar güncelle
    └─► pipeline-complete → Toplu Supabase kayıt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOPLAM GECİKME: 0ms (sorgu biter bitmez PDF indirme başlar)
```

## Araştırma Bulguları

### Mevcut Dosya Analizi

| Dosya | Satır | Rol |
|-------|-------|-----|
| `electron-bot/src/main/intvrg-beyanname-api.ts` | 475 satır | `queryBeyannameler()`, `queryBeyannamelerMultiYear()`, `fetchBeyannamePdf()` fonksiyonları |
| `electron-bot/src/main/index.ts` | ~2000 satır | `intvrg:beyanname-query` handler (satır 1108-1242), `intvrg:beyanname-multi-query` (1247-1389), `intvrg:beyanname-bulk-download` (1394-1496), `ivdTokenCache` (satır 1100) |
| `src/app/api/intvrg/beyanname/route.ts` | 203 satır | Sorgu başlatma API, bot komutu gönderir |
| `src/components/beyannameler/hooks/use-beyanname-query.ts` | 852 satır | WS event dinleme, `downloadAll()`, `autoDownloadRef` (500ms delay) |
| `src/components/beyannameler/beyanname-client.tsx` | ~1100+ satır | Auto-download useEffect (918-948), savedBeyoids yükleme, arşiv kaydetme |

### Kritik Kod Noktaları

**1. IVD Token Cache (index.ts:1100)**
```typescript
const ivdTokenCache = new Map<string, { token: string; timestamp: number }>();
const IVD_TOKEN_TTL = 25 * 60 * 1000; // 25 dakika
```
Pipeline'da token cache'e gerek yok — token doğrudan sorgudan indirmeye aktarılır.

**2. Auto-Download Mekanizması (beyanname-client.tsx:918-941)**
```typescript
const autoDownloadRef = useRef(false);
useEffect(() => {
  if (queryDone && beyannameler.length > 0 && selectedCustomerId && !downloadProgress) {
    const timer = setTimeout(() => { // ★ 500ms DELAY — KALDIRILACAK
      if (!autoDownloadRef.current) {
        autoDownloadRef.current = true;
        downloadAll(selectedCustomerId, withBeyoid);
      }
    }, 500);
  }
}, [queryDone, beyannameler, selectedCustomerId, downloadProgress, savedBeyoids, downloadAll]);
```
Bu tüm mekanizma kaldırılacak.

**3. downloadAll() fonksiyonu (use-beyanname-query.ts:675-735)**
```typescript
const downloadAll = useCallback(async (customerId, beyannameler) => {
  const toDownload = beyannameler.filter(b => b.beyoid && !state.savedBeyoids.includes(b.beyoid));
  // POST /api/intvrg/beyanname-bulk-download
});
```
Bu fonksiyon kaldırılacak — PDF indirme artık bot tarafında otomatik.

**4. Bulk Download Handler (index.ts:1394-1496)**
```typescript
wsClient.on('intvrg:beyanname-bulk-download', async (data) => {
  const CONCURRENCY = 5; // ★ 10'a çıkarılacak
  for (let i = 0; i < beyannameler.length; i += CONCURRENCY) {
    const chunk = beyannameler.slice(i, i + CONCURRENCY);
    await Promise.allSettled(chunk.map(downloadOne));
  }
});
```
Bu ayrı handler kaldırılacak, logic pipeline handler'a taşınacak.

**5. savedBeyoids Yükleme (beyanname-client.tsx:652-657)**
```typescript
useEffect(() => {
  if (queryDone && selectedCustomerId && beyannameler.length > 0) {
    loadSavedBeyoids(selectedCustomerId);
  }
}, [queryDone, selectedCustomerId, beyannameler.length, loadSavedBeyoids]);
```
Bu, queryDone'dan ÖNCE (customer seçildiğinde) yapılacak.

### Multi-Year Akış (Çoklu Yıl)

Çoklu yıl sorgusunda her chunk (yıl) için ayrı GİB API çağrısı yapılıyor:
- `splitIntoYearChunks()` → yıl bazlı böl
- Her chunk sıralı sorgulanır (GİB rate-limit koruması — 2s delay)
- Chunk sonuçları `intvrg:beyanname-multi-chunk-results` ile frontend'e gönderiliyor

Pipeline'da:
- Her chunk'ın sonuçları gelir gelmez o chunk'ın PDF'leri indirilmeye başlar
- Bir sonraki chunk sorgulanırken önceki chunk'ın PDF'leri paralel iniyor

## Etkilenecek Dosyalar

| # | Dosya | Değişiklik Tipi | Detay |
|---|-------|----------------|-------|
| 1 | `electron-bot/src/main/intvrg-beyanname-api.ts` | Yeni fonksiyon ekleme | `queryAndDownloadPipeline()` fonksiyonu ekle |
| 2 | `electron-bot/src/main/index.ts` | Handler ekleme/düzenleme | Yeni `intvrg:beyanname-query-and-download` handler. Eski `intvrg:beyanname-query` ve `intvrg:beyanname-bulk-download` handler'larını koru (geriye uyumluluk) ama yeni sorgulamalar pipeline kullanacak |
| 3 | `src/app/api/intvrg/beyanname/route.ts` | Düzenleme | Bot komutuna `savedBeyoids` ekle, komut tipini `intvrg:beyanname-query-and-download` yap |
| 4 | `src/components/beyannameler/hooks/use-beyanname-query.ts` | Büyük refactor | `downloadAll` kaldır, `autoDownloadRef` kaldır, `intvrg:beyanname-pipeline-complete` event ekle, `startQuery`'ye savedBeyoids parametresi ekle |
| 5 | `src/components/beyannameler/beyanname-client.tsx` | Düzenleme | Auto-download effect kaldır, savedBeyoids pre-load (customer seçiminde), startQuery'ye savedBeyoids geçir |

## Uygulama Planı

### Adım 1: `intvrg-beyanname-api.ts` — Pipeline Fonksiyonu
- [ ] Yeni `queryAndDownloadPipeline()` fonksiyonu yaz
- [ ] Parametreler: `params: BeyannameQueryParams, skipBeyoids: string[], callbacks: PipelineCallbacks`
- [ ] Akış: Login → IVD Token → Query → Send Results → Filter (skip saved) → Download PDFs (10 concurrent)
- [ ] Callbacks: `onProgress`, `onResults`, `onPdfResult`, `onPdfSkip`, `onComplete`
- [ ] Çoklu yıl versiyonu: `queryAndDownloadPipelineMultiYear()` — chunk bazlı pipeline

```typescript
// Yeni type'lar
export interface PipelineCallbacks {
  onProgress: (status: string) => void;
  onResults: (beyannameler: BeyannameItem[]) => void;
  onPdfResult: (data: {
    pdfBase64: string;
    turKodu: string;
    turAdi: string;
    donem: string;
    beyoid: string;
    versiyon: string;
    downloadedCount: number;
    totalCount: number;
  }) => void;
  onPdfSkip: (data: { beyoid: string; turAdi: string; error: string }) => void;
  onComplete: (stats: {
    totalQueried: number;
    totalDownloaded: number;
    totalFailed: number;
    totalSkipped: number;
  }) => void;
}

export async function queryAndDownloadPipeline(
  params: BeyannameQueryParams,
  skipBeyoids: string[],
  callbacks: PipelineCallbacks,
): Promise<{ success: boolean; ivdToken?: string; beyannameler: BeyannameItem[]; error?: string }> {
  // 1. Login
  callbacks.onProgress('GİB Dijital VD\'ye giriş yapılıyor...');
  const bearerToken = await gibDijitalLogin(params.userid, params.password, params.captchaApiKey, params.ocrSpaceApiKey);

  // 2. IVD Token
  callbacks.onProgress('İnternet Vergi Dairesi oturumu açılıyor...');
  const ivdToken = await getIvdToken(bearerToken);

  // 3. Beyanname sorgusu
  callbacks.onProgress('Beyannameler sorgulanıyor...');
  const client = new IntrvrgClient(ivdToken, params.vkn);
  const result = await client.callDispatch(...);
  const beyannameler = parseBeyannameler(result);

  // 4. Sonuçları gönder (★ ANINDA)
  callbacks.onResults(beyannameler);
  callbacks.onProgress(`${beyannameler.length} beyanname bulundu, PDF'ler indiriliyor...`);

  // 5. Kaydedilmemiş olanları filtrele
  const skipSet = new Set(skipBeyoids);
  const toDownload = beyannameler.filter(b => b.beyoid && !skipSet.has(b.beyoid));
  const skippedCount = beyannameler.length - toDownload.length;

  if (toDownload.length === 0) {
    callbacks.onComplete({ totalQueried: beyannameler.length, totalDownloaded: 0, totalFailed: 0, totalSkipped: skippedCount });
    return { success: true, ivdToken, beyannameler };
  }

  // 6. PDF indirme (★ 0 DELAY — ANINDA BAŞLAR)
  let downloaded = 0;
  let failed = 0;
  const CONCURRENCY = 10;

  for (let i = 0; i < toDownload.length; i += CONCURRENCY) {
    const chunk = toDownload.slice(i, i + CONCURRENCY);
    await Promise.allSettled(chunk.map(async (item) => {
      const pdfResult = await fetchBeyannamePdf(ivdToken, item.beyoid);
      if (pdfResult.success && pdfResult.pdfBase64) {
        downloaded++;
        callbacks.onPdfResult({ pdfBase64: pdfResult.pdfBase64, ...item, downloadedCount: downloaded, totalCount: toDownload.length });
      } else {
        failed++;
        callbacks.onPdfSkip({ beyoid: item.beyoid, turAdi: item.turAdi, error: pdfResult.error || 'PDF indirilemedi' });
      }
    }));
  }

  // 7. Tamamlandı
  callbacks.onComplete({ totalQueried: beyannameler.length, totalDownloaded: downloaded, totalFailed: failed, totalSkipped: skippedCount });
  return { success: true, ivdToken, beyannameler };
}
```

### Adım 2: `index.ts` — Yeni Pipeline Handler
- [ ] `intvrg:beyanname-query-and-download` handler ekle
- [ ] Mevcut `intvrg:beyanname-query` handler'ı koru (geriye uyumluluk)
- [ ] Mevcut `intvrg:beyanname-bulk-download` handler'ı koru (geriye uyumluluk)
- [ ] Pipeline handler'da `queryAndDownloadPipeline()` çağır
- [ ] Callback'leri WS mesajlarına mapple:
  - `onProgress` → `intvrg:beyanname-progress`
  - `onResults` → `intvrg:beyanname-results`
  - `onPdfResult` → `intvrg:beyanname-bulk-pdf-result`
  - `onPdfSkip` → `intvrg:beyanname-bulk-pdf-skip`
  - `onComplete` → `intvrg:beyanname-pipeline-complete` (YENİ EVENT)
- [ ] IVD token'ı cache'le (pipeline sonunda)
- [ ] `activeBeyannameQueries` kontrolü ekle

```typescript
// index.ts — Yeni handler
wsClient.on('intvrg:beyanname-query-and-download', async (data: BotCommandData) => {
  const customerName = data.customerName as string | undefined;
  const requesterId = data.userId as string | undefined;
  const skipBeyoids = (data.savedBeyoids as string[]) || [];

  // Duplicate query guard
  const queryKey = `pipeline-${data.userid}-${data.basAy}${data.basYil}-${data.bitAy}${data.bitYil}`;
  if (activeBeyannameQueries.has(queryKey)) { ... return; }
  activeBeyannameQueries.set(queryKey, true);

  try {
    const { queryAndDownloadPipeline } = await import('./intvrg-beyanname-api');

    const result = await queryAndDownloadPipeline(
      { userid, password, vkn, basAy, basYil, bitAy, bitYil, captchaApiKey, ocrSpaceApiKey },
      skipBeyoids,
      {
        onProgress: (status) => wsClient.send('intvrg:beyanname-progress', { status, customerName, requesterId }),
        onResults: (beyannameler) => {
          wsClient.send('intvrg:beyanname-results', { beyannameler, customerName, requesterId });
          // queryDone sinyali de gönder (frontend tablo göstersin)
          wsClient.send('intvrg:beyanname-complete', { success: true, totalCount: beyannameler.length, customerName, requesterId });
        },
        onPdfResult: (data) => wsClient.send('intvrg:beyanname-bulk-pdf-result', { ...data, requesterId }),
        onPdfSkip: (data) => wsClient.send('intvrg:beyanname-bulk-pdf-skip', { ...data, requesterId }),
        onComplete: (stats) => wsClient.send('intvrg:beyanname-pipeline-complete', { ...stats, customerName, requesterId }),
      },
    );

    // IVD token cache'le
    if (result.ivdToken && data.vkn) {
      ivdTokenCache.set(data.vkn as string, { token: result.ivdToken, timestamp: Date.now() });
    }
  } catch (e: any) { ... } finally {
    activeBeyannameQueries.delete(queryKey);
  }
});
```

### Adım 3: `beyanname/route.ts` — API Değişikliği
- [ ] Komut tipini `intvrg:beyanname-query-and-download` yap (tek yıl için)
- [ ] Çoklu yıl için `intvrg:beyanname-multi-query-and-download` komut tipi
- [ ] `savedBeyoids`'i request body'den al veya ayrı bir endpoint ile al
- [ ] Bot komutuna `savedBeyoids` ekle

```typescript
// route.ts değişikliği
const commandType = basYil !== bitYil
  ? "intvrg:beyanname-multi-query-and-download"
  : "intvrg:beyanname-query-and-download";

const response = await fetch(internalUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tenantId,
    type: commandType,
    data: {
      userid, password, vkn: customer.vknTckn,
      basAy, basYil, bitAy, bitYil,
      customerName, captchaApiKey, ocrSpaceApiKey, userId: user.id,
      savedBeyoids: body.savedBeyoids || [], // ★ YENİ
    },
  }),
});
```

### Adım 4: `use-beyanname-query.ts` — Hook Refactor
- [ ] `downloadAll` fonksiyonunu kaldır (artık bot otomatik indiriyor)
- [ ] `startQuery` imzasını güncelle: `savedBeyoids` parametresi ekle
- [ ] `DOWNLOAD_START` action'ı `COMPLETE` reducer'ında otomatik tetiklensin
- [ ] Yeni `intvrg:beyanname-pipeline-complete` event handler ekle
- [ ] `autoDownloadRef` ve 500ms setTimeout'u tamamen kaldır
- [ ] `COMPLETE` reducer'ında `allComplete` hesaplamasını güncelle:
  - Beyanname yoksa → `allComplete = true`
  - Beyanname var ve hepsi zaten kaydedilmişse → `allComplete = true`
  - Aksi halde → PDF'ler iniyor, `pipeline-complete` beklenecek

```typescript
// startQuery değişikliği
const startQuery = useCallback(
  async (customerId: string, basAy: string, basYil: string, bitAy: string, bitYil: string, savedBeyoids: string[]) => {
    dispatch({ type: "QUERY_START" });

    const response = await fetch("/api/intvrg/beyanname", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, basAy, basYil, bitAy, bitYil, savedBeyoids }), // ★ savedBeyoids eklendi
    });
    // ...
  },
  [state.isLoading]
);

// Yeni WS event handler (ws.onmessage switch'e ekle)
case "intvrg:beyanname-pipeline-complete": {
  // Tüm PDF'ler indirildi — toplu kaydet
  const bufferedItems = [...pdfBufferRef.current];
  const cId = bulkCustomerIdRef.current;
  pdfBufferRef.current = [];

  if (bufferedItems.length > 0 && cId) {
    dispatch({ type: "PROGRESS", payload: { status: `${bufferedItems.length} beyanname kaydediliyor...` } });

    const SAVE_BATCH = 20;
    for (let i = 0; i < bufferedItems.length; i += SAVE_BATCH) {
      const batch = bufferedItems.slice(i, i + SAVE_BATCH);
      // POST /api/intvrg/beyanname-bulk-save
      // ...
    }
  }

  dispatch({ type: "DOWNLOAD_COMPLETE" });
  break;
}
```

### Adım 5: `beyanname-client.tsx` — UI Değişiklikleri
- [ ] `autoDownloadRef` useEffect'i kaldır (satır 918-948)
- [ ] `queryDone` sonrası `downloadAll` çağrısını kaldır
- [ ] savedBeyoids'i customer seçildiğinde yükle (erken yükleme)
- [ ] `handleQuery` içinde `startQuery`'ye `savedBeyoids` geçir
- [ ] `queryDone` ile `beyanname-complete` geldiğinde tablo gösterilsin, `DOWNLOAD_START` otomatik
- [ ] `downloadProgress` state'i `COMPLETE` ile birlikte başlar (ayrı trigger yok)

```typescript
// Customer seçildiğinde savedBeyoids'i yükle
useEffect(() => {
  if (selectedCustomerId) {
    loadSavedBeyoids(selectedCustomerId);
  }
}, [selectedCustomerId, loadSavedBeyoids]);

// handleQuery'de savedBeyoids'i geçir
const handleQuery = useCallback(async () => {
  // ... mevcut validasyonlar ...
  setSelectedYear("all");
  await startQuery(selectedCustomerId, basAy, basYil, bitAy, bitYil, savedBeyoids);
  // ★ downloadAll çağrısı YOK — bot otomatik indirecek
}, [selectedCustomerId, selectedCustomer, basAy, basYil, bitAy, bitYil, savedBeyoids, startQuery]);
```

### Adım 6: Çoklu Yıl Pipeline (Multi-Year)
- [ ] `intvrg-beyanname-api.ts`'e `queryAndDownloadPipelineMultiYear()` ekle
- [ ] Her chunk sonucu geldiğinde hemen o chunk'ın PDF'lerini indirmeye başla
- [ ] `index.ts`'e `intvrg:beyanname-multi-query-and-download` handler ekle
- [ ] Frontend'te mevcut multi-year event'leri koruyarak pipeline-complete entegre et

```typescript
// Multi-year pipeline — chunk bazlı PDF indirme
export async function queryAndDownloadPipelineMultiYear(
  params: BeyannameQueryParams,
  skipBeyoids: string[],
  callbacks: MultiYearPipelineCallbacks,
): Promise<MultiYearPipelineResult> {
  const chunks = splitIntoYearChunks(params.basAy, params.basYil, params.bitAy, params.bitYil);
  const skipSet = new Set(skipBeyoids);
  const allBeyannameler: BeyannameItem[] = [];
  let totalDownloaded = 0, totalFailed = 0, totalSkipped = 0;

  // PDF indirme queue — chunk sonuçları geldikçe dolacak
  let activePdfDownloads = Promise.resolve();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    // ... token yenileme, chunk sorgusu (mevcut logic) ...

    const chunkBeyannameler = await queryChunk(client, chunk);
    allBeyannameler.push(...chunkBeyannameler);

    // Chunk sonuçlarını gönder
    callbacks.onChunkResults(i, chunks.length, chunk.basYil, chunkBeyannameler);

    // ★ ANINDA PDF indirmeye başla (önceki chunk'ın indirmesi bitmeden)
    const toDownload = chunkBeyannameler.filter(b => b.beyoid && !skipSet.has(b.beyoid));
    totalSkipped += chunkBeyannameler.length - toDownload.length;

    // Önceki chunk'ın indirmesini beklemeden yeni chunk'ı kuyruğa ekle
    activePdfDownloads = activePdfDownloads.then(async () => {
      const { dl, fl } = await downloadBatch(toDownload, ivdToken, callbacks);
      totalDownloaded += dl;
      totalFailed += fl;
    });

    // Chunk arası 2s bekleme (GİB rate-limit) — SON CHUNK HARİÇ
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Tüm PDF indirmelerinin bitmesini bekle
  await activePdfDownloads;

  callbacks.onComplete({ totalQueried: allBeyannameler.length, totalDownloaded, totalFailed, totalSkipped });
  return { success: true, allBeyannameler, ivdToken };
}
```

## Teknik Notlar

### 1. savedBeyoids Pre-Loading
- Mevcut: `queryDone` sonrası yükleniyor → 200ms gecikme
- Yeni: Customer seçildiğinde yükleniyor → sorgu başladığında zaten hazır
- Edge case: Customer seçildikten sonra başka beyannameler kaydedilirse → eski cache ile çalışır, duplicate kontrolü `beyanname-bulk-save` API'sinde zaten var

### 2. Concurrency Artışı: 5 → 10
- GİB PDF endpoint'i (`intvrg_server/goruntuleme`) her PDF ~100-500ms
- 5 concurrent ile 50 PDF = ~5-25 saniye
- 10 concurrent ile 50 PDF = ~2.5-12.5 saniye
- GİB rate-limit riski düşük (farklı endpoint, GET request)

### 3. Geriye Uyumluluk
- Eski `intvrg:beyanname-query` ve `intvrg:beyanname-bulk-download` handler'ları KORUNACAK
- Yeni sorgulamalar `intvrg:beyanname-query-and-download` kullanacak
- Eski frontend (güncellenmemiş electron bot) eski akışla çalışmaya devam eder

### 4. WS Event Akışı (Yeni)
```
→ intvrg:beyanname-progress      (login, token, sorgu durumu)
→ intvrg:beyanname-results       (beyanname listesi — tablo göster)
→ intvrg:beyanname-complete      (sorgu tamamlandı — queryDone=true)
→ intvrg:beyanname-bulk-pdf-result  (her PDF indirildiğinde — progress)
→ intvrg:beyanname-bulk-pdf-skip    (PDF indirilemezse)
→ intvrg:beyanname-pipeline-complete (tüm PDF'ler indi — toplu kaydet)
```

### 5. Çoklu Yıl WS Event Akışı (Yeni)
```
→ intvrg:beyanname-multi-progress       (chunk durumu)
→ intvrg:beyanname-multi-chunk-results  (chunk sonuçları)
→ intvrg:beyanname-bulk-pdf-result      (her PDF — chunk farkı yok)
→ intvrg:beyanname-bulk-pdf-skip
→ intvrg:beyanname-multi-complete       (tüm chunk'lar bitti)
→ intvrg:beyanname-pipeline-complete    (tüm PDF'ler bitti — toplu kaydet)
```

### 6. bulkCustomerIdRef Yönetimi
- `startQuery` çağrıldığında `bulkCustomerIdRef.current = customerId` set edilmeli
- `pipeline-complete` geldiğinde `pdfBufferRef` drain edilip kayıt yapılır

### 7. Reducer Değişiklikleri
- `COMPLETE` action: `allComplete` artık false olarak kalacak (PDF indirme devam ediyor)
- Yeni durum: `queryDone=true`, `downloadProgress.isDownloading=true` (eş zamanlı)
- `DOWNLOAD_COMPLETE`: `allComplete=true` (pipeline tamamlandı)

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Tek pipeline komutu (query+download) | 0 delay, round-trip yok | Ayrı komutlar + daha hızlı trigger (hâlâ latency var) |
| savedBeyoids bot'a gönderilir | Bot gereksiz PDF indirmiyor | Hepsini indir, frontend filtrele (bant genişliği israfı) |
| savedBeyoids customer seçiminde yüklenir | Sorgu başladığında hazır | queryDone sonrası yükle (mevcut — gecikme) |
| CONCURRENCY 5→10 | 2x hız, GİB endpoint risk düşük | 15-20 (agresif — rate-limit riski artar) |
| Eski handler'lar korunur | Geriye uyumluluk | Kaldır (breaking change) |
| pipeline-complete sonrası toplu kayıt | Tüm PDF'ler tamam, batch kayıt | Her PDF'i anında kaydet (çok fazla API çağrısı) |
| Multi-year: chunk query sıralı, PDF indirme paralel | GİB sorgu rate-limit var, PDF endpoint yok | Tamamen paralel (GİB ban riski) |
