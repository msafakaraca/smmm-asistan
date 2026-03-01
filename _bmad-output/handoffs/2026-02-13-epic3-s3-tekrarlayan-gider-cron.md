# Handoff: E3-S3 Tekrarlayan Gider Backend Otomasyonu
**Tarih:** 2026-02-13
**Durum:** Tamamlandı

## Görev Tanımı
> Tekrarlayan giderlerin (isRecurring=true) otomatik olarak yeni dönem kayıtları oluşturmasını sağlayan cron job backend mekanizması. UI kısmı (toggle + periyot seçimi) zaten expense-form.tsx'te mevcut.

## Araştırma Bulguları

### Mevcut Altyapı
- **Vercel Cron** zaten kullanılıyor: `vercel.json` → `/api/cron/announcements` (her 15dk)
- **Cron pattern**: `src/app/api/cron/announcements/route.ts` referans olarak mevcut
- **Auth**: `CRON_SECRET` env variable + `Authorization: Bearer` header kontrolü
- **Prisma modeli**: `expenses` tablosunda `isRecurring` (Boolean) ve `recurringFrequency` (enum) alanları var
- **Enum**: `REC_MONTHLY`, `REC_QUARTERLY`, `REC_ANNUAL`
- **Benzer mekanizma**: `auto_charge_logs` tablosu maliyet kalemleri için mevcut (period + unique constraint ile duplicate önleme)
- **Expenses schema**: `@@index([tenantId, date])`, `@@index([tenantId, categoryId])`

### Gerekli Mantık
1. Cron job günde 1 kez çalışır (her gün 03:00 UTC)
2. `isRecurring=true` olan tüm giderleri bulur
3. Her birinin `recurringFrequency`'sine göre yeni dönem gelip gelmediğini kontrol eder
4. Yeni dönem geldiyse, aynı bilgilerle yeni bir `expense` kaydı oluşturur
5. Duplicate önleme: Aynı dönem için tekrar oluşturma yapılmamalı
6. Log tablosu ile takip (opsiyonel - basit tutmak için log yerine date kontrolü yeterli)

### Duplicate Önleme Stratejisi
En basit yaklaşım: Son kaydın tarihine bakarak yeni dönem gelip gelmediğini kontrol et.

```
REC_MONTHLY:   Son kayıt bu ayda mı? Evet → atla, Hayır → oluştur
REC_QUARTERLY: Son kayıt bu çeyrekte mi? Evet → atla, Hayır → oluştur
REC_ANNUAL:    Son kayıt bu yılda mı? Evet → atla, Hayır → oluştur
```

Daha güvenilir yaklaşım (tercih): `recurring_expense_logs` tablosu ile `(expenseId, period)` unique constraint.

### Karar: Log Tablosu ile Takip
- `auto_charge_logs` pattern'ini takip ederek `recurring_expense_logs` tablosu oluşturulacak
- `(sourceExpenseId, period)` unique constraint → duplicate garantisi
- Hangi dönemlerin işlendiği net görülür

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `prisma/schema.prisma` | Düzenleme | `recurring_expense_logs` modeli ekle |
| `src/app/api/cron/recurring-expenses/route.ts` | Yeni dosya | Cron job handler |
| `vercel.json` | Düzenleme | Yeni cron schedule ekle |

**Toplam:** 1 yeni dosya + 2 düzenleme = 3 dosya

## Uygulama Planı

### Adım 1: Prisma Schema - recurring_expense_logs modeli
- [ ] `prisma/schema.prisma`'ya yeni model ekle:

```prisma
model recurring_expense_logs {
  id              String           @id @default(uuid()) @db.Uuid
  sourceExpenseId String           @db.Uuid
  createdExpenseId String?         @db.Uuid
  period          String           // "2026-02" formatında
  status          AutoChargeStatus // SUCCESS veya FAILED (mevcut enum reuse)
  errorMessage    String?
  executedAt      DateTime         @default(now())
  tenantId        String           @db.Uuid

  source_expense expenses @relation("recurring_source", fields: [sourceExpenseId], references: [id], onDelete: Cascade)
  created_expense expenses? @relation("recurring_created", fields: [createdExpenseId], references: [id], onDelete: SetNull)
  tenants        tenants  @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([sourceExpenseId, period])
  @@index([tenantId])
}
```

