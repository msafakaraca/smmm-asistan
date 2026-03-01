# Handoff: E-Beyanname API Optimizasyon — Tam Analiz + Uygulama Planı
**Tarih:** 2026-02-15 23:30
**Durum:** ✅ Tamamlandı

## Görev Tanımı
> E-Beyanname portal API'sinin tam analizi, mevcut bot.ts kodunun incelenmesi ve yeni bağımsız `ebeyanname-api.ts` modülü oluşturulması. Cheerio ile HTML parse, paralel sayfa çekme, güvenilir durum tespiti.

---

## 1. E-Beyanname dispatch API — Tam Keşif

### 1.1 Endpoint
```
POST https://ebeyanname.gib.gov.tr/dispatch?_dc={timestamp}
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
X-Requested-With: XMLHttpRequest
Referer: https://ebeyanname.gib.gov.tr/dispatch?cmd=LOGIN&TOKEN={token}
```

### 1.2 Response Envelope
```xml
<SERVICERESULT>
    <TOKEN>128-char-hex-yenilenen-token</TOKEN>
    <SERVERERROR></SERVERERROR>
    <EYEKSERROR></EYEKSERROR>
    <HTMLCONTENT>...HTML içerik...</HTMLCONTENT>
</SERVICERESULT>
```
- Token her response'da gelir (session-based, aynı kalabilir veya yenilenebilir)
- `<SERVERERROR>` veya `<EYEKSERROR>` dolu ise hata var

### 1.3 Keşfedilen Tüm dispatch Komutları

| Komut | Parametreler | Açıklama |
|-------|-------------|----------|
| `BEYANNAMESORGU` | TOKEN | Arama formunu getir |
| `BEYANNAMELISTESI` | sorguTipiZ, baslangicTarihi, bitisTarihi, pageNo, TOKEN | **Ana beyanname listesi sorgusu** |
| `THKESASBILGISGKMESAJLARI` | beyannameOid, TOKEN | Beyanname detay (SGK bildirimleri) |
| `THKESASBILGISGKMESAJLISTESI` | thkEsasOid | Tahakkuk mesaj listesi |
| `HATALITAHAKKUKSAYISI` | o={beyannameOid} | Hatalı tahakkuk sayısı |
| `HATALITAHAKKUKSAYISIOZEL` | oz={beyannameOid} | Özel hatalı tahakkuk |
| `THKSONDURUMSGK` | tahakkukOid, thkdurum | SGK son durum güncelleme |
| `MUHSGKMANUELONAYGONDER` | beyannameOid | Manuel onay gönder |
| `MUHSGKMANUELIPTALGONDER` | beyannameOid | Manuel iptal gönder |
| `MUHSGKMANUELKONTROLGONDER` | beyannameOid | Manuel kontrol gönder |

### 1.4 BEYANNAMELISTESI Sorgu Parametreleri

| Parametre | Format | Açıklama |
|-----------|--------|----------|
| `cmd` | `BEYANNAMELISTESI` | Zorunlu |
| `TOKEN` | 128 char hex | Zorunlu |
| `sorguTipiZ` | `1` | Tarih filtresi aktif |
| `baslangicTarihi` | `YYYYMMDD` | Başlangıç tarihi |
| `bitisTarihi` | `YYYYMMDD` | Bitiş tarihi |
| `sorguTipiN` | `1` | VKN filtresi aktif |
| `vergiNo` | String | VKN değeri |
| `sorguTipiT` | `1` | TCK filtresi aktif |
| `tcKimlikNo` | String | TCK değeri |
| `sorguTipiB` | `1` | Beyanname türü filtresi aktif |
| `beyannameTanim` | String | Tür kodu (KDV1, MUHSGK vb.) |
| `sorguTipiP` | `1` | Dönem filtresi aktif |
| `donemBasAy` / `donemBasYil` | int | Dönem başlangıç |
| `donemBitAy` / `donemBitYil` | int | Dönem bitiş |
| `sorguTipiV` | `1` | VD filtresi aktif |
| `vdKodu` | `060266` formatında | VD kodu |
| `pageNo` | Integer | Sayfa no (2+ için, ilk sayfa için parametre yok veya 1) |
| `_dc` | Unix timestamp ms | Cache bypass |

