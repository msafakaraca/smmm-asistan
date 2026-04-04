/**
 * Dashboard Invalidation Helper
 *
 * Next.js API route'larından WebSocket server'a dashboard invalidation
 * sinyali gönderir. WS server bu sinyali ilgili tenant'ın browser
 * client'larına iletir ve SWR cache'leri revalidate edilir.
 *
 * Aynı zamanda server-side in-memory cache'i de temizler.
 */

import { serverCache } from "@/lib/server-cache";

const WS_PORT = process.env.WS_PORT || '3001';
const WS_HOST = process.env.WS_HOST || 'localhost';

export async function invalidateDashboard(tenantId: string, keys: string[]): Promise<void> {
  // 1. Server-side cache temizle (ayni process)
  keys.forEach(key => {
    serverCache.invalidate(`${tenantId}:${key}`);
  });

  // 2. Client-side cache'leri WS ile invalidate et (farkli process)
  try {
    await fetch(`http://${WS_HOST}:${WS_PORT}/_internal/dashboard-invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, keys }),
    });
  } catch {
    // Non-critical — WS server'a ulaşılamazsa sessizce devam et
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
