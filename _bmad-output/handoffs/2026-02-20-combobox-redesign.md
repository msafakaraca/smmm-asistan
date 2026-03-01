# Handoff: Beyanname Combobox Redesign + Sorgulama Durumu
**Tarih:** 2026-02-20 14:00
**Durum:** Araştırma Tamamlandı -> Uygulama Bekliyor

## Görev Tanımı
> Arşiv sayfasında (/dashboard/beyannameler/arsiv) mükellef seçim alanı çok uzun, filtre butonu sağa kayıyor. Combobox kompakt hale getirilecek. Combobox item'larında: VKN kırmızı renkle, son sorgulama tarihi, sorgulama durumu etiketi (Sorgulandı/Sorgulanmamış) gösterilecek. Tüm bilgiler simetrik, hizalı ve | ayırıcısıyla ayrılacak. Beyanname sorgulandığında ve arşive atıldığında otomatik olarak combobox'ta "Sorgulandı" etiketi ve tarih görünecek.

## Araştırma Bulguları

### Mevcut Durum

#### Arşiv Sayfası Combobox (beyanname-arsiv-client.tsx)
- **Satır 691:** `min-w-[220px] flex-1` -> combobox tüm genişliği kaplıyor
- **Satır 700-708:** Trigger sadece firma adı gösteriyor: "ABC Muhasebe"
- **Satır 712-714:** PopoverContent genişliği trigger'a bağlı (var(--radix-popover-trigger-width))
- **Satır 733-754:** Item layout: `[✓] Ad (VKN)` — basit, sorgulama durumu yok

#### Sorgulama Sayfası Combobox (beyanname-client.tsx)
- **Satır 942-1010:** Aynı pattern, ek olarak "GİB eksik" label'i var (satır 1002-1004)
- **Satır 950-957:** Trigger aynı — sadece firma adı

#### Veri Kaynağı — query_archives tablosu
- **Schema:** prisma/schema.prisma:1271-1301
- `lastQueriedAt DateTime` alanı mevcut
- `queryType = "beyanname"` ile filtrelenebilir
- Index: `@@index([tenantId, customerId])` — hızlı GROUP BY
- Unique: `@@unique([tenantId, customerId, queryType, month, year])`

#### Customers API (src/app/api/customers/route.ts)
- `GET /api/customers?fields=minimal` dönüyor: id, unvan, kisaltma, vknTckn, sirketTipi, siraNo, hasGib/Edevlet/TurmobCredentials
- Auth: `auth()` fonksiyonu kullanılıyor (session.user.tenantId)
- 7+ yerde kullanılıyor — kirletilmemeli

#### Mevcut UI Bileşenleri
- `Badge` component var: `src/components/ui/badge.tsx` — success, warning, destructive, outline varyantları
- Dark mode pattern: `text-emerald-600 dark:text-emerald-400` projede zaten kullanılıyor
- Ayırıcı pattern: `border-r` ve `|` karakter ikisi de projede mevcut

### Kararlar ve Gerekçeler

| Karar | Neden | Alternatif |
|-------|-------|------------|
| Yeni API endpoint oluştur | Customers API kirletilmez, clean separation | customers?withQueryStatus=beyanname (kirletir) |
| Promise.allSettled kullan | Status API fail olsa bile müşteri listesi görünür | Promise.all (hata halinde tümü fail olur) |
| CSS border-r ayırıcı | Daha temiz, hizalı, profesyonel | `\|` karakteri (kaba görünür) |
| VKN text-rose-600 | Dikkat çekici ama hata hissi vermeyen | text-red-600 (çok agresif, hata gibi) |
| Dot (●/○) + inline text | Kompakt, Badge'den daha az yer kaplar | Badge component (daha kalabalık) |
| PopoverContent minWidth:500 | 3 bölge sığması için | Trigger genişliği ile sınırlı (sığmaz) |
| Her iki sayfa da güncellenir | UX tutarlılığı | Sadece arsiv (tutarsız olur) |

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `src/app/api/query-archives/customer-status/route.ts` | **YENİ** | Beyanname sorgulama durumu endpoint'i |
| `src/components/beyannameler/beyanname-arsiv-client.tsx` | Düzenleme | Combobox layout + item redesign |
| `src/components/beyannameler/beyanname-client.tsx` | Düzenleme | Sorgulama sayfası combobox tutarlılığı |

