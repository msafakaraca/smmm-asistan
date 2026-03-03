# Handoff: Beyanname Takip — Statü Sistemi Revizyonu
**Tarih:** 2026-03-03 23:45
**Durum:** ✅ Tamamlandı (2026-03-03)

## Görev Tanımı
> Beyanname takip (kontrol çizelgesi) tablosundaki gri sütun boyama sistemini kaldırıp ikon tabanlı statü sistemine geçiş.
> Yeni statüler: Onaylandı, Onay Bekliyor, Gönderilmeyecek, Dilekçe Verildi/Gönderilecek.
> Hücre tıklama ile dropdown statü değiştirme. MUHSGK'ya "Dilekçe" seçeneği ekleme.
> Sütun header tıklama bug'ını düzeltme. Dosya linklerini (B, T, S, H) belirgin hale getirme.

## Araştırma Bulguları

### Mevcut Statü Sistemi
- **DeclarationStatus** tipi: `"bos" | "verildi" | "muaf" | "3aylik"` (`types.ts:11`)
- **Gri boyama**: `customer.verilmeyecekBeyannameler?.includes(tur.kod)` → `bg-zinc-600` (`kontrol-customer-row.tsx:285-286`)
- **Sol tık**: `verildi` ↔ `bos` toggle (`beyanname-takip-page.tsx:175-190`)
- **Sağ tık**: `verilmeyecekBeyannameler` array'ine toggle (context menu yok, direkt toggle) (`beyanname-takip-page.tsx:192-241`)
- **Kilitli hücreler**: `isMuaf === true` → sol tık engelli (`beyanname-takip-page.tsx:178-179`)

### Dosya Linkleri (B, T, S, H)
- **Konum**: `kontrol-customer-row.tsx:295-421`
- **Render koşulu**: `status === "verildi" && meta` olduğunda tooltip içinde gösteriliyor
- **Badge boyutları**: `w-4 h-4` (16x16px), font `text-[9px]`
- **Renk kodları**:
  - B (Beyanname): `bg-red-100 text-red-600 border-red-200`
  - T (Tahakkuk): `bg-orange-100 text-orange-600 border-orange-200`
  - S (SGK Tahakkuk): `bg-blue-100 text-blue-600 border-blue-200`
  - H (Hizmet Listesi): `bg-purple-100 text-purple-600 border-purple-200`
- **PDF açma**: `openPdf()` fonksiyonu (`kontrol-customer-row.tsx:79-97`)
- **SGK/Hizmet path algılama**: Karmaşık path kontrolü (`kontrol-customer-row.tsx:253-275`)

### Sütun Kaybolma Bug'ı
- **Konum**: `use-kontrol-data.ts:176-195`
- **Sebep**: `activeBeyannameTurleri` sadece `beyannameStatuses`'ta `"verildi"` veya `"bos"` olan kolonları gösteriyor
- **Sorun**: `verilmeyecekBeyannameler`'deki (muaf) beyannameler `beyannameler` JSON'ında kayıt oluşturmuyor → sütun filtreleniyor
- **Çözüm**: `activeBeyannameTurleri` filtresini kaldır veya tüm `beyannameTurleri`'ni döndür

### Beyanname Türü Yönetimi Sayfası
- **Sayfa**: `/dashboard/mukellefler/beyannameler` → `client.tsx`
- **MUHSGK donemSecenekleri**: `["aylik", "3aylik"]` (`beyanname-turleri/route.ts:31`)
- **DonemType**: `"15gunluk" | "aylik" | "3aylik" | "6aylik" | "yillik"` (`use-beyanname-yonetimi.ts:7`)
- **Atama mekanizması**: Header cell'de select + "Ata" butonu → `onBulkAssign()` ile seçili mükelleflere atar
- **Veri kaydı**: `customers.beyannameAyarlari` JSON → `{"KDV1": "aylik", "MUHSGK": "3aylik"}`
- **API**: `PATCH /api/customers/beyanname-ayarlari` ile bulk kayıt

### Beyanname Takip API
- **GET**: `/api/beyanname-takip?year=X&month=Y` → `{customerId: beyannameler_json}` map
- **PUT**: Tek hücre güncelle → upsert `beyanname_takip` kaydı
- **JSON yapısı**: `{"KDV1": {"status": "verildi", "meta": {...}, "files": {...}}}`

## Yeni Statü Sistemi

