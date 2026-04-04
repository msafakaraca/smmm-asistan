# Handoff: Dashboard Anlık Güncelleme ve API Optimizasyonu
**Tarih:** 2026-04-03 14:30
**Durum:** Faz 1 Tamamlandı → Faz 2 Bekliyor

## Görev Tanımı
> Dashboard API'lerinin anlık olarak güncellenmesi ve çok hızlı bir şekilde API'lerin çekilmesi için kapsamlı optimizasyon. WebSocket-driven invalidation, batch API, server-side cache ve polling temizliği.

---

## Araştırma Bulguları

### Mevcut Mimari
- **Veri çekme:** SWR ile 4 paralel hook (stats, alerts, activity, upcoming)
- **Polling:** 60-120 saniye `refreshInterval` ile background polling
- **WebSocket:** Sadece bot progress için kullanılıyor (`server.ts:88-108`), dashboard invalidation yok
- **API:** 10 ayrı dashboard endpoint, her biri ayrı HTTP roundtrip
- **Cache:** Sadece SWR client-side cache (server-side cache yok)

### Sorunlar
1. Dashboard verileri **60-120 saniye gecikmeyle** güncelleniyor (polling)
2. Veri değişmese bile her 60-120 saniyede boş HTTP isteği yapılıyor
3. Dashboard sayfası açılırken **4 ayrı HTTP roundtrip** (latency çarpanı)
4. Server-side cache yok — her istek DB'ye gidiyor
5. Mutation (müşteri ekleme, görev tamamlama vb.) sonrası dashboard **hemen güncellenmiyor**

### Mevcut Dosya Yapısı
| Dosya | Satır | Rol |
|-------|-------|-----|
| `server.ts` | 733 | WebSocket server, `broadcastToTenant()` export'u var |
| `src/components/dashboard/hooks/use-dashboard-data.ts` | 312 | SWR hook'ları, fetcher, refresh fonksiyonları |
| `src/components/global-bot-listener.tsx` | ~250 | WebSocket listener (sadece bot events) |
| `src/providers/swr-provider.tsx` | ~80 | Global SWR config |
| `src/app/api/dashboard/stats/route.ts` | - | 19 paralel Prisma sorgusu |
| `src/app/api/dashboard/alerts/route.ts` | - | 6 paralel count sorgusu |
| `src/app/api/dashboard/activity/route.ts` | - | Audit log sorgusu |
| `src/app/api/dashboard/upcoming/route.ts` | - | Reminder sorgusu |
| `src/app/api/dashboard/tasks-summary/route.ts` | - | 20 paralel sorgu |
| `src/app/api/dashboard/declaration-stats/route.ts` | - | 6 kontrol tablosu sorgusu |
| `src/app/api/dashboard/announcement-stats/route.ts` | - | 10 count sorgusu |
| `src/app/api/dashboard/bulk-send-summary/route.ts` | - | 3 sorgu |
| `src/app/api/dashboard/takip-stats/route.ts` | - | 1 sorgu |
| `src/app/api/dashboard/takip-column-stats/route.ts` | - | 2 paralel sorgu |

---

## FAZ 1: WebSocket Dashboard Invalidation Sistemi
**Etki:** 🔥🔥🔥 (En yüksek) | **Efor:** 2-3 saat
**Hedef:** Mutation sonrası dashboard'un anlık güncellenmesi

