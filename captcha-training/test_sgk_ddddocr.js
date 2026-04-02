/**
 * SGK Captcha + ddddocr Lokal Model Test Scripti
 * ================================================
 * SGK E-Bildirge captcha'larını indirip ddddocr ONNX modeli ile çözmeyi dener.
 * Sonuçları dosya adı olarak kaydeder.
 *
 * Kullanım: node test_sgk_ddddocr.js
 * Çalıştırma dizini: electron-bot (onnxruntime-node oradan yükleniyor)
 */

const path = require('path');
const fs = require('fs');

// Modülleri doğru yerlerden yükle
const ROOT_DIR = path.join(__dirname, '..');
const ELECTRON_BOT_DIR = path.join(ROOT_DIR, 'electron-bot');
const sharp = require(path.join(ROOT_DIR, 'node_modules', 'sharp'));

// ─── Ayarlar ───────────────────────────────────────────────────────────────
const TOTAL_CAPTCHAS = 20;
const SGK_CAPTCHA_URL = 'https://ebildirge.sgk.gov.tr/EBildirgeV2/PG';
const MODEL_DIR = path.join(ELECTRON_BOT_DIR, 'models');
const OUTPUT_DIR = path.join(__dirname, 'sgk_captcha_test');
const IMG_HEIGHT = 64;
const NUM_CLASSES = 8210;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ─── ONNX Model Yükleme ───────────────────────────────────────────────────
let onnxSession = null;
let charset = [];

async function loadModel() {
  const ort = require(path.join(ELECTRON_BOT_DIR, 'node_modules', 'onnxruntime-node'));

  const modelPath = path.join(MODEL_DIR, 'ddddocr.onnx');
  const charsetPath = path.join(MODEL_DIR, 'ddddocr_charset.json');

  if (!fs.existsSync(modelPath)) throw new Error(`Model bulunamadı: ${modelPath}`);
  if (!fs.existsSync(charsetPath)) throw new Error(`Charset bulunamadı: ${charsetPath}`);

  charset = JSON.parse(fs.readFileSync(charsetPath, 'utf-8'));
  console.log(`Charset yüklendi: ${charset.length} karakter`);

  onnxSession = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
  });
  console.log('ddddocr ONNX model yüklendi\n');
}

// ─── Görüntü İşleme (sharp ile) ──────────────────────────────────────────
async function decodeJpegToGray(buffer) {
  const { data, info } = await sharp(buffer)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    gray: new Uint8Array(data),
    width: info.width,
    height: info.height,
  };
}

function bilinearResize(src, srcW, srcH, dstW, dstH) {
  const dst = new Uint8Array(dstW * dstH);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = x * xRatio;
      const srcY = y * yRatio;
      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const y1 = Math.min(y0 + 1, srcH - 1);
      const xFrac = srcX - x0;
      const yFrac = srcY - y0;
      const tl = src[y0 * srcW + x0];
      const tr = src[y0 * srcW + x1];
      const bl = src[y1 * srcW + x0];
      const br = src[y1 * srcW + x1];
      const top = tl + (tr - tl) * xFrac;
      const bottom = bl + (br - bl) * xFrac;
      dst[y * dstW + x] = Math.round(top + (bottom - top) * yFrac);
    }
  }
  return dst;
}

function preprocessImage(grayPixels, srcWidth, srcHeight) {
  const newWidth = Math.round(srcWidth * (IMG_HEIGHT / srcHeight));
  const resized = bilinearResize(grayPixels, srcWidth, srcHeight, newWidth, IMG_HEIGHT);
  const input = new Float32Array(IMG_HEIGHT * newWidth);
  for (let i = 0; i < resized.length; i++) {
    input[i] = resized[i] / 255.0;
  }
  return { data: input, width: newWidth };
}

// ─── CTC Decode ──────────────────────────────────────────────────────────
function ctcDecode(logits, seqLen) {
  const decoded = [];
  let prev = -1;
  for (let t = 0; t < seqLen; t++) {
    const offset = t * NUM_CLASSES;
    let maxIdx = 0;
    let maxVal = -Infinity;
    for (let c = 0; c < NUM_CLASSES; c++) {
      if (logits[offset + c] > maxVal) {
        maxVal = logits[offset + c];
        maxIdx = c;
      }
    }
    if (maxIdx !== 0 && maxIdx !== prev) {
      const ch = charset[maxIdx] || '';
      if (ch) decoded.push(ch);
    }
    prev = maxIdx;
  }
  return decoded.join('');
}

