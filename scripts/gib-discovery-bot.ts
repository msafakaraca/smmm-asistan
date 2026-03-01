/**
 * GİB Discovery Bot
 *
 * GİB portallarının login mekanizmasını, API endpoint'lerini ve
 * parametrelerini keşfetmek için Puppeteer tabanlı analiz botu.
 *
 * Kullanım: npx tsx scripts/gib-discovery-bot.ts
 */

import puppeteer, { Browser, Page, HTTPRequest, HTTPResponse } from 'puppeteer';

// ═══════════════════════════════════════════════════════════════════════════
// Renkli console output
// ═══════════════════════════════════════════════════════════════════════════
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}[OK]${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  network: (msg: string) => console.log(`${colors.cyan}[NET]${colors.reset} ${msg}`),
  form: (msg: string) => console.log(`${colors.magenta}[FORM]${colors.reset} ${msg}`),
  api: (msg: string) => console.log(`${colors.yellow}[API]${colors.reset} ${msg}`),
};

// ═══════════════════════════════════════════════════════════════════════════
// Keşif sonuçları
// ═══════════════════════════════════════════════════════════════════════════
interface DiscoveryResult {
  portal: string;
  loginUrl: string;
  formAction: string | null;
  formMethod: string | null;
  formFields: FormField[];
  hiddenFields: FormField[];
  captchaInfo: CaptchaInfo | null;
  networkRequests: NetworkRequest[];
  cookies: CookieInfo[];
  jsVariables: Record<string, unknown>;
}

interface FormField {
  name: string;
  id: string;
  type: string;
  value: string;
  placeholder: string;
  required: boolean;
}

interface CaptchaInfo {
  type: string;
  imageUrl: string | null;
  inputName: string | null;
  siteKey: string | null;
}

interface NetworkRequest {
  url: string;
  method: string;
  postData: string | null;
  headers: Record<string, string>;
  responseStatus: number | null;
  responseType: string | null;
}

