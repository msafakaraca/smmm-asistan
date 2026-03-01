# Handoff: Beyanname Dosya Kayıt Sistemi Düzeltme
**Tarih:** 2026-02-22 16:30
**Durum:** Tamamlandı

## Görev Tanımı
> Beyannameler sayfasında (/dashboard/beyannameler) sorgulanan beyannameler dosyalar sayfasında onlarca "Beyannameler" klasörü oluşturuyor. Beyanname Kontrol botunun (/dashboard/beyanname-kontrol) dosya kayıt sistemi referans alınarak, beyannameler sayfasının dosya kayıt sistemi aynı yapıya getirilecek.

## SORUNUN KÖK NEDENİ

### Race Condition — Çoklu "Beyannameler" Klasörü

**Neden oluyor?** Beyannameler sayfası her PDF geldiğinde `saveSingle()` ile **eşzamanlı (concurrent)** HTTP istekleri gönderiyor. Örneğin 5 yıllık sorgulamada 50+ PDF hızla geliyor ve her biri aynı anda `ensureBeyannameFolder()` fonksiyonunu çağırıyor:

```
PDF-1 geldi → saveSingle() → ensureBeyannameFolder() → findMany (boş) → CREATE "Beyannameler" ✓
PDF-2 geldi → saveSingle() → ensureBeyannameFolder() → findMany (boş, henüz commit yok!) → CREATE "Beyannameler" ✗ (DUPLİKAT!)
PDF-3 geldi → saveSingle() → ensureBeyannameFolder() → findMany (boş, henüz commit yok!) → CREATE "Beyannameler" ✗ (DUPLİKAT!)
...7 concurrent request = 7 "Beyannameler" klasörü
```

**Module-level cache** (`folderCache`) bu sorunu çözmez çünkü cache key'i `tenantId:customerId:year` şeklinde ve ilk istek henüz cache'e yazmadan diğer istekler de çalışmaya başlar.

---

## İKİ SİSTEMİN KARŞILAŞTIRMASI

### A) Beyanname Kontrol Botu (REFERANS — Doğru Çalışan)

**API:** `src/app/api/gib/process-results/route.ts`

**Klasör Yapısı:**
```
Müşteri Kök Klasörü (parentId: null)
├── Beyannameler (type: "beyanname")
│   ├── KDV1 (type: "FOLDER")
│   │   ├── 01/2025 (type: "FOLDER", year: 2025, month: 1)
│   │   │   └── 5000000000_KDV1_2025-01_BEYANNAME.pdf
│   │   └── 02/2025
│   │       └── 5000000000_KDV1_2025-02_BEYANNAME.pdf
│   ├── MUHSGK
│   │   └── 01/2025
│   │       └── 5000000000_MUHSGK_2025-01_BEYANNAME.pdf
│   └── GGECICI
│       └── 10/2025-12/2025 (çeyreklik)
│           └── 5000000000_GGECICI_2025-12_BEYANNAME.pdf
│
├── Tahakkuklar (type: "tahakkuk")
│   ├── KDV1
│   │   └── 01/2025
│   │       └── 5000000000_KDV1_2025-01_TAHAKKUK.pdf
│   └── ...
│
└── SGK Tahakkuk ve Hizmet Listesi (type: "sgk")
    ├── Tahakkuk
    │   └── 01/2025
    │       ├── 5000000000_MUHSGK_2025-01_SGK_TAHAKKUK_1.pdf
    │       └── 5000000000_MUHSGK_2025-01_SGK_TAHAKKUK_2.pdf
    └── Hizmet Listesi
        └── 01/2025
            └── 5000000000_MUHSGK_2025-01_HIZMET_LISTESI_1.pdf
```

**Dosya Adı Formatı:** `{VKN}_{BeyannameTuru}_{Yıl}-{Ay}_{FileCategory}[_{Index}].pdf`

**Supabase Storage Path:** `{tenantId}/{customerId}/{year}/{month}/{fileName}`

**Duplicate Detection:** Metadata bazlı → `vknTckn + beyannameTuru + year + month + fileCategory + fileIndex`

**Klasör Oluşturma Güvenliği:**
- Her müşteri SERİ işlenir (batch of 5, ama aynı müşteri paralel yok)
- Klasör zinciri sıralı: root → Beyannameler → TürKodu → Ay/Yıl
- SGK klasörleri `ensureSgkFolderStructure()` ile ÖNCEDEN oluşturulur (race condition önlemi)

---

### B) Beyannameler Sayfası (SORUNLU — Düzeltilecek)

