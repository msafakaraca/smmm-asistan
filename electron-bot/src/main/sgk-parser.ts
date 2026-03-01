/**
 * SGK PDF Parser Module
 *
 * Hizmet Listesi ve Tahakkuk Fisi PDF'lerini parse eder.
 * Electron bot tarafinda calisir (Node.js ortami).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

// ═══════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════

export interface HizmetListesiParsed {
    year: number;
    month: number;
    onayTarihi: string | null;
    isciSayisi: number;
}

export interface TahakkukFisiParsed {
    year: number;
    month: number;
    kabulTarihi: string | null;
    isciSayisi: number;
    gunSayisi: number;
    netTutar: number;
}

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Base64 string'i Buffer'a cevir
 */
function base64ToBuffer(base64Data: string): Buffer {
    // "data:application/pdf;base64," prefix varsa kaldir
    const cleanBase64 = base64Data.replace(/^data:application\/pdf;base64,/, '');
    return Buffer.from(cleanBase64, 'base64');
}

/**
 * Turk parasini sayiya cevir
 * Ornek: "1.234,56" -> 1234.56
 */
function parseTurkishNumber(str: string): number {
    if (!str) return 0;
    // Noktalari kaldir, virgucu noktaya cevir
    const cleaned = str.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

/**
 * Tarih stringini parse et
 * Formatlar: "15.01.2025", "15/01/2025", "2025-01-15"
 */
function parseDate(str: string): string | null {
    if (!str) return null;

    // DD.MM.YYYY veya DD/MM/YYYY
    const turkishMatch = str.match(/(\d{2})[\.\/](\d{2})[\.\/](\d{4})/);
    if (turkishMatch) {
        const [, day, month, year] = turkishMatch;
        return `${year}-${month}-${day}`;
    }

    // YYYY-MM-DD (ISO)
    const isoMatch = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return str;
    }

    return null;
}

/**
 * Donem bilgisini parse et (yil/ay)
 * Formatlar: "2025/01", "01/2025", "OCAK 2025", "2025 OCAK"
 *
 * NOT: Sicil numarasi formatlarini (6001-61/000) yakalamamasi icin
 * sadece makul yil araligi (2020-2030) ve ay araligi (1-12) kabul edilir
 */
