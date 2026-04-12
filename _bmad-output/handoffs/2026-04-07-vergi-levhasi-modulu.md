# Handoff: Vergi Levhası Modülü
**Tarih:** 2026-04-07 18:30
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor

## Görev Tanımı
> Maliye İşlemleri menüsüne "Vergi Levhası" alt menüsü eklenmesi. Tüm mükelleflerin vergi levhalarının GİB İnternet Vergi Dairesi (INTVRG) üzerinden HTTP API ile sorgulanması, PDF olarak indirilmesi, Supabase Storage'da arşivlenmesi ve kullanıcıya sunulması. Mali müşavirin kendi GİB bilgileriyle TEK LOGIN yapılacak, ardından tüm mükelleflerin VKN/TCKN'leri ile sıralı sorgulama yapılacak. UI olarak `/dashboard/beyannameler` sayfasının arşiv-first yapısı referans alınacak.

---

## 1. GİB API Detayları (HAR Analizi)

### 1.1 Endpoint ve Komutlar

Tüm API çağrıları tek endpoint üzerinden yapılır:

```
POST https://intvrg.gib.gov.tr/intvrg_server/dispatch
Content-Type: application/x-www-form-urlencoded; charset=UTF-8

Body: cmd=<komut>&callid=<sessionId>-<counter>&token=<ivdToken>&jp=<JSON-params>
```

### 1.2 Login Akışı (TEK LOGIN — KRİTİK FARK!)

Diğer INTVRG modüllerinden farklı olarak, vergi levhası sorgulama **mali müşavirin kendi GİB bilgileriyle** yapılır. Her mükellefin GİB şifresiyle giriş yapılmaz!

```
1. gibDijitalLogin(maliMusavir.gibCode, maliMusavir.gibPassword)
   → Bearer Token
2. getIvdToken(bearerToken)
   → IVD Token (128 hex char)
3. IntrvrgClient(ivdToken, "") ile tüm mükellefleri sorgula
```

**Mali müşavir GİB bilgileri:**
- Kaynak: `tenants.gibSettings` JSON alanı → `gibCode` (plain), `gibPassword` (AES-256-GCM encrypted)
- API: `GET /api/settings/gib` → `{ gibCode, gibPassword (decrypted), captchaKey }`
- Server-side: `prisma.tenants.findUnique({ where: { id: tenantId }, select: { gibSettings: true } })` + `decrypt(gibSettings.gibPassword)`

### 1.3 Komut 1: Mevcut Vergi Levhalarını Listele

**Komut:** `vergiLevhasiDetay_kayitlariListele`

**İstek (Şahıs/Basit Usul — TCKN ile):**
```json
{
  "mukellefVergiNo": "",
  "mukellefTCKimlikNo": "23297037542"
}
```

**İstek (Firma — VKN ile):**
```json
{
  "mukellefVergiNo": "9930091870",
  "mukellefTCKimlikNo": ""
}
```

**VKN/TCKN Ayrım Kuralı:**
```typescript
// vknTckn.length === 11 → Şahıs veya Basit Usul → TCKN gönder
// vknTckn.length === 10 → Firma → VKN gönder
// Şahıs için VKN gönderilirse GİB hata veriyor!
const jp = customer.vknTckn.length === 11
  ? { mukellefVergiNo: "", mukellefTCKimlikNo: customer.vknTckn }
  : { mukellefVergiNo: customer.vknTckn, mukellefTCKimlikNo: "" };
```

**Başarılı Yanıt:**
```json
{
  "data": {
    "vrglvh": [
      {
        "onayzamani": "20260309031430",
        "vergiadi": "YILLIK GELİR VERGİSİ",
        "vdadi": "TOKAT",
        "onaykodu": "4YP6RMMCZFC4",
        "vergikodu": "0001"
      }
    ],
    "vrglvhListeSize": 15
  },
  "metadata": { "optime": "20260407172019" }
}
```

**Hata Yanıtı (Mükellefiyet yok veya yanlış parametre):**
```json
{
  "error": "1",
  "messages": [
    {
      "text": "Gerçek mükellefler için TC Kimlik Numarası bilgisi girilmelidir.",
      "type": "1"
    }
  ]
}
```

### 1.4 Komut 2: Vergi Levhası Oluştur/Görüntüle

**Komut:** `vergiLevhasiDetay_olustur`

**İstek (Yeni oluştur — islemTip: 0):**
```json
{
  "mukellefVkn": "9930091870",
  "islemTip": 0
}
```

**İstek (Mevcut görüntüle — islemTip: 1):**
```json
{
  "mukellefVkn": "9930091870",
  "onayKod": "4YP6RMMCZFC4",
  "islemTip": 1
}
```

**NOT:** `mukellefVkn` alanına şahıslarda TCKN, firmalarda VKN gönderilecek (aynı `vknTckn` değeri).

**Başarılı Yanıt:**
```json
{
  "data": {
    "ceEVergiLevhaVergiTur": "YILLIK GELİR VERGİSİ",
    "ceEVergiLevhaVknTx": "9930091870",
    "ceEVergiLevhaVdTx": "TOKAT",
    "ceEVergiLevhaOnayKoduTx": "4YP6RMMCZFC4",
    "ceEVergiLevhaAdSoyadUnvanTx": "ERKAN YÜKSEL",
    "ceEVergiLevhaTcknTx": "23297037542",
    "ceEVergiLevhaOnayZamanTx": "09/03/2026 03:14:30",
    "message": ""
  }
}
```

