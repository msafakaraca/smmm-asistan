# Handoff: SGK E-Bildirge V2 Sorgulama Sayfasi
**Tarih:** 2026-02-22 22:50
**Durum:** Tamamlandi

## Gorev Tanimi
> SGK E-Bildirge V2 sistemine HTTP API ile baglanarak, mukelleflerin onayli bildirgelerini sorgulayan ve PDF'lerini indiren bir modul gelistirilecek. Beyanname sorgulama sayfasiyla (/dashboard/beyannameler) birebir ayni tasarimda bir SGK Sorgulama sayfasi olusturulacak. Ilk fazda tek musteri sorgulama + PDF indirme, ikinci fazda toplu sorgulama eklenecek.

## Arastirma Bulgulari

### 1. SGK E-Bildirge V2 API Analizi (HAR Dosyasindan)

**Base URL:** `https://ebildirge.sgk.gov.tr/EBildirgeV2`
**Framework:** Apache Struts 2 (Java) - `.action` URL'leri, `struts.token.name` parametreleri
**Auth:** Session-based (JSESSIONID cookie + Struts CSRF token zinciri)
**Anti-bot:** Custom JPEG captcha

#### Tam Akis (7 Adim):
```
Adim 1: Login sayfasi yukle       GET  /EBildirgeV2
Adim 2: Captcha resmi al         GET  /EBildirgeV2/PG
Adim 3: Login POST               POST /EBildirgeV2/login/kullaniciIlkKontrollerGiris.action
Adim 4: Onayli Bildirgeler'e git  GET  /EBildirgeV2/tahakkuk/tahakkukonaylanmisTahakkukDonemBilgileriniYukle.action?struts.token.name=token&token=XXX
Adim 5: Donem sorgula            POST /EBildirgeV2/tahakkuk/tahakkukonaylanmisTahakkukDonemSecildi.action
Adim 6: PDF indir                POST /EBildirgeV2/tahakkuk/pdfGosterim.action
Adim 7: Logout                   GET  /EBildirgeV2/logout.jsp
```

#### Adim 3 - Login (POST):
```
URL: /EBildirgeV2/login/kullaniciIlkKontrollerGiris.action
Content-Type: application/x-www-form-urlencoded

Body:
  username={VKN_TCKN}        # 11 karakter, sgkKullaniciAdi
  isyeri_kod={ISYERI_KODU}   # 4 karakter, sgkIsyeriKodu
  password={SISTEM_SIFRE}    # max 10, sgkSistemSifresi
  isyeri_sifre={ISYERI_SIFRE}# max 10, sgkIsyeriSifresi
  isyeri_guvenlik={CAPTCHA}  # captcha cozumu

Headers:
  Origin: https://ebildirge.sgk.gov.tr
  Referer: https://ebildirge.sgk.gov.tr/EBildirgeV2
  Sec-Fetch-Dest: document
  Sec-Fetch-Mode: navigate
  Sec-Fetch-Site: same-origin
  User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...
```

**Response:** HTML sayfa (menu). Icerisinde token barindiran linkler:
```html
<a href="/EBildirgeV2/tahakkuk/tahakkukonaylanmisTahakkukDonemBilgileriniYukle.action?struts.token.name=token&token=2XT722FZ4GHHNP38BHZ95JFUAOVY8N09">
```
Token'i HTML'den parse etmek ZORUNLU.

#### Adim 4 - Donem Secimi Sayfasi (GET):
```
URL: /EBildirgeV2/tahakkuk/tahakkukonaylanmisTahakkukDonemBilgileriniYukle.action
Params: struts.token.name=token&token={LOGIN_RESPONSE_TOKEN}

Response: HTML - Donem secimi formu + yeni token
  - hizmet_yil_ay_index (baslangic donemi dropdown index)
  - hizmet_yil_ay_index_bitis (bitis donemi dropdown index)
  - Gizli token alanlari: <input type="hidden" name="token" value="XXX" />
```

