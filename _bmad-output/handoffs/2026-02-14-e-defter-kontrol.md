# Handoff: E-Defter Kontrol Modülü
**Tarih:** 2026-02-14 19:30
**Durum:** Tamamlandı

## Görev Tanımı
> E-Defter portalındaki paket yükleme durumlarını HTTP API istekleriyle Electron Bot üzerinden sorgulayan yeni modül. Mükellef seçimi + yıl/ay aralığı seçimi ile e-defterlerin (KB, YB, Y) yüklenip yüklenmediğini kontrol eder.

## Araştırma Bulguları

### 1. E-Defter API Endpoint (HAR Analizi)

**Ana Sorgu Endpoint'i:**
```
GET https://edefter.gib.gov.tr/api/v1/edefter/paket/EDEFTER_PAKET_LISTESI_GETIR
  ?donem=YYYYMM   (örnek: 202501)
  &page=0
  &size=1000
```

**Response:**
```json
{
  "status": "1",
  "message": "İşlem Başarılı.",
  "numberOfElements": 3,
  "result": [
    {
      "oid": "3imapqozoq1jun",
      "paketId": "23297037542-202501-KB-000000",
      "islemOid": "3imapqozoq1juo",
      "belgeTuru": "KB",
      "alinmaZamani": "20250527100347",
      "durumKodu": 0,
      "durumAciklama": "Paket başarı ile işlendi.",
      "dfsPath": "23297037542-202501-KB-000000.zip",
      "gibDfsPath": "GIB-23297037542-202501-KB-000000.zip"
    }
  ]
}
```

**Paket Türleri:**
- `KB` — Kebir Defteri (Büyük Defter)
- `YB` — Yevmiye Beyannamesi
- `Y` — Yevmiye Defteri

**Durum Kodları:**
- `0` — Paket başarı ile işlendi
- `numberOfElements: 0` ve boş `result` — O ay için yükleme yok

### 2. Authentication Akışı

**Adım 1: GİB Dijital VD Login (mevcut — değişmeyecek)**
```
gibDijitalLogin(userid, sifre, captchaApiKey, ocrSpaceApiKey)
→ Bearer token (dijital.gib.gov.tr)
```
Referans: `electron-bot/src/main/earsiv-dijital-api.ts:273-426`

**Adım 2: E-Defter Token Exchange (YENİ)**
```
GET https://dijital.gib.gov.tr/apigateway/auth/tdvd/edefter-login
Headers:
  Authorization: Bearer <dijital_vd_token>
  Accept: application/json, text/plain, */*
  User-Agent: Mozilla/5.0 ...
  Origin: https://dijital.gib.gov.tr
  Referer: https://dijital.gib.gov.tr/

Response: {
  "redirectUrl": "https://edefter.gib.gov.tr/global/loginInteraktif?state=<JWT_TOKEN>"
}
```
JWT token `state` query parametresinden parse edilecek.
Pattern: `electron-bot/src/main/intvrg-tahsilat-api.ts:116-154` (getIvdToken)

**Adım 3: E-Defter API Çağrısı**
```
GET https://edefter.gib.gov.tr/api/v1/edefter/paket/EDEFTER_PAKET_LISTESI_GETIR?donem=YYYYMM&page=0&size=1000
Headers:
  Authorization: Bearer <jwt_token>   ← Önce bunu dene
  Accept: */*
  User-Agent: Mozilla/5.0 ...
  Referer: https://edefter.gib.gov.tr/default/list-package
```

> **NOT:** İlk HAR'da explicit Authorization header görünmedi. Önce Bearer dene, çalışmazsa cookie-based flow'a geç (loginInteraktif fetch → Set-Cookie yakala → Cookie header ile API çağrısı).

### 3. Mevcut Referans Dosyalar

| Dosya | Ne İçin Referans |
|-------|-----------------|
| `electron-bot/src/main/earsiv-dijital-api.ts` | gibDijitalLogin(), genel modül yapısı, hata yönetimi |
| `electron-bot/src/main/intvrg-tahsilat-api.ts:116-154` | getIvdToken() — token exchange pattern |
| `electron-bot/src/main/intvrg-tahsilat-api.ts:160-205` | IntrvrgClient — dispatch pattern |
| `electron-bot/src/main/index.ts:791-933` | earsiv:query WebSocket handler — tam handler pattern |
| `src/components/e-arsiv-fatura/e-arsiv-fatura-page.tsx` | UI sayfa yapısı referansı |
| `src/components/e-tebligat/` | Benzer modül UI referansı |
| `src/components/dashboard/nav.tsx` | Sidebar menü yapısı |