**Güncel Levha Zaten Varsa (message dolu gelir):**
```json
{
  "data": {
    "ceEVergiLevhaOnayKoduTx": "4YP6RMMCZFC4",
    "ceEVergiLevhaOnayZamanTx": "09/03/2026 03:14:30",
    "message": "9930091870 Vergi Kimlik Numaralı mükellefe ait güncel vergi levhası sistemde mevcut.<br>Yeni vergi levhası oluşturulmamıştır."
  }
}
```

### 1.5 PDF İndirme

**Yöntem:** GET isteği

**URL:**
```
GET https://intvrg.gib.gov.tr/intvrg_server/goruntuleme
  ?cmd=IMAJ
  &subcmd=IVD_VRG_LVH_GORUNTULE
  &onayKodu={onayKodu}
  &vrgLvhBoyut=buyuk
  &vrgLvhRenk=gri
  &goruntuTip=2
  &token={urlEncodedIvdToken}
```

**Parametreler:**
| Parametre | Değer | Açıklama |
|-----------|-------|----------|
| `cmd` | `IMAJ` | Sabit |
| `subcmd` | `IVD_VRG_LVH_GORUNTULE` | Sabit |
| `onayKodu` | ör. `4YP6RMMCZFC4` | Oluştur yanıtından |
| `vrgLvhBoyut` | `buyuk` | Sabit (büyük boyut) |
| `vrgLvhRenk` | `gri` | Varsayılan: gri |
| `goruntuTip` | `2` | Sabit |
| `token` | URL-encoded IVD token | Auth |

**Yanıt:** `application/pdf` formatında PDF dosyası

### 1.6 İstek Başlıkları (Tüm dispatch çağrıları)
```
Accept: application/json, text/javascript, */*; q=0.01
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Origin: https://intvrg.gib.gov.tr
Referer: https://intvrg.gib.gov.tr/intvrg_side/main.jsp?token={token}&appName=tdvd
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...
```

---

## 2. Mimari Kararlar

| Karar | Detay | Gerekçe |
|-------|-------|---------|
| **Login** | Mali müşavir GİB bilgileriyle TEK login | Her mükellef için ayrı login gereksiz, INTVRG tek login ile tüm mükellefleri sorgulayabiliyor |
| **VKN/TCKN** | 11 hane → TCKN (şahıs/basit usul), 10 hane → VKN (firma) | GİB şahıslar için VKN kabul etmiyor |
| **PDF renk** | Varsayılan `gri` | Kullanıcı kararı |
| **Storage** | Supabase Storage: `vergi-levhasi/{tenantId}/{customerId}/{onayKodu}.pdf` | Mevcut altyapı |
| **Arşiv kaydı** | `query_archives` tablosu, `queryType: "vergiLevhasi"` | Mevcut pattern |
| **Tekli dialog** | YOK — tek "Sorgula" butonu | Zaten tek login, toplu dialog'da mükellef seçimi yeterli |
| **Tekrar sorgulama** | Sorgulanmamışlar → otomatik, sorgulanmışlar → kullanıcıya sor | Gereksiz GİB yükünü önle |
| **Token refresh** | 15 dk proaktif refresh (PipelineTokenState pattern) | Uzun toplu sorgularda token expire olabilir |

---

## 3. Etkilenecek Dosyalar

### 3.1 Yeni Dosyalar (8 dosya)

| # | Dosya | Açıklama |
|---|-------|----------|
| 1 | `electron-bot/src/main/intvrg-vergi-levhasi-api.ts` | GİB API modülü — listele, oluştur, PDF indir |
| 2 | `src/app/(dashboard)/dashboard/vergi-levhasi/page.tsx` | Sayfa route (server component) |
| 3 | `src/components/vergi-levhasi/vergi-levhasi-client.tsx` | Ana client component — mükellef listesi, filtreler |
| 4 | `src/components/vergi-levhasi/vergi-levhasi-query-dialog.tsx` | Sorgulama dialog (3+1 aşamalı) |
| 5 | `src/components/vergi-levhasi/hooks/use-vergi-levhasi-query.ts` | WebSocket hook — sorgulama state yönetimi |
| 6 | `src/app/api/intvrg/vergi-levhasi/route.ts` | API — kayıt CRUD, sorgulama durumu |
| 7 | `src/app/api/intvrg/vergi-levhasi-pdf/route.ts` | API — PDF upload/signed URL |
| 8 | `src/components/vergi-levhasi/vergi-levhasi-whatsapp-dialog.tsx` | WhatsApp gönderim dialog |

### 3.2 Düzenlenecek Dosyalar (2 dosya)

| # | Dosya | Değişiklik |
|---|-------|-----------|
| 1 | `src/components/dashboard/nav.tsx` | "Vergi Levhası" menü öğesi ekleme (~satır 125) |
| 2 | `electron-bot/src/main/index.ts` | WebSocket handler ekleme (intvrg:vergi-levhasi-*) |

