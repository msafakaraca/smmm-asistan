# Handoff: E-Beyanname Bot — Puppeteer'dan HTTP API'ye Geçiş
**Tarih:** 2026-03-01 23:00
**Durum:** Tamamlandı

## Görev Tanımı
> Mevcut `bot.ts` (2053 satır) monolitik e-beyanname botunu pasife alıp, yerine bağımsız `ebeyanname-api.ts` modülü yazmak. Beyanname sorgulama (regex → Cheerio), PDF indirme, PDF parse, batch gönderme — tüm pipeline tek yeni modülde. `index.ts`'deki `bot:start` handler yeni modüle yönlendirilecek. Server.ts, process-results API, kontrol sayfası, frontend — HİÇBİRİ DEĞİŞMEYECEK.

---

## 1. Mevcut Mimari (Değişmeyecek Katmanlar)

```
Kontrol Sayfası (kontrol-page.tsx)
  → useBotConnection.startBot()
    → POST /api/gib/sync
      → server.ts → broadcastToTenant('bot:start', data)
        → Electron Bot (index.ts) → bot:start handler
          → [ESKİ: runElectronBot()] → [YENİ: runEbeyannamePipeline()]
            → onProgress('batch-results', payload)
              → server.ts bot:batch-results handler
                → POST /api/gib/process-results (PDF kayıt + DB güncelle)
                → POST /api/beyanname-takip/sync
                → broadcast 'bot:batch-processed'
            → onProgress('complete', stats)
              → GlobalBotListener → BotResultContext → UI güncelle
```

**Değişmeyen dosyalar (DOKUNMA!):**
- `server.ts` — bot:batch-results handler (satır 234-378)
- `src/app/api/gib/process-results/route.ts` — PDF kayıt + DB update (1332 satır)
- `src/app/api/gib/sync/route.ts` — Bot başlatma
- `src/app/api/gib/pre-downloaded/route.ts` — Zaten indirilmiş kontrol
- `src/app/api/beyanname-takip/sync/route.ts` — Sync
- `src/components/kontrol/*` — Tüm kontrol sayfası
- `src/components/global-bot-listener.tsx` — WebSocket listener

---

## 2. Değişecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `electron-bot/src/main/ebeyanname-api.ts` | **YENİ** | Ana pipeline modülü (~800-1000 satır) |
| `electron-bot/src/main/index.ts` | **Düzenleme** | Satır 275-354: `bot:start` handler güncelle |
| `electron-bot/package.json` | **Düzenleme** | `cheerio` bağımlılığı ekle |

**Pasife alınacak (silinmeyecek, import kaldırılacak):**
- `electron-bot/src/main/bot.ts` — Artık hiçbir yerden import edilmeyecek

---

## 3. Mevcut bot.ts Analizi — Yeni Modüle Taşınacaklar

### 3.1 Login (earsiv-dijital-api.ts'den import)

bot.ts kendi `dijitalGibLogin()` fonksiyonunu içeriyor (satır 502-558) ama `earsiv-dijital-api.ts`'deki `gibDijitalLogin()` daha gelişmiş (OCR.space primary + 2Captcha fallback). **Yeni modül `earsiv-dijital-api.ts`'deki `gibDijitalLogin()`'i kullanacak.**

```typescript
// earsiv-dijital-api.ts'den import
import { gibDijitalLogin } from './earsiv-dijital-api';
```

### 3.2 getEbeyanToken (bot.ts:560-596 → kopyalanacak)

```typescript
async function getEbeyanToken(dijitalToken: string): Promise<string | null> {
    // 1. GET dijital.gib.gov.tr/apigateway/auth/tdvd/ebyn-login
    //    Header: Authorization: Bearer {dijitalToken}
    // 2. Response: { redirectUrl: "https://ebeyanname.gib.gov.tr/dispatch?cmd=LOGIN&TOKEN=xxx" }
    // 3. TOKEN parse: redirectUrl.match(/TOKEN=([^&]+)/)
    // 4. Session aktivasyonu: GET redirectUrl (ZORUNLU! Yapılmazsa dispatch çalışmaz)
    // 5. Return: 128-char hex token
}
```

**Endpoint:** `https://dijital.gib.gov.tr/apigateway/auth/tdvd/ebyn-login`
**Token format:** 128 karakter hex string, büyük harf `TOKEN` parametresi

### 3.3 fetchBeyannamePage (bot.ts:622-891 → Cheerio ile yeniden yazılacak)

**Mevcut:** Regex ile HTML parse — kırılgan, karmaşık, 270 satır
**Yeni:** Cheerio ile CSS selector — dayanıklı, temiz, ~100 satır

**Dispatch API:**
```
POST https://ebeyanname.gib.gov.tr/dispatch?_dc={Date.now()}
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
X-Requested-With: XMLHttpRequest
Origin: https://ebeyanname.gib.gov.tr
Referer: https://ebeyanname.gib.gov.tr/dispatch?cmd=LOGIN&TOKEN={token}

Body: cmd=BEYANNAMELISTESI&sorguTipiZ=1&baslangicTarihi={YYYYMMDD}&bitisTarihi={YYYYMMDD}&TOKEN={token}
```