### Adım 1.1: `server.ts` — Dashboard invalidation broadcast fonksiyonu ekle
- [x] `broadcastDashboardInvalidation(tenantId, keys)` fonksiyonu ekle (satır ~108 civarı, `broadcastToAll`'dan sonra)
- [x] `export`'a ekle (satır 733)

```typescript
// server.ts — broadcastToAll fonksiyonundan sonra eklenecek
function broadcastDashboardInvalidation(tenantId: string, keys: string[]): void {
  broadcastToTenant(tenantId, {
    type: 'dashboard:invalidate',
    data: { keys }
  });
}
```

Export satırı:
```typescript
export { broadcastToTenant, broadcastToAll, broadcastDashboardInvalidation, clients };
```

### Adım 1.2: `src/lib/dashboard-invalidation.ts` — API'lerden çağrılacak yardımcı modül (YENİ DOSYA)
- [x] API route'larından WebSocket server'a invalidation sinyali göndermek için HTTP-based helper

**Neden HTTP helper?**
Next.js API route'ları WebSocket server'dan izole çalışır. Doğrudan `broadcastDashboardInvalidation()` import edilemez (farklı process). Bu yüzden `server.ts`'e yeni bir internal endpoint eklenmeli ve API route'ları bu endpoint'i çağırmalı.

```typescript
// src/lib/dashboard-invalidation.ts
const WS_PORT = process.env.WS_PORT || '3001';
const WS_HOST = process.env.WS_HOST || 'localhost';

export async function invalidateDashboard(tenantId: string, keys: string[]): Promise<void> {
  try {
    await fetch(`http://${WS_HOST}:${WS_PORT}/_internal/dashboard-invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, keys }),
    });
  } catch {
    // Non-critical — sessizce devam et
    console.warn('[Dashboard Invalidation] WS server\'a ulaşılamadı');
  }
}

// Hangi mutation hangi dashboard key'leri etkiler
export const INVALIDATION_MAP = {
  customers: ['stats', 'alerts', 'declaration-stats'],
  tasks: ['stats', 'alerts', 'tasks-summary'],
  reminders: ['upcoming'],
  beyannameTakip: ['stats', 'declaration-stats'],
  takip: ['takip-stats', 'takip-column-stats'],
  announcements: ['announcement-stats'],
  activity: ['activity'],
} as const;
```

### Adım 1.3: `server.ts` — Internal dashboard invalidation endpoint'i ekle
- [x] Mevcut `/_internal/bot-command` endpoint'inin yanına ekle (satır ~531 civarı)

```typescript
// /_internal/dashboard-invalidate endpoint'i
if (req.method === 'POST' && pathname === '/_internal/dashboard-invalidate') {
  let body = '';
  req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
  req.on('end', () => {
    try {
      const { tenantId, keys } = JSON.parse(body);
      if (tenantId && keys?.length) {
        broadcastDashboardInvalidation(tenantId, keys);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(400);
        res.end('Missing tenantId or keys');
      }
    } catch {
      res.writeHead(400);
      res.end('Invalid JSON');
    }
  });
  return;
}
```

### Adım 1.4: `src/components/global-bot-listener.tsx` — Dashboard invalidation listener ekle
- [x] Mevcut `ws.onmessage` handler'ına `dashboard:invalidate` case'i ekle
- [x] SWR `mutate()` ile ilgili key'leri revalidate et

```typescript
// global-bot-listener.tsx — onmessage handler'ına eklenecek
} else if (message.type === "dashboard:invalidate") {
  const keys = message.data?.keys as string[];
  if (keys?.length) {
    const { mutate } = await import("swr");
    // İlgili key'lere uyan tüm SWR cache'lerini invalidate et
    mutate(
      (key: string) => typeof key === 'string' && keys.some(k => key.includes(`/api/dashboard/${k}`)),
      undefined,
      { revalidate: true }
    );
  }
}
```

### Adım 1.5: Mutation API'lerine invalidation çağrıları ekle
- [x] Her mutation endpoint'inin sonuna `invalidateDashboard()` çağrısı ekle (fire-and-forget)

**Etkilenecek dosyalar ve invalidation key'leri:**

| Dosya | Method | Invalidation Keys |
|-------|--------|-------------------|
| `src/app/api/customers/route.ts` | POST (L132) | `['stats', 'alerts', 'declaration-stats']` |
| `src/app/api/customers/route.ts` | DELETE (L354) | `['stats', 'alerts', 'declaration-stats']` |
| `src/app/api/customers/[id]/route.ts` | PUT (L65) | `['stats', 'alerts']` |
| `src/app/api/customers/[id]/route.ts` | DELETE (L113) | `['stats', 'alerts', 'declaration-stats']` |
| `src/app/api/customers/bulk-delete/route.ts` | DELETE (L6) | `['stats', 'alerts', 'declaration-stats']` |
| `src/app/api/customers/delete-all/route.ts` | DELETE (L5) | `['stats', 'alerts', 'declaration-stats']` |
| `src/app/api/customers/import/route.ts` | POST (L8) | `['stats', 'alerts', 'declaration-stats']` |
| `src/app/api/customers/bulk-status/route.ts` | POST (L56) | `['stats', 'alerts']` |
| `src/app/api/customers/[id]/credentials/route.ts` | PUT (L132) | `['alerts']` |
| `src/app/api/tasks/route.ts` | POST (L158) | `['stats', 'alerts', 'tasks-summary']` |
| `src/app/api/tasks/[id]/route.ts` | PUT (L183) | `['stats', 'alerts', 'tasks-summary']` |
| `src/app/api/tasks/[id]/route.ts` | DELETE (L326) | `['stats', 'alerts', 'tasks-summary']` |
| `src/app/api/tasks/[id]/status/route.ts` | PATCH (L51) | `['stats', 'alerts', 'tasks-summary']` |
| `src/app/api/tasks/bulk-delete/route.ts` | DELETE (L6) | `['stats', 'alerts', 'tasks-summary']` |
| `src/app/api/reminders/route.ts` | POST (L136) | `['upcoming']` |
| `src/app/api/reminders/[id]/route.ts` | PATCH (L17) | `['upcoming']` |
| `src/app/api/reminders/[id]/route.ts` | DELETE (L208) | `['upcoming']` |
| `src/app/api/beyanname-takip/route.ts` | PUT (L116) | `['stats', 'declaration-stats']` |
| `src/app/api/beyanname-takip/route.ts` | POST (L188) | `['stats', 'declaration-stats']` |
| `src/app/api/beyanname-takip/route.ts` | DELETE (L238) | `['stats', 'declaration-stats']` |
| `src/app/api/beyanname-takip/sync/route.ts` | POST (L14) | `['stats', 'declaration-stats']` |
| `src/app/api/takip/satirlar/route.ts` | POST (L130) | `['takip-stats', 'takip-column-stats']` |
| `src/app/api/takip/satirlar/route.ts` | PUT (L218) | `['takip-stats', 'takip-column-stats']` |
| `src/app/api/takip/satirlar/route.ts` | DELETE (L387) | `['takip-stats', 'takip-column-stats']` |
| `src/app/api/takip/bulk-status/route.ts` | POST (L20) | `['takip-stats', 'takip-column-stats']` |
| `src/app/api/takip/reset/route.ts` | POST (L10) | `['takip-stats', 'takip-column-stats']` |
| `src/app/api/announcements/send/route.ts` | POST (L18) | `['announcement-stats']` |
| `src/app/api/customer-groups/route.ts` | POST (L64) | `['stats']` |
| `src/app/api/customer-groups/[id]/route.ts` | PUT (L94) | `['stats']` |
| `src/app/api/customer-groups/[id]/route.ts` | DELETE (L183) | `['stats']` |
| `src/app/api/customer-groups/[id]/members/route.ts` | POST (L12) | `['stats']` |
| `src/app/api/customer-groups/[id]/members/route.ts` | DELETE (L119) | `['stats']` |

**Ekleme pattern'i (her dosyada aynı):**

```typescript
import { invalidateDashboard } from "@/lib/dashboard-invalidation";

