/**
 * Upstash Rate Limiting Configuration
 *
 * Bu modül API isteklerini sınırlamak için Upstash Ratelimit kullanır.
 * Farklı endpoint türleri için farklı limitler tanımlanmıştır.
 *
 * @see https://upstash.com/docs/oss/sdks/ts/ratelimit/overview
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";

// Redis client - environment variables'dan okur
// UPSTASH_REDIS_REST_URL ve UPSTASH_REDIS_REST_TOKEN gerekli
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Rate Limit Stratejisi:
 *
 * Internal çağrılar (server.ts → API): Middleware'de X-Internal-Token ile BYPASS
 * Aşağıdaki limitler sadece dış dünyadan gelen istekler için geçerli.
 *
 * SMMM ofisi profili (500-600 mükellef):
 * - Tarama sırasında dashboard açık: sync, invalidation, beyanname-takip sorguları
 * - Aynı anda birden fazla sekme/kullanıcı olabilir
 * - Bot işlemleri internal bypass ile geçiyor, buradaki limitler sadece frontend
 */

/**
 * Genel API rate limiter
 * Dakikada 200 istek - dashboard navigasyon, veri yükleme
 */
export const generalRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(200, "1 m"),
  analytics: true,
  prefix: "ratelimit:general",
});

/**
 * Auth rate limiter (login, register)
 * Dakikada 5 istek - brute force koruması
 */
export const authRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  analytics: true,
  prefix: "ratelimit:auth",
});

/**
 * Bot/GİB endpoint rate limiter (sadece frontend çağrıları)
 * Dakikada 60 istek - tarama başlatma, sync, durum sorgulama
 * Not: Asıl yoğun trafik (process-results) internal bypass ile geçer
 */
export const botRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  analytics: true,
  prefix: "ratelimit:bot",
});

/**
 * Bulk operations rate limiter
 * Dakikada 30 istek - toplu işlemler (import, export)
 */
export const bulkRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
  prefix: "ratelimit:bulk",
});

/**
 * File upload rate limiter
 * Dakikada 60 istek - dosya yükleme/indirme
 */
export const uploadRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  analytics: true,
  prefix: "ratelimit:upload",
});

/**
 * Credentials/Passwords rate limiter - KRİTİK GÜVENLİK
 * Dakikada 10 istek - brute force koruması
 * Hassas şifre işlemleri için sıkı sınırlama
 */
export const credentialsRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
  prefix: "ratelimit:credentials",
});

/**
 * Settings rate limiter
 * Dakikada 30 istek - ayar değişiklikleri
 */
export const settingsRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
  prefix: "ratelimit:settings",
});

/**
 * Rate limit tipini endpoint'e göre belirle
 */
export type RateLimitType = "general" | "auth" | "bot" | "bulk" | "upload" | "credentials" | "settings";

/**
 * Endpoint path'ine göre uygun rate limiter'ı döndür
 */
export function getRateLimiter(pathname: string): Ratelimit {
  // Auth endpoints - En sıkı sınırlama (brute force koruması)
  if (
    pathname.includes("/api/auth") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/auth/")
  ) {
    return authRatelimit;
  }

  // KRITIK: Credentials/Passwords endpoints - Hassas veri korumasi
  if (
    pathname.includes("/api/sifreler") ||
    pathname.includes("/credentials") ||
    pathname.includes("/api/customers") && pathname.includes("/credentials")
  ) {
    return credentialsRatelimit;
  }

  // Settings endpoints - Ayar degisiklikleri
  if (pathname.includes("/api/settings")) {
    return settingsRatelimit;
  }

  // Bot endpoints
  if (pathname.includes("/api/gib") || pathname.includes("/api/turmob") || pathname.includes("/api/bot")) {
    return botRatelimit;
  }

  // Bulk operation endpoints (yazma işlemleri - gönderim, indirme vb.)
  // Not: /api/bulk-send/documents bir okuma/arama endpoint'idir, bulk rate limit'e tabi değil
  if (
    (pathname.includes("/bulk") && !pathname.endsWith("/documents")) ||
    pathname.includes("/import") ||
    pathname.includes("/export")
  ) {
    return bulkRatelimit;
  }

  // File upload endpoints
  if (pathname.includes("/api/files") || pathname.includes("/api/upload")) {
    return uploadRatelimit;
  }

  // Default: general rate limit
  return generalRatelimit;
}

/**
 * Rate limit sonucunu kontrol et ve uygun response header'ları oluştur
 */
export function createRateLimitHeaders(
  remaining: number,
  limit: number,
  reset: number
): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", limit.toString());
  headers.set("X-RateLimit-Remaining", remaining.toString());
  headers.set("X-RateLimit-Reset", reset.toString());
  return headers;
}

/**
 * Rate limiting aktif mi kontrol et
 * Development'ta veya env değişkenleri yoksa devre dışı bırakılabilir
 */
export function isRateLimitEnabled(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}