### 1.5 Pagination Yapısı

```
digerSayfayaGecis(form, action, currentPage, totalPages, baseQuery)
```
- **action:** `'firstPage'`, `'previousPage'`, `'nextPage'`, `'lastPage'`
- **Sayfa başı:** 25 kayıt sabit
- **Bilgi formatı:** `"1 - 25 / 123"` → regex: `/(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)/`
- **totalPages:** `Math.ceil(totalRecords / 25)`
- Gerçek veri: 123 kayıt, 5 sayfa

---

## 2. HTML Tablo Yapısı (Kesin Pattern)

### 2.1 Satır Yapısı

```html
<!-- Script tag ile tip bilgisi (her satırdan önce) -->
<script>beyannameTipleri['{OID}'] = '{TYPE}';</script>

<!-- Satır -->
<tr id="row{OID}" class="blAG|blKG" title="{dosyaAdı}   {tarih}">
  <td id="checkboxTD{OID}" align=center></td>          <!-- [0] Checkbox -->
  <td>MUHSGK</td>                                       <!-- [1] Beyanname Türü -->
  <td align=left>\n {VKN/TCK}</td>                      <!-- [2] VKN/TCK (baştaki boşluk+newline!) -->
  <td title="{TAM_UNVAN}">{KISA_UNVAN}...</td>          <!-- [3] Ad/Unvan (title'da tam ad) -->
  <td align=left>{VD_ADI}</td>                           <!-- [4] Vergi Dairesi -->
  <td align=center>{AY}/{YIL}-{AY}/{YIL}</td>           <!-- [5] Dönem -->
  <td align=center>Merkez</td>                           <!-- [6] Şube -->
  <td align=left>{GG.AA.YYYY - SS:DD:SS}</td>           <!-- [7] Yükleme Zamanı -->
  <td><!-- Durum nested table (aşağıda detay) --></td>   <!-- [8] Vergi Tahakkuku -->
  <td><!-- SGK kontrol ikonu --></td>                    <!-- [9] SGK Tahakkuku -->
</tr>
```

### 2.2 Durum Hücresi (td[8]) İç Yapısı

```html
<td>
  <table>
    <tr>
      <!-- Durum ikonu + metin -->
      <td id="durumTD{OID}">
        <img src="images/{durum}.gif"/>&nbsp;{DurumMetni}
      </td>

      <!-- Mesaj ikonu (sadece hatalılarda) -->
      <td align="center" id="msgIcon{OID}" style="width:17px">
        <!-- Hatalı ise: -->
        <img src="images/ico_msg.gif" title="Mesaj" style="cursor:pointer"
             onclick="beyannameMesajGosterInDetay('{OID}')"/>
      </td>

      <!-- Beyanname PDF (onaylandı ve iptal'de var, hatalıda yok) -->
      <td align="center" id="bynPDF{OID}" style="width:17px">
        <img src="images/pdf_b.gif" onclick="beyannameGoruntule('{OID}',false,false)"/>
      </td>

      <!-- Tahakkuk PDF (sadece onaylandıda var) -->
      <td align="center" id="thkPDF{OID}" style="width:17px">
        <img src="images/pdf_t.gif" onclick="tahakkukGoruntule('{OID}','{thkOID}',false,false)"/>
      </td>

      <!-- İhbar (genelde boş) -->
      <td align="center" style="width:17px" id="ihb{OID}"></td>
    </tr>
  </table>
</td>
```

### 2.3 SGK Hücresi (td[9]) İç Yapısı

```html
<!-- MUHSGK beyannamelerinde tick_kontrol ikonu var -->
<td align="center" style="width: 20px">
  <img src="images/tick_kontrol.gif" title="Beyanname Detayı"
       style="cursor:pointer" onclick="beyannameSGKBildirimleriGoster('{OID}', false)"/>
</td>

<!-- MUHSGK olmayan (örn KDV1) beyannamelerde boş -->
<td align="center" style="width: 20px"></td>
```

