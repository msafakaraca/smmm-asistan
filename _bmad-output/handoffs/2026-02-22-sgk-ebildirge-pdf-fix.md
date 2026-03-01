# Handoff: SGK E-Bildirge PDF Indirme Hatasi Duzeltmesi
**Tarih:** 2026-02-22 23:50
**Durum:** Tamamlandi

## Gorev Tanimi
> SGK E-Bildirge pipeline'inda PDF indirme 4/4 basarisiz. Login, captcha, donem sorgulama hepsi basarili ama `pdfGosterim.action` endpoint'ine yapilan PDF istekleri HTML donuyor (PDF yerine). Kök neden analiz edildi, düzeltme yapilacak.

## Arastirma Bulgulari

### Hata Analizi (hata.txt log'undan)
- Login basarili, token alinmis
- Donem sorgulama basarili, 2 bildirge bulunmus
- 4 PDF indirme denemesinin 4'u de basarisiz
- Her seferinde `text/html` content-type donuyor (PDF yerine)
- Her HTML yanitindan yeni token cikariliyor (session canli)
- Sonuc: 2 bildirge, 0 PDF, 4 hata

### Kök Neden: `islem()` JavaScript Fonksiyonu Analizi

SGK'nin PDF indirme mekanizmasi `islem(EkForm, deger)` JS fonksiyonu ile calisir:
```javascript
function islem(EkForm, deger) {
    // 1. Popup pencere ac (goruntulemede)
    // 2. Sayfadaki mevcut pdfFormId formunun hidden field'larini set et:
    $('#bildirgeRefNoId').val(deger);
    $('#downloadId').val('true');  // veya 'false'
    $('#tipId').val('tahakkukonayliFisTahakkukPdf');  // veya diger tip
    // 3. Formu submit et:
    pdfFormId.submit();
}
```

### pdfFormId Formu (browser'dan alinmis)
```html
<form id="pdfFormId" name="pdfGosterimForm"
      action="/EBildirgeV2/tahakkuk/pdfGosterim.action" method="post">
    <input type="hidden" name="struts.token.name" value="token">
    <input type="hidden" name="token" value="67GMN3ETOLH8JU57NRTGK640TI66N9XF">
    <input type="hidden" name="tip" value="tahakkukonayliFisTahakkukPdf" id="tipId">
    <input type="hidden" name="download" value="false" id="downloadId">
    <input type="hidden" name="hizmet_yil_ay_index" value="2" id="pdfFormId_hizmet_yil_ay_index">
    <input type="hidden" name="hizmet_yil_ay_index_bitis" value="1" id="pdfFormId_hizmet_yil_ay_index_bitis">
    <input type="hidden" name="bildirgeRefNo" value="1834-2026-1" id="bildirgeRefNoId">
</form>
```

### Tespit Edilen Sorunlar

**Sorun 1 (KESIN): `hizmet_yil_ay_index_bitis` degeri yanlis**
- Browser formu: `hizmet_yil_ay_index=2`, `hizmet_yil_ay_index_bitis=1`
- Bizim kod: `hizmet_yil_ay_index=2`, `hizmet_yil_ay_index_bitis=2`
- Server bu degerleri donem seciciye gore kendisi set ediyor
- Bizim kod calculatePeriodIndex ile hesapliyor → uyusmuyor

**Sorun 2 (MUHTEMEL): Token tüketimi**
- Struts token one-time use — her form submit'te tuketilir
- Browser'da `pdfFormId.submit()` popup'a gider, ana sayfa token'i degismez
- Bizim fetch() ile gonderdigimizde token server'da tuketilir
- Ikinci PDF icin gecerli token kalmaz

**Sorun 3 (MUHTEMEL): Referer header**
- Bizim kod her zaman `https://ebildirge.sgk.gov.tr/EBildirgeV2` gonderiyor
- Browser'da referer donem sorgulama sonuc sayfasi olur

### PDF Tip Kodlari (HTML'den cikarildi)
| Kod | tip Degeri | Aciklama |
|-----|-----------|----------|
| T / TD | tahakkukonayliFisTahakkukPdf | Tahakkuk PDF (goruntulem / indir) |
| H / HD | tahakkukonayliFisHizmetPdf | Hizmet Listesi PDF |
| SH / SHD | tahakkukonayliFisUcretGizliHizmetPdf | S.Hizmet PDF |

## Etkilenecek Dosyalar
| Dosya | Degisiklik | Detay |
|-------|-----------|-------|
| `electron-bot/src/main/sgk-ebildirge-api.ts` | Duzenleme | queryPeriod + downloadPdf + getHeaders |

## Uygulama Plani

### Adim 1: queryPeriod'da pdfFormId formunu parse et (~satir 430-469)