### DeclarationStatus (Genişletilmiş)
```typescript
export type DeclarationStatus =
  | "bos"                    // Boş (henüz işlem yok)
  | "onay_bekliyor"          // Sistem: beyannameAyarlari'nda var, bot henüz sorgulamadı
  | "onaylandi"              // Sistem: GİB bot sorgulayıp doğruladı (+ dosya linkleri)
  | "verildi"                // Kullanıcı: Manuel gönderildi işaretleme
  | "verilmedi"              // Kullanıcı: Gönderilmedi işaretleme
  | "gonderilmeyecek"        // Kalıcı: verilmeyecekBeyannameler'den (kilitli)
  | "dilekce_gonderilecek"   // Sistem: beyannameAyarlari'nda "dilekce" seçilmiş
  | "dilekce_verildi"        // Kullanıcı: Dilekçe verildi işaretleme
;
```

### Statü-İkon-Renk Matrisi
| Statü | İkon (Lucide) | Renk | Dosya Linkleri | Tıklanabilir? |
|-------|--------------|------|---------------|---------------|
| `onay_bekliyor` | `Clock` | Turuncu | Yok | Evet (popover) |
| `onaylandi` | `CheckCircle2` | Yeşil | B, T, S, H (varsa) | Evet (popover) |
| `verildi` | `CheckCircle2` | Yeşil | B, T, S, H (varsa) | Evet (popover) |
| `verilmedi` | `XCircle` | Kırmızı | Yok | Evet (popover) |
| `gonderilmeyecek` | `Ban` | Gri | Yok | **Hayır (kilitli)** |
| `dilekce_gonderilecek` | `FileText` | Mor | Yok | Evet (popover) |
| `dilekce_verildi` | `FileCheck` | Mor/Yeşil | **Yok** | Evet (popover) |
| `bos` | (boş) | — | Yok | Evet (popover) |

### Varsayılan Statü Ataması (Dönem Açıldığında)
Yeni bir dönem açıldığında (GET /api/beyanname-takip), eğer customer için kayıt yoksa:
1. `verilmeyecekBeyannameler`'de olan kodlar → `gonderilmeyecek`
2. `beyannameAyarlari`'nda "dilekce" olanlar → `dilekce_gonderilecek`
3. `beyannameAyarlari`'nda diğer dönem olanlar → `onay_bekliyor`
4. `beyannameAyarlari`'nda olmayan → `bos`

### GİB Bot Entegrasyonu
Bot beyanname sorguladığında mevcut `beyanname-takip/sync` route'u `status: "verildi"` yazıyor → bunu `"onaylandi"` olarak değiştir.

### Hücre Tıklama Popover
Sol tık → küçük popover/dropdown açılır:
- ✅ Gönderildi (`verildi`)
- ❌ Gönderilmedi (`verilmedi`)
- 📄 Dilekçe Verildi (`dilekce_verildi`)

"Gönderilmeyecek" hücreler kilitli — popover açılmaz, cursor `not-allowed`.

### Sağ Tık
Mevcut davranış korunur ama label "Muaf" → "Gönderilmeyecek" olarak değişir.

## Etkilenecek Dosyalar

| # | Dosya | Değişiklik | Detay |
|---|-------|-----------|-------|
| 1 | `src/components/kontrol/types.ts` | Düzenleme | `DeclarationStatus` genişlet, yeni tipler |
| 2 | `src/components/kontrol/kontrol-customer-row.tsx` | **Büyük Düzenleme** | Gri boyama kaldır, ikon render, B/T/S/H belirgin, popover |
| 3 | `src/components/kontrol-cizelgesi/beyanname-takip-page.tsx` | Düzenleme | Sol tık → popover, sağ tık label, footer legend |
| 4 | `src/components/kontrol/hooks/use-kontrol-data.ts` | Düzenleme | `activeBeyannameTurleri` filter fix, varsayılan statü hesaplama |
| 5 | `src/components/kontrol/kontrol-table.tsx` | Düzenleme | Sütun header tıklama sadece sort (column visibility kaldır) |
| 6 | `src/app/api/beyanname-takip/route.ts` | Düzenleme | GET: varsayılan statü ataması, PUT: yeni statüler |
| 7 | `src/app/api/beyanname-turleri/route.ts` | Düzenleme | MUHSGK `donemSecenekleri`'ne "dilekce" ekle |
| 8 | `src/components/beyanname-yonetimi/hooks/use-beyanname-yonetimi.ts` | Düzenleme | `DonemType`'a "dilekce" ekle, label maps |
| 9 | `src/components/beyanname-yonetimi/beyanname-matrix.tsx` | Düzenleme | Dilekçe seçeneği dropdown'da görünsün |
| 10 | `src/app/api/beyanname-takip/sync/route.ts` | Düzenleme | Bot sync: `"verildi"` → `"onaylandi"` |
| 11 | `src/components/kontrol/kontrol-page.tsx` | Düzenleme | Eski kontrol sayfası da aynı değişiklikleri almalı (varsa) |