### 2.4 Kesin Durum Haritası

| Durum | İkon Dosyası | Metin | PDF Beyanname | PDF Tahakkuk | Mesaj İkonu |
|-------|-------------|-------|---------------|--------------|-------------|
| **Onaylandı** | `ok.gif` | `Onaylandı` | `pdf_b.gif` var | `pdf_t.gif` var | Yok |
| **Hatalı** | `err.gif` | `Hatalı` | Yok | Yok | `ico_msg.gif` var |
| **İptal** | `iptal.gif` | `İptal` | `pdf_b.gif` var | Yok | Yok |
| **Bekliyor** | `wtng.gif` | `Bekliyor` (?) | ? | ? | ? |

**Cheerio selector:**
```javascript
// Durum tespiti
const durumTd = $(`td[id^="durumTD"]`);
const img = durumTd.find('img');
const src = img.attr('src'); // "images/ok.gif" | "images/err.gif" | "images/iptal.gif" | "images/wtng.gif"
const statusMap = {
  'ok.gif': 'onaylandi',
  'err.gif': 'hatali',
  'iptal.gif': 'iptal',
  'wtng.gif': 'bekliyor'
};
```

### 2.5 PDF Fonksiyonları ve OID'ler

```javascript
// Beyanname PDF — tek OID
beyannameGoruntule('{beyannameOid}', false, false)

// Tahakkuk PDF — İKİ OID gerekli!
tahakkukGoruntule('{beyannameOid}', '{tahakkukOid}', false, false)
// tahakkukOid, thkPDF{OID} hücresindeki onclick'ten çıkartılır

// SGK Tahakkuk PDF (detay sayfasından)
sgkTahakkukGoruntule('{beyannameOid}', '{sgkBildirimOid}', false, false)

// SGK Hizmet Dökümü PDF
sgkHizmetGoruntule('{beyannameOid}', '{sgkBildirimOid}', false, false)
```

**Not:** PDF fonksiyonları AJAX değil, `window.open()` ile yeni sekmede açıyor. Bu yüzden Network tab'da dispatch olarak görünmüyor. Muhtemelen `dispatch?cmd=IMAJ&...` URL'i oluşturuyor.

---

## 3. MUHSGK Detay Sayfası (THKESASBILGISGKMESAJLARI)

### 3.1 Response Yapısı

Detay sayfası 2 bölümlü tablo:

**Satır 1: Vergi Tahakkuku**
```html
<tr id="row{beyannameOid}" class="blKG" title="SGK Bildirimleri Listesi">
  <td align="center">12/2025-12/2025</td>           <!-- Dönem -->
  <td align="left">Vergi</td>                        <!-- Açıklama: "Vergi" -->
  <td><!-- durumDetay: ok.gif + Onaylandı --></td>   <!-- Durum -->
  <td><!-- pdf_b.gif --></td>                         <!-- Beyanname PDF -->
</tr>
```

**Satır 2: SGK Bildirimi**
```html
<tr id="row{sgkOid}" class="blAG" title="SGK Bildirimleri Listesi">
  <td align="center">12/2025-12/2025</td>
  <td align="left">Asıl, TÜM SİG.KOLLARI/YABNC UYR, 05510-Say.Kan.MYO, 12 / 2025, 01010033851060000, Yasal süresinde verilme</td>
  <td><!-- durumDetay: ok.gif + Onaylandı --></td>
  <td>
    <!-- sgkthkPDF: pdf_s.gif — SGK Tahakkuk PDF -->
    <!-- sgkhzmtPDF: pdf_h.gif — Hizmet Dökümü PDF -->
  </td>
</tr>
```

### 3.2 Detay Sayfası Ek Butonları

