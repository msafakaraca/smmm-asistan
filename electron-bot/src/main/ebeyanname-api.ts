/**
 * GİB E-Beyanname API - HTTP API Pipeline
 * =========================================
 * Puppeteer yerine doğrudan HTTP API + Cheerio ile beyanname sorgulama ve PDF indirme.
 * earsiv-dijital-api.ts'deki gibDijitalLogin'i kullanır.
 */

import * as cheerio from 'cheerio';
import { gibDijitalLogin } from './earsiv-dijital-api';
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
    DIJITAL_GIB: {
        EBYN_LOGIN: 'https://dijital.gib.gov.tr/apigateway/auth/tdvd/ebyn-login',
    },
    EBEYANNAME: {
        DISPATCH: 'https://ebeyanname.gib.gov.tr/dispatch',
    },
    RATE_LIMIT: {
        BETWEEN_REQUESTS: 100,
        BETWEEN_PAGES: 1100,
        BETWEEN_DOWNLOADS: 1200,
        BASE_RETRY_WAIT: 500,
        COOLDOWN_AFTER_500: 2000,
        MAX_DELAY: 1200,
        CONSECUTIVE_500_THRESHOLD: 3,
        BIG_COOLDOWN: 3000,
        RETRY_WAIT: 500,
        RETRY_MAX_WAIT: 3000,
    },
    TIMEOUTS: {
        HTTP_REQUEST: 30000,
        CAPTCHA_SOLVE: 60000,
    },
    MAX_RETRIES: 3,
    MAX_CAPTCHA_RETRIES: 5,
    MAX_PAGE_RETRIES: 20,
};

// HTTP Headers
const DIJITAL_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Language': 'tr-TR,tr;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Origin': 'https://dijital.gib.gov.tr',
    'Referer': 'https://dijital.gib.gov.tr/portal/login',
};

