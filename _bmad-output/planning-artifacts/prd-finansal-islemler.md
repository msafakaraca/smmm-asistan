# Finansal Islemler Modulu - PRD (Product Requirements Document)

**Version:** 1.0.0
**Tarih:** 2026-02-12
**Durum:** Onaylandi - Party Mode Tartismasi Tamamlandi
**Hazırlayan:** BMAD Party Mode (Tum Ajanlar)
**Oncelik:** YUKSEK - Acil

---

## 1. Urun Ozeti

### 1.1 Vizyon

Finansal Islemler modulu, mali musavirin tum finansal operasyonlarini (muhasebe ucretleri, tahsilatlar, hizmetler, giderler, istatistikler ve hesap dokumu) tek bir platformdan yonetmesini saglayan kapsamli bir cari kasa ve finans yonetim sistemidir.

### 1.2 Temel Deger Onerisi

| Deger | Aciklama |
|-------|----------|
| **Tam Ozgurluk** | Mali musavir sinir tanimadan diledigini kalem olusturur, kategorize eder, faturalar |
| **Esnek Odeme** | Aylik, 3 aylik, 6 aylik, yillik, tek seferlik + dagitim stratejisi |
| **Akilli Otomasyon** | Otomatik borclndirma, otomatik bakiye hesaplama, tekrarlayan kayitlar |
| **Canli Istatistikler** | Yeni kategori = yeni grafik dilimi, sifir mudahale |
| **Para Guvenligi** | Decimal hassasiyet, audit log, cift kayit engelleme |

### 1.3 Hedef Kullanici

| Segment | Aciklama |
|---------|----------|
| **Birincil** | SMMM ofis sahibi / yoneticisi |
| **Ikincil** | SMMM ofis calisanlari (muhasebe elemani) |
| **Haric** | Mukellefler (erisim YOK) |

### 1.4 Problem Tanimi

Mali musavirler su an:
- Excel'de tahsilat takibi yapiyorlar - hata ve zaman kaybi
- Kim odedi, kim odemedi bilgisi dagnik - nakit akisi gorulmuyor
- Ek hizmet ucretleri (sirket kurulus, sermaye artirimi) takip edilemiyor
- Ofis giderleri ayri bir yerde tutuluyor - karlilik hesabi zor
- Cek vade takibi manuel yapiliyor - unutma riski yuksek
- Farkli odeme periyotlari (3 aylik cek, yillik odeme) yonetilemiyorr

---

## 2. Kapsam

### 2.1 Dahil (In Scope)

| # | Ozellik | Aciklama |
|---|---------|----------|
| 1 | Muhasebe Ucretleri & Maliyet Kalemleri | Sinrsiz kategori, esnek periyot, SMM destegi |
| 2 | Tahsilatlar | Coklu borc tahsilati, kismi odeme, cek, nakit, havale |
| 3 | Hizmetler | Ek hizmet faturalandirma, ozel kategoriler |
| 4 | Giderler | Ofis giderleri, tekrarlayan gider otomasyonu |
| 5 | Istatistikler | Dinamik grafikler, kategori bazli analiz |
| 6 | Hesap Dokumu | Filtrelenebilir, Excel/PDF export |
| 7 | Cek Yonetimi | Portfoy, tahsil, karsiliksiz, iade state machine |
| 8 | Otomatik Borclndirma | Konfigurasyon bazli cron, tenant'a ozel gun |
| 9 | Doviz Destegi | USD/EUR, manuel kur girisi |
| 10 | SMM Hesaplama | KDV (%20) + Stopaj (%20) otomatik hesaplama |

### 2.2 Haric (Out of Scope)

| # | Ozellik | Neden |
|---|---------|-------|
| 1 | Mukellef portal erisimi | Bu fazda kapsam disi |
| 2 | Otomatik kur cekme (TCMB API) | Ileri faz, manuel yeterli |
| 3 | E-Fatura/E-Arsiv entegrasyonu | Ileri faz |
| 4 | Banka entegrasyonu (otomatik mutabakat) | Ileri faz |
| 5 | WhatsApp tahsilat hatirlatma | Epic 5'te degerlendirilecek |

---

## 3. Kullanici Hikayeleri (User Stories)

### 3.1 Ana Kullanici Hikayesi (Primary Job)

> "Mali musavir olarak, tum mukelleflerimin mali durumunu tek bir yerden gormek ve tahsilat takibi yapmak istiyorum, boylece nakit akisimi kontrol edebilirim."

