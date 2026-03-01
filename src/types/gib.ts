/**
 * GIB Bot Type Definitions
 * Electron Bot ile senkronize type tanımları
 */

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
    // MUHSGK Özel Alanlar
    sgkTahakkukBuffer?: string;
    sgkTahakkukPath?: string;
    sgkHizmetBuffer?: string;
    sgkHizmetPath?: string;
};

export type GibErrorCode =
    | 'GIB_SESSION_EXPIRED'
    | 'GIB_FRAME_DETACHED'
    | 'GIB_TARGET_CLOSED'
    | 'GIB_AUTH_FAILED'
    | 'GIB_CAPTCHA_FAILED'
    | 'HTTP_401'
    | 'HTTP_403'
    | 'HTTP_500'
    | 'PDF_INVALID'
    | 'PDF_TIMEOUT'
    | 'CHROMEWEB_ERROR'
    | 'TIMEOUT'
    | 'UNKNOWN';

export interface GibError {
    code: GibErrorCode;
    message: string;
    description?: string;
    isCritical: boolean;
    userAction: string | null;
    originalError?: string;
    timestamp?: string;
}

export type GibBotResult = {
    success: boolean;
    beyannameler: BeyannameData[];
    unmatchedBeyannameler?: BeyannameData[];
    stopped?: boolean;
    startDate?: string;
    endDate?: string;
    error?: string;
    errorCode?: GibErrorCode;
    errorDetails?: GibError;
    stats: {
        total: number;
        pages: number;
        duration: number;
        downloaded: number;
        skipped: number;
        failed: number;
        newCustomers: number;
        preSkipped?: number;
        matched?: number;
        unmatched?: number;
    };
    processedFiles?: {
        customerName: string;
        vkn: string;
        fileName: string;
        status: 'downloaded' | 'skipped' | 'failed' | 'pre-skipped';
        error?: string;
        errorType?: GibErrorCode;
    }[];
};
