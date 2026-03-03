# Handoff: Mükellef Beyanname Türü Yönetimi Sayfası
**Tarih:** 2026-03-03 21:30
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor
**Toplam Task:** 10
**Context Reset Noktası:** Task 5 tamamlandıktan sonra

---

## Görev Tanımı

> Mali müşavirin mükelleflerine hangi beyanname türlerinin atanacağını ve her birinin dönemini (15 günlük, aylık, 3 aylık, 6 aylık, yıllık) yönettiği tam ekran matrix tablosu. Toplu ve tekil atama desteği. Hattat yazılımının "Beyanname Kontrol" tablosu referans alınarak tasarlanmıştır.

---

## Onaylanan Kararlar

| Karar | Sonuç |
|-------|-------|
| Beyanname türleri | Hattat referanslı 23 tür (FORMBA, FORMBS, MUH çıkarıldı) |
| Dönemler | 15 günlük, aylık, 3 aylık, 6 aylık, yıllık |
| Veri modeli | `beyannameAyarlari: Json` (Customer) + `donemSecenekleri: String[]` (beyanname_turleri) |
| Eski veri | Sıfırdan başla, migrate yok |
| Mevcut alan | `verilmeyecekBeyannameler` dokunulmayacak, API'de otomatik senkronize edilecek |
| Sayfa konumu | `/dashboard/mukellefler/beyannameler` |
| Buton konumu | Mükellefler toolbar'da "Mükellefleri Çek" yanında |
| UX pattern | Kategori tab'lı matrix + dönem dropdown |
| Filtreleme | Şirket tipine göre (şahıs/firma/basit_usul) |
| Toplu işlem | Mükellef seç → sütun başlığından dönem ata |
| Virtual scrolling | Evet, threshold: 100 |
| Kaydetme | "Kaydet" butonu ile toplu (optimistic update yok) |
| Kontrol çizelgesi | Bu scope DIŞI |
| Beyanname takip redesign | Bu scope DIŞI |

---

## Hattat Referans — Beyanname Türleri (23 Adet)

Kaynak: `c:\Users\msafa\Desktop\Projeler\SMMM Asistan Belgeler\Beyanname Kontrol Seçme.txt`

| siraNo | kod | aciklama | kisaAd | kategori | donemSecenekleri |
|--------|-----|----------|--------|----------|------------------|
| 1 | GELIR | Gelir Vergisi Beyannamesi | GV | Gelir | ["yillik"] |
| 2 | KDV1 | KDV Beyannamesi 1 | KDV1 | KDV | ["aylik", "3aylik"] |
| 3 | KDV2 | KDV Beyannamesi 2 | KDV2 | KDV | ["aylik", "3aylik"] |
| 4 | DAMGA | Damga Vergisi Beyannamesi | DV | Damga | ["aylik"] |
| 5 | GGECICI | Gelir Geçici Vergi Beyannamesi | GVG | Gelir | ["3aylik"] |
| 6 | KGECICI | Kurum Geçici Vergi Beyannamesi | KVG | Kurumlar | ["3aylik"] |
| 7 | KURUMLAR | Kurumlar Vergisi Beyannamesi | KV | Kurumlar | ["yillik"] |
| 8 | OTV | ÖTV Beyannamesi | ÖTV | ÖTV | ["aylik", "3aylik"] |
| 9 | MUHSGK | Muhtasar ve Prim Hizmet Beyannamesi | MUH/SGK | Muhtasar | ["aylik", "3aylik"] |
| 10 | POSET | Poşet Beyannamesi | POŞET | Diğer | ["aylik", "3aylik", "6aylik"] |
| 11 | KDV4 | KDV Beyannamesi 4 | KDV4 | KDV | ["aylik"] |
| 12 | BASIT | Basit Usul Ticari Kazanç Beyannamesi | BASIT | Gelir | ["yillik"] |
| 13 | GELIR1001E | Gelir 1001E Beyannamesi | 1001E | Gelir | ["yillik"] |
| 14 | GMSI | Gayrimenkul Sermaye İradı Beyannamesi | GMSI | Gelir | ["yillik"] |
| 15 | TURIZM | Turizm Payı Beyannamesi | TURZ | Diğer | ["aylik", "3aylik"] |
| 16 | MUHSGK2 | Muhtasar ve Prim Hizmet 2 | MUH2 | Muhtasar | ["aylik", "3aylik"] |
| 17 | OTV3B | ÖTV 3B Beyannamesi | ÖTV3B | ÖTV | ["aylik", "3aylik"] |
| 18 | OTV1 | ÖTV 1 Beyannamesi | ÖTV1 | ÖTV | ["15gunluk", "aylik", "3aylik"] |
| 19 | OTV3A | ÖTV 3A Beyannamesi | ÖTV3A | ÖTV | ["aylik", "3aylik"] |
| 20 | OTV4 | ÖTV 4 Beyannamesi | ÖTV4 | ÖTV | ["aylik", "3aylik"] |
| 21 | OIV | ÖİV Beyannamesi | ÖİV | Diğer | ["aylik"] |
| 22 | KONAKLAMA | Konaklama Vergisi Beyannamesi | KONK | Diğer | ["aylik"] |
| 23 | KDV9015 | KDV Tevkifat Beyannamesi | 9015 | KDV | ["aylik"] |

