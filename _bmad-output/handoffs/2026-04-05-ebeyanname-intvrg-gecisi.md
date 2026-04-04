# Handoff: E-Beyanname Pipeline → INTVRG Geçişi

**Tarih:** 2026-04-05 01:30
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor

## Görev Tanımı

> Mevcut `ebeyanname-api.ts`'deki HTTP API çağrılarını (token alma, beyanname arama, PDF indirme, SGK detay) INTVRG API'ye geçir. Tüm üst katman mantığı (dosya kaydetme, PDF parse, batch gönderme, duplicate kontrol, progress reporting, klasör oluşturma, BeyannameTakip güncelleme) **AYNEN** kalacak. Sadece HTTP katmanı değişiyor.

## Test Sonuçları (2026-04-04)

INTVRG test modülü (`intvrg-beyanname-kontrol-api.ts`) ile doğrulanan bulgular:

| Metrik | E-Beyanname (mevcut) | INTVRG (yeni) |
|--------|---------------------|---------------|
| Response format | HTML (Cheerio parse) | **JSON** |
| Rate limit | 1sn kuralı + 20 retry | **Yok** |
| Süre (~96 beyanname + PDF) | Dakikalar | **~30 saniye** |
| Beyanname arama | `ebeyanname.gib.gov.tr/dispatch` HTML | `intvrg.gib.gov.tr/intvrg_server/dispatch` JSON |
| PDF indirme | `ebeyanname.gib.gov.tr/dispatch?cmd=IMAJ` | `intvrg.gib.gov.tr/intvrg_server/goruntuleme` |
| SGK detay | HTML regex parse | JSON API |
| Token parametre adı | `TOKEN` (büyük harf) | `token` (küçük harf) |
| Günlük PDF kotası | Gözlenmedi | **Var** (algılama mekanizması gerekli) |
| OID encoding | Gerek yok | **encodeURIComponent gerekli** (½, }, ! karakterleri) |

**Kanıtlanmış:** 237/252 PDF başarıyla indirildi. Kalan 15 hata = GİB sunucu taraflı (Error reading PNG, vedop2 exception) + kota dolması.

---

## Mevcut Sistem Analizi (DOKUNULMAYACAKLAR)

### Dosya Kaydetme (`process-results/route.ts`)
- Supabase Storage'a upload (`adminUploadFile`)
- Klasör yapısı: Mükellef Root → Kategori (Beyannameler/Tahakkuklar/SGK) → Yıl → Tür/Ay
- Duplicate detection: `vknTckn + beyannameTuru + year + month + fileCategory + fileIndex`
- 5 seviyeli mükellef eşleştirme (VKN exact → unvan exact → contains → first 15 → word match)
- Transaction-based BeyannameTakip + kontrol tablo güncellemeleri (SGK, KDV, KDV2, KDV9015, Gecici Vergi)

### PDF Parse'lar
- `parseKdvTahakkuk(base64)` → KDV1 için
- `parseKdv2Tahakkuk(base64)` → KDV2 için
- `parseKdv9015Tahakkuk(base64)` → KDV9015 için
- `parseGeciciVergiTahakkuk(base64)` → GGECICI/KGECICI için
- `parseTahakkukFisi(base64)` → MUHSGK SGK tahakkuk için
- `parseHizmetListesi(base64)` → MUHSGK hizmet listesi için

### Batch Gönderme (her 5 beyanname'de bir)
```typescript
onProgress('batch-results', {
  message: `${i + 1}/${total} işlendi`,
  beyannameler: processedBeyannameler.slice(-5),
  stats, startDate, tenantId
});
```

### server.ts Batch İşleme
1. `/api/gib/process-results` → dosya kaydet, eşleştir
2. Eşleşmeyenler → `/api/gib/mukellefler/import` → otomatik mükellef oluştur
3. Yeni mükellefler için → tekrar `/api/gib/process-results` (re-processing)
4. `/api/beyanname-takip/sync` → senkronizasyon
5. `bot:batch-processed` broadcast + dashboard invalidation

### Pre-download Duplicate Check
- `getPreDownloadedCustomers(apiToken, year, month)` → `/api/gib/pre-downloaded`
- Map key: `${vkn}_${normalizedTuru}`
- `downloadedTypes` array: `['BEYANNAME', 'TAHAKKUK']` → her ikisi de varsa atla

### Stop Mekanizması
- `botShouldStop` flag + `checkIfStopped()` kontrol noktaları
- Login öncesi, sayfa çekme sırasında, PDF döngüsünde kontrol
- Durduğunda `onProgress('complete', { stats, stopped: true })` gönderir