### 3.2 Alt Hikayeler

#### Muhasebe Ucretleri & Maliyet Kalemleri

| ID | Hikaye | Oncelik |
|----|--------|---------|
| US-F01 | Mali musavir olarak, herhangi bir maliyet kalemini (muhasebe ucreti, defter saklama, SGK hizmeti vb.) herhangi bir mukellefe tanimlayabilmek istiyorum | P0 |
| US-F02 | Mali musavir olarak, maliyet kalemine odeme periyodu (aylik/3 aylik/6 aylik/yillik/tek seferlik) atayabilmek istiyorum | P0 |
| US-F03 | Mali musavir olarak, yillik bir maliyeti aylara esit dagitabilmek veya toplu borclndiabilmek istiyorum (dagitim stratejisi) | P0 |
| US-F04 | Mali musavir olarak, serbest meslek makbuzu keseceksem KDV ve stopaj otomatik hesaplansin istiyorum | P0 |
| US-F05 | Mali musavir olarak, makbuz kesmeyeceksem sadece brut tutar uzerinden calisabilmek istiyorum | P0 |
| US-F06 | Mali musavir olarak, varsayilan KDV/Stopaj/SMM ayarlarini Muhasebe Ucretleri sayfasinda belirleyebilmek istiyorum | P1 |
| US-F07 | Mali musavir olarak, birden fazla mukellefe tek seferde ayni maliyet kalemini tanmlayabilmek istiyorum (toplu ucret belirleme) | P1 |
| US-F08 | Mali musavir olarak, kendi ozel maliyet kategorilerimi olusturabilmek istiyorum (sinrsiz kategori) | P0 |

#### Tahsilatlar

| ID | Hikaye | Oncelik |
|----|--------|---------|
| US-F10 | Mali musavir olarak, mukelleften tahsilat aldigimda bunu kaydetmek ve bakiyeyi otomatik dusurmek istiyorum | P0 |
| US-F11 | Mali musavir olarak, birden fazla borcu tek seferde tahsil edebilmek istiyorum (coklu borc secimi) | P0 |
| US-F12 | Mali musavir olarak, kismi odeme yapildiginda kalan bakiyeyi takip edebilmek istiyorum | P0 |
| US-F13 | Mali musavir olarak, odeme yontemini secebilmek istiyorum (nakit, havale/EFT, kredi karti, cek) | P0 |
| US-F14 | Mali musavir olarak, cekle odeme alindiginda cek bilgilerini (numara, banka - opsiyonel, vade) girebilmek istiyorum | P0 |
| US-F15 | Mali musavir olarak, otomatik borclndirma gununu Tahsilatlar sayfasindan ayarlayabilmek istiyorum (1-28) | P1 |
| US-F16 | Mali musavir olarak, vadesi gecen tahsilatlari kirmizi vurgulu olarak gorebilmek istiyorum | P1 |

#### Cek Yonetimi

| ID | Hikaye | Oncelik |
|----|--------|---------|
| US-F20 | Mali musavir olarak, portfoydeki ceklerin listesini ve vade takvimini gorebilmek istiyorum | P0 |
| US-F21 | Mali musavir olarak, cekin durumunu guncelleyebilmek istiyorum (portfolyde -> tahsil edildi / karslksz / iade) | P0 |
| US-F22 | Mali musavir olarak, vadesi yaklasan cekler icin bildirim alabilmek istiyorum | P1 |

#### Hizmetler

| ID | Hikaye | Oncelik |
|----|--------|---------|
| US-F30 | Mali musavir olarak, mukellefe ek hizmet (sirket kurulus, sermaye artirimi, adres degisikligi vb.) faturalandirabilmek istiyorum | P0 |
| US-F31 | Mali musavir olarak, hizmet kategorilerini kendim olusturup yonetebilmek istiyorum | P0 |
| US-F32 | Mali musavir olarak, hizmet bedelinin mukellef bakiyesine otomatik borclnmasini istiyorum | P0 |

#### Giderler

