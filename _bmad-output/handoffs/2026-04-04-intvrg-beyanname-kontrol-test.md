# Handoff: INTVRG Beyanname Kontrol — Test Modülü

**Tarih:** 2026-04-04 19:30
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor

## Görev Tanımı

> Mevcut beyanname-kontrol sayfasındaki (`/dashboard/beyanname-kontrol`) e-beyanname pipeline'ı yerine İnternet Vergi Dairesi (INTVRG) üzerinden beyanname sorgulama ve PDF indirme akışını **test etmek** için ayrı bir sekme/modül oluştur. Mevcut sisteme dokunma, ayrı bir test ortamı kur. Rate limit testi, PDF indirme testi yapılacak.

## Mevcut Sistem (DOKUNMA!)

### Akış

```
1. gibDijitalLogin(username, password, captchaKey, ocrSpaceApiKey) → dijital bearer token
2. getEbeyanToken(dijitalToken) → e-beyanname token (ebeyanname.gib.gov.tr)
3. fetchBeyannamePage(token, startDate, endDate, page) → HTML parse (Cheerio)
   - Endpoint: POST https://ebeyanname.gib.gov.tr/dispatch
   - cmd=BEYANNAMELISTESI
   - sorguTipiZ=1, baslangicTarihi, bitisTarihi, pageNo
   - Response: HTML → Cheerio ile parse → BeyannameItem[]
4. downloadPdf(oid, type, token) → PDF binary
   - Endpoint: GET https://ebeyanname.gib.gov.tr/dispatch?cmd=IMAJ&subcmd=BEYANNAMEGORUNTULE/TAHAKKUKGORUNTULE
5. getMuhsgkDetailPdfs(oid, token) → SGK URL'leri
   - Endpoint: POST https://ebeyanname.gib.gov.tr/dispatch?cmd=THKESASBILGISGKMESAJLARI
   - Response: HTML → regex ile sgkTahakkukGoruntule/sgkHizmetGoruntule URL parse
6. downloadSgkPdf(url, token) → SGK PDF binary
```

### Dosyalar (DOKUNMA!)

| Dosya | İşlev |
|-------|-------|
| `electron-bot/src/main/ebeyanname-api.ts` | E-beyanname pipeline (tüm fonksiyonlar) |
| `electron-bot/src/main/index.ts:473-556` | `bot:start` handler → `runEbeyannamePipeline()` |
| `src/components/kontrol/` | Beyanname kontrol çizelgesi UI |
| `src/components/beyanname-kontrol/` | SmmmAsistanPage (bot kontrol paneli) |
| `src/app/api/gib/sync/route.ts` | Bot başlatma API |

### Rate Limit (e-beyanname)

```typescript
BETWEEN_REQUESTS: 100ms
BETWEEN_PAGES: 1100ms
BETWEEN_DOWNLOADS: 1200ms
```

GİB "İki istek arası en az 1 sn" hatası → retry mekanizması var.

---

## Yeni Sistem (INTVRG — TEST)

### HAR Analizi Sonuçları

HAR dosyası: `c:\Users\msafa\Downloads\intvrg.gib.gov.tr.beyanname.gib.bot.har`
- 109 toplam istek, 11 API çağrısı (dispatch)
- 96 beyanname, 45 benzersiz mükellef, 4 sayfa (25/sayfa)
- Rate limit header: **YOK** — tüm istekler 200 OK

### Token Akışı

```
1. gibDijitalLogin(username, password, captchaKey, ocrSpaceApiKey) → dijital bearer token
2. getIvdToken(bearerToken) → IVD token (intvrg.gib.gov.tr)
   - Fonksiyon zaten var: electron-bot/src/main/intvrg-tahsilat-api.ts:116
   - Import: import { getIvdToken, IntrvrgClient, INTVRG_BASE } from './intvrg-tahsilat-api';
```

### API Endpoint'leri

