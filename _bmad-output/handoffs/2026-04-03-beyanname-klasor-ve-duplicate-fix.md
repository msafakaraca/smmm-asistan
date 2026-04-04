# Handoff: Beyanname Dosya Kayıt — Klasör Yapısı + Çapraz Duplicate Detection
**Tarih:** 2026-04-03 
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor

## Görev Tanımı
> `/dashboard/beyannameler` sayfasında sorgulama yapıldığında indirilen PDF'ler, `/dashboard/dosyalar` sayfasında ilgili mükellefin klasör yapısına değil, en alta (klasör dışına) tek tek kaydediliyor. Bunun nedeni `parentId` alanının hiç ayarlanmaması ve klasör oluşturma kodunun bulunmaması.
>
> Aynı zamanda `/beyannameler` ve `/beyanname-kontrol` (GİB bot) sayfaları aynı beyannameleri indirdiğinde duplikat dosya oluşmaması gerekiyor. İki sistem birbirinin dosyalarından habersiz — çapraz duplicate detection yok.
>
> Ek olarak, GİB bot (`process-results`) şu an `Beyannameler → TürKodu → Ay/Yıl` hiyerarşisi kullanıyor. Kullanıcı `Beyannameler → Yıl → TürKodu → dosyalar` yapısını istiyor. Her iki sistem de aynı yapıyı kullanmalı ki aynı klasörlere yazsınlar ve duplikat klasör oluşmasın.
>
> **İleriye dönük fix** — mevcut yanlış kaydedilmiş dosyalar taşınmayacak, sadece yeni kayıtlar doğru yapıda olacak.

---

## SORUNUN KÖK NEDENLERİ

### 1. parentId Eksik (beyanname-stream-save ve beyanname-bulk-save)

Her iki API de `prisma.documents.create()` çağrısında `parentId` alanını **hiç göndermiyor**. Bu yüzden dosyalar `parentId: null` ile kaydediliyor ve dosya ağacının en altına (kök seviyeye) düşüyor.

**beyanname-stream-save/route.ts — satır 88-105:**
```typescript
prisma.documents.create({
  data: {
    name: filename,
    originalName: `${turAdi || turKodu} - ${monthPadded}/${year} (v${versiyon || "1"})`,
    type: "pdf",
    mimeType: "application/pdf",
    size: buffer.length,
    path: storagePath,
    storage: "supabase",
    year,
    month,
    vknTckn: customer.vknTckn,
    beyannameTuru: turKodu,
    fileCategory: "BEYANNAME",
    customerId,
    tenantId: user.tenantId,
    // ❌ parentId YOK — dosya köke düşüyor!
  },
})
```

**beyanname-bulk-save/route.ts — satır 115-132:** Aynı sorun, `parentId` yok.

### 2. Klasör Oluşturma Kodu Yok

`beyanname-stream-save` ve `beyanname-bulk-save` dosyalarında `ensureBeyannameFolder()` gibi bir fonksiyon **hiç yok**. Dosya kaydedilmeden önce klasör hiyerarşisi oluşturulmuyor.

### 3. GİB Bot Farklı Hiyerarşi Kullanıyor

`process-results/route.ts`'deki `savePdfToSupabase()` fonksiyonu şu hiyerarşiyi kullanıyor:
```
Müşteri Kök → Beyannameler → TürKodu (KDV1) → Ay/Yıl (01/2025) → dosya.pdf
```

Kullanıcının istediği:
```
Müşteri Kök → Beyannameler → Yıl (2025) → TürKodu (KDV1) → dosya.pdf
```

### 4. Çapraz Duplicate Detection Yok

- `beyanname-stream-save`: Sadece kendi kayıtlarını kontrol ediyor (`name + customerId + fileCategory`)
- `process-results`: metadata bazlı kontrol yapıyor (`vknTckn + beyannameTuru + year + month + fileCategory`)
- **İki sistem aynı dosya adı formatını kullanıyor** (`{VKN}_{TürKodu}_{Yıl}-{Ay}_BEYANNAME.pdf`) — bu iyi, ama her ikisi de karşı sistemin kayıtlarını `name` ile kontrol ederse çapraz dedup çalışır.

### 5. Klasör Duplikasyonu Riski

İki ayrı sistem (`process-results` ve `beyanname-stream-save`) aynı klasörleri oluşturmaya çalışırsa, `findFirst` → `create` pattern'inde race condition yaşanabilir. Documents tablosunda klasörler için unique constraint yok — aynı isimde birden fazla klasör oluşabilir.