---

## 4. Uygulama Planı

### Adım 1: Electron Bot API Modülü
**Dosya:** `electron-bot/src/main/intvrg-vergi-levhasi-api.ts`

```typescript
import { gibDijitalLogin } from './earsiv-dijital-api';
import { getIvdToken, IntrvrgClient } from './intvrg-tahsilat-api';

// --- Sabitler ---
const INTVRG_BASE = 'https://intvrg.gib.gov.tr';
const GORUNTULEME_URL = `${INTVRG_BASE}/intvrg_server/goruntuleme`;
const TOKEN_REFRESH_MS = 15 * 60 * 1000; // 15 dakika

// --- Tipler ---
interface VergiLevhasiQueryParams {
  userid: string;         // Mali müşavir GİB kullanıcı kodu
  password: string;       // Mali müşavir GİB şifresi
  captchaApiKey?: string;
  ocrSpaceApiKey?: string;
}

interface MukellefInfo {
  customerId: string;
  vknTckn: string;
  unvan: string;
}

interface VergiLevhasiItem {
  onayzamani: string;     // "20260309031430"
  vergiadi: string;       // "YILLIK GELİR VERGİSİ"
  vdadi: string;          // "TOKAT"
  onaykodu: string;       // "4YP6RMMCZFC4"
  vergikodu: string;      // "0001"
}

interface VergiLevhasiOlusturResult {
  ceEVergiLevhaVergiTur: string;
  ceEVergiLevhaVknTx: string;
  ceEVergiLevhaVdTx: string;
  ceEVergiLevhaOnayKoduTx: string;
  ceEVergiLevhaAdSoyadUnvanTx: string;
  ceEVergiLevhaTcknTx: string;
  ceEVergiLevhaOnayZamanTx: string;
  message: string;
}

interface MukellefResult {
  customerId: string;
  success: boolean;
  onayKodu?: string;
  onayZamani?: string;
  vergiTuru?: string;
  vergiDairesi?: string;
  unvan?: string;
  pdfBase64?: string;
  error?: string;
  alreadyExists?: boolean; // message dolu gelirse
}

interface PipelineTokenState {
  ivdToken: string;
  bearerToken: string;
  timestamp: number;
}

// --- Ana Fonksiyon ---
export async function queryVergiLevhalari(
  params: VergiLevhasiQueryParams,
  mukellefler: MukellefInfo[],
  onProgress: (status: string, current: number, total: number, customerId?: string) => void,
  onResult: (result: MukellefResult) => void,
): Promise<{ success: boolean; totalQueried: number; totalDownloaded: number; totalFailed: number }> {

  // 1. TEK LOGIN
  onProgress('GİB\'e giriş yapılıyor...', 0, mukellefler.length);
  const bearerToken = await gibDijitalLogin(
    params.userid,
    params.password,
    params.captchaApiKey || '',
    params.ocrSpaceApiKey,
  );

  const ivdToken = await getIvdToken(bearerToken);
  const client = new IntrvrgClient(ivdToken, '');

  const tokenState: PipelineTokenState = {
    ivdToken,
    bearerToken,
    timestamp: Date.now(),
  };

  let totalDownloaded = 0;
  let totalFailed = 0;

  // 2. SIRALI SORGULAMA
  for (let i = 0; i < mukellefler.length; i++) {
    const m = mukellefler[i];
    onProgress(`${m.unvan} sorgulanıyor...`, i + 1, mukellefler.length, m.customerId);

    // Token refresh kontrolü
    if (Date.now() - tokenState.timestamp > TOKEN_REFRESH_MS) {
      onProgress('Token yenileniyor...', i + 1, mukellefler.length);
      const newBearer = await gibDijitalLogin(params.userid, params.password, params.captchaApiKey || '', params.ocrSpaceApiKey);
      const newIvd = await getIvdToken(newBearer);
      tokenState.ivdToken = newIvd;
      tokenState.bearerToken = newBearer;
      tokenState.timestamp = Date.now();
      // IntrvrgClient yeniden oluştur
      client = new IntrvrgClient(newIvd, '');
    }

    try {
      // VKN/TCKN ayrımı
      const isGercek = m.vknTckn.length === 11;
      const listeleJp = isGercek
        ? { mukellefVergiNo: '', mukellefTCKimlikNo: m.vknTckn }
        : { mukellefVergiNo: m.vknTckn, mukellefTCKimlikNo: '' };

      // a) Listele
      const listResult = await client.callDispatch<{
        data?: { vrglvh?: VergiLevhasiItem[]; vrglvhListeSize?: number };
        error?: string;
        messages?: Array<{ text: string; type: string }>;
      }>('vergiLevhasiDetay_kayitlariListele', listeleJp);

      // Hata kontrolü
      if (listResult.error === '1' || listResult.messages?.length) {
        const errorMsg = listResult.messages?.[0]?.text || 'Bilinmeyen hata';
        onResult({ customerId: m.customerId, success: false, error: errorMsg });
        totalFailed++;
        continue;
      }

      // b) Oluştur (islemTip: 0 → güncel varsa döner, yoksa oluşturur)
      const olusturResult = await client.callDispatch<{
        data?: VergiLevhasiOlusturResult;
        error?: string;
        messages?: Array<{ text: string; type: string }>;
      }>('vergiLevhasiDetay_olustur', {
        mukellefVkn: m.vknTckn,
        islemTip: 0,
      });

      if (olusturResult.error === '1' || !olusturResult.data?.ceEVergiLevhaOnayKoduTx) {
        const errorMsg = olusturResult.messages?.[0]?.text || 'Vergi levhası oluşturulamadı';
        onResult({ customerId: m.customerId, success: false, error: errorMsg });
        totalFailed++;
        continue;
      }

      const onayKodu = olusturResult.data.ceEVergiLevhaOnayKoduTx;
      const onayZamani = olusturResult.data.ceEVergiLevhaOnayZamanTx;

      // c) PDF indir
      onProgress(`${m.unvan} — PDF indiriliyor...`, i + 1, mukellefler.length, m.customerId);
      const pdfBase64 = await downloadVergiLevhasiPdf(tokenState.ivdToken, onayKodu);

      onResult({
        customerId: m.customerId,
        success: true,
        onayKodu,
        onayZamani,
        vergiTuru: olusturResult.data.ceEVergiLevhaVergiTur,
        vergiDairesi: olusturResult.data.ceEVergiLevhaVdTx,
        unvan: olusturResult.data.ceEVergiLevhaAdSoyadUnvanTx,
        pdfBase64,
        alreadyExists: !!olusturResult.data.message,
      });
      totalDownloaded++;

    } catch (err: any) {
      onResult({
        customerId: m.customerId,
        success: false,
        error: err.message || 'Bilinmeyen hata',
      });
      totalFailed++;
    }
  }

  return {
    success: true,
    totalQueried: mukellefler.length,
    totalDownloaded,
    totalFailed,
  };
}

// --- PDF İndirme ---
async function downloadVergiLevhasiPdf(ivdToken: string, onayKodu: string): Promise<string> {
  const url = new URL(GORUNTULEME_URL);
  url.searchParams.set('cmd', 'IMAJ');
  url.searchParams.set('subcmd', 'IVD_VRG_LVH_GORUNTULE');
  url.searchParams.set('onayKodu', onayKodu);
  url.searchParams.set('vrgLvhBoyut', 'buyuk');
  url.searchParams.set('vrgLvhRenk', 'gri');
  url.searchParams.set('goruntuTip', '2');
  url.searchParams.set('token', ivdToken);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/pdf, */*',
      'Referer': `${INTVRG_BASE}/intvrg_side/main.jsp?token=${ivdToken}&appName=tdvd`,
    },
  });

  if (!response.ok) {
    throw new Error(`PDF indirilemedi: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
}
```

**Referans dosya:** `electron-bot/src/main/intvrg-tahsilat-api.ts` (IntrvrgClient, getIvdToken)
**Referans dosya:** `electron-bot/src/main/earsiv-dijital-api.ts` (gibDijitalLogin)

### Adım 2: WebSocket Handler
**Dosya:** `electron-bot/src/main/index.ts`
**Konum:** Mevcut INTVRG handler'larının sonuna (OKC handler'ından sonra, ~satır 2432+)

```typescript
// --- Aktif sorgu Map'i (dosya başında diğer Map'lerle birlikte) ---
const activeVergiLevhasiQueries = new Map<string, boolean>();