**Base URL:** `https://intvrg.gib.gov.tr/intvrg_server/dispatch`
**Method:** POST
**Content-Type:** `application/x-www-form-urlencoded; charset=UTF-8`

**Form body format:**
```
cmd={serviceName_methodName}
callid={sessionId}-{counter}
token={ivdToken}
jp={JSON.stringify(params)}
```

**IntrvrgClient zaten bu format'ı implement ediyor** (`intvrg-tahsilat-api.ts:176-205`)

---

### 1. Beyanname Arama: `beyannameService_beyannameAra`

**Request JP parametreleri:**
```json
{
  "arsivde": false,
  "sorguTipiN": 0,
  "vergiNo": "",
  "sorguTipiT": 0,
  "tcKimlikNo": "",
  "sorguTipiB": 0,
  "beyannameTanim": "",
  "sorguTipiP": 0,
  "donemBasAy": "03",
  "donemBasYil": "2026",
  "donemBitAy": "04",
  "donemBitYil": "2026",
  "sorguTipiV": 0,
  "vdKodu": "",
  "sorguTipiZ": 1,
  "tarihAraligi": {
    "baslangicTarihi": "20260201",
    "bitisTarihi": "20260228"
  },
  "sorguTipiD": 1,
  "durum": {
    "radiob": false,
    "radiob1": false,
    "radiob2": true,
    "radiob3": false
  },
  "pageNo": 1
}
```

**sorguTipiZ = 1** → Tarih aralığı filtresi aktif
**sorguTipiD = 1** → Durum filtresi aktif
**durum.radiob2 = true** → Sadece "Onaylandı" (durum=2)
**Tarih formatı:** `donemBasAy/donemBasYil` = dönem, `tarihAraligi` = yükleme tarihi (YYYYMMDD)
**pageNo:** İlk sayfa için parametre eklenmez, 2. sayfadan itibaren `"pageNo": 2`

**Response:**
```json
{
  "data": {
    "data": [
      {
        "beyannameKodu": "KDV1",
        "beyannameTuru": "KDV1_44",
        "durum": "2",
        "tckn": "5050036469",
        "unvan": "İSMET KARACA",
        "vergiDairesi": "060260",
        "donem": "01/2026-01/2026",
        "yuklemezamani": "23.02.2026 - 15:26:26",
        "beyannameOid": "1vmlz4tlvp1fp9",
        "tahakkukOid": "1smlz4o4sm1uol",
        "mesajvar": "0",
        "ihbarnamekesildi": 0,
        "onaylanabilir": "F",
        "subeno": 0
      }
    ],
    "rowcount": 96,
    "page": 1
  }
}
```

**Durum değerleri:**
- `"0"` = Hatalı
- `"1"` = Onay Bekliyor
- `"2"` = Onaylandı
- `"3"` = İptal

