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

// Aktif browser instance - memory leak önleme
let activeBrowser: Browser | null = null;

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
  }
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
    apiEndpoint: '/apigateway/auth/tdvd/invd-login',
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
 * GİB uygulamasını başlatan ana fonksiyon
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
    // Önceki browser'ı temizle
    await cleanupPreviousBrowser();

    onProgress('Tarayıcı başlatılıyor...');

    // Dinamik ekran boyutunu al
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    // Paketlenmiş Chromium yolunu al
    const chromiumPath = getChromiumPath();
    console.log(`[GIB-LAUNCHER] Chromium path: ${chromiumPath || 'Puppeteer varsayılanı'}`);

    // ⚡ KRİTİK: Sadece görünür ve minimize olmayan pencereyi minimize et
    // Gizli pencereye minimize() çağrıldığında Windows önce pencereyi gösterir!
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow && mainWindow.isVisible() && !mainWindow.isMinimized()) {
      console.log('[GIB-LAUNCHER] Electron penceresi minimize ediliyor...');
      mainWindow.minimize();
      await new Promise(r => setTimeout(r, 300)); // Minimize animasyonu için bekle
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

    // Browser process ID'sini al (PowerShell için)
    const browserPid = browser.process()?.pid;
    console.log(`[GIB-LAUNCHER] Chromium başlatıldı, PID: ${browserPid}`);

    // Aktif browser'ı kaydet
    activeBrowser = browser;

    // Browser kapanınca referansı temizle
    browser.on('disconnected', () => {
      console.log('[GIB-LAUNCHER] Tarayıcı kapandı');
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
      console.log('[GIB-LAUNCHER] ✅ Pencere maximize edildi (CDP)');
    } catch (e) {
      console.warn('[GIB-LAUNCHER] CDP maximize başarısız:', e);
    }

    // Sayfayı ön plana getir
    await page.bringToFront();

    // Windows API ile pencereyi OS seviyesinde ön plana getir (3 deneme)
    for (let i = 0; i < 3; i++) {
      await bringBrowserWindowToFront(browserPid);
      await new Promise(r => setTimeout(r, 300));
    }

    // User agent ayarla
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Automation detection bypass
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    onProgress('GİB giriş sayfası yükleniyor...');

    // Login sayfasına git
    await page.goto(GIB_CONFIG.LOGIN_URL, {
      waitUntil: 'domcontentloaded',
      timeout: GIB_CONFIG.TIMEOUTS.PAGE_LOAD,
    });

    // Pencereyi ön plana getir (sayfa yüklendikten sonra)
    await page.bringToFront();

    // Windows API ile pencereyi OS seviyesinde ön plana getir (tekrar)
    await bringBrowserWindowToFront(browserPid);

    // Form elementini bekle (hızlı)
    try {
      await page.waitForSelector('input#userid', { timeout: 5000, visible: true });
      console.log('[GIB-LAUNCHER] ✅ Login form yüklendi');
    } catch {
      await new Promise(r => setTimeout(r, GIB_CONFIG.DELAYS.FORM_READY));
    }

    onProgress('Giriş bilgileri dolduruluyor...');

    // Userid selectors - GİB MUI (Material-UI) React form
    const useridSelectors = [
      'input#userid',
      'input[id="userid"]',
      'input[name="userid"]',
      '.MuiInputBase-input[name="userid"]',
      '.MuiOutlinedInput-input[name="userid"]',
      'input[placeholder*="T.C. Kimlik"]',
      'input[placeholder*="Vergi Kimlik"]',
      'input[placeholder*="Kullanıcı Kodu"]',
      'input[formcontrolname="userid"]',
      '#mat-input-0',
    ];

    // Password selectors - GİB MUI (Material-UI) React form
    const passwordSelectors = [
      'input#sifre',
      'input[id="sifre"]',
      'input[name="sifre"]',
      'input[type="password"][name="sifre"]',
      'input[type="password"][id="sifre"]',
      '.MuiInputBase-input[name="sifre"]',
      '.MuiOutlinedInput-input[type="password"]',
      'input[placeholder*="Şifrenizi yazınız"]',
      'input[placeholder*="şifre"]',
      'input[formcontrolname="sifre"]',
      'input[type="password"]',
    ];

    // Kullanıcı adı ve şifre AYNI ANDA gir (paralel - çok hızlı)
    const [useridFilled, passwordFilled] = await Promise.all([
      fillInput(page, useridSelectors, userid, 'Kullanıcı adı'),
      fillInput(page, passwordSelectors, password, 'Şifre'),
    ]);

    if (!useridFilled || !passwordFilled) {
      onProgress('⚠️ Form alanları bulunamadı. Lütfen manuel olarak doldurun.');
      return { success: false, browserOpen: true, error: 'Form alanları bulunamadı' };
    }

    // Doğrulama kodu bekleniyor
    onProgress('✅ Bilgiler girildi! Doğrulama kodunu girin ve giriş yapın.');

    // Login bekle - URL değişimini dinle
    let loginSuccessful = false;
    try {
      await page.waitForFunction(
        () => {
          const url = window.location.pathname;
          return url.includes('/dashboard') ||
                 url.includes('/portal/main') ||
                 url.includes('/home') ||
                 (!url.includes('/login') && !url.includes('/portal/login'));
        },
        { timeout: GIB_CONFIG.TIMEOUTS.LOGIN_WAIT }
      );
      loginSuccessful = true;
    } catch {
      onProgress('⏰ Süre doldu (3 dk). Tarayıcı açık, manuel devam edebilirsiniz.');
      return {
        success: false,
        browserOpen: true,
        error: 'Giriş süresi doldu. Manuel devam edebilirsiniz.'
      };
    }

    if (!loginSuccessful) {
      return { success: false, browserOpen: true, error: 'Login başarısız' };
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
      // Hedef sayfa yoksa normal uygulama akışını takip et
      onProgress(`✅ Giriş başarılı! ${appConfig.displayName}'ye yönlendiriliyor...`);

      try {
        let appOpened = false;

        // Yöntem 1: API ile yönlendirme (varsa)
        if (appConfig.apiEndpoint) {
          const apiResult = await page.evaluate(async (apiUrl: string) => {
            try {
              const response = await fetch(apiUrl, {
                method: 'GET',
                credentials: 'include',
              });

              if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
              }

              const data = await response.json();
              return data.redirectUrl
                ? { success: true, redirectUrl: data.redirectUrl }
                : { success: false, error: 'redirectUrl yok' };
            } catch (e: unknown) {
              return { success: false, error: e instanceof Error ? e.message : 'Hata' };
            }
          }, GIB_CONFIG.BASE_URL + appConfig.apiEndpoint);

          if (apiResult.success && apiResult.redirectUrl) {
            onProgress(`${appConfig.displayName} sayfası açılıyor...`);
            await page.goto(apiResult.redirectUrl, {
              waitUntil: 'domcontentloaded',
              timeout: GIB_CONFIG.TIMEOUTS.APP_REDIRECT,
            });
            appOpened = true;
          }
        }

        // Yöntem 2: API başarısız olursa UI üzerinden tıklama ile geç
        if (!appOpened) {
          console.log(`[GIB-LAUNCHER] API yönlendirmesi başarısız, UI üzerinden ${appConfig.displayName}'ye geçiliyor...`);
          onProgress(`${appConfig.displayName} menüsü açılıyor...`);

          // Dashboard'un yüklenmesini bekle (hızlı)
          await new Promise(r => setTimeout(r, GIB_CONFIG.DELAYS.PAGE_TRANSITION));

          // Uygulama kartına tıkla
          const menuClicked = await clickAppCard(page, appConfig);

          if (menuClicked) {
            // Popup açılmasını bekle (hızlı)
            await new Promise(r => setTimeout(r, GIB_CONFIG.DELAYS.POPUP_OPEN));
            onProgress(`${appConfig.displayName} onaylanıyor...`);

            // ONAYLA butonuna tıkla
            const onayClicked = await clickConfirmButton(page);

            if (onayClicked) {
              appOpened = true;
            }
          }
        }

        if (appOpened) {
          await new Promise(r => setTimeout(r, GIB_CONFIG.DELAYS.PAGE_TRANSITION));
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
