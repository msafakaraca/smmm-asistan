# Handoff: Epic 2 - Tahsilatlar & Çek Yönetimi
**Tarih:** 2026-02-12 14:00
**Durum:** Tamamlandı

## Görev Tanımı
> Epic 2 (Tahsilatlar & Çek Yönetimi) story'lerini sırayla uygula: E2-S1, E2-S2, E2-S3, E2-S4, E2-S5, E2-S6, E2-S7

## Araştırma Bulguları

### Mevcut Durum
- **Backend API'leri %100 hazır** - Tüm endpoint'ler Epic 0'da oluşturulmuş
- **TypeScript tipleri hazır** - `finance-types.ts` tüm interface/Zod schema'ları içeriyor
- **Tahsilatlar sayfası placeholder** - Sadece boş bir div var
- **Pattern referansı** - Muhasebe Ücretleri sayfası aynı pattern kullanılacak

### Mevcut API Endpoint'leri (Hazır)
| Endpoint | Method | Dosya |
|----------|--------|-------|
| `/api/finance/transactions` | GET, POST | `src/app/api/finance/transactions/route.ts` |
| `/api/finance/transactions/[id]` | GET, PUT, DELETE | `src/app/api/finance/transactions/[id]/route.ts` |
| `/api/finance/transactions/pending/[customerId]` | GET | `src/app/api/finance/transactions/pending/[customerId]/route.ts` |
| `/api/finance/transactions/collect` | POST | `src/app/api/finance/transactions/collect/route.ts` |
| `/api/finance/checks` | GET, POST | `src/app/api/finance/checks/route.ts` |
| `/api/finance/checks/[id]` | GET, PUT, DELETE | `src/app/api/finance/checks/[id]/route.ts` |
| `/api/finance/checks/[id]/status` | PUT | `src/app/api/finance/checks/[id]/status/route.ts` |
| `/api/finance/settings` | GET, PUT | `src/app/api/finance/settings/route.ts` |

### Mevcut Types & Schemas (finance-types.ts'de)
- `FinancialTransaction`, `Check`, `PendingDebtWithBalance` interface'leri
- `CollectRequest`, `CollectionFormValues`, `CheckFormValues` tipleri
- `collectionFormSchema`, `checkFormSchema` Zod şemaları
- Tüm enum label haritaları (TRANSACTION_STATUS_LABELS, PAYMENT_METHOD_LABELS, CHECK_STATUS_LABELS vb.)

### Pattern Referansı
- **Hook pattern:** `use-cost-definitions.ts` → useState + useCallback + fetch pattern
- **Table pattern:** `cost-definition-table.tsx` → memo + useMemo filtreleme + Table components
- **Page pattern:** `muhasebe-ucretleri/page.tsx` → hooks + dialog states + handler functions
- **Import pattern:** Direct import (barrel YASAK)

## Etkilenecek Dosyalar

| # | Dosya | İşlem | Story |
|---|-------|-------|-------|
| 1 | `src/components/finansal-islemler/hooks/use-transactions.ts` | Yeni | E2-S1 |
| 2 | `src/components/finansal-islemler/hooks/use-checks.ts` | Yeni | E2-S5 |
| 3 | `src/components/finansal-islemler/tahsilatlar/summary-cards.tsx` | Yeni | E2-S1 |
| 4 | `src/components/finansal-islemler/tahsilatlar/collection-table.tsx` | Yeni | E2-S1 |
| 5 | `src/components/finansal-islemler/tahsilatlar/collection-form.tsx` | Yeni | E2-S2, S3, S4 |
| 6 | `src/components/finansal-islemler/tahsilatlar/pending-debts-selector.tsx` | Yeni | E2-S2, S3 |
| 7 | `src/components/finansal-islemler/tahsilatlar/check-form.tsx` | Yeni | E2-S4 |
| 8 | `src/components/finansal-islemler/tahsilatlar/check-portfolio-table.tsx` | Yeni | E2-S5 |
| 9 | `src/components/finansal-islemler/tahsilatlar/auto-charge-settings.tsx` | Yeni | E2-S6 |
| 10 | `src/app/(dashboard)/dashboard/finansal-islemler/tahsilatlar/page.tsx` | Düzenleme | E2-S7 |

## Uygulama Planı

---

### Adım 1: Hooks (E2-S1 + E2-S5 bağımlılığı)

