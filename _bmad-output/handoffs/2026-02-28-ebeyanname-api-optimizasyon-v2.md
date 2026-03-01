# Handoff: E-Beyanname API Optimizasyon — v2 (HAR Doğrulanmış)
**Tarih:** 2026-02-28 17:00
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor
**Önceki Versiyon:** `2026-02-15-ebeyanname-api-optimizasyon.md`

## Görev Tanımı
> Yeni bağımsız `ebeyanname-api.ts` Electron Bot modülü oluştur. Cheerio ile HTML parse, sıralı sayfa çekme (rate limit uyumlu), HAR-doğrulanmış durum tespiti. Bot.ts'deki mevcut regex-based `fetchBeyannamePage` fonksiyonunun cheerio ile yeniden yazılmış, bağımsız versiyonu.

---

## 1. E-Beyanname dispatch API (HAR Doğrulanmış)

### 1.1 Endpoint & Headers (HAR'dan Doğrulanmış)

```
POST https://ebeyanname.gib.gov.tr/dispatch?_dc={Date.now()}
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
X-Requested-With: XMLHttpRequest
Origin: https://ebeyanname.gib.gov.tr
Referer: https://ebeyanname.gib.gov.tr/
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36
Accept: */*
```

**Not:** `X-Requested-With: XMLHttpRequest` HAR'da doğrulandı — eklenmeli.

### 1.2 Response Envelope (HAR'dan Doğrulanmış)

```xml
<SERVICERESULT>
    <TOKEN>128-char-hex-token</TOKEN>
    <SERVERERROR></SERVERERROR>
    <EYEKSERROR></EYEKSERROR>
    <HTMLCONTENT>...HTML içerik...</HTMLCONTENT>
</SERVICERESULT>
```

Response headers:
```
Cache-Control: no-cache
Content-Type: text/html;charset=UTF-8
Pragma: No-cache
Server: CS
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
```

**Cookie YOK** — oturum tamamen TOKEN parametresiyle yönetiliyor.

### 1.3 Hata Kontrolü

GİB'in client-side parser'ından (`resolveAJAXResult`):
1. `<SERVERERROR>` dolu ise → hata mesajı göster, TOKEN güncelle
2. `<EYEKSERROR>` dolu ise → hata göster, 1s sonra pencereyi kapat (oturum sona ermiş)
3. Her ikisi de boş → `<HTMLCONTENT>` içeriğini render et

### 1.4 Dispatch Komutları (Tam Liste)

| Komut | Parametreler | Açıklama |
|-------|-------------|----------|
| `LOGIN` | TOKEN (GET query param) | İlk sayfa yükleme (session başlat) |
| `BEYANNAMESORGU` | TOKEN | Arama formunu getir |
| `BEYANNAMELISTESI` | sorguTipiZ, baslangicTarihi, bitisTarihi, pageNo, TOKEN + filtreler | **Ana beyanname listesi sorgusu** |
| `THKESASBILGISGKMESAJLARI` | beyannameOid, TOKEN | MUHSGK detay (SGK bildirimleri) |
| `THKESASBILGISGKMESAJLISTESI` | thkEsasOid | Tahakkuk mesaj listesi |
| `DETAYICINBEYANNAMEGETIR` | subcmd=BEYANNAMEMESAJLISTESI | Hata mesajları popup |
| `IMAJ` | subcmd, beyannameOid, TOKEN, + OID'ler | PDF görüntüleme (GET) |
| `ARSIVBEYANNAMESORGU` | TOKEN | Arşiv beyanname arama |
| `ARSIVPAKETSORGU` | TOKEN | Arşiv paket arama |

---

## 2. BEYANNAMELISTESI Sorgu Parametreleri (HAR Doğrulanmış)

### 2.1 Zorunlu ve Opsiyonel Parametreler

| Parametre | Format | Açıklama | Zorunlu? |
|-----------|--------|----------|----------|
| `cmd` | `BEYANNAMELISTESI` | Komut | ✅ |
| `TOKEN` | 128 char hex | Oturum token'ı | ✅ |
| `sorguTipiZ` | `1` | Tarih filtresi (her zaman aktif, kapatılamaz) | ✅ |
| `baslangicTarihi` | `YYYYMMDD` | Yükleme tarihi başlangıç | ✅ |
| `bitisTarihi` | `YYYYMMDD` | Yükleme tarihi bitiş | ✅ |
| `sorguTipiN` | `1` | VKN filtresi aktif | Opsiyonel |
| `vergiNo` | 10 hane | VKN değeri | sorguTipiN=1 ise |
| `sorguTipiT` | `1` | TCK filtresi aktif | Opsiyonel |
| `tcKimlikNo` | 11 hane | TCK değeri | sorguTipiT=1 ise |
| `sorguTipiB` | `1` | Beyanname türü filtresi aktif | Opsiyonel |
| `beyannameTanim` | `KDV1`, `MUHSGK` vb. | Tür kodu | sorguTipiB=1 ise |
| `sorguTipiP` | `1` | Dönem filtresi aktif | Opsiyonel |
| `donemBasAy`/`donemBasYil` | int | Dönem başlangıç | sorguTipiP=1 ise |
| `donemBitAy`/`donemBitYil` | int | Dönem bitiş | sorguTipiP=1 ise |
| `sorguTipiV` | `1` | Vergi dairesi filtresi aktif | Opsiyonel |
| `vdKodu` | `060266` formatı | VD kodu | sorguTipiV=1 ise |
| `sorguTipiD` | `1` | **Durum filtresi aktif** | Opsiyonel |
| `durum` | `0\|1\|2\|3` | **0=Hatalı, 1=Onay Bekliyor, 2=Onaylandı, 3=İptal** | sorguTipiD=1 ise |
| `pageNo` | Integer | Sayfa (1. sayfa için parametre yok, 2+ için gerekli) | Opsiyonel |

