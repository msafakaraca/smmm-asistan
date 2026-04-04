/**
 * GİB Beyanname API - INTVRG Pipeline
 * =====================================
 * INTVRG (İnternet Vergi Dairesi) JSON API ile beyanname sorgulama ve PDF indirme.
 * earsiv-dijital-api.ts'deki gibDijitalLogin'i kullanır.
 * intvrg-tahsilat-api.ts'deki getIvdToken ve IntrvrgClient'ı kullanır.
 */

import { gibDijitalLogin } from './earsiv-dijital-api';
import { getIvdToken, IntrvrgClient, INTVRG_BASE } from './intvrg-tahsilat-api';
import { parseHizmetListesi, parseTahakkukFisi, HizmetListesiParsed, TahakkukFisiParsed } from './sgk-parser';
import { parseKdvTahakkuk, KdvTahakkukParsed } from './kdv-parser';
import { parseKdv2Tahakkuk, Kdv2TahakkukParsed } from './kdv2-parser';
import { parseKdv9015Tahakkuk, Kdv9015TahakkukParsed } from './kdv9015-parser';
import { parseGeciciVergiTahakkuk, GeciciVergiTahakkukParsed } from './gecici-vergi-parser';
import { getApiUrl } from './config';

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════
export const GIB_CONFIG = {
    TIMEOUTS: {
        HTTP_REQUEST: 30000,
        CAPTCHA_SOLVE: 60000,
    },
    MAX_RETRIES: 3,
    MAX_CAPTCHA_RETRIES: 5,
};