#### 1a. `use-transactions.ts`
```typescript
// Pattern: use-cost-definitions.ts ile aynı
// Fonksiyonlar:
// - fetchTransactions(params?) → GET /api/finance/transactions
//   params: customerId, type, status, categoryId, startDate, endDate, page, limit
// - fetchPendingDebts(customerId) → GET /api/finance/transactions/pending/[customerId]
//   Dönen tip: PendingDebtWithBalance[]
// - collectPayment(data: CollectRequest) → POST /api/finance/transactions/collect
// - createTransaction(data) → POST /api/finance/transactions
// - summaryStats → {pendingTotal, thisMonthCollected, overdueTotal} hesaplaması
//   (client-side: transactions verisi üzerinden hesaplanır)
```

**Detaylı API Kullanımı:**
- GET transactions: `type=DEBIT&status=PENDING` ile bekleyen borçlar
- GET transactions: `type=CREDIT` ile tahsilatlar
- Pending API: `/api/finance/transactions/pending/${customerId}` → remaining hesaplanmış borçlar döner
- Collect API: `{customerId, transactionIds[], amount, paymentMethod, currency, exchangeRate?, checkData?, date, note?}`

#### 1b. `use-checks.ts`
```typescript
// Fonksiyonlar:
// - fetchChecks(params?) → GET /api/finance/checks?status=&customerId=
// - createCheck(data) → POST /api/finance/checks
// - updateCheckStatus(id, newStatus) → PUT /api/finance/checks/[id]/status
//   Body: { status: "COLLECTED" | "BOUNCED" | "RETURNED" }
//   State machine: IN_PORTFOLIO → COLLECTED | BOUNCED | RETURNED (tek yön)
```

---

### Adım 2: Özet Kartları (E2-S1)

#### `summary-cards.tsx`
```
3 kart yan yana (responsive grid):
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ ⏳ Bekleyen     │ │ 💰 Bu Ay       │ │ 🔴 Vadesi      │
│ Toplam          │ │ Tahsilat       │ │ Geçen          │
│ ₺125.000       │ │ ₺45.000        │ │ ₺30.000        │
└────────────────┘ └────────────────┘ └────────────────┘

Hesaplama:
- Bekleyen: type=DEBIT, status IN (PENDING, PARTIAL) → SUM(amount)
- Bu Ay: type=CREDIT, bu ayin tarih araligi → SUM(amount)
- Vadesi Geçen: type=DEBIT, status IN (PENDING, PARTIAL), dueDate < today → SUM(amount)

Props: transactions: FinancialTransaction[]
Renk: Bekleyen=blue, Tahsilat=green, Vadesi Geçen=red
```

**UI Component:** Card from `@/components/ui/card`, lucide icons (Clock, HandCoins, AlertTriangle)

---

### Adım 3: Tahsilat Tablosu (E2-S1)

#### `collection-table.tsx`
```
Tablo kolonları:
| Müşteri | Kalem | Tutar | Vade Tarihi | Durum | İşlemler |

Filtreler (üst kısım):
- Arama (müşteri adı)
- Tarih aralığı (başlangıç - bitiş)
- Ödeme yöntemi (Select: Tümü/Nakit/Havale/EFT/Çek/Kredi Kartı)
- Durum (Select: Tümü/Bekliyor/Kısmi/Tamamlandı/İptal)

Renk kodlaması:
- Kırmızı satır: dueDate < today && status IN (PENDING, PARTIAL)
- Sarı badge: PENDING
- Mavi badge: PARTIAL
- Yeşil badge: COMPLETED
- Gri badge: CANCELLED

Sıralama: dueDate ASC (yaklaşan üstte)

"Tahsilat Al" butonu → collection-form açar (seçili müşteri ile)
```

**Pattern:** `cost-definition-table.tsx` ile aynı memo + useMemo filtreleme pattern'i
**Props:** `transactions, loading, onCollect(customerId)`

---

### Adım 4: Tahsilat Kayıt Formu (E2-S2 + E2-S3 + E2-S4)

#### `collection-form.tsx` (Sheet/Dialog)
```
Adım 1: Müşteri Seçimi
  → Select dropdown: müşteri listesi
  → Seçilince → fetchPendingDebts(customerId) çağrılır

Adım 2: Borç Seçimi
  → PendingDebtsSelector component embed (aşağıda)
  → Checkbox ile çoklu borç seçimi
  → Seçili toplam otomatik hesaplanır

Adım 3: Ödeme Bilgileri
  → Tahsil edilen tutar (number input)
    - Varsayılan: seçili borçların toplamı
    - Farklı tutar girilirse kısmi tahsilat uyarısı gösterilir
  → Ödeme yöntemi (Select: Nakit/Havale/EFT/Çek/Kredi Kartı)
    - "Çek" seçildiğinde → CheckForm embed (aşağıda)
  → Para birimi (Select: TRY/USD/EUR)
    - TRY dışında → exchangeRate input görünür
  → Tarih (DatePicker)
  → Not (textarea, opsiyonel)

Adım 4: Onay
  → Özet göster: Müşteri, seçili borç sayısı, toplam, ödeme yöntemi
  → "Tahsil Et" butonu → collectPayment() çağrılır
  → Başarı → toast + tablo yenile + formu kapat
```

