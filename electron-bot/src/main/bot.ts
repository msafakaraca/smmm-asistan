/**
 * GİB E-Beyanname Bot - HTTP API Version
 * ========================================
 * Puppeteer yerine doğrudan HTTP API kullanır
 * src/lib/gib-api kütüphanesi ile entegre
 */

import { parseHizmetListesi, parseTahakkukFisi, HizmetListesiParsed, TahakkukFisiParsed } from './sgk-parser';
import { parseKdvTahakkuk, KdvTahakkukParsed } from './kdv-parser';
import { parseKdv2Tahakkuk, Kdv2TahakkukParsed } from './kdv2-parser';
import { parseKdv9015Tahakkuk, Kdv9015TahakkukParsed } from './kdv9015-parser';
import { parseGeciciVergiTahakkuk, GeciciVergiTahakkukParsed } from './gecici-vergi-parser';
import { getApiUrl } from './config';

// ═══════════════════════════════════════════════════════════════════
// CONFIG - HTTP API için optimize edilmiş
// ═══════════════════════════════════════════════════════════════════
export const GIB_CONFIG = {
    // API Endpoints
    DIJITAL_GIB: {
        CAPTCHA: 'https://dijital.gib.gov.tr/apigateway/captcha/getnewcaptcha',
        LOGIN: 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/login',
        EBYN_LOGIN: 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/ebyn-login',
        IVD_LOGIN: 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/intvrg-login',
    },
    EBEYANNAME: {
        DISPATCH: 'https://ebeyanname.gib.gov.tr/dispatch',
    },
    TWOCAPTCHA_API: 'https://2captcha.com',

    // Rate Limiting - Adaptive Backoff System
    RATE_LIMIT: {
        BETWEEN_REQUESTS: 1800,  // GİB kuralı: 1520 → 1800ms (daha güvenli base delay)
        BETWEEN_PAGES: 1200,     // 1000 → 1200ms
        BETWEEN_DOWNLOADS: 1800, // 1520 → 1800ms

        // Adaptive Backoff Parameters
        BASE_RETRY_WAIT: 2000,           // İlk retry için 2s bekle (1500'den arttırıldı)
        COOLDOWN_AFTER_500: 5000,        // İLK 500 sonrası 5s soğuma
        MAX_DELAY: 2500,                 // Normal işlemler için maksimum delay
        CONSECUTIVE_500_THRESHOLD: 2,    // 2 ardışık 500 sonrası büyük cooldown
        BIG_COOLDOWN: 8000,              // Büyük cooldown süresi (cascade failure için)

        // Eski değerler (uyumluluk için)
        RETRY_WAIT: 2000,                // 1500 → 2000ms
        RETRY_MAX_WAIT: 8000,            // 5000 → 8000ms
    },

    // Timeouts
    TIMEOUTS: {
        HTTP_REQUEST: 30000,
        CAPTCHA_SOLVE: 60000,
    },

    // Retry
    MAX_RETRIES: 3,
    MAX_CAPTCHA_RETRIES: 5,
    MAX_PAGE_RETRIES: 20,
};

// HTTP Headers
const HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Language': 'tr-TR,tr;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Origin': 'https://dijital.gib.gov.tr',
    'Referer': 'https://dijital.gib.gov.tr/portal/login',
};

// ═══════════════════════════════════════════════════════════════════
// HATA KODLARI SİSTEMİ
// ═══════════════════════════════════════════════════════════════════

export const GIB_ERROR_CODES = {
    GIB_SESSION_EXPIRED: {
        code: 'GIB_SESSION_EXPIRED',
        message: 'GİB oturumu sona erdi',
        description: 'Başka bir yerden GİB\'e giriş yapıldı veya oturum zaman aşımına uğradı.',
        isCritical: true,
        userAction: 'Lütfen botu yeniden başlatın. Aynı anda başka bir cihazdan GİB\'e giriş yapmadığınızdan emin olun.'
    },
    GIB_AUTH_FAILED: {
        code: 'GIB_AUTH_FAILED',
        message: 'GİB giriş başarısız',
        description: 'Kullanıcı adı, şifre veya parola hatalı olabilir.',
        isCritical: true,
        userAction: 'GİB kullanıcı adı ve şifrenizi kontrol edin. Şifrenizi yakın zamanda değiştirdiyseniz SMMM Asistan\'da güncellemeyi unutmayın.'
    },
    GIB_CAPTCHA_FAILED: {
        code: 'GIB_CAPTCHA_FAILED',
        message: 'CAPTCHA doğrulaması başarısız',
        description: 'GİB güvenlik kodu birden fazla denemede çözülemedi.',
        isCritical: true,
        userAction: 'Captcha servisi geçici olarak yanıt vermiyor olabilir. Birkaç dakika bekleyip tekrar deneyin.'
    },
    HTTP_401: {
        code: 'HTTP_401',
        message: 'GİB yetkilendirme hatası',
        description: 'GİB oturumu geçersiz veya süresi dolmuş.',
        isCritical: false,
        userAction: 'Bot otomatik olarak yeniden giriş deneyecek. Sorun devam ederse botu yeniden başlatın.'
    },
    HTTP_403: {
        code: 'HTTP_403',
        message: 'GİB erişim engeli',
        description: 'Bu işlem için yetkiniz bulunmuyor veya GİB tarafından geçici erişim kısıtlaması uygulandı.',
        isCritical: false,
        userAction: 'Birkaç dakika bekleyip tekrar deneyin. Sorun devam ederse GİB yetkilerinizi kontrol edin.'
    },
    HTTP_500: {
        code: 'HTTP_500',
        message: 'GİB sunucusu yanıt vermiyor',
        description: 'GİB sunucularında geçici bir sorun yaşanıyor.',
        isCritical: false,
        userAction: 'GİB sistemlerinde bakım veya yoğunluk olabilir. Birkaç dakika sonra tekrar deneyin.'
    },
    PDF_INVALID: {
        code: 'PDF_INVALID',
        message: 'PDF dosyası okunamadı',
        description: 'İndirilen PDF dosyası bozuk veya geçersiz formatta.',
        isCritical: false,
        userAction: 'Bot ilgili beyanname için tekrar deneyecek. Sorun devam ederse beyanname durumunu manuel kontrol edin.'
    },
    PDF_TIMEOUT: {
        code: 'PDF_TIMEOUT',
        message: 'PDF indirme zaman aşımına uğradı',
        description: 'GİB sunucusu PDF dosyasını zamanında göndermedi.',
        isCritical: false,
        userAction: 'Ağ bağlantınız yavaş olabilir veya GİB sunucuları meşgul. Bot otomatik olarak tekrar deneyecek.'
    },
    TIMEOUT: {
        code: 'TIMEOUT',
        message: 'İstek zaman aşımına uğradı',
        description: 'GİB sunucusu beklenen sürede yanıt vermedi.',
        isCritical: false,
        userAction: 'İnternet bağlantınızı kontrol edin. GİB sunucuları yoğun saatlerde yavaşlayabilir.'
    },
    UNKNOWN: {
        code: 'UNKNOWN',
        message: 'Beklenmeyen bir hata oluştu',
        description: 'İşlem sırasında tanımlanamayan bir sorun meydana geldi.',
        isCritical: false,
        userAction: 'Lütfen botu yeniden başlatmayı deneyin. Sorun tekrarlanırsa destek ekibiyle iletişime geçin.'
    }
} as const;

export type GibErrorCode = keyof typeof GIB_ERROR_CODES;

export interface GibError {
    code: GibErrorCode;
    message: string;
    description?: string;
    isCritical: boolean;
    userAction: string | null;
    originalError?: string;
    timestamp?: string;
}

export function detectErrorCode(errorMessage: string): GibErrorCode {
    const msg = errorMessage.toLowerCase();

    if (msg.includes('oturum') && (msg.includes('sona erdi') || msg.includes('timeout'))) {
        return 'GIB_SESSION_EXPIRED';
    }
    if (msg.includes('hatalıdır') || msg.includes('yanlış') || msg.includes('giriş başarısız')) {
        return 'GIB_AUTH_FAILED';
    }
    if (msg.includes('captcha') && (msg.includes('çözülemedi') || msg.includes('failed'))) {
        return 'GIB_CAPTCHA_FAILED';
    }
    if (msg.includes('401') || msg.includes('unauthorized')) return 'HTTP_401';
    if (msg.includes('403') || msg.includes('forbidden')) return 'HTTP_403';
    if (msg.includes('500') || msg.includes('internal server error')) return 'HTTP_500';
    if (msg.includes('invalid pdf') || msg.includes('geçersiz pdf')) return 'PDF_INVALID';
    if (msg.includes('timeout')) return 'TIMEOUT';

    return 'UNKNOWN';
}

export function createGibError(errorMessage: string, originalError?: Error): GibError {
    const code = detectErrorCode(errorMessage);
    const errorInfo = GIB_ERROR_CODES[code];

    return {
        code,
        message: errorInfo.message,
        description: 'description' in errorInfo ? errorInfo.description : undefined,
        isCritical: errorInfo.isCritical,
        userAction: errorInfo.userAction,
        originalError: originalError?.message || errorMessage,
        timestamp: new Date().toISOString()
    };
}

// ═══════════════════════════════════════════════════════════════════
// TYPES - Mevcut arayüzler korunuyor
// ═══════════════════════════════════════════════════════════════════
export type BeyannameData = {
    beyannameTuru: string;
    tcVkn: string;
    adSoyadUnvan: string;
    vergiDairesi: string;
    vergilendirmeDonemi: string;
    yuklemeZamani: string;
    oid?: string;
    tahakkukOid?: string;
    // PDF indirme başarı durumu - Beyanname Takip tablosu için kritik
    success?: boolean;  // true = PDF başarıyla indirildi, "verildi" olarak işaretlenecek
    beyannameBuffer?: string;
    tahakkukBuffer?: string;
    beyannamePath?: string;
    tahakkukPath?: string;
    sgkTahakkukBuffer?: string;
    sgkTahakkukPath?: string;
    sgkHizmetBuffer?: string;
    sgkHizmetPath?: string;
    tahakkukDurumu?: string;
    sgkTahakkukParsed?: TahakkukFisiParsed;
    sgkHizmetParsed?: HizmetListesiParsed;
    kdvTahakkukParsed?: KdvTahakkukParsed;
    kdv2TahakkukParsed?: Kdv2TahakkukParsed;
    kdv9015TahakkukParsed?: Kdv9015TahakkukParsed;
    geciciVergiTahakkukParsed?: GeciciVergiTahakkukParsed;
    sgkTahakkukBuffers?: Array<{ buffer: string; index: number; parsed?: TahakkukFisiParsed }>;
    sgkHizmetBuffers?: Array<{ buffer: string; index: number; parsed?: HizmetListesiParsed }>;
    sgkTahakkukToplam?: {
        isciSayisi: number;
        netTutar: number;
        gunSayisi: number;
        dosyaSayisi: number;
    };
    sgkHizmetToplam?: {
        isciSayisi: number;
        dosyaSayisi: number;
    };
};

