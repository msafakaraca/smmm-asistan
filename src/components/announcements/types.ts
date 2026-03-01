// Mükellef Duyuru Modülü - TypeScript Types

import { customers, customer_groups, announcement_templates, scheduled_announcements, announcement_logs } from '@prisma/client';

// Type aliases for backward compatibility
type Customer = customers;
type CustomerGroup = customer_groups;
type AnnouncementTemplate = announcement_templates;
type ScheduledAnnouncement = scheduled_announcements;
type AnnouncementLog = announcement_logs;

// ============================================
// KANAL VE DURUM TANIMLARI
// ============================================

export type AnnouncementChannel = 'email' | 'sms' | 'whatsapp';

export type AnnouncementStatus = 'pending' | 'sent' | 'failed';

export type ScheduledAnnouncementStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export type RepeatPattern = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export type TargetType = 'all' | 'selected' | 'group';

export type TemplateType = 'general' | 'beyanname' | 'vergi' | 'sgk' | 'genel_duyuru';

// ============================================
// KANAL AYARLARI
// ============================================

export interface ChannelSettings {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
}

// ============================================
// MÜŞTERİ GÖRÜNÜMÜ
// ============================================

export interface AnnouncementCustomer {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  sirketTipi: string;
  email: string | null;
  telefon1: string | null;
  telefon2: string | null;
  status: string;
  groups: Array<{
    groupId: string;
    groupName: string;
  }>;
}

// ============================================
// FİLTRE STATE
// ============================================

export interface AnnouncementFilterState {
  sirketTipiFilter: string[]; // sahis, firma, basit_usul
  groupIds: string[];
  hasEmailFilter: 'all' | 'yes' | 'no';
  hasPhoneFilter: 'all' | 'yes' | 'no';
  statusFilter: 'all' | 'active' | 'passive';
  searchTerm: string;
}

export function getDefaultAnnouncementFilterState(): AnnouncementFilterState {
  return {
    sirketTipiFilter: [],
    groupIds: [],
    hasEmailFilter: 'all',
    hasPhoneFilter: 'all',
    statusFilter: 'active',
    searchTerm: '',
  };
}

// ============================================
// ANLIK GÖNDERİM
// ============================================

export interface SendAnnouncementRequest {
  customerIds: string[];
  subject?: string;
  content: string;
  channels: ChannelSettings;
}

export interface SendResult {
  success: boolean;
  total: number;
  sent: number;
  failed: number;
  results: Array<{
    customerId: string;
    customerName: string;
    channel: AnnouncementChannel;
    status: AnnouncementStatus;
    error?: string;
  }>;
}

// ============================================
// ŞABLON TÜRLERİ
// ============================================

export interface TemplateWithCount extends AnnouncementTemplate {
  _count?: {
    scheduledAnnouncements: number;
  };
}

