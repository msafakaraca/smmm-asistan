/**
 * SGK E-Bildirge V2 API Modülü
 * =============================
 * SGK E-Bildirge sistemi üzerinden onaylanmış tahakkuk/hizmet bildirgeleri sorgulama ve PDF indirme.
 *
 * - Session-based auth (JSESSIONID cookie + Struts CSRF token zinciri)
 * - Custom JPEG captcha çözme (2Captcha — hızlı polling, max 22s)
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

const DELAY_BETWEEN_REQUESTS = 300;  // Login/sorgu adımları arası bekleme
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
// Captcha Çözücü — Sadece 2Captcha (SGK captcha'ları OCR ile çözülemiyor)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 2Captcha ile captcha çöz
 * İlk bekleme 2s, sonra 2s aralıklarla poll (toplam max ~22s)
 * 2Captcha basit captcha'ları 5-12s'de çözer, 22s'den uzun sürerse yeni captcha denemek daha hızlı
 */
async function solveCaptcha(imageBase64: string, captchaApiKey?: string): Promise<string | null> {
  if (!captchaApiKey) {
    console.log('[SGK-CAPTCHA] 2Captcha API key yok!');
    return null;
  }

  try {
    const t0 = Date.now();
    console.log('[SGK-CAPTCHA] 2Captcha deneniyor...');
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const submitResponse = await fetch('https://2captcha.com/in.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        key: captchaApiKey,
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

    const pollUrl = `https://2captcha.com/res.php?key=${captchaApiKey}&action=get&id=${captchaId}&json=1`;

    // İlk bekleme 2s — 2Captcha queue'ya alım süresi
    await sleep(2000);

    // Polling: 2s aralıkla, max 10 deneme (~22s toplam)
    for (let i = 0; i < 10; i++) {
      const resultResponse = await fetch(pollUrl);
      const resultData = await resultResponse.json();

      if (resultData.status === 1) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        const solution = resultData.request;
        console.log(`[SGK-CAPTCHA] 2Captcha çözüm (${elapsed}s): ${solution}`);
        return solution;
      }
      if (resultData.request !== 'CAPCHA_NOT_READY') {
        console.log(`[SGK-CAPTCHA] 2Captcha beklenmeyen yanıt:`, JSON.stringify(resultData));
        return null;
      }
      await sleep(2000);
    }
    console.log('[SGK-CAPTCHA] 2Captcha zaman aşımı (22s)');
    return null;
  } catch (e) {
    console.log(`[SGK-CAPTCHA] 2Captcha hatası: ${(e as Error).message}`);
    return null;
  }
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
   * HTML yapısını debug için logla — SGK parse sorunlarında kullanılır
   */
  private debugHtmlStructure(html: string): void {
    const $ = cheerio.load(html);
    console.log('[SGK-DEBUG] ═══ HTML Yapı Analizi ═══');
    console.log(`[SGK-DEBUG] Toplam uzunluk: ${html.length} karakter`);
    console.log(`[SGK-DEBUG] Tablo sayısı: ${$('table').length}`);
    console.log(`[SGK-DEBUG] Form sayısı: ${$('form').length}`);
    console.log(`[SGK-DEBUG] Select sayısı: ${$('select').length}`);

    $('table').each((i, tableEl) => {
      const $table = $(tableEl);
      const rowCount = $table.find('tr').length;
      const thCount = $table.find('th').length;
      const className = $table.attr('class') || '(yok)';
      const id = $table.attr('id') || '(yok)';

      console.log(`[SGK-DEBUG] Tablo[${i}]: class="${className}" id="${id}" ${rowCount}satır ${thCount}th`);

      const firstRow = $table.find('tr').first().text().trim().replace(/\s+/g, ' ').substring(0, 200);
      console.log(`[SGK-DEBUG]   İlk satır: ${firstRow}`);

      if (rowCount > 1) {
        const secondRow = $table.find('tr').eq(1).text().trim().replace(/\s+/g, ' ').substring(0, 200);
        console.log(`[SGK-DEBUG]   İkinci satır: ${secondRow}`);
      }
    });
    console.log('[SGK-DEBUG] ═══════════════════════════');
  }

  /**
   * Sonuç tablosundan bildirge satırlarını parse et
   *
   * SGK sayfasında birden fazla tablo olabilir (işyeri bilgileri, dönem seçici, vs.).
   * Doğru tabloyu bulmak için header hücrelerindeki anahtar kelimeler kontrol edilir.
   * Ayrıca her satırda dönem formatı (YYYY/MM) doğrulanır.
   */
  private parseBildirgeler(html: string): BildirgeRow[] {
    const $ = cheerio.load(html);
    const rows: BildirgeRow[] = [];

    // ─── Adım 1: Bildirge veri tablosunu header eşleştirmesiyle bul ───
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let targetTable: any = null;

    $('table').each((_i, tableEl) => {
      if (targetTable) return;
      // Tablodaki TH hücrelerinin birleşik metnini kontrol et
      const thText = $(tableEl).find('th').text().toLowerCase();
      // Bildirge tablosu şu anahtar kelimeleri içerir:
      // "tahakkuk" + "hizmet" veya "belge" veya "çalışan"/"calisan"
      if (
        thText.includes('tahakkuk') &&
        (thText.includes('hizmet') || thText.includes('belge') || thText.includes('çalışan') || thText.includes('calisan'))
      ) {
        targetTable = tableEl;
        console.log('[SGK-EBILDIRGE] Bildirge tablosu bulundu (header eşleşmesi: tahakkuk+hizmet/belge)');
      }
    });

    // Fallback: "Yıl/Ay" içeren tablo
    if (!targetTable) {
      $('table').each((_i, tableEl) => {
        if (targetTable) return;
        const thText = $(tableEl).find('th').text();
        if (thText.includes('Yıl/Ay') || thText.includes('Yil/Ay') || thText.includes('yıl/ay')) {
          targetTable = tableEl;
          console.log('[SGK-EBILDIRGE] Bildirge tablosu bulundu (Yıl/Ay fallback)');
        }
      });
    }

    // Fallback 2: "PEK" veya "Tutar" içeren TH'li tablo
    if (!targetTable) {
      $('table').each((_i, tableEl) => {
        if (targetTable) return;
        const thText = $(tableEl).find('th').text().toLowerCase();
        if ((thText.includes('pek') || thText.includes('tutar')) && thText.includes('kanun')) {
          targetTable = tableEl;
          console.log('[SGK-EBILDIRGE] Bildirge tablosu bulundu (PEK/Tutar+Kanun fallback)');
        }
      });
    }

    if (!targetTable) {
      console.log('[SGK-EBILDIRGE] ⚠️ Bildirge tablosu bulunamadı! Debug bilgisi loglanıyor...');
      this.debugHtmlStructure(html);
      return rows;
    }

    // ─── Adım 2: Veri satırlarını parse et ───
    const $tbody = $(targetTable).find('tbody');
    const $dataRows = $tbody.length > 0
      ? $tbody.find('tr')
      : $(targetTable).find('tr').slice(1); // İlk satır header, kalanları veri

    console.log(`[SGK-EBILDIRGE] ${$dataRows.length} veri satırı bulundu`);

    // YYYY/MM dönem format doğrulaması
    const donemRegex = /^\d{4}\/\d{2}$/;

    $dataRows.each((_i, el) => {
      const cells = $(el).find('td');
      if (cells.length < 8) return; // Yetersiz hücre — header veya boş satır

      const tahakkukDonem = $(cells[0]).text().trim();
      const hizmetDonem = $(cells[1]).text().trim();

      // Dönem format doğrulaması — en az biri YYYY/MM olmalı
      if (!donemRegex.test(tahakkukDonem) && !donemRegex.test(hizmetDonem)) {
        return; // Bildirge satırı değil, atla
      }

      const belgeTuru = $(cells[2]).text().trim();
      const belgeMahiyeti = $(cells[3]).text().trim();
      const kanunNo = $(cells[4]).text().trim();
      const calisanSayisiStr = $(cells[5]).text().trim().replace(/\./g, '').replace(/,/g, '');
      const gunSayisiStr = $(cells[6]).text().trim().replace(/\./g, '').replace(/,/g, '');
      const pekTutar = $(cells[7]).text().trim();

      // ─── İlk satır debug: HTML yapısını logla ───
      if (_i < 2) {
        const rowHtml = $(el).html() || '';
        console.log(`[SGK-DEBUG-ROW${_i}] Hücre sayısı: ${cells.length}`);
        console.log(`[SGK-DEBUG-ROW${_i}] Satır HTML (ilk 2000): ${rowHtml.substring(0, 2000)}`);
        // Tüm elementlerin onclick attribute'larını logla
        $(el).find('[onclick]').each((_k, onclickEl) => {
          const tag = (onclickEl as any).tagName || (onclickEl as any).name || '?';
          const onclick = $(onclickEl).attr('onclick') || '';
          console.log(`[SGK-DEBUG-ROW${_i}] onclick element: <${tag}> onclick="${onclick.substring(0, 300)}"`);
        });
        // Tüm <a> elementlerini logla
        $(el).find('a').each((_k, aEl) => {
          const text = $(aEl).text().trim();
          const href = $(aEl).attr('href') || '';
          const onclick = $(aEl).attr('onclick') || '';
          const allAttrs = (aEl as any).attribs || {};
          console.log(`[SGK-DEBUG-ROW${_i}] <a> text="${text}" href="${href.substring(0, 200)}" onclick="${onclick.substring(0, 200)}" attrs=${JSON.stringify(allAttrs).substring(0, 300)}`);
        });
        // Tüm <input> elementlerini logla
        $(el).find('input').each((_k, inputEl) => {
          const name = $(inputEl).attr('name') || '';
          const value = $(inputEl).attr('value') || '';
          const type = $(inputEl).attr('type') || '';
          console.log(`[SGK-DEBUG-ROW${_i}] <input> type="${type}" name="${name}" value="${value.substring(0, 100)}"`);
        });
        // Tüm <button> elementlerini logla
        $(el).find('button').each((_k, btnEl) => {
          const text = $(btnEl).text().trim();
          const onclick = $(btnEl).attr('onclick') || '';
          console.log(`[SGK-DEBUG-ROW${_i}] <button> text="${text}" onclick="${onclick.substring(0, 200)}"`);
        });
      }

      // ─── bildirgeRefNo çıkarma ───
      let bildirgeRefNo = '';

      // Yöntem 1: Tüm link'lerdeki onclick ve href'lerden ara
      $(el).find('a').each((_j, linkEl) => {
        if (bildirgeRefNo) return;
        const onclick = $(linkEl).attr('onclick') || '';
        const href = $(linkEl).attr('href') || '';
        const combined = onclick + ' ' + href;

        // Pattern 1: bildirgeRefNo='XXX' veya bildirgeRefNo="XXX"
        const m1 = combined.match(/bildirgeRefNo\s*[=,]\s*['"]([^'"]+)['"]/);
        if (m1?.[1]) { bildirgeRefNo = m1[1]; return; }

        // Pattern 2: pdfGosterim('type','refNo')
        const m2 = combined.match(/pdfGosterim\s*\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]/);
        if (m2?.[1]) { bildirgeRefNo = m2[1]; return; }

        // Pattern 3: URL parametresi bildirgeRefNo=XXX
        const m3 = combined.match(/bildirgeRefNo=([^&\s'"]+)/);
        if (m3?.[1]) { bildirgeRefNo = m3[1]; return; }
      });

      // Yöntem 2: Tüm elementlerdeki onclick'lerden ara (a, button, input, td, vb.)
      if (!bildirgeRefNo) {
        $(el).find('[onclick]').each((_j, onclickEl) => {
          if (bildirgeRefNo) return;
          const onclick = $(onclickEl).attr('onclick') || '';

          const m1 = onclick.match(/bildirgeRefNo\s*[=,]\s*['"]([^'"]+)['"]/);
          if (m1?.[1]) { bildirgeRefNo = m1[1]; return; }

          const m2 = onclick.match(/pdfGosterim\s*\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]/);
          if (m2?.[1]) { bildirgeRefNo = m2[1]; return; }

          // Genel fonksiyon çağrısı: fn('param1', 'XXXX-YYYY-M')
          const m3 = onclick.match(/\(\s*['"][^'"]*['"]\s*,\s*['"](\d{1,6}-\d{4}-\d{1,2})['"]/);
          if (m3?.[1]) { bildirgeRefNo = m3[1]; return; }

          // Tek parametreli: fn('XXXX-YYYY-M')
          const m4 = onclick.match(/\(\s*['"](\d{1,6}-\d{4}-\d{1,2})['"]/);
          if (m4?.[1]) { bildirgeRefNo = m4[1]; return; }

          const m5 = onclick.match(/bildirgeRefNo=([^&\s'"]+)/);
          if (m5?.[1]) { bildirgeRefNo = m5[1]; return; }
        });
      }

      // Yöntem 3: Hidden input'tan bildirgeRefNo
      if (!bildirgeRefNo) {
        $(el).find('input').each((_j, inputEl) => {
          if (bildirgeRefNo) return;
          const name = $(inputEl).attr('name') || '';
          const value = $(inputEl).attr('value') || '';
          if (!value) return;
          // name'de refNo, bildirge, ref gibi anahtar kelimeler ara
          if (name.toLowerCase().includes('ref') || name.toLowerCase().includes('bildirge')) {
            bildirgeRefNo = value;
            return;
          }
          // value formatı XXXX-YYYY-M ise al
          if (/^\d{1,6}-\d{4}-\d{1,2}$/.test(value)) {
            bildirgeRefNo = value;
            return;
          }
        });
      }

      // Yöntem 4: data-* attribute'lardan ara
      if (!bildirgeRefNo) {
        const allAttrs = (el as any).attribs || {};
        for (const [attrName, attrValue] of Object.entries(allAttrs)) {
          if (bildirgeRefNo) break;
          if (attrName.startsWith('data-') && typeof attrValue === 'string') {
            if (attrValue.includes('ref') || /^\d{1,6}-\d{4}-\d{1,2}$/.test(attrValue)) {
              bildirgeRefNo = attrValue;
            }
          }
        }
      }

      // Yöntem 5: Satırdaki tüm href'lerde XXXX-YYYY-M pattern'i ara
      if (!bildirgeRefNo) {
        $(el).find('a[href]').each((_j, linkEl) => {
          if (bildirgeRefNo) return;
          const href = $(linkEl).attr('href') || '';
          const m = href.match(/(\d{1,6}-\d{4}-\d{1,2})/);
          if (m?.[1]) { bildirgeRefNo = m[1]; return; }
        });
      }

      // Yöntem 6: Satırdaki tüm text content'te refNo pattern'i ara (son çare)
      if (!bildirgeRefNo) {
        const rowText = $(el).text();
        // Pattern: XXXX-YYYY-M (ör: 1834-2026-1)
        const m = rowText.match(/\b(\d{1,6}-\d{4}-\d{1,2})\b/);
        if (m?.[1]) { bildirgeRefNo = m[1]; }
      }

      if (_i < 2) {
        console.log(`[SGK-DEBUG-ROW${_i}] Çıkarılan bildirgeRefNo: "${bildirgeRefNo}"`);
      }

      // ─── PDF link kontrolü ───
      // <a> elementlerinde kontrol
      let hasTahakkukPdf = $(el).find('a').filter((_j, a) => {
        const onclick = $(a).attr('onclick') || '';
        const text = $(a).text().trim();
        return onclick.includes('tahakkukonayliFisTahakkukPdf') || text === 'T';
      }).length > 0;

      let hasHizmetPdf = $(el).find('a').filter((_j, a) => {
        const onclick = $(a).attr('onclick') || '';
        const text = $(a).text().trim();
        return onclick.includes('tahakkukonayliFisHizmetPdf') || text === 'H';
      }).length > 0;

      // Fallback: <button>, <input type="button/image"> veya onclick içeren herhangi bir element
      if (!hasTahakkukPdf) {
        hasTahakkukPdf = $(el).find('[onclick*="tahakkukonayliFisTahakkukPdf"], [onclick*="Tahakkuk"], button:contains("T")').length > 0;
      }
      if (!hasHizmetPdf) {
        hasHizmetPdf = $(el).find('[onclick*="tahakkukonayliFisHizmetPdf"], [onclick*="Hizmet"], button:contains("H")').length > 0;
      }

      // Eğer hiçbir PDF linki bulunamadıysa ama bildirge satırıysa, her ikisini de true yap
      // (SGK sayfası değişmiş olabilir, indirmeyi deneyelim)
      if (!hasTahakkukPdf && !hasHizmetPdf && bildirgeRefNo) {
        hasTahakkukPdf = true;
        hasHizmetPdf = true;
        if (_i < 2) {
          console.log(`[SGK-DEBUG-ROW${_i}] PDF linkleri bulunamadı, refNo var → her ikisi de true yapıldı`);
        }
      }

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
   *
   * SGK E-Bildirge sayfası işyeri bilgilerini "Anahtar : Değer" formatında
   * tek bir text bloğu olarak döner (tablo hücreleri arasında).
   * Regex ile bilinen anahtar kelimeler arasındaki değerleri çıkarır.
   */
  private parseIsyeriInfo(html: string): IsyeriInfo | null {
    const $ = cheerio.load(html);
    const bodyText = $('body').text().replace(/\s+/g, ' ');

    // İşyeri Tipini bul
    let isyeriTipi = '';
    const tipiMatch = bodyText.match(/(Özel\s+İşyeri|Kamu\s+İşyeri)/i);
    if (tipiMatch) isyeriTipi = tipiMatch[1].replace(/\s+/g, ' ').trim();

    // "Label : Değer" pattern'inden bilgi çıkar
    const extractBetweenLabels = (startLabel: string, nextLabels: string[]): string => {
      const escapedStart = startLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const startRegex = new RegExp(escapedStart + '\\s*:', 'i');
      const startMatch = bodyText.match(startRegex);
      if (!startMatch || startMatch.index === undefined) return '';

      const afterStart = bodyText.substring(startMatch.index + startMatch[0].length);

      let endIdx = afterStart.length;
      for (const nextLabel of nextLabels) {
        const escapedNext = nextLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nextRegex = new RegExp('\\s' + escapedNext + '\\s*:', 'i');
        const nextMatch = afterStart.match(nextRegex);
        if (nextMatch && nextMatch.index !== undefined && nextMatch.index < endIdx) {
          endIdx = nextMatch.index;
        }
      }

      return afterStart.substring(0, endIdx).trim();
    };

    const sicilNo = extractBetweenLabels('Sicil No', ['Ünvan', 'Unvan', 'Adresi', 'Adres']);
    const unvan = extractBetweenLabels('Ünvan', ['Adresi', 'Adres', 'SGK kod-Ad', 'SGM', 'İşyeri Tipi'])
      || extractBetweenLabels('Unvan', ['Adresi', 'Adres', 'SGK kod-Ad', 'SGM', 'İşyeri Tipi']);

    if (!sicilNo && !unvan) {
      // Fallback: tablo hücrelerinden label → next cell
      const getText = (label: string): string => {
        let value = '';
        $(`td:contains("${label}"), th:contains("${label}")`).each((_i, el) => {
          if (value) return;
          const next = $(el).next('td, span, div');
          if (next.length > 0) {
            const nextText = next.text().trim();
            if (nextText && nextText.length > 0) value = nextText;
          }
        });
        return value;
      };

      const fbSicilNo = getText('Sicil No') || getText('İşyeri Sicil');
      const fbUnvan = getText('Ünvan') || getText('Unvan');
      if (!fbSicilNo && !fbUnvan) {
        console.log('[SGK-EBILDIRGE] İşyeri bilgisi bulunamadı');
        return null;
      }

      return {
        sicilNo: fbSicilNo,
        unvan: fbUnvan,
        isyeriTipi,
      };
    }

    console.log(`[SGK-EBILDIRGE] İşyeri bilgisi parse edildi: Sicil=${sicilNo.substring(0, 20)}... Ünvan=${unvan.substring(0, 30)}...`);

    return {
      sicilNo,
      unvan,
      isyeriTipi,
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

    // Debug: HTML yapısını logla (parse sorunlarını tespit etmek için)
    this.debugHtmlStructure(html);

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
    captchaApiKey, downloadPdfs = true,
    onProgress, onResults, onPdfResult, onPdfSkip, onComplete, onError,
  } = params;

  if (!captchaApiKey) {
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

          const captchaSolution = await solveCaptcha(captchaBase64, captchaApiKey);
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

    // İndirilecek PDF görevlerini hazırla
    interface PdfTask {
      bildirge: BildirgeRow;
      tip: 'tahakkuk' | 'hizmet';
      index: number;
    }
    const pdfTasks: PdfTask[] = [];

    for (let i = 0; i < queryResult.bildirgeler.length; i++) {
      const bildirge = queryResult.bildirgeler[i];
      for (const tip of ['tahakkuk', 'hizmet'] as const) {
        const available = tip === 'tahakkuk' ? bildirge.hasTahakkukPdf : bildirge.hasHizmetPdf;
        if (!available) {
          onPdfSkip({ bildirgeRefNo: bildirge.bildirgeRefNo, tip, reason: 'PDF linki mevcut değil' });
          continue;
        }
        if (!bildirge.bildirgeRefNo) {
          onPdfSkip({ bildirgeRefNo: bildirge.bildirgeRefNo || `satir-${i}`, tip, reason: 'Bildirge referans numarası bulunamadı' });
          continue;
        }
        pdfTasks.push({ bildirge, tip, index: i });
      }
    }

    const totalPdfs = pdfTasks.length;
    console.log(`[SGK-PIPELINE] ${totalPdfs} PDF TAMAMI paralel indirilecek (rate limit yok)`);

    onProgress({
      status: `${totalPdfs} PDF aynı anda indiriliyor...`,
      phase: 'download',
    });

    // Tüm PDF'leri aynı anda paralel indir — rate limit yok
    await Promise.all(
      pdfTasks.map(async (task) => {
        try {
          const pdfBuffer = await session.downloadPdf(
            task.bildirge.bildirgeRefNo,
            task.tip,
            startIndex,
            endIndex,
          );
          // İndirilir indirilmez hemen callback'le gönder
          const fileName = `SGK_${task.tip === 'tahakkuk' ? 'Tahakkuk' : 'Hizmet'}_${task.bildirge.hizmetDonem.replace('/', '-')}_${task.bildirge.bildirgeRefNo}.pdf`;
          onPdfResult({
            bildirgeRefNo: task.bildirge.bildirgeRefNo,
            tip: task.tip,
            donem: task.bildirge.hizmetDonem,
            pdfBase64: pdfBuffer.toString('base64'),
            fileName,
            success: true,
          });
          downloadedPdfs++;
        } catch (e: any) {
          console.log(`[SGK-PIPELINE] PDF indirme hatası: ${task.bildirge.bildirgeRefNo} (${task.tip}): ${e.message}`);
          failedPdfs++;
          onPdfResult({
            bildirgeRefNo: task.bildirge.bildirgeRefNo,
            tip: task.tip,
            donem: task.bildirge.hizmetDonem,
            pdfBase64: '',
            fileName: '',
            success: false,
            error: e.message,
          });
        }
      })
    );

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
