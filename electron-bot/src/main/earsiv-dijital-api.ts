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
// Captcha Çözücü — ddddocr Lokal ONNX Model
// ═══════════════════════════════════════════════════════════════════════════

import { solveCaptchaLocal } from './captcha-local';

/**
 * Captcha çöz — ddddocr lokal ONNX model (~10ms, ücretsiz, offline)
 */
async function solveCaptcha(imageBase64: string): Promise<string | null> {
  try {
    const result = await solveCaptchaLocal(imageBase64);
    if (result) {
      console.log(`[EARSIV-CAPTCHA] ddddocr çözüm: ${result}`);
      return result;
    }
    console.log('[EARSIV-CAPTCHA] ddddocr çözüm başarısız (sonuç kısa veya hata)');
    return null;
  } catch (e) {
    console.log(`[EARSIV-CAPTCHA] ddddocr hatası: ${(e as Error).message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GİB Dijital VD Login
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GİB Dijital Vergi Dairesi'ne login yap, Bearer token döndür.
 * Captcha çözümü ddddocr lokal ONNX model ile yapılır (~10ms).
 * Captcha yanlışsa otomatik yeni captcha ister ve tekrar dener.
 *
 * @param userid - GİB kullanıcı kodu (gibKodu)
 * @param sifre - GİB şifresi (gibSifre)
 * @param captchaApiKey - Kullanılmıyor (geriye uyumluluk için tutuldu)
 * @param ocrSpaceApiKey - Kullanılmıyor (geriye uyumluluk için tutuldu)
 * @param onProgress - İlerleme callback
 * @returns Bearer token string
 * @throws Hata durumunda Error fırlatır (AUTH_FAILED, CAPTCHA_FAILED, vb.)
 */
export async function gibDijitalLogin(
  userid: string,
  sifre: string,
  captchaApiKey?: string,
  ocrSpaceApiKey?: string,
  onProgress?: (status: string) => void,
): Promise<string> {
  console.log('[EARSIV-LOGIN] GİB Dijital VD login başlatılıyor (ddddocr lokal model)...');

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

      // 2. Captcha çöz — ddddocr lokal model
      onProgress?.('Captcha çözülüyor (lokal model)...');
      const cleanBase64 = captchaBase64.replace(/^data:image\/\w+;base64,/, '');
      const captchaSolution = await solveCaptcha(cleanBase64);

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
