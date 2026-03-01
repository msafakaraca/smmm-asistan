---
title: 'E-Arşiv Fatura Sorgulama Entegrasyonu'
slug: 'e-arsiv-fatura-sorgulama'
created: '2026-02-12'
status: 'in-progress'
stepsCompleted: [1, 2, 3, 4]
status: 'ready'
tech_stack: ['Next.js 15', 'React 19', 'TypeScript 5.7', 'Electron', 'WebSocket', 'TanStack Virtual', 'XLSX (client-side)', 'Radix UI', 'TailwindCSS 4']
files_to_modify:
  - 'electron-bot/src/main/earsiv-api.ts (YENİ)'
  - 'electron-bot/src/main/index.ts (DÜZENLE)'
  - 'server.ts (DÜZENLE)'
  - 'src/app/api/earsiv/query/route.ts (YENİ)'
  - 'src/app/(dashboard)/dashboard/e-arsiv-fatura/page.tsx (YENİ)'
  - 'src/components/e-arsiv-fatura/e-arsiv-fatura-page.tsx (YENİ)'
  - 'src/components/e-arsiv-fatura/e-arsiv-fatura-table.tsx (YENİ)'
  - 'src/components/e-arsiv-fatura/hooks/use-e-arsiv-websocket.ts (YENİ)'
  - 'src/components/dashboard/nav.tsx (DÜZENLE)'
code_patterns:
  - 'HTTP API: URLSearchParams + POST to dispatch (bot.ts pattern)'
  - 'WebSocket: wsClient.send(type, data) → server relay → browser'
  - 'Auth: getUserWithProfile() + tenantId filter'
  - 'Table: useVirtualizer + memo + sticky header'
  - 'Nav: navItems array with children'
  - 'Export: client-side XLSX from in-memory data'
test_patterns: []
---

# Tech-Spec: E-Arşiv Fatura Sorgulama Entegrasyonu

**Created:** 2026-02-12

## Overview

### Problem Statement

Mali müşavirler, mükelleflerin gelen ve düzenlenen e-arşiv faturalarını görmek için GİB e-Arşiv Portal'ına (earsivportal.efatura.gov.tr) tek tek giriş yapmak zorunda kalıyor. Her mükellef için ayrı giriş, ayrı tarih filtresi, ayrı sorgu — bu ciddi zaman kaybı ve verimsizlik yaratıyor.

### Solution

Electron bot üzerinden GİB e-Arşiv Portal API'sine doğrudan HTTP istekleriyle bağlanarak:
- Gelen faturaları listeleme (adıma kesilen belgeler)
- Düzenlenen faturaları listeleme (kestiğim faturalar)
- Fatura detayı görüntüleme (JSON + HTML)
- Excel export

Tüm istekler kullanıcının kendi bilgisayarından (Electron) yapılacak — IP ban / rate limit riski minimize edilecek.

### Scope

