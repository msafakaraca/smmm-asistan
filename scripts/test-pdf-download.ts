/**
 * GİB PDF İndirme Test Script
 *
 * Bu script E-Beyanname portalından PDF indirmeyi test eder.
 *
 * Kullanım:
 *   npx ts-node scripts/test-pdf-download.ts
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load env from multiple locations
dotenv.config();
dotenv.config({ path: path.join(process.cwd(), 'electron-bot', '.env') });

// ═══════════════════════════════════════════════════════════════════════════
// API URLs
// ═══════════════════════════════════════════════════════════════════════════

const DIJITAL_GIB = {
  CAPTCHA: 'https://dijital.gib.gov.tr/apigateway/captcha/getnewcaptcha',
  LOGIN: 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/login',
  EBYN_LOGIN: 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/ebyn-login',
};

const EBEYANNAME = {
  DISPATCH: 'https://ebeyanname.gib.gov.tr/dispatch',
};

const TWOCAPTCHA_API = 'https://2captcha.com';

// ═══════════════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════════════

const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY || process.env.TWOCAPTCHA_API_KEY;
const GIB_KODU = process.env.GIB_KODU || '50500087';
const GIB_SIFRE = process.env.GIB_SIFRE || '967522';

// Verbose logging (--verbose veya -v ile aktif)
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Accept-Language': 'tr-TR,tr;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Origin': 'https://dijital.gib.gov.tr',
  'Referer': 'https://dijital.gib.gov.tr/portal/login',
};

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

// Verbose log - sadece --verbose ile gösterilir
function log(msg: string, data?: any) {
  if (!VERBOSE) return;
  const timestamp = new Date().toISOString().substring(11, 23);
  if (data) {
    console.log(`[${timestamp}] ${msg}`, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  } else {
    console.log(`[${timestamp}] ${msg}`);
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function solveWith2Captcha(base64Image: string): Promise<string | null> {
  if (!CAPTCHA_API_KEY) {
    log('2Captcha API key tanımlı değil');
    return null;
  }

  try {
    log('2Captcha\'ya captcha gönderiliyor...');
    const submitRes = await fetch(`${TWOCAPTCHA_API}/in.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        key: CAPTCHA_API_KEY,
        method: 'base64',
        body: base64Image,
        json: '1',
        numeric: '0',
        min_len: '4',
        max_len: '7',
        language: '2',
      }),
    });

    const submitData = await submitRes.json();
    if (submitData.status !== 1) {
      log('2Captcha submit hatası', submitData);
      return null;
    }

    const captchaId = submitData.request;
    log(`2Captcha ID: ${captchaId}, çözülmesi bekleniyor...`);

    for (let i = 0; i < 20; i++) {
      await sleep(3000);
      const resultRes = await fetch(
        `${TWOCAPTCHA_API}/res.php?key=${CAPTCHA_API_KEY}&action=get&id=${captchaId}&json=1`
      );
      const resultData = await resultRes.json();

      if (resultData.status === 1) {
        return resultData.request.toLowerCase();
      }
      if (resultData.request !== 'CAPCHA_NOT_READY') {
        log('2Captcha hatası', resultData);
        return null;
      }
    }

    log('2Captcha timeout');
    return null;
  } catch (error) {
    log('2Captcha hatası', (error as Error).message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Login Functions
// ═══════════════════════════════════════════════════════════════════════════

async function dijitalGibLogin(): Promise<{ token: string } | null> {
  log('=== Dijital GİB Login ===');

  // Captcha al
  log('Captcha alınıyor...');
  const captchaRes = await fetch(DIJITAL_GIB.CAPTCHA, { headers: HEADERS });
  const captchaData = await captchaRes.json();
  log(`Captcha CID: ${captchaData.cid}`);

  // Captcha çöz
  log('Captcha çözülüyor...');
  const solution = await solveWith2Captcha(captchaData.captchaImgBase64);
  if (!solution) {
    log('Captcha çözülemedi!');
    return null;
  }
  log(`Captcha çözümü: ${solution}`);

  // Login
  log('Login yapılıyor...');
  const loginPayload = {
    dk: solution,
    userid: GIB_KODU,
    sifre: GIB_SIFRE,
    imageId: captchaData.cid,
  };

  const loginRes = await fetch(DIJITAL_GIB.LOGIN, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(loginPayload),
  });

  const loginData = await loginRes.json();

  if (loginData.token) {
    log('✅ Dijital GİB login başarılı!');
    return { token: loginData.token };
  }

  log('❌ Dijital GİB login başarısız', loginData);
  return null;
}

async function getEbeyanToken(dijitalToken: string): Promise<string | null> {
  log('=== E-Beyanname Token ===');

  const response = await fetch(DIJITAL_GIB.EBYN_LOGIN, {
    method: 'GET',
    headers: {
      ...HEADERS,
      'Authorization': `Bearer ${dijitalToken}`,
    },
  });

  const data = await response.json();

  if (data.redirectUrl) {
    const tokenMatch = data.redirectUrl.match(/TOKEN=([^&]+)/);
    if (tokenMatch) {
      const token = tokenMatch[1];
      log(`E-Beyanname token: ${token.substring(0, 30)}...`);

      // Session aktive et
      log('Session aktive ediliyor...');
      await fetch(data.redirectUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      log('✅ E-Beyanname session aktive edildi');
      return token;
    }
  }

  log('❌ E-Beyanname token alınamadı');
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Beyanname Search
// ═══════════════════════════════════════════════════════════════════════════

interface BeyannameItem {
  oid: string;
  tahakkukOid?: string;
  sgkBildiriOid?: string;
  muhsgkDetailOid?: string;
  beyannameTuru: string;
  tcVkn: string;
  adSoyadUnvan: string;
  vergiDairesi: string;
  vergilendirmeDonemi: string;
  yuklemeZamani: string;
  hasSgkDetails?: boolean;
  /** Tahakkuk durumu: onaylandi, hata, iptal, onay_bekliyor */
  durum: 'onaylandi' | 'hata' | 'iptal' | 'onay_bekliyor' | 'bilinmiyor';
}

