/**
 * E-Tebligat Dijital VD API Modülü
 * =================================
 * GİB Dijital Vergi Dairesi API üzerinden e-Tebligat sorgulama.
 *
 * - gibDijitalLogin ile Bearer token
 * - Sayfalı tebligat listeleme
 * - Zarf detay sorgulama (okundu işaretleme)
 * - Belge PDF indirme
 *
 * API yapısı HAR analizine dayanır (2026-02-14).
 */

import { gibDijitalLogin } from './earsiv-dijital-api';

// ═══════════════════════════════════════════════════════════════════════════
// Sabitler
// ═══════════════════════════════════════════════════════════════════════════

const DIJITAL_GIB_BASE = 'https://dijital.gib.gov.tr';

const ENDPOINTS = {
  AKTIVASYON_SORGULA: `${DIJITAL_GIB_BASE}/apigateway/etebligat/etebligat/aktivasyon-sorgula`,
  GERCEK_TUZEL_AKTIVASYON: `${DIJITAL_GIB_BASE}/apigateway/etebligat/etebligat/gercek-tuzel-aktivasyon-sorgula`,
  TEBLIGAT_SAYILARI: `${DIJITAL_GIB_BASE}/apigateway/etebligat/etebligat/tebligat-sayilari`,
  BELGE_TUR: `${DIJITAL_GIB_BASE}/apigateway/etebligat/etebligat/get-belge-tur`,
  TEBLIGAT_LISTELE: `${DIJITAL_GIB_BASE}/apigateway/etebligat/etebligat/tebligat-listele`,
  ZARF_DETAY: `${DIJITAL_GIB_BASE}/apigateway/etebligat/etebligat/zarf-detay-sorgula`,
  BELGE_EK_LISTELE: `${DIJITAL_GIB_BASE}/apigateway/etebligat/etebligat/belge-ek-listele`,
  BELGE_GETIR: `${DIJITAL_GIB_BASE}/apigateway/etebligat/etebligat/belge-getir`,
  REPORT_DOWNLOAD: `${DIJITAL_GIB_BASE}/apigateway/etebligat/report/download`,
} as const;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36';
const DELAY_BETWEEN_REQUESTS = 1500;
const PAGE_SIZE = 10; // GİB portal default
const MAX_PAGES = 100; // Sonsuz döngü koruması

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface TebligatItem {
  kurumKodu: string;
  kurumAciklama: string;
  belgeTuru: string;
  belgeTuruAciklama: string;
  belgeNo: string;
  kayitZamani: string;
  tebligZamani: string;
  mukellefOkumaZamani: string | null;
  gonderimZamani: string;
  gerceklesenOtomatikOkunmaZamani: string | null;
  dizin: string;
  tebligId: string;
  tebligSecureId: string;
  tarafId: string;
  tarafSecureId: string;
  altKurum: string | null;
}

export interface TebligatSayilari {
  okunmus: number;
  okunmamis: number;
  arsivlenmis: number;
}

export interface EtebligatQueryResult {
  success: boolean;
  tebligatlar: TebligatItem[];
  totalCount: number;
  sayilar: TebligatSayilari | null;
  aktivasyon: boolean;
  error?: string;
}