#### Adim 5 - Donem Sorgula (POST):
```
URL: /EBildirgeV2/tahakkuk/tahakkukonaylanmisTahakkukDonemSecildi.action
Content-Type: application/x-www-form-urlencoded

Body:
  struts.token.name=token
  token={PERIOD_PAGE_TOKEN}
  hizmet_yil_ay_index={START_INDEX}      # 1=en yeni ay, geriye dogru artar
  hizmet_yil_ay_index_bitis={END_INDEX}

Donem Index Hesabi:
  index = (currentYear * 12 + currentMonth) - (targetYear * 12 + targetMonth) + 1
  Ornek: Bugun Subat 2026, hedef Ocak 2026 → index = (2026*12+2) - (2026*12+1) + 1 = 2

Response: HTML tablo - "Onayli Bildirge Listesi"
```

#### Response Tablosu Kolonlari:
| Kolon | Aciklama | Ornek |
|-------|----------|-------|
| Tahakkuk Yil/Ay | Tahakkuk donemi | `2026/01` |
| Hizmet Yil/Ay | Hizmet donemi | `2026/01` |
| Belge Turu | Belge tur kodu | `01` |
| Belge Mahiyeti | ASIL/EK | `ASIL` |
| Kanun No | Kanun numarasi | `05510` |
| Toplam Calisan Sayisi | Calisan adet | `10` |
| Toplam Gun Sayisi | Is gunu toplam | `288` |
| Toplam Pek Tutar | Tahakkuk tutar | `342.194,62 TL` |
| Belgeler | PDF indirme linkleri | T, H (SH indirilmeyecek!) |

#### Isyeri Bilgileri (Response Header):
```typescript
interface IsyeriInfo {
  sicilNo: string;          // "2 4791 01 01 1041296 060 01-02 000 001"
  unvan: string;            // "ERKAN YUKSEL"
  adres: string;
  sgmKodAd: string;         // "01-SGK TOKAT SOSYAL GUV.IL MUDURLUGU"
  kanunKapsaminaAlinis: string; // "04/10/2017"
  primOran: string;         // "2,25"
  isyeriTipi: string;       // "Ozel Isyeri"
}
```

#### Adim 6 - PDF Indir (POST):
```
URL: /EBildirgeV2/tahakkuk/pdfGosterim.action
Content-Type: application/x-www-form-urlencoded

Body:
  struts.token.name=token
  token={QUERY_RESPONSE_TOKEN}
  tip={PDF_TYPE}
  download=true
  hizmet_yil_ay_index={START_INDEX}
  hizmet_yil_ay_index_bitis={END_INDEX}
  bildirgeRefNo={REF_NO}      # ornek: "1834-2026-1"

PDF Tipleri (SADECE 2 ADET INDIRILECEK):
  tahakkukonayliFisTahakkukPdf   → SGK Tahakkuk Fisi (T)
  tahakkukonayliFisHizmetPdf     → Hizmet Listesi (H)

  tahakkukonayliFisUcretGizliHizmetPdf → INDIRILMEYECEK (SH/S.Hizmet)

Response: application/pdf binary stream
```

#### Token Zinciri Kurali:
```
Login Response → token A (HTML link'lerden parse)
  → Navigate (token A) → Donem Sayfasi → token B (form hidden field'dan parse)
    → Query (token B) → Sonuc Sayfasi → token C (form hidden field'dan parse)
      → PDF Download (token C)
      → Re-query (token C) → yeni token D
```

Token formati: 32 karakter uppercase alfanumerik, ornek: `2XT722FZ4GHHNP38BHZ95JFUAOVY8N09`

#### Captcha:
```
URL: GET /EBildirgeV2/PG (veya /EBildirgeV2/PG?{timestamp} refresh icin)
Response: image/jpeg (~4-5KB)
Cozum: OCR.space (hizli) veya 2Captcha (fallback) - mevcut GIB captcha pattern'i ile ayni
```

### 2. SGK Credential'lari (Mevcut Yapi)

**DB Alanlari (customers tablosu):**
```prisma
sgkKullaniciAdi   String?  // Encrypted - VKN/TCKN
sgkIsyeriKodu     String?  // Encrypted - 4 karakter
sgkSistemSifresi  String?  // Encrypted
sgkIsyeriSifresi  String?  // Encrypted
```

**Branch destegi de mevcut:** `customer_branches` tablosunda ayni alanlar var.

