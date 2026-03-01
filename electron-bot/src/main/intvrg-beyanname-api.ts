/**
 * INTVRG Beyanname Sorgulama API Modülü
 * ======================================
 * GİB İnternet Vergi Dairesi (INTVRG) üzerinden beyanname listesi sorgulama.
 *
 * Akış: GİB Dijital VD Login → IVD Token → INTVRG Dispatch → Beyanname Sorgusu
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
interface BeyannameQueryParams {
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
};

function getBeyannameTurAdi(turKodu: string): string {
  return BEYANNAME_TURU_MAP[turKodu] || turKodu;
}

// ═══════════════════════════════════════════════════════════════════════════
// Dönem Parse Helper
// ═══════════════════════════════════════════════════════════════════════════

const AY_ISIMLERI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

/**
 * GİB dönem formatını okunabilir hale çevir.
 * Örnek: "202501202501" → "Ocak 2025"
 * Örnek: "202501202512" → "Ocak 2025 - Aralık 2025"
 * Örnek: "202501" → "Ocak 2025"
 */
function formatDonem(donemStr: string): string {
  if (!donemStr) return donemStr;

  // 12 karakter: "YYYYMMYYYYMM" (başlangıç + bitiş)
  // Örnek: "202501202501" → "01/2025-01/2025"
  if (donemStr.length === 12) {
    const basYil = donemStr.substring(0, 4);
    const basAy = donemStr.substring(4, 6);
    const bitYil = donemStr.substring(6, 10);
    const bitAy = donemStr.substring(10, 12);

    return `${basAy}/${basYil}-${bitAy}/${bitYil}`;
  }

  // 6 karakter: "YYYYMM"
  // Örnek: "202501" → "01/2025-01/2025"
  if (donemStr.length === 6) {
    const yil = donemStr.substring(0, 4);
    const ay = donemStr.substring(4, 6);
    return `${ay}/${yil}-${ay}/${yil}`;
  }

  // Bilinmeyen format — ham döndür
  return donemStr;
}

// ═══════════════════════════════════════════════════════════════════════════
// Ana Orchestration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Beyanname sorgulaması ana fonksiyonu.
 *
 * 1. GİB Dijital VD'ye login
 * 2. IVD token al
 * 3. Beyanname sorgusunu çalıştır
 * 4. Response parse → BeyannameItem[]
 */
