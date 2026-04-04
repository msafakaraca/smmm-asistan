/**
 * INTVRG Beyanname Kontrol API — TEST MODÜLÜ
 * ============================================
 * İnternet Vergi Dairesi (INTVRG) üzerinden beyanname sorgulama ve PDF indirme.
 * Mevcut ebeyanname-api.ts'den BAĞIMSIZ çalışır.
 *
 * Akış: GİB Dijital Login → IVD Token → INTVRG Dispatch → Beyanname Ara → PDF İndir
 */

import { gibDijitalLogin } from './earsiv-dijital-api';
import { getIvdToken, IntrvrgClient, INTVRG_BASE } from './intvrg-tahsilat-api';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/** INTVRG beyanname arama sonucu (tek kayıt) */
export interface IntrvrgBeyannameItem {
  beyannameKodu: string;
  beyannameTuru: string;
  durum: string;           // "0"=Hatalı, "1"=Onay Bekliyor, "2"=Onaylandı, "3"=İptal
  tckn: string;
  unvan: string;
  vergiDairesi: string;
  donem: string;           // "01/2026-01/2026"
  yuklemezamani: string;   // "23.02.2026 - 15:26:26"
  beyannameOid: string;
  tahakkukOid: string;
  mesajvar: string;
  ihbarnamekesildi: number;
  onaylanabilir: string;
  subeno: number;
}

/** Beyanname arama response */
interface BeyannameSearchResponse {
  data: {
    data: IntrvrgBeyannameItem[];
    rowcount: number;
    page: number;
  };
}

/** SGK bildirge detay — thkhaberlesme yapısı */
interface ThkHaberlesme {
  durum: string;
  onaylanabilir: string;
  aciklama: string;
  bynthkoid: string;
  mesajvar: string;
  bynihb: string;
  thkoid: string;
  donem: string;
}

/** SGK bildirge detay response */
interface SgkBildirgeResponse {
  data: {
    beyanname_durum: string;
    bildirim_sayisi: string;
    beyannameoid: string;
    [key: string]: unknown; // thkhaberlesme1, thkhaberlesme2, ...
  };
}

/** PDF indirme sonucu */
export interface PdfDownloadResult {
  success: boolean;
  type: 'beyanname' | 'tahakkuk' | 'sgk-tahakkuk' | 'sgk-hizmet';
  size: number;
  buffer?: string; // base64
  error?: string;
}

/** Pipeline istatistikleri */
export interface IntrvrgTestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDuration: number;       // ms
  avgResponseTime: number;     // ms
  rateLimitHits: number;
  tokenStatus: 'active' | 'expired' | 'unknown';
  pdfStats: {
    attempted: number;
    downloaded: number;
    totalSize: number;         // bytes
    errors: number;
  };
}

/** Pipeline seçenekleri */
export interface IntrvrgTestOptions {
  tenantId: string;
  username: string;
  password: string;
  captchaKey: string;
  ocrSpaceApiKey?: string;
  // Tarih aralığı (yükleme tarihi — YYYYMMDD)
  baslangicTarihi: string;
  bitisTarihi: string;
  // Dönem
  donemBasAy: string;
  donemBasYil: string;
  donemBitAy: string;
  donemBitYil: string;
  // Filtreler
  durumFiltresi?: 'onaylandi' | 'hatali' | 'tumu';
  // PDF indirme seçenekleri
  downloadBeyanname?: boolean;
  downloadTahakkuk?: boolean;
  downloadSgk?: boolean;
  // Callback
  onProgress: (type: string, payload: Record<string, unknown>) => void;
}

