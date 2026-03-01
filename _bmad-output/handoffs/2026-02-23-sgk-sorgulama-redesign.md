# Handoff: SGK E-Bildirge Sorgulama Sayfası — Beyanname Tasarımına Dönüştürme
**Tarih:** 2026-02-23 18:00
**Durum:** ✅ Tamamlandı (2026-02-23)

## Görev Tanımı
> SGK E-Bildirge Sorgulama sayfasının tasarımını birebir Beyanname Sorgulama sayfası ile aynı yapmak.
> Arşiv sayfası da dahil. HER DETAY BİREBİR AYNI OLACAK. Sadece Electron Bot farklı işlem yapıyor.

## Araştırma Bulguları

### Mevcut Durum Analizi

**Beyanname Sorgulama (HEDEF TASARIM):** `src/components/beyannameler/beyanname-client.tsx` (1433 satır)
- Layout: `h-full overflow-hidden gap-2` — tam yükseklik, scroll yok
- Başlık: `h-5 w-5` ikon, `text-xl font-bold`
- Filtre kartı: `p-3 shadow-sm`, inline flex layout (`flex items-end gap-2.5 flex-wrap`)
- Combobox: Özel trigger button (Button değil!), VKN gösterimi, "Sorgulandı/Sorgulanmamış/GİB Eksik" durumu
- Dönem seçiciler: Yan yana, `|` ayırıcı ile
- Butonlar: Filtrelerle aynı satırda (Sorgula, Toplu Sorgula, Arşiv)
- Sonuçlar: Accordion gruplu kart listesi (BeyannameGroupHeader + BeyannameRow)
- Yıl filtresi: YearFilterBar (çoklu yıl sorgusunda)
- Export: Excel + PDF butonları (allComplete sonrası)
- Boş durum: `flex-1 min-h-0` ile tam yükseklik dolduran centered card

**SGK Sorgulama (MEVCUT — DEĞİŞECEK):** `src/components/sgk-sorgulama/sgk-client.tsx` (566 satır)
- Layout: `gap-6 p-6` — klasik padding
- Başlık: `h-6 w-6 text-blue-600` ikon, `text-2xl font-bold`
- Filtre kartı: `p-4`, grid layout (`grid grid-cols-1 gap-4 md:grid-cols-6`)
- Combobox: Button variant trigger, basit gösterim
- Dönem seçiciler: Grid hücrelerde, ayrık label'larla
- Butonlar: Ayrı satırda, altta
- Sonuçlar: Geleneksel HTML tablo
- Boş durum: Basit centered text

### Fark Tablosu

| Özellik | Beyanname (Hedef) | SGK (Mevcut) |
|---------|-------------------|--------------|
| Ana wrapper | `h-full overflow-hidden gap-2` | `gap-6 p-6` |
| Başlık icon | `h-5 w-5 text-primary` | `h-6 w-6 text-blue-600` |
| Başlık font | `text-xl font-bold` | `text-2xl font-bold` |
| Filtre kartı | `p-3 shadow-sm` + inline flex | `p-4` + grid |
| Combobox trigger | Özel `<button>` + VKN + durum | `<Button variant="outline">` basit |
| Combobox dropdown genişlik | `minWidth: 620` | `w-[350px]` |
| Dönem select | Inline + `\|` ayırıcı | Grid hücrelerde |
| Butonlar | Filtrelerle aynı satır | Ayrı satır (`mt-4`) |
| Sonuç gösterimi | Accordion grup (SgkGroupHeader + SgkRow) | HTML `<table>` |
| Yıl filtresi | YearFilterBar + YearSectionHeader | Yok |
| Export | Excel + PDF butonları | Yok |
| Boş durum | `flex-1 min-h-0` centered card | Basit `p-8` centered |
| PDF dialog | `BeyannamePdfDialog` (ayrı component) | Inline `<Dialog>` |

### Data Model Mapping

```
Beyanname                    →  SGK
─────────────────────────    ─────────────────────────
BeyannameItem                →  SgkDisplayItem (türetilmiş)
  turKodu                    →  pdfType ('tahakkuk' | 'hizmet_listesi')
  turAdi                     →  groupName ('MUHSGK Tahakkuk' | 'Hizmet Listesi')
  donem ("202601")           →  donem ("2026/01")
  aciklama                   →  belgeMahiyeti ("ASIL" | "EK")
  beyoid                     →  compositeKey ("refNo_pdfType")
  savedBeyoids               →  savedRefs

BeyannameGroup               →  SgkPdfGroup
  turKodu                    →  groupKey
  turAdi                     →  groupName
  items: BeyannameItem[]     →  items: SgkDisplayItem[]
  savedCount                 →  savedCount
  totalCount                 →  totalCount
```