**Zod Schema:** `collectionFormSchema` (finance-types.ts'de zaten var)
**Form Library:** React Hook Form + zodResolver

#### `pending-debts-selector.tsx` (E2-S2, E2-S3)
```
Props: customerId, onSelectionChange(ids[], totalAmount)

API: GET /api/finance/transactions/pending/{customerId}
Dönen data: PendingDebtWithBalance[] (remaining hesaplanmış)

UI:
┌──────────────────────────────────────────────────────────┐
│ ☐ | Kategori      | Açıklama     | Tutar    | Kalan    │
│ ✅ | Muhasebe Ücr. | Ocak 2026    | ₺5.000   | ₺5.000  │
│ ☐  | Beyanname     | Ocak 2026    | ₺2.000   | ₺1.500  │
│ ✅ | Defter Sak.   | 2025 Yıllık  | ₺3.000   | ₺3.000  │
├──────────────────────────────────────────────────────────┤
│ Seçili Toplam: ₺8.000                      [Tümünü Seç]│
└──────────────────────────────────────────────────────────┘

Kısmi tahsilat göstergesi (E2-S3):
- remaining < amount ise → "Kısmi ödenmiş" badge
- İkinci ödeme yapılırken → kalan tutar ön doldurulur
```

#### `check-form.tsx` (E2-S4)
```
Sadece paymentMethod === "CHECK" seçildiğinde gösterilir
collection-form içine embed

Alanlar:
- Çek No (string, opsiyonel)
- Banka (string, opsiyonel)
- Vade Tarihi (DatePicker, zorunlu)
- Tutar (number, zorunlu - varsayılan: tahsilat tutarı)

Zod: checkFormSchema (finance-types.ts'de var)
```

---

### Adım 5: Çek Portföy Yönetimi (E2-S5)

#### `check-portfolio-table.tsx`
```
Tablo kolonları:
| Çek No | Banka | Müşteri | Tutar | Vade Tarihi | Durum | İşlemler |

Durum badge renkleri:
- IN_PORTFOLIO (mavi): "Portföyde"
- COLLECTED (yeşil): "Tahsil Edildi"
- BOUNCED (kırmızı): "Karşılıksız"
- RETURNED (turuncu): "İade Edildi"

Filtreler:
- Durum (Select: Tümü/Portföyde/Tahsil Edildi/Karşılıksız/İade)
- Müşteri (arama)
- Vade aralığı (tarih range)

İşlemler (sadece IN_PORTFOLIO durumunda):
- "Tahsil Edildi" butonu → PUT /checks/[id]/status {status: "COLLECTED"}
- "Karşılıksız" butonu → PUT /checks/[id]/status {status: "BOUNCED"}
- "İade" butonu → PUT /checks/[id]/status {status: "RETURNED"}
→ Her durum değişikliğinde onay dialog'u göster

Vadesi yaklaşan vurgulama:
- dueDate <= today+7 gün && status=IN_PORTFOLIO → sarı arka plan
- dueDate < today && status=IN_PORTFOLIO → kırmızı arka plan

State Machine (API'de var, frontend validation da yap):
IN_PORTFOLIO → [COLLECTED, BOUNCED, RETURNED]
COLLECTED → [] (final)
BOUNCED → [] (final)
RETURNED → [] (final)
```

---

### Adım 6: Otomatik Borçlandırma Ayarları (E2-S6)

#### `auto-charge-settings.tsx`
```
Collapsible panel (DefaultSettingsPanel ile aynı pattern)

İçerik:
- Otomatik borçlandırma toggle (aktif/pasif)
- Borçlandırma günü seçimi (Select: 1-28)
- Açıklama metni: "Her ayın X. gününde aktif maliyet kalemleri
  otomatik olarak borçlandırılır"

API:
- GET /api/finance/settings → autoChargeEnabled, autoChargeDay
- PUT /api/finance/settings → güncelle

localStorage: panel açık/kapalı durumu
```

**NOT:** pg_cron fonksiyonu bu story'de Supabase migration olarak deploy edilecek. Ancak bu konuda kullanıcıya bilgi verilecek, doğrudan Supabase'e migration göndermeyeceğiz - SQL hazırlanıp handoff'ta paylaşılacak.

---

### Adım 7: Tahsilatlar Sayfası Tam Entegrasyon (E2-S7)

#### `tahsilatlar/page.tsx`
```
Layout:
┌──────────────────────────────────────────────────────────┐
│ 🤑 Tahsilatlar                           [Kategoriler]  │
│ Müşterilerden tahsilat kaydı ve çek portföy yönetimi    │
├──────────────────────────────────────────────────────────┤
│ [AutoChargeSettings - collapsible panel]                │
├──────────────────────────────────────────────────────────┤
│ [SummaryCards - 3 özet kartı]                           │
├──────────────────────────────────────────────────────────┤
│ Tabs: [Tahsilatlar] [Çek Portföyü]                     │
├──────────────────────────────────────────────────────────┤
│ Tab 1: CollectionTable                                  │
│   + Filtreler + Tablo + "Tahsilat Al" butonu            │
│ Tab 2: CheckPortfolioTable                              │
│   + Filtreler + Tablo + Durum değiştirme                │
├──────────────────────────────────────────────────────────┤
│ [CollectionForm - Sheet/Dialog (gizli, butonla açılır)] │
└──────────────────────────────────────────────────────────┘

State Yönetimi:
- useTransactions() → transactions, pendingDebts, collectPayment, summary
- useChecks() → checks, updateCheckStatus
- useFinanceSettings() → settings (auto-charge)
- useCategories() → categories (filtre için)
- useState: customers, showCollectionForm, activeTab, selectedCustomerId

Tab'lar: Tabs component (Radix UI)
Loading: Skeleton component
Error: toast.error
Empty: "Henüz tahsilat kaydı bulunmuyor" mesajı

Responsive: grid-cols-1 md:grid-cols-3 (kartlar), full-width tablo
```

## Teknik Notlar

### Dikkat Edilecek Edge Case'ler
1. **Kısmi tahsilat:** remaining hesabı API'den geliyor (child_transactions SUM)
2. **Çek → BOUNCED:** İlgili CREDIT transaction CANCELLED olur, DEBIT tekrar PENDING'e döner (API'de handle ediliyor)
3. **Boş müşteri listesi:** `fetchCustomers` → `/api/customers?status=active`
4. **Para formatı:** `Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })`
5. **Tarih formatı:** `new Date(date).toLocaleDateString('tr-TR')`

