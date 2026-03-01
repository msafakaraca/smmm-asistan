/**
 * Base KDV Parser Module
 *
 * Tum KDV parser'lari (KDV1, KDV2, KDV9015) icin ortak fonksiyonlar ve tipler.
 * Ortak PDF parse mantigi burada bulunur, her parser sadece kendine ozgu
 * vergi kodu ve tip kontrolu yapar.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParseLib = require('pdf-parse');

// Debug mode - set GIB_DEBUG=true for verbose logging
const DEBUG_BASE_PARSER = process.env.GIB_DEBUG === 'true';

// =====================================================================
// INTERFACES
// =====================================================================

/**
 * Tum KDV parser'larinin ortak sonuc tipi.
 * KdvTahakkukParsed, Kdv2TahakkukParsed ve Kdv9015TahakkukParsed
 * hepsi ayni yapidadir.
 */
export interface KdvTahakkukBase {
    year: number;
    month: number;
    beyanTarihi: string | null;
    kdvMatrah: number;
    tahakkukEden: number;
    mahsupEdilen: number;
    odenecek: number;
    devredenKdv: number;
    damgaVergisi: number;
    vade: string | null;
    vknTckn?: string;
}

/**
 * Her parser'a ozgu konfigürasyon.
 * Vergi kodu, log prefix ve tip tespit kurallari burada tanimlanir.
 */
export interface KdvParserConfig {
    /** Parser ismi, log prefix olarak kullanilir. Ornek: 'KDV-PARSER' */
    logPrefix: string;
    /** Bu parser'in vergi kodu. Ornek: '0015', '4017', '9015' */
    vergiKodu: string;
    /** Tablo satirinda vergi kodundan sonra gelen tur etiketi. Ornek: 'KDV', 'KDV2?' */
    turEtiketi: string;
    /** Bossluklu formatta vergi kodundan sonra gelen tur match. Ornek: 'KDV', 'KDV2?' */
    turEtiketiBosluklu: string;
    /** PDF'in bu parser'a ait olup olmadigini kontrol eden fonksiyon */
    isTargetTahakkuk: (text: string) => boolean;
    /** PDF'in bu parser tarafindan reddedilmesi gereken tipleri kontrol eden fonksiyon */
    shouldReject: (text: string) => boolean;
    /** Tablo satiri bulunamadiginda kullanilacak fallback parser (opsiyonel) */
    fallbackParser?: (text: string, result: KdvTahakkukBase, logPrefix: string) => void;
}

// =====================================================================
// HELPER FUNCTIONS (export edilir, parser'lar da kullanabilir)
// =====================================================================

/**
 * Base64 string'i Buffer'a cevir
 */
export function base64ToBuffer(base64Data: string): Buffer {
    // "data:application/pdf;base64," prefix varsa kaldir
    const cleanBase64 = base64Data.replace(/^data:application\/pdf;base64,/, '');
    return Buffer.from(cleanBase64, 'base64');
}

/**
 * Turk parasini sayiya cevir
 * Ornek: "1.234,56" -> 1234.56
 * Ornek: "12.049.003,11" -> 12049003.11
 */
