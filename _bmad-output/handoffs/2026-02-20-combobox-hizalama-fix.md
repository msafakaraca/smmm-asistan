# Handoff: Combobox Hizalama ve Layout Düzeltmesi
**Tarih:** 2026-02-20 15:30
**Durum:** Tamamlandı

## Görev Tanımı
> Beyanname arşiv ve sorgulama sayfalarındaki combobox dropdown'unda VKN, sorgulama durumu ve tarih bilgileri kaymış, hizasız görünüyor. Mükellef seçim alanı daha geniş olacak. Dropdown item'ları simetrik, hizalı ve düzgün kolonlu olacak.

## Sorun Analizi (Screenshot'tan)

### Görünen Sorunlar:
1. **Tüm bilgiler tek flex satırda sıkışık** — firma adı, VKN, "Sorgulandı" etiketi ve tarih aynı satırda `gap-2` ile akıyor, hizalanmıyor
2. **VKN kırmızı renkleri okunamıyor** — Dark mode'da `text-rose-600` çok koyu
3. **"Sorgulandı" ve tarih alanı sabit genişlik yok** — farklı uzunluktaki firma adları her satırda farklı konuma itiyor
4. **Mükellef trigger alanı `max-w-[400px]`** — kullanıcı daha geniş istiyor
5. **PopoverContent `minWidth: 500`** — yeterli değil, 3 kolon düzgün sığmıyor

### Kök Neden:
Mevcut layout `flex items-center gap-2` ile tüm elementler inline akıyor. Sabit kolon genişlikleri yok, bu yüzden firma adı uzunluğuna göre VKN ve durum kayıyor. **CSS Grid** veya **sabit genişlikli flex bölümleri** gerekli.

## Mevcut Kod Yapısı

### Arşiv Sayfası — beyanname-arsiv-client.tsx
- **Satır 730:** Trigger container: `min-w-[220px] max-w-[400px]`
- **Satır 758:** PopoverContent: `minWidth: 500`
- **Satır 782-813:** Item layout — `flex w-full items-center gap-2`
  - Check icon (shrink-0)
  - Firma adı (`truncate flex-1`)
  - VKN (`shrink-0 border-x`)
  - Durum span (`shrink-0 flex items-center gap-1.5`)

### Sorgulama Sayfası — beyanname-client.tsx
- **Satır 976:** Trigger: full width (iyi)
- **Satır 1002:** PopoverContent: `minWidth: 500`
- **Satır 1026-1060:** Aynı item layout + GİB eksik label

## Uygulama Planı

### Adım 1: Arşiv Sayfası Layout Fix (beyanname-arsiv-client.tsx)

#### 1a. Trigger genişliği artır
- **Satır 730:** `max-w-[400px]` → `max-w-[550px]` olacak

#### 1b. PopoverContent genişliği artır
- **Satır 758:** `minWidth: 500` → `minWidth: 600` olacak

#### 1c. Item layout'u CSS Grid ile yeniden tasarla
- **Satır 782-813:** Tüm button içeriği değişecek
- Yeni yapı: `grid grid-cols-[16px_1fr_120px_180px]` (4 kolonlu grid)
  - Kolon 1: Check icon (16px sabit)
  - Kolon 2: Firma adı (1fr — kalan alan, truncate)
  - Kolon 3: VKN (120px sabit — 10 haneli VKN + padding sığar)
  - Kolon 4: Durum + Tarih (180px sabit)

