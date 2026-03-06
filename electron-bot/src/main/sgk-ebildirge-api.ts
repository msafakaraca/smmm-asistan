/**
 * SGK E-Bildirge V2 API Modülü
 * =============================
 * SGK E-Bildirge sistemi üzerinden onaylanmış tahakkuk/hizmet bildirgeleri sorgulama ve PDF indirme.
 *
 * - Session-based auth (JSESSIONID cookie + Struts CSRF token zinciri)
 * - Custom JPEG captcha çözme (OCR.space + 2Captcha fallback)
 * - Dönem bazlı sorgulama
 * - Tahakkuk Fişi (T) ve Hizmet Listesi (H) PDF indirme
 *
 * API yapısı HAR analizine dayanır (2026-03).
 * Framework: Apache Struts 2 — .action URL'leri, token zinciri
 */

import * as cheerio from 'cheerio';

// ═══════════════════════════════════════════════════════════════════════════
// Sabitler
// ═══════════════════════════════════════════════════════════════════════════

const SGK_BASE = 'https://ebildirge.sgk.gov.tr';
const EBILDIRGE_BASE = `${SGK_BASE}/EBildirgeV2`;

const ENDPOINTS = {
  HOME: `${EBILDIRGE_BASE}`,
  CAPTCHA: `${EBILDIRGE_BASE}/PG`,
  LOGIN: `${EBILDIRGE_BASE}/login/kullaniciIlkKontrollerGiris.action`,
  PERIOD_LOAD: `${EBILDIRGE_BASE}/tahakkuk/tahakkukonaylanmisTahakkukDonemBilgileriniYukle.action`,
  PERIOD_QUERY: `${EBILDIRGE_BASE}/tahakkuk/tahakkukonaylanmisTahakkukDonemSecildi.action`,
  PDF_DOWNLOAD: `${EBILDIRGE_BASE}/tahakkuk/pdfGosterim.action`,
  LOGOUT: `${EBILDIRGE_BASE}/logout.jsp`,
} as const;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const DELAY_BETWEEN_REQUESTS = 1500; // 1.5 saniye — SGK rate limit koruması
const MAX_CAPTCHA_RETRIES = 3;       // Captcha çözme max retry
const MAX_LOGIN_RETRIES = 2;         // Login max retry

// PDF tipleri — sadece bu ikisi indirilecek
const PDF_TYPES = {
  tahakkuk: 'tahakkukonayliFisTahakkukPdf',
  hizmet: 'tahakkukonayliFisHizmetPdf',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface SgkCredentials {
  kullaniciAdi: string;    // VKN/TCKN
  isyeriKodu: string;      // 4 karakter işyeri kodu
  sistemSifresi: string;   // max 10 karakter
  isyeriSifresi: string;   // max 10 karakter
}

export interface BildirgeRow {
  tahakkukDonem: string;     // "2026/01"
  hizmetDonem: string;       // "2026/01"
  belgeTuru: string;         // "01"
  belgeMahiyeti: string;     // "ASIL" / "EK"
  kanunNo: string;           // "05510"
  calisanSayisi: number;
  gunSayisi: number;
  pekTutar: string;          // "342.194,62 TL"
  bildirgeRefNo: string;     // "1834-2026-1"
  hasTahakkukPdf: boolean;
  hasHizmetPdf: boolean;
}

export interface IsyeriInfo {
  sicilNo: string;
  unvan: string;
  adres: string;
  sgmKodAd: string;
  kanunKapsaminaAlinis: string;
  primOran: string;
  isyeriTipi: string;
}

export interface BildirgeQueryResult {
  bildirgeler: BildirgeRow[];
  isyeriInfo: IsyeriInfo | null;
  token: string; // Sonraki işlem için yeni token
}

export interface SgkEbildirgeResult {
  success: boolean;
  bildirgeler: BildirgeRow[];
  isyeriInfo: IsyeriInfo | null;
  pdfResults: PdfDownloadResult[];
  error?: string;
}

export interface PdfDownloadResult {
  bildirgeRefNo: string;
  tip: 'tahakkuk' | 'hizmet';
  donem: string;
  pdfBase64: string;
  fileName: string;
  success: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Yardımcı Fonksiyonlar
// ═══════════════════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Dönem index hesabı — SGK'nın beklediği index formatı
 * index = (currentYear * 12 + currentMonth) - (targetYear * 12 + targetMonth) + 1
 */
function calculatePeriodIndex(targetYear: number, targetMonth: number): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 0-indexed → 1-indexed
  return (currentYear * 12 + currentMonth) - (targetYear * 12 + targetMonth) + 1;
}

// ═══════════════════════════════════════════════════════════════════════════
// Captcha Çözücü — OCR.space (birincil) + 2Captcha (fallback)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * OCR.space tek istek — belirtilen engine ile captcha çöz
 */
async function ocrSpaceRequest(
  cleanBase64: string,
  apiKey: string,
  engine: '1' | '2',
  scale: boolean = false,
): Promise<string | null> {
  const params: Record<string, string> = {
    apikey: apiKey,
    base64Image: `data:image/jpeg;base64,${cleanBase64}`,
    OCREngine: engine,
    isOverlayRequired: 'false',
    language: 'eng',
  };
  if (scale) params.scale = 'true';
  if (engine === '2') params.isTable = 'false';

  const controller = new AbortController();
  const TIMEOUT_MS = 10000;
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const result = await response.json();
    if (result.IsErroredOnProcessing) {
      console.log(`[SGK-CAPTCHA] OCR.space E${engine} API hatası: ${result.ErrorMessage?.[0] || JSON.stringify(result.ErrorDetails)}`);
      return null;
    }
    if (result.ParsedResults?.[0]?.ParsedText) {
      const text = result.ParsedResults[0].ParsedText.trim().replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
      if (text.length >= 4) return text;
      console.log(`[SGK-CAPTCHA] OCR.space E${engine} sonuç çok kısa: "${text}"`);
    }
    return null;
  } catch (e) {
    clearTimeout(timeout);
    const msg = (e as Error).name === 'AbortError' ? `zaman aşımı (${TIMEOUT_MS / 1000}s)` : (e as Error).message;
    console.log(`[SGK-CAPTCHA] OCR.space E${engine} hatası: ${msg}`);
    return null;
  }
}