| ID | Hikaye | Oncelik |
|----|--------|---------|
| US-F40 | Mali musavir olarak, ofis giderlerimi (personel, kira, elektrik, su, demirbas) kayit altina alabilmek istiyorum | P0 |
| US-F41 | Mali musavir olarak, tekrarlayan giderleri (kira, personel maasi) otomatik kayit olarak tanimlayabilmek istiyorum | P1 |
| US-F42 | Mali musavir olarak, gider kategorilerimi kendim olusturup yonetebilmek istiyorum | P0 |
| US-F43 | Mali musavir olarak, yillik bazda giderleri de kaydedebilmek istiyorum (ornegin yillik yazilim lisansi) | P1 |

#### Istatistikler

| ID | Hikaye | Oncelik |
|----|--------|---------|
| US-F50 | Mali musavir olarak, toplam alacak, bu ay tahsilat, toplam gider ve net kar bilgilerini summary kartlarinda gorebilmek istiyorum | P0 |
| US-F51 | Mali musavir olarak, gelir dagiliini kategori bazli pasta grafikte gorebilmek istiyorum (yeni kategori eklenince otomatik guncelleme) | P0 |
| US-F52 | Mali musavir olarak, aylik gelir-gider karsilastirmasini cubuk grafikte gorebilmek istiyorum | P0 |
| US-F53 | Mali musavir olarak, tahsilat performansimi (oran) ve en borclu mukellefleri gorebilmek istiyorum | P1 |
| US-F54 | Mali musavir olarak, donem filtrelemesi yapabilmek istiyorum (ay, yil) | P0 |

#### Hesap Dokumu

| ID | Hikaye | Oncelik |
|----|--------|---------|
| US-F60 | Mali musavir olarak, mukellef bazli detayli hesap dokumu (tarih, islem turu, aciklama, borc, alacak, bakiye) gorebilmek istiyorum | P0 |
| US-F61 | Mali musavir olarak, hesap dokumunu tarih araligi, mukellef ve kategori ile filtreleyebilmek istiyorum | P0 |
| US-F62 | Mali musavir olarak, hesap dokumunu Excel ve PDF olarak export edebilmek istiyorum | P0 |
| US-F63 | Mali musavir olarak, tum mukelleflerin topluca hesap dokumunu alabilmek istiyorum | P1 |

---

## 4. Fonksiyonel Gereksinimler

### 4.1 Menu Yapisi

```
Sol Menu (Dashboard Nav):
📊 Dashboard
👥 Mukellefler
📋 Kontrol
💼 Finansal Islemler          <-- YENi ANA MENU
   ├── 💰 Muhasebe Ucretleri
   ├── 💳 Tahsilatlar
   ├── 🔧 Hizmetler
   ├── 📦 Giderler
   ├── 📈 Istatistikler
   └── 📄 Hesap Dokumu
📁 Dosyalar
🔑 Sifreler
📅 Takip Cizelgesi
⏰ Hatirlaticilar
⚙️ Ayarlar
```

### 4.2 Kategori Sistemi

**Varsayilan Gelir Kategorileri (Seed Data):**

| # | Kategori | Renk | Tipik Kullanim |
|---|----------|------|----------------|
| 1 | Muhasebe Ucreti | Mavi | Aylik defter tutma |
| 2 | Beyanname Hizmeti | Yesil | Beyanname hazirlama |
| 3 | SGK Hizmeti | Sari | SGK bildirge/tahakkuk |
| 4 | Sirket Kurulusu | Mor | Yeni sirket kurma |
| 5 | Sermaye Artirimi | Kahve | Sermaye degisikligi |
| 6 | Adres Degisikligi | Turuncu | Adres/unvan degisikligi |
| 7 | Defter Saklama | Gri | Yillik defter arsivleme |
| 8 | Danismanlik | Kirmizi | Genel mali danismanlik |
| 9 | Diger Hizmetler | Siyah | Kategorize edilmemis |

**Varsayilan Gider Kategorileri:**

| # | Kategori | Tipik Kullanim |
|---|----------|----------------|
| 1 | Personel Gideri | Maas, SGK, prim |
| 2 | Kira | Ofis kirasi |
| 3 | Elektrik | Ofis elektrigi |
| 4 | Su | Ofis suyu |
| 5 | Internet/Telefon | Iletisim giderleri |
| 6 | Kirtasiye | Ofis malzemeleri |
| 7 | Demirbas | Bilgisayar, mobilya |
| 8 | Yazilim Lisansi | E-Donusum, muhasebe yazilimi |
| 9 | Ulasim | Yol, arac giderleri |
| 10 | Diger Giderler | Kategorize edilmemis |

