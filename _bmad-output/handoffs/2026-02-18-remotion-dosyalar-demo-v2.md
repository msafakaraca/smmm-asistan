# Handoff: Remotion Dosyalar Demo Videosu v2
**Tarih:** 2026-02-18 16:30
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor

## Görev Tanımı
> Mevcut Remotion demo videosunu kullanıcının paylaştığı gerçek Dosyalar sayfası screenshot'larına birebir uygun olacak şekilde tamamen yeniden yaz. 16 sahnelik genişletilmiş senaryo ile 36 saniyelik video üret.

---

## Proje Bilgileri
- **Proje dizini:** `C:\Users\msafa\Desktop\remotion-demo`
- **Ana dosya:** `src/DosyalarDemo.tsx` (tamamen yeniden yazılacak)
- **Mevcut paketler:** remotion 4.0.424, react 19, typescript 5.9, xlsx
- **Render komutu:** `npx remotion render DosyalarDemo out/dosyalar-demo.mp4`

---

## Gerçek UI Analizi (Screenshot'lardan)

### Screenshot 1 - Mükellefler Listesi
- **Header:** Sol: "İsmet Karaca" (kullanıcı adı). Sağ: Kırmızı "Bağlı Değil" badge + güneş/ay tema ikonu + "İK" avatar (yuvarlak)
- **Toolbar:** Tek satır. Sol: [← → ↑] nav butonları bir rounded-lg container içinde | breadcrumb: 🏠 Mükellefler. Orta-sağ: Arama "Ara..." input. Sağ: "Yeni Klasör" outline buton + "Filtrele" outline buton + "Yenile" outline buton
- **Tablo başlıkları:** Ad | Şirket Türü | Değiştirme tarihi | Tür | Boyut (5 kolon!)
- **Satırlar:** Sarı klasör ikonu + mükellef adı | yeşil "Şahıs" veya mavi "Firma" rounded-full gradient badge | DD.MM.YYYY HH:mm | "Dosya klasörü" | (boş)
- **Footer:** "60 öğe"

### Screenshot 2 - Cemile Özer Klasörleri
- **Breadcrumb:** 🏠 Mükellefler > Cemile Özer
- **Klasörler:** Banka Evrakları, Beyannameler, SGK Tahakkuk ve Hizmet Listesi, Tahakkuklar
- **Badge:** Hepsi "Şahıs" (yeşil gradient)
- **Footer:** "4 öğe"

### Screenshot 3 - Beyannameler Alt Klasörleri
- **Breadcrumb:** 🏠 Mükellefler > Cemile Özer > Beyannameler
- **Klasörler:** GELİR, GGEÇİCİ, KDV1, MUHSGK, POSET
- **Badge:** Hepsi "Şahıs"
- **Footer:** "5 öğe"

---

## Gerçek Component Yapısı (Kaynak Koddan)

### Toolbar (dosyalar-toolbar.tsx)
```
Container: flex items-center gap-2 p-2 border-b bg-background
├── [Nav+Breadcrumb: flex items-center flex-1 border border-border rounded-lg overflow-hidden]
│   ├── [Nav: flex items-center gap-1 px-1 border-r border-border]
│   │   ├── ← buton (solar:alt-arrow-left-bold, h-8 w-8, ghost)
│   │   ├── → buton (solar:alt-arrow-right-bold, h-8 w-8, ghost)
│   │   └── ↑ buton (solar:alt-arrow-up-bold, h-8 w-8, ghost)
│   └── [Breadcrumbs: flex items-center gap-1 text-sm px-3 py-1.5]
│       ├── Home ikonu (solar:home-bold h-4 w-4) + "Mükellefler"
│       ├── Separator (solar:alt-arrow-right-linear h-3 w-3)
│       └── Crumb text (max-w-[150px] truncate)
├── [Search: relative w-64]
│   ├── Magnifer ikonu (solar:magnifer-bold, left-2.5)
│   └── Input (placeholder="Ara...", pl-8 h-9)
├── [Yeni Klasör: variant=outline size=sm]
│   └── solar:folder-add-bold + "Yeni Klasör"
├── [Filtrele: variant=outline size=sm]
│   └── solar:filter-bold + "Filtrele"
└── [Yenile: variant=outline size=sm]
    └── solar:refresh-bold + "Yenile"
```