---

## HEDEF KLASÖR YAPISI

```
Müşteri Kök Klasörü (parentId: null)
├── Beyannameler/                         ← TEK klasör (type: "beyanname")
│   ├── 2024/                             ← YIL klasörü (type: "FOLDER")
│   │   ├── KDV1/                         ← TÜR KODU klasörü (type: "FOLDER")
│   │   │   ├── 1234567890_KDV1_2024-01_BEYANNAME.pdf
│   │   │   ├── 1234567890_KDV1_2024-02_BEYANNAME.pdf
│   │   │   └── ... (12 aya kadar)
│   │   ├── MUHSGK/
│   │   │   ├── 1234567890_MUHSGK_2024-01_BEYANNAME.pdf
│   │   │   └── ...
│   │   └── GGECICI/
│   │       ├── 1234567890_GGECICI_2024-03_BEYANNAME.pdf
│   │       └── ...
│   ├── 2025/
│   │   ├── KDV1/
│   │   └── MUHSGK/
│   └── 2026/
│       ├── KDV1/
│       └── MUHSGK/
├── Tahakkuklar/                          ← AYNI YAPI (type: "tahakkuk")
│   ├── 2024/
│   │   ├── KDV1/
│   │   │   └── 1234567890_KDV1_2024-01_TAHAKKUK.pdf
│   │   └── ...
│   └── ...
└── SGK Tahakkuk ve Hizmet Listesi/       ← DEĞİŞMEYECEK (mevcut yapı korunacak)
    ├── Tahakkuk/
    │   └── 01/2025/
    └── Hizmet Listesi/
        └── 01/2025/
```

**Önemli:** Ay klasörü YOK — dosyalar doğrudan TürKodu klasöründe. Dosya adında ay bilgisi zaten mevcut (`_2024-01_`).

---

## ÇAPRAZ DUPLICATE DETECTION STRATEJİSİ

### Dosya Adı = Primary Key

Her iki sistem de **birebir aynı dosya adını** üretiyor:
```
{cleanVKN}_{cleanTürKodu}_{Yıl}-{Ay}_BEYANNAME.pdf
```

Bu dosya adı bir müşteri + beyanname türü + dönem için **benzersiz**.

### Detection Akışı

```
SENARYO 1: GİB bot önce çalıştı
────────────────────────────────
Bot → process-results → Kayıt: name="1234567890_KDV1_2026-02_BEYANNAME.pdf", parentId=KDV1FolderId
Sorgulama → stream-save → findFirst(name="1234567890_KDV1_2026-02_BEYANNAME.pdf") → BULDU → ATLA ✅

SENARYO 2: Sorgulama önce çalıştı
──────────────────────────────────
Sorgulama → stream-save → Kayıt: name="1234567890_KDV1_2026-02_BEYANNAME.pdf", parentId=KDV1FolderId
Bot → process-results → findFirst(name + metadata) → BULDU → ATLA ✅

SENARYO 3: Aynı anda (race condition)
──────────────────────────────────────
İkisi de findFirst → YOK → ikisi de create → biri başarılı, diğeri P2002* veya duplikat
*P2002 sadece unique constraint varsa fırlar — yoksa duplikat oluşur ama bu senaryo pratikte ÇOK NADİR
```

### Mevcut Duplicate Check Kodları (KORUNACAK + GENİŞLETİLECEK)

**beyanname-stream-save (satır 61-74) — ZATEN ÇAPRAZ ÇALIŞIYOR:**
```typescript
const existing = await prisma.documents.findFirst({
  where: {
    name: filename,           // Dosya adı her iki sistemde aynı
    customerId,
    tenantId: user.tenantId,
    fileCategory: "BEYANNAME",
  },
  select: { id: true },
});
if (existing) {
  return NextResponse.json({ success: true, beyoid, skipped: true });
}
```
Bu sorgu `name + customerId + fileCategory` ile arar — GİB bot'un kaydettiği dosyaları da BULUR çünkü aynı `name` ve `fileCategory: "BEYANNAME"` kullanılıyor. **Bu kodu değiştirmeye gerek yok.**

