import { describe, it, expect } from 'vitest';
import { isValidVkn, isValidTckn, isValidTaxNumber } from '@/lib/utils/tax-validation';

// =====================================================================
// VKN (Vergi Kimlik Numarasi - 10 hane) Testleri
// =====================================================================
describe('isValidVkn', () => {
  // Gecerli VKN numaralari (algoritmadan hesaplanan checksum dogru)
  it('gecerli VKN numaralarini kabul etmeli', () => {
    expect(isValidVkn('0010010180')).toBe(true);
    expect(isValidVkn('1234567899')).toBe(true);
    expect(isValidVkn('0123456789')).toBe(true);
    expect(isValidVkn('1111111116')).toBe(true);
    expect(isValidVkn('9999999992')).toBe(true);
  });

  // Uzunluk kontrolleri
  it('10 haneden kisa numaralari reddetmeli', () => {
    expect(isValidVkn('123456789')).toBe(false); // 9 hane
    expect(isValidVkn('12345')).toBe(false);     // 5 hane
    expect(isValidVkn('')).toBe(false);           // bos
  });

  it('10 haneden uzun numaralari reddetmeli', () => {
    expect(isValidVkn('12345678901')).toBe(false); // 11 hane
    expect(isValidVkn('123456789012')).toBe(false); // 12 hane
  });

  // Sayi olmayan karakterler
  it('sayi olmayan karakterleri reddetmeli', () => {
    expect(isValidVkn('123456789a')).toBe(false);
    expect(isValidVkn('abcdefghij')).toBe(false);
    expect(isValidVkn('12345 6789')).toBe(false);
  });

  // Checksum hatali VKN numaralari
  it('checksum hatali VKN numaralarini reddetmeli', () => {
    expect(isValidVkn('1234567890')).toBe(false); // dogru checksum 9, burada 0
    expect(isValidVkn('0000000010')).toBe(false); // dogru checksum 1, burada 0
    expect(isValidVkn('1111111115')).toBe(false); // dogru checksum 6, burada 5
  });

  // 0000000001 ozel durum: gecerli VKN (checksum = 1)
  it('0000000001 gecerli VKN olarak kabul etmeli', () => {
    expect(isValidVkn('0000000001')).toBe(true);
  });
});

// =====================================================================
// TCKN (T.C. Kimlik Numarasi - 11 hane) Testleri
// =====================================================================
describe('isValidTckn', () => {
  // Gecerli TCKN numaralari
  it('gecerli TCKN numaralarini kabul etmeli', () => {
    expect(isValidTckn('10000000146')).toBe(true);
    expect(isValidTckn('10000000214')).toBe(true);
    expect(isValidTckn('55555555550')).toBe(true);
  });

  // Negatif modulo edge case
  it('negatif modulo iceren TCKN numaralarini dogru hesaplamali', () => {
    // ((1+0+0+0+0)*7 - (9+9+9+9)) % 10 = (7-36) % 10 = -29 % 10
    // JS'de -29 % 10 = -9, dogru sonuc: 1
    expect(isValidTckn('19090909018')).toBe(true);
  });

  // Ilk hane 0 olamaz
  it('ilk hanesi 0 olan TCKN numaralarini reddetmeli', () => {
    expect(isValidTckn('01234567890')).toBe(false);
    expect(isValidTckn('00000000000')).toBe(false);
  });

  // Uzunluk kontrolleri
  it('11 haneden kisa numaralari reddetmeli', () => {
    expect(isValidTckn('1234567890')).toBe(false);  // 10 hane
    expect(isValidTckn('123456')).toBe(false);       // 6 hane
    expect(isValidTckn('')).toBe(false);              // bos
  });

  it('11 haneden uzun numaralari reddetmeli', () => {
    expect(isValidTckn('123456789012')).toBe(false); // 12 hane
  });

  // Sayi olmayan karakterler
  it('sayi olmayan karakterleri reddetmeli', () => {
    expect(isValidTckn('1234567890a')).toBe(false);
    expect(isValidTckn('abcdefghijk')).toBe(false);
    expect(isValidTckn('123 456 789')).toBe(false);
  });

  // 10. hane checksum hatasi
  it('10. hane checksum hatali TCKN numaralarini reddetmeli', () => {
    // 10000000146 gecerli, d10=4 -> d10=5 yapalim -> 10000000156
    expect(isValidTckn('10000000156')).toBe(false);
  });

  // 11. hane checksum hatasi
  it('11. hane checksum hatali TCKN numaralarini reddetmeli', () => {
    // 10000000146 gecerli, d11=6 -> d11=7 yapalim -> 10000000147
    expect(isValidTckn('10000000147')).toBe(false);
  });
});

// =====================================================================
// isValidTaxNumber (VKN veya TCKN) Testleri
// =====================================================================
describe('isValidTaxNumber', () => {
  it('gecerli VKN numarasini kabul etmeli', () => {
    expect(isValidTaxNumber('0010010180')).toBe(true);
  });

  it('gecerli TCKN numarasini kabul etmeli', () => {
    expect(isValidTaxNumber('10000000146')).toBe(true);
  });

  it('gecersiz uzunluktaki numaralari reddetmeli', () => {
    expect(isValidTaxNumber('123456789')).toBe(false);   // 9 hane
    expect(isValidTaxNumber('123456789012')).toBe(false); // 12 hane
    expect(isValidTaxNumber('')).toBe(false);
  });

  it('checksum hatali numaralari reddetmeli', () => {
    expect(isValidTaxNumber('1234567890')).toBe(false);
    expect(isValidTaxNumber('01234567890')).toBe(false);
  });

  it('null ve undefined icin false donmeli', () => {
    expect(isValidTaxNumber(null as unknown as string)).toBe(false);
    expect(isValidTaxNumber(undefined as unknown as string)).toBe(false);
  });
});
