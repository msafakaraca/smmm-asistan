# Finansal Islemler Modulu - Uygulama Plani

**Version:** 1.0.0
**Tarih:** 2026-02-12
**Referanslar:**
- PRD: prd-finansal-islemler.md
- Mimari: architecture-finansal-islemler.md
- Epic/Story: epics-and-stories-finansal-islemler.md

---

## 1. Uygulama Stratejisi

### Genel Yaklasim

Her epic icin Context Reset Protocol uygulanacak:
1. Story'yi oku ve anla
2. Ilgili dosyalari arastir
3. Kodu yaz
4. Test et
5. Story'yi tamamla

### Baslangic Sirasi

```
Sprint 1: E0 (Altyapi)
  → Prisma modeller → Seed → API iskelet → Nav menu → Tipler
  → CIKTI: Tum teknik temel hazir

Sprint 2-3: E1 (Muhasebe Ucretleri)
  → Kategoriler → Maliyet tanimi → SMM → Ayarlar → Toplu → Sayfa
  → CIKTI: Mali musavir maliyet kalemi tanimlayabilir

Sprint 4-5: E2 (Tahsilatlar)
  → Tablo → Form → Kismi odeme → Cek → Portfoy → Cron → Sayfa
  → CIKTI: Tahsilat alabilir, cek yonetebilir

Sprint 6: E3 (Hizmetler & Giderler)
  → Hizmetler → Giderler → Tekrarlayan
  → CIKTI: Ek hizmet ve gider kaydedebilir

Sprint 7-8: E4 (Istatistikler & Hesap Dokumu)
  → Kartlar → Grafikler → Performans → Dokumu → Export
  → CIKTI: Raporlama ve analiz

Sprint 9: E5 (Polish)
  → Widget → Bildirim → Doviz → Performans → QA
  → CIKTI: Production-ready modul
```

---

## 2. Sprint 1: Epic 0 - Altyapi (Detayli)

### Adim 1: Prisma Schema (E0-S1)

**Dosya:** prisma/schema.prisma

**Yapilacaklar:**
1. 10 enum ekle (Currency, Frequency, ChargeStrategy, TransactionType, TransactionStatus, PaymentMethod, CheckStatus, FinanceCategoryType, AutoChargeStatus, RecurringFrequency)
2. 6 model ekle (FinanceCategory, CostDefinition, FinancialTransaction, Check, Expense, AutoChargeLog)
3. Tenant modeline financialDefaults Json? ekle
4. Customer modeline yeni relation'lar ekle
5. Migration calistir: npx prisma migrate dev --name add_financial_models
6. Client generate: npx prisma generate

**Dikkat:**
- Decimal(12,2) para alanlari
- Decimal(5,2) oran alanlari
- Decimal(10,4) kur alani
- Tum modellerde tenantId + index
- AutoChargeLog'da @@unique([costDefinitionId, period])

### Adim 2: Seed Data (E0-S2)

**Dosya:** prisma/seed-finance.ts (veya mevcut seed.ts'ye ekleme)

**Yapilacaklar:**
1. 9 varsayilan gelir kategorisi
2. 10 varsayilan gider kategorisi
3. Her mevcut tenant icin seed calistir
4. Yeni tenant hook'una seed ekleme (varsa)

**Dikkat:**
- Idempotent: upsert kullan (tekrar calistiginda duplicate olmasin)
- isDefault: true (varsayilanlar icin)

### Adim 3: API Iskelet (E0-S3)

**Dizin:** src/app/api/finance/

**Yapilacaklar:**
1. 8 API dizini olustur (categories, cost-definitions, transactions, checks, expenses, stats, account-statement, settings)
2. Her dizinde route.ts ve gerekli alt dizinler
3. Temel CRUD pattern:
   - Auth guard (getUserWithProfile)
   - TenantId filtresi
   - Try-catch error handling
   - Turkce hata mesajlari

### Adim 4: Nav Menu (E0-S4)

**Dosya:** src/components/dashboard/nav.tsx

**Yapilacaklar:**
1. "Finansal Islemler" collapsible grubu ekle (Briefcase ikonu)
2. 6 alt menu itemi ekle
3. Her item icin route tanimla

**Sayfa Dizinleri:**
```
src/app/(dashboard)/dashboard/finansal-islemler/
├── page.tsx (ana sayfa - redirect veya ozet)
├── muhasebe-ucretleri/page.tsx
├── tahsilatlar/page.tsx
├── hizmetler/page.tsx
├── giderler/page.tsx
├── istatistikler/page.tsx
└── hesap-dokumu/page.tsx
```

### Adim 5: TypeScript Tipleri (E0-S5)

**Dosya:** src/components/finansal-islemler/shared/finance-types.ts

**Yapilacaklar:**
1. Tum enum TypeScript tipleri
2. Model interface'leri (Prisma generated'dan turetilmis)
3. API request/response tipleri
4. Form tipleri
5. Zod validation schemalari

