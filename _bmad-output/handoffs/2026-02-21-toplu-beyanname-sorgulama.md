# Handoff: Toplu Beyanname Sorgulama Özelliği

**Tarih:** 2026-02-21
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor

## Görev Tanımı

> Beyannameler sayfasına "Toplu Sorgula" butonu eklenecek. Bu buton GİB şifresi kayıtlı ve sorgulanmamış tüm mükellefleri sıralı olarak sorgulayacak, PDF'leri indirip kaydedecek. Tüm mükelleflerin sorgulaması bitmeden sadece progress bar gösterilecek, bittiğinde sonuç listesi sunulacak ve arşive yönlendirecek.

## Araştırma Bulguları

### Mevcut Mimari
- **Beyanname sorgulama pipeline:** `use-beyanname-query.ts` hook'u TEK mükellef için çalışıyor
- **Stream save pipeline:** Her PDF geldiğinde `POST /api/intvrg/beyanname-stream-save` fire-and-forget çağrılır — yüksek optimize (module cache, paralel upload)
- **Electron Bot:** `intvrg-beyanname-api.ts` — `queryAndDownloadPipeline()` ve `queryBeyannamelerMultiYear()` fonksiyonları mevcut
- **WS mimarisi:** Server.ts relay pattern ile event'leri Electron ↔ Browser arasında iletir
- **Arşiv sayfası:** URL param `customerId` + `autoFilter=true` ile mükellef otomatik filtrelenebilir

### Mevcut Reuse Noktaları
| Fonksiyon | Dosya | Satır | Reuse |
|-----------|-------|-------|-------|
| `gibDijitalLogin()` | `earsiv-dijital-api.ts` | export | Her mükellef için login |
| `getIvdToken()` | `intvrg-tahsilat-api.ts` | L.116-154 | IVD token alma |
| `IntrvrgClient.callDispatch()` | `intvrg-tahsilat-api.ts` | L.160-205 | INTVRG sorgu |
| `splitIntoYearChunks()` | `intvrg-beyanname-api.ts` | L.140-164 | Çoklu yıl bölme |
| `queryAndDownloadPipeline()` | `intvrg-beyanname-api.ts` | L.466+ | Pipeline pattern |
| `broadcastToTenant()` | `server.ts` | L.113-124 | WS relay |
| Stream save API | `/api/intvrg/beyanname-stream-save` | route.ts | Fire-and-forget kaydetme |
| Customer status API | `/api/query-archives/customer-status` | route.ts | Sorgulama durumu |

### Customer Tipi (UI'da)
```typescript
interface Customer {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  hasGibCredentials: boolean;     // gibKodu && gibSifre dolu mu
  lastBeyannameQueryAt: string | null;  // Son sorgulama tarihi
}
```

### WS Event Pattern (Mevcut)
```
intvrg:beyanname-progress
intvrg:beyanname-results
intvrg:beyanname-complete
intvrg:beyanname-bulk-pdf-result
intvrg:beyanname-bulk-complete
intvrg:beyanname-pipeline-complete
```

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `electron-bot/src/main/intvrg-beyanname-api.ts` | Ekleme | `queryBeyannamelerBulk()` fonksiyonu — sıralı mükellef sorgulama |
| `electron-bot/src/main/index.ts` | Ekleme (~390) | `intvrg:beyanname-bulk-start` WS handler + `isBulkRunning` lock |
| `server.ts` | Ekleme (~512) | 9 yeni bulk event relay case'i |
| `src/app/api/intvrg/beyanname/route.ts` | Ekleme | PUT metodu — bulk query endpoint |
| `src/components/beyannameler/beyanname-client.tsx` | Düzenleme | Toplu Sorgula butonu + combobox daraltma + progress/sonuç panel |
| `src/components/global-bot-listener.tsx` | Ekleme (~230) | Bulk event log handler'ları |
| `src/components/beyannameler/beyanname-bulk-query-dialog.tsx` | **Yeni dosya** | Dialog: Sorgulanacak/Sorgulanmayacak sekmeleri + checkbox seçim |
| `src/components/beyannameler/hooks/use-bulk-query.ts` | **Yeni dosya** | Bulk query hook: WS dinleme, state machine, stream-save |

## Uygulama Planı