export function parseTurkishNumber(str: string): number {
    if (!str) return 0;
    // Noktalari kaldir, virgucu noktaya cevir
    const cleaned = str.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

/**
 * Turk tarih formatini ISO formatina cevir
 * "27/01/2026" -> "2026-01-27"
 * "27.01.2026" -> "2026-01-27"
 */
export function parseTurkishDate(str: string): string | null {
    if (!str) return null;

    // DD/MM/YYYY veya DD.MM.YYYY formati
    const match = str.match(/(\d{2})[\/.](\d{2})[\/.](\d{4})/);
    if (!match) return null;

    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
}

/**
 * PDF metninden VKN/TCKN bilgisini cikarir (10-11 haneli)
 * Yapişik format dahil: "VERGİ KİMLİK NUMARASI38935555418"
 */
export function extractVkn(text: string): string | null {
    const vknMatch =
        text.match(/(?:VKN|TCKN|V\.K\.N|T\.C\.K\.N)[:\s]+(\d{10,11})/i) ||
        text.match(/(?:Vergi(?:\s+Kimlik)?(?:\s+Numarası)?|Mükellef(?:\s+No)?)[:\s]+(\d{10,11})/i) ||
        text.match(/VERG[İI]\s*K[İI]ML[İI]K\s*NUMARASI(\d{10,11})/i) || // Yapişik format
        text.match(/NUMARASI(\d{10,11})/i); // Daha kisa yapişik

    return vknMatch ? vknMatch[1] : null;
}

/**
 * PDF metninden donem bilgisini cikarir
 * Format 1: "12/2025-12/2025"
 * Format 2: "Dönem: 12/2025"
 * Format 3: "MM/YYYY" (tabloda)
 */
export function parseDonnem(text: string): { year: number; month: number } | null {
    // Format 1: "12/2025-12/2025" veya "12/2025 - 12/2025"
    const donemMatch1 = text.match(/(\d{2})\/(\d{4})\s*[-–]\s*(\d{2})\/(\d{4})/);
    if (donemMatch1) {
        return {
            month: parseInt(donemMatch1[1], 10),
            year: parseInt(donemMatch1[2], 10)
        };
    }

    // Format 2: "Vergilendirme Dönemi" veya "Dönem: 12/2025"
    const donemMatch2 = text.match(/(?:Vergilendirme\s+D[öo]nemi|D[öo]nem)[:\s]+(\d{1,2})\/(\d{4})/i);
    if (donemMatch2) {
        return {
            month: parseInt(donemMatch2[1], 10),
            year: parseInt(donemMatch2[2], 10)
        };
    }

    // Format 3: Tabloda "MM/YYYY" formati
    const donemMatch3 = text.match(/\b(\d{2})\/(20[2-3]\d)\b/);
    if (donemMatch3) {
        const month = parseInt(donemMatch3[1], 10);
        const year = parseInt(donemMatch3[2], 10);
        if (month >= 1 && month <= 12) {
            return { month, year };
        }
    }

    return null;
}

/**
 * PDF metninden beyan/kabul tarihini cikarir
 */
export function parseBeyanTarihi(text: string): string | null {
    // Oncelikle label'li formati dene
    const kabulMatch =
        text.match(/(?:Kabul\s+Tarihi|Beyan\s+Tarihi|Tahakkuk\s+Tarihi)[:\s]+(\d{2}[\/\.]\d{2}[\/\.]\d{4})/i) ||
        text.match(/(\d{2}[\/\.]\d{2}[\/\.]\d{4})\s*(?:Tahakkuk|Kabul)/i);

    if (kabulMatch) {
        return parseTurkishDate(kabulMatch[1]);
    }

    // "Kabul Tarihi" label'indan sonraki ilk tarihi bul
    const kabulIndex = text.search(/Kabul\s*Tarihi/i);
    if (kabulIndex !== -1) {
        const afterKabul = text.substring(kabulIndex);
        const tarihMatch = afterKabul.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (tarihMatch) {
            return parseTurkishDate(tarihMatch[1]);
        }
    }

    return null;
}

/**
 * PDF metninden damga vergisini parse eder
 * Hem bosluklu hem yapisik formatlari destekler
 */
export function parseDamgaVergisi(text: string): number {
    const sayiPattern = '(\\d{1,3}(?:\\.\\d{3})*,\\d{2})';

    // Bosluklu format: 1048 5035 ile baslar
    // Sira: 1048 5035 MATRAH TAHAKKUK MAHSUP ODENECEK VADE
    const damgaBoslukluPattern = new RegExp(
        '1048\\s+5035\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+(\\d{2}\\/\\d{2}\\/\\d{4})',
        'i'
    );
    const damgaBoslukluMatch = text.match(damgaBoslukluPattern);

    if (damgaBoslukluMatch) {
        // Ikinci tutar (tahakkuk eden) damga vergisi miktari
        return parseTurkishNumber(damgaBoslukluMatch[2]);
    }

    // Yapisik format: 1048 ile baslar, 5035 ile biter
    const damgaYapisikPattern = new RegExp(
        '1048' + sayiPattern + sayiPattern + sayiPattern + sayiPattern + '(\\d{2}\\/\\d{2}\\/\\d{4})5035',
        'i'
    );
    const damgaYapisikMatch = text.match(damgaYapisikPattern);

    if (damgaYapisikMatch) {
        return parseTurkishNumber(damgaYapisikMatch[2]);
    }

    // Alternatif pattern'ler
    const damgaPatterns = [
        new RegExp('1048\\s*5035\\s*' + sayiPattern + '\\s*' + sayiPattern, 'i'),
        new RegExp('1048' + sayiPattern + sayiPattern, 'i'),
        /DAMGA\s+VERG[İI]S[İI]\s*[:\s]*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
        /Damga\s+Vergisi\s*[:\s]*(\d{1,3}(?:\.\d{3})*,\d{2})/i
    ];

    for (const pattern of damgaPatterns) {
        const match = text.match(pattern);
        if (match) {
            let result = parseTurkishNumber(match[1]);
            if (result === 0 && match[2]) {
                result = parseTurkishNumber(match[2]);
            }
            return result;
        }
    }

    return 0;
}

/**
 * PDF metninden vade tarihini cikarir (tablo satirindan alinmamissa)
 */
export function parseVadeTarihi(text: string): string | null {
    const vadeMatch =
        text.match(/Vade(?:\s+Tarihi)?\s*[:\s]+(\d{2}[\/\.]\d{2}[\/\.]\d{4})/i) ||
        text.match(/Son\s+[Öö]deme\s+Tarihi\s*[:\s]+(\d{2}[\/\.]\d{2}[\/\.]\d{4})/i);

    if (vadeMatch) {
        return parseTurkishDate(vadeMatch[1]);
    }

    // Tablodaki son tarih vade olabilir
    const allDates = [...text.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)];
    const dates = allDates.map((m) => m[1]);
    if (dates.length >= 2) {
        const lastDate = dates[dates.length - 1];
        return parseTurkishDate(lastDate);
    }

    return null;
}

