/**
 * GİB E-Beyanname Bot - Electron Version
 * =====================
 * Ana bot ile senkronize - PDF indirme mantığı aynı
 */

import puppeteer, { Browser, Page, Cookie, CookieParam } from "puppeteer";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { parseHizmetListesi, parseTahakkukFisi, HizmetListesiParsed, TahakkukFisiParsed } from './sgk-parser';
import { parseKdvTahakkuk, KdvTahakkukParsed } from './kdv-parser';
import { parseKdv2Tahakkuk, Kdv2TahakkukParsed } from './kdv2-parser';

// ═══════════════════════════════════════════════════════════════════
// COOKIE MANAGEMENT - Modern Puppeteer API
// ═══════════════════════════════════════════════════════════════════

// GİB Domain'leri
const GIB_DOMAINS = [
    'ebeyanname.gib.gov.tr',
    'dijital.gib.gov.tr',
    'gib.gov.tr',
    'intvrg.gib.gov.tr'
];

/**
 * Browser'dan tüm GİB cookie'lerini al
 * Modern browser.cookies() API kullanır
 */
async function getGibCookies(browser: Browser): Promise<Cookie[]> {
    try {
        const allCookies = await browser.cookies();
        // GİB domain'lerine ait cookie'leri filtrele
        return allCookies.filter(cookie =>
            GIB_DOMAINS.some(domain =>
                cookie.domain.includes(domain) || domain.includes(cookie.domain.replace(/^\./, ''))
            )
        );
    } catch (error) {
        console.error('[Cookie] browser.cookies() hatası:', error);
        return [];
    }
}

/**
 * Cookie array'ini HTTP header string'ine çevir
 */