**In Scope:**
- E-Arşiv Portal API login (token alma — captcha yok, sadece kullanıcı adı + şifre)
- Düzenlenen faturalar listesi (`EARSIV_PORTAL_TASLAKLARI_GETIR`)
- Gelen faturalar listesi (`EARSIV_PORTAL_ADIMA_KESILEN_BELGELERI_GETIR`)
- Fatura detayı görüntüleme (`EARSIV_PORTAL_FATURA_GETIR` + `EARSIV_PORTAL_FATURA_GOSTER`)
- Excel export (client-side XLSX)
- Mevcut Customer credentials kullanımı (gibKodu + gibSifre)
- Electron bot üzerinden HTTP istekleri (kullanıcı IP'sinden)
- WebSocket mesajlaşma (Next.js server ↔ Electron bot)
- Dashboard'da yeni e-Arşiv fatura sayfası

**Out of Scope:**
- Fatura oluşturma / imzalama / iptal
- Veritabanı cache (her zaman canlı sorgulama)
- E-Fatura sistemi (farklı portal)
- SMS doğrulama
- Next.js server'dan direkt GİB API çağrısı

## Context for Development

### Codebase Patterns

#### 1. Electron Bot HTTP API Pattern (bot.ts)
- HTTP istekleri `fetch()` ile yapılıyor (node-fetch değil, native)
- `URLSearchParams` ile form-urlencoded body oluşturma
- Headers: `Content-Type: application/x-www-form-urlencoded`, browser User-Agent, Referer
- Login → Token → Dispatch akışı
- Adaptive retry: HTTP 500 sonrası progressive backoff (2s→5s→8s)
- PDF'ler base64 olarak WebSocket üzerinden gönderiliyor

#### 2. WebSocket Mesajlaşma Pattern (ws-client.ts)
- `wsClient.send(type, data)` — Generic mesaj gönderme
- `wsClient.sendProgress(progress, message)` → `bot:progress` tipi
- `wsClient.sendComplete(result)` → `bot:complete` tipi (max 3 retry)
- `wsClient.sendError(error)` → `bot:error` tipi
- Bağlantı koptuğunda queue (max 100 mesaj), 5s interval reconnect (max 20 deneme)

#### 3. Server Message Routing (server.ts)
- `handleMessage(client, message)` switch-case ile mesaj yönlendirme
- `broadcastToTenant(tenantId, data)` — Tenant'a mesaj broadcast
- `/_internal/bot-command` POST endpoint — API'den bot'a komut gönderme
- Her mesaj `client.tenantId` ile tenant isolation sağlıyor

#### 4. API → Bot Komut Pattern (sync/route.ts)
```
Auth check → Credential decrypt → fetch('/_internal/bot-command') → SSE response
```

#### 5. UI Table Pattern (kontrol-table.tsx, kdv-kontrol-table.tsx)
- `useVirtualizer` (200+ satır threshold, estimateSize: 40, overscan: 10)
- `React.memo` ile component memoization
- Sticky header: `sticky top-0 z-20 bg-muted`
- Status badges: icon + color + label config object
- TailwindCSS: `text-xs`, `border-separate border-spacing-0`

#### 6. Navigation Pattern (nav.tsx)
- `navItems` array: `{ title, href, icon, children? }`
- Children = sub-menu (açılır)
- `openMenus` Set ile state yönetimi
- Lucide React iconları

#### 7. Mevcut E-Arşiv Altyapısı
- `earsiv-launcher.ts` — Sadece portal açıyor (Puppeteer headed), API çağrısı YOK
- `src/app/api/bot/launch-gib/route.ts` — `application: 'earsiv'` zaten destekleniyor → `earsiv:launch` event
- Quick Actions Panel'de "GİB 5000/2000" linki mevcut

### GİB E-Arşiv Portal API Detayları

**Base URL:** `https://earsivportal.efatura.gov.tr`
**Test URL:** `https://earsivportaltest.efatura.gov.tr`

**Endpoint'ler:**
| Path | İşlev |
|------|-------|
| `/earsiv-services/assos-login` | Token alma (login) |
| `/earsiv-services/dispatch` | Tüm iş operasyonları |
| `/earsiv-services/download` | Dosya indirme |

**Login:**
```
POST /earsiv-services/assos-login
Content-Type: application/x-www-form-urlencoded
assoscmd=anologin&userid={gibKodu}&sifre={gibSifre}&sifre2={gibSifre}&parola=1&rtype=json
→ Response: {"token": "xxx"}
```

**Düzenlenen Faturalar:**
```
POST /earsiv-services/dispatch
cmd=EARSIV_PORTAL_TASLAKLARI_GETIR&pageName=RG_BASITTASLAKLAR&callid={UUID}&token={token}
jp={"baslangic":"01/01/2024","bitis":"31/01/2024","hangiTip":"5000/30000","table":[]}
```

**Gelen Faturalar:**
```
POST /earsiv-services/dispatch
cmd=EARSIV_PORTAL_ADIMA_KESILEN_BELGELERI_GETIR&pageName=RG_ALICI_TASLAKLAR&callid={UUID}&token={token}
jp={"baslangic":"01/01/2024","bitis":"31/01/2024"}
```

**Fatura Detayı:**
```
POST /earsiv-services/dispatch
cmd=EARSIV_PORTAL_FATURA_GETIR&pageName=RG_BASITFATURA&callid={UUID}&token={token}
jp={"ettn":"{fatura-ETTN}"}
```

**Fatura HTML Görünüm:**
```
POST /earsiv-services/dispatch
cmd=EARSIV_PORTAL_FATURA_GOSTER&pageName=RG_BASITFATURA&callid={UUID}&token={token}
jp={"ettn":"{fatura-ETTN}","onpiPreview":"P"}
```

**Ortak Headers:**
```
Content-Type: application/x-www-form-urlencoded;charset=UTF-8
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Referrer: https://earsivportal.efatura.gov.tr/intragiris.html
Accept: */*
Accept-Language: tr,en-US;q=0.9,en;q=0.8
```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `electron-bot/src/main/bot.ts` | HTTP API pattern (login, dispatch, URLSearchParams, headers, retry) |
| `electron-bot/src/main/ws-client.ts` | WebSocket client (send, progress, complete, error, queue) |
| `electron-bot/src/main/earsiv-launcher.ts` | Mevcut e-Arşiv launcher (config, selectors — sadece portal açma) |
| `electron-bot/src/main/index.ts` | Electron main process (message handler registration) |
| `server.ts` | WebSocket server (handleMessage, broadcastToTenant, /_internal/bot-command) |
| `src/app/api/gib/sync/route.ts` | API→Bot komut gönderme pattern (auth, decrypt, fetch internal) |
| `src/app/api/bot/launch-gib/route.ts` | E-Arşiv launch altyapısı (application: 'earsiv' desteği) |
| `src/components/kontrol/kontrol-table.tsx` | Virtual scrolling table pattern |
| `src/components/kdv-kontrol/kdv-kontrol-table.tsx` | Status badge + inline actions pattern |
| `src/components/dashboard/nav.tsx` | Navigation menü pattern |
| `src/components/dashboard/quick-actions-panel.tsx` | GİB 5000/2000 quick link (mevcut e-arşiv launcher) |
| `src/lib/crypto.ts` | AES-256-GCM encrypt/decrypt |
| `src/lib/supabase/auth.ts` | getUserWithProfile() auth guard |

### Technical Decisions

1. **Electron bot üzerinden HTTP** — IP ban/rate limit riskini minimize etmek için tüm GİB API istekleri kullanıcının kendi bilgisayarından yapılacak
2. **Mevcut credentials** — Customer modelindeki gibKodu + gibSifre alanları kullanılacak, yeni alan eklenmeyecek
3. **Canlı sorgulama** — DB cache yok, her istekte GİB API'ye gidilecek. Veriler WebSocket üzerinden browser'a gelecek, orada state'te tutulacak
4. **Client-side Excel** — XLSX export, browser'daki in-memory veriden oluşturulacak (DB'de veri olmadığı için server-side export anlamsız)
5. **Yeni WebSocket mesaj tipleri** — `earsiv:query`, `earsiv:progress`, `earsiv:results`, `earsiv:detail`, `earsiv:error`
6. **Müşteri bazlı sorgulama** — Her sorguda tek bir müşterinin credential'ları ile login yapılacak (GİB portal per-user token veriyor)
7. **Tab yapısı** — "Gelen E-Arşiv Faturalar" ve "Giden E-Arşiv Faturalar" olmak üzere 2 tab. Her tab farklı dispatch komutu (ADIMA_KESILEN vs TASLAKLARI_GETIR)
8. **Mükellef seçimi** — Dropdown ile GİB bilgileri dolu olan mükelleflerin listelenmesi. Seçim sonrası gibKodu + gibSifre decrypt edilerek bot'a gönderilecek
9. **Skeleton loader** — Tablo yüklenene kadar gri animasyonlu placeholder satırlar
10. **Fatura detay dialog** — Modal (Dialog) ile fatura HTML görünümü. HTML sanitize edilecek (XSS koruması)