## Etkilenecek Dosyalar

| # | Dosya | İşlem | Detay |
|---|-------|-------|-------|
| 1 | `electron-bot/src/main/edefter-api.ts` | **Yeni** | E-Defter HTTP API modülü |
| 2 | `electron-bot/src/main/index.ts` | Düzenleme | `edefter:query` WebSocket handler |
| 3 | `src/app/(dashboard)/dashboard/e-defter-kontrol/page.tsx` | **Yeni** | Sayfa bileşeni |
| 4 | `src/components/e-defter/e-defter-kontrol-page.tsx` | **Yeni** | Ana bileşen (form + tablo) |
| 5 | `src/components/dashboard/nav.tsx` | Düzenleme | Sidebar'a "E-Defter Kontrol" ekle |

## Uygulama Planı

### Adım 1: Electron Bot — E-Defter API Modülü
Dosya: `electron-bot/src/main/edefter-api.ts`

- [ ] Types tanımla (EdefterPaket, EdefterKontrolResult)
- [ ] `getEdefterToken(bearerToken)` — edefter-login endpoint'i + state JWT parse
- [ ] `queryEdefterPaketler(jwtToken, donem)` — tek ay sorgusu
- [ ] `queryEdefterKontrol(params, onProgress, onResults)` — ana orchestration
  - gibDijitalLogin → getEdefterToken → ayları paralel sorgula (aralarında 500ms delay)
- [ ] Hata yönetimi: AUTH_FAILED, TOKEN_EXPIRED, GIB_MAINTENANCE, NETWORK_ERROR
- [ ] 401 durumunda re-login mekanizması (earsiv pattern)

```typescript
// Modül yapısı taslağı
import { gibDijitalLogin } from './earsiv-dijital-api';

const EDEFTER_BASE = 'https://edefter.gib.gov.tr';
const EDEFTER_LOGIN_URL = 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/edefter-login';

const ENDPOINTS = {
  PAKET_LISTESI: `${EDEFTER_BASE}/api/v1/edefter/paket/EDEFTER_PAKET_LISTESI_GETIR`,
} as const;

export interface EdefterPaket {
  oid: string;
  paketId: string;
  islemOid: string;
  belgeTuru: string;        // KB, YB, Y
  alinmaZamani: string;     // "20250527100347"
  durumKodu: number;        // 0 = başarılı
  durumAciklama: string;
  dfsPath: string;
  gibDfsPath: string;
}

export interface EdefterAySonuc {
  donem: string;            // "202501"
  ay: number;               // 1
  yil: number;              // 2025
  paketler: EdefterPaket[];
  kbYuklendi: boolean;
  ybYuklendi: boolean;
  yYuklendi: boolean;
  tamam: boolean;           // 3'ü de yüklendi mi
  yuklemeTarihi: string | null;  // İlk yükleme tarihi
}

export interface EdefterKontrolResult {
  success: boolean;
  vkntckn: string;
  yil: number;
  aylar: EdefterAySonuc[];
  tamamlanan: number;       // Kaç ay tam
  eksik: number;            // Kaç ay eksik
  error?: string;
}

// Token exchange — intvrg-tahsilat-api.ts:getIvdToken pattern'i
async function getEdefterToken(bearerToken: string): Promise<string> {
  const response = await fetch(EDEFTER_LOGIN_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': USER_AGENT,
      'Origin': 'https://dijital.gib.gov.tr',
      'Referer': 'https://dijital.gib.gov.tr/',
    },
  });
  // redirectUrl'den state parametresini parse et
  const data = await response.json();
  const url = new URL(data.redirectUrl);
  return url.searchParams.get('state')!;
}

// Tek ay sorgulama
async function queryDonem(token: string, donem: string): Promise<EdefterAySonuc> {
  const url = `${ENDPOINTS.PAKET_LISTESI}?donem=${donem}&page=0&size=1000`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      // ... standart headers
    },
  });
  // parse & return
}

// Ana fonksiyon — tüm ayları sorgula
export async function queryEdefterKontrol(
  params: EdefterQueryParams,
  onProgress?: (status: string) => void,
  onResults?: (aylar: EdefterAySonuc[]) => void,
): Promise<EdefterKontrolResult> {
  // 1. gibDijitalLogin
  // 2. getEdefterToken
  // 3. basAy-bitAy arası her ay için queryDonem (sıralı, 500ms delay)
  // 4. Sonuçları birleştir
}
```

### Adım 2: Electron Bot — WebSocket Handler
Dosya: `electron-bot/src/main/index.ts`

