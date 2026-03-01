/**
 * Stirling-PDF API Konfigurasyonu
 *
 * Self-hosted PDF islem servisi icin ayarlar.
 * Default: http://localhost:8080
 */

export const STIRLING_CONFIG = {
  // Base URL - environment variable'dan veya default localhost
  BASE_URL: process.env.STIRLING_PDF_URL || 'http://localhost:8080',

  // API Key (opsiyonel - Stirling-PDF authentication aktifse)
  API_KEY: process.env.STIRLING_API_KEY || '',

  // API Endpoint'leri
  ENDPOINTS: {
    // Genel islemler
    MERGE: '/api/v1/general/merge-pdfs',
    SPLIT: '/api/v1/general/split-pages',

    // Misc islemler
    COMPRESS: '/api/v1/misc/compress-pdf',

    // Donusturme islemleri
    FILE_TO_PDF: '/api/v1/convert/file/pdf',      // Word, Excel, PowerPoint -> PDF
    PDF_TO_WORD: '/api/v1/convert/pdf/word',       // PDF -> Word
    PDF_TO_EXCEL: '/api/v1/convert/pdf/xlsx',      // PDF -> Excel (text-based)

    // OCR islemleri
    OCR: '/api/v1/misc/ocr-pdf',

    // Sayfa islemleri
    ROTATE: '/api/v1/general/rotate-pdf',
    EXTRACT_PAGES: '/api/v1/general/split-pdf-by-sections',
  },

  // Timeout ayarlari (ms)
  TIMEOUTS: {
    DEFAULT: 60000,      // 60 saniye - normal islemler
    LARGE_FILE: 120000,  // 2 dakika - buyuk dosyalar
    OCR: 180000,         // 3 dakika - OCR islemleri
  },

  // Dosya boyutu limitleri (bytes)
  FILE_LIMITS: {
    MAX_SIZE: 50 * 1024 * 1024,        // 50 MB - tek dosya
    MAX_TOTAL_SIZE: 100 * 1024 * 1024, // 100 MB - toplam (merge icin)
    MAX_FILES: 20,                      // Merge icin max dosya sayisi
  },

  // Desteklenen dosya turleri
  SUPPORTED_TYPES: {
    // Word -> PDF
    WORD: ['.doc', '.docx', '.odt', '.rtf'],
    // Excel -> PDF
    EXCEL: ['.xls', '.xlsx', '.ods', '.csv'],
    // PowerPoint -> PDF
    POWERPOINT: ['.ppt', '.pptx', '.odp'],
    // Image -> PDF
    IMAGE: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'],
    // PDF isleme
    PDF: ['.pdf'],
  },

  // Sikistirma seviyeleri
  COMPRESSION_LEVELS: {
    LOW: 0,      // Minimum sikistirma, max kalite
    MEDIUM: 1,   // Dengeli
    HIGH: 2,     // Maximum sikistirma, dusuk kalite
  },
} as const;

/**
 * Stirling-PDF'e istek icin header'lari olustur
 */
export function getStirlingHeaders(): HeadersInit {
  const headers: HeadersInit = {};

  if (STIRLING_CONFIG.API_KEY) {
    headers['X-API-KEY'] = STIRLING_CONFIG.API_KEY;
  }

  return headers;
}

/**
 * Dosya uzantisinin desteklenip desteklenmedigini kontrol et
 */
export function isFileTypeSupported(
  filename: string,
  category: keyof typeof STIRLING_CONFIG.SUPPORTED_TYPES
): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  const supportedTypes = STIRLING_CONFIG.SUPPORTED_TYPES[category] as readonly string[];
  return supportedTypes.includes(ext);
}

/**
 * Dosya boyutunu kontrol et
 */
export function validateFileSize(size: number, isMultiple = false): { valid: boolean; error?: string } {
  const limit = isMultiple ? STIRLING_CONFIG.FILE_LIMITS.MAX_TOTAL_SIZE : STIRLING_CONFIG.FILE_LIMITS.MAX_SIZE;

  if (size > limit) {
    const limitMB = limit / (1024 * 1024);
    return {
      valid: false,
      error: `Dosya boyutu limiti asildi. Maximum: ${limitMB}MB`
    };
  }

  return { valid: true };
}
