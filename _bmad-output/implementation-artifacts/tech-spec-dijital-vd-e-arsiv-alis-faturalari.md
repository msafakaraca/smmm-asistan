---
title: 'Dijital VD E-Arşiv Alış Faturaları Sorgulama'
slug: 'dijital-vd-e-arsiv-alis-faturalari'
created: '2026-02-12'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 15', 'React 19', 'TypeScript 5.7', 'Electron', 'WebSocket', 'TanStack Virtual', 'XLSX', 'Radix UI', 'TailwindCSS 4', 'Lucide Icons']
files_to_modify:
  - 'electron-bot/src/main/earsiv-dijital-api.ts (YENİ)'
  - 'electron-bot/src/main/index.ts (DÜZENLE — earsiv:query handler ekle)'
  - 'server.ts (DÜZENLE — earsiv:* mesaj routing ekle)'
  - 'src/lib/gib-api/endpoints.ts (DÜZENLE — EARSIV endpoint ekle)'
  - 'src/app/api/earsiv/query/route.ts (YENİ)'
  - 'src/app/(dashboard)/dashboard/e-arsiv-fatura/page.tsx (YENİ)'
  - 'src/components/e-arsiv-fatura/e-arsiv-fatura-page.tsx (YENİ)'
  - 'src/components/e-arsiv-fatura/e-arsiv-fatura-table.tsx (YENİ)'
  - 'src/components/e-arsiv-fatura/hooks/use-e-arsiv-query.ts (YENİ)'
  - 'src/components/dashboard/nav.tsx (DÜZENLE — menü öğesi ekle)'
code_patterns:
  - 'Electron Event Handler: wsClient.on(event, async (data) => { ... wsClient.send(responseEvent, result) })'
  - 'WebSocket Relay: server.ts handleMessage switch-case → broadcastToTenant(tenantId, message)'
  - 'Bot Command Flow: API POST → /_internal/bot-command → broadcastToTenant → Electron wsClient.on()'
  - 'Auth Guard: getUserWithProfile() + tenantId filter'
  - 'Credential Decrypt: decrypt(customer.gibKodu), decrypt(customer.gibSifre)'
  - 'Virtual Table: useVirtualizer + React.memo + sticky header'
  - 'Nav: navItems array { title, href, icon, children? }'
  - 'Dynamic Import: const { module } = await import(path)'
test_patterns: []
---

# Tech-Spec: Dijital VD E-Arşiv Alış Faturaları Sorgulama

**Created:** 2026-02-12

## Overview

### Problem Statement

Mali müşavirler, mükelleflerin e-Arşiv alış faturalarını kontrol etmek için GİB Dijital Vergi Dairesi portalına (`dijital.gib.gov.tr`) tek tek giriş yapıp, 7 günlük dilimlerle manuel sorgulama yapmak zorunda kalıyor. Her mükellef için ayrı giriş, ayrı tarih filtreleri, ayrı sorgu — bu ciddi zaman kaybı yaratıyor. Mali müşavirin asıl amacı bu faturaları Luca veya diğer muhasebe programları ile çapraz kontrol yapmak, ancak mevcut süreç buna engel oluyor.

### Solution

Electron Bot üzerinden GİB Dijital Vergi Dairesi API'sine (`POST /apigateway/api/earsiv/alici-list`) doğrudan HTTP çağrısı yaparak:
- Mükellef seçilir, 1 aylık tarih aralığı girilir
- Bot, 7 günlük dilimlere bölerek otomatik sorgulama yapar
- Sonuçlar WebSocket ile frontend'e anlık stream edilir
- Tablo halinde gösterilir, Excel ve PDF olarak export edilebilir

Tüm API istekleri mali müşavirin kendi bilgisayarından (Electron Bot) yapılacak — GİB IP ban riski sıfır.

### Scope

**In Scope:**
- Electron Bot içinde GİB Dijital VD HTTP API login (captcha + Bearer token)
- `POST /apigateway/api/earsiv/alici-list` ile alış faturaları sorgulama
- 1 aylık tarih aralığını otomatik 7 günlük dilimlere bölme
- Pagination desteği (totalPage > 1 durumunda tüm sayfaları çekme)
- WebSocket ile frontend'e anlık sonuç iletimi
- Fatura tablosu (virtual scrolling)
- Excel export (client-side XLSX)
- PDF export
- Dashboard'da yeni sayfa + navigation

**Out of Scope:**
- Veritabanı kaydı (anlık sorgulama, cache yok)
- Server-side GİB API çağrısı (IP ban riski)
- Fatura oluşturma / imzalama / iptal
- E-Fatura sistemi (farklı portal)
- E-Arşiv Portal API (earsivportal.efatura.gov.tr) — farklı spec'te

## Context for Development

### GİB Dijital VD E-Arşiv API (Doğrulanmış — 2026-02-12)

