/**
 * E-Arşiv Dijital VD API Modülü
 * ==============================
 * GİB Dijital Vergi Dairesi API üzerinden e-Arşiv alış faturası sorgulama.
 *
 * - HTTP API login (captcha + Bearer token)
 * - 7 günlük tarih dilimleme
 * - Pagination destekli sorgulama
 * - Streaming (dilim bazlı callback)
 *
 * Referans: src/lib/gib-api/gib-auth.ts pattern'i
 */

// ═══════════════════════════════════════════════════════════════════════════
// Sabitler (endpoints.ts'den — rootDir kısıtı nedeniyle inline)
// ═══════════════════════════════════════════════════════════════════════════

const DIJITAL_GIB_BASE = 'https://dijital.gib.gov.tr';

const ENDPOINTS = {
  CAPTCHA: `${DIJITAL_GIB_BASE}/apigateway/captcha/getnewcaptcha`,
  LOGIN: `${DIJITAL_GIB_BASE}/apigateway/auth/tdvd/login`,
  USER_INFO: `${DIJITAL_GIB_BASE}/apigateway/auth/tdvd/user-info`,
  EARSIV_ALICI_LIST: `${DIJITAL_GIB_BASE}/apigateway/api/earsiv/alici-list`,
} as const;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const DELAY_BETWEEN_REQUESTS = 2000; // 2 saniye — GİB rate limit koruması
const MAX_PAGES_PER_CHUNK = 50; // Sonsuz döngü koruması
const PER_CHUNK_TIMEOUT = 60_000; // 60 saniye per dilim
const MAX_DATE_RANGE_DAYS = 93; // ~3 ay
const PAGE_SIZE = 50; // Güvenli pageSize (OR-2)
const MAX_CAPTCHA_RETRIES = 3; // Captcha max retry (WI-3)

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface EarsivFatura {
  unvan: string;
  tcknVkn: string;
  faturaNo: string;
  duzenlenmeTarihi: string;
  toplamTutar: number;
  odenecekTutar: string;
  vergilerTutari: number;
  paraBirimi: string;
  tesisatNumarasi: string;
  gonderimSekli: string;
  iptalItirazDurum: string | null;
  iptalItirazTarihi: string | null;
  mukellefTckn: string;
  mukellefVkn: string;
}

export interface EarsivQueryResult {
  success: boolean;
  invoices: EarsivFatura[];
  totalCount: number;
  completedChunks: string[];
  failedChunks: string[];
  sessionRefreshed: boolean; // PM-1: Re-login yapıldı mı?
  error?: string;
}

interface DateChunk {
  bas: string; // DD/MM/YYYY
  son: string; // DD/MM/YYYY
  label: string; // Kullanıcı dostu "01.01.2026 - 07.01.2026"
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ortak HTTP header'ları
 */
function getHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'User-Agent': USER_AGENT,
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'Cookie': 'i18next=tr',
    'Origin': DIJITAL_GIB_BASE,
    'Referer': `${DIJITAL_GIB_BASE}/`,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ═══════════════════════════════════════════════════════════════════════════
// Captcha Çözücü — OCR.space (birincil) + 2Captcha (fallback)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * OCR.space tek istek — belirtilen engine ile captcha çöz
 */
async function ocrSpaceRequest(cleanBase64: string, apiKey: string, engine: '1' | '2', scale: boolean = false): Promise<string | null> {
  const params: Record<string, string> = {
    apikey: apiKey,
    base64Image: `data:image/png;base64,${cleanBase64}`,
    OCREngine: engine,
    isOverlayRequired: 'false',
    language: 'eng',
  };
  if (scale) params.scale = 'true';
  if (engine === '2') params.isTable = 'false';

  const controller = new AbortController();
  const TIMEOUT_MS = 10000;
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const result = await response.json();
    if (result.IsErroredOnProcessing) {
      console.log(`[EARSIV-CAPTCHA] OCR.space E${engine} API hatası: ${result.ErrorMessage?.[0] || JSON.stringify(result.ErrorDetails)}`);
      return null;
    }
    if (result.ParsedResults?.[0]?.ParsedText) {
      const text = result.ParsedResults[0].ParsedText.trim().replace(/\s+/g, '').toLowerCase();
      if (text.length >= 4) return text;
      console.log(`[EARSIV-CAPTCHA] OCR.space E${engine} sonuç çok kısa: "${text}"`);
    }
    return null;
  } catch (e) {
    clearTimeout(timeout);
    const msg = (e as Error).name === 'AbortError' ? `zaman aşımı (${TIMEOUT_MS / 1000}s)` : (e as Error).message;
    console.log(`[EARSIV-CAPTCHA] OCR.space E${engine} hatası: ${msg}`);
    return null;
  }
}

