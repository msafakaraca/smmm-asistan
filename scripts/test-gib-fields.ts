/**
 * GİB Login - Farklı Field İsimleri Testi
 */

import 'dotenv/config';

const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY || process.env.TWOCAPTCHA_API_KEY;

const GIB_CAPTCHA_API = 'https://dijital.gib.gov.tr/apigateway/captcha/getnewcaptcha';
const GIB_LOGIN_API = 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/login';

const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Accept-Language': 'tr-TR,tr;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Origin': 'https://dijital.gib.gov.tr',
  'Referer': 'https://dijital.gib.gov.tr/portal/login',
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function solve2Captcha(base64: string): Promise<string | null> {
  if (!CAPTCHA_API_KEY) return null;

  const submitRes = await fetch('https://2captcha.com/in.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ key: CAPTCHA_API_KEY, method: 'base64', body: base64, json: '1' }),
  });
  const submitData = await submitRes.json();
  if (submitData.status !== 1) return null;

  const captchaId = submitData.request;
  console.log(`  Captcha ID: ${captchaId}`);

  for (let i = 0; i < 20; i++) {
    await sleep(3000);
    const res = await fetch(`https://2captcha.com/res.php?key=${CAPTCHA_API_KEY}&action=get&id=${captchaId}&json=1`);
    const data = await res.json();
    if (data.status === 1) return data.request;
    if (data.request !== 'CAPCHA_NOT_READY') return null;
  }
  return null;
}

async function testPayload(name: string, payload: object): Promise<void> {
  console.log(`\n--- Test: ${name} ---`);

  // Captcha al
  const captchaRes = await fetch(GIB_CAPTCHA_API, { headers: HEADERS });
  const captchaData = await captchaRes.json();

  // Captcha çöz
  const solution = await solve2Captcha(captchaData.captchaImgBase64);
  if (!solution) {
    console.log('  Captcha çözülemedi');
    return;
  }

  // Login payload'a captcha ekle
  const fullPayload = { ...payload, captcha: solution, cid: captchaData.cid };
  console.log('  Payload:', JSON.stringify(fullPayload));

  const loginRes = await fetch(GIB_LOGIN_API, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(fullPayload),
  });

  const text = await loginRes.text();
  console.log('  Status:', loginRes.status);
  console.log('  Response:', text.substring(0, 200));

  const data = JSON.parse(text);
  if (data.messages?.[0]) {
    console.log(`  -> ${data.messages[0].code}: ${data.messages[0].text}`);
  }
  if (data.token) {
    console.log('  -> ✅ LOGIN BAŞARILI!');
  }
}

async function main() {
  const userid = '50500087';
  const pass = '967522';

  console.log('GİB LOGIN - FIELD NAME TESTS');
  console.log('User:', userid, 'Pass:', pass);

  // Test 1: password (mevcut)
  await testPayload('userid + password', { userid, password: pass });

  // Test 2: sifre
  await testPayload('userid + sifre', { userid, sifre: pass });

  // Test 3: parola
  await testPayload('userid + parola', { userid, parola: pass });

  // Test 4: pass
  await testPayload('userid + pass', { userid, pass });

  // Test 5: userPassword
  await testPayload('userid + userPassword', { userid, userPassword: pass });

  console.log('\n' + '='.repeat(50));
}

main().catch(console.error);