export interface BotOptions {
    tenantId?: string;
    username: string;
    password: string;
    parola?: string;
    captchaKey?: string;
    startDate: string;
    endDate: string;
    donemBasAy?: number;
    donemBasYil?: number;
    donemBitAy?: number;
    donemBitYil?: number;
    downloadFiles?: boolean;
    token?: string;
    vergiNo?: string;
    tcKimlikNo?: string;
    beyannameTuru?: string;
    onProgress: (type: string, data: any) => void;
}

// Internal types
interface BeyannameItem {
    oid: string;
    tahakkukOid?: string;
    sgkBildiriOid?: string;
    muhsgkDetailOid?: string;
    beyannameTuru: string;
    tcVkn: string;
    adSoyadUnvan: string;
    vergiDairesi: string;
    vergilendirmeDonemi: string;
    yuklemeZamani: string;
    hasSgkDetails?: boolean;
    durum: 'onaylandi' | 'hata' | 'iptal' | 'onay_bekliyor' | 'bilinmiyor';
}

interface PaginationInfo {
    currentPage: number;
    totalPages: number;
    baseQuery: string;
}

interface MuhsgkDetailPdfs {
    sgkTahakkukUrls: string[];
    hizmetListesiUrls: string[];
}

// Pre-download check types
interface PreDownloadedCustomer {
    vkn: string;
    beyannameTuru: string;
    downloadedTypes: string[];
}

interface PreDownloadCheck {
    vkn: string;
    beyannameTuru: string;
    downloadedTypes: Set<string>;
}

// ═══════════════════════════════════════════════════════════════════
// DEBUG MODE
// ═══════════════════════════════════════════════════════════════════
const DEBUG_MODE = process.env.GIB_DEBUG === 'true';

// ═══════════════════════════════════════════════════════════════════
// BOT STOP MECHANISM
// ═══════════════════════════════════════════════════════════════════
let botShouldStop = false;

// ═══════════════════════════════════════════════════════════════════
// RATE LIMIT STATE TRACKING (HTTP 500 Adaptive Backoff)
// ═══════════════════════════════════════════════════════════════════
let consecutiveHttp500Count = 0;
let lastHttp500Time = 0;
let currentDelay = GIB_CONFIG.RATE_LIMIT.BETWEEN_DOWNLOADS; // 1800ms başlangıç

function getAdaptiveDelay(): number {
    // Ardışık 500 hatası varsa delay'i artır
    if (consecutiveHttp500Count >= 2) {
        return Math.min(currentDelay + 300, GIB_CONFIG.RATE_LIMIT.MAX_DELAY); // 2500ms max
    }
    return currentDelay;
}

function resetRateLimitState(): void {
    consecutiveHttp500Count = 0;
    currentDelay = GIB_CONFIG.RATE_LIMIT.BETWEEN_DOWNLOADS;
}

export function stopBot() {
    console.log('[GIB-BOT] 🛑 Bot durdurma sinyali alındı!');
    botShouldStop = true;
}

export function resetBotStopFlag() {
    botShouldStop = false;
}

function checkIfStopped(): boolean {
    return botShouldStop;
}

// ═══════════════════════════════════════════════════════════════════
// LOGGING SYSTEM
// ═══════════════════════════════════════════════════════════════════
const colors = {
    reset: '\x1b[0m',
    blue: '\x1b[34m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m',
    dim: '\x1b[2m'
};

function getTimestamp(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');
    const secs = now.getSeconds().toString().padStart(2, '0');
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${mins}:${secs}.${ms}`;
}

const log = {
    debug: (msg: string) => {
        if (DEBUG_MODE) {
            console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.dim}[DEBUG]${colors.reset} 🔍 ${msg}`);
        }
    },
    verbose: (msg: string) => {
        if (DEBUG_MODE) {
            console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.dim}[VERBOSE]${colors.reset} 📝 ${msg}`);
        }
    },
    info: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.cyan}[BİLGİ]${colors.reset} ℹ️ ${msg}`),
    success: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.green}[BAŞARILI]${colors.reset} ✅ ${msg}`),
    warn: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.yellow}[UYARI]${colors.reset} ⚠️ ${msg}`),
    error: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.red}[HATA]${colors.reset} ❌ ${msg}`),
    download: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.magenta}[İNDİRME]${colors.reset} 📥 ${msg}`),
    skip: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.yellow}[ATLANDI]${colors.reset} ⏭️ ${msg}`),
    customerTime: (vkn: string, name: string, seconds: number) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.cyan}[SÜRE]${colors.reset} ⏱️ ${vkn} - ${name}: ${seconds.toFixed(1)}s`),
    http: (method: string, url: string, status?: number, duration?: number) => {
        const statusColor = status && status >= 200 && status < 300 ? colors.green :
                           status && status >= 400 ? colors.red : colors.yellow;
        const statusText = status ? `${statusColor}${status}${colors.reset}` : '...';
        const durationText = duration ? ` (${duration}ms)` : '';
        console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.blue}[HTTP]${colors.reset} 🌐 ${method} ${url.substring(0, 80)}... → ${statusText}${durationText}`);
    },
    separator: (title?: string) => {
        const line = '═'.repeat(60);
        if (title) {
            console.log(`${colors.cyan}╔${line}╗${colors.reset}`);
            console.log(`${colors.cyan}║${colors.reset} ${title.padEnd(58)} ${colors.cyan}║${colors.reset}`);
            console.log(`${colors.cyan}╚${line}╝${colors.reset}`);
        } else {
            console.log(`${colors.gray}${line}${colors.reset}`);
        }
    }
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDate(dateStr: string): { year: string; month: string; day: string; formatted: string; display: string } {
    const date = new Date(dateStr);
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return {
        year,
        month,
        day,
        formatted: `${year}${month}${day}`,
        display: `${day}.${month}.${year}`
    };
}

// Beyanname türü normalize
const BEYANNAME_TYPE_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
    { code: 'KDV9015', pattern: /KDV.*9015|KDV9015|TEVK[İI]FAT.*M[ÜU]KELLEF/i },
    { code: 'KDV1', pattern: /KDV.*1|KDV1/i },
    { code: 'KDV2', pattern: /KDV.*2|KDV2/i },
    { code: 'MUHSGK', pattern: /MUHSGK|MUHTASAR|SGK/i },
    { code: 'GV', pattern: /GEL[İI]R.*VERG[İI]S[İI]|^GV$/i },
    { code: 'GGECICI', pattern: /GEL[İI]R.*GE[ÇC][İI]C[İI]|GVG|GGEC/i },
    { code: 'KV', pattern: /KURUMLAR.*VERG[İI]S[İI]|^KV$/i },
    { code: 'KGECICI', pattern: /KURUMLAR.*GE[ÇC][İI]C[İI]|KVG|KGEC/i },
    { code: 'BABS', pattern: /BA.*BS|BABS/i },
    { code: 'DAMGA', pattern: /DAMGA/i },
];

function normalizeBeyannameTuru(beyannameTuru: string): string {
    const normalizedType = beyannameTuru.toUpperCase();
    for (const { code, pattern } of BEYANNAME_TYPE_PATTERNS) {
        if (pattern.test(normalizedType)) return code;
    }
    const firstWord = normalizedType.split(/\s+/)[0].replace(/[^A-Z0-9]/g, '').substring(0, 15);
    if (firstWord === 'KDV') return 'KDV1';
    return firstWord || 'DIGER';
}

// Dönem hesaplama
function calculateBeyannameDonem(searchDate: Date, beyannameTuru: string): { year: number; month: number } {
    const searchYear = searchDate.getFullYear();
    const searchMonth = searchDate.getMonth() + 1;

    const isQuarterly = /G(EC|EÇ)İC|K(EC|EÇ)İC/i.test(beyannameTuru);

    if (isQuarterly) {
        let quarter: number;
        let year = searchYear;

        if (searchMonth >= 1 && searchMonth <= 3) {
            quarter = 4;
            year = searchYear - 1;
        } else if (searchMonth >= 4 && searchMonth <= 6) {
            quarter = 1;
        } else if (searchMonth >= 7 && searchMonth <= 9) {
            quarter = 2;
        } else {
            quarter = 3;
        }

        const quarterEndMonth = quarter * 3;
        return { year, month: quarterEndMonth };
    }

    let beyannameMonth = searchMonth - 1;
    let beyannameYear = searchYear;

    if (beyannameMonth === 0) {
        beyannameMonth = 12;
        beyannameYear = searchYear - 1;
    }

    return { year: beyannameYear, month: beyannameMonth };
}

// ═══════════════════════════════════════════════════════════════════
// CAPTCHA SOLVER
// ═══════════════════════════════════════════════════════════════════

async function solveWith2Captcha(base64Image: string, apiKey: string): Promise<string | null> {
    try {
        log.debug('2Captcha\'ya captcha gönderiliyor...');
        const submitRes = await fetch(`${GIB_CONFIG.TWOCAPTCHA_API}/in.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                key: apiKey,
                method: 'base64',
                body: base64Image,
                json: '1',
                numeric: '0',
                min_len: '4',
                max_len: '7',
                language: '2',
            }),
        });

        const submitData = await submitRes.json();
        if (submitData.status !== 1) {
            log.warn(`2Captcha submit hatası: ${JSON.stringify(submitData)}`);
            return null;
        }

        const captchaId = submitData.request;
        log.debug(`2Captcha ID: ${captchaId}, çözülmesi bekleniyor...`);

        for (let i = 0; i < 20; i++) {
            await delay(3000);
            const resultRes = await fetch(
                `${GIB_CONFIG.TWOCAPTCHA_API}/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`
            );
            const resultData = await resultRes.json();

            if (resultData.status === 1) {
                return resultData.request.toLowerCase();
            }
            if (resultData.request !== 'CAPCHA_NOT_READY') {
                log.warn(`2Captcha hatası: ${JSON.stringify(resultData)}`);
                return null;
            }
        }

        log.warn('2Captcha timeout');
        return null;
    } catch (error) {
        log.error(`2Captcha hatası: ${(error as Error).message}`);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// GİB LOGIN (HTTP API)
// ═══════════════════════════════════════════════════════════════════

async function dijitalGibLogin(username: string, password: string, captchaKey: string): Promise<{ token: string } | null> {
    log.separator('Dijital GİB Login');

    // 1. Captcha al
    log.debug('Captcha alınıyor...');
    const captchaRes = await fetch(GIB_CONFIG.DIJITAL_GIB.CAPTCHA, { headers: HEADERS });

    if (!captchaRes.ok) {
        log.error(`Captcha API hatası: ${captchaRes.status}`);
        return null;
    }

    const captchaData = await captchaRes.json();
    log.debug(`Captcha CID: ${captchaData.cid}`);

    // 2. Captcha çöz
    log.debug('Captcha çözülüyor...');
    const solution = await solveWith2Captcha(captchaData.captchaImgBase64, captchaKey);
    if (!solution) {
        log.error('Captcha çözülemedi!');
        return null;
    }
    log.debug(`Captcha çözümü: ${solution}`);

    // 3. Login
    log.debug('Login yapılıyor...');
    const loginPayload = {
        dk: solution,
        userid: username,
        sifre: password,
        imageId: captchaData.cid,
    };

    const loginRes = await fetch(GIB_CONFIG.DIJITAL_GIB.LOGIN, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(loginPayload),
    });

    const loginData = await loginRes.json();

    if (loginData.token) {
        log.success('Dijital GİB login başarılı!');
        return { token: loginData.token };
    }

    // Hata mesajını kontrol et
    if (loginData.messages && Array.isArray(loginData.messages)) {
        const errorMsg = loginData.messages.find((m: any) => m.type === 'ERROR');
        if (errorMsg) {
            log.error(`Login hatası: ${errorMsg.text}`);
        }
    }

    log.error('Dijital GİB login başarısız');
    return null;
}