## Implementation Plan

### Akış Diyagramı

```
┌──────────────┐     ┌───────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Browser UI  │────►│ API Route     │────►│ WebSocket Server │────►│ Electron Bot    │
│  (React)     │     │ /api/earsiv/  │     │ server.ts        │     │ earsiv-api.ts   │
│              │     │ query         │     │ /_internal/      │     │                 │
│ Fatura       │     │               │     │ bot-command      │     │ 1. Login (token)│
│ listesi      │◄────│               │◄────│                  │◄────│ 2. List faturas │
│ göster       │     │               │     │ broadcastToTenant│     │ 3. Get detail   │
│              │     │               │     │                  │     │ 4. Send results │
└──────────────┘     └───────────────┘     └──────────────────┘     └─────────────────┘
     ▲                                            │                         │
     │              WebSocket (real-time)          │                         │
     └────────────────────────────────────────────┘                         │
                                                                            │
                                                              ┌─────────────▼──────┐
                                                              │ GİB E-Arşiv Portal │
                                                              │ earsivportal.       │
                                                              │ efatura.gov.tr      │
                                                              └────────────────────┘
```

### Tasks

#### Task 1: Electron Bot — E-Arşiv API Modülü
**Dosya:** `electron-bot/src/main/earsiv-api.ts` (YENİ)
**Bağımlılık:** Yok (ilk yapılacak)

