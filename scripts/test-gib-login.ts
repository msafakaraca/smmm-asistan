/**
 * GİB Login Test Script - Single Format
 *
 * API hata kodu: tdvd.auth.null.userid
 * Bu, field isminin "userid" olduğunu gösteriyor
 *
 * Kullanım: npx tsx scripts/test-gib-login.ts
 */

import 'dotenv/config';

const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY || process.env.TWOCAPTCHA_API_KEY;

// GİB Endpoints
const GIB_CAPTCHA_API = 'https://dijital.gib.gov.tr/apigateway/captcha/getnewcaptcha';
const GIB_LOGIN_API = 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/login';

// Default headers
const DEFAULT_HEADERS = {
  'Accept': 'application/json',
  'Accept-Language': 'tr-TR,tr;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Content-Type': 'application/json',
  'Origin': 'https://dijital.gib.gov.tr',
  'Referer': 'https://dijital.gib.gov.tr/portal/login',
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function solve2Captcha(base64Image: string): Promise<string | null> {
  if (!CAPTCHA_API_KEY) {
    console.log('[2CAPTCHA] API key tanımlı değil');
    return null;
  }

  console.log('[2CAPTCHA] Captcha gönderiliyor...');

  const submitRes = await fetch('https://2captcha.com/in.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      key: CAPTCHA_API_KEY,
      method: 'base64',
      body: base64Image,
      json: '1',
      numeric: '0',
      min_len: '4',
      max_len: '6',
      language: '2',
    }),
  });

  const submitData = await submitRes.json();

  if (submitData.status !== 1) {
    console.log('[2CAPTCHA] Gönderme hatası:', submitData.request);
    return null;
  }

  const captchaId = submitData.request;
  console.log(`[2CAPTCHA] ID: ${captchaId}, çözüm bekleniyor...`);

  for (let i = 0; i < 30; i++) {
    await sleep(3000);

    const resultRes = await fetch(
      `https://2captcha.com/res.php?key=${CAPTCHA_API_KEY}&action=get&id=${captchaId}&json=1`
    );
    const resultData = await resultRes.json();

    if (resultData.status === 1) {
      console.log(`[2CAPTCHA] Çözüldü: ${resultData.request}`);
      return resultData.request;
    }

    if (resultData.request !== 'CAPCHA_NOT_READY') {
      console.log('[2CAPTCHA] Hata:', resultData.request);
      return null;
    }

    console.log(`[2CAPTCHA] Bekleniyor... (${i + 1}/30)`);
  }

  console.log('[2CAPTCHA] Timeout');
  return null;
}

async function testGibLogin() {
  console.log('='.repeat(60));
  console.log('GİB LOGIN TEST - userid FORMAT');
  console.log('='.repeat(60));

  // Step 1: Get Captcha
  console.log('\n[ADIM 1] Captcha alınıyor...');

  const captchaRes = await fetch(GIB_CAPTCHA_API, { headers: DEFAULT_HEADERS });

  if (!captchaRes.ok) {
    console.log('❌ Captcha alınamadı!');
    return;
  }

  const captchaData = await captchaRes.json();
  console.log('✅ Captcha alındı - CID:', captchaData.cid);

  // Step 2: Solve Captcha
  console.log('\n[ADIM 2] Captcha çözülüyor...');
  const captchaSolution = await solve2Captcha(captchaData.captchaImgBase64);

  if (!captchaSolution) {
    console.log('❌ Captcha çözülemedi!');
    return;
  }

  console.log('✅ Captcha çözüldü:', captchaSolution);

  // Step 3: Login with userid format
  console.log('\n[ADIM 3] Login yapılıyor...');

  // Test credentials - placeholder değerler
  // Gerçek test için GİB kullanıcı bilgileri gerekli
  const testUser = 'TEST12345678'; // TC/VKN formatında
  const testPass = 'TESTPASSWORD123';

  // Format: userid (from error code tdvd.auth.null.userid)
  const loginPayload = {
    userid: testUser,
    password: testPass,
    captcha: captchaSolution,
    cid: captchaData.cid,
  };

  console.log('Login Payload:', { ...loginPayload, password: '***' });

  const loginRes = await fetch(GIB_LOGIN_API, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(loginPayload),
  });

  console.log(`HTTP Status: ${loginRes.status}`);
  const loginText = await loginRes.text();
  console.log('\nLogin Response:');
  console.log(loginText);

  try {
    const data = JSON.parse(loginText);
    console.log('\n--- Parsed Response ---');
    console.log(JSON.stringify(data, null, 2));

    if (data.messages) {
      console.log('\n--- Messages ---');
      data.messages.forEach((m: { code: string; text: string; type: string }) => {
        console.log(`[${m.type}] ${m.code}`);
        console.log(`  → ${m.text}`);
      });
    }

    // Analiz
    console.log('\n--- Analiz ---');
    if (data.messages?.some((m: { code: string }) => m.code.includes('null.userid'))) {
      console.log('❌ userid field hala null - field ismi yanlış olabilir');
    } else if (data.messages?.some((m: { code: string }) => m.code.includes('null.password'))) {
      console.log('⚠️ userid kabul edildi! password field ismi yanlış');
    } else if (data.messages?.some((m: { code: string }) => m.code.includes('captcha'))) {
      console.log('⚠️ userid ve password kabul edildi! captcha hatası');
    } else if (data.messages?.some((m: { code: string }) => m.code.includes('auth.failed') || m.code.includes('invalid'))) {
      console.log('✅ Tüm field isimleri doğru! Sadece credentials hatalı (beklenen)');
    } else if (data.token) {
      console.log('✅ Login başarılı! Token alındı');
    } else {
      console.log('⚠️ Bilinmeyen durum');
    }

  } catch {
    console.log('⚠️ Response JSON değil');
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST TAMAMLANDI');
  console.log('='.repeat(60));
}

// Run
testGibLogin().catch(console.error);