- [ ] `edefter:query` handler ekle (earsiv:query pattern'ini kopyala — satır 791-933)
- [ ] Gönderilecek WebSocket event'leri:
  - `edefter:query-progress` — { status, customerName, phase }
  - `edefter:query-results` — { aylar, customerName }
  - `edefter:query-complete` — { success, tamamlanan, eksik, customerName }
  - `edefter:query-error` — { error, errorCode, customerName }
- [ ] Aktif sorgu kontrolü (duplicate prevention)
- [ ] 5 dakika timeout

### Adım 3: Dashboard Sayfası
Dosya: `src/app/(dashboard)/dashboard/e-defter-kontrol/page.tsx`

- [ ] Basit page wrapper (mevcut pattern)

### Adım 4: Ana Bileşen
Dosya: `src/components/e-defter/e-defter-kontrol-page.tsx`

- [ ] Mükellef seçimi (mevcut customer select pattern)
- [ ] Yıl seçimi (dropdown, varsayılan: mevcut yıl)
- [ ] Ay aralığı: Başlangıç ay — Bitiş ay (1-12, varsayılan: Ocak-Aralık)
- [ ] "Sorgula" butonu
- [ ] WebSocket bağlantısı (mevcut useWebSocket hook'u kullan)
- [ ] Progress gösterimi
- [ ] Sonuç tablosu
- [ ] Özet bilgi: "X/12 ay tamamlandı (Y eksik)"

**Tablo yapısı:**
```
| Ay       | KB  | YB  | Y   | Yükleme Tarihi | Durum    |
|----------|-----|-----|-----|----------------|----------|
| Ocak     | ✅  | ✅  | ✅  | 27.05.2025     | Tamam    |
| Şubat    | ✅  | ✅  | ✅  | 27.05.2025     | Tamam    |
| ...      |     |     |     |                |          |
| Ekim     | ❌  | ❌  | ❌  | -              | Eksik    |
```

Renk kodlaması:
- Yeşil arka plan: Tamam (3/3 paket yüklendi)
- Kırmızı arka plan: Eksik (hiç yüklenmemiş)
- Sarı arka plan: Kısmen (1 veya 2 paket yüklendi)

### Adım 5: Sidebar Menü
Dosya: `src/components/dashboard/nav.tsx`

- [ ] "E-Defter Kontrol" menü öğesi ekle
- [ ] İkon: `BookCheck` veya `FileCheck` (lucide-react)
- [ ] URL: `/dashboard/e-defter-kontrol`
- [ ] GİB Portal Araçları grubuna ekle

## Teknik Notlar

### Auth Fallback Stratejisi
E-Defter API'si Bearer token kabul etmezse (cookie-based ise):
```typescript
// 1. loginInteraktif'e fetch yap
const loginRes = await fetch(
  `https://edefter.gib.gov.tr/global/loginInteraktif?state=${jwt}`,
  { redirect: 'manual' }
);
// 2. Set-Cookie header'larını yakala
const cookies = loginRes.headers.getSetCookie?.() || [];
// 3. API çağrılarında Cookie header kullan
```

### Paralel Sorgu vs Sıralı Sorgu
- 12 ayı sıralı sorgula, aralarında 500ms delay
- GİB rate-limit riski nedeniyle paralel sorgudan kaçın
- Her ay sorgulandığında onProgress callback çağır

### Ay Formatı
E-Defter API `donem` parametresi: `YYYYMM` (6 karakter)
- Ocak 2025 → `202501`
- Aralık 2025 → `202512`

### alinmaZamani Parse
Format: `"20250527100347"` → `YYYYMMDDHHmmss`
```typescript
function parseAlinmaZamani(raw: string): string {
  if (!raw || raw.length < 8) return '-';
  return `${raw.slice(6,8)}.${raw.slice(4,6)}.${raw.slice(0,4)}`;
}
// "20250527100347" → "27.05.2025"
```

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatif |
|-------|-------|------------|
| Electron Bot üzerinden HTTP API | IP dağıtımı — her mali müşavir kendi IP'sini kullanır | Next.js server-side (TEK IP = ban riski!) |
| Sıralı sorgu (500ms delay) | GİB rate-limit koruması | Paralel sorgu (ban riski) |
| earsiv-dijital-api.ts referans | Aynı login pattern, kanıtlanmış yapı | Yeni pattern (gereksiz) |
| Yıl + ay aralığı seçimi | Tek ay yerine tüm yılı kontrol imkanı | Sadece tek ay seçimi |
| Bearer token öncelikli | Daha basit implementasyon | Cookie-based (karmaşık) |