### BeyannameData Tipi (AYNEN KALACAK)
```typescript
{
  beyannameTuru: string;              // "KDV1", "MUHSGK", "GGECICI" vb.
  tcVkn: string;                      // VKN/TCKN
  adSoyadUnvan: string;               // Ünvan
  vergiDairesi: string;               // Vergi dairesi
  vergilendirmeDonemi: string;        // Dönem
  yuklemeZamani: string;              // Yükleme zamanı
  oid?: string;                       // Beyanname OID
  tahakkukOid?: string;               // Tahakkuk OID
  success?: boolean;
  beyannameBuffer?: string;           // Base64 PDF
  tahakkukBuffer?: string;            // Base64 tahakkuk PDF
  sgkTahakkukBuffer?: string;         // İlk SGK tahakkuk
  sgkHizmetBuffer?: string;           // İlk SGK hizmet
  tahakkukDurumu?: string;            // "onaylandi" vb.
  sgkTahakkukParsed?: TahakkukFisiParsed;
  sgkHizmetParsed?: HizmetListesiParsed;
  kdvTahakkukParsed?: KdvTahakkukParsed;
  kdv2TahakkukParsed?: Kdv2TahakkukParsed;
  kdv9015TahakkukParsed?: Kdv9015TahakkukParsed;
  geciciVergiTahakkukParsed?: GeciciVergiTahakkukParsed;
  sgkTahakkukBuffers?: Array<{ buffer: string; index: number; parsed?: TahakkukFisiParsed }>;
  sgkHizmetBuffers?: Array<{ buffer: string; index: number; parsed?: HizmetListesiParsed }>;
  sgkTahakkukToplam?: { isciSayisi: number; netTutar: number; gunSayisi: number; dosyaSayisi: number };
  sgkHizmetToplam?: { isciSayisi: number; dosyaSayisi: number };
}
```

---

## Değiştirilecek Fonksiyonlar (ebeyanname-api.ts)

### 1. `getEbeyanToken()` → **SİLİNECEK**

**Mevcut (satır 393-429):**
```
GET https://dijital.gib.gov.tr/apigateway/auth/tdvd/ebyn-login
  → Bearer dijitalToken
  → redirectUrl'den TOKEN parse
  → Session aktivasyonu (redirectUrl'e GET)
  → e-beyanname TOKEN döner
```

**Yeni:**
```
import { getIvdToken } from './intvrg-tahsilat-api';
const ivdToken = await getIvdToken(dijitalToken);
// IVD token döner — session aktivasyonu gerekmez
```

### 2. `fetchBeyannamePage()` → **TAMAMEN YENİDEN YAZILACAK**

**Mevcut (satır 564-643):**
```
POST https://ebeyanname.gib.gov.tr/dispatch
  body: cmd=BEYANNAMELISTESI&sorguTipiZ=1&baslangicTarihi=...&TOKEN=...
  → HTML response
  → parseBeyannamePage() ile Cheerio parse
  → Token refresh (<TOKEN> tag'inden)
  → Rate limit kontrolü (<SERVERERROR> "1 sn")
  → 20 retry, 1.1sn sayfa arası bekleme
```

**Yeni:**
```typescript
import { IntrvrgClient } from './intvrg-tahsilat-api';

const client = new IntrvrgClient(ivdToken, '');

async function fetchBeyannamePage(client: IntrvrgClient, params: {
  donemBasAy: string; donemBasYil: string;
  donemBitAy: string; donemBitYil: string;
  baslangicTarihi: string; bitisTarihi: string;
  pageNo?: number;
}): Promise<{ beyannameler: BeyannameItem[]; totalPages: number }> {
  
  const jp: Record<string, unknown> = {
    arsivde: false,
    sorguTipiN: 0, vergiNo: '',
    sorguTipiT: 0, tcKimlikNo: '',
    sorguTipiB: 0, beyannameTanim: '',
    sorguTipiP: 0,
    donemBasAy: params.donemBasAy,
    donemBasYil: params.donemBasYil,
    donemBitAy: params.donemBitAy,
    donemBitYil: params.donemBitYil,
    sorguTipiV: 0, vdKodu: '',
    sorguTipiZ: 1,
    tarihAraligi: {
      baslangicTarihi: params.baslangicTarihi,
      bitisTarihi: params.bitisTarihi,
    },
    sorguTipiD: 1,
    durum: { radiob: false, radiob1: false, radiob2: true, radiob3: false },
  };
  // İlk sayfa için pageNo eklenmez
  if (params.pageNo && params.pageNo > 1) jp.pageNo = params.pageNo;
  
  // Filtreler (opsiyonel)
  // VKN filtresi: sorguTipiN: 1, vergiNo: vkn
  // TCK filtresi: sorguTipiT: 1, tcKimlikNo: tck
  // Beyanname türü filtresi: sorguTipiB: 1, beyannameTanim: tanim
  
  const result = await client.callDispatch<BeyannameSearchResponse>(
    'beyannameService_beyannameAra', jp
  );
  
  const items = result.data?.data || [];
  const rowcount = result.data?.rowcount || 0;
  const totalPages = Math.ceil(rowcount / 25);
  
  return { beyannameler: items, totalPages };
}
```