**Dönüşüm:** Her `BildirgeItem` → 2 adet `SgkDisplayItem` (Tahakkuk + Hizmet Listesi)

### Hook Arayüzü (Değişmeyecek)

`src/components/sgk-sorgulama/hooks/use-sgk-query.ts` — mevcut hook aynen kalacak:
- `bildirgeler: BildirgeItem[]` — sorgu sonuçları
- `isyeriInfo: IsyeriInfo | null` — işyeri bilgileri
- `isLoading, queryDone, allComplete` — durum
- `progress, error, errorCode` — ilerleme/hata
- `downloadProgress` — PDF indirme ilerlemesi
- `savedRefs: string[]` — kaydedilmiş compositeKey'ler
- `pdfCache: Record<string, string>` — blob URL cache
- `pdfDialogOpen, pdfDialogUrl, pdfDialogTitle` — PDF dialog
- `startQuery(), clearResults(), viewPdf(), closePdfDialog()` — aksiyonlar

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `src/components/sgk-sorgulama/sgk-client.tsx` | **TAM YENİDEN YAZIM** | Beyanname tasarımına dönüştür |
| `src/components/sgk-sorgulama/sgk-pdf-dialog.tsx` | **Yeni dosya** ✅ ZATEN OLUŞTURULDU | BeyannamePdfDialog'un blob URL versiyonu |
| `src/app/(dashboard)/dashboard/sgk-sorgulama/arsiv/page.tsx` | **Yeni dosya** | Arşiv sayfa route'u |
| `src/components/sgk-sorgulama/sgk-arsiv-client.tsx` | **Yeni dosya** | beyanname-arsiv-client.tsx'in SGK versiyonu |

## Uygulama Planı

### Adım 1: sgk-client.tsx — Tam Yeniden Yazım (ANA İŞ)
- [x] sgk-pdf-dialog.tsx zaten oluşturuldu (BeyannamePdfDialog ile birebir aynı stil)
- [ ] sgk-client.tsx dosyasını oku (güncel hali)
- [ ] Beyanname-client.tsx'deki layout skeleton'ı kopyala
- [ ] SGK verisine adapte et:

**1.1 Ana Wrapper:**
```tsx
<div className="flex flex-col h-full overflow-hidden gap-2">
```

**1.2 Başlık:**
```tsx
<div className="flex items-center gap-2">
  <Building2 className="h-5 w-5 text-primary" />
  <h1 className="text-xl font-bold">SGK E-Bildirge Sorgulama</h1>
</div>
```

**1.3 Filtre Kartı:**
- `rounded-lg border bg-card p-3 shadow-sm`
- `flex items-end gap-2.5 flex-wrap` (grid DEĞİL!)
- Combobox: Özel trigger (Button DEĞİL!), `minWidth: 620`, VKN gösterimi, SGK durum
- Dönem: Inline flex + `|` ayırıcı
- Butonlar: Sorgula + Arşiv (aynı satırda)
- Export: `allComplete` sonrası Excel + PDF + Temizle

**1.4 Sonuç Grupları — Yeni Types:**
```typescript
interface SgkDisplayItem {
  compositeKey: string;   // `${bildirgeRefNo}_${pdfType}`
  donem: string;          // hizmetDonem "2026/01"
  donemYear: string;      // "2026"
  pdfType: "tahakkuk" | "hizmet_listesi";
  belgeTuru: string;
  belgeMahiyeti: string;
  kanunNo: string;
  calisanSayisi: string;
  gunSayisi: string;
  pekTutar: string;
  bildirgeRefNo: string;
}

interface SgkPdfGroup {
  groupKey: string;       // 'tahakkuk' | 'hizmet_listesi'
  groupName: string;      // 'MUHSGK Tahakkuk' | 'Hizmet Listesi'
  items: SgkDisplayItem[];
  savedCount: number;
  totalCount: number;
}
```

**1.5 Dönüşüm:** `transformToDisplayItems(bildirgeler) → SgkDisplayItem[]`
- Her BildirgeItem → 2 SgkDisplayItem (tahakkuk + hizmet_listesi)

**1.6 Gruplama:**
- Grup 1: "MUHSGK Tahakkuk" (groupKey: "tahakkuk", kısa: "T")
- Grup 2: "Hizmet Listesi" (groupKey: "hizmet_listesi", kısa: "H")
- Yıl bazlı: extractYear("2026/01") → "2026"