**Endpoint:** `POST https://dijital.gib.gov.tr/apigateway/api/earsiv/alici-list`
**Auth:** `Authorization: Bearer <token>` (Dijital VD login'den dönen token)
**Content-Type:** `application/json`
**Cookie:** `i18next=tr`

**Request Payload:**
```json
{
  "data": {
    "duzenlenmeTarihiBas": "15/01/2026",
    "duzenlenmeTarihiSon": "21/01/2026"
  },
  "meta": {
    "pagination": { "pageNo": 1, "pageSize": 10 },
    "sortFieldName": "faturaNo",
    "sortType": "DESC",
    "filters": []
  }
}
```

**Response:**
```json
{
  "messages": null,
  "resultListDenormalized": [
    {
      "unvan": "TURKCELL ÖDEME VE ELEKTRONİK PARA HİZMETLERİ ANONİM ŞİRKETİ",
      "tcknVkn": "2120133627",
      "faturaNo": "TE12026000000125",
      "duzenlenmeTarihi": "2026-01-15 11:21:35",
      "toplamTutar": 23.81,
      "odenecekTutar": "25.00",
      "vergilerTutari": 1.19,
      "paraBirimi": "TRY",
      "tesisatNumarasi": "01283.00061",
      "gonderimSekli": "ELEKTRONİK",
      "iptalItirazDurum": null,
      "iptalItirazTarihi": null,
      "mukellefTckn": "          ",
      "mukellefVkn": "2120133627"
    }
  ],
  "pageDetail": { "pageNo": 1, "pageSize": 10, "total": 2, "totalPage": 1 }
}
```

**Tarih formatı:** DD/MM/YYYY (slash separatörlü)
**Tarih limiti:** Max 7 gün per sorgu (inclusive)
**Response time:** ~179ms

### Codebase Patterns

#### 1. Electron Bot Event Handler Pattern (index.ts:746-784)
```typescript
wsClient.on('earsiv:launch', async (data: BotCommandData) => {
    try {
        const { launchEarsivPortal } = await import('./earsiv-launcher');
        const result = await launchEarsivPortal({
            userid: data.userid as string,
            password: data.password as string,
            customerName,
            onProgress: (status: string) => {
                wsClient?.send('earsiv:launch-progress', { status, customerName });
            }
        });
        if (result.success) {
            wsClient?.send('earsiv:launch-complete', { success: true, customerName });
        } else {
            wsClient?.sendError(result.error || 'Hata');
        }
    } catch (e: any) {
        wsClient?.sendError(e.message || 'Hata');
    }
});
```

#### 2. WebSocket Server Relay Pattern (server.ts:406-430)
```typescript
case 'gib:launch-progress':
case 'gib:launch-complete':
    broadcastToTenant(client.tenantId, message);
    break;
```

#### 3. Bot Command Delegation Pattern (launch-gib/route.ts)
```typescript
// API Route → /_internal/bot-command → broadcastToTenant → Electron
const eventType = application === 'earsiv' ? 'earsiv:launch' : 'gib:launch';
const response = await fetch(`http://localhost:${port}/_internal/bot-command`, {
    method: "POST",
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, tenantId, type: eventType, data: commandData })
});
```

#### 4. GİB HTTP API Login Pattern (gib-auth.ts)
- `GET /apigateway/captcha/getnewcaptcha` → captcha base64 + cid
- `solveUnifiedCaptcha()` → OCR.space veya 2Captcha ile çözüm
- `POST /apigateway/auth/tdvd/login` → `{ dk, userid, sifre, imageId }` → Bearer token
- Token 30 dakika geçerli, `GET /apigateway/auth/tdvd/user-info` ile refresh

#### 5. GİB Endpoints Registry (endpoints.ts)
- `GIB_ENDPOINTS.PORTAL.LOGIN_API` — Login endpoint
- `GIB_ENDPOINTS.PORTAL.CAPTCHA_API` — Captcha endpoint
- `GIB_ENDPOINTS.GATEWAY` — API Gateway servisleri
- E-Arşiv endpoint henüz tanımlı DEĞİL → eklenecek

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `electron-bot/src/main/index.ts:746-784` | E-Arşiv event handler pattern (earsiv:launch) |
| `electron-bot/src/main/earsiv-launcher.ts` | Mevcut e-Arşiv launcher (sadece portal açma — Puppeteer) |
| `electron-bot/src/main/ws-client.ts` | WebSocket client (send, sendProgress, sendError, queue) |
| `server.ts:133-434` | handleMessage switch-case + broadcastToTenant |
| `server.ts:474-500` | /_internal/bot-command POST handler |
| `src/lib/gib-api/gib-auth.ts:70-327` | HTTP API login flow (captcha + token) |
| `src/lib/gib-api/client.ts` | GibHttpClient (cookie manager, rate limiter) |
| `src/lib/gib-api/endpoints.ts` | GIB_ENDPOINTS sabit tanımları |
| `src/lib/gib-api/captcha-solver.ts` | Unified captcha çözücü (OCR.space + 2Captcha) |
| `src/app/api/bot/launch-gib/route.ts:185-195` | E-Arşiv event tipi belirleme + bot-command gönderme |
| `src/components/kontrol/kontrol-table.tsx` | Virtual scrolling table pattern |
| `src/components/dashboard/nav.tsx` | Navigation menü pattern |
| `src/lib/crypto.ts` | AES-256-GCM encrypt/decrypt |
| `src/lib/supabase/auth.ts` | getUserWithProfile() auth guard |

### Technical Decisions

1. **Electron Bot üzerinden HTTP API** — IP ban riski nedeniyle tüm GİB istekleri mali müşavirin kendi PC'sinden yapılacak
2. **GİB login Electron Bot'ta yapılacak** — `src/lib/gib-api/` kütüphanesi server-side, Electron Bot'un kendi login implementasyonu olacak. Mevcut `gib-auth.ts` pattern'i referans alınacak ama Electron Bot için yeniden yazılacak
3. **Captcha çözümü** — Captcha API key `.env` dosyasından (`CAPTCHA_API_KEY`) okunacak. Tenant ayarlarından DEĞİL. İleride kendi captcha çözümümüz veya farklı API key olabilir ama şimdilik `.env`
4. **Yeni WebSocket mesaj tipleri** — `earsiv:query` (komut), `earsiv:query-progress`, `earsiv:query-results`, `earsiv:query-error`
5. **7 günlük dilimleme bot'ta yapılacak** — Bot tarih aralığını alır, kendisi 7'şer güne böler, her dilimi sorgular, sonuçları birleştirir
6. **pageSize: 100** — Default 10 yerine 100 kullanılacak (daha az API çağrısı, GİB destekliyorsa)
7. **Mevcut `earsiv:launch` handler korunacak** — Yeni handler `earsiv:query` olarak ayrı eklenecek
8. **Client-side export** — Excel/PDF, browser'daki in-memory veriden oluşturulacak
9. **Dönem varsayılanı** — Beyanname dönem kuralı: bir önceki ay

## Implementation Plan

### Tasks

#### Katman 1: Shared — Endpoint Tanımları

- [ ] Task 1: EARSIV endpoint'lerini GIB_ENDPOINTS registry'sine ekle
  - File: `src/lib/gib-api/endpoints.ts`
  - Action: `GATEWAY` bloğunun **yanına (peer olarak, nested DEĞİL)** `EARSIV` bloğu ekle (F23)
  - Detail:
    ```typescript
    // GIB_ENDPOINTS objesi içinde, GATEWAY'den sonra, } as const kapanışından önce:
    GATEWAY: {
      // ... mevcut ...
    },

    // ═══════════════════════════════════════════════════════════════════
    // E-ARŞİV — Dijital VD E-Arşiv Fatura Sorgulama
    // ═══════════════════════════════════════════════════════════════════
    EARSIV: {
      BASE_URL: 'https://dijital.gib.gov.tr/apigateway/api/earsiv',
      ALICI_LIST: 'https://dijital.gib.gov.tr/apigateway/api/earsiv/alici-list',
    },
    ```
  - Notes: `as const` yapısı korunmalı. EARSIV, GATEWAY'in peer'ı olarak eklenmeli (child değil, aynı seviyede).

#### Katman 2: Electron Bot — Core API Modülü

- [ ] Task 2: E-Arşiv Dijital API modülünü oluştur (login + query + dilimleme)
  - File: `electron-bot/src/main/earsiv-dijital-api.ts` (YENİ)
  - Action: Aşağıdaki fonksiyonları içeren modül oluştur:
  - Detail:
    **a) `gibDijitalLogin(userid, sifre, captchaApiKey, onProgress?)` fonksiyonu:**
    - `GET https://dijital.gib.gov.tr/apigateway/captcha/getnewcaptcha` → captcha base64 + cid al
    - Captcha'yı çöz (OCR.space veya 2Captcha — `captcha-solver.ts` pattern'i referans al, ama Electron Bot'ta node-fetch kullan)
    - `POST https://dijital.gib.gov.tr/apigateway/auth/tdvd/login` ile `{ dk: cid, userid, sifre, imageId: captchaCevap }` gönder
    - Dönen `token` (Bearer) değerini return et
    - Hata durumlarını yönet: yanlış şifre, captcha hatası, ağ hatası
    - `gib-auth.ts:70-327` pattern'ini referans al
    - **NOT (F22):** Dijital VD API login için `gibKodu` (userid) + `gibSifre` (sifre) kullanılır. `gibParola` farklı bir GİB servisi (Portal login) içindir — bu spec'te kullanılmaz.

    **b) `splitDateRange(startDate, endDate)` yardımcı fonksiyonu:**
    - **Input: ISO string** (`"2026-01-01"`) — frontend'den gelen format (F7)
    - İç mantıkta Date nesnelerine parse et: `new Date(startDate + 'T00:00:00')` (timezone güvenli)
    - 7 günlük dilimlere böl
    - **Output: DD/MM/YYYY** formatında — GİB API'nin beklediği format (F7)
    - Her dilim: `{ bas: "01/01/2026", son: "07/01/2026" }` formatında
    - Son dilim 7 günden kısa olabilir (ay sonu)
    - Örnek: "2026-01-01" → "2026-01-31" → 5 dilim:
      - `{ bas: "01/01/2026", son: "07/01/2026" }`
      - `{ bas: "08/01/2026", son: "14/01/2026" }`
      - `{ bas: "15/01/2026", son: "21/01/2026" }`
      - `{ bas: "22/01/2026", son: "28/01/2026" }`
      - `{ bas: "29/01/2026", son: "31/01/2026" }`
    - **Tarih format dönüşüm zinciri (F7):**
      ```
      Frontend (YYYY-MM-DD) → API Route (pass-through) → Bot (ISO string)
        → splitDateRange() → Date parse → DD/MM/YYYY → GİB API
      ```

    **c) `queryEarsivAliciList(token, dateRange, onProgress?, onResults?)` fonksiyonu:**
    - `splitDateRange()` ile dilimlere böl
    - **Input date validation (F24):** `splitDateRange` fonksiyonu başında max 93 gün (~3 ay) kontrol et — aşılırsa `throw new Error('INVALID_DATE_RANGE: Maksimum 3 aylık dönem sorgulanabilir')` — frontend bypass edilse bile bot korur
    - `completedChunks: string[]` dizisi tut — **format: "DD/MM/YYYY - DD/MM/YYYY"** (F26), örn: `"01/01/2026 - 07/01/2026"`
    - `failedChunks: string[]` dizisi tut — **format: "DD/MM/YYYY - DD/MM/YYYY (hata mesajı)"** (F26)
    - Her dilim için:
      - `POST /apigateway/api/earsiv/alici-list` çağrısı yap
      - Headers: `Authorization: Bearer ${token}`, `Content-Type: application/json`, `Cookie: i18next=tr`
      - Body: `{ data: { duzenlenmeTarihiBas, duzenlenmeTarihiSon }, meta: { pagination: { pageNo: 1, pageSize: 100 }, sortFieldName: "faturaNo", sortType: "DESC", filters: [] } }`
      - Pagination: `totalPage > 1` ise pageNo 2, 3... ile tekrarla — **MAX_PAGES_PER_CHUNK = 50 güvenlik limiti** (sonsuz döngü koruması, F11)
      - Her sayfa sonucunu `onResults(invoices, progress)` callback ile gönder (stream)
      - `onProgress(status)` ile ilerleme bildir ("Dilim 1/5 sorgulanıyor...", "2. sayfa çekiliyor...")
      - **Per-chunk timeout: 60 saniye** (F25) — tek dilim 60s'yi aşarsa abort et, failedChunks'a ekle, sonraki dilime geç
      - **Dilim başarılıysa** → `completedChunks`'a ekle (format: "DD/MM/YYYY - DD/MM/YYYY")
      - **Dilim hata alırsa** → `failedChunks`'a ekle, hatayı logla, sonraki dilime devam et (tek dilim hatası tüm sorguyu durdurmasın, F3)
    - **Rate limiting: TÜM API çağrıları arası (page + chunk) minimum 2 saniye bekle** (F29) — `HTTP_CONFIG.RATE_LIMITS.DELAY_BETWEEN_REQUESTS`
    - Boş `resultListDenormalized` ise skip et (hata değil)
    - Tüm sonuçları birleşik olarak return et — **partial failure durumunda `completedChunks` ve `failedChunks` da return et**

    **d) TypeScript Interface'leri:**
    ```typescript
    interface EarsivFatura {
      unvan: string;
      tcknVkn: string;
      faturaNo: string;
      duzenlenmeTarihi: string;
      toplamTutar: number;
      odenecekTutar: string;
      vergilerTutari: number;
      paraBirimi: string;
      tesisatNumarasi: string;
      gonderimSekli: string;
      iptalItirazDurum: string | null;
      iptalItirazTarihi: string | null;
      mukellefTckn: string;
      mukellefVkn: string;
    }

    interface EarsivQueryResult {
      success: boolean;
      invoices: EarsivFatura[];
      totalCount: number;
      completedChunks: string[];  // Başarılı sorgulanan tarih aralıkları (F3)
      failedChunks: string[];     // Hata alan tarih aralıkları (F3)
      error?: string;
    }
    ```
  - Notes:
    - Electron Bot ortamında çalışacak — `node-fetch` veya Electron'un built-in `net.fetch` kullan
    - `src/lib/gib-api/gib-auth.ts` pattern'ini referans al ama Electron'a göre adapte et
    - `src/lib/gib-api/captcha-solver.ts` pattern'ini referans al (OCR.space + 2Captcha fallback)
    - User-Agent header'ı: `HTTP_CONFIG.HEADERS.USER_AGENT` değerini kullan
    - Captcha API key, `earsiv:query` event data'sından gelecek (API route `process.env.CAPTCHA_API_KEY`'den okuyup bot'a gönderir)
    - **[ELICITATION WR-3/OR-1]:** `captcha-solver.ts`'yi yeniden yazmak yerine doğrudan import et: `import { solveUnifiedCaptcha } from '../../src/lib/gib-api/captcha-solver'`
    - **[ELICITATION WR-4/OR-2]:** `pageSize: 50` kullan (100 yerine). Fallback retry mantığı gereksiz — 50 güvenli ve yeterli.
    - **[ELICITATION PM-1]:** 401 response alınırsa 1 kez re-login dene. Başarısızsa kısmi sonuçları döndür. `EarsivQueryResult.sessionRefreshed: boolean` field'ı ekle.
    - **[ELICITATION WI-1]:** Response validation: `if (!response.resultListDenormalized || !Array.isArray(response.resultListDenormalized)) throw new Error('GIB_API_CHANGED')`
    - **[ELICITATION WI-3]:** Captcha max 3 retry (5 yerine). Her biri ~30s = max 90s login süresi.
    - **[ELICITATION WI-6]:** HTTP 429 → exponential backoff: 5s, 10s, 20s (max 3 retry per chunk). 3 retry sonrası failedChunks'a ekle.
    - **[ELICITATION PM-5]:** Response Content-Type kontrolü: JSON değilse `GIB_MAINTENANCE` error fırlat.
    - **[ELICITATION WI-7]:** Electron 28+ built-in `fetch` kullan, `node-fetch` dependency ekleme.