**Beyanname kodları (HAR'dan gözlenenler):**
KDV1, KDV2, KDV9015, MUHSGK, GGECICI, KGECICI, DAMGA, KONAKLAMA, TURIZM

**Pagination:**
- 25 kayıt/sayfa
- `rowcount` = toplam kayıt sayısı
- `page` = mevcut sayfa
- Toplam sayfa = Math.ceil(rowcount / 25)

---

### 2. SGK Bildirge Detay: `sgkBildirgeIslemleri_bildirgeleriGetir`

**Request JP:**
```json
{
  "beyannameOid": "1tmlj6o2a91r9k"
}
```

**Response:**
```json
{
  "data": {
    "beyanname_durum": "2",
    "bildirim_sayisi": "6",
    "birsayfadakikayit": "100",
    "baslangicindeksi": "0",
    "bitisindeksi": "6",
    "pageno": "1",
    "beyannameoid": "1tmlj6o2a91r9k",
    "lastpage": "1",
    "arsivde": "0",
    "thkhaberlesme1": {
      "durum": "2",
      "onaylanabilir": "F",
      "aciklama": "Vergi",
      "bynthkoid": "12mlh2j30j1mlv",
      "mesajvar": "0",
      "bynihb": "0",
      "thkoid": "11mlhrwco21hgx",
      "donem": "01/2026-01/2026"
    },
    "thkhaberlesme2": {
      "durum": "2",
      "onaylanabilir": "F",
      "aciklama": "Asıl, TÜM SİG.KOLLARI/YABNC UYR, 05510-Say.Kan.MYO, 01 / 2026, 01011041296060000, Yasal süresinde verilme",
      "bynthkoid": "12mlh2j30j1mlv",
      "mesajvar": "0",
      "bynihb": "0",
      "thkoid": "1fmlhsdccy19xb",
      "donem": "01/2026-01/2026"
    },
    "thkhaberlesme3": { "...aynı yapı..." },
    "thkhaberlesme4": { "...aynı yapı..." },
    "thkhaberlesme5": { "...aynı yapı..." },
    "thkhaberlesme6": { "...aynı yapı..." }
  }
}
```

**Önemli alanlar:**
- `thkhaberlesme1`: Vergi tahakkuku → `thkoid` = beyannameOid (vergi tahakkuk PDF için)
- `thkhaberlesme2+`: SGK bildirge bildirimler → `thkoid` = sgkTahakkukOid (SGK PDF'ler için)
- `bildirim_sayisi`: Toplam thkhaberlesme sayısı
- `aciklama`: "Vergi" olanı vergi tahakkuku, diğerleri SGK bildirgeleri
- Her `thkoid` ile SGK tahakkuk ve hizmet listesi PDF indirilebilir

---

### 3. PDF İndirme URL'leri

**Base URL:** `https://intvrg.gib.gov.tr/intvrg_server/goruntuleme`
**Method:** GET
**Ortak query params:** `cmd=IMAJ&USERID=&inline=true&goruntuTip=1&token={ivdToken}`

#### 3a. Beyanname PDF
```
GET https://intvrg.gib.gov.tr/intvrg_server/goruntuleme
  ?cmd=IMAJ
  &subcmd=BEYANNAMEGORUNTULE
  &beyannameOid={beyannameOid}
  &USERID=
  &inline=true
  &goruntuTip=1
  &token={ivdToken}
```

#### 3b. Vergi Tahakkuk PDF
```
GET https://intvrg.gib.gov.tr/intvrg_server/goruntuleme
  ?cmd=IMAJ
  &subcmd=TAHAKKUKGORUNTULE
  &tahakkukOid={tahakkukOid}
  &beyannameOid={beyannameOid}
  &USERID=
  &inline=true
  &goruntuTip=1
  &token={ivdToken}
```

#### 3c. SGK Hizmet Listesi PDF
```
GET https://intvrg.gib.gov.tr/intvrg_server/goruntuleme
  ?cmd=IMAJ
  &subcmd=SGKHIZMETGORUNTULE
  &sgkTahakkukOid={sgkThkOid}
  &beyannameOid={beyannameOid}
  &USERID=
  &inline=true
  &goruntuTip=1
  &token={ivdToken}
```

#### 3d. SGK Tahakkuk PDF
```
GET https://intvrg.gib.gov.tr/intvrg_server/goruntuleme
  ?cmd=IMAJ
  &subcmd=SGKTAHAKKUKGORUNTULE
  &sgkTahakkukOid={sgkThkOid}
  &USERID=
  &inline=true
  &goruntuTip=1
  &token={ivdToken}
```

#### 3e. SGK Toplu Tahakkuk PDF
```
GET https://intvrg.gib.gov.tr/intvrg_server/goruntuleme
  ?cmd=IMAJ
  &subcmd=PDF_SGK_TOPLU_TAHAKKUK_GORUNTULE
  &thkOidler={virgülle ayrılmış oid listesi}
  &USERID=
  &inline=true
  &goruntuTip=1
  &token={ivdToken}
```

#### 3f. SGK Toplu Mesaj Excel İndir
```
GET https://intvrg.gib.gov.tr/intvrg_server/goruntuleme
  ?cmd=IMAJ
  &subcmd=EXCEL_SGK_TOPLU_MESAJ_INDIR
  &beyannameOid={beyannameOid}
  &USERID=
  &inline=true
  &goruntuTip=1
  &token={ivdToken}
```

#### 3g. Ödeme Planı PDF
```
GET https://intvrg.gib.gov.tr/intvrg_server/goruntuleme
  ?cmd=IMAJ
  &subcmd=EBYNODEMEPLANIGORUNTULE
  &beyOid={beyannameOid}
  &goruntuTip=1
  &token={ivdToken}
  &inline=true
```

---

### Mevcut vs INTVRG Karşılaştırma

| Özellik | Mevcut (ebeyanname) | INTVRG |
|---------|---------------------|--------|
| Token | `getEbeyanToken()` → ebeyanname TOKEN | `getIvdToken()` → IVD token |
| Arama endpoint | `ebeyanname.gib.gov.tr/dispatch` | `intvrg.gib.gov.tr/intvrg_server/dispatch` |
| Arama komutu | `cmd=BEYANNAMELISTESI` | `cmd=beyannameService_beyannameAra` |
| Arama response | HTML (Cheerio parse) | **JSON** |
| Sayfa/kayıt | 25/sayfa | 25/sayfa |
| PDF base URL | `ebeyanname.gib.gov.tr/dispatch` | `intvrg.gib.gov.tr/intvrg_server/goruntuleme` |
| PDF komutu | `cmd=IMAJ&subcmd=...&TOKEN=` | `cmd=IMAJ&subcmd=...&token=` |
| SGK detay | HTML parse (regex) | **JSON** (`sgkBildirgeIslemleri_bildirgeleriGetir`) |
| Rate limit | 1 sn kuralı (SERVERERROR) | **Gözlenmedi** |
| Token parametre adı | `TOKEN` (büyük harf) | `token` (küçük harf) |

---

## Uygulama Planı

### Adım 1: Electron Bot — INTVRG Beyanname Test Modülü

Yeni dosya: `electron-bot/src/main/intvrg-beyanname-kontrol-api.ts`

Bu dosya mevcut `ebeyanname-api.ts`'den **bağımsız** çalışacak.

- [ ] `IntrvrgBeyannameClient` sınıfı oluştur (veya `IntrvrgClient` extend et)
- [ ] `searchBeyannameler(params)` → `beyannameService_beyannameAra` çağır, tüm sayfaları çek
- [ ] `getSgkBildirgeDetail(beyannameOid)` → `sgkBildirgeIslemleri_bildirgeleriGetir` çağır
- [ ] `downloadBeyannamePdf(beyannameOid, token)` → goruntuleme endpoint
- [ ] `downloadTahakkukPdf(tahakkukOid, beyannameOid, token)` → goruntuleme endpoint
- [ ] `downloadSgkTahakkukPdf(sgkThkOid, token)` → goruntuleme endpoint
- [ ] `downloadSgkHizmetPdf(sgkThkOid, beyannameOid, token)` → goruntuleme endpoint
- [ ] `runIntrvrgBeyannamePipeline(options)` → ana pipeline fonksiyonu

**Pipeline akışı:**
```typescript
async function runIntrvrgBeyannamePipeline(options: IntrvrgBotOptions) {
  // 1. Login
  const bearerToken = await gibDijitalLogin(username, password, captchaKey, ocrSpaceApiKey);
  
  // 2. IVD Token
  const ivdToken = await getIvdToken(bearerToken);
  
  // 3. Beyanname Ara (tüm sayfalar)
  const allBeyannameler = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await searchBeyannameler(ivdToken, {
      donemBasAy, donemBasYil, donemBitAy, donemBitYil,
      baslangicTarihi, bitisTarihi,
      durum: { radiob2: true }, // Onaylandı
      pageNo: page
    });
    allBeyannameler.push(...result.data.data);
    totalPages = Math.ceil(result.data.rowcount / 25);
    page++;
  } while (page <= totalPages);
  
  // 4. Her beyanname için PDF indir
  for (const byn of allBeyannameler) {
    // Beyanname PDF
    await downloadBeyannamePdf(byn.beyannameOid, ivdToken);
    
    // Tahakkuk PDF
    await downloadTahakkukPdf(byn.tahakkukOid, byn.beyannameOid, ivdToken);
    
    // MUHSGK → SGK detay
    if (byn.beyannameKodu === 'MUHSGK') {
      const sgkDetail = await getSgkBildirgeDetail(byn.beyannameOid, ivdToken);
      // thkhaberlesme2+ → SGK tahakkuk + hizmet listesi PDF
      for (const key of Object.keys(sgkDetail.data).filter(k => k.startsWith('thkhaberlesme') && k !== 'thkhaberlesme1')) {
        const thk = sgkDetail.data[key];
        await downloadSgkTahakkukPdf(thk.thkoid, ivdToken);
        await downloadSgkHizmetPdf(thk.thkoid, byn.beyannameOid, ivdToken);
      }
    }
  }
}
```

### Adım 2: Electron Bot — WebSocket Handler

`electron-bot/src/main/index.ts`'e yeni handler ekle:

```typescript
// Mevcut bot:start handler'a DOKUNMA!
// Yeni handler ekle:
wsClient.on('bot:start-intvrg-test', async (data: BotCommandData) => {
  await runIntrvrgBeyannamePipeline({
    // ... aynı parametreler
    onProgress: (type, payload) => { wsClient.send('intvrg-test:progress', payload); }
  });
});
```

### Adım 3: Next.js API Route

Yeni dosya: `src/app/api/gib/intvrg-test/route.ts`

- [ ] POST → Bot'a `bot:start-intvrg-test` komutu gönder
- [ ] Mevcut `/api/gib/sync` pattern'ini kopyala ama farklı komut ismi kullan

### Adım 4: Frontend — Test UI

Yeni dosya: `src/components/beyanname-kontrol/intvrg-test-tab.tsx`

`smmm-asistan-page.tsx`'ye yeni bir tab ekle: "INTVRG Test"

Tab içeriği:
- [ ] Tarih aralığı seçici (başlangıç/bitiş)
- [ ] "Senkronizasyonu Başlat" butonu
- [ ] Progress bar + mesaj alanı
- [ ] Sonuç tablosu (bulunan beyannameler)
- [ ] Her beyanname için PDF durumu (indirildiyse boyut, hataysa mesaj)
- [ ] Rate limit istatistikleri (istek sayısı, süre, hata sayısı)
- [ ] SGK detay bilgileri (MUHSGK için)

### Adım 5: WebSocket Mesajları

Server.ts'e yeni mesaj tipleri:

```
intvrg-test:progress → { message, progress, type }
intvrg-test:results → { beyannameler, stats }
intvrg-test:complete → { stats, beyannameler }
intvrg-test:error → { error, errorCode }
```

---

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `electron-bot/src/main/intvrg-beyanname-kontrol-api.ts` | **YENİ DOSYA** | INTVRG beyanname pipeline |
| `electron-bot/src/main/index.ts` | Düzenleme | `bot:start-intvrg-test` handler ekle (~20 satır) |
| `src/app/api/gib/intvrg-test/route.ts` | **YENİ DOSYA** | Test API route |
| `src/components/beyanname-kontrol/intvrg-test-tab.tsx` | **YENİ DOSYA** | Test UI bileşeni |
| `src/components/beyanname-kontrol/smmm-asistan-page.tsx` | Düzenleme | Yeni tab ekle |
| `server.ts` | Düzenleme | WebSocket mesaj routing (~10 satır) |

---

## Mevcut Kullanılabilir Altyapı

### Zaten Var — Doğrudan Kullan

1. **`gibDijitalLogin()`** — `electron-bot/src/main/earsiv-dijital-api.ts`
   - Captcha çözme (OCR.space + ddddocr ONNX)
   - Bearer token döner

2. **`getIvdToken(bearerToken)`** — `electron-bot/src/main/intvrg-tahsilat-api.ts:116`
   - Bearer → IVD token

3. **`IntrvrgClient`** — `electron-bot/src/main/intvrg-tahsilat-api.ts:160`
   - `callDispatch(cmd, jp)` → INTVRG dispatch çağrısı
   - Token, sessionId, callCounter yönetimi
   - Header'lar hazır

4. **`INTVRG_BASE`** — `https://intvrg.gib.gov.tr`

5. **PDF Parser'lar** — Tahakkuk, SGK, KDV parse:
   - `electron-bot/src/main/sgk-parser.ts` — `parseHizmetListesi()`, `parseTahakkukFisi()`
   - `electron-bot/src/main/kdv-parser.ts` — `parseKdvTahakkuk()`
   - `electron-bot/src/main/kdv2-parser.ts` — `parseKdv2Tahakkuk()`
   - `electron-bot/src/main/gecici-vergi-parser.ts` — `parseGeciciVergiTahakkuk()`

### Yeni Yazılacak

1. **Beyanname arama fonksiyonu** — `beyannameService_beyannameAra` çağrısı
2. **SGK bildirge detay fonksiyonu** — `sgkBildirgeIslemleri_bildirgeleriGetir` çağrısı
3. **PDF indirme fonksiyonu** — `goruntuleme` endpoint'i (GET, token query param)
4. **Pipeline fonksiyonu** — Tüm akışı yöneten ana fonksiyon

---

## Veri Mapping (INTVRG → Mevcut BeyannameData)

```typescript
// INTVRG response → BeyannameData (ebeyanname-api.ts:143)
{
  beyannameTuru: item.beyannameKodu,        // "KDV1", "MUHSGK", "GGECICI"
  tcVkn: item.tckn,                          // "5050036469"
  adSoyadUnvan: item.unvan,                  // "İSMET KARACA"
  vergiDairesi: item.vergiDairesi,           // "060260"
  vergilendirmeDonemi: item.donem,           // "01/2026-01/2026"
  yuklemeZamani: item.yuklemezamani,          // "23.02.2026 - 15:26:26"
  oid: item.beyannameOid,                    // "1vmlz4tlvp1fp9"
  tahakkukOid: item.tahakkukOid,             // "1smlz4o4sm1uol"
  tahakkukDurumu: item.durum === "2" ? "onaylandi" : "bekliyor",
}
```

**Beyanname kodu normalizasyonu:**
`beyannameTuru` alanı `KDV1_44` gibi versiyon içerebilir → `beyannameKodu` alanı saf kodu verir (`KDV1`).

---

## Test Senaryoları

### 1. Rate Limit Testi
- Tüm sayfaları arka arkaya çek (delay olmadan)
- HTTP status ve response time'ları logla
- Hata alınırsa delay artır ve tekrar dene

### 2. PDF İndirme Testi
- En az 1 beyanname PDF + 1 tahakkuk PDF indir
- PDF boyutunu ve geçerliliğini kontrol et (%PDF- header kontrolü)
- MUHSGK varsa SGK tahakkuk + hizmet listesi PDF indir

### 3. Token Süresi Testi
- Token ile uzun süre işlem yap, expire olduğunda davranışı gözlemle

### 4. Filtreleme Testi
- Farklı durum filtreleri (onaylanmış, hatalı, tümü)
- Farklı dönem aralıkları

---

## Teknik Notlar

1. **Token parametre adı:** INTVRG'de `token` (küçük harf), e-beyanname'de `TOKEN` (büyük harf)
2. **PDF URL:** INTVRG'de `goruntuleme` endpoint'i, e-beyanname'de `dispatch` endpoint'i
3. **SGK detay:** INTVRG'de JSON API (`sgkBildirgeIslemleri_bildirgeleriGetir`), e-beyanname'de HTML parse
4. **Beyanname arama:** INTVRG'de JSON response, e-beyanname'de HTML (Cheerio)
5. **SGK thkhaberlesme1:** Her zaman "Vergi" tahakkuku (vergi tahakkuk PDF). thkhaberlesme2+ SGK bildirgeleri.
6. **`IntrvrgClient` VKN gerektirir:** Constructor'da `vkn` parametresi var ama beyanname arama için VKN gerekmeyebilir. Boş string gönderilebilir veya mali müşavirin VKN'si kullanılabilir.
7. **`goruntuTip` parametresi:** `1` = inline (tarayıcıda aç), `2` = download. PDF indirmek için `1` yeterli — response binary PDF gelir.
8. **SGK toplu tahakkuk:** `thkOidler` parametresi virgülle ayrılmış OID listesi — birden fazla işyeri olan mükelleflerde tüm tahakkukları tek PDF'te birleştirir.

---

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Ayrı test tab'ı | Mevcut sistemi bozmamak | Mevcut pipeline'ı değiştirmek (riskli) |
| Yeni bot komutu (`bot:start-intvrg-test`) | Mevcut `bot:start` handler'a dokunmamak | Aynı handler'da flag ile ayırmak |
| `IntrvrgClient` kullanmak | Zaten dispatch çağrısı hazır | Sıfırdan fetch yazmak (gereksiz) |
| JSON response | INTVRG JSON dönüyor, parse kolay | HTML parse (gereksiz karmaşıklık) |
| Rate limit delay başta 0 | Test amaçlı — GİB rate'ini ölçmek | Sabit delay koymak (testi anlamsızlaştırır) |

---

## UI Tasarımı

### Tab Yapısı (smmm-asistan-page.tsx'e eklenecek)

Mevcut tablar: Bulunan, Eşleşmeyenler, Taramalar
Yeni tab: **"INTVRG Test"**

### INTVRG Test Tab İçeriği

```
┌─────────────────────────────────────────────────────┐
│ INTVRG Beyanname Test                               │
│                                                     │
│ [Tarih Aralığı: 01.02.2026 - 28.02.2026]          │
│ [Durum: ☑ Onaylandı ☐ Hatalı ☐ Tümü]             │
│ [PDF İndir: ☑ Beyanname ☑ Tahakkuk ☑ SGK]         │
│                                                     │
│ [▶ Testi Başlat]  [⏹ Durdur]                       │
│                                                     │
│ ── İlerleme ──────────────────────────────────────  │
│ ███████████░░░░░░░░░░░░ 45%                        │
│ Sayfa 2/4 çekiliyor... (50 beyanname bulundu)      │
│                                                     │
│ ── İstatistikler ─────────────────────────────────  │
│ │ Toplam İstek: 8  │ Başarılı: 8  │ Hata: 0  │    │
│ │ Toplam Süre: 2.3s │ Ort. Response: 280ms    │    │
│ │ Rate Limit: Yok    │ Token Durumu: Aktif     │    │
│                                                     │
│ ── Sonuçlar (96 beyanname) ─────────────────────── │
│ │ # │ Tür    │ VKN/TCK    │ Ünvan        │ Dönem │ │
│ │ 1 │ KDV1   │ 5050036469 │ İSMET KARACA │ 01/26 │ │
│ │ 2 │ MUHSGK │ 5050036469 │ İSMET KARACA │ 01/26 │ │
│ │ ...                                              │ │
│                                                     │
│ ── PDF Test Sonuçları ─────────────────────────── │
│ │ VKN        │ Tür    │ Beyanname │ Tahakkuk │ SGK │ │
│ │ 5050036469 │ KDV1   │ ✅ 45KB   │ ✅ 32KB  │ -  │ │
│ │ 5050036469 │ MUHSGK │ ✅ 28KB   │ ✅ 15KB  │ ✅ │ │
│                                                     │
└─────────────────────────────────────────────────────┘
```
