# Finansal Islemler Modulu - Epic & Story Plani

**Version:** 1.0.0
**Tarih:** 2026-02-12
**PRD Referansi:** prd-finansal-islemler.md
**Mimari Referansi:** architecture-finansal-islemler.md
**Toplam Sprint:** 9

---

## Epic Ozeti

| Epic | Baslik | Sprint | Oncelik |
|------|--------|--------|---------|
| E0 | Altyapi & Veri Modeli | 1 | P0 |
| E1 | Maliyet Tanimlamasi & Muhasebe Ucretleri | 2 | P0 |
| E2 | Tahsilatlar & Cek Yonetimi | 2 | P0 |
| E3 | Hizmetler & Giderler | 1 | P1 |
| E4 | Istatistikler & Hesap Dokumu | 2 | P1 |
| E5 | Polish & Entegrasyon | 1 | P2 |

---

## Epic 0: ALTYAPI & VERI MODELI

**Amac:** Finansal Islemler modulunun teknik temelini kurmak
**Sprint:** 1
**Bagimlilk:** Yok (ilk epic)

### E0-S1: Prisma Schema Guncelleme

**Aciklama:** 6 yeni Prisma modeli, enum'lar ve iliskilerin eklenmesi

**Kabul Kriterleri:**
- [ ] 8 enum tanimlanmis (Currency, Frequency, ChargeStrategy, TransactionType, TransactionStatus, PaymentMethod, CheckStatus, FinanceCategoryType, AutoChargeStatus, RecurringFrequency)
- [ ] 6 model tanimlanmis (FinanceCategory, CostDefinition, FinancialTransaction, Check, Expense, AutoChargeLog)
- [ ] Tenant modeline financialDefaults Json? alani eklenmis
- [ ] Customer modeline yeni iliskiler eklenmis
- [ ] Tum index'ler tanimlanmis
- [ ] Tum unique constraint'ler tanimlanmis
- [ ] Migration basariyla calistirilmis
- [ ] Prisma client generate edilmis

**Teknik Notlar:**
- Decimal(12,2) para alanlari icin zorunlu
- Decimal(5,2) oran alanlari icin (kdvRate, stopajRate)
- Decimal(10,4) exchangeRate icin
- @@unique([costDefinitionId, period]) AutoChargeLog'da cift kayit engeli

---

### E0-S2: Varsayilan Kategori Seed Data

**Aciklama:** Yeni tenant olusturuldiginda veya mevcut tenant'lar icin varsayilan finansal kategorilerin seed edilmesi

**Kabul Kriterleri:**
- [ ] 9 varsayilan gelir kategorisi seed edilmis
- [ ] 10 varsayilan gider kategorisi seed edilmis
- [ ] Her kategoride isDefault: true
- [ ] Her kategoride renk ve ikon atanmis
- [ ] Mevcut tenant'lar icin calistirilmis
- [ ] Yeni tenant olusturuldiginda otomatik seed calisir

**Teknik Notlar:**
- Seed script: prisma/seed.ts veya ayri migration
- Tenant bazli izolasyon: Her tenant kendi kategorilerini alir
- Idempotent olmali: Tekrar calistiginda duplicate olusturmamali

---

### E0-S3: API Iskelet (Temel CRUD)

**Aciklama:** Tum finance API endpoint'lerinin iskelet yapisi

**Kabul Kriterleri:**
- [ ] /api/finance/categories - GET, POST, PUT, DELETE
- [ ] /api/finance/cost-definitions - GET, POST, PUT, DELETE
- [ ] /api/finance/transactions - GET, POST, PUT, DELETE
- [ ] /api/finance/checks - GET, POST
- [ ] /api/finance/checks/[id]/status - PUT
- [ ] /api/finance/expenses - GET, POST, PUT, DELETE
- [ ] /api/finance/settings - GET, PUT
- [ ] Her endpoint'te auth guard
- [ ] Her endpoint'te tenantId filtresi
- [ ] Her endpoint'te temel error handling

---

### E0-S4: Dashboard Nav Menu Entegrasyonu

**Aciklama:** Sol menude "Finansal Islemler" ana grubu ve 6 alt sayfa linki