// --- WebSocket Handler ---
wsClient.on('intvrg:vergi-levhasi-query', async (data: BotCommandData) => {
  const requesterId = data.userId as string | undefined;

  const queryKey = `vergi-levhasi-${data.userid}`;
  if (activeVergiLevhasiQueries.has(queryKey)) {
    wsClient?.send('intvrg:vergi-levhasi-error', {
      error: 'Zaten bir vergi levhası sorgulaması devam ediyor',
      errorCode: 'QUERY_IN_PROGRESS',
      requesterId,
    });
    return;
  }
  activeVergiLevhasiQueries.set(queryKey, true);

  const TIMEOUT_MS = 10 * 60 * 1000; // 10 dakika (çok mükellef olabilir)
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
  );

  try {
    const { queryVergiLevhalari } = await import('./intvrg-vergi-levhasi-api');

    const mukellefler = (data.mukellefler as Array<{
      customerId: string;
      vknTckn: string;
      unvan: string;
    }>) || [];

    const queryWork = async () => {
      return await queryVergiLevhalari(
        {
          userid: data.userid as string,
          password: data.password as string,
          captchaApiKey: data.captchaApiKey as string,
          ocrSpaceApiKey: data.ocrSpaceApiKey as string | undefined,
        },
        mukellefler,
        (status, current, total, customerId) => {
          wsClient?.send('intvrg:vergi-levhasi-progress', {
            status, current, total, customerId, requesterId,
          });
        },
        (result) => {
          wsClient?.send('intvrg:vergi-levhasi-result', {
            ...result, requesterId,
          });
        },
      );
    };

    const result = await Promise.race([queryWork(), timeoutPromise]);
    wsClient?.send('intvrg:vergi-levhasi-complete', {
      ...result, requesterId,
    });

  } catch (e: any) {
    // Standart hata mapping (beyanname handler'daki gibi)
    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = e.message || 'Vergi levhası sorgulama hatası';

    if (e.message === 'TIMEOUT') { errorCode = 'TIMEOUT'; errorMessage = 'Sorgulama zaman aşımına uğradı.'; }
    else if (e.message?.startsWith('AUTH_FAILED')) { errorCode = 'AUTH_FAILED'; }
    else if (e.message?.startsWith('CAPTCHA_FAILED') || e.message?.startsWith('CAPTCHA_SERVICE_DOWN')) { errorCode = 'CAPTCHA_FAILED'; }
    else if (e.message?.startsWith('GIB_MAINTENANCE')) { errorCode = 'GIB_MAINTENANCE'; }
    else if (e.message?.startsWith('IVD_TOKEN_FAILED') || e.message?.startsWith('IVD_SESSION_EXPIRED')) { errorCode = 'IVD_ERROR'; }

    wsClient?.send('intvrg:vergi-levhasi-error', {
      error: errorMessage, errorCode, requesterId,
    });
  } finally {
    activeVergiLevhasiQueries.delete(queryKey);
  }
});
```

**WebSocket Event Haritası:**
| Yön | Event | Açıklama |
|-----|-------|----------|
| Frontend → Bot | `intvrg:vergi-levhasi-query` | Sorgulama başlat |
| Bot → Frontend | `intvrg:vergi-levhasi-progress` | İlerleme güncellemesi |
| Bot → Frontend | `intvrg:vergi-levhasi-result` | Tek mükellef sonucu |
| Bot → Frontend | `intvrg:vergi-levhasi-complete` | Tüm sorgulama tamamlandı |
| Bot → Frontend | `intvrg:vergi-levhasi-error` | Hata |

### Adım 3: Backend API Routes

#### 3a. Vergi Levhası Kayıt/Durum API
**Dosya:** `src/app/api/intvrg/vergi-levhasi/route.ts`

```typescript
// GET: Mükellef vergi levhası durumlarını döner
// Query: ?customerId=xxx (opsiyonel, yoksa tümü)
// Response: { items: VergiLevhasiRecord[] }