**Token refresh GEREK YOK** — IntrvrgClient token'ı constructor'da alıyor, dispatch çağrılarında otomatik kullanıyor.
**Rate limit retry GEREK YOK** — INTVRG'de rate limit yok (test ile doğrulandı).
**Cheerio import SİLİNECEK** — JSON response'ta parse gerek yok.

### 3. `parseBeyannamePage()` → **SİLİNECEK**

**Mevcut (satır 435-562):** Cheerio ile HTML'den beyanname satırlarını parse ediyor.
**Yeni:** Gerek yok — INTVRG JSON döner.

### 4. **INTVRG Response → BeyannameItem Mapping**

```typescript
// INTVRG JSON response item:
{
  beyannameKodu: "KDV1",        // Normalize edilmiş tür kodu
  beyannameTuru: "KDV1_44",     // Ham tür (versiyonlu)
  durum: "2",                   // "0"=Hatalı, "1"=Bekliyor, "2"=Onaylandı, "3"=İptal
  tckn: "5050036469",           // VKN veya TCKN
  unvan: "İSMET KARACA",        // Ünvan
  vergiDairesi: "060260",       // VD kodu
  donem: "01/2026-01/2026",     // Dönem
  yuklemezamani: "23.02.2026 - 15:26:26",
  beyannameOid: "1vmlz4tlvp1fp9",
  tahakkukOid: "1smlz4o4sm1uol",
}

// → BeyannameData mapping:
{
  beyannameTuru: item.beyannameKodu,        // "KDV1" (normalizeBeyannameTuru ile)
  tcVkn: item.tckn,
  adSoyadUnvan: item.unvan,
  vergiDairesi: item.vergiDairesi,
  vergilendirmeDonemi: item.donem,
  yuklemeZamani: item.yuklemezamani,
  oid: item.beyannameOid,
  tahakkukOid: item.tahakkukOid,
  tahakkukDurumu: item.durum === "2" ? "onaylandi" : item.durum === "0" ? "hata" : "bekliyor",
}
```

**ÖNEMLİ:** `beyannameKodu` alanını kullan (`KDV1`), `beyannameTuru` alanını DEĞİL (`KDV1_44`). `beyannameKodu` zaten normalize edilmiş hali.

### 5. `downloadPdf()` → **TAMAMEN YENİDEN YAZILACAK**

**Mevcut (satır 649-765):**
```
GET https://ebeyanname.gib.gov.tr/dispatch?cmd=IMAJ&subcmd=...&TOKEN={token}
  → Content-Type kontrolü (pdf/octet-stream vs HTML)
  → HTML'den <PDFFILE> tag'i ile base64 extract
  → HTTP 500 adaptive backoff (consecutiveHttp500Count, currentDelay)
  → 3 retry, exponential backoff
```

