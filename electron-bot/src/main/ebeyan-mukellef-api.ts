/**
 * E-Beyan Mükellef API Modülü
 * ============================
 * GİB e-Beyan portalından mükellef listesi çekme.
 *
 * Akış:
 * 1. gibDijitalLogin() → Bearer token
 * 2. Bearer token → e-Beyan redirect URL (yeni-ebyn-login)
 * 3. BrowserWindow ile redirect URL'ye git → SESSION cookie al
 * 4. SESSION cookie ile mukellef-detay-list API çağrısı (fetch)
 *
 * Not: E-Beyan portali Next.js tabanlı. Login sayfası client-side JS ile
 * SESSION cookie oluşturuyor, bu yüzden Electron BrowserWindow kullanarak
 * token → SESSION cookie dönüşümü yapıyoruz.
 */

import { gibDijitalLogin } from './earsiv-dijital-api';
import { BrowserWindow, session as electronSession } from 'electron';

// ═══════════════════════════════════════════════════════════════════════════
// Sabitler
// ═══════════════════════════════════════════════════════════════════════════

const DIJITAL_GIB_BASE = 'https://dijital.gib.gov.tr';
const EBEYAN_BASE = 'https://ebeyan.gib.gov.tr';

const ENDPOINTS = {
  EBEYAN_TOKEN: `${DIJITAL_GIB_BASE}/apigateway/auth/tdvd/yeni-ebyn-login?platform=prod`,
  MUKELLEF_DETAY_LIST: `${EBEYAN_BASE}/api/kullanici/mukellef/mukellef-detay-list`,
} as const;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface GibMukellefRaw {
  adSoyadUnvan: string;
  tckn: string;
  vkn: string;
  sozlesmeTipi: string;
  sozlesmeDurumu: string;
  sozlesmeTarihi: string | null;
  sozlesmeSonTarihi: string | null;
  sozlesmeBitisAciklamasi: string | null;
  gecmisBeyanGonderebilirMi: boolean;
}

export interface MukellefData {
  unvan: string;
  tcKimlikNo: string | null;
  vergiKimlikNo: string;
  vknTckn: string;
  sirketTipi: string;
  sozlesmeTipi: string;
  sozlesmeTarihi: string;
}