export async function queryBeyannameler(
  params: BeyannameQueryParams,
  onProgress?: (status: string) => void,
  onResults?: (beyannameler: BeyannameItem[]) => void,
): Promise<BeyannameQueryResult> {
  try {
    // 1. GİB Dijital VD Login
    onProgress?.('GİB Dijital VD\'ye giriş yapılıyor...');
    const bearerToken = await gibDijitalLogin(
      params.userid,
      params.password,
      params.captchaApiKey,
      params.ocrSpaceApiKey,
      onProgress,
    );

    // 2. IVD Token al
    onProgress?.('İnternet Vergi Dairesi oturumu açılıyor...');
    const ivdToken = await getIvdToken(bearerToken);

    // 3. INTVRG Client oluştur
    const client = new IntrvrgClient(ivdToken, params.vkn);

    // 4. Beyanname sorgusunu çalıştır
    onProgress?.('Beyannameler sorgulanıyor...');

    // GİB API yanıt yapısı: { data: { beyanname: { beyanname: [...] } } }
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

    // 5. Response parse — GİB API'de iç içe beyanname.beyanname yapısı var
    const rawBeyannameler = result.data?.beyanname?.beyanname || [];
    console.log(`[INTVRG-BEYANNAME] ${rawBeyannameler.length} beyanname bulundu`);

    const beyannameler: BeyannameItem[] = rawBeyannameler.map((item) => {
      // beyanname_turu formatı: "KDV1_39" → turKodu: "KDV1", versiyon: "39"
      const rawTur = item.beyanname_turu || item.beyannameturu || '';
      const lastUnderscoreIdx = rawTur.lastIndexOf('_');
      const turKodu = lastUnderscoreIdx > 0 ? rawTur.substring(0, lastUnderscoreIdx) : rawTur;
      const versiyon = lastUnderscoreIdx > 0 ? rawTur.substring(lastUnderscoreIdx + 1) : '0';

      return {
        turKodu,
        turAdi: getBeyannameTurAdi(turKodu),
        donem: item.donem || '',
        donemFormatli: formatDonem(item.donem || ''),
        versiyon,
        kaynak: item.kaynak || '',
        aciklama: item.aciklama || '',
        beyoid: item.beyoid || '',
      };
    });

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

/** Yıl bazlı chunk (GİB maks 12 ay kısıtı) */
export interface YearChunk {
  basAy: string;
  basYil: string;
  bitAy: string;
  bitYil: string;
}

/** Çoklu yıl chunk ilerleme callback'i */
export interface MultiYearCallbacks {
  onChunkProgress: (chunkIndex: number, totalChunks: number, year: string, status: string) => void;
  onChunkResults: (chunkIndex: number, totalChunks: number, year: string, beyannameler: BeyannameItem[]) => void;
  onAllComplete: (allItems: BeyannameItem[], ivdToken: string) => void;
}

/**
 * Tarih aralığını yıl bazlı chunk'lara böler.
 * GİB API tek sorguda maks 12 ay (1 yıl) desteklediğinden, çoklu yıl aralıkları parçalanmalıdır.
 *
 * Örnek: ("03", "2022", "11", "2025") →
 *   [{basAy:"03", basYil:"2022", bitAy:"12", bitYil:"2022"},
 *    {basAy:"01", basYil:"2023", bitAy:"12", bitYil:"2023"},
 *    {basAy:"01", basYil:"2024", bitAy:"12", bitYil:"2024"},
 *    {basAy:"01", basYil:"2025", bitAy:"11", bitYil:"2025"}]
 */
export function splitIntoYearChunks(basAy: string, basYil: string, bitAy: string, bitYil: string): YearChunk[] {
  const startYear = parseInt(basYil, 10);
  const endYear = parseInt(bitYil, 10);

  // Tek yıl → chunk yok
  if (startYear === endYear) {
    return [{ basAy, basYil, bitAy, bitYil }];
  }

  const chunks: YearChunk[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const chunk: YearChunk = {
      basAy: year === startYear ? basAy : '01',
      basYil: String(year),
      bitAy: year === endYear ? bitAy : '12',
      bitYil: String(year),
    };
    chunks.push(chunk);
  }

  return chunks;
}

/** Token TTL kontrol sabiti — 5 dk'dan az kaldıysa yeniden login */
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000;

/**
 * Çoklu yıl beyanname sorgulama orchestrator'ı.
 * Yıl bazlı chunk'lara böler, sırasıyla sorgu yapar, token yönetir.
 */
export async function queryBeyannamelerMultiYear(
  params: BeyannameQueryParams,
  callbacks: MultiYearCallbacks,
  onProgress?: (status: string) => void,
): Promise<{ success: boolean; allBeyannameler: BeyannameItem[]; ivdToken: string; error?: string }> {
  const chunks = splitIntoYearChunks(params.basAy, params.basYil, params.bitAy, params.bitYil);
  const totalChunks = chunks.length;
  const allItems: BeyannameItem[] = [];

  console.log(`[INTVRG-BEYANNAME-MULTI] ${totalChunks} yıl chunk'ı oluşturuldu: ${chunks.map(c => c.basYil).join(', ')}`);

  // İlk login
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

    // Token TTL kontrol — 5 dk'dan az kaldıysa yeniden login
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

    // Chunk sorgusu
    const chunkLabel = `${chunk.basAy}/${chunk.basYil} - ${chunk.bitAy}/${chunk.bitYil}`;
    callbacks.onChunkProgress(i, totalChunks, year, `${year} yılı sorgulanıyor...`);
    onProgress?.(`${year} yılı sorgulanıyor (${i + 1}/${totalChunks})...`);

    console.log(`[INTVRG-BEYANNAME-MULTI] Chunk ${i + 1}/${totalChunks}: ${chunkLabel}`);

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
      const beyannameler: BeyannameItem[] = rawBeyannameler.map((item) => {
        const rawTur = item.beyanname_turu || item.beyannameturu || '';
        const lastUnderscoreIdx = rawTur.lastIndexOf('_');
        const turKodu = lastUnderscoreIdx > 0 ? rawTur.substring(0, lastUnderscoreIdx) : rawTur;
        const versiyon = lastUnderscoreIdx > 0 ? rawTur.substring(lastUnderscoreIdx + 1) : '0';

        return {
          turKodu,
          turAdi: getBeyannameTurAdi(turKodu),
          donem: item.donem || '',
          donemFormatli: formatDonem(item.donem || ''),
          versiyon,
          kaynak: item.kaynak || '',
          aciklama: item.aciklama || '',
          beyoid: item.beyoid || '',
        };
      });

      console.log(`[INTVRG-BEYANNAME-MULTI] Chunk ${i + 1}/${totalChunks} (${year}): ${beyannameler.length} beyanname`);
      allItems.push(...beyannameler);
      callbacks.onChunkResults(i, totalChunks, year, beyannameler);

    } catch (chunkError: unknown) {
      const err = chunkError as Error;
      console.error(`[INTVRG-BEYANNAME-MULTI] Chunk ${i + 1}/${totalChunks} (${year}) hatası: ${err.message}`);
      // Hatayı logla ama diğer chunk'lara devam et
      callbacks.onChunkProgress(i, totalChunks, year, `${year} yılı hata: ${err.message}`);
    }

    // Chunk arası 2 sn bekleme (GİB rate-limit koruması)
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

/**
 * GİB INTVRG'den beyanname PDF'ini indir.
 *
 * URL pattern (HAR'dan): /intvrg_server/goruntuleme?cmd=IMAJ&subcmd=BEYANNAMEGORUNTULE&beyannameOid={beyoid}&token={token}
 */
export async function fetchBeyannamePdf(
  ivdToken: string,
  beyoid: string,
): Promise<{ success: boolean; pdfBase64?: string; error?: string }> {
  try {
    const url = `${GORUNTULEME_URL}?cmd=IMAJ&subcmd=BEYANNAMEGORUNTULE&beyannameOid=${encodeURIComponent(beyoid)}&USERID=&inline=true&goruntuTip=1&token=${encodeURIComponent(ivdToken)}`;

    console.log(`[INTVRG-PDF] PDF indiriliyor: beyoid=${beyoid.substring(0, 8)}...`);

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

    // PDF kontrolü — content-type veya magic bytes
    if (contentType.includes('application/pdf') || buffer.subarray(0, 5).toString() === '%PDF-') {
      const pdfBase64 = buffer.toString('base64');
      console.log(`[INTVRG-PDF] PDF başarıyla indirildi: ${(buffer.length / 1024).toFixed(1)} KB`);
      return { success: true, pdfBase64 };
    }

    // PDF değilse HTML hata sayfası olabilir
    const text = buffer.toString('utf-8').substring(0, 500);
    console.error(`[INTVRG-PDF] PDF yerine beklenmeyen içerik: ${contentType} → ${text.substring(0, 200)}`);
    throw new Error('GİB sunucusu PDF yerine hata döndürdü. Oturum süresi dolmuş olabilir.');

  } catch (e: unknown) {
    const error = e as Error;
    console.error(`[INTVRG-PDF] PDF indirme hatası: ${error.message}`);
    return { success: false, error: error.message };
  }
}
