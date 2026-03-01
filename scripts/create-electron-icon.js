/**
 * Electron Bot için ikon oluşturma scripti
 * Sharp kullanarak farklı boyutlarda PNG ikonlar oluşturur
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, '../electron-bot/assets');

// SMMM Asistan için basit bir ikon SVG'si
// Mavi arka plan, beyaz "S" harfi ve hesap sembolü
const createIconSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Yuvarlatılmış kare arka plan -->
  <rect x="8" y="8" width="240" height="240" rx="48" ry="48" fill="url(#bg)"/>
  <!-- Beyaz "S" harfi (SMMM için) -->
  <text x="128" y="175"
        font-family="Arial, sans-serif"
        font-size="160"
        font-weight="bold"
        fill="white"
        text-anchor="middle">S</text>
  <!-- Küçük hesap simgesi (sağ alt köşe) -->
  <circle cx="195" cy="195" r="28" fill="white" opacity="0.9"/>
  <path d="M195 180 L195 210 M180 195 L210 195"
        stroke="#3b82f6"
        stroke-width="6"
        stroke-linecap="round"/>
</svg>
`;

async function createIcons() {
  console.log('🎨 Electron Bot ikonları oluşturuluyor...\n');

  // Assets klasörünün varlığını kontrol et
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  const sizes = [
    { name: 'icon.png', size: 256 },      // Ana ikon
    { name: 'icon@2x.png', size: 512 },   // Retina
    { name: 'icon-16.png', size: 16 },    // Tray (küçük)
    { name: 'icon-32.png', size: 32 },    // Tray (normal)
    { name: 'icon-48.png', size: 48 },    // Taskbar
    { name: 'icon-64.png', size: 64 },    // Büyük tray
    { name: 'icon-128.png', size: 128 },  // Dock
  ];

  for (const { name, size } of sizes) {
    const svgBuffer = Buffer.from(createIconSvg(size));
    const outputPath = path.join(ASSETS_DIR, name);

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`✅ ${name} (${size}x${size}) oluşturuldu`);
  }

  // Windows ICO için özel boyutlar içeren multi-size PNG
  // (electron-builder ICO'yu otomatik oluşturabilir)
  console.log('\n📦 Windows için icon.ico hazırlanıyor...');

  // 256x256 PNG'yi ICO yerine kullanacağız
  // Electron-builder build sırasında PNG'den ICO oluşturabilir
  const icoSvg = Buffer.from(createIconSvg(256));
  await sharp(icoSvg)
    .resize(256, 256)
    .png()
    .toFile(path.join(ASSETS_DIR, 'icon-256.png'));

  console.log('✅ icon-256.png (ICO kaynağı) oluşturuldu');

  console.log('\n🎉 Tüm ikonlar başarıyla oluşturuldu!');
  console.log(`📁 Konum: ${ASSETS_DIR}`);
}

async function createIco() {
  const { default: pngToIco } = require('png-to-ico');

  console.log('\n🔧 Windows ICO dosyası oluşturuluyor...');

  // Farklı boyutlardaki PNG'leri ICO'ya çevir
  const pngFiles = [
    path.join(ASSETS_DIR, 'icon-16.png'),
    path.join(ASSETS_DIR, 'icon-32.png'),
    path.join(ASSETS_DIR, 'icon-48.png'),
    path.join(ASSETS_DIR, 'icon-256.png'),
  ];

  const icoBuffer = await pngToIco(pngFiles);
  fs.writeFileSync(path.join(ASSETS_DIR, 'icon.ico'), icoBuffer);

  console.log('✅ icon.ico oluşturuldu');
}

createIcons()
  .then(() => createIco())
  .catch(console.error);