### 2.2 `sorguTipiD` — Durum Filtresi (YENİ KEŞİF!)

HAR'daki JavaScript'ten keşfedildi. Server-side durum filtreleme imkanı:

```
sorguTipiD=1&durum=2  → Sadece Onaylandı beyannameler
sorguTipiD=1&durum=0  → Sadece Hatalı beyannameler
```

**Optimizasyon fırsatı:** Sadece `durum=2` ile sorgulayarak gereksiz satırları çekmekten kaçınılabilir. Ancak "son durum" tespiti için tüm durumların çekilmesi gerekebilir.

### 2.3 Pagination (HAR Doğrulanmış)

**Sayfa başı:** 25 kayıt (sabit)

**HAR'dan gerçek pagination HTML:**
```html
<td><input title="İlk Sayfa" type=button value="|<<" onclick="digerSayfayaGecis(...)" /></td>
<td><input title="Önceki Sayfa" type=button value="<<" onclick="digerSayfayaGecis(...)" /></td>
<td><b><font size="2">26 - 50 / 123</font></b></td>
<td><input title="Sonraki Sayfa" type=button value=">>" onclick="digerSayfayaGecis(...)" /></td>
<td><input title="Son Sayfa" type=button value=">>|" onclick="digerSayfayaGecis(...)" /></td>
```

