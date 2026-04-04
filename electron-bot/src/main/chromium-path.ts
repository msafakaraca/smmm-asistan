/**
 * Puppeteer Chromium yolunu bulur
 * İndirilen Chromium'u userData dizininden kullanır
 */

import { getChromiumExecutablePath, isChromiumInstalled } from './chromium-downloader';

export { isChromiumInstalled };

/**
 * Chromium executable yolunu döndürür
 */
export function getChromiumPath(): string | undefined {
  const execPath = getChromiumExecutablePath();
  if (execPath) {
    console.log('[CHROMIUM] Path:', execPath);
    return execPath;
  }

  console.log('[CHROMIUM] Chromium bulunamadı, Puppeteer varsayılanı kullanılacak');
  return undefined;
}
