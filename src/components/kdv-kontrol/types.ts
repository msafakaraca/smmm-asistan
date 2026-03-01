/**
 * KDV Kontrol Module Types
 */

// KDV Kontrol durumları
export type KdvStatus = "bekliyor" | "verildi" | "eksik" | "verilmeyecek";

// API'den gelen KDV Kontrol verisi
export interface KdvKontrolData {
  customerId: string;
  unvan: string;
  siraNo: string | null;
  vknTckn: string;
  sirketTipi: string;
  year: number;
  month: number;
  // KDV kontrol bilgileri
  id: string | null;
  kdvMatrah: number | null;
  tahakkukEden: number | null;
  mahsupEdilen: number | null;
  odenecek: number | null;
  devredenKdv: number | null;
  damgaVergisi: number | null;
  vade: string | null;
  beyanTarihi: string | null;
  tahakkukDocumentId: string | null;
  status: KdvStatus;
  notes: string | null;
  // Dosya sayıları
  tahakkukFileCount: number;
  beyannameFileCount: number;
}

// KDV Tahakkuk PDF parse sonucu
export interface KdvTahakkukParsed {
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
}

// Parse API sonucu
export interface KdvParseResult {
  success: boolean;
  parsed: boolean;
  data?: KdvTahakkukParsed;
  documentsFound: number;
  error?: string;
}

// Toplu parse sonucu
export interface KdvParseAllResult {
  success: boolean;
  message: string;
  processed: number;
  parsed: number;
  errors: string[];
}