## Uygulama Planı

### Adım 1: Type Tanımları ve DonemType Genişletme
- [ ] `src/components/kontrol/types.ts` → `DeclarationStatus` genişlet
- [ ] `src/components/beyanname-yonetimi/hooks/use-beyanname-yonetimi.ts` → `DonemType`'a `"dilekce"` ekle, `DONEM_OPTIONS`, `DONEM_LABEL_MAP`, `DONEM_SHORT_LABEL_MAP` güncelle

### Adım 2: Beyanname Türleri API — MUHSGK Dilekçe Seçeneği
- [ ] `src/app/api/beyanname-turleri/route.ts:31` → MUHSGK `donemSecenekleri`'ne `"dilekce"` ekle: `["aylik", "3aylik", "dilekce"]`
- [ ] MUHSGK2 için de aynı: `["aylik", "3aylik", "dilekce"]`
- [ ] Mevcut tenant'lar için migration: GET handler'daki `emptyDonemTurler` bloğuna benzer mantıkla dilekçe seçeneği eksik MUHSGK türlerine otomatik ekle

### Adım 3: Beyanname Takip API — Varsayılan Statü ve Yeni Statüler
- [ ] `src/app/api/beyanname-takip/route.ts` GET: Dönem verisi yüklenirken, kayıt olmayan müşteriler için varsayılan statü hesapla
  - `beyannameAyarlari` + `verilmeyecekBeyannameler` verilerini de çek
  - Her müşteri-beyanname çifti için varsayılan statü belirle
- [ ] PUT: Yeni statü değerlerini kabul et (`onay_bekliyor`, `onaylandi`, `verilmedi`, `gonderilmeyecek`, `dilekce_gonderilecek`, `dilekce_verildi`)