| Buton | İkon | Komut |
|-------|------|-------|
| Yenile | `refresh.jpg` | `beyannameSGKBildirimleriGoster('{OID}', false)` |
| Toplu Tahakkuk İndir | `multiDownload.png` | `sgkTopluTahakkukGoruntule('{bynOID}', '{sgkOID}', false, false)` |
| Mesaj İndir (Excel) | `mesajDownload.png` | `sgkTopluBeyannameMesajGoruntule('{OID}', false, false)` |
| Paket Onay İsteği | `onayIptal.jpg` | `sgkManuelTahakkukOnay('{OID}')` |

---

## 4. Token Alma Akışı (Mevcut Kod)

```
gibDijitalLogin(userid, sifre, captchaKey, ocrKey)
    ↓ Bearer Token
getEbeyanToken(dijitalToken)                    // bot.ts:560-596
    ↓ GET dijital.gib.gov.tr/apigateway/auth/tdvd/ebyn-login
    ↓ response.redirectUrl → TOKEN parse
    ↓ GET redirectUrl (session aktivasyonu!)
    ↓ 128 char hex TOKEN
dispatch istekleri (BEYANNAMELISTESI, THKESASBILGISGKMESAJLARI, vb.)
```

**Kritik:** `redirectUrl`'ye GET yapılmazsa session aktive olmaz!

---

## 5. Önemli Keşifler ve Edge Case'ler

### 5.1 Aynı Mükellef Birden Fazla Beyanname
Veriden: ÜMİT ERDEM (TCK: 68791059072) aynı dönem (12/2025) için 6 kez MUHSGK göndermiş:
1. 10:16:46 → **Hatalı** (ico_msg.gif var)
2. 10:25:29 → **Hatalı**
3. 10:31:49 → **Hatalı**
4. 10:41:47 → **Hatalı**
5. 10:47:55 → **İptal** (pdf_b.gif var ama thk yok)
6. 11:50:11 → **Onaylandı** (pdf_b + pdf_t var)

**Sonuç:** "Son durum" belirlenirken **yükleme zamanına göre sıralayıp en son kaydı** baz almalıyız. Eğer en son kayıt Onaylandı ise → beyanname verilmiş.

### 5.2 Beyanname Türü Çeşitliliği
170+ beyanname türü var. Bizim kontrol sistemi için önemli olanlar:
- `MUHSGK`, `MUHSGK2` — Muhtasar ve Prim Hizmet
- `KDV1`, `KDV2`, `KDV2B`, `KDV4` — KDV
- `GGECICI`, `KGECICI` — Geçici Vergi
- `DAMGA` — Damga Vergisi
- `FORMBA`, `FORMBS` — BA/BS Formları
- `KURUMLAR`, `KURUMLARP` — Kurumlar Vergisi
- `GELIR` — Gelir Vergisi

### 5.3 VKN vs TCK Farkı
- **VKN** (10 hane): Şirketler → `<td>` içinde baştaki boşluk + `\n` var
- **TCK** (11 hane): Şahıslar → `<td>` içinde sadece boşluk

Parse sırasında `.trim()` gerekli.

### 5.4 Unvan
- Kısa unvan `<td>` text içeriğinde (`...` ile kesilmiş)
- **Tam unvan `title` attribute'unda!** → `$('td').attr('title')` kullan

### 5.5 Kayıt Boyutu
- Mali müşavire göre değişir: **100-500 beyanname** / aylık sorgu
- 25 kayıt/sayfa → 4-20 sayfa arası

---

## 6. Mimari Kararlar

| Karar | Seçim | Gerekçe |
|-------|-------|---------|
| HTML Parser | **cheerio** | Hafif, CSS selector, jQuery-like, regex'ten çok daha dayanıklı |
| Modül yapısı | **Yeni `ebeyanname-api.ts`** | bot.ts'e (1500+ satır) dokunma riski yüksek, bağımsız modül |
| Paralel sayfa limiti | **3 concurrent** | GİB rate limit güvenliği |
| Son durum mantığı | **Yükleme zamanına göre** | Aynı mükellef+tür+dönem'in son kaydı baz |
| Token yönetimi | **Zincirli** | Her response'daki token'ı bir sonraki istekte kullan |
| PDF indirme | **Ayrı modül/mevcut bot.ts** | Bu modül sadece sorgulama odaklı |

