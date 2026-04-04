# Handoff: WebSocket Tek Port Refactor (Render Uyumluluğu)
**Tarih:** 2026-04-03
**Durum:** Araştırma Tamamlandı → Uygulama Bekliyor

## Görev Tanımı
> WS server'ı ayrı porttan (3001) kaldırıp, HTTP server ile aynı porta (3000) taşı.
> Render/Railway gibi platformlar tek port veriyor. Ayrıca `_internal/dashboard-invalidate`
> endpoint'i port 3000'de ama `dashboard-invalidation.ts` port 3001'e istek atıyor — bu da düzeltilecek.

## Mevcut Durum
```
server.ts
├── HTTP :3000 → Next.js + _internal/* endpoints
└── WS   :3001 → WebSocketServer({ port: wsPort }) — AYRI PORT
```

## Hedef Durum
```
server.ts
└── :3000 → Next.js + _internal/* + WS (/ws path'i üzerinden upgrade)
```

## Araştırma Bulguları

### Client-Side WS Bağlantı Pattern'i (16 dosya — hepsi aynı)
```typescript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3001';
const wsHost = `${window.location.hostname}:${wsPort}`;
const ws = new WebSocket(`${protocol}//${wsHost}?token=${token}`);
```

### Yeni Pattern (DRY utility)
```typescript
import { getWsUrl } from "@/lib/ws-url";
const ws = new WebSocket(`${getWsUrl()}?token=${token}`);
```

### Bug: dashboard-invalidation.ts yanlış port kullanıyor
`_internal/dashboard-invalidate` endpoint'i port 3000'deki HTTP server'da, ama
`dashboard-invalidation.ts` port 3001'e (WS_PORT) istek atıyor. Bu refactor ile düzelecek
çünkü tek port olacak.

## Etkilenecek Dosyalar

| # | Dosya | Değişiklik |
|---|-------|-----------|
| 1 | `server.ts` | WS'i ayrı port → HTTP upgrade ile aynı porta taşı |
| 2 | `src/lib/ws-url.ts` | **Yeni dosya** — WS URL utility |
| 3 | `src/lib/dashboard-invalidation.ts` | WS_PORT → PORT kullan |
| 4 | `src/components/global-bot-listener.tsx` | getWsUrl() kullan |
| 5 | `src/components/beyannameler/hooks/use-bulk-query.ts` | getWsUrl() kullan |
| 6 | `src/components/beyannameler/hooks/use-beyanname-query.ts` | getWsUrl() kullan |
| 7 | `src/components/pos/hooks/use-pos-query.ts` | getWsUrl() kullan |
| 8 | `src/components/okc/hooks/use-okc-query.ts` | getWsUrl() kullan |
| 9 | `src/components/tahsilat/hooks/use-tahsilat-query.ts` | getWsUrl() kullan |
| 10 | `src/components/sgk-sorgulama/hooks/use-sgk-query.ts` | getWsUrl() kullan |
| 11 | `src/components/sgk-kontrol/hooks/use-sgk-kontrol-data.ts` | getWsUrl() kullan |
| 12 | `src/components/kdv9015-kontrol/hooks/use-kdv9015-kontrol-data.ts` | getWsUrl() kullan |
| 13 | `src/components/kdv2-kontrol/hooks/use-kdv2-kontrol-data.ts` | getWsUrl() kullan |
| 14 | `src/components/kdv-kontrol/hooks/use-kdv-kontrol-data.ts` | getWsUrl() kullan |
| 15 | `src/components/gecici-vergi-kontrol/hooks/use-gecici-vergi-kontrol-data.ts` | getWsUrl() kullan |
| 16 | `src/components/e-tebligat/hooks/use-etebligat-query.ts` | getWsUrl() kullan |
| 17 | `src/components/e-defter/hooks/use-edefter-query.ts` | getWsUrl() kullan |
| 18 | `src/components/e-arsiv-fatura/hooks/use-e-arsiv-query.ts` | getWsUrl() kullan |
| 19 | `src/app/(dashboard)/dashboard/mukellefler/client.tsx` | getWsUrl() kullan |
| 20 | `src/app/api/gib/stop/route.ts` | WS_PORT referansı temizle |
| 21 | `electron-bot/src/main/index.ts` | Default WS_URL: ws://localhost:3000/ws |

## Uygulama Planı

### Adım 1: `src/lib/ws-url.ts` — Yeni utility dosyası oluştur
```typescript
/**
 * WebSocket URL helper
 * Tüm client-side bileşenler bu fonksiyonu kullanır.
 */
export function getWsUrl(): string {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}
```
- `window.location.host` port dahil döner (localhost:3000 veya smmmasistan.com)
- `/ws` path'i ile WS upgrade tetiklenir
- NEXT_PUBLIC_WS_PORT artık gereksiz

### Adım 2: `server.ts` — WS server'ı aynı porta taşı

**Kaldır:**
```typescript
const wsPort = parseInt(process.env.WS_PORT || '3001', 10);
// ...
const wss = new WebSocketServer({ port: wsPort });
```

**Ekle:**
```typescript
const wss = new WebSocketServer({ noServer: true });