/**
 * Tablo satirini parse eder (vergi koduna gore 3 format destekler)
 * FORMAT 1: Bosluklu - "KODU TUR MATRAH TAHAKKUK MAHSUP ODENECEK VADE"
 * FORMAT 2: Yapisik  - "KODUMATRAHTHKKUKMAHSUPODENECEKVADETÜR"
 * FORMAT 3: Eski bosluklu - "KODU MATRAH TAHAKKUK MAHSUP ODENECEK VADE TÜR"
 *
 * @returns Tablo bilgileri bulunduysa doldurulmus nesne, bulunamadiysa null
 */
export function parseTabloSatirlari(
    text: string,
    vergiKodu: string,
    turEtiketiBosluklu: string,
    turEtiketi: string
): { matrah: number; tahakkuk: number; mahsup: number; odenecek: number; vade: string | null } | null {
    const sayiPattern = '(\\d{1,3}(?:\\.\\d{3})*,\\d{2})';

    // FORMAT 1: Bosluklu tablo formati
    // "0015 KDV 648.636,46 64.863,65 10.760,08 54.103,57 28/01/2026"
    const boslukluPattern = new RegExp(
        vergiKodu + '\\s+' + turEtiketiBosluklu + '\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+' + sayiPattern + '\\s+(\\d{2}\\/\\d{2}\\/\\d{4})',
        'i'
    );
    const boslukluMatch = text.match(boslukluPattern);

    if (boslukluMatch) {
        return {
            matrah: parseTurkishNumber(boslukluMatch[1]),
            tahakkuk: parseTurkishNumber(boslukluMatch[2]),
            mahsup: parseTurkishNumber(boslukluMatch[3]),
            odenecek: parseTurkishNumber(boslukluMatch[4]),
            vade: parseTurkishDate(boslukluMatch[5])
        };
    }

    // FORMAT 2: Yapisik tablo formati
    // "0015648.636,4664.863,6510.760,0854.103,5728/01/2026KDV"
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
            vade: parseTurkishDate(yapisikMatch[5])
        };
    }

    // FORMAT 3: Eski bosluklu format (TUR sonda)
    // "0015  648.636,46  64.863,65  10.760,08  54.103,57  28/01/2026  KDV"
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
            vade: parseTurkishDate(eskiBoslukluMatch[5])
        };
    }

    return null;
}

