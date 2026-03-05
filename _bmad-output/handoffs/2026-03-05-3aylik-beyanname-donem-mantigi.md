# Handoff: 3 Aylık Beyanname Dönem Mantığı

**Tarih:** 2026-03-05 14:00
**Durum:** ✅ Tamamlandı

## Görev Tanımı

> GİB kurallarına göre 3 aylık beyannameler Q1(Oca-Şub-Mar), Q2(Nis-May-Haz), Q3(Tem-Ağu-Eyl), Q4(Eki-Kas-Ara) olarak gruplanır. 3 aylık beyanname çeyrekten sonraki ayda verilir (Nisan, Temmuz, Ekim, Ocak). Kontrol çizelgesinde bu mantık uygulanmadığı için 3 aylık beyannameler 12 ayın hepsinde "onay bekliyor" olarak görünüyor. Bu güncelleme ile:
> 1. 3 aylık beyannameler sadece verilme aylarında (Nis, Tem, Eki, Oca) aktif gösterilecek
> 2. Metadata'da hangi çeyrek için gönderildiği belirtilecek (örn: "Oca-Şub-Mar 2026")
> 3. Dönem dışı aylar `donem_disi` statusuyla pasif gösterilecek
> 4. 3 aylık olduğu "3A" badge ile belirtilecek

## Araştırma Bulguları

### Mevcut Durum

**`beyannameAyarlari` alanı** (`customers` tablosu): Her müşteri için `{"KDV1": "3aylik", "GGECICI": "3aylik"}` gibi JSON ayar tutuyor.

**`/api/beyanname-takip` GET** (satır 44-71): Default status hesaplarken `ayarlar[turKod]` değerine bakıyor ama `3aylik` / `aylik` ayrımı yapmıyor:
```typescript
// satır 61-63 - Sorunlu kod
} else if (ayarlar[turKod]) {
    customerBeyannameler[turKod] = { status: "onay_bekliyor" };
    hasDefaults = true;
}
```
Bu kod `3aylik` dahil her dönem türü için `onay_bekliyor` veriyor — ay kontrolü yok.

**Frontend** (`kontrol-customer-row.tsx` satır 108-114): `getEffectiveStatus` fonksiyonunda eski `"3aylik"` status değerini backward compat olarak `"onay_bekliyor"`'a çeviriyor. Bu sadece legacy data içindir, dönem mantığıyla ilgisi yok.

**Tip tanımı** (`types.ts` satır 11-21): `DeclarationStatus` union type'ında `"donem_disi"` yok. Eklenmeli.

### Kritik Bilgiler

- `beyannameAyarlari` API'den müşterilerle birlikte geliyor ama **frontend Customer type'ında tanımlı değil**
- API tarafında `beyannameAyarlari` zaten `select`'te mevcut (beyanname-takip route.ts satır 27)
- Frontend'de `Customer` interface'ine `beyannameAyarlari` eklenmeli (dönem bilgisi tooltip için lazım)

### 3 Aylık Dönem Eşleme Tablosu

| Çeyrek | Kapsadığı Aylar | Verilme Ayı | Metadata Label |
|--------|----------------|-------------|----------------|
| Q1 | Ocak, Şubat, Mart | Nisan (4) | "Oca-Şub-Mar YYYY" |
| Q2 | Nisan, Mayıs, Haziran | Temmuz (7) | "Nis-May-Haz YYYY" |
| Q3 | Temmuz, Ağustos, Eylül | Ekim (10) | "Tem-Ağu-Eyl YYYY" |
| Q4 | Ekim, Kasım, Aralık | Ocak (1) | "Eki-Kas-Ara YYYY-1" |

**Yıl Edge Case:** Q4 (Eki-Kas-Ara) → Ocak'ta verilir. Ocak 2026 açıldığında kapsam = "Eki-Kas-Ara **2025**".

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `src/app/api/beyanname-takip/route.ts` | Düzenleme | GET handler'da 3 aylık dönem mantığı + metadata |
| `src/components/kontrol/types.ts` | Düzenleme | `donem_disi` status ekleme, Customer'a beyannameAyarlari |
| `src/components/kontrol/kontrol-customer-row.tsx` | Düzenleme | `donem_disi` render + "3A" badge + tooltip |

## Uygulama Planı

### Adım 1: Types Güncelleme (`src/components/kontrol/types.ts`)

- [ ] `DeclarationStatus` union'a `"donem_disi"` ekle (satır 21 civarı)
- [ ] `BeyannameStatusMeta` interface'ine `kapsam?: string` ekle (satır 68-83 arası)

### Adım 2: API Güncelleme (`src/app/api/beyanname-takip/route.ts`)

- [ ] `getQuarterInfo(month, year)` yardımcı fonksiyon ekle (dosya başına)
- [ ] GET handler satır 51-66 arasındaki döngüde `ayarlar[turKod] === "3aylik"` kontrolü ekle:
  - Verilme ayıysa (1, 4, 7, 10) → `status: "onay_bekliyor"` + `meta: { donem: "3aylik", kapsam: "..." }`
  - Dönem dışı aysa → `status: "donem_disi"`
