# Handoff: Beyanname Streaming Pipeline Optimizasyonu
**Tarih:** 2026-02-20
**Durum:** Tamamlandı

## Görev Tanımı
> Beyanname sorgulama sayfasında (`/dashboard/beyannameler`) PDF indirme → arşive aktarma pipeline'ını streaming mimarisine geçir. Mevcut "buffer → toplu kaydet → arşivle" pattern'i yerine her PDF indirildiğinde ANINDA kaydet + arşivle + UI güncelle. POST /api/query-archives 1415ms'lik toplu kaydetme darboğazını ortadan kaldır.

## Mevcut Akış (SORUNLU)

```
1. Bot GİB'den beyanname listesini sorgular
2. Bot PDF'leri indirir (concurrency=10)
3. Her PDF → WS mesajı → Dashboard'da pdfBufferRef'e push
4. TÜM PDF'ler indiğinde "pipeline-complete" event'i gelir
5. Dashboard buffer'ı 20'lik batch'lere böler
6. Her batch: POST /api/intvrg/beyanname-bulk-save (sıralı!)
7. Tüm batch'ler bittikten sonra: POST /api/query-archives (arşiv kayıt, 1415ms)
8. Sonra beyanname listesi yüklenir
```

**Sorunlar:**
- Kullanıcı TÜM pipeline bitene kadar bekler (~45s, 100 PDF)
- PDF'ler memory'de birikir (100 PDF × 500KB = 50MB+ RAM)
- Arşiv kayıt en sonda tek seferde yapılır (1415ms blok)
- Sıralı batch save → gereksiz gecikme

## Hedef Akış (STREAMING)

```
1. Bot GİB'den beyanname listesini sorgular → ANINDA tablo gösterilir
2. Bot her PDF'i indirdiğinde → WS mesajı → Dashboard
3. Her PDF için PARALEL:
   A) Supabase Storage'a upload + Document DB kaydı
   B) query_archives tablosuna incremental merge
   C) UI'da blob URL cache + satır güncelleme (PDF ikonu belirir)
4. Kullanıcı ilk PDF'i ~5s'de görür, gerisi akarak gelir
5. Toplam pipeline: ~15s (3x hızlı)
```

## Araştırma Bulguları

### Mevcut Dosya Yapısı ve Satır Numaraları

#### 1. `src/components/beyannameler/hooks/use-beyanname-query.ts` (855 satır)
- **Satır 448-473**: `pdfBufferRef.current.push(item)` — Buffer birikme noktası
- **Satır 494**: `SAVE_BATCH = 20` — Batch size sabit
- **Satır 461-465**: `atob()` base64 decode her PDF için — hot loop'ta CPU
- **Satır 797-820**: `preloadPdfs()` — Signed URL batch fetch + 3 concurrent download
- **WS mesaj tipleri:**
  - `intvrg:beyanname-bulk-pdf-result` → buffer'a push (değişecek → streaming save)
  - `intvrg:beyanname-pipeline-complete` → toplu kaydet tetikle (kalkacak)
  - `intvrg:beyanname-bulk-complete` → batch save tamamlandı
- **State reducer**: 25+ action type, `DOWNLOAD_PROGRESS`, `SAVE_SUCCESS` vb.

#### 2. `src/components/beyannameler/beyanname-client.tsx` (1387 satır)
- **Satır 659-710**: Archive auto-save logic (`saveOrMerge`) — useRef flag ile
- **Satır 920-927**: `preloadPdfs()` çağrısı query tamamlandığında
- Archive save: `POST /api/query-archives` ile her ay için ayrı merge
- `archiveSavedRef` ile duplicate save önleme

#### 3. `src/app/api/intvrg/beyanname-bulk-save/route.ts`
- Auth check + duplicate kontrolü (mevcut beyoid'leri set'e al)
- `BATCH_SIZE=5` paralel Supabase upload + DB insert
- Yıl bazlı klasör oluşturma (`ensureBeyannameFolder`)
- Response: `{ savedCount, skippedCount, savedBeyoids[] }`

#### 4. `src/app/api/query-archives/route.ts`
- Atomik merge: mevcut kayıt varsa dedup ile birleştir, yoksa oluştur
- `mergeAndDedup(existing, newItems, dedupKeys)` — beyoid bazlı
- `queryHistory` array'ine yeni entry ekle
- `MAX_ARCHIVE_SIZE=10000` limiti
- Transaction kullanıyor (atomik)