Yeni item JSX:
```tsx
<button
  key={c.id}
  type="button"
  className="grid grid-cols-[16px_1fr_120px_180px] w-full items-center gap-x-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
  onClick={() => {
    setSelectedCustomerId(c.id);
    setCustomerSearch("");
    setComboboxOpen(false);
  }}
>
  {/* Kolon 1: Check */}
  <Check
    className={`h-4 w-4 ${
      selectedCustomerId === c.id ? "opacity-100" : "opacity-0"
    }`}
  />
  {/* Kolon 2: Firma Adı */}
  <span className="truncate text-sm">{c.kisaltma || c.unvan}</span>
  {/* Kolon 3: VKN */}
  <span className="text-xs font-mono text-rose-500 dark:text-rose-400 text-right">
    {c.vknTckn}
  </span>
  {/* Kolon 4: Durum + Tarih */}
  <span className="flex items-center gap-1.5 justify-end">
    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.lastBeyannameQueryAt ? "bg-emerald-500 dark:bg-emerald-400" : "bg-slate-300 dark:bg-zinc-600"}`} />
    <span className={`text-[11px] whitespace-nowrap ${c.lastBeyannameQueryAt ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
      {c.lastBeyannameQueryAt ? "Sorgulandı" : "Sorgulanmamış"}
    </span>
    {queryDate && (
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{queryDate}</span>
    )}
  </span>
</button>
```

### Adım 2: Sorgulama Sayfası Layout Fix (beyanname-client.tsx)

#### 2a. PopoverContent genişliği artır
- **Satır 1002:** `minWidth: 500` → `minWidth: 600` olacak

#### 2b. Item layout'u CSS Grid ile yeniden tasarla
- **Satır 1026-1060:** Aynı grid yapısı, ama 5 kolonlu (GİB eksik için ek kolon):
  - `grid grid-cols-[16px_1fr_120px_70px_180px]`
  - Kolon 4: GİB durumu (70px — "GİB eksik" veya boş)
  - Kolon 5: Sorgulama durumu + tarih (180px)

Alternatif: GİB eksik label'i firma adının yanına, durum kolonunun soluna yerleştirilebilir — 4 kolonlu tutmak daha simetrik.

Tercih: **4 kolon tut**, GİB eksik uyarısını durum kolonunda (Kolon 4) göster, sorgulama durumunun önüne yerleştir:
```tsx
<span className="flex items-center gap-1.5 justify-end">
  {!c.hasGibCredentials && (
    <span className="text-[10px] text-destructive font-medium whitespace-nowrap">GİB eksik</span>
  )}
  <span className="h-1.5 w-1.5 rounded-full shrink-0 ..." />
  <span className="text-[11px] ...">Sorgulandı/Sorgulanmamış</span>
  {queryDate && <span>...</span>}
</span>
```

### Adım 3: Renk İyileştirmeleri (Her İki Dosya)
- VKN: `text-rose-600` → `text-rose-500` (dark mode'da daha okunur)
- Sorgulandı text: `text-emerald-700` → `text-emerald-600` (dark mode'da daha okunur)
- VKN'den `border-x border-border` kaldır (grid kolon ayırımı yeterli, border kalabalık yapıyor)

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `src/components/beyannameler/beyanname-arsiv-client.tsx` | Düzenleme | Trigger genişliği, PopoverContent, item grid layout |
| `src/components/beyannameler/beyanname-client.tsx` | Düzenleme | PopoverContent, item grid layout |

## Görsel Hedef

### Dropdown Item (Grid Layout)
```
┌────────────────────────────────────────────────────────────────────┐
│  🔍 Mükellef ara (ünvan, kısaltma veya VKN)...                    │
├──────────────────────────────────────────────────────────────────── │
│  ✓ │ Seyid Çetindağ          │  2060041298  │  ● Sorgulandı 15.02 │
│    │ Sercin Çoruması Almus...│  1830231291  │  ○ Sorgulanmamış     │
│    │ Aytohir Yardh Cidre ...│  1204712151  │  ● Sorgulandı 03.01 │
│    │ Tüchnet Taaır ya Dab...│  1462231291  │  ○ Sorgulanmamış     │
│    │ Erhan Yıldız            │  4966325522  │  ● Sorgulandı 10.02 │
│    │ Serdert Kahvecioğlu     │  5452365266  │  ○ Sorgulanmamış     │
│    │ Ercan Gazi Söler        │  1460243501  │  ○ Sorgulanmamış     │
│    │ Hasir Özdoğru           │  xxxxxxxxxx  │  ○ Sorgulanmamış     │
│    │ Yukat Mavuoğlu          │  0024563318  │  ● Sorgulandı 4 Ay  │
│    │ Ümit Eralan             │  xxxxxxxxxx  │  ○ Sorgulanmamış     │
│    │ Cansu Özer              │  xxxxxxxxxx  │  ○ Sorgulanmamış     │
└──────────────────────────────────────────────────────────────────── │
  ✓ icon │  Firma (truncate)    │ VKN (sağa)  │  Durum (sağa hizalı) │
  16px   │  1fr                 │ 120px       │  180px               │
```

### Kritik Fark (Eski vs Yeni)
- **Eski:** `flex gap-2` → VKN ve durum her satırda farklı konumda
- **Yeni:** `grid grid-cols-[...]` → VKN ve durum her satırda aynı dikey hizda

## Teknik Notlar

1. **grid-cols template:** `[16px_1fr_120px_180px]` Tailwind'de doğrudan kullanılabilir, arbitrary values destekliyor
2. **whitespace-nowrap:** "Sorgulanmamış" ve tarih kesilmemesi için gerekli
3. **text-right:** VKN sağa hizalanacak (sayılar sağa hizalanınca daha düzgün)
4. **justify-end:** Durum kolonu içindeki elementler sağa yaslanacak
5. **Trigger genişliği:** Arşiv sayfasında `max-w-[550px]`, sorgulama sayfası zaten full width

## Kararlar

| Karar | Neden |
|-------|-------|
| CSS Grid (flex yerine) | Sabit kolon genişlikleri, tüm satırlar aynı hizada |
| VKN border kaldır | Grid kolon ayırımı yeterli, border görsel kalabalık |
| 4 kolonlu tutmak (5 değil) | Simetri, GİB eksik de durum kolonunda |
| minWidth: 600 | 4 kolon düzgün sığması için 500 yetersiz |
| max-w-[550px] | Trigger'ı daha rahat göstermek için |