async function getEbeyanToken(dijitalToken: string): Promise<string | null> {
    log.debug('E-Beyanname token alınıyor...');

    const response = await fetch(GIB_CONFIG.DIJITAL_GIB.EBYN_LOGIN, {
        method: 'GET',
        headers: {
            ...HEADERS,
            'Authorization': `Bearer ${dijitalToken}`,
        },
    });

    const data = await response.json();

    if (data.redirectUrl) {
        const tokenMatch = data.redirectUrl.match(/TOKEN=([^&]+)/);
        if (tokenMatch) {
            const token = tokenMatch[1];
            log.debug(`E-Beyanname token: ${token.substring(0, 30)}...`);

            // Session aktive et
            log.debug('Session aktive ediliyor...');
            await fetch(data.redirectUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': HEADERS['User-Agent'],
                },
            });

            log.success('E-Beyanname session aktive edildi');
            return token;
        }
    }

    log.error('E-Beyanname token alınamadı');
    return null;
}

// ═══════════════════════════════════════════════════════════════════
// BEYANNAME SEARCH
// ═══════════════════════════════════════════════════════════════════

// GİB API beyannameTanim parametresi için kısa kod → GİB tanım adı eşlemesi
const GIB_BEYANNAME_TANIM_MAP: Record<string, string> = {
    'KDV1': 'KDV1',
    'KDV2': 'KDV2',
    'KDV9015': 'KDV9015',
    'MUHSGK': 'MUHSGK',
    'GGECICI': 'GGECICI',
    'KGECICI': 'KGECICI',
    'GELIR': 'GELIR',
    'KURUMLAR': 'KURUMLAR',
    'DAMGA': 'DAMGA',
    'POSET': 'POSET',
    'KONAKLAMA': 'KONAKLAMA',
    'TURIZM': 'TURIZM',
};

function resolveBeyannameTanim(code: string): string {
    return GIB_BEYANNAME_TANIM_MAP[code.toUpperCase()] || code;
}

async function fetchBeyannamePage(
    ebeyanToken: string,
    baslangicTarihi: string,
    bitisTarihi: string,
    pageNumber: number = 1,
    searchFilters?: {
        vergiNo?: string;
        tcKimlikNo?: string;
        beyannameTuru?: string;
    }
): Promise<{ beyannameler: BeyannameItem[]; pagination: PaginationInfo | null; newToken: string }> {
    log.debug(`Sayfa ${pageNumber} çekiliyor...`);

    const unixTimestamp = Math.floor(Date.now() / 1000);

    // GİB form sıralaması: cmd → sorguTipiN → vergiNo → sorguTipiT → tcKimlikNo
    // → sorguTipiB → beyannameTanim → sorguTipiZ → baslangicTarihi → bitisTarihi → pageNo → TOKEN
    // NOT: GİB her sayfada tüm filtrelerin tekrar gönderilmesini bekliyor!
    const formData = new URLSearchParams();
    formData.append('cmd', 'BEYANNAMELISTESI');

    // VKN filtresi
    if (searchFilters?.vergiNo) {
        formData.append('sorguTipiN', '1');
        formData.append('vergiNo', searchFilters.vergiNo);
    }
    // TCK filtresi
    if (searchFilters?.tcKimlikNo) {
        formData.append('sorguTipiT', '1');
        formData.append('tcKimlikNo', searchFilters.tcKimlikNo);
    }
    // Beyanname türü filtresi
    if (searchFilters?.beyannameTuru) {
        const gibTanim = resolveBeyannameTanim(searchFilters.beyannameTuru);
        formData.append('sorguTipiB', '1');
        formData.append('beyannameTanim', gibTanim);
        if (pageNumber === 1) {
            log.info(`Beyanname türü filtresi: ${searchFilters.beyannameTuru} → beyannameTanim=${gibTanim}`);
        }
    }
    // beyannameTuru yoksa sorguTipiB gönderilmez -> TÜM türler gelir

    // Tarih aralığı (her zaman aktif)
    formData.append('sorguTipiZ', '1');
    formData.append('baslangicTarihi', baslangicTarihi);
    formData.append('bitisTarihi', bitisTarihi);

    // Sayfa numarası (sayfa 2+ için)
    if (pageNumber > 1) {
        formData.append('pageNo', String(pageNumber));
    }

    formData.append('TOKEN', ebeyanToken);

    log.debug(`FormData (sayfa ${pageNumber}): ${formData.toString().replace(/TOKEN=[^&]+/, 'TOKEN=***')}`);

    const response = await fetch(`${GIB_CONFIG.EBEYANNAME.DISPATCH}?_dc=${unixTimestamp}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': HEADERS['User-Agent'],
            'Origin': 'https://ebeyanname.gib.gov.tr',
            'Referer': 'https://ebeyanname.gib.gov.tr/',
        },
        body: formData.toString(),
    });

    const html = await response.text();

    let contentHtml = html;
    const htmlContentMatch = html.match(/<HTMLCONTENT>([\s\S]*?)<\/HTMLCONTENT>/i);
    if (htmlContentMatch) {
        contentHtml = htmlContentMatch[1];
    }

    // Yeni TOKEN'ı al
    const tokenMatch = html.match(/<TOKEN>([^<]+)<\/TOKEN>/);
    const newToken = tokenMatch ? tokenMatch[1] : ebeyanToken;

    // Sayfalama bilgisini parse et
    let pagination: PaginationInfo | null = null;
    const paginationMatch = contentHtml.match(
        /digerSayfayaGecis\([^,]+,\s*'nextPage'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([^']+)'/
    );
    if (paginationMatch) {
        pagination = {
            currentPage: parseInt(paginationMatch[1], 10),
            totalPages: parseInt(paginationMatch[2], 10),
            baseQuery: paginationMatch[3],
        };
        log.debug(`Sayfalama: ${pagination.currentPage}/${pagination.totalPages}`);
    }

    const beyannameler: BeyannameItem[] = [];
    // GİB OID'leri her türlü karakter içerebilir (URL-encoded, özel karakterler vb.)
    // [^"]+ : Tırnak hariç tüm karakterleri yakala - EN GENEL ÇÖZÜM
    const rowRegex = /<tr[^>]*id="row([^"]+)"[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(contentHtml)) !== null) {
        const rowId = rowMatch[1];
        const rowHtml = rowMatch[2];

        // ═══════════════════════════════════════════════════════════════════
        // GÜÇLENDİRİLMİŞ DURUM TESPİTİ v2.0
        // ═══════════════════════════════════════════════════════════════════
        // GİB HTML Yapısı:
        // <td id="durumTD{oid}"><img src="images/ok.gif">&nbsp;Onaylandı</td>
        // <td id="durumTD{oid}"><img src="images/err.gif">&nbsp;Hatalı</td>
        // <td id="durumTD{oid}"><img src="images/wtng.gif">&nbsp;Onay bekliyor</td>
        // <td id="durumTD{oid}"><img src="images/iptal.gif">&nbsp;İptal Edildi</td>
        // ═══════════════════════════════════════════════════════════════════

        let durum: BeyannameItem['durum'] = 'bilinmiyor';

        // YÖNTEMİ 1: durumTD{oid} hücresini bul (EN GÜVENİLİR)
        // Bu hücre sadece durum bilgisi içerir, mükellef adıyla karışmaz
        // rowId'de regex özel karakterleri olabilir (örn: Xe6%C4%9EY-.O.%C4%9E%C4%9EA3k)
        const escapedRowId = rowId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const durumTdRegex = new RegExp(`<td[^>]*id=["']durumTD${escapedRowId}["'][^>]*>([\\s\\S]*?)<\\/td>`, 'i');
        const durumTdMatch = rowHtml.match(durumTdRegex);

        if (durumTdMatch) {
            const durumTdContent = durumTdMatch[1];
            const durumTdLower = durumTdContent.toLowerCase();

            // İkon dosya adından tespit
            if (durumTdLower.includes('ok.gif')) {
                durum = 'onaylandi';
            } else if (durumTdLower.includes('err.gif') || durumTdLower.includes('error.gif')) {
                durum = 'hata';
            } else if (durumTdLower.includes('wtng.gif') || durumTdLower.includes('wait.gif')) {
                durum = 'onay_bekliyor';
            } else if (durumTdLower.includes('iptal.gif') || durumTdLower.includes('del.gif') || durumTdLower.includes('cancel.gif')) {
                durum = 'iptal';
            }
            // Text'ten tespit (backup)
            else if (durumTdLower.includes('onaylandı') || durumTdLower.includes('onaylandi')) {
                durum = 'onaylandi';
            } else if (durumTdLower.includes('hatalı') || durumTdLower.includes('hatali')) {
                durum = 'hata';
            } else if (durumTdLower.includes('onay bekliyor') || durumTdLower.includes('bekliyor')) {
                durum = 'onay_bekliyor';
            } else if (durumTdLower.includes('iptal')) {
                durum = 'iptal';
            }

            log.verbose(`Durum tespiti (durumTD): OID=${rowId}, Durum=${durum}, Content="${durumTdContent.substring(0, 50).replace(/\s+/g, ' ').trim()}..."`);
        }

        // YÖNTEMİ 2: Vergi Tahakkuku Durumu hücresi (9. sütun civarı)
        // GİB'de durum ikonları genellikle ayrı bir <table> içinde
        if (durum === 'bilinmiyor') {
            // Nested table içindeki durum ikonunu bul
            const nestedTableMatch = rowHtml.match(/<table[^>]*>[\s\S]*?<img[^>]*src=["']images\/(ok|err|wtng|iptal|del|cancel|error|wait)\.gif["'][^>]*>[\s\S]*?<\/table>/i);
            if (nestedTableMatch) {
                const iconType = nestedTableMatch[1].toLowerCase();
                if (iconType === 'ok') durum = 'onaylandi';
                else if (iconType === 'err' || iconType === 'error') durum = 'hata';
                else if (iconType === 'wtng' || iconType === 'wait') durum = 'onay_bekliyor';
                else if (iconType === 'iptal' || iconType === 'del' || iconType === 'cancel') durum = 'iptal';

                log.verbose(`Durum tespiti (nested table): OID=${rowId}, Durum=${durum}, Icon=${iconType}`);
            }
        }

        // YÖNTEMİ 3: Satırdaki tüm durum ikonlarını tara
        if (durum === 'bilinmiyor') {
            // Sadece durum ikonlarını bul (pdf_b.gif, pdf_t.gif gibi diğer ikonları atla)
            const statusIconRegex = /<img[^>]*src=["'][^"']*\/(ok|err|wtng|iptal|del|cancel|error|wait)\.gif["'][^>]*>/gi;
            let iconMatch;

            while ((iconMatch = statusIconRegex.exec(rowHtml)) !== null) {
                const iconType = iconMatch[1].toLowerCase();
                if (iconType === 'ok') {
                    durum = 'onaylandi';
                    break; // Onaylandı en yüksek öncelik
                } else if (iconType === 'err' || iconType === 'error') {
                    durum = 'hata';
                } else if ((iconType === 'wtng' || iconType === 'wait') && durum !== 'hata') {
                    durum = 'onay_bekliyor';
                } else if ((iconType === 'iptal' || iconType === 'del' || iconType === 'cancel') && durum !== 'hata' && durum !== 'onay_bekliyor') {
                    durum = 'iptal';
                }
            }

            if (durum !== 'bilinmiyor') {
                log.verbose(`Durum tespiti (icon scan): OID=${rowId}, Durum=${durum}`);
            }
        }

        // DEBUG: Bilinmeyen durumlarda detaylı log yaz
        if (durum === 'bilinmiyor') {
            log.warn(`⚠️ Durum tespit edilemedi (OID: ${rowId})`);
            if (DEBUG_MODE) {
                log.debug(`HTML snippet: ${rowHtml.substring(0, 300).replace(/\s+/g, ' ')}...`);
            }
        }

        const cells: string[] = [];
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let cellMatch;

        while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
            let cellContent = cellMatch[1]
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            const titleMatch = cellMatch[0].match(/title="([^"]+)"/);
            if (titleMatch && cellContent.endsWith('...')) {
                cellContent = titleMatch[1];
            }

            cells.push(cellContent);
        }

        if (cells.length >= 5) {
            // Tahakkuk OID bul - [^'"]+ ile tüm karakterleri yakala
            const tahakkukMatch = rowHtml.match(
                /tahakkukGoruntule\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]/
            );

            // SGK Bildiri OID bul - [^'"]+ ile tüm karakterleri yakala
            const sgkBildiriMatch = rowHtml.match(
                /sgkTahakkukGoruntule\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]/
            );

            // MUHSGK detay OID bul - [^'"]+ ile tüm karakterleri yakala
            const muhsgkDetailOidMatch = rowHtml.match(/bynGoruntu\(['"]([^'"]+)['"]/);

            // MUHSGK kontrolü
            const beyannameTuru = cells[1] || '';
            const isMuhsgk = beyannameTuru.toUpperCase() === 'MUHSGK' ||
                             (beyannameTuru.toLowerCase().includes('muhtasar') &&
                              beyannameTuru.toLowerCase().includes('prim'));

            // OID'leri decode et - HTML'de URL-encoded olarak geliyor (%C4%9E gibi)
            // URLSearchParams tekrar encode edeceği için çift encoding'i önle
            const safeDecodeOid = (oid: string | undefined): string | undefined => {
                if (!oid) return undefined;
                try {
                    return decodeURIComponent(oid);
                } catch {
                    return oid; // Decode edilemezse orijinali kullan
                }
            };

            beyannameler.push({
                oid: safeDecodeOid(rowId)!,
                tahakkukOid: safeDecodeOid(tahakkukMatch ? tahakkukMatch[2] : undefined),
                sgkBildiriOid: safeDecodeOid(sgkBildiriMatch ? sgkBildiriMatch[2] : undefined),
                muhsgkDetailOid: safeDecodeOid(muhsgkDetailOidMatch ? muhsgkDetailOidMatch[1] : undefined),
                beyannameTuru: beyannameTuru,
                tcVkn: cells[2] || '',
                adSoyadUnvan: cells[3] || '',
                vergiDairesi: cells[4] || '',
                vergilendirmeDonemi: cells[5] || '',
                yuklemeZamani: cells[7] || '',
                hasSgkDetails: isMuhsgk || beyannameTuru.toUpperCase() === 'MUHSGK',
                durum: durum,
            });
        }
    }

    log.debug(`Sayfa ${pageNumber}: ${beyannameler.length} beyanname bulundu`);
    return { beyannameler, pagination, newToken };
}