- [ ] `EARSIV_API_CONFIG` sabitleri tanımla (base URL, endpoints, headers, timeouts)
- [ ] `earsivLogin(userid, sifre)` — POST `/earsiv-services/assos-login` → token döner
- [ ] `fetchDuzenlenenFaturalar(token, baslangic, bitis)` — `EARSIV_PORTAL_TASLAKLARI_GETIR` dispatch
- [ ] `fetchGelenFaturalar(token, baslangic, bitis)` — `EARSIV_PORTAL_ADIMA_KESILEN_BELGELERI_GETIR` dispatch
- [ ] `fetchFaturaDetay(token, ettn)` — `EARSIV_PORTAL_FATURA_GETIR` → JSON detay
- [ ] `fetchFaturaHtml(token, ettn)` — `EARSIV_PORTAL_FATURA_GOSTER` → HTML render
- [ ] UUID v1 `callid` üretimi (crypto.randomUUID veya uuid paketi)
- [ ] Retry logic: HTTP 500 → progressive backoff (bot.ts pattern)
- [ ] Token expiry handling: Response'da `error: "1"` + `"Oturum zamanaşımına uğradı"` → otomatik re-login (token ~5dk ömürlü)
- [ ] Error code mapping: `error: "1"` + `messages` array parse et. NullPointerException, oturum zamanaşımı, genel hata durumları
- [ ] Login komutu: Production `assoscmd=anologin`, Test ortamı `assoscmd=login` — config'de ayarlanabilir
- [ ] HTML görüntüleme boş dönebilir (`data: ""`) — fallback olarak JSON detay tablosu

**Pattern referans:** `bot.ts:502-618` (login), `bot.ts:622-895` (dispatch), `bot.ts:269-284` (adaptive backoff)

#### Task 2: Electron Bot — Message Handler Kaydı
**Dosya:** `electron-bot/src/main/index.ts` (DÜZENLE)
**Bağımlılık:** Task 1