### Bağımlılıklar
- Tüm UI component'leri: `@/components/ui/*` (Button, Table, Card, Badge, Select, Input, Sheet, Dialog, Tabs, Skeleton, Checkbox)
- Lucide icons: HandCoins, Clock, AlertTriangle, Search, Filter, Plus, Check, X, CreditCard, Banknote
- React Hook Form + Zod resolver (mevcut projede var)
- `@/components/ui/sonner` (toast)

### Performans
- `React.memo` → tüm tablo component'leri
- `useMemo` → filtreleme hesaplamaları
- `useCallback` → event handler'lar
- Pagination → API zaten skip/take destekliyor

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Tabs ile çek portföyü aynı sayfada | Story E2-S7: "Çek portföyü tab veya alt bölüm olarak erişilebilir" | Ayrı sayfa → Navigation karmaşıklığı |
| Sheet (yan panel) ile tahsilat formu | Muhasebe ücretleri pattern'i ile tutarlı | Dialog → küçük ekranda sıkışır |
| Client-side özet hesaplama | İlk versiyon basitliği, API ek endpoint gerektirmez | Ayrı stats API → Epic 4'te yapılacak |
| pg_cron SQL'i hazırla ama deploy etme | Supabase migration doğrudan gönderilemez, kullanıcı onayı gerekir | Doğrudan deploy → riskli |

## Dosya Oluşturma Sırası

```
1. use-transactions.ts     (hook - tüm componentler buna bağlı)
2. use-checks.ts           (hook - çek tablosu buna bağlı)
3. summary-cards.tsx        (E2-S1 - bağımsız component)
4. pending-debts-selector.tsx (E2-S2/S3 - form'un parçası)
5. check-form.tsx           (E2-S4 - form'un parçası)
6. collection-form.tsx      (E2-S2/S3/S4 - selector ve check-form embed eder)
7. collection-table.tsx     (E2-S1 - tablo, collect butonu form'u açar)
8. check-portfolio-table.tsx (E2-S5 - bağımsız tablo)
9. auto-charge-settings.tsx  (E2-S6 - bağımsız panel)
10. tahsilatlar/page.tsx    (E2-S7 - tüm componentleri entegre eder)
```