**`digerSayfayaGecis` tam signature (HAR JS'den):**
```javascript
digerSayfayaGecis(frm, page, pageNo, lastPage, pagingFormParams, contentIdForPaging)
// frm = this.form
// page = 'firstPage' | 'previousPage' | 'nextPage' | 'lastPage'
// pageNo = mevcut sayfa numarası (integer)
// lastPage = toplam sayfa sayısı (integer)
// pagingFormParams = 'cmd=BEYANNAMELISTESI&sorguTipiZ=1&baslangicTarihi=20260101&bitisTarihi=20260131&'
```

**İki parse yöntemi (her ikisi de kullanılmalı):**

```typescript
// Yöntem 1: digerSayfayaGecis regex (ana yöntem — bot.ts'de kanıtlanmış)
const paginationMatch = html.match(
    /digerSayfayaGecis\([^,]+,\s*'nextPage'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([^']+)'/
);
// [1] = currentPage, [2] = totalPages, [3] = baseQuery

// Yöntem 2: font text regex (backup — cheerio ile)
const pageInfo = $('font[size="2"]').first().text(); // "26 - 50 / 123"
const pageMatch = pageInfo.match(/(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)/);
// [3] = totalRecords → Math.ceil(totalRecords / 25) = totalPages
```

**HAR'dan doğrulanan gerçek pagination:**
```
Sayfa 1: "1 - 25 / 123"    (pageNo parametresi YOK)
Sayfa 2: "26 - 50 / 123"   (pageNo=2)
Sayfa 3: "51 - 75 / 123"   (pageNo=3)
Sayfa 4: "76 - 100 / 123"  (pageNo=4)
Sayfa 5: "101 - 123 / 123" (pageNo=5, son sayfa)
```

---

## 3. HTML Tablo Yapısı (HAR'dan Birebir)

### 3.1 Tablo Başlığı (10 Kolon)

```html
<table cellspacing=1 width="100%">
<colgroup>
    <col width="25"/><col width="80"/><col width="110"/><col width="130"/>
    <col width="120"/><col width="112"/><col width="110"/><col width="80"/>
</colgroup>
<tr>
    <th class="bslkK"><!-- Toplu Seç Checkbox --></th>
    <th class="bslkK">Beyanname Türü</th>
    <th class="bslkK">TC Kimlik Numarası / Vergi Kimlik Numarası</th>
    <th class="bslkK">Ad Soyad/Unvan(*)</th>
    <th class="bslkK">Vergi Dairesi / Malmüdürlüğü</th>
    <th class="bslkK">Vergilendirme Dönemi</th>
    <th class="bslkK">Şube No</th>
    <th class="bslkK">Yükleme Zamanı</th>
    <th class="bslkK">Vergi Tahakkuku Durumu</th>
    <th class="bslkK">SGK Tahakkuku Durumu</th>
</tr>
```

### 3.2 Satır Yapısı (HAR'dan Birebir Kopyalanmış)

**Her satırdan önce script tag:**
```html
<script>beyannameTipleri['1wmjx0i91w144z'] = 'MUHSGK';</script>
```

**Satır:**
```html
<tr id="row1wmjx0i91w144z" class="blAG" title="2025_ARALIK_Muhtasar(AYLIK).xml   03.01.2026 - 13:43:12">
    <td id="checkboxTD1wmjx0i91w144z" align=center></td>            <!-- [0] Checkbox (sadece wtng'de dolu) -->
    <td>MUHSGK</td>                                                   <!-- [1] Beyanname Türü -->
    <td align=left> 6******890</td>                                   <!-- [2] VKN/TCK (baştaki boşluk+newline!) -->
    <td title="EV EŞYAM DAYANIKLI TÜKETİM MALLARI...">EV EŞYAM DAYANI...</td>  <!-- [3] Ad/Unvan -->
    <td align=left>TOKAT VD</td>                                      <!-- [4] Vergi Dairesi -->
    <td align=center>12/2025-12/2025</td>                             <!-- [5] Dönem -->
    <td align=center>Merkez</td>                                      <!-- [6] Şube -->
    <td align=left>03.01.2026 - 13:43:12</td>                        <!-- [7] Yükleme Zamanı -->
    <td><!-- [8] Durum nested table (3.3'te detay) --></td>
    <td><!-- [9] SGK Tahakkuku (3.5'te detay) --></td>
</tr>
```

**Sınıf alternasyonu:** `blAG` (açık) ve `blKG` (koyu) — zebra striping.

**`title` attribute formatı:** `{YIL}_{AY_TR}_{TürAdı}({DÖNEM}).xml   {GG.AA.YYYY} - {SS:DD:SS}`

### 3.3 Durum Hücresi (td[8]) — HAR'dan Birebir

**Onaylandı (ok.gif):**
```html
<td>
    <table><tr>
        <td id="durumTD1wmjx0i91w144z">
            <img src="images/ok.gif"/>&nbsp;Onaylandı
        </td>
        <td align="center" id="msgIcon1wmjx0i91w144z" style="width:17px">
            <!-- Bazen ico_msg.gif olabilir (Onaylandıda DA mesaj olabiliyor!) -->
        </td>
        <td align="center" id="bynPDF1wmjx0i91w144z" style="width:17px">
            <img src="images/pdf_b.gif" title="Beyannameyi PDF Formatında görüntülemek için tıklayınız."
                 style="cursor:pointer" onclick="beyannameGoruntule('1wmjx0i91w144z',false,false)"/>
        </td>
        <td align="center" id="thkPDF1wmjx0i91w144z" style="width:17px">
            <img src="images/pdf_t.gif" title="Tahakkuku PDF Formatında görüntülemek için tıklayınız."
                 style="cursor:pointer" onclick="tahakkukGoruntule('1wmjx0i91w144z','1vmjx0jpaj12zm',false,false)"/>
        </td>
        <td align="center" style="width:17px" id="ihb1wmjx0i91w144z"></td>
    </tr></table>
</td>
```

**Hatalı (err.gif):**
```html
<td id="durumTD1smjx0eacg14rf">
    <img src="images/err.gif"/>&nbsp;Hatalı
</td>
<td align="center" id="msgIcon1smjx0eacg14rf" style="width:17px">
    <img src="images/ico_msg.gif" title="Mesaj" style="cursor:pointer"
         onclick="beyannameMesajGosterInDetay('1smjx0eacg14rf')"/>
</td>
<td align="center" id="bynPDF1smjx0eacg14rf" style="width:17px"><!-- BOŞ --></td>
<td align="center" id="thkPDF1smjx0eacg14rf" style="width:17px"><!-- BOŞ --></td>
```

**İptal (iptal.gif):**
```html
<td id="durumTD1wmjx0i91w15ep">
    <img src="images/iptal.gif"/>&nbsp;İptal
</td>
<td align="center" id="msgIcon..."><!-- BOŞ --></td>
<td align="center" id="bynPDF...">
    <img src="images/pdf_b.gif" ... onclick="beyannameGoruntule(...)"/>  <!-- Beyanname PDF VAR -->
</td>
<td align="center" id="thkPDF..."><!-- BOŞ — Tahakkuk PDF YOK --></td>
```

**Onay Bekliyor (wtng.gif) — HAR'DAN DOĞRULANMIŞ:**
```html
<td id="checkboxTD1smkqnmj8r1qxi" align=center>
    <input type="checkbox" name="1smkqnmj8r1qxi" .../>  <!-- SADECE bu durumda checkbox aktif! -->
</td>
...
<td id="durumTD1smkqnmj8r1qxi">
    <img src="images/wtng.gif"/>&nbsp;Onay bekliyor
</td>
<td align="center" id="msgIcon..."><!-- BOŞ --></td>
<td align="center" id="bynPDF...">
    <img src="images/pdf_b.gif" ... onclick="beyannameGoruntule(...)"/>  <!-- Beyanname PDF VAR -->
</td>
<td align="center" id="thkPDF..."><!-- BOŞ — Tahakkuk PDF YOK --></td>
```

### 3.4 HAR-Doğrulanmış Durum Haritası

| Durum | İkon | Metin (HAR'dan) | Checkbox | pdf_b | pdf_t | ico_msg | SGK tick |
|-------|------|-----------------|----------|-------|-------|---------|----------|
| **Onaylandı** | `ok.gif` | `Onaylandı` | ❌ | ✅ | ✅ | **Bazen** | MUHSGK'da |
| **Hatalı** | `err.gif` | `Hatalı` | ❌ | ❌ | ❌ | ✅ Her zaman | MUHSGK'da |
| **İptal** | `iptal.gif` | `İptal` | ❌ | ✅ | ❌ | ❌ | MUHSGK'da |
| **Onay Bekliyor** | `wtng.gif` | `Onay bekliyor` | ✅ | ✅ | ❌ | ❌ | MUHSGK'da |

**HAR istatistik (123 beyanname):** 109 Onaylandı, 11 Hatalı, 2 İptal, 1 Onay Bekliyor.

### 3.5 SGK Hücresi (td[9])

```html
<!-- MUHSGK beyannamelerinde (53/123 satır): -->
<td align="center" style="width: 20px">
    <img src="images/tick_kontrol.gif" title="Beyanname Detayı" style="cursor:pointer"
         onclick="beyannameSGKBildirimleriGoster('1wmjx0i91w144z', false)"/>
</td>

<!-- MUHSGK OLMAYAN beyannamelerde (KDV1, GGECICI, POSET vb.): -->
<td align="center" style="width: 20px"></td>
```

---

## 4. PDF Download URL Yapısı (HAR JavaScript'ten Keşfedildi)

HAR'daki `ebyn_common.js`'den çıkarılan tam IMAJ komutları:

| subcmd | Açıklama | URL Pattern |
|--------|----------|-------------|
| `BEYANNAMEGORUNTULE` | Beyanname PDF | `GET dispatch?cmd=IMAJ&subcmd=BEYANNAMEGORUNTULE&TOKEN={token}&beyannameOid={oid}&inline=true` |
| `TAHAKKUKGORUNTULE` | Tahakkuk PDF | `GET dispatch?cmd=IMAJ&subcmd=TAHAKKUKGORUNTULE&TOKEN={token}&beyannameOid={oid}&tahakkukOid={thkOid}&inline=true` |
| `SGKTAHAKKUKGORUNTULE` | SGK Tahakkuk | `GET dispatch?cmd=IMAJ&subcmd=SGKTAHAKKUKGORUNTULE&TOKEN={token}&beyannameOid={oid}&sgkTahakkukOid={sgkOid}&inline=true` |
| `SGKHIZMETGORUNTULE` | SGK Hizmet | `GET dispatch?cmd=IMAJ&subcmd=SGKHIZMETGORUNTULE&TOKEN={token}&beyannameOid={oid}&sgkTahakkukOid={sgkOid}&inline=true` |
| `PDF_SGK_TOPLU_TAHAKKUK_GORUNTULE` | SGK Toplu Tahakkuk | `GET dispatch?cmd=IMAJ&subcmd=PDF_SGK_TOPLU_TAHAKKUK_GORUNTULE&TOKEN={token}&beyannameOid={oid}&thkOidler={ids}&inline=true` |
| `IHBARNAMEGORUNTULE` | İhbarname | `GET dispatch?cmd=IMAJ&subcmd=IHBARNAMEGORUNTULE&TOKEN={token}&beyannameOid={oid}&tahakkukOid={thkOid}&tarhOid={toid}&inline=true` |

**Not:** `window.open()` ile açılıyor — network tab'da görünmüyor. `inline=true` → browser'da göster; `inline=true` olmazsa dosya olarak indir. Arşiv sorguları için `&ARSIV=T` eklenir.

**Mevcut bot.ts'deki downloadPdf (satır 897-1025) zaten bu yapıyı kullanıyor:**
```typescript
// bot.ts:906-917
const params = new URLSearchParams({
    cmd: 'IMAJ',
    subcmd: type === 'beyanname' ? 'BEYANNAMEGORUNTULE' : 'TAHAKKUKGORUNTULE',
    beyannameOid: beyannameOid,
    goruntuTip: '1',
    inline: 'true',
    TOKEN: token,
});
if (type === 'tahakkuk' && tahakkukOid) {
    params.append('tahakkukOid', tahakkukOid);
}
```

---

## 5. Token Alma Akışı (HAR + Kod Doğrulanmış)

```
gibDijitalLogin(userid, sifre, captchaKey, ocrKey)     // earsiv-dijital-api.ts (export)
    ↓ Bearer Token

GET dijital.gib.gov.tr/apigateway/auth/tdvd/ebyn-login  // bot.ts:560-596 (private)
    Headers: { Authorization: 'Bearer {dijitalToken}' }
    ↓ Response: { "redirectUrl": "https://ebeyanname.gib.gov.tr/dispatch?cmd=LOGIN&TOKEN={128hex}" }

TOKEN regex parse: /TOKEN=([^&]+)/
    ↓ 128 char hex TOKEN (sadece 0-9 a-f)

GET {redirectUrl}                                        // Session aktivasyonu (ZORUNLU!)
    Headers: { Accept: 'text/html,...', User-Agent: '...' }
    ↓ 200 OK (HTML sayfa, hidden input'a TOKEN gömülü)

POST dispatch istekleri (TOKEN POST body'de)
```

**KRİTİK:** `redirectUrl`'ye GET yapılmazsa session aktive olmaz!
**KRİTİK:** E-Beyanname oturumunda cookie YOK — tamamen TOKEN bazlı.

---

## 6. Beyanname Türleri (HAR Gerçek Veri)

| Tür Kodu | Tam Adı | HAR'daki Sayı | Dönem Formatı |
|----------|---------|---------------|---------------|
| MUHSGK | Muhtasar ve Prim Hizmet Beyannamesi | 53 | `12/2025-12/2025` (aylık) veya `10/2025-12/2025` (çeyreklik) |
| KDV1 | KDV Beyannamesi | 42 | `12/2025-12/2025` |
| GGECICI | Gelir Geçici Vergi | 9 | `10/2025-12/2025` |
| POSET | Poşet Beyannamesi | 7 | `10/2025-12/2025` |
| KGECICI | Kurumlar Geçici Vergi | 5 | `10/2025-12/2025` |
| KDV2 | KDV2 Beyannamesi | 3 | `12/2025-12/2025` |
| KONAKLAMA | Konaklama Vergisi | 2 | — |
| TURIZM | Turizm Vergisi | 1 | — |
| KDV9015 | Tevkifat Beyannamesi | 1 | — |

**Toplam:** 123 beyanname, 5 sayfa (25/sayfa)

---

## 7. Edge Case'ler (HAR + Kod Doğrulanmış)

### 7.1 Aynı Mükellef Çoklu Beyanname
"Son durum" tespiti: **yükleme zamanına göre sıralayıp en son kaydı** baz al.

### 7.2 VKN vs TCK
- VKN (10 hane) → `<td>` içinde baştaki boşluk + `\n` var
- TCK (11 hane) → `<td>` içinde sadece boşluk
- **Parse: `.trim()` zorunlu**

### 7.3 Unvan
- Kısa unvan → `<td>` text (`...` ile kesilmiş)
- **Tam unvan → `title` attribute'unda!**

### 7.4 OID Format
HAR'dan: `1wmjx0i91w144z`, `1smjx0eacg14rf` — alfanumerik.
Bot.ts'de URL-encoded OID'ler de olabiliyor (`%C4%9E` gibi) → `safeDecodeOid()` savunma amaçlı eklenecek.

### 7.5 Mesaj İkonu (ico_msg.gif)
HAR'dan keşif: **Sadece Hatalı'da değil, bazı Onaylandı satırlarında da var!** (26 ikon / 123 satır)

### 7.6 Checkbox
**Sadece "Onay bekliyor" (wtng.gif) satırlarında** checkbox aktif. Diğer tüm durumlarda checkbox `<td>` boş.

---

## 8. Mimari Kararlar (Güncellenmiş)

| Karar | Seçim | Gerekçe |
|-------|-------|---------|
| HTML Parser | **cheerio** | CSS selector ile güvenilir parse, regex'ten çok daha dayanıklı |
| Modül yapısı | **Yeni `ebeyanname-api.ts`** | bot.ts'e (2052 satır) dokunma riski yüksek, bağımsız modül |
| Sayfa çekme | **Sıralı (PARALEL DEĞİL!)** | GİB rate limit + token zinciri. Bot.ts de sıralı çekiyor |
| Rate limit | **`BETWEEN_PAGES: 1200ms`** | Bot.ts'deki GIB_CONFIG değerlerini kullan |
| Durum tespiti | **3-katmanlı fallback** (bot.ts pattern) | durumTD → nested table → icon scan |
| Son durum mantığı | **Yükleme zamanına göre** | Aynı mükellef+tür+dönem'in son kaydı baz |
| Token yönetimi | **Zincirli** | Her response'daki token'ı bir sonraki istekte kullan |
| Durum değerleri | **bot.ts uyumlu** | `'onaylandi' \| 'hata' \| 'iptal' \| 'onay_bekliyor' \| 'bilinmiyor'` |
| WebSocket pattern | **intvrg:beyanname-query ile aynı** | Dynamic import, dedup map, timeout, progress/results/complete/error |

---

## 9. Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `electron-bot/src/main/ebeyanname-api.ts` | **YENİ** | Ana sorgulama modülü |
| `electron-bot/src/main/index.ts` | Düzenleme | `ebeyanname:query` WebSocket handler ekle |
| `electron-bot/package.json` | Düzenleme | `cheerio` bağımlılığı ekle |

**DOKUNULMAYACAK:** `electron-bot/src/main/bot.ts` — mevcut PDF indirme botu olarak kalır.

---

## 10. Uygulama Planı

### Adım 1: Bağımlılık Kurulumu
- [ ] `cd electron-bot && npm install cheerio`
- [ ] `npm install -D @types/cheerio` (eğer ayrı paketse)

### Adım 2: `ebeyanname-api.ts` Oluştur

#### 2.1 Import'lar ve Sabitler
```typescript
import * as cheerio from 'cheerio';
import { gibDijitalLogin } from './earsiv-dijital-api';
import { GIB_CONFIG } from './bot';

const EBEYANNAME_DISPATCH = 'https://ebeyanname.gib.gov.tr/dispatch';
const EBYN_LOGIN_URL = 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/ebyn-login';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const PAGE_SIZE = 25;
```

#### 2.2 TypeScript Interface'ler
```typescript
export interface EbeyanBeyannameItem {
    oid: string;
    beyannameTuru: string;
    tcVkn: string;
    adSoyadUnvan: string;       // title attribute'dan tam unvan
    vergiDairesi: string;
    vergilendirmeDonemi: string; // "12/2025-12/2025"
    subeNo: string;
    yuklemeZamani: string;       // "03.01.2026 - 13:43:12"
    durum: 'onaylandi' | 'hata' | 'iptal' | 'onay_bekliyor' | 'bilinmiyor';
    hasMesaj: boolean;           // ico_msg.gif var mı
    hasBeyPdf: boolean;          // pdf_b.gif var mı
    hasThkPdf: boolean;          // pdf_t.gif var mı
    tahakkukOid: string | null;  // tahakkukGoruntule onclick'ten parse
    sgkBildiriOid: string | null;
    muhsgkDetailOid: string | null;
    hasSgkDetay: boolean;        // tick_kontrol.gif var mı
}

export interface EbeyanQueryParams {
    userid: string;
    password: string;
    captchaApiKey: string;
    ocrSpaceApiKey?: string;
    baslangicTarihi: string;    // YYYYMMDD
    bitisTarihi: string;        // YYYYMMDD
    vergiNo?: string;
    tcKimlikNo?: string;
    beyannameTuru?: string;
}

export interface EbeyanQueryResult {
    success: boolean;
    beyannameler: EbeyanBeyannameItem[];
    totalRecords: number;
    totalPages: number;
    ebeyanToken?: string;       // PDF indirme için cache'lenebilir
    error?: string;
}
```

#### 2.3 Fonksiyonlar
- [ ] `sleep(ms)` — basit delay helper
- [ ] `safeDecodeOid(oid)` — URL-encoded OID'ler için (bot.ts:863-870 pattern)
- [ ] `getEbeyanToken(dijitalToken)` — bot.ts:560-596'dan kopyala
- [ ] `dispatchRequest(token, formData)` — tek dispatch POST isteği, SERVICERESULT parse, hata kontrolü
- [ ] `parseBeyannamePage(html)` — cheerio ile HTML parse (aşağıda tam implementasyon)
- [ ] `fetchAllPages(ebeyanToken, params, onProgress?, onResults?)` — tüm sayfaları sıralı çek
- [ ] `queryEbeyannameler(params, onProgress?, onResults?)` — ana export fonksiyon (login → token → fetch → parse)

#### 2.4 Cheerio Parse Fonksiyonu (HAR-Doğrulanmış, 3-Katmanlı Durum Tespiti)

```typescript
function parseBeyannamePage(html: string): {
    records: EbeyanBeyannameItem[];
    totalRecords: number;
    totalPages: number;
    currentPage: number;
    newToken: string;
} {
    // 1. SERVICERESULT envelope'dan TOKEN ve HTMLCONTENT çıkar
    const tokenMatch = html.match(/<TOKEN>([^<]+)<\/TOKEN>/);
    const newToken = tokenMatch ? tokenMatch[1] : '';

    const htmlContentMatch = html.match(/<HTMLCONTENT>([\s\S]*?)<\/HTMLCONTENT>/i);
    const contentHtml = htmlContentMatch ? htmlContentMatch[1] : html;

    // Hata kontrolü
    const serverError = html.match(/<SERVERERROR>([^<]+)<\/SERVERERROR>/);
    const eyeksError = html.match(/<EYEKSERROR>([^<]+)<\/EYEKSERROR>/);
    if (serverError?.[1] || eyeksError?.[1]) {
        throw new Error(serverError?.[1] || eyeksError?.[1] || 'GİB Hata');
    }

    const $ = cheerio.load(contentHtml);

    // 2. Pagination — İki yöntemli parse
    let totalRecords = 0;
    let totalPages = 1;
    let currentPage = 1;

    // Yöntem A: digerSayfayaGecis regex
    const pagMatch = contentHtml.match(
        /digerSayfayaGecis\([^,]+,\s*'nextPage'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([^']+)'/
    );
    if (pagMatch) {
        currentPage = parseInt(pagMatch[1], 10);
        totalPages = parseInt(pagMatch[2], 10);
    }

    // Yöntem B: font text (backup + totalRecords)
    const pageText = $('font[size="2"]').first().text();
    const pageTextMatch = pageText.match(/(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)/);
    if (pageTextMatch) {
        totalRecords = parseInt(pageTextMatch[3], 10);
        if (!pagMatch) {
            totalPages = Math.ceil(totalRecords / PAGE_SIZE);
            currentPage = Math.ceil(parseInt(pageTextMatch[1], 10) / PAGE_SIZE);
        }
    }

    // Tek sayfa ise totalRecords = satır sayısı
    if (totalRecords === 0) {
        totalRecords = $('tr[id^="row"]').length;
    }

    // 3. Satırları parse et
    const records: EbeyanBeyannameItem[] = [];

    $('tr[id^="row"]').each((_, row) => {
        const $row = $(row);
        const rawOid = $row.attr('id')?.replace('row', '') || '';
        const oid = safeDecodeOid(rawOid);
        const tds = $row.find('> td');

        if (tds.length < 8) return; // Geçersiz satır (header veya detay satırı olabilir)

        // === DURUM TESPİTİ (3-Katmanlı, bot.ts pattern) ===
        let durum: EbeyanBeyannameItem['durum'] = 'bilinmiyor';

        // Katman 1: durumTD{oid} hücresindeki img src
        const durumTd = $row.find(`td[id^="durumTD"]`);
        const durumImg = durumTd.find('img').attr('src') || '';
        const durumKey = durumImg.split('/').pop() || '';

        const durumMapIcon: Record<string, EbeyanBeyannameItem['durum']> = {
            'ok.gif': 'onaylandi',
            'err.gif': 'hata',
            'error.gif': 'hata',
            'iptal.gif': 'iptal',
            'del.gif': 'iptal',
            'cancel.gif': 'iptal',
            'wtng.gif': 'onay_bekliyor',
            'wait.gif': 'onay_bekliyor',
        };

        if (durumMapIcon[durumKey]) {
            durum = durumMapIcon[durumKey];
        }

        // Katman 2: durumTD text içeriğinden (backup)
        if (durum === 'bilinmiyor') {
            const durumText = durumTd.text().toLowerCase();
            if (durumText.includes('onaylandı') || durumText.includes('onaylandi')) durum = 'onaylandi';
            else if (durumText.includes('hatalı') || durumText.includes('hatali')) durum = 'hata';
            else if (durumText.includes('onay bekliyor') || durumText.includes('bekliyor')) durum = 'onay_bekliyor';
            else if (durumText.includes('iptal')) durum = 'iptal';
        }

        // Katman 3: Nested table'daki herhangi bir durum ikonu (son fallback)
        if (durum === 'bilinmiyor') {
            const nestedImgs = $row.find('table img[src*="images/"]');
            nestedImgs.each((_, img) => {
                if (durum !== 'bilinmiyor') return;
                const src = $(img).attr('src') || '';
                const fname = src.split('/').pop() || '';
                if (durumMapIcon[fname]) {
                    durum = durumMapIcon[fname];
                }
            });
        }

        // === OID'LERİ ÇIKAR ===
        // Tahakkuk OID
        const thkOnclick = $row.find(`td[id^="thkPDF"] img`).attr('onclick') || '';
        const thkMatch = thkOnclick.match(/tahakkukGoruntule\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]/);

        // SGK Bildiri OID
        const sgkOnclick = $row.find('img[src*="tick_kontrol"]').attr('onclick') || '';
        const sgkMatch = sgkOnclick.match(/beyannameSGKBildirimleriGoster\(['"]([^'"]+)['"]/);

        // MUHSGK detail OID (bynGoruntu)
        const muhsgkMatch = $row.html()?.match(/bynGoruntu\(['"]([^'"]+)['"]/);

        // === UNVAN ===
        const unvanTd = tds.eq(3);
        const tamUnvan = unvanTd.attr('title') || unvanTd.text().trim();

        records.push({
            oid,
            beyannameTuru: tds.eq(1).text().trim(),
            tcVkn: tds.eq(2).text().trim(),
            adSoyadUnvan: tamUnvan,
            vergiDairesi: tds.eq(4).text().trim(),
            vergilendirmeDonemi: tds.eq(5).text().trim(),
            subeNo: tds.eq(6).text().trim(),
            yuklemeZamani: tds.eq(7).text().trim(),
            durum,
            hasMesaj: $row.find(`td[id^="msgIcon"] img`).length > 0,
            hasBeyPdf: $row.find(`td[id^="bynPDF"] img`).length > 0,
            hasThkPdf: $row.find(`td[id^="thkPDF"] img`).length > 0,
            tahakkukOid: thkMatch ? safeDecodeOid(thkMatch[2]) : null,
            sgkBildiriOid: sgkMatch ? safeDecodeOid(sgkMatch[1]) : null,
            muhsgkDetailOid: muhsgkMatch ? safeDecodeOid(muhsgkMatch[1]) : null,
            hasSgkDetay: $row.find('img[src*="tick_kontrol"]').length > 0,
        });
    });

    return { records, totalRecords, totalPages, currentPage, newToken };
}
```

### Adım 3: WebSocket Handler Ekle (`index.ts`)

**Pattern:** `intvrg:beyanname-query` handler ile birebir aynı yapı.

```typescript
// index.ts'e eklenecek (~ satır 1220 civarı, intvrg:beyanname-query sonrası)

const activeEbeyanQueries = new Map<string, boolean>();

wsClient.on('ebeyanname:query', async (data: BotCommandData) => {
    const customerName = data.customerName as string | undefined;
    const requesterId = data.userId as string | undefined;

    console.log('[MAIN] 📋 E-Beyanname Sorgulama başlatılıyor...');
    mainWindow?.webContents.send('bot:command', { type: 'ebeyanname-query-start', customerName });

    // Dedup kontrolü
    const queryKey = `ebeyanname-${data.userid}-${data.baslangicTarihi}-${data.bitisTarihi}`;
    if (activeEbeyanQueries.has(queryKey)) {
        wsClient?.send('ebeyanname:query-error', {
            error: 'Bu mükellef için zaten bir sorgulama devam ediyor',
            errorCode: 'QUERY_IN_PROGRESS', customerName, requesterId,
        });
        return;
    }
    activeEbeyanQueries.set(queryKey, true);

    const TIMEOUT_MS = 5 * 60 * 1000;
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
    );

    try {
        const { queryEbeyannameler } = await import('./ebeyanname-api');

        const queryWork = async () => {
            if (!wsClient?.connected) throw new Error('WebSocket bağlantısı kopmuş');

            wsClient?.send('ebeyanname:query-progress', {
                status: 'E-Beyanname sorgulaması başlatılıyor...', customerName, phase: 'login', requesterId,
            });

            return await queryEbeyannameler(
                {
                    userid: data.userid as string,
                    password: data.password as string,
                    captchaApiKey: data.captchaApiKey as string,
                    ocrSpaceApiKey: data.ocrSpaceApiKey as string | undefined,
                    baslangicTarihi: data.baslangicTarihi as string,
                    bitisTarihi: data.bitisTarihi as string,
                    vergiNo: data.vergiNo as string | undefined,
                    tcKimlikNo: data.tcKimlikNo as string | undefined,
                    beyannameTuru: data.beyannameTuru as string | undefined,
                },
                (status) => {
                    if (wsClient?.connected) {
                        wsClient.send('ebeyanname:query-progress', { status, customerName, requesterId });
                    }
                },
                (beyannameler) => {
                    if (wsClient?.connected) {
                        wsClient.send('ebeyanname:query-results', { beyannameler, customerName, requesterId });
                    }
                },
            );
        };

        const result = await Promise.race([queryWork(), timeoutPromise]) as import('./ebeyanname-api').EbeyanQueryResult;

        if (result.success) {
            wsClient?.send('ebeyanname:query-complete', {
                success: true, totalCount: result.beyannameler.length,
                totalRecords: result.totalRecords, totalPages: result.totalPages,
                customerName, ebeyanToken: result.ebeyanToken, requesterId,
            });
        } else {
            wsClient?.send('ebeyanname:query-error', {
                error: result.error || 'Sorgulama başarısız', errorCode: 'QUERY_FAILED', customerName, requesterId,
            });
        }
    } catch (e: any) {
        let errorCode = 'UNKNOWN_ERROR';
        let errorMessage = e.message || 'E-Beyanname sorgulama hatası';

        if (e.message === 'TIMEOUT') { errorCode = 'TIMEOUT'; errorMessage = 'Sorgulama zaman aşımına uğradı (5 dk).'; }
        else if (e.message?.startsWith('AUTH_FAILED')) { errorCode = 'AUTH_FAILED'; errorMessage = 'GİB giriş başarısız: ' + e.message.replace('AUTH_FAILED: ', ''); }
        else if (e.message?.startsWith('CAPTCHA_FAILED') || e.message?.startsWith('CAPTCHA_SERVICE_DOWN')) { errorCode = 'CAPTCHA_FAILED'; }
        else if (e.message?.startsWith('GIB_MAINTENANCE')) { errorCode = 'GIB_MAINTENANCE'; errorMessage = 'GİB bakımda.'; }
        else if (e.message?.includes('ECONNREFUSED') || e.message?.includes('network') || e.message?.includes('fetch')) { errorCode = 'NETWORK_ERROR'; }

        wsClient?.send('ebeyanname:query-error', { error: errorMessage, errorCode, customerName, requesterId });
    } finally {
        activeEbeyanQueries.delete(queryKey);
    }
});
```

### Adım 4: Test
- [ ] Electron bot başlat
- [ ] WebSocket üzerinden `ebeyanname:query` gönder
- [ ] Edge case'ler: boş sonuç, tek sayfa, çok sayfa, hatalı beyanname
- [ ] Durum tespiti doğrulaması: ok.gif, err.gif, iptal.gif, wtng.gif

---

## 11. Mevcut Kod Referansları (Satır Numaraları Güncel — 28.02.2026)

| Fonksiyon | Dosya:Satır | İlişki |
|-----------|------------|--------|
| `gibDijitalLogin()` | `earsiv-dijital-api.ts:273-426` | **Import et** (export edilmiş) |
| `GIB_CONFIG` | `bot.ts:17-58` | **Import et** (export edilmiş) |
| `GIB_ERROR_CODES` | `bot.ts:74-103` | **Import et** (export edilmiş) |
| `getEbeyanToken()` | `bot.ts:560-596` | **Kopyala** (private, export DEĞİL) |
| `fetchBeyannamePage()` | `bot.ts:622-891` | **Yeniden yaz** (cheerio ile, private) |
| `BeyannameItem` type | `bot.ts:217-230` | **Referans** (yeni genişletilmiş versiyon oluştur) |
| `safeDecodeOid()` | `bot.ts:863-870` | **Kopyala** (private, inline) |
| `HEADERS` | `bot.ts:61-68` | Sadece `User-Agent` lazım |
| `delay()` | `bot.ts:364-366` | **Kopyala** (basit) |
| `intvrg:beyanname-query` handler | `index.ts:1073-1219` | **Pattern referans** (aynı yapı) |
| `earsiv:query` handler | `index.ts:793-933` | **Pattern referans** (login + progress) |

---

## 12. `queryEbeyannameler` Ana Fonksiyon Akışı

```typescript
export async function queryEbeyannameler(
    params: EbeyanQueryParams,
    onProgress?: (status: string) => void,
    onResults?: (beyannameler: EbeyanBeyannameItem[]) => void,
): Promise<EbeyanQueryResult> {
    // 1. Login
    onProgress?.('GİB Dijital VD\'ye giriş yapılıyor...');
    const dijitalToken = await gibDijitalLogin(
        params.userid, params.password,
        params.captchaApiKey, params.ocrSpaceApiKey,
        onProgress
    );

    // 2. E-Beyanname Token Al
    onProgress?.('E-Beyanname oturumu açılıyor...');
    const ebeyanToken = await getEbeyanToken(dijitalToken);
    if (!ebeyanToken) throw new Error('E-Beyanname token alınamadı');

    await sleep(GIB_CONFIG.RATE_LIMIT.BETWEEN_REQUESTS); // 1800ms

    // 3. İlk sayfayı çek
    onProgress?.('Beyannameler sorgulanıyor...');
    let currentToken = ebeyanToken;
    const searchFilters = {
        vergiNo: params.vergiNo,
        tcKimlikNo: params.tcKimlikNo,
        beyannameTuru: params.beyannameTuru,
    };

    const firstPage = await fetchPage(currentToken, params.baslangicTarihi, params.bitisTarihi, 1, searchFilters);
    currentToken = firstPage.newToken;

    let allRecords = [...firstPage.records];
    const { totalPages, totalRecords } = firstPage;

    onResults?.(firstPage.records);
    onProgress?.(`Sayfa 1/${totalPages} çekildi (${allRecords.length} beyanname)`);

    // 4. Kalan sayfaları sıralı çek
    for (let page = 2; page <= totalPages; page++) {
        await sleep(GIB_CONFIG.RATE_LIMIT.BETWEEN_PAGES); // 1200ms

        const pageResult = await fetchPage(currentToken, params.baslangicTarihi, params.bitisTarihi, page, searchFilters);
        currentToken = pageResult.newToken;
        allRecords.push(...pageResult.records);

        onResults?.(pageResult.records);
        onProgress?.(`Sayfa ${page}/${totalPages} çekildi (toplam: ${allRecords.length} beyanname)`);
    }

    return {
        success: true,
        beyannameler: allRecords,
        totalRecords,
        totalPages,
        ebeyanToken: currentToken,
    };
}
```

---

## 13. cURL Referans (HAR Doğrulanmış)

```bash
# BEYANNAMELISTESI — Sayfa 1
curl "https://ebeyanname.gib.gov.tr/dispatch?_dc=$(date +%s%3N)" \
  -H "Content-Type: application/x-www-form-urlencoded; charset=UTF-8" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: https://ebeyanname.gib.gov.tr" \
  -H "Referer: https://ebeyanname.gib.gov.tr/" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36" \
  --data-raw "cmd=BEYANNAMELISTESI&sorguTipiZ=1&baslangicTarihi=20260101&bitisTarihi=20260131&TOKEN={128hex}"

# BEYANNAMELISTESI — Sayfa 2+
curl "https://ebeyanname.gib.gov.tr/dispatch?_dc=$(date +%s%3N)" \
  -H "Content-Type: application/x-www-form-urlencoded; charset=UTF-8" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: https://ebeyanname.gib.gov.tr" \
  -H "Referer: https://ebeyanname.gib.gov.tr/" \
  --data-raw "cmd=BEYANNAMELISTESI&sorguTipiZ=1&baslangicTarihi=20260101&bitisTarihi=20260131&pageNo=2&TOKEN={128hex}"

# VKN filtreli sorgu
curl "https://ebeyanname.gib.gov.tr/dispatch?_dc=$(date +%s%3N)" \
  -H "Content-Type: application/x-www-form-urlencoded; charset=UTF-8" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Origin: https://ebeyanname.gib.gov.tr" \
  -H "Referer: https://ebeyanname.gib.gov.tr/" \
  --data-raw "cmd=BEYANNAMELISTESI&sorguTipiN=1&vergiNo=6070329890&sorguTipiZ=1&baslangicTarihi=20260101&bitisTarihi=20260131&TOKEN={128hex}"
```

---

## 14. Kontrol Listesi (Uygulama Öncesi)

- [x] HAR ile dispatch API doğrulandı
- [x] HTML tablo yapısı HAR'dan birebir kopyalandı
- [x] 4 durum (ok, err, iptal, wtng) HAR'da doğrulandı
- [x] Pagination yapısı HAR'da doğrulandı (5 sayfa, 25/sayfa, 123 kayıt)
- [x] PDF URL yapısı HAR JavaScript'ten çıkarıldı
- [x] Token akışı HAR'da doğrulandı (ebyn-login → redirect → dispatch)
- [x] Cookie olmadığı doğrulandı — tamamen TOKEN bazlı
- [x] Bot.ts durum değerleri (hata, onay_bekliyor, bilinmiyor) eşleştirildi
- [x] WebSocket handler pattern (intvrg:beyanname-query) analiz edildi
- [x] Tüm import/export durumları kontrol edildi
- [x] Rate limit değerleri bot.ts'den alındı
- [x] safeDecodeOid() güvenlik önlemi eklendi
- [x] 3-katmanlı durum tespiti (bot.ts uyumlu) tasarlandı
- [x] sorguTipiD (durum filtresi) keşfedildi — gelecekte kullanılabilir

---

> **Bu handoff ile yeni context'te doğrudan Adım 1'den başlanabilir.**
>
> Kullanıcıya mesaj:
> ```
> 2026-02-28-ebeyanname-api-optimizasyon-v2.md handoff'una göre uygulamaya başla
> ```
