/**
 * Geçici Vergi PDF Parser Module
 *
 * GGECICI (Gelir Geçici Vergi - 0032 GGV) ve
 * KGECICI (Kurum Geçici Vergi - 0033 KGV) tahakkuk fişlerini parse eder.
 * Electron bot tarafında çalışır (Node.js ortamı).
 *
 * Geçici vergi tahakkuk fişinde 3 vergi satırı bulunur:
 * 1. Ana vergi (0032 GGV veya 0033 KGV): matrah, tahakkuk, mahsup, ödenecek, vade
 * 2. 1047 DVER: damga vergisi 1
 * 3. 1048 5035: damga vergisi 2
 *
 * Dönem formatı çeyreklik: "10/2025-12/2025" (son ay = month)
 */

import {
    base64ToBuffer,
    parseTurkishNumber,
    parseTurkishDate,
    extractVkn,
    isSgkTahakkuk,
    parseBeyanTarihi,
} from './parsers/base-kdv-parser';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParseLib = require('pdf-parse');

// Debug mode
const DEBUG_PARSER = process.env.GIB_DEBUG === 'true';
const LOG_PREFIX = 'GECICI-PARSER';

// ═══════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════

export interface GeciciVergiTahakkukParsed {
    year: number;
    month: number;              // Çeyreğin son ayı (3, 6, 9, 12)
    vergilendirmeDonemi: string; // "10/2025-12/2025" - ham format
    beyanTarihi: string | null;
    vergiTuru: 'GGECICI' | 'KGECICI';  // 0032 → GGECICI, 0033 → KGECICI
    matrah: number;             // 0032/0033 satırı matrah
    tahakkukEden: number;       // 0032/0033 satırı tahakkuk eden
    mahsupEdilen: number;       // 0032/0033 satırı mahsup edilen
    odenecek: number;           // 0032/0033 satırı ödenecek
    damgaVergisi1047: number;   // 1047 DVER tahakkuk eden
    damgaVergisi1048: number;   // 1048 5035 tahakkuk eden
    vade: string | null;
    vknTckn?: string;
}

// ═══════════════════════════════════════════════════════════════════
// HELPER - Çeyreklik dönem parse
// ═══════════════════════════════════════════════════════════════════

/**
 * Geçici vergi dönem formatını parse eder
 * Format: "10/2025-12/2025" veya "01/2025 - 03/2025"
 * Döndürür: { year: son yıl, month: son ay, vergilendirmeDonemi: ham string }
 */
function parseGeciciDonem(text: string): { year: number; month: number; vergilendirmeDonemi: string } | null {
    // Format: MM/YYYY-MM/YYYY veya MM/YYYY - MM/YYYY
    const donemMatch = text.match(/(\d{2})\/(\d{4})\s*[-–]\s*(\d{2})\/(\d{4})/);
    if (donemMatch) {
        const endMonth = parseInt(donemMatch[3], 10);
        const endYear = parseInt(donemMatch[4], 10);
        const vergilendirmeDonemi = `${donemMatch[1]}/${donemMatch[2]}-${donemMatch[3]}/${donemMatch[4]}`;

        return {
            year: endYear,
            month: endMonth,
            vergilendirmeDonemi,
        };
    }

    return null;
}

/**
 * Tablo satırını parse eder (geçici vergi için)
 * Bosluklu: "0032 GGV 1.234,56 1.234,56 1.234,56 1.234,56 28/01/2026"
 * Yapisik:  "00321.234,561.234,561.234,561.234,5628/01/2026GGV"
 */
