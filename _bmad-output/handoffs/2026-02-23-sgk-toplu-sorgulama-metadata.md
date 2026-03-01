# Handoff: SGK Toplu Sorgulama Metadata Düzeltmesi
**Tarih:** 2026-02-23 18:15
**Durum:** ✅ Tamamlandı

## Görev Tanımı
> Toplu SGK E-Bildirge sorgulamasında metadata alanları (kanunNo, calisanSayisi, gunSayisi, pekTutar) arşive kaydedilmiyor. Bu alanlar tek sorgulama akışında doğru çalışıyor ama toplu sorgulama callback'lerinde eksik gönderiliyor.

## Araştırma Bulguları

### Kök Neden
Toplu sorgulama pipeline'ında `queryEbildirgeBulk()` fonksiyonu, `queryAndDownloadPipeline()` callback'inde metadata alanlarını **çıkarmış/eklenmemiş**. Tek sorgulama callback'inde tüm metadata var, toplu'da eksik.

### Veri Akışı Karşılaştırması

**TEK SORGULAMA (Çalışıyor):**
```
BildirgeItem { kanunNo, calisanSayisi, gunSayisi, pekTutar }
  → queryAndDownloadPipeline() onPdfResult callback → TÜM ALANLAR VAR
  → WebSocket: sgk:ebildirge-pdf-result → TÜM ALANLAR VAR
  → Hook saveSingle() → TÜM ALANLAR VAR
  → /api/sgk/ebildirge-stream-save → metadata kaydedilir ✅
```

**TOPLU SORGULAMA (Sorunlu):**
```
BildirgeItem { kanunNo, calisanSayisi, gunSayisi, pekTutar }
  → queryEbildirgeBulk() → queryAndDownloadPipeline() onPdfResult callback → 4 ALAN EKSIK ❌
  → WebSocket: sgk:ebildirge-bulk-pdf-result-item → EKSIK ALANLAR GEÇMEZ
  → Hook savePdf() → EKSIK ALANLAR GÖNDERİLMEZ
  → /api/sgk/ebildirge-stream-save → metadata BOŞ kaydedilir ❌
```

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `electron-bot/src/main/sgk-ebildirge-api.ts` | Düzenleme | BulkSgkCallbacks interface + onPdfResult callback |
| `src/components/sgk-sorgulama/hooks/use-sgk-bulk-query.ts` | Düzenleme | savePdf çağrısına metadata ekle |

## Uygulama Planı

### Adım 1: Electron Bot — BulkSgkCallbacks Interface Güncelle
**Dosya:** `electron-bot/src/main/sgk-ebildirge-api.ts`
**Satır 940-947** — `BulkSgkCallbacks.onPdfResult` interface'ine metadata alanlarını ekle:

```typescript
// ÖNCE (satır 940-947):
onPdfResult: (customerId: string, branchId: string | undefined, pdfData: {
    pdfBase64: string;
    bildirgeRefNo: string;
    pdfType: string;
    hizmetDonem: string;
    belgeTuru: string;
    belgeMahiyeti: string;
}) => void;

// SONRA:
onPdfResult: (customerId: string, branchId: string | undefined, pdfData: {
    pdfBase64: string;
    bildirgeRefNo: string;
    pdfType: string;
    hizmetDonem: string;
    belgeTuru: string;
    belgeMahiyeti: string;
    kanunNo: string;
    calisanSayisi: string;
    gunSayisi: string;
    pekTutar: string;
}) => void;
```

### Adım 2: Electron Bot — onPdfResult Callback'e Metadata Ekle
**Dosya:** `electron-bot/src/main/sgk-ebildirge-api.ts`
**Satır 1019-1028** — `queryEbildirgeBulk()` içindeki onPdfResult callback'ine metadata alanlarını ekle:

