/**
 * Prisma tmp dosyalarını temizler
 * Windows ve Unix uyumlu
 */
const fs = require('fs');
const path = require('path');

const prismaClientDir = path.join(__dirname, '..', 'node_modules', '.prisma', 'client');

if (!fs.existsSync(prismaClientDir)) {
  console.log('[cleanup] Prisma client klasörü bulunamadı, atlanıyor...');
  process.exit(0);
}

const files = fs.readdirSync(prismaClientDir);
const tmpFiles = files.filter(f => f.includes('.tmp'));

if (tmpFiles.length === 0) {
  console.log('[cleanup] Temizlenecek tmp dosyası yok.');
  process.exit(0);
}

let deleted = 0;
let failed = 0;

tmpFiles.forEach(file => {
  const filePath = path.join(prismaClientDir, file);
  try {
    fs.unlinkSync(filePath);
    deleted++;
  } catch (err) {
    // Dosya kilitli olabilir, atla
    failed++;
  }
});

console.log(`[cleanup] ${deleted} tmp dosyası silindi${failed > 0 ? `, ${failed} dosya atlandı (kilitli)` : ''}`);
