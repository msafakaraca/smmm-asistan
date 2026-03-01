# Handoff: SGK E-Bildirge Toplu Sorgulama
**Tarih:** 2026-02-23 20:00
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor

## Görev Tanımı
> SGK E-Bildirge sorgulama sayfasına toplu sorgulama özelliği eklenmesi. Beyanname sorgulama sayfasındaki toplu sorgulama pattern'i birebir referans alınacak. Her müşteri branch'i ayrı bir sorgulama birimi olarak işlenecek.

## Kritik Kararlar

| Karar | Değer | Gerekçe |
|-------|-------|---------|
| Müşteriler arası bekleme | **1 saniye** | SGK fresh session kullanıyor, doğal gecikme yeterli |
| Branch desteği | Her branch ayrı sorgulama birimi | SGK'da her işyeri kodu farklı giriş |
| Captcha | **Sadece 2Captcha** (OCR Space KULLANILMAYACAK) | SGK E-Bildirge'ye özel — sgk-ebildirge-api.ts'de sıralama değiştirildi |
| Stream-save | Mevcut endpoint yeniden kullanılır | `/api/sgk/ebildirge-stream-save` zaten çalışıyor |
| PDF tipleri | Tahakkuk + Hizmet Listesi | Her bildirge 2 PDF üretir |

## Araştırma Bulguları

### Referans Pattern: Beyanname Toplu Sorgulama
Birebir kopyalanacak dosyalar:
- `src/components/beyannameler/beyanname-bulk-query-dialog.tsx` (337 satır) → SGK versiyonu
- `src/components/beyannameler/beyanname-bulk-results.tsx` (304 satır) → SGK versiyonu
- `src/components/beyannameler/hooks/use-bulk-query.ts` (477 satır) → SGK versiyonu
- `src/app/api/intvrg/beyanname/route.ts` PUT metodu (satır 220-415) → SGK versiyonu
- `electron-bot/src/main/index.ts` bulk handler (satır 1826-1919) → SGK versiyonu

### Mevcut SGK Tek Müşteri Altyapısı
- `electron-bot/src/main/sgk-ebildirge-api.ts` — `queryAndDownloadPipeline()` (satır 741+)
- `src/app/api/sgk/ebildirge/route.ts` — Tek müşteri POST endpoint (244 satır)
- `src/app/api/sgk/ebildirge-stream-save/route.ts` — PDF kayıt (491 satır, DEĞİŞMEYECEK)
- `src/components/sgk-sorgulama/hooks/use-sgk-query.ts` — Tek müşteri WS hook (591 satır)
- `server.ts` satır 528-534 — Mevcut SGK event relay

### SGK vs GİB Farkları (Bot Tarafı)

| | GİB Beyanname (bulk ref) | SGK E-Bildirge (hedef) |
|---|---|---|
| Auth | Bearer token (stateless) | Session cookie + Struts token |
| API | JSON REST | HTML form |
| Captcha | OCR.space + 2Captcha | **Sadece 2Captcha** |
| Session | Token yenilenmez | Her adımda token zinciri |
| Pipeline | `queryBeyannamelerBulk()` | **YAZILACAK:** `queryEbildirgeBulk()` |
| PDF Tipi | Tek (beyanname) | İki (tahakkuk + hizmet_listesi) |
| Credential | gibKodu, gibSifre | sgkKullaniciAdi, sgkIsyeriKodu, sgkSistemSifresi, sgkIsyeriSifresi |

### Customer API — hasSgkCredentials
`/api/customers?fields=minimal` endpoint'i zaten `hasSgkCredentials` flag'i döndürüyor (satır 87):
```typescript
hasSgkCredentials: !!(c.sgkKullaniciAdi && c.sgkIsyeriKodu && c.sgkSistemSifresi && c.sgkIsyeriSifresi),
```
Branch'ler için ayrı bir endpoint gerekecek.

## Etkilenecek Dosyalar

