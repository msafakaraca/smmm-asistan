/**
 * E-Beyanname Arama Test Script
 *
 * Bu script E-Beyanname portalına giriş ve beyanname arama akışını test eder.
 * TÜRMOB reverse-engineering'den öğrenilen bilgiler kullanılıyor.
 *
 * Kullanım:
 *   npx ts-node scripts/test-ebeyanname-search.ts
 */

import 'dotenv/config';

// ═══════════════════════════════════════════════════════════════════════════
// API URLs
// ═══════════════════════════════════════════════════════════════════════════

const DIJITAL_GIB = {
  CAPTCHA: 'https://dijital.gib.gov.tr/apigateway/captcha/getnewcaptcha',
  LOGIN: 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/login',
  EBYN_LOGIN: 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/ebyn-login',
  USER_INFO: 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/user-info',
};

const EBEYANNAME = {
  // TÜRMOB formatı - eyeks endpoint'i
  EYEKS: 'https://ebeyanname.gib.gov.tr/eyeks',
  DISPATCH: 'https://ebeyanname.gib.gov.tr/dispatch',
};

const OCR_SPACE_API = 'https://api.ocr.space/parse/image';
const TWOCAPTCHA_API = 'https://2captcha.com';

// ═══════════════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════════════

const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY;
const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY;
const GIB_KODU = process.env.GIB_KODU || '';
const GIB_SIFRE = process.env.GIB_SIFRE || '';
const GIB_PAROLA = process.env.GIB_PAROLA || ''; // E-Beyanname için

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

