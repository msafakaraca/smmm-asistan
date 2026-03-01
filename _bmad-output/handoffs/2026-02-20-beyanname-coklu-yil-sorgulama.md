# Handoff: Beyanname Çoklu Yıl Sorgulama Desteği
**Tarih:** 2026-02-20 14:00
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor

## Görev Tanımı
> Beyanname sorgulama sayfasında (`/dashboard/beyannameler`) çoklu yıl arama desteği eklenmesi. Kullanıcı Ocak 2022 - Aralık 2025 gibi geniş bir tarih aralığı seçtiğinde, Electron Bot yıl bazlı chunk'lara bölerek sırasıyla her yılı sorgulamalı, tüm beyanname linklerini toplamalı ve en sonunda toplu PDF indirmesi yapmalı.
>
> **GİB API Kısıtı:** İnternet Vergi Dairesi (INTVRG) tek sorguda en fazla 12 aylık aralığı (1 yıl) destekler. Daha geniş aralıklar "Seçilen dönem aralığı bir yıldan fazla olamaz!" hatası verir.

## Araştırma Bulguları

### Mevcut Durum
- Frontend 4 dropdown ile dönem seçimi yapıyor (basAy, basYil, bitAy, bitYil)
- `YEARS` sabiti son 5 yılı sunuyor (satır 70): `Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)`
- `startQuery()` hook fonksiyonu parametreleri direkt API'ye gönderiyor
- API route (`/api/intvrg/beyanname`) parametreleri olduğu gibi bot'a iletiyor
- Bot handler (`intvrg:beyanname-query`) tek sorgu yapıyor, yıl chunk'lama yok
- Bot IVD token'ı 25 dk cache'liyor (`ivdTokenCache`, `IVD_TOKEN_TTL = 25 * 60 * 1000`)
- Toplu PDF indirme ayrı handler (`intvrg:beyanname-bulk-download`), cache'deki token'ı kullanıyor
- Arşiv sistemi `donem` string'inden yıl/ay parse edip `/{tenantId}/{customerId}/beyannameler/{year}/` altına kaydediyor — bu kısım zaten çoklu yılı destekler

### İlgili Dosyalar ve Satır Numaraları
| Dosya | Satırlar | Rolü |
|-------|----------|------|
| `src/components/beyannameler/beyanname-client.tsx` | 70 (YEARS), 91-107 (getDefaultPeriod), 209-911 (component) | UI + dönem seçimi |
| `src/components/beyannameler/hooks/use-beyanname-query.ts` | 24-71 (types), 86-106 (actions), 256-606 (hook) | State yönetimi + WS event'leri |
| `src/app/api/intvrg/beyanname/route.ts` | 1-200 | Sorgu API route |
| `src/app/api/intvrg/beyanname-bulk-download/route.ts` | 1-111 | Toplu indirme API route |
| `electron-bot/src/main/intvrg-beyanname-api.ts` | 42-52 (params), 130-221 (queryBeyannameler) | Bot sorgu fonksiyonu |
| `electron-bot/src/main/index.ts` | 1100-1101 (token cache), 1106-1242 (query handler), 1247-1349 (bulk handler) | Bot WebSocket handler'ları |

### Mevcut Pattern'ler
- WS event isimlendirme: `intvrg:beyanname-{action}` (progress, results, complete, error, bulk-pdf-result, bulk-pdf-skip, bulk-complete, bulk-error)
- Bot'ta `activeBeyannameQueries` Map ile duplikasyon önleme
- Frontend'de `pdfBufferRef` ile PDF'ler belleğe alınıp `bulk-complete`'te toplu flush
- `requesterId` ile kullanıcı bazlı mesaj filtreleme

## Etkilenecek Dosyalar

| Dosya | Değişiklik | Detay |
|-------|-----------|-------|
| `electron-bot/src/main/index.ts` | Düzenleme | Yeni `intvrg:beyanname-multi-query` handler (yıl bazlı chunk, sıralı sorgu, token yönetimi) |
| `electron-bot/src/main/intvrg-beyanname-api.ts` | Düzenleme | `splitIntoYearChunks()` helper + `queryBeyannamelerMultiYear()` orchestrator fonksiyonu |
| `src/components/beyannameler/hooks/use-beyanname-query.ts` | Düzenleme | Yeni action'lar (MULTI_QUERY_CHUNK_RESULTS, MULTI_QUERY_PROGRESS, MULTI_QUERY_COMPLETE), yeni WS event listener'ları, `startQuery` mantığı |
| `src/components/beyannameler/beyanname-client.tsx` | Düzenleme | Çoklu yıl progress UI, YEARS sabitini genişletme, yıl bazlı sonuç gruplama |
| `src/app/api/intvrg/beyanname/route.ts` | Düzenleme | Çoklu yıl aralığını algılama, `intvrg:beyanname-multi-query` komut tipi gönderme |

**Arşiv sistemi (beyanname-bulk-save, beyanname-save) DEĞİŞMEYECEK** — mevcut yıl klasörleme zaten çalışır.