**API'ler:**
- `src/app/api/intvrg/beyanname-stream-save/route.ts` (ana save - stream)
- `src/app/api/intvrg/beyanname-save/route.ts` (tek PDF save)
- `src/app/api/intvrg/beyanname-bulk-save/route.ts` (toplu save)

**Mevcut Klasör Yapısı (YANLIŞ):**
```
Müşteri Kök Klasörü (parentId: null)
├── Beyannameler ← DUPLİKAT #1
│   └── 2020
├── Beyannameler ← DUPLİKAT #2
│   └── 2021
├── Beyannameler ← DUPLİKAT #3
│   └── 2022
├── Beyannameler ← DUPLİKAT #4 ...
```

**Mevcut Dosya Adı Formatı:** `{turKodu}_{MM}-{Yıl}_v{versiyon}.pdf`

**Mevcut Supabase Storage Path:** `{tenantId}/{customerId}/beyannameler/{year}/{beyoid}_{fileName}`

---

## HEDEF: BİREBİR AYNI Dosya Adı + Çapraz Duplicate Detection

### KRİTİK KARAR: Dosya Adları Birebir Aynı Olacak!

Her iki sistemin ürettiği dosya adları **BİREBİR AYNI** olmalı ki:
- GİB bot bir beyanname indirdiyse → beyanname sorgulama tekrar kaydetmesin
- Beyanname sorgulama indirdiyse → GİB bot tekrar kaydetmesin
- Çapraz duplicate detection **dosya adı karşılaştırması** ile çalışsın

### Referans Dosya Adı Formatı (process-results — satır 257-264):
```typescript
// process-results/route.ts — REFERANS FORMAT
const cleanVknTckn = customerVknTckn.replace(/\D/g, '');
const cleanBeyannameTuru = beyannameTuru.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 15);
const monthPadded = String(month).padStart(2, '0');
const fileCategory = "BEYANNAME"; // ← SABİT

// Tekil dosya:
fileName = `${cleanVknTckn}_${cleanBeyannameTuru}_${year}-${monthPadded}_${fileCategory}.pdf`;
// Örnek: 5000000000_KDV1_2025-01_BEYANNAME.pdf
```

### Hedef: Beyannameler Sayfası DA AYNI İsmi Üretecek!
```typescript
// beyanname-stream-save — AYNI FORMAT
const cleanVknTckn = customer.vknTckn.replace(/\D/g, '');
const cleanBeyannameTuru = item.turKodu.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 15);
const monthPadded = String(month).padStart(2, '0');
const fileCategory = "BEYANNAME"; // ← AYNI SABİT!

fileName = `${cleanVknTckn}_${cleanBeyannameTuru}_${year}-${monthPadded}_${fileCategory}.pdf`;
// Örnek: 5000000000_KDV1_2025-01_BEYANNAME.pdf ← BİREBİR AYNI!
```

### Hedef Klasör Yapısı (process-results ile birebir aynı):
```
Müşteri Kök Klasörü (parentId: null)
├── Beyannameler (TEK klasör!)
│   ├── KDV1
│   │   ├── 01/2025
│   │   │   └── 5000000000_KDV1_2025-01_BEYANNAME.pdf ← BİREBİR AYNI
│   │   └── 02/2025
│   │       └── 5000000000_KDV1_2025-02_BEYANNAME.pdf
│   ├── MUHSGK
│   │   └── 01/2025
│   │       └── 5000000000_MUHSGK_2025-01_BEYANNAME.pdf
│   └── GGECICI
│       └── 10/2025-12/2025
│           └── 5000000000_GGECICI_2025-12_BEYANNAME.pdf
```

### Hedef Supabase Storage Path (aynı):
`{tenantId}/{customerId}/{year}/{month}/{fileName}`

### Çapraz Duplicate Detection Akışı:
```
SENARYO 1: Önce GİB bot çalıştı
─────────────────────────────────
Bot → process-results → Kayıt: name="5000000000_KDV1_2025-01_BEYANNAME.pdf"
                                 fileCategory="BEYANNAME"
                                 vknTckn="5000000000", beyannameTuru="KDV1"

Sonra beyanname sorgulama çalıştı:
stream-save → Aynı dosya adını üretir: "5000000000_KDV1_2025-01_BEYANNAME.pdf"
            → DB'de name ile arar → BULUR → KAYDETMEZ ✓

SENARYO 2: Önce beyanname sorgulama çalıştı
─────────────────────────────────────────────
stream-save → Kayıt: name="5000000000_KDV1_2025-01_BEYANNAME.pdf"
                      fileCategory="BEYANNAME"
                      vknTckn="5000000000", beyannameTuru="KDV1"

Sonra GİB bot çalıştı:
process-results → Aynı dosya adını üretir: "5000000000_KDV1_2025-01_BEYANNAME.pdf"
                → DB'de metadata VEYA name ile arar → BULUR → KAYDETMEZ ✓
```