| # | Dosya | Değişiklik | Detay |
|---|-------|-----------|-------|
| 1 | `electron-bot/src/main/sgk-ebildirge-api.ts` | Düzenleme | `queryEbildirgeBulk()` ve `cancelSgkBulkQuery()` fonksiyonları ekle |
| 2 | `electron-bot/src/main/index.ts` | Düzenleme | `sgk:ebildirge-bulk-start` ve `sgk:ebildirge-bulk-cancel` handler ekle |
| 3 | `server.ts` | Düzenleme | SGK bulk WS event'leri relay et |
| 4 | `src/app/api/sgk/ebildirge-bulk/route.ts` | Yeni dosya | PUT endpoint — müşteri+branch listesi al, credential decrypt, Bot'a gönder |
| 5 | `src/components/sgk-sorgulama/hooks/use-sgk-bulk-query.ts` | Yeni dosya | Bulk state yönetimi + WS listener + fire-and-forget stream-save |
| 6 | `src/components/sgk-sorgulama/sgk-bulk-query-dialog.tsx` | Yeni dosya | Müşteri+branch seçim dialog'u |
| 7 | `src/components/sgk-sorgulama/sgk-bulk-results.tsx` | Yeni dosya | Sonuç ekranı (istatistik kartları + müşteri satırları) |
| 8 | `src/components/sgk-sorgulama/sgk-client.tsx` | Düzenleme | "Toplu Sorgula" butonu, bulk state entegrasyonu, progress paneli |

## Uygulama Planı

### Adım 1: Electron Bot — `queryEbildirgeBulk()` fonksiyonu
**Dosya:** `electron-bot/src/main/sgk-ebildirge-api.ts`

Referans: `intvrg-beyanname-api.ts` satır 882-1065 (`queryBeyannamelerBulk`)

- [ ] `BulkSgkCustomer` interface tanımla:
  ```typescript
  interface BulkSgkCustomer {
    id: string;              // customerId
    branchId?: string;       // branch varsa
    unvan: string;           // Görüntüleme adı
    kullaniciAdi: string;    // Decrypt edilmiş
    isyeriKodu: string;
    sistemSifresi: string;
    isyeriSifresi: string;
    savedBildirgeRefNos: string[];  // Skip edilecek ref'ler
  }
  ```
- [ ] `BulkSgkCallbacks` interface tanımla (beyanname pattern ile aynı):
  ```typescript
  interface BulkSgkCallbacks {
    onCustomerStart: (index: number, total: number, customer: BulkSgkCustomer) => void;
    onCustomerProgress: (index: number, total: number, customer: BulkSgkCustomer, status: string) => void;
    onCustomerResults: (index: number, total: number, customer: BulkSgkCustomer, bildirgeler: BildirgeItem[]) => void;
    onPdfResult: (customerId: string, branchId: string | undefined, pdfData: any) => void;
    onCustomerComplete: (index: number, total: number, customer: BulkSgkCustomer, stats: { totalQueried: number; totalDownloaded: number; totalFailed: number }) => void;
    onCustomerError: (index: number, total: number, customer: BulkSgkCustomer, error: string) => void;
    onAllComplete: (summary: { totalCustomers: number; successCount: number; errorCount: number; totalBildirge: number; totalPdf: number }) => void;
  }
  ```
- [ ] `sgkBulkCancelled` flag ekle ve `cancelSgkBulkQuery()` export et
- [ ] `queryEbildirgeBulk()` fonksiyonu yaz:
  - Müşterileri sıralı döngüde işle
  - Her müşteri için: mevcut `queryAndDownloadPipeline()` fonksiyonunu çağır
  - İptal kontrolü her döngü başında
  - **Müşteriler arası 1 saniye bekleme** (`setTimeout(resolve, 1000)`)
  - Hata izolasyonu: bir müşteri fail olursa diğerine geç
  - Tüm müşteriler bitince `onAllComplete` callback'i çağır
- [ ] `queryAndDownloadPipeline`'dan gelen callback'leri bulk callback'lere yönlendir

### Adım 2: Electron Bot — index.ts handler
**Dosya:** `electron-bot/src/main/index.ts`

Referans: Satır 1826-1919 (beyanname bulk handler)