**beyanname-bulk-save (satır 84-99) — ZATEN ÇAPRAZ ÇALIŞIYOR:**
```typescript
const existingDocs = await prisma.documents.findMany({
  where: {
    customerId,
    tenantId: user.tenantId,
    fileCategory: "BEYANNAME",
    name: { in: allFilenames },
  },
  select: { name: true },
});
const existingSet = new Set(existingDocs.map((d) => d.name));
const toSave = enriched.filter((i) => !existingSet.has(i.filename));
```
Bu sorgu da `name + customerId + fileCategory` ile toplu kontrol yapıyor — GİB bot kayıtlarını da BULUR. **Bu kodu değiştirmeye gerek yok.**

**process-results (satır 271-298) — ZATEN ÇAPRAZ ÇALIŞIYOR:**
```typescript
existingDoc = await prisma.documents.findFirst({
  where: {
    tenantId,
    OR: [
      { vknTckn, beyannameTuru, year, month, fileCategory, fileIndex: fileIndex || null },
      { customerId, name: fileName }  // ← Bu satır sorgulama kayıtlarını da BULUR
    ]
  }
});
```
`OR` bloğundaki ikinci koşul `{ customerId, name: fileName }` — beyanname sorgulamanın kaydettiği dosyaları da BULUR. **Bu kodu değiştirmeye gerek yok.**

**SONUÇ:** Duplicate detection zaten çapraz çalışacak durumda çünkü her iki sistem de aynı dosya adı formatını ve aynı `fileCategory: "BEYANNAME"` değerini kullanıyor. Sadece klasör yapısı ve `parentId` düzeltilmeli.

---

## PAYLAŞILAN KLASÖR OLUŞTURMA FONKSİYONU

### Neden Paylaşılan?

İki ayrı sistem (`process-results` ve `beyanname-stream-save/bulk-save`) aynı klasörleri oluşturacak. Klasör oluşturma kodu her iki dosyada ayrı ayrı yazılırsa:
- Ufak farklılıklar duplikat klasör yaratır
- Bakım zorlaşır
- Race condition koruması tutarsız olur

### Çözüm: `src/lib/file-system.ts`'e Yeni Fonksiyonlar

`file-system.ts` zaten `ensureCustomerFolder`, `getOrCreateSubfolder` gibi klasör fonksiyonlarını barındırıyor. Yeni fonksiyonlar da buraya eklenecek.

### Eklenecek Fonksiyonlar

#### 1. `getOrCreateFolderSafe()` — Atomik Klasör Oluşturma

```typescript
/**
 * Race-condition-safe klasör oluşturma.
 * findFirst → create → P2002 catch → findFirst retry
 */
export async function getOrCreateFolderSafe(
  tenantId: string,
  customerId: string,
  parentId: string,
  name: string,
  type: string = "FOLDER",
  extraData?: { year?: number; month?: number }
): Promise<string> {
  // 1. Önce var mı bak
  const existing = await prisma.documents.findFirst({
    where: { tenantId, customerId, parentId, name, isFolder: true },
    select: { id: true }
  });
  if (existing) return existing.id;

  // 2. Yoksa oluştur
  try {
    const created = await prisma.documents.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        customerId,
        parentId,
        name,
        isFolder: true,
        type,
        size: 0,
        storage: "local",
        updatedAt: new Date(),
        ...extraData
      }
    });
    return created.id;
  } catch (e: any) {
    // 3. Race condition — başka bir request aynı anda oluşturduysa
    if (e.code === 'P2002' || e.message?.includes('Unique constraint')) {
      const found = await prisma.documents.findFirst({
        where: { tenantId, customerId, parentId, name, isFolder: true },
        select: { id: true }
      });
      if (found) return found.id;
    }
    throw e;
  }
}
```

#### 2. `ensureBeyannameFolderChain()` — Beyanname Klasör Hiyerarşisi

