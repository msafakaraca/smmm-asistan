/**
 * GİB Uygulama Launcher (İVD, E-Beyanname, vs.)
 * ==============================================
 * Puppeteer ile headed browser açarak GİB'e giriş yapar
 * ve seçilen uygulamaya otomatik geçiş sağlar.
 */

import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import { screen, BrowserWindow } from 'electron';
import { exec } from 'child_process';
import { getChromiumPath } from './chromium-path';
import { solveCaptchaLocal } from './captcha-local';

// Aktif browser instance - memory leak önleme
let activeBrowser: Browser | null = null;
// Hazır sayfa — gib:prepare ile önceden açılır, gib:launch gelince kullanılır
let preparedPage: Page | null = null;
let prepareInProgress = false;

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Desteklenen GİB uygulamaları
 */
export type GibApplication = 'ivd' | 'interaktifvd' | 'ebeyanname' | 'defter-beyan' | 'ebeyan' | 'edefter';

/**
 * İVD içinde hedef sayfalar
 */
export type IvdTargetPage = 'borc-sorgulama' | 'odemelerim' | 'emanet-defterim' | 'e-tebligat' | 'vergi-levhasi' | null;

/**
 * Vergi levhası dil seçenekleri
 */
export type VergiLevhasiDil = 'tr' | 'en';

/**
 * Vergi levhası yıl seçenekleri
 */
export type VergiLevhasiYil = '2023' | '2024' | '2025' | '2026';

export interface GibLaunchOptions {
  userid: string;
  password: string;
  application: GibApplication;
  targetPage?: IvdTargetPage;  // İVD'ye giriş sonrası hedef sayfa
  customerName?: string;       // Mükellef adı (log için)
  vergiLevhasiYil?: VergiLevhasiYil;  // Vergi levhası yılı
  vergiLevhasiDil?: VergiLevhasiDil;  // Vergi levhası dili
  onProgress: (status: string) => void;
}