- [ ] `isSgkBulkRunning` flag ekle (mevcut `activeSgkQueries` yanına)
- [ ] `sgk:ebildirge-bulk-start` handler:
  ```typescript
  wsClient.on('sgk:ebildirge-bulk-start', async (data: BotCommandData) => {
    if (isSgkBulkRunning) { error döndür; return; }
    isSgkBulkRunning = true;
    try {
      const { queryEbildirgeBulk } = await import('./sgk-ebildirge-api');
      await queryEbildirgeBulk(data.customers, data, callbacks);
    } finally { isSgkBulkRunning = false; }
  });
  ```
- [ ] `sgk:ebildirge-bulk-cancel` handler:
  ```typescript
  wsClient.on('sgk:ebildirge-bulk-cancel', async () => {
    const { cancelSgkBulkQuery } = await import('./sgk-ebildirge-api');
    cancelSgkBulkQuery();
    wsClient?.send('sgk:ebildirge-bulk-cancelled', {});
  });
  ```
- [ ] Callback'ler WS event'lerine map:
  - `onCustomerStart` → `sgk:ebildirge-bulk-customer-start`
  - `onCustomerProgress` → `sgk:ebildirge-bulk-progress`
  - `onCustomerResults` → `sgk:ebildirge-bulk-customer-results`
  - `onPdfResult` → `sgk:ebildirge-bulk-pdf-result-item`
  - `onCustomerComplete` → `sgk:ebildirge-bulk-customer-complete`
  - `onCustomerError` → `sgk:ebildirge-bulk-customer-error`
  - `onAllComplete` → `sgk:ebildirge-bulk-all-complete`

### Adım 3: server.ts — WS Event Relay
**Dosya:** `server.ts`

Referans: Satır 528-534 (mevcut SGK event relay)

- [ ] Satır 534'ten sonra ekle:
  ```typescript
  case 'sgk:ebildirge-bulk-customer-start':
  case 'sgk:ebildirge-bulk-progress':
  case 'sgk:ebildirge-bulk-customer-results':
  case 'sgk:ebildirge-bulk-pdf-result-item':
  case 'sgk:ebildirge-bulk-customer-complete':
  case 'sgk:ebildirge-bulk-customer-error':
  case 'sgk:ebildirge-bulk-all-complete':
  case 'sgk:ebildirge-bulk-query-error':
  case 'sgk:ebildirge-bulk-cancelled':
    console.log(`[WS] SGK E-Bildirge BULK event: ${message.type}`);
    broadcastToTenant(client.tenantId, message);
    break;
  ```

### Adım 4: API Endpoint — PUT /api/sgk/ebildirge-bulk
**Dosya:** `src/app/api/sgk/ebildirge-bulk/route.ts` (YENİ)

Referans: `src/app/api/intvrg/beyanname/route.ts` PUT metodu (satır 220-415)

- [ ] Request interface:
  ```typescript
  interface SgkBulkQueryRequest {
    customerIds: string[];
    basAy: string;
    basYil: string;
    bitAy: string;
    bitYil: string;
  }
  ```
- [ ] Auth check + tenantId
- [ ] Müşterileri tek sorguda al (`findMany where id in customerIds`):
  - SGK credential alanları: `sgkKullaniciAdi, sgkIsyeriKodu, sgkSistemSifresi, sgkIsyeriSifresi`
  - Branch'ler dahil: `include: { customer_branches: { select: { id, branchName, sgkKullaniciAdi, sgkIsyeriKodu, sgkSistemSifresi, sgkIsyeriSifresi } } }`
- [ ] Her müşteri + branch için credential decrypt:
  - Ana müşteri: SGK credential'ı varsa ekle
  - Her branch: SGK credential'ı varsa ayrı item olarak ekle
  - `bulkItems` array'ine push (customerId + branchId + unvan + decrypt edilmiş credentials)
- [ ] Kaydedilmiş bildirge ref'lerini al (duplicate prevention):
  - Documents tablosundan `fileCategory IN ('SGK_TAHAKKUK', 'HIZMET_LISTESI')` ile
  - Veya mevcut naming pattern'den bildirgeRefNo extract et
  - **Basit yaklaşım:** Mevcut stream-save zaten duplicate detection yapıyor, boş array gönder