// ═══════════════════════════════════════════════════════════════════
// PDF DOWNLOAD FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

async function downloadPdf(
    beyannameOid: string,
    type: 'beyanname' | 'tahakkuk',
    token: string,
    tahakkukOid?: string,
    maxRetries: number = 3  // 2 → 3 (daha fazla şans)
): Promise<{ success: boolean; base64?: string; fileSize?: number; error?: string }> {
    log.download(`${type} PDF indiriliyor: ${beyannameOid}`);

    const params = new URLSearchParams({
        cmd: 'IMAJ',
        subcmd: type === 'beyanname' ? 'BEYANNAMEGORUNTULE' : 'TAHAKKUKGORUNTULE',
        beyannameOid: beyannameOid,
        goruntuTip: '1',
        inline: 'true',
        TOKEN: token,
    });

    if (type === 'tahakkuk' && tahakkukOid) {
        params.append('tahakkukOid', tahakkukOid);
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const unixTimestamp = Math.floor(Date.now() / 1000);
        const url = `${GIB_CONFIG.EBEYANNAME.DISPATCH}?_dc=${unixTimestamp}&${params.toString()}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/pdf,application/octet-stream,*/*',
                    'User-Agent': HEADERS['User-Agent'],
                    'Referer': 'https://ebeyanname.gib.gov.tr/',
                },
            });

            log.http('GET', url, response.status);

            // HTTP 500 hatası - Adaptive Backoff Sistemi
            if (response.status === 500) {
                consecutiveHttp500Count++;
                lastHttp500Time = Date.now();

                // İLK 500 hatası - 5 saniye cooldown
                if (consecutiveHttp500Count === 1) {
                    log.warn(`⚠️ İLK HTTP 500! ${GIB_CONFIG.RATE_LIMIT.COOLDOWN_AFTER_500}ms cooldown başlatılıyor...`);
                    await delay(GIB_CONFIG.RATE_LIMIT.COOLDOWN_AFTER_500); // 5000ms
                    currentDelay = 2000; // Delay'i artır
                }
                // Ardışık 500 hatası - daha uzun bekleme
                else if (consecutiveHttp500Count >= GIB_CONFIG.RATE_LIMIT.CONSECUTIVE_500_THRESHOLD) {
                    log.warn(`⚠️ ${consecutiveHttp500Count}. ardışık HTTP 500! ${GIB_CONFIG.RATE_LIMIT.BIG_COOLDOWN}ms büyük cooldown...`);
                    await delay(GIB_CONFIG.RATE_LIMIT.BIG_COOLDOWN); // 8000ms
                    currentDelay = GIB_CONFIG.RATE_LIMIT.MAX_DELAY; // 2500ms
                }

                if (attempt < maxRetries) {
                    // Progressive backoff: 2s, 3s, 4s...
                    const retryWait = GIB_CONFIG.RATE_LIMIT.BASE_RETRY_WAIT + (attempt - 1) * 1000;
                    log.warn(`${type} PDF HTTP 500, ${retryWait}ms beklenip tekrar deneniyor (${attempt}/${maxRetries})...`);
                    await delay(retryWait);
                    continue;
                }

                return { success: false, error: `HTTP 500 (${attempt} deneme sonrası)` };
            }

            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
            }

            // Başarılı istek - state'i resetle
            if (consecutiveHttp500Count > 0) {
                log.success(`✅ Rate limit normale döndü (${consecutiveHttp500Count} hata sonrası)`);
                resetRateLimitState();
            }

            const contentType = response.headers.get('content-type') || '';

            // PDF ise
            if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
                const buffer = await response.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');

                if (base64.length > 1000) {
                    log.success(`${type} PDF indirildi: ${buffer.byteLength} bytes`);
                    return { success: true, base64, fileSize: buffer.byteLength };
                }
            }

            // HTML/XML response
            const text = await response.text();

            // XML içinden PDF kontrolü
            if (text.includes('<PDFFILE>')) {
                const pdfMatch = text.match(/<PDFFILE>([^<]+)<\/PDFFILE>/);
                if (pdfMatch) {
                    const base64Pdf = pdfMatch[1];
                    log.success(`${type} PDF (XML) indirildi: ${base64Pdf.length} chars`);
                    return { success: true, base64: base64Pdf, fileSize: base64Pdf.length };
                }
            }

            // Hata mesajı kontrolü
            if (text.includes('EYEKSERROR') || text.includes('SERVERERROR')) {
                const errorMatch = text.match(/<EYEKSERROR>([^<]+)<\/EYEKSERROR>/) ||
                                  text.match(/<SERVERERROR>([^<]+)<\/SERVERERROR>/);
                if (errorMatch) {
                    return { success: false, error: errorMatch[1] };
                }
            }

            return { success: false, error: `Beklenmeyen Content-Type: ${contentType}` };
        } catch (error) {
            if (attempt < maxRetries) {
                const backoffWait = Math.min(
                    GIB_CONFIG.RATE_LIMIT.RETRY_WAIT * Math.pow(1.5, attempt - 1),
                    GIB_CONFIG.RATE_LIMIT.RETRY_MAX_WAIT
                );
                log.warn(`${type} PDF hatası, ${backoffWait}ms beklenip tekrar deneniyor (${attempt}/${maxRetries})...`);
                await delay(backoffWait);
                continue;
            }
            return { success: false, error: (error as Error).message };
        }
    }

    return { success: false, error: 'Max retry exceeded' };
}

async function getMuhsgkDetailPdfs(beyannameOid: string, token: string): Promise<MuhsgkDetailPdfs> {
    log.debug(`MUHSGK Detay PDF'leri: ${beyannameOid}`);

    const result: MuhsgkDetailPdfs = {
        sgkTahakkukUrls: [],
        hizmetListesiUrls: [],
    };

    try {
        const unixTimestamp = Math.floor(Date.now() / 1000);
        const formData = new URLSearchParams({
            cmd: 'THKESASBILGISGKMESAJLARI',
            beyannameOid: beyannameOid,
            TOKEN: token,
        });

        const response = await fetch(`${GIB_CONFIG.EBEYANNAME.DISPATCH}?_dc=${unixTimestamp}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': HEADERS['User-Agent'],
                'Origin': 'https://ebeyanname.gib.gov.tr',
                'Referer': 'https://ebeyanname.gib.gov.tr/',
            },
            body: formData.toString(),
        });

        if (!response.ok) {
            log.error(`Detay popup hatası: HTTP ${response.status}`);
            return result;
        }

        const rawHtml = await response.text();
        log.debug(`Detay popup alındı: ${rawHtml.length} chars`);

        // HTML entity decode - GİB bazen &quot; &apos; &#39; kullanıyor
        const html = rawHtml
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&#39;/g, "'")
            .replace(/&#34;/g, '"')
            .replace(/&amp;/g, '&');

        // OID decode helper - HTML'de URL-encoded geliyor, decode edip tekrar encode ediyoruz
        const safeDecodeEncode = (oid: string): string => {
            try {
                return encodeURIComponent(decodeURIComponent(oid));
            } catch {
                return encodeURIComponent(oid);
            }
        };

        // SGK URL parse helper
        const parseSgkUrls = (funcName: string, subcmd: string): string[] => {
            const urls: string[] = [];
            // Pattern 1: Standart quote'lu format - sgkTahakkukGoruntule('oid1', 'oid2')
            const regex = new RegExp(`${funcName}\\s*\\(\\s*['"]([^'"]+)['"]\\s*,\\s*['"]([^'"]+)['"]`, 'gi');
            let m;
            while ((m = regex.exec(html)) !== null) {
                const bynOid = safeDecodeEncode(m[1]);
                const sgkOid = safeDecodeEncode(m[2]);
                const url = `${GIB_CONFIG.EBEYANNAME.DISPATCH}?cmd=IMAJ&subcmd=${subcmd}&TOKEN=__TOKEN__&beyannameOid=${bynOid}&sgkTahakkukOid=${sgkOid}&inline=true`;
                if (!urls.some(u => u.includes(sgkOid))) {
                    urls.push(url);
                    log.debug(`${funcName} URL bulundu: sgkOid=${sgkOid}`);
                }
            }
            return urls;
        };

        // SGK Tahakkuk PDF URL'leri
        result.sgkTahakkukUrls = parseSgkUrls('sgkTahakkukGoruntule', 'SGKTAHAKKUKGORUNTULE');

        // Hizmet Listesi PDF URL'leri
        result.hizmetListesiUrls = parseSgkUrls('sgkHizmetGoruntule', 'SGKHIZMETGORUNTULE');

        // NOT: sgkTopluTahakkukGoruntule (toplu indirme butonu) kasıtlı olarak EKLENMEZ.
        // Toplu buton farklı bir OID kullanır ve bireysel SGKTAHAKKUKGORUNTULE endpoint'iyle
        // uyumsuz olduğu için "İşlem Başarısız!" hatası verir.

        // Özet log - her zaman göster (debug değil)
        if (result.sgkTahakkukUrls.length > 0 || result.hizmetListesiUrls.length > 0) {
            log.info(`   📋 MUHSGK Detay: ${result.sgkTahakkukUrls.length} Tahakkuk, ${result.hizmetListesiUrls.length} Hizmet URL bulundu`);
        } else {
            // HTML içeriğini analiz et: gerçekten SGK verisi yok mu, yoksa parse hatası mı?
            const htmlLower = html.toLowerCase();
            const hasSgkKeywords = htmlLower.includes('sgktahakkuk') || htmlLower.includes('sgkhizmet') ||
                                   htmlLower.includes('sgk_tahakkuk') || htmlLower.includes('sgk_hizmet');
            const hasOnclick = htmlLower.includes('onclick');
            const hasPdfIcon = htmlLower.includes('pdf_s') || htmlLower.includes('pdf_h') || htmlLower.includes('.pdf');
            const hasGoruntule = htmlLower.includes('goruntule');

            if (hasSgkKeywords || (hasOnclick && hasPdfIcon) || hasGoruntule) {
                // HTML'de SGK pattern'leri VAR ama regex yakalayamadı → gerçek parse hatası
                log.error(`   ❌ MUHSGK Detay: SGK pattern'leri HTML'de var ama URL parse edilemedi! (HTML: ${rawHtml.length} chars)`);
                log.warn(`   🔍 Bulunan pattern'ler: sgkKeywords=${hasSgkKeywords}, onclick=${hasOnclick}, pdfIcon=${hasPdfIcon}, goruntule=${hasGoruntule}`);
                // Parse hatası durumunda HTML'i detaylı logla
                log.debug(`   HTML (ilk 1500 char): ${rawHtml.substring(0, 1500)}`);
            } else {
                // HTML'de hiç SGK pattern'i yok → bu mükellefin gerçekten SGK çalışanı yok
                log.info(`   ℹ️ MUHSGK Detay: Bu beyannamede SGK verisi bulunmuyor (HTML: ${rawHtml.length} chars)`);
            }
        }

    } catch (error) {
        log.error(`MUHSGK detay hatası: ${(error as Error).message}`);
    }

    return result;
}

async function downloadSgkPdf(
    url: string,
    token: string,
    maxRetries: number = 3  // 2 → 3 (daha fazla şans)
): Promise<{ success: boolean; base64?: string; fileSize?: number; error?: string }> {
    const urlWithToken = url.replace('__TOKEN__', token);
    log.download(`SGK PDF indiriliyor...`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(urlWithToken, {
                method: 'GET',
                headers: {
                    'Accept': 'application/pdf,application/octet-stream,*/*',
                    'User-Agent': HEADERS['User-Agent'],
                    'Referer': 'https://ebeyanname.gib.gov.tr/',
                },
            });

            log.http('GET', urlWithToken, response.status);

            // HTTP 500 hatası - Adaptive Backoff Sistemi
            if (response.status === 500) {
                consecutiveHttp500Count++;
                lastHttp500Time = Date.now();

                // İLK 500 hatası - 5 saniye cooldown
                if (consecutiveHttp500Count === 1) {
                    log.warn(`⚠️ İLK HTTP 500! ${GIB_CONFIG.RATE_LIMIT.COOLDOWN_AFTER_500}ms cooldown başlatılıyor...`);
                    await delay(GIB_CONFIG.RATE_LIMIT.COOLDOWN_AFTER_500); // 5000ms
                    currentDelay = 2000; // Delay'i artır
                }
                // Ardışık 500 hatası - daha uzun bekleme
                else if (consecutiveHttp500Count >= GIB_CONFIG.RATE_LIMIT.CONSECUTIVE_500_THRESHOLD) {
                    log.warn(`⚠️ ${consecutiveHttp500Count}. ardışık HTTP 500! ${GIB_CONFIG.RATE_LIMIT.BIG_COOLDOWN}ms büyük cooldown...`);
                    await delay(GIB_CONFIG.RATE_LIMIT.BIG_COOLDOWN); // 8000ms
                    currentDelay = GIB_CONFIG.RATE_LIMIT.MAX_DELAY; // 2500ms
                }

                if (attempt < maxRetries) {
                    // Progressive backoff: 2s, 3s, 4s...
                    const retryWait = GIB_CONFIG.RATE_LIMIT.BASE_RETRY_WAIT + (attempt - 1) * 1000;
                    log.warn(`SGK PDF HTTP 500, ${retryWait}ms beklenip tekrar deneniyor (${attempt}/${maxRetries})...`);
                    await delay(retryWait);
                    continue;
                }

                return { success: false, error: `HTTP 500 (${attempt} deneme sonrası)` };
            }

            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
            }

            // Başarılı istek - state'i resetle
            if (consecutiveHttp500Count > 0) {
                log.success(`✅ Rate limit normale döndü (${consecutiveHttp500Count} hata sonrası)`);
                resetRateLimitState();
            }

            const contentType = response.headers.get('content-type') || '';
            log.debug(`SGK Response Content-Type: ${contentType}`);

            // PDF veya octet-stream ise direkt binary olarak işle
            if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
                const buffer = await response.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');

                log.debug(`SGK PDF buffer size: ${buffer.byteLength} bytes, base64 length: ${base64.length}`);

                if (base64.length > 1000) {
                    log.success(`SGK PDF indirildi: ${buffer.byteLength} bytes`);
                    return { success: true, base64, fileSize: buffer.byteLength };
                } else {
                    // Küçük PDF - muhtemelen boş veya hata
                    log.warn(`SGK PDF çok küçük: ${buffer.byteLength} bytes - muhtemelen boş veya hatalı`);
                    // Yine de döndür, boş değilse işe yarar
                    if (base64.length > 100) {
                        return { success: true, base64, fileSize: buffer.byteLength };
                    }
                    return { success: false, error: `PDF çok küçük: ${buffer.byteLength} bytes` };
                }
            }

            // PDF değilse text olarak oku
            const text = await response.text();
            log.debug(`SGK Response text length: ${text.length}, first 200 chars: ${text.substring(0, 200)}`);

            if (text.includes('<PDFFILE>')) {
                const pdfMatch = text.match(/<PDFFILE>([^<]+)<\/PDFFILE>/);
                if (pdfMatch) {
                    const base64Pdf = pdfMatch[1];
                    log.success(`SGK PDF (XML) indirildi: ${base64Pdf.length} chars`);
                    return { success: true, base64: base64Pdf, fileSize: base64Pdf.length };
                }
            }

            if (text.includes('EYEKSERROR') || text.includes('SERVERERROR')) {
                const errorMatch = text.match(/<EYEKSERROR>([^<]+)<\/EYEKSERROR>/) ||
                                  text.match(/<SERVERERROR>([^<]+)<\/SERVERERROR>/);
                if (errorMatch) {
                    const errorMsg = errorMatch[1];
                    // "Bir sistem hatası oluştu" gibi geçici hatalar için retry yap
                    const isTransient = errorMsg.includes('sistem hatası') ||
                                       errorMsg.includes('daha sonra tekrar') ||
                                       errorMsg.includes('zaman aşımı') ||
                                       errorMsg.includes('timeout');
                    if (isTransient && attempt < maxRetries) {
                        const retryWait = GIB_CONFIG.RATE_LIMIT.BASE_RETRY_WAIT + (attempt - 1) * 1000;
                        log.warn(`SGK PDF GİB geçici hatası: "${errorMsg}" - ${retryWait}ms beklenip tekrar deneniyor (${attempt}/${maxRetries})...`);
                        await delay(retryWait);
                        continue;
                    }
                    return { success: false, error: errorMsg };
                }
            }

            return { success: false, error: `Beklenmeyen Content-Type: ${contentType}` };
        } catch (error) {
            if (attempt < maxRetries) {
                const backoffWait = Math.min(
                    GIB_CONFIG.RATE_LIMIT.RETRY_WAIT * Math.pow(1.5, attempt - 1),
                    GIB_CONFIG.RATE_LIMIT.RETRY_MAX_WAIT
                );
                log.warn(`SGK PDF hatası, ${backoffWait}ms beklenip tekrar deneniyor (${attempt}/${maxRetries})...`);
                await delay(backoffWait);
                continue;
            }
            return { success: false, error: (error as Error).message };
        }
    }

    return { success: false, error: 'Max retry exceeded' };
}

