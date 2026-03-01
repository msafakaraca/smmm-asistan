# Handoff: Epic 4 - İstatistikler & Hesap Dökümü
**Tarih:** 2026-02-13
**Durum:** Parça 1 Tamamlandı (İstatistikler Sayfası)

## Görev Tanımı
> Epic 4: İstatistikler & Hesap Dökümü modülünü uygula. 7 story: İstatistik Summary Kartları (E4-S1), Gelir Dağılımı Pasta Grafik (E4-S2), Aylık Gelir-Gider Çubuk Grafik (E4-S3), Tahsilat Performansı (E4-S4), İstatistikler Sayfası Tam Entegrasyon (E4-S5), Hesap Dökümü Tablosu (E4-S6), Excel/PDF Export (E4-S7).

## Araştırma Bulguları

### Mevcut Altyapı
- **İstatistikler sayfası** → Placeholder (`src/app/(dashboard)/dashboard/finansal-islemler/istatistikler/page.tsx`)
- **Hesap Dökümü sayfası** → Placeholder (`src/app/(dashboard)/dashboard/finansal-islemler/hesap-dokumu/page.tsx`)
- **Recharts 3.7.0** → Projede mevcut, `PieChart`, `ResponsiveContainer`, `Tooltip`, `Cell` kullanılıyor
  - Referans: `src/components/dashboard/charts/customer-bar-chart.tsx` (donut chart pattern)
- **xlsx 0.18.5 + exceljs 4.4.0** → Projede mevcut, export için kullanılıyor
  - Referans: `src/app/api/takip/export/route.ts` (xlsx export pattern)
- **API'ler hazır:**
  - `GET /api/finance/transactions` → customerId, type, status, categoryId, startDate, endDate filtreleri
  - `GET /api/finance/expenses` → categoryId, isRecurring, startDate, endDate filtreleri
- **Hook'lar hazır:**
  - `useTransactions(params)` → transactions[], summaryStats (pendingTotal, thisMonthCollected, overdueTotal)
  - `useExpenses(params)` → expenses[], summaryStats (totalAmount, recurringTotal, thisMonthTotal)
  - `useCategories()` → categories[]
- **TypeScript tipleri hazır:** FinancialTransaction, Expense, FinanceCategory, tüm enum'lar ve label map'leri
- **SummaryCards pattern** → `src/components/finansal-islemler/tahsilatlar/summary-cards.tsx` (3 kart, memo, formatCurrency)

### İstatistikler İçin Gerekli Veriler
1. **Toplam Alacak:** DEBIT transactions, status PENDING veya PARTIAL → `netAmount` toplamı
2. **Bu Ay Tahsilat:** CREDIT transactions, bu aydaki → `netAmount` toplamı
3. **Toplam Gider:** expenses, seçili dönemdeki → `amount` toplamı
4. **Net Kâr:** Bu ay tahsilat - Bu ay gider
5. **Kategori dağılımı:** transactions groupBy categoryId → tutar toplamı (pasta grafik)
6. **Aylık trend:** transactions + expenses, son 12 ay → aylık tutar toplamları (çubuk grafik)
7. **Tahsilat oranı:** COMPLETED DEBIT / Tüm DEBIT * 100

### Hesap Dökümü İçin Gerekli Veriler
- Müşteri bazlı tüm transactions (DEBIT + CREDIT)
- Tarih sıralı, running balance hesaplaması
- Filtreler: müşteri, tarih aralığı, kategori, işlem türü

### Stats API Gereksinimi
Tahsilatlar sayfasında `limit: 500` ile tüm kayıtlar çekilip client-side hesaplanıyor (kodda not var: "Epic 4'te ayrı stats API'si ile değiştirilecek"). İstatistikler sayfası için **ayrı aggregate API** oluşturmak daha performanslı.

**Yeni API:** `GET /api/finance/stats`
- Dönem parametreleri: year, month (veya startDate, endDate)
- Server-side aggregate sorgular (Prisma aggregate)
- Response: summaryCards, categoryBreakdown, monthlyTrend, collectionRate