`queryPeriod` metodunun donus tipine `pdfFormFields` ekle:

```typescript
interface PdfFormFields {
  hizmet_yil_ay_index: string;
  hizmet_yil_ay_index_bitis: string;
  token: string;
}
```

`queryPeriod` metodunda bildirge parse'dan sonra:
```typescript
// pdfFormId formundan PDF indirme parametrelerini al
const pdfForm = $('form#pdfFormId, form[name="pdfGosterimForm"]');
let pdfFormFields: PdfFormFields | undefined;
if (pdfForm.length > 0) {
  pdfFormFields = {
    hizmet_yil_ay_index: (pdfForm.find('input[name="hizmet_yil_ay_index"]').val() as string) || String(startIndex),
    hizmet_yil_ay_index_bitis: (pdfForm.find('input[name="hizmet_yil_ay_index_bitis"]').val() as string) || String(endIndex),
    token: (pdfForm.find('input[name="token"]').val() as string) || this.currentToken || '',
  };
  // PDF form token'ini kullan (farkli olabilir)
  if (pdfFormFields.token) {
    this.currentToken = pdfFormFields.token;
  }
}
```

Donus degerine `pdfFormFields` ekle:
```typescript
return { bildirgeler, isyeriInfo, pdfFormFields };
```

### Adim 2: downloadPdf'i pdfFormFields kullanacak sekilde guncelle (~satir 593-660)

`downloadPdf` imzasini degistir — `startIndex/endIndex` yerine `pdfFormFields` al:

```typescript
async downloadPdf(
  bildirgeRefNo: string,
  pdfType: 'tahakkuk' | 'hizmet_listesi',
  pdfFormFields: { hizmet_yil_ay_index: string; hizmet_yil_ay_index_bitis: string },
): Promise<{ success: boolean; pdfBase64?: string; error?: string }>
```

Form data'yi guncelle:
```typescript
const formData = new URLSearchParams({
  'struts.token.name': 'token',
  'token': this.currentToken,
  'tip': tip,
  'download': 'true',
  'hizmet_yil_ay_index': pdfFormFields.hizmet_yil_ay_index,
  'hizmet_yil_ay_index_bitis': pdfFormFields.hizmet_yil_ay_index_bitis,
  'bildirgeRefNo': bildirgeRefNo,
});
```

### Adim 3: Referer header'ini dinamik yap (~satir 251-268)

`SgkSession` sinifina `lastPageUrl` field'i ekle:
```typescript
private lastPageUrl: string = SGK_BASE;
```

`getHeaders`'da Referer'i dinamik yap:
```typescript
'Referer': this.lastPageUrl,
```

Her istek sonrasi `lastPageUrl`'i guncelle:
- `loadPeriodPage` sonrasi: `ENDPOINTS.PERIOD_LOAD`
- `queryPeriod` sonrasi: `ENDPOINTS.PERIOD_QUERY`

### Adim 4: Pipeline'daki cagrilari guncelle (~satir 775-858)

`queryPeriod` donus degerinden `pdfFormFields`'i al:
```typescript
const { bildirgeler, isyeriInfo, pdfFormFields } = await session.queryPeriod(startIndex, endIndex);
```

`downloadPdf` cagrisini guncelle:
```typescript
const pdfResult = await session.downloadPdf(
  bildirge.bildirgeRefNo,
  pdfType,
  pdfFormFields || { hizmet_yil_ay_index: String(startIndex), hizmet_yil_ay_index_bitis: String(endIndex) },
);
```

### Adim 5: PDF indirme icin redirect:'follow' dene (~satir 618)

```typescript
// redirect: 'manual' yerine
redirect: 'follow',
```

## Teknik Notlar
- `islem()` fonksiyonu ara adim yapmadan direkt form submit ediyor — intermediate step yok
- Struts token one-time use — basarili PDF sonrasi token tuketilir, HTML'den yeni token cikarilmali
- Basarili PDF response'ta (`application/pdf`) token gelmez — sonraki PDF icin loadPeriodPage+queryPeriod tekrari gerekebilir
- Eger token tüketimi sorunu devam ederse, her PDF icin donem sayfasini yeniden yuklemek gerekebilir

## Kararlar ve Gerekceleri
| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| PDF form field'larini server'dan parse et | Server kendi index degerleri set ediyor, hesaplama uyusmuyor | calculatePeriodIndex duzeltmek (ama server mantigi bilinmiyor) |
| Referer'i dinamik yap | SGK Referer kontrol ediyor olabilir | Sabit Referer (mevcut, calismadi) |
| redirect:'follow' dene | PDF endpoint redirect yapabilir | redirect:'manual' tutmak (mevcut, calismadi) |