---

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `src/app/api/intvrg/beyanname-stream-save/route.ts` | BÜYÜK DEĞİŞİKLİK | Klasör yapısı tamamen değişecek |
| `src/app/api/intvrg/beyanname-save/route.ts` | BÜYÜK DEĞİŞİKLİK | Aynı klasör yapısına geçecek |
| `src/app/api/intvrg/beyanname-bulk-save/route.ts` | DEĞİŞİKLİK | Varsa aynı yapıya geçecek |
| `src/components/beyannameler/hooks/use-beyanname-query.ts` | KÜÇÜK DEĞİŞİKLİK | Batch save (concurrent → sequential veya mutex) |

---

## Uygulama Planı

### Adım 1: `ensureBeyannameFolder` Fonksiyonunu Yeniden Yaz (stream-save)

**Dosya:** `src/app/api/intvrg/beyanname-stream-save/route.ts` (satır 103-180)

Mevcut yapı:
```
Müşteri → Beyannameler → Yıl
```

Yeni yapı (referans sisteme uyumlu):
```
Müşteri → Beyannameler → TürKodu → Ay/Yıl
```

- [ ] `ensureBeyannameFolder(tenantId, customerId, year)` fonksiyonunu yeni parametrelerle güncelle:
  `ensureBeyannameFolder(tenantId, customerId, year, month, turKodu)`
- [ ] TürKodu klasörü oluşturma ekle (Beyannameler altında)
- [ ] Ay/Yıl klasörü oluşturma ekle (TürKodu altında): `{Ay}/{Yıl}` formatında
- [ ] Çeyreklik dönem desteği ekle (GGECICI/KGECICI): `{BaşAy}/{Yıl}-{BitAy}/{Yıl}` formatında
- [ ] **RACE CONDITION FİX:** In-flight folder creation promise'lerini paylaşmak için mutex/lock pattern uygula

**Race Condition Fix Stratejisi — Promise Deduplication:**
```typescript
// Module-level: aynı key için tek promise
const folderCreationLocks = new Map<string, Promise<string>>();

async function ensureBeyannameFolder(...): Promise<string> {
  const lockKey = `${tenantId}:${customerId}:${turKodu}:${year}:${month}`;

  // Aynı key için zaten bir promise varsa, onu bekle
  const existing = folderCreationLocks.get(lockKey);
  if (existing) return existing;

  // Yoksa yeni promise oluştur ve paylaş
  const promise = _ensureBeyannameFolder(...);
  folderCreationLocks.set(lockKey, promise);

  try {
    return await promise;
  } finally {
    folderCreationLocks.delete(lockKey);
  }
}
```

### Adım 2: Dosya Adı Formatını Güncelle (stream-save)

**Dosya:** `src/app/api/intvrg/beyanname-stream-save/route.ts` (satır 311-319)

Mevcut format:
```typescript
const fileName = `${item.turKodu}_${monthPadded}-${year}_v${item.versiyon || "1"}.pdf`;
const storagePath = `${tenantId}/${customerId}/beyannameler/${year}/${item.beyoid}_${fileName}`;
```

Yeni format (process-results ile BİREBİR AYNI):
```typescript
const cleanVknTckn = customer.vknTckn.replace(/\D/g, '');
const cleanBeyannameTuru = item.turKodu.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 15);
const fileCategory = "BEYANNAME"; // process-results ile AYNI
const fileName = `${cleanVknTckn}_${cleanBeyannameTuru}_${year}-${monthPadded}_${fileCategory}.pdf`;
const storagePath = `${tenantId}/${customerId}/${year}/${monthPadded}/${fileName}`;
```

- [ ] Dosya adı formatını process-results ile BİREBİR AYNI yap
- [ ] fileCategory'yi "BEYANNAME" yap (eskiden "INTVRG_BEYANNAME" idi)
- [ ] Storage path'i referans sisteme uyumlu yap
- [ ] createMany'deki data yapısını güncelle (parentId artık ay/yıl klasörünü gösterecek)
- [ ] Duplicate check'e isim bazlı kontrol ekle (sadece beyoid değil, name ile de kontrol)

### Adım 3: Çapraz Duplicate Detection Ekle (stream-save)

