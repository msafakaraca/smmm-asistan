# Handoff: Beyanname Klasör Yapısı Düzeltme
**Tarih:** 2026-02-22 17:30
**Durum:** ✅ Tamamlandı (2026-02-22)

## Görev Tanımı
> Beyanname dosya kayıt sistemi yanlış klasör yapısı oluşturuyor. Onlarca duplike "Beyannameler" klasörü ve duplike tür klasörleri (KDV1 x4, GGECICI x4) oluşuyor. Klasör hiyerarşisi de kullanıcının istediğinden farklı.
>
> **İstenen yapı:** `Beyannameler → Yıl → TürKodu → dosyalar` (ay klasörü YOK, dosyalar doğrudan tür klasöründe)
>
> **Mevcut yapı:** `Beyannameler → TürKodu → Ay/Yıl → dosyalar`

## Araştırma Bulguları

### Mevcut Durum (YANLIŞ)
```
Müşteri Kök/
  Beyannameler/         ← BİRDEN FAZLA (race condition!)
    KDV1/               ← BİRDEN FAZLA (race condition!)
      01/2025/          ← Ay/Yıl KLASÖRÜ
        dosya.pdf
```

### İstenen Durum (DOĞRU)
```
Müşteri Kök/
  Beyannameler/         ← TEK ADET
    2020/               ← YIL KLASÖRÜ
      KDV1/             ← TÜR KODU KLASÖRÜ
        1234567890_KDV1_2020-01_BEYANNAME.pdf
        1234567890_KDV1_2020-02_BEYANNAME.pdf
        ...
        1234567890_KDV1_2020-12_BEYANNAME.pdf
      MUHSGK/
        1234567890_MUHSGK_2020-01_BEYANNAME.pdf
    2021/
      KDV1/
      MUHSGK/
    ...
    2026/
```

### Değişiklik Özeti
| | Mevcut | İstenen |
|---|---|---|
| Seviye 1 | Beyannameler | Beyannameler |
| Seviye 2 | TürKodu (KDV1) | **Yıl (2022)** |
| Seviye 3 | Ay/Yıl (01/2025) | **TürKodu (KDV1)** |
| Seviye 4 | dosya.pdf | **dosya.pdf** (Ay klasörü YOK!) |

### Race Condition Problemi
Ekran görüntülerinde 6 adet "Beyannameler" klasörü ve 4'er adet KDV1/GGECICI klasörü var. Mevcut Promise deduplication çalışmıyor çünkü:
- Her API request yeni bir Node.js process'te çalışabilir (serverless)
- Module-level Map serverless ortamda persist etmez
- Çözüm: Database seviyesinde `findFirst` + create with unique constraint veya upsert pattern

### GİB Beyanname Kontrol Botu (process-results) Referans Analizi
**Dosya:** `src/app/api/gib/process-results/route.ts`
- `savePdfToSupabase()`: satır 228-548
- Mevcut hiyerarşi: `Müşteri → Beyannameler → TürKodu → Ay/Yıl → dosya`
- fileCategory: `BEYANNAME`, `TAHAKKUK`, `SGK_TAHAKKUK`, `HIZMET_LISTESI`
- Dosya adı formatı: `{VKN}_{TürKodu}_{Yıl}-{Ay}_{FileCategory}.pdf`
- Çeyreklik dönem (GGECICI/KGECICI): `monthYearFolderName = "${startPadded}/${year}-${endPadded}/${year}"`

### INTVRG Save API'leri Analizi
**3 dosya da aynı yapıyı kullanıyor:**
- `beyanname-stream-save/route.ts` — Micro-batch (1-10 PDF), en optimize
- `beyanname-save/route.ts` — Tek PDF kaydetme
- `beyanname-bulk-save/route.ts` — Toplu kaydetme
- Hepsi: `Müşteri → Beyannameler → TürKodu → Ay/Yıl → dosya`
- fileCategory: `BEYANNAME`
- Race condition fix: `folderCreationLocks` Map (çalışmıyor!)

### Dosya Adı Formatı (KORUNACAK — HER İKİ SİSTEMDE AYNI)
```
{VKN}_{BeyannameTuru}_{Yıl}-{Ay}_{FileCategory}.pdf
```
Örnekler:
- `1234567890_KDV1_2025-01_BEYANNAME.pdf`
- `1234567890_KDV1_2025-01_TAHAKKUK.pdf`
- `1234567890_MUHSGK_2025-01_SGK_TAHAKKUK_1.pdf`
- `1234567890_MUHSGK_2025-01_HIZMET_LISTESI_1.pdf`

### Storage Path Formatı (KORUNACAK)
```
{tenantId}/{customerId}/{year}/{month}/{fileName}
```

