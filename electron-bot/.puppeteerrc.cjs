/**
 * Puppeteer yapılandırması
 * Chromium'u proje içindeki .chromium dizinine indirir
 * Bu sayede electron-builder ile paketlenebilir
 */
const path = require('path');

module.exports = {
  // Chromium'u proje içinde sakla (paketleme için)
  cacheDirectory: path.join(__dirname, '.chromium'),
};