```typescript
/**
 * Beyanname/Tahakkuk klasör zinciri oluşturur.
 * Hiyerarşi: Müşteri Kök → Ana Klasör → Yıl → TürKodu
 * 
 * @returns TürKodu klasörünün ID'si (dosyalar buraya kaydedilecek)
 */
export async function ensureBeyannameFolderChain(
  tenantId: string,
  customerId: string,
  mainFolderName: "Beyannameler" | "Tahakkuklar",
  mainFolderType: "beyanname" | "tahakkuk",
  year: number,
  turKodu: string
): Promise<string> {
  // 1. Müşteri kök klasörünü bul
  const customerRoot = await prisma.documents.findFirst({
    where: { tenantId, customerId, isFolder: true, parentId: null },
    select: { id: true }
  });
  if (!customerRoot) {
    throw new Error(`Müşteri kök klasörü bulunamadı: ${customerId}`);
  }

  // 2. Ana klasör (Beyannameler veya Tahakkuklar)
  const mainFolderId = await getOrCreateFolderSafe(
    tenantId, customerId, customerRoot.id,
    mainFolderName, mainFolderType
  );

  // 3. Yıl klasörü (2024, 2025, 2026)
  const yearFolderId = await getOrCreateFolderSafe(
    tenantId, customerId, mainFolderId,
    String(year), "FOLDER",
    { year }
  );

  // 4. TürKodu klasörü (KDV1, MUHSGK, GGECICI)
  const cleanTurKodu = turKodu.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 15);
  const turKoduFolderId = await getOrCreateFolderSafe(
    tenantId, customerId, yearFolderId,
    cleanTurKodu, "FOLDER"
  );

  return turKoduFolderId;
}
```

#### 3. Module-Level Lock (Opsiyonel Ama Önerilen)

```typescript
// Aynı Node.js process içindeki concurrent request'ler için
const folderCreationLocks = new Map<string, Promise<string>>();

export async function ensureBeyannameFolderChainLocked(
  tenantId: string,
  customerId: string,
  mainFolderName: "Beyannameler" | "Tahakkuklar",
  mainFolderType: "beyanname" | "tahakkuk",
  year: number,
  turKodu: string
): Promise<string> {
  const cleanTurKodu = turKodu.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 15);
  const lockKey = `${tenantId}:${customerId}:${mainFolderName}:${year}:${cleanTurKodu}`;

  const existing = folderCreationLocks.get(lockKey);
  if (existing) return existing;

  const promise = ensureBeyannameFolderChain(
    tenantId, customerId, mainFolderName, mainFolderType, year, turKodu
  );
  folderCreationLocks.set(lockKey, promise);

  try {
    return await promise;
  } finally {
    folderCreationLocks.delete(lockKey);
  }
}
```

---

## ETKİLENECEK DOSYALAR

| # | Dosya | Değişiklik Türü | Detay |
|---|-------|----------------|-------|
| 1 | `src/lib/file-system.ts` | **YENİ FONKSİYONLAR** | `getOrCreateFolderSafe()`, `ensureBeyannameFolderChain()`, module-level lock |
| 2 | `src/app/api/intvrg/beyanname-stream-save/route.ts` | **DÜZENLEME** | Klasör zinciri oluştur + `parentId` ekle |
| 3 | `src/app/api/intvrg/beyanname-bulk-save/route.ts` | **DÜZENLEME** | Klasör zinciri oluştur + `parentId` ekle |
| 4 | `src/app/api/gib/process-results/route.ts` | **DÜZENLEME** | Hiyerarşi değişikliği: TürKodu→Ay/Yıl → Yıl→TürKodu, paylaşılan fonksiyona geç |

---

## UYGULAMA PLANI

### Adım 1: `src/lib/file-system.ts` — Paylaşılan Fonksiyonları Ekle

**Mevcut dosya:** 313 satır, mevcut fonksiyonlara dokunulmayacak.

**Eklenecekler (dosyanın sonuna):**

1. `getOrCreateFolderSafe()` fonksiyonu
   - Parametreler: `tenantId, customerId, parentId, name, type, extraData`
   - `findFirst` → `create` → P2002 catch → `findFirst` retry pattern
   - Tüm klasör oluşturma işlemleri için temel yapı taşı

2. `ensureBeyannameFolderChain()` fonksiyonu
   - Parametreler: `tenantId, customerId, mainFolderName, mainFolderType, year, turKodu`
   - 4 seviyeli hiyerarşi: Kök → Ana Klasör → Yıl → TürKodu
   - Dönen değer: TürKodu klasörünün ID'si (dosyalar buraya kaydedilecek)

3. `ensureBeyannameFolderChainLocked()` fonksiyonu (wrapper)
   - Module-level `Map<string, Promise<string>>` ile lock
   - Aynı process içindeki concurrent request'ler için tek bir promise paylaşılır
   - Lock key: `${tenantId}:${customerId}:${mainFolderName}:${year}:${cleanTurKodu}`

