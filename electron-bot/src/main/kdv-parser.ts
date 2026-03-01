/**
 * KDV PDF Parser Module
 *
 * KDV1 Tahakkuk Fisi PDF'lerini parse eder.
 * Electron bot tarafinda calisir (Node.js ortami).
 *
 * Ornek PDF icerigi:
 * - TAHAKKUK FİŞİ - KATMA DEĞER VERGİSİ
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

export interface KdvTahakkukParsed extends KdvTahakkukBase {}

// ═══════════════════════════════════════════════════════════════════
// KDV1 PARSER KONFIGURASYONU
// ═══════════════════════════════════════════════════════════════════

const KDV1_CONFIG: KdvParserConfig = {
    logPrefix: 'KDV-PARSER',
    vergiKodu: '0015',
    turEtiketi: 'KDV',
    turEtiketiBosluklu: 'KDV',

    isTargetTahakkuk: (text: string): boolean => {
        return (
            text.includes('KATMA DEĞER VERGİSİ') ||
            text.includes('KATMA DEGER VERGISI') ||
            text.includes('KDV') ||
            text.includes('0015') // Normal KDV vergi kodu
        );
    },

    shouldReject: (text: string): boolean => {
        // KDV9015 (Tevkifat) kontrolu - 9015 varsa ve 0015 yoksa KDV9015'tir, reddet
        const isKdv9015Tahakkuk =
            text.includes('9015') &&
            !text.includes('0015');

        if (isKdv9015Tahakkuk) {
            if (DEBUG_PARSER) console.log('[KDV-PARSER] KDV9015 (Tevkifat) tahakkuku - KDV1 parser atlaniyor');
            return true;
        }

        return false;
    },

    fallbackParser: (text: string, result: KdvTahakkukBase, logPrefix: string): void => {
        fallbackLabelParser(text, result, logPrefix, '0015');
    },
};

// ═══════════════════════════════════════════════════════════════════
// MAIN PARSER FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * KDV1 Tahakkuk Fisi PDF'ini parse et
 *
 * ONEMLI: Sadece KDV tahakkukunu parse eder!
 * SGK tahakkuklari reddedilir.
 */
export async function parseKdvTahakkuk(base64Data: string): Promise<KdvTahakkukParsed | null> {
    return parseKdvTahakkukBase(base64Data, KDV1_CONFIG);
}

// ═══════════════════════════════════════════════════════════════════
// TEST FUNCTION (Development only)
// ═══════════════════════════════════════════════════════════════════

export async function testKdvParser() {
    console.log('[KDV-PARSER] Test mode - Parser hazir');
}
