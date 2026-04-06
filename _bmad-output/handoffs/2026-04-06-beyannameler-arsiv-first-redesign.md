# Handoff: Beyannameler Sayfası Arşiv-First Yeniden Yapılandırma
**Tarih:** 2026-04-06 12:00
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor

## Görev Tanımı
> `/dashboard/beyannameler` sayfası varsayılan olarak arşiv sayfası olacak. Sorgulama işlemleri popup/dialog ile yapılacak. Arşiv butonu kaldırılacak. Mali müşavir varsayılan olarak arşive ulaşacak, sorgulama dialog içinde yapılacak.

## Mevcut Durum
- `/beyannameler/page.tsx` → `BeyannameClient` render ediyor (sorgulama sayfası)
- `/beyannameler/arsiv/page.tsx` → `BeyannameArsivClient` render ediyor (arşiv sayfası)
- Sorgulama sayfasında "Arşiv" butonu ile arşive gidiliyor
- Toplu sorgulama dialog ile açılıyor ama progress ana sayfada gösteriliyor
- Tekli sorgulama ana sayfada inline yapılıyor

## Hedef
1. `/beyannameler` → Arşiv sayfası gösterecek (varsayılan)
2. "Sorgula" butonu → Dialog açar (mükellef + dönem seçimi + progress dialog içinde)
3. "Toplu Sorgula" butonu → Mevcut dialog + progress dialog içinde
4. Tekli sorgulama bitince → Dialog kapanır → Arşiv otomatik o mükellefi filtreler
5. Toplu sorgulama sonuçlarında satıra tıklayınca → Dialog kapanır → Arşiv o mükellefi filtreler
6. Arşiv butonu kaldırılacak
7. `beyanname-client.tsx` SİLİNMEYECEK, referans olarak kalacak

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `src/app/(dashboard)/dashboard/beyannameler/page.tsx` | Düzenleme | `BeyannameArsivClient` render edecek, `hasGibCredentials` bilgisi de geçecek |
| `src/app/(dashboard)/dashboard/beyannameler/arsiv/page.tsx` | Düzenleme | `/dashboard/beyannameler`'e redirect |
| `src/components/beyannameler/beyanname-arsiv-client.tsx` | Düzenleme | Sorgula + Toplu Sorgula butonları ekle, auto-filter callback, dialog entegrasyonu |
| `src/components/beyannameler/beyanname-query-dialog.tsx` | Yeni dosya | Tekli sorgulama dialog (mükellef + dönem + progress içeride) |
| `src/components/beyannameler/beyanname-bulk-query-dialog.tsx` | Düzenleme | Progress dialog içine taşı, sonuç satırlarına tıklama ekle |

## Uygulama Planı

### Adım 1: Sayfa route değişiklikleri
- [ ] `beyannameler/page.tsx` → `BeyannameArsivClient` import et ve render et
  - `hasGibCredentials` bilgisini customer query'sine ekle (mevcut arsiv page'de yok)
  - Mevcut sorgulama page'deki gibi `gibKodu`, `gibSifre` select edip `hasGibCredentials: !!(c.gibKodu && c.gibSifre)` hesapla
- [ ] `beyannameler/arsiv/page.tsx` → `redirect("/dashboard/beyannameler")` yap