- [ ] `expenses` modeline relation ekle:
```prisma
  recurring_source_logs recurring_expense_logs[] @relation("recurring_source")
  recurring_created_logs recurring_expense_logs[] @relation("recurring_created")
```

- [ ] `tenants` modeline relation ekle:
```prisma
  recurring_expense_logs recurring_expense_logs[]
```

- [ ] `npx prisma db push` veya migration çalıştır

### Adım 2: Cron Job API Route
- [ ] `src/app/api/cron/recurring-expenses/route.ts` oluştur
- [ ] GET handler:
  1. CRON_SECRET auth kontrolü
  2. Tüm tenant'lardaki `isRecurring=true` expenses'ları getir
  3. Her biri için mevcut dönem hesapla (bugünün yıl-ay'ı)
  4. `recurring_expense_logs`'da bu dönem var mı kontrol et
  5. Yoksa yeni expense oluştur + log kaydı yaz
  6. Hata olursa log'a FAILED yaz

- [ ] Dönem hesaplama fonksiyonu:
```typescript
function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shouldCreateForPeriod(
  frequency: "REC_MONTHLY" | "REC_QUARTERLY" | "REC_ANNUAL",
  period: string
): boolean {
  const [year, month] = period.split("-").map(Number);
  switch (frequency) {
    case "REC_MONTHLY": return true; // Her ay
    case "REC_QUARTERLY": return [1, 4, 7, 10].includes(month); // Çeyrek başları
    case "REC_ANNUAL": return month === 1; // Yılbaşı
  }
}
```

- [ ] Yeni expense oluşturma:
```typescript
const newExpense = await prisma.expenses.create({
  data: {
    categoryId: source.categoryId,
    amount: source.amount,
    currency: source.currency,
    date: new Date(), // Bugünün tarihi
    description: source.description ? `${source.description} (Otomatik)` : "Tekrarlayan gider (Otomatik)",
    isRecurring: false, // Oluşturulan kayıt tekrarlayan DEĞİL
    tenantId: source.tenantId,
  },
});
```
  **KRİTİK:** Oluşturulan yeni kayıtta `isRecurring: false` olmalı, yoksa sonsuz döngüye girer!

### Adım 3: vercel.json güncelle
- [ ] Yeni cron schedule ekle:
```json
{
  "path": "/api/cron/recurring-expenses",
  "schedule": "0 3 * * *"
}
```
  Günde 1 kez, 03:00 UTC'de çalışır (Türkiye saati 06:00)

## Teknik Notlar

### Edge Case'ler
- **Sonsuz döngü**: Yeni oluşturulan expense `isRecurring: false` olmalı!
- **Geçmiş dönem**: Cron çalışmadıysa sadece mevcut dönemi oluşturur (geçmiş dönemler atlanır - basitlik için)
- **Silinen kaynak**: `onDelete: Cascade` ile kaynak silindiğinde loglar da silinir
- **Aynı gün çoklu çalışma**: `@@unique([sourceExpenseId, period])` ile korunuyor
- **Çeyrek dönem**: REC_QUARTERLY sadece Ocak, Nisan, Temmuz, Ekim aylarında oluşturur
- **Multi-tenant**: Tüm tenant'lar tek cron'da işlenir, her kaydın tenantId'si korunur

### Performans
- `findMany` ile tüm recurring expenses tek sorguda alınır
- Log kontrolü batch yapılabilir ama başlangıçta basit loop yeterli
- Gider sayısı düşük olacağı için (ofis başına ~10-50) performans sorunu beklenmez

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Vercel Cron | Zaten kullanılıyor, altyapı hazır | pg_cron (Supabase), external cron |
| Log tablosu | Duplicate güvenliği, audit trail | Date-based kontrol (daha kırılgan) |
| Günde 1 kez | Gider oluşturma günlük yeterli | Saatlik (gereksiz), haftalık (geç) |
| isRecurring:false yeni kayıt | Sonsuz döngü önleme | Flag alanı (over-engineering) |
| Sadece mevcut dönem | Basitlik, geçmiş dönemi kullanıcı manuel girer | Backfill (karmaşık) |
