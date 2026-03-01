/**
 * İŞKUR İşveren Sistemi Launcher
 * ================================
 * Puppeteer ile headed browser açarak İŞKUR İşveren Sistemi'ne giriş yapar.
 * İki yöntem desteklenir:
 * 1. İŞKUR bilgileriyle giriş (T.C. + şifre → İşveren Giriş butonu tıkla)
 * 2. E-Devlet ile giriş (İŞKUR → E-Devlet butonu → giris.turkiye.gov.tr → form doldur → kullanıcıya devret)
 */

import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import { screen, BrowserWindow } from 'electron';
import { exec } from 'child_process';
import { getChromiumPath } from './chromium-path';

// Aktif browser instance
let activeBrowser: Browser | null = null;

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface IskurLaunchOptions {
  tckn: string;
  password: string;
  loginMethod: "iskur" | "edevlet";
  customerName?: string;
  onProgress: (status: string) => void;
}

export interface IskurLaunchResult {
  success: boolean;
  browserOpen?: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const ISKUR_CONFIG = {
  URL: 'https://esube.iskur.gov.tr/',

  TIMEOUTS: {
    PAGE_LOAD: 30000,
    ELEMENT_WAIT: 10000,
    NAVIGATION_WAIT: 15000,
  },

  DELAYS: {
    FORM_READY: 500,
    BETWEEN_INPUTS: 100,
    MODAL_READY: 1000,
  },

  SELECTORS: {
    // İŞKUR Ana Sayfa
    GIRIS_BUTTON: 'a[href="#modalIsverenGiris"]',
    // İŞKUR Credentials Login
    TC_INPUT: '#ctl02_userLoginIsveren_ctlEmployerUserId',
    PASSWORD_INPUT: '#ctl02_userLoginIsveren_ctlEmployerPassword',
    ISVEREN_GIRIS_BUTTON: '#ctl02_userLoginIsveren_ctlEmployerFirmaAra',
    // E-Devlet ile giriş
    EDEVLET_BUTTON: '#ctl02_userLoginIsveren_ctlEDevletIleGirisIsveren',
    // E-Devlet formu (giris.turkiye.gov.tr)
    EDEVLET_TC_INPUT: 'input#tridField',
    EDEVLET_PASSWORD_INPUT: 'input#egpField',
  },
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Windows API ile Chrome penceresini ön plana getirir
 */
async function bringBrowserWindowToFront(): Promise<void> {
  if (process.platform !== 'win32') return;

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

$chrome = Get-Process -Name "chrome" -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 } |
    Sort-Object StartTime -Descending |
    Select-Object -First 1

if ($chrome) {
    $hwnd = $chrome.MainWindowHandle
    [WindowHelper]::keybd_event([WindowHelper]::VK_MENU, 0, [WindowHelper]::KEYEVENTF_EXTENDEDKEY, [UIntPtr]::Zero)
    [WindowHelper]::keybd_event([WindowHelper]::VK_MENU, 0, [WindowHelper]::KEYEVENTF_EXTENDEDKEY -bor [WindowHelper]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)
    $foregroundHwnd = [WindowHelper]::GetForegroundWindow()
    $foregroundThreadId = [WindowHelper]::GetWindowThreadProcessId($foregroundHwnd, [IntPtr]::Zero)
    $currentThreadId = [WindowHelper]::GetCurrentThreadId()
    $targetThreadId = [WindowHelper]::GetWindowThreadProcessId($hwnd, [IntPtr]::Zero)
    [WindowHelper]::AttachThreadInput($currentThreadId, $foregroundThreadId, $true)
    [WindowHelper]::AttachThreadInput($currentThreadId, $targetThreadId, $true)
    if ([WindowHelper]::IsIconic($hwnd)) {
        [WindowHelper]::ShowWindow($hwnd, 9)
        Start-Sleep -Milliseconds 100
    }
    [WindowHelper]::SetWindowPos($hwnd, [WindowHelper]::HWND_TOPMOST, 0, 0, 0, 0, [WindowHelper]::SWP_NOMOVE -bor [WindowHelper]::SWP_NOSIZE)
    [WindowHelper]::ShowWindow($hwnd, 3)
    [WindowHelper]::SetForegroundWindow($hwnd)
    [WindowHelper]::BringWindowToTop($hwnd)
    [WindowHelper]::SetWindowPos($hwnd, [WindowHelper]::HWND_NOTOPMOST, 0, 0, 0, 0, [WindowHelper]::SWP_NOMOVE -bor [WindowHelper]::SWP_NOSIZE)
    [WindowHelper]::AttachThreadInput($currentThreadId, $foregroundThreadId, $false)
    [WindowHelper]::AttachThreadInput($currentThreadId, $targetThreadId, $false)
}
`;

  return new Promise((resolve) => {
    exec(`powershell -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"').replace(/\$/g, '`$')}"`, (error) => {
      if (error) {
        console.warn('[ISKUR-LAUNCHER] PowerShell bringToFront hatasi:', error.message);
      }
      resolve();
    });
  });
}

async function cleanupPreviousBrowser(): Promise<void> {
  if (activeBrowser) {
    try {
      if (activeBrowser.connected) {
        console.log('[ISKUR-LAUNCHER] Onceki tarayici kapatiliyor...');
        await activeBrowser.close();
      }
    } catch {
      console.log('[ISKUR-LAUNCHER] Onceki tarayici zaten kapali');
    }
    activeBrowser = null;
  }
}

async function fillInput(page: Page, selectors: string[], value: string, fieldName: string): Promise<boolean> {
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000, visible: true });

      const success = await page.evaluate((sel: string, val: string) => {
        const input = document.querySelector(sel) as HTMLInputElement;
        if (!input) return false;

        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;

        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      }, selector, value);

      if (success) {
        console.log(`[ISKUR-LAUNCHER] ${fieldName} girildi (${selector})`);
        return true;
      }
    } catch {
      // Bu selector calismadi, sonrakini dene
    }
  }

  console.warn(`[ISKUR-LAUNCHER] ${fieldName} input bulunamadi!`);
  return false;
}

// ═══════════════════════════════════════════════════════════════════
// SHARED BROWSER LAUNCH
// ═══════════════════════════════════════════════════════════════════

async function launchBrowserAndNavigate(onProgress: (status: string) => void): Promise<{ browser: Browser; page: Page }> {
  await cleanupPreviousBrowser();

  onProgress('Tarayici baslatiliyor...');

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const chromiumPath = getChromiumPath();

  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow && mainWindow.isVisible() && !mainWindow.isMinimized()) {
    mainWindow.minimize();
    await new Promise(r => setTimeout(r, 300));
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
    console.log('[ISKUR-LAUNCHER] Tarayici kapandi');
    if (activeBrowser === browser) {
      activeBrowser = null;
    }
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  // CDP ile pencereyi maximize et
  try {
    const session = await page.target().createCDPSession();
    const { windowId } = await session.send('Browser.getWindowForTarget');
    await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
    await new Promise(r => setTimeout(r, 200));
    await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'maximized' } });
    await session.detach();
  } catch (e) {
    console.warn('[ISKUR-LAUNCHER] CDP maximize basarisiz:', e);
  }

  await page.bringToFront();
  for (let i = 0; i < 3; i++) {
    await bringBrowserWindowToFront();
    await new Promise(r => setTimeout(r, 300));
  }

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  onProgress('ISKUR Isveren Sistemi yukleniyor...');

  await page.goto(ISKUR_CONFIG.URL, {
    waitUntil: 'domcontentloaded',
    timeout: ISKUR_CONFIG.TIMEOUTS.PAGE_LOAD,
  });

  await page.bringToFront();
  await bringBrowserWindowToFront();

  return { browser, page };
}

async function openLoginModal(page: Page, onProgress: (status: string) => void): Promise<void> {
  onProgress('Giris butonu tiklaniyor...');

  await page.waitForSelector(ISKUR_CONFIG.SELECTORS.GIRIS_BUTTON, {
    timeout: ISKUR_CONFIG.TIMEOUTS.ELEMENT_WAIT,
    visible: true,
  });

  await page.click(ISKUR_CONFIG.SELECTORS.GIRIS_BUTTON);

  // Modal'in acilmasini bekle
  await new Promise(r => setTimeout(r, ISKUR_CONFIG.DELAYS.MODAL_READY));
}

// ═══════════════════════════════════════════════════════════════════
// ISKUR CREDENTIALS LOGIN
// ═══════════════════════════════════════════════════════════════════

export async function launchIskurWithCredentials(options: IskurLaunchOptions): Promise<IskurLaunchResult> {
  const { tckn, password, customerName, onProgress } = options;

  let browser: Browser | null = null;

  try {
    const result = await launchBrowserAndNavigate(onProgress);
    browser = result.browser;
    const page = result.page;

    // Giris modal'ini ac
    await openLoginModal(page, onProgress);

    onProgress('ISKUR bilgileri dolduruluyor...');

    // TC Kimlik No gir
    const tcknFilled = await fillInput(page, [ISKUR_CONFIG.SELECTORS.TC_INPUT], tckn, 'T.C. Kimlik No');

    await new Promise(r => setTimeout(r, ISKUR_CONFIG.DELAYS.BETWEEN_INPUTS));

    // Sifre gir
    const passwordFilled = await fillInput(page, [ISKUR_CONFIG.SELECTORS.PASSWORD_INPUT], password, 'ISKUR Sifresi');

    if (!tcknFilled || !passwordFilled) {
      onProgress('Form alanlari bulunamadi. Lutfen manuel olarak doldurun.');
      return { success: false, browserOpen: true, error: 'Form alanlari bulunamadi' };
    }

    // Isveren Giris butonuna tikla
    onProgress('Giris yapiliyor...');
    await page.waitForSelector(ISKUR_CONFIG.SELECTORS.ISVEREN_GIRIS_BUTTON, {
      timeout: ISKUR_CONFIG.TIMEOUTS.ELEMENT_WAIT,
      visible: true,
    });
    await page.click(ISKUR_CONFIG.SELECTORS.ISVEREN_GIRIS_BUTTON);

    const customerInfo = customerName ? ` (${customerName})` : '';
    onProgress(`ISKUR giris yapildi${customerInfo}!`);

    return { success: true, browserOpen: true };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('[ISKUR-LAUNCHER] Credentials giris hatasi:', errorMessage);

    if (browser && browser.connected) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    activeBrowser = null;

    return { success: false, browserOpen: false, error: errorMessage };
  }
}

// ═══════════════════════════════════════════════════════════════════
// E-DEVLET LOGIN VIA ISKUR
// ═══════════════════════════════════════════════════════════════════

export async function launchIskurWithEdevlet(options: IskurLaunchOptions): Promise<IskurLaunchResult> {
  const { tckn, password, customerName, onProgress } = options;

  let browser: Browser | null = null;

  try {
    const result = await launchBrowserAndNavigate(onProgress);
    browser = result.browser;
    const page = result.page;

    // Giris modal'ini ac
    await openLoginModal(page, onProgress);

    // E-Devlet butonuna tikla
    onProgress('E-Devlet butonuna tiklaniyor...');
    await page.waitForSelector(ISKUR_CONFIG.SELECTORS.EDEVLET_BUTTON, {
      timeout: ISKUR_CONFIG.TIMEOUTS.ELEMENT_WAIT,
      visible: true,
    });
    await page.click(ISKUR_CONFIG.SELECTORS.EDEVLET_BUTTON);

    // E-Devlet sayfasina yonlendirmeyi bekle
    onProgress('E-Devlet sayfasina yonlendiriliyor...');
    await page.waitForNavigation({
      waitUntil: 'domcontentloaded',
      timeout: ISKUR_CONFIG.TIMEOUTS.NAVIGATION_WAIT,
    });

    // E-Devlet formunun yuklenmesini bekle
    await new Promise(r => setTimeout(r, ISKUR_CONFIG.DELAYS.FORM_READY));

    onProgress('E-Devlet bilgileri dolduruluyor...');

    // TC Kimlik No gir
    const tcknFilled = await fillInput(
      page,
      [ISKUR_CONFIG.SELECTORS.EDEVLET_TC_INPUT, 'input[name="tridField"]'],
      tckn,
      'T.C. Kimlik No'
    );

    await new Promise(r => setTimeout(r, ISKUR_CONFIG.DELAYS.BETWEEN_INPUTS));

    // E-Devlet sifre gir
    const passwordFilled = await fillInput(
      page,
      [ISKUR_CONFIG.SELECTORS.EDEVLET_PASSWORD_INPUT, 'input[name="egpField"]'],
      password,
      'E-Devlet Sifresi'
    );

    if (!tcknFilled || !passwordFilled) {
      onProgress('E-Devlet form alanlari bulunamadi. Lutfen manuel olarak doldurun.');
      return { success: false, browserOpen: true, error: 'E-Devlet form alanlari bulunamadi' };
    }

    const customerInfo = customerName ? ` (${customerName})` : '';
    onProgress(`E-Devlet bilgileri girildi${customerInfo}! Giris butonuna tiklayin.`);

    // Giris butonuna BASMA - kullaniciya devret
    return { success: true, browserOpen: true };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('[ISKUR-LAUNCHER] E-Devlet giris hatasi:', errorMessage);

    if (browser && browser.connected) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    activeBrowser = null;

    return { success: false, browserOpen: false, error: errorMessage };
  }
}