#### 5. `electron-bot/src/main/intvrg-beyanname-api.ts`
- `queryAndDownloadPipeline()` satır 465-593
- PDF download: `fetchBeyannamePdf(ivdToken, beyoid)` → base64
- Concurrency=10 paralel download
- `onPdfResult` callback ile her PDF WS'ye gönderiliyor
- Multi-year: chunk'lar arası 2s bekleme (GİB rate-limit)

#### 6. `electron-bot/src/main/index.ts` (WS handler)
- `intvrg:beyanname-query-and-download` komutu
- Her PDF result: `wsClient.send('intvrg:beyanname-bulk-pdf-result', {...})`
- Pipeline complete: `wsClient.send('intvrg:beyanname-pipeline-complete', {...})`

#### 7. `src/lib/storage-supabase.ts`
- `adminUploadFile(path, buffer, contentType)` — RLS bypass
- `generateStoragePath()` — tenant/customer/year/ yapısı
- `getSignedUrl()` — 1 saat geçerli URL

### Pattern ve Convention'lar
- Tüm API'lerde `getUserWithProfile()` auth guard
- Tüm query'lerde `tenantId` filter zorunlu
- Supabase Storage bucket: `smmm-documents`
- Document model: `fileCategory: "INTVRG_BEYANNAME"`
- PDF dosya adı formatı: `{turKodu}_{ay}-{yil}_v{versiyon}.pdf`

## Etkilenecek Dosyalar

| # | Dosya | Değişiklik | Detay |
|---|-------|-----------|-------|
| 1 | `src/components/beyannameler/hooks/use-beyanname-query.ts` | **BÜYÜK DÜZENLEME** | Buffer kaldır, streaming save ekle, yeni reducer actions |
| 2 | `src/components/beyannameler/beyanname-client.tsx` | **ORTA DÜZENLEME** | Archive auto-save logic'i kaldır (hook'a taşındı) |
| 3 | `src/app/api/intvrg/beyanname-stream-save/route.ts` | **YENİ DOSYA** | Unified streaming save endpoint |
| 4 | `src/app/api/intvrg/beyanname-bulk-save/route.ts` | **KÜÇÜK DÜZENLEME** | Deprecation note veya backward compat |
| 5 | `src/app/api/query-archives/route.ts` | **KÜÇÜK DÜZENLEME** | Incremental merge optimize (tek item için) |

## Uygulama Planı

### Adım 1: Yeni Unified Stream-Save API Endpoint Oluştur
**Dosya:** `src/app/api/intvrg/beyanname-stream-save/route.ts`

Bu endpoint TEK BİR PDF için her şeyi yapar:
- [ ] Auth check + tenantId
- [ ] Supabase Storage'a PDF upload (base64 → buffer)
- [ ] `documents` tablosuna kayıt oluştur (beyoid duplicate check)
- [ ] `query_archives` tablosuna incremental merge (tek item append)
- [ ] Response: `{ success, beyoid, documentId, archiveUpdated }`

```typescript
// Pseudo-kod
export async function POST(req: NextRequest) {
  const user = await getUserWithProfile();
  if (!user) return unauthorized();

  const { customerId, pdfBase64, turKodu, turAdi, donem, beyoid, versiyon } = await req.json();

  // 1. Duplicate check
  const existing = await prisma.documents.findFirst({
    where: { tenantId: user.tenantId, customerId, fileCategory: "INTVRG_BEYANNAME", path: { contains: beyoid } }
  });
  if (existing) return json({ success: true, beyoid, skipped: true });

  // 2. Paralel: Storage upload + Archive merge
  const [uploadResult, archiveResult] = await Promise.all([
    // A) Supabase upload + Document create
    uploadAndCreateDocument(user.tenantId, customerId, pdfBase64, turKodu, turAdi, donem, beyoid, versiyon),
    // B) Archive incremental merge
    incrementalArchiveMerge(user.tenantId, customerId, turKodu, turAdi, donem, beyoid, versiyon)
  ]);

  return json({ success: true, beyoid, documentId: uploadResult.id, archiveUpdated: archiveResult.updated });
}
```

**Kritik:** Bu endpoint ~200-400ms sürmeli (Supabase upload + DB insert paralel). Mevcut bulk-save'in 1415ms'lik toplu işleminden çok daha hızlı.

### Adım 2: Hook'u Streaming Mimarisine Geçir
**Dosya:** `src/components/beyannameler/hooks/use-beyanname-query.ts`

