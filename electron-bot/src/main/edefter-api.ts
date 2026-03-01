/**
 * E-Defter API Modülü
 * ====================
 * GİB E-Defter portalı üzerinden paket yükleme durumlarını sorgulama.
 *
 * Akış: GİB Dijital VD Login → E-Defter Token Exchange → Paket Listesi Sorgusu
 *
 * Referans: earsiv-dijital-api.ts, intvrg-tahsilat-api.ts pattern'leri
 */

import { gibDijitalLogin } from './earsiv-dijital-api';

// ═══════════════════════════════════════════════════════════════════════════
// Sabitler
// ═══════════════════════════════════════════════════════════════════════════

const DIJITAL_GIB_BASE = 'https://dijital.gib.gov.tr';
const EDEFTER_BASE = 'https://edefter.gib.gov.tr';
const EDEFTER_LOGIN_URL = `${DIJITAL_GIB_BASE}/apigateway/auth/tdvd/edefter-login`;

const ENDPOINTS = {
  PAKET_LISTESI: `${EDEFTER_BASE}/api/v1/edefter/paket/EDEFTER_PAKET_LISTESI_GETIR`,
} as const;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DELAY_BETWEEN_REQUESTS = 500; // 500ms — GİB rate limit koruması

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface EdefterPaket {
  oid: string;
  paketId: string;
  islemOid: string;
  belgeTuru: string;        // KB, YB, Y
  alinmaZamani: string;     // "20250527100347"
  durumKodu: number;        // 0 = başarılı
  durumAciklama: string;
  dfsPath: string;
  gibDfsPath: string;
}

export interface EdefterAySonuc {
  donem: string;            // "202501"
  ay: number;               // 1
  yil: number;              // 2025
  paketler: EdefterPaket[];
  kbYuklendi: boolean;
  ybYuklendi: boolean;
  yYuklendi: boolean;
  tamam: boolean;           // 3'ü de yüklendi mi
  yuklemeTarihi: string | null;  // İlk yükleme tarihi (DD.MM.YYYY)
}

export interface EdefterKontrolResult {
  success: boolean;
  vkntckn: string;
  yil: number;
  aylar: EdefterAySonuc[];
  tamamlanan: number;       // Kaç ay tam
  eksik: number;            // Kaç ay eksik
  kismenEksik: number;      // Kaç ay kısmen eksik
  error?: string;
}