- [ ] `earsiv:query` event listener ekle (mevcut `earsiv:launch` pattern'i takip et)
- [ ] `earsiv:detail` event listener ekle (tekil fatura detay isteği)
- [ ] Dynamic import: `await import('./earsiv-api')`
- [ ] Progress callback: `wsClient.send('earsiv:progress', { progress, message })`
- [ ] Sonuç gönderimi: `wsClient.send('earsiv:results', { queryType, faturas })`
- [ ] Detay gönderimi: `wsClient.send('earsiv:detail', { ettn, html, json })`
- [ ] Hata gönderimi: `wsClient.sendError(error, 'EARSIV_ERROR')`

**Pattern referans:** `index.ts:275-825` (event listener registration), `earsiv:launch` handler

#### Task 3: WebSocket Server — Mesaj Routing
**Dosya:** `server.ts` (DÜZENLE)
**Bağımlılık:** Yok (paralel yapılabilir)

- [ ] `handleMessage` switch-case'e `earsiv:progress` ekle → `broadcastToTenant`
- [ ] `handleMessage` switch-case'e `earsiv:results` ekle → `broadcastToTenant`
- [ ] `handleMessage` switch-case'e `earsiv:detail` ekle → `broadcastToTenant`
- [ ] `handleMessage` switch-case'e `earsiv:error` ekle → `broadcastToTenant`

**Pattern referans:** `server.ts:131-434` (handleMessage), `server.ts:86-97` (broadcastToTenant)

#### Task 4: API Route — E-Arşiv Sorgu Endpoint'i
**Dosya:** `src/app/api/earsiv/query/route.ts` (YENİ)
**Bağımlılık:** Task 3

- [ ] POST endpoint: `{ customerId, queryType, startDate, endDate }`
- [ ] Auth guard: `getUserWithProfile()` + tenantId
- [ ] Customer lookup: `prisma.customer.findFirst({ where: { id, tenantId } })`
- [ ] Credential decrypt: `decrypt(customer.gibKodu)`, `decrypt(customer.gibSifre)`
- [ ] GİB bilgileri kontrolü: gibKodu/gibSifre boşsa hata dön
- [ ] `/_internal/bot-command` POST ile bot'a komut delege et
- [ ] SSE stream response (mevcut sync/route.ts pattern)
- [ ] Hata durumları: 401 (auth), 400 (eksik bilgi), 502 (bot bağlı değil)

**Pattern referans:** `src/app/api/gib/sync/route.ts:38-138` (SSE + credential decrypt + bot delegation)

#### Task 5: Frontend — E-Arşiv Fatura Sayfası
**Dosya:** `src/app/(dashboard)/dashboard/e-arsiv-fatura/page.tsx` (YENİ)
**Bağımlılık:** Yok (paralel yapılabilir)

- [ ] Dashboard layout içinde page component
- [ ] Dynamic import: `EArsivFaturaPage` component'i lazy load

#### Task 6: Frontend — Ana Sayfa Component'i
**Dosya:** `src/components/e-arsiv-fatura/e-arsiv-fatura-page.tsx` (YENİ)
**Bağımlılık:** Task 5, Task 7, Task 8

- [ ] Mükellef dropdown: `/api/customers` endpoint'inden GİB bilgileri dolu olanları listele
- [ ] Dönem seçici: Ay/Yıl dropdown (varsayılan: bir önceki ay — beyanname dönem kuralı)
- [ ] "Sorgula" butonu → POST `/api/earsiv/query`
- [ ] Tab yapısı: `useState<'gelen' | 'giden'>('gelen')` — Radix Tabs
- [ ] Tab: "Gelen E-Arşiv Faturalar" | "Giden E-Arşiv Faturalar"
- [ ] Tab değiştiğinde yeni sorgu tetikle (veya cached sonucu göster)
- [ ] "Excel İndir" butonu → client-side XLSX export
- [ ] Loading state: Skeleton loader (tablo boyutunda)
- [ ] Error state: Bot bağlı değil / GİB bilgileri eksik / API hatası
- [ ] Empty state: "Fatura bulunamadı" mesajı
- [ ] WebSocket hook entegrasyonu (real-time sonuçlar)

#### Task 7: Frontend — Fatura Tablosu
**Dosya:** `src/components/e-arsiv-fatura/e-arsiv-fatura-table.tsx` (YENİ)
**Bağımlılık:** Task 6

- [ ] Virtual scrolling: `useVirtualizer` (200+ satır threshold, estimateSize: 40)
- [ ] React.memo ile row memoization
- [ ] Sticky header: `sticky top-0 z-20 bg-muted`
- [ ] Gelen faturalar kolonları: Belge No, VKN/TCKN, Unvan, Tarih, Tutar, KDV
- [ ] Giden faturalar kolonları: Belge No, VKN/TCKN, Alıcı Unvan, Tarih, Tutar, KDV, Durum
- [ ] Satıra tıkla → Fatura Detay Dialog aç
- [ ] Skeleton loader: 8 satır placeholder (gri animasyon)
- [ ] Sıralama: Tarih (varsayılan: en yeni üstte)
- [ ] Toplam tutar/KDV özeti (tablo altı)

#### Task 8: Frontend — WebSocket Hook
**Dosya:** `src/components/e-arsiv-fatura/hooks/use-e-arsiv-websocket.ts` (YENİ)
**Bağımlılık:** Task 3

- [ ] WebSocket bağlantısı dinle: `earsiv:progress`, `earsiv:results`, `earsiv:detail`, `earsiv:error`
- [ ] State yönetimi: `{ status, progress, gelenFaturalar, gidenFaturalar, selectedFaturaDetail, error }`
- [ ] Status enum: `'idle' | 'connecting' | 'loading' | 'success' | 'error'`
- [ ] Progress tracking: GİB'e bağlanılıyor → Login → Faturalar çekiliyor → Tamamlandı
- [ ] Cleanup: Component unmount'ta listener'ları temizle

#### Task 9: Frontend — Fatura Detay Dialog
**Dosya:** `src/components/e-arsiv-fatura/e-arsiv-fatura-page.tsx` içinde (veya ayrı component)
**Bağımlılık:** Task 6, Task 8

- [ ] Radix Dialog component
- [ ] HTML render: `dangerouslySetInnerHTML` ile GİB fatura HTML'i göster
- [ ] HTML sanitization: XSS koruması (DOMPurify veya mevcut sanitizer)
- [ ] Loading state: Dialog açılırken fatura detayı çekiliyorsa skeleton
- [ ] JSON detay tab'ı: Fatura alanlarını tablo formatında göster (opsiyonel)
- [ ] Dialog başlığı: Fatura no + tarih

#### Task 10: Navigation Güncelleme
**Dosya:** `src/components/dashboard/nav.tsx` (DÜZENLE)
**Bağımlılık:** Task 5

- [ ] `navItems` array'ine "E-Arşiv Fatura" menü öğesi ekle
- [ ] Icon: `FileText` veya `Receipt` (Lucide)
- [ ] Href: `/dashboard/e-arsiv-fatura`
- [ ] Konum: "Beyanname İşlemleri" grubunun altında veya bağımsız

### Uygulama Sırası

```
Paralel Grup A (Backend):         Paralel Grup B (Frontend):
┌─────────────────────────┐       ┌─────────────────────────┐
│ Task 1: earsiv-api.ts   │       │ Task 5: page.tsx        │
│ Task 3: server.ts       │       │ Task 10: nav.tsx        │
└──────────┬──────────────┘       └──────────┬──────────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────────┐       ┌─────────────────────────┐
│ Task 2: index.ts        │       │ Task 8: ws hook         │
│ Task 4: API route       │       │ Task 6: page component  │
└──────────┬──────────────┘       │ Task 7: table component │
           │                      │ Task 9: detail dialog   │
           ▼                      └─────────────────────────┘
     Entegrasyon Testi
```

### Acceptance Criteria

#### AC1: Mükellef Seçimi ve Sorgulama
```
Given: Kullanıcı e-Arşiv Fatura sayfasına girdi
When:  GİB bilgileri dolu bir mükellef seçip dönem belirleyip "Sorgula"ya tıkladı
Then:  Electron bot GİB e-Arşiv Portal'ına login olup fatura listesini döner
And:   Skeleton loader sorgu süresince görünür
And:   Sonuçlar tabloda listelenir
```

#### AC2: Tab Geçişi
```
Given: Kullanıcı bir mükellef için sorgulama yaptı ve sonuçlar geldi
When:  "Gelen E-Arşiv Faturalar" veya "Giden E-Arşiv Faturalar" tab'ına tıkladı
Then:  İlgili fatura listesi gösterilir (farklı dispatch komutu kullanılır)
```

#### AC3: Fatura Detay Görüntüleme
```
Given: Fatura listesi yüklenmiş durumda
When:  Kullanıcı bir fatura satırına tıkladı
Then:  Dialog açılır ve faturanın HTML görünümü gösterilir (GİB formatında)
And:   HTML sanitize edilerek XSS'e karşı korunur
```

#### AC4: Excel Export
```
Given: Fatura listesi yüklenmiş durumda
When:  Kullanıcı "Excel İndir" butonuna tıkladı
Then:  Aktif tab'daki (gelen/giden) faturalar Excel dosyası olarak indirilir
And:   Excel'de tüm kolonlar mevcut (Belge No, VKN, Unvan, Tarih, Tutar, KDV)
```

#### AC5: Hata Durumları
```
Given: Kullanıcı sorgulama yapmaya çalışıyor
When:  a) Electron bot bağlı değilse → "Bot bağlantısı bulunamadı" hatası gösterilir
       b) GİB bilgileri eksikse → "GİB giriş bilgileri eksik" hatası gösterilir
       c) GİB login başarısızsa → "GİB giriş başarısız: [GİB hata mesajı]" gösterilir
       d) GİB API yanıt vermezse → Timeout sonrası "GİB yanıt vermedi" gösterilir
Then:  Kullanıcı anlaşılır Türkçe hata mesajı görür
```

#### AC6: Real-time Progress
```
Given: Kullanıcı sorgulamayı başlattı
When:  Electron bot GİB API ile iletişim kuruyor
Then:  Kullanıcı sırasıyla şu aşamaları görür:
       1. "GİB'e bağlanılıyor..."
       2. "Giriş yapılıyor..."
       3. "Faturalar çekiliyor..."
       4. "Tamamlandı" (veya hata mesajı)
```

#### AC7: Dönem Seçimi
```
Given: Kullanıcı e-Arşiv Fatura sayfasını açtı
When:  Sayfa yüklendiğinde
Then:  Varsayılan dönem bir önceki ay olmalı (beyanname dönem kuralı)
       Ör: Bugün Şubat 2026 ise → Ocak 2026 seçili gelir
```

#### AC8: Navigation
```
Given: Kullanıcı dashboard'da
When:  Sol menüde "E-Arşiv Fatura" menü öğesine tıkladı
Then:  /dashboard/e-arsiv-fatura sayfasına yönlendirilir
```

## Additional Context

### Dependencies

- Electron bot'un çalışıyor olması gerekli (mevcut beyanname indirme için de aynı kısıt)
- Müşterinin gibKodu + gibSifre bilgilerinin dolu olması gerekli
- WebSocket bağlantısının aktif olması gerekli

### Testing Strategy

- E-Arşiv test ortamı mevcut: `https://earsivportaltest.efatura.gov.tr`
- Test credentials furkankadioglu/efatura repo'sunda `setTestCredentials()` ile alınabilir
- Manual test: Bot'u başlat → Fatura listele → Detay görüntüle → Excel export

### Notes

- GİB e-Arşiv Portal API captcha gerektirmiyor — sadece kullanıcı adı + şifre ile token alınıyor
- Tarih formatı: DD/MM/YYYY
- `jp` parametresi JSON string olarak gönderiliyor
- `callid` UUID v1 formatında
- Token session-based, her istek için gerekli
- `hangiTip: "5000/30000"` düzenlenen faturalar için filtre parametresi
- Mevcut `earsiv-launcher.ts` dosyasındaki `EARSIV_CONFIG` yeniden kullanılabilir
- `src/app/api/bot/launch-gib/route.ts` zaten `application: 'earsiv'` ve `earsiv:launch` event tipini destekliyor
- Referans repolar: github.com/mlevent/fatura, github.com/furkankadioglu/efatura

### API Test Sonuçları (2026-02-12 — Doğrulanmış)

#### Test Ortamı (earsivportaltest.efatura.gov.tr)
| Endpoint | Sonuç | Not |
|----------|-------|-----|
| Test credentials alma (`esign` + `kullaniciOner`) | **BASARILI** | userid: 33333301, sifre: 1 |
| Login (`assos-login` + `assoscmd=login`) | **BASARILI** | Token + redirectUrl dönüyor |
| Düzenlenen faturalar (`TASLAKLARI_GETIR`) | **BASARILI** | 253KB veri, yüzlerce test faturası |
| Gelen faturalar (`ADIMA_KESILEN_BELGELERI_GETIR`) | **HATA** | NullPointerException (GİB test ortamı bug'u) |
| Fatura JSON detay (`FATURA_GETIR`) | **BASARILI** | 3.4KB detay, malHizmetTable dahil |

#### Production Ortamı (earsivportal.efatura.gov.tr)
| Endpoint | Sonuç | Not |
|----------|-------|-----|
| Login (`assos-login` + `assoscmd=anologin`) | **BASARILI** | Token dönüyor, `chgpwd` yok |
| Düzenlenen faturalar (1 ay) | **BASARILI** | data array, fatura objesi |
| Düzenlenen faturalar (3 ay) | **BASARILI** | Tarih kısıtlaması YOK |
| Gelen faturalar | **HATA** | NullPointerException (bu mükellef için) |
| Fatura JSON detay | **BASARILI** | Tam fatura verisi (3575 byte) |
| Fatura HTML görüntüleme | **BOS** | `{"data":""}` — bu mükellef/fatura için boş |
| Token expiry | **DOGRULANMIS** | ~5 dk sonra "Oturum zamanaşımına uğradı" hatası |

#### Kritik Bulgular
1. **Login komutu farklı:** Test ortamı `assoscmd=login`, Production `assoscmd=anologin`
2. **Token ömrü kısa:** ~5 dakika sonra expire oluyor. Her sorgu öncesi token kontrolü gerekli
3. **Gelen faturalar API'si güvenilmez:** NullPointerException dönebilir. Graceful error handling şart
4. **HTML görüntüleme boş dönebilir:** Fallback olarak JSON detay tablosu gösterilmeli
5. **Tarih aralığı kısıtlaması yok:** Giden faturalar 1 hafta, 1 ay, 3 ay aralıkla çalışıyor
6. **`--data-urlencode` kullanılmalı:** `jp` parametresindeki JSON özel karakterler encode edilmeli

#### Doğrulanmış Response Formatları

**Fatura Listesi (data array):**
```json
{
  "data": [
    {
      "belgeNumarasi": "GIB2026000000001",
      "aliciVknTckn": "61258330806",
      "aliciUnvanAdSoyad": "MÜJDAT SAKİ",
      "belgeTarihi": "05-01-2026",
      "belgeTuru": "FATURA",
      "onayDurumu": "Onaylandı",
      "ettn": "58ddf26d-5359-433a-9ee5-8872a3822864"
    }
  ],
  "metadata": { "optime": "20260212..." }
}
```

**Fatura JSON Detay (data object):**
```json
{
  "data": {
    "faturaUuid": "...",
    "faturaTarihi": "05/01/2026",
    "faturaTipi": "SATIS",
    "paraBirimi": "TRY",
    "vknTckn": "61258330806",
    "aliciAdi": "MÜJDAT",
    "aliciSoyadi": "SAKİ",
    "vergiDairesi": "ALMUS VERGİ DAİRESİ MÜD.",
    "belgeNumarasi": "GIB2026000000001",
    "malHizmetTable": [
      {
        "malHizmet": "Toretto Yarı Otomatik...",
        "miktar": 1.0,
        "birimFiyat": 3000.0,
        "malHizmetTutari": 3000.0,
        "kdvOrani": 20.0,
        "kdvTutari": 600.0
      }
    ]
  }
}
```

**Token Expire Hatası:**
```json
{
  "error": "1",
  "messages": [{"type":"4","text":"Oturum zamanaşımına uğradı, yeni oturum açınız."}]
}
```

**GİB Sistem Hatası:**
```json
{
  "error": "1",
  "messages": ["Genel Sistem Hatası:java.lang.NullPointerException"]
}
```
