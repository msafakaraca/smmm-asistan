// Reminder Types for Anımsatıcılar & Notlar

export type ReminderType = "event" | "task";
export type ReminderStatus = "active" | "completed" | "cancelled";
export type RepeatPattern = "daily" | "weekly" | "monthly" | "yearly" | null;
export type WeekDay = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

// Customer subset for reminder display
export interface ReminderCustomer {
  id: string;
  unvan: string;
  kisaltma?: string | null;
  vknTckn: string;
}

export interface Reminder {
  id: string;

  // İçerik
  title: string;
  description?: string | null;
  type: ReminderType;

  // Zamanlama
  date: Date | string;
  isAllDay: boolean;
  startTime?: string | null;
  endTime?: string | null;

  // Tekrarlama
  repeatPattern?: RepeatPattern;
  repeatDays: WeekDay[];
  repeatEndDate?: Date | string | null;

  // WhatsApp
  phoneNumber?: string | null;
  sendWhatsApp: boolean;
  whatsappSentAt?: Date | string | null;

  // Durum
  status: ReminderStatus;
  location?: string | null;

  // Relations
  userId: string;
  tenantId: string;
  customerId?: string | null;
  customer?: ReminderCustomer | null;

  // Çoklu mükellef desteği (opsiyonel)
  customerIds?: string[];
  customers?: ReminderCustomer[];

  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateReminderInput {
  title: string;
  description?: string;
  type?: ReminderType;
  date: Date | string;
  isAllDay?: boolean;
  startTime?: string;
  endTime?: string;
  repeatPattern?: RepeatPattern;
  repeatDays?: WeekDay[];
  repeatEndDate?: Date | string;
  phoneNumber?: string;
  sendWhatsApp?: boolean;
  location?: string;
  customerId?: string;
  customerIds?: string[]; // Çoklu mükellef desteği
}

export interface UpdateReminderInput extends Partial<CreateReminderInput> {
  status?: ReminderStatus;
}

export interface ReminderFilter {
  year: number;
  month: number; // 1-12
  type?: ReminderType;
  customerId?: string;
  status?: ReminderStatus;
}
