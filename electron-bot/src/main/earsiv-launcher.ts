/**
 * E-Arşiv Portal Launcher (GİB 5000/2000)
 * ========================================
 * Puppeteer ile headed browser açarak E-Arşiv Portalına giriş yapar.
 * Giriş sonrası browser açık kalır, kullanıcıya bırakılır.
 */

import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import { screen, BrowserWindow } from 'electron';
import { exec } from 'child_process';
import { getChromiumPath } from './chromium-path';

// Aktif browser instance - memory leak önleme
let activeBrowser: Browser | null = null;

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface EarsivLaunchOptions {
  userid: string;      // Kullanıcı kodu (max 8 karakter)
  password: string;    // Şifre (max 6 karakter)
  customerName?: string;
  onProgress: (status: string) => void;
}

export interface EarsivLaunchResult {
  success: boolean;
  browserOpen?: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const EARSIV_CONFIG = {
  LOGIN_URL: 'https://earsivportal.efatura.gov.tr/intragiris.html',

  TIMEOUTS: {
    PAGE_LOAD: 30000,
    ELEMENT_WAIT: 10000,
  },

  DELAYS: {
    FORM_READY: 500,
    BETWEEN_INPUTS: 100,
    AFTER_LOGIN_CLICK: 1000,
  },

  SELECTORS: {
    USERID: '#userid',
    PASSWORD: '#password',
    LOGIN_BUTTON: 'button[onclick="assosLogin()"]',
  },
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Windows API ile Chrome penceresini ön plana getirir
 * keybd_event ile ALT tuşuna basarak Windows Focus Stealing Protection'ı bypass eder
 */
async function bringBrowserWindowToFront(): Promise<void> {
  // Sadece Windows'ta çalışır
  if (process.platform !== 'win32') {
    console.log('[EARSIV-LAUNCHER] ℹ️ bringBrowserWindowToFront sadece Windows\'ta çalışır');
    return;
  }

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

    public const byte VK_MENU = 0x12;  // ALT key
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

    # ALT tuşuna bas ve bırak - Bu Windows'un focus stealing protection'ını bypass eder
    [WindowHelper]::keybd_event([WindowHelper]::VK_MENU, 0, [WindowHelper]::KEYEVENTF_EXTENDEDKEY, [UIntPtr]::Zero)
    [WindowHelper]::keybd_event([WindowHelper]::VK_MENU, 0, [WindowHelper]::KEYEVENTF_EXTENDEDKEY -bor [WindowHelper]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)

    # Mevcut foreground penceresinin thread'ini al
    $foregroundHwnd = [WindowHelper]::GetForegroundWindow()
    $foregroundThreadId = [WindowHelper]::GetWindowThreadProcessId($foregroundHwnd, [IntPtr]::Zero)
    $currentThreadId = [WindowHelper]::GetCurrentThreadId()
    $targetThreadId = [WindowHelper]::GetWindowThreadProcessId($hwnd, [IntPtr]::Zero)

    # Thread input'larını birleştir (foreground izni için)
    [WindowHelper]::AttachThreadInput($currentThreadId, $foregroundThreadId, $true)
    [WindowHelper]::AttachThreadInput($currentThreadId, $targetThreadId, $true)

    # Pencere minimize ise restore et
    if ([WindowHelper]::IsIconic($hwnd)) {
        [WindowHelper]::ShowWindow($hwnd, 9)  # SW_RESTORE
        Start-Sleep -Milliseconds 100
    }

    # Pencereyi geçici olarak TOPMOST yap
    [WindowHelper]::SetWindowPos($hwnd, [WindowHelper]::HWND_TOPMOST, 0, 0, 0, 0, [WindowHelper]::SWP_NOMOVE -bor [WindowHelper]::SWP_NOSIZE)

    # Pencereyi maximize et
    [WindowHelper]::ShowWindow($hwnd, 3)  # SW_MAXIMIZE

    # Ön plana getir
    [WindowHelper]::SetForegroundWindow($hwnd)
    [WindowHelper]::BringWindowToTop($hwnd)

    # TOPMOST'u kaldır (normal pencere gibi davransın)
    [WindowHelper]::SetWindowPos($hwnd, [WindowHelper]::HWND_NOTOPMOST, 0, 0, 0, 0, [WindowHelper]::SWP_NOMOVE -bor [WindowHelper]::SWP_NOSIZE)

    # Thread input'larını ayır
    [WindowHelper]::AttachThreadInput($currentThreadId, $foregroundThreadId, $false)
    [WindowHelper]::AttachThreadInput($currentThreadId, $targetThreadId, $false)

    Write-Host "Chrome penceresi on plana getirildi"
}
`;

  return new Promise((resolve) => {
    exec(`powershell -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"').replace(/\$/g, '`$')}"`, (error) => {
      if (error) {
        console.warn('[EARSIV-LAUNCHER] PowerShell bringToFront hatası:', error.message);
      } else {
        console.log('[EARSIV-LAUNCHER] ✅ Chrome penceresi ön plana getirildi (Windows API)');
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
        console.log('[EARSIV-LAUNCHER] Önceki tarayıcı kapatılıyor...');
        await activeBrowser.close();
      }
    } catch {
      console.log('[EARSIV-LAUNCHER] Önceki tarayıcı zaten kapalı');
    }
    activeBrowser = null;
  }
}

/**
 * Input alanına anında değer gir (Native value setter ile)
 */
async function fillInput(page: Page, selector: string, value: string, fieldName: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: EARSIV_CONFIG.TIMEOUTS.ELEMENT_WAIT, visible: true });

    // Native value setter ile anında değer gir
    const success = await page.evaluate((sel: string, val: string) => {
      const input = document.querySelector(sel) as HTMLInputElement;
      if (!input) return false;

      // Değeri anında set et
      input.value = val;

      // Input event gönder (form validation için)
      const inputEvent = new Event('input', { bubbles: true });
      input.dispatchEvent(inputEvent);

      // Change event de gönder
      const changeEvent = new Event('change', { bubbles: true });
      input.dispatchEvent(changeEvent);

      return true;
    }, selector, value);

    if (success) {
      console.log(`[EARSIV-LAUNCHER] ✅ ${fieldName} girildi`);
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`[EARSIV-LAUNCHER] ⚠️ ${fieldName} girilemedi:`, error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * E-Arşiv Portal'a giriş yapan ana fonksiyon
 */
export async function launchEarsivPortal(options: EarsivLaunchOptions): Promise<EarsivLaunchResult> {
  const { userid, password, customerName, onProgress } = options;

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Önceki browser'ı temizle
    await cleanupPreviousBrowser();

    onProgress('Tarayıcı başlatılıyor...');

    // Dinamik ekran boyutunu al
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    // Paketlenmiş Chromium yolunu al
    const chromiumPath = getChromiumPath();
    console.log(`[EARSIV-LAUNCHER] Chromium path: ${chromiumPath || 'Puppeteer varsayılanı'}`);

    // ⚡ KRİTİK: Sadece görünür ve minimize olmayan pencereyi minimize et
    // Gizli pencereye minimize() çağrıldığında Windows önce pencereyi gösterir!
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow && mainWindow.isVisible() && !mainWindow.isMinimized()) {
      console.log('[EARSIV-LAUNCHER] Electron penceresi minimize ediliyor...');
      mainWindow.minimize();
      await new Promise(r => setTimeout(r, 300));
    }

    // Puppeteer'ın paketlenmiş Chromium'unu kullan
    browser = await puppeteer.launch({
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

    const browserPid = browser.process()?.pid;
    console.log(`[EARSIV-LAUNCHER] Chromium başlatıldı, PID: ${browserPid}`);

    // Aktif browser'ı kaydet
    activeBrowser = browser;

    // Browser kapanınca referansı temizle
    browser.on('disconnected', () => {
      console.log('[EARSIV-LAUNCHER] Tarayıcı kapandı');
      if (activeBrowser === browser) {
        activeBrowser = null;
      }
    });

    // Yeni sayfa aç
    const pages = await browser.pages();
    page = pages[0] || await browser.newPage();

    // CDP ile pencereyi ön plana getir (agresif yöntem)
    try {
      const session = await page.target().createCDPSession();
      const { windowId } = await session.send('Browser.getWindowForTarget');

      // 1. Önce normal state'e getir (minimize'dan çıkarmak için)
      await session.send('Browser.setWindowBounds', {
        windowId,
        bounds: { windowState: 'normal' }
      });

      // Kısa delay
      await new Promise(r => setTimeout(r, 200));

      // 2. Sonra maximize et
      await session.send('Browser.setWindowBounds', {
        windowId,
        bounds: { windowState: 'maximized' }
      });

      await session.detach();
      console.log('[EARSIV-LAUNCHER] ✅ Pencere maximize edildi (CDP)');
    } catch (e) {
      console.warn('[EARSIV-LAUNCHER] CDP maximize başarısız:', e);
    }

    // Sayfayı ön plana getir
    await page.bringToFront();

    // Windows API ile pencereyi OS seviyesinde ön plana getir (3 deneme)
    for (let i = 0; i < 3; i++) {
      await bringBrowserWindowToFront();
      await new Promise(r => setTimeout(r, 300));
    }

    // User agent ayarla
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    onProgress('E-Arşiv Portal giriş sayfası yükleniyor...');

    // Login sayfasına git
    await page.goto(EARSIV_CONFIG.LOGIN_URL, {
      waitUntil: 'domcontentloaded',
      timeout: EARSIV_CONFIG.TIMEOUTS.PAGE_LOAD,
    });

    // Pencereyi ön plana getir
    await page.bringToFront();

    // Windows API ile pencereyi OS seviyesinde ön plana getir (tekrar)
    await bringBrowserWindowToFront();

    // Form elementini bekle
    await new Promise(r => setTimeout(r, EARSIV_CONFIG.DELAYS.FORM_READY));

    onProgress('Giriş bilgileri dolduruluyor...');

    // Kullanıcı kodu gir
    const useridFilled = await fillInput(page, EARSIV_CONFIG.SELECTORS.USERID, userid, 'Kullanıcı kodu');

    await new Promise(r => setTimeout(r, EARSIV_CONFIG.DELAYS.BETWEEN_INPUTS));

    // Şifre gir
    const passwordFilled = await fillInput(page, EARSIV_CONFIG.SELECTORS.PASSWORD, password, 'Şifre');

    if (!useridFilled || !passwordFilled) {
      onProgress('⚠️ Form alanları bulunamadı. Lütfen manuel doldurun.');
      return { success: false, browserOpen: true, error: 'Form alanları bulunamadı' };
    }

    onProgress('Giriş butonuna tıklanıyor...');

    // Giriş butonuna tıkla
    try {
      // Yöntem 1: Selector ile
      const loginButton = await page.$(EARSIV_CONFIG.SELECTORS.LOGIN_BUTTON);
      if (loginButton) {
        await loginButton.click();
        console.log('[EARSIV-LAUNCHER] ✅ Giriş butonu tıklandı (selector)');
      } else {
        // Yöntem 2: evaluate ile assosLogin() çağır
        await page.evaluate(() => {
          const btn = document.querySelector('button[onclick="assosLogin()"]') as HTMLButtonElement;
          if (btn) {
            btn.click();
          } else {
            // Yöntem 3: Direkt fonksiyon çağır
            // @ts-ignore
            if (typeof window.assosLogin === 'function') {
              // @ts-ignore
              window.assosLogin();
            }
          }
        });
        console.log('[EARSIV-LAUNCHER] ✅ Giriş butonu tıklandı (evaluate)');
      }
    } catch (clickError) {
      console.warn('[EARSIV-LAUNCHER] Giriş butonu tıklama hatası:', clickError);
    }

    await new Promise(r => setTimeout(r, EARSIV_CONFIG.DELAYS.AFTER_LOGIN_CLICK));

    // Başarı mesajı
    const customerInfo = customerName ? ` (${customerName})` : '';
    onProgress(`🎉 E-Arşiv Portal açıldı${customerInfo}! Tarayıcı sizin kontrolünüzde.`);

    // browser.close() ÇAĞIRMA - tarayıcı açık kalacak!
    return { success: true, browserOpen: true };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('[EARSIV-LAUNCHER] Hata:', errorMessage);

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
export async function closeEarsivBrowser(): Promise<void> {
  await cleanupPreviousBrowser();
}

/**
 * Aktif browser var mı?
 */
export function hasActiveEarsivBrowser(): boolean {
  return activeBrowser !== null && activeBrowser.connected;
}