function parseDonem(text: string): { year: number; month: number } | null {
    // YYYY/MM formatı - sadece makul yillar (2020-2030)
    const yyyyMmMatch = text.match(/\b(20[2-3]\d)[\/](\d{1,2})\b/);
    if (yyyyMmMatch) {
        const year = parseInt(yyyyMmMatch[1]);
        const month = parseInt(yyyyMmMatch[2]);
        // Ay 1-12 arasi olmali
        if (month >= 1 && month <= 12) {
            return { year, month };
        }
    }

    // MM/YYYY formatı - sadece makul yillar
    const mmYyyyMatch = text.match(/\b(\d{1,2})[\/](20[2-3]\d)\b/);
    if (mmYyyyMatch) {
        const month = parseInt(mmYyyyMatch[1]);
        const year = parseInt(mmYyyyMatch[2]);
        // Ay 1-12 arasi olmali
        if (month >= 1 && month <= 12) {
            return { year, month };
        }
    }

    // Türkçe ay isimleri
    const aylar: Record<string, number> = {
        'OCAK': 1, 'SUBAT': 2, 'ŞUBAT': 2, 'MART': 3, 'NISAN': 4, 'NİSAN': 4,
        'MAYIS': 5, 'HAZIRAN': 6, 'HAZİRAN': 6, 'TEMMUZ': 7, 'AGUSTOS': 8, 'AĞUSTOS': 8,
        'EYLUL': 9, 'EYLÜL': 9, 'EKIM': 10, 'EKİM': 10, 'KASIM': 11, 'ARALIK': 12
    };

    const upperText = text.toUpperCase();
    for (const [ayAd, ayNo] of Object.entries(aylar)) {
        const ayYilMatch = upperText.match(new RegExp(`${ayAd}\\s*(20[2-3]\\d)`));
        if (ayYilMatch) {
            return { year: parseInt(ayYilMatch[1]), month: ayNo };
        }
        const yilAyMatch = upperText.match(new RegExp(`(20[2-3]\\d)\\s*${ayAd}`));
        if (yilAyMatch) {
            return { year: parseInt(yilAyMatch[1]), month: ayNo };
        }
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PARSER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Hizmet Listesi PDF'ini parse et
 *
 * Aranacak bilgiler:
 * - Donem (Yil/Ay)
 * - Onay Tarihi
 * - Isci Sayisi (TOPLAM satir sayisi veya "X Kisi" gibi ifadeler)
 */
// Debug mode - set GIB_DEBUG=true for verbose logging
const DEBUG_PARSER = process.env.GIB_DEBUG === 'true';

export async function parseHizmetListesi(base64Data: string): Promise<HizmetListesiParsed | null> {
    try {
        const buffer = base64ToBuffer(base64Data);
        const data = await pdfParse(buffer);
        const text = data.text;

        if (!text || text.length < 50) {
            return null;
        }

        let year = 0;
        let month = 0;
        let onayTarihi: string | null = null;
        let isciSayisi = 0;

        // 1. Donem bilgisi - SGK Hizmet Listesi icin ozel formatlar
        // Format 1: "Yıl - Ay" label'i sonrasi (satir sonunda veya sonraki satirda)
        // Ornek: "Yıl - Ay\n...\n2025/12"
        const yilAyLabelMatch = text.match(/Y[ıi]l\s*-\s*Ay[\s\S]{0,50}?(20[2-3]\d)[\/](\d{1,2})/i);
        if (yilAyLabelMatch) {
            const parsedYear = parseInt(yilAyLabelMatch[1]);
            const parsedMonth = parseInt(yilAyLabelMatch[2]);
            if (parsedMonth >= 1 && parsedMonth <= 12) {
                year = parsedYear;
                month = parsedMonth;
            }
        }

        // Format 2: "Dönem: 2025/01" veya "DÖNEM : 01/2025"
        if (year === 0) {
            const donemMatch = text.match(/D[ÖO]NEM\s*[:\s]+([^\n\r]+)/i);
            if (donemMatch) {
                const donem = parseDonem(donemMatch[1]);
                if (donem) {
                    year = donem.year;
                    month = donem.month;
                }
            }
        }

        // Format 3: "AİT OLDUĞU YIL / AY" sonrasi (SGK tahakkuk formatı)
        if (year === 0) {
            const aitOlduguMatch = text.match(/A[İI]T\s*OLDU[GĞ]U\s*Y[IİI]L\s*[\/\s]*AY[\s\S]{0,30}?(20[2-3]\d)[\/](\d{1,2})/i);
            if (aitOlduguMatch) {
                const parsedYear = parseInt(aitOlduguMatch[1]);
                const parsedMonth = parseInt(aitOlduguMatch[2]);
                if (parsedMonth >= 1 && parsedMonth <= 12) {
                    year = parsedYear;
                    month = parsedMonth;
                }
            }
        }

        // Fallback: Text icinde YYYY/MM formatini ara (sicil numaralarini haric tut)
        if (year === 0) {
            const donem = parseDonem(text);
            if (donem) {
                year = donem.year;
                month = donem.month;
            }
        }

        // 2. Onay Tarihi
        // "Onay Tarihi: 15.02.2025" veya "ONAYLAMA TARİHİ: 15/02/2025"
        const onayMatch = text.match(/ONAY(?:LAMA)?\s*TAR[İI]H[İI]\s*[:\s]+([0-9\.\/\-]+)/i);
        if (onayMatch) {
            onayTarihi = parseDate(onayMatch[1]);
        }

        // 3. Isci Sayisi - Birden fazla yontem dene (oncelik sirasina gore)
        // YONTEM 1: Yapışık format (Sno + TC + Ad)
        const yapisikPattern = /(\d{1,2})(\d{11})([A-ZÇĞİÖŞÜa-zçğıöşü]{2,})/g;
        const yapisikMatches = [...text.matchAll(yapisikPattern)];

        if (yapisikMatches.length > 0) {
            const snoNumaralari = yapisikMatches.map(m => parseInt(m[1]));
            const maxSno = Math.max(...snoNumaralari);
            if (maxSno >= 1 && maxSno <= 500) {
                isciSayisi = maxSno;
            }
        }

        // YONTEM 2: Bosluklu format
        if (isciSayisi === 0) {
            const snoPattern = /^\s*(\d{1,3})\s+\d{11}\s+/gm;
            const snoMatches = text.match(snoPattern);
            if (snoMatches && snoMatches.length > 0) {
                const snoNumaralari = snoMatches.map((m: string) => {
                    const match = m.match(/^\s*(\d{1,3})/);
                    return match ? parseInt(match[1]) : 0;
                });
                const maxSno = Math.max(...snoNumaralari);
                if (maxSno >= 1 && maxSno <= 500) {
                    isciSayisi = maxSno;
                }
            }
        }

        // YONTEM 3: Unique TC sayimi
        if (isciSayisi === 0) {
            const tcPattern = /[1-9]\d{10}/g;
            const tcMatches = text.match(tcPattern);
            if (tcMatches) {
                const uniqueTcs = Array.from(new Set(tcMatches)) as string[];
                const validTcs = uniqueTcs.filter((tc) => {
                    const ilkIki = parseInt(tc.substring(0, 2));
                    return ilkIki >= 10 && ilkIki <= 99;
                });
                if (validTcs.length > 0 && validTcs.length <= 500) {
                    isciSayisi = validTcs.length;
                }
            }
        }

        // YONTEM 4: Label pattern
        if (isciSayisi === 0) {
            const labelPatterns = [
                /S[İI]GORTALI\s*SAYISI\s*[:\s]*(\d+)/i,
                /K[İI][SŞ][İI]\s*SAYISI\s*[:\s]*(\d+)/i,
                /(\d+)\s*K[İI][SŞ][İI]/i
            ];
            for (const pattern of labelPatterns) {
                const match = text.match(pattern);
                if (match) {
                    const sayi = parseInt(match[1]);
                    if (sayi >= 1 && sayi <= 500) {
                        isciSayisi = sayi;
                        break;
                    }
                }
            }
        }

        // Debug log (only when DEBUG_PARSER is true)
        if (DEBUG_PARSER) {
            console.log(`[SGK-PARSER] Hizmet Listesi: ${year}/${month}, İşçi=${isciSayisi}`);
        }

        // En az bir bilgi bulduysa dondur
        if (year > 0 || isciSayisi > 0) {
            return { year, month, onayTarihi, isciSayisi };
        }

        return null;

    } catch (error) {
        console.error('[SGK-PARSER] Hizmet Listesi parse hatasi:', error);
        return null;
    }
}

/**
 * SGK Tahakkuk Fisi PDF'ini parse et
 *
 * ONEMLI: Sadece SGK tahakkukunu parse eder!
 * KDV/Gelir Vergisi tahakkukları reddedilir.
 *
 * SGK Tahakkuk Fisi icerikleri:
 * - "SOSYAL GÜVENLİK KURUMU" veya "SİGORTA PRİMLERİ GENEL MÜDÜRLÜĞÜ"
 * - AİT OLDUĞU YIL / AY: 2025/12
 * - BELGE KABUL TARİHİ: 16.01.2026
 * - Sigortalı Sayısı, Prim Günü, Net Tutar
 */
export async function parseTahakkukFisi(base64Data: string): Promise<TahakkukFisiParsed | null> {
    try {
        const buffer = base64ToBuffer(base64Data);
        const data = await pdfParse(buffer);
        const text = data.text;

        if (!text || text.length < 50) {
            return null;
        }

        // SGK Tahakkuk kontrolu - KDV/Vergi tahakkuklarini reddet
        const isSgkTahakkuk =
            text.includes('SOSYAL GÜVENLİK KURUMU') ||
            text.includes('SOSYAL GUVENLIK KURUMU') ||
            text.includes('SİGORTA PRİMLERİ') ||
            text.includes('SIGORTA PRIMLERI') ||
            text.includes('SGK') ||
            text.includes('5510');

        const isVergiTahakkuk =
            text.includes('HAZİNE VE MALİYE') ||
            text.includes('HAZINE VE MALIYE') ||
            text.includes('KATMA DEĞER VERGİSİ') ||
            text.includes('GELİR VERGİSİ') ||
            text.includes('MUHTASAR');

        if (isVergiTahakkuk && !isSgkTahakkuk) {
            return null;
        }

        if (!isSgkTahakkuk) {
            return null;
        }

        let year = 0;
        let month = 0;
        let kabulTarihi: string | null = null;
        let isciSayisi = 0;
        let gunSayisi = 0;
        let netTutar = 0;

        // 1. Donem bilgisi - SGK Tahakkuk ozel formati
        // "AİT OLDUĞU YIL / AY: 2025/12" veya yakininda
        const aitOlduguMatch = text.match(/A[İI]T\s*OLDU[GĞ]U\s*Y[IİI]L\s*[\/\s]*AY[\s\S]{0,50}?(20[2-3]\d)[\/](\d{1,2})/i);
        if (aitOlduguMatch) {
            const parsedYear = parseInt(aitOlduguMatch[1]);
            const parsedMonth = parseInt(aitOlduguMatch[2]);
            if (parsedMonth >= 1 && parsedMonth <= 12) {
                year = parsedYear;
                month = parsedMonth;
            }
        }

        // Alternatif: Genel donem formati
        if (year === 0) {
            const donemMatch = text.match(/D[ÖO]NEM\s*[:\s]+([^\n\r]+)/i);
            if (donemMatch) {
                const donem = parseDonem(donemMatch[1]);
                if (donem) {
                    year = donem.year;
                    month = donem.month;
                }
            }
        }

        // Fallback
        if (year === 0) {
            const donem = parseDonem(text);
            if (donem) {
                year = donem.year;
                month = donem.month;
            }
        }

        // 2. Kabul Tarihi
        const tarihPattern = /(\d{2}\.\d{2}\.\d{4})/g;
        const tumTarihler = [...text.matchAll(tarihPattern)];

        const belgeKabulIndex = text.indexOf('BELGE KABUL TAR');
        if (belgeKabulIndex !== -1) {
            const sonrakiText = text.substring(belgeKabulIndex);
            const ilkTarihMatch = sonrakiText.match(/(\d{2}\.\d{2}\.\d{4})/);
            if (ilkTarihMatch) {
                kabulTarihi = parseDate(ilkTarihMatch[1]);
            }
        }

        if (!kabulTarihi && tumTarihler.length > 0) {
            for (const tarihMatch of tumTarihler) {
                const tarih = tarihMatch[1];
                const yil = parseInt(tarih.split('.')[2]);
                if (yil >= 2025) {
                    kabulTarihi = parseDate(tarih);
                    break;
                }
            }
        }

        // 3. Isci Sayisi
        const kisiPatterns = [
            /K[İI][SŞ][İI]\s*SAYISI\s*[:\s]*(\d+)/i,
            /K[İI][SŞ][İI]\s*SAYISI:(\d+)/i,
            /S[İI]GORTALI\s*SAYISI\s*[:\s]*(\d+)/i
        ];

        for (const pattern of kisiPatterns) {
            const match = text.match(pattern);
            if (match) {
                isciSayisi = parseInt(match[1]);
                break;
            }
        }

        // 4. Gun Sayisi
        const gunSayisiIndex = text.search(/G[ÜU]N\s*SAYISI\s*:/i);
        if (gunSayisiIndex !== -1) {
            const sonrakiText = text.substring(gunSayisiIndex);
            const gunMatch = sonrakiText.match(/\b(30|[12]?\d)\b/);
            if (gunMatch) {
                const gun = parseInt(gunMatch[1]);
                if (gun >= 1 && gun <= 31) {
                    gunSayisi = gun;
                }
            }
        }

        if (gunSayisi === 0) {
            const kisiGunMatch = text.match(/K[İI][SŞ][İI]\s*SAYISI\s*[:\s]*\d+[\s\n]+(\d{1,2})\b/i);
            if (kisiGunMatch) {
                const gun = parseInt(kisiGunMatch[1]);
                if (gun >= 1 && gun <= 31) {
                    gunSayisi = gun;
                }
            }
        }

        // 5. Net Tutar - En son tutar stratejisi
        const tutarPattern = /(\d{1,3}(?:\.\d{3})*,\d{2})/g;
        const tumTutarlar = text.match(tutarPattern);

        if (tumTutarlar && tumTutarlar.length > 0) {
            const sonTutar = tumTutarlar[tumTutarlar.length - 1];
            netTutar = parseTurkishNumber(sonTutar);
        }

        // Debug log
        if (DEBUG_PARSER) {
            console.log(`[SGK-PARSER] Tahakkuk: ${year}/${month}, İşçi=${isciSayisi}, Gün=${gunSayisi}, Tutar=${netTutar}`);
        }

        // En az bir bilgi bulduysa dondur
        if (year > 0 || netTutar > 0 || isciSayisi > 0) {
            return { year, month, kabulTarihi, isciSayisi, gunSayisi, netTutar };
        }

        return null;

    } catch (error) {
        console.error('[SGK-PARSER] Tahakkuk Fisi parse hatasi:', error);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// TEST FUNCTION (Development only)
// ═══════════════════════════════════════════════════════════════════

export async function testParser() {
    console.log('[SGK-PARSER] Test mode - Parser hazir');
}