- [ ] Bot bağlantı kontrolü (`/_internal/clients`)
- [ ] Captcha API key kontrolü (**sadece CAPTCHA_API_KEY, OCR Space gönderilmeyecek**)
- [ ] Bot'a `sgk:ebildirge-bulk-start` komutu gönder:
  ```typescript
  body: {
    tenantId,
    type: "sgk:ebildirge-bulk-start",
    data: {
      customers: bulkItems,
      basAy, basYil, bitAy, bitYil,
      captchaApiKey,
      // ocrSpaceApiKey GÖNDERİLMEYECEK (SGK'da sadece 2Captcha)
    }
  }
  ```
- [ ] Response: `{ success: true, totalCustomers: bulkItems.length }`

### Adım 5: Hook — use-sgk-bulk-query.ts
**Dosya:** `src/components/sgk-sorgulama/hooks/use-sgk-bulk-query.ts` (YENİ)

Referans: `src/components/beyannameler/hooks/use-bulk-query.ts` (477 satır — BİREBİR KOPYALA, ADAPTE ET)

- [ ] Types:
  ```typescript
  export interface SgkBulkCustomerResult {
    customerId: string;
    branchId?: string;
    customerName: string;
    status: "pending" | "querying" | "downloading" | "complete" | "error";
    bildirgeCount: number;      // beyanname yerine bildirge
    downloadedCount: number;
    error?: string;
  }

  export interface SgkBulkSummary {
    totalCustomers: number;
    successCount: number;
    errorCount: number;
    totalBildirge: number;      // beyanname yerine bildirge
    totalPdf: number;
  }
  ```
- [ ] Reducer: Beyanname pattern ile birebir aynı, sadece field isimlerini değiştir
- [ ] WS Event mapping:
  - `sgk:ebildirge-bulk-customer-start` → CUSTOMER_START
  - `sgk:ebildirge-bulk-progress` → PROGRESS
  - `sgk:ebildirge-bulk-customer-results` → CUSTOMER_RESULTS (`bildirgeler.length`)
  - `sgk:ebildirge-bulk-pdf-result-item` → PDF_DOWNLOADED + fire-and-forget save
  - `sgk:ebildirge-bulk-customer-complete` → CUSTOMER_COMPLETE
  - `sgk:ebildirge-bulk-customer-error` → CUSTOMER_ERROR
  - `sgk:ebildirge-bulk-all-complete` → ALL_COMPLETE
  - `sgk:ebildirge-bulk-query-error` → ERROR
  - `sgk:ebildirge-bulk-cancelled` → CANCELLED
- [ ] `savePdf` fonksiyonu → mevcut `/api/sgk/ebildirge-stream-save` endpoint'ini çağır:
  ```typescript
  await fetch("/api/sgk/ebildirge-stream-save", {
    method: "POST",
    body: JSON.stringify({
      customerId: data.customerId,
      items: [{
        pdfBase64: data.pdfBase64,
        bildirgeRefNo: data.bildirgeRefNo,
        pdfType: data.pdfType,
        hizmetDonem: data.hizmetDonem,
        belgeTuru: data.belgeTuru,
        belgeMahiyeti: data.belgeMahiyeti,
      }]
    })
  });
  ```
- [ ] `startBulkQuery` → `PUT /api/sgk/ebildirge-bulk` endpoint'ini çağır
- [ ] `cancelBulkQuery` → WS üzerinden `sgk:ebildirge-bulk-cancel` gönder
- [ ] Elapsed time counter (beyanname pattern ile aynı)

### Adım 6: Dialog — sgk-bulk-query-dialog.tsx
**Dosya:** `src/components/sgk-sorgulama/sgk-bulk-query-dialog.tsx` (YENİ)

Referans: `src/components/beyannameler/beyanname-bulk-query-dialog.tsx` (337 satır — KOPYALA + ADAPTE ET)

- [ ] Customer interface güncelle:
  ```typescript
  interface SgkCustomerWithBranches {
    id: string;
    unvan: string;
    kisaltma: string | null;
    vknTckn: string;
    hasSgkCredentials: boolean;
    branches: Array<{
      id: string;
      branchName: string;
      hasSgkCredentials: boolean;
    }>;
  }
  ```
