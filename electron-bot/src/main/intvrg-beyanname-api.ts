/**
 * INTVRG Beyanname Sorgulama API Modülü
 * ======================================
 * GİB İnternet Vergi Dairesi (INTVRG) üzerinden beyanname listesi sorgulama.
 *
 * Akış: GİB Dijital VD Login → IVD Token → INTVRG Dispatch → Beyanname Sorgusu
 *
 * Token Yönetimi: PDF indirme sırasında token süresi dolduğunda otomatik
 * yenileme ve başarısız PDF'leri tekrar deneme mekanizması.
 *
 * Referans: intvrg-tahsilat-api.ts pattern'i
 */

import { gibDijitalLogin } from './earsiv-dijital-api';
import { getIvdToken, IntrvrgClient, INTVRG_BASE } from './intvrg-tahsilat-api';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** Beyanname satırı (GİB API'den gelen ham veri) */
export interface BeyannameItem {
  turKodu: string;
  turAdi: string;
  donem: string;
  donemFormatli: string;
  versiyon: string;
  kaynak: string;
  aciklama: string;
  beyoid: string;
}

/** Beyanname sorgu sonucu */
export interface BeyannameQueryResult {
  success: boolean;
  vkntckn: string;
  sorgudonemi: string;
  toplamBeyannameSayisi: number;
  beyannameler: BeyannameItem[];
  ivdToken?: string;
  error?: string;
}

/** Sorgulama parametreleri */
export interface BeyannameQueryParams {
  userid: string;
  password: string;
  vkn: string;
  basAy: string;
  basYil: string;
  bitAy: string;
  bitYil: string;
  captchaApiKey: string;
  ocrSpaceApiKey?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Token State — Pipeline boyunca paylaşılan mutable token durumu
// ═══════════════════════════════════════════════════════════════════════════

interface PipelineTokenState {
  ivdToken: string;
  bearerToken: string;
  timestamp: number;
}

/** Token süresinin dolduğunu gösteren hata mesajları */
function isTokenExpiredError(error?: string): boolean {
  if (!error) return false;
  return (
    error.includes('hata döndürdü') ||
    error.includes('Oturum süresi') ||
    error.includes('HTTP 401') ||
    error.includes('HTTP 403')
  );
}

/** Token yenileme — 15 dakikadan eski veya zorunlu yenileme */
const TOKEN_PROACTIVE_REFRESH_MS = 15 * 60 * 1000; // 15 dakika

async function refreshTokenIfNeeded(
  tokenState: PipelineTokenState,
  params: BeyannameQueryParams,
  force: boolean = false,
): Promise<void> {
  const elapsed = Date.now() - tokenState.timestamp;
  if (!force && elapsed < TOKEN_PROACTIVE_REFRESH_MS) return;

  console.log(`[PIPELINE-TOKEN] Token yenileniyor (${Math.round(elapsed / 1000)}s eski, force=${force})...`);
  tokenState.bearerToken = await gibDijitalLogin(
    params.userid,
    params.password,
    params.captchaApiKey,
    params.ocrSpaceApiKey,
  );
  tokenState.ivdToken = await getIvdToken(tokenState.bearerToken);
  tokenState.timestamp = Date.now();
  console.log(`[PIPELINE-TOKEN] Token yenilendi`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Beyanname Türü Mapping
// ═══════════════════════════════════════════════════════════════════════════

const BEYANNAME_TURU_MAP: Record<string, string> = {
  'KDV1': 'KDV1 Beyannamesi',
  'KDV2': 'KDV2 Beyannamesi',
  'KONAKLAMA': 'Konaklama Vergisi Beyannamesi',
  'KGECICI': 'Kurumlar Geçici Vergi Beyannamesi',
  'GGECICI': 'Gelir Geçici Vergi Beyannamesi',
  'MUHSGK': 'Muhtasar ve Prim Hizmet Beyannamesi',
  'TURIZM': 'Turizm Payı Beyannamesi',
  'GELIR': 'Yıllık Gelir Vergisi Beyannamesi',
  'KURUMLAR': 'Kurumlar Vergisi Beyannamesi',
  'DAMGA': 'Damga Vergisi Beyannamesi',
  'BA': 'Ba Formu',
  'BS': 'Bs Formu',
  'FORMBA': 'FORMBA',
  'FORMBS': 'FORMBS',
};

function getBeyannameTurAdi(turKodu: string): string {
  return BEYANNAME_TURU_MAP[turKodu] || turKodu;
}

// ═══════════════════════════════════════════════════════════════════════════
// Dönem Parse Helper
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GİB dönem formatını okunabilir hale çevir.
 * "202501202501" → "01/2025-01/2025"
 * "202501" → "01/2025-01/2025"
 */
function formatDonem(donemStr: string): string {
  if (!donemStr) return donemStr;

  if (donemStr.length === 12) {
    const basYil = donemStr.substring(0, 4);
    const basAy = donemStr.substring(4, 6);
    const bitYil = donemStr.substring(6, 10);
    const bitAy = donemStr.substring(10, 12);
    return `${basAy}/${basYil}-${bitAy}/${bitYil}`;
  }

  if (donemStr.length === 6) {
    const yil = donemStr.substring(0, 4);
    const ay = donemStr.substring(4, 6);
    return `${ay}/${yil}-${ay}/${yil}`;
  }

  return donemStr;
}

// ═══════════════════════════════════════════════════════════════════════════
// Ham beyanname parse — tekrarlayan kodu tek yere topla
// ═══════════════════════════════════════════════════════════════════════════

function parseRawBeyannameler(rawItems: Array<Record<string, string>>): BeyannameItem[] {
  return rawItems.map((item) => {
    const rawTur = item.beyanname_turu || item.beyannameturu || '';
    const lastUnderscoreIdx = rawTur.lastIndexOf('_');
    const turKodu = lastUnderscoreIdx > 0 ? rawTur.substring(0, lastUnderscoreIdx) : rawTur;
    const versiyon = lastUnderscoreIdx > 0 ? rawTur.substring(lastUnderscoreIdx + 1) : '0';
    const beyoid = item.beyoid || item.beyannameOid || item.beyannameoid
      || item.BEYANNAMEOID || item.beyanname_oid || '';

    return {
      turKodu,
      turAdi: getBeyannameTurAdi(turKodu),
      donem: item.donem || '',
      donemFormatli: formatDonem(item.donem || ''),
      versiyon,
      kaynak: item.kaynak || '',
      aciklama: item.aciklama || '',
      beyoid,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Ana Orchestration — Tek yıl sorgu (pipeline dışı)
// ═══════════════════════════════════════════════════════════════════════════

export async function queryBeyannameler(
  params: BeyannameQueryParams,
  onProgress?: (status: string) => void,
  onResults?: (beyannameler: BeyannameItem[]) => void,
): Promise<BeyannameQueryResult> {
  try {
    onProgress?.('GİB Dijital VD\'ye giriş yapılıyor...');
    const bearerToken = await gibDijitalLogin(
      params.userid,
      params.password,
      params.captchaApiKey,
      params.ocrSpaceApiKey,
      onProgress,
    );

    onProgress?.('İnternet Vergi Dairesi oturumu açılıyor...');
    const ivdToken = await getIvdToken(bearerToken);

    const client = new IntrvrgClient(ivdToken, params.vkn);

    onProgress?.('Beyannameler sorgulanıyor...');
    const result = await client.callDispatch<{
      data: {
        beyanname?: { beyanname?: Array<Record<string, string>> };
        donem?: string;
      };
    }>(
      'beyannameIslemleri_beyannameSorgulaSorgu',
      {
        vkn: { vkn: params.vkn },
        basDonem: { ay: params.basAy, yil: params.basYil },
        bitDonem: { ay: params.bitAy, yil: params.bitYil },
      },
    );

    const rawBeyannameler = result.data?.beyanname?.beyanname || [];
    console.log(`[INTVRG-BEYANNAME] ${rawBeyannameler.length} beyanname bulundu`);

    if (rawBeyannameler.length > 0) {
      console.log('[BEYOID-DEBUG] Raw item keys:', Object.keys(rawBeyannameler[0]));
      console.log('[BEYOID-DEBUG] Sample:', JSON.stringify(rawBeyannameler[0]).substring(0, 500));
    }

    const beyannameler = parseRawBeyannameler(rawBeyannameler);

    onProgress?.(`${beyannameler.length} beyanname bulundu`);
    onResults?.(beyannameler);

    const queryResult: BeyannameQueryResult = {
      success: true,
      vkntckn: params.vkn,
      sorgudonemi: `${params.basAy}/${params.basYil} - ${params.bitAy}/${params.bitYil}`,
      toplamBeyannameSayisi: beyannameler.length,
      beyannameler,
      ivdToken,
    };

    console.log(`[INTVRG-BEYANNAME] Beyanname sorgulaması tamamlandı: ${beyannameler.length} beyanname`);
    return queryResult;

  } catch (e: unknown) {
    const error = e as Error;
    console.error(`[INTVRG-BEYANNAME] Beyanname sorgulama hatası: ${error.message}`);
    return {
      success: false,
      vkntckn: params.vkn,
      sorgudonemi: `${params.basAy}/${params.basYil} - ${params.bitAy}/${params.bitYil}`,
      toplamBeyannameSayisi: 0,
      beyannameler: [],
      error: error.message,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Çoklu Yıl Chunk Desteği
// ═══════════════════════════════════════════════════════════════════════════

export interface YearChunk {
  basAy: string;
  basYil: string;
  bitAy: string;
  bitYil: string;
}

export interface MultiYearCallbacks {
  onChunkProgress: (chunkIndex: number, totalChunks: number, year: string, status: string) => void;
  onChunkResults: (chunkIndex: number, totalChunks: number, year: string, beyannameler: BeyannameItem[]) => void;
  onAllComplete: (allItems: BeyannameItem[], ivdToken: string) => void;
}

export function splitIntoYearChunks(basAy: string, basYil: string, bitAy: string, bitYil: string): YearChunk[] {
  const startYear = parseInt(basYil, 10);
  const endYear = parseInt(bitYil, 10);

  if (startYear === endYear) {
    return [{ basAy, basYil, bitAy, bitYil }];
  }

  const chunks: YearChunk[] = [];
  for (let year = startYear; year <= endYear; year++) {
    chunks.push({
      basAy: year === startYear ? basAy : '01',
      basYil: String(year),
      bitAy: year === endYear ? bitAy : '12',
      bitYil: String(year),
    });
  }
  return chunks;
}

const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000;

export async function queryBeyannamelerMultiYear(
  params: BeyannameQueryParams,
  callbacks: MultiYearCallbacks,
  onProgress?: (status: string) => void,
): Promise<{ success: boolean; allBeyannameler: BeyannameItem[]; ivdToken: string; error?: string }> {
  const chunks = splitIntoYearChunks(params.basAy, params.basYil, params.bitAy, params.bitYil);
  const totalChunks = chunks.length;
  const allItems: BeyannameItem[] = [];

  console.log(`[INTVRG-BEYANNAME-MULTI] ${totalChunks} yıl chunk'ı oluşturuldu: ${chunks.map(c => c.basYil).join(', ')}`);

  onProgress?.('GİB Dijital VD\'ye giriş yapılıyor...');
  let bearerToken = await gibDijitalLogin(
    params.userid,
    params.password,
    params.captchaApiKey,
    params.ocrSpaceApiKey,
    onProgress,
  );

  onProgress?.('İnternet Vergi Dairesi oturumu açılıyor...');
  let ivdToken = await getIvdToken(bearerToken);
  let tokenTimestamp = Date.now();

  for (let i = 0; i < totalChunks; i++) {
    const chunk = chunks[i];
    const year = chunk.basYil;

    const elapsed = Date.now() - tokenTimestamp;
    if (elapsed > (25 * 60 * 1000 - TOKEN_REFRESH_THRESHOLD)) {
      console.log(`[INTVRG-BEYANNAME-MULTI] Token yenileniyor (${Math.round(elapsed / 1000)}s geçti)...`);
      callbacks.onChunkProgress(i, totalChunks, year, 'Token yenileniyor...');
      onProgress?.('GİB oturumu yenileniyor...');

      bearerToken = await gibDijitalLogin(
        params.userid,
        params.password,
        params.captchaApiKey,
        params.ocrSpaceApiKey,
      );
      ivdToken = await getIvdToken(bearerToken);
      tokenTimestamp = Date.now();
    }

    callbacks.onChunkProgress(i, totalChunks, year, `${year} yılı sorgulanıyor...`);
    onProgress?.(`${year} yılı sorgulanıyor (${i + 1}/${totalChunks})...`);

    console.log(`[INTVRG-BEYANNAME-MULTI] Chunk ${i + 1}/${totalChunks}: ${chunk.basAy}/${chunk.basYil} - ${chunk.bitAy}/${chunk.bitYil}`);

    try {
      const client = new IntrvrgClient(ivdToken, params.vkn);
      const result = await client.callDispatch<{
        data: {
          beyanname?: { beyanname?: Array<Record<string, string>> };
          donem?: string;
        };
      }>(
        'beyannameIslemleri_beyannameSorgulaSorgu',
        {
          vkn: { vkn: params.vkn },
          basDonem: { ay: chunk.basAy, yil: chunk.basYil },
          bitDonem: { ay: chunk.bitAy, yil: chunk.bitYil },
        },
      );

      const rawBeyannameler = result.data?.beyanname?.beyanname || [];
      if (rawBeyannameler.length > 0) {
        console.log('[BEYOID-DEBUG-MULTI] Keys:', Object.keys(rawBeyannameler[0]));
      }

      const beyannameler = parseRawBeyannameler(rawBeyannameler);

      console.log(`[INTVRG-BEYANNAME-MULTI] Chunk ${i + 1}/${totalChunks} (${year}): ${beyannameler.length} beyanname`);
      allItems.push(...beyannameler);
      callbacks.onChunkResults(i, totalChunks, year, beyannameler);

    } catch (chunkError: unknown) {
      const err = chunkError as Error;
      console.error(`[INTVRG-BEYANNAME-MULTI] Chunk ${i + 1}/${totalChunks} (${year}) hatası: ${err.message}`);
      callbacks.onChunkProgress(i, totalChunks, year, `${year} yılı hata: ${err.message}`);
    }

    if (i < totalChunks - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`[INTVRG-BEYANNAME-MULTI] Tamamlandı: Toplam ${allItems.length} beyanname`);
  callbacks.onAllComplete(allItems, ivdToken);

  return {
    success: true,
    allBeyannameler: allItems,
    ivdToken,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF Görüntüleme
// ═══════════════════════════════════════════════════════════════════════════

const GORUNTULEME_URL = `${INTVRG_BASE}/intvrg_server/goruntuleme`;
const PDF_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36';

export async function fetchBeyannamePdf(
  ivdToken: string,
  beyoid: string,
): Promise<{ success: boolean; pdfBase64?: string; error?: string }> {
  try {
    const url = `${GORUNTULEME_URL}?cmd=IMAJ&subcmd=BEYANNAMEGORUNTULE&beyannameOid=${encodeURIComponent(beyoid)}&USERID=&inline=true&goruntuTip=1&token=${encodeURIComponent(ivdToken)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf, */*',
        'User-Agent': PDF_USER_AGENT,
        'Referer': `${INTVRG_BASE}/intvrg_side/main.jsp?token=${ivdToken}&appName=tdvd`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: PDF indirilemedi`);
    }

    const contentType = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());

    if (contentType.includes('application/pdf') || buffer.subarray(0, 5).toString() === '%PDF-') {
      const pdfBase64 = buffer.toString('base64');
      return { success: true, pdfBase64 };
    }

    const text = buffer.toString('utf-8').substring(0, 500);
    console.error(`[INTVRG-PDF] PDF yerine beklenmeyen içerik: ${contentType} → ${text.substring(0, 200)}`);
    throw new Error('GİB sunucusu PDF yerine hata döndürdü. Oturum süresi dolmuş olabilir.');

  } catch (e: unknown) {
    const error = e as Error;
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Pipeline: Token-Aware PDF İndirme (Otomatik Yenileme + Retry)
// ═══════════════════════════════════════════════════════════════════════════

export interface PipelineCallbacks {
  onProgress: (status: string) => void;
  onResults: (beyannameler: BeyannameItem[]) => void;
  onPdfResult: (data: {
    pdfBase64: string;
    turKodu: string;
    turAdi: string;
    donem: string;
    beyoid: string;
    versiyon: string;
    downloadedCount: number;
    totalCount: number;
  }) => void;
  onPdfSkip: (data: { beyoid: string; turAdi: string; error: string }) => void;
  onComplete: (stats: {
    totalQueried: number;
    totalDownloaded: number;
    totalFailed: number;
    totalSkipped: number;
  }) => void;
}

/**
 * Token-aware PDF indirme.
 *
 * Her batch öncesinde token yaşını kontrol eder, 15 dk'dan eskiyse proaktif yeniler.
 * Bir batch'te token hatası tespit edilirse:
 *   1. Token'ı zorla yeniler
 *   2. Hatalı item'ları yeniden dener
 *
 * Bu sayede 200+ PDF'lik çoklu yıl sorgularında token expire sorunu ortadan kalkar.
 */
async function downloadPdfsTokenAware(
  tokenState: PipelineTokenState,
  params: BeyannameQueryParams,
  items: BeyannameItem[],
  concurrency: number,
  callbacks: Pick<PipelineCallbacks, 'onPdfResult' | 'onPdfSkip'>,
  onStatusUpdate?: (status: string) => void,
): Promise<{ downloaded: number; failed: number }> {
  let downloaded = 0;
  let failed = 0;
  const totalCount = items.length;

  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);

    // Proaktif token yenileme — her batch öncesinde kontrol
    try {
      await refreshTokenIfNeeded(tokenState, params);
    } catch (refreshErr) {
      console.error(`[PIPELINE-PDF] Proaktif token yenileme hatası:`, refreshErr);
      // Eski token ile devam et — hâlâ çalışabilir
    }

    const tokenForBatch = tokenState.ivdToken;
    const tokenExpiredItems: BeyannameItem[] = [];

    await Promise.allSettled(
      chunk.map(async (item) => {
        const result = await fetchBeyannamePdf(tokenForBatch, item.beyoid);
        if (result.success && result.pdfBase64) {
          downloaded++;
          callbacks.onPdfResult({
            pdfBase64: result.pdfBase64,
            turKodu: item.turKodu,
            turAdi: item.turAdi,
            donem: item.donem,
            beyoid: item.beyoid,
            versiyon: item.versiyon,
            downloadedCount: downloaded,
            totalCount,
          });
        } else if (isTokenExpiredError(result.error)) {
          tokenExpiredItems.push(item);
        } else {
          failed++;
          callbacks.onPdfSkip({
            beyoid: item.beyoid,
            turAdi: item.turAdi,
            error: result.error || 'PDF indirilemedi',
          });
        }
      }),
    );

    // Token hatası varsa → zorla yenile ve retry
    if (tokenExpiredItems.length > 0) {
      console.log(`[PIPELINE-PDF] ${tokenExpiredItems.length} PDF token hatası — zorla yenileniyor...`);
      onStatusUpdate?.('GİB oturumu yenileniyor...');

      try {
        await refreshTokenIfNeeded(tokenState, params, true); // force refresh

        // Retry başarısız item'ları yeni token ile
        const retryToken = tokenState.ivdToken;
        await Promise.allSettled(
          tokenExpiredItems.map(async (item) => {
            const result = await fetchBeyannamePdf(retryToken, item.beyoid);
            if (result.success && result.pdfBase64) {
              downloaded++;
              callbacks.onPdfResult({
                pdfBase64: result.pdfBase64,
                turKodu: item.turKodu,
                turAdi: item.turAdi,
                donem: item.donem,
                beyoid: item.beyoid,
                versiyon: item.versiyon,
                downloadedCount: downloaded,
                totalCount,
              });
            } else {
              failed++;
              callbacks.onPdfSkip({
                beyoid: item.beyoid,
                turAdi: item.turAdi,
                error: result.error || 'PDF indirilemedi (retry sonrası)',
              });
            }
          }),
        );
      } catch (refreshErr) {
        console.error(`[PIPELINE-PDF] Token yenileme başarısız:`, refreshErr);
        for (const item of tokenExpiredItems) {
          failed++;
          callbacks.onPdfSkip({
            beyoid: item.beyoid,
            turAdi: item.turAdi,
            error: 'GİB oturumu yenilenemedi',
          });
        }
      }
    }
  }

  return { downloaded, failed };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tek Yıl Pipeline: Sorgu + PDF İndirme
// ═══════════════════════════════════════════════════════════════════════════

export async function queryAndDownloadPipeline(
  params: BeyannameQueryParams,
  skipBeyoids: string[],
  callbacks: PipelineCallbacks,
): Promise<{ success: boolean; ivdToken?: string; beyannameler: BeyannameItem[]; error?: string }> {
  const PDF_CONCURRENCY = 10;

  try {
    // 1. GİB Login
    callbacks.onProgress('GİB Dijital VD\'ye giriş yapılıyor...');
    const bearerToken = await gibDijitalLogin(
      params.userid,
      params.password,
      params.captchaApiKey,
      params.ocrSpaceApiKey,
      (status) => callbacks.onProgress(status),
    );

    // 2. IVD Token
    callbacks.onProgress('İnternet Vergi Dairesi oturumu açılıyor...');
    const ivdToken = await getIvdToken(bearerToken);

    // Token state — pipeline boyunca paylaşılır
    const tokenState: PipelineTokenState = {
      ivdToken,
      bearerToken,
      timestamp: Date.now(),
    };

    // 3. Beyanname sorgusu
    callbacks.onProgress('Beyannameler sorgulanıyor...');
    const client = new IntrvrgClient(ivdToken, params.vkn);

    const result = await client.callDispatch<{
      data: {
        beyanname?: { beyanname?: Array<Record<string, string>> };
        donem?: string;
      };
    }>(
      'beyannameIslemleri_beyannameSorgulaSorgu',
      {
        vkn: { vkn: params.vkn },
        basDonem: { ay: params.basAy, yil: params.basYil },
        bitDonem: { ay: params.bitAy, yil: params.bitYil },
      },
    );

    const rawBeyannameler = result.data?.beyanname?.beyanname || [];
    console.log(`[PIPELINE] ${rawBeyannameler.length} beyanname bulundu`);

    const beyannameler = parseRawBeyannameler(rawBeyannameler);

    // 4. Sonuçları hemen gönder
    callbacks.onResults(beyannameler);
    callbacks.onProgress(`${beyannameler.length} beyanname bulundu — PDF indirme başlıyor...`);

    // 5. skipBeyoids filtrele
    const skipSet = new Set(skipBeyoids);
    const toDownload = beyannameler.filter((b) => b.beyoid && !skipSet.has(b.beyoid));
    const skippedCount = beyannameler.length - toDownload.length;

    console.log(`[PIPELINE] PDF indirme: ${toDownload.length} adet (${skippedCount} atlandı)`);

    // 6. Token-aware PDF indir
    let downloaded = 0;
    let failedCount = 0;

    if (toDownload.length > 0) {
      const pdfResult = await downloadPdfsTokenAware(
        tokenState, params, toDownload, PDF_CONCURRENCY, callbacks,
        (status) => callbacks.onProgress(status),
      );
      downloaded = pdfResult.downloaded;
      failedCount = pdfResult.failed;
    }

    // 7. Tamamlandı
    callbacks.onComplete({
      totalQueried: beyannameler.length,
      totalDownloaded: downloaded,
      totalFailed: failedCount,
      totalSkipped: skippedCount,
    });

    return { success: true, ivdToken: tokenState.ivdToken, beyannameler };

  } catch (e: unknown) {
    const error = e as Error;
    console.error(`[PIPELINE] Hata: ${error.message}`);
    return { success: false, beyannameler: [], error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Çoklu Yıl Pipeline: Token-Aware Sorgu + PDF İndirme
// ═══════════════════════════════════════════════════════════════════════════

export interface MultiYearPipelineCallbacks extends PipelineCallbacks {
  onChunkProgress: (chunkIndex: number, totalChunks: number, year: string, status: string) => void;
  onChunkResults: (chunkIndex: number, totalChunks: number, year: string, beyannameler: BeyannameItem[]) => void;
}

export async function queryAndDownloadPipelineMultiYear(
  params: BeyannameQueryParams,
  skipBeyoids: string[],
  callbacks: MultiYearPipelineCallbacks,
): Promise<{ success: boolean; allBeyannameler: BeyannameItem[]; ivdToken?: string; error?: string }> {
  const PDF_CONCURRENCY = 10;
  const chunks = splitIntoYearChunks(params.basAy, params.basYil, params.bitAy, params.bitYil);
  const totalChunks = chunks.length;
  const allItems: BeyannameItem[] = [];
  const skipSet = new Set(skipBeyoids);

  let totalDownloaded = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  console.log(`[PIPELINE-MULTI] ${totalChunks} yıl chunk'ı: ${chunks.map(c => c.basYil).join(', ')}`);

  try {
    // İlk login
    callbacks.onProgress('GİB Dijital VD\'ye giriş yapılıyor...');
    const bearerToken = await gibDijitalLogin(
      params.userid,
      params.password,
      params.captchaApiKey,
      params.ocrSpaceApiKey,
      (status) => callbacks.onProgress(status),
    );

    callbacks.onProgress('İnternet Vergi Dairesi oturumu açılıyor...');
    const ivdToken = await getIvdToken(bearerToken);

    // PAYLAŞILAN token state — tüm PDF download'lar bu state'i kullanır
    // downloadPdfsTokenAware bu state'i otomatik yeniler
    const tokenState: PipelineTokenState = {
      ivdToken,
      bearerToken,
      timestamp: Date.now(),
    };

    // PDF indirme zincirleri — artık paylaşılan tokenState kullanıyor
    let activePdfDownloads: Promise<void> = Promise.resolve();

    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunks[i];
      const year = chunk.basYil;

      // Sorgu öncesi token kontrolü — 20 dk'dan eskiyse yenile
      const elapsed = Date.now() - tokenState.timestamp;
      if (elapsed > (25 * 60 * 1000 - TOKEN_REFRESH_THRESHOLD)) {
        console.log(`[PIPELINE-MULTI] Token yenileniyor (${Math.round(elapsed / 1000)}s geçti)...`);
        callbacks.onChunkProgress(i, totalChunks, year, 'Token yenileniyor...');
        callbacks.onProgress('GİB oturumu yenileniyor...');

        await refreshTokenIfNeeded(tokenState, params, true);
      }

      // Chunk sorgusu — güncel token ile
      callbacks.onChunkProgress(i, totalChunks, year, `${year} yılı sorgulanıyor...`);
      callbacks.onProgress(`${year} yılı sorgulanıyor (${i + 1}/${totalChunks})...`);

      try {
        const client = new IntrvrgClient(tokenState.ivdToken, params.vkn);
        const result = await client.callDispatch<{
          data: {
            beyanname?: { beyanname?: Array<Record<string, string>> };
            donem?: string;
          };
        }>(
          'beyannameIslemleri_beyannameSorgulaSorgu',
          {
            vkn: { vkn: params.vkn },
            basDonem: { ay: chunk.basAy, yil: chunk.basYil },
            bitDonem: { ay: chunk.bitAy, yil: chunk.bitYil },
          },
        );

        const rawBeyannameler = result.data?.beyanname?.beyanname || [];
        const beyannameler = parseRawBeyannameler(rawBeyannameler);

        console.log(`[PIPELINE-MULTI] Chunk ${i + 1}/${totalChunks} (${year}): ${beyannameler.length} beyanname`);
        allItems.push(...beyannameler);
        callbacks.onChunkResults(i, totalChunks, year, beyannameler);

        // PDF'leri download queue'ya ekle — tokenState paylaşılıyor
        const toDownload = beyannameler.filter((b) => b.beyoid && !skipSet.has(b.beyoid));
        const chunkSkipped = beyannameler.length - toDownload.length;
        totalSkipped += chunkSkipped;

        if (toDownload.length > 0) {
          // tokenState referans olarak geçiyor — her zaman güncel token kullanılır
          activePdfDownloads = activePdfDownloads.then(async () => {
            const pdfResult = await downloadPdfsTokenAware(
              tokenState, params, toDownload, PDF_CONCURRENCY, callbacks,
              (status) => callbacks.onProgress(status),
            );
            totalDownloaded += pdfResult.downloaded;
            totalFailed += pdfResult.failed;
          });
        }

      } catch (chunkError: unknown) {
        const err = chunkError as Error;
        console.error(`[PIPELINE-MULTI] Chunk ${i + 1}/${totalChunks} (${year}) hatası: ${err.message}`);
        callbacks.onChunkProgress(i, totalChunks, year, `${year} yılı hata: ${err.message}`);
      }

      // Chunk arası 2s bekleme (son chunk hariç)
      if (i < totalChunks - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Tüm PDF indirmelerini bekle
    await activePdfDownloads;

    // Tamamlandı
    callbacks.onComplete({
      totalQueried: allItems.length,
      totalDownloaded,
      totalFailed,
      totalSkipped,
    });

    return { success: true, allBeyannameler: allItems, ivdToken: tokenState.ivdToken };

  } catch (e: unknown) {
    const error = e as Error;
    console.error(`[PIPELINE-MULTI] Hata: ${error.message}`);
    return { success: false, allBeyannameler: allItems, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Toplu Beyanname Sorgulama — Sıralı Mükellef İterasyonu
// ═══════════════════════════════════════════════════════════════════════════

export interface BulkCustomer {
  customerId: string;
  customerName: string;
  userid: string;
  password: string;
  vkn: string;
  savedBeyoids: string[];
}

export interface BulkQueryCallbacks {
  onProgress: (current: number, total: number, status: string) => void;
  onCustomerStart: (customerId: string, customerName: string, index: number, total: number) => void;
  onCustomerResults: (customerId: string, customerName: string, beyannameler: BeyannameItem[]) => void;
  onPdfResult: (customerId: string, data: {
    pdfBase64: string; turKodu: string; turAdi: string;
    donem: string; beyoid: string; versiyon: string;
    downloadedCount: number; totalCount: number;
  }) => void;
  onCustomerComplete: (customerId: string, customerName: string, stats: {
    totalQueried: number; totalDownloaded: number; totalFailed: number; totalSkipped: number;
  }) => void;
  onCustomerError: (customerId: string, customerName: string, error: string) => void;
  onAllComplete: (summary: {
    totalCustomers: number; successCount: number; errorCount: number;
    totalBeyanname: number; totalPdf: number; cancelled: boolean;
  }) => void;
}

let bulkCancelled = false;

export function cancelBulkQuery() {
  bulkCancelled = true;
}

export function isBulkQueryCancelled(): boolean {
  return bulkCancelled;
}

/**
 * Toplu beyanname sorgulama — mükellefleri sıralı olarak sorgular.
 * Her mükellef için: login → sorgu → PDF indirme → sonraki mükellef.
 * GİB paralel sorguyu reddediyor, bu yüzden sıralı zorunlu.
 */
export async function queryBeyannamelerBulk(
  customers: BulkCustomer[],
  dateRange: { basAy: string; basYil: string; bitAy: string; bitYil: string },
  captchaApiKey: string,
  ocrSpaceApiKey: string | undefined,
  callbacks: BulkQueryCallbacks,
): Promise<void> {
  bulkCancelled = false;
  const total = customers.length;
  let successCount = 0;
  let errorCount = 0;
  let totalBeyanname = 0;
  let totalPdf = 0;
  const isMultiYear = dateRange.basYil !== dateRange.bitYil;

  console.log(`[BULK-QUERY] Toplu sorgulama başlatılıyor: ${total} mükellef, ${isMultiYear ? 'çoklu yıl' : 'tek yıl'}`);

  for (let i = 0; i < total; i++) {
    if (bulkCancelled) {
      console.log(`[BULK-QUERY] İptal edildi (${i}/${total})`);
      callbacks.onAllComplete({
        totalCustomers: total, successCount, errorCount,
        totalBeyanname, totalPdf, cancelled: true,
      });
      return;
    }

    const customer = customers[i];
    callbacks.onCustomerStart(customer.customerId, customer.customerName, i, total);
    callbacks.onProgress(i, total, `${customer.customerName} sorgulanıyor... (${i + 1}/${total})`);

    console.log(`[BULK-QUERY] [${i + 1}/${total}] ${customer.customerName} (VKN: ${customer.vkn.substring(0, 4)}***)`);

    try {
      const params: BeyannameQueryParams = {
        userid: customer.userid,
        password: customer.password,
        vkn: customer.vkn,
        basAy: dateRange.basAy,
        basYil: dateRange.basYil,
        bitAy: dateRange.bitAy,
        bitYil: dateRange.bitYil,
        captchaApiKey,
        ocrSpaceApiKey,
      };

      let customerBeyanname = 0;
      let customerPdf = 0;

      const pipelineCallbacks: PipelineCallbacks = {
        onProgress: (status) => {
          callbacks.onProgress(i, total, `${customer.customerName}: ${status}`);
        },
        onResults: (beyannameler) => {
          customerBeyanname = beyannameler.length;
          totalBeyanname += beyannameler.length;
          callbacks.onCustomerResults(customer.customerId, customer.customerName, beyannameler);
        },
        onPdfResult: (data) => {
          customerPdf++;
          totalPdf++;
          callbacks.onPdfResult(customer.customerId, data);
        },
        onPdfSkip: () => {
          // Atlandı — sessizce devam
        },
        onComplete: (stats) => {
          successCount++;
          callbacks.onCustomerComplete(customer.customerId, customer.customerName, stats);
          console.log(`[BULK-QUERY] [${i + 1}/${total}] ${customer.customerName}: ${customerBeyanname} beyanname, ${customerPdf} PDF`);
        },
      };

      let pipelineResult: { success: boolean; error?: string };

      if (isMultiYear) {
        const multiCallbacks: MultiYearPipelineCallbacks = {
          ...pipelineCallbacks,
          onChunkProgress: (_ci, _tc, year, status) => {
            callbacks.onProgress(i, total, `${customer.customerName}: ${year} - ${status}`);
          },
          onChunkResults: (_ci, _tc, _year, beyannameler) => {
            customerBeyanname += beyannameler.length;
            totalBeyanname += beyannameler.length;
            // Chunk sonuçlarını da gönder
            callbacks.onCustomerResults(customer.customerId, customer.customerName, beyannameler);
          },
        };
        // Multi-year'da onResults çağrılmadığından onChunkResults'ta biriktiriyoruz
        multiCallbacks.onResults = () => {};

        pipelineResult = await queryAndDownloadPipelineMultiYear(params, customer.savedBeyoids, multiCallbacks);
      } else {
        pipelineResult = await queryAndDownloadPipeline(params, customer.savedBeyoids, pipelineCallbacks);
      }

      // Pipeline hata döndürdüyse (throw etmeden) — errorCount artır
      if (!pipelineResult.success) {
        errorCount++;
        const errMsg = pipelineResult.error || 'Sorgulama başarısız';
        console.error(`[BULK-QUERY] [${i + 1}/${total}] ${customer.customerName} PIPELINE HATASI: ${errMsg}`);
        callbacks.onCustomerError(customer.customerId, customer.customerName, errMsg);
      }
    } catch (e: unknown) {
      errorCount++;
      const err = e as Error;
      console.error(`[BULK-QUERY] [${i + 1}/${total}] ${customer.customerName} HATA: ${err.message}`);
      callbacks.onCustomerError(customer.customerId, customer.customerName, err.message || 'Bilinmeyen hata');
    }

    // Mükelleflerin arası 3 saniye bekleme (son mükellef hariç)
    if (i < total - 1 && !bulkCancelled) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log(`[BULK-QUERY] Tamamlandı: ${successCount} başarılı, ${errorCount} hatalı, ${totalBeyanname} beyanname, ${totalPdf} PDF`);
  callbacks.onAllComplete({
    totalCustomers: total, successCount, errorCount,
    totalBeyanname, totalPdf, cancelled: false,
  });
}
