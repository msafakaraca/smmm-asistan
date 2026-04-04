/**
 * Server-Side In-Memory Cache
 *
 * TTL bazli Map cache. Dashboard API endpoint'lerinde tekrarlayan
 * DB sorgularini azaltmak icin kullanilir.
 * Singleton instance — Next.js hot reload'da korunur (globalThis).
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
}

class ServerCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxSize = 500;

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
    // LRU benzeri: max size asilirsa en eskiyi sil
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

  // Tenant bazli tum cache'i sil
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
