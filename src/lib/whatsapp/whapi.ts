/**
 * Whapi.cloud API Entegrasyonu
 *
 * Bu modül Whapi.cloud API'si ile WhatsApp mesajı gönderimi sağlar.
 * API Docs: https://whapi.readme.io/reference/
 */

import { WhatsAppMessage, WhatsAppResponse } from "./types";

const WHAPI_BASE_URL = "https://gate.whapi.cloud";

/**
 * Telefon numarasını Whapi formatına dönüştürür.
 * Input: 05551234567, +905551234567, 5551234567
 * Output: 905551234567@s.whatsapp.net
 */
function formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, '');

    // Handle Turkish numbers
    if (digits.startsWith('0')) {
        digits = '90' + digits.slice(1);
    } else if (!digits.startsWith('90') && digits.length === 10) {
        digits = '90' + digits;
    }

    return `${digits}@s.whatsapp.net`;
}

/**
 * Whapi.cloud API ile WhatsApp mesajı gönderir
 *
 * @param message - Gönderilecek mesaj
 * @returns WhatsAppResponse
 */
export async function sendWhatsAppMessage(
    message: WhatsAppMessage
): Promise<WhatsAppResponse> {
    const apiKey = process.env.WHATSAPP_API_KEY;

    if (!apiKey) {
        console.error("[WhatsApp API] WHATSAPP_API_KEY is not configured");
        return {
            success: false,
            error: "WhatsApp API anahtarı yapılandırılmamış"
        };
    }

    const formattedPhone = formatPhoneNumber(message.to);

    try {
        const response = await fetch(`${WHAPI_BASE_URL}/messages/text`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                to: formattedPhone,
                body: message.message,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("[WhatsApp API] Error response:", errorData);

            return {
                success: false,
                error: errorData.message || `HTTP ${response.status}: Gönderim başarısız`,
            };
        }

        const data = await response.json();

        return {
            success: true,
            messageId: data.message?.id || data.id,
            timestamp: new Date().toISOString(),
        };
    } catch (error) {
        console.error("[WhatsApp API] Unexpected error:", error);

        return {
            success: false,
            error: error instanceof Error ? error.message : "Bilinmeyen hata",
        };
    }
}

/**
 * Toplu WhatsApp mesajı gönderir
 *
 * @param messages - Gönderilecek mesajlar
 * @param delayMs - Mesajlar arası bekleme süresi (ms) - Rate limit için
 * @returns Sonuçlar dizisi
 */
export async function sendBulkWhatsAppMessages(
    messages: WhatsAppMessage[],
    delayMs: number = 1000
): Promise<{ phone: string; result: WhatsAppResponse }[]> {
    const results: { phone: string; result: WhatsAppResponse }[] = [];

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];

        const result = await sendWhatsAppMessage(msg);
        results.push({ phone: msg.to, result });

        // Add delay between messages to avoid rate limiting
        if (i < messages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    return results;
}

/**
 * Beyanname bildirimi mesajı oluşturur
 */
export function createDeclarationNotificationMessage(
    customerName: string,
    year: number,
    month: number,
    beyannameler: string[]
): string {
    const monthNames = [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ];

    const monthName = monthNames[month - 1] || "Bilinmeyen";
    const beyannameList = beyannameler.join(", ");

    return `📋 *Beyanname Bildirimi*

Sayın ${customerName},

${year} yılı ${monthName} ayına ait ${beyannameList} beyanname tahakkukunuz hazırlanmıştır.

Detaylı bilgi için e-postanızı kontrol ediniz.

---
SMMM Asistan`;
}