/**
 * OCR.space ile captcha çöz — çoklu engine retry stratejisi
 * Deneme sırası: Engine 2 → Engine 2 (scale) → Engine 1
 */
async function solveWithOcrSpace(imageBase64: string, apiKey: string): Promise<string | null> {
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  // 1. Engine 2 — captcha-tarzı metin için daha iyi
  console.log('[EARSIV-CAPTCHA] OCR.space E2 deneniyor...');
  const r1 = await ocrSpaceRequest(cleanBase64, apiKey, '2');
  if (r1) { console.log(`[EARSIV-CAPTCHA] OCR.space E2 çözüm: ${r1}`); return r1; }

  // 2. Engine 2 + scale — küçük/bulanık captcha'lar için
  console.log('[EARSIV-CAPTCHA] OCR.space E2+scale deneniyor...');
  const r2 = await ocrSpaceRequest(cleanBase64, apiKey, '2', true);
  if (r2) { console.log(`[EARSIV-CAPTCHA] OCR.space E2+scale çözüm: ${r2}`); return r2; }

  // 3. Engine 1 — farklı OCR algoritması, bazı captcha'larda daha başarılı
  console.log('[EARSIV-CAPTCHA] OCR.space E1 deneniyor...');
  const r3 = await ocrSpaceRequest(cleanBase64, apiKey, '1', true);
  if (r3) { console.log(`[EARSIV-CAPTCHA] OCR.space E1 çözüm: ${r3}`); return r3; }

  console.log('[EARSIV-CAPTCHA] OCR.space tüm denemeler başarısız');
  return null;
}

/**
 * 2Captcha ile captcha çöz (yavaş ama güvenilir)
 */