**Filtre parametreleri:**
- `sorguTipiN=1&vergiNo={vkn}` — VKN filtre
- `sorguTipiT=1&tcKimlikNo={tck}` — TCK filtre
- `sorguTipiB=1&beyannameTanim={tur}` — Beyanname türü filtre
- `pageNo={n}` — Sayfa (2+ için)

**Response XML envelope:**
```xml
<SERVICERESULT>
    <TOKEN>{güncel-token}</TOKEN>
    <SERVERERROR></SERVERERROR>
    <EYEKSERROR></EYEKSERROR>
    <HTMLCONTENT>...HTML tablo...</HTMLCONTENT>
</SERVICERESULT>
```

**Cheerio parse stratejisi:**
```typescript
import * as cheerio from 'cheerio';

function parseBeyannamePage(html: string) {
    const $ = cheerio.load(html);

    // Pagination: "1 - 25 / 123"
    const pageInfo = $('font[size="2"]').text();
    const pageMatch = pageInfo.match(/(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)/);
    const totalRecords = pageMatch ? parseInt(pageMatch[3]) : 0;
    const totalPages = Math.ceil(totalRecords / 25);

    // Satırlar
    const records = [];
    $('tr[id^="row"]').each((_, row) => {
        const $row = $(row);
        const oid = $row.attr('id')?.replace('row', '') || '';
        const tds = $row.find('> td');

        // Durum ikonu
        const durumImg = $row.find('td[id^="durumTD"] img').attr('src') || '';
        const durumKey = durumImg.split('/').pop() || '';
        const statusMap = { 'ok.gif': 'onaylandi', 'err.gif': 'hata', 'iptal.gif': 'iptal', 'wtng.gif': 'onay_bekliyor' };

        // Tahakkuk OID
        const thkOnclick = $row.find('td[id^="thkPDF"] img').attr('onclick') || '';
        const thkMatch = thkOnclick.match(/tahakkukGoruntule\('[^']+','([^']+)'/);

        records.push({
            oid,
            beyannameTuru: normalizeBeyannameTuru(tds.eq(1).text().trim()),
            vknTckn: tds.eq(2).text().trim(),         // .trim() zorunlu (başta \n + boşluk var)
            unvan: tds.eq(3).attr('title') || tds.eq(3).text().trim(),  // title'da tam unvan
            vergiDairesi: tds.eq(4).text().trim(),
            donem: tds.eq(5).text().trim(),            // "01/2026-01/2026"
            subeNo: tds.eq(6).text().trim(),
            yuklemeZamani: tds.eq(7).text().trim(),    // "03.01.2026 - 13:43:12"
            durum: statusMap[durumKey] || 'bilinmiyor',
            tahakkukOid: thkMatch ? thkMatch[1] : null,
            hasBeyPdf: $row.find('td[id^="bynPDF"] img').length > 0,
            hasThkPdf: $row.find('td[id^="thkPDF"] img').length > 0,
            hasSgkDetay: $row.find('img[src*="tick_kontrol"]').length > 0,
        });
    });

    return { records, totalRecords, totalPages };
}
```

### 3.4 downloadPdf (bot.ts:897-1025 → kopyalanacak)

```typescript
async function downloadPdf(
    beyannameOid: string,
    type: 'beyanname' | 'tahakkuk',
    token: string,
    tahakkukOid?: string,
    maxRetries = 3
): Promise<string | null>  // base64 string veya null
```

**URL yapısı:**
```
GET https://ebeyanname.gib.gov.tr/dispatch?_dc={ts}&cmd=IMAJ&subcmd={SUBCMD}&beyannameOid={oid}&goruntuTip=1&inline=true&TOKEN={token}

SUBCMD:
- BEYANNAMEGORUNTULE (beyanname PDF)
- TAHAKKUKGORUNTULE (tahakkuk PDF — ek param: &tahakkukOid={thkOid})
```

**Response işleme:**
1. Content-Type `application/pdf` veya `octet-stream` → direkt binary
2. XML `<PDFFILE>{base64}</PDFFILE>` → base64 içerik
3. `<EYEKSERROR>` veya `<SERVERERROR>` → hata
4. Validasyon: `base64.length > 1000`

**Adaptive Backoff:**
```typescript
// HTTP 500 alındığında:
if (response.status === 500) {
    consecutiveHttp500Count++;
    if (consecutiveHttp500Count >= CONSECUTIVE_500_THRESHOLD) {
        await delay(BIG_COOLDOWN);      // 8000ms
        currentDelay = MAX_DELAY;        // 2500ms
    } else {
        await delay(COOLDOWN_AFTER_500); // 5000ms
        currentDelay = Math.min(currentDelay + 500, MAX_DELAY);
    }
}
// Başarılı istek → reset
if (success) {
    consecutiveHttp500Count = 0;
    currentDelay = BETWEEN_DOWNLOADS;
}
```