// POST: Vergi levhası sonucunu kaydet (PDF + metadata)
// Body: { customerId, onayKodu, onayZamani, vergiTuru, vergiDairesi, unvan, pdfBase64 }
// İşlem: 1) PDF'i Supabase'e yükle  2) documents tablosuna kaydet  3) query_archives güncelle
```

**Referans pattern:** `src/app/api/intvrg/beyanname-bulk-save/route.ts`

**Supabase Storage path:** `{tenantId}/{customerId}/VergiLevhasi/{onayKodu}.pdf`
**Document fileCategory:** `"VERGI_LEVHASI"`
**queryType:** `"vergiLevhasi"`

**query_archives kaydı:**
- `month`: Onay zamanından parse edilen ay
- `year`: Onay zamanından parse edilen yıl
- `resultData`: `[{ onayKodu, onayZamani, vergiTuru, vergiDairesi, unvan }]`
- `totalCount`: 1 (her seferinde bir levha)

#### 3b. Vergi Levhası PDF API
**Dosya:** `src/app/api/intvrg/vergi-levhasi-pdf/route.ts`

```typescript
// GET: Signed URL döner
// Query: ?customerId=xxx&onayKodu=xxx
// Response: { signedUrl, fileName }

// Referans: src/app/api/intvrg/beyanname-pdf/route.ts
```

### Adım 4: Frontend — Sayfa
**Dosya:** `src/app/(dashboard)/dashboard/vergi-levhasi/page.tsx`

```typescript
// Server component — beyannameler/page.tsx ile aynı pattern
// 1. Auth check
// 2. Prisma: customers.findMany (id, unvan, kisaltma, vknTckn, sirketTipi, email, telefon1)
// 3. orderBy: sirketTipi asc, siraNo asc, unvan asc
// 4. Pass to VergiLevhasiClient