**Credential Cekme Kodu:**
```typescript
const customer = await prisma.customers.findFirst({
  where: { id: customerId, tenantId: user.tenantId },
  select: {
    id: true, unvan: true, vknTckn: true,
    sgkKullaniciAdi: true, sgkIsyeriKodu: true,
    sgkSistemSifresi: true, sgkIsyeriSifresi: true,
    customer_branches: {
      select: {
        id: true, branchName: true,
        sgkKullaniciAdi: true, sgkIsyeriKodu: true,
        sgkSistemSifresi: true, sgkIsyeriSifresi: true,
      }
    }
  }
});

// Decrypt
const kullaniciAdi = decrypt(customer.sgkKullaniciAdi);
const isyeriKodu = decrypt(customer.sgkIsyeriKodu);
const sistemSifresi = decrypt(customer.sgkSistemSifresi);
const isyeriSifresi = decrypt(customer.sgkIsyeriSifresi);
```

**Onemli:** Branch varsa branch credential'lari kullanilir, yoksa customer credential'lari.

### 3. Dosya Kaydetme Pattern'i (Mevcut Beyanname Sistemi)

#### Klasor Yapisi (SGK icin uyarlanmis - ekran goruntulerine gore):
```
Mukellef /
  SGK Tahakkuk ve Hizmet Listesi /     # type: "sgk"
    ├── Hizmet Listesi /                # type: "hizmet_listesi"
    │   ├── 01/2025 /                   # type: "FOLDER", year: 2025, month: 1
    │   │   └── {VKN}_01_2025-01_HIZMET_LISTESI.pdf
    │   ├── 02/2025 /
    │   └── 01/2026 /
    └── Tahakkuk /                      # type: "sgk_tahakkuk"
        ├── 01/2025 /                   # type: "FOLDER", year: 2025, month: 1
        │   └── {VKN}_01_2025-01_SGK_TAHAKKUK.pdf
        ├── 02/2025 /
        └── 01/2026 /
```

#### Dosya Isimlendirme Pattern'i:
```
{VKN}_{BelgeTuru}_{Year}-{Month}_{FileCategory}.pdf

Ornekler:
  12345678901_01_2026-01_SGK_TAHAKKUK.pdf
  12345678901_01_2026-01_HIZMET_LISTESI.pdf
  12345678901_01_2026-01_SGK_TAHAKKUK_1.pdf     (ikinci bildirge, ayni donem)
  12345678901_01_2026-01_HIZMET_LISTESI_1.pdf   (ikinci bildirge, ayni donem)
```

#### Duplicate Detection:
- **Birincil:** `bildirgeRefNo` (SGK'nin unique ID'si, beyoid karsiligi)
- **Ikincil:** Dosya adi eslestirme (`documents` tablosunda `name` alani ile)
- **Metadata:** `vknTckn`, `beyannameTuru` (belgeTuru), `year`, `month`, `fileCategory`, `fileIndex`

#### Document Kaydi (DB):
```typescript
{
  name: "12345678901_01_2026-01_SGK_TAHAKKUK.pdf",
  originalName: "SGK Tahakkuk - 01/2026.pdf",
  type: "sgk_tahakkuk",          // veya "hizmet_listesi"
  mimeType: "application/pdf",
  isFolder: false,
  parentId: monthYearFolderId,   // "01/2026" klasorunun ID'si
  path: "tenantId/customerId/2026/01/filename.pdf",
  storage: "supabase",
  year: 2026,
  month: 1,
  vknTckn: "12345678901",
  beyannameTuru: "01",           // belge turu kodu
  fileCategory: "SGK_TAHAKKUK",  // veya "HIZMET_LISTESI"
  fileIndex: null,               // veya 1, 2, 3 (coklu bildirge)
  customerId: "xxx",
  tenantId: "yyy"
}
```

#### Supabase Storage Path:
```
{tenantId}/{customerId}/{year}/{month}/{filename}.pdf
```

#### Race Condition Onleme:
- `folderCreationLocks` Map ile Promise deduplication (ayni anda ayni klasor olusturulmaz)

### 4. Beyanname Sayfasi UI Yapisi (Klonlanacak)