/**
 * KDV1 ve KDV9015 icin label bazli fallback parser
 * Tablo formatlari bulunamadiginda kullanilir
 */
export function fallbackLabelParser(text: string, result: KdvTahakkukBase, logPrefix: string, vergiKodu: string): void {
    if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] Tablo formati bulunamadi, label bazli arama yapiliyor...`);

    // KDV MATRAH
    const kdvMatrahMatch1 = text.match(new RegExp(vergiKodu + '\\s+(?:KDV|KATMA)[^\\d]*([\\d\\.]+,\\d{2})', 'i'));
    if (kdvMatrahMatch1) {
        result.kdvMatrah = parseTurkishNumber(kdvMatrahMatch1[1]);
        if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] KDV Matrah (vergi kodu):`, result.kdvMatrah);
    }

    if (result.kdvMatrah === 0) {
        const kdvMatrahMatch2 = text.match(/KDV\s+Matrah[ıi]?\s*[:\s]*([\d\.]+,\d{2})/i);
        if (kdvMatrahMatch2) {
            result.kdvMatrah = parseTurkishNumber(kdvMatrahMatch2[1]);
            if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] KDV Matrah (label):`, result.kdvMatrah);
        }
    }

    // TAHAKKUK EDEN
    const tahakkukPatterns = [
        /TAHAKKUK\s+EDEN\s*[:\s]*([\d\.]+,\d{2})/i,
        /Tahakkuk\s+Eden\s+Vergi\s*[:\s]*([\d\.]+,\d{2})/i,
        /Toplam\s+Tahakkuk\s*[:\s]*([\d\.]+,\d{2})/i
    ];
    for (const pattern of tahakkukPatterns) {
        const match = text.match(pattern);
        if (match) {
            result.tahakkukEden = parseTurkishNumber(match[1]);
            if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] Tahakkuk Eden:`, result.tahakkukEden);
            break;
        }
    }

    // MAHSUP EDILEN
    const mahsupPatterns = [
        /MAHSUP\s+ED[İI]LEN\s*[:\s]*([\d\.]+,\d{2})/i,
        /Mahsup\s+Edilen\s*[:\s]*([\d\.]+,\d{2})/i
    ];
    for (const pattern of mahsupPatterns) {
        const match = text.match(pattern);
        if (match) {
            result.mahsupEdilen = parseTurkishNumber(match[1]);
            if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] Mahsup Edilen:`, result.mahsupEdilen);
            break;
        }
    }

    // ODENECEK
    const odenecekPatterns = [
        /[ÖO]DENECEK\s+(?:OLAN\s+)?(?:VERG[İI]\s*)?\s*[:\s]*([\d\.]+,\d{2})/i,
        /[Öö]denecek\s+(?:Olan\s+)?(?:Vergi\s*)?\s*[:\s]*([\d\.]+,\d{2})/i
    ];
    for (const pattern of odenecekPatterns) {
        const match = text.match(pattern);
        if (match) {
            result.odenecek = parseTurkishNumber(match[1]);
            if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] Odenecek:`, result.odenecek);
            break;
        }
    }
}

/**
 * KDV2 icin fallback parser - sadece vergi kodu ile matrah arar
 */
export function fallbackKdv2Parser(text: string, result: KdvTahakkukBase, logPrefix: string): void {
    if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] Tablo formati bulunamadi, 4017 bazli arama yapiliyor...`);

    const sayiPattern = '(\\d{1,3}(?:\\.\\d{3})*,\\d{2})';
    const kdv4017Pattern = new RegExp(
        '4017[^\\d]*' + sayiPattern,
        'i'
    );
    const kdv4017Match = text.match(kdv4017Pattern);
    if (kdv4017Match) {
        result.kdvMatrah = parseTurkishNumber(kdv4017Match[1]);
        if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] KDV2 Matrah (vergi kodu 4017):`, result.kdvMatrah);
    }
}