---

## 3. Sprint 2-3: Epic 1 - Muhasebe Ucretleri (Detayli)

### Sprint 2:

**E1-S1: Kategori Yonetimi**
- src/components/finansal-islemler/shared/category-manager.tsx (dialog)
- src/components/finansal-islemler/shared/category-selector.tsx (dropdown)
- API: /api/finance/categories CRUD

**E1-S2: Maliyet Kalemi CRUD**
- src/components/finansal-islemler/muhasebe-ucretleri/cost-definition-table.tsx
- src/components/finansal-islemler/muhasebe-ucretleri/cost-definition-form.tsx
- API: /api/finance/cost-definitions CRUD
- Hook: src/components/finansal-islemler/hooks/use-cost-definitions.ts

**E1-S3: SMM Hesaplama**
- src/components/finansal-islemler/muhasebe-ucretleri/smm-calculator.tsx
- Canli hesaplama: Brut -> KDV -> Stopaj -> Net
- Reusable component (hizmetler sayfasinda da kullanilacak)

### Sprint 3:

**E1-S4: Varsayilan Ayarlar Paneli**
- src/components/finansal-islemler/muhasebe-ucretleri/default-settings-panel.tsx
- API: /api/finance/settings GET/PUT
- localStorage: panel acik/kapali durumu

**E1-S5: Toplu Ucret Belirleme**
- src/components/finansal-islemler/muhasebe-ucretleri/bulk-cost-form.tsx
- API: /api/finance/cost-definitions/bulk POST
- Mukellef multi-select

**E1-S6: Sayfa Entegrasyonu**
- src/app/(dashboard)/dashboard/finansal-islemler/muhasebe-ucretleri/page.tsx
- Tum componentlerin birlesmesi
- Loading/error/empty state

---

## 4. Sprint 4-5: Epic 2 - Tahsilatlar (Detayli)

### Sprint 4:

**E2-S1: Tahsilat Tablosu**
- src/components/finansal-islemler/tahsilatlar/collection-table.tsx
- Ozet kartlari (3 adet)
- Renk kodlamali tablo

**E2-S2: Tahsilat Formu**
- src/components/finansal-islemler/tahsilatlar/collection-form.tsx
- src/components/finansal-islemler/tahsilatlar/pending-debts-selector.tsx
- API: /api/finance/transactions/collect POST
- API: /api/finance/transactions/pending/[customerId] GET

**E2-S3: Kismi Tahsilat**
- parentTransactionId iliskisi
- Bakiye hesaplamasi: Borc - Sum(Odemeler)
- UI: Alt satir gosterimi

### Sprint 5:

**E2-S4: Cek Formu**
- src/components/finansal-islemler/tahsilatlar/check-form.tsx
- Check entity olusturma
- Transaction'a baglama

**E2-S5: Cek Portfoyu**
- Ayri tab veya section
- State machine UI
- Durum gecis dialog'u

**E2-S6: Otomatik Borclndirma**
- pg_cron SQL fonksiyonlari (Supabase migration)
- Ayar paneli: auto-charge-settings.tsx
- AutoChargeLog goruntuleme

**E2-S7: Sayfa Entegrasyonu**

---

## 5. Sprint 6: Epic 3 - Hizmetler & Giderler (Detayli)