### 3.5 getMuhsgkDetailPdfs (bot.ts:1027-1137 → Cheerio ile yeniden yazılacak)

```typescript
async function getMuhsgkDetailPdfs(beyannameOid: string, token: string): Promise<MuhsgkDetailPdfs>
```

**Dispatch çağrısı:**
```
POST /dispatch?_dc={ts}
Body: cmd=THKESASBILGISGKMESAJLARI&beyannameOid={oid}&TOKEN={token}
```

**Cheerio ile parse:**
```typescript
const $ = cheerio.load(htmlContent);
const sgkTahakkukUrls: string[] = [];
const hizmetListesiUrls: string[] = [];

// SGK Tahakkuk PDF linkleri
$('img[onclick*="sgkTahakkukGoruntule"]').each((_, img) => {
    const onclick = $(img).attr('onclick') || '';
    // onclick: sgkTahakkukGoruntule('bynOid', 'sgkOid', false, false)
    const match = onclick.match(/sgkTahakkukGoruntule\('([^']+)',\s*'([^']+)'/);
    if (match) {
        sgkTahakkukUrls.push(
            `${DISPATCH}?cmd=IMAJ&subcmd=SGKTAHAKKUKGORUNTULE&beyannameOid=${match[1]}&sgkTahakkukOid=${match[2]}&inline=true&TOKEN=__TOKEN__`
        );
    }
});

// Hizmet Listesi PDF linkleri
$('img[onclick*="sgkHizmetGoruntule"]').each((_, img) => {
    const onclick = $(img).attr('onclick') || '';
    const match = onclick.match(/sgkHizmetGoruntule\('([^']+)',\s*'([^']+)'/);
    if (match) {
        hizmetListesiUrls.push(
            `${DISPATCH}?cmd=IMAJ&subcmd=SGKHIZMETGORUNTULE&beyannameOid=${match[1]}&sgkTahakkukOid=${match[2]}&inline=true&TOKEN=__TOKEN__`
        );
    }
});
```

### 3.6 downloadSgkPdf (bot.ts:1139-1272 → kopyalanacak)

downloadPdf ile aynı mantık, URL'deki `__TOKEN__` placeholder'ı gerçek token ile değiştirilir.

### 3.7 Pre-Download Check (bot.ts:1278-1317 → kopyalanacak)

```typescript
async function getPreDownloadedCustomers(apiToken: string, year: number, month: number): Promise<Map<string, PreDownloadCheck>>
// GET {serverUrl}/api/gib/pre-downloaded?year={y}&month={m}
// Returns Map<"vkn_beyannameTuru", { downloadedTypes: Set<string> }>
// downloadedTypes: "BEYANNAME", "TAHAKKUK", "SGK_TAHAKKUK", "HIZMET_LISTESI"
```

### 3.8 PDF Parse Fonksiyonları (mevcut parser dosyalarından import)

Parser dosyaları **zaten ayrı modüllerde** — bot.ts sadece import edip kullanıyor. Yeni modül de aynı import'ları yapacak:

```typescript
import { parseHizmetListesi, parseTahakkukFisi } from './sgk-parser';
import { parseKdvTahakkuk } from './kdv-parser';
import { parseKdv2Tahakkuk } from './kdv2-parser';
import { parseKdv9015Tahakkuk } from './kdv9015-parser';
import { parseGeciciVergiTahakkuk } from './gecici-vergi-parser';
```

**Parse mantığı (bot.ts:1691-1907):**
```typescript
// KDV1 tahakkuk parse
if (beyanname.tahakkukBuffer && beyanname.beyannameTuru === 'KDV1') {
    beyanname.kdvTahakkukParsed = await parseKdvTahakkuk(beyanname.tahakkukBuffer);
}
// KDV2
if (beyanname.tahakkukBuffer && beyanname.beyannameTuru === 'KDV2') {
    beyanname.kdv2TahakkukParsed = await parseKdv2Tahakkuk(beyanname.tahakkukBuffer);
}
// KDV9015
if (beyanname.tahakkukBuffer && beyanname.beyannameTuru === 'KDV9015') {
    beyanname.kdv9015TahakkukParsed = await parseKdv9015Tahakkuk(beyanname.tahakkukBuffer);
}
// GGECICI / KGECICI
if (beyanname.tahakkukBuffer && ['GGECICI', 'KGECICI'].includes(beyanname.beyannameTuru)) {
    beyanname.geciciVergiTahakkukParsed = await parseGeciciVergiTahakkuk(beyanname.tahakkukBuffer);
}
// MUHSGK SGK Tahakkuk
for (const sgkBuf of beyanname.sgkTahakkukBuffers || []) {
    sgkBuf.parsed = await parseTahakkukFisi(sgkBuf.buffer);
}
// MUHSGK Hizmet Listesi
for (const hizBuf of beyanname.sgkHizmetBuffers || []) {
    hizBuf.parsed = await parseHizmetListesi(hizBuf.buffer);
}
```