export interface GibLaunchResult {
  success: boolean;
  browserOpen?: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const GIB_CONFIG = {
  BASE_URL: 'https://dijital.gib.gov.tr',
  LOGIN_URL: 'https://dijital.gib.gov.tr/portal/login',

  TIMEOUTS: {
    PAGE_LOAD: 30000,
    LOGIN_WAIT: 180000,  // 3 dakika (captcha için)
    APP_REDIRECT: 15000,
  },

  // Hızlı geçişler için minimum bekleme süreleri (ms)
  DELAYS: {
    FORM_READY: 300,
    BETWEEN_INPUTS: 50,
    POPUP_OPEN: 500,
    PAGE_TRANSITION: 800,
  },

  CAPTCHA: {
    MAX_RETRY: 5,
    // Captcha görseli selector'ları (GİB MUI React form)
    IMAGE_SELECTORS: [
      'img[alt*="captcha" i]',
      'img[alt*="Captcha" i]',
      'img[alt*="güvenlik" i]',
      'img[alt*="doğrulama" i]',
      'img.captcha-image',
      'img[src*="captcha"]',
      'img[src^="data:image"]',
      '.captcha img',
      '#captchaImage',
    ],
    // Captcha input selector'ları
    INPUT_SELECTORS: [
      'input#dk',
      'input[name="dk"]',
      'input[id="dk"]',
      'input#captchaInput',
      'input[name="captcha"]',
      'input[name="captchaInput"]',
      'input[placeholder*="güvenlik" i]',
      'input[placeholder*="doğrulama" i]',
      'input[placeholder*="Güvenlik" i]',
      'input[placeholder*="Doğrulama" i]',
      'input[placeholder*="kodu" i]',
      'input[placeholder*="Kod" i]',
    ],
    // Login butonu selector'ları
    BUTTON_SELECTORS: [
      'button[type="submit"]',
      'button.login-button',
      'button.MuiButton-containedPrimary',
      'button.MuiButton-root[type="submit"]',
      'button:has(span:contains("Giriş"))',
      'button span',
    ],
    // Captcha yenile butonu selector'ları
    REFRESH_SELECTORS: [
      'button[aria-label*="yenile" i]',
      'button[aria-label*="refresh" i]',
      'button.captcha-refresh',
      'img[alt*="yenile" i]',
      '.refresh-captcha',
      'svg[data-testid="RefreshIcon"]',
    ],
  },
};

/**
 * Uygulama bazlı konfigürasyon
 * - imgAlt: Uygulama kartındaki img elementinin alt attribute'u
 * - text: Uygulama kartındaki text (fallback)
 * - apiEndpoint: Varsa direkt API ile yönlendirme endpoint'i
 * - displayName: Kullanıcıya gösterilecek isim
 */
const APP_CONFIG: Record<GibApplication, {
  imgAlt: string;
  text: string;
  apiEndpoint: string | null;
  displayName: string;
}> = {
  ivd: {
    imgAlt: 'İnternet Vergi Dairesi',
    text: 'İnternet Vergi Dairesi',
    apiEndpoint: '/apigateway/auth/tdvd/intvrg-login',
    displayName: 'İnternet Vergi Dairesi',
  },
  interaktifvd: {
    imgAlt: 'İnteraktif Vergi Dairesi',
    text: 'İnteraktif Vergi Dairesi',
    apiEndpoint: '/apigateway/auth/tdvd/intvrg-login',
    displayName: 'İnteraktif Vergi Dairesi',
  },
  ebeyanname: {
    imgAlt: 'ebeyanname',
    text: 'e-Beyanname',
    apiEndpoint: '/apigateway/auth/tdvd/ebyn-login',
    displayName: 'E-Beyanname',
  },
  'defter-beyan': {
    imgAlt: 'Defter Beyan Sistemi',
    text: 'Defter Beyan Sistemi',
    apiEndpoint: null,
    displayName: 'Defter Beyan Sistemi',
  },
  'ebeyan': {
    imgAlt: 'yeniebeyanname',
    text: 'e-Beyan',
    apiEndpoint: null,
    displayName: 'e-Beyan Sistemi',
  },
  'edefter': {
    imgAlt: 'edefter',
    text: 'e-Defter',
    apiEndpoint: null,
    displayName: 'e-Defter Sistemi',
  },
};

/**
 * İVD hedef sayfa konfigürasyonu
 */
const IVD_TARGET_PAGES: Record<NonNullable<IvdTargetPage>, {
  path: string;
  displayName: string;
  selector: string;
}> = {
  'borc-sorgulama': {
    path: '/portal/odeme-borc-islemleri',
    displayName: 'Borç Ödeme ve Detay',
    selector: 'a[href="/portal/odeme-borc-islemleri"]',
  },
  'odemelerim': {
    path: '/portal/odemelerim-alindilarim',
    displayName: 'Ödemelerim ve Alındılarım',
    selector: 'a[href="/portal/odemelerim-alindilarim"]',
  },
  'emanet-defterim': {
    path: '/portal/emanet-defterim',
    displayName: 'Emanet Defterim',
    selector: 'a[href="/portal/emanet-defterim"]',
  },
  'e-tebligat': {
    path: '/portal/e-tebligat',
    displayName: 'e-Tebligat',
    selector: 'a[href="/portal/e-tebligat"]',
  },
  'vergi-levhasi': {
    path: '/portal/e-vergi-levhalarim',
    displayName: 'e-Vergi Levhalarım',
    selector: 'a[href="/portal/e-vergi-levhalarim"]',
  },
};

/**
 * Vergi levhası işlemi için selector'lar
 */
const VERGI_LEVHASI_SELECTORS = {
  // Yıl butonları
  YEAR_BUTTON: (year: string) => `button[id="${year}"]`,
  // Tablo
  TABLE_CONTAINER: '.MuiDataGrid-root',
  TABLE_ROWS: '.MuiDataGrid-row',
  ONAY_ZAMANI_CELL: '[data-field="onayZamani"]',
  ISLEM_BUTTON: 'button#basic-button',
  // İşlem menüsü
  MENU_POPUP: '.MuiMenu-paper',
  MENU_TR: 'li[id="0"]',  // Türkçe Vergi Levhası İndir
  MENU_EN: 'li[id="1"]',  // İngilizce Vergi Levhası İndir
  // Boş tablo kontrolü
  NO_DATA: '.MuiDataGrid-overlay',
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Windows API ile Chrome penceresini ön plana getirir
 * keybd_event ile ALT tuşuna basarak Windows Focus Stealing Protection'ı bypass eder
 * @param pid - Puppeteer browser'ın process ID'si (opsiyonel, verilirse sadece o process hedeflenir)
 */
async function bringBrowserWindowToFront(pid?: number): Promise<void> {
  // Sadece Windows'ta çalışır
  if (process.platform !== 'win32') {
    console.log('[GIB-LAUNCHER] ℹ️ bringBrowserWindowToFront sadece Windows\'ta çalışır');
    return;
  }

  // PID verilmişse o process'i hedefle, yoksa en son açılan Chrome'u bul
  const processFilter = pid
    ? `Get-Process -Id ${pid} -ErrorAction SilentlyContinue`
    : `Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Sort-Object StartTime -Descending | Select-Object -First 1`;

  const targetPidValue = pid || 0;

  const psScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WindowHelper {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr lpdwProcessId);
    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    public const byte VK_MENU = 0x12;
    public const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const uint SWP_NOMOVE = 0x0002;
    public const uint SWP_NOSIZE = 0x0001;
    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    public static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
}
"@

` + '$targetPid = ' + targetPidValue + `
` + '$chrome = ' + processFilter + `

if ($chrome) {
    $hwnd = $chrome.MainWindowHandle

    if ($hwnd -ne 0) {
        # ALT tuşuna bas ve bırak - Windows focus stealing protection bypass
        [WindowHelper]::keybd_event([WindowHelper]::VK_MENU, 0, [WindowHelper]::KEYEVENTF_EXTENDEDKEY, [UIntPtr]::Zero)
        [WindowHelper]::keybd_event([WindowHelper]::VK_MENU, 0, [WindowHelper]::KEYEVENTF_EXTENDEDKEY -bor [WindowHelper]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)

        # Thread input'larını birleştir
        $foregroundHwnd = [WindowHelper]::GetForegroundWindow()
        $foregroundThreadId = [WindowHelper]::GetWindowThreadProcessId($foregroundHwnd, [IntPtr]::Zero)
        $currentThreadId = [WindowHelper]::GetCurrentThreadId()
        $targetThreadId = [WindowHelper]::GetWindowThreadProcessId($hwnd, [IntPtr]::Zero)

        [WindowHelper]::AttachThreadInput($currentThreadId, $foregroundThreadId, $true)
        [WindowHelper]::AttachThreadInput($currentThreadId, $targetThreadId, $true)

        # Minimize ise restore et
        if ([WindowHelper]::IsIconic($hwnd)) {
            [WindowHelper]::ShowWindow($hwnd, 9)
            Start-Sleep -Milliseconds 100
        }

        # TOPMOST yap, maximize et, foreground yap
        [WindowHelper]::SetWindowPos($hwnd, [WindowHelper]::HWND_TOPMOST, 0, 0, 0, 0, [WindowHelper]::SWP_NOMOVE -bor [WindowHelper]::SWP_NOSIZE)
        [WindowHelper]::ShowWindow($hwnd, 3)
        [WindowHelper]::SetForegroundWindow($hwnd)
        [WindowHelper]::BringWindowToTop($hwnd)
        [WindowHelper]::SetWindowPos($hwnd, [WindowHelper]::HWND_NOTOPMOST, 0, 0, 0, 0, [WindowHelper]::SWP_NOMOVE -bor [WindowHelper]::SWP_NOSIZE)

        # Thread input'larını ayır
        [WindowHelper]::AttachThreadInput($currentThreadId, $foregroundThreadId, $false)
        [WindowHelper]::AttachThreadInput($currentThreadId, $targetThreadId, $false)

        Write-Host "Chrome penceresi on plana getirildi (PID: $($chrome.Id))"
    }
}
`;

  return new Promise((resolve) => {
    exec(`powershell -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"').replace(/\$/g, '`$')}"`, (error) => {
      if (error) {
        console.warn('[GIB-LAUNCHER] PowerShell bringToFront hatası:', error.message);
      } else {
        console.log(`[GIB-LAUNCHER] ✅ Chrome penceresi ön plana getirildi (PID: ${pid || 'auto'})`);
      }
      resolve();
    });
  });
}

/**
 * Önceki browser instance'ı temizle
 */
async function cleanupPreviousBrowser(): Promise<void> {
  if (activeBrowser) {
    try {
      if (activeBrowser.connected) {
        console.log('[GIB-LAUNCHER] Önceki tarayıcı kapatılıyor...');
        await activeBrowser.close();
      }
    } catch {
      console.log('[GIB-LAUNCHER] Önceki tarayıcı zaten kapalı');
    }
    activeBrowser = null;
    preparedPage = null;
  }
}

/**
 * ⚡ Puppeteer'ı önceden başlat ve login sayfasını yükle.
 * gib:prepare sinyali ile çağrılır — credentials gelmeden tarayıcı hazır olur.
 */
export async function prepareGibBrowser(
  onProgress: (status: string) => void,
): Promise<void> {
  // Zaten hazırlık yapılıyorsa veya hazır sayfa varsa atla
  if (prepareInProgress) {
    console.log('[GIB-LAUNCHER] ⚡ Hazırlık zaten devam ediyor, atlanıyor');
    return;
  }
  if (preparedPage && activeBrowser?.connected) {
    console.log('[GIB-LAUNCHER] ⚡ Tarayıcı zaten hazır');
    return;
  }

  prepareInProgress = true;
  const t0 = Date.now();

  try {
    await cleanupPreviousBrowser();

    onProgress('⚡ Tarayıcı başlatılıyor...');

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const chromiumPath = getChromiumPath();

    // Electron penceresi minimize
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow && mainWindow.isVisible() && !mainWindow.isMinimized()) {
      mainWindow.minimize();
    }

    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      executablePath: chromiumPath,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--start-maximized',
        '--window-position=0,0',
        `--window-size=${width},${height}`,
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=CalculateNativeWinOcclusion',
        '--no-first-run',
        '--disable-hang-monitor',
        '--force-device-scale-factor=1',
        '--new-window',
        '--disable-session-crashed-bubble',
        '--disable-infobars',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
      ],
    });

    activeBrowser = browser;

    browser.on('disconnected', () => {
      if (activeBrowser === browser) {
        activeBrowser = null;
        preparedPage = null;
      }
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    // CDP maximize
    try {
      const session = await page.target().createCDPSession();
      const { windowId } = await session.send('Browser.getWindowForTarget');
      await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
      await new Promise(r => setTimeout(r, 100));
      await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'maximized' } });
      await session.detach();
    } catch { /* ignore */ }

    const browserPid = browser.process()?.pid;
    await page.bringToFront();
    await bringBrowserWindowToFront(browserPid);

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // Login sayfasını yükle — credentials geldiğinde form hazır olacak
    onProgress('⚡ GİB giriş sayfası yükleniyor...');
    await page.goto(GIB_CONFIG.LOGIN_URL, {
      waitUntil: 'domcontentloaded',
      timeout: GIB_CONFIG.TIMEOUTS.PAGE_LOAD,
    });

    preparedPage = page;
    console.log(`[GIB-LAUNCHER] ⚡ Tarayıcı hazır! (${Date.now() - t0}ms)`);
    onProgress('⚡ Tarayıcı hazır, giriş bilgileri bekleniyor...');

  } catch (e) {
    console.error('[GIB-LAUNCHER] ⚡ Prepare hatası:', e);
  } finally {
    prepareInProgress = false;
  }
}

/**
 * Input alanına React-uyumlu şekilde ANINDA değer gir (Luca yöntemi)
 * Native value setter + React event dispatch ile çalışır
 */
async function fillInput(page: Page, selectors: string[], value: string, fieldName: string): Promise<boolean> {
  for (const selector of selectors) {
    try {
      // Elementi bekle (çok hızlı - element zaten yüklenmiş olmalı)
      await page.waitForSelector(selector, { timeout: 1000, visible: true });

      // React Native Value Setter ile anında değer gir
      const success = await page.evaluate((sel: string, val: string) => {
        const input = document.querySelector(sel) as HTMLInputElement;
        if (!input) return false;

        // Native value setter al (React controlled input bypass)
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;

        if (nativeInputValueSetter) {
          // Değeri anında set et
          nativeInputValueSetter.call(input, val);

          // React'e input event gönder (state güncellemesi için)
          const inputEvent = new Event('input', { bubbles: true });
          input.dispatchEvent(inputEvent);

          // Change event de gönder (form validation için)
          const changeEvent = new Event('change', { bubbles: true });
          input.dispatchEvent(changeEvent);

          return true;
        }
        return false;
      }, selector, value);

      if (success) {
        console.log(`[GIB-LAUNCHER] ✅ ${fieldName} girildi (${selector})`);
        return true;
      }
    } catch {
      // Bu selector çalışmadı, sonrakini dene
    }
  }

  console.warn(`[GIB-LAUNCHER] ⚠️ ${fieldName} input bulunamadı!`);
  return false;
}

/**
 * Sayfadaki captcha görselini base64 olarak al.
 * img src data:image veya canvas ile çıkarım yapar.
 */
async function extractCaptchaImage(page: Page): Promise<string | null> {
  const selectors = GIB_CONFIG.CAPTCHA.IMAGE_SELECTORS;

  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (!el) continue;

      // img elementinin src'sini al
      const src = await page.evaluate(
        (imgEl) => {
          if (!imgEl || imgEl.tagName !== 'IMG') return null;
          const img = imgEl as HTMLImageElement;
          // data:image base64 ise direkt döndür
          if (img.src?.startsWith('data:image')) {
            return img.src;
          }
          // Blob URL veya normal URL ise canvas ile çıkar
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            if (canvas.width === 0 || canvas.height === 0) return null;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            ctx.drawImage(img, 0, 0);
            return canvas.toDataURL('image/png');
          } catch {
            return null;
          }
        },
        el,
      );

      if (src && src.length > 100) {
        console.log(`[GIB-LAUNCHER] Captcha görseli bulundu (${selector})`);
        return src;
      }
    } catch {
      // Sonraki selector'ı dene
    }
  }

  return null;
}

/**
 * Captcha yenile butonuna tıkla
 */
async function refreshCaptcha(page: Page): Promise<boolean> {
  const selectors = GIB_CONFIG.CAPTCHA.REFRESH_SELECTORS;

  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (!el) continue;

      // Tıklama öncesi parent button'u bul (SVG icon olabilir)
      const clicked = await page.evaluate((s: string) => {
        const element = document.querySelector(s);
        if (!element) return false;
        // Element veya en yakın button parent'ına tıkla
        const btn = element.closest('button') || element.closest('[role="button"]') || element;
        (btn as HTMLElement).click();
        return true;
      }, selector);

      if (clicked) {
        console.log(`[GIB-LAUNCHER] Captcha yenilendi (${selector})`);
        await new Promise(r => setTimeout(r, 1000)); // Yeni captcha yüklenmesini bekle
        return true;
      }
    } catch {
      // Sonraki selector'ı dene
    }
  }

  return false;
}

/**
 * Login butonuna tıkla
 */
async function clickLoginButton(page: Page): Promise<boolean> {
  const selectors = GIB_CONFIG.CAPTCHA.BUTTON_SELECTORS;

  // Önce normal selector'ları dene
  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (!el) continue;

      await el.click();
      console.log(`[GIB-LAUNCHER] Login butonuna tıklandı (${selector})`);
      return true;
    } catch {
      // Sonraki selector'ı dene
    }
  }

  // Fallback: "Giriş" veya "GİRİŞ" metnini içeren butonu bul
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (text.includes('giriş') || text.includes('giris') || text === 'gir') {
        btn.click();
        return true;
      }
    }
    // Span içinde "Giriş" yazısı olan butonları da kontrol et
    const spans = Array.from(document.querySelectorAll('button span'));
    for (const span of spans) {
      const text = (span.textContent || '').trim().toLowerCase();
      if (text.includes('giriş') || text.includes('giris')) {
        const btn = span.closest('button');
        if (btn) {
          (btn as HTMLElement).click();
          return true;
        }
      }
    }
    return false;
  });

  if (clicked) {
    console.log('[GIB-LAUNCHER] Login butonuna tıklandı (text fallback)');
    return true;
  }

  console.warn('[GIB-LAUNCHER] ⚠️ Login butonu bulunamadı!');
  return false;
}

/**
 * Login sonrası sonuç kontrolü.
 * URL değişimini dinler — sabit bekleme yok.
 * URL değiştiyse başarılı, değişmediyse hata mesajını okur.
 */
async function checkLoginError(page: Page): Promise<{ hasError: boolean; isCaptchaError: boolean; message: string }> {
  // URL değişimini bekle (max 3s) — sabit sleep yok
  try {
    await page.waitForFunction(
      () => {
        const url = window.location.pathname;
        return !url.includes('/login') && !url.includes('/portal/login');
      },
      { timeout: 3000 }
    );
    // URL değişti → başarılı giriş
    return { hasError: false, isCaptchaError: false, message: '' };
  } catch {
    // URL değişmedi → hata var, sayfadaki mesajı oku
  }

  const errorInfo = await page.evaluate(() => {
    const errorSelectors = [
      '.MuiAlert-message', '.MuiAlert-root', '.MuiSnackbar-root',
      '.error-message', '.login-error', '[role="alert"]',
      '.MuiFormHelperText-root.Mui-error', '.MuiTypography-colorError',
    ];
    for (const sel of errorSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = (el.textContent || '').trim();
        if (text.length > 0) return text;
      }
    }
    return '';
  });

  if (!errorInfo) {
    return { hasError: false, isCaptchaError: false, message: '' };
  }

  const lower = errorInfo.toLowerCase();
  const isCaptchaError = lower.includes('captcha') || lower.includes('güvenlik kodu') ||
    lower.includes('guvenlik kodu') || lower.includes('doğrulama kodu') ||
    lower.includes('dogrulama kodu') || lower.includes('hatalı kod') || lower.includes('hatali kod');

  return { hasError: true, isCaptchaError, message: errorInfo };
}

/**
 * Sayfadaki captcha'yı otomatik çöz ve giriş yap.
 * ddddocr lokal ONNX model kullanır (~10ms).
 * Başarısız olursa yeni captcha ister ve tekrar dener (max MAX_RETRY).
 */
async function solveCaptchaAndLogin(
  page: Page,
  onProgress: (status: string) => void,
): Promise<{ success: boolean; error?: string }> {
  const maxRetry = GIB_CONFIG.CAPTCHA.MAX_RETRY;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    onProgress(`Doğrulama kodu çözülüyor (${attempt}/${maxRetry})...`);

    // 1. Captcha görselini sayfadan çek
    const captchaBase64 = await extractCaptchaImage(page);
    if (!captchaBase64) {
      console.log(`[GIB-LAUNCHER] Captcha görseli bulunamadı (deneme ${attempt})`);
      if (attempt < maxRetry) {
        // Captcha görseli henüz yüklenmemiş olabilir, bekle
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      return { success: false, error: 'Captcha görseli sayfada bulunamadı' };
    }

    // 2. ddddocr ile çöz
    const cleanBase64 = captchaBase64.replace(/^data:image\/\w+;base64,/, '');
    const solution = await solveCaptchaLocal(cleanBase64);

    if (!solution) {
      console.log(`[GIB-LAUNCHER] Captcha çözülemedi (deneme ${attempt})`);
      if (attempt < maxRetry) {
        await refreshCaptcha(page);
        continue;
      }
      return { success: false, error: 'Captcha çözülemedi' };
    }

    console.log(`[GIB-LAUNCHER] Captcha çözüldü: ${solution} (deneme ${attempt})`);
    onProgress(`Doğrulama kodu girildi: ${solution}`);

    // 3. Captcha input'una yaz
    const captchaFilled = await fillInput(
      page,
      GIB_CONFIG.CAPTCHA.INPUT_SELECTORS,
      solution,
      'Doğrulama kodu',
    );

    if (!captchaFilled) {
      console.log(`[GIB-LAUNCHER] Captcha input bulunamadı (deneme ${attempt})`);
      if (attempt < maxRetry) {
        await new Promise(r => setTimeout(r, 300));
        continue;
      }
      return { success: false, error: 'Doğrulama kodu alanı bulunamadı' };
    }

    // 4. Login butonuna tıkla
    await new Promise(r => setTimeout(r, 100)); // React state güncellemesini bekle
    const loginClicked = await clickLoginButton(page);

    if (!loginClicked) {
      return { success: false, error: 'Giriş butonu bulunamadı' };
    }

    // 5. Login sonucu kontrol et
    const errorCheck = await checkLoginError(page);

    if (!errorCheck.hasError) {
      // Başarılı giriş!
      onProgress('✅ Giriş başarılı!');
      return { success: true };
    }

    if (errorCheck.isCaptchaError) {
      console.log(`[GIB-LAUNCHER] Captcha hatası: ${errorCheck.message} (deneme ${attempt})`);
      onProgress(`Doğrulama kodu hatalı, yeniden deneniyor (${attempt}/${maxRetry})...`);
      if (attempt < maxRetry) {
        // Captcha'yı yenile ve tekrar dene
        await refreshCaptcha(page);
        continue;
      }
    } else {
      // Captcha dışı hata (yanlış şifre, vb.)
      console.log(`[GIB-LAUNCHER] Giriş hatası: ${errorCheck.message}`);
      return { success: false, error: errorCheck.message };
    }
  }

  return { success: false, error: `${maxRetry} denemede captcha çözülemedi` };
}

/**
 * Uygulama kartına tıklayarak geçiş yap
 */
async function clickAppCard(page: Page, appConfig: typeof APP_CONFIG[GibApplication]): Promise<boolean> {
  const { imgAlt, text } = appConfig;

  const clicked = await page.evaluate((alt: string, txt: string) => {
    // Yöntem 1: img alt attribute ile bul
    const img = document.querySelector(`img[alt="${alt}"]`);
    if (img) {
      const boxComponent = img.closest('[data-testid="box-component"]') || img.parentElement?.parentElement;
      if (boxComponent) {
        (boxComponent as HTMLElement).click();
        return 'img-alt';
      }
    }

    // Yöntem 2: Text ile bul
    const paragraphs = Array.from(document.querySelectorAll('p'));
    for (const p of paragraphs) {
      if (p.textContent?.trim() === txt) {
        const boxComponent = p.closest('[data-testid="box-component"]') || p.parentElement;
        if (boxComponent) {
          (boxComponent as HTMLElement).click();
          return 'text';
        }
      }
    }

    return null;
  }, imgAlt, text);

  if (clicked) {
    console.log(`[GIB-LAUNCHER] ✅ Uygulama kartı tıklandı (${clicked})`);
    return true;
  }

  console.log('[GIB-LAUNCHER] ⚠️ Uygulama kartı bulunamadı');
  return false;
}

/**
 * ONAYLA butonuna tıkla
 */
async function clickConfirmButton(page: Page): Promise<boolean> {
  const clicked = await page.evaluate(() => {
    // Yöntem 1: title="ONAYLA" ile bul
    const btnByTitle = document.querySelector('button[title="ONAYLA"]');
    if (btnByTitle) {
      (btnByTitle as HTMLElement).click();
      return 'title';
    }

    // Yöntem 2: label="ONAYLA" ile bul
    const btnByLabel = document.querySelector('button[label="ONAYLA"]');
    if (btnByLabel) {
      (btnByLabel as HTMLElement).click();
      return 'label';
    }

    // Yöntem 3: Text içeriği ile bul
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const btn of buttons) {
      if (btn.textContent?.trim().toUpperCase() === 'ONAYLA') {
        (btn as HTMLElement).click();
        return 'text';
      }
    }

    // Yöntem 4: MUI primary contained button
    const primaryBtn = document.querySelector('button.MuiButton-containedPrimary[type="submit"]');
    if (primaryBtn) {
      (primaryBtn as HTMLElement).click();
      return 'mui-primary';
    }

    return null;
  });

  if (clicked) {
    console.log(`[GIB-LAUNCHER] ✅ ONAYLA butonu tıklandı (${clicked})`);
    return true;
  }

  console.log('[GIB-LAUNCHER] ⚠️ ONAYLA butonu bulunamadı');
  return false;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Vergi levhası indirme işlemi
 */
async function handleVergiLevhasi(
  page: Page,
  yil: VergiLevhasiYil,
  dil: VergiLevhasiDil,
  _customerName: string | undefined,
  _onProgress: (status: string) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. e-Vergi Levhalarım sayfasına git
    const targetUrl = GIB_CONFIG.BASE_URL + '/portal/e-vergi-levhalarim';
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: GIB_CONFIG.TIMEOUTS.APP_REDIRECT,
    });

    await new Promise(r => setTimeout(r, GIB_CONFIG.DELAYS.PAGE_TRANSITION));

    // 2. Seçilen yıl butonuna tıkla
    const yearButtonSelector = VERGI_LEVHASI_SELECTORS.YEAR_BUTTON(yil);
    try {
      await page.waitForSelector(yearButtonSelector, { timeout: 5000, visible: true });
      await page.click(yearButtonSelector);
      console.log(`[GIB-LAUNCHER] ✅ ${yil} yılı seçildi`);
    } catch {
      // Yıl butonu bulunamadı, varsayılan yıl kullanılabilir
      console.log(`[GIB-LAUNCHER] ⚠️ ${yil} yıl butonu bulunamadı, sayfada varsayılan yıl kullanılıyor`);
    }

    await new Promise(r => setTimeout(r, GIB_CONFIG.DELAYS.PAGE_TRANSITION));

    // 3. Tablonun yüklenmesini bekle
    try {
      await page.waitForSelector(VERGI_LEVHASI_SELECTORS.TABLE_CONTAINER, { timeout: 10000 });
    } catch {
      // Tablo bulunamadı
      console.log(`[GIB-LAUNCHER] ⚠️ ${yil} yılı için vergi levhası bulunamadı`);
      return { success: false, error: 'Vergi levhası bulunamadı' };
    }

    // 4. Boş tablo kontrolü
    const isEmpty = await page.evaluate((noDataSelector: string) => {
      const overlay = document.querySelector(noDataSelector);
      return overlay && overlay.textContent?.includes('Kayıt bulunamadı');
    }, VERGI_LEVHASI_SELECTORS.NO_DATA);

    if (isEmpty) {
      console.log(`[GIB-LAUNCHER] ⚠️ ${yil} yılı için vergi levhası bulunamadı`);
      return { success: false, error: 'Vergi levhası bulunamadı' };
    }

    // 5. Tablodaki satırları bul ve en son tarihli olanı seç
    const rowData = await page.evaluate((selectors: typeof VERGI_LEVHASI_SELECTORS) => {
      const rows = document.querySelectorAll(selectors.TABLE_ROWS);
      if (rows.length === 0) return null;

      // Birden fazla satır varsa, onay zamanına göre en son olanı bul
      let latestRow: Element | null = null;
      let latestDate: Date | null = null;

      rows.forEach((row) => {
        const onayCell = row.querySelector('[data-field="onayZamani"]');
        if (onayCell) {
          const dateText = onayCell.textContent?.trim();
          if (dateText) {
            // Tarih formatı: "DD.MM.YYYY HH:mm:ss" veya benzeri
            const parts = dateText.split(/[\s.:/]+/);
            if (parts.length >= 3) {
              const date = new Date(
                parseInt(parts[2]), // yıl
                parseInt(parts[1]) - 1, // ay (0-indexed)
                parseInt(parts[0]), // gün
                parseInt(parts[3] || '0'),
                parseInt(parts[4] || '0')
              );
              if (!latestDate || date > latestDate) {
                latestDate = date;
                latestRow = row;
              }
            }
          }
        }
      });

      // En son tarihli satır yoksa ilk satırı al
      if (!latestRow) {
        latestRow = rows[0];
      }

      // Satır index'ini bul
      const rowIndex = Array.from(rows).indexOf(latestRow);
      return { rowIndex, totalRows: rows.length };
    }, VERGI_LEVHASI_SELECTORS);

    if (!rowData) {
      console.log('[GIB-LAUNCHER] ⚠️ Vergi levhası satırı bulunamadı');
      return { success: false, error: 'Vergi levhası satırı bulunamadı' };
    }

    console.log(`[GIB-LAUNCHER] ✅ ${rowData.totalRows} vergi levhası bulundu, ${rowData.rowIndex + 1}. satır seçildi`);

    // 6. İŞLEM butonuna tıkla
    const islemButtonClicked = await page.evaluate((selectors: typeof VERGI_LEVHASI_SELECTORS, rowIndex: number) => {
      const rows = document.querySelectorAll(selectors.TABLE_ROWS);
      if (rows.length === 0) return false;

      const targetRow = rows[rowIndex] || rows[0];
      const islemButton = targetRow.querySelector(selectors.ISLEM_BUTTON);

      if (islemButton) {
        (islemButton as HTMLElement).click();
        return true;
      }

      // Alternatif: Satırdaki herhangi bir butonu bul
      const anyButton = targetRow.querySelector('button');
      if (anyButton) {
        (anyButton as HTMLElement).click();
        return true;
      }

      return false;
    }, VERGI_LEVHASI_SELECTORS, rowData.rowIndex);

    if (!islemButtonClicked) {
      console.log('[GIB-LAUNCHER] ⚠️ İşlem butonu bulunamadı');
      return { success: false, error: 'İşlem butonu bulunamadı' };
    }

    console.log('[GIB-LAUNCHER] ✅ İŞLEM butonu tıklandı');

    // 7. Menünün açılmasını bekle
    await new Promise(r => setTimeout(r, GIB_CONFIG.DELAYS.POPUP_OPEN));

    // 8. Dil seçimine göre indirme linkine tıkla
    const menuItemSelector = dil === 'tr'
      ? VERGI_LEVHASI_SELECTORS.MENU_TR
      : VERGI_LEVHASI_SELECTORS.MENU_EN;

    const dilAdi = dil === 'tr' ? 'Türkçe' : 'İngilizce';

    const menuItemClicked = await page.evaluate((selector: string, dilAdi: string) => {
      // Yöntem 1: ID ile bul
      const menuItem = document.querySelector(selector);
      if (menuItem) {
        (menuItem as HTMLElement).click();
        return 'id';
      }

      // Yöntem 2: Text ile bul
      const menuItems = Array.from(document.querySelectorAll('.MuiMenuItem-root, li[role="menuitem"]'));
      for (const item of menuItems) {
        const text = item.textContent?.toLowerCase() || '';
        if (text.includes(dilAdi.toLowerCase()) && text.includes('vergi levhası')) {
          (item as HTMLElement).click();
          return 'text';
        }
      }

      return null;
    }, menuItemSelector, dilAdi);

    if (menuItemClicked) {
      console.log(`[GIB-LAUNCHER] ✅ ${dilAdi} Vergi Levhası İndir tıklandı (${menuItemClicked})`);
      return { success: true };
    } else {
      console.log(`[GIB-LAUNCHER] ⚠️ ${dilAdi} indirme seçeneği bulunamadı`);
      return { success: false, error: 'İndirme seçeneği bulunamadı' };
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('[GIB-LAUNCHER] Vergi levhası hatası:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * GİB login akışı — form doldur + captcha çöz + giriş yap.
 * Tarayıcıdaki login sayfasında otomatik giriş yapar.
 */
async function performGibLogin(
  page: Page,
  userid: string,
  password: string,
  onProgress: (status: string) => void,
  skipPageLoad = false,
): Promise<{ success: boolean; error?: string }> {
  if (!skipPageLoad) {
    onProgress('GİB giriş sayfası yükleniyor...');
    await page.goto(GIB_CONFIG.LOGIN_URL, {
      waitUntil: 'domcontentloaded',
      timeout: GIB_CONFIG.TIMEOUTS.PAGE_LOAD,
    });
  }

  // Form yüklenmesini bekle
  try {
    await page.waitForSelector('input#userid', { timeout: 5000, visible: true });
  } catch {
    await new Promise(r => setTimeout(r, GIB_CONFIG.DELAYS.FORM_READY));
  }

  onProgress('Giriş bilgileri dolduruluyor...');

  const useridSelectors = [
    'input#userid', 'input[id="userid"]', 'input[name="userid"]',
    '.MuiInputBase-input[name="userid"]', '.MuiOutlinedInput-input[name="userid"]',
    'input[placeholder*="T.C. Kimlik"]', 'input[placeholder*="Vergi Kimlik"]',
    'input[placeholder*="Kullanıcı Kodu"]', 'input[formcontrolname="userid"]', '#mat-input-0',
  ];

  const passwordSelectors = [
    'input#sifre', 'input[id="sifre"]', 'input[name="sifre"]',
    'input[type="password"][name="sifre"]', 'input[type="password"][id="sifre"]',
    '.MuiInputBase-input[name="sifre"]', '.MuiOutlinedInput-input[type="password"]',
    'input[placeholder*="Şifrenizi yazınız"]', 'input[placeholder*="şifre"]',
    'input[formcontrolname="sifre"]', 'input[type="password"]',
  ];

  // Kullanıcı adı ve şifre paralel doldur
  const [useridFilled, passwordFilled] = await Promise.all([
    fillInput(page, useridSelectors, userid, 'Kullanıcı adı'),
    fillInput(page, passwordSelectors, password, 'Şifre'),
  ]);

  if (!useridFilled || !passwordFilled) {
    onProgress('⚠️ Form alanları bulunamadı. Lütfen manuel olarak doldurun.');
    return { success: false, error: 'Form alanları bulunamadı' };
  }

  onProgress('✅ Bilgiler girildi! Doğrulama kodu çözülüyor...');

  // Captcha görselinin render edilmesini bekle (minimal)
  await new Promise(r => setTimeout(r, 200));

  // Otomatik captcha çözümü + login
  const captchaResult = await solveCaptchaAndLogin(page, onProgress);

  if (!captchaResult.success) {
    onProgress(`⚠️ Otomatik giriş başarısız: ${captchaResult.error || 'Bilinmeyen hata'}. Manuel giriş bekleniyor...`);

    // Manuel giriş bekle (3 dakika)
    try {
      await page.waitForFunction(
        () => {
          const url = window.location.pathname;
          return !url.includes('/login') && !url.includes('/portal/login');
        },
        { timeout: GIB_CONFIG.TIMEOUTS.LOGIN_WAIT }
      );
    } catch {
      return { success: false, error: 'Giriş süresi doldu' };
    }
  }

  return { success: true };
}

/**
 * GİB uygulamasını başlatan ana fonksiyon.
 * prepareGibBrowser ile önceden hazırlanmış tarayıcı varsa kullanır.
 */
export async function launchGibApplication(options: GibLaunchOptions): Promise<GibLaunchResult> {
  const { userid, password, application, targetPage, customerName, vergiLevhasiYil, vergiLevhasiDil, onProgress } = options;

  const appConfig = APP_CONFIG[application];
  if (!appConfig) {
    return { success: false, browserOpen: false, error: `Bilinmeyen uygulama: ${application}` };
  }

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    const t0 = Date.now();

    // ⚡ Hazır tarayıcı varsa kullan (gib:prepare ile önceden açılmış)
    if (preparedPage && activeBrowser?.connected) {
      browser = activeBrowser;
      page = preparedPage;
      preparedPage = null; // Tüketildi
      console.log(`[GIB-LAUNCHER] ⚡ Hazır tarayıcı kullanıldı! (${Date.now() - t0}ms)`);

      // Hazır sayfa zaten login sayfasında — direkt form doldur
      onProgress('⚡ Giriş bilgileri dolduruluyor...');
      const loginResult = await performGibLogin(page, userid, password, onProgress, true);
      if (!loginResult.success) {
        return { success: false, browserOpen: true, error: loginResult.error };
      }
      console.log(`[GIB-LAUNCHER] ⚡ Hazır tarayıcı + login tamamlandı (${Date.now() - t0}ms)`);

    } else {
      // Hazırlık yapılmadı veya prepare henüz bitmedi — bekle veya normal başlat

      // Prepare devam ediyorsa kısa bekle (max 3s)
      if (prepareInProgress) {
        console.log('[GIB-LAUNCHER] ⏳ Prepare devam ediyor, bekleniyor...');
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 100));
          if (preparedPage && activeBrowser?.connected) {
            browser = activeBrowser;
            page = preparedPage;
            preparedPage = null;
            console.log(`[GIB-LAUNCHER] ⚡ Prepare tamamlandı, hazır tarayıcı kullanılıyor (${Date.now() - t0}ms)`);
            break;
          }
        }
      }

      if (page) {
        // Prepare bekleme sonucu hazır sayfa geldi
        onProgress('⚡ Giriş bilgileri dolduruluyor...');
        const loginResult = await performGibLogin(page, userid, password, onProgress, true);
        if (!loginResult.success) {
          return { success: false, browserOpen: true, error: loginResult.error };
        }
        console.log(`[GIB-LAUNCHER] ⚡ Beklenen prepare + login tamamlandı (${Date.now() - t0}ms)`);
      } else {
        // Normal soğuk başlangıç
        await cleanupPreviousBrowser();
        onProgress('Tarayıcı başlatılıyor...');

        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        const chromiumPath = getChromiumPath();

        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow && mainWindow.isVisible() && !mainWindow.isMinimized()) {
          mainWindow.minimize();
        }

        browser = await puppeteer.launch({
          headless: false,
          defaultViewport: null,
          executablePath: chromiumPath,
          ignoreDefaultArgs: ['--enable-automation'],
          args: [
            '--start-maximized', '--window-position=0,0', `--window-size=${width},${height}`,
            '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
            '--disable-features=CalculateNativeWinOcclusion', '--no-first-run',
            '--disable-hang-monitor', '--force-device-scale-factor=1', '--new-window',
            '--disable-session-crashed-bubble', '--disable-infobars',
            '--disable-extensions', '--disable-component-extensions-with-background-pages',
          ],
        });

        const browserPid = browser.process()?.pid;
        console.log(`[GIB-LAUNCHER] Chromium başlatıldı (${Date.now() - t0}ms), PID: ${browserPid}`);

        activeBrowser = browser;
        browser.on('disconnected', () => {
          if (activeBrowser === browser) { activeBrowser = null; preparedPage = null; }
        });

        const pages = await browser.pages();
        page = pages[0] || await browser.newPage();

        try {
          const session = await page.target().createCDPSession();
          const { windowId } = await session.send('Browser.getWindowForTarget');
          await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
          await new Promise(r => setTimeout(r, 100));
          await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'maximized' } });
          await session.detach();
        } catch { /* ignore */ }

        await page.bringToFront();
        await bringBrowserWindowToFront(browserPid);

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        const loginResult = await performGibLogin(page, userid, password, onProgress);
        if (!loginResult.success) {
          return { success: false, browserOpen: true, error: loginResult.error };
        }
        console.log(`[GIB-LAUNCHER] ✅ Soğuk başlangıç + login tamamlandı (${Date.now() - t0}ms)`);
      }
    }

    // Hedef sayfa varsa (borç sorgulama, vergi levhası, vb.) doğrudan oraya git
    // İVD'yi ayrıca açmaya gerek yok - GİB oturumu açık
    if (targetPage && IVD_TARGET_PAGES[targetPage]) {
      const targetConfig = IVD_TARGET_PAGES[targetPage];
      const customerInfo = customerName ? ` (${customerName})` : '';

      // Vergi levhası için özel işlem
      if (targetPage === 'vergi-levhasi') {
        const yil = vergiLevhasiYil || '2025';
        const dil = vergiLevhasiDil || 'tr';

        const vergiLevhasiResult = await handleVergiLevhasi(page, yil, dil, customerName, onProgress);

        // Vergi levhası işlemi sonucu ne olursa olsun browser açık kalacak
        return { success: vergiLevhasiResult.success, browserOpen: true, error: vergiLevhasiResult.error };
      }

      // Diğer hedef sayfalar için normal akış
      onProgress(`${targetConfig.displayName} sayfasına gidiliyor${customerInfo}...`);

      try {
        // Doğrudan hedef sayfaya git (İVD dashboard'u atla)
        const targetUrl = GIB_CONFIG.BASE_URL + targetConfig.path;
        await page.goto(targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: GIB_CONFIG.TIMEOUTS.APP_REDIRECT,
        });

        await new Promise(r => setTimeout(r, GIB_CONFIG.DELAYS.PAGE_TRANSITION));
        onProgress(`🎉 ${targetConfig.displayName} açıldı${customerInfo}! Tarayıcı sizin kontrolünüzde.`);
      } catch (targetError) {
        console.error('[GIB-LAUNCHER] Hedef sayfa hatası:', targetError);
        onProgress(`⚠️ ${targetConfig.displayName} açılamadı. Dashboard'dan manuel geçiş yapabilirsiniz.`);
      }
    } else {
      // Hedef sayfa yoksa API ile redirect URL al ve yeni sekmede aç
      onProgress(`✅ Giriş başarılı! ${appConfig.displayName}'ye yönlendiriliyor...`);

      try {
        let appOpened = false;

        // API ile yönlendirme — Bearer token dahil
        if (appConfig.apiEndpoint) {
          const apiResult = await page.evaluate(async (apiUrl: string) => {
            try {
              // Token'ı localStorage/sessionStorage'dan al
              const token = localStorage.getItem('token') ||
                            localStorage.getItem('accessToken') ||
                            sessionStorage.getItem('token') ||
                            sessionStorage.getItem('accessToken') || '';

              const headers: Record<string, string> = {
                'Accept': 'application/json, text/plain, */*',
              };
              if (token) {
                headers['Authorization'] = `Bearer ${token}`;
              }

              const response = await fetch(apiUrl, {
                method: 'GET',
                credentials: 'include',
                headers,
              });

              if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}`, token: !!token };
              }

              const data = await response.json();
              return data.redirectUrl
                ? { success: true, redirectUrl: data.redirectUrl, token: !!token }
                : { success: false, error: 'redirectUrl yok', token: !!token };
            } catch (e: unknown) {
              return { success: false, error: e instanceof Error ? e.message : 'Hata', token: false };
            }
          }, GIB_CONFIG.BASE_URL + appConfig.apiEndpoint);

          console.log(`[GIB-LAUNCHER] API sonucu: success=${apiResult.success}, token=${apiResult.token}, error=${apiResult.error || 'yok'}`);

          if (apiResult.success && apiResult.redirectUrl) {
            // Yeni sekmede aç
            onProgress(`${appConfig.displayName} yeni sekmede açılıyor...`);
            const newPage = await browser!.newPage();
            await newPage.goto(apiResult.redirectUrl, {
              waitUntil: 'domcontentloaded',
              timeout: GIB_CONFIG.TIMEOUTS.APP_REDIRECT,
            });
            await newPage.bringToFront();
            appOpened = true;
          }
        }

        // Fallback: API başarısız olursa UI üzerinden tıklama
        if (!appOpened) {
          console.log(`[GIB-LAUNCHER] API yönlendirmesi başarısız, UI üzerinden ${appConfig.displayName}'ye geçiliyor...`);
          onProgress(`${appConfig.displayName} menüsü açılıyor...`);

          await new Promise(r => setTimeout(r, GIB_CONFIG.DELAYS.PAGE_TRANSITION));

          const menuClicked = await clickAppCard(page, appConfig);
          if (menuClicked) {
            await new Promise(r => setTimeout(r, GIB_CONFIG.DELAYS.POPUP_OPEN));
            onProgress(`${appConfig.displayName} onaylanıyor...`);
            const onayClicked = await clickConfirmButton(page);
            if (onayClicked) appOpened = true;
          }
        }

        if (appOpened) {
          onProgress(`🎉 ${appConfig.displayName} açıldı! Tarayıcı sizin kontrolünüzde.`);
        } else {
          onProgress(`⚠️ ${appConfig.displayName} yönlendirme başarısız. Dashboard'dan manuel geçiş yapabilirsiniz.`);
        }
      } catch (appError) {
        console.error('[GIB-LAUNCHER] Yönlendirme hatası:', appError);
        onProgress(`⚠️ ${appConfig.displayName} yönlendirme hatası. Tarayıcı açık, manuel geçiş yapabilirsiniz.`);
      }
    }

    // browser.close() ÇAĞIRMA - tarayıcı açık kalacak!
    return { success: true, browserOpen: true };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('[GIB-LAUNCHER] Hata:', errorMessage);

    // Hata durumunda browser'ı kapat
    if (browser && browser.connected) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    activeBrowser = null;

    return {
      success: false,
      browserOpen: false,
      error: errorMessage,
    };
  }
}

/**
 * Aktif browser'ı kapat
 */
export async function closeGibBrowser(): Promise<void> {
  await cleanupPreviousBrowser();
}

/**
 * Aktif browser var mı?
 */
export function hasActiveBrowser(): boolean {
  return activeBrowser !== null && activeBrowser.connected;
}

// ═══════════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY (eski API için)
// ═══════════════════════════════════════════════════════════════════

/**
 * @deprecated Use launchGibApplication({ application: 'ivd', ... }) instead
 */
export async function launchIvdBrowser(options: Omit<GibLaunchOptions, 'application'>): Promise<GibLaunchResult> {
  return launchGibApplication({ ...options, application: 'ivd' });
}


/**
 * @deprecated Use closeGibBrowser() instead
 */
export const closeIvdBrowser = closeGibBrowser;
