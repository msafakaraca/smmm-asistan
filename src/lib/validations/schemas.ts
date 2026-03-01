import { z } from "zod";

// ============================================
// Reminder Schema
// ============================================
export const reminderSchema = z.object({
  title: z
    .string()
    .min(1, "Başlık zorunludur")
    .max(200, "Başlık en fazla 200 karakter olabilir"),
  description: z
    .string()
    .max(1000, "Açıklama en fazla 1000 karakter olabilir")
    .optional(),
  type: z.enum(["event", "task"]),
  date: z.string().min(1, "Tarih zorunludur"),
  isAllDay: z.boolean(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  phoneNumber: z.string().optional(),
  sendWhatsApp: z.boolean(),
  customerIds: z.array(z.string().uuid()).optional(),
});

export type ReminderFormData = z.infer<typeof reminderSchema>;

// ============================================
// Note Schema (Task type reminder)
// ============================================
export const noteSchema = z.object({
  title: z
    .string()
    .min(1, "Başlık zorunludur")
    .max(200, "Başlık en fazla 200 karakter olabilir"),
  description: z
    .string()
    .max(5000, "Not içeriği en fazla 5000 karakter olabilir")
    .optional(),
  type: z.literal("task"),
  date: z.string().min(1, "Tarih zorunludur"),
  customerIds: z.array(z.string().uuid()).optional(),
});

export type NoteFormData = z.infer<typeof noteSchema>;

// ============================================
// Task Schema
// ============================================
export const taskSchema = z.object({
  title: z
    .string()
    .min(1, "Başlık zorunludur")
    .max(200, "Başlık en fazla 200 karakter olabilir"),
  description: z
    .string()
    .max(2000, "Açıklama en fazla 2000 karakter olabilir")
    .optional(),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: z.string().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
});

export type TaskFormData = z.infer<typeof taskSchema>;

// ============================================
// Customer Group Schema
// ============================================
export const customerGroupSchema = z.object({
  name: z
    .string()
    .min(1, "Grup adı zorunludur")
    .max(100, "Grup adı en fazla 100 karakter olabilir"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Geçerli bir renk kodu giriniz (#RRGGBB)"),
  customerIds: z.array(z.string().uuid()),
  beyannameTypes: z.array(z.string()),
});

export type CustomerGroupFormData = z.infer<typeof customerGroupSchema>;

// ============================================
// Template Schema
// ============================================
export const templateSchema = z.object({
  name: z
    .string()
    .min(1, "Şablon adı zorunludur")
    .max(100, "Şablon adı en fazla 100 karakter olabilir"),
  subject: z
    .string()
    .min(1, "Konu zorunludur")
    .max(200, "Konu en fazla 200 karakter olabilir"),
  content: z.string().min(1, "İçerik zorunludur"),
  type: z.enum(["email", "whatsapp", "sms"]),
});

export type TemplateFormData = z.infer<typeof templateSchema>;

// ============================================
// Customer Schema
// ============================================
export const customerSchema = z.object({
  unvan: z
    .string()
    .min(1, "Ünvan zorunludur")
    .max(300, "Ünvan en fazla 300 karakter olabilir"),
  kisaltma: z
    .string()
    .max(50, "Kısaltma en fazla 50 karakter olabilir")
    .optional()
    .nullable(),
  vknTckn: z
    .string()
    .min(10, "VKN/TCKN en az 10 karakter olmalıdır")
    .max(11, "VKN/TCKN en fazla 11 karakter olabilir")
    .regex(/^\d+$/, "VKN/TCKN sadece rakamlardan oluşmalıdır"),
  vergiDairesi: z.string().optional().nullable(),
  sirketTipi: z.enum(["sahis", "firma", "basit_usul"]),
  email: z.string().email("Geçerli bir e-posta adresi giriniz").optional().nullable(),
  telefon1: z.string().optional().nullable(),
  telefon2: z.string().optional().nullable(),
  adres: z.string().optional().nullable(),
  status: z.enum(["active", "passive", "archived"]),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

// ============================================
// Password Schema
// ============================================
export const passwordSchema = z.object({
  siteName: z
    .string()
    .min(1, "Site adı zorunludur")
    .max(100, "Site adı en fazla 100 karakter olabilir"),
  username: z
    .string()
    .min(1, "Kullanıcı adı zorunludur")
    .max(100, "Kullanıcı adı en fazla 100 karakter olabilir"),
  password: z
    .string()
    .min(1, "Şifre zorunludur")
    .max(200, "Şifre en fazla 200 karakter olabilir"),
  url: z.string().url("Geçerli bir URL giriniz").optional().nullable(),
  notes: z.string().max(500, "Notlar en fazla 500 karakter olabilir").optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
});

export type PasswordFormData = z.infer<typeof passwordSchema>;

// ============================================
// Settings Schema
// ============================================
export const gibSettingsSchema = z.object({
  gibKullaniciAdi: z.string().optional(),
  gibSifre: z.string().optional(),
  autoLogin: z.boolean(),
  downloadPath: z.string().optional(),
});

export type GibSettingsFormData = z.infer<typeof gibSettingsSchema>;

export const turmobSettingsSchema = z.object({
  turmobKullaniciAdi: z.string().optional(),
  turmobSifre: z.string().optional(),
  autoSync: z.boolean(),
});

export type TurmobSettingsFormData = z.infer<typeof turmobSettingsSchema>;
