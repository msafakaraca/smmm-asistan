# Handoff: Beyanname Pipeline Faz 2 — Bulk PDF Kaydetme & Pre-Load
**Tarih:** 2026-03-05
**Durum:** ✅ Tamamlandı (2026-03-05)
**Bağımlılık:** Faz 1 tamamlandı (`2026-03-05-beyanname-pipeline-uygulama.md`)

## Görev Tanımı
> Pipeline'dan indirilen PDF'lerin otomatik olarak Supabase Storage'a kaydedilmesi ve sonraki sorgularda daha önce kaydedilmiş beyoid'lerin pipeline'a geçirilmesi (skip mekanizması). Böylece tekrar edilen sorgularda sadece yeni beyannameler indiriliyor.

## Faz 1'den Gelen Altyapı (Zaten Mevcut)

| Yapı | Durum | Açıklama |
|------|-------|----------|
| `savedBeyoids` parametresi — API route | ✅ | `POST /api/intvrg/beyanname` request body'de |
| `savedBeyoids` parametresi — Bot handler | ✅ | `intvrg:beyanname-query-and-download` data'sında |
| `skipBeyoids` filtresi — Pipeline fonksiyonları | ✅ | `queryAndDownloadPipeline()` ve multi-year versiyonu |
| `startQuery()` imzası — savedBeyoids param | ✅ | Hook'ta `savedBeyoids?: string[]` |
| `intvrg:beyanname-bulk-pdf-result` WS event | ✅ | Her PDF indirildiğinde gönderiliyor |
| `intvrg:beyanname-pipeline-complete` WS event | ✅ | Tüm PDF'ler indirildiğinde |

## Mevcut Yapılar (Araştırma)

### Storage — `src/lib/storage-supabase.ts`
- Bucket: `smmm-documents`
- Path formatı: `{tenantId}/{customerId}/{year}/{month}/{filename}`
- `uploadFile(bucket, path, buffer, contentType)` — upload
- `adminUploadFile(bucket, path, buffer, contentType)` — RLS bypass
- `fileExists(bucket, path)` — varlık kontrolü

### Document Model — `prisma/schema.prisma` (satır 275-310)
```
documents { id, name, originalName, type, mimeType, size, isFolder, parentId,
  path, url, storage, year, month, icon, color, vknTckn, beyannameTuru,
  fileCategory, fileIndex, customerId, tenantId, createdAt, updatedAt }
```

### Query Archives — `prisma/schema.prisma` (satır 1274-1303)
```
query_archives { id, customerId, tenantId, userId, queryType, month, year,
  resultData (JSON), resultMeta, queryHistory, totalCount, totalAmount,
  lastQueriedAt, queryCount, createdAt, updatedAt }
  @@unique([tenantId, customerId, queryType, month, year])
```

### Dosya Adı Standardı (Handoff 2026-02-22 referans)
```
{vknTckn}_{turKodu}_{year}-{month}_BEYANNAME.pdf
Örnek: 5000000000_KDV1_2025-01_BEYANNAME.pdf
```

### Arşivleme Akışı (Mevcut — `use-beyanname-query.ts`)
`intvrg:beyanname-complete` geldiğinde → `POST /api/query-archives` ile ay bazlı arşivleme zaten yapılıyor (satır 314-360). Bu arşivleme **sorgu sonuçlarını** (beyanname listesi) kaydediyor, PDF'leri değil.

## Uygulama Planı

### Adım 1: `POST /api/intvrg/beyanname-bulk-save/route.ts` — YENİ DOSYA

Pipeline'dan gelen PDF'leri batch olarak kaydetme endpoint'i.

**Request body:**
```typescript
interface BulkSaveRequest {
  customerId: string;
  items: Array<{
    pdfBase64: string;
    beyoid: string;
    turKodu: string;
    turAdi: string;
    donem: string;       // "202501202501"
    versiyon: string;
  }>;
}
```

**Akış:**
1. Auth + tenant check
2. Customer bilgilerini al (unvan, vknTckn)
3. Her item için:
   a. Dönem parse: `donem` → `year`, `month`
   b. Dosya adı oluştur: `{vknTckn}_{turKodu}_{year}-{month}_BEYANNAME.pdf`
   c. Supabase path: `{tenantId}/{customerId}/{year}/{month}/{filename}`
   d. Duplicate check: `prisma.documents.findFirst({ where: { name, customerId, tenantId, fileCategory: "BEYANNAME" } })`
   e. Skip if exists
   f. Base64 → Buffer → `adminUploadFile()` ile Supabase'e yükle
   g. `prisma.documents.create()` ile metadata kaydet
4. Sonuç: `{ saved: number, skipped: number, failed: number }`

**Önemli:**
- `fileCategory: "BEYANNAME"` (sabit)
- `storage: "supabase"`
- `beyannameTuru` alanına `turKodu` yazılacak
- `vknTckn` alanına müşteri VKN yazılacak
- Race condition: Aynı dosya birden fazla pipeline'dan gelebilir → `findFirst` + skip