**Kurallar:**
- Mali musavir varsayilan kategorileri duzenleyebilir veya silebilir
- Sinrsiz ozel kategori olusturabilir
- Her kategorinin rengi ve ikonu ozellestirilebilir
- Kategoriler tenant bazli izole (multi-tenant)
- Silinen kategoriye bagli islemler varsa uyari ver

### 4.3 Maliyet Tanimlama (CostDefinition)

**Amac:** Mukellefe tekrarlayan veya tek seferlik maliyet kalemi tanimlamak

**Ozellikler:**
- Mukellef secimi (zorunlu)
- Kategori secimi veya yeni kategori olusturma
- Tutar + para birimi (TRY/USD/EUR)
- Odeme periyodu: Aylik, 3 Aylik, 6 Aylik, Yillik, Tek Seferlik
- Dagitim stratejisi (yillik maliyetlerde):
  - FULL: Vade gelince toplu borclandirma
  - DISTRIBUTED: Aylara esit dagitim
- SMM (Serbest Meslek Makbuzu) destegi:
  - Toggle: Makbuz kesilecek mi? (Evet/Hayir)
  - KDV orani: Varsayilan %20 (degistirilebilir)
  - Stopaj orani: Varsayilan %20 (degistirilebilir)
  - Canli onizleme: Brut, KDV, Stopaj, Net tutarlar
- Baslangic/bitis tarihi
- Aktif/pasif durumu

**SMM Hesaplama Formulu:**
```
Brut Tutar:  X TL
KDV:        +X * kdvRate (varsayilan %20)
Stopaj:     -X * stopajRate (varsayilan %20)
Net:        = Brut + KDV - Stopaj
```

**Contextual Ayarlar (Muhasebe Ucretleri sayfasinda):**
- Varsayilan SMM toggle
- Varsayilan KDV orani
- Varsayilan Stopaj orani
- Collapsible panel (localStorage ile hatirla)

### 4.4 Tahsilatlar

**Amac:** Mukelleflerden alinan odemeleri kaydetmek

**Ozellikler:**
- Mukellef secimi -> bekleyen borclar otomatik listelenir
- Coklu borc secimi (checkbox ile birden fazla borc sec)
- Tahsil edilen tutar girisi (farkliysa kismi tahsilat)
- Odeme yontemi secimi:
  - Nakit
  - Havale/EFT
  - Kredi Karti
  - Cek (secildiginde cek formu acilir)
- Cek bilgileri (cek secildikten):
  - Cek No (opsiyonel)
  - Banka (opsiyonel)
  - Vade tarihi (zorunlu)
  - Tutar (zorunlu)
- Doviz islemlerinde:
  - Para birimi secimi (TRY/USD/EUR)
  - Manuel kur girisi
  - Otomatik TL karsiligi hesaplama
- Tarih ve not alani

**Contextual Ayarlar (Tahsilatlar sayfasinda):**
- Otomatik borclndirma aktif/pasif toggle
- Borclndirma gunu (1-28 arasi, varsayilan: 1)
- Collapsible panel

**Otomatik Borclndirma Mekanizmasi:**
- Supabase pg_cron ile her gece 00:01'de calisir
- Bugunun gununu kontrol eder
- autoChargeDay = bugun olan tenant'lari bulur
- Aktif CostDefinition kayitlarini isler:
  - MONTHLY: Her ay
  - QUARTERLY: 3 ayda bir (Oca, Nis, Tem, Eki)
  - BIANNUAL: 6 ayda bir (Oca, Tem)
  - ANNUAL: Yilda bir (baslangic ayinda)
  - ONE_TIME: Sadece ilk kez (sonra isActive = false)
- DISTRIBUTED stratejide: yillik tutar / 12 aylik borclandirma
- FULL stratejide: toplu borclandirma
- Cift borclandirma engeli: AutoChargeLog + unique constraint
- Basarili/basarisiz log kaydi

### 4.5 Cek Yonetimi

**State Machine:**
```
                    ┌─────────────┐
                    │ IN_PORTFOLIO │ (Portfoyde)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌───────────┐ ┌──────────┐ ┌──────────┐
       │ COLLECTED  │ │ BOUNCED  │ │ RETURNED │
       │(Tahsil Ed.)│ │(Karsilksz)│ │ (Iade)   │
       └───────────┘ └──────────┘ └──────────┘
```