**Import gereksinimi:** `crypto` (zaten Node.js built-in), `prisma` (zaten `@/lib/db`'den import edilebilir — mevcut dosyada nasıl import edildiğini kontrol et).

- [ ] `getOrCreateFolderSafe()` fonksiyonunu yaz
- [ ] `ensureBeyannameFolderChain()` fonksiyonunu yaz
- [ ] `ensureBeyannameFolderChainLocked()` wrapper'ını yaz
- [ ] Mevcut `prisma` import'unu kontrol et, yoksa ekle

---

### Adım 2: `src/app/api/intvrg/beyanname-stream-save/route.ts` — parentId Ekle

**Mevcut dosya:** 237 satır

**Yapılacaklar:**

1. **Import ekle (satır 1-5 civarı):**
   ```typescript
   import { ensureBeyannameFolderChainLocked } from "@/lib/file-system";
   ```

2. **Klasör zincirini oluştur (satır 76-80 civarı, buffer kontrolünden sonra, create'den önce):**
   
   Mevcut kodda satır 76'da `buffer` kontrolü var, satır 80'de `storagePath` oluşturuluyor. `storagePath` ile `prisma.documents.create` arasına klasör oluşturma eklenecek:
   
   ```typescript
   // Satır 80'den sonra, create'den önce ekle:
   const targetFolderId = await ensureBeyannameFolderChainLocked(
     user.tenantId,
     customerId,
     "Beyannameler",
     "beyanname",
     year,
     turKodu
   );
   ```

3. **`parentId` ekle (satır 88-105, prisma.documents.create data objesi):**
   
   Mevcut `data` objesine `parentId: targetFolderId` ekle:
   ```typescript
   prisma.documents.create({
     data: {
       name: filename,
       // ... mevcut alanlar aynen korunacak ...
       customerId,
       tenantId: user.tenantId,
       parentId: targetFolderId,  // ← YENİ EKLENEN
     },
   })
   ```

**Duplicate check (satır 61-74):** Değişiklik YOK — mevcut `name + customerId + fileCategory` kontrolü zaten çapraz çalışıyor.

**Dosya adı formatı (satır 58-59):** Değişiklik YOK — format zaten doğru.

- [ ] `ensureBeyannameFolderChainLocked` import et
- [ ] Buffer kontrolünden sonra, create'den önce `ensureBeyannameFolderChainLocked()` çağrısı ekle
- [ ] `prisma.documents.create` data objesine `parentId: targetFolderId` ekle

---

### Adım 3: `src/app/api/intvrg/beyanname-bulk-save/route.ts` — parentId Ekle

**Mevcut dosya:** 319 satır

**Yapılacaklar:**

1. **Import ekle (satır 1-5 civarı):**
   ```typescript
   import { ensureBeyannameFolderChainLocked } from "@/lib/file-system";
   ```

2. **Klasör zincirini oluştur — HER ITEM İÇİN (satır 100-114 civarı):**
   
   Mevcut kodda `toSave` filtresi (satır 97-98) sonrası her item için `Promise.all` ile upload + create yapılıyor (satır 100-135). Her item'ın dönemini (year) ve türünü (turKodu) biliyoruz.
   
   Farklı item'lar farklı yıl ve türlerde olabilir. Her item için klasör zinciri oluşturulmalı:
   ```typescript
   // Her item için, upload öncesinde:
   const targetFolderId = await ensureBeyannameFolderChainLocked(
     user.tenantId,
     customerId,
     "Beyannameler",
     "beyanname",
     item.year,
     item.turKodu
   );
   ```
   
   **Optimizasyon notu:** `ensureBeyannameFolderChainLocked` zaten module-level lock kullanıyor. Aynı yıl+tür için birden fazla çağrı gelirse, sadece ilki klasör oluşturur, diğerleri aynı promise'i bekler. Bu yüzden `toSave` üzerinde map+Promise.all güvenli.

3. **`parentId` ekle (satır 115-132, prisma.documents.create data objesi):**
   ```typescript
   const docResult = await prisma.documents.create({
     data: {
       name: item.filename,
       // ... mevcut alanlar aynen korunacak ...
       customerId,
       tenantId: user.tenantId,
       parentId: targetFolderId,  // ← YENİ EKLENEN
     },
   });
   ```

**Duplicate check (satır 84-99):** Değişiklik YOK — mevcut toplu `name + customerId + fileCategory` kontrolü zaten çapraz çalışıyor.

- [ ] `ensureBeyannameFolderChainLocked` import et
- [ ] Her `toSave` item'ı için `ensureBeyannameFolderChainLocked()` çağrısı ekle
- [ ] `prisma.documents.create` data objesine `parentId: targetFolderId` ekle

---

### Adım 4: `src/app/api/gib/process-results/route.ts` — Hiyerarşiyi Değiştir

**Mevcut dosya:** ~900+ satır, `savePdfToSupabase()` fonksiyonu satır 228-548 arası.

**AMAÇ:** Mevcut inline klasör oluşturma kodunu paylaşılan `ensureBeyannameFolderChainLocked()` fonksiyonuyla değiştirmek. Bu sayede:
- Hiyerarşi otomatik olarak Yıl → TürKodu yapısına geçer
- Her iki sistem aynı fonksiyonu kullanır → aynı klasörlere yazar
- Duplikat klasör riski ortadan kalkar

**Yapılacaklar:**

1. **Import ekle (dosya başı):**
   ```typescript
   import { ensureBeyannameFolderChainLocked } from "@/lib/file-system";
   ```

2. **`savePdfToSupabase` içindeki Beyanname/Tahakkuk klasör oluşturma kodunu değiştir:**

   **ESKİ KOD (satır 345-471) — BEYANNAME ve TAHAKKUK için inline hiyerarşi:**
   ```
   Müşteri Kök (satır 315-340)
   → Ana Klasör: "Beyannameler"/"Tahakkuklar" (satır 345-370)
   → TürKodu klasörü: KDV1 (satır 449-456)
   → Ay/Yıl klasörü: 01/2025 (satır 460-467)
   targetParentId = monthYearFolder.id (satır 469)
   ```

   **YENİ KOD — Paylaşılan fonksiyonu çağır:**
   
   `fileType === "beyanname"` veya `fileType === "tahakkuk"` durumlarında:
   ```typescript
   const mainFolderName = fileType === "beyanname" ? "Beyannameler" : "Tahakkuklar";
   const mainFolderType = fileType === "beyanname" ? "beyanname" : "tahakkuk";
   
   targetParentId = await ensureBeyannameFolderChainLocked(
     tenantId,
     customerId,
     mainFolderName,
     mainFolderType,
     year,
     beyannameTuru
   );
   ```
   
   Bu tek çağrı, eski 345-471 arasındaki ~120 satırlık inline kodun Beyanname/Tahakkuk kısmını tamamen değiştirir.

3. **SGK klasör yapısına DOKUNMA:**
   
   `ensureSgkFolderStructure()` fonksiyonu (satır 99-216) ve `fileType === "sgkTahakkuk"` / `fileType === "hizmetListesi"` dalları **AYNEN KORUNACAK**. SGK yapısı farklı bir hiyerarşi kullanıyor ve kullanıcı bunu değiştirmek istemedi.
   
   SGK akışı:
   ```
   Müşteri Kök → SGK Tahakkuk ve Hizmet Listesi → Tahakkuk/Hizmet Listesi → Ay/Yıl → dosya
   ```
   Bu yapı mevcut haliyle kalacak.

4. **Müşteri Kök Klasörü:**
   
   Mevcut kodda müşteri kök klasörü `savePdfToSupabase` içinde bulunuyor (satır 315-340). `ensureBeyannameFolderChain` fonksiyonu da kök klasörü `findFirst` ile buluyor. Kök klasör oluşturma `ensureCustomerFolder()` tarafından zaten yapılıyor — ek bir şey gerekmiyor.
   
   **DİKKAT:** Eğer müşteri kök klasörü henüz oluşturulmamışsa, `ensureBeyannameFolderChain` hata fırlatır. Bu durumda `savePdfToSupabase` içindeki mevcut kök klasör oluşturma kodu (satır 323-340) **KORUNMALI** ve `ensureBeyannameFolderChainLocked` çağrısından ÖNCE çalışmalı.
   
   Alternatif: `ensureBeyannameFolderChain` fonksiyonunda kök klasör yoksa oluşturma mantığı da eklenebilir. Ama bu, fonksiyona `customerName` parametresi eklemeyi gerektirir. **Karar: Kök klasör oluşturma mevcut kodda kalsın, `ensureBeyannameFolderChain` sadece kök klasörü BULSUN.**

5. **Duplicate detection kodu (satır 271-298):**
   Değişiklik YOK — mevcut `OR` bloğu zaten çapraz çalışıyor.

6. **Dosya adı formatı (satır 253-264):**
   Değişiklik YOK — format doğru.

- [ ] `ensureBeyannameFolderChainLocked` import et
- [ ] Beyanname/Tahakkuk dallarında inline klasör oluşturma kodunu `ensureBeyannameFolderChainLocked()` çağrısıyla değiştir
- [ ] `targetParentId`'nin doğru atandığını doğrula
- [ ] SGK dalına DOKUNMA
- [ ] Müşteri kök klasörü oluşturma kodunu KORU (ensureBeyannameFolderChain'den ÖNCE çalışmalı)

---

## TEKNİK NOTLAR

### 1. Documents Schema — Unique Constraint Yok

```prisma
model documents {
  id              String   @id @default(uuid()) @db.Uuid
  name            String
  parentId        String?  @db.Uuid
  isFolder        Boolean  @default(false)
  // ... diğer alanlar
  
  @@index([parentId])
  @@index([tenantId, customerId])
  // ❌ Klasörler için unique constraint YOK
}
```

P2002 hatası `getOrCreateFolderSafe`'te yakalanıyor ama şu an fırlamaz çünkü unique constraint yok. Bu durumda `findFirst` → `create` pattern'i race condition'a karşı %100 güvenli değil — ama:
- Module-level lock aynı process içindeki concurrent request'leri korur
- `findFirst` → `create` arası milisaniye düzeyinde — farklı process'ler arası çarpışma pratikte ÇOK NADİR
- İleride unique constraint migration'ı ile tam garanti sağlanabilir

### 2. `beyanname-save/route.ts` Mevcut Değil

Dosya bulunamadı. Sadece `beyanname-stream-save` ve `beyanname-bulk-save` var.

### 3. Storage Path Değişmiyor

Her iki sistemde de `generateStoragePath()` (`src/lib/storage-supabase.ts`) kullanılıyor:
```
{tenantId}/{customerId}/{year}/{month}/{fileName}
```
Bu fiziksel Supabase Storage path'i değişmeyecek. Sadece documents tablosundaki `parentId` güncellenecek.

### 4. Dosya Adı Formatı Değişmiyor

Her iki sistem de aynı format:
```
{cleanVKN}_{cleanTürKodu}_{Yıl}-{Ay}_BEYANNAME.pdf
```
Cleaning kuralları:
- `cleanVKN`: `vknTckn.replace(/\D/g, '')`
- `cleanTürKodu`: `turKodu.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 15)`

### 5. GGECICI/KGECICI Çeyreklik Beyannameler

Eski yapıda çeyreklik beyannameler için özel ay/yıl klasör adı hesaplanıyordu (`10/2025-12/2025`). Yeni yapıda ay klasörü olmadığı için bu hesaplama gereksiz. Dosya adında ay bilgisi zaten var.

GGECICI beyannamesi dosya adı örneği: `1234567890_GGECICI_2025-12_BEYANNAME.pdf`
Bu dosya `2025 → GGECICI` klasöründe olacak.

### 6. `ensureCustomerFolder` ile Tutarlılık

`file-system.ts` (satır 68-84) `ensureCustomerFolder` fonksiyonunda 4 standart alt klasör oluşturuluyor:
```typescript
const STANDARD_SUBFOLDERS = [
  { name: "Banka Evrakları", icon: "bank", type: "banka" },
  { name: "Beyannameler", icon: "file-text", type: "beyanname" },
  { name: "Tahakkuklar", icon: "receipt", type: "tahakkuk" },
  { name: "SGK Tahakkuk ve Hizmet Listesi", icon: "shield", type: "sgk" }
];
```

`ensureBeyannameFolderChain` fonksiyonundaki `getOrCreateFolderSafe` "Beyannameler" klasörünü ararken `{ name: "Beyannameler", isFolder: true, parentId: customerRoot.id }` ile arar. `ensureCustomerFolder` tarafından oluşturulan "Beyannameler" klasörünü BULUR çünkü aynı isim ve aynı parent. **Tutarlılık sağlanmış.**

### 7. Tahakkuklar İçin Aynı Yapı

Kullanıcı sadece "Beyannameler"den bahsetse de, `process-results` Tahakkuk dosyaları için de aynı hiyerarşiyi kullanıyor. Yeni yapıda Tahakkuklar da `Yıl → TürKodu` şeklinde olacak:
```
Tahakkuklar/
  2026/
    KDV1/
      1234567890_KDV1_2026-02_TAHAKKUK.pdf
```

`ensureBeyannameFolderChain` fonksiyonu `mainFolderName` parametresi sayesinde hem "Beyannameler" hem "Tahakkuklar" için çalışır.

### 8. Eski Kayıtlarla Uyumluluk

- Eski kayıtlar (parentId: null veya eski hiyerarşi) yerinde kalacak
- Yeni kayıtlar doğru hiyerarşide oluşturulacak
- Dosya ağacında eski ve yeni yapılar bir süre birlikte var olacak
- İleriye dönük fix — migrasyon planlanmadı

---

## KARARLAR VE GEREKÇELERİ

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Hiyerarşi: Yıl → TürKodu (ay klasörü yok) | Kullanıcı açıkça bu yapıyı istedi | TürKodu → Ay/Yıl (mevcut, kullanıcı istemedi) |
| Paylaşılan fonksiyon (`file-system.ts`) | İki sistem aynı fonksiyonu çağırır → aynı klasörlere yazar → duplikat klasör imkansız | Her dosyada ayrı inline kod (duplikat klasör riski, bakım zorluğu) |
| Module-level lock + findFirst/create | Aynı process içi: lock korur. Farklı process: findFirst zaten bulur. Pratikte yeterli güvenlik | DB unique constraint (migration gerekir, mevcut duplikatlar patlattırır) |
| Duplicate detection değişiklik YOK | Mevcut `name + customerId + fileCategory` kontrolü zaten çapraz çalışıyor | Ek metadata kontrolü (gereksiz karmaşıklık) |
| SGK yapısına dokunulmuyor | Kullanıcı sadece Beyannameler'den bahsetti, SGK farklı klasör altında | SGK de değiştirilebilirdi ama scope artardı |
| İleriye dönük fix (migrasyon yok) | Kullanıcı onayladı — A seçeneği | Migrasyon dahil (B seçeneği — riskli, ek geliştirme) |

---

## UYGULAMA SIRASI VE BAĞIMLILIKLAR

```
Adım 1: file-system.ts (bağımsız)
  ↓
Adım 2: beyanname-stream-save (Adım 1'e bağımlı)
Adım 3: beyanname-bulk-save (Adım 1'e bağımlı) — 2 ve 3 paralel yapılabilir
  ↓
Adım 4: process-results (Adım 1'e bağımlı, 2-3'ten bağımsız)
  ↓
Test: Manuel test — her iki sistemle sorgulama yapıp dosyaların doğru klasöre girdiğini doğrula
```

---

## TEST PLANI

### Manuel Test 1: Beyanname Sorgulama (/beyannameler)
1. `/dashboard/beyannameler` sayfasına git
2. Bir müşteri için 2026 yılı KDV1 beyannamesi sorgula
3. `/dashboard/dosyalar` sayfasına git
4. İlgili müşterinin klasöründe `Beyannameler → 2026 → KDV1 → dosya.pdf` yapısını doğrula
5. Dosyanın müşteri klasörünün dışında (en alta) olMADIĞINI doğrula

### Manuel Test 2: GİB Bot Senkronizasyonu (/beyanname-kontrol)
1. `/dashboard/beyanname-kontrol` sayfasına git
2. Aynı müşteri için aynı dönem beyanname senkronizasyonu yap
3. `/dashboard/dosyalar` sayfasında aynı klasör yapısını doğrula
4. Dosyanın `Beyannameler → 2026 → KDV1` altında olduğunu doğrula

### Manuel Test 3: Çapraz Duplicate Detection
1. Önce `/beyannameler`'den bir beyanname sorgula (dosya kaydedilir)
2. Sonra `/beyanname-kontrol`'den aynı müşteri + aynı dönem + aynı tür senkronize et
3. Dosyanın TEK KOPYA olduğunu doğrula (duplikat oluşmadı)
4. Ters sırayla da test et (önce bot, sonra sorgulama)

### Manuel Test 4: Birden Fazla Dönem
1. `/beyannameler`'den bir müşteri için 2024-2026 arası çoklu yıl sorgula
2. Klasör yapısında her yıl için ayrı klasör oluştuğunu doğrula
3. Her yıl klasörü altında tür klasörlerinin doğru oluştuğunu doğrula

### Manuel Test 5: Toplu Kayıt (bulk-save)
1. `/beyannameler`'den toplu sorgulama yap (birden fazla tür + dönem)
2. Tüm dosyaların doğru klasör hiyerarşisine girdiğini doğrula
3. Duplikat klasör oluşmadığını doğrula