- [ ] Props:
  ```typescript
  interface SgkBulkQueryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    customers: SgkCustomerWithBranches[];
    basAy: string;
    basYil: string;
    bitAy: string;
    bitYil: string;
    onStart: (selectedItems: Array<{ customerId: string; branchId?: string }>) => void;
  }
  ```
- [ ] Müşteri gruplama:
  - `queryable`: SGK credential'ı olan müşteriler + credential'ı olan branch'ler
  - `noCredentials`: SGK credential'ı olmayan müşteriler + branch'ler
  - Branch'ler parent müşterinin altında indent'li gösterilir
- [ ] Checkbox: Her müşteri ve her branch ayrı ayrı seçilebilir
- [ ] `selectedItems` state: `Set<string>` → key format: `customerId` veya `customerId:branchId`
- [ ] "Sorgulanacak" ve "Sorgulanmayacak" tab'ları
- [ ] Title: "Toplu SGK E-Bildirge Sorgulama"
- [ ] Description: dönem bilgisi
- [ ] Footer: seçili sayısı + "Sorgulamayı Başlat" butonu

### Adım 7: Results — sgk-bulk-results.tsx
**Dosya:** `src/components/sgk-sorgulama/sgk-bulk-results.tsx` (YENİ)

Referans: `src/components/beyannameler/beyanname-bulk-results.tsx` (304 satır — KOPYALA + ADAPTE ET)

- [ ] StatCard component'i aynen kopyala
- [ ] CustomerResultRow: "beyanname" → "bildirge", "PDF" aynen
- [ ] İstatistik kartları:
  - Başarılı Mükellef (successCount)
  - Hatalı Mükellef (errorCount)
  - Toplam Bildirge (totalBildirge)
  - İndirilen PDF (totalPdf)
- [ ] Müşteri tıklaması → SGK arşiv sayfasına yönlendir:
  ```typescript
  router.push(`/dashboard/sgk-sorgulama/arsiv?customerId=${result.customerId}&autoFilter=true`);
  ```
- [ ] Başlık: "Toplu SGK Sorgulama Tamamlandı" / "İptal Edildi"

### Adım 8: sgk-client.tsx entegrasyonu
**Dosya:** `src/components/sgk-sorgulama/sgk-client.tsx`

Referans: Beyanname client'taki toplu sorgulama entegrasyonu

- [ ] Import ekle:
  ```typescript
  import { useSgkBulkQuery } from "./hooks/use-sgk-bulk-query";
  import SgkBulkQueryDialog from "./sgk-bulk-query-dialog";
  import SgkBulkResults from "./sgk-bulk-results";
  ```
- [ ] State ekle:
  ```typescript
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const { state: bulkState, startBulkQuery, cancelBulkQuery, resetBulkQuery, elapsedSeconds: bulkElapsed } = useSgkBulkQuery();
  ```
- [ ] "Toplu Sorgula" butonu ekle (mevcut "Sorgula" butonunun yanına):
  ```tsx
  <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
    <Users className="mr-2 h-4 w-4" />
    Toplu Sorgula
  </Button>
  ```
- [ ] Progress paneli (bulkState.status === "running"):
  - Mevcut müşteri adı
  - X/Y progress bar
  - Geçen süre
  - İptal butonu
- [ ] Sonuç ekranı (bulkState.status === "completed" || "cancelled"):
  - `<SgkBulkResults>` component'i render et
  - `onClose` → `resetBulkQuery()`
- [ ] Dialog render:
  ```tsx
  <SgkBulkQueryDialog
    open={bulkDialogOpen}
    onOpenChange={setBulkDialogOpen}
    customers={customersWithBranches}
    basAy={basAy} basYil={basYil} bitAy={bitAy} bitYil={bitYil}
    onStart={handleBulkStart}
  />
  ```
- [ ] `handleBulkStart` fonksiyonu: dialog'dan gelen selectedItems'ı `startBulkQuery`'ye aktar
- [ ] Branch bilgilerini customers API'den çekmek için ek fetch gerekebilir veya `/api/customers/[id]/branches` endpoint'ini kullan