interface EdefterQueryParams {
  userid: string;
  password: string;
  basAy: number;
  bitAy: number;
  yil: number;
  captchaApiKey: string;
  ocrSpaceApiKey?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * alinmaZamani parse — "20250527100347" → "27.05.2025"
 */
function parseAlinmaZamani(raw: string): string {
  if (!raw || raw.length < 8) return '-';
  return `${raw.slice(6, 8)}.${raw.slice(4, 6)}.${raw.slice(0, 4)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// E-Defter Token Alma
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GİB Dijital VD Bearer token ile E-Defter JWT token'ı al.
 * edefter-login endpoint'i redirectUrl döndürür, bu URL'den state parametresi parse edilir.
 */
async function getEdefterToken(bearerToken: string): Promise<string> {
  console.log('[EDEFTER] E-Defter token alınıyor...');

  const response = await fetch(EDEFTER_LOGIN_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': USER_AGENT,
      'Origin': DIJITAL_GIB_BASE,
      'Referer': `${DIJITAL_GIB_BASE}/`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('EDEFTER_TOKEN_FAILED: Bearer token geçersiz veya süresi dolmuş');
    }
    throw new Error(`EDEFTER_TOKEN_FAILED: HTTP ${response.status}`);
  }

  const data = await response.json();
  const redirectUrl = data.redirectUrl;

  if (!redirectUrl) {
    throw new Error('EDEFTER_TOKEN_FAILED: redirectUrl alınamadı');
  }

  // URL'den state parametresini parse et
  const url = new URL(redirectUrl);
  const stateToken = url.searchParams.get('state');

  if (!stateToken) {
    throw new Error('EDEFTER_TOKEN_FAILED: state parametresi bulunamadı');
  }

  console.log(`[EDEFTER] E-Defter token alındı: ${stateToken.substring(0, 20)}...`);
  return stateToken;
}

// ═══════════════════════════════════════════════════════════════════════════
// E-Defter Paket Sorgulama
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tek bir dönem için E-Defter paket listesini sorgula.
 *
 * İlk olarak Bearer token dener, 401 alırsa cookie-based flow'a geçer.
 */
async function queryDonem(token: string, donem: string, useCookie: boolean = false, cookies?: string): Promise<EdefterAySonuc> {
  const yil = parseInt(donem.substring(0, 4), 10);
  const ay = parseInt(donem.substring(4, 6), 10);

  const url = `${ENDPOINTS.PAKET_LISTESI}?donem=${donem}&page=0&size=1000`;

  const headers: Record<string, string> = {
    'Accept': '*/*',
    'User-Agent': USER_AGENT,
    'Referer': `${EDEFTER_BASE}/default/list-package`,
  };

  if (useCookie && cookies) {
    headers['Cookie'] = cookies;
  } else {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('EDEFTER_SESSION_EXPIRED: Oturum sona erdi');
    }
    throw new Error(`EDEFTER_API_ERROR: HTTP ${response.status} (donem: ${donem})`);
  }

  const data = await response.json();

  // Paketleri parse et
  const paketler: EdefterPaket[] = data.result || [];
  const kbPaketler = paketler.filter(p => p.belgeTuru === 'KB');
  const ybPaketler = paketler.filter(p => p.belgeTuru === 'YB');
  const yPaketler = paketler.filter(p => p.belgeTuru === 'Y');

  const kbYuklendi = kbPaketler.length > 0;
  const ybYuklendi = ybPaketler.length > 0;
  const yYuklendi = yPaketler.length > 0;
  const tamam = kbYuklendi && ybYuklendi && yYuklendi;

  // İlk yükleme tarihini bul
  let yuklemeTarihi: string | null = null;
  if (paketler.length > 0) {
    // En erken alinmaZamani
    const zamanlar = paketler
      .map(p => p.alinmaZamani)
      .filter(z => z && z.length >= 8)
      .sort();

    if (zamanlar.length > 0) {
      yuklemeTarihi = parseAlinmaZamani(zamanlar[0]);
    }
  }

  return {
    donem,
    ay,
    yil,
    paketler,
    kbYuklendi,
    ybYuklendi,
    yYuklendi,
    tamam,
    yuklemeTarihi,
  };
}

/**
 * Cookie-based fallback: loginInteraktif → Set-Cookie yakalama
 */
async function getEdefterCookies(jwtToken: string): Promise<string | null> {
  console.log('[EDEFTER] Cookie-based flow deneniyor...');

  try {
    const loginUrl = `${EDEFTER_BASE}/global/loginInteraktif?state=${jwtToken}`;
    const response = await fetch(loginUrl, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'manual',
    });

    // Set-Cookie header'larını yakala
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    if (setCookieHeaders.length === 0) {
      // Fallback: get header
      const singleCookie = response.headers.get('set-cookie');
      if (singleCookie) {
        const cookieValue = singleCookie.split(';')[0];
        console.log(`[EDEFTER] Cookie alındı (fallback): ${cookieValue.substring(0, 30)}...`);
        return cookieValue;
      }
      return null;
    }

    // Cookie'leri birleştir
    const cookies = setCookieHeaders.map(c => c.split(';')[0]).join('; ');
    console.log(`[EDEFTER] Cookie'ler alındı: ${cookies.substring(0, 50)}...`);
    return cookies;
  } catch (e) {
    console.error('[EDEFTER] Cookie alma hatası:', (e as Error).message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Ana Sorgulama Fonksiyonu
// ═══════════════════════════════════════════════════════════════════════════

/**
 * E-Defter paket kontrol — tüm ayları sorgula.
 *
 * @param params - Sorgulama parametreleri
 * @param onProgress - İlerleme callback'i
 * @param onResults - Sonuç callback'i (her ay sorgulandığında)
 * @returns Kontrol sonucu
 */
export async function queryEdefterKontrol(
  params: EdefterQueryParams,
  onProgress?: (status: string) => void,
  onResults?: (aylar: EdefterAySonuc[]) => void,
): Promise<EdefterKontrolResult> {
  const { userid, password, basAy, bitAy, yil, captchaApiKey, ocrSpaceApiKey } = params;

  // 1. GİB Dijital VD Login
  onProgress?.('GİB Dijital VD\'ye giriş yapılıyor...');
  const bearerToken = await gibDijitalLogin(
    userid,
    password,
    captchaApiKey,
    ocrSpaceApiKey,
    (status) => onProgress?.(status),
  );

  // 2. E-Defter Token Exchange
  onProgress?.('E-Defter portalına bağlanılıyor...');
  const edefterToken = await getEdefterToken(bearerToken);

  // 3. Ayları sıralı sorgula (rate limit koruması)
  const aylar: EdefterAySonuc[] = [];
  let useCookie = false;
  let cookies: string | null = null;

  for (let ay = basAy; ay <= bitAy; ay++) {
    const donem = `${yil}${String(ay).padStart(2, '0')}`;
    const ayAdi = getAyAdi(ay);
    onProgress?.(`${ayAdi} ${yil} sorgulanıyor...`);

    try {
      const sonuc = await queryDonem(edefterToken, donem, useCookie, cookies || undefined);
      aylar.push(sonuc);

      // Sonuçları aktar
      onResults?.([...aylar]);
    } catch (e) {
      const error = e as Error;

      // İlk 401'de cookie-based flow dene
      if (error.message?.includes('EDEFTER_SESSION_EXPIRED') && !useCookie) {
        console.log('[EDEFTER] Bearer token 401 aldı, cookie-based flow deneniyor...');
        onProgress?.('Alternatif bağlantı yöntemi deneniyor...');

        cookies = await getEdefterCookies(edefterToken);
        if (cookies) {
          useCookie = true;

          // Bu ayı tekrar dene
          try {
            const sonuc = await queryDonem(edefterToken, donem, true, cookies);
            aylar.push(sonuc);
            onResults?.([...aylar]);
          } catch (retryError) {
            console.error(`[EDEFTER] Cookie retry hatası (${donem}):`, (retryError as Error).message);
            // Boş sonuç ekle — hata döndürme, diğer ayları denemeye devam et
            aylar.push({
              donem, ay, yil,
              paketler: [],
              kbYuklendi: false, ybYuklendi: false, yYuklendi: false,
              tamam: false, yuklemeTarihi: null,
            });
            onResults?.([...aylar]);
          }
        } else {
          // Cookie de alınamazsa oturum hatası fırlat
          throw new Error('EDEFTER_SESSION_EXPIRED: E-Defter oturumu açılamadı');
        }
      } else {
        // Diğer hatalar — boş sonuç ekle, devam et
        console.error(`[EDEFTER] Dönem hatası (${donem}):`, error.message);
        aylar.push({
          donem, ay, yil,
          paketler: [],
          kbYuklendi: false, ybYuklendi: false, yYuklendi: false,
          tamam: false, yuklemeTarihi: null,
        });
        onResults?.([...aylar]);
      }
    }

    // Rate limit koruması — son ay hariç bekle
    if (ay < bitAy) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  // 4. Sonuçları özetle
  const tamamlanan = aylar.filter(a => a.tamam).length;
  const eksik = aylar.filter(a => !a.kbYuklendi && !a.ybYuklendi && !a.yYuklendi).length;
  const kismenEksik = aylar.filter(a => !a.tamam && (a.kbYuklendi || a.ybYuklendi || a.yYuklendi)).length;

  return {
    success: true,
    vkntckn: userid,
    yil,
    aylar,
    tamamlanan,
    eksik,
    kismenEksik,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Yardımcılar
// ═══════════════════════════════════════════════════════════════════════════

function getAyAdi(ay: number): string {
  const aylar = [
    '', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
  ];
  return aylar[ay] || `${ay}. ay`;
}