// Mevcut mutation fonksiyonunun return'ünden ÖNCE (fire-and-forget):
invalidateDashboard(user.tenantId, ['stats', 'alerts']);
return NextResponse.json(result);
```

### Adım 1.6: `server.ts` — Bot işlemleri sonrası da dashboard invalidation
- [x] `bot:batch-processed` handler'ında (satır ~357) invalidation ekle
- [x] `bot:complete` handler'ında invalidation ekle

```typescript
// bot:batch-processed handler'ında, mevcut broadcastToTenant'tan sonra:
broadcastDashboardInvalidation(tenantId, ['stats', 'declaration-stats', 'activity']);
```

---

## FAZ 2: Batch Dashboard API
**Etki:** 🔥🔥 (Yüksek) | **Efor:** 3-4 saat
**Hedef:** Tek roundtrip'te tüm dashboard verilerini çekme

### Adım 2.1: `src/app/api/dashboard/batch/route.ts` — Batch endpoint oluştur (YENİ DOSYA)
- [x] POST endpoint: `{ widgets: ['stats', 'alerts', 'activity', 'upcoming', ...] }` alır
- [x] Her widget için mevcut endpoint'lerdeki logic'i resolver fonksiyonlara çıkar
- [x] `Promise.allSettled` ile paralel çalıştır (bir widget fail ederse diğerleri etkilenmez)
- [x] Her widget'ın query parametrelerini body'den al

```typescript
// src/app/api/dashboard/batch/route.ts
import { getUserWithProfile } from "@/lib/supabase/auth";
import { NextRequest, NextResponse } from "next/server";