**Referans pattern:** `src/app/api/query-archives/route.ts` POST handler (satır 154-278)

### Adım 2: `use-beyanname-query.ts` — PDF Kaydetme Buffer + Auto-Save

Pipeline'dan gelen her `intvrg:beyanname-bulk-pdf-result` event'ini buffer'la ve batch olarak kaydet.

**2a. Yeni state alanları (reducer'a ekle):**
```typescript
// State'e ekle
pdfSaveProgress: { saved: number; total: number } | null;
```

**2b. Yeni reducer action'lar:**
```typescript
| { type: "PDF_SAVE_START" }
| { type: "PDF_SAVE_PROGRESS"; payload: { saved: number; total: number } }
| { type: "PDF_SAVE_DONE"; payload: { saved: number; skipped: number } }
```

**2c. WS event handler değişikliği — `intvrg:beyanname-bulk-pdf-result` case:**
Mevcut:
```typescript
case "intvrg:beyanname-bulk-pdf-result": {
  dispatch({ type: "PIPELINE_PDF_PROGRESS", ... });
  break;
}
```

Yeni (buffer ekle):
```typescript
case "intvrg:beyanname-bulk-pdf-result": {
  dispatch({ type: "PIPELINE_PDF_PROGRESS", ... });
  // PDF'i buffer'a ekle
  pdfBufferRef.current.push({
    pdfBase64: data.pdfBase64,
    beyoid: data.beyoid,
    turKodu: data.turKodu,
    turAdi: data.turAdi,
    donem: data.donem,
    versiyon: data.versiyon,
  });
  // 5 PDF biriktiğinde batch kaydet
  if (pdfBufferRef.current.length >= 5) {
    flushPdfBuffer();
  }
  break;
}
```

**2d. `intvrg:beyanname-pipeline-complete` case'inde kalan buffer'ı flush et:**
```typescript
case "intvrg:beyanname-pipeline-complete": {
  dispatch({ type: "PIPELINE_COMPLETE", ... });
  // Kalan PDF'leri kaydet
  if (pdfBufferRef.current.length > 0) {
    flushPdfBuffer();
  }
  toast.success(msg);
  break;
}
```

**2e. `flushPdfBuffer()` fonksiyonu:**
```typescript
const pdfBufferRef = useRef<PdfItem[]>([]);
const savingRef = useRef(false);

const flushPdfBuffer = useCallback(async () => {
  if (savingRef.current || pdfBufferRef.current.length === 0) return;
  if (!pendingQueryRef.current?.customerId) return;

  savingRef.current = true;
  const items = [...pdfBufferRef.current];
  pdfBufferRef.current = [];

  try {
    const res = await fetch("/api/intvrg/beyanname-bulk-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: pendingQueryRef.current.customerId,
        items,
      }),
    });
    if (res.ok) {
      const result = await res.json();
      console.log(`[BEYANNAME-SAVE] ${result.saved} kayıt, ${result.skipped} skip`);
    }
  } catch (err) {
    console.error("[BEYANNAME-SAVE] Hata:", err);
  } finally {
    savingRef.current = false;
    // Birikenler varsa tekrar flush
    if (pdfBufferRef.current.length > 0) {
      flushPdfBuffer();
    }
  }
}, []);
```

### Adım 3: Pre-Load — Kaydedilmiş Beyoid'leri Yükle

Sorgulama başlatılmadan önce daha önce kaydedilmiş dosyaların beyoid'lerini yükle.

**3a. Yeni API endpoint: `GET /api/intvrg/beyanname-saved-beyoids`**

```typescript
// src/app/api/intvrg/beyanname-saved-beyoids/route.ts — YENİ DOSYA
// Parametreler: customerId (zorunlu)
// Response: { beyoids: string[] }

// Akış:
// 1. Auth + tenant check
// 2. query_archives'den queryType="beyanname" olan kayıtları al (sadece resultData)
// 3. resultData JSON array'den beyoid'leri çıkar
// 4. Return: { beyoids: [...unique beyoid'ler] }
```

**Neden ayrı endpoint?**
- `query-archives/customer-bulk` tüm resultData'yı döner (çok büyük olabilir)
- Bu endpoint sadece beyoid string array'i döner (hafif)

**3b. `beyanname-client.tsx` — Pre-load entegrasyonu:**

```typescript
// Yeni state
const [savedBeyoids, setSavedBeyoids] = useState<string[]>([]);

// Mükellef seçildiğinde beyoid'leri yükle
useEffect(() => {
  if (!selectedCustomerId) {
    setSavedBeyoids([]);
    return;
  }
  fetch(`/api/intvrg/beyanname-saved-beyoids?customerId=${selectedCustomerId}`)
    .then(r => r.ok ? r.json() : { beyoids: [] })
    .then(data => setSavedBeyoids(data.beyoids || []))
    .catch(() => setSavedBeyoids([]));
}, [selectedCustomerId]);
```

**3c. `handleQuery` ve `handleRequery` güncelle:**
```typescript
// ESKİ:
await startQuery(selectedCustomerId, basAy, basYil, bitAy, bitYil, []);

// YENİ:
await startQuery(selectedCustomerId, basAy, basYil, bitAy, bitYil, savedBeyoids);
```

### Adım 4: Pipeline Complete Sonrası — savedBeyoids Güncelle

Pipeline tamamlandıktan sonra yeni kaydedilen beyoid'leri savedBeyoids state'ine ekle.

**`intvrg:beyanname-pipeline-complete` handler'ında:**
```typescript
// Pipeline tamamlandıktan sonra savedBeyoids'i güncelle
// (Yeni indirilen PDF'lerin beyoid'leri savedBeyoids'e eklenir)
// Not: Bu UI refresh değil, sadece in-memory state güncellemesi
```

Bu isteğe bağlı (opsiyonel) çünkü sonraki sorgularda yeniden pre-load yapılacak zaten.

## Etkilenecek Dosyalar

| # | Dosya | İşlem | Detay |
|---|-------|-------|-------|
| 1 | `src/app/api/intvrg/beyanname-bulk-save/route.ts` | YENİ | Batch PDF kaydetme endpoint |
| 2 | `src/app/api/intvrg/beyanname-saved-beyoids/route.ts` | YENİ | Kaydedilmiş beyoid'leri dönen hafif endpoint |
| 3 | `src/components/beyannameler/hooks/use-beyanname-query.ts` | DÜZENLEME | PDF buffer + auto-save + reducer |
| 4 | `src/components/beyannameler/beyanname-client.tsx` | DÜZENLEME | Pre-load + savedBeyoids state |

## WS Event Akışı (Faz 2 ile Güncellenen)

```
[Sorgu Başlatılmadan Önce]
→ GET /api/intvrg/beyanname-saved-beyoids?customerId=X
← { beyoids: ["abc", "def", ...] }

[Sorgu Başlatma]
→ POST /api/intvrg/beyanname (savedBeyoids: ["abc", "def", ...])
→ Bot: pipeline başlat (skipBeyoids = savedBeyoids)

[Bot → Frontend via WS]
← intvrg:beyanname-results          (tablo göster)
← intvrg:beyanname-complete          (sorgu bitti)
← intvrg:beyanname-bulk-pdf-result   (her PDF indirildiğinde)
   → Hook: buffer'a ekle
   → 5 PDF biriktiğinde → POST /api/intvrg/beyanname-bulk-save
      → Supabase Storage'a yükle + Document metadata kaydet
← intvrg:beyanname-pipeline-complete  (tüm PDF'ler bitti)
   → Hook: kalan buffer'ı flush et
   → POST /api/intvrg/beyanname-bulk-save (son batch)
```

## Teknik Notlar

1. **Buffer boyutu: 5 PDF** — Her 5 PDF biriktiğinde batch kaydetme tetiklenir. Çok küçük → çok fazla request, çok büyük → memory. 5 iyi bir denge.
2. **Race condition koruması:** `savingRef.current` flag'i ile aynı anda birden fazla flush önlenir
3. **Duplicate check:** Hem Supabase upload'da hem de Document metadata'da check yapılacak
4. **fileCategory standardı:** "BEYANNAME" (sabit) — diğer bot modülleriyle tutarlı
5. **Storage:** Supabase (`storage: "supabase"`, `adminUploadFile()` ile RLS bypass)
6. **Pre-load boyutu:** Ortalama müşteride 50-200 beyanname beyoid'i → ~10-40KB JSON → hafif
7. **pendingQueryRef dependency:** PDF buffer flush'ı customerId'ye ihtiyaç duyar → pendingQueryRef.current'tan alınır

## Kararlar

| Karar | Neden | Alternatif |
|-------|-------|-----------|
| Ayrı `beyanname-saved-beyoids` endpoint | customer-bulk çok ağır, sadece beyoid'ler yeterli | customer-bulk + client-side filter |
| Buffer boyutu 5 | Memory vs request trade-off | 10 (daha az request ama daha fazla memory) |
| `adminUploadFile()` (RLS bypass) | Server-side upload, user auth zaten API'de kontrol ediliyor | Normal upload + service role |
| Document model kullanımı | Mevcut dosya yönetim sistemiyle entegre | Ayrı tablo (gereksiz karmaşıklık) |
| Klasör yapısı yok (Faz 2) | Scope'u dar tut, PDF'ler flat kayıt | Klasör hierarchy (Faz 3) |

## Uygulama Sırası

1. `beyanname-bulk-save/route.ts` — YENİ: Batch PDF kaydetme API
2. `beyanname-saved-beyoids/route.ts` — YENİ: Pre-load beyoid'ler API
3. `use-beyanname-query.ts` — DÜZENLEME: PDF buffer + auto-save
4. `beyanname-client.tsx` — DÜZENLEME: Pre-load + savedBeyoids geçirme
