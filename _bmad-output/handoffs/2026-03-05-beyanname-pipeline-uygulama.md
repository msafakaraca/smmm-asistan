# Handoff: Beyanname Pipeline Mimarisi Uygulaması
**Tarih:** 2026-03-05
**Durum:** Tamamlandı
**Referans:** `_bmad-output/handoffs/2026-02-20-beyanname-pipeline-mimarisi.md`

## Görev Tanımı
> Beyanname sorgulama sayfasında (`/dashboard/beyannameler`) sorgu tamamlandığında, Electron Bot'un beyanname listesini aldığı anda PDF indirmeye paralel başlaması. Mevcut sıralı akış (sorgu → bekle → ayrı indirme komutu) yerine tek pipeline komutu (sorgu + indirme birleşik). Frontend ve bot senkronize, 0 delay.

## Mevcut Durum (Analiz Sonucu)

Kod tabanı 15.02.2026 yedekten geri yüklenmiş durumda. Handoff'taki "kaldırılacak" mekanizmalar (downloadAll, autoDownloadRef, bulk-download handler, savedBeyoids) **zaten mevcut değil**. Sadece **ekleme** yapılacak.

### Mevcut Dosyalar ve İçerikleri

| # | Dosya | Satır | Mevcut İçerik |
|---|-------|-------|---------------|
| 1 | `electron-bot/src/main/intvrg-beyanname-api.ts` | 475 | `queryBeyannameler()`, `queryBeyannamelerMultiYear()`, `fetchBeyannamePdf()`, `splitIntoYearChunks()`, `BeyannameItem`, `BeyannameQueryParams` type'ları |
| 2 | `electron-bot/src/main/index.ts` | ~2000+ | `intvrg:beyanname-query` handler (satır 1094-1228), `intvrg:beyanname-multi-query` handler (satır 1233-1379), `intvrg:beyanname-pdf` handler (satır 1384-1447), `ivdTokenCache` (satır 1086), `activeBeyannameQueries` (satır 1092) |
| 3 | `src/app/api/intvrg/beyanname/route.ts` | 211 | Auth + customer fetch + credential decrypt + bot komutu gönderme. Komut: `intvrg:beyanname-query` veya `intvrg:beyanname-multi-query` |
| 4 | `src/components/beyannameler/hooks/use-beyanname-query.ts` | 627 | Reducer: QUERY_START, PROGRESS, RESULTS, COMPLETE, ERROR, CLEAR, SHOW_ARCHIVE, PDF_LOADING, PDF_DONE, MULTI_PROGRESS, MULTI_CHUNK_RESULTS, MULTI_COMPLETE. WS event dinleme. `startQuery(customerId, basAy, basYil, bitAy, bitYil)` |
| 5 | `src/components/beyannameler/beyanname-client.tsx` | 782 | Combobox mükellef seçimi, dönem seçimi, sorgulama, yıl filtresi, BeyannameGroupList, arşiv overlap dialog. `handleQuery` → `startQuery()` çağırır |

### Mevcut OLMAYAN Şeyler (Kaldırma Gerekmez)
- `downloadAll()` fonksiyonu — yok
- `autoDownloadRef` / 500ms setTimeout — yok
- `intvrg:beyanname-bulk-download` handler — yok
- `beyanname-bulk-save` API endpoint — yok
- `savedBeyoids` mekanizması — yok
- Bulk PDF indirme logic — yok

## Uygulama Planı

### Adım 1: `intvrg-beyanname-api.ts` — Pipeline Fonksiyonları Ekle

Dosyanın **sonuna** (475. satırdan sonra) iki yeni fonksiyon eklenecek. Mevcut fonksiyonlara dokunulmayacak.