/**
 * OCR.space ile captcha çöz — çoklu engine retry stratejisi
 * Deneme sırası: Engine 2 → Engine 2 (scale) → Engine 1
 */
async function solveWithOcrSpace(imageBase64: string, apiKey: string): Promise<string | null> {
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  // 1. Engine 2 — captcha-tarzı metin için daha iyi
  console.log('[SGK-CAPTCHA] OCR.space E2 deneniyor...');
  const r1 = await ocrSpaceRequest(cleanBase64, apiKey, '2');
  if (r1) { console.log(`[SGK-CAPTCHA] OCR.space E2 çözüm: ${r1}`); return r1; }

  // 2. Engine 2 + scale — küçük/bulanık captcha'lar için
  console.log('[SGK-CAPTCHA] OCR.space E2+scale deneniyor...');
  const r2 = await ocrSpaceRequest(cleanBase64, apiKey, '2', true);
  if (r2) { console.log(`[SGK-CAPTCHA] OCR.space E2+scale çözüm: ${r2}`); return r2; }

  // 3. Engine 1 — farklı OCR algoritması
  console.log('[SGK-CAPTCHA] OCR.space E1 deneniyor...');
  const r3 = await ocrSpaceRequest(cleanBase64, apiKey, '1', true);
  if (r3) { console.log(`[SGK-CAPTCHA] OCR.space E1 çözüm: ${r3}`); return r3; }

  console.log('[SGK-CAPTCHA] OCR.space tüm denemeler başarısız');
  return null;
}

/**
 * 2Captcha ile captcha çöz (yavaş ama güvenilir)
 */