/** Pipeline sonucu */
export interface IntrvrgTestResult {
  success: boolean;
  beyannameler: IntrvrgBeyannameItem[];
  pdfResults: Map<string, PdfDownloadResult[]>;
  stats: IntrvrgTestStats;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════
// SABITLER
// ═══════════════════════════════════════════════════════════════════

const INTVRG_GORUNTULEME = `${INTVRG_BASE}/intvrg_server/goruntuleme`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const ITEMS_PER_PAGE = 25;

// Rate limit test — başlangıçta delay yok, hata alınırsa artır
let currentDelay = 0;

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Pipeline durdurma flag'i
let stopRequested = false;

export function stopIntrvrgTest(): void {
  stopRequested = true;
}

function checkStop(): void {
  if (stopRequested) {
    throw new Error('INTVRG_TEST_STOPPED: Kullanıcı tarafından durduruldu');
  }
}

// ═══════════════════════════════════════════════════════════════════
// BEYANNAME ARAMA
// ═══════════════════════════════════════════════════════════════════

/**
 * INTVRG üzerinden beyanname arama.
 * beyannameService_beyannameAra dispatch komutu kullanır.
 */
async function searchBeyannameler(
  client: IntrvrgClient,
  params: {
    donemBasAy: string;
    donemBasYil: string;
    donemBitAy: string;
    donemBitYil: string;
    baslangicTarihi: string;
    bitisTarihi: string;
    durum: { radiob: boolean; radiob1: boolean; radiob2: boolean; radiob3: boolean };
    pageNo?: number;
  },
): Promise<BeyannameSearchResponse> {
  const jp: Record<string, unknown> = {
    arsivde: false,
    sorguTipiN: 0,
    vergiNo: '',
    sorguTipiT: 0,
    tcKimlikNo: '',
    sorguTipiB: 0,
    beyannameTanim: '',
    sorguTipiP: 0,
    donemBasAy: params.donemBasAy,
    donemBasYil: params.donemBasYil,
    donemBitAy: params.donemBitAy,
    donemBitYil: params.donemBitYil,
    sorguTipiV: 0,
    vdKodu: '',
    sorguTipiZ: 1,
    tarihAraligi: {
      baslangicTarihi: params.baslangicTarihi,
      bitisTarihi: params.bitisTarihi,
    },
    sorguTipiD: 1,
    durum: params.durum,
  };

  // İlk sayfa için pageNo eklenmez
  if (params.pageNo && params.pageNo > 1) {
    jp.pageNo = params.pageNo;
  }

  return client.callDispatch<BeyannameSearchResponse>(
    'beyannameService_beyannameAra',
    jp,
  );
}

// ═══════════════════════════════════════════════════════════════════
// SGK BİLDİRGE DETAY
// ═══════════════════════════════════════════════════════════════════

/**
 * MUHSGK beyannamesi için SGK bildirge detay bilgilerini al.
 */
async function getSgkBildirgeDetail(
  client: IntrvrgClient,
  beyannameOid: string,
): Promise<SgkBildirgeResponse> {
  return client.callDispatch<SgkBildirgeResponse>(
    'sgkBildirgeIslemleri_bildirgeleriGetir',
    { beyannameOid },
  );
}

// ═══════════════════════════════════════════════════════════════════
// PDF İNDİRME
// ═══════════════════════════════════════════════════════════════════

/**
 * INTVRG goruntuleme endpoint'inden PDF indir.
 * @returns base64 encoded PDF buffer
 */
async function downloadPdf(
  url: string,
  ivdToken: string,
): Promise<{ buffer: string; size: number }> {
  const fullUrl = `${url}&token=${ivdToken}`;

  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/pdf,*/*',
      'Referer': `${INTVRG_BASE}/intvrg_side/main.jsp`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    const preview = errorBody.substring(0, 200);
    console.error(`[INTVRG-TEST] PDF HTTP ${response.status} | Content-Type: ${response.headers.get('content-type')} | Body: ${preview}`);
    throw new Error(`PDF_DOWNLOAD_FAILED: HTTP ${response.status} | ${preview}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // PDF geçerlilik kontrolü — detaylı hata mesajı
  const header = buffer.subarray(0, 20).toString('utf-8');
  if (buffer.length < 100) {
    console.error(`[INTVRG-TEST] PDF çok kısa: ${buffer.length} byte | Content-Type: ${contentType} | Header: ${header}`);
    throw new Error(`PDF_INVALID: Çok kısa response (${buffer.length} byte) | Content-Type: ${contentType} | İlk karakterler: ${header}`);
  }

  if (!header.startsWith('%PDF')) {
    const bodyPreview = buffer.subarray(0, 300).toString('utf-8');
    console.error(`[INTVRG-TEST] PDF değil: Content-Type: ${contentType} | Boyut: ${buffer.length} | İlk 300 karakter: ${bodyPreview}`);

    // Günlük kota aşımı kontrolü — pipeline'ı durdur
    if (bodyPreview.includes('kota') || bodyPreview.includes('günlük')) {
      throw new Error('QUOTA_EXCEEDED: Günlük PDF indirme kotası doldu');
    }

    throw new Error(`PDF_INVALID: %PDF header yok | Content-Type: ${contentType} | Boyut: ${buffer.length} | Başlangıç: ${header.substring(0, 50)}`);
  }

  return {
    buffer: buffer.toString('base64'),
    size: buffer.length,
  };
}

/** OID'yi URL-safe encode et (½, }, ! gibi özel karakterler için) */
function encodeOid(oid: string): string {
  return encodeURIComponent(oid);
}

/** Beyanname PDF indir */
async function downloadBeyannamePdf(
  beyannameOid: string,
  ivdToken: string,
): Promise<PdfDownloadResult> {
  try {
    const url = `${INTVRG_GORUNTULEME}?cmd=IMAJ&subcmd=BEYANNAMEGORUNTULE&beyannameOid=${encodeOid(beyannameOid)}&USERID=&inline=true&goruntuTip=1`;
    const { buffer, size } = await downloadPdf(url, ivdToken);
    return { success: true, type: 'beyanname', size, buffer };
  } catch (e) {
    return { success: false, type: 'beyanname', size: 0, error: (e as Error).message };
  }
}

/** Vergi tahakkuk PDF indir */
async function downloadTahakkukPdf(
  tahakkukOid: string,
  beyannameOid: string,
  ivdToken: string,
): Promise<PdfDownloadResult> {
  try {
    const url = `${INTVRG_GORUNTULEME}?cmd=IMAJ&subcmd=TAHAKKUKGORUNTULE&tahakkukOid=${encodeOid(tahakkukOid)}&beyannameOid=${encodeOid(beyannameOid)}&USERID=&inline=true&goruntuTip=1`;
    const { buffer, size } = await downloadPdf(url, ivdToken);
    return { success: true, type: 'tahakkuk', size, buffer };
  } catch (e) {
    return { success: false, type: 'tahakkuk', size: 0, error: (e as Error).message };
  }
}

/** SGK tahakkuk PDF indir */
async function downloadSgkTahakkukPdf(
  sgkThkOid: string,
  ivdToken: string,
): Promise<PdfDownloadResult> {
  try {
    const url = `${INTVRG_GORUNTULEME}?cmd=IMAJ&subcmd=SGKTAHAKKUKGORUNTULE&sgkTahakkukOid=${encodeOid(sgkThkOid)}&USERID=&inline=true&goruntuTip=1`;
    const { buffer, size } = await downloadPdf(url, ivdToken);
    return { success: true, type: 'sgk-tahakkuk', size, buffer };
  } catch (e) {
    return { success: false, type: 'sgk-tahakkuk', size: 0, error: (e as Error).message };
  }
}

/** SGK hizmet listesi PDF indir */
async function downloadSgkHizmetPdf(
  sgkThkOid: string,
  beyannameOid: string,
  ivdToken: string,
): Promise<PdfDownloadResult> {
  try {
    const url = `${INTVRG_GORUNTULEME}?cmd=IMAJ&subcmd=SGKHIZMETGORUNTULE&sgkTahakkukOid=${encodeOid(sgkThkOid)}&beyannameOid=${encodeOid(beyannameOid)}&USERID=&inline=true&goruntuTip=1`;
    const { buffer, size } = await downloadPdf(url, ivdToken);
    return { success: true, type: 'sgk-hizmet', size, buffer };
  } catch (e) {
    return { success: false, type: 'sgk-hizmet', size: 0, error: (e as Error).message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// ANA PIPELINE
// ═══════════════════════════════════════════════════════════════════

/**
 * INTVRG Beyanname Test Pipeline.
 * Rate limit testi, beyanname arama, PDF indirme test.
 */
export async function runIntrvrgBeyannamePipeline(
  options: IntrvrgTestOptions,
): Promise<IntrvrgTestResult> {
  stopRequested = false;
  currentDelay = 0;

  const stats: IntrvrgTestStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalDuration: 0,
    avgResponseTime: 0,
    rateLimitHits: 0,
    tokenStatus: 'unknown',
    pdfStats: { attempted: 0, downloaded: 0, totalSize: 0, errors: 0 },
  };

  const responseTimes: number[] = [];
  const allBeyannameler: IntrvrgBeyannameItem[] = [];
  const pdfResults = new Map<string, PdfDownloadResult[]>();
  const startTime = Date.now();

  const sendProgress = (message: string, progress?: number) => {
    options.onProgress('progress', { message, progress: progress ?? 0 });
  };

  const sendResults = (beyannameler: IntrvrgBeyannameItem[]) => {
    options.onProgress('results', {
      beyannameler,
      stats: { ...stats, totalDuration: Date.now() - startTime },
    });
  };

  try {
    // ═══════════════════════════════════════════
    // 1. GİB Dijital Login
    // ═══════════════════════════════════════════
    sendProgress('GİB Dijital VD\'ye giriş yapılıyor...', 5);

    const bearerToken = await gibDijitalLogin(
      options.username,
      options.password,
      options.captchaKey,
      options.ocrSpaceApiKey,
      (msg: string) => sendProgress(msg),
    );
    stats.totalRequests++;
    stats.successfulRequests++;
    checkStop();

    // ═══════════════════════════════════════════
    // 2. IVD Token
    // ═══════════════════════════════════════════
    sendProgress('İnternet Vergi Dairesi oturumu açılıyor...', 10);

    const ivdToken = await getIvdToken(bearerToken);
    stats.totalRequests++;
    stats.successfulRequests++;
    stats.tokenStatus = 'active';
    checkStop();

    // ═══════════════════════════════════════════
    // 3. IntrvrgClient oluştur
    // ═══════════════════════════════════════════
    const client = new IntrvrgClient(ivdToken, '');

    // Durum filtresi
    const durum = {
      radiob: options.durumFiltresi === 'tumu',
      radiob1: false,
      radiob2: options.durumFiltresi === 'onaylandi' || !options.durumFiltresi,
      radiob3: options.durumFiltresi === 'hatali',
    };

    // ═══════════════════════════════════════════
    // 4. Beyanname Arama (tüm sayfalar)
    // ═══════════════════════════════════════════
    sendProgress('Beyannameler aranıyor...', 15);

    let page = 1;
    let totalPages = 1;

    do {
      checkStop();
      const reqStart = Date.now();

      try {
        const result = await searchBeyannameler(client, {
          donemBasAy: options.donemBasAy,
          donemBasYil: options.donemBasYil,
          donemBitAy: options.donemBitAy,
          donemBitYil: options.donemBitYil,
          baslangicTarihi: options.baslangicTarihi,
          bitisTarihi: options.bitisTarihi,
          durum,
          pageNo: page,
        });

        const elapsed = Date.now() - reqStart;
        responseTimes.push(elapsed);
        stats.totalRequests++;
        stats.successfulRequests++;

        const items = result.data?.data || [];
        const rowcount = result.data?.rowcount || 0;
        totalPages = Math.ceil(rowcount / ITEMS_PER_PAGE);

        allBeyannameler.push(...items);

        const progressPct = 15 + Math.floor((page / Math.max(totalPages, 1)) * 25);
        sendProgress(
          `Sayfa ${page}/${totalPages} çekildi (${allBeyannameler.length}/${rowcount} beyanname, ${elapsed}ms)`,
          progressPct,
        );

        console.log(`[INTVRG-TEST] Sayfa ${page}/${totalPages}: ${items.length} kayıt, ${elapsed}ms`);

      } catch (e) {
        const elapsed = Date.now() - reqStart;
        stats.totalRequests++;
        stats.failedRequests++;

        const errMsg = (e as Error).message;
        console.error(`[INTVRG-TEST] Sayfa ${page} hatası (${elapsed}ms): ${errMsg}`);

        // Rate limit kontrolü
        if (errMsg.includes('429') || errMsg.includes('rate') || errMsg.includes('1 sn')) {
          stats.rateLimitHits++;
          currentDelay = Math.min(currentDelay + 500, 3000);
          sendProgress(`Rate limit algılandı! ${currentDelay}ms bekleniyor...`);
          await sleep(currentDelay);
          continue; // Aynı sayfayı tekrar dene
        }

        // Token expire
        if (errMsg.includes('401') || errMsg.includes('SESSION_EXPIRED')) {
          stats.tokenStatus = 'expired';
          throw e;
        }
      }

      // Delay (rate limit testi — başta 0)
      if (currentDelay > 0 && page < totalPages) {
        await sleep(currentDelay);
      }

      page++;
    } while (page <= totalPages);

    // Arama sonuçlarını gönder
    sendResults(allBeyannameler);
    sendProgress(`${allBeyannameler.length} beyanname bulundu. PDF indirme başlıyor...`, 40);

    // ═══════════════════════════════════════════
    // 5. PDF İndirme (opsiyonel)
    // ═══════════════════════════════════════════
    const downloadByn = options.downloadBeyanname !== false;
    const downloadThk = options.downloadTahakkuk !== false;
    const downloadSgk = options.downloadSgk !== false;

    if (downloadByn || downloadThk || downloadSgk) {
      const totalToProcess = allBeyannameler.length;
      let quotaExceeded = false;

      for (let i = 0; i < allBeyannameler.length; i++) {
        checkStop();
        if (quotaExceeded) break;
        const byn = allBeyannameler[i];
        const bynPdfResults: PdfDownloadResult[] = [];

        const pdfProgress = 40 + Math.floor((i / totalToProcess) * 55);
        sendProgress(
          `PDF indiriliyor: ${byn.unvan} — ${byn.beyannameKodu} (${i + 1}/${totalToProcess})`,
          pdfProgress,
        );

        // PDF sonucu işle ve kota kontrolü yap
        const processPdfResult = (result: PdfDownloadResult) => {
          if (result.success) {
            stats.successfulRequests++;
            stats.pdfStats.downloaded++;
            stats.pdfStats.totalSize += result.size;
          } else {
            stats.failedRequests++;
            stats.pdfStats.errors++;
            if (result.error?.includes('QUOTA_EXCEEDED')) {
              quotaExceeded = true;
              sendProgress('⚠️ Günlük PDF indirme kotası doldu! PDF indirme durduruluyor...');
            }
          }
          bynPdfResults.push({ ...result, buffer: undefined });
        };

        // Beyanname PDF
        if (downloadByn && byn.beyannameOid && !quotaExceeded) {
          stats.pdfStats.attempted++;
          const reqStart = Date.now();
          const result = await downloadBeyannamePdf(byn.beyannameOid, ivdToken);
          responseTimes.push(Date.now() - reqStart);
          stats.totalRequests++;
          processPdfResult(result);
          if (currentDelay > 0) await sleep(currentDelay);
        }

        // Tahakkuk PDF
        if (downloadThk && byn.tahakkukOid && !quotaExceeded) {
          stats.pdfStats.attempted++;
          const reqStart = Date.now();
          const result = await downloadTahakkukPdf(byn.tahakkukOid, byn.beyannameOid, ivdToken);
          responseTimes.push(Date.now() - reqStart);
          stats.totalRequests++;
          processPdfResult(result);
          if (currentDelay > 0) await sleep(currentDelay);
        }

        // SGK detay (MUHSGK)
        if (downloadSgk && byn.beyannameKodu === 'MUHSGK' && !quotaExceeded) {
          try {
            stats.totalRequests++;
            const sgkDetail = await getSgkBildirgeDetail(client, byn.beyannameOid);
            stats.successfulRequests++;

            // thkhaberlesme2+ → SGK PDF'leri
            const thkKeys = Object.keys(sgkDetail.data)
              .filter(k => k.startsWith('thkhaberlesme') && k !== 'thkhaberlesme1');

            for (const key of thkKeys) {
              checkStop();
              if (quotaExceeded) break;
              const thk = sgkDetail.data[key] as ThkHaberlesme;
              if (!thk?.thkoid) continue;

              // SGK Tahakkuk PDF
              const sgkIdx = key.replace('thkhaberlesme', '');
              stats.pdfStats.attempted++;
              const sgkThkResult = await downloadSgkTahakkukPdf(thk.thkoid, ivdToken);
              stats.totalRequests++;
              processPdfResult(sgkThkResult);

              if (currentDelay > 0) await sleep(currentDelay);
              if (quotaExceeded) break;

              // SGK Hizmet Listesi PDF
              stats.pdfStats.attempted++;
              const sgkHizResult = await downloadSgkHizmetPdf(thk.thkoid, byn.beyannameOid, ivdToken);
              stats.totalRequests++;
              processPdfResult(sgkHizResult);

              if (currentDelay > 0) await sleep(currentDelay);
            }
          } catch (e) {
            stats.totalRequests++;
            stats.failedRequests++;
            console.error(`[INTVRG-TEST] SGK detay hatası (${byn.beyannameOid}): ${(e as Error).message}`);
          }
        }

        pdfResults.set(byn.beyannameOid, bynPdfResults);
      }
    }

    // ═══════════════════════════════════════════
    // 6. Tamamlama
    // ═══════════════════════════════════════════
    stats.totalDuration = Date.now() - startTime;
    stats.avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    sendProgress('Test tamamlandı!', 100);

    options.onProgress('complete', {
      beyannameler: allBeyannameler,
      pdfResults: Object.fromEntries(pdfResults),
      stats,
    });

    return {
      success: true,
      beyannameler: allBeyannameler,
      pdfResults,
      stats,
    };

  } catch (e) {
    stats.totalDuration = Date.now() - startTime;
    stats.avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    const errMsg = (e as Error).message;
    console.error(`[INTVRG-TEST] Pipeline hatası: ${errMsg}`);

    options.onProgress('error', {
      error: errMsg,
      stats,
    });

    return {
      success: false,
      beyannameler: allBeyannameler,
      pdfResults,
      stats,
      error: errMsg,
    };
  }
}