// NOT: hasGibCredentials GEREKMEZ (mali müşavir bilgileri kullanılıyor)
// Ama email ve telefon1 gerekli (WhatsApp/Mail için)
```

**Referans:** `src/app/(dashboard)/dashboard/beyannameler/page.tsx` (satır 1-52)

### Adım 5: Frontend — Ana Client Component
**Dosya:** `src/components/vergi-levhasi/vergi-levhasi-client.tsx`

**State:**
```typescript
const [customers, setCustomers] = useState<CustomerInfo[]>(initialCustomers);
const [filter, setFilter] = useState<'all' | 'queried' | 'not-queried'>('all');
const [searchTerm, setSearchTerm] = useState('');
const [queryDialogOpen, setQueryDialogOpen] = useState(false);
const [pdfPreview, setPdfPreview] = useState<PdfPreviewData | null>(null);
const [whatsappDialog, setWhatsappDialog] = useState<{open: boolean; customer: CustomerInfo | null}>({open: false, customer: null});
const [mailDialog, setMailDialog] = useState<{open: boolean; customer: CustomerInfo | null}>({open: false, customer: null});
```

**Sayfa yüklendiğinde:**
1. `/api/query-archives/customer-status?queryType=vergiLevhasi` ile son sorgulama tarihlerini al
2. Her müşteriye `lastVergiLevhasiQueryAt` ekle
3. `/api/intvrg/vergi-levhasi` ile mevcut kayıtları (onayKodu, onayZamani) al

**UI Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  Vergi Levhası                              [Sorgula]        │
│  ────────────────────────────────────────────────────────────│
│  🔍 Ara...    Filtre: [Tümü ▾] [Sorgulandı ▾] [Sorgulanmadı]│
│  ────────────────────────────────────────────────────────────│
│  ┌──────────────────────────────────────────────────────────┐│
│  │ ABC İnşaat Ltd.Şti.                                     ││
│  │ 🟢 Sorgulandı · 09/03/2026 · Onay: 4YP6RMMCZFC4  📱 ✉️││
│  ├──────────────────────────────────────────────────────────┤│
│  │ XYZ Ticaret A.Ş.                                        ││
│  │ ⚪ Sorgulanmadı                                          ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ Mehmet Yılmaz                                            ││
│  │ ⚠️ Mükellefiyet bulunamadı                               ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

**Satır tıklama:** Sorgulanmışsa → PDF preview dialog açılır (signed URL ile)
**Badge durumları:**
- `🟢 Sorgulandı` — Yeşil badge, tarih + onay kodu gösterilir
- `⚪ Sorgulanmadı` — Gri badge
- `⚠️ Mükellefiyet bulunamadı` — Sarı/amber badge (hata durumu)
- `❌ Hata` — Kırmızı badge (genel hata)

**WhatsApp/Mail butonları:** Sadece sorgulanmış mükelleflerde gösterilir

### Adım 6: Frontend — Sorgulama Dialog
**Dosya:** `src/components/vergi-levhasi/vergi-levhasi-query-dialog.tsx`

**Aşamalar:**

**Aşama 1 — Mükellef Seçimi:**
```
┌─────────────────────────────────────────────────────────────┐
│  Vergi Levhası Sorgulama                               [✕] │
│  ─────────────────────────────────────────────────────────  │
│  🔍 Mükellef ara...                                        │
│  ☑ Tümünü Seç / Tümünü Kaldır                             │
│  ───────────────────────────────────────────────────────── │
│  ☑ ABC İnşaat Ltd.Şti.        🟢 Sorgulandı (09/03)      │
│  ☑ XYZ Ticaret A.Ş.           ⚪ Sorgulanmadı              │
│  ☑ Mehmet Yılmaz               ⚪ Sorgulanmadı              │
│  ☐ Ayşe Demir                  🟢 Sorgulandı (09/03)      │
│  ───────────────────────────────────────────────────────── │
│  Seçili: 3 mükellef                                        │
│                                              [Sorgula]     │
└─────────────────────────────────────────────────────────────┘
```

**Ara Aşama — Tekrar Sorgulama Uyarısı (sadece gerekirse):**
```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ Daha Önce Sorgulanmış Mükellefler                      │
│  ─────────────────────────────────────────────────────────  │
│  Aşağıdaki mükellefler daha önce sorgulanmış:              │
│                                                             │
│  • ABC İnşaat Ltd.Şti.     Son: 09/03/2026                 │
│                                                             │
│  Bu mükellefleri tekrar sorgulamak ister misiniz?           │
│                                                             │
│  [Dahil Et — Tekrar Sorgula]  [Çıkar — Sadece Yeniler]    │
└─────────────────────────────────────────────────────────────┘
```

**Mantık:**
- Seçilen mükelleflerden `lastVergiLevhasiQueryAt` olanlar ayrılır
- Hiç sorgulanmamışlar → doğrudan sorgulama listesine
- Daha önce sorgulanmışlar → kullanıcıya sorulur
- "Dahil Et" → hepsi sorgulanır
- "Çıkar" → sadece yeniler sorgulanır

**Aşama 2 — İlerleme:**
```
┌─────────────────────────────────────────────────────────────┐
│  Vergi Levhası Sorgulanıyor...                             │
│  ─────────────────────────────────────────────────────────  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ %60    3/5                  │
│                                                             │
│  🔄 Mehmet Yılmaz — Sorgulanıyor...                        │
│  ✅ ABC İnşaat Ltd.Şti. — İndirildi                        │
│  ✅ XYZ Ticaret A.Ş. — İndirildi                           │
│                                                             │
│  Geçen süre: 00:12                                         │
└─────────────────────────────────────────────────────────────┘
```

**Aşama 3 — Sonuçlar:**
```
┌─────────────────────────────────────────────────────────────┐
│  ✅ Sorgulama Tamamlandı                                    │
│  ─────────────────────────────────────────────────────────  │
│  5 mükellef sorgulandı · 4 başarılı · 1 başarısız          │
│                                                             │
│  ✅ ABC İnşaat Ltd.Şti.    — PDF indirildi                 │
│  ✅ XYZ Ticaret A.Ş.       — PDF indirildi                 │
│  ✅ Mehmet Yılmaz           — PDF indirildi                 │
│  ✅ Fatma Kaya              — PDF indirildi                 │
│  ⚠️ Ali Veli               — Mükellefiyet bulunamadı       │
│                                                             │
│                              [Yeni Sorgulama]  [Kapat]     │
└─────────────────────────────────────────────────────────────┘
```

### Adım 7: Frontend — WebSocket Hook
**Dosya:** `src/components/vergi-levhasi/hooks/use-vergi-levhasi-query.ts`

**State yönetimi:**
```typescript
type QueryStage = 'idle' | 'selecting' | 'confirming' | 'querying' | 'complete' | 'error';