**Yeni:**
```typescript
const INTVRG_GORUNTULEME = 'https://intvrg.gib.gov.tr/intvrg_server/goruntuleme';

async function downloadPdf(
  subcmd: string,
  params: Record<string, string>,
  ivdToken: string,
  maxRetries: number = 2,
): Promise<{ success: boolean; base64?: string; fileSize?: number; error?: string }> {
  
  // URL oluştur — TÜM parametreleri encodeURIComponent ile encode et
  const queryParts = [
    `cmd=IMAJ`,
    `subcmd=${subcmd}`,
    ...Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`),
    `USERID=`,
    `inline=true`,
    `goruntuTip=1`,
    `token=${ivdToken}`,  // küçük harf "token"
  ];
  const url = `${INTVRG_GORUNTULEME}?${queryParts.join('&')}`;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/pdf,*/*',
          'Referer': 'https://intvrg.gib.gov.tr/intvrg_side/main.jsp',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type') || '';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Kota kontrolü
      if (buffer.length < 200) {
        const text = buffer.toString('utf-8');
        if (text.includes('kota') || text.includes('günlük')) {
          return { success: false, error: 'QUOTA_EXCEEDED' };
        }
      }
      
      // PDF geçerlilik
      const header = buffer.subarray(0, 5).toString('utf-8');
      if (buffer.length < 100 || !header.startsWith('%PDF')) {
        // GİB sunucu hatası (Error reading PNG, vedop2 exception vb.) — retry etme
        const preview = buffer.subarray(0, 100).toString('utf-8');
        return { success: false, error: `PDF_INVALID: ${preview.substring(0, 80)}` };
      }
      
      return {
        success: true,
        base64: buffer.toString('base64'),
        fileSize: buffer.length,
      };
      
    } catch (e) {
      if (attempt === maxRetries) {
        return { success: false, error: (e as Error).message };
      }
      // Kısa retry beklemesi (rate limit yok, sadece geçici hata için)
      await sleep(300);
    }
  }
  
  return { success: false, error: 'MAX_RETRIES_EXCEEDED' };
}
```

**PDF İndirme Çağrıları:**

```typescript
// Beyanname PDF
downloadPdf('BEYANNAMEGORUNTULE', { beyannameOid: oid }, ivdToken);

// Tahakkuk PDF
downloadPdf('TAHAKKUKGORUNTULE', { tahakkukOid: thkOid, beyannameOid: oid }, ivdToken);

// SGK Tahakkuk PDF
downloadPdf('SGKTAHAKKUKGORUNTULE', { sgkTahakkukOid: sgkOid }, ivdToken);

// SGK Hizmet Listesi PDF
downloadPdf('SGKHIZMETGORUNTULE', { sgkTahakkukOid: sgkOid, beyannameOid: oid }, ivdToken);
```

### 6. `getMuhsgkDetailPdfs()` → **TAMAMEN YENİDEN YAZILACAK**

**Mevcut (satır 771-852):**
```
POST https://ebeyanname.gib.gov.tr/dispatch
  body: cmd=THKESASBILGISGKMESAJLARI&beyannameOid=...&TOKEN=...
  → HTML response
  → Regex parse: sgkTahakkukGoruntule('oid1', 'oid2'), sgkHizmetGoruntule(...)
  → URL construction with __TOKEN__ placeholder
  → Deduplication
```

**Yeni:**
```typescript
async function getMuhsgkSgkDetails(
  client: IntrvrgClient,
  beyannameOid: string,
): Promise<{ sgkEntries: Array<{ thkoid: string; aciklama: string; index: number }> }> {
  
  const result = await client.callDispatch<SgkBildirgeResponse>(
    'sgkBildirgeIslemleri_bildirgeleriGetir',
    { beyannameOid },
  );
  
  const entries: Array<{ thkoid: string; aciklama: string; index: number }> = [];
  const data = result.data;
  const bildirimSayisi = parseInt(data.bildirim_sayisi || '0', 10);
  
  // thkhaberlesme1 = Vergi tahakkuku (atla — ana tahakkuk zaten indiriliyor)
  // thkhaberlesme2+ = SGK bildirgeleri
  for (let i = 2; i <= bildirimSayisi; i++) {
    const key = `thkhaberlesme${i}`;
    const thk = data[key] as { thkoid: string; aciklama: string } | undefined;
    if (thk?.thkoid) {
      entries.push({ thkoid: thk.thkoid, aciklama: thk.aciklama, index: i });
    }
  }
  
  return { sgkEntries: entries };
}
```

**Artık URL oluşturmaya gerek yok** — her SGK entry'si için doğrudan `downloadPdf()` çağrılacak:
```typescript
// Her sgkEntry için:
const sgkThk = await downloadPdf('SGKTAHAKKUKGORUNTULE', { sgkTahakkukOid: entry.thkoid }, ivdToken);
const sgkHiz = await downloadPdf('SGKHIZMETGORUNTULE', { sgkTahakkukOid: entry.thkoid, beyannameOid }, ivdToken);
```

### 7. `downloadSgkPdf()` → **SİLİNECEK**

Mevcut (satır 858-969): Ayrı SGK PDF indirme fonksiyonu (URL'den __TOKEN__ replace, HTML response handling).
**Yeni:** `downloadPdf()` tüm PDF türlerini karşılıyor — ayrı fonksiyona gerek yok.

### 8. Rate Limit Mekanizması → **SİLİNECEK**

**Silinecek değişkenler ve fonksiyonlar:**
- `consecutiveHttp500Count` (global)
- `currentDelay` (global)
- `resetRateLimitState()` (satır 261-266)
- `getAdaptiveDelay()` (satır 268-273)
- `GIB_CONFIG.RATE_LIMIT` tüm sabitleri (BETWEEN_REQUESTS, BETWEEN_PAGES, BETWEEN_DOWNLOADS, COOLDOWN_AFTER_500, vb.)
- `MAX_PAGE_RETRIES` (20 retry)
- `fetchBeyannamePage` içindeki rate limit retry döngüsü

**Yeni:** Rate limit yok. PDF indirmelerde `QUOTA_EXCEEDED` algılama var (kota dolunca dur).

### 9. Token Refresh Mekanizması → **SİLİNECEK**

**Mevcut:** Her dispatch response'undan `<TOKEN>` tag'i ile yeni token extract edilir.
**Yeni:** `IntrvrgClient` token'ı constructor'da alır, tüm çağrılarda kullanır. Token refresh yok.

---

## Pipeline Akışı (runEbeyannamePipeline) — Değişiklik Detayları

### Adım 1: Login (AYNI KALACAK)
```typescript
const dijitalToken = await gibDijitalLogin(username, password, captchaKey, ocrSpaceApiKey);
```
**Değişiklik yok** — `gibDijitalLogin` aynen kullanılacak.

### Adım 2: Token (DEĞİŞECEK)
```typescript
// ESKİ:
const ebeyanToken = await getEbeyanToken(dijitalToken);
// → currentToken değişkeni ile takip

// YENİ:
const ivdToken = await getIvdToken(dijitalToken);
const client = new IntrvrgClient(ivdToken, '');
// → IntrvrgClient token'ı yönetir, currentToken gerekmez
```

### Adım 3: Pre-download Check (AYNI KALACAK)
```typescript
const preDownloaded = await getPreDownloadedCustomers(options.token, donem.year, donem.month);
```
**Değişiklik yok.**

### Adım 4: Beyanname Arama (DEĞİŞECEK)

**ESKİ:**
```typescript
// Sayfa 1
let { beyannameler, totalPages, newToken } = await fetchBeyannamePage(currentToken, startFormatted, endFormatted, 1, filters);
currentToken = newToken;
// Sayfa 2..N (1.1sn bekleme, 20 retry)
for (let page = 2; page <= totalPages; page++) {
  await sleep(BETWEEN_PAGES); // 1100ms
  const pageResult = await fetchBeyannamePage(currentToken, startFormatted, endFormatted, page, filters);
  currentToken = pageResult.newToken;
}
// Durum filtresi: JS tarafında "onaylandi" filtrele
```

**YENİ:**
```typescript
// Tarih parametreleri hesapla
const startDate = new Date(options.startDate);
const endDate = new Date(options.endDate);
const baslangicTarihi = `${startDate.getFullYear()}${String(startDate.getMonth()+1).padStart(2,'0')}${String(startDate.getDate()).padStart(2,'0')}`;
const bitisTarihi = `${endDate.getFullYear()}${String(endDate.getMonth()+1).padStart(2,'0')}${String(endDate.getDate()).padStart(2,'0')}`;

// Dönem hesapla (başlangıçtan 2 ay önce — bitiş ayı)
let dBasAy = startDate.getMonth(); // 0-indexed, zaten -1
if (dBasAy <= 0) { dBasAy += 12; }
const donemBasYil = dBasAy > startDate.getMonth() + 1 ? startDate.getFullYear() - 1 : startDate.getFullYear();

// Filtreler
const jp: Record<string, unknown> = {
  arsivde: false,
  sorguTipiN: options.vergiNo ? 1 : 0,
  vergiNo: options.vergiNo || '',
  sorguTipiT: options.tcKimlikNo ? 1 : 0,
  tcKimlikNo: options.tcKimlikNo || '',
  sorguTipiB: options.beyannameTuru ? 1 : 0,
  beyannameTanim: options.beyannameTuru || '',
  sorguTipiP: 0,
  donemBasAy: String(dBasAy).padStart(2, '0'),
  donemBasYil: String(donemBasYil),
  donemBitAy: String(endDate.getMonth() + 1).padStart(2, '0'),
  donemBitYil: String(endDate.getFullYear()),
  sorguTipiV: 0, vdKodu: '',
  sorguTipiZ: 1,
  tarihAraligi: { baslangicTarihi, bitisTarihi },
  sorguTipiD: 1,
  durum: { radiob: false, radiob1: false, radiob2: true, radiob3: false }, // Sadece onaylandı
};

// Tüm sayfaları çek (bekleme YOK)
let page = 1;
let totalPages = 1;
const allItems: IntrvrgBeyannameItem[] = [];

do {
  if (page > 1) jp.pageNo = page;
  const result = await client.callDispatch<BeyannameSearchResponse>('beyannameService_beyannameAra', jp);
  allItems.push(...(result.data?.data || []));
  totalPages = Math.ceil((result.data?.rowcount || 0) / 25);
  page++;
} while (page <= totalPages);

// BeyannameData'ya dönüştür (DURUM filtresi API'de yapıldı, JS tarafında gerek yok)
const allBeyannameler: BeyannameData[] = allItems.map(item => ({
  beyannameTuru: normalizeBeyannameTuru(item.beyannameKodu),
  tcVkn: item.tckn,
  adSoyadUnvan: item.unvan,
  vergiDairesi: item.vergiDairesi,
  vergilendirmeDonemi: item.donem,
  yuklemeZamani: item.yuklemezamani,
  oid: item.beyannameOid,
  tahakkukOid: item.tahakkukOid,
  tahakkukDurumu: 'onaylandi', // API'den sadece onaylandı geldi
}));
```

**Önemli farklar:**
- `durum: { radiob2: true }` → sadece onaylandı API'den döner (JS tarafında filtre gereksiz)
- Sayfa arası bekleme YOK
- Token refresh YOK
- Rate limit retry YOK
- `normalizeBeyannameTuru()` fonksiyonu AYNEN KULLANILACAK (`beyannameKodu` alanından)

### Adım 5: Pre-download Duplicate Check (AYNI KALACAK)

```typescript
// Mevcut mantık aynen — preDownloaded map'ten kontrol
const preKey = `${item.tcVkn}_${normalizedTuru}`;
const preCheck = preDownloaded.get(preKey);
if (preCheck && preCheck.downloadedTypes.includes('BEYANNAME') && preCheck.downloadedTypes.includes('TAHAKKUK')) {
  stats.preSkipped++;
  continue; // Atla
}
```

### Adım 6: PDF İndirme (DEĞİŞECEK)

**ESKİ:** Her PDF arası 1.2sn bekleme, HTTP 500 adaptive backoff, HTML/XML response handling
**YENİ:** Bekleme YOK, doğrudan binary PDF response, encodeURIComponent

```typescript
// Beyanname PDF
const bynResult = await downloadPdf('BEYANNAMEGORUNTULE', { beyannameOid: item.oid! }, ivdToken);
if (bynResult.success) {
  item.beyannameBuffer = bynResult.base64;
  stats.downloaded++;
}

// Tahakkuk PDF
const thkResult = await downloadPdf('TAHAKKUKGORUNTULE', {
  tahakkukOid: item.tahakkukOid!,
  beyannameOid: item.oid!,
}, ivdToken);
if (thkResult.success) {
  item.tahakkukBuffer = thkResult.base64;
  stats.downloaded++;
  
  // PDF Parse (AYNEN MEVCUT MANTIK)
  const normalized = normalizeBeyannameTuru(item.beyannameTuru);
  if (normalized === 'KDV1') {
    item.kdvTahakkukParsed = parseKdvTahakkuk(thkResult.base64!);
  } else if (normalized === 'KDV2') {
    item.kdv2TahakkukParsed = parseKdv2Tahakkuk(thkResult.base64!);
  } else if (normalized === 'KDV9015') {
    item.kdv9015TahakkukParsed = parseKdv9015Tahakkuk(thkResult.base64!);
  } else if (normalized === 'GGECICI' || normalized === 'KGECICI') {
    item.geciciVergiTahakkukParsed = parseGeciciVergiTahakkuk(thkResult.base64!);
  }
}

// MUHSGK → SGK detay (JSON API)
if (normalized === 'MUHSGK') {
  const { sgkEntries } = await getMuhsgkSgkDetails(client, item.oid!);
  
  item.sgkTahakkukBuffers = [];
  item.sgkHizmetBuffers = [];
  
  for (const entry of sgkEntries) {
    // SGK Tahakkuk
    const sgkThk = await downloadPdf('SGKTAHAKKUKGORUNTULE', { sgkTahakkukOid: entry.thkoid }, ivdToken);
    if (sgkThk.success && sgkThk.base64) {
      const parsed = parseTahakkukFisi(sgkThk.base64);
      item.sgkTahakkukBuffers.push({ buffer: sgkThk.base64, index: entry.index, parsed });
      if (!item.sgkTahakkukBuffer) {
        item.sgkTahakkukBuffer = sgkThk.base64;
        item.sgkTahakkukParsed = parsed;
      }
    }
    
    // SGK Hizmet Listesi
    const sgkHiz = await downloadPdf('SGKHIZMETGORUNTULE', {
      sgkTahakkukOid: entry.thkoid,
      beyannameOid: item.oid!,
    }, ivdToken);
    if (sgkHiz.success && sgkHiz.base64) {
      const parsed = parseHizmetListesi(sgkHiz.base64);
      item.sgkHizmetBuffers.push({ buffer: sgkHiz.base64, index: entry.index, parsed });
      if (!item.sgkHizmetBuffer) {
        item.sgkHizmetBuffer = sgkHiz.base64;
        item.sgkHizmetParsed = parsed;
      }
    }
  }
  
  // SGK Toplamları (AYNEN MEVCUT MANTIK)
  // isciSayisi, netTutar, gunSayisi, dosyaSayisi hesapla
}

// Kota kontrolü
if (bynResult.error === 'QUOTA_EXCEEDED' || thkResult.error === 'QUOTA_EXCEEDED') {
  report(95, 'Günlük PDF indirme kotası doldu! Kalan beyannameler atlanıyor...');
  break; // PDF döngüsünden çık
}
```

### Adım 7: Batch Gönderme (AYNI KALACAK)
```typescript
if ((i + 1) % 5 === 0 || i === onaylanmisBeyannameler.length - 1) {
  onProgress('batch-results', { ... });
}
```

### Adım 8: Tamamlama (AYNI KALACAK)
```typescript
onProgress('complete', { stats, beyannameler: allBeyannameler });
```

---

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `electron-bot/src/main/ebeyanname-api.ts` | **BÜYÜK DEĞİŞİKLİK** | Token, arama, PDF indirme, SGK detay fonksiyonları yeniden yazılacak |
| `electron-bot/src/main/intvrg-beyanname-kontrol-api.ts` | **DÜZENLEME** | Disk kaydetme kodu silinecek (test tamamlandı) |
| `electron-bot/src/main/index.ts` | **Değişiklik yok** | `bot:start` handler aynen kalacak |
| `server.ts` | **Değişiklik yok** | `bot:batch-results` handler aynen kalacak |
| `src/app/api/gib/sync/route.ts` | **Değişiklik yok** | Aynı parametreler gönderilecek |
| `src/app/api/gib/process-results/route.ts` | **Değişiklik yok** | BeyannameData aynı formatta gelecek |
| `src/app/api/gib/pre-downloaded/route.ts` | **Değişiklik yok** | |
| `src/components/beyanname-kontrol/` | **Değişiklik yok** | Frontend değişmeyecek |

---

## Silinecek Kodlar (ebeyanname-api.ts'den)

1. `import * as cheerio from 'cheerio'` — HTML parse gerek yok
2. `getEbeyanToken()` fonksiyonu (satır 393-429)
3. `parseBeyannamePage()` fonksiyonu (satır 435-562)
4. `fetchBeyannamePage()` fonksiyonu (satır 564-643) — tamamen yeniden yazılacak
5. `getMuhsgkDetailPdfs()` fonksiyonu (satır 771-852) — tamamen yeniden yazılacak
6. `downloadSgkPdf()` fonksiyonu (satır 858-969) — `downloadPdf()` karşılıyor
7. Rate limit değişkenleri: `consecutiveHttp500Count`, `currentDelay`, `resetRateLimitState()`, `getAdaptiveDelay()`
8. `GIB_CONFIG.RATE_LIMIT` tüm sabitleri
9. `GIB_CONFIG.EBEYANNAME` sabitleri
10. `GIB_CONFIG.DIJITAL_GIB.EBYN_LOGIN` sabiti
11. `EBEYANNAME_HEADERS` objesi
12. `MAX_PAGE_RETRIES` sabiti
13. Token refresh mekanizması (`currentToken` ve `<TOKEN>` tag parse)

## Eklenecek Import'lar (ebeyanname-api.ts'e)

```typescript
import { getIvdToken, IntrvrgClient, INTVRG_BASE } from './intvrg-tahsilat-api';
```

## Eklenecek Sabitler

```typescript
const INTVRG_GORUNTULEME = `${INTVRG_BASE}/intvrg_server/goruntuleme`;
```

---

## Kota Yönetimi (YENİ)

Pipeline'da kota algılama ve durdurma:

```typescript
let quotaExceeded = false;

// Her PDF indirme sonrası kontrol
if (result.error === 'QUOTA_EXCEEDED') {
  quotaExceeded = true;
  report(95, 'Günlük PDF indirme kotası doldu!');
  break;
}

// Döngünün başında da kontrol
if (quotaExceeded) break;
```

Kota dolduğunda:
- PDF indirme durur
- Mevcut batch gönderilir
- `onProgress('complete', { stats, beyannameler })` çağrılır (normal tamamlama)
- Stats'ta `quotaExceeded: true` flag'i eklenir

---

## Dokunulmayacak Fonksiyonlar Listesi (ebeyanname-api.ts'de)

1. `normalizeBeyannameTuru()` (satır 348-356) — AYNEN
2. `calculateBeyannameDonem()` (satır 358-377) — AYNEN
3. `formatDate()` (satır 326-332) — AYNEN
4. `detectErrorCode()` (satır 113-124) — AYNEN
5. `createGibError()` (satır 126-138) — AYNEN
6. `stopBot()` / `resetBotStopFlag()` / `checkIfStopped()` — AYNEN
7. `getPreDownloadedCustomers()` (satır 975-1014) — AYNEN
8. `GIB_ERROR_CODES` (satır 70-99) — AYNEN
9. `BeyannameData` tipi (satır 143-180) — AYNEN
10. `BotOptions` tipi (satır 182-201) — AYNEN
11. `BEYANNAME_TYPE_PATTERNS` (satır 335-346) — AYNEN
12. Tüm log helper'ları — AYNEN
13. Tüm PDF parser import'ları ve çağrıları — AYNEN
14. Batch gönderme mantığı (her 5 beyanname) — AYNEN
15. Progress reporting mantığı — AYNEN
16. SGK toplam hesaplama mantığı — AYNEN

---

## Uygulama Sırası

### Adım 1: Test modülünden disk kaydetmeyi sil
- `intvrg-beyanname-kontrol-api.ts`'den `fs`, `path`, `app` import'larını ve disk yazma kodunu kaldır

### Adım 2: ebeyanname-api.ts'e yeni import'ları ekle
- `import { getIvdToken, IntrvrgClient, INTVRG_BASE } from './intvrg-tahsilat-api'`
- `INTVRG_GORUNTULEME` sabiti

### Adım 3: Cheerio ve eski sabitleri sil
- `import * as cheerio` kaldır
- `GIB_CONFIG.EBEYANNAME`, `GIB_CONFIG.DIJITAL_GIB.EBYN_LOGIN` sil
- `GIB_CONFIG.RATE_LIMIT` tüm sabitleri sil
- `EBEYANNAME_HEADERS` sil
- Rate limit değişkenleri ve fonksiyonları sil

### Adım 4: getEbeyanToken → getIvdToken
- `getEbeyanToken()` fonksiyonunu sil
- Pipeline'da `getIvdToken()` + `new IntrvrgClient()` kullan

### Adım 5: fetchBeyannamePage yeniden yaz
- `parseBeyannamePage()` sil
- `fetchBeyannamePage()` → INTVRG `beyannameService_beyannameAra` ile değiştir
- Response mapping: INTVRG JSON → BeyannameItem

### Adım 6: downloadPdf yeniden yaz
- Eski `downloadPdf()` sil
- Yeni `downloadPdf(subcmd, params, ivdToken)` yaz
- `encodeURIComponent` + kota algılama + binary PDF handling

### Adım 7: getMuhsgkDetailPdfs yeniden yaz
- Eski fonksiyon (HTML regex) sil
- Yeni `getMuhsgkSgkDetails(client, beyannameOid)` yaz (JSON API)
- `downloadSgkPdf()` fonksiyonunu sil

### Adım 8: Pipeline akışını güncelle
- Token alma → `getIvdToken` + `IntrvrgClient`
- Arama döngüsü → Rate limit kaldır, JSON response
- PDF indirme → Yeni `downloadPdf`, bekleme kaldır
- SGK detay → JSON API + doğrudan `downloadPdf`
- Kota algılama ekle
- Tüm PDF parse çağrılarını koru

### Adım 9: Derleme ve test
- `npm run build` (electron-bot)
- `npx tsc --noEmit` (Next.js)

---

## Kritik Uyarılar

1. **encodeURIComponent ZORUNLU** — INTVRG OID'leri özel karakterler içerebilir (½, }, !). Test ile kanıtlandı.
2. **Kota mekanizması ZORUNLU** — Günlük PDF indirme kotası var. `QUOTA_EXCEEDED` algılanmazsa tüm sonraki PDF'ler başarısız olur.
3. **`beyannameKodu` kullan, `beyannameTuru` DEĞİL** — INTVRG response'unda `beyannameTuru: "KDV1_44"` (versiyonlu), `beyannameKodu: "KDV1"` (normalize). `beyannameKodu` alanını kullan.
4. **Token refresh YOK** — IntrvrgClient token'ı constructor'da alır. `currentToken` değişkeni gerekmez.
5. **Durum filtresi API'de** — `durum: { radiob2: true }` ile sadece onaylandı gelir. JS tarafında filtre gereksiz.
6. **GİB sunucu hataları** — Bazı beyanname türlerinde (KONAKLAMA, TURİZM) GİB PDF oluşturamıyor. Bu bizden kaynaklanmıyor, hata loglanmalı ama pipeline durdurulmamalı.
