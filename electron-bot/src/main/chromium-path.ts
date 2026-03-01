/**
 * Puppeteer Chromium yolunu bulur
 * Development ve Production ortamlarında farklı yollar kullanılır
 */
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Chromium executable yolunu döndürür
 * - Development: .chromium dizininden
 * - Production: resources/chromium dizininden
 */
export function getChromiumPath(): string | undefined {
  const isPackaged = app.isPackaged;

  // Platform'a göre executable adı
  const execName = process.platform === 'win32' ? 'chrome.exe' : 'chrome';

  if (isPackaged) {
    // Production: resources dizininde
    const resourcesPath = process.resourcesPath;
    const chromiumDir = path.join(resourcesPath, 'chromium');

    // Chromium dizinini tara ve executable'ı bul
    const execPath = findChromiumExecutable(chromiumDir, execName);
    if (execPath) {
      console.log('[CHROMIUM] Production path:', execPath);
      return execPath;
    }
  } else {
    // Development: proje dizinindeki .chromium klasörü
    const devChromiumDir = path.join(__dirname, '..', '..', '.chromium');

    // Chromium dizinini tara ve executable'ı bul
    const execPath = findChromiumExecutable(devChromiumDir, execName);
    if (execPath) {
      console.log('[CHROMIUM] Development path:', execPath);
      return execPath;
    }
  }

  // Bulunamazsa undefined döndür (Puppeteer kendi bulur)
  console.log('[CHROMIUM] Chromium bulunamadı, Puppeteer varsayılanı kullanılacak');
  return undefined;
}

/**
 * Chromium dizininde executable'ı recursive olarak arar
 */
function findChromiumExecutable(baseDir: string, execName: string): string | undefined {
  if (!fs.existsSync(baseDir)) {
    return undefined;
  }

  // Dizin yapısı: .chromium/chrome/win64-XXXXXX/chrome-win64/chrome.exe
  // veya: .chromium/chromium/win64-XXXXXX/chrome-win64/chrome.exe

  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(baseDir, entry.name);

      if (entry.isDirectory()) {
        // Alt dizinlerde recursive ara
        const found = findChromiumExecutable(entryPath, execName);
        if (found) return found;
      } else if (entry.isFile() && entry.name === execName) {
        return entryPath;
      }
    }
  } catch (err) {
    console.warn('[CHROMIUM] Dizin tarama hatası:', err);
  }

  return undefined;
}

/**
 * Chromium'un kurulu olup olmadığını kontrol eder
 */
export function isChromiumInstalled(): boolean {
  const chromiumPath = getChromiumPath();
  if (!chromiumPath) return false;

  try {
    fs.accessSync(chromiumPath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