## Uygulama Planı

### Adım 1: API Endpoint Oluştur
- [ ] `src/app/api/query-archives/customer-status/route.ts` oluştur
- [ ] Auth guard: `getUserWithProfile()` + tenantId
- [ ] Prisma `groupBy` sorgusu:
  ```typescript
  const results = await prisma.query_archives.groupBy({
    by: ['customerId'],
    where: {
      tenantId: user.tenantId,
      queryType,
    },
    _max: {
      lastQueriedAt: true,
    },
  });
  ```
- [ ] Response: `{ statuses: Record<string, string> }` — customerId -> ISO date string

### Adım 2: Arşiv Sayfası Combobox Redesign (beyanname-arsiv-client.tsx)

#### 2a. Customer Interface Güncelleme
- [ ] Satır 42-46: `lastBeyannameQueryAt: string | null` ekle

#### 2b. Veri Yükleme — Promise.allSettled
- [ ] Satır 482-502 (`loadCustomers`): Promise.allSettled ile customers + statuses paralel yükle
  ```typescript
  const [customersResult, statusResult] = await Promise.allSettled([
    fetch("/api/customers?fields=minimal"),
    fetch("/api/query-archives/customer-status?queryType=beyanname"),
  ]);
  // customers'ı map'le, status'ı merge et
  ```

#### 2c. Layout Kompaktlık
- [ ] Satır 691: `min-w-[220px] flex-1` -> `min-w-[220px] max-w-[400px]` (flex-1 kaldır)

#### 2d. Trigger Güncelleme
- [ ] Satır 700-708: Seçili mükellef varken trigger'da VKN de göster:
  ```
  "ABC Muhasebe · 1234567890"
  ```
  VKN kısmı `text-rose-600 dark:text-rose-400`

#### 2e. PopoverContent Genişliği
- [ ] Satır 712-714: `style` prop'una `minWidth: 500` ekle

#### 2f. Combobox Item Redesign (ANA DEĞİŞİKLİK)
- [ ] Satır 733-754: Tamamen yeniden tasarla
- [ ] Yeni layout (tek satır, CSS border-r ile bölünmüş):
  ```
  [✓] Firma Adı      | 1234567890 | ● Sorgulandı · 15.02.2026
  [✓] Diğer Firma    | 9876543210 | ○ Sorgulanmamış
  ```
- [ ] Bölüm 1 — Firma adı: `truncate flex-1 text-sm`
- [ ] Bölüm 2 — VKN: `text-xs font-mono text-rose-600 dark:text-rose-400 shrink-0 border-x border-border px-2`
- [ ] Bölüm 3 — Durum: `shrink-0 flex items-center gap-1.5`
  - Dot: `h-1.5 w-1.5 rounded-full` + emerald/slate renk
  - Label: `text-[11px]` — "Sorgulandı" veya "Sorgulanmamış"
  - Tarih (varsa): `text-[10px] text-muted-foreground` — "15.02.2026"

### Adım 3: Sorgulama Sayfası Combobox Tutarlılığı (beyanname-client.tsx)

#### 3a. Customer Interface Güncelleme
- [ ] Satır 56-61: `lastBeyannameQueryAt: string | null` ekle

#### 3b. Veri Yükleme
- [ ] Satır 614-635: Aynı Promise.allSettled pattern

#### 3c. Item Redesign
- [ ] Satır 982-1006: Arşiv sayfasıyla aynı 3 bölgeli layout
- [ ] "GİB eksik" label'i korunacak (Bölüm 3'te durumun yanında veya altında)