function parseAnaSatir(
    text: string,
    vergiKodu: string,
    turEtiketi: string
): { matrah: number; tahakkuk: number; mahsup: number; odenecek: number; vade: string | null } | null {
    const sayiPattern = '(\\d{1,3}(?:\\.\\d{3})*,\\d{2})';

    // FORMAT 1: Boşluklu - "0032 GGV MATRAH TAHAKKUK MAHSUP ODENECEK VADE"
    const boslukluPattern = new RegExp(
        vergiKodu + '\\s+' + turEtiketi + '\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+(\\d{2}\\/\\d{2}\\/\\d{4})',
        'i'
    );
    const boslukluMatch = text.match(boslukluPattern);
    if (boslukluMatch) {
        return {
            matrah: parseTurkishNumber(boslukluMatch[1]),
            tahakkuk: parseTurkishNumber(boslukluMatch[2]),
            mahsup: parseTurkishNumber(boslukluMatch[3]),
            odenecek: parseTurkishNumber(boslukluMatch[4]),
            vade: parseTurkishDate(boslukluMatch[5]),
        };
    }

    // FORMAT 2: Yapışık - "0032MATRAHTHKKUKMAHSUPODENECEKVADETÜR"
    const yapisikPattern = new RegExp(
        vergiKodu + sayiPattern + sayiPattern + sayiPattern + sayiPattern + '(\\d{2}\\/\\d{2}\\/\\d{4})' + turEtiketi,
        'i'
    );
    const yapisikMatch = text.match(yapisikPattern);
    if (yapisikMatch) {
        return {
            matrah: parseTurkishNumber(yapisikMatch[1]),
            tahakkuk: parseTurkishNumber(yapisikMatch[2]),
            mahsup: parseTurkishNumber(yapisikMatch[3]),
            odenecek: parseTurkishNumber(yapisikMatch[4]),
            vade: parseTurkishDate(yapisikMatch[5]),
        };
    }

    // FORMAT 3: Eski boşluklu (TÜR sonda) - "0032 MATRAH TAHAKKUK MAHSUP ODENECEK VADE GGV"
    const eskiBoslukluPattern = new RegExp(
        vergiKodu + '\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+(\\d{2}\\/\\d{2}\\/\\d{4})\\s*' + turEtiketi,
        'i'
    );
    const eskiBoslukluMatch = text.match(eskiBoslukluPattern);
    if (eskiBoslukluMatch) {
        return {
            matrah: parseTurkishNumber(eskiBoslukluMatch[1]),
            tahakkuk: parseTurkishNumber(eskiBoslukluMatch[2]),
            mahsup: parseTurkishNumber(eskiBoslukluMatch[3]),
            odenecek: parseTurkishNumber(eskiBoslukluMatch[4]),
            vade: parseTurkishDate(eskiBoslukluMatch[5]),
        };
    }

    return null;
}

/**
 * 1047 DVER satırını parse eder
 * Boşluklu: "1047 DVER MATRAH TAHAKKUK MAHSUP ODENECEK VADE"
 * Yapışık:  "1047MATRAHTHKKUKMAHSUPODENECEKVADETÜR"
 */
function parseDamga1047(text: string): number {
    const sayiPattern = '(\\d{1,3}(?:\\.\\d{3})*,\\d{2})';

    // Boşluklu format
    const boslukluPattern = new RegExp(
        '1047\\s+DVER\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+' + sayiPattern,
        'i'
    );
    const boslukluMatch = text.match(boslukluPattern);
    if (boslukluMatch) {
        return parseTurkishNumber(boslukluMatch[2]); // tahakkuk eden
    }

    // Yapışık format
    const yapisikPattern = new RegExp(
        '1047' + sayiPattern + sayiPattern + sayiPattern + sayiPattern + '(\\d{2}\\/\\d{2}\\/\\d{4})DVER',
        'i'
    );
    const yapisikMatch = text.match(yapisikPattern);
    if (yapisikMatch) {
        return parseTurkishNumber(yapisikMatch[2]);
    }

    // Basit fallback: 1047 ile başlayan satırda ikinci sayı
    const fallback = new RegExp('1047\\s*(?:DVER)?\\s*' + sayiPattern + '\\s*' + sayiPattern, 'i');
    const fallbackMatch = text.match(fallback);
    if (fallbackMatch) {
        return parseTurkishNumber(fallbackMatch[2]);
    }

    return 0;
}