### Tablo Başlıkları (5 kolon)
| Kolon | Genişlik | Hizalama |
|-------|----------|----------|
| Ad | flex-1 (min 200px) | Sol |
| Şirket Türü | 140px | Sol |
| Değiştirme tarihi | 160px | Sol |
| Tür | 120px | Sol |
| Boyut | 100px | Sağ |
- Stil: h-9 border-b text-xs font-medium text-muted-foreground uppercase

### Dosya Satırı (dosyalar-file-row.tsx)
- **Klasör ikonu:** solar:folder-bold h-5 w-5 text-yellow-500
- **PDF ikonu:** solar:document-text-bold h-5 w-5 text-red-500
- **İsim:** truncate text-sm font-medium
- **Badge stilleri (rounded-full, gradient):**
  - Firma: `linear-gradient(to right, #6366F1, #2563EB)` + white text
  - Şahıs: `linear-gradient(to right, #10B981, #0D9488)` + white text
  - Basit Usul: `linear-gradient(to right, #FB923C, #F59E0B)` + white text
  - Ölçü: text-xs px-2.5 py-0.5 font-semibold shadow-sm
- **Tarih:** DD.MM.YYYY HH:mm, text-xs text-muted-foreground
- **Tür:** "Dosya klasörü" veya "PDF Belgesi", text-xs
- **Boyut:** Klasörlerde boş, dosyalarda "245 KB" gibi, text-xs sağ hizalı
- **Hover:** bg-muted/80 (açık gri)
- **Seçili:** bg-blue-500/15

### Footer (dosyalar-footer.tsx)
- Container: h-12 px-3 border-t bg-background
- Sol: "{N} öğe" text-sm + seçim varsa "| {N} öğe seçili"

### Yeni Klasör Dialog (folder-dialog.tsx)
- Başlık: "Yeni Klasör Oluştur"
- Input: placeholder="Klasör Adı", autoFocus, border-2 primary focus
- Butonlar: "İptal" (outline) + "Oluştur" (primary indigo)

### Boş Klasör (Empty State)
- Upload ikonu (solar:upload-bold h-16 w-16 text-muted/50)
- "Buraya dosya yüklemek için tıklayın" (text-lg font-medium)
- "veya dosyaları sürükleyin" (text-sm)

---

## Renk Paleti

```typescript
const C = {
  // Arkaplan
  bg: "#FAFAFA",         // genel arkaplan (gri)
  card: "#FFFFFF",       // pencere arkaplanı
  toolbar: "#FAFAFA",    // toolbar arkaplanı
  muted: "#F4F4F5",      // zinc-100
  mutedHover: "rgba(0,0,0,0.04)", // hover arkaplan

  // Kenarlar
  border: "#E4E4E7",     // zinc-200

  // Metinler
  text: "#09090B",       // zinc-950
  textMuted: "#71717A",  // zinc-500
  textLight: "#A1A1AA",  // zinc-400

  // İkonlar
  yellowFolder: "#EAB308",  // yellow-500
  redPdf: "#EF4444",        // red-500

  // Badge gradient uçları
  firmaFrom: "#6366F1",   firmaTo: "#2563EB",
  sahisFrom: "#10B981",   sahisTo: "#0D9488",
  basitFrom: "#FB923C",   basitTo: "#F59E0B",

  // Seçim
  selected: "rgba(59,130,246,0.15)",

  // Primary
  primary: "#4F46E5",
  primaryFg: "#FFFFFF",

  // Header
  disconnectedBg: "#FEE2E2",
  disconnectedText: "#DC2626",

  // Cursor
  cursor: "#09090B",
};
```

---

## Teknik Özellikler

| Özellik | Eski | Yeni |
|---------|------|------|
| Çözünürlük | 960x640 | **1280x720** |
| FPS | 30 | 30 |
| Toplam frame | 600 (20sn) | **1080 (36sn)** |
| Tablo kolonu | 4 | **5** |
| Sahne sayısı | ~10 | **16** |

---