**Gecerli gecisler:**
- IN_PORTFOLIO -> COLLECTED (cek tahsil edildi)
- IN_PORTFOLIO -> BOUNCED (cek karslksz cikti)
- IN_PORTFOLIO -> RETURNED (cek iade edildi)

**Gecersiz gecisler (engellenmeli):**
- COLLECTED -> herhangi bir durum
- BOUNCED -> herhangi bir durum (yeni cek olusturulmali)
- RETURNED -> herhangi bir durum

### 4.6 Hizmetler

**Amac:** Mukellefe ek hizmet faturalandirmak

**Ozellikler:**
- Mukellef secimi
- Hizmet kategorisi secimi veya yeni olusturma
- Tutar + para birimi
- Vade secimi (odeme periyodu)
- SMM bilgileri (maliyet tanimiyla ayni)
- Islem otomatik olarak FinancialTransaction'a DEBIT olarak yazilir

### 4.7 Giderler

**Amac:** Ofis ici giderleri kaydetmek (mukellefe BAGLI DEGIL)

**Ozellikler:**
- Gider kategorisi secimi veya yeni olusturma
- Tutar + para birimi
- Tarih
- Aciklama
- Tekrarlayan gider toggle:
  - Evet ise: periyot secimi (aylik/3 aylik/yillik)
  - Sistem otomatik olarak her periyotta gider kaydeder
- Yillik giderler desteklenir (ornegin yazilim lisansi)

### 4.8 Istatistikler

**Amac:** Finansal durumin gorsel ozeti

**Bilesenler:**

1. **Summary Kartlari (4 adet):**
   - Toplam Alacak (bekleyen borclar toplami)
   - Bu Ay Tahsilat (bu aydaki tahsilatlar toplami)
   - Toplam Gider (secili donemdeki giderler)
   - Net Kar (Tahsilat - Gider)

2. **Gelir Dagilimi Pasta Grafik:**
   - Kategori bazli gelir dagilimi
   - DINAMIK: Yeni kategori eklendiginde otomatik yeni dilim
   - Her kategorinin kendi rengi (FinanceCategory.color)
   - Hover'da tutar ve yuzde gosterimi

3. **Aylik Gelir-Gider Cubuk Grafik:**
   - 12 aylik karsilastirma
   - Yesil: Gelir (tahsilatlar)
   - Kirmizi: Gider
   - Hover'da detay

4. **Tahsilat Performansi:**
   - Progress bar: Tahsilat orani (%)
   - En borclu mukellefler listesi (top 5-10)
   - Gecikme suresi bilgisi

5. **Yaklasan Vadeler Takvimi (opsiyonel):**
   - Bu aydaki cek vadeleri
   - Bu aydaki borclanma tarihleri

**Filtreler:**
- Donem: Ay ve Yil secimi
- Kategori filtresi

**Export:**
- Excel, PDF, Yazdir secenekleri

### 4.9 Hesap Dokumu

**Amac:** Mukellef bazli detayli islem gecmisi

**Tablo Kolonlari:**
| Kolon | Aciklama |
|-------|----------|
| Tarih | Islem tarihi |
| Islem Turu | Borc/Alacak |
| Kategori | Maliyet kalemi kategorisi |
| Aciklama | Islem detayi |
| Borc | Borclandirma tutari |
| Alacak | Tahsilat tutari |
| Bakiye | Running balance (cumlayan bakiye) |

**Filtreler:**
- Mukellef secimi (tekli veya tumu)
- Tarih araligi
- Kategori
- Islem turu (borc/alacak/tumu)

**Export:** Excel ve PDF

---

## 5. Veri Modeli

### 5.1 Yeni Modeller (6 adet)