const EBEYANNAME_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Accept': '*/*',
    'Accept-Language': 'tr-TR,tr;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Origin': 'https://ebeyanname.gib.gov.tr',
    'X-Requested-With': 'XMLHttpRequest',
};

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

interface BeyannameItem {
    oid: string;
    tahakkukOid?: string;
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
// RATE LIMIT STATE
// ═══════════════════════════════════════════════════════════════════
let consecutiveHttp500Count = 0;
let currentDelay = GIB_CONFIG.RATE_LIMIT.BETWEEN_DOWNLOADS;

function getAdaptiveDelay(): number {
    if (consecutiveHttp500Count >= 2) {
        return Math.min(currentDelay + 300, GIB_CONFIG.RATE_LIMIT.MAX_DELAY);
    }
    return currentDelay;
}

function resetRateLimitState(): void {
    consecutiveHttp500Count = 0;
    currentDelay = GIB_CONFIG.RATE_LIMIT.BETWEEN_DOWNLOADS;
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

// ═══════════════════════════════════════════════════════════════════
// E-BEYANNAME TOKEN
// ═══════════════════════════════════════════════════════════════════
async function getEbeyanToken(dijitalToken: string): Promise<string | null> {
    log.debug('E-Beyanname token alınıyor...');

    const response = await fetch(GIB_CONFIG.DIJITAL_GIB.EBYN_LOGIN, {
        method: 'GET',
        headers: {
            ...DIJITAL_HEADERS,
            'Authorization': `Bearer ${dijitalToken}`,
        },
    });

    const data = await response.json();

    if (data.redirectUrl) {
        const tokenMatch = data.redirectUrl.match(/TOKEN=([^&]+)/);
        if (tokenMatch) {
            const token = tokenMatch[1];
            log.debug(`E-Beyanname token: ${token.substring(0, 30)}...`);

            // Session aktive et (ZORUNLU — yapılmazsa dispatch çalışmaz)
            log.debug('Session aktive ediliyor...');
            await fetch(data.redirectUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': DIJITAL_HEADERS['User-Agent'],
                },
            });

            log.success('E-Beyanname session aktive edildi');
            return token;
        }
    }

    log.error('E-Beyanname oturum anahtarı alınamadı — GİB giriş bilgilerini kontrol edin');
    return null;
}

// ═══════════════════════════════════════════════════════════════════
// BEYANNAME SEARCH (Cheerio)
// ═══════════════════════════════════════════════════════════════════

function parseBeyannamePage(html: string): { records: BeyannameItem[]; totalRecords: number; totalPages: number } {
    // HTMLCONTENT çıkar
    let contentHtml = html;
    const htmlContentMatch = html.match(/<HTMLCONTENT>([\s\S]*?)<\/HTMLCONTENT>/i);
    if (htmlContentMatch) {
        contentHtml = htmlContentMatch[1];
    }

    const $ = cheerio.load(contentHtml);

    // Pagination: "1 - 25 / 123" veya digerSayfayaGecis fonksiyon çağrısı
    let totalRecords = 0;
    let totalPages = 1;

    // Yöntem 1: digerSayfayaGecis fonksiyon çağrısından sayfa bilgisi
    const paginationMatch = contentHtml.match(
        /digerSayfayaGecis\([^,]+,\s*'nextPage'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([^']+)'/
    );
    if (paginationMatch) {
        totalPages = parseInt(paginationMatch[2], 10);
    }

    // Yöntem 2: "1 - 25 / 123" formatından toplam kayıt
    const pageInfoText = $('font[size="2"]').text();
    const pageMatch = pageInfoText.match(/(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)/);
    if (pageMatch) {
        totalRecords = parseInt(pageMatch[3], 10);
        if (totalPages === 1) {
            totalPages = Math.ceil(totalRecords / 25);
        }
    }

    // Satırları parse et
    const records: BeyannameItem[] = [];
    $('tr[id^="row"]').each((_, row) => {
        const $row = $(row);
        const rowId = $row.attr('id')?.replace('row', '') || '';

        // OID decode
        let oid: string;
        try { oid = decodeURIComponent(rowId); } catch { oid = rowId; }

        // Durum tespiti
        let durum: BeyannameItem['durum'] = 'bilinmiyor';
        const durumTd = $row.find(`td[id^="durumTD"]`);
        if (durumTd.length > 0) {
            const durumHtml = durumTd.html()?.toLowerCase() || '';
            if (durumHtml.includes('ok.gif')) durum = 'onaylandi';
            else if (durumHtml.includes('err.gif') || durumHtml.includes('error.gif')) durum = 'hata';
            else if (durumHtml.includes('wtng.gif') || durumHtml.includes('wait.gif')) durum = 'onay_bekliyor';
            else if (durumHtml.includes('iptal.gif') || durumHtml.includes('del.gif') || durumHtml.includes('cancel.gif')) durum = 'iptal';
            // Text'ten tespit (backup)
            else if (durumHtml.includes('onaylandı') || durumHtml.includes('onaylandi')) durum = 'onaylandi';
            else if (durumHtml.includes('hatalı') || durumHtml.includes('hatali')) durum = 'hata';
            else if (durumHtml.includes('onay bekliyor') || durumHtml.includes('bekliyor')) durum = 'onay_bekliyor';
            else if (durumHtml.includes('iptal')) durum = 'iptal';
        }

        // Yedek: Satırdaki nested table veya direkt status ikonları
        if (durum === 'bilinmiyor') {
            const rowHtml = ($row.html() || '').toLowerCase();
            const statusIcons = rowHtml.match(/images\/(ok|err|wtng|iptal|del|cancel|error|wait)\.gif/g);
            if (statusIcons) {
                for (const icon of statusIcons) {
                    if (icon.includes('ok.gif')) { durum = 'onaylandi'; break; }
                    else if (icon.includes('err.gif') || icon.includes('error.gif')) durum = 'hata';
                    else if ((icon.includes('wtng.gif') || icon.includes('wait.gif')) && durum !== 'hata') durum = 'onay_bekliyor';
                    else if ((icon.includes('iptal.gif') || icon.includes('del.gif') || icon.includes('cancel.gif')) && durum !== 'hata' && durum !== 'onay_bekliyor') durum = 'iptal';
                }
            }
        }

        if (durum === 'bilinmiyor') {
            log.warn(`Durum tespit edilemedi (OID: ${oid})`);
        }

        // Hücreleri oku
        const tds = $row.find('> td');
        if (tds.length < 6) return; // Yetersiz hücre, atla

        // Beyanname türü (2. sütun, index 1)
        const beyannameTuru = tds.eq(1).text().replace(/\s+/g, ' ').trim();

        // VKN/TCK (3. sütun, index 2) — başta \n ve boşluk var, trim zorunlu
        const tcVkn = tds.eq(2).text().trim();

        // Unvan — title attribute'unda tam unvan var
        const unvanTd = tds.eq(3);
        const adSoyadUnvan = unvanTd.attr('title') || unvanTd.text().replace(/\s+/g, ' ').trim();

        // Vergi dairesi
        const vergiDairesi = tds.eq(4).text().replace(/\s+/g, ' ').trim();

        // Dönem
        const vergilendirmeDonemi = tds.eq(5).text().replace(/\s+/g, ' ').trim();

        // Yükleme zamanı (8. sütun, index 7)
        const yuklemeZamani = tds.eq(7).text().replace(/\s+/g, ' ').trim();

        // Tahakkuk OID
        const rowHtmlFull = $row.html() || '';
        const thkMatch = rowHtmlFull.match(/tahakkukGoruntule\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]/);
        let tahakkukOid: string | undefined;
        if (thkMatch) {
            try { tahakkukOid = decodeURIComponent(thkMatch[2]); } catch { tahakkukOid = thkMatch[2]; }
        }

        // MUHSGK kontrolü — SGK detay var mı?
        const isMuhsgk = beyannameTuru.toUpperCase() === 'MUHSGK' ||
                         (beyannameTuru.toLowerCase().includes('muhtasar') && beyannameTuru.toLowerCase().includes('prim'));
        const hasSgkDetails = isMuhsgk || $row.find('img[src*="tick_kontrol"]').length > 0;

        records.push({
            oid,
            tahakkukOid,
            beyannameTuru,
            tcVkn,
            adSoyadUnvan,
            vergiDairesi,
            vergilendirmeDonemi,
            yuklemeZamani,
            hasSgkDetails,
            durum,
        });
    });

    return { records, totalRecords: totalRecords || records.length, totalPages };
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
): Promise<{ beyannameler: BeyannameItem[]; totalPages: number; newToken: string }> {
    log.debug(`Sayfa ${pageNumber} çekiliyor...`);

    let currentToken = ebeyanToken;

    // Rate limit retry — GİB "İki istek arası en az 1 sn" hatası verirse tekrar dene
    for (let attempt = 1; attempt <= GIB_CONFIG.MAX_PAGE_RETRIES; attempt++) {
        const formData = new URLSearchParams();
        formData.append('cmd', 'BEYANNAMELISTESI');

        if (searchFilters?.vergiNo) {
            formData.append('sorguTipiN', '1');
            formData.append('vergiNo', searchFilters.vergiNo);
        }
        if (searchFilters?.tcKimlikNo) {
            formData.append('sorguTipiT', '1');
            formData.append('tcKimlikNo', searchFilters.tcKimlikNo);
        }
        if (searchFilters?.beyannameTuru) {
            const gibTanim = resolveBeyannameTanim(searchFilters.beyannameTuru);
            formData.append('sorguTipiB', '1');
            formData.append('beyannameTanim', gibTanim);
            if (pageNumber === 1 && attempt === 1) log.info(`Beyanname türü filtresi: ${searchFilters.beyannameTuru} → beyannameTanim=${gibTanim}`);
        }

        formData.append('sorguTipiZ', '1');
        formData.append('baslangicTarihi', baslangicTarihi);
        formData.append('bitisTarihi', bitisTarihi);

        if (pageNumber > 1) {
            formData.append('pageNo', String(pageNumber));
        }

        formData.append('TOKEN', currentToken);

        const ts = Date.now();
        const response = await fetch(`${GIB_CONFIG.EBEYANNAME.DISPATCH}?_dc=${ts}`, {
            method: 'POST',
            headers: {
                ...EBEYANNAME_HEADERS,
                'Referer': `https://ebeyanname.gib.gov.tr/dispatch?cmd=LOGIN&TOKEN=${currentToken}`,
            },
            body: formData.toString(),
        });

        const html = await response.text();

        // Yeni TOKEN'ı al (her yanıtta güncellenir)
        const tokenMatch = html.match(/<TOKEN>([^<]+)<\/TOKEN>/);
        if (tokenMatch) currentToken = tokenMatch[1];

        // Rate limit hatası kontrolü
        const serverError = html.match(/<SERVERERROR>([^<]*)<\/SERVERERROR>/);
        if (serverError && serverError[1] && serverError[1].includes('1 sn')) {
            log.warn(`Sayfa ${pageNumber} rate limit! Deneme ${attempt} — 1.2s bekleniyor...`);
            await delay(1200);
            continue;
        }

        // Cheerio ile parse et
        const { records, totalPages } = parseBeyannamePage(html);

        log.debug(`Sayfa ${pageNumber}: ${records.length} beyanname bulundu`);
        return { beyannameler: records, totalPages, newToken: currentToken };
    }

    // Tüm denemeler başarısız
    log.error(`Sayfa ${pageNumber} alınamadı — ${GIB_CONFIG.MAX_PAGE_RETRIES} deneme başarısız`);
    return { beyannameler: [], totalPages: 1, newToken: currentToken };
}

// ═══════════════════════════════════════════════════════════════════
// PDF DOWNLOAD
// ═══════════════════════════════════════════════════════════════════

async function downloadPdf(
    beyannameOid: string,
    type: 'beyanname' | 'tahakkuk',
    token: string,
    tahakkukOid?: string,
    maxRetries: number = 3
): Promise<{ success: boolean; base64?: string; fileSize?: number; error?: string }> {
    log.download(`${type} PDF indiriliyor: ${beyannameOid}`);

    const params = new URLSearchParams({
        cmd: 'IMAJ',
        subcmd: type === 'beyanname' ? 'BEYANNAMEGORUNTULE' : 'TAHAKKUKGORUNTULE',
        beyannameOid,
        goruntuTip: '1',
        inline: 'true',
        TOKEN: token,
    });

    if (type === 'tahakkuk' && tahakkukOid) {
        params.append('tahakkukOid', tahakkukOid);
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const ts = Date.now();
        const url = `${GIB_CONFIG.EBEYANNAME.DISPATCH}?_dc=${ts}&${params.toString()}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/pdf,application/octet-stream,*/*',
                    'User-Agent': DIJITAL_HEADERS['User-Agent'],
                    'Referer': 'https://ebeyanname.gib.gov.tr/',
                },
            });

            log.http('GET', url, response.status);

            // HTTP 500 — Adaptive Backoff
            if (response.status === 500) {
                consecutiveHttp500Count++;
                if (consecutiveHttp500Count === 1) {
                    log.warn(`HTTP 500! ${GIB_CONFIG.RATE_LIMIT.COOLDOWN_AFTER_500}ms cooldown...`);
                    await delay(GIB_CONFIG.RATE_LIMIT.COOLDOWN_AFTER_500);
                    currentDelay = 2000;
                } else if (consecutiveHttp500Count >= GIB_CONFIG.RATE_LIMIT.CONSECUTIVE_500_THRESHOLD) {
                    log.warn(`${consecutiveHttp500Count}. ardisik HTTP 500! ${GIB_CONFIG.RATE_LIMIT.BIG_COOLDOWN}ms buyuk cooldown...`);
                    await delay(GIB_CONFIG.RATE_LIMIT.BIG_COOLDOWN);
                    currentDelay = GIB_CONFIG.RATE_LIMIT.MAX_DELAY;
                }
                if (attempt < maxRetries) {
                    const retryWait = GIB_CONFIG.RATE_LIMIT.BASE_RETRY_WAIT + (attempt - 1) * 1000;
                    log.warn(`${type} PDF HTTP 500, ${retryWait}ms bekle (${attempt}/${maxRetries})...`);
                    await delay(retryWait);
                    continue;
                }
                return { success: false, error: `HTTP 500 (${attempt} deneme sonrasi)` };
            }

            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
            }

            // Basarili — rate limit reset
            if (consecutiveHttp500Count > 0) {
                log.success(`Rate limit normale dondu (${consecutiveHttp500Count} hata sonrasi)`);
                resetRateLimitState();
            }

            const contentType = response.headers.get('content-type') || '';

            // PDF binary
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

            // XML icinden PDF
            if (text.includes('<PDFFILE>')) {
                const pdfMatch = text.match(/<PDFFILE>([^<]+)<\/PDFFILE>/);
                if (pdfMatch) {
                    log.success(`${type} PDF (XML) indirildi: ${pdfMatch[1].length} chars`);
                    return { success: true, base64: pdfMatch[1], fileSize: pdfMatch[1].length };
                }
            }

            // Hata mesaji
            if (text.includes('EYEKSERROR') || text.includes('SERVERERROR')) {
                const errorMatch = text.match(/<EYEKSERROR>([^<]+)<\/EYEKSERROR>/) ||
                                  text.match(/<SERVERERROR>([^<]+)<\/SERVERERROR>/);
                if (errorMatch) return { success: false, error: errorMatch[1] };
            }

            return { success: false, error: `Beklenmeyen Content-Type: ${contentType}` };
        } catch (error) {
            if (attempt < maxRetries) {
                const backoffWait = Math.min(
                    GIB_CONFIG.RATE_LIMIT.RETRY_WAIT * Math.pow(1.5, attempt - 1),
                    GIB_CONFIG.RATE_LIMIT.RETRY_MAX_WAIT
                );
                log.warn(`${type} PDF hatasi, ${backoffWait}ms bekle (${attempt}/${maxRetries})...`);
                await delay(backoffWait);
                continue;
            }
            return { success: false, error: (error as Error).message };
        }
    }

    return { success: false, error: 'Maksimum deneme sayısına ulaşıldı. GİB sunucusu yanıt vermiyor.' };
}