- [ ] `pdfBufferRef` kaldır (buffer gereksiz)
- [ ] `SAVE_BATCH` kaldır
- [ ] Yeni `saveSinglePdf()` fonksiyonu ekle:
  ```typescript
  const saveSinglePdf = useCallback(async (item: PdfBufferItem) => {
    const res = await fetch('/api/intvrg/beyanname-stream-save', {
      method: 'POST',
      body: JSON.stringify({
        customerId: bulkCustomerIdRef.current,
        pdfBase64: item.pdfBase64,
        turKodu: item.turKodu,
        turAdi: item.turAdi,
        donem: item.donem,
        beyoid: item.beyoid,
        versiyon: item.versiyon,
      }),
    });
    const data = await res.json();
    if (data.success && !data.skipped) {
      dispatch({ type: 'SINGLE_SAVE_SUCCESS', payload: { beyoid: item.beyoid } });
    }
  }, []);
  ```
- [ ] `intvrg:beyanname-bulk-pdf-result` handler'ını değiştir:
  ```typescript
  case 'intvrg:beyanname-bulk-pdf-result': {
    const { pdfBase64, turKodu, turAdi, donem, beyoid, versiyon, downloadedCount, totalCount } = data;

    // 1. UI cache (blob URL) — ANINDA
    const blobUrl = createBlobUrl(pdfBase64);
    dispatch({ type: 'PDF_CACHE_SET', payload: { beyoid, blobUrl } });

    // 2. Progress güncelle — ANINDA
    dispatch({ type: 'DOWNLOAD_PROGRESS', payload: { downloadedCount, totalCount } });

    // 3. Arka planda kaydet (fire-and-forget with concurrency limit)
    saveQueue.add(() => saveSinglePdf({ pdfBase64, turKodu, turAdi, donem, beyoid, versiyon }));
    break;
  }
  ```
- [ ] Concurrency limiter ekle (max 5 paralel save):
  ```typescript
  // p-queue veya custom semaphore
  const saveQueue = useMemo(() => new PQueue({ concurrency: 5 }), []);
  ```
- [ ] `pipeline-complete` handler'ını sadeleştir:
  ```typescript
  case 'intvrg:beyanname-pipeline-complete': {
    // Tüm save queue'nun bitmesini bekle
    await saveQueue.onIdle();
    dispatch({ type: 'ALL_COMPLETE' });
    break;
  }
  ```
- [ ] Yeni reducer action'ları:
  - `SINGLE_SAVE_SUCCESS` — savedBeyoids'e beyoid ekle, satır ikonunu güncelle
  - `SAVE_QUEUE_PROGRESS` — kaç PDF kaydedildi / toplam
- [ ] Eski batch save logic'ini kaldır (batchSavePdfs, flushBuffer, vb.)

### Adım 3: Client Component'ten Archive Logic Kaldır
**Dosya:** `src/components/beyannameler/beyanname-client.tsx`