**1a. `queryAndDownloadPipeline()` — Tek yıl pipeline**

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
): Promise<{ success: boolean; ivdToken?: string; beyannameler: BeyannameItem[]; error?: string }>
```

**Akış:**
1. `gibDijitalLogin()` → bearer token
2. `getIvdToken()` → ivd token
3. `client.callDispatch('beyannameIslemleri_beyannameSorgulaSorgu', ...)` → beyanname listesi
4. Parse (mevcut `queryBeyannameler` parse logic'ini aynen kullan)
5. `callbacks.onResults(beyannameler)` — **ANINDA frontend'e gönder**
6. `skipBeyoids` filtreleme: `new Set(skipBeyoids)` ile kaydedilmişleri çıkar
7. PDF indirme (10 concurrent): `fetchBeyannamePdf()` çağır, her biri için `onPdfResult` veya `onPdfSkip`
8. `callbacks.onComplete(stats)`

**Dikkat:** `BeyannameQueryParams` interface'i private (export edilmemiş). Export etmek gerekiyor:
```typescript
// Satır 42: "interface BeyannameQueryParams" → "export interface BeyannameQueryParams"
```

**1b. `queryAndDownloadPipelineMultiYear()` — Çoklu yıl pipeline**

```typescript
export interface MultiYearPipelineCallbacks extends PipelineCallbacks {
  onChunkProgress: (chunkIndex: number, totalChunks: number, year: string, status: string) => void;
  onChunkResults: (chunkIndex: number, totalChunks: number, year: string, beyannameler: BeyannameItem[]) => void;
}

