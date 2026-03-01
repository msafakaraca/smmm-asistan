/**
 * SMS Modülü - TypeScript Types
 */

export interface SMSMessage {
  to: string; // Telefon numarası
  message: string;
}

export interface SMSResponse {
  success: boolean;
  messageId?: string;
  code?: string; // Netgsm yanıt kodu
  timestamp?: string;
  error?: string;
}

export interface BulkSMSResult {
  phone: string;
  result: SMSResponse;
}

// Netgsm yanıt kodları
export const NETGSM_RESPONSE_CODES: Record<string, { success: boolean; message: string }> = {
  '00': { success: true, message: 'Başarılı' },
  '01': { success: true, message: 'Başarılı' },
  '02': { success: true, message: 'Başarılı' },
  '20': { success: false, message: 'Mesaj metninde hata var (Türkçe karakter sorunu olabilir)' },
  '30': { success: false, message: 'Geçersiz kullanıcı kodu, şifre veya api yetkisi yok' },
  '40': { success: false, message: 'Mesaj başlığı sistemde tanımlı değil' },
  '50': { success: false, message: 'Abone hesabı aktif değil' },
  '51': { success: false, message: 'Kredi yetersiz' },
  '60': { success: false, message: 'Gönderilecek numara yok' },
  '70': { success: false, message: 'Hatalı sorgu' },
  '80': { success: false, message: 'Gönderim sınırı aşıldı' },
  '85': { success: false, message: 'Mesaj içeriği 1043 karakteri aşıyor' },
  '100': { success: false, message: 'Sistem hatası' },
};

// SMS provider türleri
export type SMSProvider = 'netgsm';

// SMS ayarları
export interface SMSSettings {
  provider: SMSProvider;
  userCode: string;
  password: string;
  header: string; // Gönderici adı (başlık)
  enabled: boolean;
}