### 3.9 Yardımcı Fonksiyonlar (bot.ts'den kopyalanacak)

```typescript
// bot.ts:383-404
const BEYANNAME_TYPE_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
    { code: 'KDV9015', pattern: /KDV.*9015|KDV9015|TEVK[İI]FAT.*M[ÜU]KELLEF/i },
    { code: 'KDV1', pattern: /KDV.*1|KDV1/i },
    { code: 'KDV2', pattern: /KDV.*2|KDV2/i },
    { code: 'MUHSGK', pattern: /MUHSGK|MUHTASAR|SGK/i },
    { code: 'GV', pattern: /GEL[İI]R.*VERG[İI]S[İI]|^GV$/i },
    { code: 'GGECICI', pattern: /GEL[İI]R.*GE[ÇC][İI]C[İI]|GVG|GGEC/i },
    { code: 'KV', pattern: /KURUMLAR.*VERG[İI]S[İI]|^KV$/i },
    { code: 'KGECICI', pattern: /KURUMLAR.*GE[ÇC][İI]C[İI]|KVG|KGEC/i },
    { code: 'BABS', pattern: /BA.*BS|BABS/i },
    { code: 'DAMGA', pattern: /DAMGA/i },
];

function normalizeBeyannameTuru(beyannameTuru: string): string { ... }
function calculateBeyannameDonem(searchDate: Date, beyannameTuru: string): { year, month } { ... }

const GIB_BEYANNAME_TANIM_MAP: Record<string, string> = {
    'KDV1': 'KDV1', 'KDV2': 'KDV2', 'KDV9015': 'KDV9015',
    'MUHSGK': 'MUHSGK', 'GGECICI': 'GGECICI', 'KGECICI': 'KGECICI',
    'GELIR': 'GELIR', 'KURUMLAR': 'KURUMLAR', 'DAMGA': 'DAMGA',
    'POSET': 'POSET', 'KONAKLAMA': 'KONAKLAMA', 'TURIZM': 'TURIZM',
};
```

### 3.10 Error Codes (bot.ts:74-151 → kopyalanacak)

Tüm `GIB_ERROR_CODES`, `detectErrorCode()`, `createGibError()` fonksiyonları aynen taşınacak.

### 3.11 Types (bot.ts:153-254 → kopyalanacak)

`BeyannameData`, `BotOptions`, `BeyannameItem`, `PaginationInfo`, `MuhsgkDetailPdfs`, `PreDownloadedCustomer`, `PreDownloadCheck` — tüm interface'ler aynen.

---

## 4. batch-results Payload Formatı (KRİTİK — process-results uyumu)

`server.ts:234-378` ve `process-results/route.ts` bu formatı bekliyor:

```typescript
onProgress('batch-results', {
    tenantId: string,
    startDate: string,
    beyannameler: BeyannameData[]  // Aşağıdaki yapı
});
```