interface VergiLevhasiQueryState {
  stage: QueryStage;
  selectedCustomerIds: string[];
  progress: { current: number; total: number; status: string; currentCustomerId?: string };
  results: MukellefResult[];
  error?: string;
}
```

**WebSocket event mapping:**
- `intvrg:vergi-levhasi-progress` → progress güncelle
- `intvrg:vergi-levhasi-result` → sonuç ekle + API'ye kaydet
- `intvrg:vergi-levhasi-complete` → stage = 'complete'
- `intvrg:vergi-levhasi-error` → stage = 'error'

**Sonuç geldiğinde (her mükellef için):**
1. Başarılıysa → `POST /api/intvrg/vergi-levhasi` ile kaydet (PDF + metadata)
2. Başarısızsa → hata kaydını state'e ekle
3. Ana sayfadaki listeyi güncelle

### Adım 8: Navigation Menü Güncellemesi
**Dosya:** `src/components/dashboard/nav.tsx`
**Konum:** ~satır 125, "E-Defter Kontrol" öğesinden sonra

```typescript
{
    title: "Vergi Levhası",
    href: "/dashboard/vergi-levhasi",
    icon: FileCheck,  // lucide-react'ten
},
```

**Icon seçenekleri:** `FileCheck`, `FileBadge`, `FileText2`, `Award` (Lucide)

### Adım 9: WhatsApp Dialog
**Dosya:** `src/components/vergi-levhasi/vergi-levhasi-whatsapp-dialog.tsx`

**Referans:** `src/components/beyannameler/beyanname-whatsapp-dialog.tsx`

**Farklılıklar:**
- Mesaj şablonu: `"{unvan} Vergi Levhası ({onayZamani})"`
- Tek PDF (beyannamelerde birden fazla olabilir)
- Dönem yerine onay tarihi gösterilir

### Adım 10: Mail Dialog & PDF Preview

**Mail Dialog:** `src/components/beyannameler/beyanname-mail-dialog.tsx` **reuse edilebilir** — generic bir bileşen.
- Subject: `"{unvan} Vergi Levhası"`
- Attachment: signed URL ile PDF

**PDF Preview:** `src/components/beyannameler/pdf-preview-dialog.tsx` **doğrudan reuse edilecek**.
- Import: `import PdfPreviewDialog from "@/components/beyannameler/pdf-preview-dialog"`
- `turAdi: "Vergi Levhası"`, `donem: onayZamani`, `customerName: unvan`

---

## 5. Teknik Notlar

### 5.1 Token Yönetimi
- IVD token 15-20 dk expire olabilir
- 50 mükellef × 3-5 sn = ~250 sn (~4 dk) — genelde sorun olmaz
- 100+ mükellef için proaktif refresh gerekli
- Pattern: `PipelineTokenState` (beyanname modülünden)

### 5.2 Hata Senaryoları
| Hata | ErrorCode | UI Davranışı |
|------|-----------|-------------|
| Mali müşavir GİB bilgileri yanlış | `AUTH_FAILED` | Dialog'da hata, ayarlara yönlendir |
| Captcha çözülemedi | `CAPTCHA_FAILED` | "Tekrar Dene" butonu |
| GİB bakımda | `GIB_MAINTENANCE` | Genel bilgi mesajı |
| Token expired | `IVD_ERROR` | Otomatik retry (token refresh) |
| Mükellefiyet yok | — | Mükellef sonucunda `success: false`, badge ile göster |
| Network hatası | `NETWORK_ERROR` | Bağlantı uyarısı |
| Timeout (10 dk) | `TIMEOUT` | Zaman aşımı mesajı |

### 5.3 Supabase Storage
- **Bucket:** `smmm-documents` (mevcut)
- **Path:** `{tenantId}/{customerId}/VergiLevhasi/{onayKodu}.pdf`
- **Upload:** `adminUploadFile()` — RLS bypass
- **Signed URL:** `getSignedUrl(path, 600)` — 10 dk geçerli
- **Referans:** `src/lib/storage-supabase.ts`

### 5.4 Documents Tablosu Kaydı
```typescript
{
  name: `${vknTckn}_VERGILEVHASI_${onayKodu}.pdf`,
  originalName: `Vergi Levhası - ${unvan} (${onayZamani})`,
  type: "pdf",
  mimeType: "application/pdf",
  size: buffer.length,
  path: storagePath,
  storage: "supabase",
  year: parseInt(onayZamani.substring(6, 10)),  // "09/03/2026" → 2026
  month: parseInt(onayZamani.substring(3, 5)),   // "09/03/2026" → 3
  vknTckn: customer.vknTckn,
  fileCategory: "VERGI_LEVHASI",
  customerId,
  tenantId,
  parentId: folderId,  // ensureVergiLevhasiFolderChain()
}
```

### 5.5 Klasör Yapısı
```
Müşteri Kök/
  └─ Vergi Levhası/
      └─ {onayKodu}.pdf