### Adım 1: Electron Bot — Bulk Query Fonksiyonu
- [ ] `intvrg-beyanname-api.ts`'e `BulkCustomer`, `BulkQueryCallbacks` interface'leri ekle
- [ ] `queryBeyannamelerBulk()` fonksiyonu yaz — sıralı mükellef işleme
- [ ] Her mükellef için: login → sorgu → PDF indirme → callback gönder
- [ ] Hata izolasyonu: bir mükellef hata → diğerine geç
- [ ] 3 saniye mükelleflerin arası bekleme
- [ ] `cancelBulkQuery()` export fonksiyonu (iptal desteği)
- [ ] Bellek yönetimi: PDF base64 gönderdikten sonra null yap

### Adım 2: Electron Bot — WS Handler
- [ ] `index.ts`'e `intvrg:beyanname-bulk-start` handler ekle
- [ ] `isBulkRunning` flag ile çift bulk önleme
- [ ] `intvrg:beyanname-bulk-cancel` handler ekle
- [ ] Tüm callback'leri WS event'lerine bağla

### Adım 3: Server — Relay Events
- [ ] `server.ts`'e 9 yeni case ekle (default öncesi):
  - `intvrg:beyanname-bulk-progress`
  - `intvrg:beyanname-bulk-customer-start`
  - `intvrg:beyanname-bulk-customer-results`
  - `intvrg:beyanname-bulk-pdf-result`
  - `intvrg:beyanname-bulk-customer-complete`
  - `intvrg:beyanname-bulk-customer-error`
  - `intvrg:beyanname-bulk-all-complete`
  - `intvrg:beyanname-bulk-error`
  - `intvrg:beyanname-bulk-cancelled`