/**
 * SGK tahakkuku olup olmadigini kontrol eder
 */
export function isSgkTahakkuk(text: string): boolean {
    return (
        text.includes('SOSYAL GÜVENLİK KURUMU') ||
        text.includes('SOSYAL GUVENLIK KURUMU') ||
        text.includes('SİGORTA PRİMLERİ') ||
        text.includes('SIGORTA PRIMLERI') ||
        text.includes('5510')
    );
}

// =====================================================================
// MAIN GENERIC PARSER FUNCTION
// =====================================================================

/**
 * Genel KDV Tahakkuk Fisi PDF parse fonksiyonu.
 * Tum KDV parser'lari bu fonksiyonu kullanir, sadece konfigürasyon farkli olur.
 *
 * @param base64Data - PDF verisi (base64 encoded)
 * @param config - Parser konfigürasyonu (vergi kodu, log prefix, vb.)
 * @returns Parse edilmis tahakkuk bilgisi veya null
 */
export async function parseKdvTahakkukBase(
    base64Data: string,
    config: KdvParserConfig
): Promise<KdvTahakkukBase | null> {
    const { logPrefix, vergiKodu, turEtiketi, turEtiketiBosluklu } = config;

    try {
        const buffer = base64ToBuffer(base64Data);
        const data = await pdfParseLib(buffer);
        const text = data.text;

        if (DEBUG_BASE_PARSER) {
            console.log(`[${logPrefix}] Tahakkuk Fisi PDF parse ediliyor...`);
            console.log(`[${logPrefix}] Text uzunlugu:`, text.length);
        }

        if (!text || text.length < 50) {
            if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] PDF text bos veya cok kisa`);
            return null;
        }

        // Debug: Ilk 2000 karakteri logla
        if (DEBUG_BASE_PARSER) {
            console.log(`[${logPrefix}] === TAHAKKUK METIN ORNEGI ===`);
            console.log(text.substring(0, 2000));
            console.log(`[${logPrefix}] === METIN SONU ===`);
        }

        // ================================================================
        // TIP KONTROLU - Bu parser'a ait mi?
        // ================================================================
        if (isSgkTahakkuk(text)) {
            if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] SGK tahakkuku - parser atlaniyor`);
            return null;
        }

        if (config.shouldReject(text)) {
            return null;
        }

        if (!config.isTargetTahakkuk(text)) {
            if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] Hedef tahakkuk degil - atlaniyor`);
            return null;
        }

        if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] Tahakkuk tespit edildi, parse ediliyor...`);

        const result: KdvTahakkukBase = {
            year: 0,
            month: 0,
            beyanTarihi: null,
            kdvMatrah: 0,
            tahakkukEden: 0,
            mahsupEdilen: 0,
            odenecek: 0,
            devredenKdv: 0,
            damgaVergisi: 0,
            vade: null,
        };

        // ================================================================
        // VKN/TCKN
        // ================================================================
        const vkn = extractVkn(text);
        if (vkn) {
            result.vknTckn = vkn;
            if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] VKN/TCKN:`, result.vknTckn);
        }

        // ================================================================
        // DONEM BILGISI
        // ================================================================
        const donem = parseDonnem(text);
        if (donem) {
            result.year = donem.year;
            result.month = donem.month;
            if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] Donem:`, result.year, '/', result.month);
        }

        // ================================================================
        // BEYAN/KABUL TARIHI
        // ================================================================
        const beyanTarihi = parseBeyanTarihi(text);
        if (beyanTarihi) {
            result.beyanTarihi = beyanTarihi;
            if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] Beyan Tarihi:`, result.beyanTarihi);
        }

        // ================================================================
        // TABLO SATIRINI PARSE ET
        // ================================================================
        if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] Tablo satiri araniyor...`);

        const tabloSonuc = parseTabloSatirlari(text, vergiKodu, turEtiketiBosluklu, turEtiketi);

        if (tabloSonuc) {
            result.kdvMatrah = tabloSonuc.matrah;
            result.tahakkukEden = tabloSonuc.tahakkuk;
            result.mahsupEdilen = tabloSonuc.mahsup;
            result.odenecek = tabloSonuc.odenecek;
            result.vade = tabloSonuc.vade;

            if (DEBUG_BASE_PARSER) {
                console.log(`[${logPrefix}] Tablo satiri bulundu:`);
                console.log(`[${logPrefix}]   Matrah:`, result.kdvMatrah);
                console.log(`[${logPrefix}]   Tahakkuk Eden:`, result.tahakkukEden);
                console.log(`[${logPrefix}]   Mahsup Edilen:`, result.mahsupEdilen);
                console.log(`[${logPrefix}]   Odenecek:`, result.odenecek);
                console.log(`[${logPrefix}]   Vade:`, result.vade);
            }
        } else if (config.fallbackParser) {
            // Fallback parser varsa calistir
            config.fallbackParser(text, result, logPrefix);
        }

        // ================================================================
        // DEVREDEN KDV HESAPLA
        // ================================================================
        if (result.mahsupEdilen > result.tahakkukEden) {
            result.devredenKdv = result.mahsupEdilen - result.tahakkukEden;
            if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] Devreden KDV (hesaplandi):`, result.devredenKdv);
        }

        // ================================================================
        // DAMGA VERGISI
        // ================================================================
        result.damgaVergisi = parseDamgaVergisi(text);
        if (DEBUG_BASE_PARSER && result.damgaVergisi > 0) {
            console.log(`[${logPrefix}] Damga Vergisi:`, result.damgaVergisi);
        }

        // ================================================================
        // VADE TARIHI (Tablo satirindan alinmamissa)
        // ================================================================
        if (!result.vade) {
            result.vade = parseVadeTarihi(text);
            if (DEBUG_BASE_PARSER && result.vade) {
                console.log(`[${logPrefix}] Vade (fallback):`, result.vade);
            }
        }

        // Ozet log
        console.log(`[${logPrefix}] ${vergiKodu}: ${result.year}/${result.month}, Odenecek=${result.odenecek.toLocaleString('tr-TR')} TL, Damga=${result.damgaVergisi.toLocaleString('tr-TR')} TL`);

        // Detayli log (sadece debug modunda)
        if (DEBUG_BASE_PARSER) {
            console.log(`[${logPrefix}] ══════════════════════════════════════════`);
            console.log(`[${logPrefix}] TAHAKKUK PARSE SONUCU`);
            console.log(`[${logPrefix}] ══════════════════════════════════════════`);
            console.log(`[${logPrefix}] | VKN/TCKN       | ${result.vknTckn || '-'}`);
            console.log(`[${logPrefix}] | Donem          | ${result.year}/${result.month}`);
            console.log(`[${logPrefix}] | Beyan Tarihi   | ${result.beyanTarihi || '-'}`);
            console.log(`[${logPrefix}] | KDV Matrah     | ${result.kdvMatrah.toLocaleString('tr-TR')} TL`);
            console.log(`[${logPrefix}] | Tahakkuk Eden  | ${result.tahakkukEden.toLocaleString('tr-TR')} TL`);
            console.log(`[${logPrefix}] | Mahsup Edilen  | ${result.mahsupEdilen.toLocaleString('tr-TR')} TL`);
            console.log(`[${logPrefix}] | Odenecek       | ${result.odenecek.toLocaleString('tr-TR')} TL`);
            console.log(`[${logPrefix}] | Devreden KDV   | ${result.devredenKdv.toLocaleString('tr-TR')} TL`);
            console.log(`[${logPrefix}] | Damga Vergisi  | ${result.damgaVergisi.toLocaleString('tr-TR')} TL`);
            console.log(`[${logPrefix}] | Vade           | ${result.vade || '-'}`);
            console.log(`[${logPrefix}] ══════════════════════════════════════════`);
        }

        // En az donem bilgisi olmali
        if (result.year === 0 || result.month === 0) {
            if (DEBUG_BASE_PARSER) console.log(`[${logPrefix}] Donem bilgisi bulunamadi`);
            return null;
        }

        return result;

    } catch (error) {
        console.error(`[${logPrefix}] Tahakkuk parse hatasi:`, error);
        return null;
    }
}