## Sahne Zaman Çizelgesi (Frame Bazlı, 30fps, Toplam 1080)

### Sahne 1: Açılış - Mükellefler Listesi (Frame 0–90, 3sn)
- Frame 0-30: Pencere fade-in + üst başlık "SMMM Asistan — Dosya Yönetimi"
- Frame 30-90: Mükellefler listesi tamamen görünür
- **Header:** "İsmet Karaca" sol, kırmızı "Bağlı Değil" badge + tema ikonu + "İK" avatar sağ
- **Breadcrumb:** 🏠 Mükellefler
- **Liste:** ~10 mükellef satırı (random isimler, Firma/Şahıs karışık)
- **Footer:** "60 öğe"

### Sahne 2: Mükellef Seçimi (Frame 90–150, 2sn)
- Frame 90-120: Cursor ortadan "Cemile Özer" satırına hareket
- Frame 120-135: Hover efekti (bg-muted/80)
- Frame 135-140: Tek tıklama → seçim (bg-blue-500/15)
- Frame 140-150: Çift tıklama efekti (mavi halka)

### Sahne 3: Mükellef Klasörleri (Frame 150–240, 3sn)
- Frame 150-165: Sahne geçiş fade
- **Breadcrumb:** 🏠 Mükellefler > Cemile Özer
- **Klasörler:** Banka Evrakları, Beyannameler, SGK Tahakkuk ve Hizmet Listesi, Tahakkuklar (hepsi "Şahıs" badge)
- **Footer:** "4 öğe"
- Frame 180-210: Cursor Beyannameler'e hareket
- Frame 210-225: Hover
- Frame 225-240: Seçim + çift tıklama

### Sahne 4: Beyanname Alt Klasörleri (Frame 240–330, 3sn)
- Frame 240-255: Sahne geçişi
- **Breadcrumb:** 🏠 Mükellefler > Cemile Özer > Beyannameler
- **Klasörler:** GELİR, GGEÇİCİ, KDV1, MUHSGK, POSET (hepsi "Şahıs" badge)
- **Footer:** "5 öğe"
- Frame 270-300: Cursor KDV1'e hareket
- Frame 300-315: Hover + seçim
- Frame 315-330: Çift tıklama

### Sahne 5: KDV1 PDF Listesi (Frame 330–420, 3sn)
- Frame 330-345: Sahne geçişi
- **Breadcrumb:** 🏠 … > Cemile Özer > Beyannameler > KDV1
- **12 PDF dosyası:** `[randomTC]_KDV1_2025_01_Beyanname.pdf` → `_2025_12_Beyanname.pdf`
- Tür: "PDF Belgesi", Boyut: 150-350 KB arası
- Badge YOK (PDF satırlarında badge gösterilmez)
- **Footer:** "12 öğe"
- Frame 360-390: Cursor ilk PDF'e hareket
- Frame 390-405: Hover + seçim
- Frame 405-420: Çift tıklama