### Adım 4: Next.js API — Bulk Query Endpoint
- [ ] `src/app/api/intvrg/beyanname/route.ts`'e PUT metodu ekle
- [ ] `customerIds[]` body parametresi
- [ ] Tüm mükellefleri tek `findMany` ile al (tenantId filter)
- [ ] Her mükellefin GİB credential'larını decrypt et
- [ ] GİB credential eksik olanları filtrele
- [ ] Her mükellef için `savedBeyoids` al (query_archives'den groupBy)
- [ ] `/_internal/bot-command` ile `intvrg:beyanname-bulk-start` gönder
- [ ] Captcha API key'leri mevcut pattern ile al

### Adım 5: Frontend — Toplu Sorgulama Dialog
- [ ] `beyanname-bulk-query-dialog.tsx` oluştur
- [ ] Radix Tabs: "Sorgulanacak" | "Sorgulanmayacak"
- [ ] **Sorgulanacak tab:**
  - Checkbox ile mükellef seçimi (varsayılan: hepsi seçili)
  - "Tümünü Seç / Kaldır" toggle
  - Mükellef adı + VKN + durum etiketi
  - Sayaç: "N mükellef sorgulanacak"
- [ ] **Sorgulanmayacak tab:**
  - GİB Şifresi Eksik grup (kırmızı, üstte)
  - Zaten Sorgulanmış grup (yeşil, altta)
- [ ] Dönem bilgisi gösterimi (sayfadaki seçim)
- [ ] "Sorgulamayı Başlat" butonu

### Adım 6: Frontend — Bulk Query Hook
- [ ] `use-bulk-query.ts` oluştur
- [ ] `useReducer` ile state machine (idle → running → completed)
- [ ] WS event listener'ları (kendi WebSocket bağlantısını dinle)
- [ ] `startBulkQuery(customerIds, dateRange)` → PUT API çağrısı
- [ ] `cancelBulkQuery()` → iptal sinyali
- [ ] Her PDF geldiğinde `POST /api/intvrg/beyanname-stream-save` (fire-and-forget)
- [ ] `activeSavesRef` ile uçuştaki save'leri takip et
- [ ] `customerResults` Map ile mükellef bazlı sonuç takibi

### Adım 7: Frontend — beyanname-client.tsx Değişiklikleri
- [ ] Combobox: `max-w-[400px]` ekle
- [ ] "Toplu Sorgula" butonu ekle (outline variant)
- [ ] `BulkQueryDialog` import + render
- [ ] `useBulkQuery()` hook import
- [ ] Progress panel (bulk running ise sorgulama alanının altında)
- [ ] Sonuç listesi (bulk complete ise progress panelin yerinde)
- [ ] Her satıra tıklama → arşive yönlendirme
- [ ] Geçen süre sayacı (`setInterval`)
- [ ] "İptal Et" butonu

### Adım 8: GlobalBotListener — Bulk Events
- [ ] `global-bot-listener.tsx`'e bulk event case'leri ekle
- [ ] Log paneline basit mesajlar yazma

## Teknik Notlar

### Rate Limiting
- GİB paralel istek reddediyor → sıralı mükellef zorunlu
- Mükelleflerin arası: 3 saniye bekleme
- Her mükellef için yeni login (credentials farklı)
- Token TTL: 25 dakika (intvrg), 10+ mükellefde re-check

### Bellek Yönetimi
- PDF base64 WS ile gönderildikten sonra null yapılmalı
- 50 mükellef × 20 beyanname = yüksek RAM riski → fire-and-forget

### Hata İzolasyonu
- Captcha fail → o mükellef hata, diğerine geç
- Login fail → o mükellef hata, diğerine geç
- PDF indirme fail → beyanname atla, diğerine devam
- WebSocket disconnect → ws-client.ts auto-reconnect + queue

### Concurrent Lock
- Electron tarafında: `isBulkRunning` flag
- İki browser sekmesinden başlatılmaya çalışılırsa → "Zaten devam ediyor" hatası

### Stream Save Pipeline
- Mevcut `beyanname-stream-save` endpoint'i **olduğu gibi** kullanılacak
- `customerId` her PDF ile birlikte geldiğinden doğru mükellefe kaydedilir
- Module-level cache'ler bulk'ta da çalışır (auth 30s, folder per year, customer, beyoid)

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatif |
|-------|-------|------------|
| PUT metodu (POST'un yanına) | Mevcut POST tek mükellef için, ayırım net | Ayrı route dosyası (gereksiz dosya bloat) |
| Sıralı sorgulama | GİB constraint — paralel reject | Paralel (GİB tarafından engelleniyor) |
| 3s bekleme | GİB rate-limit koruması | 5s (çok yavaş), 1s (riskli) |
| Checkbox ile seçim | Kullanıcı bazı mükellefleri çıkarabilir | Otomatik tümü (esneklik yok) |
| Fire-and-forget save | Bot beklemeden sonraki mükellefe geçer | Sıralı save (çok yavaş) |
| isBulkRunning lock | Çift bulk önleme | Redis lock (overengineering) |
| GlobalBotListener'da sadece log | Asıl state use-bulk-query'de | GlobalBotListener'da tam state (SRP ihlali) |

---

## WS Event Akış Diyagramı

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         TOPLU BEYANNAME SORGULAMA FULL FLOW                         │
└─────────────────────────────────────────────────────────────────────────────────────┘

1️⃣  USER ACTION — "Toplu Sorgula" butonuna tıkla
    ├─ BulkQueryDialog açılır
    ├─ Mükellefleri listele (sorgulanacak/sorgulanmayacak)
    ├─ Checkbox ile seçim yap
    └─ "Sorgulamayı Başlat" tıkla

2️⃣  API CALL — PUT /api/intvrg/beyanname
    ├─ customerIds[] → findMany (tenant filter)
    ├─ Her mükellef GİB credential decrypt
    ├─ SavedBeyoids query (skip list)
    └─ POST /_internal/bot-command → intvrg:beyanname-bulk-start

3️⃣  ELECTRON BOT — queryBeyannamelerBulk()
    ├─ FOR EACH customer:
    │   ├─ WS: intvrg:beyanname-bulk-customer-start
    │   ├─ gibDijitalLogin(customer.userid, customer.password)
    │   ├─ getIvdToken(bearerToken)
    │   ├─ Beyanname sorgusu (chunk'lı veya tek yıl)
    │   ├─ WS: intvrg:beyanname-bulk-customer-results
    │   ├─ PDF indirme (sıralı, rate-limited):
    │   │   └─ Her PDF → WS: intvrg:beyanname-bulk-pdf-result
    │   ├─ WS: intvrg:beyanname-bulk-customer-complete
    │   ├─ [HATA] → WS: intvrg:beyanname-bulk-customer-error → DEVAM ET
    │   └─ 3 saniye bekle → sonraki mükellef
    └─ WS: intvrg:beyanname-bulk-all-complete (summary)

4️⃣  SERVER.TS — Relay
    └─ Tüm intvrg:beyanname-bulk-* event'leri → broadcastToTenant()

5️⃣  BROWSER — use-bulk-query.ts
    ├─ bulk-customer-start → progress güncelle
    ├─ bulk-progress → status mesajı güncelle
    ├─ bulk-pdf-result → POST /api/intvrg/beyanname-stream-save (fire-and-forget)
    ├─ bulk-customer-complete → customerResults Map güncelle
    ├─ bulk-customer-error → customerResults Map'e error ekle
    └─ bulk-all-complete → status = 'completed' → sonuç listesi göster

6️⃣  UI GÜNCELLEMESİ
    ├─ Running: Progress panel (mükellef ilerlemesi + beyanname ilerlemesi)
    └─ Completed: Sonuç listesi (her satır → arşive link)
```