async function solveWith2Captcha(imageBase64: string, apiKey: string): Promise<string | null> {
  try {
    console.log('[SGK-CAPTCHA] 2Captcha deneniyor...');
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const submitResponse = await fetch('https://2captcha.com/in.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        key: apiKey,
        method: 'base64',
        body: cleanBase64,
        json: '1',
        numeric: '0',
        min_len: '4',
        max_len: '8',
        language: '2',
        textinstructions: 'SGK captcha, alphanumeric characters, 6 characters.',
      }),
    });

    const submitResult = await submitResponse.json();
    if (submitResult.status !== 1) {
      console.log(`[SGK-CAPTCHA] 2Captcha submit başarısız:`, JSON.stringify(submitResult));
      return null;
    }

    const captchaId = submitResult.request;
    console.log(`[SGK-CAPTCHA] 2Captcha ID: ${captchaId}, polling başlıyor...`);

    // Polling (max 30 deneme x 3s = 90s)
    for (let i = 0; i < 30; i++) {
      await sleep(3000);
      const resultResponse = await fetch(
        `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`,
      );
      const resultData = await resultResponse.json();

      if (resultData.status === 1) {
        const solution = resultData.request;
        console.log(`[SGK-CAPTCHA] 2Captcha çözüm: ${solution}`);
        return solution;
      }
      if (resultData.request !== 'CAPCHA_NOT_READY') {
        console.log(`[SGK-CAPTCHA] 2Captcha beklenmeyen yanıt:`, JSON.stringify(resultData));
        return null;
      }
    }
    console.log('[SGK-CAPTCHA] 2Captcha zaman aşımı (90s)');
    return null;
  } catch (e) {
    console.log(`[SGK-CAPTCHA] 2Captcha hatası: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Captcha çöz — önce OCR.space, sonra 2Captcha fallback
 */
async function solveCaptcha(imageBase64: string, captchaApiKey?: string, ocrSpaceApiKey?: string): Promise<string | null> {
  // Önce OCR.space dene (hızlı)
  if (ocrSpaceApiKey) {
    const result = await solveWithOcrSpace(imageBase64, ocrSpaceApiKey);
    if (result) return result;
    console.log('[SGK-CAPTCHA] OCR.space başarısız, 2Captcha deneniyor...');
  }

  // 2Captcha fallback
  if (captchaApiKey) {
    return await solveWith2Captcha(imageBase64, captchaApiKey);
  }

  console.log('[SGK-CAPTCHA] Hiçbir captcha servisi kullanılamadı!');
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SgkSession — Cookie jar + Struts token zinciri yöneten oturum sınıfı
// ═══════════════════════════════════════════════════════════════════════════

class SgkSession {
  private cookies: Map<string, string> = new Map();
  private currentToken: string | null = null;

  /**
   * Set-Cookie header'ından cookie'leri parse et ve jar'a ekle
   */
  private parseCookies(response: Response): void {
    // Node.js fetch'te set-cookie header'ı getSetCookie() ile alınır
    const setCookieHeaders: string[] = [];

    // getSetCookie() — Node 18+ destekli
    if (typeof (response.headers as any).getSetCookie === 'function') {
      setCookieHeaders.push(...(response.headers as any).getSetCookie());
    } else {
      // Fallback: set-cookie header'ını virgülle ayır
      const raw = response.headers.get('set-cookie');
      if (raw) {
        setCookieHeaders.push(...raw.split(/,(?=[^ ])/));
      }
    }

    for (const cookieStr of setCookieHeaders) {
      const parts = cookieStr.split(';')[0]?.trim();
      if (!parts) continue;
      const eqIdx = parts.indexOf('=');
      if (eqIdx === -1) continue;
      const name = parts.substring(0, eqIdx).trim();
      const value = parts.substring(eqIdx + 1).trim();
      if (name && value) {
        this.cookies.set(name, value);
      }
    }
  }

  /**
   * Cookie jar'dan Cookie header string'i oluştur
   */
  private getCookieString(): string {
    const parts: string[] = [];
    for (const [name, value] of this.cookies) {
      parts.push(`${name}=${value}`);
    }
    return parts.join('; ');
  }

  /**
   * Ortak HTTP header'ları
   */
  private getCommonHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive',
      'Origin': SGK_BASE,
      'Referer': `${EBILDIRGE_BASE}`,
    };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    const cookieStr = this.getCookieString();
    if (cookieStr) {
      headers['Cookie'] = cookieStr;
    }
    return headers;
  }

  /**
   * HTTP GET isteği — cookie jar yönetimli
   */
  private async httpGet(url: string): Promise<{ html: string; headers: Headers; status: number }> {
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getCommonHeaders(),
      redirect: 'follow',
    });
    this.parseCookies(response);
    const html = await response.text();
    return { html, headers: response.headers, status: response.status };
  }

  /**
   * HTTP POST isteği — cookie jar yönetimli
   */
  private async httpPost(
    url: string,
    body: URLSearchParams,
    options?: { expectBinary?: boolean },
  ): Promise<{ html: string; headers: Headers; status: number; buffer?: Buffer }> {
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getCommonHeaders('application/x-www-form-urlencoded'),
      body: body.toString(),
      redirect: 'follow',
    });
    this.parseCookies(response);

    if (options?.expectBinary) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return { html: '', headers: response.headers, status: response.status, buffer };
    }

    const html = await response.text();
    return { html, headers: response.headers, status: response.status };
  }

  /**
   * HTML'den Struts token parse et (hidden input veya link'ten)
   */
  private parseTokenFromHtml(html: string): string | null {
    const $ = cheerio.load(html);

    // 1. Hidden input field'dan token parse
    const hiddenToken = $('input[name="token"]').val();
    if (hiddenToken && typeof hiddenToken === 'string' && hiddenToken.length > 10) {
      return hiddenToken;
    }

    // 2. Link'lerden token parse (login response)
    const link = $('a[href*="tahakkukonaylanmisTahakkukDonemBilgileriniYukle"]').attr('href');
    if (link) {
      try {
        const url = new URL(link, SGK_BASE);
        const token = url.searchParams.get('token');
        if (token && token.length > 10) {
          return token;
        }
      } catch {
        // URL parse hatası — regex ile dene
        const match = link.match(/token=([A-Z0-9]+)/);
        if (match?.[1]) return match[1];
      }
    }

    // 3. Tüm link'lerde token ara
    let foundToken: string | null = null;
    $('a[href*="token="]').each((_i, el) => {
      if (foundToken) return;
      const href = $(el).attr('href');
      if (href) {
        const match = href.match(/token=([A-Z0-9]{20,})/);
        if (match?.[1]) foundToken = match[1];
      }
    });
    if (foundToken) return foundToken;

    // 4. Form action URL'sinden token
    $('form').each((_i, el) => {
      if (foundToken) return;
      const action = $(el).attr('action');
      if (action) {
        const match = action.match(/token=([A-Z0-9]{20,})/);
        if (match?.[1]) foundToken = match[1];
      }
    });

    return foundToken;
  }

  /**
   * Login sonrası HTML'den hata mesajı parse et
   */
  private parseLoginError(html: string): string | null {
    const $ = cheerio.load(html);

    // Hata mesajı alanları
    const errorSelectors = [
      '.errorMessage',
      '.errors',
      '#hataMesaj',
      '.alert-danger',
      '.hata',
      'span.error',
      'div.error',
    ];

    for (const selector of errorSelectors) {
      const text = $(selector).text().trim();
      if (text && text.length > 3) return text;
    }

    // Script içindeki alert mesajlarını kontrol et
    const scriptContent = $('script').text();
    const alertMatch = scriptContent.match(/alert\(['"](.+?)['"]\)/);
    if (alertMatch?.[1]) return alertMatch[1];

    return null;
  }

  /**
   * Sonuç tablosundan bildirge satırlarını parse et
   */
  private parseBildirgeler(html: string): BildirgeRow[] {
    const $ = cheerio.load(html);
    const rows: BildirgeRow[] = [];

    // Tablo satırlarını bul — çeşitli tablo sınıfları dene
    const tableSelectors = [
      'table.listeTablo tbody tr',
      'table.list tbody tr',
      'table.dataTable tbody tr',
      'table tbody tr',
    ];

    let $rows: cheerio.Cheerio<cheerio.Element> | null = null;
    for (const selector of tableSelectors) {
      const found = $(selector);
      if (found.length > 0) {
        $rows = found;
        break;
      }
    }

    if (!$rows || $rows.length === 0) {
      console.log('[SGK-EBILDIRGE] Tabloda satır bulunamadı');
      return rows;
    }

    $rows.each((_i, el) => {
      const cells = $(el).find('td');
      if (cells.length < 8) return; // Başlık satırını atla

      // Tablo kolonları: Tahakkuk Yıl/Ay, Hizmet Yıl/Ay, Belge Türü, Belge Mahiyeti,
      // Kanun No, Toplam Çalışan Sayısı, Toplam Gün Sayısı, Toplam PEK Tutar, PDF linkleri
      const tahakkukDonem = $(cells[0]).text().trim();
      const hizmetDonem = $(cells[1]).text().trim();
      const belgeTuru = $(cells[2]).text().trim();
      const belgeMahiyeti = $(cells[3]).text().trim();
      const kanunNo = $(cells[4]).text().trim();
      const calisanSayisiStr = $(cells[5]).text().trim().replace(/\./g, '').replace(/,/g, '');
      const gunSayisiStr = $(cells[6]).text().trim().replace(/\./g, '').replace(/,/g, '');
      const pekTutar = $(cells[7]).text().trim();

      // bildirgeRefNo — link'lerden veya hücre verilerinden çıkar
      let bildirgeRefNo = '';
      $(el).find('a[href*="bildirgeRefNo="], a[onclick*="bildirgeRefNo"]').each((_j, linkEl) => {
        const href = $(linkEl).attr('href') || '';
        const onclick = $(linkEl).attr('onclick') || '';
        const refMatch = (href + onclick).match(/bildirgeRefNo[=:]['"]?([^'"&\s]+)/);
        if (refMatch?.[1]) bildirgeRefNo = refMatch[1];
      });

      // bildirgeRefNo bulunamazsa, hücre içi hidden input'tan veya data attribute'dan dene
      if (!bildirgeRefNo) {
        const hiddenRefNo = $(el).find('input[name*="refNo"], input[name*="bildirge"]').val();
        if (hiddenRefNo && typeof hiddenRefNo === 'string') bildirgeRefNo = hiddenRefNo;
      }

      // Tahakkuk ve Hizmet PDF link kontrolü
      const hasTahakkukPdf = $(el).find('a[href*="tahakkukonayliFisTahakkukPdf"], a[onclick*="tahakkukonayliFisTahakkukPdf"]').length > 0
        || $(el).find('a:contains("T"), img[title*="Tahakkuk"]').length > 0;
      const hasHizmetPdf = $(el).find('a[href*="tahakkukonayliFisHizmetPdf"], a[onclick*="tahakkukonayliFisHizmetPdf"]').length > 0
        || $(el).find('a:contains("H"), img[title*="Hizmet"]').length > 0;

      // Satır doğrulama — en azından dönem bilgisi olmalı
      if (!tahakkukDonem && !hizmetDonem) return;

      rows.push({
        tahakkukDonem,
        hizmetDonem,
        belgeTuru,
        belgeMahiyeti,
        kanunNo,
        calisanSayisi: parseInt(calisanSayisiStr, 10) || 0,
        gunSayisi: parseInt(gunSayisiStr, 10) || 0,
        pekTutar,
        bildirgeRefNo,
        hasTahakkukPdf,
        hasHizmetPdf,
      });
    });

    console.log(`[SGK-EBILDIRGE] ${rows.length} bildirge satırı parse edildi`);
    return rows;
  }

  /**
   * Sonuç sayfasından işyeri bilgilerini parse et
   */
  private parseIsyeriInfo(html: string): IsyeriInfo | null {
    const $ = cheerio.load(html);

    // İşyeri bilgileri genellikle tablo veya div içinde gelir
    const getText = (label: string): string => {
      let value = '';
      // Label'a göre bul
      $(`td:contains("${label}"), th:contains("${label}"), label:contains("${label}")`).each((_i, el) => {
        if (value) return;
        const next = $(el).next('td, span, div');
        if (next.length > 0) {
          value = next.text().trim();
        }
      });
      return value;
    };

    const sicilNo = getText('Sicil No') || getText('İşyeri Sicil');
    const unvan = getText('Unvan') || getText('İşyeri Unvanı');

    // Eğer hiçbir bilgi bulunamazsa null dön
    if (!sicilNo && !unvan) return null;

    return {
      sicilNo,
      unvan,
      adres: getText('Adres') || getText('İşyeri Adres'),
      sgmKodAd: getText('SGM') || getText('Sosyal Güvenlik Merkezi'),
      kanunKapsaminaAlinis: getText('Kanun') || getText('Kapsam'),
      primOran: getText('Prim Oran') || getText('Prim'),
      isyeriTipi: getText('İşyeri Tipi') || getText('Tip'),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Adım 1: Session başlat — JSESSIONID cookie al
  // ═══════════════════════════════════════════════════════════════════════

  async initSession(): Promise<void> {
    console.log('[SGK-SESSION] Oturum başlatılıyor...');
    const { status } = await this.httpGet(ENDPOINTS.HOME);
    console.log(`[SGK-SESSION] Ana sayfa yüklendi (HTTP ${status}), JSESSIONID alındı`);

    // JSESSIONID kontrolü
    if (!this.cookies.has('JSESSIONID')) {
      console.log('[SGK-SESSION] JSESSIONID cookie bulunamadı, devam ediliyor...');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Adım 2: Captcha resmi al
  // ═══════════════════════════════════════════════════════════════════════

  async getCaptchaImage(): Promise<Buffer> {
    console.log('[SGK-SESSION] Captcha resmi alınıyor...');
    const response = await fetch(ENDPOINTS.CAPTCHA, {
      method: 'GET',
      headers: this.getCommonHeaders(),
    });
    this.parseCookies(response);

    if (!response.ok) {
      throw new Error(`SGK_CAPTCHA_FETCH_FAILED: Captcha alınamadı (HTTP ${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[SGK-SESSION] Captcha resmi alındı (${buffer.length} byte)`);
    return buffer;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Adım 3: Login
  // ═══════════════════════════════════════════════════════════════════════

  async login(credentials: SgkCredentials, captchaSolution: string): Promise<void> {
    console.log('[SGK-SESSION] Login yapılıyor...');
    const maskedUser = credentials.kullaniciAdi.length > 4
      ? `${credentials.kullaniciAdi.slice(0, 3)}***${credentials.kullaniciAdi.slice(-2)}`
      : '***';
    console.log(`[SGK-SESSION] Kullanıcı: ${maskedUser}, İşyeri kodu: ${credentials.isyeriKodu}`);

    const body = new URLSearchParams({
      username: credentials.kullaniciAdi,
      isyeri_kod: credentials.isyeriKodu,
      password: credentials.sistemSifresi,
      isyeri_sifre: credentials.isyeriSifresi,
      isyeri_guvenlik: captchaSolution,
    });

    const { html, status } = await this.httpPost(ENDPOINTS.LOGIN, body);

    // Login başarı kontrolü
    if (status >= 400) {
      throw new Error(`SGK_LOGIN_HTTP_ERROR: HTTP ${status}`);
    }

    // Hata mesajı kontrolü
    const loginError = this.parseLoginError(html);
    if (loginError) {
      // Captcha hatası mı kontrol et
      if (loginError.toLowerCase().includes('güvenlik') ||
          loginError.toLowerCase().includes('captcha') ||
          loginError.toLowerCase().includes('doğrulama')) {
        throw new Error(`SGK_CAPTCHA_WRONG: ${loginError}`);
      }
      throw new Error(`SGK_LOGIN_FAILED: ${loginError}`);
    }

    // Token parse et — başarılı login'de menü sayfası gelir ve token barındırır
    const token = this.parseTokenFromHtml(html);
    if (!token) {
      // Login sayfası tekrar gösteriliyorsa başarısız
      if (html.includes('isyeri_guvenlik') || html.includes('kullaniciIlkKontrollerGiris')) {
        throw new Error('SGK_LOGIN_FAILED: Giriş başarısız. Kullanıcı adı, şifre veya captcha hatalı olabilir.');
      }
      throw new Error('SGK_TOKEN_NOT_FOUND: Login sonrası token bulunamadı');
    }

    this.currentToken = token;
    console.log(`[SGK-SESSION] Login başarılı, token alındı: ${token.substring(0, 8)}...`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Adım 4: Dönem sayfasına git
  // ═══════════════════════════════════════════════════════════════════════

  async loadPeriodPage(): Promise<string> {
    if (!this.currentToken) {
      throw new Error('SGK_NO_TOKEN: Aktif token yok, önce login yapılmalı');
    }

    console.log('[SGK-SESSION] Dönem seçim sayfası yükleniyor...');
    const url = `${ENDPOINTS.PERIOD_LOAD}?struts.token.name=token&token=${this.currentToken}`;
    const { html, status } = await this.httpGet(url);

    if (status >= 400) {
      throw new Error(`SGK_PERIOD_PAGE_ERROR: HTTP ${status}`);
    }

    // Yeni token parse et
    const newToken = this.parseTokenFromHtml(html);
    if (!newToken) {
      throw new Error('SGK_TOKEN_CHAIN_BROKEN: Dönem sayfasından token alınamadı');
    }

    this.currentToken = newToken;
    console.log(`[SGK-SESSION] Dönem sayfası yüklendi, yeni token: ${newToken.substring(0, 8)}...`);
    return newToken;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Adım 5: Dönem sorgula
  // ═══════════════════════════════════════════════════════════════════════

  async queryPeriod(startIndex: number, endIndex: number): Promise<BildirgeQueryResult> {
    if (!this.currentToken) {
      throw new Error('SGK_NO_TOKEN: Aktif token yok');
    }

    console.log(`[SGK-SESSION] Dönem sorgulanıyor (index: ${startIndex}-${endIndex})...`);

    const body = new URLSearchParams({
      'struts.token.name': 'token',
      'token': this.currentToken,
      'hizmet_yil_ay_index': String(startIndex),
      'hizmet_yil_ay_index_bitis': String(endIndex),
    });

    const { html, status } = await this.httpPost(ENDPOINTS.PERIOD_QUERY, body);

    if (status >= 400) {
      throw new Error(`SGK_QUERY_HTTP_ERROR: HTTP ${status}`);
    }

    // Token zinciri — yeni token parse et
    const newToken = this.parseTokenFromHtml(html);
    if (!newToken) {
      throw new Error('SGK_TOKEN_CHAIN_BROKEN: Sorgu sonucundan token alınamadı');
    }
    this.currentToken = newToken;

    // Bildirge satırlarını parse et
    const bildirgeler = this.parseBildirgeler(html);

    // İşyeri bilgilerini parse et
    const isyeriInfo = this.parseIsyeriInfo(html);

    console.log(`[SGK-SESSION] Sorgu tamamlandı: ${bildirgeler.length} bildirge bulundu`);

    return {
      bildirgeler,
      isyeriInfo,
      token: newToken,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Adım 6: PDF indir
  // ═══════════════════════════════════════════════════════════════════════

  async downloadPdf(
    bildirgeRefNo: string,
    tip: 'tahakkuk' | 'hizmet',
    startIndex: number,
    endIndex: number,
  ): Promise<Buffer> {
    if (!this.currentToken) {
      throw new Error('SGK_NO_TOKEN: Aktif token yok');
    }

    const pdfType = PDF_TYPES[tip];
    console.log(`[SGK-SESSION] PDF indiriliyor: ${bildirgeRefNo} (${tip})...`);

    const body = new URLSearchParams({
      'struts.token.name': 'token',
      'token': this.currentToken,
      'tip': pdfType,
      'download': 'true',
      'hizmet_yil_ay_index': String(startIndex),
      'hizmet_yil_ay_index_bitis': String(endIndex),
      'bildirgeRefNo': bildirgeRefNo,
    });

    const { buffer, headers, status } = await this.httpPost(ENDPOINTS.PDF_DOWNLOAD, body, { expectBinary: true });

    if (status >= 400) {
      throw new Error(`SGK_PDF_HTTP_ERROR: HTTP ${status}`);
    }

    // Content-Type kontrolü — PDF mi?
    const contentType = headers.get('content-type') || '';
    if (!contentType.includes('pdf') && buffer) {
      // HTML döndüyse token zinciri kırılmış olabilir
      const htmlContent = buffer.toString('utf-8');
      const newToken = this.parseTokenFromHtml(htmlContent);
      if (newToken) {
        this.currentToken = newToken;
      }
      throw new Error(`SGK_PDF_NOT_PDF: Beklenen PDF yerine ${contentType} döndü`);
    }

    if (!buffer || buffer.length < 100) {
      throw new Error('SGK_PDF_EMPTY: PDF içeriği boş veya çok küçük');
    }

    console.log(`[SGK-SESSION] PDF indirildi: ${bildirgeRefNo} (${tip}) — ${buffer.length} byte`);
    return buffer;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Adım 7: Çıkış
  // ═══════════════════════════════════════════════════════════════════════

  async logout(): Promise<void> {
    try {
      console.log('[SGK-SESSION] Çıkış yapılıyor...');
      await this.httpGet(ENDPOINTS.LOGOUT);
      console.log('[SGK-SESSION] Çıkış başarılı');
    } catch (e) {
      // Logout hatası kritik değil — görmezden gel
      console.log(`[SGK-SESSION] Çıkış sırasında hata (görmezden geliniyor): ${(e as Error).message}`);
    } finally {
      this.cookies.clear();
      this.currentToken = null;
    }
  }

  /**
   * Mevcut token'ı döndür (debug ve dışarıdan erişim için)
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Ana Pipeline Fonksiyonu — Sorgu + PDF İndirme
// ═══════════════════════════════════════════════════════════════════════════

export async function sgkEbildirgeQueryAndDownload(params: {
  credentials: SgkCredentials;
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
  captchaApiKey?: string;
  ocrSpaceApiKey?: string;
  downloadPdfs?: boolean; // PDF'leri de indir mi? (default: true)
  onProgress: (data: { status: string; phase?: string }) => void;
  onResults: (data: { bildirgeler: BildirgeRow[]; isyeriInfo: IsyeriInfo | null }) => void;
  onPdfResult: (data: PdfDownloadResult) => void;
  onPdfSkip: (data: { bildirgeRefNo: string; tip: string; reason: string }) => void;
  onComplete: (data: { success: boolean; totalBildirgeler: number; totalPdfs: number; downloadedPdfs: number; failedPdfs: number }) => void;
  onError: (data: { error: string; errorCode: string }) => void;
}): Promise<void> {
  const {
    credentials, startMonth, startYear, endMonth, endYear,
    captchaApiKey, ocrSpaceApiKey, downloadPdfs = true,
    onProgress, onResults, onPdfResult, onPdfSkip, onComplete, onError,
  } = params;

  if (!captchaApiKey && !ocrSpaceApiKey) {
    onError({ error: 'Captcha API key tanımlı değil. Ayarlardan captcha servisini yapılandırın.', errorCode: 'CAPTCHA_SERVICE_DOWN' });
    return;
  }

  const session = new SgkSession();
  let loginSuccess = false;

  try {
    // ─── Dönem index'lerini hesapla ───
    const startIndex = calculatePeriodIndex(startYear, startMonth);
    const endIndex = calculatePeriodIndex(endYear, endMonth);
    console.log(`[SGK-PIPELINE] Dönem: ${startMonth}/${startYear} - ${endMonth}/${endYear}`);
    console.log(`[SGK-PIPELINE] Index: ${startIndex} - ${endIndex}`);

    // ─── Login (retry destekli) ───
    for (let loginAttempt = 1; loginAttempt <= MAX_LOGIN_RETRIES; loginAttempt++) {
      console.log(`[SGK-PIPELINE] Login denemesi ${loginAttempt}/${MAX_LOGIN_RETRIES}`);
      onProgress({ status: `SGK giriş yapılıyor (deneme ${loginAttempt}/${MAX_LOGIN_RETRIES})...`, phase: 'login' });

      for (let captchaAttempt = 1; captchaAttempt <= MAX_CAPTCHA_RETRIES; captchaAttempt++) {
        try {
          // Adım 1: Session başlat
          onProgress({ status: 'SGK oturumu başlatılıyor...', phase: 'login' });
          await session.initSession();
          await sleep(500);

          // Adım 2: Captcha al ve çöz
          onProgress({ status: `Captcha çözülüyor (deneme ${captchaAttempt}/${MAX_CAPTCHA_RETRIES})...`, phase: 'captcha' });
          const captchaBuffer = await session.getCaptchaImage();
          const captchaBase64 = captchaBuffer.toString('base64');

          const captchaSolution = await solveCaptcha(captchaBase64, captchaApiKey, ocrSpaceApiKey);
          if (!captchaSolution) {
            console.log(`[SGK-PIPELINE] Captcha çözülemedi (deneme ${captchaAttempt}/${MAX_CAPTCHA_RETRIES})`);
            if (captchaAttempt === MAX_CAPTCHA_RETRIES) {
              throw new Error('CAPTCHA_FAILED: Captcha çözülemedi. Tüm denemeler başarısız.');
            }
            await sleep(1000);
            continue;
          }

          console.log(`[SGK-PIPELINE] Captcha çözüldü: ${captchaSolution}`);

          // Adım 3: Login
          onProgress({ status: 'SGK girişi yapılıyor...', phase: 'login' });
          await session.login(credentials, captchaSolution);

          loginSuccess = true;
          break; // Captcha retry döngüsünden çık
        } catch (e: any) {
          if (e.message?.startsWith('SGK_CAPTCHA_WRONG')) {
            console.log(`[SGK-PIPELINE] Captcha hatalı (deneme ${captchaAttempt}/${MAX_CAPTCHA_RETRIES}): ${e.message}`);
            if (captchaAttempt === MAX_CAPTCHA_RETRIES) {
              throw new Error(`CAPTCHA_FAILED: ${MAX_CAPTCHA_RETRIES} deneme sonrası captcha çözülemedi.`);
            }
            await sleep(1000);
            continue;
          }
          // Captcha dışı hata — direkt fırlat
          throw e;
        }
      }

      if (loginSuccess) break;
    }

    if (!loginSuccess) {
      throw new Error('SGK_LOGIN_FAILED: Tüm giriş denemeleri başarısız.');
    }

    // ─── Dönem sayfasına git (Adım 4) ───
    onProgress({ status: 'Onaylanmış bildirgeler sayfası yükleniyor...', phase: 'query' });
    await sleep(DELAY_BETWEEN_REQUESTS);
    await session.loadPeriodPage();

    // ─── Dönem sorgula (Adım 5) ───
    onProgress({ status: `Bildirgeler sorgulanıyor (${startMonth}/${startYear} - ${endMonth}/${endYear})...`, phase: 'query' });
    await sleep(DELAY_BETWEEN_REQUESTS);
    const queryResult = await session.queryPeriod(startIndex, endIndex);

    // Sonuçları gönder
    onResults({
      bildirgeler: queryResult.bildirgeler,
      isyeriInfo: queryResult.isyeriInfo,
    });

    if (queryResult.bildirgeler.length === 0) {
      onProgress({ status: 'Seçilen dönemde bildirge bulunamadı.', phase: 'complete' });
      onComplete({
        success: true,
        totalBildirgeler: 0,
        totalPdfs: 0,
        downloadedPdfs: 0,
        failedPdfs: 0,
      });
      await session.logout();
      return;
    }

    // ─── PDF İndirme (Adım 6) ───
    if (!downloadPdfs) {
      onProgress({ status: 'Sorgulama tamamlandı (PDF indirme kapalı).', phase: 'complete' });
      onComplete({
        success: true,
        totalBildirgeler: queryResult.bildirgeler.length,
        totalPdfs: 0,
        downloadedPdfs: 0,
        failedPdfs: 0,
      });
      await session.logout();
      return;
    }

    let downloadedPdfs = 0;
    let failedPdfs = 0;
    let totalPdfs = 0;

    // Her bildirge için Tahakkuk (T) ve Hizmet (H) PDF'lerini indir
    for (let i = 0; i < queryResult.bildirgeler.length; i++) {
      const bildirge = queryResult.bildirgeler[i];
      const pdfTypesArr: Array<{ tip: 'tahakkuk' | 'hizmet'; available: boolean }> = [
        { tip: 'tahakkuk', available: bildirge.hasTahakkukPdf },
        { tip: 'hizmet', available: bildirge.hasHizmetPdf },
      ];

      for (const { tip, available } of pdfTypesArr) {
        if (!available) {
          onPdfSkip({
            bildirgeRefNo: bildirge.bildirgeRefNo,
            tip,
            reason: 'PDF linki mevcut değil',
          });
          continue;
        }

        if (!bildirge.bildirgeRefNo) {
          onPdfSkip({
            bildirgeRefNo: bildirge.bildirgeRefNo || `satir-${i}`,
            tip,
            reason: 'Bildirge referans numarası bulunamadı',
          });
          continue;
        }

        totalPdfs++;
        const tipLabel = tip === 'tahakkuk' ? 'Tahakkuk Fişi' : 'Hizmet Listesi';
        onProgress({
          status: `PDF indiriliyor: ${bildirge.hizmetDonem} ${tipLabel} (${downloadedPdfs + failedPdfs + 1}/${totalPdfs})...`,
          phase: 'download',
        });

        try {
          await sleep(DELAY_BETWEEN_REQUESTS);
          const pdfBuffer = await session.downloadPdf(
            bildirge.bildirgeRefNo,
            tip,
            startIndex,
            endIndex,
          );

          const fileName = `SGK_${tip === 'tahakkuk' ? 'Tahakkuk' : 'Hizmet'}_${bildirge.hizmetDonem.replace('/', '-')}_${bildirge.bildirgeRefNo}.pdf`;

          onPdfResult({
            bildirgeRefNo: bildirge.bildirgeRefNo,
            tip,
            donem: bildirge.hizmetDonem,
            pdfBase64: pdfBuffer.toString('base64'),
            fileName,
            success: true,
          });
          downloadedPdfs++;
        } catch (e: any) {
          console.log(`[SGK-PIPELINE] PDF indirme hatası: ${bildirge.bildirgeRefNo} (${tip}): ${e.message}`);
          failedPdfs++;
          onPdfResult({
            bildirgeRefNo: bildirge.bildirgeRefNo,
            tip,
            donem: bildirge.hizmetDonem,
            pdfBase64: '',
            fileName: '',
            success: false,
            error: e.message,
          });
        }
      }
    }

    // ─── Tamamlandı ───
    onProgress({ status: 'SGK E-Bildirge sorgulaması tamamlandı.', phase: 'complete' });
    onComplete({
      success: true,
      totalBildirgeler: queryResult.bildirgeler.length,
      totalPdfs,
      downloadedPdfs,
      failedPdfs,
    });
  } catch (e: any) {
    console.error(`[SGK-PIPELINE] Hata: ${e.message}`);

    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = e.message || 'SGK E-Bildirge sorgulama hatası';

    if (e.message?.startsWith('CAPTCHA_FAILED') || e.message?.startsWith('SGK_CAPTCHA')) {
      errorCode = 'CAPTCHA_FAILED';
    } else if (e.message?.startsWith('SGK_LOGIN_FAILED') || e.message?.startsWith('SGK_LOGIN_HTTP')) {
      errorCode = 'AUTH_FAILED';
    } else if (e.message?.startsWith('SGK_TOKEN')) {
      errorCode = 'TOKEN_ERROR';
    } else if (e.message?.startsWith('SGK_QUERY')) {
      errorCode = 'QUERY_ERROR';
    } else if (e.message?.startsWith('SGK_PDF')) {
      errorCode = 'PDF_ERROR';
    } else if (e.message?.includes('ECONNREFUSED') || e.message?.includes('network') || e.message?.includes('fetch')) {
      errorCode = 'NETWORK_ERROR';
      errorMessage = 'SGK sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.';
    } else if (e.message === 'TIMEOUT') {
      errorCode = 'TIMEOUT';
      errorMessage = 'SGK sorgulaması zaman aşımına uğradı.';
    }

    onError({ error: errorMessage, errorCode });
  } finally {
    // Her durumda logout yap
    try {
      if (loginSuccess) {
        await session.logout();
      }
    } catch {
      // Logout hatası görmezden gel
    }
  }
}
