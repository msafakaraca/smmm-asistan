/**
 * KDV2 (Tevkifat) Kontrol Module Types
 */

// KDV2 Kontrol durumları
export type Kdv2Status = "bekliyor" | "verildi" | "eksik" | "verilmeyecek";

// API'den gelen KDV2 Kontrol verisi
export interface Kdv2KontrolData {
  customerId: string;
  unvan: string;
  siraNo: string | null;
  vknTckn: string;
  sirketTipi: string;
  year: number;
  month: number;
  // KDV2 kontrol bilgileri
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
  status: Kdv2Status;
  notes: string | null;
  // Dosya sayıları
  tahakkukFileCount: number;
  beyannameFileCount: number;
}

// KDV2 Tahakkuk PDF parse sonucu
export interface Kdv2TahakkukParsed {
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
export interface Kdv2ParseResult {
  success: boolean;
  parsed: boolean;
  data?: Kdv2TahakkukParsed;
  documentsFound: number;
  error?: string;
}

// Toplu parse sonucu
export interface Kdv2ParseAllResult {
  success: boolean;
  message: string;
  processed: number;
  parsed: number;
  errors: string[];
}