async function solveWith2Captcha(imageBase64: string, apiKey: string): Promise<string | null> {
  try {
    console.log('[EARSIV-CAPTCHA] 2Captcha deneniyor...');
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const submitResponse = await fetch('https://2captcha.com/in.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        key: apiKey,
        method: 'base64',
        body: cleanBase64,
        json: '1',
        numeric: '0',
        min_len: '4',
        max_len: '7',
        language: '2',
        textinstructions: 'Captcha may contain dash (-) character. Include all characters.',
      }),
    });

    const submitResult = await submitResponse.json();
    if (submitResult.status !== 1) {
      console.log(`[EARSIV-CAPTCHA] 2Captcha submit başarısız:`, JSON.stringify(submitResult));
      return null;
    }

    const captchaId = submitResult.request;
    console.log(`[EARSIV-CAPTCHA] 2Captcha ID: ${captchaId}, polling başlıyor...`);

    // Polling (max 30 deneme × 3s = 90s)
    for (let i = 0; i < 30; i++) {
      await sleep(3000);
      const resultResponse = await fetch(
        `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`
      );
      const resultData = await resultResponse.json();

      if (resultData.status === 1) {
        const solution = resultData.request.toLowerCase();
        console.log(`[EARSIV-CAPTCHA] 2Captcha çözüm: ${solution}`);
        return solution;
      }
      if (resultData.request !== 'CAPCHA_NOT_READY') {
        console.log(`[EARSIV-CAPTCHA] 2Captcha beklenmeyen yanıt:`, JSON.stringify(resultData));
        return null;
      }
    }
    console.log('[EARSIV-CAPTCHA] 2Captcha zaman aşımı (90s)');
    return null;
  } catch (e) {
    console.log(`[EARSIV-CAPTCHA] 2Captcha hatası: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Captcha çöz — önce OCR.space, sonra 2Captcha fallback
 */
async function solveCaptcha(imageBase64: string, captchaApiKey: string, ocrSpaceApiKey?: string): Promise<string | null> {
  // Önce OCR.space dene (hızlı)
  if (ocrSpaceApiKey) {
    const result = await solveWithOcrSpace(imageBase64, ocrSpaceApiKey);
    if (result) return result;
    console.log('[EARSIV-CAPTCHA] OCR.space başarısız, 2Captcha deneniyor...');
  }

  // 2Captcha fallback
  if (captchaApiKey) {
    return await solveWith2Captcha(imageBase64, captchaApiKey);
  }

  console.log('[EARSIV-CAPTCHA] Hiçbir captcha servisi kullanılamadı!');
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// GİB Dijital VD Login
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GİB Dijital Vergi Dairesi'ne login yap, Bearer token döndür.
 *
 * @param userid - GİB kullanıcı kodu (gibKodu)
 * @param sifre - GİB şifresi (gibSifre)
 * @param captchaApiKey - 2Captcha API key
 * @param ocrSpaceApiKey - OCR.space API key (opsiyonel, öncelikli)
 * @param onProgress - İlerleme callback
 * @returns Bearer token string
 * @throws Hata durumunda Error fırlatır (AUTH_FAILED, CAPTCHA_FAILED, vb.)
 */
export async function gibDijitalLogin(
  userid: string,
  sifre: string,
  captchaApiKey: string,
  ocrSpaceApiKey?: string,
  onProgress?: (status: string) => void,
): Promise<string> {
  if (!captchaApiKey && !ocrSpaceApiKey) {
    throw new Error('CAPTCHA_SERVICE_DOWN: Captcha API key tanımlı değil');
  }

  console.log('[EARSIV-LOGIN] GİB Dijital VD login başlatılıyor...');

  for (let attempt = 1; attempt <= MAX_CAPTCHA_RETRIES; attempt++) {
    console.log(`[EARSIV-LOGIN] Deneme ${attempt}/${MAX_CAPTCHA_RETRIES}`);
    onProgress?.(`Giriş deneniyor (${attempt}/${MAX_CAPTCHA_RETRIES})...`);

    try {
      // 1. Captcha al
      onProgress?.('Captcha alınıyor...');
      const captchaResponse = await fetch(ENDPOINTS.CAPTCHA, {
        headers: getHeaders(),
      });

      if (!captchaResponse.ok) {
        console.log(`[EARSIV-LOGIN] Captcha API hatası: ${captchaResponse.status}`);
        continue;
      }

      // PM-5: Content-Type kontrolü
      const contentType = captchaResponse.headers.get('content-type') || '';
      if (!contentType.includes('application/json') && !contentType.includes('text/')) {
        throw new Error('GIB_MAINTENANCE: GİB şu anda bakımda olabilir');
      }

      const captchaData = await captchaResponse.json();
      const captchaId = captchaData.cid || `captcha_${Date.now()}`;
      const captchaBase64 = captchaData.captchaImgBase64 || '';

      if (!captchaBase64 || captchaBase64.length < 100) {
        console.log('[EARSIV-LOGIN] Captcha görseli alınamadı');
        continue;
      }

      // 2. Captcha çöz
      onProgress?.('Captcha çözülüyor...');
      const cleanBase64 = captchaBase64.replace(/^data:image\/\w+;base64,/, '');
      const captchaSolution = await solveCaptcha(cleanBase64, captchaApiKey, ocrSpaceApiKey);

      if (!captchaSolution) {
        console.log('[EARSIV-LOGIN] Captcha çözülemedi');
        continue;
      }

      console.log(`[EARSIV-LOGIN] Captcha çözüldü: ${captchaSolution}`);

      // 3. Login
      onProgress?.('GİB\'e giriş yapılıyor...');
      const loginPayload = {
        dk: captchaSolution,
        userid,
        sifre,
        imageId: captchaId,
      };

      const loginResponse = await fetch(ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(loginPayload),
      });

      const responseText = await loginResponse.text();

      // PM-5: JSON response kontrolü
      let loginData: { messages?: Array<{ code: string; text: string; type: string }> | null; token?: string; accessToken?: string };
      try {
        loginData = JSON.parse(responseText);
      } catch {
        throw new Error('GIB_MAINTENANCE: GİB yanıtı JSON formatında değil — bakım olabilir');
      }

      // Hata kontrolü
      const messages = loginData.messages || [];
      const errorMessages = messages.filter(m => m.type === 'ERROR');

      if (errorMessages.length > 0) {
        const firstError = errorMessages[0];
        const errorText = firstError.text || '';
        const errorTextLower = errorText.toLowerCase();

        // Captcha hatası → yeniden dene
        if (errorTextLower.includes('captcha') || errorTextLower.includes('güvenlik kodu') || errorTextLower.includes('guvenlik kodu')) {
          console.log(`[EARSIV-LOGIN] Captcha hatası, yeniden deneniyor...`);
          continue;
        }

        // Auth hatası → fatal
        if (errorTextLower.includes('kullanıcı') || errorTextLower.includes('şifre') || errorTextLower.includes('sifre') ||
            firstError.code?.toLowerCase().includes('invalid') || firstError.code?.toLowerCase().includes('auth')) {
          throw new Error(`AUTH_FAILED: ${errorText}`);
        }

        // Diğer hatalar → yeniden dene
        console.log(`[EARSIV-LOGIN] GİB hatası: ${errorText}`);
        continue;
      }

      // Token al
      const token = loginData.token || loginData.accessToken || '';
      if (!token) {
        console.log('[EARSIV-LOGIN] Token alınamadı');
        continue;
      }

      console.log(`[EARSIV-LOGIN] Giriş başarılı! Token: ${token.substring(0, 20)}...`);

      // Login sonrası user-info çağrısı — session context'i aktive etmek için
      try {
        onProgress?.('Kullanıcı bilgileri alınıyor...');
        const userInfoResponse = await fetch(ENDPOINTS.USER_INFO, {
          method: 'GET',
          headers: getHeaders(token),
        });
        if (userInfoResponse.ok) {
          const userInfoData = await userInfoResponse.json();
          console.log(`[EARSIV-LOGIN] User-info başarılı:`, JSON.stringify(userInfoData).substring(0, 200));
        } else {
          console.log(`[EARSIV-LOGIN] User-info başarısız: ${userInfoResponse.status} (devam ediliyor)`);
        }
      } catch (uiError) {
        console.log(`[EARSIV-LOGIN] User-info hatası: ${(uiError as Error).message} (devam ediliyor)`);
      }

      onProgress?.('GİB girişi başarılı');
      return token;

    } catch (e: unknown) {
      const error = e as Error;
      // Fatal hatalar → fırlat
      if (error.message?.startsWith('AUTH_FAILED') ||
          error.message?.startsWith('GIB_MAINTENANCE') ||
          error.message?.startsWith('CAPTCHA_SERVICE_DOWN')) {
        throw error;
      }
      // Geçici hatalar → yeniden dene
      console.log(`[EARSIV-LOGIN] Deneme ${attempt} hatası: ${error.message}`);
      if (attempt < MAX_CAPTCHA_RETRIES) {
        await sleep(2000);
      }
    }
  }

  throw new Error(`CAPTCHA_FAILED: ${MAX_CAPTCHA_RETRIES} denemede giriş yapılamadı`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Tarih Dilimleme
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tarih aralığını 7 günlük dilimlere böl.
 *
 * @param startDate - ISO string "2026-01-01"
 * @param endDate - ISO string "2026-01-31"
 * @returns DD/MM/YYYY formatında dilimler
 */
export function splitDateRange(startDate: string, endDate: string): DateChunk[] {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  // Max 93 gün (~3 ay) kontrol (F24)
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > MAX_DATE_RANGE_DAYS) {
    throw new Error('INVALID_DATE_RANGE: Maksimum 3 aylık dönem sorgulanabilir');
  }
  if (diffDays < 0) {
    throw new Error('INVALID_DATE_RANGE: Başlangıç tarihi bitiş tarihinden sonra olamaz');
  }

  const chunks: DateChunk[] = [];
  let current = new Date(start);

  while (current <= end) {
    const chunkStart = new Date(current);
    const chunkEnd = new Date(current);
    chunkEnd.setDate(chunkEnd.getDate() + 6); // 7 gün (inclusive)

    if (chunkEnd > end) {
      chunkEnd.setTime(end.getTime());
    }

    const bas = formatDateDDMMYYYY(chunkStart);
    const son = formatDateDDMMYYYY(chunkEnd);
    const label = `${formatDateDot(chunkStart)} - ${formatDateDot(chunkEnd)}`;

    chunks.push({ bas, son, label });

    // Sonraki dilim
    current.setDate(chunkEnd.getDate() + 1);
  }

  return chunks;
}

function formatDateDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateDot(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// E-Arşiv Alıcı Listesi Sorgulama
// ═══════════════════════════════════════════════════════════════════════════

/**
 * E-Arşiv alış faturalarını sorgula.
 * Tarih aralığını 7 günlük dilimlere böler, her dilimi sorgular, sonuçları stream eder.
 *
 * @param token - Bearer token (gibDijitalLogin'den)
 * @param dateRange - { startDate: "2026-01-01", endDate: "2026-01-31" }
 * @param captchaApiKey - Re-login için 2Captcha API key (PM-1)
 * @param ocrSpaceApiKey - Re-login için OCR.space API key (opsiyonel)
 * @param loginCredentials - Re-login için credential bilgileri (PM-1)
 * @param onProgress - İlerleme callback
 * @param onResults - Fatura sonuçları callback (streaming)
 * @returns Birleşik sonuçlar
 */
export async function queryEarsivAliciList(
  token: string,
  dateRange: { startDate: string; endDate: string },
  captchaApiKey: string,
  ocrSpaceApiKey: string | undefined,
  loginCredentials: { userid: string; sifre: string },
  onProgress?: (status: string) => void,
  onResults?: (invoices: EarsivFatura[], progress: { chunk: number; totalChunks: number; pageNo: number }) => void,
): Promise<EarsivQueryResult> {
  const chunks = splitDateRange(dateRange.startDate, dateRange.endDate);
  const allInvoices: EarsivFatura[] = [];
  const completedChunks: string[] = [];
  const failedChunks: string[] = [];
  let currentToken = token;
  let sessionRefreshed = false;

  console.log(`[EARSIV-QUERY] ${chunks.length} dilim sorgulanacak`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkLabel = `${chunk.label}`;

    onProgress?.(`${chunkLabel} sorgulanıyor (${i + 1}/${chunks.length})`);
    console.log(`[EARSIV-QUERY] Dilim ${i + 1}/${chunks.length}: ${chunk.bas} - ${chunk.son}`);

    try {
      // Per-chunk timeout (F25)
      const chunkResult = await Promise.race([
        queryChunk(currentToken, chunk, i, chunks.length, onProgress, onResults),
        sleep(PER_CHUNK_TIMEOUT).then(() => { throw new Error('CHUNK_TIMEOUT'); }),
      ]) as EarsivFatura[];

      allInvoices.push(...chunkResult);
      completedChunks.push(`${chunk.bas} - ${chunk.son}`);

    } catch (e: unknown) {
      const error = e as Error;

      // PM-1: 401 → Re-login dene (1 kez)
      if (error.message?.includes('401') && !sessionRefreshed) {
        console.log('[EARSIV-QUERY] Token expired, re-login deneniyor...');
        onProgress?.('Oturum yenileniyor...');
        try {
          currentToken = await gibDijitalLogin(
            loginCredentials.userid,
            loginCredentials.sifre,
            captchaApiKey,
            ocrSpaceApiKey,
            onProgress,
          );
          sessionRefreshed = true;

          // Bu dilimi tekrar dene
          try {
            const retryResult = await Promise.race([
              queryChunk(currentToken, chunk, i, chunks.length, onProgress, onResults),
              sleep(PER_CHUNK_TIMEOUT).then(() => { throw new Error('CHUNK_TIMEOUT'); }),
            ]) as EarsivFatura[];
            allInvoices.push(...retryResult);
            completedChunks.push(`${chunk.bas} - ${chunk.son}`);
            continue;
          } catch (retryError) {
            failedChunks.push(`${chunk.bas} - ${chunk.son} (${(retryError as Error).message})`);
          }
        } catch (loginError) {
          failedChunks.push(`${chunk.bas} - ${chunk.son} (re-login başarısız: ${(loginError as Error).message})`);
        }
        continue;
      }

      // Diğer hatalar → failedChunks'a ekle, devam et
      const errorMsg = error.message === 'CHUNK_TIMEOUT'
        ? 'zaman aşımı (60s)'
        : error.message || 'bilinmeyen hata';
      failedChunks.push(`${chunk.bas} - ${chunk.son} (${errorMsg})`);
      console.log(`[EARSIV-QUERY] Dilim ${i + 1} hatası: ${errorMsg}`);

      // Kurtarılamaz hatalar — kalan dilimleri denemeye gerek yok, hemen dur
      // 1. GİB dönem sınırı hatası
      // 2. Telefon güncelleme zorunluluğu / yetki hatası
      const isDateLimitError = error.message?.includes('önceki 2 aya kadar');
      const isAuthServiceError = error.message?.includes('tdvd.auth.servis.yetki.hata') || error.message?.includes('yetkiniz bulunmamaktadır');
      if (isDateLimitError || isAuthServiceError) {
        const reason = isAuthServiceError
          ? 'GİB yetki/telefon hatası'
          : 'dönem sınırı';
        console.log(`[EARSIV-QUERY] ${reason} hatası algılandı, kalan ${chunks.length - i - 1} dilim atlanıyor`);
        for (let j = i + 1; j < chunks.length; j++) {
          failedChunks.push(`${chunks[j].bas} - ${chunks[j].son} (${errorMsg})`);
        }
        break;
      }
    }

    // Rate limiting: dilimler arası bekleme
    if (i < chunks.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  const result: EarsivQueryResult = {
    success: completedChunks.length > 0 || allInvoices.length > 0,
    invoices: allInvoices,
    totalCount: allInvoices.length,
    completedChunks,
    failedChunks,
    sessionRefreshed,
  };

  console.log(`[EARSIV-QUERY] Tamamlandı: ${allInvoices.length} fatura, ${completedChunks.length} başarılı, ${failedChunks.length} hatalı dilim`);
  return result;
}

/**
 * Tek bir 7 günlük dilimi sorgula (pagination dahil)
 */
async function queryChunk(
  token: string,
  chunk: DateChunk,
  chunkIndex: number,
  totalChunks: number,
  onProgress?: (status: string) => void,
  onResults?: (invoices: EarsivFatura[], progress: { chunk: number; totalChunks: number; pageNo: number }) => void,
): Promise<EarsivFatura[]> {
  const chunkInvoices: EarsivFatura[] = [];
  let pageNo = 1;

  while (pageNo <= MAX_PAGES_PER_CHUNK) {
    const payload = {
      data: {
        duzenlenmeTarihiBas: chunk.bas,
        duzenlenmeTarihiSon: chunk.son,
      },
      meta: {
        pagination: { pageNo, pageSize: PAGE_SIZE },
        sortFieldName: 'faturaNo',
        sortType: 'DESC',
        filters: [],
      },
    };

    const response = await fetch(ENDPOINTS.EARSIV_ALICI_LIST, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload),
    });

    // WI-6: 429 Rate limit → exponential backoff
    if (response.status === 429) {
      const delays = [5000, 10000, 20000];
      let retried = false;
      for (const delay of delays) {
        onProgress?.(`GİB istek limiti aşıldı, ${delay / 1000}s bekleniyor...`);
        console.log(`[EARSIV-QUERY] 429 Rate limit, ${delay}ms bekleniyor...`);
        await sleep(delay);

        const retryResponse = await fetch(ENDPOINTS.EARSIV_ALICI_LIST, {
          method: 'POST',
          headers: getHeaders(token),
          body: JSON.stringify(payload),
        });

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const invoices = retryData.resultListDenormalized || [];
          if (invoices.length > 0) {
            chunkInvoices.push(...invoices);
            onResults?.(invoices, { chunk: chunkIndex + 1, totalChunks, pageNo });
          }
          const totalPage = retryData.pageDetail?.totalPage || 1;
          if (pageNo >= totalPage) { retried = true; break; }
          pageNo++;
          retried = true;
          break;
        }
        if (retryResponse.status !== 429) {
          throw new Error(`HTTP ${retryResponse.status}`);
        }
      }
      if (!retried) {
        throw new Error('RATE_LIMIT: 3 backoff denemesi sonrası hâlâ 429');
      }
      await sleep(DELAY_BETWEEN_REQUESTS);
      continue;
    }

    // PM-1: 401 Unauthorized → token expired
    if (response.status === 401) {
      throw new Error('401: Token expired');
    }

    // 409 Conflict → GİB bu dilimde fatura bulamadı, boş sonuç döndür
    if (response.status === 409) {
      console.log(`[EARSIV-QUERY] Dilim ${chunk.bas}-${chunk.son}: fatura bulunamadı (409)`);
      return chunkInvoices;
    }

    if (!response.ok) {
      // Hata response body'sini oku — GİB'in gerçek hata mesajını görmek için
      let errorBody = '';
      let readableError = '';
      try {
        errorBody = await response.text();
        console.log(`[EARSIV-QUERY] HTTP ${response.status} hata detayı:`, errorBody.substring(0, 500));

        // GİB JSON hata mesajını parse et — code + text birlikte sakla
        const parsed = JSON.parse(errorBody);
        if (parsed.messages && Array.isArray(parsed.messages)) {
          readableError = parsed.messages.map((m: { code?: string; text?: string }) => {
            const prefix = m.code ? `[${m.code}] ` : '';
            return prefix + (m.text || '');
          }).filter(Boolean).join('; ');
        }
      } catch {
        // Body okunamadı veya parse edilemedi
      }
      throw new Error(readableError || `HTTP ${response.status}`);
    }

    // PM-5: Content-Type kontrolü
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('GIB_MAINTENANCE: Yanıt JSON değil — GİB bakımda olabilir');
    }

    const data = await response.json();

    // WI-1: Response format validation
    if (data.resultListDenormalized !== undefined && !Array.isArray(data.resultListDenormalized)) {
      throw new Error('GIB_API_CHANGED: resultListDenormalized beklenen formatta değil');
    }

    const invoices: EarsivFatura[] = data.resultListDenormalized || [];

    if (invoices.length > 0) {
      chunkInvoices.push(...invoices);
      onResults?.(invoices, { chunk: chunkIndex + 1, totalChunks, pageNo });
    }

    // Pagination kontrolü
    const totalPage = data.pageDetail?.totalPage || 1;
    if (pageNo >= totalPage) break;

    if (pageNo > 1) {
      onProgress?.(`${chunk.label} — ek faturalar alınıyor (sayfa ${pageNo}/${totalPage})`);
    }

    pageNo++;
    await sleep(DELAY_BETWEEN_REQUESTS);
  }

  return chunkInvoices;
}
