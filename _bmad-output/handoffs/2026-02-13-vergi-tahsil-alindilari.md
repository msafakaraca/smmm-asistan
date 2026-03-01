# Handoff: Vergi Tahsil Alındıları Modülü
**Tarih:** 2026-02-13 16:00
**Durum:** Tamamlandı

## Görev Tanımı
> Mükellefin GİB İnternet Vergi Dairesi'nden tahsilat bilgilerini HTTP API çağrılarıyla çekip kullanıcıya tablo olarak göstermek. Electron Bot üzerinden HTTP API kullanılacak. Captcha çözümü: OCR Space (birincil) + 2Captcha (fallback).

## Araştırma Bulguları

### 1. GİB API Akışı (HAR Dosyalarından)

**Adım 1: GİB Dijital VD Login** (Mevcut - earsiv-dijital-api.ts kullanılacak)
- `GET https://dijital.gib.gov.tr/apigateway/captcha/getnewcaptcha` → captcha al
- `POST https://dijital.gib.gov.tr/apigateway/auth/tdvd/login` → Bearer token al
- `GET https://dijital.gib.gov.tr/apigateway/auth/tdvd/user-info` → session context

**Adım 2: IVD Token Alma** (YENİ)
- `GET https://dijital.gib.gov.tr/apigateway/auth/tdvd/intvrg-login` (Bearer token ile)
- Response: `{"redirectUrl":"https://intvrg.gib.gov.tr/intvrg_side/main.jsp?token=XXXXX&appName=tdvd"}`
- Bu URL'den `token` parametresini parse et

**Adım 3: INTVRG API Çağrıları** (YENİ)
- Base URL: `https://intvrg.gib.gov.tr/intvrg_server/dispatch`
- Method: POST
- Content-Type: `application/x-www-form-urlencoded; charset=UTF-8`
- Headers: `Accept: application/json, text/javascript, */*; q=0.01`

### 2. INTVRG API Endpoint'leri

Tüm çağrılar aynı URL'e POST yapılır, `cmd` parametresi ile ayırt edilir:

#### 2a. Bağlı Vergi Daireleri
```
cmd: sicilIslemleri_loadBagliVD
jp: {"vergiNo":"4310244837"}
Response: {"data":[{"vdKodu":"060260","vdTuru":1,"isyeriTuru":1,"faalKodu":1}]}
```
- `faalKodu: 1` = FAAL (aktif vergi dairesi) → bunu otomatik seçeceğiz

#### 2b. Vergi Türleri Listesi
```
cmd: sicilIslemleri_loadVergiMukellefiyetleri
jp: {"vergiNo":"4310244837"}
Response: {"data":[
  {"vergiAdi":"Hepsi","vergiKodu":"hepsi"},
  {"vergiAdi":"G.STOPAJ","vergiKodu":"0003"},
  {"vergiAdi":"KURUMLAR V.","vergiKodu":"0010"},
  {"vergiAdi":"KDV GERCEK","vergiKodu":"0015"},
  {"vergiAdi":"KUR.GEÇ. V.","vergiKodu":"0033"},
  {"vergiAdi":"KONAKLAMA V.","vergiKodu":"0059"},
  {"vergiAdi":"TURZMPAY AJN","vergiKodu":"0068"}
]}
```

#### 2c. Tahsilat Ana Sorgu (Sorgula butonu)
```
cmd: tahsilatIslemleri_thsSorgula
jp: {"vkn":"4310244837","vd":"060260","vergiKodu":"hepsi","basAy":"01","basYil":"2025","bitAy":"12","bitYil":"2025"}
Response: {
  "data": {
    "vergituru": "HEPSİ",
    "vkntckn": "4310244837",
    "sorgudonemi": "01/2025 - 12/2025",
    "vergidairesi": "060260 - TOKAT",
    "toplamtahsilatsayisi": "63",
    "adsoyadunvan": "GÜNDÜZLÜLER OTELCİLİK...",
    "tahsilatlar": [
      {
        "odemetarihi": "26.02.2025",
        "vergidonem": "01/2025-01/2025",
        "tahsilatoid": "5rm7lmnl3i1206",
        "thsfisno": "20250226/03-FCT/0000511",
        "thkfisno": "20250210/01-FCW/0000009",
        "vergikodu": "0059 - KONAKLAMA V."
      },
      {"ths": "d 0059 - KONAKLAMA V."},  // Separator/ilk satır ikonu (filtrele)
      // ... daha fazla tahsilat
    ]
  }
}
```
**ÖNEMLİ:** Response'taki `tahsilatlar` dizisinde `{"ths": "d ..."}` formatında separator öğeler var. Bunlar filtrelenmeli - sadece `tahsilatoid` içeren öğeler gerçek tahsilat satırlarıdır.