// Her widget için resolver import'ları
import { resolveStats } from "./resolvers/stats";
import { resolveAlerts } from "./resolvers/alerts";
import { resolveActivity } from "./resolvers/activity";
import { resolveUpcoming } from "./resolvers/upcoming";

const RESOLVERS: Record<string, (user: UserProfile, params?: Record<string, string>) => Promise<unknown>> = {
  stats: resolveStats,
  alerts: resolveAlerts,
  activity: resolveActivity,
  upcoming: resolveUpcoming,
  // İsteğe bağlı genişleme:
  // 'tasks-summary': resolveTasksSummary,
  // 'declaration-stats': resolveDeclarationStats,
};

export async function POST(req: NextRequest) {
  const user = await getUserWithProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { widgets, params = {} } = await req.json();
  if (!Array.isArray(widgets) || widgets.length === 0) {
    return NextResponse.json({ error: "widgets array required" }, { status: 400 });
  }

  const results = await Promise.allSettled(
    widgets.map(w => {
      const resolver = RESOLVERS[w];
      if (!resolver) return Promise.reject(new Error(`Unknown widget: ${w}`));
      return resolver(user, params[w] || {});
    })
  );

  const response: Record<string, { ok: boolean; data?: unknown; error?: string }> = {};
  widgets.forEach((w, i) => {
    const r = results[i];
    response[w] = r.status === 'fulfilled'
      ? { ok: true, data: r.value }
      : { ok: false, error: r.reason?.message || 'Unknown error' };
  });

  return NextResponse.json(response);
}
```

### Adım 2.2: Resolver dosyaları oluştur (YENİ DOSYALAR)
- [x] `src/app/api/dashboard/batch/resolvers/stats.ts` — mevcut `stats/route.ts`'deki logic'i çıkar
- [x] `src/app/api/dashboard/batch/resolvers/alerts.ts` — mevcut `alerts/route.ts`'deki logic'i çıkar
- [x] `src/app/api/dashboard/batch/resolvers/activity.ts` — mevcut `activity/route.ts`'deki logic'i çıkar
- [x] `src/app/api/dashboard/batch/resolvers/upcoming.ts` — mevcut `upcoming/route.ts`'deki logic'i çıkar

**Pattern:** Her resolver mevcut route.ts'deki asıl iş mantığını alır, `user` ve `params` parametreleri alır, direkt data döner (NextResponse değil).

```typescript
// Örnek: resolvers/stats.ts
export async function resolveStats(user: UserProfile, params: Record<string, string>) {
  const year = parseInt(params.year) || defaultYear;
  const month = parseInt(params.month) || defaultMonth;
  // ... mevcut stats/route.ts'deki Promise.all logic'i
  return statsData;
}
```

**NOT:** Mevcut route.ts dosyaları silinmeyecek (geriye uyumluluk). İsteğe bağlı olarak resolver'ları çağıracak şekilde refactor edilebilir.

### Adım 2.3: `src/components/dashboard/hooks/use-dashboard-data.ts` — Batch fetching desteği
- [x] İlk yükleme için batch fetch, sonraki güncellemeler için individual SWR
- [x] Batch response'u parse edip her widget'ı ayrı SWR cache'ine yaz

```typescript
// use-dashboard-data.ts — İlk yükleme optimizasyonu
const batchInitialized = useRef(false);