## Uygulama Planı

### Adım 1: Electron Bot — `splitIntoYearChunks` + `queryBeyannamelerMultiYear` (intvrg-beyanname-api.ts)

- [ ] `splitIntoYearChunks(basAy, basYil, bitAy, bitYil)` helper fonksiyonu ekle
  - Giriş: `("03", "2022", "11", "2025")`
  - Çıkış: `[{basAy:"03", basYil:"2022", bitAy:"12", bitYil:"2022"}, {basAy:"01", basYil:"2023", bitAy:"12", bitYil:"2023"}, {basAy:"01", basYil:"2024", bitAy:"12", bitYil:"2024"}, {basAy:"01", basYil:"2025", bitAy:"11", bitYil:"2025"}]`
  - Eğer tek yıl ise (basYil === bitYil) → chunk yok, direkt döndür
  - İlk yıl: basAy/basYil → 12/basYil (kısmi)
  - Ara yıllar: 01/yil → 12/yil (tam)
  - Son yıl: 01/bitYil → bitAy/bitYil (kısmi)

- [ ] `queryBeyannamelerMultiYear()` orchestrator fonksiyonu ekle
  - Parametre: `params` (credentials + tarih aralığı) + `onChunkProgress` + `onChunkResults` + `onAllComplete` callback'leri
  - Akış:
    1. `splitIntoYearChunks()` ile chunk'lara böl
    2. İlk chunk için `gibDijitalLogin()` + `getIvdToken()` yap
    3. Her chunk sırasıyla:
       - Token TTL kontrol → 5 dk'dan az kaldıysa yeniden login + token al
       - `IntrvrgClient.callDispatch()` ile sorgu yap
       - `onChunkResults(chunkIndex, totalChunks, year, beyannameler)` çağır
       - Tüm beyannameleri `allItems[]`'e ekle
       - Chunk arası 2 sn bekleme (GİB rate-limit koruması)
    4. Tüm chunk'lar bittikten sonra `onAllComplete(allItems, ivdToken)` çağır
  - Return: `{ success, allBeyannameler, ivdToken }`

### Adım 2: Electron Bot — `intvrg:beyanname-multi-query` handler (index.ts)

- [ ] Satır ~1106 civarına yeni handler ekle: `wsClient.on('intvrg:beyanname-multi-query', ...)`
- [ ] Mevcut `activeBeyannameQueries` Map'ini multi-query için de kullan
- [ ] Handler akışı:
  1. `queryBeyannamelerMultiYear()` çağır
  2. `onChunkProgress` callback'inden → `intvrg:beyanname-multi-progress` WS event'i gönder (`{ chunkIndex, totalChunks, year, status, customerName, requesterId }`)
  3. `onChunkResults` callback'inden → `intvrg:beyanname-multi-chunk-results` WS event'i gönder (`{ chunkIndex, totalChunks, year, beyannameler, customerName, requesterId }`)
  4. `onAllComplete` callback'inden → IVD token'ı cache'le, `intvrg:beyanname-multi-complete` WS event'i gönder (`{ totalCount, allBeyannameler, customerName, requesterId }`)
  5. Hata durumunda → `intvrg:beyanname-error` gönder (mevcut hata event'ini kullan)
- [ ] Timeout: chunk sayısı × 3 dakika (ör. 4 chunk = 12 dk timeout)

### Adım 3: API Route Güncelleme (beyanname/route.ts)

- [ ] Çoklu yıl tespiti: `basYil !== bitYil` ise → komut tipi `intvrg:beyanname-multi-query` olsun
- [ ] Tek yıl ise → mevcut `intvrg:beyanname-query` komutunu kullanmaya devam et
- [ ] Değişiklik minimal: sadece `type` field'ını koşullu yap (satır 164)

### Adım 4: Frontend Hook Güncellemesi (use-beyanname-query.ts)

- [ ] Yeni Action türleri ekle:
  ```typescript
  | { type: "MULTI_PROGRESS"; payload: { chunkIndex: number; totalChunks: number; year: string; status: string } }
  | { type: "MULTI_CHUNK_RESULTS"; payload: { chunkIndex: number; totalChunks: number; year: string; beyannameler: BeyannameItem[] } }
  | { type: "MULTI_COMPLETE"; payload: { totalCount: number } }
  ```

- [ ] State'e yeni alanlar ekle:
  ```typescript
  multiQueryProgress: {
    isMultiYear: boolean;
    currentChunk: number;
    totalChunks: number;
    currentYear: string;
    completedYears: { year: string; count: number }[];
  } | null;
  ```

- [ ] Reducer case'leri ekle:
  - `MULTI_PROGRESS`: `multiQueryProgress` güncelle
  - `MULTI_CHUNK_RESULTS`: beyannameleri mevcut listeye **append** et (biriktir), completedYears'a ekle
  - `MULTI_COMPLETE`: `queryDone = true`, `isLoading = false` yap → otomatik bulk-download tetiklenir

- [ ] WebSocket `onmessage`'e yeni event listener'lar ekle:
  - `intvrg:beyanname-multi-progress` → `MULTI_PROGRESS` dispatch
  - `intvrg:beyanname-multi-chunk-results` → `MULTI_CHUNK_RESULTS` dispatch (beyannameleri biriktir)
  - `intvrg:beyanname-multi-complete` → `MULTI_COMPLETE` dispatch + toast

- [ ] Return'e `multiQueryProgress` ekle

### Adım 5: Frontend UI Güncellemesi (beyanname-client.tsx)

- [ ] `YEARS` sabitini 10 yıla genişlet (satır 70):
  ```typescript
  const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);
  ```

- [ ] Çoklu yıl uyarı banner'ı ekle — `basYil !== bitYil` olduğunda:
  ```
  ⓘ Çoklu yıl sorgulaması: [basAy/basYil] - [bitAy/bitYil] arasındaki beyannameler yıl bazında sırasıyla sorgulanacak.
  ```

- [ ] Çoklu yıl progress bileşeni ekle — `multiQueryProgress` varken göster:
  ```
  📊 Beyanname Sorgulanıyor (2/4)
  ████████████░░░░░░░░░░░ %50

  ✅ 2022: 42 beyanname bulundu
  🔄 2023: Sorgulanıyor...
  ⏳ 2024: Bekliyor
  ⏳ 2025: Bekliyor
  ```

- [ ] Mevcut tek yıl progress'i koruyarak, `multiQueryProgress` null ise eski UI, doluysa yeni çoklu yıl UI göster

- [ ] Sonuçlar kısmında beyannameler zaten `allComplete` sonrası gösteriliyor — mevcut tablo ve filtre sistemi çoklu yılı otomatik destekler çünkü tüm beyannameler tek `beyannameler[]` array'inde birikiyor

- [ ] İptal butonu: `isLoading` durumunda "İptal Et" butonu göster (nice-to-have, ilk versiyon için opsiyonel)

## Teknik Notlar

### GİB API Kısıtı
- İnternet Vergi Dairesi tek sorguda en fazla 1 yıl (12 ay) kabul ediyor
- `basDonem` ve `bitDonem` arası 12 aydan fazla olursa hata döndürüyor
- Çözüm: Yıl bazlı chunk'lara bölme (frontend'de değil, bot tarafında)