**Kabul Kriterleri:**
- [ ] "Finansal Islemler" collapsible menu grubu eklenmis
- [ ] 6 alt menu itemi: Muhasebe Ucretleri, Tahsilatlar, Hizmetler, Giderler, Istatistikler, Hesap Dokumu
- [ ] Her menu iteminda ikon var
- [ ] Aktif sayfa vurgulanir
- [ ] 6 bos sayfa olusturulmus (placeholder)
- [ ] Route yapisi: /dashboard/finansal-islemler/*

**Etkilenen Dosyalar:**
- src/components/dashboard/nav.tsx
- src/app/(dashboard)/dashboard/finansal-islemler/ (6 yeni dizin)

---

### E0-S5: TypeScript Tip Tanimlari

**Aciklama:** Frontend'de kullanilacak tum TypeScript interface ve type tanimlari

**Kabul Kriterleri:**
- [ ] src/components/finansal-islemler/shared/finance-types.ts olusturulmus
- [ ] Tum enum'lar TypeScript'te tanimlanmis
- [ ] Tum model interface'leri tanimlanmis
- [ ] API request/response tipleri tanimlanmis
- [ ] Zod validation schemalari tanimlanmis
- [ ] Form tipleri tanimlanmis

---

## Epic 1: MALIYET TANIMLAMASI & MUHASEBE UCRETLERI

**Amac:** Mali musavirin maliyet kalemleri tanimlayabilmesi ve yonetebilmesi
**Sprint:** 2
**Bagimlilk:** Epic 0

### E1-S1: Kategori Yonetimi

**Aciklama:** Mali musavirin gelir/gider kategorilerini CRUD ile yonetebilmesi

**Kabul Kriterleri:**
- [ ] Kategori listesi goruntulenebilir (tablo)
- [ ] Yeni kategori olusturulabilir (dialog form)
- [ ] Kategori duzenlenebilir (isim, renk, ikon)
- [ ] Kategori silinebilir (bagli veri varsa uyari)
- [ ] Varsayilan kategoriler isaretli ve farklilastirilmis
- [ ] Gelir ve gider kategorileri ayri tab'larda
- [ ] Tenant bazli izolasyon

**UI Bilesenler:**
- CategoryManager dialog/sheet
- CategorySelector dropdown (diger formlarda kullanilacak)

---

### E1-S2: Maliyet Kalemi Tanimi CRUD

**Aciklama:** Mukellefe maliyet kalemi (muhasebe ucreti, defter saklama vb.) tanimlanmasi

**Kabul Kriterleri:**
- [ ] Maliyet kalemleri tablosu (mukellef, kategori, tutar, periyot, durum)
- [ ] Yeni maliyet kalemi formu:
  - Mukellef secimi
  - Kategori secimi / yeni olusturma
  - Tutar + para birimi (TRY/USD/EUR)
  - Odeme periyodu (aylik/3aylik/6aylik/yillik/tek seferlik)
  - Dagitim stratejisi (FULL/DISTRIBUTED) - yillik secildiginde gorunur
  - Baslangic/bitis tarihi
  - Aktif/pasif toggle
- [ ] Maliyet kalemi duzenleme
- [ ] Maliyet kalemi silme (soft - isActive false)
- [ ] Mukellef bazli filtreleme
- [ ] Kategori bazli filtreleme

---

### E1-S3: SMM Hesaplama (KDV/Stopaj)

**Aciklama:** Serbest meslek makbuzu icin KDV ve stopaj otomatik hesaplama

**Kabul Kriterleri:**
- [ ] SMM toggle (makbuz kesilecek mi?)
- [ ] KDV orani girisi (varsayilan %20)
- [ ] Stopaj orani girisi (varsayilan %20)
- [ ] Canli onizleme: Brut, KDV tutari, Stopaj tutari, Net tutar
- [ ] Toggle kapali iken KDV/Stopaj alanlari gizlenir
- [ ] Hesaplama formulu: Net = Brut + KDV - Stopaj
- [ ] Decimal hassasiyet (2 basamak)

**UI Bilesenler:**
- SMMCalculator component (reusable)

---

### E1-S4: Varsayilan Ayarlar Paneli

**Aciklama:** Muhasebe ucretleri sayfasinda collapsible varsayilan ayarlar paneli

**Kabul Kriterleri:**
- [ ] Collapsible panel (acik/kapali)
- [ ] Varsayilan SMM toggle
- [ ] Varsayilan KDV orani
- [ ] Varsayilan Stopaj orani
- [ ] Ayarlar degistiginde Tenant.financialDefaults guncellenir
- [ ] Yeni maliyet kaleminde bu degerler on doldurulur
- [ ] Kalem bazinda override edilebilir
- [ ] localStorage ile panel acik/kapali durumu hatirlanir

---

### E1-S5: Toplu Ucret Belirleme

**Aciklama:** Birden fazla mukellefe tek seferde ayni maliyet kalemini tanimlama

**Kabul Kriterleri:**
- [ ] Mukellef coklu secimi (checkbox tablo veya multi-select)
- [ ] Ortak maliyet kalemi formu (kategori, tutar, periyot, SMM)
- [ ] Toplu kayit (POST /api/finance/cost-definitions/bulk)
- [ ] Basari/hata ozeti dialog
- [ ] Zaten tanimli mukelleflerde uyari

---

### E1-S6: Muhasebe Ucretleri Sayfasi (Tam Entegrasyon)

**Aciklama:** Tum E1 componentlerinin entegre edilip calisir hale getirilmesi

**Kabul Kriterleri:**
- [ ] Sayfa layout'u tamamlanmis
- [ ] Ayarlar paneli + tablo + formlar entegre
- [ ] Arama ve filtreleme calisiyor
- [ ] Loading/error/empty state'ler
- [ ] Responsive tasarim
- [ ] Turkce metinler

---

## Epic 2: TAHSILATLAR & CEK YONETIMI

**Amac:** Mukelleflerden tahsilat alinmasi ve cek portfoy yonetimi
**Sprint:** 2
**Bagimlilk:** Epic 1

### E2-S1: Tahsilat Tablosu ve Ozet Kartlari

**Aciklama:** Tahsilatlar sayfasinin ana tablosu ve ozet kartlari

**Kabul Kriterleri:**
- [ ] 3 ozet karti: Bekleyen toplam, Bu ay tahsilat, Vadesi gecen
- [ ] Tahsilat tablosu (mukellef, kalem, tutar, vade, durum)
- [ ] Renk kodlamasi: kirmizi (vadesi gecmis), sari (bekleyen), yesil (tamamlanmis)
- [ ] Filtreler: tarih araligi, mukellef, odeme yontemi, durum
- [ ] Siralama: vade tarihine gore (yaklasan ustde)

---

### E2-S2: Tahsilat Kayit Formu

**Aciklama:** Mukelleften tahsilat alindiginda kayit formu

**Kabul Kriterleri:**
- [ ] Mukellef secimi -> bekleyen borclar otomatik listelenir
- [ ] Coklu borc secimi (checkbox)
- [ ] Secili toplam otomatik hesaplanir
- [ ] Tahsil edilen tutar girisi
- [ ] Farkli tutar girildiginde kismi tahsilat uyarisi
- [ ] Odeme yontemi secimi (nakit/havale/EFT/kredi karti/cek)
- [ ] Doviz secildiginde kur girisi formu acilir
- [ ] Tarih ve not alani
- [ ] Kayit sonrasi tablo guncellenir

---

### E2-S3: Kismi Tahsilat Yonetimi

**Aciklama:** Tam tutar odenmediginde kismi tahsilat kaydi ve bakiye takibi

**Kabul Kriterleri:**
- [ ] Kismi odeme: status = PARTIAL
- [ ] Kalan bakiye otomatik hesaplanir (Borc - Sum(Odemeler))
- [ ] Kismi odemeler parent transaction'a baglidir
- [ ] Tabloda kismi odemeler alt satirda gosterilir
- [ ] Ikinci odeme yapildiginda kalan tutar on doldurulur
- [ ] Tum odemeler yapildiginda status = COMPLETED

---

### E2-S4: Cek Formu ve Cek Olusturma

**Aciklama:** Tahsilat cekle yapildiginda cek bilgi formu

**Kabul Kriterleri:**
- [ ] Odeme yontemi "Cek" secildiginde cek formu acilir
- [ ] Cek No (opsiyonel)
- [ ] Banka (opsiyonel)
- [ ] Vade tarihi (zorunlu)
- [ ] Tutar (zorunlu)
- [ ] Check entity olusturulur (status: IN_PORTFOLIO)
- [ ] FinancialTransaction'a checkId baglenir

---

### E2-S5: Cek Portfoy Yonetimi

**Aciklama:** Portfoydeki ceklerin listesi, vade takvimi ve durum yonetimi

**Kabul Kriterleri:**
- [ ] Cek listesi tablosu (no, banka, tutar, vade, durum, mukellef)
- [ ] Durum degistirme: Portfoyde -> Tahsil Edildi / Karsiliksiz / Iade
- [ ] State machine validation (gecersiz gecis engellenir)
- [ ] Karsiliksiz/iade durumunda ilgili transaction PENDING'e doner
- [ ] Filtreler: durum, vade araligi, mukellef
- [ ] Vadesi yaklasan cekler vurgulanir
- [ ] Onay dialog'u her durum degisikliginde

---

### E2-S6: Otomatik Borclndirma Sistemi

**Aciklama:** pg_cron ile otomatik borclndirma ve ayar paneli

**Kabul Kriterleri:**
- [ ] Tahsilatlar sayfasinda collapsible ayar paneli
- [ ] Otomatik borclndirma toggle (aktif/pasif)
- [ ] Borclndirma gunu secimi (1-28)
- [ ] pg_cron fonksiyonu olusturulmus
- [ ] Periyot kontrolu (aylik/3aylik/6aylik/yillik/tek seferlik)
- [ ] Dagitim stratejisi hesaplamasi (FULL/DISTRIBUTED)
- [ ] AutoChargeLog kaydi (basari/hata)
- [ ] Cift borclndirma engeli (unique constraint)
- [ ] ONE_TIME islemler sonra isActive = false
- [ ] Supabase migration olarak deploy

---

### E2-S7: Tahsilatlar Sayfasi (Tam Entegrasyon)

**Aciklama:** Tum E2 componentlerinin entegre edilip calisir hale getirilmesi

**Kabul Kriterleri:**
- [ ] Sayfa layout'u tamamlanmis
- [ ] Ayar paneli + ozet kartlar + tablo + formlar entegre
- [ ] Cek portfoyu tab veya alt bolum olarak eriselebilir
- [ ] Loading/error/empty state'ler
- [ ] Responsive tasarim
- [ ] Turkce metinler

---

## Epic 3: HIZMETLER & GIDERLER

**Amac:** Ek hizmet faturalandirma ve ofis gideri takibi
**Sprint:** 1
**Bagimlilk:** Epic 1, Epic 2

### E3-S1: Hizmetler Sayfasi

**Aciklama:** Mukellefe ek hizmet faturalandirma

**Kabul Kriterleri:**
- [ ] Hizmet listesi tablosu (mukellef, kategori, tutar, tarih, durum)
- [ ] Hizmet ekleme formu:
  - Mukellef secimi
  - Hizmet kategorisi secimi / yeni olusturma
  - Tutar + para birimi
  - SMM bilgileri (KDV/Stopaj)
  - Tarih ve aciklama
- [ ] Hizmet eklendiginde FinancialTransaction'a DEBIT yazilir
- [ ] Hizmet duzenleme/silme
- [ ] Filtreler: mukellef, kategori, tarih araligi

---

### E3-S2: Giderler Sayfasi

**Aciklama:** Ofis ici gider takibi (mukellefe BAGLI DEGIL)

**Kabul Kriterleri:**
- [ ] Gider listesi tablosu (kategori, tutar, tarih, aciklama, tekrarlayan)
- [ ] Gider ekleme formu:
  - Gider kategorisi secimi / yeni olusturma
  - Tutar + para birimi
  - Tarih ve aciklama
  - Tekrarlayan gider toggle
  - Tekrarlayan ise: periyot secimi (aylik/3 aylik/yillik)
- [ ] Gider duzenleme/silme
- [ ] Aylik toplam otomatik hesaplama
- [ ] Filtreler: kategori, tarih araligi, tekrarlayan/tek seferlik

---

### E3-S3: Tekrarlayan Gider Otomasyonu

**Aciklama:** Kira, personel maasi gibi tekrarlayan giderlerin otomatik kaydedilmesi

**Kabul Kriterleri:**
- [ ] Tekrarlayan gider tanimlama (isRecurring + recurringFrequency)
- [ ] Otomatik kayit: pg_cron veya API-level cron
- [ ] Periyot bazli: aylik, 3 aylik, yillik
- [ ] Cift kayit engeli
- [ ] Tekrarlayan gider listesi ayri goruntulenir
- [ ] Durdurma/basltatma secenegi

---

## Epic 4: ISTATISTIKLER & HESAP DOKUMU

**Amac:** Finansal raporlama, grafikler ve hesap dokumu
**Sprint:** 2
**Bagimlilk:** Epic 1, Epic 2, Epic 3

### E4-S1: Istatistik Summary Kartlari

**Aciklama:** 4 ozet karti: Toplam Alacak, Bu Ay Tahsilat, Toplam Gider, Net Kar

**Kabul Kriterleri:**
- [ ] Toplam Alacak: PENDING + PARTIAL status DEBIT transactions toplami
- [ ] Bu Ay Tahsilat: Bu aydaki COMPLETED CREDIT transactions toplami
- [ ] Toplam Gider: Secili donemdeki Expense toplami
- [ ] Net Kar: Tahsilat - Gider
- [ ] Donem filtresi ile degisir
- [ ] Animasyonlu sayi guncelleme
- [ ] Renk kodlamasi (yesil pozitif, kirmizi negatif)

---

### E4-S2: Gelir Dagilimi Pasta Grafik

**Aciklama:** Kategori bazli gelir dagiliini gosteren dinamik pasta grafik

**Kabul Kriterleri:**
- [ ] FinanceCategory bazli DEBIT toplami
- [ ] Her dilim kategorinin rengini kullanir (FinanceCategory.color)
- [ ] Yeni kategori eklendiginde otomatik yeni dilim
- [ ] Hover'da tutar ve yuzde
- [ ] Legend (aciklama) altta
- [ ] Donem filtresi ile degisir
- [ ] Bos kategori gizlenir
- [ ] Recharts veya Chart.js ile implement

---

### E4-S3: Aylik Gelir-Gider Cubuk Grafik

**Aciklama:** 12 aylik gelir-gider karsilastirma cubuk grafik

**Kabul Kriterleri:**
- [ ] Son 12 ay gosterilir
- [ ] Yesil cubuk: Toplam tahsilat (CREDIT)
- [ ] Kirmizi cubuk: Toplam gider (Expense)
- [ ] Hover'da ay detayi
- [ ] Yil secimi ile degisir
- [ ] Responsive boyut

---

### E4-S4: Tahsilat Performansi

**Aciklama:** Tahsilat orani progress bar ve en borclu mukellefler listesi

**Kabul Kriterleri:**
- [ ] Progress bar: (COMPLETED / Tum DEBIT) * 100
- [ ] Renk: yesil >80%, sari >60%, kirmizi <60%
- [ ] En borclu mukellefler listesi (top 10)
- [ ] Her satirda: mukellef adi, borc tutari, gecikme suresi
- [ ] Siralama: borc tutarina gore azalan
- [ ] Donem filtresi

---

### E4-S5: Istatistikler Sayfasi (Tam Entegrasyon)

**Aciklama:** Tum istatistik componentlerinin entegre edilmesi

**Kabul Kriterleri:**
- [ ] Donem filtresi (ay/yil)
- [ ] 4 summary karti ust kisimda
- [ ] Pasta grafik + cubuk grafik orta kisimda
- [ ] Tahsilat performansi alt kisimda
- [ ] Export butonlari (Excel/PDF/yazdir)
- [ ] Loading state'ler (skeleton)
- [ ] Responsive layout

---

### E4-S6: Hesap Dokumu Tablosu

**Aciklama:** Mukellef bazli detayli hesap dokumu

**Kabul Kriterleri:**
- [ ] Tablo: Tarih, Islem Turu, Kategori, Aciklama, Borc, Alacak, Bakiye
- [ ] Running balance (cumlayan bakiye) hesaplamasi
- [ ] Filtreler:
  - Mukellef secimi (tekli veya tumu)
  - Tarih araligi
  - Kategori
  - Islem turu (borc/alacak/tumu)
- [ ] Siralama: tarihe gore
- [ ] Pagination veya virtual scroll
- [ ] Bos state (islem yok)

---

### E4-S7: Excel/PDF Export

**Aciklama:** Hesap dokumu ve istatistiklerin export edilmesi

**Kabul Kriterleri:**
- [ ] Excel export (xlsx kutuphanesi)
- [ ] PDF export (jspdf kutuphanesi)
- [ ] Filtrelenmis verinin export edilmesi
- [ ] Dosya adi: "Hesap_Dokumu_MukellefAdi_Tarih.xlsx/pdf"
- [ ] Export butonlari sayfada gorunur
- [ ] Buyuk veri icin async export (loading indicator)

---

## Epic 5: POLISH & ENTEGRASYON

**Amac:** Dashboard widget, bildirimler, performans ve son duzeltmeler
**Sprint:** 1
**Bagimlilk:** Epic 0-4

### E5-S1: Dashboard Finansal Ozet Widget

**Aciklama:** Ana dashboard'a finansal ozet widget'i eklenmesi

**Kabul Kriterleri:**
- [ ] Bu ay tahsilat orani
- [ ] Toplam bekleyen alacak
- [ ] Vadesi gecen islem sayisi
- [ ] Son 5 islem listesi
- [ ] "Detay" linki Finansal Islemler'e yonlendirir
- [ ] Widget mevcut dashboard layout'una uygun

---

### E5-S2: Bildirim Entegrasyonu

**Aciklama:** Finansal bildirimler dashboard bildirim paneline eklenmesi

**Kabul Kriterleri:**
- [ ] Vadesi bu hafta gecen tahsilatlar bildirimi
- [ ] Otomatik borclndirma sonuclari bildirimi
- [ ] Vadesi yaklasan cekler bildirimi
- [ ] Karsiliksiz cek uyarisi
- [ ] Bildirimler mevcut bildirim sistemine entegre

---

### E5-S3: Doviz Destegi (USD/EUR)

**Aciklama:** Tum formlarda doviz destegi ve kur hesaplamasi

**Kabul Kriterleri:**
- [ ] Para birimi secimi (TRY/USD/EUR) tum formlarda
- [ ] TRY disinda secildiginde kur girisi alani
- [ ] TL karsiligi otomatik hesaplanir (tutar * kur)
- [ ] Istatistiklerde TL bazinda gosterim
- [ ] Hesap dokumunde orijinal tutar + kur + TL karsiligi

---

### E5-S4: Performans Optimizasyonu

**Aciklama:** Buyuk veri setlerinde performans iyilestirmesi

**Kabul Kriterleri:**
- [ ] Virtual scrolling: 500+ satirli tablolarda
- [ ] Istatistik sorgulari: Aggregate query optimizasyonu
- [ ] React.memo: Tablo satirlari
- [ ] useMemo: Hesaplamalar
- [ ] Dynamic import: Grafik componentleri lazy load
- [ ] API pagination: cursor-based

---

### E5-S5: Son Duzeltmeler ve QA

**Aciklama:** Tum modulun son test ve duzeltmeleri

**Kabul Kriterleri:**
- [ ] Tum sayfalar responsive
- [ ] Tum metinler Turkce (karakter kontrolu)
- [ ] Tum formlar Zod validation
- [ ] Tum API'ler auth + tenantId guard
- [ ] Loading/error/empty state'ler
- [ ] Edge case testleri
- [ ] Cross-browser test (Chrome, Firefox, Safari)

---

## Bagimlilk Matrisi

```
E0 ──► E1 ──► E2 ──► E3 ──► E4 ──► E5
       │             │
       └─────────────┘
       (E3, E1'e bagimli)
```

| Story | Bagimli Oldugu |
|-------|---------------|
| E1-* | E0 tamamlanmis olmali |
| E2-S1..S5 | E1 tamamlanmis olmali |
| E2-S6 | E1 + Supabase pg_cron erisimi |
| E3-* | E1 tamamlanmis olmali |
| E4-* | E1 + E2 + E3 tamamlanmis olmali |
| E5-* | E0-E4 tamamlanmis olmali |

---

## Sprint Plani

| Sprint | Epic | Story'ler | Cikti |
|--------|------|-----------|-------|
| S1 | E0 | E0-S1, E0-S2, E0-S3, E0-S4, E0-S5 | Altyapi hazir |
| S2 | E1 | E1-S1, E1-S2, E1-S3 | Temel maliyet tanimi |
| S3 | E1 | E1-S4, E1-S5, E1-S6 | Muhasebe ucretleri tamamlanmis |
| S4 | E2 | E2-S1, E2-S2, E2-S3 | Temel tahsilat |
| S5 | E2 | E2-S4, E2-S5, E2-S6, E2-S7 | Cek + otomasyon |
| S6 | E3 | E3-S1, E3-S2, E3-S3 | Hizmetler + giderler |
| S7 | E4 | E4-S1, E4-S2, E4-S3 | Grafikler |
| S8 | E4 | E4-S4, E4-S5, E4-S6, E4-S7 | Raporlama |
| S9 | E5 | E5-S1, E5-S2, E5-S3, E5-S4, E5-S5 | Polish |

---

> **Epics & Stories v1.0.0** | Finansal Islemler Modulu | 2026-02-12
