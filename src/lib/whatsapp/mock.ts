// Mock WhatsApp Service
// Bu servis console'a log basar, gerçek API yok
// Gerçek entegrasyon için: Twilio, WhatsApp Business API, vb. kullanılacak

import { WhatsAppMessage, WhatsAppResponse } from "./types";

/**
 * Mock WhatsApp mesajı gönderimi
 * Console'a log basar ve simüle edilmiş bir response döner
 *
 * @param message - WhatsApp mesaj objesi
 * @returns Promise<WhatsAppResponse>
 */
export async function sendWhatsAppMessage(
  message: WhatsAppMessage
): Promise<WhatsAppResponse> {
  const timestamp = new Date().toISOString();

  console.log("\n" + "=".repeat(50));
  console.log("🔔 MOCK WHATSAPP MESSAGE");
  console.log("=".repeat(50));
  console.log("📱 TO:", message.to);
  console.log("💬 MESSAGE:");
  console.log(message.message);
  console.log("⏰ TIMESTAMP:", timestamp);
  console.log("=".repeat(50) + "\n");

  // Simüle gecikme (gerçek API gibi davranmak için)
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Mock response
  return {
    success: true,
    messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp,
  };
}

/**
 * WhatsApp Business API entegrasyonu için placeholder
 * TODO: Gerçek API entegrasyonu eklenecek
 *
 * Örnek: Twilio WhatsApp API
 * ```typescript
 * import twilio from "twilio";
 *
 * const client = twilio(
 *   process.env.TWILIO_ACCOUNT_SID,
 *   process.env.TWILIO_AUTH_TOKEN
 * );
 *
 * export async function sendWhatsAppMessageReal(message: WhatsAppMessage) {
 *   return await client.messages.create({
 *     from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
 *     to: `whatsapp:${message.to}`,
 *     body: message.message
 *   });
 * }
 * ```
 */
export async function sendWhatsAppMessageReal(
  message: WhatsAppMessage
): Promise<WhatsAppResponse> {
  throw new Error(
    "Real WhatsApp API not implemented yet. Use sendWhatsAppMessage() for mock service."
  );
}