export async function queryAndDownloadPipelineMultiYear(
  params: BeyannameQueryParams,
  skipBeyoids: string[],
  callbacks: MultiYearPipelineCallbacks,
): Promise<{ success: boolean; allBeyannameler: BeyannameItem[]; ivdToken?: string; error?: string }>
```

**Akış:**
1. `splitIntoYearChunks()` ile yıl chunk'larına böl
2. İlk login → bearer + ivd token
3. Her chunk için:
   - Token TTL kontrol (mevcut `queryBeyannamelerMultiYear` logic'i)
   - Chunk sorgusu → `callbacks.onChunkResults()`
   - **ANINDA** o chunk'ın PDF'lerini indirmeye başla (skipBeyoids filtreli)
   - PDF indirmeleri paralel queue'ya ekle (`activePdfDownloads = activePdfDownloads.then(...)`)
   - Chunk arası 2s bekleme (GİB rate-limit) — **son chunk hariç**
4. Tüm PDF indirmelerini bekle (`await activePdfDownloads`)
5. `callbacks.onComplete(stats)`

### Adım 2: `index.ts` — Yeni Pipeline Handler'lar Ekle

Mevcut handler'lara **dokunulmayacak**. Yeni handler'lar `intvrg:beyanname-pdf` handler'ından ÖNCE (satır ~1383 civarı) eklenecek.

**2a. `intvrg:beyanname-query-and-download` handler (tek yıl)**

```typescript
wsClient.on('intvrg:beyanname-query-and-download', async (data: BotCommandData) => {
  // ... duplicate guard (queryKey: pipeline-{userid}-{basAy}{basYil}-{bitAy}{bitYil})
  // ... 5dk timeout

  const skipBeyoids = (data.savedBeyoids as string[]) || [];

  const { queryAndDownloadPipeline } = await import('./intvrg-beyanname-api');

  const result = await queryAndDownloadPipeline(params, skipBeyoids, {
    onProgress: (status) => wsClient.send('intvrg:beyanname-progress', { status, customerName, requesterId }),
    onResults: (beyannameler) => {
      wsClient.send('intvrg:beyanname-results', { beyannameler, customerName, requesterId });
      // queryDone sinyali de gönder
      wsClient.send('intvrg:beyanname-complete', { success: true, totalCount: beyannameler.length, customerName, requesterId });
    },
    onPdfResult: (data) => wsClient.send('intvrg:beyanname-bulk-pdf-result', { ...data, customerName, requesterId }),
    onPdfSkip: (data) => wsClient.send('intvrg:beyanname-bulk-pdf-skip', { ...data, customerName, requesterId }),
    onComplete: (stats) => wsClient.send('intvrg:beyanname-pipeline-complete', { ...stats, customerName, requesterId }),
  });

  // IVD token cache
  if (result.ivdToken && data.vkn) {
    ivdTokenCache.set(data.vkn as string, { token: result.ivdToken, timestamp: Date.now() });
  }
});
```

**2b. `intvrg:beyanname-multi-query-and-download` handler (çoklu yıl)**

```typescript
wsClient.on('intvrg:beyanname-multi-query-and-download', async (data: BotCommandData) => {
  // ... duplicate guard, dynamic timeout

  const skipBeyoids = (data.savedBeyoids as string[]) || [];

  const { queryAndDownloadPipelineMultiYear } = await import('./intvrg-beyanname-api');

  const result = await queryAndDownloadPipelineMultiYear(params, skipBeyoids, {
    onProgress: (status) => wsClient.send('intvrg:beyanname-progress', { status, customerName, requesterId }),
    onResults: (beyannameler) => {
      // Multi-year'da her chunk results geldiğinde tablo güncellenir
    },
    onChunkProgress: (ci, tc, year, status) => wsClient.send('intvrg:beyanname-multi-progress', { chunkIndex: ci, totalChunks: tc, year, status, customerName, requesterId }),
    onChunkResults: (ci, tc, year, beyannameler) => {
      wsClient.send('intvrg:beyanname-multi-chunk-results', { chunkIndex: ci, totalChunks: tc, year, beyannameler, customerName, requesterId });
    },
    onPdfResult: (data) => wsClient.send('intvrg:beyanname-bulk-pdf-result', { ...data, customerName, requesterId }),
    onPdfSkip: (data) => wsClient.send('intvrg:beyanname-bulk-pdf-skip', { ...data, customerName, requesterId }),
    onComplete: (stats) => {
      wsClient.send('intvrg:beyanname-multi-complete', { success: true, totalCount: stats.totalQueried, customerName, requesterId });
      wsClient.send('intvrg:beyanname-pipeline-complete', { ...stats, customerName, requesterId });
    },
  });

  // IVD token cache
  if (result.ivdToken && data.vkn) {
    ivdTokenCache.set(data.vkn as string, { token: result.ivdToken, timestamp: Date.now() });
  }
});
```

**Error handling:** Mevcut handler'lardaki error pattern'i aynen kullan (TIMEOUT, AUTH_FAILED, CAPTCHA_FAILED, GIB_MAINTENANCE, IVD_TOKEN_FAILED, NETWORK_ERROR).

### Adım 3: `beyanname/route.ts` — Komut Tipini Pipeline'a Çevir

İki değişiklik:

**3a. Komut tipini değiştir (satır 166):**
```typescript
// ESKİ:
const commandType = isMultiYear ? "intvrg:beyanname-multi-query" : "intvrg:beyanname-query";

// YENİ:
const commandType = isMultiYear ? "intvrg:beyanname-multi-query-and-download" : "intvrg:beyanname-query-and-download";
```

**3b. Request body'ye `savedBeyoids` ekle + bot komutuna geçir:**

Interface güncelle (satır 16):
```typescript
interface BeyannameQueryRequest {
  customerId: string;
  basAy: string;
  basYil: string;
  bitAy: string;
  bitYil: string;
  savedBeyoids?: string[];  // ★ YENİ
}
```

Body parse'dan sonra (satır 44):
```typescript
const { customerId, basAy, basYil, bitAy, bitYil, savedBeyoids } = body;
```

Bot komutuna ekle (satır 173 civarı, data objesinin içine):
```typescript
data: {
  // ... mevcut alanlar ...
  savedBeyoids: savedBeyoids || [],  // ★ YENİ
},
```

### Adım 4: `use-beyanname-query.ts` — Hook'a Pipeline Event'leri Ekle

**4a. Yeni reducer action type'ları ekle:**
```typescript
| { type: "PIPELINE_PDF_PROGRESS"; payload: { downloadedCount: number; totalCount: number; turAdi: string } }
| { type: "PIPELINE_COMPLETE"; payload: { totalDownloaded: number; totalFailed: number; totalSkipped: number } }
```

**4b. Reducer'a yeni case'ler ekle:**
```typescript
case "PIPELINE_PDF_PROGRESS":
  return {
    ...state,
    progress: {
      status: `PDF indiriliyor: ${action.payload.downloadedCount}/${action.payload.totalCount} (${action.payload.turAdi})`,
      customerName: state.progress.customerName,
    },
  };

