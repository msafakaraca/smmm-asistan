/**
 * Takip Cizelgesi - Paylaşılan Utility Fonksiyonları
 *
 * extractCellData: Hücre değerini normalize eder (eski primitive format ve yeni metadata formatı)
 * Hem takip-satir.tsx hem takip-cizelgesi.tsx tarafından kullanılır.
 */

export interface CellValue {
  value: boolean | string | null;
  modifiedBy?: string;
  modifiedByName?: string;
  modifiedAt?: string;
}

/**
 * Ham hücre değerini normalize eder.
 * Eski format (primitive boolean/string) ve yeni format (metadata objesi) destekler.
 */
export function extractCellData(rawValue: unknown): { value: boolean | string | null; metadata?: CellValue } {
  if (rawValue === null || rawValue === undefined) {
    return { value: null };
  }

  // Primitive değer (eski format)
  if (typeof rawValue === "boolean" || typeof rawValue === "string" || typeof rawValue === "number") {
    return { value: rawValue as boolean | string | null };
  }

  // Obje (yeni metadata formatı)
  if (typeof rawValue === "object" && rawValue !== null) {
    const obj = rawValue as CellValue;
    return {
      value: obj.value ?? null,
      metadata: obj.modifiedByName ? obj : undefined,
    };
  }

  return { value: null };
}