export interface SyncMukellefsOptions {
  username: string;
  password: string;
  captchaApiKey?: string;
  ocrSpaceApiKey?: string;
  onProgress: (type: string, data: any) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'User-Agent': USER_AGENT,
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Unvan'ı Title Case'e çevir
 * "SERPIL CERITOGLU" → "Serpil Ceritoglu"
 */
function toTitleCase(str: string): string {
  return str
    .toLocaleLowerCase('tr-TR')
    .replace(/(^|\s)\S/g, (char) => char.toLocaleUpperCase('tr-TR'));
}

// ═══════════════════════════════════════════════════════════════════════════
// API Fonksiyonları
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Adım 2: Bearer token ile e-Beyan redirect URL al
 * yeni-ebyn-login endpoint'i token içeren bir redirectUrl döndürür
 */
async function getEbeyanRedirectUrl(bearerToken: string): Promise<string> {
  console.log('[EBEYAN-MUKELLEF] E-Beyan redirect URL alınıyor...');

  const response = await fetch(ENDPOINTS.EBEYAN_TOKEN, {
    method: 'GET',
    headers: getHeaders(bearerToken),
  });

  if (!response.ok) {
    throw new Error(`EBEYAN_TOKEN_FAILED: E-Beyan token alınamadı (HTTP ${response.status})`);
  }

  const data = await response.json();
  console.log('[EBEYAN-MUKELLEF] yeni-ebyn-login yanıt:', JSON.stringify(data).substring(0, 500));

  const redirectUrl: string = data?.redirectUrl || data?.data?.redirectUrl || '';

  if (!redirectUrl) {
    throw new Error('EBEYAN_TOKEN_FAILED: redirectUrl boş döndü');
  }

  console.log(`[EBEYAN-MUKELLEF] Redirect URL: ${redirectUrl.substring(0, 100)}...`);
  return redirectUrl;
}

/**
 * Adım 3: BrowserWindow ile SESSION cookie al
 *
 * E-Beyan portali Next.js tabanlı. /dijital-login sayfası client-side JS
 * ile token'ı alıp backend'e gönderir ve SESSION cookie oluşturur.
 * Bu yüzden BrowserWindow ile sayfayı yükleyip JS'in çalışmasını bekliyoruz.
 */
async function getSessionCookie(redirectUrl: string): Promise<string> {
  console.log('[EBEYAN-MUKELLEF] BrowserWindow ile SESSION cookie alınıyor...');

  // Geçici partition (persist: olmadan → bellekte kalır, diske yazılmaz)
  const partitionId = `ebeyan-${Date.now()}`;
  const ses = electronSession.fromPartition(partitionId);

  // User-Agent ayarla
  ses.setUserAgent(USER_AGENT);

  const win = new BrowserWindow({
    show: false,
    width: 1024,
    height: 768,
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Debug: navigation olaylarını logla
  win.webContents.on('did-navigate', (_event, url) => {
    console.log(`[EBEYAN-MUKELLEF] Navigate: ${url.substring(0, 120)}`);
  });
  win.webContents.on('did-redirect-navigation', (_event, url) => {
    console.log(`[EBEYAN-MUKELLEF] Redirect: ${url.substring(0, 120)}`);
  });

  try {
    // Sayfayı yükle (timeout: 20s)
    console.log(`[EBEYAN-MUKELLEF] Sayfa yükleniyor: ${redirectUrl.substring(0, 100)}...`);

    await Promise.race([
      win.loadURL(redirectUrl),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('EBEYAN_LOGIN_FAILED: Sayfa yükleme timeout (20s)')), 20000)
      ),
    ]);

    console.log('[EBEYAN-MUKELLEF] Sayfa yüklendi, SESSION cookie bekleniyor...');

    // SESSION cookie'yi bekle (polling, max 12s)
    const sessionValue = await waitForSessionCookie(ses, 12000);
    console.log(`[EBEYAN-MUKELLEF] ✓ SESSION cookie alındı: ${sessionValue.substring(0, 20)}...`);
    return sessionValue;

  } finally {
    win.destroy();
    ses.clearStorageData().catch(() => {});
  }
}

/**
 * SESSION cookie için polling yap
 * Her 500ms'de cookie'leri kontrol et, bulunca döndür
 */
async function waitForSessionCookie(
  ses: Electron.Session,
  timeoutMs: number,
): Promise<string> {
  const start = Date.now();
  const pollInterval = 500;

  while (Date.now() - start < timeoutMs) {
    // SESSION cookie'yi ara
    const sessionCookies = await ses.cookies.get({ name: 'SESSION' });
    if (sessionCookies.length > 0) {
      return sessionCookies[0].value;
    }

    // Alternatif: JSESSIONID veya benzeri
    const allCookies = await ses.cookies.get({});
    const gibCookies = allCookies.filter(c => c.domain?.includes('gib.gov.tr'));

    const sessionLike = gibCookies.find(c =>
      c.name === 'SESSION' ||
      c.name === 'JSESSIONID' ||
      c.name.toUpperCase().includes('SESSION')
    );

    if (sessionLike) {
      console.log(`[EBEYAN-MUKELLEF] Session cookie bulundu: ${sessionLike.name}`);
      return sessionLike.value;
    }

    await sleep(pollInterval);
  }

  // Timeout — debug bilgisi
  const allCookies = await ses.cookies.get({});
  const gibCookies = allCookies.filter(c => c.domain?.includes('gib.gov.tr'));
  console.log(`[EBEYAN-MUKELLEF] Timeout! ${gibCookies.length} GİB cookie bulundu:`);
  for (const c of gibCookies) {
    console.log(`  ${c.name}=${c.value.substring(0, 30)}... (domain: ${c.domain})`);
  }

  throw new Error(
    'EBEYAN_LOGIN_FAILED: SESSION cookie alınamadı (timeout). ' +
    `${gibCookies.length} GİB cookie var ama SESSION yok.`
  );
}

/**
 * Adım 4: SESSION cookie ile mükellef detay listesini çek
 */
