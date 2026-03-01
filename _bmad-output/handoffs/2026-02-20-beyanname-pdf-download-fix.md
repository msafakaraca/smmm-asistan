# Handoff: Beyanname PDF İndirme Sorunu + Archive Performance Fix
**Tarih:** 2026-02-20
**Durum:** Kısmen Tamamlandı → Adım 2 (beyoid mapping) için log bekleniyor

---

## Görev Tanımı

İki sorun:
1. `POST /api/query-archives` 3561ms sürüyor — çok yavaş
2. 454 beyanname `query_archives` tablosuna kaydediliyor ama PDF'ler indirilmiyor → ikon gri kalıyor

---

## Araştırma Bulguları

### Sorun 1 — PDF İndirilmiyor (KRİTİK)

**Root Cause:** `beyoid` field'ı GİB API'sinden boş geliyor (muhtemelen field adı yanlış map ediliyor).

**Cascade failure zinciri:**
```
beyoid = ''
  → beyanname-client.tsx'de: withBeyoid = beyannameler.filter(b => b.beyoid) → length = 0
  → if (withBeyoid.length > 0) koşulu sağlanmaz
  → downloadAll() hiç çağrılmaz
  → intvrg:beyanname-bulk-download komutu bota hiç gönderilmez
  → DOWNLOAD_COMPLETE dispatch edilmez
  → allComplete = false sonsuza kadar
  → <BeyannameTable> hiç render edilmez
  → Sorgula butonu disabled (queryDone && !allComplete)
  → Kullanıcı sıkışır
```

**Bot log kanıtı:**
```
[INTVRG-TOKEN] Multi-query IVD token cache'lendi ✅ (token VAR)
[INTVRG-MULTI] Tamamlandı: toplam 454 beyanname ✅
[WS] 📨 intvrg:beyanname-multi-complete ✅
[WS] 📨 intvrg:beyanname-query ← yeni deneme, bulk-download HİÇ YOK
```

**Token cache'de sorun yok** — `ivdTokenCache.set()` çağrılıyor. Sorun tamamen `beyoid` boş geldiği için.

**Mevcut mapping (`intvrg-beyanname-api.ts` satır ~252-260):**
```typescript
beyoid: item.beyoid || '',  // ← item.beyoid undefined olabilir
```

GİB API farklı field adı döndürüyor olabilir: `beyannameOid`, `beyannameoid`, `BEYANNAMEOID`, `beyanname_oid` vb.

**Debug için eklenmesi gereken log (henüz eklenmedi, kullanıcı debuglamak için ekleyecek):**
```typescript
if (rawBeyannameler.length > 0) {
  console.log('[BEYOID-DEBUG] Raw item keys:', Object.keys(rawBeyannameler[0]));
  console.log('[BEYOID-DEBUG] Raw item[0]:', JSON.stringify(rawBeyannameler[0]));
}
```

---

### Sorun 2 — UI Donma (beyoid boş olduğunda)

`beyanname-client.tsx` satır 554-575'te auto-download effect:

```typescript
// Mevcut kod
if (withBeyoid.length > 0) {
  downloadAll(selectedCustomerId, withBeyoid);
}
// withBeyoid.length === 0 ise hiçbir şey olmaz → allComplete asla true olmaz
```

**Fix:** `withBeyoid.length === 0` olsa bile `ALL_COMPLETE` dispatch et, tablo görünsün.

---

### Sorun 3 — POST /api/query-archives Yavaşlığı (3561ms)

**Neden yavaş:**
- Her POST'ta `getUserWithProfile()` → Supabase auth round-trip (~300-500ms)
- `prisma.customers.findFirst()` customer kontrolü → gereksiz ikinci DB sorgusu (~200-300ms)
- Transaction (findUnique + update/create büyük JSON) (~500-1000ms)
- Supabase remote DB latency (~200-500ms)

**Ek sorun:** `beyanname-client.tsx`'de her ay grubu için ayrı `saveOrMerge` çağrısı (fire-and-forget paralel ama her biri yavaş).

**Hızlı fix:** `route.ts`'deki customer kontrolünü kaldır — auth zaten tenantId sağlıyor.

---

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Öncelik |
|-------|-----------|---------|
| `electron-bot/src/main/intvrg-beyanname-api.ts` | beyoid field mapping fix | 🔴 KRİTİK |
| `src/components/beyannameler/beyanname-client.tsx` | allComplete dispatch when no beyoid | 🔴 KRİTİK |
| `src/app/api/query-archives/route.ts` | customer check kaldır | 🟡 ORTA |

---

## Uygulama Planı

### Adım 1: beyoid field adını tespit et (ÖNCE YAP)

`electron-bot/src/main/intvrg-beyanname-api.ts` — `queryBeyannameler` fonksiyonu içinde (satır ~359):

```typescript
const rawBeyannameler = result.data?.beyanname?.beyanname || [];
// DEBUG: Geçici log ekle
if (rawBeyannameler.length > 0) {
  console.log('[BEYOID-DEBUG] Keys:', Object.keys(rawBeyannameler[0]));
  console.log('[BEYOID-DEBUG] Sample:', JSON.stringify(rawBeyannameler[0]));
}
```

Aynı şeyi multi-year sorguda da yap (`queryBeyannamelerMultiYear` fonksiyonu, ~satır 244):

```typescript
const rawBeyannameler = result.data?.beyanname?.beyanname || [];
if (rawBeyannameler.length > 0) {
  console.log('[BEYOID-DEBUG-MULTI] Keys:', Object.keys(rawBeyannameler[0]));
  console.log('[BEYOID-DEBUG-MULTI] Sample:', JSON.stringify(rawBeyannameler[0]));
}
```