## Teknik Notlar

### Captcha Kuralı (KRİTİK!)
SGK E-Bildirge'de **sadece 2Captcha** kullanılacak. OCR Space kullanılmayacak.
- `sgk-ebildirge-api.ts`'de captcha sıralaması değiştirildi
- Bulk API endpoint'ten `ocrSpaceApiKey` **GÖNDERİLMEYECEK**
- Bot handler'da da `ocrSpaceApiKey: undefined` geçilecek

### Branch Credential Çözümleme
Tek müşteri endpoint'i (`/api/sgk/ebildirge`) zaten branch desteği var (satır 110-126).
Bulk endpoint'te aynı pattern kullanılacak ama döngüde:
```typescript
for (const customer of customers) {
  // Ana müşteri
  if (hasSgkCredentials(customer)) {
    bulkItems.push({ id: customer.id, branchId: undefined, ... });
  }
  // Branch'ler
  for (const branch of customer.customer_branches) {
    if (hasSgkCredentials(branch)) {
      bulkItems.push({ id: customer.id, branchId: branch.id, ... });
    }
  }
}
```

### Stream-Save Uyumluluğu
Mevcut `ebildirge-stream-save` endpoint'i `customerId` alıyor, `branchId` almıyor.
Dosya isimlendirmesi VKN bazlı olduğundan ve her branch'in farklı VKN'si olduğundan sorun çıkmaz.
**Ancak** branch'lerin VKN'si = müşterinin VKN'si (aynı firma farklı işyeri).
Bu durumda dosya adı çakışması olmaz çünkü `bildirgeRefNo` unique'dir.

### queryAndDownloadPipeline Yeniden Kullanımı
Mevcut `queryAndDownloadPipeline()` fonksiyonu tek müşteri için tasarlanmış.
Bulk fonksiyon bu pipeline'ı loop içinde çağıracak.
Her müşteri için bağımsız `SgkSession` oluşturulur (login → query → PDF → logout).

### WS Event Data Yapısı
```typescript
// sgk:ebildirge-bulk-customer-start
{ index: number, total: number, customerId: string, branchId?: string, customerName: string }

// sgk:ebildirge-bulk-progress
{ index: number, total: number, customerId: string, branchId?: string, customerName: string, status: string }

// sgk:ebildirge-bulk-customer-results
{ index: number, total: number, customerId: string, branchId?: string, bildirgeler: BildirgeItem[] }

// sgk:ebildirge-bulk-pdf-result-item
{ customerId: string, branchId?: string, pdfBase64: string, bildirgeRefNo: string, pdfType: string, hizmetDonem: string, belgeTuru: string, belgeMahiyeti: string }

// sgk:ebildirge-bulk-customer-complete
{ index: number, total: number, customerId: string, branchId?: string, customerName: string, stats: { totalQueried, totalDownloaded, totalFailed } }

// sgk:ebildirge-bulk-customer-error
{ index: number, total: number, customerId: string, branchId?: string, customerName: string, error: string }

// sgk:ebildirge-bulk-all-complete
{ totalCustomers: number, successCount: number, errorCount: number, totalBildirge: number, totalPdf: number }
```

### Performans
- Fire-and-forget stream-save (her PDF geldiğinde anında kaydet)
- Mevcut cache katmanları (auth, folder, customer, bildirgeRef) otomatik çalışır
- Müşteriler arası 1sn bekleme
- İptal mekanizması: flag kontrolü her döngü başında

## Uygulama Sırası (Önerilen)

```
1. server.ts               → WS relay (5 dk, en basit)
2. sgk-ebildirge-api.ts    → queryEbildirgeBulk() (30 dk)
3. index.ts                → Bot handler (15 dk)
4. ebildirge-bulk/route.ts → API endpoint (20 dk)
5. use-sgk-bulk-query.ts   → Hook (20 dk)
6. sgk-bulk-query-dialog    → Dialog (20 dk)
7. sgk-bulk-results         → Sonuç ekranı (15 dk)
8. sgk-client.tsx           → Entegrasyon (20 dk)
```
