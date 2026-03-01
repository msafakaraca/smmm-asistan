/**
 * KDV2 (Tevkifat) PDF Parser Module
 *
 * KDV2 Tahakkuk Fisi PDF'lerini parse eder.
 * Electron bot tarafinda calisir (Node.js ortami).
 *
 * KDV2 Vergi Kodu: 4017
 * Beyanname Türü: KDV Beyannamesi 2 (Tevkifat)
 *
 * Ornek PDF icerigi:
 * - TAHAKKUK FİŞİ - KATMA DEĞER VERGİSİ TEVKİFATI
 * - VKN: 23297037542
 * - Dönem: 12/2025
 * - Kabul Tarihi: 27/01/2026
 * - KDV Matrah: 74.377,51
 * - Tahakkuk Eden: 7.437,75
 * - Mahsup Edilen: 0,00
 * - Ödenecek: 7.437,75
 * - Damga Vergisi: 791,00
 * - Vade: 25/01/2026
 */

import {
    KdvTahakkukBase,
    KdvParserConfig,
    parseKdvTahakkukBase,
    fallbackKdv2Parser,
} from './parsers/base-kdv-parser';

// Debug mode - set GIB_DEBUG=true for verbose logging
const DEBUG_PARSER = process.env.GIB_DEBUG === 'true';

// ═══════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════

export interface Kdv2TahakkukParsed extends KdvTahakkukBase {}

// ═══════════════════════════════════════════════════════════════════
// KDV2 PARSER KONFIGURASYONU
// ═══════════════════════════════════════════════════════════════════

const KDV2_CONFIG: KdvParserConfig = {
    logPrefix: 'KDV2-PARSER',
    vergiKodu: '4017',
    turEtiketi: 'KDV2?',
    turEtiketiBosluklu: 'KDV2?',

    isTargetTahakkuk: (text: string): boolean => {
        return (
            text.includes('4017') || // KDV2 vergi kodu
            text.includes('KATMA DEĞER VERGİSİ TEVKİFATI') ||
            text.includes('KATMA DEGER VERGISI TEVKIFATI') ||
            text.includes('KDV2') ||
            text.includes('KDV BEYANNAMESİ 2') ||
            text.includes('KDV BEYANNAMESI 2')
        );
    },

    shouldReject: (text: string): boolean => {
        // KDV1 kontrolu - KDV1 (0015) ise reddet
        const isKdv1Tahakkuk =
            text.includes('0015') &&
            !text.includes('4017');

        if (isKdv1Tahakkuk) {
            if (DEBUG_PARSER) console.log('[KDV2-PARSER] KDV1 tahakkuku - KDV2 parser atlaniyor');
            return true;
        }

        // KDV9015 kontrolu - KDV Tevkifat (9015) ise reddet
        const isKdv9015Tahakkuk =
            text.includes('9015') &&
            !text.includes('4017');

        if (isKdv9015Tahakkuk) {
            if (DEBUG_PARSER) console.log('[KDV2-PARSER] KDV9015 (Tevkifat) tahakkuku - KDV2 parser atlaniyor');
            return true;
        }

        return false;
    },

    fallbackParser: (text: string, result: KdvTahakkukBase, logPrefix: string): void => {
        fallbackKdv2Parser(text, result, logPrefix);
    },
};

// ═══════════════════════════════════════════════════════════════════
// MAIN PARSER FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * KDV2 (Tevkifat) Tahakkuk Fisi PDF'ini parse et
 *
 * ONEMLI: Sadece KDV2 (vergi kodu 4017) tahakkukunu parse eder!
 * KDV1, SGK ve diger tahakkuklar reddedilir.
 */
export async function parseKdv2Tahakkuk(base64Data: string): Promise<Kdv2TahakkukParsed | null> {
    return parseKdvTahakkukBase(base64Data, KDV2_CONFIG);
}

// ═══════════════════════════════════════════════════════════════════
// TEST FUNCTION (Development only)
// ═══════════════════════════════════════════════════════════════════

export async function testKdv2Parser() {
    console.log('[KDV2-PARSER] Test mode - Parser hazir');
}