Bot'u yeniden derle, tek mükellef için 1 yıl sorgula, log'a bak.

### Adım 2: beyoid mapping'i düzelt

Log'dan gerçek field adını öğrendikten sonra:

```typescript
// intvrg-beyanname-api.ts satır ~252 ve ~370
// Önce: beyoid: item.beyoid || '',
// Sonra (gerçek field adına göre):
beyoid: item.GERCEK_FIELD_ADI || item.beyoid || '',
```

Her iki yerde de aynı fix (hem `queryBeyannameler` hem `queryBeyannamelerMultiYear`).

### Adım 3: UI donma fix'i

`src/components/beyannameler/beyanname-client.tsx` satır ~564-574:

```typescript
// Mevcut
const withBeyoid = beyannameler.filter((b) => b.beyoid);
if (withBeyoid.length > 0) {
  downloadAll(selectedCustomerId, withBeyoid);
}

// Düzeltilmiş
const withBeyoid = beyannameler.filter((b) => b.beyoid);
if (withBeyoid.length > 0) {
  downloadAll(selectedCustomerId, withBeyoid);
} else {
  // PDF indirilemez ama tablo gösterilsin
  dispatch({ type: "ALL_COMPLETE" });
}
```

**NOT:** `dispatch` doğrudan kullanılamıyor — `clearResults` hook'tan geliyor. Bunun yerine ya hook'a `markComplete` fonksiyonu ekle, ya da `downloadAll` 0 item ile çağrıldığında `ALL_COMPLETE` dispatch etsin:

`src/components/beyannameler/hooks/use-beyanname-query.ts` satır ~685-688:

```typescript
const downloadAll = useCallback(
  async (customerId: string, beyannameler: BeyannameItem[]) => {
    if (state.downloadProgress?.isDownloading) return;
    if (beyannameler.length === 0) return;

    const toDownload = beyannameler.filter(
      (b) => b.beyoid && !state.savedBeyoids.includes(b.beyoid)
    );

    if (toDownload.length === 0) {
      toast.info("Tüm beyannameler zaten kaydedilmiş");
      dispatch({ type: "ALL_COMPLETE" });
      return;
    }
```

Ve `beyanname-client.tsx`'deki auto-download:

```typescript
const withBeyoid = beyannameler.filter((b) => b.beyoid);
// withBeyoid boşsa downloadAll'a boş gönder → ALL_COMPLETE dispatch edilir
downloadAll(selectedCustomerId, withBeyoid);
// if (withBeyoid.length > 0) koşulunu kaldır
```

### Adım 4: Archive POST performans fix'i

`src/app/api/query-archives/route.ts` satır ~206-218 — customer kontrolünü kaldır:

```typescript
// KALDIR: Bu blok gereksiz (auth zaten tenantId sağlıyor)
// const customer = await prisma.customers.findFirst({
//   where: { id: customerId, tenantId: user.tenantId },
//   select: { id: true },
// });
// if (!customer) {
//   return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
// }
```

---

## Teknik Notlar

### IVD Token Cache — SORUN DEĞİL
`ivdTokenCache` doğru çalışıyor. Log'da `[INTVRG-TOKEN] Multi-query IVD token cache'lendi` görünüyor. Token TTL 25 dakika (`IVD_TOKEN_TTL = 25 * 60 * 1000`). Sorun token'da değil, `beyoid` field adında.

### Arşiv Kayıt — ÇALIŞIYOR
`query_archives` tablosuna kayıt oluyor (454 kayıt). Bu `beyoid` olmadan da kaydediliyor çünkü `resultData` tüm beyanname JSON'ını saklıyor. Sorun sadece PDF indirme adımında.

### Archive Page Icon — NEDEN GRİ
`beyanname-arsiv-client.tsx` satır ~406:
```typescript
{b.beyoid ? (<Eye green/>) : (<Eye gray/>)}
```
`b.beyoid` boş string → falsy → gri ikon. `beyoid` fix'i uygulandıktan sonra arşivdeki ikonlar da düzelecek (yeniden sorgu yapılınca).

### Multi-Year Query Çift Map
`beyoid` mapping hem `queryBeyannameler` (~satır 370) hem de `queryBeyannamelerMultiYear` (~satır 252) içinde ayrı ayrı var. İkisini de fix etmek gerekiyor!

### Hook'ta `dispatch` Erişimi
`beyanname-client.tsx`'de `dispatch` doğrudan yok — `useReducer`'ın dispatch'i `use-beyanname-query.ts` içinde. En temiz çözüm: `downloadAll`'u 0-item case'i handle edecek şekilde düzenlemek (Adım 3'te açıklandı).

---

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatif |
|-------|-------|------------|
| Debug log ekle, sonra fix yap | Gerçek field adı bilinmiyor | Tüm olası adları dene (riskli) |
| `downloadAll` 0-item ALL_COMPLETE dispatch etsin | En az değişiklik, temiz | Hook'a yeni fonksiyon ekle |
| Customer check kaldır | Gereksiz DB sorgusu, auth yeterli | Önbelleğe al |

---

## Uygulama Sırası

```
1. Adım 1: Debug log ekle → bot derle → sorgula → field adını öğren
2. Adım 2: beyoid mapping fix (her iki yerde)
3. Adım 3: UI donma fix (downloadAll + beyanname-client)
4. Adım 4: Archive POST fix (customer check kaldır)
5. Test: Bir mükellef sorgusu → PDF ikonları yeşil mi?
```
