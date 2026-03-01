// Gelir vergisi dilimleri ve hesaplama fonksiyonları
// Kaynak: Gelir Vergisi Kanunu, yıllık güncellemeler

interface VergiDilimi {
    limit: number;
    rate: number;
}

// Ücret gelirleri için vergi dilimleri (yıl bazında)
const UCRET_VERGI_DILIMLERI: Record<number, VergiDilimi[]> = {
    2026: [
        { limit: 190_000, rate: 0.15 },
        { limit: 400_000, rate: 0.20 },
        { limit: 1_500_000, rate: 0.27 },
        { limit: 5_300_000, rate: 0.35 },
        { limit: Infinity, rate: 0.40 },
    ],
    2025: [
        { limit: 158_000, rate: 0.15 },
        { limit: 330_000, rate: 0.20 },
        { limit: 1_200_000, rate: 0.27 },
        { limit: 4_300_000, rate: 0.35 },
        { limit: Infinity, rate: 0.40 },
    ],
    2024: [
        { limit: 110_000, rate: 0.15 },
        { limit: 230_000, rate: 0.20 },
        { limit: 870_000, rate: 0.27 },
        { limit: 3_000_000, rate: 0.35 },
        { limit: Infinity, rate: 0.40 },
    ],
    2023: [
        { limit: 70_000, rate: 0.15 },
        { limit: 150_000, rate: 0.20 },
        { limit: 550_000, rate: 0.27 },
        { limit: 1_900_000, rate: 0.35 },
        { limit: Infinity, rate: 0.40 },
    ],
    2022: [
        { limit: 32_000, rate: 0.15 },
        { limit: 70_000, rate: 0.20 },
        { limit: 250_000, rate: 0.27 },
        { limit: 880_000, rate: 0.35 },
        { limit: Infinity, rate: 0.40 },
    ],
    2021: [
        { limit: 24_000, rate: 0.15 },
        { limit: 53_000, rate: 0.20 },
        { limit: 190_000, rate: 0.27 },
        { limit: 650_000, rate: 0.35 },
        { limit: Infinity, rate: 0.40 },
    ],
    2020: [
        { limit: 22_000, rate: 0.15 },
        { limit: 49_000, rate: 0.20 },
        { limit: 180_000, rate: 0.27 },
        { limit: 600_000, rate: 0.35 },
        { limit: Infinity, rate: 0.40 },
    ],
};

// Ücret dışı gelirler için vergi dilimleri
const UCRET_DISI_VERGI_DILIMLERI: Record<number, VergiDilimi[]> = {
    2026: [
        { limit: 190_000, rate: 0.15 },
        { limit: 400_000, rate: 0.20 },
        { limit: 1_000_000, rate: 0.27 },
        { limit: 5_300_000, rate: 0.35 },
        { limit: Infinity, rate: 0.40 },
    ],
    2025: [
        { limit: 158_000, rate: 0.15 },
        { limit: 330_000, rate: 0.20 },
        { limit: 800_000, rate: 0.27 },
        { limit: 4_300_000, rate: 0.35 },
        { limit: Infinity, rate: 0.40 },
    ],
};

function getDilimler(yil: number, isUcret: boolean): VergiDilimi[] {
    const kaynak = isUcret ? UCRET_VERGI_DILIMLERI : UCRET_DISI_VERGI_DILIMLERI;
    // Yıl bulunamazsa en yakın yılı kullan
    if (kaynak[yil]) return kaynak[yil];
    const years = Object.keys(kaynak).map(Number).sort((a, b) => b - a);
    return kaynak[years[0]] || kaynak[2026];
}

// Kümülatif matraha dayalı olmayan vergi hesaplama
export function hesaplaGelirVergisi(
    yil: number,
    gelir: number,
    isUcret: boolean = true
): number {
    if (gelir <= 0) return 0;

    const dilimler = getDilimler(yil, isUcret);
    let vergi = 0;
    let kalanGelir = gelir;
    let oncekiLimit = 0;

    for (const dilim of dilimler) {
        if (kalanGelir <= 0) break;
        const dilimGenisligi = dilim.limit - oncekiLimit;
        const buDilimdekiGelir = Math.min(kalanGelir, dilimGenisligi);
        vergi += buDilimdekiGelir * dilim.rate;
        kalanGelir -= buDilimdekiGelir;
        oncekiLimit = dilim.limit;
    }

    return vergi;
}

// Kümülatif matraha dayalı vergi hesaplama
// Toplam matrahtan önceki matrahın vergisini çıkarır
export function hesaplaGelirVergisiKumulatif(
    yil: number,
    gelir: number,
    kumulatifMatrah: number,
    isUcret: boolean = true
): number {
    if (gelir <= 0) return 0;

    const toplamMatrah = kumulatifMatrah + gelir;
    const toplamVergi = hesaplaGelirVergisi(yil, toplamMatrah, isUcret);
    const oncekiVergi = hesaplaGelirVergisi(yil, kumulatifMatrah, isUcret);

    return toplamVergi - oncekiVergi;
}