function log(msg: string, data?: any) {
  const timestamp = new Date().toISOString().substring(11, 23);
  if (data) {
    console.log(`[${timestamp}] ${msg}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${timestamp}] ${msg}`);
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function solveWithOcrSpace(base64Image: string): Promise<string | null> {
  if (!OCR_SPACE_API_KEY) {
    log('OCR.space API key tanımlı değil');
    return null;
  }

  try {
    const formData = new URLSearchParams({
      apikey: OCR_SPACE_API_KEY,
      base64Image: `data:image/png;base64,${base64Image}`,
      language: 'eng',
      OCREngine: '2',
      isOverlayRequired: 'false',
    });

    const response = await fetch(OCR_SPACE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      signal: AbortSignal.timeout(60000),
    });

    const data = await response.json();

    if (data.OCRExitCode === 1 && data.ParsedResults?.[0]?.ParsedText) {
      const solution = data.ParsedResults[0].ParsedText
        .trim()
        .replace(/\s+/g, '')
        .toLowerCase();
      return solution;
    }

    log('OCR.space parse hatası', data);
    return null;
  } catch (error) {
    log('OCR.space hatası', (error as Error).message);
    return null;
  }
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

async function solveCaptcha(base64Image: string): Promise<string | null> {
  // Önce OCR.space dene
  log('Önce OCR.space deneniyor...');
  let solution = await solveWithOcrSpace(base64Image);
  if (solution) {
    log(`OCR.space çözümü: ${solution}`);
    return solution;
  }

  // OCR.space başarısız, 2Captcha dene
  log('OCR.space başarısız, 2Captcha deneniyor...');
  solution = await solveWith2Captcha(base64Image);
  if (solution) {
    log(`2Captcha çözümü: ${solution}`);
    return solution;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 1: Dijital GİB Login
// ═══════════════════════════════════════════════════════════════════════════

async function dijitalGibLogin(): Promise<{ token: string } | null> {
  log('=== STEP 1: Dijital GİB Login ===');

  // 1.1 Captcha al
  log('Captcha alınıyor...');
  const captchaRes = await fetch(DIJITAL_GIB.CAPTCHA, { headers: HEADERS });
  const captchaData = await captchaRes.json();
  log(`Captcha CID: ${captchaData.cid}`);

  // 1.2 Captcha çöz
  log('Captcha çözülüyor...');
  const solution = await solveCaptcha(captchaData.captchaImgBase64);
  if (!solution) {
    log('Captcha çözülemedi!');
    return null;
  }

  // 1.3 Login
  log('Login yapılıyor...');
  const loginPayload = {
    dk: solution,          // TÜRMOB formatı - captcha değil dk!
    userid: GIB_KODU,
    sifre: GIB_SIFRE,
    imageId: captchaData.cid,  // TÜRMOB formatı - cid değil imageId!
  };

  const loginRes = await fetch(DIJITAL_GIB.LOGIN, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(loginPayload),
  });

  const loginData = await loginRes.json();
  log(`Login response (${loginRes.status}):`, loginData);

  if (loginData.token) {
    log('✅ Dijital GİB login başarılı!');
    return { token: loginData.token };
  }

  log('❌ Dijital GİB login başarısız');
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 2: E-Beyanname Token Al (Yöntem 1: ebyn-login API)
// ═══════════════════════════════════════════════════════════════════════════

async function getEbeyanTokenViaApi(dijitalToken: string): Promise<string | null> {
  log('=== STEP 2A: E-Beyanname Token (ebyn-login API) ===');

  const response = await fetch(DIJITAL_GIB.EBYN_LOGIN, {
    method: 'GET',
    headers: {
      ...HEADERS,
      'Authorization': `Bearer ${dijitalToken}`,
    },
  });

  log(`ebyn-login response status: ${response.status}`);
  const responseText = await response.text();
  log(`ebyn-login response body: ${responseText.substring(0, 500)}`);

  try {
    const data = JSON.parse(responseText);
    log('ebyn-login parsed:', data);

    // redirectUrl'den TOKEN çıkar
    if (data.redirectUrl) {
      const tokenMatch = data.redirectUrl.match(/TOKEN=([^&]+)/);
      if (tokenMatch) {
        const token = tokenMatch[1];
        log(`E-Beyanname token bulundu: ${token.substring(0, 30)}...`);

        // ÖNEMLİ: Redirect URL'e giderek session'ı aktive et
        log('Session aktive ediliyor (redirect URL)...');
        const activateResponse = await fetch(data.redirectUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        log(`Activate response status: ${activateResponse.status}`);
        const activateText = await activateResponse.text();
        log(`Activate response preview: ${activateText.substring(0, 300)}`);

        // Session aktive edildi, token'ı döndür
        log(`✅ E-Beyanname session aktive edildi`);
        return token;
      }
    }
  } catch (e) {
    log('ebyn-login JSON parse hatası');
  }

  log('❌ E-Beyanname token alınamadı');
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 2: E-Beyanname Token Al (Yöntem 2: TÜRMOB eyeks direct login)
// ═══════════════════════════════════════════════════════════════════════════

async function getEbeyanTokenViaEyeks(): Promise<string | null> {
  log('=== STEP 2B: E-Beyanname Token (eyeks direct login) ===');

  // TÜRMOB formatı:
  // POST /eyeks?_dc=UNIX_TIMESTAMP
  // Content-Type: application/x-www-form-urlencoded
  // Body: eyekscommand=ajaxlogin&redirectionpath=context1&username=XXX&password1=XXX&password2=XXX

  if (!GIB_PAROLA) {
    log('GIB_PAROLA tanımlı değil (E-Beyanname parolası)');
    return null;
  }

  const unixTimestamp = Math.floor(Date.now() / 1000);
  const formData = new URLSearchParams({
    eyekscommand: 'ajaxlogin',
    redirectionpath: 'context1',
    username: GIB_KODU,
    password1: GIB_SIFRE,
    password2: GIB_PAROLA,
  });

  const response = await fetch(`${EBEYANNAME.EYEKS}?_dc=${unixTimestamp}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: formData.toString(),
  });

  log(`eyeks response status: ${response.status}`);
  const responseText = await response.text();
  log(`eyeks response: ${responseText.substring(0, 500)}`);

  // XML parse - <TOKEN> elementi
  const tokenMatch = responseText.match(/<TOKEN>([^<]+)<\/TOKEN>/);
  if (tokenMatch) {
    log(`✅ E-Beyanname token (eyeks): ${tokenMatch[1].substring(0, 30)}...`);
    return tokenMatch[1];
  }

  // Error check
  const errorMatch = responseText.match(/<ERROR>([^<]+)<\/ERROR>/);
  if (errorMatch) {
    log(`❌ eyeks hatası: ${errorMatch[1]}`);
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 3: Beyanname Ara
// ═══════════════════════════════════════════════════════════════════════════

async function searchBeyannameler(ebeyanToken: string): Promise<void> {
  log('=== STEP 3: Beyanname Arama ===');

  // Tarihler - son 30 gün
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`; // yyyyMMdd format
  };

  const baslangicTarihi = formatDate(thirtyDaysAgo);
  const bitisTarihi = formatDate(now);

  log(`Tarih aralığı: ${baslangicTarihi} - ${bitisTarihi}`);

  // TÜRMOB formatı
  const unixTimestamp = Math.floor(Date.now() / 1000);
  const formData = new URLSearchParams({
    cmd: 'BEYANNAMELISTESI',
    sorguTipiB: '1',
    beyannameTanim: 'MUHSGK',
    sorguTipiZ: '1',
    baslangicTarihi: baslangicTarihi,
    bitisTarihi: bitisTarihi,
    TOKEN: ebeyanToken,
  });

  log(`Search URL: ${EBEYANNAME.DISPATCH}?_dc=${unixTimestamp}`);
  log(`Form data: ${formData.toString()}`);

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

  log(`Search response status: ${response.status}`);
  const html = await response.text();
  log(`Response length: ${html.length} chars`);
  log(`Response preview (first 1000):\n${html.substring(0, 1000)}`);

  // XML içinden HTMLCONTENT'i çıkar
  let contentHtml = html;
  const htmlContentMatch = html.match(/<HTMLCONTENT>([\s\S]*?)<\/HTMLCONTENT>/i);
  if (htmlContentMatch) {
    contentHtml = htmlContentMatch[1];
    log(`HTMLCONTENT length: ${contentHtml.length}`);
  }

  // Beyanname satırlarını parse et
  const rowRegex = /<tr[^>]*id="row([a-zA-Z0-9]+)"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  const beyannameler: any[] = [];

  while ((rowMatch = rowRegex.exec(contentHtml)) !== null) {
    const rowId = rowMatch[1];
    const rowHtml = rowMatch[2];

    // Hücreleri parse et
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      let cellContent = cellMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Kısaltılmış unvan için title attribute
      const titleMatch = cellMatch[0].match(/title="([^"]+)"/);
      if (titleMatch && cellContent.endsWith('...')) {
        cellContent = titleMatch[1];
      }

      cells.push(cellContent);
    }

    if (cells.length >= 5) {
      beyannameler.push({
        oid: rowId,
        beyannameTuru: cells[1] || '',
        tcVkn: cells[2] || '',
        adSoyadUnvan: cells[3] || '',
        vergiDairesi: cells[4] || '',
        vergilendirmeDonemi: cells[5] || '',
        yuklemeZamani: cells[7] || '',
      });
    }
  }

  if (beyannameler.length > 0) {
    log(`✅ ${beyannameler.length} beyanname parse edildi!`);
    log('İlk 3 beyanname:');
    beyannameler.slice(0, 3).forEach((b, i) => {
      log(`  ${i + 1}. ${b.adSoyadUnvan} - ${b.beyannameTuru} (OID: ${b.oid})`);
    });
  } else {
    log('❌ Beyanname parse edilemedi');
  }

  // Error check
  if (html.includes('EYEKSERROR') && !html.includes('<EYEKSERROR></EYEKSERROR>')) {
    const errorMatch = html.match(/<EYEKSERROR>([^<]+)<\/EYEKSERROR>/);
    if (errorMatch) {
      log(`❌ E-Beyanname Hatası: ${errorMatch[1]}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═'.repeat(60));
  console.log('E-BEYANNAME ARAMA TEST');
  console.log('═'.repeat(60));
  console.log(`GIB_KODU: ${GIB_KODU || 'TANIMLI DEĞİL'}`);
  console.log(`GIB_SIFRE: ${GIB_SIFRE ? '***' : 'TANIMLI DEĞİL'}`);
  console.log(`GIB_PAROLA: ${GIB_PAROLA ? '***' : 'TANIMLI DEĞİL'}`);
  console.log(`OCR_SPACE_API_KEY: ${OCR_SPACE_API_KEY ? '***' : 'TANIMLI DEĞİL'}`);
  console.log('═'.repeat(60));

  if (!GIB_KODU || !GIB_SIFRE) {
    log('GIB_KODU ve GIB_SIFRE env değişkenleri gerekli!');
    return;
  }

  // Step 1: Dijital GİB Login
  const dijitalLogin = await dijitalGibLogin();
  if (!dijitalLogin) {
    log('Test sonlandırılıyor (Dijital GİB login başarısız)');
    return;
  }

  await sleep(1000);

  // Step 2: E-Beyanname Token Al
  // Önce API yöntemi, başarısız olursa TÜRMOB yöntemi
  let ebeyanToken = await getEbeyanTokenViaApi(dijitalLogin.token);

  if (!ebeyanToken && GIB_PAROLA) {
    log('API yöntemi başarısız, eyeks yöntemi deneniyor...');
    await sleep(1000);
    ebeyanToken = await getEbeyanTokenViaEyeks();
  }

  if (!ebeyanToken) {
    log('Test sonlandırılıyor (E-Beyanname token alınamadı)');
    return;
  }

  await sleep(1000);

  // Step 3: Beyanname Ara
  await searchBeyannameler(ebeyanToken);

  console.log('═'.repeat(60));
  console.log('TEST TAMAMLANDI');
  console.log('═'.repeat(60));
}

main().catch(console.error);
