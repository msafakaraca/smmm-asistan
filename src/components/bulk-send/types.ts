// Toplu Gönderim Modülü - TypeScript Types

// Dosya türleri
export type DosyaTipi = 'BEYANNAME' | 'TAHAKKUK' | 'SGK_TAHAKKUK' | 'HIZMET_LISTESI';

// Gönderim durumu
export interface SendStatus {
  mailSent: boolean;
  mailSentAt: string | null;
  mailSentTo: string | null;
  mailError: string | null;

  whatsappSent: boolean;
  whatsappSentAt: string | null;
  whatsappSentTo: string | null;
  whatsappType: 'link' | 'document' | 'text' | 'document_text' | null;
  whatsappError: string | null;

  smsSent: boolean;
  smsSentAt: string | null;
  smsSentTo: string | null;
  smsError: string | null;
}

// Bulk send document (frontend)
export interface BulkSendDocument {
  id: string;
  name: string;
  originalName: string | null;
  path: string | null;
  size: number;
  mimeType: string | null;
  year: number | null;
  month: number | null;
  beyannameTuru: string;
  dosyaTipi: DosyaTipi;

  // Customer info
  customerId: string;
  customerName: string;
  customerKisaltma: string | null;
  customerEmail: string | null;
  customerTelefon1: string | null;
  customerTelefon2: string | null;

  // Send status
  sendStatus: SendStatus | null;

  createdAt: string;
}

// Filter request
export interface BulkSendFilterRequest {
  customerIds?: string[];
  groupIds?: string[];
  beyannameTypes?: string[];
  documentTypes?: DosyaTipi[];
  status?: {
    mailSent?: boolean;
    whatsappSent?: boolean;
    smsSent?: boolean;
  };
  yearStart: number;
  monthStart: number;
  yearEnd: number;
  monthEnd: number;
}

// Mail gönderim request
export interface BulkMailRequest {
  documentIds: string[];
  subject?: string;
  body?: string;
  groupByCustomer: boolean;
}

// WhatsApp gönderim request
export interface BulkWhatsAppRequest {
  documentIds: string[];
  message?: string;
  sendType: 'link' | 'document' | 'text' | 'document_text';
}

// SMS gönderim request
export interface BulkSmsRequest {
  documentIds: string[];
  message?: string;
}

// Download request
export interface BulkDownloadRequest {
  documentIds: string[];
  groupByCustomer: boolean;
}

// Send result
export interface SendResult {
  success: boolean;
  total: number;
  sent: number;
  failed: number;
  errors: Array<{
    documentId: string;
    customerId: string;
    customerName: string;
    error: string;
  }>;
}

// SMS provider types
export type SmsProvider = 'netgsm' | 'iletimerkezi' | 'mutlucell';

// SMS settings
export interface SmsSettings {
  provider: SmsProvider;
  apiKey: string;
  apiSecret?: string;
  sender: string;
  enabled: boolean;
}

// Parsed document info from filename
export interface ParsedDocumentInfo {
  beyannameTuru: string;
  year: number;
  month: number;
  dosyaTipi: DosyaTipi;
}

// Grouped documents by customer
export interface CustomerDocumentGroup {
  customerId: string;
  customerName: string;
  customerKisaltma: string | null;
  customerEmail: string | null;
  customerTelefon1: string | null;
  documents: BulkSendDocument[];
}

// Filter state (frontend)
export interface BulkSendFilterState {
  customerIds: string[];
  groupIds: string[]; // Müşteri grup filtreleri
  beyannameTypes: string[];
  documentTypes: DosyaTipi[];
  mailSentFilter: 'all' | 'sent' | 'not_sent';
  whatsappSentFilter: 'all' | 'sent' | 'not_sent';
  smsSentFilter: 'all' | 'sent' | 'not_sent';
  yearStart: number;
  monthStart: number;
  yearEnd: number;
  monthEnd: number;
  searchTerm: string;
}

// Selection state
export interface SelectionState {
  selectedIds: Set<string>;
  selectAll: boolean;
}

// Stats
export interface BulkSendStats {
  totalDocuments: number;
  totalCustomers: number;
  mailSent: number;
  whatsappSent: number;
  smsSent: number;
  notSent: number;
}

// Table column definition
export interface BulkSendColumn {
  id: string;
  header: string;
  accessor: keyof BulkSendDocument | ((row: BulkSendDocument) => string | number | boolean | null);
  sortable?: boolean;
  width?: number;
}

