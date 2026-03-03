# Handoff: GİB Mükellef Çekme — Puppeteer → HTTP API Dönüşümü

**Tarih:** 2026-03-03
**Durum:** Tamamlandı

## Görev Tanımı

> Mükellefleri GİB e-Beyan sitesinden çeken bot modülünü Puppeteer'dan HTTP API'ye dönüştür. Buton metnini "GİB" → "Mükellefleri Çek" olarak değiştir.

## Araştırma Bulguları

### HAR Analizi — E-Beyan API Akışı

Mevcut Puppeteer yaklaşımı HTML tablosu scrape ediyor. HAR dosyaları incelendiğinde, GİB'in arkada JSON API'ler kullandığı tespit edildi. **Pagination yok** — API tüm mükellefleri tek response'ta döndürüyor.

**Yeni HTTP API akışı (4 adım):**

```
Adım 1: gibDijitalLogin() → Bearer token  (MEVCUT — earsiv-dijital-api.ts)
Adım 2: GET dijital.gib.gov.tr/apigateway/auth/tdvd/yeni-ebyn-login?platform=prod
         Headers: Authorization: Bearer <token>
         Response: { "redirectUrl": "https://ebeyan.gib.gov.tr/dijital-login?token=<128_hex>" }
Adım 3: GET ebeyan.gib.gov.tr/dijital-login?token=<128_hex>
         → redirect: 'manual' ile çağır, Set-Cookie header'larını yakala
Adım 4: GET ebeyan.gib.gov.tr/api/kullanici/mukellef/mukellef-detay-list
         Headers: Cookie: <step 3'ten gelen cookie'ler>
         Response: TÜM mükellefler tek seferde (pagination yok!)
```

### API Response Yapısı (mukellef-detay-list)

```json
{
  "data": {
    "detayliMukellefList": [
      {
        "adSoyadUnvan": "SERPIL CERITOGLU",
        "tckn": "42577953518",
        "vkn": "2060045298",
        "sozlesmeTipi": "ARACILIK_SORUMLULUK_SOZLESMESI",
        "sozlesmeDurumu": "GECERLI",
        "sozlesmeTarihi": "2011-03-03",
        "sozlesmeSonTarihi": null,
        "sozlesmeBitisAciklamasi": "Devam Ediyor",
        "gecmisBeyanGonderebilirMi": false
      }
    ]
  },
  "messages": null,
  "traceId": "..."
}
```

**Veri eşleme (API → mevcut kayıt yapısı):**

| API Alanı | Hedef Alan | Not |
|-----------|-----------|-----|
| `adSoyadUnvan` | `unvan` | toTitleCase uygula |
| `tckn` | `tcKimlikNo` | Boş string şirketlerde → null yap |
| `vkn` | `vergiKimlikNo`, `vknTckn` | |
| `sozlesmeTipi` | `sozlesmeTipi` | |
| `sozlesmeTarihi` | `sozlesmeTarihi` | ISO format "2011-03-03" |
| `tckn.length === 11` | `sirketTipi` | 11 hane → `sahis`, değilse → `firma` |

### Mevcut Akış (Değişmeyecek Parçalar)

Bu dosyalar **DEĞİŞMEYECEK:**

| Dosya | Neden |
|-------|-------|
| `server.ts:159-208` | `bot:mukellef-data` handler — aynı kalacak |
| `src/app/api/gib/mukellefler/import/route.ts` | Import API — aynı kalacak |
| `src/app/api/gib/mukellefler/sync/route.ts` | Sync trigger API — aynı kalacak |
| `src/app/(dashboard)/dashboard/mukellefler/import-results-dialog.tsx` | Sonuç dialog — aynı kalacak |

### Mevcut Puppeteer Kodu (Değiştirilecek)

- `electron-bot/src/main/gib-mukellef.ts` (555 satır): Tamamı Puppeteer tabanlı, silinecek
- `electron-bot/src/main/index.ts:377-421`: `gib:sync-taxpayers` handler — HTTP API fonksiyonunu çağıracak şekilde değişecek

### Mevcut gibDijitalLogin Pattern

`electron-bot/src/main/earsiv-dijital-api.ts:273-400` — Bu fonksiyonu import edeceğiz:

