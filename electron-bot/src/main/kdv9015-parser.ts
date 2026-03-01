/**
 * KDV9015 (Tevkifat Mükellefiyetsiz) PDF Parser Module
 *
 * KDV Tevkifatı (Vergi Kodu: 9015) Tahakkuk Fişi PDF'lerini parse eder.
 * Electron bot tarafında çalışır (Node.js ortamı).
 *
 * Örnek PDF içeriği:
 * - TAHAKKUK FİŞİ - KATMA DEĞER VERGİSİ TEVKİFAT
 * - VKN: 23297037542
 * - Dönem: 12/2025
 * - Kabul Tarihi: 27/01/2026
 * - KDV Matrah: 12.049.003,11
 * - Tahakkuk Eden: 2.406.392,87
 * - Mahsup Edilen: 2.816.371,08
 * - Ödenecek: 0,00
 * - Damga Vergisi: 791,00
 * - Vade: 28/01/2026
 */

import {
    KdvTahakkukBase,
    KdvParserConfig,
    parseKdvTahakkukBase,
    fallbackLabelParser,
} from './parsers/base-kdv-parser';

// Debug mode - set GIB_DEBUG=true for verbose logging
const DEBUG_PARSER = process.env.GIB_DEBUG === 'true';

// ═══════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════

export interface Kdv9015TahakkukParsed extends KdvTahakkukBase {}

// ═══════════════════════════════════════════════════════════════════
// KDV9015 PARSER KONFIGURASYONU
// ═══════════════════════════════════════════════════════════════════

const KDV9015_CONFIG: KdvParserConfig = {
    logPrefix: 'KDV9015-PARSER',
    vergiKodu: '9015',
    turEtiketi: 'KDV',
    turEtiketiBosluklu: 'KDV',

    isTargetTahakkuk: (text: string): boolean => {
        return (
            text.includes('9015') || // KDV Tevkifati (Mukellefiyetsiz) vergi kodu
            (text.includes('KATMA DEĞER VERGİSİ') && text.includes('TEVKİFAT')) ||
            (text.includes('KATMA DEGER VERGISI') && text.includes('TEVKIFAT')) ||
            text.includes('MÜKELLEFİYETSİZ') ||
            text.includes('MUKELLEFIYETSIZ')
        );
    },

    shouldReject: (text: string): boolean => {
        // KDV1 kontrolu - 0015 vergi kodu varsa ve 9015 yoksa KDV1'dir, reddet
        const isKdv1Only =
            text.includes('0015') &&
            !text.includes('9015');

        if (isKdv1Only) {
            if (DEBUG_PARSER) console.log('[KDV9015-PARSER] KDV1 (0015) tahakkuku - KDV9015 parser atlaniyor');
            return true;
        }

        // KDV2 kontrolu - 4017 vergi kodu
        if (text.includes('4017')) {
            if (DEBUG_PARSER) console.log('[KDV9015-PARSER] KDV2 (4017) tahakkuku - KDV9015 parser atlaniyor');
            return true;
        }

        return false;
    },

    fallbackParser: (text: string, result: KdvTahakkukBase, logPrefix: string): void => {
        fallbackLabelParser(text, result, logPrefix, '9015');
    },
};

// ═══════════════════════════════════════════════════════════════════
// MAIN PARSER FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * KDV9015 (Tevkifat Mükellefiyetsiz) Tahakkuk Fişi PDF'ini parse et
 *
 * ONEMLI: Sadece 9015 (KDV Tevkifatı) tahakkukunu parse eder!
 * 0015 (Normal KDV1), 4017 (KDV2), SGK tahakkuklari reddedilir.
 */
export async function parseKdv9015Tahakkuk(base64Data: string): Promise<Kdv9015TahakkukParsed | null> {
    return parseKdvTahakkukBase(base64Data, KDV9015_CONFIG);
}

// ═══════════════════════════════════════════════════════════════════
// TEST FUNCTION (Development only)
// ═══════════════════════════════════════════════════════════════════

export async function testKdv9015Parser() {
    console.log('[KDV9015-PARSER] Test mode - Parser hazir');
}