case "PIPELINE_COMPLETE":
  return {
    ...state,
    progress: {
      status: `Tamamlandı: ${action.payload.totalDownloaded} PDF indirildi${action.payload.totalSkipped > 0 ? `, ${action.payload.totalSkipped} atlandı` : ''}${action.payload.totalFailed > 0 ? `, ${action.payload.totalFailed} başarısız` : ''}`,
      customerName: state.progress.customerName,
    },
  };
```

**4c. `startQuery` imzasını güncelle (satır 530-531):**
```typescript
// ESKİ:
async (customerId: string, basAy: string, basYil: string, bitAy: string, bitYil: string) => {

// YENİ:
async (customerId: string, basAy: string, basYil: string, bitAy: string, bitYil: string, savedBeyoids?: string[]) => {
```

**4d. `startQuery` fetch body'sine `savedBeyoids` ekle (satır 548):**
```typescript
body: JSON.stringify({ customerId, basAy, basYil, bitAy, bitYil, savedBeyoids: savedBeyoids || [] }),
```

**4e. `UseBeyannameQueryReturn` interface'ini güncelle (satır 55):**
```typescript
startQuery: (customerId: string, basAy: string, basYil: string, bitAy: string, bitYil: string, savedBeyoids?: string[]) => Promise<void>;
```

**4f. WS onmessage switch'e yeni event handler'lar ekle (satır ~493 civarı, `intvrg:beyanname-pdf-error` case'inden sonra):**

```typescript
case "intvrg:beyanname-bulk-pdf-result": {
  dispatch({
    type: "PIPELINE_PDF_PROGRESS",
    payload: {
      downloadedCount: data.downloadedCount || 0,
      totalCount: data.totalCount || 0,
      turAdi: data.turAdi || "",
    },
  });
  break;
}

case "intvrg:beyanname-bulk-pdf-skip": {
  console.log(`[BEYANNAME-PDF] Atlandı: ${data.turAdi} — ${data.error}`);
  break;
}

case "intvrg:beyanname-pipeline-complete": {
  dispatch({
    type: "PIPELINE_COMPLETE",
    payload: {
      totalDownloaded: data.totalDownloaded || 0,
      totalFailed: data.totalFailed || 0,
      totalSkipped: data.totalSkipped || 0,
    },
  });

  const msg = data.totalDownloaded > 0
    ? `${data.totalDownloaded} beyanname PDF'i indirildi`
    : "Tüm beyanname PDF'leri zaten mevcut";
  toast.success(msg);
  break;
}
```

### Adım 5: `beyanname-client.tsx` — UI Güncellemeleri

**5a. `handleQuery`'de `startQuery`'ye `savedBeyoids` geçir (satır 352):**
```typescript
// ESKİ:
await startQuery(selectedCustomerId, basAy, basYil, bitAy, bitYil);

// YENİ:
await startQuery(selectedCustomerId, basAy, basYil, bitAy, bitYil, []);
// Not: savedBeyoids şimdilik boş array — Faz 2'de gerçek savedBeyoids entegre edilecek
```

**5b. `handleRequery`'de de aynı (satır 372):**
```typescript
await startQuery(selectedCustomerId, basAy, basYil, bitAy, bitYil, []);
```

**5c. Pipeline progress gösterimi (opsiyonel — mevcut progress UI yeterli)**
Mevcut `progress.status` alanı zaten PIPELINE_PDF_PROGRESS ve PIPELINE_COMPLETE reducer'larında güncelleniyor. İlerleme çubuğu (satır 641-646) bu status'u gösterecek. Ek UI değişikliği gerekmiyor.

## WS Event Akışı (Yeni — Tek Yıl)

```
[Frontend → API → Bot]
→ POST /api/intvrg/beyanname (savedBeyoids dahil)
→ _internal/bot-command: intvrg:beyanname-query-and-download

[Bot → Frontend via WS]
← intvrg:beyanname-progress    (login, token, sorgu durumu)
← intvrg:beyanname-results     (beyanname listesi — tablo göster)
← intvrg:beyanname-complete    (sorgu tamamlandı — queryDone=true)
← intvrg:beyanname-bulk-pdf-result  (her PDF indirildiğinde — progress güncelle)
← intvrg:beyanname-bulk-pdf-skip    (PDF indirilemezse — logla)
← intvrg:beyanname-pipeline-complete (tüm PDF'ler indi — tamamlandı mesajı)
```

## WS Event Akışı (Yeni — Çoklu Yıl)

```
← intvrg:beyanname-multi-progress       (chunk durumu)
← intvrg:beyanname-multi-chunk-results   (chunk sonuçları — tablo append)
← intvrg:beyanname-bulk-pdf-result       (her PDF — chunk farkı yok)
← intvrg:beyanname-bulk-pdf-skip
← intvrg:beyanname-multi-complete        (tüm chunk'lar sorgulandı)
← intvrg:beyanname-pipeline-complete     (tüm PDF'ler indi)
```

## Teknik Notlar

1. **Concurrency: 10** — `fetchBeyannamePdf()` chunk'lar halinde 10 paralel indirme
2. **Geriye uyumluluk:** Eski `intvrg:beyanname-query` ve `intvrg:beyanname-multi-query` handler'ları KORUNACAK
3. **BeyannameQueryParams export:** Satır 42'de `interface` → `export interface`
4. **savedBeyoids Faz 1:** Şimdilik boş array gönderilecek (Faz 2'de gerçek pre-load entegrasyonu)
5. **beyanname-bulk-save API:** Bu handoff'ta YOK — Faz 2'de ayrı handoff olarak planlanacak
6. **Token TTL:** Multi-year pipeline'da mevcut `queryBeyannamelerMultiYear` token yenileme logic'i aynen kullanılacak (25dk TTL, 5dk threshold)
7. **Error handling:** Mevcut handler'lardaki pattern aynen pipeline handler'lara kopyalanacak

## Uygulama Sırası

1. ✅ `intvrg-beyanname-api.ts` — `BeyannameQueryParams` export + `queryAndDownloadPipeline()` + `queryAndDownloadPipelineMultiYear()` ekle
2. ✅ `index.ts` — İki yeni pipeline handler ekle (mevcut handler'ların ÜSTÜNE, satır ~1383 civarı)
3. ✅ `beyanname/route.ts` — Komut tipi + savedBeyoids
4. ✅ `use-beyanname-query.ts` — Reducer + event handler + startQuery imzası
5. ✅ `beyanname-client.tsx` — startQuery çağrılarına savedBeyoids ekle

## Kararlar

| Karar | Neden |
|-------|-------|
| Faz 1: bulk-save olmadan pipeline | Scope'u daralt, temel değeri (0 delay) ver |
| savedBeyoids şimdilik boş array | Pre-load mekanizması Faz 2'ye bırakıldı |
| Eski handler'lar korunur | Geriye uyumluluk, breaking change yok |
| CONCURRENCY 10 | GİB PDF endpoint risk düşük, 2x hız |
| Reducer'a yeni action'lar | Mevcut reducer yapısıyla uyumlu, minimal değişiklik |