#### Sayfa Hiyerarsisi:
```
page.tsx (dynamic import, ssr: false)
  └── sgk-client.tsx (ana component)
        ├── Baslik (Building2 icon + "SGK Sorgulama")
        ├── Filtreler Karti
        │   ├── Mukellef Secimi (Popover + Combobox)
        │   ├── Baslangic Ay/Yil (Select x 2)
        │   ├── Bitis Ay/Yil (Select x 2)
        │   └── Sorgula Butonu
        ├── Ilerleme Gostergesi (sorgu + indirme)
        ├── Hata Mesaji (Alert)
        ├── Sonuc Alani
        │   └── BildirgeGroupList (Tahakkuk ve Hizmet Listesi gruplari)
        │       ├── TahakkukGroup (genisleyebilir)
        │       │   └── BildirgeRow'lar (donem, durum, PDF ikonu)
        │       └── HizmetListesiGroup (genisleyebilir)
        │           └── BildirgeRow'lar
        └── Modals
            └── PdfDialog (PDF goruntuleme)
```

#### Varsayilan Donem: Bir onceki ay (beyanname kurali)
#### Mukellef Secimi: SGK credential kontrolu (gibSifre yerine sgkSistemSifresi)

### 5. WebSocket Event Isimlendirmesi

```
sgk:ebildirge-progress              # Durum guncelleme
sgk:ebildirge-results               # Sorgu sonuclari (bildirge listesi)
sgk:ebildirge-complete              # Sorgu tamamlandi
sgk:ebildirge-pdf-result            # Tek PDF geldi
sgk:ebildirge-pdf-skip              # PDF indirilemedi
sgk:ebildirge-bulk-complete         # Tum PDF'ler indirildi
sgk:ebildirge-pipeline-complete     # Sorgu + indirme tamam
sgk:ebildirge-error                 # Hata
```

### 6. Electron Bot Komut Isimlendirmesi

```
sgk:ebildirge-query-and-download    # Tek musteri sorgu + PDF indirme
```

## Etkilenecek Dosyalar

