/**
 * Dosyalar Module Types
 *
 * Dosya yönetimi için tip tanımlamaları
 */

// Dosya/Klasör item
export interface FileItem {
  id: string;
  name: string;
  isFolder: boolean;
  parentId: string | null;
  size?: number;
  mimeType?: string;
  createdAt?: string;
  updatedAt?: string;
  customerId?: string | null;
  sirketTipi?: string;
  color?: string | null;
}

// Breadcrumb navigasyon
export interface Breadcrumb {
  id: string | null;
  name: string;
}

// Pano durumu (kopyala/kes)
export interface ClipboardState {
  items: FileItem[];
  action: "copy" | "cut";
}

// Filtreli doküman
export interface FilteredDocument {
  id: string;
  name: string;
  size: number | null;
  category?: string;
}

// Filtreli sonuç (müşteri bazlı)
export interface FilteredResult {
  customer: {
    id: string;
    unvan: string;
    vknTckn: string;
    sirketTipi: string;
  };
  documents: FilteredDocument[];
}

// Müşteri
export interface Customer {
  id: string;
  unvan: string;
  vknTckn: string;
  sirketTipi: string;
}

// Beyanname türü
export interface BeyannameType {
  code: string;
  name: string;
  count: number;
}

// Seçim kutusu koordinatları
export interface SelectionRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// Dosya türü seçenekleri
export const FILE_TYPE_OPTIONS = [
  { id: "BEYANNAME", label: "Beyanname" },
  { id: "TAHAKKUK", label: "Tahakkuk" },
  { id: "SGK_TAHAKKUK", label: "SGK Tahakkuk" },
  { id: "HIZMET_LISTESI", label: "Hizmet Listesi" },
] as const;

// Ay seçenekleri
export const MONTH_OPTIONS = [
  { value: 1, label: "Ocak" },
  { value: 2, label: "Şubat" },
  { value: 3, label: "Mart" },
  { value: 4, label: "Nisan" },
  { value: 5, label: "Mayıs" },
  { value: 6, label: "Haziran" },
  { value: 7, label: "Temmuz" },
  { value: 8, label: "Ağustos" },
  { value: 9, label: "Eylül" },
  { value: 10, label: "Ekim" },
  { value: 11, label: "Kasım" },
  { value: 12, label: "Aralık" },
];

// Yıl seçenekleri (dinamik)
export const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const year = new Date().getFullYear() - i;
  return { value: year, label: year.toString() };
});

// Şirket tipi normalizasyon
export function normalizeSirketTipi(type: string | undefined | null): string {
  if (!type) return "-";
  const normalized = type.toLowerCase().trim();
  if (normalized.includes("firma") || normalized.includes("ltd") || normalized.includes("a.ş") || normalized.includes("şirket")) {
    return "Firma";
  }
  if (normalized.includes("basit") || normalized.includes("usul")) {
    return "Basit Usul";
  }
  if (normalized.includes("şahıs") || normalized.includes("sahis") || normalized.includes("sahıs")) {
    return "Şahıs";
  }
  return type;
}

// Boyut formatlama
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
