/**
 * KDV9015 (KDV Tevkifat) Kontrol Module Types
 */

// KDV9015 Kontrol durumlari
export type Kdv9015Status = "bekliyor" | "verildi" | "eksik" | "verilmeyecek";

// API'den gelen KDV9015 Kontrol verisi
export interface Kdv9015KontrolData {
  customerId: string;
  unvan: string;
  siraNo: string | null;
  vknTckn: string;
  sirketTipi: string;
  year: number;
  month: number;
  // KDV9015 kontrol bilgileri
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
  status: Kdv9015Status;
  notes: string | null;
  // Dosya sayilari
  tahakkukFileCount: number;
  beyannameFileCount: number;
}

// KDV9015 Tahakkuk PDF parse sonucu
export interface Kdv9015TahakkukParsed {
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
export interface Kdv9015ParseResult {
  success: boolean;
  parsed: boolean;
  data?: Kdv9015TahakkukParsed;
  documentsFound: number;
  error?: string;
}

// Toplu parse sonucu
export interface Kdv9015ParseAllResult {
  success: boolean;
  message: string;
  processed: number;
  parsed: number;
  errors: string[];
}