// ═══════════════════════════════════════════════════════════════════
// MUHSGK DETAIL PDFs (Cheerio)
// ═══════════════════════════════════════════════════════════════════

async function getMuhsgkDetailPdfs(beyannameOid: string, token: string): Promise<MuhsgkDetailPdfs> {
    log.debug(`MUHSGK Detay PDF'leri: ${beyannameOid}`);

    const result: MuhsgkDetailPdfs = { sgkTahakkukUrls: [], hizmetListesiUrls: [] };

    try {
        const ts = Date.now();
        const formData = new URLSearchParams({
            cmd: 'THKESASBILGISGKMESAJLARI',
            beyannameOid,
            TOKEN: token,
        });

        const response = await fetch(`${GIB_CONFIG.EBEYANNAME.DISPATCH}?_dc=${ts}`, {
            method: 'POST',
            headers: {
                ...EBEYANNAME_HEADERS,
                'Referer': `https://ebeyanname.gib.gov.tr/dispatch?cmd=LOGIN&TOKEN=${token}`,
            },
            body: formData.toString(),
        });

        if (!response.ok) {
            log.error(`Detay popup hatasi: HTTP ${response.status}`);
            return result;
        }

        const rawHtml = await response.text();
        log.debug(`Detay popup alindi: ${rawHtml.length} chars`);

        // HTML entity decode
        const html = rawHtml
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&#39;/g, "'")
            .replace(/&#34;/g, '"')
            .replace(/&amp;/g, '&');

        // OID decode helper
        const safeDecodeEncode = (oid: string): string => {
            try { return encodeURIComponent(decodeURIComponent(oid)); }
            catch { return encodeURIComponent(oid); }
        };

        // SGK URL parse helper
        const parseSgkUrls = (funcName: string, subcmd: string): string[] => {
            const urls: string[] = [];
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

        result.sgkTahakkukUrls = parseSgkUrls('sgkTahakkukGoruntule', 'SGKTAHAKKUKGORUNTULE');
        result.hizmetListesiUrls = parseSgkUrls('sgkHizmetGoruntule', 'SGKHIZMETGORUNTULE');

        if (result.sgkTahakkukUrls.length > 0 || result.hizmetListesiUrls.length > 0) {
            log.info(`   MUHSGK Detay: ${result.sgkTahakkukUrls.length} Tahakkuk, ${result.hizmetListesiUrls.length} Hizmet URL bulundu`);
        } else {
            const htmlLower = html.toLowerCase();
            const hasSgkKeywords = htmlLower.includes('sgktahakkuk') || htmlLower.includes('sgkhizmet');
            const hasGoruntule = htmlLower.includes('goruntule');
            if (hasSgkKeywords || hasGoruntule) {
                log.error(`   MUHSGK Detay: SGK pattern'leri HTML'de var ama URL parse edilemedi!`);
            } else {
                log.info(`   MUHSGK Detay: Bu beyannamede SGK verisi bulunmuyor`);
            }
        }
    } catch (error) {
        log.error(`MUHSGK detay hatasi: ${(error as Error).message}`);
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════════
// SGK PDF DOWNLOAD
// ═══════════════════════════════════════════════════════════════════

async function downloadSgkPdf(
    url: string,
    token: string,
    maxRetries: number = 3
): Promise<{ success: boolean; base64?: string; fileSize?: number; error?: string }> {
    const urlWithToken = url.replace('__TOKEN__', token);
    log.download(`SGK PDF indiriliyor...`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(urlWithToken, {
                method: 'GET',
                headers: {
                    'Accept': 'application/pdf,application/octet-stream,*/*',
                    'User-Agent': DIJITAL_HEADERS['User-Agent'],
                    'Referer': 'https://ebeyanname.gib.gov.tr/',
                },
            });

            log.http('GET', urlWithToken, response.status);

            // HTTP 500 — Adaptive Backoff
            if (response.status === 500) {
                consecutiveHttp500Count++;
                if (consecutiveHttp500Count === 1) {
                    log.warn(`HTTP 500! ${GIB_CONFIG.RATE_LIMIT.COOLDOWN_AFTER_500}ms cooldown...`);
                    await delay(GIB_CONFIG.RATE_LIMIT.COOLDOWN_AFTER_500);
                    currentDelay = 2000;
                } else if (consecutiveHttp500Count >= GIB_CONFIG.RATE_LIMIT.CONSECUTIVE_500_THRESHOLD) {
                    log.warn(`${consecutiveHttp500Count}. ardisik HTTP 500! ${GIB_CONFIG.RATE_LIMIT.BIG_COOLDOWN}ms buyuk cooldown...`);
                    await delay(GIB_CONFIG.RATE_LIMIT.BIG_COOLDOWN);
                    currentDelay = GIB_CONFIG.RATE_LIMIT.MAX_DELAY;
                }
                if (attempt < maxRetries) {
                    const retryWait = GIB_CONFIG.RATE_LIMIT.BASE_RETRY_WAIT + (attempt - 1) * 1000;
                    log.warn(`SGK PDF HTTP 500, ${retryWait}ms bekle (${attempt}/${maxRetries})...`);
                    await delay(retryWait);
                    continue;
                }
                return { success: false, error: `HTTP 500 (${attempt} deneme sonrasi)` };
            }

            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}` };
            }

            // Basarili — rate limit reset
            if (consecutiveHttp500Count > 0) {
                log.success(`Rate limit normale dondu (${consecutiveHttp500Count} hata sonrasi)`);
                resetRateLimitState();
            }

            const contentType = response.headers.get('content-type') || '';

            // PDF binary
            if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
                const buffer = await response.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                if (base64.length > 1000) {
                    log.success(`SGK PDF indirildi: ${buffer.byteLength} bytes`);
                    return { success: true, base64, fileSize: buffer.byteLength };
                }
                if (base64.length > 100) {
                    return { success: true, base64, fileSize: buffer.byteLength };
                }
                return { success: false, error: `PDF cok kucuk: ${buffer.byteLength} bytes` };
            }

            // Text response
            const text = await response.text();
            if (text.includes('<PDFFILE>')) {
                const pdfMatch = text.match(/<PDFFILE>([^<]+)<\/PDFFILE>/);
                if (pdfMatch) {
                    log.success(`SGK PDF (XML) indirildi: ${pdfMatch[1].length} chars`);
                    return { success: true, base64: pdfMatch[1], fileSize: pdfMatch[1].length };
                }
            }

            if (text.includes('EYEKSERROR') || text.includes('SERVERERROR')) {
                const errorMatch = text.match(/<EYEKSERROR>([^<]+)<\/EYEKSERROR>/) ||
                                  text.match(/<SERVERERROR>([^<]+)<\/SERVERERROR>/);
                if (errorMatch) {
                    const errorMsg = errorMatch[1];
                    const isTransient = errorMsg.includes('sistem hatası') || errorMsg.includes('daha sonra tekrar') ||
                                       errorMsg.includes('zaman aşımı') || errorMsg.includes('timeout');
                    if (isTransient && attempt < maxRetries) {
                        const retryWait = GIB_CONFIG.RATE_LIMIT.BASE_RETRY_WAIT + (attempt - 1) * 1000;
                        log.warn(`SGK PDF gecici hata: "${errorMsg}" - ${retryWait}ms bekle (${attempt}/${maxRetries})...`);
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
                log.warn(`SGK PDF hatasi, ${backoffWait}ms bekle (${attempt}/${maxRetries})...`);
                await delay(backoffWait);
                continue;
            }
            return { success: false, error: (error as Error).message };
        }
    }

    return { success: false, error: 'Maksimum deneme sayısına ulaşıldı. GİB sunucusu yanıt vermiyor.' };
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
    resetRateLimitState();

    log.separator('E-BEYANNAME HTTP API PIPELINE');
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
        await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_REQUESTS);

        // ═══════════════════════════════════════════════════════════
        // STEP 2: E-BEYANNAME TOKEN
        // ═══════════════════════════════════════════════════════════
        const ebeyanToken = await getEbeyanToken(dijitalToken);
        if (!ebeyanToken) {
            const error = createGibError('E-Beyanname token alınamadı');
            onProgress('error', { error: error.message, gibError: error });
            return;
        }
        let currentToken = ebeyanToken;
        await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_REQUESTS);

        // ═══════════════════════════════════════════════════════════
        // STEP 3: SEARCH
        // ═══════════════════════════════════════════════════════════
        const searchFilters = { vergiNo, tcKimlikNo, beyannameTuru };
        const filterParts: string[] = [];
        if (beyannameTuru) filterParts.push(`Tur: ${beyannameTuru}`);
        if (vergiNo) filterParts.push(`VKN: ${vergiNo}`);
        if (tcKimlikNo) filterParts.push(`TCK: ${tcKimlikNo}`);

        if (beyannameTuru) {
            report(55, `${beyannameTuru} beyanname sorgusu yapılıyor...${vergiNo ? ` (VKN: ${vergiNo})` : ''}${tcKimlikNo ? ` (TCK: ${tcKimlikNo})` : ''}`);
        } else {
            report(55, `Tüm beyannameler sorgulanıyor...${vergiNo ? ` (VKN: ${vergiNo})` : ''}${tcKimlikNo ? ` (TCK: ${tcKimlikNo})` : ''}`);
        }

        const startDateInfo = formatDate(startDate);
        const endDateInfo = formatDate(endDate);

        // Ilk sayfa
        const firstResult = await fetchBeyannamePage(currentToken, startDateInfo.formatted, endDateInfo.formatted, 1, searchFilters);
        let totalPages = firstResult.totalPages;
        currentToken = firstResult.newToken;
        const allSearchedBeyannameler: BeyannameItem[] = [...firstResult.beyannameler];

        log.info(`Sayfa 1/${totalPages} çekildi: ${firstResult.beyannameler.length} beyanname`);
        if (totalPages > 1) {
            report(57, `Sayfa 1/${totalPages} çekildi (${firstResult.beyannameler.length} beyanname)`);
        }

        // Kalan sayfalar
        for (let currentPage = 2; currentPage <= totalPages; currentPage++) {
            if (checkIfStopped()) {
                log.warn('Bot durduruldu (sayfa cekme sirasinda)');
                onProgress('error', { error: 'Bot kullanıcı tarafından durduruldu', errorCode: 'USER_STOPPED' });
                return;
            }

            await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_PAGES);

            log.info(`Sayfa ${currentPage}/${totalPages} çekiliyor...`);
            const pageResult = await fetchBeyannamePage(currentToken, startDateInfo.formatted, endDateInfo.formatted, currentPage, searchFilters);
            allSearchedBeyannameler.push(...pageResult.beyannameler);
            currentToken = pageResult.newToken;

            if (pageResult.totalPages > totalPages) totalPages = pageResult.totalPages;

            log.info(`Sayfa ${currentPage}/${totalPages} çekildi: ${pageResult.beyannameler.length} beyanname`);
            const progressPct = 55 + Math.round((currentPage / totalPages) * 10);
            report(progressPct, `Sayfa ${currentPage}/${totalPages} çekildi (toplam: ${allSearchedBeyannameler.length} beyanname)`);
        }

        stats.pages = totalPages;

        // Durum filtresi
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
        log.success(`Onaylandi: ${durumStats.onaylandi} (indirilecek)`);
        if (durumStats.onay_bekliyor > 0) log.warn(`Onay Bekliyor: ${durumStats.onay_bekliyor}`);
        if (durumStats.hata > 0) log.warn(`Hatali: ${durumStats.hata}`);
        if (durumStats.iptal > 0) log.warn(`Iptal: ${durumStats.iptal}`);
        if (durumStats.bilinmiyor > 0) log.warn(`Bilinmiyor: ${durumStats.bilinmiyor}`);

        stats.total = onaylanmisBeyannameler.length;
        stats.skipped = allSearchedBeyannameler.length - onaylanmisBeyannameler.length;

        report(65, `${allSearchedBeyannameler.length} ${filterLabel}beyanname bulundu (${totalPages} sayfa)`);

        const statusParts: string[] = [];
        statusParts.push(`${durumStats.onaylandi} onaylı`);
        if (durumStats.hata > 0) statusParts.push(`${durumStats.hata} hatalı`);
        if (durumStats.onay_bekliyor > 0) statusParts.push(`${durumStats.onay_bekliyor} bekliyor`);
        if (durumStats.iptal > 0) statusParts.push(`${durumStats.iptal} iptal`);
        report(70, statusParts.join(' | '));

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

        for (let i = 0; i < onaylanmisBeyannameler.length; i++) {
            // Stop kontrolu
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

            // BeyannameData olustur
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

            // Pre-download skip
            if (preCheck && preCheck.downloadedTypes.has('BEYANNAME') && preCheck.downloadedTypes.has('TAHAKKUK')) {
                stats.preSkipped++;
                beyanname.success = true;
                processedBeyannameler.push(beyanname);
                allBeyannameler.push(beyanname);
                await delay(100);
                continue;
            }

            try {
                // a) Beyanname PDF
                if (item.oid) {
                    const result = await downloadPdf(item.oid, 'beyanname', currentToken);
                    if (result.success && result.base64) {
                        beyanname.beyannameBuffer = result.base64;
                        stats.downloaded++;
                    } else {
                        stats.failed++;
                        log.error(`Beyanname PDF hatasi: ${result.error}`);
                    }
                    await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_DOWNLOADS);
                }

                // b) Tahakkuk PDF
                if (item.tahakkukOid) {
                    const result = await downloadPdf(item.oid, 'tahakkuk', currentToken, item.tahakkukOid);
                    if (result.success && result.base64) {
                        beyanname.tahakkukBuffer = result.base64;
                        stats.downloaded++;

                        // Parse tahakkuk
                        const turuUpper = item.beyannameTuru?.toUpperCase() || '';
                        if (turuUpper === 'KDV1') {
                            try { beyanname.kdvTahakkukParsed = await parseKdvTahakkuk(result.base64) || undefined; }
                            catch (e) { log.warn(`KDV1 parse hatasi: ${(e as Error).message}`); }
                        }
                        if (turuUpper === 'KDV2') {
                            try { beyanname.kdv2TahakkukParsed = await parseKdv2Tahakkuk(result.base64) || undefined; }
                            catch (e) { log.warn(`KDV2 parse hatasi: ${(e as Error).message}`); }
                        }
                        if (turuUpper === 'KDV9015') {
                            try { beyanname.kdv9015TahakkukParsed = await parseKdv9015Tahakkuk(result.base64) || undefined; }
                            catch (e) { log.warn(`KDV9015 parse hatasi: ${(e as Error).message}`); }
                        }
                        const normalizedForParse = normalizeBeyannameTuru(item.beyannameTuru || '');
                        if (normalizedForParse === 'GGECICI' || normalizedForParse === 'KGECICI') {
                            try { beyanname.geciciVergiTahakkukParsed = await parseGeciciVergiTahakkuk(result.base64) || undefined; }
                            catch (e) { log.warn(`${item.beyannameTuru} parse hatasi: ${(e as Error).message}`); }
                        }
                    } else {
                        stats.failed++;
                        log.error(`Tahakkuk PDF hatasi: ${result.error}`);
                    }
                    await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_DOWNLOADS);
                }

                // c) MUHSGK SGK PDF'leri
                if (item.hasSgkDetails && item.oid) {
                    log.debug('MUHSGK tespit edildi, SGK PDF\'leri indiriliyor...');

                    const muhsgkPdfs = await getMuhsgkDetailPdfs(item.oid, currentToken);

                    beyanname.sgkTahakkukBuffers = [];
                    beyanname.sgkHizmetBuffers = [];

                    // SGK Tahakkuk
                    for (let sgkIdx = 0; sgkIdx < muhsgkPdfs.sgkTahakkukUrls.length; sgkIdx++) {
                        if (sgkIdx > 0) await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_DOWNLOADS);

                        const sgkResult = await downloadSgkPdf(muhsgkPdfs.sgkTahakkukUrls[sgkIdx], currentToken);
                        if (sgkResult.success && sgkResult.base64) {
                            let parsed: TahakkukFisiParsed | undefined;
                            try { parsed = await parseTahakkukFisi(sgkResult.base64) || undefined; }
                            catch (e) { log.warn(`SGK Tahakkuk parse hatasi: ${(e as Error).message}`); }

                            beyanname.sgkTahakkukBuffers.push({ buffer: sgkResult.base64, index: sgkIdx + 1, parsed });

                            if (sgkIdx === 0) {
                                beyanname.sgkTahakkukBuffer = sgkResult.base64;
                                beyanname.sgkTahakkukParsed = parsed;
                            }
                            stats.downloaded++;
                        } else {
                            log.warn(`SGK Tahakkuk[${sgkIdx + 1}] indirme başarısız: ${sgkResult.error || 'Bilinmeyen hata'}`);
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

                    // Hizmet Listesi
                    if (muhsgkPdfs.hizmetListesiUrls.length > 0 && muhsgkPdfs.sgkTahakkukUrls.length > 0) {
                        await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_DOWNLOADS);
                    }

                    for (let hizmetIdx = 0; hizmetIdx < muhsgkPdfs.hizmetListesiUrls.length; hizmetIdx++) {
                        if (hizmetIdx > 0) await delay(GIB_CONFIG.RATE_LIMIT.BETWEEN_DOWNLOADS);

                        const hizmetResult = await downloadSgkPdf(muhsgkPdfs.hizmetListesiUrls[hizmetIdx], currentToken);
                        if (hizmetResult.success && hizmetResult.base64) {
                            let parsed: HizmetListesiParsed | undefined;
                            try { parsed = await parseHizmetListesi(hizmetResult.base64) || undefined; }
                            catch (e) { log.warn(`Hizmet Listesi parse hatasi: ${(e as Error).message}`); }

                            beyanname.sgkHizmetBuffers!.push({ buffer: hizmetResult.base64, index: hizmetIdx + 1, parsed });

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
                            if (f.parsed) totalIsci += f.parsed.isciSayisi || 0;
                        }
                        beyanname.sgkHizmetToplam = { isciSayisi: totalIsci, dosyaSayisi: beyanname.sgkHizmetBuffers.length };
                        if (totalIsci > 0) {
                            log.success(`   Hizmet Listesi: ${totalIsci} isci${beyanname.sgkHizmetBuffers.length > 1 ? ` (${beyanname.sgkHizmetBuffers.length} dosya)` : ''}`);
                        }
                    }
                }
            } catch (e: any) {
                log.error(`Indirme hatasi (${item.tcVkn}): ${e.message}`);
                stats.failed++;
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

            // Adaptive delay
            await delay(getAdaptiveDelay());

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
            reportBeyanname(i + 1, onaylanmisBeyannameler.length, item, 'OK', hasParseData ? parseInfo : undefined);
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
