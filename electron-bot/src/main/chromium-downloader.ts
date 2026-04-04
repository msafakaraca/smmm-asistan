/**
 * Chromium İndirme Yöneticisi
 * ============================
 * İlk açılışta Chromium'u kullanıcının bilgisayarına indirir.
 * @puppeteer/browsers paketini kullanır.
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Puppeteer ile uyumlu Chrome sürümü
const CHROME_BUILD_ID = '143.0.7499.169';

/** İndirme ilerleme bilgisi */
export interface DownloadProgress {
  percent: number;
  downloadedMB: number;
  totalMB: number;
  status: string;
}

type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Chromium'un kaydedileceği dizin
 * Packaged: %LOCALAPPDATA%/smmm-bot/chromium
 * Dev: electron-bot/.chromium
 */
export function getChromiumCacheDir(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'chromium');
  }
  return path.join(__dirname, '..', '..', '.chromium');
}

/**
 * Chromium kurulu mu kontrol eder
 */
export function isChromiumInstalled(): boolean {
  const execPath = getChromiumExecutablePath();
  if (!execPath) return false;
  try {
    fs.accessSync(execPath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Chromium executable path'ini döndürür
 */
export function getChromiumExecutablePath(): string | undefined {
  const cacheDir = getChromiumCacheDir();
  const execName = process.platform === 'win32' ? 'chrome.exe' : 'chrome';
  return findExecutable(cacheDir, execName);
}

function findExecutable(baseDir: string, execName: string): string | undefined {
  if (!fs.existsSync(baseDir)) return undefined;

  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(baseDir, entry.name);
      if (entry.isDirectory()) {
        const found = findExecutable(entryPath, execName);
        if (found) return found;
      } else if (entry.isFile() && entry.name === execName) {
        return entryPath;
      }
    }
  } catch {
    // Dizin okunamadı
  }
  return undefined;
}

/**
 * Chromium'u indirir ve kuruluma hazırlar
 */
export async function downloadChromium(onProgress?: ProgressCallback): Promise<string> {
  const { install, Browser, detectBrowserPlatform } = require('@puppeteer/browsers');

  const cacheDir = getChromiumCacheDir();
  const platform = detectBrowserPlatform();

  console.log(`[CHROMIUM] İndirme başlıyor...`);
  console.log(`[CHROMIUM] Hedef: ${cacheDir}`);
  console.log(`[CHROMIUM] Build: ${CHROME_BUILD_ID}`);
  console.log(`[CHROMIUM] Platform: ${platform}`);

  onProgress?.({
    percent: 0,
    downloadedMB: 0,
    totalMB: 0,
    status: 'Chromium indiriliyor...',
  });

  const result = await install({
    cacheDir,
    browser: Browser.CHROME,
    buildId: CHROME_BUILD_ID,
    downloadProgressCallback: (downloadedBytes: number, totalBytes: number) => {
      const downloadedMB = Math.round(downloadedBytes / 1024 / 1024);
      const totalMB = Math.round(totalBytes / 1024 / 1024);
      const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;

      onProgress?.({
        percent,
        downloadedMB,
        totalMB,
        status: `Chromium indiriliyor... ${downloadedMB} / ${totalMB} MB`,
      });
    },
  });

  console.log(`[CHROMIUM] İndirme tamamlandı: ${result.executablePath}`);

  onProgress?.({
    percent: 100,
    downloadedMB: 0,
    totalMB: 0,
    status: 'Chromium kurulumu tamamlandı!',
  });

  return result.executablePath;
}