// ─── Captcha İndir ───────────────────────────────────────────────────────
async function fetchSgkCaptcha() {
  const response = await fetch(SGK_CAPTCHA_URL, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9',
      'Referer': 'https://ebildirge.sgk.gov.tr/EBildirgeV2/',
    },
  });

  if (!response.ok) {
    throw new Error(`SGK Captcha HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Tek Captcha Çöz ────────────────────────────────────────────────────
async function solveCaptcha(jpegBuffer) {
  const ort = require(path.join(ELECTRON_BOT_DIR, 'node_modules', 'onnxruntime-node'));

  const decoded = await decodeJpegToGray(jpegBuffer);
  const { data: inputData, width: inputWidth } = preprocessImage(
    decoded.gray, decoded.width, decoded.height
  );

  const t0 = Date.now();
  const inputTensor = new ort.Tensor('float32', inputData, [1, 1, IMG_HEIGHT, inputWidth]);
  const results = await onnxSession.run({ input1: inputTensor });

  const output = results['387'];
  const seqLen = output.dims[0];
  const text = ctcDecode(output.data, seqLen);
  const elapsed = Date.now() - t0;

  return { text, elapsed, width: decoded.width, height: decoded.height };
}

// ─── Ana Test ────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SGK Captcha + ddddocr Lokal Model Testi');
  console.log(`  ${TOTAL_CAPTCHAS} captcha indirilip test edilecek`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Çıktı dizinini oluştur
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Model yükle
  await loadModel();

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 1; i <= TOTAL_CAPTCHAS; i++) {
    try {
      process.stdout.write(`[${i}/${TOTAL_CAPTCHAS}] Captcha indiriliyor... `);

      const jpegBuffer = await fetchSgkCaptcha();
      process.stdout.write(`(${jpegBuffer.length} byte) → Çözülüyor... `);

      const { text, elapsed, width, height } = await solveCaptcha(jpegBuffer);

      // Dosya adı: çözüm_index.jpg (çözüm boşsa "EMPTY")
      const safeName = text.length > 0 ? text.replace(/[^a-zA-Z0-9_-]/g, '_') : 'EMPTY';
      const fileName = `${safeName}_${String(i).padStart(2, '0')}.jpg`;
      const filePath = path.join(OUTPUT_DIR, fileName);

      fs.writeFileSync(filePath, jpegBuffer);

      const status = text.length >= 4 ? '✓' : '✗ (kısa)';
      if (text.length >= 4) successCount++; else failCount++;

      console.log(`${status} → "${text}" (${elapsed}ms, ${width}x${height}) → ${fileName}`);

      results.push({
        index: i,
        solution: text,
        length: text.length,
        elapsed,
        width,
        height,
        fileName,
        valid: text.length >= 4,
      });

      // SGK'ya fazla yük binmesin diye kısa bekleme
      if (i < TOTAL_CAPTCHAS) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err) {
      failCount++;
      console.log(`✗ HATA: ${err.message}`);
      results.push({
        index: i,
        solution: '',
        length: 0,
        elapsed: 0,
        width: 0,
        height: 0,
        fileName: '',
        valid: false,
        error: err.message,
      });
    }
  }

  // ─── Özet ────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  SONUÇLAR');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Toplam:   ${TOTAL_CAPTCHAS}`);
  console.log(`  Çözülen:  ${successCount} (≥4 karakter)`);
  console.log(`  Başarısız: ${failCount}`);
  console.log(`  Oran:     ${((successCount / TOTAL_CAPTCHAS) * 100).toFixed(1)}%`);
  console.log(`  Çıktı:    ${OUTPUT_DIR}`);

  const avgElapsed = results.filter(r => r.elapsed > 0).reduce((a, b) => a + b.elapsed, 0) /
    results.filter(r => r.elapsed > 0).length;
  console.log(`  Ort süre: ${avgElapsed.toFixed(1)}ms`);

  console.log('\n  Çözümler:');
  results.forEach(r => {
    const mark = r.valid ? '✓' : '✗';
    const sol = r.solution || r.error || 'BOŞ';
    console.log(`    ${mark} #${String(r.index).padStart(2, '0')}: "${sol}" (${r.length} kar, ${r.elapsed}ms)`);
  });

  console.log('═══════════════════════════════════════════════════════════\n');

  // JSON sonuç dosyası
  const jsonPath = path.join(OUTPUT_DIR, '_results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`Detaylı sonuçlar: ${jsonPath}`);
}

main().catch(console.error);