export interface CreateTemplateRequest {
  name: string;
  subject?: string;
  content: string;
  type?: TemplateType;
  channels?: AnnouncementChannel[];
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {
  isActive?: boolean;
}

// ============================================
// ZAMANLI DUYURU TÜRLERİ
// ============================================

export interface ScheduledAnnouncementWithRelations extends ScheduledAnnouncement {
  template?: AnnouncementTemplate | null;
  _count?: {
    logs: number;
  };
}

export interface CreateScheduledAnnouncementRequest {
  name: string;
  subject?: string;
  content: string;
  sendEmail: boolean;
  sendSms: boolean;
  sendWhatsApp: boolean;
  scheduledAt: string; // ISO string
  repeatPattern?: RepeatPattern;
  repeatDay?: number;
  repeatEndDate?: string;
  targetType: TargetType;
  customerIds?: string[];
  groupIds?: string[];
  templateId?: string;
}

export interface UpdateScheduledAnnouncementRequest extends Partial<CreateScheduledAnnouncementRequest> {
  status?: ScheduledAnnouncementStatus;
}

// ============================================
// LOG TÜRLERİ
// ============================================

export interface AnnouncementLogWithRelations extends AnnouncementLog {
  customer?: Customer | null;
  announcement?: ScheduledAnnouncement | null;
}

export interface LogFilterState {
  channel?: AnnouncementChannel;
  status?: AnnouncementStatus;
  customerId?: string;
  announcementId?: string;
  startDate?: string;
  endDate?: string;
}

// ============================================
// İSTATİSTİKLER
// ============================================

export interface AnnouncementStats {
  totalCustomers: number;
  customersWithEmail: number;
  customersWithPhone: number;
  selectedCount: number;
  scheduledCount: number;
  sentToday: number;
}

// ============================================
// TABLO KOLONLARI
// ============================================

export interface AnnouncementColumn {
  id: string;
  header: string;
  accessor: keyof AnnouncementCustomer | ((row: AnnouncementCustomer) => string | number | boolean | null);
  sortable?: boolean;
  width?: number;
}

// ============================================
// SEÇİM STATE
// ============================================

export interface SelectionState {
  selectedIds: Set<string>;
  selectAll: boolean;
}

// ============================================
// ŞABLON DEĞİŞKENLERİ
// ============================================

export const TEMPLATE_VARIABLES = [
  { key: '{{unvan}}', label: 'Ünvan', description: 'Mükellef ünvanı' },
  { key: '{{kisaltma}}', label: 'Kısaltma', description: 'Mükellef kısaltması' },
  { key: '{{vkn}}', label: 'VKN/TCKN', description: 'Vergi kimlik no' },
  { key: '{{email}}', label: 'Email', description: 'Mükellef email adresi' },
  { key: '{{telefon}}', label: 'Telefon', description: 'Mükellef telefon numarası' },
  { key: '{{tarih}}', label: 'Tarih', description: 'Bugünün tarihi' },
  { key: '{{ay}}', label: 'Ay', description: 'Mevcut ay adı' },
  { key: '{{yil}}', label: 'Yıl', description: 'Mevcut yıl' },
] as const;

// ============================================
// ŞİRKET TİPLERİ
// ============================================

export const SIRKET_TIPLERI = [
  { value: 'sahis', label: 'Şahıs' },
  { value: 'firma', label: 'Firma' },
  { value: 'basit_usul', label: 'Basit Usul' },
] as const;

// ============================================
// TEKRARLAMA KALIPLARI
// ============================================

export const REPEAT_PATTERNS = [
  { value: 'once', label: 'Tek Seferlik' },
  { value: 'daily', label: 'Günlük' },
  { value: 'weekly', label: 'Haftalık' },
  { value: 'monthly', label: 'Aylık' },
  { value: 'yearly', label: 'Yıllık' },
] as const;

// ============================================
// YARDIMCI FONKSİYONLAR
// ============================================

/**
 * Şablon değişkenlerini gerçek değerlerle değiştirir
 */
export function replaceTemplateVariables(
  template: string,
  customer: Partial<AnnouncementCustomer>
): string {
  const now = new Date();
  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  return template
    .replace(/\{\{unvan\}\}/g, customer.unvan || '')
    .replace(/\{\{kisaltma\}\}/g, customer.kisaltma || customer.unvan || '')
    .replace(/\{\{vkn\}\}/g, customer.vknTckn || '')
    .replace(/\{\{email\}\}/g, customer.email || '')
    .replace(/\{\{telefon\}\}/g, customer.telefon1 || '')
    .replace(/\{\{tarih\}\}/g, now.toLocaleDateString('tr-TR'))
    .replace(/\{\{ay\}\}/g, months[now.getMonth()])
    .replace(/\{\{yil\}\}/g, now.getFullYear().toString());
}

/**
 * Telefon numarasını WhatsApp formatına çevirir
 */
export function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('90') && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith('0') && digits.length === 11) {
    return '90' + digits.slice(1);
  }

  if (digits.startsWith('5') && digits.length === 10) {
    return '90' + digits;
  }

  return '90' + digits;
}

/**
 * Telefon numarasını SMS formatına çevirir (Netgsm)
 */
export function formatPhoneForSms(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  // Netgsm 5XXXXXXXXX formatını bekler (10 hane, başında 0 yok)
  if (digits.startsWith('90') && digits.length === 12) {
    return digits.slice(2);
  }

  if (digits.startsWith('0') && digits.length === 11) {
    return digits.slice(1);
  }

  if (digits.startsWith('5') && digits.length === 10) {
    return digits;
  }

  return digits;
}

/**
 * Durum etiketini döndürür
 */
export function getStatusLabel(status: ScheduledAnnouncementStatus): string {
  const labels: Record<ScheduledAnnouncementStatus, string> = {
    active: 'Aktif',
    paused: 'Duraklatıldı',
    completed: 'Tamamlandı',
    cancelled: 'İptal Edildi',
  };
  return labels[status] || status;
}

/**
 * Kanal etiketini döndürür
 */
export function getChannelLabel(channel: AnnouncementChannel): string {
  const labels: Record<AnnouncementChannel, string> = {
    email: 'Email',
    sms: 'SMS',
    whatsapp: 'WhatsApp',
  };
  return labels[channel] || channel;
}

/**
 * Tekrarlama kalıbı etiketini döndürür
 */
export function getRepeatPatternLabel(pattern: RepeatPattern | null): string {
  if (!pattern) return 'Tek Seferlik';

  const labels: Record<RepeatPattern, string> = {
    once: 'Tek Seferlik',
    daily: 'Günlük',
    weekly: 'Haftalık',
    monthly: 'Aylık',
    yearly: 'Yıllık',
  };
  return labels[pattern] || pattern;
}

/**
 * Sonraki çalışma tarihini hesaplar
 */
export function calculateNextExecuteDate(
  scheduledAt: Date,
  repeatPattern: RepeatPattern | null,
  repeatDay?: number
): Date | null {
  if (!repeatPattern || repeatPattern === 'once') {
    return null;
  }

  const now = new Date();
  const next = new Date(scheduledAt);

  while (next <= now) {
    switch (repeatPattern) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        if (repeatDay) {
          next.setMonth(next.getMonth() + 1);
          next.setDate(Math.min(repeatDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
        } else {
          next.setMonth(next.getMonth() + 1);
        }
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }
  }

  return next;
}