```
FinanceCategory (Dinamik Kategori)
├── id: UUID @id
├── name: String
├── type: Enum (INCOME/EXPENSE)
├── isDefault: Boolean
├── color: String?
├── icon: String?
├── tenantId: UUID
├── createdAt: DateTime
├── updatedAt: DateTime
└── @@unique([tenantId, name, type])

CostDefinition (Maliyet Tanimi)
├── id: UUID @id
├── customerId: UUID -> Customer
├── categoryId: UUID -> FinanceCategory
├── description: String?
├── amount: Decimal(12,2)
├── currency: Enum (TRY/USD/EUR)
├── frequency: Enum (MONTHLY/QUARTERLY/BIANNUAL/ANNUAL/ONE_TIME)
├── chargeStrategy: Enum (FULL/DISTRIBUTED)
├── hasSMM: Boolean
├── kdvRate: Decimal?
├── stopajRate: Decimal?
├── startDate: DateTime
├── endDate: DateTime?
├── isActive: Boolean
├── tenantId: UUID
├── createdAt: DateTime
├── updatedAt: DateTime
└── @@index([tenantId, customerId])

FinancialTransaction (Merkezi Islem Defteri)
├── id: UUID @id
├── customerId: UUID? -> Customer
├── costDefinitionId: UUID? -> CostDefinition
├── categoryId: UUID -> FinanceCategory
├── type: Enum (DEBIT/CREDIT)
├── amount: Decimal(12,2)
├── currency: Enum (TRY/USD/EUR)
├── exchangeRate: Decimal?
├── originalAmount: Decimal?
├── grossAmount: Decimal?
├── kdvAmount: Decimal?
├── stopajAmount: Decimal?
├── netAmount: Decimal(12,2)
├── description: String?
├── date: DateTime
├── dueDate: DateTime?
├── paymentMethod: Enum? (CASH/BANK_TRANSFER/EFT/CHECK/CREDIT_CARD)
├── checkId: UUID? -> Check
├── status: Enum (PENDING/COMPLETED/PARTIAL/CANCELLED)
├── parentTransactionId: UUID? (kismi odeme bagi)
├── autoGenerated: Boolean
├── tenantId: UUID
├── createdAt: DateTime
├── updatedAt: DateTime
└── @@index([tenantId, customerId, date])

Check (Cek)
├── id: UUID @id
├── checkNumber: String?
├── bankName: String?
├── amount: Decimal(12,2)
├── currency: Enum (TRY/USD/EUR)
├── issueDate: DateTime
├── dueDate: DateTime
├── status: Enum (IN_PORTFOLIO/COLLECTED/BOUNCED/RETURNED)
├── customerId: UUID -> Customer
├── note: String?
├── tenantId: UUID
├── createdAt: DateTime
├── updatedAt: DateTime
└── @@index([tenantId, dueDate])

Expense (Ofis Gideri)
├── id: UUID @id
├── categoryId: UUID -> FinanceCategory
├── amount: Decimal(12,2)
├── currency: Enum (TRY/USD/EUR)
├── date: DateTime
├── description: String?
├── isRecurring: Boolean
├── recurringFrequency: Enum? (MONTHLY/QUARTERLY/ANNUAL)
├── tenantId: UUID
├── createdAt: DateTime
├── updatedAt: DateTime
└── @@index([tenantId, date])

AutoChargeLog (Otomatik Islem Logu)
├── id: UUID @id
├── costDefinitionId: UUID -> CostDefinition
├── transactionId: UUID? -> FinancialTransaction
├── period: String (ornegin "2026-02")
├── status: Enum (SUCCESS/FAILED)
├── errorMessage: String?
├── executedAt: DateTime
├── tenantId: UUID
└── @@unique([costDefinitionId, period])
```

### 5.2 Mevcut Model Degisiklikleri

```
Tenant modeline ekleme:
├── financialDefaults: Json?
│   {
│     "hasSMM": true,
│     "defaultKdvRate": 20,
│     "defaultStopajRate": 20,
│     "autoChargeEnabled": true,
│     "autoChargeDay": 1
│   }
```

### 5.3 Iliskiler

```
Customer 1--N CostDefinition
Customer 1--N FinancialTransaction
Customer 1--N Check
FinanceCategory 1--N CostDefinition
FinanceCategory 1--N FinancialTransaction
FinanceCategory 1--N Expense
CostDefinition 1--N FinancialTransaction
CostDefinition 1--N AutoChargeLog
Check 1--1 FinancialTransaction
FinancialTransaction 1--N FinancialTransaction (parent-child: kismi odeme)
```

---

## 6. API Endpoints

### 6.1 Kategori API

| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET | /api/finance/categories | Tum kategorileri listele |
| POST | /api/finance/categories | Yeni kategori olustur |
| PUT | /api/finance/categories/[id] | Kategori guncelle |
| DELETE | /api/finance/categories/[id] | Kategori sil |

### 6.2 Maliyet Tanimi API

| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET | /api/finance/cost-definitions | Maliyet tanimlari listele |
| GET | /api/finance/cost-definitions/[id] | Maliyet tanimi detay |
| POST | /api/finance/cost-definitions | Yeni maliyet tanimi |
| POST | /api/finance/cost-definitions/bulk | Toplu maliyet tanimi |
| PUT | /api/finance/cost-definitions/[id] | Maliyet tanimi guncelle |
| DELETE | /api/finance/cost-definitions/[id] | Maliyet tanimi sil |

### 6.3 Tahsilat (Islem) API

| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET | /api/finance/transactions | Islemleri listele (filtreli) |
| GET | /api/finance/transactions/[id] | Islem detay |
| POST | /api/finance/transactions | Yeni islem (tahsilat/borc) |
| PUT | /api/finance/transactions/[id] | Islem guncelle |
| DELETE | /api/finance/transactions/[id] | Islem sil (soft) |
| GET | /api/finance/transactions/pending/[customerId] | Mukellefin bekleyen borclari |
| POST | /api/finance/transactions/collect | Coklu tahsilat kaydi |

### 6.4 Cek API

| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET | /api/finance/checks | Cekleri listele |
| GET | /api/finance/checks/[id] | Cek detay |
| POST | /api/finance/checks | Yeni cek |
| PUT | /api/finance/checks/[id]/status | Cek durumu guncelle |

### 6.5 Gider API

| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET | /api/finance/expenses | Giderleri listele |
| POST | /api/finance/expenses | Yeni gider |
| PUT | /api/finance/expenses/[id] | Gider guncelle |
| DELETE | /api/finance/expenses/[id] | Gider sil |

### 6.6 Istatistik API

| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET | /api/finance/stats/summary | Summary kartlari verileri |
| GET | /api/finance/stats/income-distribution | Kategori bazli gelir dagilimi |
| GET | /api/finance/stats/monthly-comparison | Aylik gelir-gider karsilastirma |
| GET | /api/finance/stats/collection-performance | Tahsilat performansi |
| GET | /api/finance/stats/top-debtors | En borclu mukellefler |

### 6.7 Hesap Dokumu API

| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET | /api/finance/account-statement | Hesap dokumu (filtreli) |
| GET | /api/finance/account-statement/export | Excel/PDF export |

### 6.8 Ayarlar API

| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET | /api/finance/settings | Finansal varsayilan ayarlar |
| PUT | /api/finance/settings | Finansal ayarlari guncelle |

---

## 7. UX/UI Gereksinimleri

### 7.1 Genel UX Prensipleri

- **Contextual Settings:** Tum ayarlar ilgili sayfada, ayri ayarlar sayfasi YOK
- **Collapsible Panels:** Ayar panelleri acilip kapanabilir (localStorage ile hatirla)
- **Canli Hesaplama:** SMM (KDV/Stopaj) tutarlari form doldurulurken canli guncellenir
- **Renk Kodlama:** Vadesi gecen (kirmizi), bekleyen (sari), odenmis (yesil)
- **Coklu Secim:** Tahsilatta birden fazla borc secip tek seferde tahsil etme
- **Responsive:** Tum sayfalar mobil uyumlu
- **Turkce:** Tum UI metinleri, hata mesajlari, etiketler Turkce

### 7.2 Dashboard Widget

Finansal ozet widget'i dashboard'a eklenir:
- Bu ay tahsilat orani
- Toplam bekleyen alacak
- Vadesi gecen islem sayisi
- Son 5 islem listesi

### 7.3 Bildirimler

Dashboard bildirim paneline entegre:
- Vadesi bu hafta gecen tahsilatlar
- Otomatik borclndirma sonuclari
- Vadesi yaklasan cekler
- Karsiliksiz cek uyarilari

---

## 8. Teknik Gereksinimler

### 8.1 Performans

- Para alanlari: Decimal(12,2) - KESINLIKLE float/double YASAK
- 500+ satirli listeler: Virtual scrolling (TanStack Virtual)
- Istatistik sorgulari: Aggregate query'ler, N+1 onleme
- Index stratejisi: tenantId, customerId, date, dueDate

### 8.2 Guvenlik

- Her API'de auth check + tenantId filtresi
- Multi-tenant izolasyon: RLS + application-level
- Finansal islem silme: Soft delete (gercekten silme)
- Audit log: Otomatik islemler icin AutoChargeLog

### 8.3 Doviz

- Desteklenen para birimleri: TRY, USD, EUR
- Kur girisi: Manuel (mali musavir girer)
- Kur sabitlenmesi: Islem anindaki kur kaydedilir
- TL karsiligi: amount * exchangeRate

