/**
 * Diğer İşlemler URL Launcher
 * ============================
 * Kullanıcı kimlik bilgisi gerektirmeyen harici portal linklerini
 * kullanıcının varsayılan tarayıcısında açar.
 *
 * Yeni bir işlem eklemek için DIGER_ISLEMLER_URLS registry'sine entry ekleyin.
 */

import { shell } from 'electron';

// ═══════════════════════════════════════════════════════════════════
// URL REGISTRY
// ═══════════════════════════════════════════════════════════════════

interface DigerIslemEntry {
  label: string;
  url: string;
}

const DIGER_ISLEMLER_URLS: Record<string, DigerIslemEntry> = {
  'efatura-iptal': {
    label: 'E-Fatura İptal/İtiraz Portalı',
    url: 'https://ebelgebasvuru.gib.gov.tr/iptal-itiraz/sertifika-giris',
  },
  // Aşağıdaki URL'ler aktif edildiğinde doğru adreslerle güncellenecek
  // 'ticaret-sicil': {
  //   label: 'Ticaret Sicili Gazetesi',
  //   url: 'https://www.ticaretsicil.gov.tr',
  // },
  // 'turmob-ebirlik': {
  //   label: 'TÜRMOB E-Birlik Sistemi',
  //   url: 'https://ebirlik.turmob.org.tr',
  // },
};

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface DigerIslemLaunchOptions {
  actionId: string;
  onProgress: (status: string) => void;
}

export interface DigerIslemLaunchResult {
  success: boolean;
  url?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════
// LAUNCHER
// ═══════════════════════════════════════════════════════════════════

export async function launchDigerIslem(
  options: DigerIslemLaunchOptions
): Promise<DigerIslemLaunchResult> {
  const { actionId, onProgress } = options;

  const entry = DIGER_ISLEMLER_URLS[actionId];
  if (!entry) {
    return {
      success: false,
      error: `Desteklenmeyen işlem: ${actionId}`,
    };
  }

  onProgress(`${entry.label} açılıyor...`);

  try {
    await shell.openExternal(entry.url);
    onProgress(`${entry.label} tarayıcıda açıldı`);

    return {
      success: true,
      url: entry.url,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error(`[DIGER-ISLEMLER] ${entry.label} açılamadı:`, error);
    return {
      success: false,
      error: `${entry.label} açılamadı: ${errorMessage}`,
    };
  }
}