// HTTP server'ın upgrade event'inde WS bağlantısını yönet
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url!, `http://${request.headers.host}`);
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});
```

**Startup log güncelle:** wsPort referansını kaldır, tek port göster.

**Graceful shutdown:** `wss.close()` kalır, değişmez.

### Adım 3: `src/lib/dashboard-invalidation.ts` — Port düzelt

**Kaldır:**
```typescript
const WS_PORT = process.env.WS_PORT || '3001';
```

**Değiştir:**
```typescript
const API_PORT = process.env.PORT || '3000';
// ...
await fetch(`http://${WS_HOST}:${API_PORT}/_internal/dashboard-invalidate`, {
```

### Adım 4: 16 client-side dosyada WS URL pattern'ini değiştir

Hepsinde aynı değişiklik:

**Kaldır (her dosyada):**
```typescript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3001';
const wsHost = `${window.location.hostname}:${wsPort}`;
const ws = new WebSocket(`${protocol}//${wsHost}?token=${token}`);
```

**Ekle:**
```typescript
import { getWsUrl } from "@/lib/ws-url";
// ...
const ws = new WebSocket(`${getWsUrl()}?token=${token}`);
```

Dosya listesi (tümünde aynı değişiklik):
1. `src/components/global-bot-listener.tsx` (satır 96-99)
2. `src/components/beyannameler/hooks/use-bulk-query.ts` (satır 274-277, 476)
3. `src/components/beyannameler/hooks/use-beyanname-query.ts` (satır 527-530)
4. `src/components/pos/hooks/use-pos-query.ts` (satır 147-150)
5. `src/components/okc/hooks/use-okc-query.ts` (satır 181-184)
6. `src/components/tahsilat/hooks/use-tahsilat-query.ts` (satır 167-170)
7. `src/components/sgk-sorgulama/hooks/use-sgk-query.ts` (satır 339-342)
8. `src/components/sgk-kontrol/hooks/use-sgk-kontrol-data.ts` (satır 169-172)
9. `src/components/kdv9015-kontrol/hooks/use-kdv9015-kontrol-data.ts` (satır 172-175)
10. `src/components/kdv2-kontrol/hooks/use-kdv2-kontrol-data.ts` (satır 169-172)
11. `src/components/kdv-kontrol/hooks/use-kdv-kontrol-data.ts` (satır 169-172)
12. `src/components/gecici-vergi-kontrol/hooks/use-gecici-vergi-kontrol-data.ts` (satır 178-181)
13. `src/components/e-tebligat/hooks/use-etebligat-query.ts` (satır 234-237)
14. `src/components/e-defter/hooks/use-edefter-query.ts` (satır 163-166)
15. `src/components/e-arsiv-fatura/hooks/use-e-arsiv-query.ts` (satır 180-183)
16. `src/app/(dashboard)/dashboard/mukellefler/client.tsx` (satır 122-125)

### Adım 5: `src/app/api/gib/stop/route.ts` — WS_PORT referansı temizle
Satır 18'de `WS_PORT` kullanılıyor ama aslında `PORT`'a istek atıyor. WS_PORT referansını kaldır.

### Adım 6: `electron-bot/src/main/index.ts` — Default URL güncelle
```typescript
// Eski:
const wsUrl = process.env.WS_URL || 'ws://localhost:3001';
// Yeni:
const wsUrl = process.env.WS_URL || 'ws://localhost:3000/ws';
```

### Adım 7: `use-bulk-query.ts` satır 476 — İkinci WS_PORT referansı
```typescript
// Eski:
const port = process.env.NEXT_PUBLIC_WS_PORT || "3001";
// Kontrol et ne amaçla kullanılıyor, muhtemelen hasElectronClient check. Güncelle veya kaldır.
```

### Adım 8: Env variable temizliği
- `NEXT_PUBLIC_WS_PORT` artık gereksiz — `.env` ve `.env.example`'dan kaldır
- `WS_PORT` artık gereksiz — kaldır
- `WS_URL` (electron-bot) kalır, default değişir

## Teknik Notlar
- `window.location.host` zaten port içerir (localhost:3000), hostname ise içermez (localhost)
- `noServer: true` ile WS server kendi port açmaz, upgrade event'i bekler
- `server.on('upgrade', ...)` sadece `/ws` path'ine gelen upgrade isteklerini kabul eder
- Next.js HMR de upgrade kullanıyor — path kontrolü ile çakışma olmaz (`/ws` vs `/_next/webpack-hmr`)
- Electron Bot'un `WS_URL` env var'ı production'da `wss://domain.com/ws` olacak

## Kararlar ve Gerekçeler
| Karar | Neden | Alternatif |
|-------|-------|-----------|
| Utility fonksiyon (`getWsUrl`) | 16 dosyada aynı pattern, DRY | Her dosyada inline (mevcut) |
| `noServer: true` + upgrade | Platform bağımsız, tek port | Ayrı port (mevcut, platform kısıtlı) |
| Path `/ws` | Basit, Next.js HMR ile çakışmaz | Query param ile ayırma |