**Dosya:** `src/app/api/intvrg/beyanname-stream-save/route.ts`

Mevcut duplicate check sadece beyoid bazlı (kendi sistemi). Ek olarak isim bazlı cross-system check gerekli:

- [ ] `getBeyoidSet()` ile kendi sistemindeki duplikatları kontrol et (mevcut — korunacak)
- [ ] **YENİ:** Her item için dosya adını oluştur ve `documents` tablosunda `name + customerId + fileCategory="BEYANNAME"` ile ara
- [ ] Eğer zaten varsa (GİB bot kaydetmişse), o item'ı atla
- [ ] Atlananlara `skippedCount` ekle

### Adım 4: `ensureBeyannameFolder` Fonksiyonunu Yeniden Yaz (beyanname-save)

**Dosya:** `src/app/api/intvrg/beyanname-save/route.ts` (satır 21-105)

- [ ] Stream-save ile aynı klasör yapısına geçir
- [ ] Yeni parametreler ekle: `month` ve `turKodu`
- [ ] Race condition fix (aynı pattern)
- [ ] Dosya adı formatını process-results ile BİREBİR AYNI yap
- [ ] fileCategory'yi "BEYANNAME" yap
- [ ] Çapraz duplicate detection ekle (name bazlı)

### Adım 5: Bulk-save API'yi Güncelle

**Dosya:** `src/app/api/intvrg/beyanname-bulk-save/route.ts`

- [ ] Bulk-save varsa aynı klasör yapısına geçir + aynı dosya adı formatı + fileCategory="BEYANNAME"
- [ ] Yoksa veya kullanılmıyorsa skip

### Adım 6: Frontend Hook Güncellemesi (Opsiyonel Optimizasyon)

**Dosya:** `src/components/beyannameler/hooks/use-beyanname-query.ts` (satır 360-382)

Mevcut: Her PDF geldiğinde `saveSingle()` ayrı ayrı çağrılır (concurrent fire-and-forget)

Potansiyel iyileştirme: Micro-batching — 500ms debounce ile biriktirip toplu gönderme
- [ ] (OPSİYONEL) Debounce/batch mekanizması eklenerek aynı anda 5-10 PDF'i tek istekte gönderme

NOT: Backend'deki Promise deduplication (Adım 1) race condition'ı çözecektir, frontend tarafında zorunlu değişiklik yok.

### Adım 7: Mevcut Duplikat Klasörleri Temizleme Script'i

- [ ] Veritabanındaki mevcut duplikat "Beyannameler" klasörlerini tespit et
- [ ] Alt dosyaları en eski (ilk) "Beyannameler" klasörünün altına taşı
- [ ] Boş duplikat klasörleri sil
- [ ] Bu işlem için bir API endpoint veya script yaz

---

## Teknik Notlar

### 1. file-system.ts ile Tutarlılık
`src/lib/file-system.ts`'deki `STANDARD_SUBFOLDERS` zaten "Beyannameler" klasörünü oluşturur. `process-results` API'si de aynı şekilde oluşturur. Yeni `ensureBeyannameFolder` fonksiyonu da `parentId: customerRootFolder.id + name: "Beyannameler"` ile arar, bu tutarlıdır.

### 2. fileCategory: AYNI "BEYANNAME" (KRİTİK DEĞİŞİKLİK!)
- Beyanname Kontrol Botu: `fileCategory = "BEYANNAME"`
- Beyannameler Sayfası: `fileCategory = "BEYANNAME"` ← **ESKİDEN "INTVRG_BEYANNAME" İDİ, ARTIK AYNI!**

Her iki sistem **aynı dosya adı** + **aynı fileCategory** kullanacak. Bu sayede:
- process-results'ın metadata bazlı duplicate check'i (`vknTckn + beyannameTuru + year + month + fileCategory`) her iki sistemin dosyalarını da bulur
- process-results'ın name bazlı fallback check'i (`{ customerId, name: fileName }`) her iki sistemin dosyalarını da bulur

### 3. Çapraz Duplicate Detection Stratejisi
**Stream-save'de eklenmesi gereken duplicate check:**
```typescript
// Mevcut: Sadece beyoid bazlı (kendi sistemi içinde)
const existingBeyoids = await getBeyoidSet(tenantId, customerId);

// YENİ EK: İsim bazlı çapraz kontrol (GİB bot'un kaydettiği dosyaları da bul)
const existingByName = await prisma.documents.findFirst({
  where: {
    tenantId,
    customerId,
    name: fileName,           // BİREBİR aynı dosya adı
    fileCategory: "BEYANNAME", // Artık her iki sistem de aynı category
    isFolder: false
  }
});
if (existingByName) {
  // GİB bot zaten bu dosyayı kaydetmiş, atla
  skippedCount++;
  continue;
}
```