#### Katman 3: Electron Bot — Event Handler

- [ ] Task 3: `earsiv:query` WebSocket event handler'ı ekle
  - File: `electron-bot/src/main/index.ts`
  - Action: Mevcut `earsiv:launch` handler'ından (satır 746-784) sonra yeni handler ekle
  - Detail:
    ```typescript
    wsClient.on('earsiv:query', async (data: BotCommandData) => {
        const customerName = data.customerName as string | undefined;
        mainWindow?.webContents.send('bot:command', { type: 'earsiv-query-start', customerName });

        // Timeout koruması: 5 dakika (F6)
        const QUERY_TIMEOUT_MS = 5 * 60 * 1000;
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), QUERY_TIMEOUT_MS)
        );

        try {
            const { gibDijitalLogin, queryEarsivAliciList } = await import('./earsiv-dijital-api');

            const queryWork = async () => {
                // 1. Progress: Login başlıyor
                wsClient?.send('earsiv:query-progress', {
                    status: 'GİB Dijital VD\'ye giriş yapılıyor...',
                    customerName, phase: 'login'
                });

                // 2. GİB Login
                const token = await gibDijitalLogin(
                    data.userid as string,
                    data.password as string,
                    data.captchaApiKey as string,
                    (status) => wsClient?.send('earsiv:query-progress', { status, customerName, phase: 'login' })
                );

                // 3. Query with streaming
                return await queryEarsivAliciList(
                    token,
                    { startDate: data.startDate as string, endDate: data.endDate as string },
                    (status) => wsClient?.send('earsiv:query-progress', { status, customerName, phase: 'query' }),
                    (invoices, progress) => wsClient?.send('earsiv:query-results', {
                        invoices, progress, customerName
                    })
                );
            };

            // Race: ya iş biter, ya timeout
            const result = await Promise.race([queryWork(), timeoutPromise]) as EarsivQueryResult;

            // 4. Complete — failedChunks varsa partial success uyarısı (F3)
            wsClient?.send('earsiv:query-complete', {
                success: true,
                totalCount: result.totalCount,
                customerName,
                completedChunks: result.completedChunks,
                failedChunks: result.failedChunks,
            });
        } catch (e: any) {
            // Yapılandırılmış hata kodları (F12)
            let errorCode = 'UNKNOWN_ERROR';
            let errorMessage = e.message || 'E-Arşiv sorgulama hatası';

            if (e.message === 'TIMEOUT') {
                errorCode = 'TIMEOUT';
                errorMessage = 'Sorgulama zaman aşımına uğradı (5 dakika). Lütfen tekrar deneyin.';
            } else if (e.message?.includes('şifre') || e.message?.includes('login') || e.message?.includes('401')) {
                errorCode = 'AUTH_FAILED';
                errorMessage = 'GİB giriş başarısız: ' + e.message;
            } else if (e.message?.includes('captcha')) {
                errorCode = 'CAPTCHA_FAILED';
                errorMessage = 'Captcha çözülemedi: ' + e.message;
            } else if (e.message?.includes('ECONNREFUSED') || e.message?.includes('network') || e.message?.includes('fetch')) {
                errorCode = 'NETWORK_ERROR';
                errorMessage = 'GİB sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.';
            } else if (e.message?.includes('rate') || e.message?.includes('429')) {
                errorCode = 'RATE_LIMIT';
                errorMessage = 'GİB istek limiti aşıldı. Birkaç dakika bekleyip tekrar deneyin.';
            }

            wsClient?.send('earsiv:query-error', {
                error: errorMessage, errorCode, customerName
            });
        }
    });
    ```
  - Notes: `earsiv:launch` handler'ı aynen kalacak, `earsiv:query` ek olarak ekleniyor. Dynamic import kullan. 5 dakika timeout koruması (F6). Yapılandırılmış error code'lar (F12).
    - **[ELICITATION PM-2]:** Her dilim öncesi `wsClient.connected` kontrolü: bağlantı kopmuşsa sorguyu durdur, kısmi sonuçları döndür.
    - **[ELICITATION PM-3 — KRİTİK]:** Tüm WebSocket mesajlarına `requesterId: data.userId` ekle. Aynı tenant'ta 2 kullanıcı aynı anda sorgulama yaparsa sonuçlar karışmasın.
    - **[ELICITATION WI-4]:** Aktif sorgu tracking: `activeQueries: Map<string, boolean>` (key: customerId). Aynı mükellef için aktif sorgu varsa `QUERY_IN_PROGRESS` error dön. Complete/error sonrası Map'ten sil.
    - **[ELICITATION PM-4]:** Captcha servisi down → `CAPTCHA_SERVICE_DOWN` error code ekle.

#### Katman 4: WebSocket Server — Mesaj Routing