**E3-S1: Hizmetler**
- src/components/finansal-islemler/hizmetler/service-table.tsx
- src/components/finansal-islemler/hizmetler/service-form.tsx
- SMM calculator reuse

**E3-S2: Giderler**
- src/components/finansal-islemler/giderler/expense-table.tsx
- src/components/finansal-islemler/giderler/expense-form.tsx

**E3-S3: Tekrarlayan Gider**
- isRecurring + recurringFrequency
- Cron entegrasyonu (mevcut auto_charge_tenants fonksiyonuna ekleme veya ayri)

---

## 6. Sprint 7-8: Epic 4 - Istatistikler & Hesap Dokumu (Detayli)

### Sprint 7:

**E4-S1: Summary Kartlari**
- API: /api/finance/stats/summary
- Aggregate query'ler

**E4-S2: Pasta Grafik**
- API: /api/finance/stats/income-distribution
- Recharts PieChart
- Dinamik renk: FinanceCategory.color

**E4-S3: Cubuk Grafik**
- API: /api/finance/stats/monthly-comparison
- Recharts BarChart
- 12 ay geri

### Sprint 8:

**E4-S4: Tahsilat Performansi**
- API: /api/finance/stats/collection-performance
- API: /api/finance/stats/top-debtors

**E4-S5: Sayfa Entegrasyonu**

**E4-S6: Hesap Dokumu**
- API: /api/finance/account-statement
- Running balance hesaplamasi
- Filtreleme

**E4-S7: Export**
- xlsx + jspdf kutuphaneleri
- Filtrelenmis veri export

---

## 7. Sprint 9: Epic 5 - Polish (Detayli)

**E5-S1: Dashboard Widget**
- Mevcut dashboard layout'a ekleme
- Finansal ozet karti

**E5-S2: Bildirimler**
- Mevcut bildirim sistemine entegrasyon

**E5-S3: Doviz**
- CurrencyInput shared component
- Kur hesaplamasi

**E5-S4: Performans**
- Virtual scrolling
- Lazy loading
- Query optimizasyon

**E5-S5: QA**
- Cross-browser test
- Responsive test
- Edge case test
- Turkce karakter kontrolu

---

## 8. Teknik Hazirlik Kontrol Listesi

### Baslangic Oncesi (E0 Oncesi)

- [ ] Mevcut Prisma schema incelenecek (cakisma kontrolu)
- [ ] Supabase pg_cron extension durumu kontrol edilecek
- [ ] Mevcut nav.tsx yapisi incelenecek
- [ ] Mevcut grafik kutuphanesi kontrolu (Recharts var mi?)
- [ ] Export kutuphaneleri kontrolu (xlsx, jspdf)
- [ ] Mevcut form pattern'leri incelenecek
- [ ] Mevcut hook pattern'leri incelenecek

### Her Story Oncesi

- [ ] Story kabul kriterlerini oku
- [ ] Etkilenecek dosyalari belirle
- [ ] Mevcut pattern'lere uy
- [ ] Auth guard + tenantId kontrol
- [ ] Turkce metinler
- [ ] Error handling

---

## 9. Risk Azaltma Plani

| Risk | Azaltma | Sorumluluk |
|------|---------|------------|
| pg_cron Supabase'de aktif degil | E0'da kontrol et, alternatif: API-level cron | E0-S1 |
| Prisma migration cakismasi | Mevcut schema dikkatli inceleme | E0-S1 |
| Grafik performansi (buyuk veri) | Lazy load + pagination | E4, E5 |
| Decimal yuvarlama hatalari | Unit test + edge case | Her sprint |
| Cek state gecis hatalari | Validation layer + test | E2-S5 |

---

## 10. Baslatma Komutu

Uygulamaya baslamak icin:

```
1. /clear
2. "architecture-finansal-islemler.md ve epics-and-stories-finansal-islemler.md
    dokumanlarini oku. Epic 0, Story E0-S1'den baslayarak uygulamaya basla."
```

Her story tamamlandiginda bir sonraki story'ye gec.
Her epic tamamlandiginda /clear yapip sonraki epic'e gec.

---

> **Implementation Plan v1.0.0** | Finansal Islemler Modulu | 2026-02-12