---

## 7. Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `electron-bot/src/main/ebeyanname-api.ts` | **YENİ** | Ana beyanname sorgulama modülü |
| `electron-bot/src/main/index.ts` | Düzenleme | Yeni WebSocket handler ekle |
| `electron-bot/package.json` | Düzenleme | `cheerio` bağımlılığı ekle |
| `src/app/api/gib/ebeyanname-query/route.ts` | **YENİ** (opsiyonel) | Frontend API endpoint |

**DOKUNULMAYACAK:** `electron-bot/src/main/bot.ts` (mevcut PDF indirme botu olarak kalır)

---

## 8. Uygulama Planı

### Adım 1: Bağımlılık Kurulumu
- [ ] `electron-bot/` dizininde `npm install cheerio` (veya `cheerio` zaten var mı kontrol et)

### Adım 2: `ebeyanname-api.ts` Modülünü Oluştur
- [ ] TypeScript interface'leri tanımla (BeyannameSatiri, SorguParams, SorguSonuc)
- [ ] `getEbeyanToken()` fonksiyonunu bot.ts'den import et veya kopyala
- [ ] `fetchBeyannamePage(token, params, pageNo)` fonksiyonu yaz
- [ ] `parseBeyannamePage(html)` fonksiyonu yaz (cheerio ile)
- [ ] `queryBeyannameler(token, params)` ana fonksiyonu yaz (pagination + paralel)
- [ ] `parseDurum(imgSrc)` helper'ı yaz
- [ ] `determineSonDurum(records)` — aynı mükellef+tür+dönem gruplama + son durum

### Adım 3: WebSocket Handler Ekle
- [ ] `index.ts`'e `ebeyanname:query` handler ekle
- [ ] Request: `{ userid, sifre, baslangicTarihi, bitisTarihi, filters? }`
- [ ] Response: `{ success, data: BeyannameSatiri[], totalRecords, error? }`

### Adım 4: Test
- [ ] Manuel test: Electron bot başlat, WebSocket üzerinden sorgu gönder
- [ ] Edge case: Boş sonuç, tek sayfa, çok sayfa, hatalı beyanname

### Adım 5: Frontend Entegrasyonu (Opsiyonel — ayrı görev)
- [ ] Kontrol panelinde E-Beyanname sorgulama butonu
- [ ] Sonuçları BeyannameTakip tablosuna otomatik yansıtma

---

## 9. Teknik Referans: Cheerio Parse Stratejisi