- [ ] Task 4: `earsiv:query-*` mesaj tiplerini server.ts'ye ekle
  - File: `server.ts`
  - Action: `handleMessage` switch-case bloğuna (satır ~406-430 civarı, mevcut `gib:launch-progress` case'lerinin yanına) yeni case'ler ekle
  - Detail:
    ```typescript
    case 'earsiv:query-progress':
    case 'earsiv:query-results':
    case 'earsiv:query-complete':
    case 'earsiv:query-error':
        // [ELICITATION PM-3]: requesterId varsa sadece o kullanıcıya gönder
        // broadcastToTenant yerine sendToUser tercih edilebilir (güvenlik)
        broadcastToTenant(client.tenantId, message);
        break;
    ```
  - Notes: Mevcut `gib:launch-progress` / `gib:launch-complete` pattern'ini birebir takip et

#### Katman 5: Next.js API Route — Bot Komutu Gönderme

- [ ] Task 5: E-Arşiv sorgulama API route'u oluştur
  - File: `src/app/api/earsiv/query/route.ts` (YENİ)
  - Action: `launch-gib/route.ts` pattern'ini referans alarak yeni POST handler oluştur
  - Detail:
    **Request Body:**
    ```typescript
    interface EarsivQueryRequest {
      customerId: string;    // Mükellef ID
      startDate: string;     // YYYY-MM-DD formatında (frontend'den)
      endDate: string;       // YYYY-MM-DD formatında (frontend'den)
    }
    ```
    **İşlem Akışı:**
    1. `getUserWithProfile()` ile auth check
    2. `customerId` ile müşteriyi çek — **KRİTİK: tenantId filtresi zorunlu:**
       ```typescript
       const customer = await prisma.customers.findFirst({
         where: { id: customerId, tenantId: user.tenantId },
         select: { id: true, unvan: true, kisaltma: true, gibKodu: true, gibSifre: true }
       });
       if (!customer) {
         return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
       }
       ```
    3. `customer.gibKodu` ve `customer.gibSifre` mevcutluk kontrolü
    4. `decrypt()` ile credential'ları çöz
    5. Bot bağlantı kontrolü (`/_internal/clients` GET)
    6. Captcha API key'i `process.env.CAPTCHA_API_KEY`'den al (`.env` dosyasından, tenant ayarlarından DEĞİL)
    7. `/_internal/bot-command` POST ile `earsiv:query` event'i gönder:
       ```json
       {
         "tenantId": "...",
         "type": "earsiv:query",
         "data": {
           "userid": "<decrypted gibKodu>",
           "password": "<decrypted gibSifre>",
           "startDate": "2026-01-01",
           "endDate": "2026-01-31",
           "customerName": "Firma Kısaltma",
           "captchaApiKey": "<process.env.CAPTCHA_API_KEY>"
         }
       }
       ```
    8. Başarılı response: `{ success: true, message: "E-Arşiv sorgulaması başlatıldı (Firma Adı)..." }`
  - Notes:
    - `launch-gib/route.ts` pattern'ini birebir takip et (auth → credential → bot check → send)
    - Tarih formatı dönüşümü YAPMA — bot kendi formatına çevirir
    - Captcha API key: `process.env.CAPTCHA_API_KEY` (`.env` dosyasından okunacak — tenant ayarlarından DEĞİL)
    - **[ELICITATION PM-3 — KRİTİK]:** Bot command data'sına `userId: user.id` ekle. Bot bu ID'yi tüm WebSocket response'larına `requesterId` olarak koyacak.
    - **Güvenlik Notu (F2/F4):** Credential'lar WebSocket üzerinden gönderiliyor. Mevcut mimari bunu `launch-gib` akışında da aynı şekilde yapıyor (localhost üzerinden). Bu kabul edilebilir risk çünkü: (1) WebSocket localhost'ta çalışıyor, (2) `/_internal/bot-command` sadece localhost'tan erişilebilir, (3) Mevcut `gib:launch` handler'ı da aynı pattern'i kullanıyor. Captcha API key `.env`'de saklanır, şifreleme gerekmez. Ancak eğer server dışarıya açılırsa WSS zorunlu olur.

#### Katman 6: Frontend — WebSocket Hook

- [ ] Task 6: E-Arşiv sorgulama React hook'u oluştur
  - File: `src/components/e-arsiv-fatura/hooks/use-e-arsiv-query.ts` (YENİ)
  - Action: WebSocket eventleri dinleyen ve state yöneten custom hook
  - Detail:
    ```typescript
    interface UseEarsivQueryReturn {
      invoices: EarsivFatura[];
      isLoading: boolean;
      isLoggedIn: boolean;
      progress: { status: string; phase: 'login' | 'query' | 'idle'; customerName?: string };
      error: string | null;
      totalCount: number;
      startQuery: (customerId: string, startDate: string, endDate: string) => Promise<void>;
      clearResults: () => void;
    }
    ```
    **Hook İçeriği:**
    1. **`useReducer` kullan** (F5 — rapid WebSocket mesajlarında state kaybını önlemek için `useState` yerine):
       ```typescript
       type Action =
         | { type: 'QUERY_START' }
         | { type: 'PROGRESS'; payload: { status: string; phase: string; customerName?: string } }
         | { type: 'LOGIN_COMPLETE' }  // (F27) Login → query geçiş anı
         | { type: 'RESULTS'; payload: { invoices: EarsivFatura[] } }
         | { type: 'COMPLETE'; payload: { totalCount: number; completedChunks: string[]; failedChunks: string[] } }
         | { type: 'ERROR'; payload: { error: string; errorCode: string } }
         | { type: 'CLEAR' };
       ```
    2. `useEffect` ile WebSocket eventleri dinle:
       - `earsiv:query-progress` → dispatch PROGRESS
       - `earsiv:query-results` → dispatch RESULTS — **`faturaNo` bazlı deduplication yap** (F8: aynı fatura birden fazla eklenmesini önle)
       - `earsiv:query-complete` → dispatch COMPLETE — `failedChunks` doluysa partial success uyarısı göster (F3)
       - `earsiv:query-error` → dispatch ERROR — `errorCode` ile spesifik hata mesajı (F12)
    3. `startQuery()` fonksiyonu: `/api/earsiv/query` POST çağrısı yaparak bot'u tetikle — **çift tıklama koruması: isLoading true ise return** (F8)
    4. `clearResults()`: State'i sıfırla

    **Return tipine ek alanlar (F3):**
    ```typescript
    interface UseEarsivQueryReturn {
      // ... mevcut alanlar ...
      completedChunks: string[];   // Başarılı tarih aralıkları
      failedChunks: string[];      // Hata alan tarih aralıkları
      isPartialResult: boolean;    // failedChunks.length > 0
    }
    ```
  - Notes:
    - WebSocket bağlantısı mevcut `useWebSocket` veya global context'ten gelecek — projede var olan pattern'i kullan
    - `useReducer` RESULTS handler'da deduplication: **composite key** `${i.faturaNo}-${i.tcknVkn}-${i.duzenlenmeTarihi}` ile unique fatura garantisi (F28 — sadece faturaNo yetmez, farklı satıcıdan aynı no gelebilir)
    - `useCallback` ile fonksiyon referanslarını stabilize et
    - **[ELICITATION PM-3 — KRİTİK]:** WebSocket event handler'larda `if (message.requesterId && message.requesterId !== currentUserId) return;` filtresi ekle. Aynı tenant'ta farklı kullanıcıların sonuçlarını karıştırma.
    - **[ELICITATION UF-5]:** `COMPLETE` dispatch'inde `toast.success("${customerName} için ${totalCount} fatura bulundu")` göster.
    - **[ELICITATION PM-6]:** RESULTS handler'da array spread yerine `concat` kullan — büyük dataset'lerde memory pressure azaltır.

#### Katman 7: Frontend — Tablo Bileşeni

- [ ] Task 7: E-Arşiv fatura tablosu bileşeni oluştur
  - File: `src/components/e-arsiv-fatura/e-arsiv-fatura-table.tsx` (YENİ)
  - Action: Virtual scrolling destekli fatura tablosu
  - Detail:
    **Tablo Kolonları:**
    | Kolon | Field | Format |
    |-------|-------|--------|
    | Ünvan | `unvan` | String, truncate |
    | VKN/TCKN | `tcknVkn` | String |
    | Fatura No | `faturaNo` | String |
    | Düzenlenme Tarihi | `duzenlenmeTarihi` | "2026-01-15 11:21:35" → "15.01.2026" formatla |
    | Toplam Tutar | `toplamTutar` | Sayı → "23,81 ₺" formatla |
    | Vergiler | `vergilerTutari` | Sayı → "1,19 ₺" formatla |
    | Ödenecek Tutar | `odenecekTutar` | String → "25,00 ₺" formatla |
    | Para Birimi | `paraBirimi` | String (TRY) |
    | Gönderim Şekli | `gonderimSekli` | String |
    | İptal/İtiraz | `iptalItirazDurum` | null ise "-", değilse göster |

    **Özellikler:**
    - `useVirtualizer` ile virtual scrolling (500+ satır desteği)
    - `React.memo` ile row memoization
    - Sticky header
    - Toplam satır: "Toplam X fatura, Y ₺ tutar" özet bilgisi
    - Sıralama: Tarih, tutar, fatura no'ya göre client-side sort
    - Filtre: Ünvan/VKN arama (client-side filter)
  - Notes:
    - `src/components/kontrol/kontrol-table.tsx` virtual scrolling pattern'ini referans al
    - TailwindCSS 4 ile stil
    - Para formatı: `new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })`
    - Tarih formatı: `duzenlenmeTarihi.split(' ')[0]` → Date parse → `toLocaleDateString('tr-TR')`
    - **odenecekTutar parse güvenliği (F17/F30):** `(val == null || val === '') ? null : (parseFloat(String(val).replace(',', '.')) || null)` — null → null kalır (0'a dönüşmez, "-" olarak gösterilir), geçerli string → number
    - İkon: `Receipt` kullan (F20 — fatura için daha uygun semantik)

- [ ] Task 8: Excel ve PDF export fonksiyonları ekle
  - File: `src/components/e-arsiv-fatura/e-arsiv-fatura-table.tsx` (aynı dosya) veya ayrı utils
  - Action: Export butonları ve fonksiyonları
  - Detail:
    **Excel Export:**
    - `xlsx` kütüphanesini kullan (projede mevcut)
    - Tüm invoices[] array'ini Excel worksheet'e dönüştür
    - Dosya adı: `e-arsiv-alis-{sanitizedCustomerName}-{YYYY-MM}.xlsx`
    - **Dosya adı sanitizasyonu (F13):** `customerName.replace(/[^a-zA-Z0-9ÇçĞğİıÖöŞşÜü\s-]/g, '').trim().substring(0, 50)`
    - Kolon başlıkları Türkçe olacak
    - **Partial result uyarısı (F3):** `failedChunks` doluysa Excel'e "DİKKAT: Eksik tarih aralıkları" notu ekle

    **PDF Export:**
    - Tabloyu PDF olarak export et
    - `window.print()` veya mevcut PDF kütüphanesini kullan
    - Dosya adı: `e-arsiv-alis-{sanitizedCustomerName}-{YYYY-MM}.pdf`
  - Notes: Client-side — browser'daki in-memory invoices[] verisinden oluşturulacak

#### Katman 8: Frontend — Sayfa Bileşeni

- [ ] Task 9: E-Arşiv fatura sayfası bileşeni oluştur
  - File: `src/components/e-arsiv-fatura/e-arsiv-fatura-page.tsx` (YENİ)
  - Action: Ana sayfa bileşeni — mükellef seçimi, tarih aralığı, sorgulama buton, tablo, export
  - Detail:
    **Sayfa Düzeni:**
    ```
    ┌──────────────────────────────────────────────┐
    │ E-Arşiv Alış Faturaları                      │
    ├──────────────────────────────────────────────┤
    │ [Mükellef Seçimi ▼]  [Ay/Yıl ▼]  [Sorgula] │
    ├──────────────────────────────────────────────┤
    │ Progress bar / Status mesajı                 │
    ├──────────────────────────────────────────────┤
    │ [Excel İndir] [PDF İndir]  Toplam: X fatura │
    ├──────────────────────────────────────────────┤
    │ ┌──────────────────────────────────────────┐ │
    │ │ Ünvan │ VKN │ Fatura No │ Tarih │ Tutar│ │
    │ │ ...   │ ... │ ...       │ ...   │ ...  │ │
    │ │ ...   │ ... │ ...       │ ...   │ ...  │ │
    │ └──────────────────────────────────────────┘ │
    └──────────────────────────────────────────────┘
    ```

    **Bileşenler:**
    1. **Mükellef seçici**: Mevcut müşteri listesinden combobox/select (API: `/api/customers` GET)
       - GİB bilgileri eksik mükellefleri filtrele veya uyarı göster
       - **[ELICITATION UF-4]:** Searchable Combobox kullan (plain Select yetersiz — 60+ mükellef listesinde arama şart)
    2. **Dönem seçici**: Ay + Yıl dropdown'ları (Radix Select)
       - Varsayılan: Bir önceki ay (beyanname dönem kuralı)
       - Seçilen ay'ın 1. ve son gününü otomatik hesapla
       - **Max 3 ay aralık limiti** (F16) — daha uzun aralık seçilmeye çalışılırsa uyarı göster: "En fazla 3 aylık dönem sorgulanabilir"
    3. **Sorgula butonu**: `use-e-arsiv-query.startQuery()` tetikle
       - Bot bağlı değilse disabled + tooltip
       - Loading durumunda spinner + "Sorgulanıyor..." yazısı
    4. **Progress bilgisi**: `progress.status` mesajını göster
       - Login fazı: "GİB'e giriş yapılıyor...", "Captcha çözülüyor..."
       - Query fazı: "Dilim 1/5 sorgulanıyor...", "Sayfa 2/3 çekiliyor..."
    5. **Fatura tablosu**: `<EarsivFaturaTable invoices={invoices} />`
    6. **Export butonları**: Excel + PDF (fatura varsa aktif)
    7. **[ELICITATION WR-6] Partial failure banner:** `failedChunks` doluysa sarı Alert: "Dikkat: XX-YY tarihleri sorgulanamadı. Sonuçlar eksik olabilir. [Tekrar Dene]" + Badge: "Kısmi Sonuç"
    8. **[ELICITATION UF-3] Hata durumunda mükellef linki:** AUTH_FAILED hatasında "GİB bilgilerini güncellemek için Mükellef Ayarları'na gidin" linki
  - Notes:
    - `useCallback` ile event handler'ları stabilize et
    - Loading sırasında formu disable et
    - Mükellef seçilmeden "Sorgula" butonu disabled

#### Katman 9: Next.js Route + Navigation

- [ ] Task 10: Next.js sayfa route'u oluştur
  - File: `src/app/(dashboard)/dashboard/e-arsiv-fatura/page.tsx` (YENİ)
  - Action: Basit page wrapper
  - Detail:
    ```typescript
    import dynamic from 'next/dynamic';
    const EarsivFaturaPage = dynamic(
      () => import('@/components/e-arsiv-fatura/e-arsiv-fatura-page'),
      { ssr: false }
    );
    export default function Page() {
      return <EarsivFaturaPage />;
    }
    ```
  - Notes: `ssr: false` — WebSocket bağımlılığı nedeniyle client-only render

- [ ] Task 11: Navigation menüsüne E-Arşiv Fatura öğesi ekle
  - File: `src/components/dashboard/nav.tsx`
  - Action: `navItems` array'ine yeni öğe ekle
  - Detail:
    - `Receipt` ikonu import et (zaten import listesinde var, satır 35)
    - "Beyanname İşlemleri"nin altına ekle (satır ~79 civarı):
    ```typescript
    {
        title: "E-Arşiv Fatura",
        href: "/dashboard/e-arsiv-fatura",
        icon: Receipt,
    },
    ```
  - Notes: `Receipt` ikonu fatura için daha uygun semantik (F20). Zaten import edilmiş durumda.

### Acceptance Criteria

#### Temel İşlevsellik

- [ ] AC 1: Given Electron Bot bağlı ve mükellefin GİB bilgileri dolu, when kullanıcı mükellef ve dönem seçip "Sorgula"ya basarsa, then bot GİB'e login olur, 7 günlük dilimlerde sorgulama yapar ve sonuçlar tabloda gösterilir

- [ ] AC 2: Given sorgulama devam ediyor, when her 7 günlük dilim sorgulandığında, then sonuçlar tabloya anlık olarak eklenir (streaming) ve progress durumu gösterilir

- [ ] AC 3: Given bir dilimde `totalPage > 1` ise, when bot o dilimin tüm sayfalarını çeker, then tüm faturalar eksisiz tabloda gösterilir

- [ ] AC 4: Given faturalar tabloda gösteriliyorken, when kullanıcı "Excel İndir" butonuna basarsa, then tüm faturalar Excel dosyası olarak indirilir

- [ ] AC 5: Given faturalar tabloda gösteriliyorken, when kullanıcı "PDF İndir" butonuna basarsa, then tüm faturalar PDF dosyası olarak indirilir

#### Hata Durumları

- [ ] AC 6: Given Electron Bot bağlı değil, when kullanıcı sorgulama yapmaya çalışırsa, then "SMMM Asistan masaüstü uygulaması bağlı değil" hatası gösterilir

- [ ] AC 7: Given mükellefin GİB bilgileri eksik, when kullanıcı o mükellef ile sorgulama yapmaya çalışırsa, then "Mükellef için GİB bilgileri eksik" hatası gösterilir

- [ ] AC 8: Given GİB login başarısız (yanlış şifre/captcha hatası), when bot login denemesinde hata alırsa, then kullanıcıya spesifik hata mesajı gösterilir

- [ ] AC 9: Given bir dilimde boş sonuç dönerse (resultListDenormalized boş), when bot o dilimi sorgularsa, then hata vermeden sonraki dilime geçer

#### Edge Cases

- [ ] AC 10: Given seçilen ay Şubat ise, when tarih dilimleme yapılırsa, then 28 veya 29 Şubat son gün olarak doğru hesaplanır

- [ ] AC 11: Given 500+ fatura sonucu dönerse, when tablo render edilirse, then virtual scrolling ile performans sorunsuz olur

- [ ] AC 12: Given sorgulama sırasında GİB rate limit'e yaklaşılırsa, when bot istekler arasında bekler, then minimum 2 saniye arayla istek yapılır

#### Navigation

- [ ] AC 13: Given kullanıcı dashboard'da, when sol menüde "E-Arşiv Fatura" öğesine tıklarsa, then `/dashboard/e-arsiv-fatura` sayfası açılır

#### Partial Failure & Güvenlik (Review Bulguları)

- [ ] AC 14: Given bot 5 dilimden 3'ünü başarıyla sorguladı ve 2'si hata aldı, when query complete olduğunda, then frontend'de "Dikkat: X-Y tarihleri sorgulanamadı" uyarısı gösterilir ve export'ta not düşülür (F3)

- [ ] AC 15: Given sorgulama 5 dakikayı aştı, when timeout gerçekleştiğinde, then "Sorgulama zaman aşımına uğradı" hatası gösterilir ve loading state sıfırlanır (F6)

- [ ] AC 16: Given kullanıcı sorgulama butonuna çift tıkladı veya aynı sorgu tekrar tetiklendi, when ikinci istek geldiğinde, then isLoading kontrolü ile engellenir ve duplicate faturalar tabloya eklenmez (F8)

- [ ] AC 17: Given GİB login hata verdi, when hata mesajı frontend'e geldiğinde, then errorCode'a göre spesifik Türkçe mesaj gösterilir (AUTH_FAILED, CAPTCHA_FAILED, NETWORK_ERROR, RATE_LIMIT, TIMEOUT) (F12)

#### Dönem Varsayılanı

- [ ] AC 18: Given kullanıcı E-Arşiv Fatura sayfasını açarsa, when sayfa yüklendiğinde, then varsayılan dönem bir önceki ay olarak ayarlanır (örn: Şubat 2026'da → Ocak 2026)

## Additional Context

### Dependencies

- Electron Bot'un çalışıyor ve WebSocket'e bağlı olması gerekli
- Müşterinin GİB bilgilerinin (gibKodu + gibSifre) dolu olması gerekli
- GİB Dijital VD login'in başarılı olması (captcha çözümü dahil)
- `CAPTCHA_API_KEY` environment variable'ın `.env`'de tanımlı olması (OCR.space veya 2Captcha)
- `xlsx` npm paketi (mevcut — client-side Excel export için)
- Mevcut WebSocket altyapısı (server.ts + ws-client.ts)

### Testing Strategy

**Manuel Test Adımları:**
1. Electron Bot'u başlat, WebSocket bağlantısını doğrula
2. Dashboard'dan "E-Arşiv Fatura" sayfasını aç
3. GİB bilgileri dolu bir mükellef seç
4. Dönem olarak bir önceki ayı seç
5. "Sorgula" butonuna bas
6. Progress mesajlarının sırayla gösterildiğini doğrula (login → dilim 1/5 → ... → tamamlandı)
7. Fatura tablosunun dolduğunu doğrula
8. Excel export → dosyanın indiğini ve doğru veri içerdiğini kontrol et
9. PDF export → dosyanın indiğini kontrol et
10. GİB bilgileri eksik mükellefi seçip sorgula → hata mesajı kontrolü
11. Electron Bot'u kapat, sorgula → bot bağlı değil hatası kontrolü

### Notes

- **Rate Limiting:** GİB dakikada 10 istek limiti — istekler arası minimum 2 saniye
- **Token Ömrü:** ~30 dakika — uzun sorgularda session timeout riski düşük (1 aylık max ~5 dilim × ~1-3 sayfa = ~15 istek, toplam ~30-45 saniye)
- **pageSize:** 100 olarak başla, GİB 400/500 dönerse 50'ye düşür
- **Tarih Dilimleme:** 01.01→07.01, 08.01→14.01, 15.01→21.01, 22.01→28.01, 29.01→31.01
- **Boş sonuç hata değil:** Bazı dilimlerde fatura olmayabilir
- **Login payload field adları:** `{ dk, userid, sifre, imageId }` — GİB'e özel
- **E-Arşiv query tarih formatı:** DD/MM/YYYY (slash separatörlü)
- **Response `resultListDenormalized`:** Array boş olabilir
- **`odenecekTutar` string olarak dönüyor** (diğerleri number) — frontend'de parse et
- **Veritabanı kaydı YOK** — tamamen anlık sorgulama, cache yok
- **İleriye yönelik:** Toplu mükellef sorgulama, veritabanına kayıt, otomatik Luca karşılaştırma scope dışı ama gelecekte düşünülebilir

---

## Advanced Elicitation Bulguları

> **Tarih:** 2026-02-13 — 5 metod uygulanmıştır. Her metodun bulguları spec'e risk, karar ve task düzeyinde entegre edilmiştir.

---

### 1. Pre-mortem Analysis

> _"Bu özellik production'da başarısız oldu. Geriye doğru çalışarak neden başarısız olduğunu buluyoruz."_

#### PM-1: Token Expiry Mid-Query (Yüksek Risk)
- **Senaryo:** Mükellefin 3 aylık sorgusunda 5 dilim × 10+ sayfa = 50+ API çağrısı. Her çağrı arası 2s bekleme → toplam ~2 dakika. Token 30 dakika geçerli olsa bile, **login'den sorgulamaya kadar captcha çözümü 30-90 saniye sürüyor**. GİB token'ı gerçekte daha erken expire ederse (inactivity timeout vs max age) sorgu ortasında 401 alır.
- **Etki:** Kısmi veri kaybı, kullanıcı tekrar sorgulama yapmalı.
- **Çözüm → Task 2'ye eklenmeli:**
  - `queryEarsivAliciList` her API çağrısında 401 kontrolü yapmalı
  - 401 alırsa `onProgress("Oturum yenileniyor...")` ile re-login denemeli (1 kez)
  - Re-login başarısızsa tüm sorguyu durdurup kısmi sonuçları döndürmeli
  - **Yeni interface field:** `EarsivQueryResult.sessionRefreshed: boolean`

#### PM-2: WebSocket Bağlantı Kopması (Orta Risk)
- **Senaryo:** Sorgulama devam ederken (20-60s) WiFi kopar veya kullanıcı sayfadan çıkar. Bot sorgulamaya devam eder ama sonuçlar kaybolur.
- **Etki:** Resource waste + kullanıcı loading state'de kalır.
- **Çözüm → Task 3'e eklenmeli:**
  - Bot'ta `wsClient.isConnected` kontrolü: bağlantı kopmuşsa sorguyu durdur
  - Her dilim öncesi bağlantı check: `if (!wsClient?.connected) { return partialResult; }`

#### PM-3: Tenant-Level Broadcast Çakışması (Yüksek Risk — GÜVENLİK)
- **Senaryo:** Aynı tenant'ta (muhasebe ofisi) 2 kullanıcı aynı anda farklı mükellef sorgulasa, `broadcastToTenant` her iki kullanıcıya da sonuç gönderir. Kullanıcı A, Kullanıcı B'nin mükellef faturalarını görür.
- **Etki:** Veri sızıntısı (aynı ofis içinde), karışık sonuçlar.
- **Çözüm → Task 4 ve Task 6'ya eklenmeli:**
  - WebSocket mesajlarına `requesterId` (userId) eklenmeli
  - Frontend hook'ta: `if (message.requesterId !== currentUserId) return;` filtresi
  - **Alternatif (daha basit):** `broadcastToTenant` yerine `sendToUser(userId, message)` kullan — mevcut server.ts'de userId bazlı gönderim var mı kontrol et

#### PM-4: Captcha Servisi Tamamen Down (Orta Risk)
- **Senaryo:** Hem OCR.space hem 2Captcha aynı anda down. Login asla gerçekleşmez.
- **Etki:** Tüm feature kullanılamaz. Kullanıcıya opak hata mesajı.
- **Çözüm → Task 2 ve Task 3'e eklenmeli:**
  - Hata kodu: `CAPTCHA_SERVICE_DOWN` — "Captcha çözüm servisleri şu anda erişilemez. Lütfen birkaç dakika sonra tekrar deneyin."
  - `gib-auth.ts:74-80` pattern'i zaten bunu kontrol ediyor — aynı pattern Electron modülünde de olmalı

#### PM-5: GİB Bakım/HTML Response (Düşük Risk)
- **Senaryo:** GİB bakım sayfası döndürür (HTML), JSON.parse hata verir.
- **Çözüm → Task 2'ye eklenmeli:**
  - Response Content-Type kontrolü: `if (!contentType.includes('application/json')) throw new Error('GIB_MAINTENANCE')`
  - Error code: `GIB_MAINTENANCE` — "GİB şu anda bakımda. Lütfen daha sonra tekrar deneyin."

#### PM-6: Memory Pressure - Büyük Dataset (Düşük-Orta Risk)
- **Senaryo:** 3 aylık sorgu, 2000+ fatura. useReducer her RESULTS dispatch'inde `[...prev, ...newInvoices]` yapar → O(n) array kopyası her mesajda.
- **Çözüm → Task 6'ya eklenmeli:**
  - `useReducer` RESULTS handler'da `push` + yeni referans yerine `concat` kullan — V8 optimizasyonu
  - Veya: Batch deduplication — her dilim sonunda dedup yap, ara sonuçlarda sadece append

#### PM-7: Electron Bot Versiyon Uyumsuzluğu (Düşük Risk)
- **Senaryo:** Web uygulaması güncellendi, Electron Bot eski versiyon. `earsiv:query` event'ini tanımaz → sessiz hata.
- **Çözüm → Task 5'e eklenmeli:**
  - API route'ta bot versiyon kontrolü (opsiyonel): `/_internal/clients` response'unda versiyon bilgisi varsa kontrol et
  - Yoksa: Bot bilinmeyen event'lere `unknown-event` response dönmeli

---

### 2. Cross-Functional War Room

> _PM + Mühendis + Tasarımcı perspektifinden feasibility/desirability/viability trade-off analizi._

#### WR-1: PM — Toplu Sorgulama Eksikliği (Desirability Gap)
- **Sorun:** 50+ mükellef yöneten mali müşavir her ay tek tek mükellef seçip sorgulayacak. Bu, mevcut manuel sürecin dijitalleştirilmesi ama **ölçeklendirilmesi değil**.
- **Karar:** V1 scope'ta tek mükellef yeterli. Ancak **V2 backlog'a eklenmeli:**
  - "Sıralı Queue" modu: Seçili mükellefleri sırayla sorgula
  - "Tümünü Sorgula" butonu: GİB bilgileri dolu tüm mükellefleri sırayla sorgula
- **Spec etkisi:** Yok (V1 scope değişmez), ama Notes bölümüne V2 roadmap notu eklenmeli ✓

#### WR-2: PM — Geçmiş Sorgu Erişimi (Desirability Gap)
- **Sorun:** "Veritabanı kaydı yok" kararı, kullanıcının geçen ay sorguladığı faturaları tekrar göremeyeceği anlamına gelir. Her seferinde yeniden sorgulama.
- **Karar:** V1'de doğru — anlık sorgulama basit ve hızlı. **V2 backlog:**
  - Son sorgu sonuçlarını `localStorage`'da cache'le (session bazlı)
  - Veya: Supabase'e query log kaydet (faturalar değil, sadece metadata)
- **Spec etkisi:** Task 6'ya opsiyonel `localStorage` cache eklenebilir (KISS — sadece son sonucu tut)

#### WR-3: Mühendis — Code Duplication Riski (Feasibility)
- **Sorun:** `gib-auth.ts` server-side'da çalışıyor. Electron Bot için `earsiv-dijital-api.ts`'de login **yeniden yazılacak**. İki yerde aynı captcha + login mantığı = bakım yükü 2x.
- **Analiz:** `gib-auth.ts` → `GibHttpClient` + `fetch` kullanıyor. Electron'da `node-fetch` veya built-in `fetch` kullanılabilir. Fark minimal.
- **Karar:** Pragmatik: V1'de Electron'a özel yaz (daha az bağımlılık). **Ama:**
  - Login helper'ını pure function olarak yaz (class değil)
  - Aynı `GIB_ENDPOINTS` + `HTTP_CONFIG` import et (shared sabitleri kullan)
  - Captcha solver'ı import et (`captcha-solver.ts` Node.js uyumlu, Electron'da çalışır)
- **Spec etkisi → Task 2 güncellemesi:**
  - `import { GIB_ENDPOINTS, HTTP_CONFIG } from '../../src/lib/gib-api/endpoints'` — shared sabitler
  - `import { solveUnifiedCaptcha } from '../../src/lib/gib-api/captcha-solver'` — captcha solver'ı yeniden yazmak yerine import et
  - Sadece login HTTP çağrısını yaz, captcha çözümünü mevcut modülden al

#### WR-4: Mühendis — pageSize Fallback Implementasyonu (Feasibility)
- **Sorun:** "100 olarak başla, 400/500 dönerse 50'ye düşür" — bu retry mantığı spec'te tanımlı ama task'larda implementasyon detayı yok.
- **Karar:** Basitleştir → **pageSize: 50 ile başla**. GİB'in 50'yi desteklediği kesin (mevcut response'da pageSize:10 var, 50 güvenli). 100 risk, 50 güvenli. Extra 1-2 API call kabul edilebilir.
- **Spec etkisi → Task 2 güncellemesi:** `pageSize: 50` (100 yerine). Fallback mantığı kaldırılır.

#### WR-5: Tasarımcı — Progress Gösterimi Detaylandırma (Viability)
- **Sorun:** "Dilim 1/5 sorgulanıyor..." kullanıcıya anlaşılmaz. Neyin 1/5'i? 7 günlük dilim nedir?
- **Karar:** Progress mesajlarını kullanıcı dostu yap:
  - ~~"Dilim 1/5 sorgulanıyor..."~~ → "01.01.2026 - 07.01.2026 arası sorgulanıyor (1/5)"
  - ~~"2. sayfa çekiliyor..."~~ → "Ek faturalar alınıyor (sayfa 2/3)"
  - Login fazında: "GİB'e giriş yapılıyor... (captcha çözülüyor)" → bu iyi
- **Spec etkisi → Task 2 ve Task 3'teki progress mesajları güncelleneli**

#### WR-6: Tasarımcı — Partial Failure UI (Viability)
- **Sorun:** `failedChunks` doluysa ne gösterilir? Spec'te "uyarı gösterilir" diyor ama UI detayı yok.
- **Karar:**
  - Sarı Alert banner (Radix Alert): "Dikkat: 22.01-28.01 ve 29.01-31.01 tarihleri sorgulanamadı. Sonuçlar eksik olabilir. [Tekrar Dene]"
  - Export'ta first row: "DİKKAT: Eksik tarih aralıkları: ..."
  - Tablo üstünde Badge: "Kısmi Sonuç" (sarı)
- **Spec etkisi → Task 9 güncellemesi:** Partial failure UI bileşeni eklenmeli

---

### 3. User Persona Focus Group

> _Mali müşavir (50+ mükellef) ve stajyer muhasebeci personaları ile özelliği test ediyoruz._

#### Persona A: Ahmet Bey — Kıdemli Mali Müşavir (60 mükellef, 15 yıl)

**UF-1: "Her ay 60 mükellefin faturalarını teker teker mi sorgulayacağım?"**
- **Sorun:** Kritik UX pain point. Manuel süreçten farkı sadece browser açmamak — hala tek tek seçim.
- **Karar:** V1'de tek mükellef yeterli. **Ama UI'da beklenti yönetimi yapılmalı:**
  - Sayfa başlığı altında: "Tek mükellef sorgulama. Toplu sorgulama yakında eklenecek." notu
  - **V2 Roadmap:** Queue-based toplu sorgulama
- **Spec etkisi:** Yok (V1 scope). UF-1 olarak Notes'a kayıt.

**UF-2: "Excel'i Luca'ya nasıl aktaracağım?"**
- **Sorun:** Asıl amaç Luca çapraz kontrol. Excel formatı Luca import'una uyumlu olmalı.
- **Karar:** V1'de generic Excel yeterli. **Ama kolon sırası ve başlıkları Luca'nın beklediği formata yakın olmalı.** Luca import formatı araştırılmalı.
- **Spec etkisi → Task 8 notu:** "Kolon başlıkları ve sırası ileride Luca uyumlu hale getirilebilir"

**UF-3: "Mükellefin GİB şifresi değişmiş, nereden güncelleyeceğim?"**
- **Sorun:** Şifre hatalı → hata mesajı gösterilir. Ama kullanıcı şifreyi nereden güncelleyeceğini bilmeli.
- **Karar:** AUTH_FAILED hata mesajına link ekle: "GİB bilgilerini güncellemek için [Mükellef Ayarları'na gidin](/dashboard/mukellefler)"
- **Spec etkisi → Task 9:** Error mesajında mükellef düzenleme linki

#### Persona B: Zeynep — Stajyer Muhasebeci (1 yıl deneyim)

**UF-4: "Mükellef listesi çok uzun, hangisini seçeceğimi bulamıyorum"**
- **Sorun:** 60+ mükellef combobox'ta arama gerekir.
- **Karar:** Mükellef seçici `Combobox` (searchable) olmalı — plain Select yetersiz.
- **Spec etkisi → Task 9:** Mükellef seçici = searchable Combobox (mevcut projede `command` pattern'i varsa kullan)

**UF-5: "Sorgulama bittiğinde bana haber versin"**
- **Sorun:** Kullanıcı başka sekmeye geçebilir. Sorgulama 20-60 saniye sürer.
- **Karar:** Sorgulama tamamlandığında `Sonner toast` bildirimi göster: "X mükellef için Y fatura bulundu"
- **Spec etkisi → Task 6:** `COMPLETE` dispatch'inde `toast.success()` çağrısı

**UF-6: "Daha önce ne zaman sorguladığımı nasıl bileceğim?"**
- **Karar:** V1'de yok. **V2:** Son sorgulama tarihi customer tablosuna eklenebilir.
- **Spec etkisi:** Yok (V1). Notes'a kayıt.

---

### 4. What If Scenarios

> _Beklenmeyen durumları keşfediyoruz._

#### WI-1: "Ya GİB API endpoint'i değişirse?"
- **Mevcut durum:** URL'ler `endpoints.ts`'de `as const` tanımlı. Değiştiğinde tek noktadan güncellenir ✓
- **Risk:** Response JSON yapısı da değişebilir (field adları, nested yapı). Interface'ler kırılır.
- **Çözüm → Task 2'ye eklenmeli:**
  - Response validation: `resultListDenormalized` field'ı yoksa veya array değilse → `GIB_API_CHANGED` error code
  - `if (!response.resultListDenormalized || !Array.isArray(response.resultListDenormalized)) throw new Error('GIB_API_CHANGED')`
  - Hata mesajı: "GİB API yanıt formatı değişmiş olabilir. Lütfen uygulama güncellemesini kontrol edin."

#### WI-2: "Ya 1000+ fatura dönerse?"
- **Mevcut çözüm:** Virtual scrolling ✓, client-side data ✓
- **Risk:** Client-side sort/filter 2000+ row'da yavaşlayabilir. Excel export memory spike.
- **Çözüm → Task 7'ye eklenmeli:**
  - Sort ve filter işlemleri `useMemo` ile memoize ✓ (zaten spec'te var)
  - Excel export: `xlsx` streaming mode varsa kullan, yoksa chunk'larda yaz
  - **Üst limit uyarısı:** 5000+ fatura → "Çok fazla sonuç. Lütfen daha kısa dönem seçin." uyarısı

#### WI-3: "Ya captcha 5 denemede de çözülemezse?"
- **Mevcut çözüm:** `gib-auth.ts` 5 retry yapıyor.
- **Risk:** 5 × captcha çözüm maliyeti (~$0.015) + 5 × 30-90s = 2.5-7.5 dakika. Timeout'a (5 dk) denk gelebilir.
- **Çözüm → Task 2'ye eklenmeli:**
  - Max 3 captcha retry (5 değil) — her biri ~30s = max 90s login süresi
  - 3. başarısızlıkta: `CAPTCHA_FAILED` — "Captcha 3 denemede çözülemedi. GİB güvenlik görseli değişmiş olabilir."

#### WI-4: "Ya aynı tenant'ta 2 kullanıcı aynı anda sorgulama yaparsa?"
- **Bu PM-3'te ele alındı.** Çözüm: `requesterId` bazlı filtreleme.
- **Ek senaryo:** Aynı kullanıcı aynı mükellef için iki kez sorgulama başlatırsa?
- **Çözüm → Task 3'e eklenmeli:**
  - Bot'ta aktif sorgu tracking: `activeQueries: Map<string, boolean>` (key: customerId)
  - Aynı mükellef için aktif sorgu varsa reddet: `QUERY_IN_PROGRESS` error
  - Complete/error sonrası Map'ten sil

#### WI-5: "Ya kullanıcı sayfadan ayrılırsa sorgulama devam ederken?"
- **Sorun:** Bot sorgulamayı bitirir, WebSocket'e gönderir, ama kimse dinlemez.
- **Minimal çözüm:** Frontend hook cleanup'ta sorguyu iptal etme (bot cancel mekanizması yok). Resource waste kabul edilebilir — sonuçlar zaten bir kere gönderilip kaybolur.
- **V2 çözüm:** `earsiv:query-cancel` event'i + bot'ta abort controller
- **Spec etkisi:** Yok (V1'de kabul edilebilir). Notes'a kayıt.

#### WI-6: "Ya GİB rate limit 429 dönerse?"
- **Mevcut çözüm:** 2s delay var ✓
- **Risk:** GİB rate limit'i dinamik olabilir. 429 alındığında ne olacak?
- **Çözüm → Task 2'ye eklenmeli:**
  - HTTP 429 response → exponential backoff: 5s, 10s, 20s (max 3 retry)
  - 3 retry sonrası → `failedChunks`'a ekle, sonraki dilime geç
  - Progress: "GİB istek limiti aşıldı, bekleniyor (5s)..."

#### WI-7: "Ya Electron Bot'un `node-fetch` versiyonu TLS sorunları yaşarsa?"
- **Karar:** Electron'un built-in `net.fetch` veya `globalThis.fetch` (Electron 28+) kullanılmalı. `node-fetch` gereksiz dependency.
- **Spec etkisi → Task 2 notu:** "Electron 28+ built-in fetch kullan, `node-fetch` dependency ekleme"

---

### 5. Occam's Razor Application

> _Spec'teki gereksiz karmaşıklığı ele alıp en basit yeterli çözümü buluyoruz._

#### OR-1: Captcha Solver — Yeniden Yazmak Yerine Import Et
- **Mevcut spec:** "captcha-solver.ts pattern'ini referans al, ama Electron Bot'ta node-fetch kullan"
- **Basitleştirme:** `captcha-solver.ts` zaten `fetch` API kullanıyor (Node.js 18+ native). Electron 28+ da native `fetch` destekliyor. **Doğrudan import et:**
  ```typescript
  import { solveUnifiedCaptcha } from '../../src/lib/gib-api/captcha-solver';
  ```
- **Etki:** ~100 satır kod tasarrufu. Tek bakım noktası. Captcha provider değişse tek yerde güncellenir.
- **Risk:** Import path'i Electron build'de çalışmalı — `tsconfig` alias'ları kontrol edilmeli.
- **Spec etkisi → Task 2 güncellendi (WR-3 ile birleşik)**

#### OR-2: pageSize — 50 ile Başla, Fallback Mantığını Kaldır
- **Mevcut spec:** "100 olarak başla, GİB 400/500 dönerse 50'ye düşür"
- **Basitleştirme:** `pageSize: 50`. Fazla 1-2 API call (aylık max 100 fatura olan mükellef için 2 call vs 1 call) → ihmal edilebilir. Fallback retry mantığı = gereksiz karmaşıklık.
- **Spec etkisi → Task 2 güncellendi (WR-4 ile birleşik)**

#### OR-3: PDF Export — `window.print()` Yeterli
- **Mevcut spec:** "Tabloyu PDF olarak export et. `window.print()` veya mevcut PDF kütüphanesini kullan"
- **Basitleştirme:** `window.print()` + print stylesheet. Ek kütüphane gereksiz.
- **Etki:** Sıfır dependency eklentisi. Print preview'da kullanıcı sayfa düzeni ayarlayabilir.
- **Risk:** Tablo çok uzunsa (100+ row) print layout bozulabilir → `@media print` CSS ile yönetilebilir.
- **Spec etkisi:** Task 8 zaten bunu söylüyor ✓

#### OR-4: Login Modülü — Class Yerine Pure Functions
- **Mevcut spec:** Spec zaten pure function öneriyor ✓ (`gibDijitalLogin` fonksiyon, class değil)
- **Onay:** Doğru karar. `GibAuthService` class'ı session tracking + auto-refresh yapıyor — Electron modülünde bunlar gerekli değil (tek seferlik login + query + done).

#### OR-5: Dönem Seçici — Basit Ay/Yıl Dropdown Yeterli
- **Mevcut spec:** Ay + Yıl dropdown ✓
- **Alternatif düşünüldü:** Date range picker (custom tarih aralığı)
- **Karar:** Ay/Yıl dropdown daha basit ve iş kuralına uygun (mali müşavirler aylık düşünür). Custom date range V2'de eklenebilir.
- **Spec etkisi:** Yok ✓

#### OR-6: Deduplication — Composite Key Gerekli mi?
- **Mevcut spec:** `${faturaNo}-${tcknVkn}-${duzenlenmeTarihi}` (F28)
- **Analiz:** GİB faturaNo formatı: `TE12026000000125` — prefix + yıl + sıra no. Farklı satıcıdan aynı no **gelme ihtimali çok düşük** ama teorik olarak mümkün (farklı fatura serileri).
- **Karar:** Composite key doğru ve savunmacı yaklaşım. Maliyeti ihmal edilebilir (Set lookup O(1)). **Koru.**
- **Spec etkisi:** Yok ✓

---

### Elicitation Sonuç: Spec Değişiklik Özeti

| # | Bulgu | Kaynak | Etkilenen Task | Öncelik |
|---|-------|--------|---------------|---------|
| PM-1 | Token expiry mid-query → re-login | Pre-mortem | Task 2 | Yüksek |
| PM-2 | WS bağlantı kopma → sorgu durdur | Pre-mortem | Task 3 | Orta |
| PM-3 | Tenant broadcast çakışması → requesterId | Pre-mortem | Task 3, 4, 5, 6 | **Kritik** |
| PM-4 | Captcha servisi down → hata kodu | Pre-mortem | Task 2, 3 | Orta |
| PM-5 | GİB HTML response → Content-Type check | Pre-mortem | Task 2 | Düşük |
| PM-6 | Memory pressure → batch concat | Pre-mortem | Task 6 | Düşük |
| WR-3 | Captcha solver import et (duplication azalt) | War Room | Task 2 | Orta |
| WR-4 | pageSize: 50 (fallback kaldır) | War Room | Task 2 | Orta |
| WR-5 | Progress mesajları kullanıcı dostu | War Room | Task 2, 3 | Orta |
| WR-6 | Partial failure UI detaylandırma | War Room | Task 9 | Orta |
| UF-4 | Mükellef seçici = searchable Combobox | Persona | Task 9 | Orta |
| UF-5 | Sorgulama bittiğinde toast bildirimi | Persona | Task 6 | Düşük |
| WI-1 | Response validation → GIB_API_CHANGED | What If | Task 2 | Orta |
| WI-3 | Captcha max 3 retry (5 yerine) | What If | Task 2 | Düşük |
| WI-4 | Aynı mükellef çift sorgu engelleme | What If | Task 3 | Orta |
| WI-6 | HTTP 429 → exponential backoff | What If | Task 2 | Orta |
| WI-7 | Electron built-in fetch (node-fetch değil) | What If | Task 2 | Düşük |
| OR-1 | Captcha solver import (= WR-3) | Occam | Task 2 | Orta |
| OR-2 | pageSize: 50 (= WR-4) | Occam | Task 2 | Orta |

### Uygulanması Gereken Kritik Değişiklikler (V1 Scope)

1. **PM-3 (Kritik):** `requesterId` bazlı mesaj filtreleme — tenant broadcast güvenlik açığı
2. **PM-1 (Yüksek):** Token expiry mid-query re-login mekanizması
3. **WR-3/OR-1 (Orta):** Captcha solver'ı import et, yeniden yazma
4. **WR-4/OR-2 (Orta):** pageSize: 50 sabit, fallback kaldır
5. **WI-1 (Orta):** GİB response format validation
6. **WI-4 (Orta):** Aynı mükellef çift sorgu engelleme
7. **WI-6 (Orta):** HTTP 429 exponential backoff

### V2 Backlog (Scope Dışı Ama Kayıt Altında)

- **WR-1:** Toplu mükellef sorgulama (queue-based)
- **WR-2:** Son sorgu sonuçlarını localStorage cache
- **UF-1:** "Toplu sorgulama yakında" UI notu
- **UF-2:** Luca uyumlu Excel format
- **UF-6:** Son sorgulama tarihi tracking
- **WI-5:** Sorgu iptal mekanizması (`earsiv:query-cancel`)
