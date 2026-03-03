/**
 * Kontrol Module Types
 *
 * Beyanname takip ve GIB bot entegrasyonu için tip tanımlamaları
 */

// Sync durumları
export type SyncStatus = "idle" | "running" | "success" | "error";

// Beyanname durum tipleri
export type DeclarationStatus =
  | "bos"                    // Boş (henüz işlem yok)
  | "onay_bekliyor"          // Sistem: beyannameAyarlari'nda var, bot henüz sorgulamadı
  | "onaylandi"              // Sistem: GİB bot sorgulayıp doğruladı (+ dosya linkleri)
  | "verildi"                // Kullanıcı: Manuel gönderildi işaretleme
  | "verilmedi"              // Kullanıcı: Gönderilmedi işaretleme
  | "gonderilmeyecek"        // Kalıcı: verilmeyecekBeyannameler'den (kilitli)
  | "dilekce_gonderilecek"   // Sistem: beyannameAyarlari'nda "dilekce" seçilmiş
  | "dilekce_verildi"        // Kullanıcı: Dilekçe verildi işaretleme
  | "muaf"                   // Backward compatibility
  | "3aylik";                // Backward compatibility

// GIB'den gelen beyanname verisi
export interface BeyannameData {
  beyannameTuru: string;
  tcVkn: string;
  adSoyadUnvan: string;
  vergiDairesi: string;
  vergilendirmeDonemi: string;
}

// Müşteri (mükellef) interface
export interface Customer {
  id: string;
  unvan: string;
  sirketTipi: string;
  vknTckn: string;
  siraNo?: string | null;
  sortOrder?: number;
  verilmeyecekBeyannameler?: string[];
}

// Beyanname türü
export interface BeyannameTuru {
  id: string;
  kod: string;
  aciklama: string;
  kisaAd: string | null;
  kategori: string | null;
  aktif: boolean;
  siraNo: number;
}

// Bot bilgisi
export interface BotInfo {
  hasCredentials: boolean;
  hasCaptchaKey: boolean;
  lastSync: string | null;
}

// Dosya bilgisi
export interface FileInfo {
  documentId?: string;
  path?: string;
}

// Beyanname durumu meta verisi
export interface BeyannameStatusMeta {
  beyannameTuru?: string;
  yuklemeZamani?: string;
  unvan?: string;
  donem?: string;
  beyannamePath?: string;
  tahakkukPath?: string;
  sgkTahakkukPath?: string;
  hizmetListesiPath?: string;
  files?: {
    beyanname?: FileInfo;
    tahakkuk?: FileInfo;
    sgkTahakkuk?: FileInfo;
    hizmetListesi?: FileInfo;
  };
}

// Beyanname durumu
export interface BeyannameStatus {
  status: DeclarationStatus;
  meta?: BeyannameStatusMeta;
  files?: {
    beyanname?: FileInfo;
    tahakkuk?: FileInfo;
    sgkTahakkuk?: FileInfo;
    hizmetListesi?: FileInfo;
  };
}

// Müşteri beyanname durumları
export type BeyannameStatuses = Record<string, Record<string, BeyannameStatus>>;

// İstatistikler
export interface KontrolStats {
  firma: number;
  sahis: number;
  basit: number;
  total: number;
}

// Yeni müşteri formu
export interface NewCustomerForm {
  unvan: string;
  vknTckn: string;
  sirketTipi: string;
}