**1.7 Alt Bileşenler (beyanname ile birebir aynı stil):**
- `SgkRow` → BeyannameRow ile aynı. Dönem + belgeMahiyeti badge + Eye ikonu
- `SgkGroupHeader` → BeyannameGroupHeader ile aynı. Chevron + kısa kod + ad + progress bar
- `SgkGroupList` → BeyannameGroupList ile aynı. Accordion expand/collapse
- `YearFilterBar` → Aynı. Yıl butonları
- `YearSectionHeader` → Aynı. Yıl ayırıcı çizgi

**1.8 İşyeri Bilgileri — Kompakt bar:**
```tsx
{query.isyeriInfo && (
  <div className="flex items-center gap-4 rounded-lg border bg-slate-50 dark:bg-zinc-900/50 px-3 py-2 text-sm">
    Sicil: ... | Ünvan: ... | Prim: %...
  </div>
)}
```

**1.9 PDF Dialog:** `<SgkPdfDialog>` kullan (zaten oluşturuldu)

**1.10 Dönem Formatları:**
- `formatDonemTurkce("2026/01")` → `"01/2026"`
- `extractYear("2026/01")` → `"2026"`
- `getDefaultPeriod()` → bir önceki ay (beyanname kuralı)

### Adım 2: SGK Arşiv Sayfası
- [ ] `src/app/(dashboard)/dashboard/sgk-sorgulama/arsiv/page.tsx` oluştur
- [ ] `src/components/sgk-sorgulama/sgk-arsiv-client.tsx` oluştur
- [ ] beyanname-arsiv-client.tsx'i kopyala, SGK'ya adapte et
- [ ] Arşiv verisi: `documents` tablosundan `fileCategory IN ('SGK_TAHAKKUK', 'HIZMET_LISTESI')` ile çek
- [ ] API endpoint gerekebilir: `/api/sgk/arsiv` veya mevcut query-archives'a SGK desteği ekle

### Adım 3: Doğrulama
- [ ] `npm run type-check` — TypeScript hataları yok
- [ ] `npm run dev` — sayfa açılıyor
- [ ] Mükellef seçimi çalışıyor
- [ ] Dönem seçimi çalışıyor
- [ ] Sorgulama çalışıyor (WebSocket)
- [ ] Sonuçlar accordion gruplarla gösteriliyor
- [ ] PDF görüntüleme çalışıyor
- [ ] Export çalışıyor

## Teknik Notlar

### sgk-pdf-dialog.tsx — ZATEN OLUŞTURULDU
- Lokasyon: `src/components/sgk-sorgulama/sgk-pdf-dialog.tsx`
- BeyannamePdfDialog ile birebir aynı stil
- Blob URL ile çalışır (signed URL fetch yok)
- Props: `open, onOpenChange, blobUrl, title, customerName`

### Hook Değişiklik Gerekmez
- `use-sgk-query.ts` aynen kalacak
- Hook zaten `savedRefs`, `pdfCache`, `pdfDialogOpen/Url/Title` döndürüyor
- Tüm WebSocket event handling mevcut ve çalışıyor

### Customer API
- SGK: `/api/customers` (full) → `sgkSistemSifresi` kontrolü ile `hasSgkCredentials`
- Beyanname: `/api/customers?fields=minimal` → `hasGibCredentials` zaten döner
- SGK için full endpoint kullanılıyor çünkü `fields=minimal` SGK credential bilgisi dönmüyor

### Dönem Farkı
- Beyanname dönem: `"202601"` (YYYYMM) veya `"202601202612"` (range)
- SGK dönem: `"2026/01"` (YYYY/MM)
- Format fonksiyonları farklı: `formatDonemTurkce()` SGK'ya özel yazılacak

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Her BildirgeItem → 2 SgkDisplayItem | Tahakkuk ve Hizmet Listesi ayrı PDF'ler, ayrı satırlarda gösterilmeli | Tek satırda 2 buton (mevcut) — reddedildi, beyanname ile uyumsuz |
| Tablo yerine accordion | Kullanıcı "birebir aynı" istedi, beyanname accordion kullanıyor | Tablo kalabilirdi — reddedildi |
| SgkPdfDialog ayrı component | BeyannamePdfDialog yeniden kullanılamaz (beyoid/signed URL'e bağlı) | Inline dialog — reddedildi, tutarsız görünüm |
| Full customer API | SGK credential bilgisi `fields=minimal`'de yok | Minimal endpoint'e SGK eklenebilir — ileride |
| Arşiv sayfası ayrı adım | Scope büyük, önce sorgulama sayfası tamamlansın | Hepsi birden — riskli |
