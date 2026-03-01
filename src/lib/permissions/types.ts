/**
 * Permission Type Definitions
 * SMMM-AI Kullanıcı Yetki Sistemi
 */

// Tüm permission'lar
export const ALL_PERMISSIONS = [
  // Müşteri yetkileri
  'customers:read',
  'customers:write',
  'customers:delete',

  // Beyanname takip yetkileri
  'beyanname:read',
  'beyanname:write',

  // Takip çizelgesi yetkileri
  'takip:read',
  'takip:write',

  // Dosya yetkileri
  'files:read',
  'files:write',

  // Şifre yetkileri
  'passwords:read',
  'passwords:write',

  // Ayarlar yetkileri
  'settings:read',
  'settings:write',

  // Kullanıcı yönetimi yetkileri
  'users:read',
  'users:manage',

  // Bot yetkileri
  'gib:run',

  // Mail yetkileri
  'mail:read',
  'mail:write',

  // Anımsatıcı yetkileri
  'reminders:read',
  'reminders:write',
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

// Kullanıcı durumları
export type UserStatus = 'pending' | 'active' | 'suspended';

// Kullanıcı rolleri
export type UserRole = 'owner' | 'admin' | 'user';

// Permission grupları (UI'da göstermek için)
export const PERMISSION_GROUPS = {
  'Müşteriler': ['customers:read', 'customers:write', 'customers:delete'],
  'Beyanname Takip': ['beyanname:read', 'beyanname:write'],
  'Takip Çizelgesi': ['takip:read', 'takip:write'],
  'Dosyalar': ['files:read', 'files:write'],
  'Şifreler': ['passwords:read', 'passwords:write'],
  'Ayarlar': ['settings:read', 'settings:write'],
  'Ekip Yönetimi': ['users:read', 'users:manage'],
  'GİB Bot': ['gib:run'],
  'Mail': ['mail:read', 'mail:write'],
  'Anımsatıcılar': ['reminders:read', 'reminders:write'],
} as const;

// Permission açıklamaları
export const PERMISSION_LABELS: Record<Permission, string> = {
  'customers:read': 'Müşterileri görüntüle',
  'customers:write': 'Müşteri ekle/düzenle',
  'customers:delete': 'Müşteri sil',
  'beyanname:read': 'Beyanname takibi görüntüle',
  'beyanname:write': 'Beyanname durumu değiştir',
  'takip:read': 'Takip çizelgesi görüntüle',
  'takip:write': 'Takip çizelgesinde işlem yap',
  'files:read': 'Dosyaları görüntüle',
  'files:write': 'Dosya yükle/sil',
  'passwords:read': 'Şifreleri görüntüle',
  'passwords:write': 'Şifre ekle/düzenle',
  'settings:read': 'Ayarları görüntüle',
  'settings:write': 'Ayarları değiştir',
  'users:read': 'Ekip üyelerini görüntüle',
  'users:manage': 'Kullanıcı ekle/sil/yetki ver',
  'gib:run': 'GİB botunu çalıştır',
  'mail:read': 'Mailleri görüntüle',
  'mail:write': 'Mail gönder',
  'reminders:read': 'Anımsatıcıları görüntüle',
  'reminders:write': 'Anımsatıcı ekle/düzenle',
};