## Etkilenecek Dosyalar

| # | Dosya | Değişiklik | Detay |
|---|-------|-----------|-------|
| 1 | `src/app/api/intvrg/beyanname-stream-save/route.ts` | **DÜZENLEME** | ensureBeyannameFolder → Yıl→Tür yapısı, race condition fix |
| 2 | `src/app/api/intvrg/beyanname-save/route.ts` | **DÜZENLEME** | ensureBeyannameFolder + _createFolderHierarchy → Yıl→Tür yapısı |
| 3 | `src/app/api/intvrg/beyanname-bulk-save/route.ts` | **DÜZENLEME** | ensureBeyannameFolder + _createFolderHierarchy → Yıl→Tür yapısı |
| 4 | `src/app/api/gib/process-results/route.ts` | **DÜZENLEME** | savePdfToSupabase klasör yapısı → Yıl→Tür, Tahakkuklar→Yıl→Tür |
| 5 | `src/app/api/intvrg/beyanname-clear-duplicates/route.ts` | **DÜZENLEME** | Yeni yapıya uyumlu temizleme |

## Uygulama Planı

### Adım 1: INTVRG beyanname-stream-save (Ana API)
**Dosya:** `src/app/api/intvrg/beyanname-stream-save/route.ts`

`ensureBeyannameFolder()` fonksiyonunu yeniden yaz:

**ESKİ hiyerarşi (4 seviye):**
```
1. Müşteri Kök (parentId: null)
2. "Beyannameler" (parentId: müşteriKök)
3. TürKodu - KDV1 (parentId: beyannameler)
4. Ay/Yıl - 01/2025 (parentId: türKodu) ← KALDIRILACAK
```

**YENİ hiyerarşi (3 seviye, dosyalar düz):**
```
1. Müşteri Kök (parentId: null)
2. "Beyannameler" (parentId: müşteriKök)
3. Yıl - 2025 (parentId: beyannameler) ← YENİ
4. TürKodu - KDV1 (parentId: yıl) ← YENİ KONUM
   → dosyalar doğrudan burada (ay klasörü YOK)
```

**Fonksiyon imzası değişikliği:**
```typescript
// ESKİ:
async function ensureBeyannameFolder(
  tenantId, customerId, turKodu, year, month
): Promise<string>  // Ay/Yıl klasör ID döndürüyordu

// YENİ:
async function ensureBeyannameFolder(
  tenantId, customerId, turKodu, year
): Promise<string>  // TürKodu klasör ID döndürecek (month parametresi gereksiz)
```

**Lock key değişikliği:**
```typescript
// ESKİ: `${tenantId}:${customerId}:${cleanTurKodu}:${year}:${month}`
// YENİ: `${tenantId}:${customerId}:${cleanTurKodu}:${year}`
```

**FolderMap key değişikliği:**
```typescript
// ESKİ: `${cleanTurKodu}:${year}:${month}`
// YENİ: `${cleanTurKodu}:${year}`
```

**Çeyreklik dönem (GGECICI/KGECICI) — KALDIRILACAK:**
Artık Ay/Yıl klasörü olmadığı için çeyreklik klasör adı hesaplama gereksiz. Dosya adında ay bilgisi zaten var.

- [x]`ensureBeyannameFolder()` parametresinden `month` kaldır
- [x]Hiyerarşi: Müşteri→Beyannameler→Yıl→TürKodu
- [x]Çeyreklik klasör adı hesaplamasını kaldır
- [x]Cache key'i güncelle (month olmadan)
- [x]Lock key'i güncelle (month olmadan)
- [x]FolderMap key'i güncelle
- [x]folderCache ve beyoidCache korunsun

### Adım 2: INTVRG beyanname-save (Tek PDF)
**Dosya:** `src/app/api/intvrg/beyanname-save/route.ts`

Adım 1 ile birebir aynı değişiklikler:
- [x]`ensureBeyannameFolder()` → month parametresini kaldır
- [x]`_createFolderHierarchy()` → Yıl→TürKodu yapısı
- [x]Çeyreklik klasör adı hesaplamasını kaldır
- [x]Lock key güncelle

### Adım 3: INTVRG beyanname-bulk-save (Toplu)
**Dosya:** `src/app/api/intvrg/beyanname-bulk-save/route.ts`

Adım 1 ile birebir aynı değişiklikler:
- [x]`ensureBeyannameFolder()` → month parametresini kaldır
- [x]`_createFolderHierarchy()` → Yıl→TürKodu yapısı
- [x]Çeyreklik klasör adı hesaplamasını kaldır
- [x]FolderMap key'i `${cleanTurKodu}:${year}` olacak