Beyoid cache mekanizması KORUNACAK (kendi sistemi içinde hızlı check için). Ek olarak isim bazlı cross-system check eklenecek.

### 4. Supabase Storage Path Değişikliği
Eski: `{tenantId}/{customerId}/beyannameler/{year}/{beyoid}_{fileName}`
Yeni: `{tenantId}/{customerId}/{year}/{month}/{beyoid}_{fileName}`
Bu değişiklik eski kayıtları BOZMAZ çünkü path DB'de saklanır, dosya hala eski path'te bulunur.

### 5. Archive Merge Fonksiyonu
`batchArchiveMerge()` fonksiyonu değişmeyecek — sadece query_archives tablosuna kayıt yapar, klasör yapısıyla ilgisi yok.

### 6. Çeyreklik Dönem Desteği
GGECICI/KGECICI beyannameleri çeyreklik dönemdir. turKodu'na bakarak klasör adı:
- Normal: `01/2025`, `02/2025`
- Çeyreklik: `10/2025-12/2025`, `01/2026-03/2026`
Bu mantık `process-results` API'sinde (satır 377-389) zaten mevcut, kopyalanacak.

---

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Race condition fix: Promise deduplication | Basit, etkili, module-level cache ile uyumlu | DB unique constraint (schema değişikliği gerekir), Mutex lock (karmaşık), Frontend debounce (backend'de garanti yok) |
| Klasör yapısı: TürKodu/Ay-Yıl | Referans sistemle (process-results) tam uyum | Sadece Yıl (mevcut - yetersiz organizasyon) |
| Dosya adı: BİREBİR AYNI format | Çapraz duplicate detection çalışır — bot veya sorgulama hangisi önce indirirse diğeri atlar | Farklı format (duplicate detection çalışmaz, aynı dosya 2 kez kaydedilir) |
| fileCategory: "BEYANNAME" (her iki sistem aynı) | Çapraz metadata bazlı duplicate detection çalışır | "INTVRG_BEYANNAME" (farklı — çapraz dedup çalışmaz) |
| Duplikat temizleme: API endpoint | Kullanıcı ihtiyaç duyduğunda çalıştırabilir | Migration script (tek seferlik, tekrar çalıştırılamaz) |

---

## Referans: Kritik Dosya Satır Numaraları

### process-results/route.ts (REFERANS)
- `savePdfToSupabase()`: satır 228-548 — Ana dosya kaydetme fonksiyonu
- Klasör yapısı oluşturma: satır 310-471
- Beyanname/Tahakkuk klasör zinciri: satır 446-471 (`mainFolder → beyannameTuruFolder → monthYearFolder`)
- Çeyreklik dönem mantığı: satır 377-389
- Duplicate detection: satır 271-303
- Dosya adı format: satır 257-264
- SGK folder pre-creation: `ensureSgkFolderStructure()` satır 99-216

### beyanname-stream-save/route.ts (DEĞİŞECEK)
- `ensureBeyannameFolder()`: satır 103-180 — **Tamamen yeniden yazılacak**
- `POST handler`: satır 250-406
- Metadata hazırlama: satır 311-319 — Dosya adı ve storage path değişecek
- createMany: satır 324-346 — parentId güncellenecek
- folderCache: satır 34 — Cache key yapısı değişecek

### beyanname-save/route.ts (DEĞİŞECEK)
- `ensureBeyannameFolder()`: satır 21-105 — **Tamamen yeniden yazılacak**
- POST handler: satır 111-231
- Dosya adı: satır 191 — Format değişecek
- Storage path: satır 195 — Path değişecek

### use-beyanname-query.ts (OPSİYONEL)
- `saveSingle()`: satır 360-382 — Concurrent fire-and-forget pattern
- WebSocket message handler: satır 468-511 — Her PDF geldiğinde saveSingle çağrılır

---

## Özet

- **8 duplikat "Beyannameler" klasörünün nedeni:** Race condition — concurrent HTTP requests aynı anda klasör oluşturuyor
- **Çözüm:** Promise deduplication + referans sisteme uyumlu klasör yapısı
- **Etkilenen dosya sayısı:** 3-4 dosya (stream-save, beyanname-save, bulk-save, opsiyonel hook)
- **Risk:** Düşük — mevcut kayıtlar bozulmaz, yeni kayıtlar doğru yapıda oluşur