**BeyannameData yapısı (process-results'ın beklediği):**
```typescript
{
    beyannameTuru: string,        // "KDV1", "MUHSGK" vb.
    tcVkn: string,                // VKN veya TCK (10-11 hane)
    adSoyadUnvan: string,         // Tam unvan
    vergiDairesi: string,
    vergilendirmeDonemi: string,  // "01/2026-01/2026"
    yuklemeZamani: string,        // "03.01.2026 - 13:43:12"
    oid: string,
    tahakkukOid: string | null,
    success: boolean,             // true = PDF indirildi, "verildi" yap

    // PDF base64 buffer'ları
    beyannameBuffer: string | null,
    tahakkukBuffer: string | null,
    sgkTahakkukBuffers: Array<{ buffer: string; index: number; parsed?: TahakkukFisiParsed }> | undefined,
    sgkHizmetBuffers: Array<{ buffer: string; index: number; parsed?: HizmetListesiParsed }> | undefined,

    // Eski tek-dosya alanları (uyumluluk)
    sgkTahakkukBuffer: string | undefined,
    sgkHizmetBuffer: string | undefined,

    // Parse sonuçları
    kdvTahakkukParsed: KdvTahakkukParsed | undefined,
    kdv2TahakkukParsed: Kdv2TahakkukParsed | undefined,
    kdv9015TahakkukParsed: Kdv9015TahakkukParsed | undefined,
    geciciVergiTahakkukParsed: GeciciVergiTahakkukParsed | undefined,
    sgkTahakkukParsed: TahakkukFisiParsed | undefined,    // İlk dosyanın parsed'ı
    sgkHizmetParsed: HizmetListesiParsed | undefined,     // İlk dosyanın parsed'ı

    // SGK Toplamlar
    sgkTahakkukToplam: { isciSayisi: number; netTutar: number; gunSayisi: number; dosyaSayisi: number } | undefined,
    sgkHizmetToplam: { isciSayisi: number; dosyaSayisi: number } | undefined,
}
```

---

## 5. complete Payload Formatı

```typescript
onProgress('complete', {
    stats: {
        total: number,         // Toplam beyanname sayısı
        pages: number,         // Toplam sayfa sayısı
        downloaded: number,    // İndirilen PDF sayısı
        skipped: number,       // Atlanan (onaysız/hatalı)
        failed: number,        // Başarısız indirme
        preSkipped: number,    // Zaten indirilmiş (skip)
        newCustomers: number,  // Yeni müşteri
        duration: string,      // "2m 34s" formatı
        // Durum dağılımı
        durumStats: {
            onaylandi: number,
            hata: number,
            iptal: number,
            onay_bekliyor: number,
            bilinmiyor: number,
        },
    },
    beyannameler: BeyannameData[],  // Tüm sonuçlar
});
```

---

## 6. runEbeyannamePipeline — Ana Orchestrator

### 6.1 Fonksiyon İmzası

```typescript
export async function runEbeyannamePipeline(options: BotOptions): Promise<void>
```

`BotOptions` aynen bot.ts'deki gibi:
```typescript
export interface BotOptions {
    tenantId?: string;
    username: string;       // GİB kodu
    password: string;       // GİB şifresi
    parola?: string;
    captchaKey?: string;    // 2Captcha API key
    startDate: string;      // "20260101"
    endDate: string;        // "20260131"
    donemBasAy?: number;
    donemBasYil?: number;
    donemBitAy?: number;
    donemBitYil?: number;
    downloadFiles?: boolean;
    token?: string;         // Internal API token (pre-download için)
    vergiNo?: string;       // VKN filtre
    tcKimlikNo?: string;    // TCK filtre
    beyannameTuru?: string; // Tür filtre
    onProgress: (type: string, data: any) => void;
}
```

### 6.2 Pipeline Akışı (bot.ts:1323-2053 mantığı)

```
1. Reset: botShouldStop=false, resetRateLimitState()
2. Stats objesi oluştur
3. Pre-download check: getPreDownloadedCustomers(token, year, month)
4. Captcha key kontrol (yoksa hata)

5. LOGIN (max 5 deneme):
   for (let attempt = 1; attempt <= MAX_CAPTCHA_RETRIES; attempt++) {
       const dijitalToken = await gibDijitalLogin(username, password, captchaKey);
       if (dijitalToken) break;
       // Captcha hatası → retry
   }

6. E-BEYANNAME TOKEN:
   const ebeyanToken = await getEbeyanToken(dijitalToken);

7. BEYANNAME SORGU (tüm sayfalar):
   let currentToken = ebeyanToken;
   let allBeyannameler = [];
   // Sayfa 1
   const page1 = await fetchBeyannamePage(currentToken, params, 1);
   currentToken = page1.newToken || currentToken;  // Token güncelle!
   allBeyannameler.push(...page1.records);
   // Sayfa 2+
   for (let p = 2; p <= page1.totalPages; p++) {
       await delay(BETWEEN_PAGES);  // 1200ms
       const pageN = await fetchBeyannamePage(currentToken, params, p);
       currentToken = pageN.newToken || currentToken;
       allBeyannameler.push(...pageN.records);
   }

8. FİLTRELE: Sadece durum === 'onaylandi' olanları al
   const approved = allBeyannameler.filter(b => b.durum === 'onaylandi');
   // Durum istatistikleri logla

9. PDF İNDİRME LOOP:
   const BATCH_SIZE = 5;
   let batch: BeyannameData[] = [];

   for (const item of approved) {
       checkIfStopped();

       // Pre-download skip check
       const preKey = `${item.vknTckn}_${item.beyannameTuru}`;
       const preData = preDownloaded.get(preKey);
       if (preData?.downloadedTypes.has('BEYANNAME') && preData?.downloadedTypes.has('TAHAKKUK')) {
           beyanname.success = true;  // BeyannameTakip güncellenmesi için
           batch.push(beyanname);
           stats.preSkipped++;
           continue;
       }

       // a) Beyanname PDF indir
       const beyPdf = await downloadPdf(item.oid, 'beyanname', currentToken);
       if (beyPdf) beyanname.beyannameBuffer = beyPdf;
       await delay(BETWEEN_DOWNLOADS);

       // b) Tahakkuk PDF indir (varsa)
       if (item.tahakkukOid) {
           const thkPdf = await downloadPdf(item.oid, 'tahakkuk', currentToken, item.tahakkukOid);
           if (thkPdf) {
               beyanname.tahakkukBuffer = thkPdf;
               // Parse tahakkuk
               if (item.beyannameTuru === 'KDV1') beyanname.kdvTahakkukParsed = await parseKdvTahakkuk(thkPdf);
               if (item.beyannameTuru === 'KDV2') beyanname.kdv2TahakkukParsed = await parseKdv2Tahakkuk(thkPdf);
               if (item.beyannameTuru === 'KDV9015') beyanname.kdv9015TahakkukParsed = await parseKdv9015Tahakkuk(thkPdf);
               if (['GGECICI','KGECICI'].includes(item.beyannameTuru)) beyanname.geciciVergiTahakkukParsed = await parseGeciciVergiTahakkuk(thkPdf);
           }
           await delay(BETWEEN_DOWNLOADS);
       }

       // c) MUHSGK SGK PDF'leri
       if (item.beyannameTuru === 'MUHSGK' && item.hasSgkDetay) {
           const detail = await getMuhsgkDetailPdfs(item.oid, currentToken);
           // SGK Tahakkuk PDF'leri
           for (let i = 0; i < detail.sgkTahakkukUrls.length; i++) {
               const sgkPdf = await downloadSgkPdf(detail.sgkTahakkukUrls[i], currentToken);
               if (sgkPdf) {
                   const parsed = await parseTahakkukFisi(sgkPdf);
                   beyanname.sgkTahakkukBuffers.push({ buffer: sgkPdf, index: i + 1, parsed });
               }
               await delay(BETWEEN_DOWNLOADS);
           }
           // Hizmet Listesi PDF'leri
           for (let i = 0; i < detail.hizmetListesiUrls.length; i++) {
               const hizPdf = await downloadSgkPdf(detail.hizmetListesiUrls[i], currentToken);
               if (hizPdf) {
                   const parsed = await parseHizmetListesi(hizPdf);
                   beyanname.sgkHizmetBuffers.push({ buffer: hizPdf, index: i + 1, parsed });
               }
               await delay(BETWEEN_DOWNLOADS);
           }
           // Toplam hesapla
           beyanname.sgkTahakkukToplam = { isciSayisi, netTutar, gunSayisi, dosyaSayisi };
           beyanname.sgkHizmetToplam = { isciSayisi, dosyaSayisi };
           // İlk dosyayı eski alanlara da yaz (uyumluluk)
           beyanname.sgkTahakkukBuffer = sgkTahakkukBuffers[0]?.buffer;
           beyanname.sgkHizmetBuffer = sgkHizmetBuffers[0]?.buffer;
           beyanname.sgkTahakkukParsed = sgkTahakkukBuffers[0]?.parsed;
           beyanname.sgkHizmetParsed = sgkHizmetBuffers[0]?.parsed;
       }

       // d) Success flag
       beyanname.success = !!(beyanname.beyannameBuffer || beyanname.tahakkukBuffer);
       batch.push(beyanname);

       // e) Batch gönder (her 5'te bir)
       if (batch.length >= BATCH_SIZE) {
           onProgress('batch-results', { tenantId, startDate, beyannameler: batch });
           batch = [];
       }
   }

   // Son batch'i gönder
   if (batch.length > 0) {
       onProgress('batch-results', { tenantId, startDate, beyannameler: batch });
   }

10. COMPLETE:
    onProgress('complete', { stats, beyannameler: allResults });
```

---

## 7. index.ts Değişikliği (Satır 275-354)

### 7.1 Mevcut Kod (satır 1-13 imports + satır 275-354)

```typescript
// Satır 1-2 (mevcut import)
import { runElectronBot, stopBot, resetBotStopFlag, BotOptions } from './bot';

// Satır 275
wsClient.on('bot:start', async (data: BotCommandData) => {
    // ...
    await runElectronBot({ ... });
});

// Satır 356-370
wsClient.on('bot:stop', () => {
    stopBot();
    // ...
});
```

### 7.2 Yeni Kod

```typescript
// Import değişikliği
import { runEbeyannamePipeline, stopBot, resetBotStopFlag, BotOptions } from './ebeyanname-api';
// NOT: bot.ts import'u tamamen kaldırılacak

// bot:start handler — aynı yapı, sadece fonksiyon adı değişiyor
wsClient.on('bot:start', async (data: BotCommandData) => {
    console.log('[MAIN] 🚀 BOT:START - E-Beyanname HTTP API Pipeline Başlatılıyor');
    // ... (onProgress callback AYNEN kalacak, satır 299-325)

    await runEbeyannamePipeline({
        tenantId: data.tenantId as string,
        username: data.username as string,
        password: data.password as string,
        parola: data.parola as string,
        startDate: data.startDate as string,
        endDate: data.endDate as string,
        captchaKey: captchaApiKey,
        token: session?.token,
        vergiNo: data.vergiNo as string | undefined,
        tcKimlikNo: data.tcKimlikNo as string | undefined,
        beyannameTuru: data.beyannameTuru as string | undefined,
        onProgress
    });
});

// bot:stop — stopBot yeni modülden gelecek
wsClient.on('bot:stop', () => {
    stopBot();
    // ...
});
```

---

## 8. Cheerio Kurulumu

```bash
cd electron-bot && npm install cheerio
```

`cheerio` zaten TypeScript types içeriyor, `@types/cheerio` gerekmez.

---

## 9. GIB_CONFIG (ebeyanname-api.ts'e taşınacak)

```typescript
export const GIB_CONFIG = {
    DIJITAL_GIB: {
        CAPTCHA: 'https://dijital.gib.gov.tr/apigateway/captcha/getnewcaptcha',
        LOGIN: 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/login',
        EBYN_LOGIN: 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/ebyn-login',
    },
    EBEYANNAME: {
        DISPATCH: 'https://ebeyanname.gib.gov.tr/dispatch',
    },
    RATE_LIMIT: {
        BETWEEN_REQUESTS: 1800,
        BETWEEN_PAGES: 1200,
        BETWEEN_DOWNLOADS: 1800,
        BASE_RETRY_WAIT: 2000,
        COOLDOWN_AFTER_500: 5000,
        MAX_DELAY: 2500,
        CONSECUTIVE_500_THRESHOLD: 2,
        BIG_COOLDOWN: 8000,
        RETRY_WAIT: 2000,
        RETRY_MAX_WAIT: 8000,
    },
    TIMEOUTS: {
        HTTP_REQUEST: 30000,
        CAPTCHA_SOLVE: 60000,
    },
    MAX_RETRIES: 3,
    MAX_CAPTCHA_RETRIES: 5,
    MAX_PAGE_RETRIES: 20,
};
```

---

## 10. HTTP Headers (ebeyanname dispatch için)

```typescript
// Dijital GİB login headers (bot.ts:56-68)
const DIJITAL_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Language': 'tr-TR,tr;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Origin': 'https://dijital.gib.gov.tr',
    'Referer': 'https://dijital.gib.gov.tr/portal/login',
};

// E-Beyanname dispatch headers (HAR'dan)
const EBEYANNAME_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Accept': '*/*',
    'Accept-Language': 'tr-TR,tr;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Origin': 'https://ebeyanname.gib.gov.tr',
    'X-Requested-With': 'XMLHttpRequest',
};

// Referer her istekte dinamik:
// `https://ebeyanname.gib.gov.tr/dispatch?cmd=LOGIN&TOKEN=${token}`
```

---

## 11. Edge Case'ler ve Dikkat Noktaları

### 11.1 Token Zinciri
Her dispatch response'da `<TOKEN>` gelir. Bu token bir sonraki istekte kullanılmalı. Token değişmezse aynı token devam eder, ama güncellenirse yenisi kullanılmalı.

### 11.2 Aynı Mükellef Birden Fazla Beyanname
Aynı VKN+Tür+Dönem için birden fazla satır olabilir (hatalı gönderimler sonrası düzeltme). `process-results` API mükerrer kontrolü yapıyor, bot tarafında ek filtre gerekmez.

### 11.3 Pre-Download Skip Mantığı
Skip edilen beyanname hâlâ `success=true` olarak batch'e eklenmeli ki `process-results` API BeyannameTakip'i "verildi" olarak güncelleyebilsin. Sadece PDF buffer'ları null olacak.

### 11.4 downloadFiles=false Durumu
`BotOptions.downloadFiles` false ise sadece sorgu yapılıp durum bilgisi dönmeli, PDF indirme atlanmalı. Bu durumda tüm approved beyannameler `success=true` ama buffer'lar null olarak gönderilir.

### 11.5 VKN/TCK Temizleme
E-Beyanname HTML'de VKN/TCK hücresinde `\n` ve baştaki boşluklar var. `.trim()` zorunlu.

### 11.6 Unvan
Kısa unvan `<td>` text'inde, **tam unvan `title` attribute'unda.** `$(td).attr('title')` kullan.

### 11.7 Bot Stop Mekanizması
`stopBot()` ve `checkIfStopped()` fonksiyonları yeni modülde de olmalı. Her PDF indirme öncesi kontrol edilmeli.

---

## 12. Dosya Yapısı Özeti

```
electron-bot/src/main/
├── ebeyanname-api.ts          ← YENİ (bu handoff'un konusu)
├── earsiv-dijital-api.ts      ← import: gibDijitalLogin (DEĞİŞMEZ)
├── index.ts                   ← bot:start handler güncelle
├── bot.ts                     ← PASİFE ALINACAK (import kaldır)
├── sgk-parser.ts              ← import: parseTahakkukFisi, parseHizmetListesi (DEĞİŞMEZ)
├── kdv-parser.ts              ← import: parseKdvTahakkuk (DEĞİŞMEZ)
├── kdv2-parser.ts             ← import: parseKdv2Tahakkuk (DEĞİŞMEZ)
├── kdv9015-parser.ts          ← import: parseKdv9015Tahakkuk (DEĞİŞMEZ)
├── gecici-vergi-parser.ts     ← import: parseGeciciVergiTahakkuk (DEĞİŞMEZ)
├── parsers/base-kdv-parser.ts ← DEĞİŞMEZ
├── intvrg-beyanname-api.ts    ← DEĞİŞMEZ
├── intvrg-tahsilat-api.ts     ← DEĞİŞMEZ
├── intvrg-okc-api.ts          ← DEĞİŞMEZ
├── intvrg-pos-api.ts          ← DEĞİŞMEZ
├── etebligat-dijital-api.ts   ← DEĞİŞMEZ
└── ws-client.ts               ← DEĞİŞMEZ
```

---

## 13. Uygulama Planı (Adım Adım)

### Adım 1: Cheerio Kurulumu
- [ ] `cd electron-bot && npm install cheerio`
- [ ] `package.json`'da cheerio bağımlılığını doğrula

### Adım 2: `ebeyanname-api.ts` Oluştur — Temel Yapı
- [ ] Import'lar: cheerio, gibDijitalLogin, tüm parser'lar
- [ ] GIB_CONFIG kopyala
- [ ] HEADERS tanımla (DIJITAL_HEADERS + EBEYANNAME_HEADERS)
- [ ] GIB_ERROR_CODES, detectErrorCode, createGibError kopyala
- [ ] Types kopyala: BeyannameData, BotOptions, BeyannameItem, PaginationInfo, MuhsgkDetailPdfs, PreDownloadCheck
- [ ] BEYANNAME_TYPE_PATTERNS, normalizeBeyannameTuru, GIB_BEYANNAME_TANIM_MAP kopyala
- [ ] Bot stop mekanizması: botShouldStop, stopBot, resetBotStopFlag, checkIfStopped
- [ ] Rate limit state: consecutiveHttp500Count, currentDelay, getAdaptiveDelay, resetRateLimitState
- [ ] Logging system kopyala

### Adım 3: `ebeyanname-api.ts` — Token Fonksiyonları
- [ ] `getEbeyanToken()` — bot.ts:560-596'dan kopyala+iyileştir
- [ ] Session aktivasyonu GET isteği dahil

### Adım 4: `ebeyanname-api.ts` — Sorgu Fonksiyonları (Cheerio)
- [ ] `parseBeyannamePage()` — Cheerio ile HTML parse (YENİ)
- [ ] `fetchBeyannamePage()` — dispatch POST + parseBeyannamePage (YENİ)
- [ ] Pagination bilgisi çıkarma
- [ ] Token güncelleme (her response'daki TOKEN)

### Adım 5: `ebeyanname-api.ts` — PDF İndirme
- [ ] `downloadPdf()` — bot.ts:897-1025'den kopyala
- [ ] `getMuhsgkDetailPdfs()` — Cheerio ile yeniden yaz
- [ ] `downloadSgkPdf()` — bot.ts:1139-1272'den kopyala
- [ ] Adaptive backoff sistemi kopyala
- [ ] PDF response parsing (binary/XML/error)

### Adım 6: `ebeyanname-api.ts` — Pre-Download Check
- [ ] `getPreDownloadedCustomers()` — bot.ts:1278-1317'den kopyala

### Adım 7: `ebeyanname-api.ts` — Ana Pipeline
- [ ] `runEbeyannamePipeline()` — Bölüm 6.2'deki akışı uygula
- [ ] Login loop (max 5 deneme)
- [ ] Sorgu + pagination
- [ ] Durum filtreleme (sadece onaylandi)
- [ ] Pre-download skip logic
- [ ] PDF indirme loop + parse
- [ ] MUHSGK SGK detay + çoklu PDF
- [ ] Batch gönderme (her 5'te)
- [ ] Complete gönderme + stats
- [ ] Error handling + error codes

### Adım 8: `index.ts` Güncelle
- [ ] `import { runElectronBot }` → `import { runEbeyannamePipeline }` değiştir
- [ ] `bot:start` handler'da `runElectronBot()` → `runEbeyannamePipeline()` değiştir
- [ ] `bot:stop` handler'da `stopBot` import'unu güncelle
- [ ] Log mesajını güncelle: "Puppeteer Bot" → "E-Beyanname HTTP API"

### Adım 9: bot.ts Pasife Alma
- [ ] `index.ts`'deki `import { runElectronBot, ... } from './bot'` satırını kaldır
- [ ] bot.ts dosyasını silme, sadece import'ları kaldır (gelecekte referans için kalabilir)

### Adım 10: Test
- [ ] Electron bot başlat
- [ ] Kontrol sayfasından sorgulama tetikle
- [ ] PDF indirme kontrolü
- [ ] BeyannameTakip güncelleme kontrolü
- [ ] Dosyalar sayfasında PDF'leri kontrol et
- [ ] Edge case: Boş sonuç, tek sayfa, çok sayfa, MUHSGK, pre-download skip

---

## 14. Teknik Notlar

- **Cheerio versiyonu:** Güncel stabil (1.0.0+), ESM import
- **Token lifecycle:** Dijital Bearer → ebyn-login → 128-char TOKEN → her dispatch'te güncelle
- **Paralel indirme YOK:** GİB rate limit nedeniyle sıralı indirme, aralarında 1800ms
- **Sayfa arası bekleme:** 1200ms
- **`_dc` parametresi:** `Date.now()` (ms) — cache busting
- **PDF boyut validasyonu:** base64.length > 1000 (çok küçük ise boş/hatalı PDF)
- **`downloadFiles` flag:** false ise PDF indirme atlanır, sadece sorgu yapılır

---

> **Bu handoff ile yeni context'te doğrudan Adım 1'den başlanabilir.**
> Tüm API endpoint'leri, HTML selector'lar, payload formatları, edge case'ler ve akış detayları hazır.