```typescript
import * as cheerio from 'cheerio';

interface BeyannameSatiri {
  oid: string;
  beyannameType: string;
  vknTckn: string;
  unvan: string;      // title attribute'dan tam unvan
  kisaUnvan: string;  // td text'ten kısa unvan
  vergiDairesi: string;
  donem: string;
  subeNo: string;
  yuklemeZamani: string;
  durum: 'onaylandi' | 'hatali' | 'iptal' | 'bekliyor';
  hasMesaj: boolean;
  hasBeyPdf: boolean;
  hasThkPdf: boolean;
  tahakkukOid: string | null;  // thkPDF onclick'ten parse
  hasSgkDetay: boolean;
}

function parseBeyannamePage(html: string): { records: BeyannameSatiri[], totalRecords: number, totalPages: number, currentPage: number } {
  const $ = cheerio.load(html);

  // Pagination bilgisi
  const pageInfo = $('font[size="2"]').text(); // "1 - 25 / 123"
  const pageMatch = pageInfo.match(/(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)/);
  const totalRecords = pageMatch ? parseInt(pageMatch[3]) : 0;
  const totalPages = Math.ceil(totalRecords / 25);
  const currentPage = pageMatch ? Math.ceil(parseInt(pageMatch[1]) / 25) : 1;

  // Satırları parse et
  const records: BeyannameSatiri[] = [];
  $('tr[id^="row"]').each((_, row) => {
    const $row = $(row);
    const oid = $row.attr('id')?.replace('row', '') || '';
    const tds = $row.find('> td');

    // Durum tespiti
    const durumImg = $row.find(`td[id^="durumTD"] img`).attr('src') || '';
    const durumMap: Record<string, string> = {
      'ok.gif': 'onaylandi',
      'err.gif': 'hatali',
      'iptal.gif': 'iptal',
      'wtng.gif': 'bekliyor'
    };
    const durumKey = durumImg.split('/').pop() || '';

    // Tahakkuk OID
    const thkOnclick = $row.find(`td[id^="thkPDF"] img`).attr('onclick') || '';
    const thkMatch = thkOnclick.match(/tahakkukGoruntule\('[^']+','([^']+)'/);

    records.push({
      oid,
      beyannameType: tds.eq(1).text().trim(),
      vknTckn: tds.eq(2).text().trim(),
      unvan: tds.eq(3).attr('title') || tds.eq(3).text().trim(),
      kisaUnvan: tds.eq(3).text().trim(),
      vergiDairesi: tds.eq(4).text().trim(),
      donem: tds.eq(5).text().trim(),
      subeNo: tds.eq(6).text().trim(),
      yuklemeZamani: tds.eq(7).text().trim(),
      durum: (durumMap[durumKey] || 'bekliyor') as any,
      hasMesaj: $row.find(`td[id^="msgIcon"] img`).length > 0,
      hasBeyPdf: $row.find(`td[id^="bynPDF"] img`).length > 0,
      hasThkPdf: $row.find(`td[id^="thkPDF"] img`).length > 0,
      tahakkukOid: thkMatch ? thkMatch[1] : null,
      hasSgkDetay: $row.find('img[src*="tick_kontrol"]').length > 0,
    });
  });

  return { records, totalRecords, totalPages, currentPage };
}
```

---

## 10. Mevcut Kod Referansları

| Fonksiyon | Dosya:Satır | Açıklama |
|-----------|------------|----------|
| `gibDijitalLogin()` | `electron-bot/src/main/earsiv-dijital-api.ts` | Ortak GİB login |
| `getEbeyanToken()` | `electron-bot/src/main/bot.ts:560-596` | E-Beyanname token alma |
| `fetchBeyannamePage()` | `electron-bot/src/main/bot.ts:622-800+` | Mevcut regex-based parse |
| `GIB_BEYANNAME_TANIM_MAP` | `electron-bot/src/main/bot.ts:603-616` | Beyanname tür eşleme |
| `GIB_CONFIG` | `electron-bot/src/main/bot.ts:17-58` | Endpoint/timeout config |
| WebSocket handlers | `electron-bot/src/main/index.ts` | Mevcut handler'lar |

---

## 11. cURL Referans (Tam İstek)

```bash
curl "https://ebeyanname.gib.gov.tr/dispatch?_dc={timestamp}" \
  -H "Accept: */*" \
  -H "Content-Type: application/x-www-form-urlencoded; charset=UTF-8" \
  -H "Origin: https://ebeyanname.gib.gov.tr" \
  -H "Referer: https://ebeyanname.gib.gov.tr/dispatch?cmd=LOGIN&TOKEN={token}" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "User-Agent: Mozilla/5.0 ..." \
  --data-raw "cmd=BEYANNAMELISTESI&sorguTipiZ=1&baslangicTarihi=20260101&bitisTarihi=20260131&pageNo=1&TOKEN={token}"
```

---

## 12. Eksik/Opsiyonel Bilgiler

| Bilgi | Durum | Etkisi |
|-------|-------|--------|
| `beyannameGoruntule()` JS kaynak kodu | Eksik | PDF URL yapısı bilinmiyor — bot.ts'den çıkarılabilir |
| `wtng.gif` (Bekliyor) gerçek örnek | Eksik | Parse stratejisi HAR'dan tahmin edildi |
| PDF indirme dispatch komutu (`IMAJ`?) | Eksik | Bu modülün kapsamı dışı |

---

> **Bu handoff ile yeni context'te doğrudan Adım 1'den başlanabilir.**
> Tüm HTML yapıları, selector'lar, edge case'ler ve parse stratejisi hazır.