- [ ] `archiveSavedRef` ve ilgili useEffect'i kaldır (satır 659-710)
- [ ] `saveOrMerge()` fonksiyonunu kaldır (archive artık stream-save API'de yapılıyor)
- [ ] `POST /api/query-archives` çağrısını kaldır
- [ ] Sadece `pipeline-complete` sonrası beyanname listesini yeniden yükle

### Adım 4: Query Archives Endpoint'ini Optimize Et
**Dosya:** `src/app/api/query-archives/route.ts`

- [ ] Yeni `incrementalMerge` modu ekle (tek item merge):
  ```typescript
  // Mevcut: POST body = { newResults: BeyannameItem[] }  ← toplu
  // Yeni:   POST body = { singleItem: BeyannameItem, mode: "incremental" }  ← tek
  ```
- [ ] Tek item merge çok daha hızlı: mevcut array'e push + dedup check
- [ ] Transaction scope'unu daralt (sadece tek kayıt güncelleme)

### Adım 5: Test ve Doğrulama
- [ ] Tek müşteri, tek ay sorgulaması (basit case)
- [ ] Tek müşteri, çoklu yıl sorgulaması (multi-year pipeline)
- [ ] 100+ beyanname sorgulaması (performans testi)
- [ ] WS bağlantı kopması sırasında kayıp kontrolü
- [ ] Duplicate beyoid testi (aynı sorgu 2 kez)
- [ ] Browser memory kullanımı kontrolü (DevTools)

## Teknik Notlar

### Concurrency Limiter (p-queue alternatifi)
Proje `p-queue` paketi kullanmıyorsa, basit bir semaphore implementasyonu:

```typescript
class SaveQueue {
  private queue: (() => Promise<void>)[] = [];
  private running = 0;
  private concurrency: number;
  private resolveIdle?: () => void;

  constructor(concurrency = 5) {
    this.concurrency = concurrency;
  }

  add(fn: () => Promise<void>) {
    this.queue.push(fn);
    this.run();
  }

  private async run() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      this.running++;
      const fn = this.queue.shift()!;
      fn().finally(() => {
        this.running--;
        if (this.running === 0 && this.queue.length === 0 && this.resolveIdle) {
          this.resolveIdle();
        }
        this.run();
      });
    }
  }

  onIdle(): Promise<void> {
    if (this.running === 0 && this.queue.length === 0) return Promise.resolve();
    return new Promise(resolve => { this.resolveIdle = resolve; });
  }
}
```

### Incremental Archive Merge (Hızlı Versiyon)
Mevcut `mergeAndDedup` tüm array'i tarar. Tek item için:

```typescript
async function incrementalArchiveMerge(tenantId, customerId, item) {
  const { month, year } = parseDonem(item.donem);

  // Upsert: varsa append, yoksa oluştur
  await prisma.$transaction(async (tx) => {
    const existing = await tx.queryArchive.findUnique({
      where: { tenantId_customerId_queryType_month_year: {
        tenantId, customerId, queryType: "beyanname", month, year
      }}
    });

    if (existing) {
      const results = existing.resultData as any[];
      const exists = results.some(r => r.beyoid === item.beyoid);
      if (!exists) {
        results.push(item);
        await tx.queryArchive.update({
          where: { id: existing.id },
          data: {
            resultData: results,
            resultMeta: { ...existing.resultMeta, totalCount: results.length, lastQueryDate: new Date() }
          }
        });
      }
    } else {
      await tx.queryArchive.create({
        data: {
          tenantId, customerId,
          queryType: "beyanname",
          month, year,
          resultData: [item],
          resultMeta: { totalCount: 1, lastQueryDate: new Date(), queryCount: 1 },
          queryHistory: [{ date: new Date(), addedCount: 1 }]
        }
      });
    }
  });
}
```

### Race Condition Koruması
- `documents` tablosunda `beyoid` bazlı unique check (findFirst before create)
- `query_archives` tablosunda transaction ile atomik merge
- Frontend'de `savedBeyoids` Set'i ile duplicate dispatch önleme

### Memory Yönetimi
- Buffer tamamen kaldırılıyor → memory spike yok
- Blob URL'ler `Map<string, string>` ile tutulur, component unmount'ta revoke edilir
- Base64 string sadece API call süresince memory'de kalır, sonra GC temizler

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Tek unified endpoint (stream-save) | Tek API call = az latency, atomik işlem | Ayrı upload + archive call (daha fazla network hop) |
| Concurrency=5 save | Supabase rate-limit koruması + hız dengesi | Concurrency=10 (riskli), Concurrency=1 (yavaş) |
| Buffer kaldırma | Memory spike'ı önler, streaming UX sağlar | Buffer tutup daha küçük batch (yarım çözüm) |
| p-queue yerine custom class | Ek bağımlılık yok, basit use case | p-queue paketi (overengineering) |
| Incremental merge (tek item) | O(1) vs O(n) — mevcut toplu merge O(n) tüm array'i tarar | Toplu merge'ü optimize et (yine yavaş) |

## Performans Projeksiyonu

| Metrik | Mevcut | Hedef | İyileşme |
|--------|--------|-------|----------|
| 100 PDF toplam süre | ~45s | ~15s | 3x hızlı |
| İlk PDF kullanıcıya görünür | ~30s | ~5s | 6x hızlı |
| Archive save süresi | 1415ms (toplu) | ~0ms (incremental, arka plan) | Sıfır bekleme |
| Browser memory peak | ~500MB (100 PDF buffer) | ~50MB (no buffer) | 10x az |
| API çağrı sayısı | 5-6 batch call + 1 archive | N single calls (paralel) | Daha fazla ama daha hızlı |

## Risk Değerlendirmesi

| Risk | Olasılık | Etki | Mitigasyon |
|------|----------|------|-----------|
| Race condition (paralel save) | Orta | Yüksek | beyoid unique check + transaction |
| Supabase rate-limit (5 concurrent) | Düşük | Orta | Concurrency limiter, retry |
| Partial save (browser kapanırsa) | Düşük | Orta | İdempotent save, tekrar sorgulama |
| Blob URL memory leak | Orta | Düşük | Strict cleanup on unmount |
| Mevcut bulk-save kullanan diğer yerler | Düşük | Düşük | Backward compat, deprecation note |