async function fetchMukellefDetayList(sessionCookie: string): Promise<GibMukellefRaw[]> {
  console.log('[EBEYAN-MUKELLEF] Mükellef listesi çekiliyor...');

  const response = await fetch(ENDPOINTS.MUKELLEF_DETAY_LIST, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Cookie': `SESSION=${sessionCookie}`,
      'Referer': `${EBEYAN_BASE}/kullanici/mukellefler`,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`MUKELLEF_LIST_FAILED: Mükellef listesi alınamadı (HTTP ${response.status}) ${text.substring(0, 200)}`);
  }

  const result = await response.json();
  const mukellefList: GibMukellefRaw[] = result?.data?.detayliMukellefList || [];

  console.log(`[EBEYAN-MUKELLEF] ${mukellefList.length} mükellef bulundu`);
  return mukellefList;
}

/**
 * API response'u mevcut taxpayer formatına dönüştür
 */
function transformMukellefData(rawList: GibMukellefRaw[]): MukellefData[] {
  return rawList.map(raw => {
    const tckn = raw.tckn?.trim() || '';
    const vkn = raw.vkn?.trim() || '';

    let sirketTipi = 'firma';
    if (tckn.length === 11 && /^\d+$/.test(tckn)) {
      sirketTipi = 'sahis';
    }

    return {
      unvan: toTitleCase(raw.adSoyadUnvan || ''),
      tcKimlikNo: tckn.length === 11 ? tckn : null,
      vergiKimlikNo: vkn,
      vknTckn: vkn,
      sirketTipi,
      sozlesmeTipi: raw.sozlesmeTipi || '',
      sozlesmeTarihi: raw.sozlesmeTarihi || '',
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Ana Fonksiyon
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GİB e-Beyan'dan mükellef listesi çek.
 */
export async function syncMukellefsViaApi(options: SyncMukellefsOptions) {
  const { username, password, captchaApiKey, ocrSpaceApiKey, onProgress } = options;

  const report = (percent: number, message: string) => {
    console.log(`[EBEYAN-MUKELLEF] %${percent} - ${message}`);
    onProgress?.('progress', { progress: percent, message });
  };

  try {
    // Adım 1: GİB Dijital Login → Bearer token
    report(5, 'GİB\'e giriş yapılıyor...');
    const bearerToken = await gibDijitalLogin(
      username,
      password,
      captchaApiKey || '',
      ocrSpaceApiKey,
      (status) => report(10, status),
    );

    await sleep(100);

    // Adım 2: E-Beyan redirect URL al
    report(30, 'E-Beyan portalına yönlendiriliyor...');
    const redirectUrl = await getEbeyanRedirectUrl(bearerToken);

    await sleep(100);

    // Adım 3: BrowserWindow ile SESSION cookie al
    report(50, 'E-Beyan oturumu başlatılıyor...');
    const sessionCookie = await getSessionCookie(redirectUrl);

    await sleep(100);

    // Adım 4: Mükellef listesini çek
    report(70, 'Mükellef listesi çekiliyor...');
    const rawMukellefList = await fetchMukellefDetayList(sessionCookie);

    if (rawMukellefList.length === 0) {
      console.warn('[EBEYAN-MUKELLEF] Mükellef listesi boş döndü');
    }

    // Veri dönüşümü
    const taxpayers = transformMukellefData(rawMukellefList);

    // İstatistikler
    const stats = {
      total: taxpayers.length,
      sahis: taxpayers.filter(t => t.sirketTipi === 'sahis').length,
      firma: taxpayers.filter(t => t.sirketTipi === 'firma').length,
      basit_usul: 0,
    };

    report(90, `${taxpayers.length} mükellef verisi çekildi. İşleniyor...`);

    // Veriyi WebSocket üzerinden gönder
    onProgress?.('mukellef-data', { taxpayers, stats });

    await sleep(200);

    report(100, `İşlem tamamlandı! ${taxpayers.length} mükellef bulundu (${stats.sahis} Şahıs, ${stats.firma} Firma).`);

    onProgress?.('complete', { stats, taxpayers });

    return { success: true, taxpayers };

  } catch (error) {
    console.error('[EBEYAN-MUKELLEF] Hata:', error);
    onProgress?.('error', {
      error: (error as Error).message,
      errorCode: extractErrorCode((error as Error).message),
    });
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Hata mesajından error code çıkar
 */
function extractErrorCode(message: string): string {
  const match = message.match(/^([A-Z_]+):/);
  return match ? match[1] : 'UNKNOWN';
}