### Hesap Dökümü API Gereksinimi
Mevcut transactions API yeterli ama **running balance** hesaplaması gerekli.
- Seçenek 1: Client-side hesapla (basit, veri az)
- Seçenek 2: API'de window function ile hesapla (performanslı)
- **Karar:** Client-side (başlangıç için yeterli, veri az)

## Scope Kararı (KRİTİK)

Epic 4 7 story içeriyor, fazla büyük olduğu için **2 parçaya bölüyoruz:**

### Parça 1: İstatistikler Sayfası (E4-S1 → E4-S5)
- Stats API + Summary kartları + Grafikler + Tam entegrasyon
- **Bu handoff bu parçayı kapsar**

### Parça 2: Hesap Dökümü + Export (E4-S6 → E4-S7)
- Ayrı handoff olarak oluşturulacak

## Etkilenecek Dosyalar (Parça 1)

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `src/app/api/finance/stats/route.ts` | Yeni dosya | İstatistik aggregate API |
| `src/components/finansal-islemler/hooks/use-stats.ts` | Yeni dosya | Stats hook |
| `src/components/finansal-islemler/istatistikler/stats-summary-cards.tsx` | Yeni dosya | 4 özet kart |
| `src/components/finansal-islemler/istatistikler/income-pie-chart.tsx` | Yeni dosya | Gelir dağılımı pasta grafik |
| `src/components/finansal-islemler/istatistikler/monthly-bar-chart.tsx` | Yeni dosya | Aylık gelir-gider çubuk grafik |
| `src/components/finansal-islemler/istatistikler/collection-performance.tsx` | Yeni dosya | Tahsilat performansı |
| `src/app/(dashboard)/dashboard/finansal-islemler/istatistikler/page.tsx` | Düzenleme | Placeholder → Tam sayfa |

**Toplam:** 6 yeni dosya + 1 düzenleme = 7 dosya

## Uygulama Planı

### Adım 1: Stats API oluştur (`/api/finance/stats`)
- [ ] `src/app/api/finance/stats/route.ts` oluştur
- [ ] Auth guard + tenantId filtresi
- [ ] Query params: `year`, `month` (varsayılan: mevcut ay)
- [ ] 4 aggregate sorgu (Promise.all ile paralel):

```typescript
// 1. Summary kartları
const [pendingDebit, thisMonthCredit, thisMonthExpenses, totalDebit, completedDebit] = await Promise.all([
  // Bekleyen alacak: DEBIT + (PENDING|PARTIAL) toplam netAmount
  prisma.financial_transactions.aggregate({
    where: { tenantId, type: "DEBIT", status: { in: ["PENDING", "PARTIAL"] } },
    _sum: { netAmount: true },
  }),
  // Bu ay tahsilat: CREDIT + tarih aralığında
  prisma.financial_transactions.aggregate({
    where: { tenantId, type: "CREDIT", date: { gte: startOfMonth, lte: endOfMonth } },
    _sum: { netAmount: true },
  }),
  // Bu ay gider
  prisma.expenses.aggregate({
    where: { tenantId, date: { gte: startOfMonth, lte: endOfMonth } },
    _sum: { amount: true },
  }),
  // Toplam borçlandırma (tüm DEBIT)
  prisma.financial_transactions.aggregate({
    where: { tenantId, type: "DEBIT", date: { gte: startOfMonth, lte: endOfMonth } },
    _sum: { netAmount: true },
  }),
  // Tamamlanan (COMPLETED DEBIT)
  prisma.financial_transactions.aggregate({
    where: { tenantId, type: "DEBIT", status: "COMPLETED", date: { gte: startOfMonth, lte: endOfMonth } },
    _sum: { netAmount: true },
  }),
]);
```

