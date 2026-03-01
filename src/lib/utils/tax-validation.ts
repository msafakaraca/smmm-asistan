/**
 * VKN (Vergi Kimlik Numarasi) ve TCKN (T.C. Kimlik Numarasi) dogrulama fonksiyonlari.
 * 
 * Turkiye'de kullanilan vergi kimlik numarasi (10 hane) ve
 * T.C. kimlik numarasi (11 hane) icin checksum validasyonu yapar.
 */

/**
 * VKN (Vergi Kimlik Numarasi - 10 hane) checksum dogrulamasi.
 * 
 * Algoritma:
 * - Her basamak (d[i], i=0..8) icin:
 *   tmp = (d[i] + 10 - (i+1)) % 10
 *   eger tmp == 0 ise tmp = 10
 *   tmp = (tmp * 2^(10-(i+1))) % 9
 *   eger tmp == 0 ise tmp = 9
 *   toplam += tmp
 * - Son hane (d[9]) = (10 - (toplam % 10)) % 10
 */
export function isValidVkn(vkn: string): boolean {
  // Null/undefined/bos kontrolu
  if (!vkn) return false;

  // Sadece 10 haneli rakam olmali
  if (!/^\d{10}$/.test(vkn)) return false;

  const digits = vkn.split('').map(Number);

  // Checksum hesaplama
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let tmp = (digits[i] + 10 - (i + 1)) % 10;
    if (tmp === 0) tmp = 10;
    tmp = (tmp * Math.pow(2, 10 - (i + 1))) % 9;
    if (tmp === 0) tmp = 9;
    sum += tmp;
  }

  const expectedLastDigit = (10 - (sum % 10)) % 10;
  return digits[9] === expectedLastDigit;
}

/**
 * TCKN (T.C. Kimlik Numarasi - 11 hane) checksum dogrulamasi.
 * 
 * Algoritma:
 * - Ilk hane 0 olamaz
 * - 10. hane: ((d[0]+d[2]+d[4]+d[6]+d[8])*7 - (d[1]+d[3]+d[5]+d[7])) % 10
 * - 11. hane: (d[0]+d[1]+d[2]+d[3]+d[4]+d[5]+d[6]+d[7]+d[8]+d[9]) % 10
 * 
 * Not: 10. hane formulunde negatif sonuc cikarsa JS modulo operatoru
 * negatif deger dondurur, bu yuzden ((x % 10) + 10) % 10 kullanilir.
 */
export function isValidTckn(tckn: string): boolean {
  // Null/undefined/bos kontrolu
  if (!tckn) return false;

  // Sadece 11 haneli rakam olmali
  if (!/^\d{11}$/.test(tckn)) return false;

  const digits = tckn.split('').map(Number);

  // Ilk hane 0 olamaz
  if (digits[0] === 0) return false;

  // 10. hane kontrolu
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const digit10 = ((oddSum * 7 - evenSum) % 10 + 10) % 10;

  if (digits[9] !== digit10) return false;

  // 11. hane kontrolu
  let totalSum = 0;
  for (let i = 0; i < 10; i++) {
    totalSum += digits[i];
  }
  const digit11 = totalSum % 10;

  return digits[10] === digit11;
}

/**
 * Vergi numarasi dogrulamasi (VKN veya TCKN).
 * 10 haneli ise VKN, 11 haneli ise TCKN olarak dogrular.
 * 
 * @param value - Dogrulanacak vergi/kimlik numarasi
 * @returns Numara gecerli ise true, degilse false
 */
export function isValidTaxNumber(value: string): boolean {
  // Null/undefined/bos kontrolu
  if (!value) return false;

  // Sadece rakamlari al
  const cleaned = value.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return isValidVkn(cleaned);
  }
  if (cleaned.length === 11) {
    return isValidTckn(cleaned);
  }

  return false;
}