function cookiesToString(cookies: Cookie[]): string {
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

/**
 * Cookie'leri dosyaya kaydet (session persistence)
 */
async function saveCookies(browser: Browser, filePath: string): Promise<boolean> {
    try {
        const cookies = await getGibCookies(browser);
        await fs.promises.writeFile(filePath, JSON.stringify(cookies, null, 2));
        console.log(`[Cookie] ${cookies.length} cookie kaydedildi: ${filePath}`);
        return true;
    } catch (error) {
        console.error('[Cookie] Kaydetme hatası:', error);
        return false;
    }
}

/**
 * Cookie'leri dosyadan yükle
 */
async function loadCookies(browser: Browser, filePath: string): Promise<boolean> {
    try {
        if (!fs.existsSync(filePath)) {
            console.log('[Cookie] Dosya bulunamadı:', filePath);
            return false;
        }

        const cookiesString = await fs.promises.readFile(filePath, 'utf8');
        const rawCookies = JSON.parse(cookiesString) as Cookie[];

        if (rawCookies.length === 0) {
            return false;
        }

        // Domain'i olan cookie'leri filtrele ve CookieParam'a çevir
        const validCookies = rawCookies
            .filter(c => c.domain && c.name && c.value)
            .map(c => ({
                name: c.name,
                value: c.value,
                domain: c.domain,
                path: c.path || '/',
                secure: c.secure,
                httpOnly: c.httpOnly,
                sameSite: c.sameSite as 'Strict' | 'Lax' | 'None' | undefined,
                expires: c.expires,
            }));

        if (validCookies.length === 0) {
            console.log('[Cookie] Geçerli cookie bulunamadı');
            return false;
        }

        // Browser seviyesinde cookie ayarla
        await browser.setCookie(...validCookies);
        console.log(`[Cookie] ${validCookies.length} cookie yüklendi`);
        return true;
    } catch (error) {
        console.error('[Cookie] Yükleme hatası:', error);
        return false;
    }
}

/**
 * Tüm GİB cookie'lerini sil
 */
async function clearGibCookies(browser: Browser): Promise<void> {
    try {
        const cookies = await getGibCookies(browser);
        if (cookies.length > 0) {
            await browser.deleteCookie(...cookies);
            console.log(`[Cookie] ${cookies.length} cookie silindi`);
        }
    } catch (error) {
        console.error('[Cookie] Silme hatası:', error);
    }
}

/**
 * Cookie'lerin geçerli olup olmadığını kontrol et
 * Session cookie'leri ve expires kontrolü
 */
function areCookiesValid(cookies: Cookie[]): boolean {
    if (cookies.length === 0) return false;

    const now = Date.now() / 1000;
    const sessionCookies = cookies.filter(c =>
        c.name.toLowerCase().includes('session') ||
        c.name.toLowerCase().includes('jsessionid') ||
        c.name.toLowerCase().includes('token')
    );

    // Session cookie yoksa geçersiz
    if (sessionCookies.length === 0) {
        console.log('[Cookie] Session cookie bulunamadı');
        return false;
    }

    // Expires kontrolü (session cookie'ler -1 veya 0 olabilir)
    const expiredCookies = sessionCookies.filter(c =>
        c.expires > 0 && c.expires < now
    );

    if (expiredCookies.length > 0) {
        console.log('[Cookie] Süresi dolmuş cookie var:', expiredCookies.map(c => c.name).join(', '));
        return false;
    }

    return true;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIG - Ana bot ile aynı
// ═══════════════════════════════════════════════════════════════════
export const GIB_CONFIG = {
    LOGIN_URL: "https://dijital.gib.gov.tr/portal/login",

    SELECTORS: {
        FORM: "form#loginForm",
        USERID: "form#loginForm input#userid",
        PASSWORD: "form#loginForm input#sifre",
        CAPTCHA_INPUT: ".captcha input#dk",
        CAPTCHA_IMAGE: '.captcha img[alt="captchaImg"]',
        LOGIN_BUTTON: 'form#loginForm button[type="submit"][title="Giriş Yap"]',

        EBEYANNAME_IMG: 'img[alt="ebeyanname"]',
        BOX_COMPONENT: '[data-testid="box-component"]',
        ONAYLA_BUTTON: 'button[title="ONAYLA"]',

        MAIN_WINDOW: "#mainWindow",
        SEARCH_FORM: "#taxReturnSearchForm",
        SEARCH_BUTTON: "#sorgulaButon",

        BEYANNAME_LIST: 'div[id^="bynList"]',
        BEYANNAME_LIST_CONTENT: 'div[id^="bynList"] .alphacube_content',

        START_DATE: "#baslangicTarihi",
        END_DATE: "#bitisTarihi",

        DURUM_CHECKBOX: "#sorguTipiD",
        ONAYLANDI_RADIO: 'input[type="radio"][name="durum"][value="2"]',

        BEYANNAME_ICON: 'img[src*="pdf_b.gif"]',
        TAHAKKUK_ICON: 'img[src*="pdf_t.gif"]',

        MUHSGK_DETAIL_ICON: 'img[src*="tick_kontrol.gif"]',
        MUHSGK_POPUP: '#bynGoruntu',
        MUHSGK_POPUP_CONTENT: '#bynGoruntu_content',
        MUHSGK_POPUP_CLOSE: '#bynGoruntu_close',
        SGK_TAHAKKUK_ICON: 'img[src*="pdf_s.gif"]',
        SGK_HIZMET_ICON: 'img[src*="pdf_h.gif"]',

        TABLE_ROWS: 'tr[id^="row"]',
        TABLE_HEADER: 'th.bslkK',

        NEXT_PAGE_BUTTON: 'input[type="button"][value=">>"]',
        PREV_PAGE_BUTTON: 'input[type="button"][value="<<"]',
        PAGINATION_INFO: 'font[size="2"]',
    },

    TIMEOUTS: {
        PAGE_LOAD: 90000,
        ELEMENT_WAIT: 60000,
        CAPTCHA_WAIT: 15000,
        NAVIGATION: 15000,
        NEW_TAB_LOAD: 10000,
        DOWNLOAD_WAIT: 10000,
    },

    DELAYS: {
        SHORT: 200,
        MEDIUM: 400,
        LONG: 1000,
        PAGE_LOAD: 1000,
        HUMAN_MIN: 300,
        HUMAN_MAX: 800,
        LIST_LOAD: 800,
        // ═══════════════════════════════════════════════════════════════════
        // GİB İSTEKLERİ - Hızlı ve stabil
        // ═══════════════════════════════════════════════════════════════════
        GIB_MIN_WAIT: 1000,       // GİB HTTP istekleri arası (1s)
        BETWEEN_DOWNLOADS: 800,   // PDF indirmeleri arası
        // === UI/DOM İŞLEMLERİ ===
        PRE_CLICK_WAIT: 600,      // İkon tıklama öncesi
        POST_ICON_CLICK: 600,     // İkon sonrası JS tetikleme
        POPUP_OPEN_WAIT: 500,     // Popup DOM yüklenmesi
        POPUP_CLOSE_WAIT: 200,    // Popup kapanma
        PAGE_CHANGE: 1000,        // Sayfa değişimi
        COOKIES_WAIT: 300,
        // === SAYFA İŞLEMLERİ ===
        PAGE_STABILIZATION: 500,
        POPUP_CHECK_RETRY_WAIT: 300,
        RECOVERY_NAVIGATION_WAIT: 500,
        BATCH_PROCESS_WAIT: 1000,
        GIB_ERROR_RETRY_WAIT: 2000,
        PRE_SKIP_WAIT: 100,
        // === PDF İNDİRME ===
        HTTP_500_RETRY_WAIT: 2000, // 500 sonrası bekleme
        SESSION_REFRESH_WAIT: 500, // Session refresh sonrası
    },

    MAX_CAPTCHA_RETRIES: 5,
    MAX_PAGE_RETRIES: 20,
    MAX_DOWNLOAD_RETRIES: 3,

    // Session refresh endpoint
    SESSION_REFRESH_URL: 'https://ebeyanname.gib.gov.tr/eyeks'
};

// ═══════════════════════════════════════════════════════════════════
// HATA KODLARI SİSTEMİ
// ═══════════════════════════════════════════════════════════════════

export const GIB_ERROR_CODES = {
    // Critical Hatalar - Bot durur, kullanıcı manuel yeniden başlatır
    GIB_SESSION_EXPIRED: {
        code: 'GIB_SESSION_EXPIRED',
        message: 'GİB oturumu sona erdi',
        description: 'Başka bir yerden GİB\'e giriş yapıldı veya oturum zaman aşımına uğradı.',
        isCritical: true,
        userAction: 'Lütfen botu yeniden başlatın.'
    },
    GIB_FRAME_DETACHED: {
        code: 'GIB_FRAME_DETACHED',
        message: 'Tarayıcı bağlantısı koptu',
        description: 'Başka bir sekmeden GİB\'e giriş yapılmış olabilir.',
        isCritical: true,
        userAction: 'Lütfen diğer GİB sekmelerini kapatıp botu yeniden başlatın.'
    },
    GIB_TARGET_CLOSED: {
        code: 'GIB_TARGET_CLOSED',
        message: 'Tarayıcı penceresi kapandı',
        description: 'Browser veya tab beklenmedik şekilde kapatıldı.',
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

    // Non-Critical Hatalar - Bot çalışmaya devam eder
    HTTP_401: { code: 'HTTP_401', message: 'Yetkilendirme hatası', isCritical: false, userAction: null },
    HTTP_403: { code: 'HTTP_403', message: 'Erişim reddedildi', isCritical: false, userAction: null },
    HTTP_500: { code: 'HTTP_500', message: 'GİB sunucu hatası', isCritical: false, userAction: null },
    PDF_INVALID: { code: 'PDF_INVALID', message: 'Geçersiz PDF', isCritical: false, userAction: null },
    PDF_TIMEOUT: { code: 'PDF_TIMEOUT', message: 'PDF indirme zaman aşımı', isCritical: false, userAction: null },
    CHROMEWEB_ERROR: { code: 'CHROMEWEB_ERROR', message: 'Tarayıcı hatası', isCritical: false, userAction: null },
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

/**
 * Hata mesajından hata kodunu tespit eder
 */
export function detectErrorCode(errorMessage: string): GibErrorCode {
    const msg = errorMessage.toLowerCase();

    // Frame/Session hataları (Critical)
    if (msg.includes('detached frame') || msg.includes('frame was detached')) {
        return 'GIB_FRAME_DETACHED';
    }
    if (msg.includes('target closed') || msg.includes('targetcloseerror')) {
        return 'GIB_TARGET_CLOSED';
    }
    if (msg.includes('oturum') && (msg.includes('sona erdi') || msg.includes('zamanaşımı') || msg.includes('timeout'))) {
        return 'GIB_SESSION_EXPIRED';
    }

    // Auth hataları (Critical)
    if (msg.includes('hatalıdır') || msg.includes('yanlış') || msg.includes('bulunamadı') || msg.includes('giriş başarısız')) {
        return 'GIB_AUTH_FAILED';
    }
    if (msg.includes('captcha') && (msg.includes('çözülemedi') || msg.includes('failed') || msg.includes('başarısız'))) {
        return 'GIB_CAPTCHA_FAILED';
    }

    // HTTP hataları (Non-critical)
    if (msg.includes('401') || msg.includes('unauthorized')) return 'HTTP_401';
    if (msg.includes('403') || msg.includes('forbidden')) return 'HTTP_403';
    if (msg.includes('500') || msg.includes('internal server error')) return 'HTTP_500';

    // PDF hataları (Non-critical)
    if (msg.includes('148 byte') || msg.includes('invalid pdf') || msg.includes('geçersiz pdf') || msg.includes('çok küçük')) {
        return 'PDF_INVALID';
    }
    if (msg.includes('timeout') && msg.includes('pdf')) return 'PDF_TIMEOUT';

    // Genel
    if (msg.includes('timeout')) return 'TIMEOUT';
    if (msg.includes('chrome') || msg.includes('puppeteer') || msg.includes('browser')) return 'CHROMEWEB_ERROR';

    return 'UNKNOWN';
}

/**
 * Hata objesi oluşturur
 */
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
    beyannameBuffer?: string;
    tahakkukBuffer?: string;
    beyannamePath?: string;
    tahakkukPath?: string;
    sgkTahakkukBuffer?: string;
    sgkTahakkukPath?: string;
    sgkHizmetBuffer?: string;
    sgkHizmetPath?: string;
    tahakkukDurumu?: string; // 'onaylandi' | 'hatali' | 'iptal' | 'onay_bekliyor' | 'bilinmiyor'
    // SGK PDF Parse sonuclari (tekil - geriye uyumluluk)
    sgkTahakkukParsed?: TahakkukFisiParsed;
    sgkHizmetParsed?: HizmetListesiParsed;
    // KDV1 Tahakkuk Parse sonucu
    kdvTahakkukParsed?: KdvTahakkukParsed;
    kdv2TahakkukParsed?: Kdv2TahakkukParsed;
    // ÇOKLU DOSYA DESTEĞİ: Birden fazla SGK Tahakkuk ve Hizmet Listesi için
    sgkTahakkukBuffers?: Array<{ buffer: string; index: number; parsed?: TahakkukFisiParsed }>;
    sgkHizmetBuffers?: Array<{ buffer: string; index: number; parsed?: HizmetListesiParsed }>;
    // TOPLAM DEĞERLERİ: Birden fazla dosya için hesaplanmış toplamlar
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
    token?: string; // API auth için
    onProgress: (type: string, data: any) => void;
}

// ═══════════════════════════════════════════════════════════════════
// PRE-DOWNLOAD CHECK TYPES & FUNCTIONS
// ═══════════════════════════════════════════════════════════════════
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

/**
 * Dönem hesaplama fonksiyonu
 * Arama tarihi - 1 ay = Beyanname dönemi
 * GGeçici/KGeçici için çeyrek dönem hesabı
 */
function calculateBeyannameDonem(searchDate: Date, beyannameTuru: string): { year: number; month: number } {
    const searchYear = searchDate.getFullYear();
    const searchMonth = searchDate.getMonth() + 1;

    // GGeçici ve KGeçici için çeyrek dönem hesabı
    const isQuarterly = /G(EC|EÇ)İC|K(EC|EÇ)İC/i.test(beyannameTuru);

    if (isQuarterly) {
        // Çeyrek dönem: Hangi çeyrekte olduğumuzu bul
        // Q1 (Ocak-Mart) → Nisan'da görünür → month 1-3
        // Q2 (Nisan-Haziran) → Temmuz'da görünür → month 4-6
        // Q3 (Temmuz-Eylül) → Ekim'de görünür → month 7-9
        // Q4 (Ekim-Aralık) → Ocak'ta (ertesi yıl) görünür → month 10-12

        let quarter: number;
        let year = searchYear;

        if (searchMonth >= 1 && searchMonth <= 3) {
            // Ocak-Mart'ta bakıyoruz → Q4 geçen yıl
            quarter = 4;
            year = searchYear - 1;
        } else if (searchMonth >= 4 && searchMonth <= 6) {
            // Nisan-Haziran'da bakıyoruz → Q1 bu yıl
            quarter = 1;
        } else if (searchMonth >= 7 && searchMonth <= 9) {
            // Temmuz-Eylül'de bakıyoruz → Q2 bu yıl
            quarter = 2;
        } else {
            // Ekim-Aralık'ta bakıyoruz → Q3 bu yıl
            quarter = 3;
        }

        // Çeyreğin son ayını döndür (veritabanında bu şekilde kaydediliyor)
        const quarterEndMonth = quarter * 3;
        return { year, month: quarterEndMonth };
    }

    // Normal beyannameler için: searchMonth - 1
    let beyannameMonth = searchMonth - 1;
    let beyannameYear = searchYear;

    if (beyannameMonth === 0) {
        beyannameMonth = 12;
        beyannameYear = searchYear - 1;
    }

    return { year: beyannameYear, month: beyannameMonth };
}

/**
 * Sunucudan daha önce indirilmiş mükellefleri çeker
 */
async function getPreDownloadedCustomers(
    token: string,
    year: number,
    month: number
): Promise<Map<string, PreDownloadCheck>> {
    const result = new Map<string, PreDownloadCheck>();

    try {
        const apiUrl = process.env.API_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/gib/pre-downloaded?year=${year}&month=${month}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
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
                // Map key: VKN + Beyanname Türü kombinasyonu
                // Bu sayede aynı mükellefin farklı beyanname türleri ayrı ayrı kontrol edilir
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
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Beyanname türü eşleştirme pattern'leri - API ile aynı
 * GİB'den gelen uzun isimler kısa kodlara çevrilir
 */
const BEYANNAME_TYPE_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
    { code: 'KDV1', pattern: /KDV.*1|KDV1/i },
    { code: 'KDV2', pattern: /KDV.*2|KDV2/i },
    { code: 'MUHSGK', pattern: /MUHSGK|MUHTASAR|SGK/i },
    { code: 'GV', pattern: /GEL[İI]R.*VERG[İI]S[İI]|^GV$/i },
    { code: 'GGECICI', pattern: /GEL[İI]R.*GE[ÇC][İI]C[İI]|GVG|GGEC/i },
    { code: 'KV', pattern: /KURUMLAR.*VERG[İI]S[İI]|^KV$/i },
    { code: 'KGECICI', pattern: /KURUMLAR.*GE[ÇC][İI]C[İI]|KVG|KGEC/i },
    { code: 'BABS', pattern: /BA.*BS|BABS/i },
    { code: 'DAMGA', pattern: /DAMGA/i },
    { code: 'TURZ', pattern: /TUR[İI]ZM|TURZ/i },
    { code: 'KONK', pattern: /KONAKLAMA|KONK/i },
    { code: 'OTV301', pattern: /OTV.*301|[ÖO]TV.*I.*SAYIL/i },
    { code: 'OTV302', pattern: /OTV.*302|[ÖO]TV.*II.*SAYIL/i },
    { code: 'OTV303', pattern: /OTV.*303|[ÖO]TV.*III.*SAYIL/i },
    { code: 'OTV304', pattern: /OTV.*304|[ÖO]TV.*IV.*SAYIL/i },
    { code: 'EMLAK', pattern: /EMLAK/i },
    { code: 'CEVRE', pattern: /[ÇC]EVRE/i },
    { code: 'MTV', pattern: /MTV|MOTORLU.*TA[ŞS]/i },
    { code: 'VERASET', pattern: /VERASET|[İI]NT[İI]KAL/i },
];

/**
 * Beyanname türünü normalize eder - API'deki getBeyannameTurKod ile aynı mantık
 * GİB'den "Konaklama Vergisi Beyannamesi" → "KONK"
 * GİB'den "Muhtasar ve Prim Hizmet Beyannamesi" → "MUHSGK"
 * Bu sayede pre-download kontrolünde veritabanı ile doğru eşleşme sağlanır
 */
function normalizeBeyannameTuru(beyannameTuru: string): string {
    const normalizedType = beyannameTuru.toUpperCase();

    // Pattern ile eşleştir
    for (const { code, pattern } of BEYANNAME_TYPE_PATTERNS) {
        if (pattern.test(normalizedType)) {
            return code;
        }
    }

    // Fallback: ilk kelime (alfanumerik, max 15 karakter)
    const firstWord = normalizedType.split(/\s+/)[0].replace(/[^A-Z0-9]/g, '').substring(0, 15);
    // KDV tek başına gelirse KDV1 olmalı
    if (firstWord === 'KDV') {
        return 'KDV1';
    }
    return firstWord || 'DIGER';
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(dateStr: string): {
    year: string;
    month: string;
    day: string;
    formatted: string;
    display: string;
    iso: string;
} {
    const date = new Date(dateStr);
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return {
        year,
        month,
        day,
        formatted: `${year}${month}${day}`,
        display: `${day}.${month}.${year}`,
        iso: `${year}-${month}-${day}`
    };
}

// 2Captcha
async function solveCaptcha(base64: string, key?: string): Promise<string | null> {
    if (!key) return null;
    console.log("[CAPTCHA] 2captcha'ya gönderiliyor...");
    try {
        const formData = new URLSearchParams();
        formData.append('key', key);
        formData.append('method', 'base64');
        formData.append('body', base64);
        formData.append('json', '1');

        const submitRes = await fetch("https://2captcha.com/in.php", { method: "POST", body: formData });
        const submitData = await submitRes.json();

        if (submitData.status !== 1) {
            console.error("Captcha submit error:", submitData);
            return null;
        }
        const captchaId = submitData.request;
        console.log(`[CAPTCHA] ID: ${captchaId} - Bekleniyor...`);

        for (let i = 0; i < 20; i++) {
            await delay(3000);
            const res = await fetch(`https://2captcha.com/res.php?key=${key}&action=get&id=${captchaId}&json=1`);
            const data = await res.json();
            if (data.status === 1) return data.request;
            if (data.request !== 'CAPCHA_NOT_READY') return null;
        }
        return null;
    } catch (e) {
        console.error("Captcha error:", e);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// DEBUG MODE - Environment variable ile kontrol
// ═══════════════════════════════════════════════════════════════════
const DEBUG_MODE = process.env.GIB_DEBUG === 'true'; // .env'de GIB_DEBUG=true ile aktifleşir

// ═══════════════════════════════════════════════════════════════════
// TÜRKÇE RENKLİ LOG SİSTEMİ - ZAMAN DAMGALI (MİLİSANİYE DAHİL)
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
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    dim: '\x1b[2m'
};

// Zaman damgası formatı: HH:MM:SS.mmm (milisaniye dahil)
function getTimestamp(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');
    const secs = now.getSeconds().toString().padStart(2, '0');
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${mins}:${secs}.${ms}`;
}

// ISO timestamp for logs
function getISOTimestamp(): string {
    return new Date().toISOString();
}

const log = {
    // Debug seviyesi - DEBUG_MODE aktifse yazdırır
    debug: (msg: string) => {
        if (DEBUG_MODE) {
            console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.dim}[DEBUG]${colors.reset} 🔍 ${msg}`);
        }
    },
    // Verbose debug - çok detaylı loglar
    verbose: (msg: string) => {
        if (DEBUG_MODE) {
            console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.dim}[VERBOSE]${colors.reset} 📝 ${msg}`);
        }
    },
    success: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.green}[BAŞARILI]${colors.reset} ✅ ${msg}`),
    warn: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.yellow}[UYARI]${colors.reset} ⚠️ ${msg}`),
    error: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.red}[HATA]${colors.reset} ❌ ${msg}`),
    download: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.magenta}[İNDİRME]${colors.reset} 📥 ${msg}`),
    skip: (msg: string) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.yellow}[ATLANDI]${colors.reset} ⏭️ ${msg}`),
    // Mükellef işlem süresi için özel log
    customerTime: (vkn: string, name: string, seconds: number) => console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.cyan}[SÜRE]${colors.reset} ⏱️ ${vkn} - ${name}: ${seconds.toFixed(1)}s`),

    // HTTP Request/Response logging
    http: (method: string, url: string, status?: number, duration?: number) => {
        const statusColor = status && status >= 200 && status < 300 ? colors.green :
                           status && status >= 400 ? colors.red : colors.yellow;
        const statusText = status ? `${statusColor}${status}${colors.reset}` : '...';
        const durationText = duration ? ` (${duration}ms)` : '';
        console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.blue}[HTTP]${colors.reset} 🌐 ${method} ${url.substring(0, 80)}... → ${statusText}${durationText}`);
    },

    // Cookie/Token logging
    cookie: (action: string, count: number, details?: string) => {
        if (DEBUG_MODE) {
            const detailText = details ? ` | ${details}` : '';
            console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.cyan}[COOKIE]${colors.reset} 🍪 ${action}: ${count} cookie${detailText}`);
        }
    },

    // Token logging
    token: (action: string, tokenPreview?: string) => {
        if (DEBUG_MODE) {
            const preview = tokenPreview ? ` (${tokenPreview.substring(0, 20)}...)` : '';
            console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.magenta}[TOKEN]${colors.reset} 🔑 ${action}${preview}`);
        }
    },

    // Header logging
    header: (headers: Record<string, string>, direction: 'REQUEST' | 'RESPONSE' = 'REQUEST') => {
        if (DEBUG_MODE) {
            const icon = direction === 'REQUEST' ? '📤' : '📥';
            console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.blue}[HEADER]${colors.reset} ${icon} ${direction}:`);
            for (const [key, value] of Object.entries(headers)) {
                // Hassas bilgileri maskele
                let displayValue = value;
                if (key.toLowerCase().includes('cookie')) {
                    displayValue = value.substring(0, 50) + '... (truncated)';
                } else if (key.toLowerCase().includes('authorization')) {
                    displayValue = value.substring(0, 30) + '... (truncated)';
                }
                console.log(`${colors.gray}    ${key}:${colors.reset} ${displayValue}`);
            }
        }
    },

    // Error with stack trace
    errorStack: (msg: string, error?: Error) => {
        console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.bgRed}${colors.white}[HATA]${colors.reset} ❌ ${msg}`);
        if (error) {
            console.log(`${colors.gray}    Message:${colors.reset} ${error.message}`);
            if (error.stack) {
                const stackLines = error.stack.split('\n').slice(1, 5);
                console.log(`${colors.gray}    Stack:${colors.reset}`);
                stackLines.forEach(line => console.log(`${colors.dim}      ${line.trim()}${colors.reset}`));
            }
        }
    },

    // Separator for visual grouping
    separator: (title?: string) => {
        const line = '═'.repeat(60);
        if (title) {
            console.log(`${colors.cyan}╔${line}╗${colors.reset}`);
            console.log(`${colors.cyan}║${colors.reset} ${title.padEnd(58)} ${colors.cyan}║${colors.reset}`);
            console.log(`${colors.cyan}╚${line}╝${colors.reset}`);
        } else {
            console.log(`${colors.gray}${line}${colors.reset}`);
        }
    },

    // JSON object pretty print
    json: (label: string, obj: any) => {
        if (DEBUG_MODE) {
            console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${colors.cyan}[JSON]${colors.reset} 📋 ${label}:`);
            try {
                const formatted = JSON.stringify(obj, null, 2);
                formatted.split('\n').forEach(line => {
                    console.log(`${colors.gray}    ${line}${colors.reset}`);
                });
            } catch {
                console.log(`${colors.gray}    [Unable to stringify]${colors.reset}`);
            }
        }
    }
};

// ═══════════════════════════════════════════════════════════════════
// MAIN BOT FUNCTION
// ═══════════════════════════════════════════════════════════════════
export async function runElectronBot(options: BotOptions) {
    const { username, password, parola, startDate, endDate, onProgress, captchaKey, downloadFiles = true, token } = options;

    // ═══════════════════════════════════════════════════════════════════
    // DEBUG: Bot Başlangıç Bilgileri
    // ═══════════════════════════════════════════════════════════════════
    log.separator('GİB E-BEYANNAME BOT BAŞLATILIYOR');
    log.debug(`Başlangıç zamanı: ${getISOTimestamp()}`);
    log.debug(`DEBUG_MODE: ${DEBUG_MODE ? 'AKTİF' : 'KAPALI'}`);
    log.debug(`Tarih aralığı: ${startDate} - ${endDate}`);
    log.debug(`PDF indirme: ${downloadFiles ? 'EVET' : 'HAYIR'}`);
    log.debug(`Kullanıcı: ${username}`);
    log.debug(`Şifre: ${'*'.repeat(password?.length || 0)}`);
    log.debug(`Parola: ${parola ? '*'.repeat(parola.length) : 'YOK'}`);
    log.debug(`Captcha Key: ${captchaKey ? captchaKey.substring(0, 8) + '...' : 'YOK'}`);
    log.token('API Token', token);
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
        preSkipped: 0 // Daha önce indirilmiş olduğu için atlanan
    };

    // Pre-download check - Daha önce indirilmiş mükellefleri atlamak için
    let preDownloadedMap: Map<string, PreDownloadCheck> = new Map();

    const allBeyannameler: BeyannameData[] = [];
    const startTime = Date.now();

    const report = (percent: number, message: string) => {
        console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} [GIB-BOT] %${percent} - ${message}`);
        onProgress('progress', { message, progress: percent });
    };

    // Pre-download check yap (token varsa)
    if (token && downloadFiles) {
        report(2, "Daha önce indirilmiş mükellefler kontrol ediliyor...");
        try {
            // Dönem hesapla: startDate - 1 ay
            const searchDate = new Date(startDate);
            const donem = calculateBeyannameDonem(searchDate, 'NORMAL');
            preDownloadedMap = await getPreDownloadedCustomers(token, donem.year, donem.month);
            report(4, `✅ ${preDownloadedMap.size} mükellef için mevcut dosyalar kontrol edildi`);
        } catch (e: any) {
            log.warn(`Pre-download check hatası: ${e.message}`);
        }
    }

    report(5, "Tarayıcı başlatılıyor...");

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=site-per-process',
                '--window-size=1920,1080'
            ]
        });

        page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Anti-detection
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        );

        await page.setExtraHTTPHeaders({
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        });

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            (window as any).chrome = { runtime: {} };
        });

        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: LOGIN
        // ═══════════════════════════════════════════════════════════════════
        let loginSuccessful = false;
        let captchaRetryCount = 0;

        while (!loginSuccessful && captchaRetryCount < GIB_CONFIG.MAX_CAPTCHA_RETRIES) {
            try {
                await page.goto(GIB_CONFIG.LOGIN_URL, { waitUntil: "networkidle0", timeout: GIB_CONFIG.TIMEOUTS.PAGE_LOAD });
            } catch (e) {
                log.warn('Sayfa yükleme timeout, devam ediliyor...');
            }

            report(15, "Kullanıcı bilgileri giriliyor...");

            await page.waitForSelector("#userid", { visible: true, timeout: 10000 });
            await delay(GIB_CONFIG.DELAYS.SHORT);

            await page.click('#userid', { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type('#userid', username, { delay: 50 });

            if (parola) {
                const parolaInput = await page.$('#parola');
                if (parolaInput) {
                    await page.click('#parola', { clickCount: 3 });
                    await page.keyboard.press('Backspace');
                    await page.type('#parola', parola, { delay: 50 });
                }
            }

            await page.waitForSelector("#sifre", { visible: true });
            await page.click('#sifre', { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type('#sifre', password, { delay: 50 });

            report(20, "⌨️ Lütfen CAPTCHA'yı manuel olarak girin ve 'Giriş Yap' butonuna tıklayın...");
            log.debug("═══════════════════════════════════════════════════════════════════");
            log.debug("📋 MANUEL GİRİŞ BEKLENİYOR");
            log.debug("   1. CAPTCHA kodunu girin");
            log.debug("   2. 'Giriş Yap' butonuna tıklayın");
            log.debug("   Timeout: 2 dakika");
            log.debug("═══════════════════════════════════════════════════════════════════");

            // Kullanıcının giriş yapmasını bekle (login formu kaybolana kadar veya 2 dakika)
            try {
                await page.waitForFunction(() => {
                    // Login formu artık sayfada değilse giriş başarılı
                    const loginForm = document.querySelector('form#loginForm');
                    // Veya URL değiştiyse
                    const url = window.location.href;
                    return !loginForm || (!url.includes('/login') && !url.includes('main.jsp'));
                }, { timeout: 120000 }); // 2 dakika timeout

                loginSuccessful = true;
                log.success("Manuel giriş başarılı!");
                report(50, "Giriş başarılı!");
            } catch (e) {
                log.error("Giriş zaman aşımına uğradı veya başarısız oldu");
                captchaRetryCount++;
                if (captchaRetryCount < GIB_CONFIG.MAX_CAPTCHA_RETRIES) {
                    report(15, `Giriş yeniden deneniyor (${captchaRetryCount}/${GIB_CONFIG.MAX_CAPTCHA_RETRIES})...`);
                    await delay(GIB_CONFIG.DELAYS.LONG);
                }
            }
        }

        if (!loginSuccessful) {
            throw new Error(`Giriş 2 dakika içinde tamamlanamadı`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: Navigate to E-Beyanname
        // ═══════════════════════════════════════════════════════════════════
        report(52, "E-Beyanname sistemine geçiliyor...");
        await delay(GIB_CONFIG.DELAYS.PAGE_LOAD);

        const currentUrlNav = page.url();
        if (!currentUrlNav.includes('intvrg') && !currentUrlNav.includes('ebeyanname')) {
            await page.waitForSelector(GIB_CONFIG.SELECTORS.EBEYANNAME_IMG, { timeout: 5000 }).catch(() => null);

            await page.evaluate(() => {
                const img = document.querySelector('img[alt="ebeyanname"]');
                if (img) {
                    const boxComponent = img.closest('[data-testid="box-component"]') as HTMLElement;
                    if (boxComponent) boxComponent.click();
                }
            });

            await delay(GIB_CONFIG.DELAYS.LONG);

            await page.evaluate(() => {
                const btn = document.querySelector('button[title="ONAYLA"]') as HTMLButtonElement;
                btn?.click();
            });

            await delay(GIB_CONFIG.DELAYS.PAGE_LOAD);
        }

        // Find E-Beyanname tab
        let targetPage: Page | null = null;
        for (let i = 0; i < 10; i++) {
            const pages = await browser.pages();
            for (const p of pages) {
                const url = p.url();
                if (url.includes("ebeyanname") || url.includes("intvrg")) {
                    targetPage = p;
                    break;
                }
            }
            if (targetPage) break;
            await delay(1000);
        }

        if (targetPage) {
            page = targetPage;
            await page.bringToFront();
            log.success('E-Beyanname sekmesine geçildi.');
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 3: Search Beyanname
        // ═══════════════════════════════════════════════════════════════════
        report(58, "Beyanname arama formu açılıyor...");
        await delay(GIB_CONFIG.DELAYS.MEDIUM);

        try {
            await page.waitForFunction(() => {
                return typeof (window as any).beyannameAraFormu === "function";
            }, { timeout: 10000 });
        } catch (e) {
            log.warn('beyannameAraFormu fonksiyonu henüz hazır değil.');
        }

        await page.evaluate(() => {
            if (typeof (window as any).beyannameAraFormu === "function") {
                (window as any).beyannameAraFormu();
            }
        });

        await delay(GIB_CONFIG.DELAYS.MEDIUM);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 4: Set Date Range
        // ═══════════════════════════════════════════════════════════════════
        report(62, "Tarih aralığı ayarlanıyor...");

        const startDateInfo = formatDate(startDate);
        const endDateInfo = formatDate(endDate);

        log.debug(`Tarih aralığı: ${startDateInfo.display} - ${endDateInfo.display}`);

        await page.waitForSelector(GIB_CONFIG.SELECTORS.MAIN_WINDOW, { timeout: 15000 }).catch(() => null);

        await page.evaluate((startFormatted: string, endFormatted: string) => {
            const setInputValue = (input: HTMLInputElement | null, value: string) => {
                if (!input) return false;
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype, "value"
                )?.set;
                nativeInputValueSetter?.call(input, value);
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
                return true;
            };

            const baslangicInput = document.getElementById("baslangicTarihi") as HTMLInputElement;
            const bitisInput = document.getElementById("bitisTarihi") as HTMLInputElement;

            if (baslangicInput) setInputValue(baslangicInput, startFormatted);
            if (bitisInput) setInputValue(bitisInput, endFormatted);
        }, startDateInfo.formatted, endDateInfo.formatted);

        await delay(GIB_CONFIG.DELAYS.SHORT);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 5: Durum Filtresi DEVRE DIŞI
        // ═══════════════════════════════════════════════════════════════════
        // NOT: Durum checkbox'ı işaretlendiğinde GİB sistem hatası oluşuyor
        // Bu nedenle tüm kayıtlar çekilip "Vergi Tahakkuk Durumu" sütununa göre filtrelenecek
        // Sadece "Onaylandı" durumundaki beyannameler işlenecek (satır bazında kontrol)
        log.debug("Durum filtresi kullanılmıyor - satır bazında 'Onaylandı' kontrolü yapılacak");

        // Period filter
        if (options.donemBasAy && options.donemBasYil && options.donemBitAy && options.donemBitYil) {
            report(68, "Vergilendirme dönemi ayarlanıyor...");

            await page.evaluate((basAy: number, basYil: number, bitAy: number, bitYil: number) => {
                const periodCheckbox = document.getElementById("sorguTipiP") as HTMLInputElement;
                if (periodCheckbox && !periodCheckbox.checked) {
                    periodCheckbox.checked = true;
                    periodCheckbox.dispatchEvent(new Event("click", { bubbles: true }));
                }

                const setSel = (name: string, val: number) => {
                    const el = document.querySelector(`select[name="${name}"]`) as HTMLSelectElement;
                    if (el) {
                        el.value = val.toString();
                        el.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                };
                setSel('donemBasAy', basAy);
                setSel('donemBasYil', basYil);
                setSel('donemBitAy', bitAy);
                setSel('donemBitYil', bitYil);
            }, options.donemBasAy, options.donemBasYil, options.donemBitAy, options.donemBitYil);
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 6: Execute Search
        // ═══════════════════════════════════════════════════════════════════
        report(70, "Beyanname sorgusu yapılıyor...");

        await page.evaluate(() => {
            if (typeof (window as any).taxReturnSearchFormPost === "function") {
                (window as any).taxReturnSearchFormPost();
            }
        });

        await delay(GIB_CONFIG.DELAYS.MEDIUM);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 7: Extract Data & Download PDFs
        // ═══════════════════════════════════════════════════════════════════
        report(75, "Beyanname listesi yükleniyor...");

        await page.waitForSelector(GIB_CONFIG.SELECTORS.BEYANNAME_LIST, { timeout: 12000 }).catch(() => null);
        // ═══════════════════════════════════════════════════════════════════
        // SESSION REFRESH - eyeks endpoint ile session canlı tutma
        // ═══════════════════════════════════════════════════════════════════
        const refreshSession = async (): Promise<boolean> => {
            try {
                const timestamp = Date.now();
                const refreshUrl = `${GIB_CONFIG.SESSION_REFRESH_URL}?_dc=${timestamp}`;

                // Cookie'leri al
                const cookies = await page!.cookies('https://ebeyanname.gib.gov.tr', 'https://dijital.gib.gov.tr');
                const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

                const response = await axios.get(refreshUrl, {
                    headers: {
                        'Cookie': cookieString,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                        'Accept': '*/*',
                        'Referer': 'https://ebeyanname.gib.gov.tr/'
                    },
                    timeout: 10000,
                    validateStatus: () => true
                });

                log.debug(`Session refresh: ${response.status}`);
                return response.status === 200;
            } catch (e: any) {
                log.debug(`Session refresh hata: ${e.message}`);
                return false;
            }
        };

        // ═══════════════════════════════════════════════════════════════════
        // PDF İNDİRME HELPER - AXIOS İLE
        // ═══════════════════════════════════════════════════════════════════
        const downloadPdfHelper = async (
            iconSelector: string,
            rowIndex: number,
            fileName: string,
            maxRetries: number = 3
        ): Promise<{ base64: string | null; errorType?: 'HTTP_500' | 'HTTP_401' | 'HTTP_ERROR' | 'NOT_PDF' | 'TIMEOUT' | 'UNKNOWN' }> => {

            // URL Cache - retry'da ikon tekrar tıklanmadan aynı URL ile dene
            let cachedUrl: string | null = null;

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    log.download(`${fileName} indiriliyor (Deneme ${attempt + 1}/${maxRetries})...`);

                    // URL zaten yakalandıysa, ikon tıklamadan direkt fetch yap
                    if (!cachedUrl) {
                        // 1. window.open'ı mock'la
                        await page!.evaluate(() => {
                            (window as any).__capturedUrl = null;
                            const originalOpen = window.open;
                            (window as any).__originalOpen = originalOpen;
                            window.open = function(url?: string | URL) {
                                if (url) (window as any).__capturedUrl = url.toString();
                                return null;
                            };
                        });

                        // 2. PDF ikonuna tıkla
                        await delay(GIB_CONFIG.DELAYS.PRE_CLICK_WAIT);

                        const iconClicked = await page!.evaluate((sel: string, idx: number, rowSel: string) => {
                            const popup = document.querySelector('div[id^="bynList"]') as HTMLElement;
                            if (!popup) return { success: false, reason: 'popup_not_found' };

                            const rows = popup.querySelectorAll(rowSel);
                            if (idx >= rows.length) return { success: false, reason: `row_not_found_idx_${idx}_total_${rows.length}` };

                            const icon = rows[idx]?.querySelector(sel);
                            if (!icon) return { success: false, reason: 'icon_not_found' };

                            (icon as HTMLElement).click();
                            return { success: true };
                        }, iconSelector, rowIndex, GIB_CONFIG.SELECTORS.TABLE_ROWS);

                        if (!iconClicked.success) {
                            log.warn(`${fileName} ikon tıklanamadı: ${iconClicked.reason}`);
                            if (iconClicked.reason === 'popup_not_found') {
                                log.error('Beyanname listesi popup\'ı kaybolmuş!');
                                return { base64: null, errorType: 'UNKNOWN' };
                            }
                            continue;
                        }

                        // GİB JavaScript'inin window.open'ı tetiklemesi için bekle
                        await delay(GIB_CONFIG.DELAYS.POST_ICON_CLICK);

                        // 3. URL'yi al ve CACHE'le
                        cachedUrl = await page!.evaluate(() => {
                            const url = (window as any).__capturedUrl;
                            if ((window as any).__originalOpen) {
                                window.open = (window as any).__originalOpen;
                                delete (window as any).__originalOpen;
                            }
                            delete (window as any).__capturedUrl;
                            return url;
                        });

                        if (!cachedUrl) {
                            log.warn(`${fileName} URL yakalanmadı`);
                            await delay(500);
                            continue;
                        }
                    }

                    log.debug(`URL: ${cachedUrl.substring(0, 80)}...`);

                    // ═══════════════════════════════════════════════════════════════════
                    // AXIOS PDF İNDİRME
                    // ═══════════════════════════════════════════════════════════════════
                    const fullUrl = cachedUrl.startsWith('http')
                        ? cachedUrl
                        : `https://ebeyanname.gib.gov.tr${cachedUrl.startsWith('/') ? '' : '/'}${cachedUrl}`;

                    // Cookie'leri Puppeteer'dan al
                    const cookies = await page!.cookies('https://ebeyanname.gib.gov.tr', 'https://dijital.gib.gov.tr');
                    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

                    const requestStartTime = Date.now();

                    try {
                        const axiosResponse = await axios.get(fullUrl, {
                            responseType: 'arraybuffer',
                            timeout: 30000,
                            validateStatus: () => true,
                            headers: {
                                'Cookie': cookieString,
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                                'Accept': 'application/pdf,application/octet-stream,*/*',
                                'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                                'Referer': 'https://ebeyanname.gib.gov.tr/',
                                'Connection': 'keep-alive',
                                'Sec-Fetch-Dest': 'document',
                                'Sec-Fetch-Mode': 'navigate',
                                'Sec-Fetch-Site': 'same-origin'
                            }
                        });

                        const requestDuration = Date.now() - requestStartTime;
                        const contentType = axiosResponse.headers['content-type'] || '';
                        log.http('GET (Axios)', fullUrl.substring(0, 80), axiosResponse.status, requestDuration);
                        log.verbose(`Content-Type: ${contentType}`);

                        // HTTP 200 + PDF → Başarı
                        if (axiosResponse.status === 200) {
                            if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
                                const base64 = Buffer.from(axiosResponse.data, 'binary').toString('base64');
                                if (base64.length > 1000) {
                                    const sizeKB = Math.round(base64.length / 1024);
                                    log.success(`${fileName} Axios ile indirildi (${sizeKB}KB)`);
                                    return { base64 };
                                }
                            } else {
                                // PDF değil - HTML/JSON hata
                                const errorText = Buffer.from(axiosResponse.data).toString('utf8');
                                log.error(`${fileName} Content-Type PDF değil: ${contentType}`);

                                if (errorText.includes('SERVICERESULT')) {
                                    log.warn(`${fileName} - GİB rate limit (SERVICERESULT)`);
                                    await refreshSession();
                                    await delay(GIB_CONFIG.DELAYS.GIB_ERROR_RETRY_WAIT);
                                    continue;
                                }
                                log.error(`Response: ${errorText.substring(0, 200)}`);
                            }
                        }
                        // HTTP 500 → Session refresh yap ve tekrar dene
                        else if (axiosResponse.status === 500) {
                            log.warn(`${fileName} HTTP 500 - Session refresh yapılıyor...`);

                            // Session refresh
                            await refreshSession();

                            // Cache temizle - yeni TOKEN alınacak
                            cachedUrl = '';

                            await delay(GIB_CONFIG.DELAYS.HTTP_500_RETRY_WAIT);
                            continue;
                        }
                        // HTTP 401/403 → Session timeout
                        else if (axiosResponse.status === 401 || axiosResponse.status === 403) {
                            log.error(`${fileName} HTTP ${axiosResponse.status} - Yetkilendirme hatası!`);
                            return { base64: null, errorType: 'HTTP_401' };
                        }
                        // Diğer hatalar
                        else {
                            log.error(`${fileName} HTTP ${axiosResponse.status}`);
                        }
                    } catch (axiosError: any) {
                        log.error(`${fileName} Axios exception: ${axiosError.message}`);
                    }

                } catch (e: any) {
                    log.error(`${fileName} beklenmeyen hata: ${e.message}`);
                }

                // Retry öncesi bekleme
                if (attempt < maxRetries - 1) {
                    const waitTime = GIB_CONFIG.DELAYS.GIB_MIN_WAIT * (attempt + 1);
                    log.debug(`${waitTime}ms bekleniyor...`);
                    await delay(waitTime);
                }
            }
            return { base64: null, errorType: 'UNKNOWN' };
        };

        // ═══════════════════════════════════════════════════════════════════
        // MUHSGK PDF İNDİRME HELPER - DETAYLI HATA LOGLAMA İLE
        // ═══════════════════════════════════════════════════════════════════
        const downloadMuhsgkPdfHelper = async (
            iconSelector: string,
            fileName: string,
            iconIndex: number = 0,
            maxRetries: number = 3
        ): Promise<{ base64: string | null; errorType?: string }> => {

            log.debug(`MUHSGK Helper Başladı: ${fileName} (Index: ${iconIndex})`);

            // URL Cache - retry'da ikon tekrar tıklanmadan aynı URL ile dene
            let cachedUrl: string | null = null;

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    log.download(`${fileName} (MUHSGK) indiriliyor (Deneme ${attempt + 1}/${maxRetries})...`);

                    // URL zaten yakalandıysa, ikon tıklamadan direkt fetch yap
                    if (!cachedUrl) {
                        // 1. window.open'ı mock'la
                        await page!.evaluate(() => {
                            (window as any).__capturedUrl = null;
                            const originalOpen = window.open;
                            (window as any).__originalOpen = originalOpen;
                            window.open = function(url?: string | URL) {
                                if (url) (window as any).__capturedUrl = url.toString();
                                return null;
                            };
                        });

                        // 2. MUHSGK Popup içindeki PDF ikonuna tıkla - ÖNCE 2 saniye bekle
                        await delay(GIB_CONFIG.DELAYS.PRE_CLICK_WAIT);
                        log.debug(`MUHSGK ikon tıklama öncesi ${GIB_CONFIG.DELAYS.PRE_CLICK_WAIT}ms beklendi`);

                        const iconClicked = await page!.evaluate((selector: string, popupSel: string, idx: number) => {
                            const popup = document.querySelector(popupSel);
                            if (!popup) return { success: false, reason: 'muhsgk_popup_not_found' };

                            const icons = popup.querySelectorAll(selector);
                            if (icons.length === 0) return { success: false, reason: `no_icons_for_selector_${selector}` };
                            if (idx >= icons.length) return { success: false, reason: `icon_index_out_of_range_idx_${idx}_total_${icons.length}` };

                            (icons[idx] as HTMLElement).click();
                            return { success: true, totalIcons: icons.length };
                        }, iconSelector, GIB_CONFIG.SELECTORS.MUHSGK_POPUP, iconIndex);

                        if (!iconClicked.success) {
                            log.warn(`${fileName} ikon tıklanamadı: ${iconClicked.reason}`);
                            if (iconClicked.reason === 'muhsgk_popup_not_found') {
                                log.error('MUHSGK popup\'ı kaybolmuş!');
                                return { base64: null, errorType: 'POPUP_CLOSED' };
                            }
                            continue;
                        }

                        // GİB JavaScript'inin window.open'ı tetiklemesi için bekle (400ms → 800ms)
                        await delay(GIB_CONFIG.DELAYS.POST_ICON_CLICK);

                        // 3. URL'yi al ve CACHE'le
                        cachedUrl = await page!.evaluate(() => {
                            const url = (window as any).__capturedUrl;
                            // window.open'ı HEMEN restore et
                            if ((window as any).__originalOpen) {
                                window.open = (window as any).__originalOpen;
                                delete (window as any).__originalOpen;
                            }
                            delete (window as any).__capturedUrl;
                            return url;
                        });

                        if (!cachedUrl) {
                            log.warn(`${fileName} URL yakalanmadı (onclick fonksiyonu çalışmamış olabilir)`);
                            await delay(1000);
                            continue;
                        }
                    } else {
                        // Cached URL ile retry - ikon tıklanmadan!
                        log.debug(`${fileName} - Cached URL ile tekrar deneniyor...`);
                    }

                    log.debug(`URL: ${cachedUrl.substring(0, 80)}...`);

                    // ═══════════════════════════════════════════════════════════════════
                    // AXIOS PDF İNDİRME (MUHSGK)
                    // ═══════════════════════════════════════════════════════════════════
                    const fullUrl = cachedUrl.startsWith('http')
                        ? cachedUrl
                        : `https://ebeyanname.gib.gov.tr${cachedUrl.startsWith('/') ? '' : '/'}${cachedUrl}`;

                    // Cookie'leri Puppeteer'dan al
                    const cookies = await page!.cookies('https://ebeyanname.gib.gov.tr', 'https://dijital.gib.gov.tr');
                    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

                    const requestStartTime = Date.now();

                    try {
                        const axiosResponse = await axios.get(fullUrl, {
                            responseType: 'arraybuffer',
                            timeout: 30000,
                            validateStatus: () => true,
                            headers: {
                                'Cookie': cookieString,
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                                'Accept': 'application/pdf,application/octet-stream,*/*',
                                'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                                'Referer': 'https://ebeyanname.gib.gov.tr/',
                                'Connection': 'keep-alive'
                            }
                        });

                        const requestDuration = Date.now() - requestStartTime;
                        const contentType = axiosResponse.headers['content-type'] || '';
                        log.http('GET (Axios)', fullUrl.substring(0, 80), axiosResponse.status, requestDuration);
                        log.verbose(`Content-Type: ${contentType}`);

                        // HTTP 200 + PDF → Başarı
                        if (axiosResponse.status === 200) {
                            if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
                                const base64 = Buffer.from(axiosResponse.data, 'binary').toString('base64');
                                if (base64.length > 1000) {
                                    const sizeKB = Math.round(base64.length / 1024);
                                    log.success(`${fileName} Axios ile indirildi (${sizeKB}KB)`);
                                    return { base64 };
                                }
                            } else {
                                const errorText = Buffer.from(axiosResponse.data).toString('utf8');
                                log.error(`${fileName} Content-Type PDF değil: ${contentType}`);

                                if (errorText.includes('SERVICERESULT')) {
                                    log.warn(`${fileName} - GİB rate limit (SERVICERESULT)`);
                                    await refreshSession();
                                    await delay(GIB_CONFIG.DELAYS.GIB_ERROR_RETRY_WAIT);
                                    continue;
                                }
                                log.error(`Response: ${errorText.substring(0, 200)}`);
                            }
                        }
                        // HTTP 500 → Session refresh
                        else if (axiosResponse.status === 500) {
                            log.warn(`${fileName} HTTP 500 - Session refresh yapılıyor...`);
                            await refreshSession();
                            cachedUrl = '';
                            await delay(GIB_CONFIG.DELAYS.HTTP_500_RETRY_WAIT);
                            continue;
                        }
                        // HTTP 401/403
                        else if (axiosResponse.status === 401 || axiosResponse.status === 403) {
                            log.error(`${fileName} HTTP ${axiosResponse.status} - Yetkilendirme hatası!`);
                            return { base64: null, errorType: 'HTTP_401' };
                        }
                        else {
                            log.error(`${fileName} HTTP ${axiosResponse.status}`);
                        }
                    } catch (axiosError: any) {
                        log.error(`${fileName} Axios exception: ${axiosError.message}`);
                    }

                } catch (e: any) {
                    log.error(`${fileName} beklenmeyen hata: ${e.message}`);
                }

                // Retry öncesi bekleme - exponential backoff
                if (attempt < maxRetries - 1) {
                    const waitTime = GIB_CONFIG.DELAYS.GIB_MIN_WAIT * (attempt + 1);
                    log.debug(`${waitTime}ms bekleniyor...`);
                    await delay(waitTime);
                }
            }
            return { base64: null, errorType: 'UNKNOWN' };
        };

        // ═══════════════════════════════════════════════════════════════════
        // SAYFA DÖNGÜSÜ
        // ═══════════════════════════════════════════════════════════════════
        let pageNum = 1;
        let hasMorePages = true;

        while (hasMorePages && pageNum <= GIB_CONFIG.MAX_PAGE_RETRIES) {
            report(75 + pageNum, `Sayfa ${pageNum} okunuyor...`);

            const pageData = await page.evaluate(() => {
                const results: any[] = [];
                const popup = document.querySelector('div[id^="bynList"]') as HTMLElement;

                if (!popup) return { results: [], hasMore: false };

                const dataRows = popup.querySelectorAll('tr[id^="row"]');

                for (const row of Array.from(dataRows)) {
                    const cells = row.querySelectorAll("td");
                    if (cells.length < 6) continue;

                    let oid = "";
                    let tahakkukOid = "";

                    const bynImg = row.querySelector('img[src*="pdf_b.gif"]');
                    if (bynImg) {
                        const onClick = bynImg.getAttribute("onclick");
                        const match = onClick?.match(/beyannameGoruntule\(['"]([^'"]+)['"]/);
                        if (match) oid = match[1];
                    }

                    const thkImg = row.querySelector('img[src*="pdf_t.gif"]');
                    if (thkImg) {
                        const onClick = thkImg.getAttribute("onclick");
                        const match = onClick?.match(/tahakkukGoruntule\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/);
                        if (match) tahakkukOid = match[2];
                    }

                    // ═══════════════════════════════════════════════════════════════════
                    // VERGİ TAHAKKUK DURUMU KONTROLÜ
                    // ═══════════════════════════════════════════════════════════════════
                    // Durum sütununu bul: id="durumTD..." ile başlayan cell
                    const durumCell = row.querySelector('td[id^="durumTD"]');
                    let tahakkukDurumu = 'bilinmiyor';

                    if (durumCell) {
                        // images/ok.gif = Onaylandı
                        // images/err.gif = Hatalı
                        // images/iptal.gif = İptal
                        // images/wtng.gif = Onay bekliyor
                        const img = durumCell.querySelector('img');
                        const imgSrc = img?.getAttribute('src') || '';
                        const cellText = durumCell.textContent?.trim() || '';

                        if (imgSrc.includes('ok.gif') || cellText.includes('Onaylandı')) {
                            tahakkukDurumu = 'onaylandi';
                        } else if (imgSrc.includes('err.gif') || cellText.includes('Hatalı')) {
                            tahakkukDurumu = 'hatali';
                        } else if (imgSrc.includes('iptal.gif') || cellText.includes('İptal')) {
                            tahakkukDurumu = 'iptal';
                        } else if (imgSrc.includes('wtng.gif') || cellText.includes('Onay bekliyor')) {
                            tahakkukDurumu = 'onay_bekliyor';
                        }
                    }

                    const rowData = {
                        beyannameTuru: cells[1]?.textContent?.trim() || "",
                        tcVkn: cells[2]?.textContent?.trim() || "",
                        adSoyadUnvan: (cells[3] as HTMLElement)?.title || cells[3]?.textContent?.trim() || "",
                        vergiDairesi: cells[4]?.textContent?.trim() || "",
                        vergilendirmeDonemi: cells[5]?.textContent?.trim() || "",
                        yuklemeZamani: cells[7]?.textContent?.trim() || "",
                        oid,
                        tahakkukOid,
                        tahakkukDurumu
                    };

                    if (rowData.tcVkn && /\d{10,11}/.test(rowData.tcVkn)) {
                        results.push(rowData);
                    }
                }

                const pageInfo = popup.innerText?.match(/(\d+)\s*-\s*(\d+)\s*\/\s*(\d+)/);
                const total = pageInfo ? parseInt(pageInfo[3]) : results.length;
                const currentEnd = pageInfo ? parseInt(pageInfo[2]) : results.length;
                const currentStart = pageInfo ? parseInt(pageInfo[1]) : 1;

                // Ek kontrol: Sonraki sayfa butonu disabled mı?
                const nextBtn = popup.querySelector('input[type="button"][value=">>"]') as HTMLInputElement;
                const nextBtnDisabled = nextBtn ? nextBtn.disabled : true;

                // hasMore: sayfa bilgisine VEYA buton durumuna göre
                const hasMoreByPageInfo = currentEnd < total;
                const hasMoreByButton = !nextBtnDisabled;

                return {
                    results,
                    hasMore: hasMoreByPageInfo || hasMoreByButton,
                    pageInfo: pageInfo ? { start: currentStart, end: currentEnd, total } : null
                };
            });

            // Sayfa bilgisini logla (debug için)
            if (pageData.pageInfo) {
                log.debug(`📊 Sayfa bilgisi: ${pageData.pageInfo.start}-${pageData.pageInfo.end}/${pageData.pageInfo.total} (hasMore: ${pageData.hasMore})`);
            } else {
                log.warn('Sayfa bilgisi okunamadı!');
            }

            // Zaten okunan satırları atla (tcVkn + donem + tur bazlı - popup recovery için)
            const existingKeys = new Set(allBeyannameler.map(b => `${b.tcVkn}_${b.vergilendirmeDonemi}_${b.beyannameTuru}`));
            const newResults = pageData.results.filter(r =>
                !existingKeys.has(`${r.tcVkn}_${r.vergilendirmeDonemi}_${r.beyannameTuru}`)
            );

            if (newResults.length === 0 && pageData.results.length > 0) {
                log.warn(`⚠️ Tüm ${pageData.results.length} satır zaten okunmuş, sonraki sayfaya geçiliyor...`);
                // Bu durumda sonraki sayfaya geçmeye devam et
            } else {
                allBeyannameler.push(...newResults);
                if (newResults.length < pageData.results.length) {
                    log.debug(`📝 ${pageData.results.length} satırdan ${newResults.length} tanesi yeni (${pageData.results.length - newResults.length} atlandi)`);
                }
            }

            // PDF İndirme
            if (downloadFiles && pageData.results.length > 0) {
                log.debug(`Sayfa ${pageNum}: ${pageData.results.length} beyanname için PDF indiriliyor...`);

                for (let i = 0; i < pageData.results.length; i++) {
                    const item = pageData.results[i];

                    // ════════════════════════════════════════════════════════════════
                    // VERGİ TAHAKKUK DURUMU KONTROLÜ - Sadece "Onaylandı" olanları işle
                    // ════════════════════════════════════════════════════════════════
                    if (item.tahakkukDurumu !== 'onaylandi') {
                        log.skip(`${item.tcVkn} - ${(item.adSoyadUnvan || '').substring(0, 25)} (Durum: ${item.tahakkukDurumu})`);
                        stats.skipped++;
                        continue; // Sonraki satıra geç
                    }

                    const customerStartTime = Date.now(); // Mükellef işlem süresi başlangıcı
                    report(85, `Sayfa ${pageNum} - Satır ${i + 1}/${pageData.results.length}: ${(item.adSoyadUnvan || '').substring(0, 25)}`);

                    // ════════════════════════════════════════════════════════════════
                    // PRE-DOWNLOAD CHECK - Daha önce indirilmiş mükellef + beyanname türü kontrolü
                    // Beyanname türü normalize edilir (API ile aynı format)
                    // GİB'den: "Muhtasar ve Prim Hizmet Beyannamesi" → "MUHTASARVEPRIMH"
                    // ════════════════════════════════════════════════════════════════
                    const normalizedTuru = normalizeBeyannameTuru(item.beyannameTuru || '');
                    const preDownloadKey = `${item.tcVkn}_${normalizedTuru}`;
                    const preCheck = preDownloadedMap.get(preDownloadKey);
                    if (preCheck && preCheck.downloadedTypes.size > 0) {
                        // Tüm beyanname türleri için: BEYANNAME + TAHAKKUK yeterli
                        // SGK dosyaları (SGK_TAHAKKUK, HIZMET_LISTESI) opsiyonel:
                        // - Bazı firmaların SGK tahakkuku olmayabilir (küçük firma, tek çalışan vb.)
                        // - İndirme sırasında 0/0 dönerse dosya kaydedilmiyor
                        const isFullyDownloaded = preCheck.downloadedTypes.has('BEYANNAME') &&
                            preCheck.downloadedTypes.has('TAHAKKUK');

                        if (isFullyDownloaded) {
                            log.skip(`${item.tcVkn} - ${item.beyannameTuru} - ${(item.adSoyadUnvan || '').substring(0, 25)} (daha önce indirilmiş)`);
                            stats.preSkipped++;
                            // Rate limit koruması: PRE-SKIP sonrası bekleme
                            await delay(GIB_CONFIG.DELAYS.PRE_SKIP_WAIT);
                            // Atlanan mükellef için buffer'lar boş kalacak
                            // Sunucu tarafı sadece "verildi" işaretleyecek
                            continue;
                        }
                    }
                    // ════════════════════════════════════════════════════════════════

                    try {
                        // Beyanname PDF
                        if (item.oid) {
                            const fileName = `${item.tcVkn}_BEYANNAME`;
                            const result = await downloadPdfHelper(GIB_CONFIG.SELECTORS.BEYANNAME_ICON, i, fileName);
                            if (result.base64) {
                                item.beyannameBuffer = result.base64;
                                stats.downloaded++;
                            } else {
                                stats.failed++;
                            }
                            // NOT: BETWEEN_DOWNLOADS kaldırıldı - GIB_MIN_WAIT yeterli
                        }

                        // Tahakkuk PDF - GİB 1 saniye kuralı için tek bekleme
                        if (item.tahakkukOid) {
                            // Beyanname varsa araya tek bekleme koy (yoksa direkt tahakkuk indir)
                            if (item.oid) {
                                await delay(GIB_CONFIG.DELAYS.GIB_MIN_WAIT);
                            }
                            const fileName = `${item.tcVkn}_TAHAKKUK`;
                            const result = await downloadPdfHelper(GIB_CONFIG.SELECTORS.TAHAKKUK_ICON, i, fileName);
                            if (result.base64) {
                                item.tahakkukBuffer = result.base64;
                                stats.downloaded++;

                                // KDV1 için tahakkuk parse işlemi
                                if (item.beyannameTuru?.toUpperCase() === 'KDV1') {
                                    try {
                                        const kdvParsed = await parseKdvTahakkuk(result.base64);
                                        if (kdvParsed) {
                                            item.kdvTahakkukParsed = kdvParsed;
                                            log.verbose(`KDV1 Tahakkuk parsed: Matrah=${kdvParsed.kdvMatrah}, TahakkukEden=${kdvParsed.tahakkukEden}, Odenecek=${kdvParsed.odenecek}`);
                                        }
                                    } catch (parseErr) {
                                        log.error(`KDV1 Tahakkuk parse hatasi: ${parseErr}`);
                                    }
                                }

                                // KDV2 için tahakkuk parse işlemi
                                if (item.beyannameTuru?.toUpperCase() === 'KDV2') {
                                    try {
                                        const kdv2Parsed = await parseKdv2Tahakkuk(result.base64);
                                        if (kdv2Parsed) {
                                            item.kdv2TahakkukParsed = kdv2Parsed;
                                            log.verbose(`KDV2 Tahakkuk parsed: Matrah=${kdv2Parsed.kdvMatrah}, TahakkukEden=${kdv2Parsed.tahakkukEden}, Odenecek=${kdv2Parsed.odenecek}`);
                                        }
                                    } catch (parseErr) {
                                        log.error(`KDV2 Tahakkuk parse hatasi: ${parseErr}`);
                                    }
                                }
                            } else {
                                stats.failed++;
                            }
                            // NOT: BETWEEN_DOWNLOADS kaldırıldı

                            // MUHSGK
                            if (item.beyannameTuru?.toUpperCase().includes('MUHSGK') && item.oid) {
                                log.debug('MUHSGK tespit edildi, ek PDF\'ler indiriliyor...');

                                const popupOpened = await page.evaluate((rowIndex: number, detailIconSelector: string, tableRowsSelector: string) => {
                                    const popup = document.querySelector('div[id^="bynList"]') as HTMLElement;
                                    if (!popup) return { success: false };

                                    const rows = popup.querySelectorAll(tableRowsSelector);
                                    if (rowIndex >= rows.length) return { success: false };

                                    const row = rows[rowIndex];
                                    const detailIcon = row.querySelector(detailIconSelector) as HTMLImageElement;
                                    if (!detailIcon) return { success: false };

                                    const onclick = detailIcon.getAttribute('onclick');
                                    if (onclick) {
                                        try { (window as any).eval(onclick); return { success: true }; } catch { return { success: false }; }
                                    } else {
                                        detailIcon.click();
                                        return { success: true };
                                    }
                                }, i, GIB_CONFIG.SELECTORS.MUHSGK_DETAIL_ICON, GIB_CONFIG.SELECTORS.TABLE_ROWS);

                                if (popupOpened.success) {
                                    // MUHSGK popup yüklenmesi için bekleme (1500 → 3000ms)
                                    await delay(GIB_CONFIG.DELAYS.POPUP_OPEN_WAIT);

                                    const popupContent = await page.evaluate((popupSelector: string) => {
                                        const popup = document.querySelector(popupSelector);
                                        if (!popup) return { found: false, sgkTahakkukCount: 0, hizmetCount: 0 };
                                        return {
                                            found: true,
                                            sgkTahakkukCount: popup.querySelectorAll('img[src*="pdf_s.gif"]').length,
                                            hizmetCount: popup.querySelectorAll('img[src*="pdf_h.gif"]').length
                                        };
                                    }, GIB_CONFIG.SELECTORS.MUHSGK_POPUP);

                                    if (popupContent.found) {
                                        // ÇOKLU DOSYA: Array'leri başlat
                                        item.sgkTahakkukBuffers = [];
                                        item.sgkHizmetBuffers = [];

                                        // SGK Tahakkuklar - TÜM DOSYALARI KAYDET
                                        for (let sgkIdx = 0; sgkIdx < popupContent.sgkTahakkukCount; sgkIdx++) {
                                            // GİB kuralı: SGK istekleri arası minimum bekleme (ilk istek hariç)
                                            if (sgkIdx > 0) {
                                                await delay(GIB_CONFIG.DELAYS.GIB_MIN_WAIT);
                                            }
                                            const sgkResult = await downloadMuhsgkPdfHelper(GIB_CONFIG.SELECTORS.SGK_TAHAKKUK_ICON, `SGK_TAHAKKUK_${sgkIdx + 1}`, sgkIdx);
                                            if (sgkResult.base64) {
                                                // Parse işlemi
                                                let parsed: TahakkukFisiParsed | undefined;
                                                try {
                                                    const parseResult = await parseTahakkukFisi(sgkResult.base64);
                                                    parsed = parseResult || undefined;
                                                    if (parsed) {
                                                        log.verbose(`SGK Tahakkuk ${sgkIdx + 1} parsed: Isci=${parsed.isciSayisi}, Gun=${parsed.gunSayisi}, Tutar=${parsed.netTutar}`);
                                                    }
                                                } catch (parseErr) {
                                                    log.error(`SGK Tahakkuk ${sgkIdx + 1} parse hatasi: ${parseErr}`);
                                                }

                                                // TÜM dosyaları array'e ekle
                                                item.sgkTahakkukBuffers!.push({
                                                    buffer: sgkResult.base64,
                                                    index: sgkIdx + 1,
                                                    parsed
                                                });

                                                // Geriye uyumluluk: İlk dosyayı tekil alanlara da kaydet
                                                if (sgkIdx === 0) {
                                                    item.sgkTahakkukBuffer = sgkResult.base64;
                                                    item.sgkTahakkukParsed = parsed;
                                                }

                                                stats.downloaded++;
                                            }
                                        }

                                        log.success(`SGK Tahakkuk: ${item.sgkTahakkukBuffers!.length}/${popupContent.sgkTahakkukCount} dosya indirildi`);

                                        // SGK Tahakkuk TOPLAM hesaplama
                                        if (item.sgkTahakkukBuffers && item.sgkTahakkukBuffers.length > 0) {
                                            let totalIsci = 0;
                                            let totalTutar = 0;
                                            let ilkGun = 0;

                                            for (const f of item.sgkTahakkukBuffers) {
                                                if (f.parsed) {
                                                    totalIsci += f.parsed.isciSayisi || 0;
                                                    totalTutar += f.parsed.netTutar || 0;
                                                    if (ilkGun === 0) ilkGun = f.parsed.gunSayisi || 0;
                                                }
                                            }

                                            item.sgkTahakkukToplam = {
                                                isciSayisi: totalIsci,
                                                netTutar: totalTutar,
                                                gunSayisi: ilkGun,
                                                dosyaSayisi: item.sgkTahakkukBuffers.length
                                            };

                                            if (item.sgkTahakkukBuffers.length > 1) {
                                                log.success(`SGK TOPLAM: ${totalIsci} işçi, ${totalTutar.toLocaleString('tr-TR')} TL (${item.sgkTahakkukBuffers.length} dosya)`);
                                            }
                                        }

                                        // Hizmet Listeleri - SGK ve Hizmet arası tek bekleme
                                        if (popupContent.hizmetCount > 0 && popupContent.sgkTahakkukCount > 0) {
                                            await delay(GIB_CONFIG.DELAYS.GIB_MIN_WAIT); // SGK → Hizmet arası
                                        }

                                        // Hizmet Listeleri - TÜM DOSYALARI KAYDET
                                        for (let hizmetIdx = 0; hizmetIdx < popupContent.hizmetCount; hizmetIdx++) {
                                            // GİB kuralı: Hizmet istekleri arası (ilk istek SGK→Hizmet geçişinde zaten beklendi)
                                            if (hizmetIdx > 0) {
                                                await delay(GIB_CONFIG.DELAYS.GIB_MIN_WAIT);
                                            }
                                            const hizmetResult = await downloadMuhsgkPdfHelper(GIB_CONFIG.SELECTORS.SGK_HIZMET_ICON, `HIZMET_LISTESI_${hizmetIdx + 1}`, hizmetIdx);
                                            if (hizmetResult.base64) {
                                                // Parse işlemi
                                                let parsed: HizmetListesiParsed | undefined;
                                                try {
                                                    const parseResult = await parseHizmetListesi(hizmetResult.base64);
                                                    parsed = parseResult || undefined;
                                                    if (parsed) {
                                                        log.verbose(`Hizmet Listesi ${hizmetIdx + 1} parsed: Isci=${parsed.isciSayisi}, Onay=${parsed.onayTarihi}`);
                                                    }
                                                } catch (parseErr) {
                                                    log.error(`Hizmet Listesi ${hizmetIdx + 1} parse hatasi: ${parseErr}`);
                                                }

                                                // TÜM dosyaları array'e ekle
                                                item.sgkHizmetBuffers!.push({
                                                    buffer: hizmetResult.base64,
                                                    index: hizmetIdx + 1,
                                                    parsed
                                                });

                                                // Geriye uyumluluk: İlk dosyayı tekil alanlara da kaydet
                                                if (hizmetIdx === 0) {
                                                    item.sgkHizmetBuffer = hizmetResult.base64;
                                                    item.sgkHizmetParsed = parsed;
                                                }

                                                stats.downloaded++;
                                            }
                                        }

                                        log.success(`Hizmet Listesi: ${item.sgkHizmetBuffers!.length}/${popupContent.hizmetCount} dosya indirildi`);

                                        // Hizmet Listesi TOPLAM hesaplama
                                        if (item.sgkHizmetBuffers && item.sgkHizmetBuffers.length > 0) {
                                            let totalIsci = 0;

                                            for (const f of item.sgkHizmetBuffers) {
                                                if (f.parsed) {
                                                    totalIsci += f.parsed.isciSayisi || 0;
                                                }
                                            }

                                            item.sgkHizmetToplam = {
                                                isciSayisi: totalIsci,
                                                dosyaSayisi: item.sgkHizmetBuffers.length
                                            };

                                            if (item.sgkHizmetBuffers.length > 1) {
                                                log.success(`HİZMET TOPLAM: ${totalIsci} işçi (${item.sgkHizmetBuffers.length} dosya)`);
                                            }
                                        }

                                        // Popup kapat
                                        await page.evaluate((closeSelector: string) => {
                                            const closeBtn = document.querySelector(closeSelector);
                                            if (closeBtn) (closeBtn as HTMLElement).click();
                                        }, GIB_CONFIG.SELECTORS.MUHSGK_POPUP_CLOSE);

                                        await delay(GIB_CONFIG.DELAYS.POPUP_CLOSE_WAIT);
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        log.error(`İndirme hatası (${item.tcVkn}): ${e}`);
                    }

                    // Mükellef işlem süresi hesapla ve logla
                    const customerDuration = (Date.now() - customerStartTime) / 1000;
                    if (customerDuration > 0.5) { // Sadece 0.5s üstü süreleri göster (PRE-SKIP hariç)
                        log.customerTime(item.tcVkn, (item.adSoyadUnvan || '').substring(0, 25), customerDuration);
                    }
                }

                // Batch sonuçlarını gönder
                log.success(`Sayfa ${pageNum} sonuçları sunucuya gönderiliyor...`);
                onProgress('batch-results', {
                    message: `Sayfa ${pageNum} kaydediliyor`,
                    beyannameler: pageData.results,
                    stats,
                    startDate,
                    tenantId: options.tenantId
                });
            }

            // Sonraki sayfa
            if (pageData.hasMore) {
                // KRITIK: Batch sonuçları sunucuya gönderildikten SONRA sayfa değiştir
                // WebSocket mesajının işlenmesi ve GİB rate limit koruması için bekleme
                log.debug(`Sayfa ${pageNum} tamamlandı, sunucu işlemi bekleniyor...`);
                await delay(GIB_CONFIG.DELAYS.BATCH_PROCESS_WAIT); // Batch işlem bekleme

                log.debug(`Sonraki sayfaya geçiliyor...`);

                const firstRowIdBefore = await page.evaluate(() => {
                    const popup = document.querySelector('div[id^="bynList"]') as HTMLElement;
                    if (!popup) return null;
                    const firstRow = popup.querySelector('tr[id^="row"]');
                    return firstRow?.id || null;
                });

                const nextClicked = await page.evaluate((nextBtnSelector: string) => {
                    const popup = document.querySelector('div[id^="bynList"]') as HTMLElement;
                    if (!popup) return false;

                    const nextBtn = popup.querySelector(nextBtnSelector) as HTMLInputElement;
                    if (nextBtn && !nextBtn.disabled) {
                        nextBtn.click();
                        return true;
                    }

                    const buttons = popup.querySelectorAll('input[type="button"]');
                    for (const btn of Array.from(buttons)) {
                        if ((btn as HTMLInputElement).value === ">>" && !(btn as HTMLInputElement).disabled) {
                            (btn as HTMLInputElement).click();
                            return true;
                        }
                    }
                    return false;
                }, GIB_CONFIG.SELECTORS.NEXT_PAGE_BUTTON);

                if (nextClicked) {
                    // Tablo değişimini bekle - GÜÇLENDIRILMIŞ: rows.length kontrolü eklendi
                    try {
                        await page.waitForFunction((prevFirstRowId: string | null) => {
                            const popup = document.querySelector('div[id^="bynList"]') as HTMLElement;
                            if (!popup) return false;

                            // KRITIK: Satırların yüklenmesini kontrol et
                            const rows = popup.querySelectorAll('tr[id^="row"]');
                            if (!rows || rows.length === 0) return false; // Henüz satır yok, beklemeye devam

                            const firstRow = rows[0];
                            const currentFirstRowId = firstRow?.id || null;

                            // prevId null ise: en az 1 satır olmalı
                            if (!prevFirstRowId) return rows.length > 0 && !!currentFirstRowId;

                            // ID değişti VE satırlar yüklendi
                            return currentFirstRowId !== prevFirstRowId && rows.length > 0;
                        }, { timeout: 30000 }, firstRowIdBefore); // 30sn timeout - GİB bazen yavaş olabiliyor
                    } catch (e) {
                        // ════════════════════════════════════════════════════════════════
                        // SAYFA GEÇİŞ TIMEOUT - GİB HATASI OLMUŞ OLABİLİR, RETRY YAP
                        // ════════════════════════════════════════════════════════════════
                        log.warn('⚠️ Sayfa geçişi timeout! GİB sistem hatası olabilir, retry yapılıyor...');
                        await delay(GIB_CONFIG.DELAYS.GIB_ERROR_RETRY_WAIT); // 5 saniye bekle

                        // Sorguyu yeniden çalıştır
                        await page.evaluate(() => {
                            if (typeof (window as any).taxReturnSearchFormPost === "function") {
                                (window as any).taxReturnSearchFormPost();
                            }
                        });

                        try {
                            await page.waitForSelector(GIB_CONFIG.SELECTORS.BEYANNAME_LIST, { timeout: 15000 });
                            await delay(2000);
                            log.success('GİB sorgusu yeniden çalıştırıldı');

                            // Hedef sayfaya git (pageNum + 1)
                            const targetPage = pageNum + 1;
                            log.debug(`📄 Sayfa ${targetPage}'e navigasyon başlıyor...`);

                            let navigationSuccess = true;
                            for (let navPage = 1; navPage < targetPage; navPage++) {
                                const prevFirstRowId = await page.evaluate(() => {
                                    const popup = document.querySelector('div[id^="bynList"]') as HTMLElement;
                                    if (!popup) return null;
                                    const firstRow = popup.querySelector('tr[id^="row"]');
                                    return firstRow?.id || null;
                                });

                                const navigated = await page.evaluate((nextBtnSelector: string) => {
                                    const popup = document.querySelector('div[id^="bynList"]') as HTMLElement;
                                    if (!popup) return false;

                                    const nextBtn = popup.querySelector(nextBtnSelector) as HTMLInputElement;
                                    if (nextBtn && !nextBtn.disabled) {
                                        nextBtn.click();
                                        return true;
                                    }

                                    const buttons = popup.querySelectorAll('input[type="button"]');
                                    for (const btn of Array.from(buttons)) {
                                        if ((btn as HTMLInputElement).value === ">>" && !(btn as HTMLInputElement).disabled) {
                                            (btn as HTMLInputElement).click();
                                            return true;
                                        }
                                    }
                                    return false;
                                }, GIB_CONFIG.SELECTORS.NEXT_PAGE_BUTTON);

                                if (navigated) {
                                    try {
                                        await page.waitForFunction((prevId: string | null) => {
                                            const popup = document.querySelector('div[id^="bynList"]') as HTMLElement;
                                            if (!popup) return false;
                                            const rows = popup.querySelectorAll('tr[id^="row"]');
                                            if (!rows || rows.length === 0) return false;
                                            const firstRow = rows[0];
                                            const currentId = firstRow?.id || null;
                                            if (!prevId) return rows.length > 0 && !!currentId;
                                            return currentId !== prevId && rows.length > 0;
                                        }, { timeout: 15000 }, prevFirstRowId);

                                        await delay(GIB_CONFIG.DELAYS.RECOVERY_NAVIGATION_WAIT);
                                        log.debug(`➡️ Sayfa ${navPage + 1}'e geçildi (recovery)`);
                                    } catch (navError) {
                                        log.error(`❌ Sayfa ${navPage + 1} navigasyon hatası!`);
                                        navigationSuccess = false;
                                        break;
                                    }
                                } else {
                                    log.error(`❌ Sayfa ${navPage + 1} buton tıklanamadı!`);
                                    navigationSuccess = false;
                                    break;
                                }
                            }

                            if (navigationSuccess) {
                                await delay(GIB_CONFIG.DELAYS.PAGE_STABILIZATION);
                                log.success(`✅ Recovery sonrası Sayfa ${targetPage}'e ulaşıldı`);
                                pageNum = targetPage;
                                stats.pages = pageNum;
                                continue; // Bu sayfayı işle
                            } else {
                                log.error('❌ Recovery navigasyonu başarısız, durduruluyor...');
                                hasMorePages = false;
                                break;
                            }
                        } catch (retryError) {
                            log.error('❌ GİB sorgusu yeniden çalıştırılamadı!');
                            hasMorePages = false;
                            break;
                        }
                    }

                    // KRITIK: Stabilizasyon delay - log'dan ÖNCE
                    await delay(GIB_CONFIG.DELAYS.PAGE_STABILIZATION);
                    log.success(`Sayfa ${pageNum + 1} yüklendi (stabilize)`);
                    pageNum++;
                    stats.pages = pageNum;

                    // Popup hala açık mı kontrol et - RETRY MEKANİZMASI
                    let popupExists = false;
                    const maxRetries = 3;

                    for (let retry = 0; retry < maxRetries; retry++) {
                        popupExists = await page.evaluate(() => {
                            const popup = document.querySelector('div[id^="bynList"]');
                            const rows = popup?.querySelectorAll('tr[id^="row"]');
                            return popup !== null && rows && rows.length > 0;
                        }) ?? false;

                        if (popupExists) {
                            if (retry > 0) {
                                log.debug(`Popup kontrolü ${retry + 1}. denemede başarılı`);
                            }
                            break;
                        }

                        if (retry < maxRetries - 1) {
                            log.debug(`Popup kontrolü ${retry + 1}/${maxRetries} başarısız, tekrar deneniyor...`);
                            await delay(GIB_CONFIG.DELAYS.POPUP_CHECK_RETRY_WAIT);
                        }
                    }

                    if (!popupExists) {
                        log.warn('Popup kapanmış, sorgu tekrar çalıştırılıyor...');

                        // 1. Arama formunu aç
                        await page.evaluate(() => {
                            if (typeof (window as any).beyannameAraFormu === "function") {
                                (window as any).beyannameAraFormu();
                            }
                        });
                        await delay(GIB_CONFIG.DELAYS.PAGE_CHANGE);

                        // 2. Arama formunun yüklenmesini bekle
                        try {
                            await page.waitForSelector(GIB_CONFIG.SELECTORS.SEARCH_FORM, { timeout: 10000 });
                            await delay(500);
                        } catch (e) {
                            log.error('Arama formu açılamadı!');
                            hasMorePages = false;
                            break;
                        }

                        // 3. Tarih ve durum filtrelerini tekrar ayarla
                        log.debug('Tarih ve durum filtreleri ayarlanıyor...');
                        await page.evaluate((startFormatted: string, endFormatted: string) => {
                            const setInputValue = (input: HTMLInputElement | null, value: string) => {
                                if (!input) return false;
                                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                                    window.HTMLInputElement.prototype, "value"
                                )?.set;
                                nativeInputValueSetter?.call(input, value);
                                input.dispatchEvent(new Event("input", { bubbles: true }));
                                input.dispatchEvent(new Event("change", { bubbles: true }));
                                return true;
                            };

                            const baslangicInput = document.getElementById("baslangicTarihi") as HTMLInputElement;
                            const bitisInput = document.getElementById("bitisTarihi") as HTMLInputElement;

                            if (baslangicInput) setInputValue(baslangicInput, startFormatted);
                            if (bitisInput) setInputValue(bitisInput, endFormatted);

                            // Durum filtresi
                            const durumCheckbox = document.getElementById("sorguTipiD") as HTMLInputElement;
                            if (durumCheckbox && !durumCheckbox.checked) {
                                durumCheckbox.checked = true;
                                durumCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
                            }

                            const onaylandiRadio = document.querySelector('input[type="radio"][name="durum"][value="2"]') as HTMLInputElement;
                            if (onaylandiRadio) {
                                onaylandiRadio.checked = true;
                                onaylandiRadio.dispatchEvent(new Event("change", { bubbles: true }));
                            }
                        }, startDateInfo.formatted, endDateInfo.formatted);

                        await delay(300);

                        // 4. Sorguyu çalıştır
                        log.debug('Sorgu tekrar çalıştırılıyor...');
                        await page.evaluate(() => {
                            if (typeof (window as any).taxReturnSearchFormPost === "function") {
                                (window as any).taxReturnSearchFormPost();
                            }
                        });

                        // 5. Beyanname listesinin yüklenmesini bekle
                        try {
                            await page.waitForSelector(GIB_CONFIG.SELECTORS.BEYANNAME_LIST, { timeout: 15000 });
                            await delay(1500); // Tablo verilerinin yüklenmesi için ek bekleme
                            log.success('Beyanname listesi tekrar yüklendi');
                        } catch (e) {
                            log.error('Beyanname listesi yüklenemedi!');
                            hasMorePages = false;
                            break;
                        }

                        // Popup tekrar açıldı, şimdi doğru sayfaya git
                        if (pageNum > 1) {
                            log.debug(`📄 Sayfa ${pageNum}'e geri dönülüyor...`);
                            let navigationSuccess = true;

                            for (let navPage = 1; navPage < pageNum; navPage++) {
                                // Navigasyon öncesi mevcut ilk satır ID'sini al
                                const prevFirstRowId = await page.evaluate(() => {
                                    const popup = document.querySelector('div[id^="bynList"]') as HTMLElement;
                                    if (!popup) return null;
                                    const firstRow = popup.querySelector('tr[id^="row"]');
                                    return firstRow?.id || null;
                                });

                                const navigated = await page.evaluate((nextBtnSelector: string) => {
                                    const popup = document.querySelector('div[id^="bynList"]') as HTMLElement;
                                    if (!popup) return false;

                                    // Selector ile ara
                                    const nextBtn = popup.querySelector(nextBtnSelector) as HTMLInputElement;
                                    if (nextBtn && !nextBtn.disabled) {
                                        nextBtn.click();
                                        return true;
                                    }

                                    // Fallback: >> butonunu ara
                                    const buttons = popup.querySelectorAll('input[type="button"]');
                                    for (const btn of Array.from(buttons)) {
                                        if ((btn as HTMLInputElement).value === ">>" && !(btn as HTMLInputElement).disabled) {
                                            (btn as HTMLInputElement).click();
                                            return true;
                                        }
                                    }
                                    return false;
                                }, GIB_CONFIG.SELECTORS.NEXT_PAGE_BUTTON);

                                if (navigated) {
                                    // KRITIK: Tablo değişimini bekle - GÜÇLENDIRILMIŞ: rows.length kontrolü
                                    try {
                                        await page.waitForFunction((prevId: string | null) => {
                                            const popup = document.querySelector('div[id^="bynList"]') as HTMLElement;
                                            if (!popup) return false;

                                            // KRITIK: Satırların yüklenmesini kontrol et
                                            const rows = popup.querySelectorAll('tr[id^="row"]');
                                            if (!rows || rows.length === 0) return false;

                                            const firstRow = rows[0];
                                            const currentId = firstRow?.id || null;

                                            if (!prevId) return rows.length > 0 && !!currentId;
                                            return currentId !== prevId && rows.length > 0;
                                        }, { timeout: 15000 }, prevFirstRowId);

                                        // Stabilizasyon bekle
                                        await delay(GIB_CONFIG.DELAYS.RECOVERY_NAVIGATION_WAIT);
                                        log.debug(`➡️ Sayfa ${navPage + 1}'e geçildi (tablo stabilize)`);
                                    } catch (e) {
                                        log.error(`❌ Sayfa ${navPage + 1} tablo değişimi zaman aşımı!`);
                                        navigationSuccess = false;
                                        break;
                                    }
                                } else {
                                    log.error(`❌ Sayfa ${navPage + 1}'e geçilemedi, buton tıklanamadı!`);
                                    navigationSuccess = false;
                                    break;
                                }
                            }

                            if (navigationSuccess) {
                                await delay(500); // Son stabilizasyon
                                log.success(`✅ Sayfa ${pageNum}'e geri dönüldü`);
                            } else {
                                log.error(`❌ Sayfa ${pageNum}'e geri dönülemedi, mevcut verilerle devam ediliyor...`);
                                // Navigation failed - döngüyü durdur yoksa aynı veriler tekrar okunur
                                hasMorePages = false;
                                break;
                            }
                        }
                    }
                } else {
                    log.debug('Sonraki sayfa butonu bulunamadı');
                    hasMorePages = false;
                }
            } else {
                log.debug('Daha fazla sayfa yok');
                hasMorePages = false;
            }
        }

        report(95, `Toplam ${allBeyannameler.length} beyanname işlendi`);

        await browser.close();

        const duration = Math.round((Date.now() - startTime) / 1000);
        report(100, `İşlem tamamlandı (${duration} saniye)`);

        stats.total = allBeyannameler.length;
        stats.duration = duration;

        onProgress('complete', {
            message: 'İşlem tamamlandı',
            success: true,
            stats,
            beyannameler: allBeyannameler,
            unmatchedBeyannameler: [],
            processedFiles: []
        });

    } catch (error: any) {
        const gibError = createGibError(error.message, error);

        // Hata kodu ve mesajı logla
        log.error(`${gibError.isCritical ? '🚨 CRITICAL' : '❌'} ERROR: [${gibError.code}] ${gibError.message}`);
        log.error(`Original: ${gibError.originalError}`);
        if (gibError.userAction) {
            log.debug(`💡 ${gibError.userAction}`);
        }

        if (browser) {
            try {
                await browser.close();
                log.debug('🔒 Tarayıcı güvenli şekilde kapatıldı');
            } catch (closeErr: any) {
                log.warn(`Tarayıcı kapatılamadı: ${closeErr.message}`);
            }
        }

        // Hata kodunu ve detayları gönder
        onProgress('error', {
            message: gibError.message,
            errorCode: gibError.code,
            errorDetails: gibError,
            isCritical: gibError.isCritical
        });
    }
}
