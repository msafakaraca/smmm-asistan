/**
 * Netgsm SMS API Entegrasyonu
 *
 * Bu modül Netgsm API'si ile SMS mesajı gönderimi sağlar.
 * API Docs: https://www.netgsm.com.tr/dokuman/
 */

import { SMSMessage, SMSResponse, BulkSMSResult, NETGSM_RESPONSE_CODES } from './types';

const NETGSM_API_URL = 'https://api.netgsm.com.tr/sms/send/get';

/**
 * Telefon numarasını Netgsm formatına dönüştürür.
 * Netgsm 5XXXXXXXXX formatını bekler (10 hane, başında 0 yok)
 *
 * Input: 05551234567, +905551234567, 905551234567, 5551234567
 * Output: 5551234567
 */
function formatPhoneNumber(phone: string): string {
  // Tüm rakam olmayan karakterleri kaldır
  let digits = phone.replace(/\D/g, '');

  // 90 ile başlıyorsa kaldır
  if (digits.startsWith('90') && digits.length === 12) {
    digits = digits.slice(2);
  }

  // 0 ile başlıyorsa kaldır
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  // 5 ile başlamalı ve 10 haneli olmalı
  if (digits.startsWith('5') && digits.length === 10) {
    return digits;
  }

  // Geçersiz numara durumunda orijinal rakamları döndür
  return digits;
}

/**
 * Netgsm yanıtını parse eder
 *
 * Başarılı yanıt formatı: "00 12345678" veya sadece "00"
 * Hata yanıt formatı: "30" veya "30 hata mesajı"
 */
function parseNetgsmResponse(responseText: string): SMSResponse {
  const text = responseText.trim();

  // İlk 2 karakter yanıt kodudur
  const code = text.substring(0, 2);
  const codeInfo = NETGSM_RESPONSE_CODES[code];

  if (codeInfo?.success) {
    // Mesaj ID'si varsa al
    const parts = text.split(' ');
    const messageId = parts.length > 1 ? parts[1] : undefined;

    return {
      success: true,
      code,
      messageId,
      timestamp: new Date().toISOString(),
    };
  }

  // Hata durumu
  return {
    success: false,
    code,
    error: codeInfo?.message || `Netgsm hatası: ${text}`,
  };
}

/**
 * Netgsm API ile SMS mesajı gönderir
 *
 * @param message - Gönderilecek mesaj
 * @returns SMSResponse
 */
export async function sendSMS(message: SMSMessage): Promise<SMSResponse> {
  const userCode = process.env.NETGSM_USERCODE;
  const password = process.env.NETGSM_PASSWORD;
  const header = process.env.NETGSM_HEADER;

  if (!userCode || !password || !header) {
    console.error('[Netgsm API] Netgsm yapılandırması eksik');
    return {
      success: false,
      error: 'SMS API yapılandırması eksik (NETGSM_USERCODE, NETGSM_PASSWORD, NETGSM_HEADER)',
    };
  }

  const formattedPhone = formatPhoneNumber(message.to);

  // Telefon numarası geçerliliği kontrolü
  if (!formattedPhone.startsWith('5') || formattedPhone.length !== 10) {
    console.error('[Netgsm API] Geçersiz telefon numarası:', message.to);
    return {
      success: false,
      error: `Geçersiz telefon numarası: ${message.to}`,
    };
  }

  try {
    const params = new URLSearchParams({
      usercode: userCode,
      password: password,
      gsmno: formattedPhone,
      message: message.message,
      msgheader: header,
    });

    const response = await fetch(`${NETGSM_API_URL}?${params}`, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error('[Netgsm API] HTTP Error:', response.status);
      return {
        success: false,
        error: `HTTP ${response.status}: Gönderim başarısız`,
      };
    }

    const responseText = await response.text();
    const result = parseNetgsmResponse(responseText);

    if (!result.success) {
      console.error('[Netgsm API] Send failed:', result.error);
    }

    return result;
  } catch (error) {
    console.error('[Netgsm API] Unexpected error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    };
  }
}

/**
 * Toplu SMS mesajı gönderir
 *
 * @param messages - Gönderilecek mesajlar
 * @param delayMs - Mesajlar arası bekleme süresi (ms) - Rate limit için
 * @returns Sonuçlar dizisi
 */
export async function sendBulkSMS(
  messages: SMSMessage[],
  delayMs: number = 500
): Promise<BulkSMSResult[]> {
  const results: BulkSMSResult[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    const result = await sendSMS(msg);
    results.push({ phone: msg.to, result });

    // Rate limit için mesajlar arası bekleme
    if (i < messages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * SMS yapılandırmasının geçerli olup olmadığını kontrol eder
 */
export function isSMSConfigured(): boolean {
  return !!(
    process.env.NETGSM_USERCODE &&
    process.env.NETGSM_PASSWORD &&
    process.env.NETGSM_HEADER
  );
}

/**
 * Telefon numarasını SMS için formatlar (export)
 * Bu fonksiyon bulk-send modülü tarafından da kullanılıyor
 */
export function formatPhoneForSms(phone: string): string {
  return formatPhoneNumber(phone);
}

/**
 * Config parametreli SMS gönderimi (multi-tenant desteği)
 * Bu fonksiyon bulk-send modülü tarafından kullanılıyor
 *
 * @param params - Gönderim parametreleri
 * @returns SMSResponse
 */
export async function sendNetgsmSms(params: {
  to: string;
  message: string;
  config: {
    usercode: string;
    password: string;
    sender: string;
  };
}): Promise<SMSResponse> {
  const { to, message, config } = params;
  const formattedPhone = formatPhoneNumber(to);

  // Telefon numarası geçerliliği kontrolü
  if (!formattedPhone.startsWith('5') || formattedPhone.length !== 10) {
    console.error('[Netgsm API] Geçersiz telefon numarası:', to);
    return {
      success: false,
      error: `Geçersiz telefon numarası: ${to}`,
    };
  }

  try {
    const urlParams = new URLSearchParams({
      usercode: config.usercode,
      password: config.password,
      gsmno: formattedPhone,
      message: message,
      msgheader: config.sender,
    });

    const response = await fetch(`${NETGSM_API_URL}?${urlParams}`, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error('[Netgsm API] HTTP Error:', response.status);
      return {
        success: false,
        error: `HTTP ${response.status}: Gönderim başarısız`,
      };
    }

    const responseText = await response.text();
    const result = parseNetgsmResponse(responseText);

    if (!result.success) {
      console.error('[Netgsm API] Send failed:', result.error);
    }

    return result;
  } catch (error) {
    console.error('[Netgsm API] Unexpected error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    };
  }
}

/**
 * SMS kredi bakiyesini sorgular (opsiyonel)
 */
export async function checkSMSBalance(): Promise<{ success: boolean; balance?: number; error?: string }> {
  const userCode = process.env.NETGSM_USERCODE;
  const password = process.env.NETGSM_PASSWORD;

  if (!userCode || !password) {
    return { success: false, error: 'Yapılandırma eksik' };
  }

  try {
    const params = new URLSearchParams({
      usercode: userCode,
      password: password,
      stession: 'kredi',
    });

    const response = await fetch(
      `https://api.netgsm.com.tr/balance/list/get?${params}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const text = await response.text();

    // Başarılı yanıt: "00 1234" şeklinde
    if (text.startsWith('00')) {
      const parts = text.trim().split(' ');
      const balance = parts.length > 1 ? parseFloat(parts[1]) : 0;
      return { success: true, balance };
    }

    return { success: false, error: text };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    };
  }
}