### 8.4 Otomatik Borclndirma

- Mekanizma: Supabase pg_cron extension
- Calisma zamani: Her gece 00:01
- Tenant bazli gun: autoChargeDay (1-28)
- Idempotency: AutoChargeLog unique constraint
- Hata yonetimi: Basarisiz islemler loglanir

---

## 9. Basari Metrikleri

| Metrik | Hedef |
|--------|-------|
| Tahsilat kayit suresi | < 30 saniye |
| Maliyet tanimi suresi | < 1 dakika |
| Istatistik sayfa yuklenme | < 2 saniye |
| Excel export | < 5 saniye (1000 satir) |
| Otomatik borclndirma hatasi | < %0.1 |
| Kullanici memnuniyeti | > %90 |

---

## 10. Kisitlamalar ve Riskler

### 10.1 Kisitlamalar

| Kisit | Etki |
|-------|------|
| pg_cron Supabase plan gereksinimleri | Pro plan gerekebilir |
| Doviz kuru manuel | Kullanici yuku |
| Mukellef erisimi yok | Islem hacmi mali musavir kapasitesi ile sinirli |

### 10.2 Riskler

| Risk | Etki | Olasilik | Azaltma |
|------|------|----------|---------|
| Yanlis borclandirma | Kritik | Orta | Unit test + idempotency |
| Cift tahsilat | Kritik | Dusuk | Unique constraint + UI guard |
| Cek vade hesaplama | Yuksek | Orta | Edge case testleri |
| Para yuvarlama | Yuksek | Yuksek | Decimal(12,2) zorunlu |
| Tenant veri sizintisi | Kritik | Dusuk | tenantId her sorgu + RLS |
| Kategori silme veri kaybi | Orta | Orta | Bagli veri varsa engelle |

---

## 11. Karar Matrisi

| # | Karar | Sonuc | Kim |
|---|-------|-------|-----|
| 1 | Modul onceligi | YUKSEK - Acil | Safa |
| 2 | Kapsam | 6 alt modul, sirali teslimat | Safa |
| 3 | Erisim | Sadece mali musavir | Safa |
| 4 | Orijinallik | Kendi tasarimiz | Safa |
| 5 | Odeme periyotlari | Aylik/3 ay/6 ay/Yillik/Tek sefer | Safa |
| 6 | Kategori yapisi | Dinamik - mali musavir olusturur | John + Safa |
| 7 | SMM destegi | Opsiyonel toggle (KDV %20, Stopaj %20) | Mary arastirma |
| 8 | Cek detayi | Banka + Cek No opsiyonel | Safa |
| 9 | Tekrarlayan gider | Otomatik kayit secenegi | Safa |
| 10 | Yillik maliyet dagitimi | FULL veya DISTRIBUTED secimi | Winston |
| 11 | Doviz kuru | Manuel giris (API yok) | Safa |
| 12 | Borclandirma gunu | Tenant bazli 1-28 | Safa |
| 13 | Sprint sayisi | 9 sprint | Safa |
| 14 | Para hassasiyeti | Decimal(12,2) | Winston |
| 15 | Cron mekanizmasi | Supabase pg_cron | Winston |
| 16 | Ayarlar lokasyonu | Ilgili sayfalarda contextual | Safa |
| 17 | SMM/KDV/Stopaj varsayilanlari | Muhasebe Ucretleri sayfasinda | Safa |
| 18 | Otomatik borclandirma ayari | Tahsilatlar sayfasinda | Safa |
| 19 | Ayar pattern | Global default + kalem bazinda override | Winston |

---

## 12. Epic Plani (Yuksek Seviye)

```
Epic 0: ALTYAPI & VERI MODELI (1 sprint)
Epic 1: MALIYET TANIMLAMASI & MUH. UCRETLERI (2 sprint)
Epic 2: TAHSILATLAR & CEK (2 sprint)
Epic 3: HIZMETLER & GIDERLER (1 sprint)
Epic 4: ISTATISTIKLER & HESAP DOKUMU (2 sprint)
Epic 5: POLISH & ENTEGRASYON (1 sprint)
TOPLAM: ~9 sprint
```

Detayli epic ve story yapisi ayri dokumanda (epics-and-stories-finansal-islemler.md)

---

> **PRD v1.0.0** | Finansal Islemler Modulu | 2026-02-12 | BMAD Party Mode