```typescript
// ÖNCE (satır 1019-1028):
onPdfResult: (pdfData) => {
    customerPdfCount++;
    callbacks.onPdfResult(customer.id, customer.branchId, {
        pdfBase64: pdfData.pdfBase64,
        bildirgeRefNo: pdfData.bildirgeRefNo,
        pdfType: pdfData.pdfType,
        hizmetDonem: pdfData.hizmetDonem,
        belgeTuru: pdfData.belgeTuru,
        belgeMahiyeti: pdfData.belgeMahiyeti,
    });
},

// SONRA:
onPdfResult: (pdfData) => {
    customerPdfCount++;
    callbacks.onPdfResult(customer.id, customer.branchId, {
        pdfBase64: pdfData.pdfBase64,
        bildirgeRefNo: pdfData.bildirgeRefNo,
        pdfType: pdfData.pdfType,
        hizmetDonem: pdfData.hizmetDonem,
        belgeTuru: pdfData.belgeTuru,
        belgeMahiyeti: pdfData.belgeMahiyeti,
        kanunNo: pdfData.kanunNo,
        calisanSayisi: pdfData.calisanSayisi,
        gunSayisi: pdfData.gunSayisi,
        pekTutar: pdfData.pekTutar,
    });
},
```

**NOT:** `pdfData` zaten `SgkPipelineCallbacks.onPdfResult`'tan geliyor ve o callback tüm metadata alanlarını içeriyor (satır 90-103). Dolayısıyla `pdfData.kanunNo`, `pdfData.calisanSayisi`, vb. zaten mevcut.

### Adım 3: Frontend Hook — savePdf Çağrısına Metadata Ekle
**Dosya:** `src/components/sgk-sorgulama/hooks/use-sgk-bulk-query.ts`
**Satır 362-369** — WebSocket handler'daki savePdf çağrısına metadata alanlarını ekle:

```typescript
// ÖNCE (satır 361-369):
if (data.pdfBase64 && data.customerId) {
    savePdf(data.customerId, {
        pdfBase64: data.pdfBase64,
        bildirgeRefNo: data.bildirgeRefNo,
        pdfType: data.pdfType,
        hizmetDonem: data.hizmetDonem,
        belgeTuru: data.belgeTuru,
        belgeMahiyeti: data.belgeMahiyeti,
    });
}

// SONRA:
if (data.pdfBase64 && data.customerId) {
    savePdf(data.customerId, {
        pdfBase64: data.pdfBase64,
        bildirgeRefNo: data.bildirgeRefNo,
        pdfType: data.pdfType,
        hizmetDonem: data.hizmetDonem,
        belgeTuru: data.belgeTuru,
        belgeMahiyeti: data.belgeMahiyeti,
        kanunNo: (data.kanunNo as string) || "",
        calisanSayisi: (data.calisanSayisi as string) || "",
        gunSayisi: (data.gunSayisi as string) || "",
        pekTutar: (data.pekTutar as string) || "",
    });
}
```

### NOT: index.ts Değişiklik Gerekmez
`electron-bot/src/main/index.ts` satır 2110-2114'te zaten spread operatörü kullanılıyor:
```typescript
wsClient.send('sgk:ebildirge-bulk-pdf-result-item', {
    customerId, branchId, ...pdfData,  // spread — yeni alanlar otomatik geçer
});
```

### NOT: ebildirge-stream-save Değişiklik Gerekmez
Save API zaten metadata alanlarını optional olarak destekliyor ve kaydediyor. Ayrıca önceki oturumda eklenen `backfillMissingMetadata()` fonksiyonu eski kayıtları da güncelleyecek.

## Teknik Notlar
- Electron Bot değişikliği yapıldıktan sonra `cd electron-bot && npm start` ile yeniden başlatılmalı
- Değişiklikler sadece 2 dosyada, toplamda 3 düzenleme
- `electron-bot/src/main/index.ts` değişiklik gerektirmez (spread operatörü)
- Mevcut `backfillMissingMetadata` önceki oturumda eklendi, eski kayıtları tekrar sorgulandığında güncelleyecek