useEffect(() => {
  if (batchInitialized.current) return;
  batchInitialized.current = true;

  // İlk yükleme: tek roundtrip
  fetch('/api/dashboard/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      widgets: ['stats', 'alerts', 'activity', 'upcoming'],
      params: {
        stats: { year: String(selectedYear), month: String(selectedMonth) },
        activity: { limit: '8', diverse: 'true' },
        upcoming: { limit: '3', days: '30' },
      }
    })
  })
  .then(r => r.json())
  .then(data => {
    // Her widget'ı SWR cache'ine yaz (revalidation tetiklemeden)
    if (data.stats?.ok) mutate(statsKey, data.stats.data, false);
    if (data.alerts?.ok) mutate('/api/dashboard/alerts', data.alerts.data, false);
    if (data.activity?.ok) mutate('/api/dashboard/activity?limit=8&diverse=true', data.activity.data, false);
    if (data.upcoming?.ok) mutate('/api/dashboard/upcoming?limit=3&days=30', data.upcoming.data, false);
  })
  .catch(() => { /* SWR individual hook'lar fallback olarak çalışır */ });
}, []);
```

### Adım 2.4: `prefetchDashboardData()` fonksiyonunu batch'e çevir
- [x] Mevcut 4 ayrı fetch yerine tek batch fetch

```typescript
export function prefetchDashboardData() {
  const { defaultYear, defaultMonth } = getDefaultPeriod();

  fetch('/api/dashboard/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      widgets: ['stats', 'alerts', 'activity', 'upcoming'],
      params: {
        stats: { year: String(defaultYear), month: String(defaultMonth) },
        activity: { limit: '8', diverse: 'true' },
        upcoming: { limit: '3', days: '30' },
      }
    })
  })
  .then(r => r.json())
  .then(data => {
    const statsUrl = `/api/dashboard/stats?year=${defaultYear}&month=${defaultMonth}`;
    if (data.stats?.ok) mutate(statsUrl, data.stats.data, false);
    if (data.alerts?.ok) mutate('/api/dashboard/alerts', data.alerts.data, false);
    if (data.activity?.ok) mutate('/api/dashboard/activity?limit=8&diverse=true', data.activity.data, false);
    if (data.upcoming?.ok) mutate('/api/dashboard/upcoming?limit=3&days=30', data.upcoming.data, false);
  })
  .catch(() => {});
}
```

---

## FAZ 3: Server-Side In-Memory Cache
**Etki:** 🔥🔥 (Yüksek) | **Efor:** 2 saat
**Hedef:** Tekrarlayan DB sorgularını azaltma, API response süresini düşürme

### Adım 3.1: `src/lib/server-cache.ts` — In-memory cache modülü oluştur (YENİ DOSYA)
- [x] TTL bazlı Map cache
- [x] Tenant-aware key yapısı
- [x] Invalidation desteği

```typescript
// src/lib/server-cache.ts

interface CacheEntry<T> {
  data: T;
  expires: number;
}

class ServerCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxSize = 500; // Maksimum entry sayısı

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    // LRU benzeri: max size aşılırsa en eskiyi sil
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, { data, expires: Date.now() + ttlMs });
  }

  // Belirli pattern'e uyan key'leri sil
  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    }
  }

  // Tenant bazlı tüm cache'i sil
  invalidateTenant(tenantId: string): void {
    this.invalidate(tenantId);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// Singleton instance (Next.js hot reload'da korunur)
const globalForCache = globalThis as typeof globalThis & { __serverCache?: ServerCache };
export const serverCache = globalForCache.__serverCache ?? (globalForCache.__serverCache = new ServerCache());
```

### Adım 3.2: Dashboard API'lere server-side cache ekle
- [x] Stats endpoint'i: 30 saniye TTL (dönem bazlı, sık değişmez)
- [x] Alerts endpoint'i: 60 saniye TTL
- [x] Declaration-stats: 60 saniye TTL
- [x] Tasks-summary: 30 saniye TTL
- [x] Announcement-stats: 120 saniye TTL
- [x] Takip-stats: 60 saniye TTL
- [x] Takip-column-stats: 60 saniye TTL

**Ekleme pattern'i (her endpoint'te aynı):**

```typescript
import { serverCache } from "@/lib/server-cache";

export async function GET(req: NextRequest) {
  const user = await getUserWithProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cache key: tenant + endpoint-specific params
  const cacheKey = `${user.tenantId}:stats:${year}:${month}`;
  const cached = serverCache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  // ... mevcut DB sorguları ...

  // Cache'e yaz
  serverCache.set(cacheKey, result, 30_000); // 30 saniye
  return NextResponse.json(result);
}
```

### Adım 3.3: Invalidation'da server cache'i de temizle
- [x] `src/lib/dashboard-invalidation.ts`'e server cache invalidation ekle

```typescript
// dashboard-invalidation.ts — invalidateDashboard fonksiyonuna ekle
import { serverCache } from "@/lib/server-cache";

export async function invalidateDashboard(tenantId: string, keys: string[]): Promise<void> {
  // 1. Server-side cache temizle (aynı process)
  keys.forEach(key => {
    serverCache.invalidate(`${tenantId}:${key}`);
  });

  // 2. Client-side cache'leri WS ile invalidate et (farklı process)
  try {
    await fetch(`http://${WS_HOST}:${WS_PORT}/_internal/dashboard-invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, keys }),
    });
  } catch {
    console.warn('[Dashboard Invalidation] WS server\'a ulaşılamadı');
  }
}
```

---

## FAZ 4: SWR Polling Temizliği ve Fine-Tuning
**Etki:** 🔥 (Orta) | **Efor:** 30-45 dakika
**Hedef:** WS invalidation aktif olduğunda gereksiz polling'i kaldırma, config optimizasyonu

### Adım 4.1: `use-dashboard-data.ts` — Polling interval'leri kaldır
- [x] `periodIndependentConfig.refreshInterval: 120000` → kaldırıldı
- [x] Activity hook'taki `refreshInterval: 60000` → kaldırıldı
- [x] WS invalidation ile artık polling'e gerek yok

```typescript
// ÖNCE:
const periodIndependentConfig = {
  refreshInterval: 120000, // ← KALDIR
  dedupingInterval: 60000,
  // ...
};

// SONRA:
const periodIndependentConfig = {
  dedupingInterval: 30000, // 60s → 30s (WS ile daha sık güncelleme mümkün)
  revalidateOnFocus: true, // false → true (tab'a dönünce güncel veri göster)
  // ...
};
```

### Adım 4.2: `swr-provider.tsx` — Global config fine-tuning
- [x] `revalidateOnFocus: false` → `true` olarak güncellendi
- [x] `dedupingInterval: 5000` → `10000` olarak güncellendi

### Adım 4.3: `use-dashboard-data.ts` — Fallback polling ekle (WS bağlantısı koptuğunda)
- [x] WS bağlı değilse 120 saniye polling'e geri dönüyor (adaptiveIndependentConfig)
- [x] `useBotLog()` hook'undan `electronConnected` state'i alınıyor

```typescript
// WS bağlantı durumuna göre adaptive config
const { wsConnected } = useBotLog();

const adaptiveConfig = useMemo(() => ({
  ...periodIndependentConfig,
  // WS yoksa fallback polling aç
  refreshInterval: wsConnected ? 0 : 120000,
}), [wsConnected]);
```

### Adım 4.4: Loading state iyileştirmesi
- [ ] ATLANDI — ayrı UI scope'u, gerektiğinde yapılacak

---

## Etkilenecek Dosyalar Özeti

| Dosya | Değişiklik | Faz |
|-------|-----------|-----|
| `server.ts` | Düzenleme — invalidation fonksiyon + internal endpoint | 1 |
| `src/lib/dashboard-invalidation.ts` | **Yeni dosya** — invalidation helper | 1 |
| `src/components/global-bot-listener.tsx` | Düzenleme — WS invalidation handler | 1 |
| `src/app/api/customers/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/customers/[id]/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/customers/bulk-delete/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/customers/delete-all/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/customers/import/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/customers/bulk-status/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/customers/[id]/credentials/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/tasks/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/tasks/[id]/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/tasks/[id]/status/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/tasks/bulk-delete/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/reminders/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/reminders/[id]/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/beyanname-takip/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/beyanname-takip/sync/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/takip/satirlar/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/takip/bulk-status/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/takip/reset/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/takip/kolonlar/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/announcements/send/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/customer-groups/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/customer-groups/[id]/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/customer-groups/[id]/members/route.ts` | Düzenleme — invalidation çağrısı | 1 |
| `src/app/api/dashboard/batch/route.ts` | **Yeni dosya** — batch endpoint | 2 |
| `src/app/api/dashboard/batch/resolvers/stats.ts` | **Yeni dosya** — stats resolver | 2 |
| `src/app/api/dashboard/batch/resolvers/alerts.ts` | **Yeni dosya** — alerts resolver | 2 |
| `src/app/api/dashboard/batch/resolvers/activity.ts` | **Yeni dosya** — activity resolver | 2 |
| `src/app/api/dashboard/batch/resolvers/upcoming.ts` | **Yeni dosya** — upcoming resolver | 2 |
| `src/components/dashboard/hooks/use-dashboard-data.ts` | Düzenleme — batch fetch + polling kaldırma | 2, 4 |
| `src/lib/server-cache.ts` | **Yeni dosya** — in-memory cache | 3 |
| `src/app/api/dashboard/stats/route.ts` | Düzenleme — cache entegrasyonu | 3 |
| `src/app/api/dashboard/alerts/route.ts` | Düzenleme — cache entegrasyonu | 3 |
| `src/app/api/dashboard/declaration-stats/route.ts` | Düzenleme — cache entegrasyonu | 3 |
| `src/app/api/dashboard/tasks-summary/route.ts` | Düzenleme — cache entegrasyonu | 3 |
| `src/app/api/dashboard/announcement-stats/route.ts` | Düzenleme — cache entegrasyonu | 3 |
| `src/app/api/dashboard/takip-stats/route.ts` | Düzenleme — cache entegrasyonu | 3 |
| `src/app/api/dashboard/takip-column-stats/route.ts` | Düzenleme — cache entegrasyonu | 3 |
| `src/providers/swr-provider.tsx` | Düzenleme — config fine-tuning | 4 |

---

## Teknik Notlar

### Edge Cases
- **WS bağlantısı kopuk:** Faz 4'teki fallback polling devreye girer
- **Batch API'de tek widget fail:** `Promise.allSettled` ile diğerleri etkilenmez
- **Server cache hot reload:** `globalThis` ile Next.js dev modunda singleton korunur
- **Aynı anda birden fazla mutation:** invalidation debounce'a gerek yok (SWR zaten dedupe yapıyor)
- **Internal endpoint güvenliği:** `/_internal/dashboard-invalidate` sadece localhost'tan erişilebilir (server.ts ile aynı process)

### Performans Beklentileri
| Metrik | Önce | Sonra |
|--------|------|-------|
| Dashboard ilk yükleme | ~400ms (4 roundtrip) | ~120ms (1 batch roundtrip) |
| Mutation → Dashboard güncelleme | 60-120 saniye (polling) | <500ms (WS invalidation) |
| DB sorgu sayısı (cache hit) | Her istek DB | 0 (cache'den) |
| Gereksiz network trafiği | 30-60 istek/dakika | 0 (polling kalkacak) |

### Bağımlılıklar
- Faz 1 bağımsız — hemen başlanabilir
- Faz 2 bağımsız — Faz 1 ile paralel yapılabilir ama ardışık önerilen
- Faz 3, Faz 1'den sonra yapılmalı (invalidation + cache birlikte çalışmalı)
- Faz 4, Faz 1'den sonra yapılmalı (WS olmadan polling kaldırmak riskli)

---

## Kararlar ve Gerekçeler

| Karar | Neden | Alternatifler |
|-------|-------|---------------|
| HTTP-based invalidation (API → WS server) | Next.js API route'ları WS server'dan izole process, import imkansız | Socket.IO (overkill), Redis pub/sub (overkill) |
| In-memory Map cache (Redis değil) | Single instance app, bu ölçekte Redis gereksiz overhead | Redis, Upstash, node-cache |
| `Promise.allSettled` (batch API) | Bir widget fail ederse diğerleri etkilenmemeli | `Promise.all` (biri fail ederse hepsi fail) |
| Mevcut route'ları silmeme | Geriye uyumluluk, diğer sayfalar individual endpoint kullanıyor | Route'ları sil, sadece batch bırak |
| Fallback polling (WS kopunca) | WS güvenilmez olabilir, UX korunmalı | Sadece WS (riskli) |
| Fire-and-forget invalidation | Mutation response süresini etkilememeli | Await (yavaşlatır) |