- [ ] Kategori dağılımı (pasta grafik için):
```typescript
// DEBIT transactions, groupBy categoryId
const categoryBreakdown = await prisma.financial_transactions.groupBy({
  by: ["categoryId"],
  where: { tenantId, type: "DEBIT", date: { gte: startOfMonth, lte: endOfMonth } },
  _sum: { netAmount: true },
});
// Kategori bilgilerini enrich et
```

- [ ] Aylık trend (çubuk grafik için):
```typescript
// Son 12 ay transactions (CREDIT) + expenses, ay bazında group
// Raw SQL veya Prisma groupBy ile
// Response: [{ month: "2026-01", income: 15000, expense: 8000 }, ...]
```

- [ ] En borçlu müşteriler (tahsilat performansı):
```typescript
// DEBIT + (PENDING|PARTIAL), groupBy customerId, order by sum desc, take 10
const topDebtors = await prisma.financial_transactions.groupBy({
  by: ["customerId"],
  where: { tenantId, type: "DEBIT", status: { in: ["PENDING", "PARTIAL"] } },
  _sum: { netAmount: true },
  orderBy: { _sum: { netAmount: "desc" } },
  take: 10,
});
```

- [ ] Response format:
```typescript
{
  summary: {
    pendingTotal: number,
    thisMonthCollected: number,
    thisMonthExpenses: number,
    netProfit: number,         // collected - expenses
    collectionRate: number,    // 0-100 yüzde
  },
  categoryBreakdown: [
    { categoryId: string, categoryName: string, color: string, total: number }
  ],
  monthlyTrend: [
    { month: string, income: number, expense: number }  // son 12 ay
  ],
  topDebtors: [
    { customerId: string, customerName: string, total: number }
  ]
}
```

### Adım 2: use-stats.ts Hook
- [ ] State: stats, loading
- [ ] Params: year?, month?
- [ ] `fetchStats(year, month)` → GET /api/finance/stats?year=X&month=Y
- [ ] Auto-fetch on mount + param change

### Adım 3: stats-summary-cards.tsx (E4-S1)
- [ ] 4 kart: Toplam Alacak, Bu Ay Tahsilat, Toplam Gider, Net Kâr
- [ ] Renk kodlaması: mavi (alacak), yeşil (tahsilat), kırmızı (gider), mor/yeşil (net kâr - pozitif yeşil, negatif kırmızı)
- [ ] `formatCurrency()` ile Türk Lirası formatlama
- [ ] Icon'lar: Clock, HandCoins, Receipt, TrendingUp
- [ ] `React.memo` ile memoize
- [ ] Pattern: `tahsilatlar/summary-cards.tsx` takip et (4 kart versiyonu)

### Adım 4: income-pie-chart.tsx (E4-S2)
- [ ] Recharts PieChart (donut) kullan
- [ ] Data: categoryBreakdown dizisi
- [ ] Her dilim kategorinin rengiyle (FinanceCategory.color)
- [ ] Hover tooltip: kategori adı + tutar + yüzde
- [ ] Ortadaki toplam rakam
- [ ] Alt legend: kategori listesi + renk + tutar
- [ ] Boş state: veri yoksa mesaj göster
- [ ] Pattern: `dashboard/charts/customer-bar-chart.tsx` donut pattern'i takip et

### Adım 5: monthly-bar-chart.tsx (E4-S3)
- [ ] Recharts BarChart kullan
- [ ] Data: monthlyTrend dizisi (son 12 ay)
- [ ] 2 bar: yeşil (gelir/tahsilat), kırmızı (gider)
- [ ] X ekseni: ay isimleri (Oca, Şub, Mar, ...)
- [ ] Y ekseni: tutar
- [ ] Hover tooltip: ay detayı (gelir + gider + fark)
- [ ] Legend: Gelir / Gider
- [ ] ResponsiveContainer ile sarmalama