/** Sayfalama bilgisi */
interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  baseQuery: string;
}

/**
 * Tek sayfa beyanname listesi çek ve parse et
 */
async function fetchBeyannamePage(
  ebeyanToken: string,
  baslangicTarihi: string,
  bitisTarihi: string,
  pageNumber: number = 1
): Promise<{ beyannameler: BeyannameItem[]; pagination: PaginationInfo | null; newToken: string }> {
  log(`=== Sayfa ${pageNumber} çekiliyor ===`);

  const unixTimestamp = Math.floor(Date.now() / 1000);

  // İlk sayfa ve sonraki sayfalar için farklı parametreler
  const formData = new URLSearchParams();
  formData.append('cmd', 'BEYANNAMELISTESI');
  formData.append('sorguTipiZ', '1');
  formData.append('baslangicTarihi', baslangicTarihi);
  formData.append('bitisTarihi', bitisTarihi);

  if (pageNumber === 1) {
    // İlk sayfa: sorguTipiB ve beyannameTanim gerekli
    formData.append('sorguTipiB', '1');
    formData.append('beyannameTanim', 'MUHSGK');
  } else {
    // Sonraki sayfalar: sadece pageNo gerekli
    formData.append('pageNo', String(pageNumber));
  }

  formData.append('TOKEN', ebeyanToken);

  const response = await fetch(`${EBEYANNAME.DISPATCH}?_dc=${unixTimestamp}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://ebeyanname.gib.gov.tr',
      'Referer': 'https://ebeyanname.gib.gov.tr/',
    },
    body: formData.toString(),
  });

  const html = await response.text();

  let contentHtml = html;
  const htmlContentMatch = html.match(/<HTMLCONTENT>([\s\S]*?)<\/HTMLCONTENT>/i);
  if (htmlContentMatch) {
    contentHtml = htmlContentMatch[1];
  }

  // Yeni TOKEN'ı al
  const tokenMatch = html.match(/<TOKEN>([^<]+)<\/TOKEN>/);
  const newToken = tokenMatch ? tokenMatch[1] : ebeyanToken;

  // Sayfalama bilgisini parse et
  // Pattern: digerSayfayaGecis(this.form,'nextPage',1,5,'cmd=BEYANNAMELISTESI...')
  let pagination: PaginationInfo | null = null;
  const paginationMatch = contentHtml.match(
    /digerSayfayaGecis\([^,]+,\s*'nextPage'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([^']+)'/
  );
  if (paginationMatch) {
    pagination = {
      currentPage: parseInt(paginationMatch[1], 10),
      totalPages: parseInt(paginationMatch[2], 10),
      baseQuery: paginationMatch[3],
    };
    log(`📄 Sayfalama: ${pagination.currentPage}/${pagination.totalPages}`);
  }

  const beyannameler: BeyannameItem[] = [];
  const rowRegex = /<tr[^>]*id="row([a-zA-Z0-9]+)"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(contentHtml)) !== null) {
    const rowId = rowMatch[1];
    const rowHtml = rowMatch[2];

    // DURUM KONTROLÜ - ok.gif = Onaylandı, err.gif = Hatalı, vb.
    let durum: BeyannameItem['durum'] = 'bilinmiyor';
    if (rowHtml.includes('ok.gif') || rowHtml.toLowerCase().includes('onaylandı')) {
      durum = 'onaylandi';
    } else if (rowHtml.includes('err.gif') || rowHtml.toLowerCase().includes('hatalı')) {
      durum = 'hata';
    } else if (rowHtml.includes('iptal.gif') || rowHtml.toLowerCase().includes('iptal')) {
      durum = 'iptal';
    } else if (rowHtml.includes('wtng.gif') || rowHtml.toLowerCase().includes('onay bekliyor')) {
      durum = 'onay_bekliyor';
    }

    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      let cellContent = cellMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const titleMatch = cellMatch[0].match(/title="([^"]+)"/);
      if (titleMatch && cellContent.endsWith('...')) {
        cellContent = titleMatch[1];
      }

      cells.push(cellContent);
    }

    if (cells.length >= 5) {
      // Tahakkuk OID bul
      const tahakkukMatch = rowHtml.match(
        /tahakkukGoruntule\(['"]([a-zA-Z0-9]+)['"],\s*['"]([a-zA-Z0-9]+)['"]/
      );

      // SGK Bildiri OID bul
      const sgkBildiriMatch = rowHtml.match(
        /sgkTahakkukGoruntule\(['"]([a-zA-Z0-9]+)['"],\s*['"]([a-zA-Z0-9]+)['"]/
      );

      // MUHSGK detay OID bul
      const muhsgkDetailOidMatch = rowHtml.match(/bynGoruntu\(['"]([a-zA-Z0-9]+)['"]/);

      // MUHSGK kontrolü
      const beyannameTuru = cells[1] || '';
      const isMuhsgk = beyannameTuru.toUpperCase() === 'MUHSGK' ||
                       (beyannameTuru.toLowerCase().includes('muhtasar') &&
                        beyannameTuru.toLowerCase().includes('prim'));

      beyannameler.push({
        oid: rowId,
        tahakkukOid: tahakkukMatch ? tahakkukMatch[2] : undefined,
        sgkBildiriOid: sgkBildiriMatch ? sgkBildiriMatch[2] : undefined,
        muhsgkDetailOid: muhsgkDetailOidMatch ? muhsgkDetailOidMatch[1] : undefined,
        beyannameTuru: beyannameTuru,
        tcVkn: cells[2] || '',
        adSoyadUnvan: cells[3] || '',
        vergiDairesi: cells[4] || '',
        vergilendirmeDonemi: cells[5] || '',
        yuklemeZamani: cells[7] || '',
        hasSgkDetails: isMuhsgk || beyannameTuru.toUpperCase() === 'MUHSGK',
        durum: durum,
      });
    }
  }

  log(`✅ Sayfa ${pageNumber}: ${beyannameler.length} beyanname bulundu`);
  return { beyannameler, pagination, newToken };
}

/**
 * TÜM SAYFALARI GEZ ve beyannameleri topla
 */
async function searchBeyannameler(ebeyanToken: string): Promise<BeyannameItem[]> {
  log('=== Beyanname Arama (Tüm Sayfalar) ===');

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const baslangicTarihi = formatDate(thirtyDaysAgo);
  const bitisTarihi = formatDate(now);

  log(`Tarih aralığı: ${baslangicTarihi} - ${bitisTarihi}`);

  const allBeyannameler: BeyannameItem[] = [];
  let currentToken = ebeyanToken;
  let currentPage = 1;
  let totalPages = 1;

  // İlk sayfayı çek
  console.log(`📄 Sayfa 1 yükleniyor...`);
  const firstResult = await fetchBeyannamePage(currentToken, baslangicTarihi, bitisTarihi, 1);
  allBeyannameler.push(...firstResult.beyannameler);
  currentToken = firstResult.newToken;

  if (firstResult.pagination) {
    totalPages = firstResult.pagination.totalPages;
    currentPage = firstResult.pagination.currentPage;
    console.log(`   ✓ Sayfa 1/${totalPages}: ${firstResult.beyannameler.length} beyanname`);
  } else {
    console.log(`   ✓ Sayfa 1/1: ${firstResult.beyannameler.length} beyanname (tek sayfa)`);
  }

  // Kalan sayfaları çek
  while (currentPage < totalPages) {
    currentPage++;
    await sleep(1250); // Sayfalar arası bekleme

    console.log(`📄 Sayfa ${currentPage} yükleniyor...`);
    const pageResult = await fetchBeyannamePage(currentToken, baslangicTarihi, bitisTarihi, currentPage);
    allBeyannameler.push(...pageResult.beyannameler);
    currentToken = pageResult.newToken;
    console.log(`   ✓ Sayfa ${currentPage}/${totalPages}: ${pageResult.beyannameler.length} beyanname`);

    // Pagination bilgisi güncelle (sayfa sayısı değişebilir)
    if (pageResult.pagination) {
      totalPages = pageResult.pagination.totalPages;
    }
  }

  console.log(`\n✅ TOPLAM: ${allBeyannameler.length} beyanname (${totalPages} sayfa)\n`);
  return allBeyannameler;
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF Download
// ═══════════════════════════════════════════════════════════════════════════

async function downloadPdf(
  beyannameOid: string,
  type: 'beyanname' | 'tahakkuk',
  token: string,
  tahakkukOid?: string  // KRİTİK: Tahakkuk için ikinci OID gerekli!
): Promise<{ success: boolean; base64?: string; fileSize?: number; error?: string }> {
  log(`PDF indiriliyor: beyannameOid=${beyannameOid}, type=${type}, tahakkukOid=${tahakkukOid || 'N/A'}`);

  const unixTimestamp = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    cmd: 'IMAJ',
    subcmd: type === 'beyanname' ? 'BEYANNAMEGORUNTULE' : 'TAHAKKUKGORUNTULE',
    beyannameOid: beyannameOid,
    goruntuTip: '1',
    inline: 'true',
    TOKEN: token,
  });

  // KRİTİK: Tahakkuk için ek OID parametresi gerekli!
  if (type === 'tahakkuk' && tahakkukOid) {
    params.append('tahakkukOid', tahakkukOid);
  }

  const url = `${EBEYANNAME.DISPATCH}?_dc=${unixTimestamp}&${params.toString()}`;
  log(`PDF URL: ${url.substring(0, 100)}...`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf,application/octet-stream,*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://ebeyanname.gib.gov.tr/',
      },
    });

    log(`Response status: ${response.status}`);
    log(`Content-Type: ${response.headers.get('content-type')}`);
    log(`Content-Length: ${response.headers.get('content-length')}`);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';

    // PDF ise
    if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      log(`✅ PDF indirildi: ${buffer.byteLength} bytes`);
      return { success: true, base64, fileSize: buffer.byteLength };
    }

    // HTML/XML ise (hata mesajı olabilir)
    const text = await response.text();
    log(`Response preview: ${text.substring(0, 500)}`);

    // XML içinden PDF kontrolü - bazen PDF base64 encoded XML içinde gelir
    if (text.includes('<PDFFILE>')) {
      const pdfMatch = text.match(/<PDFFILE>([^<]+)<\/PDFFILE>/);
      if (pdfMatch) {
        const base64Pdf = pdfMatch[1];
        log(`✅ PDF (XML içinde) indirildi: ${base64Pdf.length} chars`);
        return { success: true, base64: base64Pdf, fileSize: base64Pdf.length };
      }
    }

    // Hata mesajı kontrolü
    if (text.includes('EYEKSERROR') || text.includes('SERVERERROR')) {
      const errorMatch = text.match(/<EYEKSERROR>([^<]+)<\/EYEKSERROR>/) ||
                        text.match(/<SERVERERROR>([^<]+)<\/SERVERERROR>/);
      if (errorMatch) {
        return { success: false, error: errorMatch[1] };
      }
    }

    return { success: false, error: `Beklenmeyen Content-Type: ${contentType}` };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MUHSGK SGK PDF Functions
// ═══════════════════════════════════════════════════════════════════════════

interface MuhsgkDetailPdfs {
  sgkTahakkukUrls: string[];
  hizmetListesiUrls: string[];
}

async function getMuhsgkDetailPdfs(beyannameOid: string, token: string): Promise<MuhsgkDetailPdfs> {
  log(`=== MUHSGK Detay PDF'leri: ${beyannameOid} ===`);

  const result: MuhsgkDetailPdfs = {
    sgkTahakkukUrls: [],
    hizmetListesiUrls: [],
  };

  try {
    // MUHSGK Detay popup HTML'ini çek
    // DevTools'tan keşfedildi: SGK popup için doğru komut THKESASBILGISGKMESAJLARI
    const unixTimestamp = Math.floor(Date.now() / 1000);
    const formData = new URLSearchParams({
      cmd: 'THKESASBILGISGKMESAJLARI',
      beyannameOid: beyannameOid,
      TOKEN: token,
    });

    const response = await fetch(`${EBEYANNAME.DISPATCH}?_dc=${unixTimestamp}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://ebeyanname.gib.gov.tr',
        'Referer': 'https://ebeyanname.gib.gov.tr/',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      log(`❌ Detay popup hatası: HTTP ${response.status}`);
      return result;
    }

    const html = await response.text();
    log(`Detay popup alındı: ${html.length} chars`);

    // Debug: İlk 1000 karakteri göster
    log(`Detay preview: ${html.substring(0, 1000)}`);

    // SGK Tahakkuk PDF URL'lerini parse et
    // KRİTİK: sgkTahakkukGoruntule('beyannameOid', 'sgkBildiriOid', false, false)
    // İKİ FARKLI OID var!
    const sgkTahakkukRegex = /sgkTahakkukGoruntule\(['"]([a-zA-Z0-9]+)['"],\s*['"]([a-zA-Z0-9]+)['"]/gi;
    let match;

    while ((match = sgkTahakkukRegex.exec(html)) !== null) {
      const bynOid = match[1];      // beyannameOid
      const sgkTahakkukOid = match[2];  // sgkTahakkukOid (KRİTİK!)
      // TOKEN doğru sırada: cmd -> subcmd -> TOKEN -> diğer parametreler
      const url = `${EBEYANNAME.DISPATCH}?cmd=IMAJ&subcmd=SGKTAHAKKUKGORUNTULE&TOKEN=__TOKEN__&beyannameOid=${bynOid}&sgkTahakkukOid=${sgkTahakkukOid}&inline=true`;
      result.sgkTahakkukUrls.push(url);
      log(`✅ SGK Tahakkuk URL bulundu: beyannameOid=${bynOid}, sgkTahakkukOid=${sgkTahakkukOid}`);
    }

    // Hizmet Listesi PDF URL'lerini parse et
    // KRİTİK: sgkHizmetGoruntule('beyannameOid', 'sgkTahakkukOid', false, false)
    const hizmetListesiRegex = /sgkHizmetGoruntule\(['"]([a-zA-Z0-9]+)['"],\s*['"]([a-zA-Z0-9]+)['"]/gi;

    while ((match = hizmetListesiRegex.exec(html)) !== null) {
      const bynOid = match[1];      // beyannameOid
      const sgkTahakkukOid = match[2];  // sgkTahakkukOid (KRİTİK!)
      // TOKEN doğru sırada
      const url = `${EBEYANNAME.DISPATCH}?cmd=IMAJ&subcmd=SGKHIZMETGORUNTULE&TOKEN=__TOKEN__&beyannameOid=${bynOid}&sgkTahakkukOid=${sgkTahakkukOid}&inline=true`;
      result.hizmetListesiUrls.push(url);
      log(`✅ Hizmet Listesi URL bulundu: beyannameOid=${bynOid}, sgkTahakkukOid=${sgkTahakkukOid}`);
    }

    // Toplu indirme butonu pattern
    // sgkTopluTahakkukGoruntule('beyannameOid', 'sgkTahakkukOid', false, false)
    const topluTahakkukRegex = /sgkTopluTahakkukGoruntule\(['"]([a-zA-Z0-9]+)['"],\s*['"]([a-zA-Z0-9]+)['"]/gi;
    while ((match = topluTahakkukRegex.exec(html)) !== null) {
      const bynOid = match[1];
      const sgkTahakkukOid = match[2];
      if (!result.sgkTahakkukUrls.some(u => u.includes(sgkTahakkukOid))) {
        const url = `${EBEYANNAME.DISPATCH}?cmd=IMAJ&subcmd=SGKTAHAKKUKGORUNTULE&TOKEN=__TOKEN__&beyannameOid=${bynOid}&sgkTahakkukOid=${sgkTahakkukOid}&inline=true`;
        result.sgkTahakkukUrls.push(url);
        log(`✅ SGK Tahakkuk URL (toplu) bulundu: beyannameOid=${bynOid}, sgkTahakkukOid=${sgkTahakkukOid}`);
      }
    }

    log(`Toplam: ${result.sgkTahakkukUrls.length} SGK Tahakkuk, ${result.hizmetListesiUrls.length} Hizmet Listesi`);

  } catch (error) {
    log(`❌ MUHSGK detay hatası: ${(error as Error).message}`);
  }

  return result;
}

async function downloadSgkPdf(
  url: string,
  token: string
): Promise<{ success: boolean; base64?: string; fileSize?: number; error?: string }> {
  // TOKEN placeholder'ı gerçek token ile değiştir
  const urlWithToken = url.replace('__TOKEN__', token);
  log(`SGK PDF indiriliyor: ${urlWithToken.substring(0, 100)}...`);

  try {
    const response = await fetch(urlWithToken, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf,application/octet-stream,*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://ebeyanname.gib.gov.tr/',
      },
    });

    log(`Response status: ${response.status}`);
    log(`Content-Type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      log(`✅ SGK PDF indirildi: ${buffer.byteLength} bytes`);
      return { success: true, base64, fileSize: buffer.byteLength };
    }

    // HTML/XML response
    const text = await response.text();
    log(`Response preview: ${text.substring(0, 500)}`);

    // XML içinden PDF kontrolü
    if (text.includes('<PDFFILE>')) {
      const pdfMatch = text.match(/<PDFFILE>([^<]+)<\/PDFFILE>/);
      if (pdfMatch) {
        const base64Pdf = pdfMatch[1];
        log(`✅ SGK PDF (XML içinde) indirildi: ${base64Pdf.length} chars`);
        return { success: true, base64: base64Pdf, fileSize: base64Pdf.length };
      }
    }

    // Hata mesajı kontrolü
    if (text.includes('EYEKSERROR') || text.includes('SERVERERROR')) {
      const errorMatch = text.match(/<EYEKSERROR>([^<]+)<\/EYEKSERROR>/) ||
                        text.match(/<SERVERERROR>([^<]+)<\/SERVERERROR>/);
      if (errorMatch) {
        return { success: false, error: errorMatch[1] };
      }
    }

    return { success: false, error: `Beklenmeyen Content-Type: ${contentType}` };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Main - BULK TEST (Tüm beyannameler)
// ═══════════════════════════════════════════════════════════════════════════

interface DownloadStats {
  beyanname: { success: number; failed: number };
  tahakkuk: { success: number; failed: number };
  sgkTahakkuk: { success: number; failed: number };
  hizmetListesi: { success: number; failed: number };
  errors: string[];
}

async function main() {
  console.log('═'.repeat(50));
  console.log('GİB PDF BULK İNDİRME TESTİ');
  console.log('═'.repeat(50));

  if (!GIB_KODU || !GIB_SIFRE) {
    console.log('❌ GIB_KODU ve GIB_SIFRE gerekli!');
    return;
  }

  const stats: DownloadStats = {
    beyanname: { success: 0, failed: 0 },
    tahakkuk: { success: 0, failed: 0 },
    sgkTahakkuk: { success: 0, failed: 0 },
    hizmetListesi: { success: 0, failed: 0 },
    errors: [],
  };

  // 1. Login (quiet)
  const dijitalLogin = await dijitalGibLogin();
  if (!dijitalLogin) return;
  console.log('✅ GİB Login başarılı');

  await sleep(1250);

  // 2. E-Beyanname Token (quiet)
  const ebeyanToken = await getEbeyanToken(dijitalLogin.token);
  if (!ebeyanToken) return;
  console.log('✅ E-Beyanname token alındı');

  await sleep(1250);

  // 3. Beyanname listele (tüm sayfalar)
  const tumBeyannameler = await searchBeyannameler(ebeyanToken);
  if (tumBeyannameler.length === 0) {
    console.log('❌ Beyanname bulunamadı');
    return;
  }

  // DURUM FİLTRESİ - Sadece Onaylandı olanları indir
  const beyannameler = tumBeyannameler.filter(b => b.durum === 'onaylandi');

  // Durum istatistikleri
  const durumStats = {
    onaylandi: tumBeyannameler.filter(b => b.durum === 'onaylandi').length,
    hata: tumBeyannameler.filter(b => b.durum === 'hata').length,
    iptal: tumBeyannameler.filter(b => b.durum === 'iptal').length,
    onay_bekliyor: tumBeyannameler.filter(b => b.durum === 'onay_bekliyor').length,
    bilinmiyor: tumBeyannameler.filter(b => b.durum === 'bilinmiyor').length,
  };

  console.log(`📋 Toplam: ${tumBeyannameler.length} beyanname`);
  console.log(`   ✅ Onaylandı: ${durumStats.onaylandi} (indirilecek)`);
  console.log(`   ⏳ Onay Bekliyor: ${durumStats.onay_bekliyor}`);
  console.log(`   ❌ Hatalı: ${durumStats.hata}`);
  console.log(`   🚫 İptal: ${durumStats.iptal}`);
  if (durumStats.bilinmiyor > 0) {
    console.log(`   ❓ Bilinmiyor: ${durumStats.bilinmiyor}`);
  }

  if (beyannameler.length === 0) {
    console.log('\n⚠️ Onaylanmış beyanname bulunamadı!');
    return;
  }

  console.log(`\n📥 ${beyannameler.length} onaylanmış beyanname indirilecek\n`);

  // Output dizini
  const outputDir = path.join(process.cwd(), 'test-output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const existingFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.pdf'));
  existingFiles.forEach(f => fs.unlinkSync(path.join(outputDir, f)));

  // 4. ONAYLANMIŞ BEYANNAMELERİ İNDİR
  console.log('İndirme başlıyor...\n');

  let totalElapsed = 0; // Toplam süre takibi

  for (let i = 0; i < beyannameler.length; i++) {
    const b = beyannameler[i];
    const results: string[] = [];
    const mukellefStartTime = Date.now(); // Mükellef başlangıç zamanı

    // Beyanname PDF
    const pdfResult = await downloadPdf(b.oid, 'beyanname', ebeyanToken);
    if (pdfResult.success && pdfResult.base64) {
      fs.writeFileSync(path.join(outputDir, `${i + 1}_beyanname_${b.beyannameTuru}_${b.tcVkn}.pdf`), Buffer.from(pdfResult.base64, 'base64'));
      results.push('B✓');
      stats.beyanname.success++;
    } else {
      results.push('B✗');
      stats.beyanname.failed++;
      stats.errors.push(`${b.tcVkn} Beyanname: ${pdfResult.error}`);
    }
    await sleep(1250); // 1500ms → 1000ms (hızlandırma)

    // Tahakkuk PDF
    if (b.tahakkukOid) {
      const tResult = await downloadPdf(b.oid, 'tahakkuk', ebeyanToken, b.tahakkukOid);
      if (tResult.success && tResult.base64) {
        fs.writeFileSync(path.join(outputDir, `${i + 1}_tahakkuk_${b.beyannameTuru}_${b.tcVkn}.pdf`), Buffer.from(tResult.base64, 'base64'));
        results.push('T✓');
        stats.tahakkuk.success++;
      } else {
        results.push('T✗');
        stats.tahakkuk.failed++;
        stats.errors.push(`${b.tcVkn} Tahakkuk: ${tResult.error}`);
      }
      await sleep(1250); // 1500ms → 1000ms
    }

    // MUHSGK SGK PDF'leri
    if (b.hasSgkDetails) {
      const muhsgkPdfs = await getMuhsgkDetailPdfs(b.oid, ebeyanToken);

      for (let j = 0; j < muhsgkPdfs.sgkTahakkukUrls.length; j++) {
        await sleep(1250); // 1500ms → 1000ms
        const sgkResult = await downloadSgkPdf(muhsgkPdfs.sgkTahakkukUrls[j], ebeyanToken);
        if (sgkResult.success && sgkResult.base64) {
          fs.writeFileSync(path.join(outputDir, `${i + 1}_sgk_tahakkuk_${j + 1}_${b.tcVkn}.pdf`), Buffer.from(sgkResult.base64, 'base64'));
          results.push('S✓');
          stats.sgkTahakkuk.success++;
        } else {
          results.push('S✗');
          stats.sgkTahakkuk.failed++;
          stats.errors.push(`${b.tcVkn} SGK: ${sgkResult.error}`);
        }
      }

      for (let j = 0; j < muhsgkPdfs.hizmetListesiUrls.length; j++) {
        await sleep(1250); // 1500ms → 1000ms
        const hResult = await downloadSgkPdf(muhsgkPdfs.hizmetListesiUrls[j], ebeyanToken);
        if (hResult.success && hResult.base64) {
          fs.writeFileSync(path.join(outputDir, `${i + 1}_hizmet_${j + 1}_${b.tcVkn}.pdf`), Buffer.from(hResult.base64, 'base64'));
          results.push('H✓');
          stats.hizmetListesi.success++;
        } else {
          results.push('H✗');
          stats.hizmetListesi.failed++;
          stats.errors.push(`${b.tcVkn} Hizmet: ${hResult.error}`);
        }
      }
    }

    // Mükellef süre hesaplama
    const mukellefElapsed = ((Date.now() - mukellefStartTime) / 1000).toFixed(1);
    totalElapsed += Date.now() - mukellefStartTime;

    // Tek satır özet (süre dahil)
    console.log(`[${String(i + 1).padStart(2)}/${beyannameler.length}] ${b.adSoyadUnvan.substring(0, 30).padEnd(30)} ${b.beyannameTuru.padEnd(8)} [${results.join(' ')}] ${mukellefElapsed}s`);

    // KRİTİK: Mükellef geçişi için rate limiting (1 saniye kuralı)
    if (i < beyannameler.length - 1) {
      await sleep(1250); // 1200ms → 1000ms
    }
  }

  // Toplam süre özeti
  const totalSeconds = (totalElapsed / 1000).toFixed(1);
  const avgPerMukellef = (totalElapsed / 1000 / beyannameler.length).toFixed(1);
  console.log(`\n⏱️  Toplam indirme süresi: ${totalSeconds}s (ortalama ${avgPerMukellef}s/mükellef)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // ÖZET
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(60));
  console.log('BULK TEST TAMAMLANDI');
  console.log('═'.repeat(60));

  console.log('\n📊 İSTATİSTİKLER:');
  console.log(`   Beyanname PDF:    ✅ ${stats.beyanname.success}  ❌ ${stats.beyanname.failed}`);
  console.log(`   Tahakkuk PDF:     ✅ ${stats.tahakkuk.success}  ❌ ${stats.tahakkuk.failed}`);
  console.log(`   SGK Tahakkuk:     ✅ ${stats.sgkTahakkuk.success}  ❌ ${stats.sgkTahakkuk.failed}`);
  console.log(`   Hizmet Listesi:   ✅ ${stats.hizmetListesi.success}  ❌ ${stats.hizmetListesi.failed}`);

  const totalSuccess = stats.beyanname.success + stats.tahakkuk.success +
                       stats.sgkTahakkuk.success + stats.hizmetListesi.success;
  const totalFailed = stats.beyanname.failed + stats.tahakkuk.failed +
                      stats.sgkTahakkuk.failed + stats.hizmetListesi.failed;

  console.log(`\n   TOPLAM: ✅ ${totalSuccess}  ❌ ${totalFailed}`);

  if (stats.errors.length > 0) {
    console.log('\n⚠️ HATALAR:');
    stats.errors.slice(0, 10).forEach(e => console.log(`   - ${e}`));
    if (stats.errors.length > 10) {
      console.log(`   ... ve ${stats.errors.length - 10} hata daha`);
    }
  }

  console.log('\n📁 İNDİRİLEN DOSYALAR:');
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.pdf'));
    files.forEach((f, i) => {
      const s = fs.statSync(path.join(outputDir, f));
      console.log(`   ${i + 1}. ${f} (${s.size} bytes)`);
    });
    console.log(`\n   Toplam: ${files.length} PDF dosyası`);
  }
}

main().catch(console.error);