- [ ] Mevcut DB kaydı varsa (satır 53 `if (customerBeyannameler[turKod]) continue;`) dokunma

Örnek implementasyon:
```typescript
function getQuarterInfo(month: number, year: number): { months: number[]; year: number; label: string } | null {
  switch (month) {
    case 1:  return { months: [10,11,12], year: year - 1, label: `Eki-Kas-Ara ${year - 1}` };
    case 4:  return { months: [1,2,3],    year,           label: `Oca-Şub-Mar ${year}` };
    case 7:  return { months: [4,5,6],    year,           label: `Nis-May-Haz ${year}` };
    case 10: return { months: [7,8,9],    year,           label: `Tem-Ağu-Eyl ${year}` };
    default: return null;
  }
}

// Döngü içinde (satır 61 yerine):
} else if (ayarlar[turKod] === "3aylik") {
    const quarterInfo = getQuarterInfo(month, year);
    if (quarterInfo) {
        // Verilme ayı — aktif
        customerBeyannameler[turKod] = {
            status: "onay_bekliyor",
            meta: { donem: "3aylik", kapsam: quarterInfo.label }
        };
    } else {
        // Dönem dışı ay — pasif
        customerBeyannameler[turKod] = { status: "donem_disi" };
    }
    hasDefaults = true;
} else if (ayarlar[turKod]) {
    // aylik, yillik, vb. — mevcut davranış
    customerBeyannameler[turKod] = { status: "onay_bekliyor" };
    hasDefaults = true;
}
```

### Adım 3: Frontend Render (`src/components/kontrol/kontrol-customer-row.tsx`)

- [ ] `Minus` ikonunu lucide-react'ten import et
- [ ] `BeyannameCell` içinde `donem_disi` durumu için render bloğu ekle (satır 453 civarı, `bos`'tan önce):
```tsx
{/* Dönem Dışı — Gri pasif, tıklanamaz */}
{status === "donem_disi" && (
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="flex items-center justify-center w-full h-full gap-0.5">
        <span className="text-[9px] font-bold text-muted-foreground/40">3A</span>
        <Minus className="w-3 h-3 text-muted-foreground/30" />
      </div>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs">
      3 Aylık — Bu ay dönem dışı
    </TooltipContent>
  </Tooltip>
)}
```
- [ ] `onay_bekliyor` durumunda 3 aylık ise "3A" badge göster + kapsam tooltip'i:
  - `meta?.donem === "3aylik"` kontrolü ile
  - Tooltip'te `meta?.kapsam` göster (örn: "3 Aylık KDV1 — Oca-Şub-Mar 2026")
- [ ] `donem_disi` hücrelerini tıklanamaz yap: `isLocked` kontrolüne `status === "donem_disi"` ekle (satır 289 civarı)
- [ ] Hücre arka plan: `donem_disi` için `bg-muted/20` (gonderilmeyecek'ten daha açık)

### Adım 4: Test

- [ ] Bir mükellefi KDV1 = "3aylik" olarak ayarla
- [ ] Nisan ayını aç → KDV1 hücresinde "3A" badge + "onay_bekliyor" (turuncu saat) + tooltip "Oca-Şub-Mar 2026"
- [ ] Şubat ayını aç → KDV1 hücresinde gri "3A" + tire ikonu (donem_disi, tıklanamaz)
- [ ] Ocak 2026 ayını aç → KDV1 hücresinde "3A" badge + tooltip "Eki-Kas-Ara 2025" (yıl doğru mu?)
- [ ] Zaten DB'de kaydı olan (verildi olarak işaretlenmiş) hücrelerin etkilenmediğini doğrula

## Teknik Notlar

- **DB kaydı varsa override etme:** `if (customerBeyannameler[turKod]) continue;` satırı (53) zaten bunu hallediyor — dokunma
- **Backward compat:** Eski `"3aylik"` status değeri types.ts'te kalmalı, getEffectiveStatus'ta `"onay_bekliyor"`'a map'leniyor
- **Performans:** `getQuarterInfo` saf fonksiyon, O(1), performans etkisi yok
- **API response boyutu:** Her `donem_disi` hücre için ekstra bir entry dönecek ama bunlar zaten `gonderilmeyecek` olarak dönüyordu, benzer boyut

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| API tarafında filtreleme | Tek kaynak prensibi — doğru veri API'den gelir | Frontend filtreleme (reddedildi: veri tutarsızlığı riski) |
| `donem_disi` yeni status | Semantik ayrım — `gonderilmeyecek` = beyanname yok, `donem_disi` = var ama bu ay değil | Mevcut `gonderilmeyecek` kullanma (reddedildi: anlam karışıklığı) |
| Verilme ayı gösterimi (Nis, Tem, Eki, Oca) | Mali müşavirlik "1 ay önce" kuralıyla tutarlı | Çeyrek sonu ayı gösterimi (reddedildi: kullanıcı beklentisiyle uyumsuz) |
| "3A" badge her durumda | Mali müşavir bir bakışta 3 aylık olduğunu anlasın | Sadece aktif aylarda badge (reddedildi: dönem dışında neden pasif olduğu anlaşılmaz) |