// ═══════════════════════════════════════════════════════════════════
// PRE-DOWNLOAD CHECK
// ═══════════════════════════════════════════════════════════════════

async function getPreDownloadedCustomers(
    apiToken: string,
    year: number,
    month: number
): Promise<Map<string, PreDownloadCheck>> {
    const result = new Map<string, PreDownloadCheck>();

    try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/gib/pre-downloaded?year=${year}&month=${month}`, {
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            log.warn(`Pre-download check API hatası: ${response.status}`);
            return result;
        }

        const data = await response.json();

        if (data.success && data.customers) {
            for (const customer of data.customers as PreDownloadedCustomer[]) {
                const mapKey = `${customer.vkn}_${customer.beyannameTuru}`;
                result.set(mapKey, {
                    vkn: customer.vkn,
                    beyannameTuru: customer.beyannameTuru,
                    downloadedTypes: new Set(customer.downloadedTypes)
                });
            }
            log.success(`${result.size} VKN+Tür kombinasyonu için mevcut dosyalar kontrol edildi`);
        }
    } catch (error: any) {
        log.warn(`Pre-download check hatası: ${error.message}`);
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN BOT FUNCTION
// ═══════════════════════════════════════════════════════════════════

export async function runElectronBot(options: BotOptions) {
    const { username, password, startDate, endDate, onProgress, captchaKey, downloadFiles = true, token, vergiNo, tcKimlikNo, beyannameTuru } = options;

    // Stop flag'i sıfırla - yeni bot başlıyor
    resetBotStopFlag();

    // Rate limit state'ini sıfırla - yeni bot session
    resetRateLimitState();

    log.separator('GİB E-BEYANNAME BOT (HTTP API)');
    log.debug(`Tarih aralığı: ${startDate} - ${endDate}`);
    log.debug(`PDF indirme: ${downloadFiles ? 'EVET' : 'HAYIR'}`);
    log.debug(`Kullanıcı: ${username}`);
    log.separator();

    // Stats
    const stats = {
        total: 0,
        pages: 0,
        duration: 0,
        downloaded: 0,
        skipped: 0,
        failed: 0,
        newCustomers: 0,
        preSkipped: 0
    };

    let preDownloadedMap: Map<string, PreDownloadCheck> = new Map();
    const allBeyannameler: BeyannameData[] = [];
    const startTime = Date.now();

    const report = (percent: number, message: string) => {
        console.log(`[GIB-BOT] %${percent} - ${message}`);
        onProgress('progress', { message, progress: percent });
    };

    // Her beyanname için detaylı progress (tam ünvan ve parse bilgisi)
    const reportBeyanname = (
        index: number,
        total: number,
        beyanname: any,
        status: string,
        parseInfo?: {
            kdv?: { odenecek?: number; devreden?: number };
            kdv2?: { odenecek?: number; devreden?: number };
            kdv9015?: { odenecek?: number; devreden?: number };
            geciciVergi?: { odenecek?: number };
            sgk?: { isciSayisi?: number; netTutar?: number; dosyaSayisi?: number };
        }
    ) => {
        const percent = 75 + (index / total) * 20;
        const turu = beyanname.beyannameTuru || 'BEYANNAME';
        const unvan = beyanname.adSoyadUnvan || 'Bilinmeyen';

        // Parse bilgilerini metin olarak oluştur
        let parseText = '';
        if (parseInfo) {
            const parts: string[] = [];
            if (parseInfo.kdv) {
                if (parseInfo.kdv.odenecek !== undefined && parseInfo.kdv.odenecek > 0) {
                    parts.push(`Ödenecek: ${parseInfo.kdv.odenecek.toLocaleString('tr-TR')}₺`);
                } else if (parseInfo.kdv.devreden !== undefined && parseInfo.kdv.devreden > 0) {
                    parts.push(`Devreden: ${parseInfo.kdv.devreden.toLocaleString('tr-TR')}₺`);
                }
            }
            if (parseInfo.kdv2) {
                if (parseInfo.kdv2.odenecek !== undefined && parseInfo.kdv2.odenecek > 0) {
                    parts.push(`Ödenecek: ${parseInfo.kdv2.odenecek.toLocaleString('tr-TR')}₺`);
                }
            }
            if (parseInfo.sgk) {
                if (parseInfo.sgk.isciSayisi !== undefined) {
                    parts.push(`${parseInfo.sgk.isciSayisi} işçi`);
                }
                if (parseInfo.sgk.netTutar !== undefined) {
                    parts.push(`${parseInfo.sgk.netTutar.toLocaleString('tr-TR')}₺`);
                }
                if (parseInfo.sgk.dosyaSayisi !== undefined && parseInfo.sgk.dosyaSayisi > 1) {
                    parts.push(`${parseInfo.sgk.dosyaSayisi} dosya`);
                }
            }
            if (parts.length > 0) {
                parseText = ` | ${parts.join(' | ')}`;
            }
        }

        const message = `[${index}/${total}] ${status} ${turu} - ${unvan}${parseText}`;

        // Terminal log
        console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.green}[İŞLEM]${colors.reset} ${message}`);

        // WebSocket progress
        onProgress('progress', { message, progress: percent });
    };

    // Pre-download check (sessiz)
    if (token && downloadFiles) {
        try {
            const searchDate = new Date(startDate);
            const donem = calculateBeyannameDonem(searchDate, 'NORMAL');
            preDownloadedMap = await getPreDownloadedCustomers(token, donem.year, donem.month);
        } catch (e: any) {
            log.warn(`Pre-download check hatası: ${e.message}`);
        }
    }

    // CAPTCHA key kontrolü
    if (!captchaKey) {
        const error = createGibError('CAPTCHA API key tanımlı değil');
        onProgress('error', { error: error.message, gibError: error });
        return;
    }

    try {
        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: LOGIN
        // ═══════════════════════════════════════════════════════════════════
        if (checkIfStopped()) {
            log.warn('Bot durduruldu (login öncesi)');
            onProgress('error', { error: 'Bot kullanıcı tarafından durduruldu', errorCode: 'USER_STOPPED' });
            return;
        }

        report(5, "🔐 GİB portalına giriş yapılıyor...");

        let dijitalToken: string | null = null;
        let loginAttempt = 0;

        while (!dijitalToken && loginAttempt < GIB_CONFIG.MAX_CAPTCHA_RETRIES) {
            if (checkIfStopped()) {
                log.warn('Bot durduruldu (login sırasında)');
                onProgress('error', { error: 'Bot kullanıcı tarafından durduruldu', errorCode: 'USER_STOPPED' });
                return;
            }
            loginAttempt++;

            // CAPTCHA deneme bilgisi
            if (loginAttempt > 1) {
                report(5 + loginAttempt, `🔄 CAPTCHA deneme ${loginAttempt}/${GIB_CONFIG.MAX_CAPTCHA_RETRIES}...`);
            } else {
                report(10, "🖼️ CAPTCHA çözülüyor...");
            }

            const loginResult = await dijitalGibLogin(username, password, captchaKey);
            if (loginResult) {
                dijitalToken = loginResult.token;
            } else {
                await delay(2000);
            }
        }

        if (!dijitalToken) {
            const error = createGibError('GİB giriş başarısız');
            onProgress('error', { error: error.message, gibError: error });
            return;
        }

        report(40, "✅ GİB Giriş Başarılı!");

        await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_REQUESTS);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: GET E-BEYANNAME TOKEN
        // ═══════════════════════════════════════════════════════════════════

        const ebeyanToken = await getEbeyanToken(dijitalToken);
        if (!ebeyanToken) {
            const error = createGibError('E-Beyanname token alınamadı');
            onProgress('error', { error: error.message, gibError: error });
            return;
        }
        let currentToken = ebeyanToken;

        await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_REQUESTS);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 3: SEARCH BEYANNAMELER
        // ═══════════════════════════════════════════════════════════════════
        const searchFilters = { vergiNo, tcKimlikNo, beyannameTuru };

        // Filtre bilgilerini logla
        const filterParts: string[] = [];
        if (beyannameTuru) filterParts.push(`Tür: ${beyannameTuru}`);
        if (vergiNo) filterParts.push(`VKN: ${vergiNo}`);
        if (tcKimlikNo) filterParts.push(`TCK: ${tcKimlikNo}`);
        const filterInfo = filterParts.length > 0 ? ` [${filterParts.join(', ')}]` : '';

        if (beyannameTuru) {
            report(55, `🔍 ${beyannameTuru} beyanname sorgusu yapılıyor...${vergiNo ? ` (VKN: ${vergiNo})` : ''}${tcKimlikNo ? ` (TCK: ${tcKimlikNo})` : ''}`);
        } else {
            report(55, `🔍 Tüm beyannameler sorgulanıyor...${vergiNo ? ` (VKN: ${vergiNo})` : ''}${tcKimlikNo ? ` (TCK: ${tcKimlikNo})` : ''}`);
        }
        if (filterParts.length > 0) {
            log.info(`Arama filtreleri: ${filterParts.join(' | ')}`);
        }

        const startDateInfo = formatDate(startDate);
        const endDateInfo = formatDate(endDate);

        log.debug(`Tarih aralığı: ${startDateInfo.formatted} - ${endDateInfo.formatted}`);

        // İlk sayfayı çek
        const firstResult = await fetchBeyannamePage(currentToken, startDateInfo.formatted, endDateInfo.formatted, 1, searchFilters);
        let totalPages = firstResult.pagination?.totalPages || 1;
        currentToken = firstResult.newToken;

        // Tüm beyannameleri topla
        let allSearchedBeyannameler: BeyannameItem[] = [...firstResult.beyannameler];
        let currentPage = 1;

        log.info(`📄 Sayfa 1/${totalPages} çekildi: ${firstResult.beyannameler.length} beyanname`);
        if (totalPages > 1) {
            report(57, `📄 Sayfa 1/${totalPages} çekildi (${firstResult.beyannameler.length} beyanname)`);
        }

        // Kalan sayfaları çek
        while (currentPage < totalPages) {
            // Stop kontrolü
            if (checkIfStopped()) {
                log.warn('Bot durduruldu (sayfa çekme sırasında)');
                onProgress('error', { error: 'Bot kullanıcı tarafından durduruldu', errorCode: 'USER_STOPPED' });
                return;
            }

            currentPage++;
            await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_PAGES);

            log.info(`📄 Sayfa ${currentPage}/${totalPages} çekiliyor...`);
            const pageResult = await fetchBeyannamePage(currentToken, startDateInfo.formatted, endDateInfo.formatted, currentPage, searchFilters);
            allSearchedBeyannameler.push(...pageResult.beyannameler);
            currentToken = pageResult.newToken;

            if (pageResult.pagination) {
                totalPages = pageResult.pagination.totalPages;
            }

            log.info(`📄 Sayfa ${currentPage}/${totalPages} çekildi: ${pageResult.beyannameler.length} beyanname`);
            // Her sayfa için progress raporu
            const progressPct = 55 + Math.round((currentPage / totalPages) * 10); // 55-65 arası
            report(progressPct, `📄 Sayfa ${currentPage}/${totalPages} çekildi (toplam: ${allSearchedBeyannameler.length} beyanname)`);
        }

        stats.pages = totalPages;

        // Durum filtresi - Sadece Onaylandı
        const onaylanmisBeyannameler = allSearchedBeyannameler.filter(b => b.durum === 'onaylandi');

        const durumStats = {
            onaylandi: allSearchedBeyannameler.filter(b => b.durum === 'onaylandi').length,
            hata: allSearchedBeyannameler.filter(b => b.durum === 'hata').length,
            iptal: allSearchedBeyannameler.filter(b => b.durum === 'iptal').length,
            onay_bekliyor: allSearchedBeyannameler.filter(b => b.durum === 'onay_bekliyor').length,
            bilinmiyor: allSearchedBeyannameler.filter(b => b.durum === 'bilinmiyor').length,
        };

        const filterLabel = beyannameTuru ? `${beyannameTuru} ` : '';
        log.success(`Toplam: ${allSearchedBeyannameler.length} ${filterLabel}beyanname (${totalPages} sayfa)`);
        log.success(`✅ Onaylandı: ${durumStats.onaylandi} (indirilecek)`);
        if (durumStats.onay_bekliyor > 0) log.warn(`⏳ Onay Bekliyor: ${durumStats.onay_bekliyor}`);
        if (durumStats.hata > 0) log.warn(`❌ Hatalı: ${durumStats.hata}`);
        if (durumStats.iptal > 0) log.warn(`🚫 İptal: ${durumStats.iptal}`);
        if (durumStats.bilinmiyor > 0) log.warn(`❓ Bilinmiyor: ${durumStats.bilinmiyor}`);

        stats.total = onaylanmisBeyannameler.length;
        stats.skipped = allSearchedBeyannameler.length - onaylanmisBeyannameler.length;

        // Web paneline sorgu sonucu bildir
        report(65, `📊 ${allSearchedBeyannameler.length} ${filterLabel}beyanname bulundu (${totalPages} sayfa)`);

        const statusParts: string[] = [];
        statusParts.push(`✅ ${durumStats.onaylandi} onaylı`);
        if (durumStats.hata > 0) statusParts.push(`❌ ${durumStats.hata} hatalı`);
        if (durumStats.onay_bekliyor > 0) statusParts.push(`⏳ ${durumStats.onay_bekliyor} bekliyor`);
        if (durumStats.iptal > 0) statusParts.push(`🚫 ${durumStats.iptal} iptal`);
        report(70, statusParts.join(' | '));

        if (onaylanmisBeyannameler.length === 0) {
            report(100, "Onaylanmış beyanname bulunamadı!");
            onProgress('complete', { stats, beyannameler: [] });
            return;
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 4: DOWNLOAD PDFs
        // ═══════════════════════════════════════════════════════════════════
        if (!downloadFiles) {
            report(100, `${onaylanmisBeyannameler.length} beyanname listelendi (PDF indirme kapalı)`);
            onProgress('complete', { stats, beyannameler: onaylanmisBeyannameler });
            return;
        }

        // Terminal özet
        log.separator('İNDİRME BAŞLIYOR');
        log.success(`📊 Toplam: ${onaylanmisBeyannameler.length} onaylı beyanname`);
        log.success(`📅 Tarih: ${startDateInfo.display} - ${endDateInfo.display}`);
        if (stats.preSkipped > 0) {
            log.success(`⏭️ Daha önce indirilmiş: ${stats.preSkipped} (atlanacak)`);
        }
        log.separator();

        report(75, `📥 ${onaylanmisBeyannameler.length} beyanname için PDF indirme başlıyor...`);

        const processedBeyannameler: BeyannameData[] = [];

        for (let i = 0; i < onaylanmisBeyannameler.length; i++) {
            // Stop kontrolü
            if (checkIfStopped()) {
                log.warn(`Bot durduruldu (${i}/${onaylanmisBeyannameler.length} beyanname işlendi)`);
                stats.duration = Math.round((Date.now() - startTime) / 1000);
                report(100, `Bot durduruldu! ${i} beyanname işlendi.`);
                onProgress('complete', { stats, beyannameler: allBeyannameler, stopped: true });
                return;
            }

            const item = onaylanmisBeyannameler[i];

            // Pre-download check
            const normalizedTuru = normalizeBeyannameTuru(item.beyannameTuru || '');
            const preDownloadKey = `${item.tcVkn}_${normalizedTuru}`;
            const preCheck = preDownloadedMap.get(preDownloadKey);

            // BeyannameData oluştur (preSkipped için de oluştur - takip tablosu güncellemesi için)
            const beyanname: BeyannameData = {
                beyannameTuru: item.beyannameTuru,
                tcVkn: item.tcVkn,
                adSoyadUnvan: item.adSoyadUnvan,
                vergiDairesi: item.vergiDairesi,
                vergilendirmeDonemi: item.vergilendirmeDonemi,
                yuklemeZamani: item.yuklemeZamani,
                oid: item.oid,
                tahakkukOid: item.tahakkukOid,
                tahakkukDurumu: 'onaylandi',
            };

            // Pre-download check - zaten indirilmiş dosyaları atla ama listeye ekle
            if (preCheck && preCheck.downloadedTypes.has('BEYANNAME') && preCheck.downloadedTypes.has('TAHAKKUK')) {
                stats.preSkipped++;
                // Başarılı olarak işaretle - dosyalar zaten mevcut
                beyanname.success = true;
                // Listeye ekle (takip tablosu güncellemesi ve beyanname türü kaydı için)
                processedBeyannameler.push(beyanname);
                allBeyannameler.push(beyanname);
                await delay(100);
                continue;
            }

            try {
                // Beyanname PDF
                if (item.oid) {
                    const result = await downloadPdf(item.oid, 'beyanname', currentToken);
                    if (result.success && result.base64) {
                        beyanname.beyannameBuffer = result.base64;
                        stats.downloaded++;
                    } else {
                        stats.failed++;
                        log.error(`Beyanname PDF hatası: ${result.error}`);
                    }
                    await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_DOWNLOADS);
                }

                // Tahakkuk PDF
                if (item.tahakkukOid) {
                    const result = await downloadPdf(item.oid, 'tahakkuk', currentToken, item.tahakkukOid);
                    if (result.success && result.base64) {
                        beyanname.tahakkukBuffer = result.base64;
                        stats.downloaded++;

                        // KDV1 parse
                        if (item.beyannameTuru?.toUpperCase() === 'KDV1') {
                            try {
                                const kdvParsed = await parseKdvTahakkuk(result.base64);
                                if (kdvParsed) {
                                    beyanname.kdvTahakkukParsed = kdvParsed;
                                    // Terminal'e KDV1 özeti
                                    const odenecek = kdvParsed.odenecek || 0;
                                    const devreden = kdvParsed.devredenKdv || 0;
                                    if (odenecek > 0) {
                                        log.success(`   📋 KDV1 Parse: Ödenecek ${odenecek.toLocaleString('tr-TR')}₺`);
                                    } else if (devreden > 0) {
                                        log.success(`   📋 KDV1 Parse: Devreden ${devreden.toLocaleString('tr-TR')}₺`);
                                    } else {
                                        log.success(`   📋 KDV1 Parse: 0₺`);
                                    }
                                }
                            } catch (parseErr) {
                                log.warn(`   ⚠️ KDV1 parse hatası: ${(parseErr as Error).message}`);
                            }
                        }

                        // KDV2 parse
                        if (item.beyannameTuru?.toUpperCase() === 'KDV2') {
                            try {
                                const kdv2Parsed = await parseKdv2Tahakkuk(result.base64);
                                if (kdv2Parsed) {
                                    beyanname.kdv2TahakkukParsed = kdv2Parsed;
                                    // Terminal'e KDV2 özeti
                                    const odenecek = kdv2Parsed.odenecek || 0;
                                    const devreden = kdv2Parsed.devredenKdv || 0;
                                    if (odenecek > 0) {
                                        log.success(`   📋 KDV2 Parse: Ödenecek ${odenecek.toLocaleString('tr-TR')}₺`);
                                    } else if (devreden > 0) {
                                        log.success(`   📋 KDV2 Parse: Devreden ${devreden.toLocaleString('tr-TR')}₺`);
                                    } else {
                                        log.success(`   📋 KDV2 Parse: 0₺`);
                                    }
                                }
                            } catch (parseErr) {
                                log.warn(`   ⚠️ KDV2 parse hatası: ${(parseErr as Error).message}`);
                            }
                        }

                        // KDV9015 parse
                        if (item.beyannameTuru?.toUpperCase() === 'KDV9015') {
                            try {
                                const kdv9015Parsed = await parseKdv9015Tahakkuk(result.base64);
                                if (kdv9015Parsed) {
                                    beyanname.kdv9015TahakkukParsed = kdv9015Parsed;
                                    // Terminal'e KDV9015 özeti
                                    const odenecek = kdv9015Parsed.odenecek || 0;
                                    const devreden = kdv9015Parsed.devredenKdv || 0;
                                    if (odenecek > 0) {
                                        log.success(`   📋 KDV9015 Parse: Ödenecek ${odenecek.toLocaleString('tr-TR')}₺`);
                                    } else if (devreden > 0) {
                                        log.success(`   📋 KDV9015 Parse: Devreden ${devreden.toLocaleString('tr-TR')}₺`);
                                    } else {
                                        log.success(`   📋 KDV9015 Parse: 0₺`);
                                    }
                                }
                            } catch (parseErr) {
                                log.warn(`   ⚠️ KDV9015 parse hatası: ${(parseErr as Error).message}`);
                            }
                        }

                        // Geçici Vergi parse (GGECICI veya KGECICI)
                        const normalizedForParse = normalizeBeyannameTuru(item.beyannameTuru || '');
                        if (normalizedForParse === 'GGECICI' || normalizedForParse === 'KGECICI') {
                            try {
                                const geciciParsed = await parseGeciciVergiTahakkuk(result.base64);
                                if (geciciParsed) {
                                    beyanname.geciciVergiTahakkukParsed = geciciParsed;
                                    const odenecek = geciciParsed.odenecek || 0;
                                    if (odenecek > 0) {
                                        log.success(`   📋 ${item.beyannameTuru} Parse: Ödenecek ${odenecek.toLocaleString('tr-TR')}₺`);
                                    } else {
                                        log.success(`   📋 ${item.beyannameTuru} Parse: 0₺`);
                                    }
                                }
                            } catch (parseErr) {
                                log.warn(`   ⚠️ ${item.beyannameTuru} parse hatası: ${(parseErr as Error).message}`);
                            }
                        }
                    } else {
                        stats.failed++;
                        log.error(`Tahakkuk PDF hatası: ${result.error}`);
                    }
                    await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_DOWNLOADS);
                }

                // MUHSGK SGK PDF'leri
                if (item.hasSgkDetails && item.oid) {
                    log.debug('MUHSGK tespit edildi, SGK PDF\'leri indiriliyor...');

                    const muhsgkPdfs = await getMuhsgkDetailPdfs(item.oid, currentToken);

                    beyanname.sgkTahakkukBuffers = [];
                    beyanname.sgkHizmetBuffers = [];

                    // SGK Tahakkuk
                    log.debug(`SGK Tahakkuk URL sayısı: ${muhsgkPdfs.sgkTahakkukUrls.length}`);
                    for (let sgkIdx = 0; sgkIdx < muhsgkPdfs.sgkTahakkukUrls.length; sgkIdx++) {
                        if (sgkIdx > 0) await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_DOWNLOADS);

                        const sgkResult = await downloadSgkPdf(muhsgkPdfs.sgkTahakkukUrls[sgkIdx], currentToken);
                        if (sgkResult.success && sgkResult.base64) {
                            let parsed: TahakkukFisiParsed | undefined;
                            try {
                                const parseResult = await parseTahakkukFisi(sgkResult.base64);
                                parsed = parseResult || undefined;
                            } catch (parseErr) {
                                log.warn(`   ⚠️ SGK Tahakkuk parse hatası: ${(parseErr as Error).message}`);
                            }

                            beyanname.sgkTahakkukBuffers.push({
                                buffer: sgkResult.base64,
                                index: sgkIdx + 1,
                                parsed
                            });

                            if (sgkIdx === 0) {
                                beyanname.sgkTahakkukBuffer = sgkResult.base64;
                                beyanname.sgkTahakkukParsed = parsed;
                            }

                            stats.downloaded++;
                        } else {
                            // SGK Tahakkuk indirme BAŞARISIZ - loglama ekle
                            log.warn(`   ⚠️ SGK Tahakkuk[${sgkIdx + 1}] indirme başarısız: ${sgkResult.error || 'Bilinmeyen hata'}`);
                        }
                    }

                    // SGK Tahakkuk toplam
                    if (beyanname.sgkTahakkukBuffers.length > 0) {
                        let totalIsci = 0;
                        let totalTutar = 0;
                        let ilkGun = 0;

                        for (const f of beyanname.sgkTahakkukBuffers) {
                            if (f.parsed) {
                                totalIsci += f.parsed.isciSayisi || 0;
                                totalTutar += f.parsed.netTutar || 0;
                                if (ilkGun === 0) ilkGun = f.parsed.gunSayisi || 0;
                            }
                        }

                        beyanname.sgkTahakkukToplam = {
                            isciSayisi: totalIsci,
                            netTutar: totalTutar,
                            gunSayisi: ilkGun,
                            dosyaSayisi: beyanname.sgkTahakkukBuffers.length
                        };

                        // Terminal'e SGK özeti
                        const dosyaText = beyanname.sgkTahakkukBuffers.length > 1
                            ? ` (${beyanname.sgkTahakkukBuffers.length} dosya)`
                            : '';
                        log.success(`   📋 SGK Parse: ${totalIsci} işçi | ${totalTutar.toLocaleString('tr-TR')}₺${dosyaText}`);
                    }

                    // Hizmet Listesi
                    if (muhsgkPdfs.hizmetListesiUrls.length > 0 && muhsgkPdfs.sgkTahakkukUrls.length > 0) {
                        await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_DOWNLOADS);
                    }

                    for (let hizmetIdx = 0; hizmetIdx < muhsgkPdfs.hizmetListesiUrls.length; hizmetIdx++) {
                        if (hizmetIdx > 0) await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_DOWNLOADS);

                        const hizmetResult = await downloadSgkPdf(muhsgkPdfs.hizmetListesiUrls[hizmetIdx], currentToken);
                        if (hizmetResult.success && hizmetResult.base64) {
                            let parsed: HizmetListesiParsed | undefined;
                            try {
                                const parseResult = await parseHizmetListesi(hizmetResult.base64);
                                parsed = parseResult || undefined;
                            } catch (parseErr) {
                                log.warn(`   ⚠️ Hizmet Listesi parse hatası: ${(parseErr as Error).message}`);
                            }

                            beyanname.sgkHizmetBuffers!.push({
                                buffer: hizmetResult.base64,
                                index: hizmetIdx + 1,
                                parsed
                            });

                            if (hizmetIdx === 0) {
                                beyanname.sgkHizmetBuffer = hizmetResult.base64;
                                beyanname.sgkHizmetParsed = parsed;
                            }

                            stats.downloaded++;
                        }
                    }

                    // Hizmet Listesi toplam
                    if (beyanname.sgkHizmetBuffers && beyanname.sgkHizmetBuffers.length > 0) {
                        let totalIsci = 0;

                        for (const f of beyanname.sgkHizmetBuffers) {
                            if (f.parsed) {
                                totalIsci += f.parsed.isciSayisi || 0;
                            }
                        }

                        beyanname.sgkHizmetToplam = {
                            isciSayisi: totalIsci,
                            dosyaSayisi: beyanname.sgkHizmetBuffers.length
                        };

                        // Terminal'e Hizmet Listesi özeti
                        if (totalIsci > 0) {
                            const dosyaText = beyanname.sgkHizmetBuffers.length > 1
                                ? ` (${beyanname.sgkHizmetBuffers.length} dosya)`
                                : '';
                            log.success(`   📋 Hizmet Listesi: ${totalIsci} işçi${dosyaText}`);
                        }
                    }
                }

            } catch (e: any) {
                log.error(`İndirme hatası (${item.tcVkn}): ${e.message}`);
                stats.failed++;
            }

            // Başarı durumunu belirle - en az bir PDF indirilmişse başarılı
            // Bu field Beyanname Takip tablosunda "verildi" işaretlemesi için kullanılır
            beyanname.success = !!(beyanname.beyannameBuffer || beyanname.tahakkukBuffer);

            processedBeyannameler.push(beyanname);
            allBeyannameler.push(beyanname);

            // Parse bilgilerini hazırla
            const parseInfo: {
                kdv?: { odenecek?: number; devreden?: number };
                kdv2?: { odenecek?: number; devreden?: number };
                kdv9015?: { odenecek?: number; devreden?: number };
                geciciVergi?: { odenecek?: number };
                sgk?: { isciSayisi?: number; netTutar?: number; dosyaSayisi?: number };
            } = {};

            // KDV1 parse sonuçları
            if (beyanname.kdvTahakkukParsed) {
                parseInfo.kdv = {
                    odenecek: beyanname.kdvTahakkukParsed.odenecek,
                    devreden: beyanname.kdvTahakkukParsed.devredenKdv
                };
            }

            // KDV2 parse sonuçları
            if (beyanname.kdv2TahakkukParsed) {
                parseInfo.kdv2 = {
                    odenecek: beyanname.kdv2TahakkukParsed.odenecek,
                    devreden: beyanname.kdv2TahakkukParsed.devredenKdv
                };
            }

            // KDV9015 parse sonuçları
            if (beyanname.kdv9015TahakkukParsed) {
                parseInfo.kdv9015 = {
                    odenecek: beyanname.kdv9015TahakkukParsed.odenecek,
                    devreden: beyanname.kdv9015TahakkukParsed.devredenKdv
                };
            }

            if (beyanname.geciciVergiTahakkukParsed) {
                parseInfo.geciciVergi = {
                    odenecek: beyanname.geciciVergiTahakkukParsed.odenecek,
                };
            }

            // SGK parse sonuçları
            if (beyanname.sgkTahakkukToplam) {
                parseInfo.sgk = {
                    isciSayisi: beyanname.sgkTahakkukToplam.isciSayisi,
                    netTutar: beyanname.sgkTahakkukToplam.netTutar,
                    dosyaSayisi: beyanname.sgkTahakkukToplam.dosyaSayisi
                };
            }

            // Rate limit - adaptive delay kullan (HTTP 500 durumuna göre ayarlanır)
            await delay(getAdaptiveDelay());

            // Her 5 mükellefde batch gönder (sessiz)
            if ((i + 1) % 5 === 0 || i === onaylanmisBeyannameler.length - 1) {
                onProgress('batch-results', {
                    message: `${i + 1}/${onaylanmisBeyannameler.length} işlendi`,
                    beyannameler: processedBeyannameler.slice(-5),
                    stats,
                    startDate,
                    tenantId: options.tenantId
                });
            }

            // Her beyanname tamamlandığında parse bilgileriyle özet
            const hasParseData = Object.keys(parseInfo).length > 0;
            reportBeyanname(i + 1, onaylanmisBeyannameler.length, item, '✅', hasParseData ? parseInfo : undefined);
        }

        // ═══════════════════════════════════════════════════════════════════
        // COMPLETE
        // ═══════════════════════════════════════════════════════════════════
        stats.duration = Math.round((Date.now() - startTime) / 1000);

        // Parse istatistikleri hesapla
        let kdvCount = 0, kdv2Count = 0, kdv9015Count = 0, sgkCount = 0;
        let kdvToplam = 0, kdv9015Toplam = 0, sgkToplam = 0;

        for (const b of allBeyannameler) {
            if (b.kdvTahakkukParsed) {
                kdvCount++;
                kdvToplam += b.kdvTahakkukParsed.odenecek || 0;
            }
            if (b.kdv2TahakkukParsed) {
                kdv2Count++;
            }
            if (b.kdv9015TahakkukParsed) {
                kdv9015Count++;
                kdv9015Toplam += b.kdv9015TahakkukParsed.odenecek || 0;
            }
            if (b.sgkTahakkukToplam) {
                sgkCount++;
                sgkToplam += b.sgkTahakkukToplam.netTutar || 0;
            }
        }

        log.separator('BOT TAMAMLANDI');
        log.success(`📊 Toplam: ${stats.total} beyanname`);
        log.success(`📥 İndirilen: ${stats.downloaded} PDF`);
        if (stats.preSkipped > 0) {
            log.success(`⏭️ Atlanan (mevcut): ${stats.preSkipped}`);
        }
        if (stats.failed > 0) {
            log.warn(`❌ Başarısız: ${stats.failed}`);
        }
        log.success(`⏱️ Süre: ${stats.duration} saniye`);

        // Parse özeti
        if (kdvCount > 0 || kdv2Count > 0 || kdv9015Count > 0 || sgkCount > 0) {
            log.separator('PARSE ÖZETİ');
            if (kdvCount > 0) {
                log.success(`📋 KDV1: ${kdvCount} adet | Toplam: ${kdvToplam.toLocaleString('tr-TR')}₺`);
            }
            if (kdv2Count > 0) {
                log.success(`📋 KDV2: ${kdv2Count} adet`);
            }
            if (kdv9015Count > 0) {
                log.success(`📋 KDV9015: ${kdv9015Count} adet | Toplam: ${kdv9015Toplam.toLocaleString('tr-TR')}₺`);
            }
            if (sgkCount > 0) {
                log.success(`📋 SGK: ${sgkCount} adet | Toplam: ${sgkToplam.toLocaleString('tr-TR')}₺`);
            }
        }
        log.separator();

        report(100, `Tamamlandı! ${stats.total} beyanname işlendi.`);
        onProgress('complete', { stats, beyannameler: allBeyannameler });

    } catch (error: any) {
        log.error(`Bot hatası: ${error.message}`);
        const gibError = createGibError(error.message, error);
        onProgress('error', { error: error.message, gibError });
    }
}