| # | Dosya | Degisiklik | Detay |
|---|-------|-----------|-------|
| 1 | `electron-bot/src/main/sgk-ebildirge-api.ts` | YENI | SGK Bot modulu (SgkSession sinifi, login, query, PDF download) |
| 2 | `electron-bot/src/main/index.ts` | DUZENLEME | `sgk:ebildirge-query-and-download` komutu ekle |
| 3 | `src/app/api/sgk/ebildirge/route.ts` | YENI | POST: tek musteri sorgu baslat |
| 4 | `src/app/api/sgk/ebildirge-stream-save/route.ts` | YENI | POST: PDF kaydetme (stream-save pattern) |
| 5 | `src/components/sgk-sorgulama/sgk-client.tsx` | YENI | Ana UI (beyanname-client klonu, SGK'ya uyarlanmis) |
| 6 | `src/components/sgk-sorgulama/hooks/use-sgk-query.ts` | YENI | WebSocket hook |
| 7 | `src/app/(dashboard)/dashboard/sgk-sorgulama/page.tsx` | YENI | Sayfa wrapper |
| 8 | `src/components/global-bot-listener.tsx` | DUZENLEME | SGK event'lerini dinle |
| 9 | `src/components/dashboard/nav.tsx` | DUZENLEME | Sidebar'a SGK Sorgulama ekle |
| 10 | `server.ts` | DUZENLEME | Bot komut routing'e SGK ekle |
| 11 | `package.json` | DUZENLEME | `cheerio` dependency ekle |

## Uygulama Plani

### Adim 1: Dependency Kurulumu
- [ ] `cheerio` npm paketi ekle (HTML parsing icin)
- [ ] `tough-cookie` veya `fetch-cookie` (cookie jar icin) - alternatif: Node.js native cookie yonetimi

### Adim 2: Electron Bot - SGK E-Bildirge Modulu
- [ ] `electron-bot/src/main/sgk-ebildirge-api.ts` olustur
- [ ] `SgkSession` sinifini yaz:
  ```typescript
  class SgkSession {
    private cookies: Map<string, string>;  // Cookie jar
    private currentToken: string | null;   // Struts CSRF token

    // Adim 1-2: Login sayfasi + captcha
    async getCaptcha(): Promise<Buffer>    // JPEG buffer dondur

    // Adim 3: Login
    async login(credentials: SgkCredentials, captchaSolution: string): Promise<void>

    // Adim 4: Donem sayfasina git
    async loadPeriodPage(): Promise<{ periodOptions: PeriodOption[], token: string }>

    // Adim 5: Donem sorgula
    async queryPeriod(startIndex: number, endIndex: number): Promise<BildirgeRow[]>

    // Adim 6: PDF indir (SADECE Tahakkuk ve Hizmet Listesi)
    async downloadPdf(bildirgeRefNo: string, tip: 'tahakkuk' | 'hizmet'): Promise<Buffer>

    // Adim 7: Cikis
    async logout(): Promise<void>
  }
  ```
- [ ] HTML parse fonksiyonlari yaz (cheerio ile):
  - `parseLoginResponse(html)` → token cikart (link href'lerden)
  - `parsePeriodPage(html)` → donem secenekleri + token
  - `parseQueryResults(html)` → BildirgeRow[] + isyeri bilgileri + token
- [ ] Captcha cozme entegrasyonu (mevcut OCR.space + 2Captcha pattern'i)
- [ ] Donem index hesaplama fonksiyonu:
  ```typescript
  function calculatePeriodIndex(targetYear: number, targetMonth: number): number {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    return (currentYear * 12 + currentMonth) - (targetYear * 12 + targetMonth) + 1;
  }
  ```
- [ ] `queryAndDownloadPipeline()` ana fonksiyonu yaz (tek musteri, tek donem araliigi)
- [ ] WebSocket callback'leri (progress, results, pdf-result, complete, error)

### Adim 3: Electron Bot - Komut Routing
- [ ] `electron-bot/src/main/index.ts` dosyasina `sgk:ebildirge-query-and-download` komutunu ekle
- [ ] Komut parametreleri: customerId, credentials, dateRange, captchaApiKey, ocrSpaceApiKey
- [ ] WebSocket event gonderim pattern'i (beyanname ile ayni)

### Adim 4: API - Sorgu Baslat
- [ ] `src/app/api/sgk/ebildirge/route.ts` olustur
- [ ] POST handler:
  1. Auth check + tenantId
  2. Customer'i bul, SGK credential'larini decrypt et
  3. SGK credential varligi kontrolu (eksikse 400 don)
  4. Bot baglanti kontrolu
  5. Captcha API key kontrolu
  6. Bot'a `sgk:ebildirge-query-and-download` komutu gonder
  7. Response: { success: true, message: "Sorgu baslatildi" }

### Adim 5: API - Stream Save
- [ ] `src/app/api/sgk/ebildirge-stream-save/route.ts` olustur
- [ ] Beyanname stream-save pattern'ini klonla ve uyarla:
  - Auth cache (30s TTL)
  - Customer cache (module-level)
  - BildirgeRefNo cache (module-level, beyoid karsiligi)
  - Dosya adi eslestirme duplicate detection
- [ ] Klasor yaratma fonksiyonu:
  ```typescript
  async function ensureSgkFolderStructure(
    tenantId, customerId, customerName,
    pdfType: 'tahakkuk' | 'hizmet_listesi',
    year, month
  ): Promise<string> // monthYearFolder ID
  // Hiyerarsi:
  //   Mukellef → SGK Tahakkuk ve Hizmet Listesi → Tahakkuk/Hizmet Listesi → MM/YYYY
  ```
- [ ] Dosya kaydetme + Supabase upload (fire-and-forget)

### Adim 6: Frontend - SGK Sorgulama Sayfasi
- [ ] `src/app/(dashboard)/dashboard/sgk-sorgulama/page.tsx` olustur (dynamic import)
- [ ] `src/components/sgk-sorgulama/sgk-client.tsx` olustur:
  - Beyanname-client'in SGK versiyonu
  - Mukellef secimi (SGK credential kontrolu ile)
  - Donem secimi (baslangic-bitis)
  - Sorgula butonu
  - Sonuc tablosu (Tahakkuk ve Hizmet Listesi gruplari)
  - Her bildirge satiri: donem, belge turu, belge mahiyeti, calisan sayisi, gun sayisi, tutar
  - Tahakkuk ve Hizmet Listesi PDF ikonu (2 buton per row)
  - Isyeri bilgileri paneli (sicil no, unvan, prim oran vb.)
  - Ilerleme gostergesi
  - Hata yonetimi
- [ ] `src/components/sgk-sorgulama/hooks/use-sgk-query.ts` olustur:
  - WebSocket event dinleyici
  - State reducer (beyanname hook pattern'i)
  - PDF cache yonetimi
  - Fire-and-forget stream save cagrilari

### Adim 7: Frontend - Global Bot Listener & Sidebar
- [ ] `src/components/global-bot-listener.tsx` dosyasina SGK event'lerini ekle
- [ ] `src/components/dashboard/nav.tsx` dosyasina SGK Sorgulama linkini ekle:
  ```typescript
  {
    title: "SGK Sorgulama",
    href: "/dashboard/sgk-sorgulama",
    icon: Building2,  // veya ShieldCheck
  }
  ```

### Adim 8: Server - Bot Komut Routing
- [ ] `server.ts` dosyasina SGK komut routing'i ekle (mevcut beyanname pattern'i ile ayni)

## Teknik Notlar

### SGK vs GIB Farklari (KRITIK!)
| Ozellik | GIB (Beyanname) | SGK (E-Bildirge) |
|---------|-----------------|-------------------|
| API Tipi | JSON REST API | HTML Form + Struts |
| Auth | Bearer Token | Session Cookie (JSESSIONID) |
| CSRF | Yok | Struts Token (tek kullanimlik, her sayfada yenilenir) |
| Response | JSON | HTML (cheerio ile parse) |
| Captcha | GIB ozel captcha | SGK ozel JPEG captcha |
| Session | Stateless (token) | Stateful (cookie jar + token zinciri) |
| PDF | GET ile beyoid + token | POST ile bildirgeRefNo + token + tip |

### Captcha Cozme
- OCR.space API (oncelik - hizli): Mevcut `earsiv-dijital-api.ts`deki pattern ayni
- 2Captcha (fallback): Ayni pattern
- SGK captchasi alfanumerik, `R4UP3S` gibi, 6 karakter

### Bir Donemde Birden Fazla Bildirge
- Ayni donemde farkli belge turu (01, 02, vb.) veya farkli kanun numarasi (05510, 6111, vb.) ile birden fazla bildirge olabilir
- Her bildirgenin `bildirgeRefNo` degeri benzersizdir (ornek: `1834-2026-1`)
- `fileIndex` alani ile ayni donem icin coklu dosya destegi saglanacak

### Donem Index Hesabi
```
SGK E-Bildirge dropdown indexi:
  index 1 = en yeni ay (su anki ay)
  index 2 = bir onceki ay
  index N = (N-1) ay oncesi

Formul: index = (currentYear * 12 + currentMonth) - (targetYear * 12 + targetMonth) + 1
Ornek: Bugun Subat 2026, hedef Ocak 2026 → (2026*12+2) - (2026*12+1) + 1 = 2
```

### Cookie Yonetimi
- `JSESSIONID` cookie'si login response'ta set edilir
- Tum sonraki isteklerde bu cookie gonderilmelidir
- `Set-Cookie` header'ini parse edip saklamak gerekir
- `HttpOnly` cookie oldugu icin HAR'da gorulmuyor ama istek zincirinde mevcut olmali

### Token Parse Yontemleri (cheerio)
```typescript
// Login response'tan (link href'lerden):
const $ = cheerio.load(html);
const link = $('a[href*="tahakkukonaylanmisTahakkukDonemBilgileriniYukle"]').attr('href');
const token = new URL('https://base' + link).searchParams.get('token');

// Form hidden field'lardan:
const token = $('input[name="token"]').val();
```

## Kararlar ve Gerekceler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| `cheerio` HTML parser | SGK HTML dondurur, JSON degil. cheerio hafif ve hizli | jsdom (agir), regex (guvenilmez) |
| SgkSession sinifi (stateful) | Token zinciri + cookie jar stateful session gerektiriyor | Stateless fonksiyonlar (GIB pattern'i - SGK'da calismaz) |
| bildirgeRefNo = unique ID | SGK'nin kendi benzersiz referans numarasi | Hash-based ID (gereksiz karmasiklik) |
| S.Hizmet indirilmeyecek | Kullanici karari - sadece Tahakkuk ve Hizmet Listesi yeterli | 3 tip de indir (gereksiz) |
| Ilk faz: tek musteri | SGK API'si ilk kez entegre ediliyor, riskleri test etmek lazim | Direkt bulk (cok riskli) |
| Klasor yapisi: MM/YYYY | Ekran goruntulerine gore mevcut yapi bu sekilde | YYYY/MM (mevcut yapiya aykiri) |
| Stream-save pattern | Beyanname ile tutarli, fire-and-forget, denenmiş yöntem | Toplu kaydetme (yavaş, hata riski) |