### Sahne 6: PDF Viewer Açılır (Frame 420–510, 3sn)
- Frame 420-440: Overlay fade-in (backdrop rgba(0,0,0,0.4) + beyaz modal)
- Modal: rounded-12, width %80, height %75
- Header: PDF ikonu + dosya adı + × kapatma butonu
- İçerik: Gri bg (#F1F1F1) + beyaz kağıt mock: "KDV Beyannamesi" başlık + "Ocak 2025 Dönemi" alt başlık + placeholder satırlar

### Sahne 7: PDF Kapanış (Frame 510–540, 1sn)
- Frame 510-530: Overlay fade-out
- KDV1 PDF listesi tekrar görünür (kısa)

### Sahne 8: Mükellef Klasörlerine Dönüş (Frame 540–600, 2sn)
- Frame 540-555: Sahne geçişi (yukarı navigasyon)
- **Breadcrumb:** 🏠 Mükellefler > Cemile Özer
- 4 klasör tekrar: Banka Evrakları, Beyannameler, SGK Tahakkuk ve Hizmet Listesi, Tahakkuklar
- **Footer:** "4 öğe"

### Sahne 9: Yeni Klasör Butonu (Frame 600–660, 2sn)
- Frame 600-630: Cursor toolbar'daki "Yeni Klasör" butonuna hareket
- Frame 630-645: Buton hover efekti
- Frame 645-660: Tıklama

### Sahne 10: Dialog Açılır (Frame 660–720, 2sn)
- Frame 660-675: Dialog fade-in (backdrop + modal)
- Başlık: "Yeni Klasör Oluştur"
- Input: boş, 2px primary border
- Butonlar: "İptal" (outline) + "Oluştur" (primary)
- Frame 680-710: Cursor input alanına hareket

### Sahne 11: Typing Animasyonu (Frame 720–810, 3sn)
- "Yeni Şube Evraklar" harf harf yazılır (19 karakter, ~4.7 frame/harf)
- Yanıp sönen cursor (2px dikey çubuk)

### Sahne 12: Oluştur Tıklama (Frame 810–855, 1.5sn)
- Frame 810-830: Cursor "Oluştur" butonuna hareket
- Frame 830-840: Tıklama efekti
- Frame 840-855: Dialog fade-out

### Sahne 13: Yeni Klasör Belirir (Frame 855–900, 1.5sn)
- Mükellef klasörleri sahnesi + "Yeni Şube Evraklar" klasörü Tahakkuklar'ın altına fade-in
- **Footer:** "5 öğe"

### Sahne 14: Yeni Klasöre Giriş (Frame 900–960, 2sn)
- Frame 900-920: Cursor "Yeni Şube Evraklar"a hareket
- Frame 920-935: Hover + seçim
- Frame 935-945: Çift tıklama
- Frame 945-960: Sahne geçişi

### Sahne 15: Boş Klasör + Upload (Frame 960–1035, 2.5sn)
- **Breadcrumb:** 🏠 … > Cemile Özer > Yeni Şube Evraklar
- Boş klasör: Upload ikonu + "Buraya dosya yüklemek için tıklayın" + "veya dosyaları sürükleyin"
- **Footer:** "0 öğe"
- Frame 970: Upload progress widget belirir (sağ alt köşe)
- Dosya: "Yeni_Şube_SGK_İşyeri_Tescil.pdf"
- Frame 970-1020: Progress %0→%100
- Frame 1020-1035: Widget kaybolur, dosya listede görünür
- **Footer:** "1 öğe"

### Sahne 16: Bitiş (Frame 1035–1080, 1.5sn)
- Frame 1050-1080: "Mükelleflerin dosyalarını güvenle yönetin" fade-in

---

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `src/Root.tsx` | Düzenleme | 1280x720, 1080 frame |
| `src/DosyalarDemo.tsx` | Tamamen yeniden yaz | Ana composition, tüm sahneler |
| `src/components/icons.tsx` | Yeni dosya | Solar SVG ikonlar (~15 ikon) |
| `src/components/cursor.tsx` | Yeni dosya | Mouse cursor + tıklama efekti |
| `src/components/header.tsx` | Yeni dosya | Üst header bar |
| `src/components/toolbar.tsx` | Yeni dosya | Nav + breadcrumb + arama + butonlar |
| `src/components/table-header.tsx` | Yeni dosya | 5 kolonlu tablo başlıkları |
| `src/components/file-row.tsx` | Yeni dosya | Satır: ikon + isim + badge + tarih + tür + boyut |
| `src/components/footer.tsx` | Yeni dosya | Alt bilgi çubuğu |
| `src/components/pdf-viewer.tsx` | Yeni dosya | PDF önizleme overlay |
| `src/components/new-folder-dialog.tsx` | Yeni dosya | Dialog + typing input |
| `src/components/upload-progress.tsx` | Yeni dosya | Progress widget |
| `src/components/empty-state.tsx` | Yeni dosya | Boş klasör görünümü |
| `src/data/mock-data.ts` | Yeni dosya | Tüm sahne verileri |
| `src/utils/animation.ts` | Yeni dosya | Ease, interpolasyon yardımcıları |
| `src/utils/cursor-path.ts` | Yeni dosya | Cursor keyframe ve tıklama frame'leri |

---

## Uygulama Planı

### Adım 1: Proje yapısı hazırla
- [ ] `src/components/` dizini oluştur
- [ ] `src/data/` dizini oluştur
- [ ] `src/utils/` dizini oluştur

### Adım 2: Veri ve yardımcı dosyaları yaz
- [ ] `src/data/mock-data.ts` — Mükellef isimleri, klasörler, PDF'ler, random TC
- [ ] `src/utils/animation.ts` — ease(), sahne geçiş opacity hesaplama
- [ ] `src/utils/cursor-path.ts` — 16 sahne için tüm cursor keyframe'leri + tıklama frame'leri

### Adım 3: SVG ikonları oluştur
- [ ] `src/components/icons.tsx` — FolderBold, DocumentTextBold, AltArrowLeftBold, AltArrowRightBold, AltArrowUpBold, HomeBold, AltArrowRightLinear, MagniferBold, FolderAddBold, FilterBold, RefreshBold, UploadBold, CloseBold, SunBold, WifiOffBold

### Adım 4: UI component'leri yaz
- [ ] `src/components/cursor.tsx`
- [ ] `src/components/header.tsx`
- [ ] `src/components/toolbar.tsx` (EN KRİTİK — gerçek UI ile birebir)
- [ ] `src/components/table-header.tsx`
- [ ] `src/components/file-row.tsx` (gradient badge'ler dahil)
- [ ] `src/components/footer.tsx`

### Adım 5: Overlay component'leri yaz
- [ ] `src/components/pdf-viewer.tsx`
- [ ] `src/components/new-folder-dialog.tsx`
- [ ] `src/components/upload-progress.tsx`
- [ ] `src/components/empty-state.tsx`

### Adım 6: Ana composition'ı yaz
- [ ] `src/DosyalarDemo.tsx` — Tamamen yeniden yaz: 16 sahne, cursor, overlay'ler, sahne geçişleri

### Adım 7: Root güncelle ve test et
- [ ] `src/Root.tsx` — 1280x720, 1080 frame
- [ ] TypeScript derleme testi (`npx tsc --noEmit`)
- [ ] Test render (`npx remotion render DosyalarDemo --frames=0-5 out/test.mp4`)
- [ ] Tam render (`npx remotion render DosyalarDemo out/dosyalar-demo.mp4`)

---

## Teknik Notlar

1. **Font:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` — Remotion'da system font stack yeterli
2. **CSS Gradient Badge:** Inline `background: "linear-gradient(to right, #6366F1, #2563EB)"` Remotion'da çalışır
3. **Sahne geçişleri:** Her geçişte 15 frame (0.5sn) içinde opacity 1→0.3→1 interpolasyonu
4. **Typing:** "Yeni Şube Evraklar" = 19 karakter, Frame 720-810 (90 frame), ~4.7 frame/karakter
5. **Upload progress:** Frame 970-1020 (50 frame), interpolate ile %0→%100
6. **Badge kuralı:** Mükellef listesi + mükellef alt klasörlerinde badge GÖRÜNür. PDF dosya satırlarında badge GÖSTERILMEZ
7. **Random TC:** `Math.floor(10000000000 + Math.random() * 89999999999)` ile 11 haneli üretilir
8. **Mükellef isimleri (random örnekler):** Ayşe Selçuk, Mehmet Yılmaz, Fatma Karaca, Cabadan İnşaat Ltd. Şti., XYZ Holding A.Ş. vb.
9. **POSET klasörü:** Screenshot'ta POSET var, onu da ekle
10. **Pencere boyutu:** 1200x650 (1280x720 canvas içinde ortalanmış, etrafında gri boşluk)

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Modüler dosya yapısı | Bakım kolaylığı, tek dosya ~1000+ satır olur | Tek dosya (mevcut, karmaşık) |
| 1280x720 çözünürlük | HD kalite, YouTube uyumlu | 960x640 (düşük), 1920x1080 (gereksiz büyük) |
| 36 saniye süre | 16 sahne için yeterli tempo | 20sn (çok hızlı), 45sn (çok yavaş) |
| SVG inline ikonlar | npm paketi Remotion'da import edilemez | Icon font (karmaşık), PNG (bulanık) |
| System font stack | Paket kurmaya gerek yok | @remotion/google-fonts (ek bağımlılık) |
