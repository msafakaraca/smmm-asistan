// WhatsApp Service Types

export interface WhatsAppMessage {
  to: string; // Telefon numarası (+905551234567 formatında)
  message: string; // Mesaj içeriği
}

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp?: string;
}