### Adım 4: Test ve Doğrulama
- [ ] Dark mode'da tüm renkler doğru mu?
- [ ] Boş tenant (query_archives boş) — "Sorgulanmamış" gösterimi çalışıyor mu?
- [ ] 500+ mükellef ile performans kontrolü
- [ ] PopoverContent taşma yok mu? (minWidth + maxWidth dengelendi mi?)
- [ ] Mobile responsive (küçük ekranda combobox ve dropdown davranışı)
- [ ] Beyanname sorgulandıktan sonra combobox'taki durum güncellenecek mi? (Evet - revalidation gerekli)

## Teknik Notlar

### Tarih Formatı
Projede zaten `formatDate` fonksiyonu var (`query-archive-filter.tsx:818-826`):
```typescript
function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
```
Bu fonksiyon kopyalanacak veya utils'e taşınacak.

### Revalidation — Sorgulama Sonrası Güncelleme
beyanname-client.tsx'te sorgulama tamamlandığında `archiveSaveRef` ile arşive kayıt yapılıyor (satır 645-687). Bu kayıt tamamlandıktan sonra combobox'taki sorgulama durumu otomatik güncellenmeli. Çözüm:
- `queryDone` state'i true olduğunda status endpoint'ini tekrar çağır
- Veya local state'te seçili mükelefin tarihini güncelle (daha hızlı)

### PopoverContent Genişlik Stratejisi
Mevcut: `style={{ width: "var(--radix-popover-trigger-width)" }}`
Yeni: `style={{ width: "var(--radix-popover-trigger-width)", minWidth: 500 }}`
Bu sayede trigger dar olsa bile dropdown en az 500px olur. Eğer trigger daha genişse (geniş ekran), trigger genişliğini takip eder.

### Performance — useMemo ile queryStatusMap
```typescript
const customersWithStatus = useMemo(() => {
  return customers.map(c => ({
    ...c,
    lastBeyannameQueryAt: queryStatusMap[c.id] || null,
  }));
}, [customers, queryStatusMap]);
```

### Prisma groupBy — Tip Güvenliği
```typescript
// Prisma 6.19 groupBy destekliyor
const results = await prisma.query_archives.groupBy({
  by: ['customerId'],
  where: { tenantId: user.tenantId, queryType },
  _max: { lastQueriedAt: true },
});

// Record<string, string> dönüşümü
const statuses: Record<string, string> = {};
for (const r of results) {
  if (r._max.lastQueriedAt) {
    statuses[r.customerId] = r._max.lastQueriedAt.toISOString();
  }
}
```

## Görsel Referans

### Combobox Trigger (Kapalı)
```
┌─────────────────────────────────────┐  ┌──────────┐
│ ABC Muhasebe · 1234567890        ▼  │  │ Filtrele │
└─────────────────────────────────────┘  └──────────┘
     max-w-[400px]                        Yanına geldi!
```

### Combobox Dropdown (Açık)
```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Mükellef ara (ünvan, kısaltma veya VKN)...             │
├─────────────────────────────────────────────────────────────┤
│  ✓  ABC Muhasebe    │  1234567890  │ ● Sorgulandı 15.02.26 │
│     XYZ Ticaret     │  9876543210  │ ○ Sorgulanmamış        │
│     DEF A.Ş.        │  5555555555  │ ● Sorgulandı 03.01.26  │
│     GHI Ltd.        │  7777777777  │ ○ Sorgulanmamış        │
└─────────────────────────────────────────────────────────────┘
     Firma Adı            VKN (kırmızı)   Durum + Tarih
     (truncate)           (border-x)      (yeşil/gri dot)
```

### Renk Şeması
| Eleman | Light Mode | Dark Mode |
|--------|-----------|-----------|
| VKN | `text-rose-600` | `text-rose-400` |
| Sorgulandı dot | `bg-emerald-500` | `bg-emerald-400` |
| Sorgulandı text | `text-emerald-700` | `text-emerald-400` |
| Sorgulanmamış dot | `bg-slate-300` | `bg-zinc-600` |
| Sorgulanmamış text | `text-muted-foreground` | `text-muted-foreground` |
| Ayırıcı border | `border-border` | `border-border` |
| Tarih | `text-muted-foreground` | `text-muted-foreground` |
