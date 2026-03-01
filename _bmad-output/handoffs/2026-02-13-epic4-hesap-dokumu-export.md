# Handoff: Epic 4 Parça 2 - Hesap Dökümü & Export (E4-S6, E4-S7)
**Tarih:** 2026-02-13
**Durum:** ✅ Tamamlandı

## Görev Tanımı
> Epic 4 Parça 2: Hesap Dökümü Tablosu (E4-S6) ve Excel/PDF Export (E4-S7). Müşteri bazlı detaylı hesap dökümü, running balance hesaplama, filtreler ve Excel export.

## Araştırma Bulguları

### Mevcut Altyapı
- **Hesap dökümü sayfası** → Placeholder (`src/app/(dashboard)/dashboard/finansal-islemler/hesap-dokumu/page.tsx`)
- **Transactions API hazır:** `GET /api/finance/transactions` (customerId, type, status, categoryId, startDate, endDate, page, limit)
  - Include: customers (id, unvan, kisaltma), category (id, name, color, icon), check
  - Pagination: page, limit, total, totalPages
  - Sıralama: date desc
- **Müşteri seçici pattern:** `src/components/reminders/taxpayer-select.tsx` (Dialog-based, arama, firma tipi filtre, single/multi)
- **Tablo pattern:** `src/components/finansal-islemler/tahsilatlar/collection-table.tsx` (Radix Table, filtreler, durum badge, memo)
- **Excel export pattern:** `src/app/api/takip/export/route.ts` + `src/app/api/bulk-send/export-excel/route.ts` (ExcelJS, header styling, row coloring, buffer response)
- **PDF export:** Projede yok (jsPDF/html2canvas mevcut değil) → Sadece Excel export yapılacak
- **TypeScript tipleri:** FinancialTransaction, TransactionType, TransactionStatus, TRANSACTION_TYPE_LABELS, TRANSACTION_STATUS_LABELS, PAYMENT_METHOD_LABELS
- **Recharts:** Projede mevcut (Parça 1'de kullanıldı)

### Hesap Dökümü Mantığı
1. Müşteri seçilir (zorunlu veya opsiyonel)
2. Tarih aralığı seçilir
3. Tüm transactions (DEBIT + CREDIT) tarih sırasıyla getirilir
4. **Running Balance:** İlk satırdan itibaren:
   - DEBIT → bakiye artar (müşterinin borcu)
   - CREDIT → bakiye azalır (müşterinin ödediği)
5. Tablo: Tarih | Tür | Kategori | Açıklama | Borç | Alacak | Bakiye
6. Excel export: aynı kolonlar + header + müşteri bilgisi

### Transactions API Kapasitesi
- Mevcut API pagination destekliyor (page/limit)
- Hesap dökümü için `limit: 500` veya tüm kayıtlar çekilebilir (running balance doğru olması için tüm dönem gerekli)
- Sıralama: API `date: desc` döndürüyor → Client'ta `date: asc`'ye çevrilmeli

### Müşteri Select Seçenekleri
- **Seçenek 1:** `taxpayer-select.tsx` component'ini direkt kullan (Dialog-based, tam özellikli) → 486 satır, büyük ama çok güzel
- **Seçenek 2:** Basit Select dropdown → Müşteri sayısı fazla olunca arama yok
- **Karar:** Basit bir Combobox (Radix Select + filtreleme) → Sayfa içinde daha pratik. Müşteri listesini `/api/customers?limit=500&fields=id,unvan,kisaltma` ile çek.

### Export Stratejisi
- **Excel:** ExcelJS ile server-side API route (mevcut pattern ile uyumlu)
- **PDF:** Proje'de jsPDF/html2canvas yok. Eklemek yerine sadece Excel export yapalım. İleride PDF gerekirse ayrı story.
- **Client-side tetikleme:** Tablo toolbar'ında "Excel İndir" butonu → API'ye fetch → blob download

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `src/components/finansal-islemler/hooks/use-account-statement.ts` | Yeni dosya | Hesap dökümü hook (transactions fetch + running balance) |
| `src/components/finansal-islemler/hesap-dokumu/account-statement-table.tsx` | Yeni dosya | Tablo + filtreler (müşteri, tarih, tür, kategori) |
| `src/app/api/finance/account-statement/export/route.ts` | Yeni dosya | Excel export API |
| `src/app/(dashboard)/dashboard/finansal-islemler/hesap-dokumu/page.tsx` | Düzenleme | Placeholder → Tam sayfa |

**Toplam:** 3 yeni dosya + 1 düzenleme = 4 dosya

## Uygulama Planı

### Adım 1: use-account-statement.ts Hook
- [ ] State: transactions[], loading, total
- [ ] Params: customerId?, startDate?, endDate?, type?, categoryId?
- [ ] `fetchStatement(params)` → GET /api/finance/transactions (limit: 500, date asc gerekli)
- [ ] **Running balance hesaplama** (client-side useMemo):
```typescript
const statementRows = useMemo(() => {
  // Tarihe göre sırala (asc)
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  let balance = 0;
  return sorted.map((t) => {
    const amount = Number(t.netAmount);
    if (t.type === "DEBIT") {
      balance += amount; // Borç artar
    } else {
      balance -= amount; // Ödeme azaltır
    }
    return {
      ...t,
      debitAmount: t.type === "DEBIT" ? amount : 0,
      creditAmount: t.type === "CREDIT" ? amount : 0,
      balance,
    };
  });
}, [transactions]);
```
- [ ] `totals` hesaplama: toplam borç, toplam alacak, son bakiye
- [ ] Export için `getExportData()` fonksiyonu (raw data döndürür)

### Adım 2: account-statement-table.tsx (E4-S6)
- [ ] **Filtreler (üst bar):**
  - Müşteri select (Select dropdown + arama): `/api/customers?limit=500` ile müşteri listesi çek
  - Tarih aralığı: 2x date input (startDate, endDate)
  - İşlem türü: Select (Tümü, Borç, Alacak)
  - Kategori: Select (useCategories hook ile)
- [ ] **Tablo kolonları:**
  | Kolon | Genişlik | Açıklama |
  |-------|----------|----------|
  | Tarih | 100px | formatDate(t.date) |
  | Müşteri | flex | kisaltma veya unvan (müşteri seçili değilse göster) |
  | Kategori | 120px | category.name + color dot |
  | Açıklama | flex | description (truncate) |
  | Borç | 120px | DEBIT tutarı (kırmızı) |
  | Alacak | 120px | CREDIT tutarı (yeşil) |
  | Bakiye | 120px | Running balance (pozitif kırmızı, negatif/0 yeşil) |
- [ ] **Alt özet satırı:**
  - Toplam Borç | Toplam Alacak | Son Bakiye
- [ ] **Boş state:** "Hesap dökümü görüntülemek için müşteri veya dönem seçin"
- [ ] **Loading state:** Loader2 spinner
- [ ] **Toolbar sağ taraf:** "Excel İndir" butonu (Download icon)
- [ ] `React.memo` ile memoize
- [ ] Pattern: `collection-table.tsx` takip et (Radix Table + filtre state)

### Adım 3: Excel Export API (E4-S7)
- [ ] `src/app/api/finance/account-statement/export/route.ts`
- [ ] Auth guard + tenantId
- [ ] Query params: customerId, startDate, endDate, type, categoryId
- [ ] Transactions çek (aynı filtreler, limit: 5000, date asc)
- [ ] Running balance hesapla (server-side)
- [ ] ExcelJS workbook oluştur:
  - **Başlık satırı (merge):** "Hesap Dökümü" + müşteri adı + dönem
  - **Kolon headers:** Tarih | Müşteri | Kategori | Açıklama | Borç | Alacak | Bakiye
  - **Veri satırları:** Her transaction
  - **Alt toplam satırı:** Toplam Borç | Toplam Alacak | Son Bakiye (bold, bordered)
  - **Header stil:** Mavi arka plan, beyaz yazı (mevcut pattern)
  - **Borç hücreleri:** Kırmızı font
  - **Alacak hücreleri:** Yeşil font
  - **Bakiye hücreleri:** Pozitif kırmızı, sıfır/negatif yeşil
  - **Tutar kolonları:** Number format ("₺#,##0.00")
- [ ] Response: Excel buffer + Content-Disposition
- [ ] Dosya adı: `hesap_dokumu_<müşteri>_<tarih>.xlsx`

### Adım 4: Hesap Dökümü Sayfası Entegrasyonu
- [ ] `hesap-dokumu/page.tsx` placeholder güncelle
- [ ] Header: FileSpreadsheet icon + başlık + alt açıklama
- [ ] Tam alan: AccountStatementTable component'i
- [ ] useAccountStatement hook entegrasyonu
- [ ] Responsive: Mobilde yatay scroll

## Teknik Notlar

### Müşteri Listesi Fetch (Basit Pattern)
```typescript
// Filtre component'inde müşteri listesini çek
const [customers, setCustomers] = useState<{id: string; unvan: string; kisaltma: string | null}[]>([]);
useEffect(() => {
  fetch("/api/customers?limit=500")
    .then(res => res.json())
    .then(data => setCustomers(Array.isArray(data) ? data : data.data || []));
}, []);
```

### Customers API Check
Mevcut `/api/customers` API'si tüm müşterileri döndürüyor. `limit` parametresi var. Response: direkt array veya paginated.

### formatDate Pattern (Projede Mevcut)
```typescript
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("tr-TR");
}
```

### formatCurrency Pattern (Projede Mevcut)
```typescript
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}
```

### Export Download Client-Side Pattern
```typescript
async function handleExport() {
  const params = new URLSearchParams();
  if (customerId) params.set("customerId", customerId);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);

  const res = await fetch(`/api/finance/account-statement/export?${params}`);
  if (!res.ok) { toast.error("Export başarısız"); return; }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hesap_dokumu.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
```

### ExcelJS Number Format (Tutar Kolonları)
```typescript
// Tutar kolonlarına number format uygula
worksheet.getColumn("debit").numFmt = '₺#,##0.00';
worksheet.getColumn("credit").numFmt = '₺#,##0.00';
worksheet.getColumn("balance").numFmt = '₺#,##0.00';
```

### Edge Case'ler
- Müşteri seçilmeden tüm müşteriler gösterilir (müşteri kolonu görünür)
- Müşteri seçildiğinde müşteri kolonu gizlenebilir (opsiyonel)
- Tarih aralığı yoksa son 3 ay varsayılan
- Çok fazla transaction (5000+) → Sayfalama veya uyarı
- Running balance başlangıç tutarı = 0 (seçili dönem öncesi hesaplanmaz → basit yaklaşım)
- Boş açıklama: "—" göster
- Export sırasında loading state (buton disabled + spinner)

### Transactions API Date Sıralama Notu
Mevcut API `orderBy: { date: "desc" }` döndürüyor. Running balance için `date: asc` gerekli.
- **Client-side:** API'den gelen veriyi `sort()` ile ters çevir
- **API param:** Opsiyonel `sort=asc` parametresi eklenebilir ama mevcut API'yi değiştirmemek daha iyi
- **Karar:** Client-side sort (basit, API değişikliği gerektirmez)

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Client-side running balance | Veri az, basit hesaplama, tek fetch | Server-side window function (overengineering) |
| Basit Select (müşteri) | Sayfa içinde pratik, arama destekli | taxpayer-select Dialog (çok büyük) |
| Sadece Excel export | PDF için jsPDF/html2canvas projede yok | PDF ekleme (yeni dependency, ayrı story) |
| ExcelJS (server-side) | Mevcut pattern, proven, header/stil desteği | Client-side xlsx (daha az özellik) |
| Mevcut transactions API | Yeterli filtreler var, yeni API gereksiz | Ayrı account-statement API (duplicate) |
| limit: 500 ilk fetch | Çoğu müşteri için yeterli | Tüm kayıtlar (performans riski) |
| Client-side date sort | API değişikliği gerektirmez | API'ye sort param ekle |
| Dönem öncesi bakiye = 0 | Basit başlangıç, ileride geliştirilebilir | Önceki dönem aggregate (karmaşık) |
