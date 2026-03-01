/**
 * Geçici Vergi Kontrol Module Types
 */

// Geçici Vergi Kontrol durumları
export type GeciciVergiStatus = "bekliyor" | "verildi" | "eksik" | "verilmeyecek";

// Vergi türü
export type GeciciVergiTuru = "GGECICI" | "KGECICI";

// API'den gelen Geçici Vergi Kontrol verisi
export interface GeciciVergiKontrolData {
  customerId: string;
  unvan: string;
  siraNo: string | null;
  vknTckn: string;
  sirketTipi: string;
  year: number;
  month: number;
  // Geçici vergi kontrol bilgileri
  id: string | null;
  vergilendirmeDonemi: string | null;
  matrah: number | null;
  tahakkukEden: number | null;
  mahsupEdilen: number | null;
  odenecek: number | null;
  damgaVergisi1047: number | null;
  damgaVergisi1048: number | null;
  vade: string | null;
  beyanTarihi: string | null;
  tahakkukDocumentId: string | null;
  status: GeciciVergiStatus;
  notes: string | null;
  // Dosya sayıları
  tahakkukFileCount: number;
  beyannameFileCount: number;
}