```typescript
export async function gibDijitalLogin(
  userid: string,
  sifre: string,
  captchaApiKey: string,
  ocrSpaceApiKey?: string,
  onProgress?: (status: string) => void,
): Promise<string>  // Bearer token döner
```

**Endpoints kullandığı:**
- `CAPTCHA: dijital.gib.gov.tr/apigateway/captcha/getnewcaptcha`
- `LOGIN: dijital.gib.gov.tr/apigateway/auth/tdvd/login`
- `USER_INFO: dijital.gib.gov.tr/apigateway/auth/tdvd/user-info`

**Helper'lar (earsiv-dijital-api.ts'den):**
- `getHeaders(token?)` — ortak HTTP header'ları (satır 84-101)
- `sleep(ms)` — delay helper (satır 77-79)
- `USER_AGENT` — sabit User-Agent string (satır 27)

## Etkilenecek Dosyalar

| # | Dosya | Değişiklik | Detay |
|---|-------|-----------|-------|
| 1 | `electron-bot/src/main/ebeyan-mukellef-api.ts` | **YENİ DOSYA** | HTTP API ile mükellef çekme modülü |
| 2 | `electron-bot/src/main/index.ts` | Düzenleme (satır 377-421) | Puppeteer → HTTP API çağrısı |
| 3 | `electron-bot/src/main/gib-mukellef.ts` | **SİLİNECEK** | Puppeteer kodu artık gereksiz |
| 4 | `src/app/(dashboard)/dashboard/mukellefler/client.tsx` | Düzenleme (satır 431-434) | Buton: "GİB" → "Mükellefleri Çek" |

## Uygulama Planı

### Adım 1: `electron-bot/src/main/ebeyan-mukellef-api.ts` oluştur

- [ ] Sabitler tanımla:
  ```typescript
  const DIJITAL_GIB_BASE = 'https://dijital.gib.gov.tr';
  const EBEYAN_BASE = 'https://ebeyan.gib.gov.tr';
  const ENDPOINTS = {
    EBEYAN_TOKEN: `${DIJITAL_GIB_BASE}/apigateway/auth/tdvd/yeni-ebyn-login?platform=prod`,
    EBEYAN_LOGIN: `${EBEYAN_BASE}/dijital-login`,
    MUKELLEF_DETAY_LIST: `${EBEYAN_BASE}/api/kullanici/mukellef/mukellef-detay-list`,
  };
  ```
- [ ] `gibDijitalLogin` fonksiyonunu `earsiv-dijital-api.ts`'den import et
- [ ] `getEbeyanToken(bearerToken: string)` fonksiyonu yaz:
  - `GET /apigateway/auth/tdvd/yeni-ebyn-login?platform=prod`
  - Header: `Authorization: Bearer <token>`
  - Response'tan `redirectUrl` içindeki token'ı parse et
- [ ] `ebeyanLogin(ebeyanToken: string)` fonksiyonu yaz:
  - `GET ebeyan.gib.gov.tr/dijital-login?token=<128hex>`
  - `redirect: 'manual'` kullan (redirect takip etme)
  - `Set-Cookie` header'larını parse et ve string olarak döndür
  - **KRİTİK:** Node.js fetch otomatik cookie yönetimi yapmaz!
- [ ] `fetchMukellefDetayList(cookies: string)` fonksiyonu yaz:
  - `GET /api/kullanici/mukellef/mukellef-detay-list`
  - Header: `Cookie: <cookies>`
  - Response: `data.detayliMukellefList` array'ini döndür
- [ ] `syncMukellefsViaApi(options)` ana fonksiyonu yaz:
  - Adım 1: `gibDijitalLogin()` → Bearer token
  - Adım 2: `getEbeyanToken()` → e-Beyan cross-domain token
  - Adım 3: `ebeyanLogin()` → session cookie'ler
  - Adım 4: `fetchMukellefDetayList()` → mükellef verileri
  - Veri dönüşümü: API response → mevcut taxpayer format
  - `onProgress` callback'leri: progress, mukellef-data, complete, error
  - Aynı options interface: `{ username, password, captchaApiKey, ocrSpaceApiKey?, onProgress }`

