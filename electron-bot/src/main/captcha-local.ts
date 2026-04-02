/**
 * Lokal CAPTCHA Çözücü — ddddocr ONNX Model
 * =============================================
 * ddddocr'un hazır eğitilmiş modelini onnxruntime-node ile çalıştırır.
 * Dış API'ye bağımlılık olmadan, ~10ms'de captcha çözer.
 *
 * Model: ddddocr common_old.onnx (13.6MB, 8210 sınıf)
 * Doğruluk: GİB captcha'larında ~%95
 * Fallback: Çözüm başarısız olursa yeni captcha istenir ve tekrar denenir
 */

import * as path from 'path';
import * as fs from 'fs';

// ═══════════════════════════════════════════════════════════════════════════
// Konfigürasyon
// ═══════════════════════════════════════════════════════════════════════════

const IMG_HEIGHT = 64;
const NUM_CLASSES = 8210; // ddddocr charset boyutu
const MAX_RETRY = 5; // Captcha retry sayısı
const GIB_CAPTCHA_URL = 'https://dijital.gib.gov.tr/apigateway/captcha/getnewcaptcha';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ═══════════════════════════════════════════════════════════════════════════
// ONNX Session & Charset (lazy singleton)
// ═══════════════════════════════════════════════════════════════════════════

let onnxSession: any = null;
let onnxLoadFailed = false;
let charset: string[] = [];

