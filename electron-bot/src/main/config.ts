/**
 * Electron Bot — Merkezi Yapılandırma
 * ====================================
 * Production URL'leri build-time'da gömülür.
 * Mali müşavir hiçbir ayar yapmak zorunda kalmaz.
 *
 * Geliştirme ortamında .env dosyası varsa oradaki değerler önceliklidir.
 */

// ─── Production URL'leri ───────────────────────────────────────────
// Bu değerler production build'de kullanılır.
// Deploy ettiğinizde gerçek domain ile güncelleyin.
const PRODUCTION_API_URL = 'https://smmm-asistan.vercel.app';
const PRODUCTION_WS_URL = 'wss://smmm-asistan-ws.onrender.com';

// ─── Development Fallback'leri ─────────────────────────────────────
const DEV_API_URL = 'http://localhost:3000';
const DEV_WS_URL = 'ws://localhost:3001';

// ─── Ortam Tespiti ─────────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production';

/**
 * API URL — Next.js sunucu adresi
 * Öncelik: env > production/dev default
 */
export function getApiUrl(): string {
  return process.env.API_URL || (isDev ? DEV_API_URL : PRODUCTION_API_URL);
}

/**
 * WebSocket URL — Gerçek zamanlı iletişim adresi
 * Öncelik: env > production/dev default
 */
export function getWsUrl(): string {
  return process.env.WS_URL || (isDev ? DEV_WS_URL : PRODUCTION_WS_URL);
}