### Adım 2: `electron-bot/src/main/index.ts` güncelle (satır 377-421)

- [ ] Import değiştir: `syncGibTaxpayers` → `syncMukellefsViaApi` (ebeyan-mukellef-api.ts'den)
- [ ] `gib:sync-taxpayers` handler'daki `syncGibTaxpayers()` çağrısını `syncMukellefsViaApi()` ile değiştir
- [ ] `ocrSpaceApiKey` parametresini de geç (env'den veya data'dan)
- [ ] `mainWindow?.hide()` ve `mainWindow?.show()` koru (pencere yönetimi)
- [ ] onProgress callback yapısı aynı kalsın

### Adım 3: `electron-bot/src/main/gib-mukellef.ts` sil

- [ ] Dosyayı tamamen sil (555 satır Puppeteer kodu)
- [ ] `index.ts`'teki import'u kaldır

### Adım 4: Buton metnini değiştir

- [ ] `src/app/(dashboard)/dashboard/mukellefler/client.tsx` satır 433:
  - `{gibLoading ? "..." : "GİB"}` → `{gibLoading ? "Çekiliyor..." : "Mükellefleri Çek"}`

## Teknik Notlar

### Cookie Yönetimi (KRİTİK)

`ebeyan.gib.gov.tr/dijital-login?token=...` endpoint'i:
- 302 redirect yapıyor
- httpOnly session cookie'leri set ediyor
- `redirect: 'manual'` ile çağırılmalı
- Response'un `headers.getSetCookie()` veya `headers.get('set-cookie')` ile cookie'ler alınmalı
- Cookie string'i sonraki isteklerde `Cookie` header'ına eklenecek

```typescript
// Cookie parse pattern
const response = await fetch(url, { redirect: 'manual' });
const setCookies = response.headers.getSetCookie?.() || [];
// veya fallback:
const setCookieHeader = response.headers.get('set-cookie') || '';
const cookieString = setCookies.map(c => c.split(';')[0]).join('; ');
```

### Rate Limit

- Login/token istekleri: rate limit yok (BETWEEN_REQUESTS: 100ms yeterli)
- API istekleri arası: 1100ms (BETWEEN_PAGES config)
- Bu modülde sadece 1 API çağrısı var (mukellef-detay-list) — rate limit sorun değil

### Hata Durumları

| Hata | Handling |
|------|----------|
| gibDijitalLogin başarısız | Mevcut hata handling (AUTH_FAILED, CAPTCHA_FAILED) |
| E-Beyan token alınamadı | `EBEYAN_TOKEN_FAILED` error fırlat |
| Cookie alınamadı | `EBEYAN_LOGIN_FAILED` error fırlat |
| Mükellef listesi boş | Uyarı log'la, boş array ile devam et |
| GİB bakımda | `GIB_MAINTENANCE` error (mevcut pattern) |

### sozlesmeDurumu Alanı

API'den yeni gelen `sozlesmeDurumu` alanı:
- `"GECERLI"` → Aktif sözleşme
- `"SOZLESME_DURUMU_SONA_EREN"` → Sona ermiş sözleşme

Bu bilgiyi şimdilik status alanına map'le: `GECERLI` → kaydet, `SONA_EREN` → yine kaydet (import API zaten mevcut kaydı günceller). İleride filtreleme gerekirse ayrı kolon eklenebilir.

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Electron Bot mimarisi korunacak | CLAUDE.md kuralı: GİB istekleri mutlaka Electron'dan | Direkt Next.js server-side (YASAK — IP ban riski) |
| `mukellef-detay-list` kullan | Daha fazla veri içeriyor (tckn, sözleşme detayları) | `mukellef-list` (sadece isim + VKN) |
| Pagination yok | API tek response'ta tümünü döndürüyor | Puppeteer'daki sayfa sayfa gezme (gereksiz) |
| `gibDijitalLogin` import et | DRY — aynı login mekanizması | Login kodunu tekrar yaz (gereksiz tekrar) |
| `redirect: 'manual'` cookie yönetimi | Node.js fetch cookie takip etmez | Cookie jar kütüphanesi (overengineering) |
| gib-mukellef.ts tamamen sil | Puppeteer kodu artık gereksiz | Deprecate et (dosya karmaşası) |