/**
 * 1048 5035 satırını parse eder
 * Boşluklu: "1048 5035 MATRAH TAHAKKUK MAHSUP ODENECEK VADE"
 * Yapışık:  "1048MATRAHTHKKUKMAHSUPODENECEKVADETÜR"
 */
function parseDamga1048(text: string): number {
    const sayiPattern = '(\\d{1,3}(?:\\.\\d{3})*,\\d{2})';

    // Boşluklu format
    const boslukluPattern = new RegExp(
        '1048\\s+5035\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+' + sayiPattern,
        'i'
    );
    const boslukluMatch = text.match(boslukluPattern);
    if (boslukluMatch) {
        return parseTurkishNumber(boslukluMatch[2]); // tahakkuk eden
    }

    // Yapışık format
    const yapisikPattern = new RegExp(
        '1048' + sayiPattern + sayiPattern + sayiPattern + sayiPattern + '(\\d{2}\\/\\d{2}\\/\\d{4})5035',
        'i'
    );
    const yapisikMatch = text.match(yapisikPattern);
    if (yapisikMatch) {
        return parseTurkishNumber(yapisikMatch[2]);
    }

    // Basit fallback
    const fallback = new RegExp('1048\\s*(?:5035)?\\s*' + sayiPattern + '\\s*' + sayiPattern, 'i');
    const fallbackMatch = text.match(fallback);
    if (fallbackMatch) {
        return parseTurkishNumber(fallbackMatch[2]);
    }

    return 0;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PARSER FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Geçici Vergi Tahakkuk Fişi PDF'ini parse et
 *
 * GGECICI (0032 GGV) veya KGECICI (0033 KGV) tahakkuk parse eder.
 * SGK tahakkukları reddedilir.
 */
export async function parseGeciciVergiTahakkuk(base64Data: string): Promise<GeciciVergiTahakkukParsed | null> {
    try {
        const buffer = base64ToBuffer(base64Data);
        const data = await pdfParseLib(buffer);
        const text = data.text;

        if (DEBUG_PARSER) {
            console.log(`[${LOG_PREFIX}] Tahakkuk Fişi PDF parse ediliyor...`);
            console.log(`[${LOG_PREFIX}] Text uzunluğu:`, text.length);
        }

        if (!text || text.length < 50) {
            if (DEBUG_PARSER) console.log(`[${LOG_PREFIX}] PDF text boş veya çok kısa`);
            return null;
        }

        if (DEBUG_PARSER) {
            console.log(`[${LOG_PREFIX}] === METIN ÖRNEĞİ ===`);
            console.log(text.substring(0, 2000));
            console.log(`[${LOG_PREFIX}] === METIN SONU ===`);
        }

        // SGK kontrolü
        if (isSgkTahakkuk(text)) {
            if (DEBUG_PARSER) console.log(`[${LOG_PREFIX}] SGK tahakkuku - parser atlanıyor`);
            return null;
        }

        // Tip tespiti: 0032 → GGECICI, 0033 → KGECICI
        const has0032 = text.includes('0032');
        const has0033 = text.includes('0033');

        let vergiTuru: 'GGECICI' | 'KGECICI';
        let vergiKodu: string;
        let turEtiketi: string;

        if (has0033) {
            vergiTuru = 'KGECICI';
            vergiKodu = '0033';
            turEtiketi = 'KGV';
        } else if (has0032) {
            vergiTuru = 'GGECICI';
            vergiKodu = '0032';
            turEtiketi = 'GGV';
        } else {
            if (DEBUG_PARSER) console.log(`[${LOG_PREFIX}] Ne 0032 ne 0033 bulundu - geçici vergi değil`);
            return null;
        }

        if (DEBUG_PARSER) console.log(`[${LOG_PREFIX}] Vergi türü tespit edildi: ${vergiTuru} (${vergiKodu})`);

        // VKN/TCKN
        const vknTckn = extractVkn(text) || undefined;
        if (DEBUG_PARSER && vknTckn) console.log(`[${LOG_PREFIX}] VKN/TCKN: ${vknTckn}`);

        // Dönem parse (çeyreklik)
        const donem = parseGeciciDonem(text);
        if (!donem) {
            if (DEBUG_PARSER) console.log(`[${LOG_PREFIX}] Dönem bilgisi bulunamadı`);
            return null;
        }
        if (DEBUG_PARSER) console.log(`[${LOG_PREFIX}] Dönem: ${donem.vergilendirmeDonemi} (${donem.year}/${donem.month})`);

        // Beyan tarihi
        const beyanTarihi = parseBeyanTarihi(text);
        if (DEBUG_PARSER && beyanTarihi) console.log(`[${LOG_PREFIX}] Beyan Tarihi: ${beyanTarihi}`);

        // Ana satır parse (0032 GGV veya 0033 KGV)
        const anaSatir = parseAnaSatir(text, vergiKodu, turEtiketi);

        let matrah = 0, tahakkukEden = 0, mahsupEdilen = 0, odenecek = 0;
        let vade: string | null = null;

        if (anaSatir) {
            matrah = anaSatir.matrah;
            tahakkukEden = anaSatir.tahakkuk;
            mahsupEdilen = anaSatir.mahsup;
            odenecek = anaSatir.odenecek;
            vade = anaSatir.vade;

            if (DEBUG_PARSER) {
                console.log(`[${LOG_PREFIX}] Ana satır bulundu:`);
                console.log(`[${LOG_PREFIX}]   Matrah: ${matrah}`);
                console.log(`[${LOG_PREFIX}]   Tahakkuk: ${tahakkukEden}`);
                console.log(`[${LOG_PREFIX}]   Mahsup: ${mahsupEdilen}`);
                console.log(`[${LOG_PREFIX}]   Ödenecek: ${odenecek}`);
                console.log(`[${LOG_PREFIX}]   Vade: ${vade}`);
            }
        } else {
            if (DEBUG_PARSER) console.log(`[${LOG_PREFIX}] Ana satır tablo formatında bulunamadı`);
        }

        // 1047 DVER damga vergisi
        const damgaVergisi1047 = parseDamga1047(text);
        if (DEBUG_PARSER && damgaVergisi1047 > 0) {
            console.log(`[${LOG_PREFIX}] 1047 DVER: ${damgaVergisi1047}`);
        }

        // 1048 5035 damga vergisi
        const damgaVergisi1048 = parseDamga1048(text);
        if (DEBUG_PARSER && damgaVergisi1048 > 0) {
            console.log(`[${LOG_PREFIX}] 1048 5035: ${damgaVergisi1048}`);
        }

        // Vade fallback - son tarih
        if (!vade) {
            const allDates = [...text.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)];
            if (allDates.length >= 2) {
                vade = parseTurkishDate(allDates[allDates.length - 1][1]);
            }
        }

        // Özet log
        console.log(`[${LOG_PREFIX}] ${vergiKodu} ${turEtiketi}: ${donem.year}/${donem.month}, Ödenecek=${odenecek.toLocaleString('tr-TR')} TL, D1047=${damgaVergisi1047.toLocaleString('tr-TR')} TL, D1048=${damgaVergisi1048.toLocaleString('tr-TR')} TL`);

        const result: GeciciVergiTahakkukParsed = {
            year: donem.year,
            month: donem.month,
            vergilendirmeDonemi: donem.vergilendirmeDonemi,
            beyanTarihi,
            vergiTuru,
            matrah,
            tahakkukEden,
            mahsupEdilen,
            odenecek,
            damgaVergisi1047,
            damgaVergisi1048,
            vade,
            vknTckn,
        };

        return result;

    } catch (error) {
        console.error(`[${LOG_PREFIX}] Tahakkuk parse hatası:`, error);
        return null;
    }
}