### Adım 4: Bot Sync — "onaylandi" Statüsü
- [ ] `src/app/api/beyanname-takip/sync/route.ts` → Bot sonucu yazarken `status: "verildi"` yerine `status: "onaylandi"` yaz
- [ ] Mevcut `"verildi"` veriler backward compatible kalmalı (UI'da "onaylandi" gibi göster)

### Adım 5: Sütun Kaybolma Bug Fix
- [ ] `src/components/kontrol/hooks/use-kontrol-data.ts:176-195` → `activeBeyannameTurleri` filtresini düzelt
  - **Seçenek A** (Önerilen): Filtreyi tamamen kaldır, tüm aktif `beyannameTurleri`'ni döndür
  - **Seçenek B**: Filtreye `gonderilmeyecek` ve diğer yeni statüleri de ekle

### Adım 6: BeyannameCell Refactor — İkon Sistemi + Popover
Bu en büyük değişiklik. `kontrol-customer-row.tsx` → `BeyannameCell` bileşeni:

- [ ] **Gri boyama kaldır** (`kontrol-customer-row.tsx:284-292`):
  ```
  ESKİ: isMuaf ? "bg-zinc-600 dark:bg-zinc-700" : ...
  YENİ: Statüye göre farklı bg (veya bg yok, sadece ikon)
  ```

- [ ] **İkon render** — Her statü için Lucide ikonu:
  ```
  onay_bekliyor → <Clock className="w-4 h-4 text-amber-500" />
  onaylandi/verildi → <CheckCircle2 className="w-4 h-4 text-green-600" /> + dosya linkleri
  verilmedi → <XCircle className="w-4 h-4 text-red-500" />
  gonderilmeyecek → <Ban className="w-4 h-4 text-gray-400" /> + cursor-not-allowed
  dilekce_gonderilecek → <FileText className="w-4 h-4 text-purple-500" />
  dilekce_verildi → <FileCheck className="w-4 h-4 text-purple-600" />
  bos → (boş hücre)
  ```

- [ ] **Dosya linkleri belirgin** — B, T, S, H badge boyutunu artır:
  - `w-4 h-4` → `w-5 h-5` (20x20px)
  - Font: `text-[9px]` → `text-[10px]`
  - Hover efekti güçlendir
  - İkon ile badge'leri yan yana düzenle: `[✅] [B] [T] [S] [H]`

- [ ] **Popover/Dropdown oluştur** — Sol tık ile durum değiştirme:
  - `beyanname-matrix.tsx`'deki `CellDropdown` pattern'ini referans al (portal + pozisyon hesaplama)
  - Seçenekler: Gönderildi, Gönderilmedi, Dilekçe Verildi
  - `gonderilmeyecek` hücrelerde popover açılmaz

- [ ] **Tooltip güncelle** — Meta bilgileri göster (mevcut pattern korunsun)

### Adım 7: Sol/Sağ Tık Handler Güncellemeleri
- [ ] `beyanname-takip-page.tsx:175-190` → `handleLeftClick`: Toggle yerine popover aç
  - State: `popoverCell: {customerId, beyannameKod, anchorEl} | null`
  - Popover'dan seçim gelince `updateBeyannameStatus()` çağır
- [ ] `beyanname-takip-page.tsx:192-241` → `handleRightClick`: Label "Muaf" → "Gönderilmeyecek"
  - Davranış aynı kalır (verilmeyecekBeyannameler toggle)
- [ ] `beyanname-takip-page.tsx:281` → Cell title: `"Sol tık: Durum değiştir | Sağ tık: Gönderilmeyecek (kalıcı)"`

### Adım 8: Footer Legend Güncelleme
- [ ] `beyanname-takip-page.tsx:453-472` → Footer'daki legend'ı yeni statülerle güncelle:
  ```
  ✅ Onaylandı  ⏳ Onay Bekliyor  🚫 Gönderilmeyecek  📄 Dilekçe  ❌ Verilmedi
  ```

### Adım 9: Sıralama Güncelleme
- [ ] `beyanname-takip-page.tsx:102` → `statusOrder` map'ini yeni statülerle güncelle:
  ```typescript
  const statusOrder = {
    onaylandi: 0, verildi: 0, dilekce_verildi: 1,
    onay_bekliyor: 2, dilekce_gonderilecek: 3,
    verilmedi: 4, bos: 5, gonderilmeyecek: 6
  };
  ```

### Adım 10: Stats ve İstatistik Güncelleme
- [ ] `kontrol-stats.tsx` → İstatistikleri yeni statülere göre hesapla (gerekirse)

## Teknik Notlar

### Backward Compatibility
- Mevcut `"verildi"` verileri korunmalı — UI'da `"verildi"` ve `"onaylandi"` aynı şekilde (yeşil ✅) gösterilir
- `"muaf"` statüsü artık JSON'da yazılmıyor, `verilmeyecekBeyannameler`'den hesaplanıyor (mevcut davranış korunur)
- `"3aylik"` statüsü → `"onay_bekliyor"` olarak migrate edilebilir

### Performans
- Popover: Portal kullan (beyanname-matrix.tsx pattern'i gibi), tek instance tüm hücreler için
- React.memo: `BeyannameCell`'e statü prop'u eklendiğinde memo karşılaştırma güncelle
- Lucide ikonları: Tree-shakeable, direkt import

### Dikkat Edilecek Edge Case'ler
- Hem `verilmeyecekBeyannameler`'de hem de `beyannameAyarlari`'nda olan beyanname kodu → `gonderilmeyecek` öncelikli
- `beyannameAyarlari`'nda `"dilekce"` olan ama GİB bot tarafından sorgulanan → `onaylandi` statüsü (bot override)
- Dönem değiştiğinde varsayılan statüler yeniden hesaplanmalı
- Print view'da ikonlar yerine metin göster (yazdırma uyumluluğu)

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Lucide ikonları | Proje zaten kullanıyor, tree-shakeable, tutarlı | Iconify (daha ağır), emoji (print sorunlu) |
| Portal-based popover | beyanname-matrix.tsx'de kanıtlanmış pattern, performanslı | Radix Popover (ağır), inline dropdown |
| Varsayılan statü API'de hesapla | Tek kaynak gerçeği, frontend karmaşıklığı azalt | Frontend'de hesapla (tutarsızlık riski) |
| `activeBeyannameTurleri` filtresini kaldır | Basit, sütun kaybolma sorununu kökte çözer | Filtreye yeni statüler ekle (karmaşık) |
| `"verildi"` backward compat | Mevcut veriler bozulmaz | Migration script (riskli) |
| Dilekçe Verildi'de dosya linki yok | Kullanıcı talebi, dilekçe fiziksel süreç | — |