interface BelgeInfo {
  id: string;
  adi: string;
  secureId: string;
  belgeTip: string;
  uzanti: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'User-Agent': USER_AGENT,
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'Origin': DIJITAL_GIB_BASE,
    'Referer': `${DIJITAL_GIB_BASE}/`,
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Tebligat listeleme payload'ı oluştur.
 *
 * GİB API formatı (HAR'dan doğrulanmış):
 * {
 *   "meta": {
 *     "pagination": { "pageNo": 1, "pageSize": 10 },
 *     "sortFieldName": "id",
 *     "sortType": "ASC",
 *     "filters": [
 *       { "fieldName": "arsivDurum", "values": ["0"] }
 *     ]
 *   }
 * }
 */
function buildListelePayload(
  pageNo: number,
  pageSize: number = PAGE_SIZE,
  filters: { fieldName: string; values: string[] }[] = [],
): Record<string, unknown> {
  return {
    meta: {
      pagination: { pageNo, pageSize },
      sortFieldName: 'id',
      sortType: 'ASC',
      filters,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// E-Tebligat Sorgulama
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tüm e-tebligatları sayfalı olarak sorgula.
 *
 * Akış:
 * 1. gercek-tuzel-aktivasyon-sorgula → mükellef aktif mi kontrol
 * 2. tebligat-sayilari → özet sayılar
 * 3. tebligat-listele (sayfalı) → tüm tebligatlar
 */
export async function queryEtebligatlar(
  token: string,
  loginCreds: { userid: string; sifre: string },
  captchaKey: string,
  ocrKey?: string,
  onProgress?: (status: string) => void,
  onResults?: (tebligatlar: TebligatItem[], progress: { pageNo: number; totalPages: number }) => void,
): Promise<EtebligatQueryResult> {
  let currentToken = token;
  let sessionRefreshed = false;

  // 1. Aktivasyon kontrolü
  onProgress?.('E-Tebligat aktivasyon durumu kontrol ediliyor...');
  console.log('[ETEBLIGAT] Aktivasyon sorgulanıyor...');

  try {
    // Önce aktivasyon-sorgula, sonra gercek-tuzel-aktivasyon-sorgula dene
    let aktivasyonRes = await fetch(ENDPOINTS.AKTIVASYON_SORGULA, {
      method: 'GET',
      headers: getHeaders(currentToken),
    });

    console.log(`[ETEBLIGAT] Aktivasyon HTTP ${aktivasyonRes.status}`);

    if (aktivasyonRes.status === 401 && !sessionRefreshed) {
      onProgress?.('Oturum yenileniyor...');
      currentToken = await gibDijitalLogin(loginCreds.userid, loginCreds.sifre, captchaKey, ocrKey, onProgress);
      sessionRefreshed = true;

      aktivasyonRes = await fetch(ENDPOINTS.AKTIVASYON_SORGULA, {
        method: 'GET',
        headers: getHeaders(currentToken),
      });
    }

    if (aktivasyonRes.ok) {
      try {
        const aktivasyonData = await aktivasyonRes.json();
        console.log('[ETEBLIGAT] Aktivasyon yanıt:', JSON.stringify(aktivasyonData).substring(0, 500));
      } catch { /* yanıt body'si yoksa sorun değil */ }
    } else if (aktivasyonRes.status === 409) {
      return {
        success: false,
        tebligatlar: [],
        totalCount: 0,
        sayilar: null,
        aktivasyon: false,
        error: 'Bu mükellef için e-Tebligat aktivasyonu bulunmamaktadır.',
      };
    } else {
      console.log(`[ETEBLIGAT] Aktivasyon hata: HTTP ${aktivasyonRes.status}, devam ediliyor...`);
    }
  } catch (e) {
    const error = e as Error;
    if (error.message?.startsWith('AUTH_FAILED') || error.message?.startsWith('CAPTCHA')) {
      throw error;
    }
    console.log(`[ETEBLIGAT] Aktivasyon kontrolü atlandı: ${error.message}`);
  }

  // 2. Tebligat sayıları
  // API yanıtı: { digerKurumOkunmusTebligatSayisi, digerKurumOkunmamisTebligatSayisi, digerKurumArsivlenmisTebligatSayisi }
  let sayilar: TebligatSayilari | null = null;
  try {
    onProgress?.('Tebligat sayıları alınıyor...');
    const sayilarRes = await fetch(ENDPOINTS.TEBLIGAT_SAYILARI, {
      method: 'GET',
      headers: getHeaders(currentToken),
    });
    console.log(`[ETEBLIGAT] Sayılar HTTP ${sayilarRes.status}`);
    if (sayilarRes.ok) {
      const sayilarData = await sayilarRes.json();
      console.log('[ETEBLIGAT] Sayılar yanıt:', JSON.stringify(sayilarData).substring(0, 500));
      // GİB API yanıt formatı (HAR'dan doğrulanmış):
      // { messages: null, digerKurumOkunmusTebligatSayisi: 4, digerKurumOkunmamisTebligatSayisi: 0, digerKurumArsivlenmisTebligatSayisi: 18 }
      const d = sayilarData.data || sayilarData;
      sayilar = {
        okunmus: d.digerKurumOkunmusTebligatSayisi ?? d.okunmusTebligatSayisi ?? d.okunmus ?? 0,
        okunmamis: d.digerKurumOkunmamisTebligatSayisi ?? d.okunmamisTebligatSayisi ?? d.okunmamis ?? 0,
        arsivlenmis: d.digerKurumArsivlenmisTebligatSayisi ?? d.arsivlenmisTebligatSayisi ?? d.arsivlenmis ?? 0,
      };
      console.log(`[ETEBLIGAT] Sayılar — Okunmuş: ${sayilar.okunmus}, Okunmamış: ${sayilar.okunmamis}, Arşivlenmiş: ${sayilar.arsivlenmis}`);
    } else {
      try {
        const errBody = await sayilarRes.text();
        console.log(`[ETEBLIGAT] Sayılar hata body:`, errBody.substring(0, 300));
      } catch { /* */ }
    }
  } catch (e) {
    console.log(`[ETEBLIGAT] Sayılar alınamadı: ${(e as Error).message}`);
  }

  // 3. Tebligat listeleme (sayfalı)
  // Arşivlenmemiş tüm tebligatlar: filters = []  (filtre yok = tümü)
  onProgress?.('Tebligatlar listeleniyor...');
  const allTebligatlar: TebligatItem[] = [];
  let pageNo = 1;
  let totalPages = 1;

  while (pageNo <= MAX_PAGES) {
    console.log(`[ETEBLIGAT] Sayfa ${pageNo} sorgulanıyor...`);

    const payload = buildListelePayload(pageNo);
    console.log(`[ETEBLIGAT] Payload:`, JSON.stringify(payload));

    let response = await fetch(ENDPOINTS.TEBLIGAT_LISTELE, {
      method: 'POST',
      headers: getHeaders(currentToken),
      body: JSON.stringify(payload),
    });

    console.log(`[ETEBLIGAT] HTTP ${response.status}`);

    // 401 → re-login
    if (response.status === 401 && !sessionRefreshed) {
      onProgress?.('Oturum yenileniyor...');
      currentToken = await gibDijitalLogin(loginCreds.userid, loginCreds.sifre, captchaKey, ocrKey, onProgress);
      sessionRefreshed = true;

      response = await fetch(ENDPOINTS.TEBLIGAT_LISTELE, {
        method: 'POST',
        headers: getHeaders(currentToken),
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      if (response.status === 409) {
        console.log('[ETEBLIGAT] 409 — tebligat bulunamadı');
        break;
      }
      let errMsg = `HTTP ${response.status}`;
      try {
        const errBody = await response.text();
        console.log(`[ETEBLIGAT] Hata body:`, errBody.substring(0, 500));
        errMsg = errBody.substring(0, 200) || errMsg;
      } catch { /* */ }
      throw new Error(`Tebligat listesi alınamadı: ${errMsg}`);
    }

    const responseData = await response.json() as Record<string, unknown>;
    console.log(`[ETEBLIGAT] Yanıt anahtarları:`, Object.keys(responseData));

    // GİB API yanıt formatı (HAR'dan doğrulanmış):
    // { messages, sonucKodu, aciklama, data: { count, tebligatDtoList: [...] }, pageDetail: { pageNo, pageSize, total, totalPage } }
    const data = responseData.data as Record<string, unknown> | undefined;
    const items: TebligatItem[] = [];

    if (data && typeof data === 'object') {
      // Birincil: data.tebligatDtoList (HAR'dan doğrulanmış)
      if (Array.isArray(data.tebligatDtoList)) {
        items.push(...data.tebligatDtoList);
      }
      // Fallback: diğer olası alan adları
      else if (Array.isArray(data.content)) {
        items.push(...data.content);
      } else if (Array.isArray(data.tebligatlar)) {
        items.push(...data.tebligatlar);
      } else if (Array.isArray(data.list)) {
        items.push(...data.list);
      }
      console.log(`[ETEBLIGAT] data anahtarları:`, Object.keys(data));
    }

    // Fallback: üst seviyede array ara
    if (items.length === 0) {
      for (const key of Object.keys(responseData)) {
        const val = responseData[key];
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          if ('tebligId' in val[0] || 'belgeNo' in val[0]) {
            console.log(`[ETEBLIGAT] Tebligat listesi '${key}' anahtarında bulundu`);
            items.push(...val);
            break;
          }
        }
      }
    }

    // pageDetail'den totalPages al (HAR'dan doğrulanmış — root seviyesinde)
    const pageDetail = responseData.pageDetail as Record<string, unknown> | undefined;
    if (pageDetail && typeof pageDetail === 'object') {
      totalPages = (pageDetail.totalPage as number) || 1;
    }

    console.log(`[ETEBLIGAT] Sayfa ${pageNo}: ${items.length} tebligat, toplam ${totalPages} sayfa`);

    if (items.length > 0) {
      allTebligatlar.push(...items);
      onResults?.(items, { pageNo, totalPages });
      onProgress?.(`Tebligatlar alınıyor (sayfa ${pageNo}/${totalPages})...`);
    }

    if (pageNo >= totalPages || items.length === 0) break;
    pageNo++;
    await sleep(DELAY_BETWEEN_REQUESTS);
  }

  console.log(`[ETEBLIGAT] Toplam ${allTebligatlar.length} tebligat bulundu`);

  return {
    success: true,
    tebligatlar: allTebligatlar,
    totalCount: allTebligatlar.length,
    sayilar,
    aktivasyon: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Zarf Detay Sorgulama (OKUNDU İŞARETLEME!)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Zarf detay sorgula — DİKKAT: Bu işlem tebligatı kalıcı olarak okundu işaretler!
 *
 * HAR'dan doğrulanmış request: { tarafId, tarafSecureId }
 */
export async function zarfDetaySorgula(
  token: string,
  tarafId: string,
  tarafSecureId: string,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  console.log(`[ETEBLIGAT] Zarf detay sorgulanıyor (tarafId: ${tarafId})...`);

  const response = await fetch(ENDPOINTS.ZARF_DETAY, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ tarafId, tarafSecureId }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED: Oturum süresi doldu');
    }
    let errorMsg = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.messages) {
        errorMsg = errorData.messages.map((m: { text?: string }) => m.text || '').filter(Boolean).join('; ') || errorMsg;
      }
    } catch { /* parse hatası */ }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return { success: true, data };
}

// ═══════════════════════════════════════════════════════════════════════════
// Belge PDF İndirme
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tebligat belgesini PDF olarak indir.
 *
 * Akış (HAR'dan doğrulanmış):
 * 1. belge-ek-listele → { tebligBelge: {...}, ekler: [...] }
 * 2. belge-getir → { data: { id, secureId, belgeTip, tarafId, tarafSecureId, uzanti, belgeAdi } }
 * 3. reportLink'ten binary indir → base64
 */
export async function belgeGetirVeIndir(
  token: string,
  tebligId: string,
  tebligSecureId: string,
  tarafId: string,
  tarafSecureId: string,
): Promise<{ success: boolean; pdfBase64?: string; error?: string }> {
  console.log(`[ETEBLIGAT] Belge indirme başlatılıyor (tebligId: ${tebligId})...`);

  // 1. Belge ek listele
  // HAR'dan doğrulanmış request: { tebligId, tebligSecureId } (taraf bilgileri gönderilmiyor!)
  const ekListeRes = await fetch(ENDPOINTS.BELGE_EK_LISTELE, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ tebligId, tebligSecureId }),
  });

  if (!ekListeRes.ok) {
    if (ekListeRes.status === 401) {
      throw new Error('TOKEN_EXPIRED: Oturum süresi doldu');
    }
    throw new Error(`Belge listesi alınamadı: HTTP ${ekListeRes.status}`);
  }

  // HAR'dan doğrulanmış yanıt:
  // { messages: null, tebligBelge: { id, adi, secureId, belgeTip, uzanti }, ekler: null | [...] }
  const ekListeData = await ekListeRes.json();
  console.log('[ETEBLIGAT] Belge ek listele yanıt:', JSON.stringify(ekListeData).substring(0, 500));

  const tebligBelge: BelgeInfo | null = ekListeData.tebligBelge || null;
  const ekler: BelgeInfo[] = ekListeData.ekler || [];

  // Ana belge tebligBelge'de, ekler ayrı
  const belge = tebligBelge || (Array.isArray(ekler) && ekler.length > 0 ? ekler[0] : null);

  if (!belge) {
    // Eski API yapısı fallback
    const dataArray = ekListeData.data || ekListeData;
    if (Array.isArray(dataArray) && dataArray.length > 0) {
      const fallbackBelge = dataArray[0];
      console.log(`[ETEBLIGAT] Fallback belge bulundu: ${fallbackBelge.belgeAdi || fallbackBelge.adi}`);
      return await downloadBelge(token, fallbackBelge, tarafId, tarafSecureId);
    }
    return { success: false, error: 'Bu tebligatta belge bulunamadı' };
  }

  console.log(`[ETEBLIGAT] Belge bulundu: ${belge.adi} (${belge.uzanti})`);

  return await downloadBelge(token, belge, tarafId, tarafSecureId);
}

/**
 * Belge indirme — belge-getir → report → PDF base64
 */
async function downloadBelge(
  token: string,
  belge: BelgeInfo,
  tarafId: string,
  tarafSecureId: string,
): Promise<{ success: boolean; pdfBase64?: string; error?: string }> {
  // 2. Belge getir — geçici reportLink URL
  // HAR'dan doğrulanmış request:
  // { data: { id, secureId, belgeTip, tarafId, tarafSecureId, uzanti, belgeAdi } }
  const belgeGetirPayload = {
    data: {
      id: belge.id,
      secureId: belge.secureId,
      belgeTip: belge.belgeTip || '0',
      tarafId,
      tarafSecureId,
      uzanti: belge.uzanti,
      belgeAdi: belge.adi,
    },
  };

  console.log('[ETEBLIGAT] Belge getir payload:', JSON.stringify(belgeGetirPayload).substring(0, 300));

  const belgeGetirRes = await fetch(ENDPOINTS.BELGE_GETIR, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(belgeGetirPayload),
  });

  if (!belgeGetirRes.ok) {
    if (belgeGetirRes.status === 401) {
      throw new Error('TOKEN_EXPIRED: Oturum süresi doldu');
    }
    throw new Error(`Belge URL alınamadı: HTTP ${belgeGetirRes.status}`);
  }

  // HAR'dan doğrulanmış yanıt:
  // { messages: null, reportLink: "https://dijital.gib.gov.tr/apigateway/etebligat/report/download?uuid=..." }
  const belgeGetirData = await belgeGetirRes.json();
  console.log('[ETEBLIGAT] Belge getir yanıt:', JSON.stringify(belgeGetirData).substring(0, 300));

  const reportLink = belgeGetirData.reportLink || belgeGetirData.data?.reportLink;

  if (!reportLink) {
    return { success: false, error: 'Belge indirme linki alınamadı' };
  }

  console.log(`[ETEBLIGAT] Report link alındı, PDF indiriliyor...`);

  // 3. PDF binary indir → base64
  const pdfUrl = reportLink.startsWith('http')
    ? reportLink
    : `${ENDPOINTS.REPORT_DOWNLOAD}?uuid=${reportLink}`;

  const pdfRes = await fetch(pdfUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      'Accept': '*/*',
      'Origin': DIJITAL_GIB_BASE,
      'Referer': `${DIJITAL_GIB_BASE}/`,
    },
  });

  if (!pdfRes.ok) {
    throw new Error(`PDF indirilemedi: HTTP ${pdfRes.status}`);
  }

  const pdfBuffer = await pdfRes.arrayBuffer();
  const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

  console.log(`[ETEBLIGAT] PDF indirildi: ${Math.round(pdfBuffer.byteLength / 1024)} KB`);

  return { success: true, pdfBase64 };
}

// Re-export login fonksiyonu
export { gibDijitalLogin };