### Adım 4: GİB process-results (Beyanname Kontrol Botu)
**Dosya:** `src/app/api/gib/process-results/route.ts`

`savePdfToSupabase()` fonksiyonundaki klasör hiyerarşisini değiştir:

**BEYANNAME dosyaları için (satır 345-370, 446-471):**
```
ESKİ: Beyannameler → TürKodu → Ay/Yıl → dosya
YENİ: Beyannameler → Yıl → TürKodu → dosya (ay klasörü yok)
```

**TAHAKKUK dosyaları için:**
```
ESKİ: Tahakkuklar → TürKodu → Ay/Yıl → dosya
YENİ: Tahakkuklar → Yıl → TürKodu → dosya (ay klasörü yok)
```

**SGK dosyaları (KORUNACAK — AYRI YAPIDA):**
```
SGK Tahakkuk ve Hizmet Listesi → Tahakkuk/Hizmet Listesi → Ay/Yıl → dosya
```
SGK yapısı zaten farklı bir klasör altında ve kullanıcı bununla ilgili bir şey söylemedi.

- [x]Beyanname hiyerarşisi: Beyannameler→Yıl→TürKodu
- [x]Tahakkuk hiyerarşisi: Tahakkuklar→Yıl→TürKodu
- [x]Ay/Yıl klasörü oluşturma kaldırılacak
- [x]Çeyreklik klasör adı hesaplaması kaldırılacak
- [x]`parentId` artık TürKodu klasörünü gösterecek (Ay/Yıl değil)
- [x]SGK yapısı DOKUNULMAYACAK (mevcut kalacak)

### Adım 5: Duplikat Temizleme API Güncelleme
**Dosya:** `src/app/api/intvrg/beyanname-clear-duplicates/route.ts`

- [x]Mevcut duplikat "Beyannameler" klasörlerini temizleme mantığı korunsun
- [x]Yeni yapıda Yıl→TürKodu kontrolü ekle
- [x]Duplikat Yıl klasörleri de temizlenebilmeli

## Teknik Notlar

### Race Condition Root Cause
Module-level `Map<string, Promise>` serverless ortamda (Next.js API routes) farklı invocation'larda persist etmez. Her cold start yeni bir Map oluşturur. Çözüm:
1. **findFirst + create pattern korulsun** — Concurrent create'lerde Prisma unique constraint hatası verir
2. **try-catch ile Prisma P2002 (unique constraint) yakalansın** — Hata alınırsa findFirst ile mevcut klasörü bul
3. **Module-level lock yine de kalsın** — Aynı invocation içindeki concurrent request'ler için faydalı

### Dosya Adı ve Storage Path
Dosya adı formatı ve Supabase Storage path değişmeyecek. Sadece documents tablosundaki `parentId` farklı klasöre işaret edecek.

### Geriye Uyumluluk
Eski kayıtlar (mevcut TürKodu→Ay/Yıl yapısında) yerlerinde kalacak. Yeni kayıtlar Yıl→TürKodu yapısında oluşturulacak. Duplikat temizleme API'si eski yapıyı düzeltebilir.

### month Değeri Hâlâ Gerekli
`month` parametresi `ensureBeyannameFolder()`'dan kaldırılsa da, dosya adında ve document record'unda (`year`, `month`) hâlâ kullanılıyor. Sadece klasör hiyerarşisinden çıkıyor.

### Yıl Klasörü Adı
Yıl klasörü basitçe `"2025"` string'i olacak (number → string). Type: `"FOLDER"`.

### TürKodu Klasörü parentId
Artık doğrudan Beyannameler'in altında değil, Yıl klasörünün altında olacak.

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Ay/Yıl klasörü kaldırılıyor | Kullanıcı istiyor: dosyalar doğrudan tür klasöründe, ay sırasına göre | Mevcut yapı korunabilirdi ama kullanıcı açıkça farklı yapı istedi |
| Yıl klasörü TürKodu'ndan önce | Kullanıcı istiyor: "Beyannameler → 2022 → KDV1 → dosyalar" | Alternatif yok, kullanıcı talebi net |
| SGK yapısına dokunulmayacak | Kullanıcı sadece Beyannameler'den bahsetti | SGK yapısı da değiştirilebilirdi ama risk ve scope artardı |
| Race condition fix: try-catch P2002 | Module-level Map serverless'ta çalışmıyor | Database-level locking (advisory lock) daha güvenli ama karmaşık |
| Dosya adı format korunuyor | Her iki sistem aynı format kullanıyor, çapraz duplicate detection çalışıyor | Format değiştirmek gereksiz risk |
