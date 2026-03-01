/**
 * GİB Login Test - Gerçek Credentials
 */

import 'dotenv/config';

const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY || process.env.TWOCAPTCHA_API_KEY;

const GIB_CAPTCHA_API = 'https://dijital.gib.gov.tr/apigateway/captcha/getnewcaptcha';
const GIB_LOGIN_API = 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/login';

const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Accept-Language': 'tr-TR,tr;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Origin': 'https://dijital.gib.gov.tr',
  'Referer': 'https://dijital.gib.gov.tr/portal/login',
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function solve2Captcha(base64Image: string): Promise<string | null> {
  if (!CAPTCHA_API_KEY) {
    console.log('2Captcha API key tanımlı değil');
    return null;
  }

  console.log('Captcha gönderiliyor...');

  const submitRes = await fetch('https://2captcha.com/in.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      key: CAPTCHA_API_KEY,
      method: 'base64',
      body: base64Image,
      json: '1',
      numeric: '0', // Harf ve rakam karışık
      min_len: '4',
      max_len: '7', // Tire dahil 7 karakter olabilir
      language: '2', // Latin karakterler
      textinstructions: 'Captcha may contain dash (-) character at the end. Include all characters including dash.',
    }),
  });

  const submitData = await submitRes.json();
  if (submitData.status !== 1) {
    console.log('Captcha gönderme hatası:', submitData.request);
    return null;
  }

  const captchaId = submitData.request;
  console.log(`Captcha ID: ${captchaId}, bekleniyor...`);

  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const resultRes = await fetch(
      `https://2captcha.com/res.php?key=${CAPTCHA_API_KEY}&action=get&id=${captchaId}&json=1`
    );
    const resultData = await resultRes.json();

    if (resultData.status === 1) {
      // GİB captcha'ları lowercase olmalı
      const solution = resultData.request.toLowerCase();
      console.log(`Captcha çözüldü: ${solution}`);
      return solution;
    }
    if (resultData.request !== 'CAPCHA_NOT_READY') {
      console.log('Captcha hatası:', resultData.request);
      return null;
    }
  }
  return null;
}

async function main() {
  // GERÇEK CREDENTIALS
  const userid = '50500087';
  const password = '967522';

  console.log('='.repeat(60));
  console.log('GİB LOGIN TEST - GERÇEK CREDENTIALS');
  console.log('='.repeat(60));

  // Captcha al
  console.log('\n1. Captcha alınıyor...');
  const captchaRes = await fetch(GIB_CAPTCHA_API, { headers: HEADERS });
  const captchaData = await captchaRes.json();
  console.log('Captcha CID:', captchaData.cid);

  // Captcha görselini kaydet (karşılaştırma için)
  const fs = await import('fs');
  const captchaBuffer = Buffer.from(captchaData.captchaImgBase64, 'base64');
  fs.writeFileSync('last-captcha.png', captchaBuffer);
  console.log('Captcha kaydedildi: last-captcha.png');

  // Captcha çöz
  console.log('\n2. Captcha çözülüyor...');
  const solution = await solve2Captcha(captchaData.captchaImgBase64);
  if (!solution) {
    console.log('Captcha çözülemedi!');
    return;
  }

  // Login - önce orijinal çözümü dene, başarısız olursa tire ekle
  console.log('\n3. Login yapılıyor...');

  const tryLogin = async (captchaSolution: string): Promise<any> => {
    const loginPayload = {
      userid,
      sifre: password,
      captcha: captchaSolution,
      cid: captchaData.cid,
    };
    console.log('Denenen captcha:', captchaSolution);

    const res = await fetch(GIB_LOGIN_API, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(loginPayload),
    });

    const text = await res.text();
    return { status: res.status, text, data: JSON.parse(text) };
  };

  // 1. Önce orijinal çözümü dene
  let result = await tryLogin(solution);
  console.log('Orijinal sonuç:', result.status, '-', result.data?.messages?.[0]?.text || 'N/A');

  // 2. Captcha hatası ve tire yoksa, tire ekleyip tekrar dene
  if (result.status === 400 &&
      result.data?.messages?.[0]?.text?.includes('güvenlik kodu') &&
      !solution.includes('-')) {
    console.log('\nTire eklenerek tekrar deneniyor...');
    result = await tryLogin(solution + '-');
    console.log('Tire ile sonuç:', result.status, '-', result.data?.messages?.[0]?.text || 'N/A');
  }

  // Sonucu göster
  console.log('\n' + '='.repeat(40));
  console.log('Final Response Status:', result.status);
  console.log('Final Response Body:', result.text);

  if (result.data?.token) {
    console.log('\n✅ LOGIN BAŞARILI! Token:', result.data.token.substring(0, 50) + '...');
  } else if (result.data?.messages) {
    console.log('\nMessages:');
    result.data.messages.forEach((m: any) => {
      console.log(`  [${m.type}] ${m.code || 'null'}: ${m.text}`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