interface CookieInfo {
  name: string;
  value: string;
  domain: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Ana Discovery Fonksiyonu
// ═══════════════════════════════════════════════════════════════════════════
async function discoverGibPortal(): Promise<void> {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              GİB DISCOVERY BOT                                 ║');
  console.log('║              Portal Analiz ve Keşif                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const portals = [
    { name: 'Dijital Vergi Dairesi', url: 'https://dijital.gib.gov.tr/portal/login' },
    { name: 'E-Beyanname', url: 'https://ebeyanname.gib.gov.tr' },
    { name: 'IVD', url: 'https://ivd.gib.gov.tr' },
    { name: 'INTVRG', url: 'https://intvrg.gib.gov.tr' },
  ];

  let browser: Browser | null = null;

  try {
    log.info('Puppeteer başlatılıyor...');

    browser = await puppeteer.launch({
      headless: false, // Görsel takip için false
      defaultViewport: { width: 1280, height: 800 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    const page = await browser.newPage();

    // Network isteklerini yakala
    const networkRequests: NetworkRequest[] = [];

    await page.setRequestInterception(true);

    page.on('request', (request: HTTPRequest) => {
      const url = request.url();
      const method = request.method();

      // Sadece ilgili istekleri logla
      if (url.includes('gib.gov.tr') && !url.includes('.js') && !url.includes('.css') && !url.includes('.png') && !url.includes('.ico')) {
        log.network(`${method} ${url.substring(0, 80)}...`);

        networkRequests.push({
          url,
          method,
          postData: request.postData() || null,
          headers: request.headers() as Record<string, string>,
          responseStatus: null,
          responseType: null,
        });
      }

      request.continue();
    });

    page.on('response', async (response: HTTPResponse) => {
      const url = response.url();
      const status = response.status();

      // Network request'i güncelle
      const req = networkRequests.find(r => r.url === url);
      if (req) {
        req.responseStatus = status;
        req.responseType = response.headers()['content-type'] || null;
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // DİJİTAL GİB PORTAL ANALİZİ
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(70));
    log.info('DİJİTAL VERGİ DAİRESİ ANALİZ EDİLİYOR...');
    console.log('═'.repeat(70) + '\n');

    await page.goto('https://dijital.gib.gov.tr/portal/login', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Sayfa yüklenmesini bekle
    await page.waitForTimeout(3000);

    // Screenshot al
    await page.screenshot({ path: 'gib-login-screenshot.png', fullPage: true });
    log.success('Screenshot kaydedildi: gib-login-screenshot.png');

    // ═══════════════════════════════════════════════════════════════════════
    // FORM ANALİZİ
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- FORM ANALİZİ ---\n');

    const formAnalysis = await page.evaluate(() => {
      const results: {
        forms: Array<{
          id: string;
          action: string;
          method: string;
          fields: Array<{
            tag: string;
            type: string;
            name: string;
            id: string;
            value: string;
            placeholder: string;
          }>;
        }>;
        allInputs: Array<{
          tag: string;
          type: string;
          name: string;
          id: string;
          value: string;
          placeholder: string;
          className: string;
        }>;
        buttons: Array<{
          type: string;
          text: string;
          id: string;
          className: string;
          onclick: string;
        }>;
        captcha: {
          found: boolean;
          imageUrl: string | null;
          inputId: string | null;
          type: string | null;
        };
      } = {
        forms: [],
        allInputs: [],
        buttons: [],
        captcha: { found: false, imageUrl: null, inputId: null, type: null },
      };

      // Tüm formları bul
      document.querySelectorAll('form').forEach(form => {
        const fields: typeof results.forms[0]['fields'] = [];

        form.querySelectorAll('input, select, textarea').forEach(input => {
          const el = input as HTMLInputElement;
          fields.push({
            tag: el.tagName.toLowerCase(),
            type: el.type || '',
            name: el.name || '',
            id: el.id || '',
            value: el.value || '',
            placeholder: el.placeholder || '',
          });
        });

        results.forms.push({
          id: form.id || '',
          action: form.action || '',
          method: form.method || '',
          fields,
        });
      });

      // Tüm input'ları bul (form dışındakiler dahil)
      document.querySelectorAll('input, select, textarea').forEach(input => {
        const el = input as HTMLInputElement;
        results.allInputs.push({
          tag: el.tagName.toLowerCase(),
          type: el.type || '',
          name: el.name || '',
          id: el.id || '',
          value: el.value || '',
          placeholder: el.placeholder || '',
          className: el.className || '',
        });
      });

      // Tüm butonları bul
      document.querySelectorAll('button, input[type="submit"], input[type="button"]').forEach(btn => {
        const el = btn as HTMLButtonElement;
        results.buttons.push({
          type: el.type || '',
          text: el.textContent?.trim() || '',
          id: el.id || '',
          className: el.className || '',
          onclick: el.getAttribute('onclick') || '',
        });
      });

      // Captcha bul
      const captchaImg = document.querySelector('img[alt*="captcha"], img[src*="captcha"], .captcha img') as HTMLImageElement;
      if (captchaImg) {
        results.captcha.found = true;
        results.captcha.imageUrl = captchaImg.src;
        results.captcha.type = 'image';
      }

      // reCAPTCHA kontrol
      const recaptcha = document.querySelector('.g-recaptcha, [data-sitekey]');
      if (recaptcha) {
        results.captcha.found = true;
        results.captcha.type = 'recaptcha';
      }

      // Captcha input'u bul
      const captchaInput = document.querySelector('input[name*="captcha"], input[id*="captcha"], input[name="dk"]') as HTMLInputElement;
      if (captchaInput) {
        results.captcha.inputId = captchaInput.id || captchaInput.name;
      }

      return results;
    });

    // Sonuçları yazdır
    log.form(`Bulunan form sayısı: ${formAnalysis.forms.length}`);

    formAnalysis.forms.forEach((form, i) => {
      console.log(`\n  Form #${i + 1}:`);
      console.log(`    ID: ${form.id || '(yok)'}`);
      console.log(`    Action: ${form.action || '(yok)'}`);
      console.log(`    Method: ${form.method || '(yok)'}`);
      console.log(`    Fields:`);
      form.fields.forEach(f => {
        console.log(`      - ${f.type || f.tag} | name="${f.name}" | id="${f.id}" | value="${f.value}"`);
      });
    });

    console.log(`\n  Tüm Input'lar (${formAnalysis.allInputs.length}):`);
    formAnalysis.allInputs.forEach(input => {
      log.form(`  ${input.type || input.tag} | name="${input.name}" | id="${input.id}" | class="${input.className.substring(0, 30)}"`);
    });

    console.log(`\n  Butonlar (${formAnalysis.buttons.length}):`);
    formAnalysis.buttons.forEach(btn => {
      log.form(`  ${btn.type} | text="${btn.text}" | id="${btn.id}"`);
    });

    console.log('\n  Captcha:');
    console.log(`    Bulundu: ${formAnalysis.captcha.found}`);
    console.log(`    Tip: ${formAnalysis.captcha.type || '(yok)'}`);
    console.log(`    Görsel URL: ${formAnalysis.captcha.imageUrl || '(yok)'}`);
    console.log(`    Input ID: ${formAnalysis.captcha.inputId || '(yok)'}`);

    // ═══════════════════════════════════════════════════════════════════════
    // JAVASCRIPT DEĞİŞKENLERİ ANALİZİ
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- JAVASCRIPT ANALİZİ ---\n');

    const jsAnalysis = await page.evaluate(() => {
      const vars: Record<string, unknown> = {};

      // Global değişkenleri kontrol et
      const checkVars = ['token', 'csrf', 'csrfToken', '_csrf', 'sessionId', 'captchaId', 'imageId', 'loginUrl', 'apiUrl'];

      checkVars.forEach(v => {
        if ((window as unknown as Record<string, unknown>)[v]) {
          vars[v] = (window as unknown as Record<string, unknown>)[v];
        }
      });

      // Meta tag'leri kontrol et
      document.querySelectorAll('meta').forEach(meta => {
        const name = meta.getAttribute('name') || meta.getAttribute('property');
        if (name && (name.includes('csrf') || name.includes('token'))) {
          vars[`meta_${name}`] = meta.getAttribute('content');
        }
      });

      // Script tag'lerindeki config'leri bul
      document.querySelectorAll('script').forEach(script => {
        const text = script.textContent || '';

        // API URL'leri bul
        const apiMatches = text.match(/['"]https?:\/\/[^'"]*gib\.gov\.tr[^'"]*['"]/g);
        if (apiMatches) {
          vars['apiUrls'] = apiMatches.map(m => m.replace(/['"]/g, ''));
        }

        // Token pattern'leri bul
        const tokenMatches = text.match(/token['":\s]*['"]([^'"]+)['"]/gi);
        if (tokenMatches) {
          vars['tokenPatterns'] = tokenMatches;
        }
      });

      return vars;
    });

    console.log('  Global JS Değişkenleri ve Config:');
    Object.entries(jsAnalysis).forEach(([key, value]) => {
      console.log(`    ${key}: ${JSON.stringify(value)}`);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // NETWORK İSTEKLERİ
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- NETWORK İSTEKLERİ ---\n');

    networkRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url.substring(0, 70)}...`);
      if (req.postData) {
        console.log(`    POST Data: ${req.postData.substring(0, 100)}`);
      }
      if (req.responseStatus) {
        console.log(`    Response: ${req.responseStatus} (${req.responseType})`);
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // COOKIE'LER
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- COOKIE\'LER ---\n');

    const cookies = await page.cookies();
    cookies.forEach(cookie => {
      log.info(`  ${cookie.name}: ${cookie.value.substring(0, 30)}... (${cookie.domain})`);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // LOGIN DENEMESİ - Form Submit'i İzle
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- LOGIN FORM SUBMIT ANALİZİ ---\n');
    log.info('Lütfen manuel olarak login bilgilerini girin ve Giriş butonuna tıklayın...');
    log.info('Bot network isteklerini izleyecek ve login parametrelerini yakalayacak.');
    log.info('30 saniye bekleniyor...\n');

    // Login sonrası network isteklerini izle
    const loginRequests: NetworkRequest[] = [];

    const loginRequestHandler = (request: HTTPRequest) => {
      const url = request.url();
      const method = request.method();

      if (method === 'POST' && url.includes('gib.gov.tr')) {
        log.api(`LOGIN İSTEĞİ YAKALANDI!`);
        console.log(`  URL: ${url}`);
        console.log(`  Method: ${method}`);
        console.log(`  Headers: ${JSON.stringify(request.headers(), null, 2)}`);
        console.log(`  POST Data: ${request.postData()}`);

        loginRequests.push({
          url,
          method,
          postData: request.postData() || null,
          headers: request.headers() as Record<string, string>,
          responseStatus: null,
          responseType: null,
        });
      }
    };

    page.on('request', loginRequestHandler);

    // 30 saniye bekle (kullanıcı manuel giriş yapabilir)
    await page.waitForTimeout(30000);

    // ═══════════════════════════════════════════════════════════════════════
    // SONUÇ RAPORU
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(70));
    console.log('KEŞİF RAPORU');
    console.log('═'.repeat(70) + '\n');

    const report = {
      timestamp: new Date().toISOString(),
      portal: 'dijital.gib.gov.tr',
      forms: formAnalysis.forms,
      inputs: formAnalysis.allInputs,
      buttons: formAnalysis.buttons,
      captcha: formAnalysis.captcha,
      jsVariables: jsAnalysis,
      networkRequests: networkRequests.slice(0, 20),
      loginRequests,
      cookies: cookies.map(c => ({ name: c.name, domain: c.domain })),
    };

    // Raporu dosyaya kaydet
    const fs = await import('fs');
    fs.writeFileSync('gib-discovery-report.json', JSON.stringify(report, null, 2));
    log.success('Rapor kaydedildi: gib-discovery-report.json');

    console.log('\n🔍 ÖNEMLİ BULGULAR:\n');

    if (formAnalysis.forms.length > 0) {
      console.log('📋 Login Form:');
      console.log(`   Action: ${formAnalysis.forms[0].action}`);
      console.log(`   Method: ${formAnalysis.forms[0].method}`);
      console.log(`   Fields: ${formAnalysis.forms[0].fields.map(f => f.name).join(', ')}`);
    }

    if (loginRequests.length > 0) {
      console.log('\n🔐 Login API:');
      console.log(`   URL: ${loginRequests[0].url}`);
      console.log(`   Method: ${loginRequests[0].method}`);
      console.log(`   POST Data: ${loginRequests[0].postData}`);
    }

    // Tarayıcıyı açık bırak (manuel inceleme için)
    log.info('\nTarayıcı açık bırakıldı. Manuel inceleme yapabilirsiniz.');
    log.info('Kapatmak için terminalde Ctrl+C yapın.\n');

    // Sonsuz bekle (Ctrl+C ile kapatılana kadar)
    await new Promise(() => {});

  } catch (error) {
    log.error(`Hata: ${(error as Error).message}`);
    console.error(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ÇALIŞTIR
// ═══════════════════════════════════════════════════════════════════════════
discoverGibPortal().catch(console.error);