```
Yıl klasörü gereksiz — vergi levhası genellikle yılda bir kez güncellenir, doğrudan `Vergi Levhası` klasörü altında tutulabilir.

### 5.6 query_archives Kaydı
```typescript
{
  queryType: "vergiLevhasi",
  month: onayAy,   // Onay zamanından
  year: onayYil,   // Onay zamanından
  resultData: [{
    onayKodu: "4YP6RMMCZFC4",
    onayZamani: "09/03/2026 03:14:30",
    vergiTuru: "YILLIK GELİR VERGİSİ",
    vergiDairesi: "TOKAT",
    unvan: "ERKAN YÜKSEL",
  }],
  totalCount: 1,
}
```

---

## 6. Mevcut Dosya Referansları

| Referans | Dosya | Ne İçin |
|----------|-------|---------|
| Page pattern | `src/app/(dashboard)/dashboard/beyannameler/page.tsx` | Server component yapısı |
| Client component | `src/components/beyannameler/beyanname-arsiv-client.tsx` | UI layout, filtre, state |
| Query dialog | `src/components/beyannameler/beyanname-bulk-query-dialog.tsx` | 3 aşamalı dialog |
| WebSocket hook | `src/components/beyannameler/hooks/use-beyanname-query.ts` | Hook pattern |
| PDF preview | `src/components/beyannameler/pdf-preview-dialog.tsx` | Reuse edilecek |
| WhatsApp dialog | `src/components/beyannameler/beyanname-whatsapp-dialog.tsx` | Template |
| Mail dialog | `src/components/beyannameler/beyanname-mail-dialog.tsx` | Reuse edilecek |
| Bulk save API | `src/app/api/intvrg/beyanname-bulk-save/route.ts` | Storage pattern |
| PDF API | `src/app/api/intvrg/beyanname-pdf/route.ts` | Signed URL pattern |
| Customer status | `src/app/api/query-archives/customer-status/route.ts` | Sorgulama durumu |
| Nav menu | `src/components/dashboard/nav.tsx` | Menü ekleme (satır ~125) |
| IntrvrgClient | `electron-bot/src/main/intvrg-tahsilat-api.ts` | Client class (satır 160-217) |
| GİB login | `electron-bot/src/main/earsiv-dijital-api.ts` | gibDijitalLogin (satır 144-293) |
| WS handler pattern | `electron-bot/src/main/index.ts` | Handler template (satır 1354-1488) |
| GİB settings | `src/app/api/settings/gib/route.ts` | Credential fetch |
| Storage utils | `src/lib/storage-supabase.ts` | Upload/download helpers |
| Folder chain | `src/lib/file-system.ts` | ensureBeyannameFolderChainLocked (satır 424-448) |
| Crypto | `src/lib/crypto.ts` | encrypt/decrypt |

---

## 7. Uygulama Sırası (Önerilen)

```
1. electron-bot/src/main/intvrg-vergi-levhasi-api.ts  → Bot API modülü
2. electron-bot/src/main/index.ts                      → WebSocket handler
3. src/app/api/intvrg/vergi-levhasi/route.ts           → Backend kayıt API
4. src/app/api/intvrg/vergi-levhasi-pdf/route.ts       → PDF API
5. src/app/(dashboard)/dashboard/vergi-levhasi/page.tsx → Sayfa
6. src/components/vergi-levhasi/hooks/use-vergi-levhasi-query.ts → Hook
7. src/components/vergi-levhasi/vergi-levhasi-query-dialog.tsx   → Dialog
8. src/components/vergi-levhasi/vergi-levhasi-client.tsx          → Ana UI
9. src/components/vergi-levhasi/vergi-levhasi-whatsapp-dialog.tsx → WhatsApp
10. src/components/dashboard/nav.tsx                    → Menü ekleme
```

---

## 8. Doğrulama Kontrol Listesi

- [ ] Mali müşavir GİB bilgileri ayarlardan okunuyor
- [ ] TEK login ile tüm mükellefler sorgulanıyor
- [ ] VKN (10 hane) / TCKN (11 hane) ayrımı doğru çalışıyor
- [ ] PDF gri renkte indiriliyor
- [ ] PDF Supabase Storage'a yükleniyor
- [ ] documents tablosuna kayıt oluşturuluyor
- [ ] query_archives tablosuna kayıt oluşturuluyor
- [ ] Tekrar sorgulama uyarısı gösteriliyor
- [ ] Sorgulanmamışlar otomatik, sorgulanmışlar kullanıcı seçimine bırakılıyor
- [ ] Mükellefiyeti olmayan mükellefler uygun badge ile gösteriliyor
- [ ] PDF dialog'da görüntüleniyor
- [ ] WhatsApp gönderimi çalışıyor
- [ ] Mail gönderimi çalışıyor
- [ ] Token 15 dk'da refresh ediliyor
- [ ] Hata senaryoları doğru handle ediliyor
- [ ] Nav menüde "Vergi Levhası" görünüyor
- [ ] tenantId filtresi tüm query'lerde var