#### 2d. Tahsilat Detay Sorgu (Görüntüle butonu)
```
cmd: tahsilatIslemleri_thsSatirSorgula
jp: {"vdKodu":"060260","tahsilatOid":"5rm7lmnl3i1206","vkn":"4310244837"}
Response: {
  "data": {
    "ths": [
      {"taksitno":"1","thsodenen":"4450.10","detayvergikodu":"0059 - KONAKLAMA V.","thsgzammi":"0.00","thskesinlesengz":"0.00"},
      {"taksitno":"1","thsodenen":"443.70","detayvergikodu":"1048 - 5035SKDAMGAV","thsgzammi":"0.00","thskesinlesengz":"0.00"},
      {"toplamgzammi":"0.00","toplamodenen":"4893.80","toplamkesinlesengz":"0.00"}
    ]
  }
}
```
- Son eleman toplam satırıdır (`toplamodenen` key'i ile ayırt edilir)

### 3. İstek Format Detayı

Tüm INTVRG istekleri `application/x-www-form-urlencoded` formatında:
```
cmd=<KOMUT_ADI>&callid=<SESSION_ID>-<SEQUENCE>&token=<IVD_TOKEN>&jp=<URL_ENCODED_JSON>
```

- `callid`: Benzersiz ID üretilmeli (örn: `${sessionId}-${counter++}`)
- `token`: Adım 2'den alınan IVD token
- `jp`: JSON.stringify → encodeURIComponent

### 4. Mevcut Proje Pattern'leri

#### Login (Yeniden Kullanılacak)
- Dosya: `electron-bot/src/main/earsiv-dijital-api.ts`
- Fonksiyonlar: `gibDijitalLogin()`, `solveCaptcha()`, `solveWithOcrSpace()`, `solveWith2Captcha()`
- Bu dosyadan login ve captcha fonksiyonları import edilecek

#### WebSocket Akışı (Takip Edilecek Pattern)
1. Next.js API → `POST http://localhost:3000/_internal/bot-command`
2. WebSocket Server → Electron Bot'a broadcast
3. Electron Bot handler → `wsClient.on('intvrg:tahsilat-query', ...)`
4. Sonuçlar → `wsClient.send('intvrg:tahsilat-results', data)`

#### Nav Yapısı
- Dosya: `src/components/dashboard/nav.tsx` satır 47-241
- "E-Arşiv Fatura" (satır 81-83) sonrasına eklenecek
- Icon: `Receipt` veya `FileText` (Lucide)

## Etkilenecek Dosyalar

| # | Dosya | Değişiklik | Detay |
|---|-------|-----------|-------|
| 1 | `electron-bot/src/main/intvrg-tahsilat-api.ts` | **Yeni dosya** | INTVRG tahsilat HTTP API servisi (login→token→sorgu→detay) |
| 2 | `electron-bot/src/main/index.ts` | Düzenleme | `wsClient.on('intvrg:tahsilat-query', ...)` handler ekle (satır ~793 civarı, earsiv:query'den sonra) |
| 3 | `src/app/api/intvrg/tahsilat/route.ts` | **Yeni dosya** | POST endpoint - bot'a sinyal gönder |
| 4 | `src/app/(dashboard)/dashboard/tahsilat-alindilari/page.tsx` | **Yeni dosya** | Sayfa componenti |
| 5 | `src/components/tahsilat/tahsilat-client.tsx` | **Yeni dosya** | Client component - filtreler + tablo |
| 6 | `src/components/tahsilat/hooks/use-tahsilat-query.ts` | **Yeni dosya** | WebSocket hook (earsiv hook pattern'i) |
| 7 | `src/components/dashboard/nav.tsx` | Düzenleme | Sidebar'a "Vergi Tahsil Alındıları" menü öğesi ekle |

## Uygulama Planı

### Adım 1: INTVRG Tahsilat API Servisi (Electron Bot)
- [ ] `electron-bot/src/main/intvrg-tahsilat-api.ts` dosyası oluştur
- [ ] `gibDijitalLogin()` fonksiyonunu `earsiv-dijital-api.ts`'den import et
- [ ] `getIvdToken(bearerToken)` fonksiyonu yaz - intvrg-login → token parse
- [ ] `IntrvrgClient` sınıfı oluştur:
  - `constructor(ivdToken, vkn)` - token ve VKN sakla
  - `callDispatch(cmd, jp)` - genel dispatch çağrısı
  - `loadBagliVD()` - vergi daireleri listesi
  - `loadVergiMukellefiyetleri()` - vergi türleri listesi
  - `thsSorgula(params)` - ana tahsilat sorgusu
  - `thsSatirSorgula(params)` - detay sorgusu
- [ ] `queryTahsilatlar()` ana orchestration fonksiyonu:
  1. Login (gibDijitalLogin)
  2. IVD token al (getIvdToken)
  3. Bağlı VD al → FAAL olanı seç
  4. Tahsilat sorgusu yap
  5. Tüm tahsilatlar için detay sorgusu yap (paralel batch)

### Adım 2: Electron Bot Handler
- [ ] `electron-bot/src/main/index.ts`'e `intvrg:tahsilat-query` handler ekle
- [ ] Handler data: `{ userid, password, vkn, basAy, basYil, bitAy, bitYil, captchaApiKey, ocrSpaceApiKey }`
- [ ] Progress event'leri: `intvrg:tahsilat-progress`
- [ ] Results event: `intvrg:tahsilat-results`
- [ ] Error event: `intvrg:tahsilat-error`

### Adım 3: Next.js API Route
- [ ] `src/app/api/intvrg/tahsilat/route.ts` oluştur
- [ ] Auth check + tenant filter
- [ ] Müşteri credential'larını decrypt et
- [ ] vknTckn'yi müşteriden al
- [ ] Bot bağlantı kontrolü
- [ ] Captcha API key'leri al
- [ ] `intvrg:tahsilat-query` sinyali gönder

### Adım 4: WebSocket Hook
- [ ] `src/components/tahsilat/hooks/use-tahsilat-query.ts` oluştur
- [ ] `use-e-arsiv-query.ts` pattern'ini takip et
- [ ] useReducer ile state yönetimi
- [ ] WebSocket dinleme: progress, results, error, complete
- [ ] Types: `TahsilatFis`, `TahsilatDetay`, `TahsilatQueryState`

### Adım 5: UI Componenti
- [ ] `src/app/(dashboard)/dashboard/tahsilat-alindilari/page.tsx` server component
- [ ] `src/components/tahsilat/tahsilat-client.tsx` client component:
  - Mükellef seçimi (combobox)
  - Dönem seçimi: Başlangıç ay/yıl - Bitiş ay/yıl
  - Sorgula butonu
  - Tahsilat tablosu (expandable rows):
    - Ana satır: Vergi Türü | Vergilendirme Dönemi | Ödeme Tarihi | Tahsilat Fiş No | Tahakkuk Fiş No | Görüntüle
    - Detay satır (expand): Vergi Kodu | Taksit No | Ödenen | Gecikme Zammı | Kesinleşen GZ
    - Toplam satır (bold)
  - Excel export

### Adım 6: Sidebar Menü
- [ ] `src/components/dashboard/nav.tsx` satır ~84'e (E-Arşiv Fatura sonrası):
```typescript
{
    title: "Vergi Tahsil Alındıları",
    href: "/dashboard/tahsilat-alindilari",
    icon: Receipt, // veya FileText
},
```

## Teknik Notlar

### Kritik Edge Case'ler
1. **`{"ths": "d ..."}` separator'ler:** Response'taki tahsilatlar dizisinde separator öğeler var. Bunları `tahsilatoid` kontrolü ile filtrele
2. **FAAL vergi dairesi:** `loadBagliVD` sonucunda `faalKodu: 1` olanı otomatik seç
3. **Vergi türü "Hepsi":** Varsayılan olarak `vergiKodu: "hepsi"` kullan
4. **Detay toplam satırı:** `thsSatirSorgula` sonucunda son eleman `toplamodenen` key'i ile toplam satırıdır
5. **Rate limiting:** Detay sorguları arası 500ms delay koy (20 tahsilat = 10 saniye)
6. **Token expiry:** IVD token süresi dolabilir - 401 kontrolü yap

### Captcha Stratejisi (earsiv-dijital-api.ts'den)
1. OCR.space Engine 2 → Engine 2+scale → Engine 1
2. Başarısız olursa 2Captcha fallback
3. Max 3 login denemesi

### INTVRG Dispatch İstek Yapısı
```typescript
const body = new URLSearchParams({
  cmd: 'tahsilatIslemleri_thsSorgula',
  callid: `${sessionId}-${callCounter++}`,
  token: ivdToken,
  jp: JSON.stringify({ vkn, vd, vergiKodu: 'hepsi', basAy, basYil, bitAy, bitYil }),
});

const response = await fetch('https://intvrg.gib.gov.tr/intvrg_server/dispatch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'User-Agent': USER_AGENT,
    'Origin': 'https://intvrg.gib.gov.tr',
    'Referer': 'https://intvrg.gib.gov.tr/intvrg_side/main.jsp?...',
  },
  body,
});
```

### Bağımlılıklar
- `earsiv-dijital-api.ts` → `gibDijitalLogin()`, `solveCaptcha()` (import edilecek, yeniden yazılmayacak)
- WebSocket server zaten `intvrg:` prefix'li event'leri destekleyecek

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Electron Bot üzerinden HTTP API | Kullanıcının isteği, mevcut pattern | Browser automation (daha yavaş) |
| OCR Space + 2Captcha | Kullanıcının isteği, earsiv'de kanıtlanmış | Sadece 2Captcha (daha yavaş) |
| Mevcut gibDijitalLogin() yeniden kullanım | DRY, test edilmiş kod | Yeni login fonksiyonu (gereksiz) |
| Expand/collapse detay satırlar | GİB'deki aynı UX, veri hiyerarşisi | Dialog/modal (daha kötü UX) |
| intvrg:tahsilat-* WebSocket event'leri | earsiv: pattern'i ile tutarlı | REST polling (daha karmaşık) |