### Adım 6: collection-performance.tsx (E4-S4)
- [ ] Progress bar: tahsilat oranı (collectionRate)
- [ ] Renk: yeşil >80%, sarı >60%, kırmızı <60%
- [ ] En borçlu müşteriler listesi (topDebtors, top 10)
- [ ] Her satır: müşteri adı, borç tutarı
- [ ] Sıralama: borç tutarına göre azalan
- [ ] Boş state: borç yok mesajı

### Adım 7: İstatistikler Sayfası Entegrasyonu (E4-S5)
- [ ] `istatistikler/page.tsx` placeholder'ı güncelle
- [ ] Dönem filtresi: ay/yıl seçimi (Select + year picker)
- [ ] Layout:
  - Üst: 4 summary kart (grid 4 kolon)
  - Orta sol: Gelir dağılımı pasta grafik
  - Orta sağ: Aylık trend çubuk grafik
  - Alt: Tahsilat performansı
- [ ] Loading state: Skeleton'lar
- [ ] useStats hook entegrasyonu
- [ ] Responsive: mobilde tek kolon

## Teknik Notlar

### Recharts Import Pattern (Projede Mevcut)
```typescript
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend,
} from "recharts";
```

### Türk Lirası Formatlama (Projede Mevcut)
```typescript
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}
```

### Ay İsimleri (Türkçe)
```typescript
const MONTH_NAMES = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
```

### Aylık Trend SQL Stratejisi
Prisma `groupBy` raw tarih gruplama desteklemiyor. İki seçenek:
1. **Client-side:** Tüm transactions + expenses çek, JS'de ay bazında grupla
2. **Raw SQL:** `$queryRaw` ile `DATE_TRUNC('month', date)` kullan

**Karar:** Hybrid yaklaşım - Son 12 ayın start/end tarihlerini hesapla, her ay için ayrı aggregate çalıştır (12 * 2 = 24 sorgu ama basit). Ya da raw SQL ile tek sorguda çöz.

**Tercih:** Raw SQL (`$queryRaw`) - tek sorguda 12 aylık veri:
```sql
SELECT
  TO_CHAR(date, 'YYYY-MM') as month,
  SUM(CASE WHEN type = 'CREDIT' THEN "netAmount" ELSE 0 END) as income,
  0 as expense
FROM financial_transactions
WHERE "tenantId" = $1 AND date >= $2
GROUP BY TO_CHAR(date, 'YYYY-MM')

UNION ALL

SELECT
  TO_CHAR(date, 'YYYY-MM') as month,
  0 as income,
  SUM(amount) as expense
FROM expenses
WHERE "tenantId" = $1 AND date >= $2
GROUP BY TO_CHAR(date, 'YYYY-MM')
```
Sonra JS'de birleştir.

### Dönem Filtresi
- Varsayılan: Mevcut ay (beyanname kuralı geçerli DEĞİL - istatistikler mevcut ayı gösterir)
- Ay seçimi: Select dropdown (Ocak-Aralık)
- Yıl seçimi: Number input veya Select (2024-2026)
- Değiştiğinde useStats refetch

### Edge Case'ler
- Veri olmayan aylar: grafiklerde 0 göster
- Tek kategori: pasta grafikte tek dilim (sorun değil)
- Hiç transaction yok: boş state göster
- Negatif net kâr: kırmızı renk
- Çok uzun müşteri adları: truncate

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Ayrı stats API | Client-side aggregate yerine server-side performans | Mevcut hook'lar (düşük performans) |
| Recharts | Projede zaten mevcut, pattern var | Chart.js (ek dependency) |
| Raw SQL trend sorgusu | Prisma groupBy tarih gruplama desteklemiyor | 24 ayrı sorgu (yavaş) |
| 2 parça bölme | 7 story tek handoff'ta çok büyük | Hepsini tek seferde (context overflow) |
| Client-side running balance | Veri az, basit hesaplama | Server window function (overengineering) |
| Dönemde beyanname kuralı yok | İstatistikler mevcut ayı göstermeli | Önceki ay (iş kuralı burada geçerli değil) |