### Adım 2: Tekli sorgulama dialog oluştur (`beyanname-query-dialog.tsx`)
- [ ] Yeni dialog component oluştur
- [ ] Props: `open`, `onOpenChange`, `customers` (hasGibCredentials dahil), `onQueryComplete(customerId)`
- [ ] İçerik:
  - Mükellef combobox (mevcut beyanname-client.tsx'den — search, hasGibCredentials badge)
  - Dönem seçiciler (başlangıç ay/yıl + bitiş ay/yıl) — `getDefaultPeriod()` ile varsayılan
  - "Sorgula" butonu
- [ ] `useBeyannameQuery` hook'unu dialog içinde kullan
- [ ] Progress gösterimi dialog içinde:
  - Tek yıl: progress.status text + spinner
  - Çoklu yıl: yıl bazlı ilerleme çubuğu + durum listesi (mevcut beyanname-client.tsx:894-947 arası JSX referans)
  - Hata durumu: error alert + tekrar dene butonu
- [ ] Sorgulama bitince (`queryDone` veya `beyannameler.length > 0`):
  - Dialog'u otomatik kapat
  - `onQueryComplete(selectedCustomerId)` callback'i çağır → arşiv client o mükellefi filtreler

### Adım 3: Toplu sorgulama dialog güncellemesi (`beyanname-bulk-query-dialog.tsx`)
- [ ] Props'a ekle: `bulkQueryState` (useBulkQuery return değeri), `onCustomerClick(customerId)`
- [ ] Dialog kapanma mantığını değiştir: `onStart` çağrıldığında dialog KAPANMASIN (`handleStart`'tan `onOpenChange(false)` kaldır)
- [ ] Dialog içine 3 aşamalı görünüm:
  - **Aşama 1 (Seçim):** Mevcut tasarım aynen kalacak
  - **Aşama 2 (Sorgulama):** Mevcut `beyanname-client.tsx:730-787` arası progress panel'i dialog içinde göster:
    - İlerleme çubuğu (mevcut tasarım)
    - İptal butonu
    - Geçen süre
    - Müşteri bazlı sonuç listesi (anında güncellenen)
  - **Aşama 3 (Tamamlandı):** Mevcut `beyanname-client.tsx:789-833` arası sonuç panel'i dialog içinde göster:
    - Sonuç satırları tıklanabilir yapılacak (cursor-pointer, hover:bg-muted)
    - Satıra tıklayınca `onCustomerClick(customerId)` çağrılır
    - Dialog kapanır, arşiv o mükellefi filtreler
- [ ] Dönem seçicileri dialog'a ekle (Aşama 1'de, mükellef seçiminin altında) — mevcut props'tan basAy/basYil/bitAy/bitYil kaldır, dialog kendi state'ini tutsun

### Adım 4: Arşiv client güncellemesi (`beyanname-arsiv-client.tsx`)
- [ ] Props interface güncelle: `initialCustomers`'a `hasGibCredentials` ekle
- [ ] Customer interface'e `hasGibCredentials` ekle
- [ ] Header'dan "Geri" butonu ve "Beyanname Arşivi" başlığını kaldır → "Beyannameler" başlığı yap (veya "Beyanname Arşivi" kalabilir)
- [ ] Filtre barına "Sorgula" ve "Toplu Sorgula" butonları ekle:
  ```
  [Mükellef Combobox ────────] [🔍 Filtrele] [🔎 Sorgula] [👥 Toplu Sorgula] [Export butonları...]
  ```
- [ ] Sorgulama dialog state: `const [queryDialogOpen, setQueryDialogOpen] = useState(false)`
- [ ] Toplu sorgulama dialog state: `const [bulkDialogOpen, setBulkDialogOpen] = useState(false)`
- [ ] `useBulkQuery()` hook'u import et ve kullan
- [ ] Auto-filter callback (`handleQueryComplete`):
  ```typescript
  const handleQueryComplete = useCallback((customerId: string) => {
    setSelectedCustomerId(customerId);
    // setTimeout ile handleFilter'ı çağır (state güncellensin)
    setTimeout(() => handleFilter(), 100);
  }, [handleFilter]);
  ```
  - Veya daha doğrusu: `selectedCustomerId` değiştiğinde ve `autoFilterRef.current` true ise otomatik filter çalıştır
- [ ] Dialog'ları render et:
  - `<BeyannameQueryDialog ... onQueryComplete={handleQueryComplete} />`
  - `<BeyannameBulkQueryDialog ... onCustomerClick={handleQueryComplete} />`
- [ ] ArrowLeft / Link to "/dashboard/beyannameler" kaldır (artık kendisi ana sayfa)

### Adım 5: Düzeltme ve temizlik
- [ ] `beyanname-arsiv-client.tsx`'deki "Tüm Sorgulamaları Sil" butonunu koru (test amaçlı)
- [ ] Boş durum mesajlarını güncelle
- [ ] Import'ları düzenle (kullanılmayan import temizliği)

## Teknik Notlar

### use-beyanname-query hook — Dialog'da kullanım
- Bu hook WebSocket üzerinden Electron Bot'tan gelen event'leri dinler
- Dialog mount olduğunda hook'un WebSocket'e bağlanması gerekir
- Dialog kapandığında (unmount) WebSocket temizlenmeli
- `startQuery` çağrıldıktan sonra `queryDone` veya `beyannameler.length > 0` olunca sorgulama bitti demek
- Dialog içindeki progress: `isLoading`, `progress.status`, `multiQueryProgress`, `error`, `errorCode` state'leri kullanılır
- Sorgulama bitince beyannamelerin arşive kaydedilmesi zaten hook içinde otomatik yapılıyor (batch save pipeline)

### use-bulk-query hook — Dialog'da kullanım
- Bu hook da WebSocket dinler
- `startBulkQuery` çağrılır → `status: "running"` → progress event'leri gelir → `status: "completed"`
- Dialog'un bulk query state'ini dışarıdan alması gerekiyor (hook arşiv client'ta çalışacak)
- `customerResults` array'i satır tıklama için kullanılacak

### Auto-filter mekanizması
- Dialog kapandığında customerId bildirilir
- Arşiv client `selectedCustomerId`'yi set eder
- `handleFilter` otomatik çağrılır — `/api/query-archives/customer-bulk` ile arşivden veri çekilir
- PDF preload otomatik başlar

### Dönem seçiciler
- Tekli sorgulama dialog'unda: `getDefaultPeriod()` ile varsayılan değerler (bir önceki ay kuralı)
- Toplu sorgulama dialog'unda: Kendi dönem state'ini tutacak (mevcut props yerine)
- `MONTHS_TR` ve `YEARS` sabitleri her iki dialog'da da gerekli

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Arşiv sayfası varsayılan | Mali müşavirin en sık kullandığı akış arşive bakmak | Sorgulama sayfası varsayılan (mevcut — kötü UX) |
| Sorgulama dialog-based | Sayfa değiştirmeden tüm iş tek yerden yapılsın | Ayrı sayfa (mevcut — fazla navigasyon) |
| Progress dialog içinde | Kullanıcı dialog'dan çıkmadan süreci takip etsin | Progress ana sayfada (mevcut — dialog kapanıyor) |
| beyanname-client.tsx silinmeyecek | Referans olarak kalacak, gerekirse geri dönülebilir | Silmek (riskli) |
| Yaklaşım A (minimal değişiklik) | Mevcut çalışan kodlara minimum müdahale | Birleşik component (büyük refactoring) |