### Token Yönetimi
- GİB IVD token'ı ~30 dk geçerli, cache TTL 25 dk
- 4 yıllık sıralı sorgu: ~30-60 sn (sorun değil)
- 150+ PDF indirme: 5-10 dk (token expire riski var)
- **Çözüm:** Her chunk öncesi token TTL kontrol, 5 dk'dan az kaldıysa re-login
- Bulk-download başlamadan önce token cache güncelleniyor (son sorgunun token'ı)

### Bellek ve Performans
- Mevcut `pdfBufferRef` pattern'i korunacak — tüm PDF'ler buffer'da birikip `bulk-complete`'te flush
- 300+ PDF için bellek: ~300 × 200KB = ~60MB buffer (kabul edilebilir)
- Chunk arası 2 sn delay: GİB rate-limit koruması

### Edge Case'ler
- Tek yıl seçimi (basYil === bitYil): mevcut akış, `intvrg:beyanname-query` kullanılır, hiçbir şey değişmez
- Başlangıç tarihi > Bitiş tarihi: frontend'de validasyon ekle
- Ortadaki bir chunk hata verirse: hatayı logla, diğer chunk'lara devam et, kısmi sonuçları koru
- Token expire olursa re-login: yeni captcha çözümü gerekecek (OCR/2Captcha)

### Geriye Uyumluluk
- Mevcut tek yıl akışı (`intvrg:beyanname-query`) KORUNACAK
- API route basYil === bitYil ise eski komutu, farklıysa yeni komutu gönderecek
- Frontend eski WS event'lerini dinlemeye devam edecek + yeni event'leri de dinleyecek
- Arşiv sistemi hiç değişmeyecek

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| Chunk'lama bot tarafında | Token yönetimi ve GİB iletişimi zaten bot'ta | Frontend'de chunk'lama (daha karmaşık) |
| Yıl bazlı chunk | GİB maks 12 ay sınırı, en doğal bölme | Aylık chunk (çok fazla sorgu, gereksiz) |
| Sıralı sorgu | GİB rate-limit riski | Paralel (ban riski) |
| Tüm linkler toplandıktan sonra toplu PDF indirme | Tek token ile tüm PDF'ler, mevcut bulk altyapı çalışır | Yıl bazlı PDF indirme (daha karmaşık) |
| Mevcut tek yıl akışını koruma | Geriye uyumluluk, en yaygın kullanım senaryosu | Tüm sorguları multi-query'ye yönlendirme |
| Yeni WS event isimleri (multi-*) | Mevcut event'lerle çakışma önleme | Mevcut event'leri payload ile ayırma |