// INTVRG PDF görüntüleme endpoint'i
const INTVRG_GORUNTULEME = `${INTVRG_BASE}/intvrg_server/goruntuleme`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ═══════════════════════════════════════════════════════════════════
// HATA KODLARI
// ═══════════════════════════════════════════════════════════════════
export const GIB_ERROR_CODES = {
    GIB_SESSION_EXPIRED: {
        code: 'GIB_SESSION_EXPIRED',
        message: 'GİB oturumu sona erdi',
        description: 'Başka bir yerden GİB\'e giriş yapıldı veya oturum zaman aşımına uğradı.',
        isCritical: true,
        userAction: 'Lütfen botu yeniden başlatın.'
    },
    GIB_AUTH_FAILED: {
        code: 'GIB_AUTH_FAILED',
        message: 'GİB giriş başarısız',
        description: 'Kullanıcı adı veya şifre hatalı.',
        isCritical: true,
        userAction: 'Lütfen GİB bilgilerinizi kontrol edip botu yeniden başlatın.'
    },
    GIB_CAPTCHA_FAILED: {
        code: 'GIB_CAPTCHA_FAILED',
        message: 'CAPTCHA çözümü başarısız',
        description: 'CAPTCHA birden fazla denemede çözülemedi.',
        isCritical: true,
        userAction: '2Captcha bakiyenizi kontrol edip botu yeniden başlatın.'
    },
    HTTP_401: { code: 'HTTP_401', message: 'Yetkilendirme hatası', isCritical: false, userAction: null },
    HTTP_403: { code: 'HTTP_403', message: 'Erişim reddedildi', isCritical: false, userAction: null },
    HTTP_500: { code: 'HTTP_500', message: 'GİB sunucu hatası', isCritical: false, userAction: null },
    PDF_INVALID: { code: 'PDF_INVALID', message: 'Geçersiz PDF', isCritical: false, userAction: null },
    PDF_TIMEOUT: { code: 'PDF_TIMEOUT', message: 'PDF indirme zaman aşımı', isCritical: false, userAction: null },
    TIMEOUT: { code: 'TIMEOUT', message: 'Zaman aşımı', isCritical: false, userAction: null },
    UNKNOWN: { code: 'UNKNOWN', message: 'Bilinmeyen hata', isCritical: false, userAction: null }
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
    if (msg.includes('oturum') && (msg.includes('sona erdi') || msg.includes('timeout'))) return 'GIB_SESSION_EXPIRED';
    if (msg.includes('hatalıdır') || msg.includes('yanlış') || msg.includes('giriş başarısız')) return 'GIB_AUTH_FAILED';
    if (msg.includes('captcha') && (msg.includes('çözülemedi') || msg.includes('failed'))) return 'GIB_CAPTCHA_FAILED';
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
// TYPES
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
    success?: boolean;
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
    ocrSpaceApiKey?: string;
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

/** INTVRG beyanname arama sonucu (tek kayıt) */
interface IntrvrgBeyannameItem {
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
}

/** Beyanname arama response */
interface BeyannameSearchResponse {
    data: {
        data: IntrvrgBeyannameItem[];
        rowcount: number;
        page: number;
    };
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

export function stopBot() {
    console.log('[EBEYANNAME-API] Bot durdurma sinyali alındı!');
    botShouldStop = true;
}

export function resetBotStopFlag() {
    botShouldStop = false;
}

function checkIfStopped(): boolean {
    return botShouldStop;
}

// ═══════════════════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════════════════
const colors = {
    reset: '\x1b[0m', blue: '\x1b[34m', green: '\x1b[32m', yellow: '\x1b[33m',
    red: '\x1b[31m', cyan: '\x1b[36m', magenta: '\x1b[35m', gray: '\x1b[90m', dim: '\x1b[2m'
};

function getTimestamp(): string {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
}

const log = {
    debug: (msg: string) => { if (DEBUG_MODE) console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.dim}[DEBUG]${colors.reset} ${msg}`); },
    verbose: (msg: string) => { if (DEBUG_MODE) console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.dim}[VERBOSE]${colors.reset} ${msg}`); },
    info: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.cyan}[INFO]${colors.reset} ${msg}`),
    success: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.green}[OK]${colors.reset} ${msg}`),
    warn: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.yellow}[UYARI]${colors.reset} ${msg}`),
    error: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.red}[HATA]${colors.reset} ${msg}`),
    download: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.magenta}[INDIRME]${colors.reset} ${msg}`),
    http: (method: string, url: string, status?: number, duration?: number) => {
        const statusColor = status && status >= 200 && status < 300 ? colors.green : status && status >= 400 ? colors.red : colors.yellow;
        const statusText = status ? `${statusColor}${status}${colors.reset}` : '...';
        const durationText = duration ? ` (${duration}ms)` : '';
        console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.blue}[HTTP]${colors.reset} ${method} ${url.substring(0, 80)}... → ${statusText}${durationText}`);
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
// HELPERS
// ═══════════════════════════════════════════════════════════════════
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDate(dateStr: string): { year: string; month: string; day: string; formatted: string; display: string } {
    const date = new Date(dateStr);
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return { year, month, day, formatted: `${year}${month}${day}`, display: `${day}.${month}.${year}` };
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

function calculateBeyannameDonem(searchDate: Date, beyannameTuru: string): { year: number; month: number } {
    const searchYear = searchDate.getFullYear();
    const searchMonth = searchDate.getMonth() + 1;
    const isQuarterly = /G(EC|EÇ)İC|K(EC|EÇ)İC/i.test(beyannameTuru);

    if (isQuarterly) {
        let quarter: number;
        let year = searchYear;
        if (searchMonth >= 1 && searchMonth <= 3) { quarter = 4; year = searchYear - 1; }
        else if (searchMonth >= 4 && searchMonth <= 6) { quarter = 1; }
        else if (searchMonth >= 7 && searchMonth <= 9) { quarter = 2; }
        else { quarter = 3; }
        return { year, month: quarter * 3 };
    }

    let beyannameMonth = searchMonth - 1;
    let beyannameYear = searchYear;
    if (beyannameMonth === 0) { beyannameMonth = 12; beyannameYear = searchYear - 1; }
    return { year: beyannameYear, month: beyannameMonth };
}

const GIB_BEYANNAME_TANIM_MAP: Record<string, string> = {
    'KDV1': 'KDV1', 'KDV2': 'KDV2', 'KDV9015': 'KDV9015',
    'MUHSGK': 'MUHSGK', 'GGECICI': 'GGECICI', 'KGECICI': 'KGECICI',
    'GELIR': 'GELIR', 'KURUMLAR': 'KURUMLAR', 'DAMGA': 'DAMGA',
    'POSET': 'POSET', 'KONAKLAMA': 'KONAKLAMA', 'TURIZM': 'TURIZM',
};

function resolveBeyannameTanim(code: string): string {
    return GIB_BEYANNAME_TANIM_MAP[code.toUpperCase()] || code;
}

// getEbeyanToken kaldırıldı — INTVRG'de getIvdToken kullanılıyor

// parseBeyannamePage ve fetchBeyannamePage kaldırıldı — INTVRG JSON API kullanılıyor

// ═══════════════════════════════════════════════════════════════════
// PDF DOWNLOAD (INTVRG goruntuleme)
// ═══════════════════════════════════════════════════════════════════

async function downloadPdf(
    subcmd: string,
    params: Record<string, string>,
    ivdToken: string,
    maxRetries: number = 2,
): Promise<{ success: boolean; base64?: string; fileSize?: number; error?: string }> {
    // URL oluştur — TÜM parametreleri encodeURIComponent ile encode et
    const queryParts = [
        `cmd=IMAJ`,
        `subcmd=${subcmd}`,
        ...Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`),
        `USERID=`,
        `inline=true`,
        `goruntuTip=1`,
        `token=${ivdToken}`, // küçük harf "token"
    ];
    const url = `${INTVRG_GORUNTULEME}?${queryParts.join('&')}`;

    log.download(`${subcmd} PDF indiriliyor...`);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'application/pdf,*/*',
                    'Referer': `${INTVRG_BASE}/intvrg_side/main.jsp`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Kota kontrolü
            if (buffer.length < 200) {
                const text = buffer.toString('utf-8');
                if (text.includes('kota') || text.includes('günlük')) {
                    return { success: false, error: 'QUOTA_EXCEEDED' };
                }
            }

            // PDF geçerlilik
            const header = buffer.subarray(0, 5).toString('utf-8');
            if (buffer.length < 100 || !header.startsWith('%PDF')) {
                // GİB sunucu hatası — retry etme
                const preview = buffer.subarray(0, 100).toString('utf-8');
                return { success: false, error: `PDF_INVALID: ${preview.substring(0, 80)}` };
            }

            log.success(`${subcmd} PDF indirildi: ${buffer.length} bytes`);
            return {
                success: true,
                base64: buffer.toString('base64'),
                fileSize: buffer.length,
            };

        } catch (e) {
            if (attempt === maxRetries) {
                return { success: false, error: (e as Error).message };
            }
            // Kısa retry beklemesi
            await delay(300);
        }
    }

    return { success: false, error: 'MAX_RETRIES_EXCEEDED' };
}

// ═══════════════════════════════════════════════════════════════════
// MUHSGK SGK DETAY (INTVRG JSON API)
// ═══════════════════════════════════════════════════════════════════

async function getMuhsgkSgkDetails(
    client: IntrvrgClient,
    beyannameOid: string,
): Promise<{ sgkEntries: Array<{ thkoid: string; aciklama: string; index: number }> }> {
    log.debug(`MUHSGK SGK detay alınıyor: ${beyannameOid}`);

    const result = await client.callDispatch<SgkBildirgeResponse>(
        'sgkBildirgeIslemleri_bildirgeleriGetir',
        { beyannameOid },
    );

    const entries: Array<{ thkoid: string; aciklama: string; index: number }> = [];
    const data = result.data;
    const bildirimSayisi = parseInt(data.bildirim_sayisi || '0', 10);

    // thkhaberlesme1 = Vergi tahakkuku (atla — ana tahakkuk zaten indiriliyor)
    // thkhaberlesme2+ = SGK bildirgeleri
    for (let i = 2; i <= bildirimSayisi; i++) {
        const key = `thkhaberlesme${i}`;
        const thk = data[key] as { thkoid: string; aciklama: string } | undefined;
        if (thk?.thkoid) {
            entries.push({ thkoid: thk.thkoid, aciklama: thk.aciklama, index: i });
        }
    }

    if (entries.length > 0) {
        log.info(`   MUHSGK Detay: ${entries.length} SGK bildirge bulundu`);
    } else {
        log.info(`   MUHSGK Detay: Bu beyannamede SGK verisi bulunmuyor`);
    }

    return { sgkEntries: entries };
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
            log.warn(`Pre-download check API hatasi: ${response.status}`);
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
            log.success(`${result.size} VKN+Tur kombinasyonu icin mevcut dosyalar kontrol edildi`);
        }
    } catch (error: any) {
        log.warn(`Pre-download check hatasi: ${error.message}`);
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════

export async function runEbeyannamePipeline(options: BotOptions) {
    const { username, password, startDate, endDate, onProgress, captchaKey, ocrSpaceApiKey, downloadFiles = true, token, vergiNo, tcKimlikNo, beyannameTuru } = options;

    // Reset
    resetBotStopFlag();

    log.separator('INTVRG BEYANNAME PIPELINE');
    log.debug(`Tarih araligi: ${startDate} - ${endDate}`);
    log.debug(`PDF indirme: ${downloadFiles ? 'EVET' : 'HAYIR'}`);
    log.debug(`Kullanici: ${username}`);
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
        console.log(`[EBEYANNAME-API] %${percent} - ${message}`);
        onProgress('progress', { message, progress: percent });
    };

    // Her beyanname icin detayli progress
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

        let parseText = '';
        if (parseInfo) {
            const parts: string[] = [];
            if (parseInfo.kdv) {
                if (parseInfo.kdv.odenecek && parseInfo.kdv.odenecek > 0) parts.push(`Ödenecek: ${parseInfo.kdv.odenecek.toLocaleString('tr-TR')} TL`);
                else if (parseInfo.kdv.devreden && parseInfo.kdv.devreden > 0) parts.push(`Devreden: ${parseInfo.kdv.devreden.toLocaleString('tr-TR')} TL`);
            }
            if (parseInfo.kdv2?.odenecek && parseInfo.kdv2.odenecek > 0) parts.push(`Ödenecek: ${parseInfo.kdv2.odenecek.toLocaleString('tr-TR')} TL`);
            if (parseInfo.sgk) {
                if (parseInfo.sgk.isciSayisi !== undefined) parts.push(`${parseInfo.sgk.isciSayisi} işçi`);
                if (parseInfo.sgk.netTutar !== undefined) parts.push(`${parseInfo.sgk.netTutar.toLocaleString('tr-TR')} TL`);
                if (parseInfo.sgk.dosyaSayisi !== undefined && parseInfo.sgk.dosyaSayisi > 1) parts.push(`${parseInfo.sgk.dosyaSayisi} dosya`);
            }
            if (parts.length > 0) parseText = ` | ${parts.join(' | ')}`;
        }

        const message = `[${index}/${total}] **${turu}** - ${unvan}${parseText}`;
        console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.green}[İŞLEM]${colors.reset} ${message}`);
        onProgress('progress', { message, progress: percent });
    };

    // Pre-download check
    if (token && downloadFiles) {
        try {
            const searchDate = new Date(startDate);
            const donem = calculateBeyannameDonem(searchDate, 'NORMAL');
            preDownloadedMap = await getPreDownloadedCustomers(token, donem.year, donem.month);
        } catch (e: any) {
            log.warn(`Pre-download check hatasi: ${e.message}`);
        }
    }

    // CAPTCHA key kontrolu
    if (!captchaKey && !ocrSpaceApiKey) {
        const error = createGibError('CAPTCHA API anahtarı tanımlı değil. Lütfen Ayarlar sayfasından CAPTCHA servis anahtarınızı girin.');
        onProgress('error', { error: error.message, gibError: error });
        return;
    }

    try {
        // ═══════════════════════════════════════════════════════════
        // STEP 1: LOGIN
        // ═══════════════════════════════════════════════════════════
        if (checkIfStopped()) {
            log.warn('Bot durduruldu (login oncesi)');
            onProgress('error', { error: 'Bot kullanıcı tarafından durduruldu', errorCode: 'USER_STOPPED' });
            return;
        }

        log.info("GİB portalına giriş yapılıyor...");

        let dijitalToken: string | null = null;

        for (let loginAttempt = 1; loginAttempt <= GIB_CONFIG.MAX_CAPTCHA_RETRIES; loginAttempt++) {
            if (checkIfStopped()) {
                log.warn('Bot durduruldu (login öncesi)');
                onProgress('error', { error: 'Bot kullanıcı tarafından durduruldu', errorCode: 'USER_STOPPED' });
                return;
            }

            if (loginAttempt > 1) {
                log.info(`CAPTCHA deneme ${loginAttempt}/${GIB_CONFIG.MAX_CAPTCHA_RETRIES}...`);
            }

            try {
                dijitalToken = await gibDijitalLogin(username, password, captchaKey!, ocrSpaceApiKey);
                if (dijitalToken) break;
            } catch (loginErr: any) {
                if (loginErr.message?.includes('AUTH_FAILED')) {
                    const error = createGibError('GİB giriş başarısız');
                    onProgress('error', { error: error.message, gibError: error });
                    return;
                }
                log.warn(`Login deneme ${loginAttempt} başarısız: ${loginErr.message}`);
                if (loginAttempt < GIB_CONFIG.MAX_CAPTCHA_RETRIES) {
                    await delay(300);
                }
            }
        }

        if (!dijitalToken) {
            const error = createGibError('GİB giriş başarısız');
            onProgress('error', { error: error.message, gibError: error });
            return;
        }

        log.success("GİB giriş başarılı!");

        // ═══════════════════════════════════════════════════════════
        // STEP 2: IVD TOKEN (INTVRG)
        // ═══════════════════════════════════════════════════════════
        report(50, 'İnternet Vergi Dairesi oturumu açılıyor...');
        const ivdToken = await getIvdToken(dijitalToken);
        const client = new IntrvrgClient(ivdToken, '');
        log.success('IVD token alındı');

        // ═══════════════════════════════════════════════════════════
        // STEP 3: SEARCH (INTVRG JSON API)
        // ═══════════════════════════════════════════════════════════
        if (beyannameTuru) {
            report(55, `${beyannameTuru} beyanname sorgusu yapılıyor...${vergiNo ? ` (VKN: ${vergiNo})` : ''}${tcKimlikNo ? ` (TCK: ${tcKimlikNo})` : ''}`);
        } else {
            report(55, `Tüm beyannameler sorgulanıyor...${vergiNo ? ` (VKN: ${vergiNo})` : ''}${tcKimlikNo ? ` (TCK: ${tcKimlikNo})` : ''}`);
        }

        const startDateInfo = formatDate(startDate);
        const endDateInfo = formatDate(endDate);

        // Tarih parametreleri (YYYYMMDD)
        const baslangicTarihi = startDateInfo.formatted;
        const bitisTarihi = endDateInfo.formatted;

        // Dönem hesapla
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        let dBasAy = startDateObj.getMonth(); // 0-indexed → zaten -1
        let donemBasYil = startDateObj.getFullYear();
        if (dBasAy <= 0) { dBasAy += 12; donemBasYil--; }

        // INTVRG arama parametreleri
        const searchJp: Record<string, unknown> = {
            arsivde: false,
            sorguTipiN: vergiNo ? 1 : 0,
            vergiNo: vergiNo || '',
            sorguTipiT: tcKimlikNo ? 1 : 0,
            tcKimlikNo: tcKimlikNo || '',
            sorguTipiB: beyannameTuru ? 1 : 0,
            beyannameTanim: beyannameTuru ? resolveBeyannameTanim(beyannameTuru) : '',
            sorguTipiP: 0,
            donemBasAy: String(dBasAy).padStart(2, '0'),
            donemBasYil: String(donemBasYil),
            donemBitAy: String(endDateObj.getMonth() + 1).padStart(2, '0'),
            donemBitYil: String(endDateObj.getFullYear()),
            sorguTipiV: 0,
            vdKodu: '',
            sorguTipiZ: 1,
            tarihAraligi: { baslangicTarihi, bitisTarihi },
            sorguTipiD: 1,
            durum: { radiob: false, radiob1: false, radiob2: true, radiob3: false }, // Sadece onaylandı
        };

        // Tüm sayfaları çek (bekleme YOK)
        let page = 1;
        let totalPages = 1;
        const allIntrvrgItems: IntrvrgBeyannameItem[] = [];

        do {
            if (checkIfStopped()) {
                log.warn('Bot durduruldu (sayfa çekme sırasında)');
                onProgress('error', { error: 'Bot kullanıcı tarafından durduruldu', errorCode: 'USER_STOPPED' });
                return;
            }

            if (page > 1) searchJp.pageNo = page;

            const result = await client.callDispatch<BeyannameSearchResponse>('beyannameService_beyannameAra', searchJp);
            const items = result.data?.data || [];
            const rowcount = result.data?.rowcount || 0;
            totalPages = Math.ceil(rowcount / 25);

            allIntrvrgItems.push(...items);

            log.info(`Sayfa ${page}/${totalPages} çekildi: ${items.length} beyanname`);
            const progressPct = 55 + Math.round((page / Math.max(totalPages, 1)) * 10);
            report(progressPct, `Sayfa ${page}/${totalPages} çekildi (toplam: ${allIntrvrgItems.length}/${rowcount} beyanname)`);

            page++;
        } while (page <= totalPages);

        stats.pages = totalPages;

        // INTVRG → BeyannameData dönüşümü (durum filtresi API'de yapıldı)
        const onaylanmisBeyannameler: BeyannameData[] = allIntrvrgItems.map(item => ({
            beyannameTuru: normalizeBeyannameTuru(item.beyannameKodu),
            tcVkn: item.tckn,
            adSoyadUnvan: item.unvan,
            vergiDairesi: item.vergiDairesi,
            vergilendirmeDonemi: item.donem,
            yuklemeZamani: item.yuklemezamani,
            oid: item.beyannameOid,
            tahakkukOid: item.tahakkukOid,
            tahakkukDurumu: 'onaylandi',
        }));

        const filterLabel = beyannameTuru ? `${beyannameTuru} ` : '';
        log.success(`Toplam: ${onaylanmisBeyannameler.length} ${filterLabel}onaylı beyanname (${totalPages} sayfa)`);

        stats.total = onaylanmisBeyannameler.length;

        report(65, `${onaylanmisBeyannameler.length} ${filterLabel}onaylı beyanname bulundu (${totalPages} sayfa)`);

        if (onaylanmisBeyannameler.length === 0) {
            report(100, "Onaylanmış beyanname bulunamadı!");
            onProgress('complete', { stats, beyannameler: [] });
            return;
        }

        // ═══════════════════════════════════════════════════════════
        // STEP 4: DOWNLOAD PDFs
        // ═══════════════════════════════════════════════════════════
        if (!downloadFiles) {
            report(100, `${onaylanmisBeyannameler.length} beyanname listelendi (PDF indirme kapalı)`);
            onProgress('complete', { stats, beyannameler: onaylanmisBeyannameler });
            return;
        }

        log.separator('INDIRME BASLIYOR');
        log.success(`Toplam: ${onaylanmisBeyannameler.length} onaylı beyanname`);
        log.success(`Tarih: ${startDateInfo.display} - ${endDateInfo.display}`);
        log.separator();

        report(75, `${onaylanmisBeyannameler.length} beyanname için PDF indirme başlıyor...`);

        const processedBeyannameler: BeyannameData[] = [];
        let quotaExceeded = false;

        for (let i = 0; i < onaylanmisBeyannameler.length; i++) {
            // Stop kontrolu
            if (checkIfStopped()) {
                log.warn(`Bot durduruldu (${i}/${onaylanmisBeyannameler.length} beyanname işlendi)`);
                stats.duration = Math.round((Date.now() - startTime) / 1000);
                report(100, `Bot durduruldu! ${i} beyanname işlendi.`);
                onProgress('complete', { stats, beyannameler: allBeyannameler, stopped: true });
                return;
            }

            if (quotaExceeded) break;

            const beyanname = onaylanmisBeyannameler[i];

            // Pre-download check
            const normalizedTuru = normalizeBeyannameTuru(beyanname.beyannameTuru || '');
            const preDownloadKey = `${beyanname.tcVkn}_${normalizedTuru}`;
            const preCheck = preDownloadedMap.get(preDownloadKey);

            // Pre-download skip
            if (preCheck && preCheck.downloadedTypes.has('BEYANNAME') && preCheck.downloadedTypes.has('TAHAKKUK')) {
                stats.preSkipped++;
                beyanname.success = true;
                processedBeyannameler.push(beyanname);
                allBeyannameler.push(beyanname);
                continue;
            }

            try {
                // a) Beyanname PDF
                if (beyanname.oid) {
                    const result = await downloadPdf('BEYANNAMEGORUNTULE', { beyannameOid: beyanname.oid }, ivdToken);
                    if (result.success && result.base64) {
                        beyanname.beyannameBuffer = result.base64;
                        stats.downloaded++;
                    } else {
                        if (result.error === 'QUOTA_EXCEEDED') { quotaExceeded = true; }
                        else { stats.failed++; log.error(`Beyanname PDF hatasi: ${result.error}`); }
                    }
                }

                // b) Tahakkuk PDF
                if (beyanname.tahakkukOid && !quotaExceeded) {
                    const result = await downloadPdf('TAHAKKUKGORUNTULE', {
                        tahakkukOid: beyanname.tahakkukOid,
                        beyannameOid: beyanname.oid!,
                    }, ivdToken);
                    if (result.success && result.base64) {
                        beyanname.tahakkukBuffer = result.base64;
                        stats.downloaded++;

                        // Parse tahakkuk
                        if (normalizedTuru === 'KDV1') {
                            try { beyanname.kdvTahakkukParsed = await parseKdvTahakkuk(result.base64) || undefined; }
                            catch (e) { log.warn(`KDV1 parse hatasi: ${(e as Error).message}`); }
                        }
                        if (normalizedTuru === 'KDV2') {
                            try { beyanname.kdv2TahakkukParsed = await parseKdv2Tahakkuk(result.base64) || undefined; }
                            catch (e) { log.warn(`KDV2 parse hatasi: ${(e as Error).message}`); }
                        }
                        if (normalizedTuru === 'KDV9015') {
                            try { beyanname.kdv9015TahakkukParsed = await parseKdv9015Tahakkuk(result.base64) || undefined; }
                            catch (e) { log.warn(`KDV9015 parse hatasi: ${(e as Error).message}`); }
                        }
                        if (normalizedTuru === 'GGECICI' || normalizedTuru === 'KGECICI') {
                            try { beyanname.geciciVergiTahakkukParsed = await parseGeciciVergiTahakkuk(result.base64) || undefined; }
                            catch (e) { log.warn(`${beyanname.beyannameTuru} parse hatasi: ${(e as Error).message}`); }
                        }
                    } else {
                        if (result.error === 'QUOTA_EXCEEDED') { quotaExceeded = true; }
                        else { stats.failed++; log.error(`Tahakkuk PDF hatasi: ${result.error}`); }
                    }
                }

                // c) MUHSGK SGK PDF'leri (INTVRG JSON API)
                if (normalizedTuru === 'MUHSGK' && beyanname.oid && !quotaExceeded) {
                    log.debug('MUHSGK tespit edildi, SGK PDF\'leri indiriliyor...');

                    try {
                        const { sgkEntries } = await getMuhsgkSgkDetails(client, beyanname.oid);

                        beyanname.sgkTahakkukBuffers = [];
                        beyanname.sgkHizmetBuffers = [];

                        for (const entry of sgkEntries) {
                            if (quotaExceeded) break;

                            // SGK Tahakkuk
                            const sgkThk = await downloadPdf('SGKTAHAKKUKGORUNTULE', { sgkTahakkukOid: entry.thkoid }, ivdToken);
                            if (sgkThk.success && sgkThk.base64) {
                                let parsed: TahakkukFisiParsed | undefined;
                                try { parsed = await parseTahakkukFisi(sgkThk.base64) || undefined; }
                                catch (e) { log.warn(`SGK Tahakkuk parse hatasi: ${(e as Error).message}`); }

                                beyanname.sgkTahakkukBuffers.push({ buffer: sgkThk.base64, index: entry.index, parsed });

                                if (!beyanname.sgkTahakkukBuffer) {
                                    beyanname.sgkTahakkukBuffer = sgkThk.base64;
                                    beyanname.sgkTahakkukParsed = parsed;
                                }
                                stats.downloaded++;
                            } else {
                                if (sgkThk.error === 'QUOTA_EXCEEDED') { quotaExceeded = true; break; }
                                log.warn(`SGK Tahakkuk[${entry.index}] indirme başarısız: ${sgkThk.error || 'Bilinmeyen hata'}`);
                            }

                            // SGK Hizmet Listesi
                            if (!quotaExceeded) {
                                const sgkHiz = await downloadPdf('SGKHIZMETGORUNTULE', {
                                    sgkTahakkukOid: entry.thkoid,
                                    beyannameOid: beyanname.oid!,
                                }, ivdToken);
                                if (sgkHiz.success && sgkHiz.base64) {
                                    let parsed: HizmetListesiParsed | undefined;
                                    try { parsed = await parseHizmetListesi(sgkHiz.base64) || undefined; }
                                    catch (e) { log.warn(`Hizmet Listesi parse hatasi: ${(e as Error).message}`); }

                                    beyanname.sgkHizmetBuffers!.push({ buffer: sgkHiz.base64, index: entry.index, parsed });

                                    if (!beyanname.sgkHizmetBuffer) {
                                        beyanname.sgkHizmetBuffer = sgkHiz.base64;
                                        beyanname.sgkHizmetParsed = parsed;
                                    }
                                    stats.downloaded++;
                                } else if (sgkHiz.error === 'QUOTA_EXCEEDED') {
                                    quotaExceeded = true;
                                }
                            }
                        }

                        // SGK Tahakkuk toplam
                        if (beyanname.sgkTahakkukBuffers.length > 0) {
                            let totalIsci = 0, totalTutar = 0, ilkGun = 0;
                            for (const f of beyanname.sgkTahakkukBuffers) {
                                if (f.parsed) {
                                    totalIsci += f.parsed.isciSayisi || 0;
                                    totalTutar += f.parsed.netTutar || 0;
                                    if (ilkGun === 0) ilkGun = f.parsed.gunSayisi || 0;
                                }
                            }
                            beyanname.sgkTahakkukToplam = {
                                isciSayisi: totalIsci, netTutar: totalTutar, gunSayisi: ilkGun,
                                dosyaSayisi: beyanname.sgkTahakkukBuffers.length
                            };
                            log.success(`   SGK Parse: ${totalIsci} isci | ${totalTutar.toLocaleString('tr-TR')} TL${beyanname.sgkTahakkukBuffers.length > 1 ? ` (${beyanname.sgkTahakkukBuffers.length} dosya)` : ''}`);
                        }

                        // Hizmet Listesi toplam
                        if (beyanname.sgkHizmetBuffers && beyanname.sgkHizmetBuffers.length > 0) {
                            let totalIsci = 0;
                            for (const f of beyanname.sgkHizmetBuffers) {
                                if (f.parsed) totalIsci += f.parsed.isciSayisi || 0;
                            }
                            beyanname.sgkHizmetToplam = { isciSayisi: totalIsci, dosyaSayisi: beyanname.sgkHizmetBuffers.length };
                            if (totalIsci > 0) {
                                log.success(`   Hizmet Listesi: ${totalIsci} isci${beyanname.sgkHizmetBuffers.length > 1 ? ` (${beyanname.sgkHizmetBuffers.length} dosya)` : ''}`);
                            }
                        }
                    } catch (sgkErr: any) {
                        log.error(`MUHSGK SGK detay hatası: ${sgkErr.message}`);
                    }
                }
            } catch (e: any) {
                log.error(`Indirme hatasi (${beyanname.tcVkn}): ${e.message}`);
                stats.failed++;
            }

            // Kota kontrolü
            if (quotaExceeded) {
                report(95, 'Günlük PDF indirme kotası doldu! Kalan beyannameler atlanıyor...');
            }

            // Basari durumu
            beyanname.success = !!(beyanname.beyannameBuffer || beyanname.tahakkukBuffer);

            processedBeyannameler.push(beyanname);
            allBeyannameler.push(beyanname);

            // Parse bilgileri
            const parseInfo: {
                kdv?: { odenecek?: number; devreden?: number };
                kdv2?: { odenecek?: number; devreden?: number };
                kdv9015?: { odenecek?: number; devreden?: number };
                geciciVergi?: { odenecek?: number };
                sgk?: { isciSayisi?: number; netTutar?: number; dosyaSayisi?: number };
            } = {};

            if (beyanname.kdvTahakkukParsed) parseInfo.kdv = { odenecek: beyanname.kdvTahakkukParsed.odenecek, devreden: beyanname.kdvTahakkukParsed.devredenKdv };
            if (beyanname.kdv2TahakkukParsed) parseInfo.kdv2 = { odenecek: beyanname.kdv2TahakkukParsed.odenecek, devreden: beyanname.kdv2TahakkukParsed.devredenKdv };
            if (beyanname.kdv9015TahakkukParsed) parseInfo.kdv9015 = { odenecek: beyanname.kdv9015TahakkukParsed.odenecek, devreden: beyanname.kdv9015TahakkukParsed.devredenKdv };
            if (beyanname.geciciVergiTahakkukParsed) parseInfo.geciciVergi = { odenecek: beyanname.geciciVergiTahakkukParsed.odenecek };
            if (beyanname.sgkTahakkukToplam) parseInfo.sgk = { isciSayisi: beyanname.sgkTahakkukToplam.isciSayisi, netTutar: beyanname.sgkTahakkukToplam.netTutar, dosyaSayisi: beyanname.sgkTahakkukToplam.dosyaSayisi };

            // Her 5 mukellefde batch gonder
            if ((i + 1) % 5 === 0 || i === onaylanmisBeyannameler.length - 1) {
                onProgress('batch-results', {
                    message: `${i + 1}/${onaylanmisBeyannameler.length} işlendi`,
                    beyannameler: processedBeyannameler.slice(-5),
                    stats,
                    startDate,
                    tenantId: options.tenantId
                });
            }

            // Progress raporu
            const hasParseData = Object.keys(parseInfo).length > 0;
            reportBeyanname(i + 1, onaylanmisBeyannameler.length, beyanname, 'OK', hasParseData ? parseInfo : undefined);
        }

        // ═══════════════════════════════════════════════════════════
        // COMPLETE
        // ═══════════════════════════════════════════════════════════
        stats.duration = Math.round((Date.now() - startTime) / 1000);

        log.separator('PIPELINE TAMAMLANDI');
        log.success(`Toplam: ${stats.total} beyanname`);
        log.success(`Indirilen: ${stats.downloaded} PDF`);
        if (stats.preSkipped > 0) log.success(`Atlanan (mevcut): ${stats.preSkipped}`);
        if (stats.failed > 0) log.warn(`Basarisiz: ${stats.failed}`);
        log.success(`Sure: ${stats.duration} saniye`);
        log.separator();

        report(100, `Tamamlandı! ${stats.total} beyanname işlendi.`);
        onProgress('complete', { stats, beyannameler: allBeyannameler });

    } catch (error: any) {
        log.error(`Pipeline hatasi: ${error.message}`);
        const gibError = createGibError(error.message, error);
        onProgress('error', { error: error.message, gibError });
    }
}