function findModelPath(): string | null {
  const candidates = [
    path.join(__dirname, '..', '..', 'models', 'ddddocr.onnx'),
    path.join(__dirname, '..', '..', '..', 'electron-bot', 'models', 'ddddocr.onnx'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findCharsetPath(): string | null {
  const candidates = [
    path.join(__dirname, '..', '..', 'models', 'ddddocr_charset.json'),
    path.join(__dirname, '..', '..', '..', 'electron-bot', 'models', 'ddddocr_charset.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function getSession(): Promise<any | null> {
  if (onnxLoadFailed) return null;
  if (onnxSession) return onnxSession;

  try {
    const ort = require('onnxruntime-node');

    const modelPath = findModelPath();
    if (!modelPath) {
      console.log('[CAPTCHA-LOCAL] ddddocr model dosyasi bulunamadi');
      onnxLoadFailed = true;
      return null;
    }

    const charsetPath = findCharsetPath();
    if (!charsetPath) {
      console.log('[CAPTCHA-LOCAL] ddddocr charset dosyasi bulunamadi');
      onnxLoadFailed = true;
      return null;
    }

    // Charset yükle
    const charsetRaw = fs.readFileSync(charsetPath, 'utf-8');
    charset = JSON.parse(charsetRaw);
    console.log(`[CAPTCHA-LOCAL] Charset yuklendi: ${charset.length} karakter`);

    // Model yükle
    console.log(`[CAPTCHA-LOCAL] Model yukleniyor: ${modelPath}`);
    onnxSession = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });

    console.log('[CAPTCHA-LOCAL] ddddocr model basariyla yuklendi');
    return onnxSession;
  } catch (e) {
    console.log(`[CAPTCHA-LOCAL] ONNX yukleme hatasi: ${(e as Error).message}`);
    onnxLoadFailed = true;
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Görüntü İşleme — ddddocr pipeline'ı ile birebir
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Base64 PNG → grayscale piksel + boyut bilgisi.
 * Electron nativeImage ile decode eder.
 */
function decodeImage(base64Str: string): { gray: Uint8Array; width: number; height: number } | null {
  try {
    const clean = base64Str.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(clean, 'base64');

    const { nativeImage } = require('electron');
    const image = nativeImage.createFromBuffer(buffer);
    const size = image.getSize();
    const bitmap = image.toBitmap(); // BGRA format

    const w = size.width;
    const h = size.height;
    const gray = new Uint8Array(w * h);

    for (let i = 0; i < w * h; i++) {
      const b = bitmap[i * 4];
      const g = bitmap[i * 4 + 1];
      const r = bitmap[i * 4 + 2];
      gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    return { gray, width: w, height: h };
  } catch (e) {
    console.log(`[CAPTCHA-LOCAL] Goruntu decode hatasi: ${(e as Error).message}`);
    return null;
  }
}

/**
 * ddddocr preprocessing:
 * 1. Height=64'e resize (genişlik orantılı)
 * 2. Grayscale
 * 3. Normalize: pixel / 255.0
 * 4. Shape: [1, 1, 64, newWidth]
 */
function preprocessImage(
  grayPixels: Uint8Array,
  srcWidth: number,
  srcHeight: number,
): { data: Float32Array; width: number } {
  // Hedef yükseklik 64, genişlik orantılı
  const newWidth = Math.round(srcWidth * (IMG_HEIGHT / srcHeight));
  const newHeight = IMG_HEIGHT;

  // Bilinear resize
  const resized = bilinearResize(grayPixels, srcWidth, srcHeight, newWidth, newHeight);

  // Normalize: pixel / 255.0
  const input = new Float32Array(newHeight * newWidth);
  for (let i = 0; i < resized.length; i++) {
    input[i] = resized[i] / 255.0;
  }

  return { data: input, width: newWidth };
}

function bilinearResize(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8Array {
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

// ═══════════════════════════════════════════════════════════════════════════
// CTC Decode
// ═══════════════════════════════════════════════════════════════════════════

/**
 * CTC greedy decode — ddddocr output format.
 * Output shape: (seq_len, 1, 8210) flattened
 * Index 0 = blank (charset[0] = "")
 */
function ctcDecode(logits: Float32Array, seqLen: number): string {
  const decoded: string[] = [];
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

    // CTC: blank (0) ve ardışık tekrarları atla
    if (maxIdx !== 0 && maxIdx !== prev) {
      const ch = charset[maxIdx] || '';
      if (ch) decoded.push(ch);
    }
    prev = maxIdx;
  }

  return decoded.join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// GİB Captcha İstekleri
// ═══════════════════════════════════════════════════════════════════════════

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Language': 'tr-TR,tr;q=0.9',
    'User-Agent': USER_AGENT,
    'Cookie': 'i18next=tr',
    'Origin': 'https://dijital.gib.gov.tr',
    'Referer': 'https://dijital.gib.gov.tr/',
  };
}

interface CaptchaResult {
  cid: string;
  solution: string;
}

/**
 * GİB'den yeni captcha al ve lokal model ile çöz.
 * Başarısız olursa yeni captcha isteyip tekrar dener (max MAX_RETRY).
 */
export async function fetchAndSolveCaptcha(
  onProgress?: (status: string) => void,
): Promise<CaptchaResult> {
  const session = await getSession();
  if (!session) {
    throw new Error('CAPTCHA_FAILED: ddddocr model yuklenemedi');
  }

  const ort = require('onnxruntime-node');

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      onProgress?.(`Captcha aliniyor (${attempt}/${MAX_RETRY})...`);

      // 1. GİB'den captcha al
      const captchaResponse = await fetch(GIB_CAPTCHA_URL, { headers: getHeaders() });
      if (!captchaResponse.ok) {
        console.log(`[CAPTCHA-LOCAL] Captcha API hatasi: ${captchaResponse.status}`);
        continue;
      }

      const captchaData = await captchaResponse.json();
      const cid = captchaData.cid || `captcha_${Date.now()}`;
      const imgBase64: string = captchaData.captchaImgBase64 || '';

      if (!imgBase64 || imgBase64.length < 100) {
        console.log('[CAPTCHA-LOCAL] Captcha gorseli alinamadi');
        continue;
      }

      // 2. Decode + preprocess
      const cleanBase64 = imgBase64.replace(/^data:image\/\w+;base64,/, '');
      const decoded = decodeImage(cleanBase64);
      if (!decoded) {
        console.log('[CAPTCHA-LOCAL] Goruntu decode basarisiz');
        continue;
      }

      const { data: inputData, width: inputWidth } = preprocessImage(
        decoded.gray,
        decoded.width,
        decoded.height,
      );

      // 3. ONNX inference
      const t0 = Date.now();
      const inputTensor = new ort.Tensor('float32', inputData, [1, 1, IMG_HEIGHT, inputWidth]);
      const results = await session.run({ input1: inputTensor });

      // Output tensor adı: "387"
      const output = results['387'];
      const dims = output.dims; // [seq_len, 1, 8210]
      const seqLen = dims[0];

      // 4. CTC decode
      const text = ctcDecode(output.data as Float32Array, seqLen);
      const elapsed = Date.now() - t0;

      console.log(`[CAPTCHA-LOCAL] Deneme ${attempt}: '${text}' (${elapsed}ms)`);

      // 5. Minimum uzunluk kontrolü (GİB captcha'ları 5 karakter)
      if (text.length < 4) {
        console.log(`[CAPTCHA-LOCAL] Sonuc cok kisa (${text.length}), yeni captcha deneniyor...`);
        continue;
      }

      onProgress?.(`Captcha cozuldu: ${text}`);
      return { cid, solution: text };
    } catch (e) {
      console.log(`[CAPTCHA-LOCAL] Deneme ${attempt} hatasi: ${(e as Error).message}`);
      continue;
    }
  }

  throw new Error(`CAPTCHA_FAILED: ${MAX_RETRY} denemede captcha cozulemedi`);
}

/**
 * Tek bir base64 görselini çöz (eski API uyumluluğu).
 */
export async function solveCaptchaLocal(base64Image: string): Promise<string | null> {
  const t0 = Date.now();

  try {
    const session = await getSession();
    if (!session) return null;

    const ort = require('onnxruntime-node');

    const decoded = decodeImage(base64Image);
    if (!decoded) return null;

    const { data: inputData, width: inputWidth } = preprocessImage(
      decoded.gray,
      decoded.width,
      decoded.height,
    );

    const inputTensor = new ort.Tensor('float32', inputData, [1, 1, IMG_HEIGHT, inputWidth]);
    const results = await session.run({ input1: inputTensor });

    const output = results['387'];
    const seqLen = output.dims[0];
    const text = ctcDecode(output.data as Float32Array, seqLen);

    const elapsed = Date.now() - t0;
    console.log(`[CAPTCHA-LOCAL] Cozum: '${text}' (${elapsed}ms)`);

    if (text.length < 4) {
      console.log(`[CAPTCHA-LOCAL] Sonuc cok kisa (${text.length} karakter)`);
      return null;
    }

    return text;
  } catch (e) {
    console.log(`[CAPTCHA-LOCAL] Hata: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Model kullanılabilir durumda mı?
 */
export function isLocalModelAvailable(): boolean {
  return !onnxLoadFailed && findModelPath() !== null && findCharsetPath() !== null;
}

/**
 * Model bilgilerini döndür.
 */
export function getModelInfo(): { available: boolean; modelPath: string | null; charsetPath: string | null } {
  return {
    available: isLocalModelAvailable(),
    modelPath: findModelPath(),
    charsetPath: findCharsetPath(),
  };
}