// Beyanname türleri
export const BEYANNAME_TYPES = [
  { code: 'KDV1', label: 'KDV 1' },
  { code: 'KDV2', label: 'KDV 2' },
  { code: 'MUHSGK', label: 'MUHSGK' },
  { code: 'GGECICI', label: 'Geçici (Gelir)' },
  { code: 'KGECICI', label: 'Geçici (Kurumlar)' },
  { code: 'YILLIKGELIR', label: 'Yıllık Gelir' },
  { code: 'YILLIKKURUMLAR', label: 'Yıllık Kurumlar' },
  { code: 'DAMGA', label: 'Damga' },
  { code: 'BA', label: 'BA' },
  { code: 'BS', label: 'BS' },
  { code: 'KONAKLAMA', label: 'Konaklama' },
  { code: 'TURIZM', label: 'Turizm' },
  { code: 'SORUMLU', label: 'Sorumlu KDV' },
  { code: 'KDV9015', label: 'KDV Tevkifat' },
  { code: 'INDIRIMLI', label: 'İndirimli Oran' },
] as const;

// Dosya türleri
export const DOCUMENT_TYPES: { code: DosyaTipi; label: string }[] = [
  { code: 'BEYANNAME', label: 'Beyanname' },
  { code: 'TAHAKKUK', label: 'Tahakkuk' },
  { code: 'SGK_TAHAKKUK', label: 'SGK Tahakkuk' },
  { code: 'HIZMET_LISTESI', label: 'Hizmet Listesi' },
];

// Default filter state
export function getDefaultFilterState(): BulkSendFilterState {
  const now = new Date();
  let month = now.getMonth();
  let year = now.getFullYear();

  // Muhasebe 1 ay geriden gelir
  if (month === 0) {
    month = 12;
    year = year - 1;
  }

  return {
    customerIds: [],
    groupIds: [],
    beyannameTypes: [],
    documentTypes: [],
    mailSentFilter: 'all',
    whatsappSentFilter: 'all',
    smsSentFilter: 'all',
    yearStart: year,
    monthStart: month,
    yearEnd: year,
    monthEnd: month,
    searchTerm: '',
  };
}

// Parse document filename
export function parseDocumentName(filename: string): ParsedDocumentInfo | null {
  // Pattern: {UNVAN}_{BEYANNAMETÜRÜ}_{DÖNEM}_{TİP}.pdf
  // Örnek: Fazli_Demirturk_KDV1_12-2025-12-2025_BEYANNAME.pdf
  const regex = /_([A-Z0-9]+)_(\d{2})-(\d{4})(?:-\d{2}-\d{4})?_([A-Z_0-9]+)\.pdf$/i;
  const match = filename.match(regex);

  if (match) {
    const [, beyannameTuru, monthStr, yearStr, dosyaTipiStr] = match;

    // Dosya tipini normalize et
    let dosyaTipi: DosyaTipi = 'BEYANNAME';
    const normalizedType = dosyaTipiStr.toUpperCase();

    if (normalizedType.includes('SGK_TAHAKKUK') || normalizedType === 'SGK_TAHAKKUK') {
      dosyaTipi = 'SGK_TAHAKKUK';
    } else if (normalizedType.includes('HIZMET_LISTESI') || normalizedType === 'HIZMET_LISTESI') {
      dosyaTipi = 'HIZMET_LISTESI';
    } else if (normalizedType.includes('TAHAKKUK') || normalizedType === 'TAHAKKUK') {
      dosyaTipi = 'TAHAKKUK';
    } else if (normalizedType.includes('BEYANNAME') || normalizedType === 'BEYANNAME') {
      dosyaTipi = 'BEYANNAME';
    }

    return {
      beyannameTuru: beyannameTuru.toUpperCase(),
      year: parseInt(yearStr, 10),
      month: parseInt(monthStr, 10),
      dosyaTipi,
    };
  }

  return null;
}

// Format phone for WhatsApp
export function formatPhoneForWhatsApp(phone: string): string {
  // Sadece rakamları al
  const digits = phone.replace(/\D/g, '');

  // Türkiye kodu ile başlıyorsa
  if (digits.startsWith('90') && digits.length === 12) {
    return digits;
  }

  // 0 ile başlıyorsa
  if (digits.startsWith('0') && digits.length === 11) {
    return '90' + digits.slice(1);
  }

  // 5 ile başlıyorsa (mobil)
  if (digits.startsWith('5') && digits.length === 10) {
    return '90' + digits;
  }

  // Varsayılan: başına 90 ekle
  return '90' + digits;
}

// Format phone for SMS
export function formatPhoneForSms(phone: string): string {
  // Sadece rakamları al
  const digits = phone.replace(/\D/g, '');

  // 0 ile başlamalı
  if (digits.startsWith('90') && digits.length === 12) {
    return '0' + digits.slice(2);
  }

  if (digits.startsWith('0')) {
    return digits;
  }

  if (digits.startsWith('5') && digits.length === 10) {
    return '0' + digits;
  }

  return '0' + digits;
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Get period label
export function getPeriodLabel(year: number, month: number): string {
  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];
  return `${months[month - 1]} ${year}`;
}
