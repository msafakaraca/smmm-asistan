/**
 * SGK Kontrol Module Types
 */

// SGK Kontrol durumları
export type SgkStatus = "bekliyor" | "gonderildi" | "eksik" | "gonderilmeyecek" | "dilekce_gonderildi";

// API'den gelen SGK Kontrol verisi
export interface SgkKontrolData {
  customerId: string;
  unvan: string;
  siraNo: string | null;
  vknTckn: string;
  sirketTipi: string;
  year: number;
  month: number;
  // SGK kontrol bilgileri
  id: string | null;
  hizmetIsciSayisi: number | null;
  hizmetOnayTarihi: string | null;
  hizmetDocumentId: string | null;
  tahakkukIsciSayisi: number | null;
  tahakkukGunSayisi: number | null;
  tahakkukNetTutar: number | null;
  tahakkukKabulTarihi: string | null;
  tahakkukDocumentId: string | null;
  status: SgkStatus;
  notes: string | null;
  // Dosya sayıları
  beyannameFileCount: number;
  muhsgkTahakkukFileCount: number;
  tahakkukFileCount: number;
  hizmetFileCount: number;
}

// Parse API sonucu
export interface ParseResult {
  success: boolean;
  parsed: boolean;
  hizmetListesi?: {
    year: number;
    month: number;
    onayTarihi: string | null;
    isciSayisi: number;
  };
  tahakkukFisi?: {
    year: number;
    month: number;
    kabulTarihi: string | null;
    isciSayisi: number;
    gunSayisi: number;
    netTutar: number;
  };
  documentsFound: number;
  error?: string;
}

// Toplu parse sonucu
export interface ParseAllResult {
  success: boolean;
  message: string;
  processed: number;
  parsed: number;
  errors: string[];
}