### Kategori Grupları (Tab sırası):

```
KDV (4):        KDV1, KDV2, KDV4, KDV9015
Gelir (5):      GELIR, GGECICI, BASIT, GELIR1001E, GMSI
Kurumlar (2):   KURUMLAR, KGECICI
Muhtasar (2):   MUHSGK, MUHSGK2
ÖTV (5):        OTV, OTV1, OTV3A, OTV3B, OTV4
Diğer (5):      DAMGA, TURIZM, KONAKLAMA, POSET, OIV
```

---

## Etkilenecek Dosyalar

| # | Dosya | İşlem | Detay |
|---|-------|-------|-------|
| 1 | `prisma/schema.prisma` | Düzenleme | `beyannameAyarlari` + `donemSecenekleri` alan ekleme |
| 2 | `src/app/api/beyanname-turleri/route.ts` | Düzenleme | 23 tür seed, donemSecenekleri desteği |
| 3 | `src/app/api/customers/beyanname-ayarlari/route.ts` | Yeni dosya | GET + PATCH bulk endpoint |
| 4 | `src/components/beyanname-yonetimi/hooks/use-beyanname-yonetimi.ts` | Yeni dosya | Veri yönetimi hook'u |
| 5 | `src/components/beyanname-yonetimi/beyanname-matrix.tsx` | Yeni dosya | Ana matrix tablo bileşeni |
| 6 | `src/components/beyanname-yonetimi/beyanname-category-tabs.tsx` | Yeni dosya | Kategori tab navigasyonu |
| 7 | `src/components/beyanname-yonetimi/beyanname-header-cell.tsx` | Yeni dosya | Sütun başlığı (dönem + toplu) |
| 8 | `src/components/beyanname-yonetimi/beyanname-data-cell.tsx` | Yeni dosya | Hücre dropdown |
| 9 | `src/components/beyanname-yonetimi/beyanname-bulk-bar.tsx` | Yeni dosya | Alt toplu işlem barı |
| 10 | `src/app/(dashboard)/dashboard/mukellefler/beyannameler/page.tsx` | Yeni dosya | Sayfa wrapper |
| 11 | `src/app/(dashboard)/dashboard/mukellefler/beyannameler/client.tsx` | Yeni dosya | Ana sayfa bileşeni |
| 12 | `src/components/dashboard/nav.tsx` | Düzenleme | Mükellefler alt menü |
| 13 | `src/app/(dashboard)/dashboard/mukellefler/client.tsx` | Düzenleme | Toolbar'a "Beyannameler" butonu |

---

## Hata Önleme Kontrol Listesi

### KRİTİK — Bu kontroller her task sonunda yapılmalı:

- [ ] **Tenant izolasyonu:** Her query'de `tenantId` filtresi var mı?
- [ ] **Zod validation:** `beyannameAyarlari` JSON verisi validate ediliyor mu?
- [ ] **Auth guard:** Her API endpoint'te auth kontrolü var mı?
- [ ] **Type safety:** `any` tipi kullanılmamış mı?
- [ ] **Import:** Barrel import yok, doğrudan import kullanılıyor mu?
- [ ] **Türkçe:** Tüm UI metinleri Türkçe mi?
- [ ] **Layout taşması:** Yatay scroll oluşmuyor mu? (Kategori tab'ları bunu çözmeli)
- [ ] **Virtual scrolling:** 100+ müşteride performans testi
- [ ] **Race condition:** Toplu güncellemede tek transaction kullanılıyor mu?

### Bilinen Edge Case'ler:

1. **Boş `donemSecenekleri`:** Mevcut beyanname_turleri kayıtlarında bu alan boş olacak. UI'da fallback gerekli.
2. **`verilmeyecekBeyannameler` senkronizasyonu:** `beyannameAyarlari` kaydedildikten sonra `verilmeyecekBeyannameler` otomatik türetilmeli.
3. **Eski türler (FORMBA, FORMBS, MUH):** Silme yerine `aktif: false` yapılmalı (beyanname_takip JSON referansları bozulmasın).
4. **15 günlük dönem:** Sadece bilgi amaçlı saklanacak, beyanname_takip entegrasyonu bu scope dışı.
5. **Yeni tenant:** İlk GET'te 23 türün tamamı seed olarak oluşturulmalı.
6. **Mevcut tenant:** GET sırasında eksik türler otomatik eklenmeli (mevcut migration pattern).

---

## UX Tasarım Detayları

### Tam Ekran Layout:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Mükellefler              Beyanname Türü Yönetimi                  │
│─────────────────────────────────────────────────────────────────────│
│ 🔍 Mükellef Ara...  │ Tür: Tümü ▼ │ Durum: Aktif ▼ │    [Kaydet]  │
│─────────────────────────────────────────────────────────────────────│
│ ┌────────────────────────────────────────────────────────────────┐  │
│ │ KDV │ Gelir │ Kurumlar │ Muhtasar │ ÖTV │ Diğer │             │  │
│ ├────────────────────────────────────────────────────────────────┤  │
│ │                                                                │  │
│ │ Sütun başlıkları: [Beyanname Adı] + [Dönem ▼] + [☑ Toplu]    │  │
│ │                                                                │  │
│ │ ┌──────────────┬──────────┬──────────┬──────────┬──────────┐  │  │
│ │ │              │  KDV1    │  KDV2    │  KDV4    │ KDV9015  │  │  │
│ │ │  Mükellef    │ [Aylık▼] │ [Aylık▼] │ [Aylık ] │ [Aylık ] │  │  │
│ │ │  [☑ Tümü]    │ [☑ Ata]  │ [☑ Ata]  │ [☑ Ata]  │ [☑ Ata]  │  │  │
│ │ ├──────────────┼──────────┼──────────┼──────────┼──────────┤  │  │
│ │ │☑ Ahmet Usta  │ Aylık  ▼ │    —     │    —     │    —     │  │  │
│ │ │☑ Mehmet Ltd  │ 3Aylık ▼ │ Aylık  ▼ │    —     │ Aylık  ▼ │  │  │
│ │ │☐ Ayşe Basit  │    —     │    —     │    —     │    —     │  │  │
│ │ │☑ Ali Tic.    │ Aylık  ▼ │ Aylık  ▼ │    —     │    —     │  │  │
│ │ │  ...         │ (virtual) │          │          │          │  │  │
│ │ └──────────────┴──────────┴──────────┴──────────┴──────────┘  │  │
│ │                                                                │  │
│ │ 📊 KDV1: 45/150 mükellef │ KDV2: 12/150 │ ...                │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│ ┌────────────────────────────────────────────────────────────────┐  │
│ │ Seçili: 3 mükellef │ Kaydedilmemiş değişiklik: 7              │  │
│ └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Etkileşim Kuralları:

1. **Tab seçimi:** Kategori tab'ına tıkla → o kategorinin beyanname türleri sütun olarak gösterilir
2. **Sütun başlığı "Dönem ▼":** Toplu atama yapılacak varsayılan dönemi seçer
3. **Sütun başlığı "☑ Ata":** Seçili mükelleflere bu beyanname türünü varsayılan dönemle atar
4. **Hücre "—":** Beyanname atanmamış. Tıklayınca dönem dropdown açılır → seçim yapılır → atanır
5. **Hücre "Aylık ▼":** Beyanname atanmış. Dropdown ile dönem değiştirilir. "Kaldır" seçeneği ile silinir
6. **Mükellef checkbox:** Toplu işlem için mükellef seçimi
7. **"Tümü" checkbox:** Filtrelenmiş tüm mükellefleri seç/kaldır
8. **"Kaydet" butonu:** Tüm değişiklikleri sunucuya gönderir (disabled durumda değişiklik yoksa)
9. **Alt bar:** Seçili mükellef sayısı + kaydedilmemiş değişiklik sayısı
10. **Şirket tipi filtresi "Tür: Tümü ▼":** Tümü / Şahıs / Firma / Basit Usul

### CSS Layout Pattern (Tam Ekran):

```tsx
// Ana container — layout padding'i iptal edip tam ekran
<div className="flex flex-col h-[calc(100vh-64px)] -m-4 xl:-m-6">
  {/* Toolbar — sabit yükseklik */}
  <div className="shrink-0 border-b bg-background p-4">
    {/* Arama, filtre, kaydet */}
  </div>

  {/* Tab + Matrix — kalan alanı doldur */}
  <div className="flex-1 flex flex-col overflow-hidden">
    {/* Kategori tab'ları */}
    <div className="shrink-0 border-b px-4">
      {/* KDV | Gelir | Kurumlar | ... */}
    </div>

    {/* Matrix tablo — scroll alanı */}
    <div className="flex-1 overflow-auto" ref={parentRef}>
      <table className="table-fixed w-full">
        <thead className="sticky top-0 bg-background z-10">
          {/* Sütun başlıkları */}
        </thead>
        <tbody>
          {/* Virtual scroll satırlar */}
        </tbody>
      </table>
    </div>

    {/* Özet istatistik */}
    <div className="shrink-0 border-t px-4 py-2 text-sm text-muted-foreground">
      {/* KDV1: 45/150 mükellef */}
    </div>
  </div>

  {/* Bulk action bar — seçili mükellef varsa görünür */}
  <div className="shrink-0 border-t bg-background p-3">
    {/* Seçili: 3 mükellef | Kaydedilmemiş: 7 */}
  </div>
</div>
```

---

## Veri Modeli Detayları

### Schema Değişiklikleri (prisma/schema.prisma):

**customers modeline eklenecek alan (satır ~215 civarı, `verilmeyecekBeyannameler`'den sonra):**
```prisma
beyannameAyarlari    Json     @default("{}")
```

**beyanname_turleri modeline eklenecek alan (satır ~87 civarı, `siraNo`'dan sonra):**
```prisma
donemSecenekleri String[] @default([])
```

### beyannameAyarlari JSON Format:

```json
{
  "KDV1": "aylik",
  "KDV2": "3aylik",
  "MUHSGK": "aylik",
  "KGECICI": "3aylik",
  "KURUMLAR": "yillik",
  "OTV1": "15gunluk"
}
```

- Key = beyanname türü kodu
- Value = dönem string (`"15gunluk"` | `"aylik"` | `"3aylik"` | `"6aylik"` | `"yillik"`)
- Key varsa = beyanname verilecek
- Key yoksa = beyanname verilmeyecek

### Dönem Enum Değerleri:

```typescript
const DONEM_OPTIONS = [
  { value: "15gunluk", label: "15 Günlük" },
  { value: "aylik", label: "Aylık" },
  { value: "3aylik", label: "3 Aylık" },
  { value: "6aylik", label: "6 Aylık" },
  { value: "yillik", label: "Yıllık" },
] as const;

type DonemType = "15gunluk" | "aylik" | "3aylik" | "6aylik" | "yillik";
```

---

## API Detayları

### GET /api/customers/beyanname-ayarlari

```typescript
// Tüm aktif mükelleflerin beyannameAyarlari'nı döner
// Response:
{
  customers: [
    {
      id: "uuid",
      unvan: "Ahmet Usta",
      kisaltma: "A.USTA",
      sirketTipi: "sahis",
      siraNo: "1",
      beyannameAyarlari: { "KDV1": "aylik", "MUHSGK": "aylik" }
    },
    // ...
  ]
}
```

**Auth pattern (verilmeyecek route'tan referans):**
```typescript
import { auth } from "@/lib/auth";
const session = await auth();
if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const tenantId = (session.user as any).tenantId;
```

**Prisma query:**
```typescript
const customers = await prisma.customers.findMany({
  where: { tenantId, status: "active" },
  select: {
    id: true,
    unvan: true,
    kisaltma: true,
    sirketTipi: true,
    siraNo: true,
    beyannameAyarlari: true,
  },
  orderBy: [{ sirketTipi: "asc" }, { siraNo: "asc" }, { unvan: "asc" }],
});
```

### PATCH /api/customers/beyanname-ayarlari

```typescript
// Toplu güncelleme
// Request body:
{
  customerIds: ["id1", "id2", "id3"],
  updates: { "KDV1": "aylik", "MUHSGK": "3aylik" },  // ekle/güncelle
  removals: ["DAMGA", "OTV"]                           // kaldır
}

// Zod validation:
const bulkUpdateSchema = z.object({
  customerIds: z.array(z.string().uuid()),
  updates: z.record(z.string(), z.enum(["15gunluk", "aylik", "3aylik", "6aylik", "yillik"])).optional(),
  removals: z.array(z.string()).optional(),
});
```

**İşlem mantığı (tek transaction):**
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Tenant izolasyonu kontrolü
  const validCustomers = await tx.customers.findMany({
    where: { id: { in: customerIds }, tenantId },
    select: { id: true, beyannameAyarlari: true, verilmeyecekBeyannameler: true },
  });

  // 2. Her müşteri için beyannameAyarlari güncelle
  for (const customer of validCustomers) {
    const current = (customer.beyannameAyarlari as Record<string, string>) || {};

    // Updates ekle
    if (updates) {
      for (const [kod, donem] of Object.entries(updates)) {
        current[kod] = donem;
      }
    }

    // Removals kaldır
    if (removals) {
      for (const kod of removals) {
        delete current[kod];
      }
    }

    // 3. verilmeyecekBeyannameler senkronizasyonu
    const tumAktifKodlar = await tx.beyanname_turleri.findMany({
      where: { tenantId, aktif: true },
      select: { kod: true },
    });
    const atanmisKodlar = Object.keys(current);
    const verilmeyecek = tumAktifKodlar
      .map(t => t.kod)
      .filter(k => !atanmisKodlar.includes(k));

    await tx.customers.update({
      where: { id: customer.id },
      data: {
        beyannameAyarlari: current,
        verilmeyecekBeyannameler: verilmeyecek,
      },
    });
  }
});
```

---

## Navigasyon Değişikliği

### src/components/dashboard/nav.tsx

**Mevcut (satır 57-61):**
```typescript
{
  title: "Mükellefler",
  href: "/dashboard/mukellefler",
  icon: Users,
},
```

**Yeni (satır 57-69 olacak):**
```typescript
{
  title: "Mükellefler",
  href: "/dashboard/mukellefler",
  icon: Users,
  children: [
    {
      title: "Mükellef Listesi",
      href: "/dashboard/mukellefler",
    },
    {
      title: "Beyanname Türleri",
      href: "/dashboard/mukellefler/beyannameler",
    },
  ],
},
```

### src/app/(dashboard)/dashboard/mukellefler/client.tsx

**"Beyannameler" butonu ekleme — toolbar'da "Mükellefleri Çek" butonunun yanına:**
```tsx
<Link href="/dashboard/mukellefler/beyannameler">
  <Button variant="outline" size="sm">
    <FileText className="h-4 w-4 mr-2" />
    Beyanname Türleri
  </Button>
</Link>
```

**Import ekle:** `import { FileText } from "lucide-react";` ve `import Link from "next/link";`

---

## UYGULAMA PLANI — 10 TASK

### ═══ BÖLÜM 1: Backend + Veri Katmanı (Task 1-5) ═══

---

### Task 1: Prisma Schema Güncelleme
**Dosya:** `prisma/schema.prisma`
**İşlem:**
- [ ] `customers` modeline `beyannameAyarlari Json @default("{}")` ekle (satır ~215, `verilmeyecekBeyannameler`'den sonra)
- [ ] `beyanname_turleri` modeline `donemSecenekleri String[] @default([])` ekle (satır ~87, `siraNo`'dan sonra)
- [ ] `npm run db:generate` çalıştır
- [ ] `npm run db:push` çalıştır

**Dikkat:**
- Mevcut veriyi bozmayacak şekilde ekleme yapılıyor (default değerler var)
- `db:push` güvenli — yeni alanlar ekleniyor, mevcut alanlar dokunulmuyor

---

### Task 2: Beyanname Türleri Seed Güncelleme
**Dosya:** `src/app/api/beyanname-turleri/route.ts`
**İşlem:**
- [ ] `DEFAULT_BEYANNAME_TURLERI` array'ini 23 türle değiştir (yukarıdaki tablo referans)
- [ ] Her türe `donemSecenekleri` ekle
- [ ] FORMBA, FORMBS, MUH kodlarını varsayılan listeden çıkar
- [ ] Auto-migration mantığına (satır 77-98) yeni kodları ekle
- [ ] GET response'a `donemSecenekleri` alanını dahil et
- [ ] Mevcut tenant'larda FORMBA, FORMBS, MUH varsa `aktif: false` yap (SİLME!)

**Yeni DEFAULT_BEYANNAME_TURLERI:**
```typescript
const DEFAULT_BEYANNAME_TURLERI = [
  { kod: "GELIR",      aciklama: "Gelir Vergisi Beyannamesi",                  kisaAd: "GV",     kategori: "Gelir",    siraNo: 1,  donemSecenekleri: ["yillik"] },
  { kod: "KDV1",       aciklama: "KDV Beyannamesi 1",                          kisaAd: "KDV1",   kategori: "KDV",      siraNo: 2,  donemSecenekleri: ["aylik", "3aylik"] },
  { kod: "KDV2",       aciklama: "KDV Beyannamesi 2",                          kisaAd: "KDV2",   kategori: "KDV",      siraNo: 3,  donemSecenekleri: ["aylik", "3aylik"] },
  { kod: "DAMGA",      aciklama: "Damga Vergisi Beyannamesi",                  kisaAd: "DV",     kategori: "Damga",    siraNo: 4,  donemSecenekleri: ["aylik"] },
  { kod: "GGECICI",    aciklama: "Gelir Geçici Vergi Beyannamesi",             kisaAd: "GVG",    kategori: "Gelir",    siraNo: 5,  donemSecenekleri: ["3aylik"] },
  { kod: "KGECICI",    aciklama: "Kurum Geçici Vergi Beyannamesi",             kisaAd: "KVG",    kategori: "Kurumlar", siraNo: 6,  donemSecenekleri: ["3aylik"] },
  { kod: "KURUMLAR",   aciklama: "Kurumlar Vergisi Beyannamesi",               kisaAd: "KV",     kategori: "Kurumlar", siraNo: 7,  donemSecenekleri: ["yillik"] },
  { kod: "OTV",        aciklama: "ÖTV Beyannamesi",                            kisaAd: "ÖTV",    kategori: "ÖTV",      siraNo: 8,  donemSecenekleri: ["aylik", "3aylik"] },
  { kod: "MUHSGK",     aciklama: "Muhtasar ve Prim Hizmet Beyannamesi",        kisaAd: "MUH/SGK",kategori: "Muhtasar", siraNo: 9,  donemSecenekleri: ["aylik", "3aylik"] },
  { kod: "POSET",      aciklama: "Poşet Beyannamesi",                          kisaAd: "POŞET",  kategori: "Diğer",    siraNo: 10, donemSecenekleri: ["aylik", "3aylik", "6aylik"] },
  { kod: "KDV4",       aciklama: "KDV Beyannamesi 4",                          kisaAd: "KDV4",   kategori: "KDV",      siraNo: 11, donemSecenekleri: ["aylik"] },
  { kod: "BASIT",      aciklama: "Basit Usul Ticari Kazanç Beyannamesi",       kisaAd: "BASIT",  kategori: "Gelir",    siraNo: 12, donemSecenekleri: ["yillik"] },
  { kod: "GELIR1001E", aciklama: "Gelir 1001E Beyannamesi",                    kisaAd: "1001E",  kategori: "Gelir",    siraNo: 13, donemSecenekleri: ["yillik"] },
  { kod: "GMSI",       aciklama: "Gayrimenkul Sermaye İradı Beyannamesi",      kisaAd: "GMSI",   kategori: "Gelir",    siraNo: 14, donemSecenekleri: ["yillik"] },
  { kod: "TURIZM",     aciklama: "Turizm Payı Beyannamesi",                    kisaAd: "TURZ",   kategori: "Diğer",    siraNo: 15, donemSecenekleri: ["aylik", "3aylik"] },
  { kod: "MUHSGK2",    aciklama: "Muhtasar ve Prim Hizmet 2",                  kisaAd: "MUH2",   kategori: "Muhtasar", siraNo: 16, donemSecenekleri: ["aylik", "3aylik"] },
  { kod: "OTV3B",      aciklama: "ÖTV 3B Beyannamesi",                         kisaAd: "ÖTV3B",  kategori: "ÖTV",      siraNo: 17, donemSecenekleri: ["aylik", "3aylik"] },
  { kod: "OTV1",       aciklama: "ÖTV 1 Beyannamesi",                          kisaAd: "ÖTV1",   kategori: "ÖTV",      siraNo: 18, donemSecenekleri: ["15gunluk", "aylik", "3aylik"] },
  { kod: "OTV3A",      aciklama: "ÖTV 3A Beyannamesi",                         kisaAd: "ÖTV3A",  kategori: "ÖTV",      siraNo: 19, donemSecenekleri: ["aylik", "3aylik"] },
  { kod: "OTV4",       aciklama: "ÖTV 4 Beyannamesi",                          kisaAd: "ÖTV4",   kategori: "ÖTV",      siraNo: 20, donemSecenekleri: ["aylik", "3aylik"] },
  { kod: "OIV",        aciklama: "ÖİV Beyannamesi",                            kisaAd: "ÖİV",    kategori: "Diğer",    siraNo: 21, donemSecenekleri: ["aylik"] },
  { kod: "KONAKLAMA",  aciklama: "Konaklama Vergisi Beyannamesi",              kisaAd: "KONK",   kategori: "Diğer",    siraNo: 22, donemSecenekleri: ["aylik"] },
  { kod: "KDV9015",    aciklama: "KDV Tevkifat Beyannamesi",                   kisaAd: "9015",   kategori: "KDV",      siraNo: 23, donemSecenekleri: ["aylik"] },
];
```

**Migration mantığı ek kurallar:**
- Mevcut FORMBA, FORMBS, MUH kodlu kayıtlar `aktif: false` yapılmalı
- Mevcut türlerin `donemSecenekleri` boşsa, DEFAULT'tan doldurulmalı
- Mevcut türlerin `aciklama`, `kisaAd`, `kategori` güncellenebilir (Hattat'a uyum)

---

### Task 3: Bulk API Endpoint
**Dosya:** `src/app/api/customers/beyanname-ayarlari/route.ts` (YENİ)
**İşlem:**
- [ ] GET — Tüm aktif mükelleflerin `{ id, unvan, kisaltma, sirketTipi, siraNo, beyannameAyarlari }` döner
- [ ] PATCH — Toplu `beyannameAyarlari` güncelleme (Zod validation ile)
- [ ] PATCH işleminde `verilmeyecekBeyannameler` otomatik senkronizasyonu
- [ ] Tüm update'ler tek `prisma.$transaction` içinde
- [ ] Tenant izolasyonu: gelen `customerIds` listesindeki her ID'nin tenant'a ait olduğu doğrulanmalı

**Auth pattern:** `src/app/api/customers/[id]/verilmeyecek/route.ts`'deki pattern kullanılacak:
```typescript
import { auth } from "@/lib/auth";
const session = await auth();
if (!session?.user) return ...;
const tenantId = (session.user as any).tenantId;
```

**NOT:** `getUserWithProfile` DEĞİL, `auth()` kullanılacak (mevcut pattern).

---

### Task 4: use-beyanname-yonetimi Hook
**Dosya:** `src/components/beyanname-yonetimi/hooks/use-beyanname-yonetimi.ts` (YENİ)
**İşlem:**
- [ ] Mükellefleri ve beyanname türlerini paralel fetch et (`Promise.all`)
- [ ] Local state: `localAyarlar: Map<customerId, Record<string, DonemType>>`
- [ ] `originalAyarlar` ref ile dirty tracking (değişen mükellefleri tespit)
- [ ] `dirtyCount` useMemo — kaydedilmemiş değişiklik sayısı
- [ ] Filtre state: `searchTerm`, `sirketTipiFilter`, `activeCategory`
- [ ] Mükellef seçim state: `selectedCustomerIds: Set<string>`
- [ ] `filteredCustomers` useMemo — arama + şirket tipi filtresi
- [ ] `categoryTurleri` useMemo — aktif kategoriye göre beyanname türlerini filtrele
- [ ] `categories` useMemo — benzersiz kategori listesi (tab'lar için)
- [ ] `stats` useMemo — her beyanname türü için atanmış mükellef sayısı

**Aksiyonlar:**
```typescript
// Tekil hücre güncelleme
updateCell(customerId: string, beyannameKod: string, donem: DonemType | null)
// null = kaldır, DonemType = ata/güncelle

// Toplu atama (sütun başlığı)
bulkAssign(beyannameKod: string, donem: DonemType)
// Seçili mükelleflere bu beyanname türünü bu dönemle atar

// Toplu kaldırma
bulkRemove(beyannameKod: string)
// Seçili mükelleflerden bu beyanname türünü kaldırır

// Kaydet
saveChanges(): Promise<void>
// Dirty mükellefleri tespit edip PATCH /api/customers/beyanname-ayarlari gönder

// Seçim
toggleCustomer(customerId: string)
toggleAllCustomers()
```

**Fetch pattern:**
```typescript
const [customersRes, turleriRes] = await Promise.all([
  fetch("/api/customers/beyanname-ayarlari"),
  fetch("/api/beyanname-turleri"),
]);
```

---

### Task 5: Navigasyon + Mükellefler Toolbar Güncellemesi
**Dosyalar:**
- `src/components/dashboard/nav.tsx` (satır 57-61 değişecek)
- `src/app/(dashboard)/dashboard/mukellefler/client.tsx` (toolbar'a buton ekleme)

**nav.tsx değişikliği:**
- [ ] "Mükellefler" linkini children'lı yapıya dönüştür
- [ ] Alt menü: "Mükellef Listesi" + "Beyanname Türleri"

**client.tsx değişikliği:**
- [ ] `import Link from "next/link"` ekle
- [ ] `import { FileText } from "lucide-react"` ekle
- [ ] Toolbar'da "Mükellefleri Çek" butonunun yanına "Beyanname Türleri" Link butonu ekle

---

### ═══ CONTEXT RESET NOKTASI ═══

**Task 5 tamamlandıktan sonra:**
1. `/clear` komutunu çalıştır
2. Şu mesajı gönder:

```
2026-03-03-mukellef-beyanname-turu-yonetimi.md handoff'una göre Task 6'dan (Sayfa Oluşturma) devam et.

Tamamlanan Task'ler: 1-5 (Schema, Seed, API, Hook, Navigasyon)
Kalan Task'ler: 6-10 (Sayfa, Matrix, Hücreler, Bulk Bar, Test)

Task 5'e kadar yapılan işler:
- prisma/schema.prisma'ya beyannameAyarlari ve donemSecenekleri eklendi
- beyanname-turleri seed'i 23 türe güncellendi
- /api/customers/beyanname-ayarlari GET+PATCH endpoint oluşturuldu
- use-beyanname-yonetimi hook yazıldı
- nav.tsx ve client.tsx güncellendi
```

---

### ═══ BÖLÜM 2: Frontend Bileşenler (Task 6-10) ═══

---

### Task 6: Sayfa Oluşturma
**Dosyalar:**
- `src/app/(dashboard)/dashboard/mukellefler/beyannameler/page.tsx` (YENİ)
- `src/app/(dashboard)/dashboard/mukellefler/beyannameler/client.tsx` (YENİ)

**page.tsx:**
```tsx
import { BeyannameYonetimiClient } from "./client";

export default function BeyannameYonetimiPage() {
  return <BeyannameYonetimiClient />;
}
```

**client.tsx yapısı:**
- [ ] `"use client"` directive
- [ ] `useBeyannameYonetimi` hook'unu kullan
- [ ] Tam ekran layout: `h-[calc(100vh-64px)] -m-4 xl:-m-6`
- [ ] Toolbar: arama input, şirket tipi select, kaydet butonu
- [ ] `BeyannameCategoryTabs` bileşeni
- [ ] `BeyannameMatrix` bileşeni
- [ ] `BeyannameBulkBar` bileşeni (seçili mükellef varsa)
- [ ] Loading state: skeleton
- [ ] Kaydetme sonrası toast mesajı

---

### Task 7: Kategori Tab'ları + Matrix Tablo
**Dosyalar:**
- `src/components/beyanname-yonetimi/beyanname-category-tabs.tsx` (YENİ)
- `src/components/beyanname-yonetimi/beyanname-matrix.tsx` (YENİ)

**beyanname-category-tabs.tsx:**
- [ ] Prop: `categories: string[]`, `activeCategory: string`, `onCategoryChange`
- [ ] Her kategorinin altında o kategorideki tür sayısı badge
- [ ] Aktif tab vurgusu
- [ ] Scrollable tab bar (mobil için)

**beyanname-matrix.tsx:**
- [ ] Virtual scrolling (`useVirtualizer`, threshold: 100)
- [ ] `parentRef` ile scroll container
- [ ] `table-fixed` layout
- [ ] Sticky thead: `sticky top-0 bg-background z-10`
- [ ] Mükellef adı sütunu: `sticky left-0` (yatay scroll'da sabit)
- [ ] Her satırda: checkbox + mükellef adı + beyanname hücreleri
- [ ] Boş durum: "Bu kategoride henüz atama yapılmamış"
- [ ] Alt istatistik bar: her beyanname türü için X/Y mükellef atanmış

**Virtual scroll pattern (kontrol-table.tsx referans):**
```tsx
const VIRTUAL_THRESHOLD = 100;
const useVirtual = customers.length > VIRTUAL_THRESHOLD;
const rowVirtualizer = useVirtualizer({
  count: filteredCustomers.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 40,
  overscan: 10,
  enabled: useVirtual,
});
```

---

### Task 8: Başlık ve Veri Hücreleri
**Dosyalar:**
- `src/components/beyanname-yonetimi/beyanname-header-cell.tsx` (YENİ)
- `src/components/beyanname-yonetimi/beyanname-data-cell.tsx` (YENİ)

**beyanname-header-cell.tsx:**
- [ ] Prop: `beyannameTuru: BeyannameTuru`, `onBulkAssign`, `onBulkRemove`, `hasSelectedCustomers`
- [ ] Üst kısım: beyanname kısa adı (tooltip ile tam açıklama)
- [ ] Orta: dönem dropdown (sadece `donemSecenekleri`'ndeki seçenekler)
- [ ] Alt: "Ata" checkbox (seçili mükelleflere toplu atama)
- [ ] `donemSecenekleri.length === 1` ise dropdown yerine sabit text göster
- [ ] Dropdown seçilmeden "Ata" checkbox'ı disabled

**beyanname-data-cell.tsx:**
- [ ] Prop: `customerId`, `beyannameKod`, `currentDonem: DonemType | null`, `donemSecenekleri`, `onChange`
- [ ] `null` (atanmamış): "—" göster, tıklayınca dönem seçici aç
- [ ] `DonemType` (atanmış): dönem label göster, tıklayınca düzenle
- [ ] Dönem seçici: küçük select/dropdown, "Kaldır" seçeneği dahil
- [ ] Dirty state: değişen hücreler subtle arka plan rengi (örn. `bg-yellow-50`)
- [ ] Compact tasarım: hücre genişliği `min-w-[80px] max-w-[100px]`

**HATA ÖNLEMESİ:**
- Select/dropdown portal kullanmalı (virtual scroll container dışına taşmasın)
- `@radix-ui/react-select` veya `@radix-ui/react-popover` ile — bunlar portal destekliyor
- Her hücre `React.memo` ile sarılmalı (6900 hücre performansı için kritik)

---

### Task 9: Toplu İşlem Bar
**Dosya:** `src/components/beyanname-yonetimi/beyanname-bulk-bar.tsx` (YENİ)

- [ ] Seçili mükellef sayısı gösterimi
- [ ] Kaydedilmemiş değişiklik sayısı
- [ ] Animasyonlu giriş: `animate-in slide-in-from-bottom-5` (mevcut pattern)
- [ ] Seçili mükellef yokken gizli
- [ ] Pozisyon: `sticky bottom-0`

---

### Task 10: Test + Hata Düzeltme
- [ ] `npm run type-check` — TypeScript hataları kontrol
- [ ] `npm run lint` — ESLint hataları kontrol
- [ ] Tarayıcıda sayfa açılıyor mu?
- [ ] Beyanname türleri yükleniyor mu? (23 tür)
- [ ] Kategori tab'ları çalışıyor mu?
- [ ] Hücre tıklama + dönem seçimi çalışıyor mu?
- [ ] Toplu atama çalışıyor mu?
- [ ] Kaydet butonu çalışıyor mu?
- [ ] Virtual scroll çalışıyor mu? (100+ mükellef ile)
- [ ] Şirket tipi filtresi çalışıyor mu?
- [ ] Arama çalışıyor mu?
- [ ] `verilmeyecekBeyannameler` senkronize ediliyor mu?
- [ ] Tam ekran layout bozulmuyor mu?
- [ ] Navigasyon doğru çalışıyor mu?

---

## Teknik Referanslar

### Auth Pattern (kopyala-yapıştır):
```typescript
// src/app/api/customers/[id]/verilmeyecek/route.ts pattern'i
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const session = await auth();
if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const tenantId = (session.user as any).tenantId;
if (!tenantId) {
  return NextResponse.json({ error: "Tenant bulunamadı" }, { status: 400 });
}
```

### Mevcut UI Import Yolları:
```typescript
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
```

### Tam Ekran Layout Pattern (client.tsx referans):
```typescript
className="flex flex-col h-[calc(100vh-64px)] -m-4 xl:-m-6"
```

### Toast Pattern:
```typescript
import { toast } from "sonner";
toast.success("Beyanname ayarları kaydedildi");
toast.error("Kaydetme sırasında hata oluştu");
```

---

## Bağımlılıklar

Yeni npm paketi gerekmiyor. Tüm kullanılan paketler projede mevcut:
- `@tanstack/react-virtual` — virtual scrolling
- `@radix-ui/*` — UI bileşenleri
- `zod` — validation
- `sonner` — toast
- `lucide-react` — ikonlar

---

## Özet

| Metrik | Değer |
|--------|-------|
| Toplam task | 10 |
| Yeni dosya | 9 |
| Değişen dosya | 4 |
| Context reset | Task 5 sonrası |
| Tahmini yeni kod | ~1500-2000 satır |
| Yeni npm paket | 0 |
