// Kıdem ve ihbar tazminatı sabitleri
// Kaynak: Çalışma ve Sosyal Güvenlik Bakanlığı, Hazine ve Maliye Bakanlığı

// Kıdem tazminatı tavanları (dönem bazında)
export interface KidemTavani {
    baslangic: string; // YYYY-MM-DD
    bitis: string;     // YYYY-MM-DD
    tutar: number;
}

export const KIDEM_TAVANLARI: KidemTavani[] = [
    { baslangic: "2026-01-01", bitis: "2026-06-30", tutar: 64948.77 },
    { baslangic: "2025-07-01", bitis: "2025-12-31", tutar: 53919.89 },
    { baslangic: "2025-01-01", bitis: "2025-06-30", tutar: 47832.29 },
    { baslangic: "2024-07-01", bitis: "2024-12-31", tutar: 41828.42 },
    { baslangic: "2024-01-01", bitis: "2024-06-30", tutar: 35058.58 },
    { baslangic: "2023-07-01", bitis: "2023-12-31", tutar: 23489.83 },
    { baslangic: "2023-01-01", bitis: "2023-06-30", tutar: 19982.83 },
    { baslangic: "2022-07-01", bitis: "2022-12-31", tutar: 15371.40 },
    { baslangic: "2022-01-01", bitis: "2022-06-30", tutar: 10848.59 },
    { baslangic: "2021-07-01", bitis: "2021-12-31", tutar: 8651.52 },
    { baslangic: "2021-01-01", bitis: "2021-06-30", tutar: 7638.96 },
    { baslangic: "2020-07-01", bitis: "2020-12-31", tutar: 7117.17 },
    { baslangic: "2020-01-01", bitis: "2020-06-30", tutar: 6730.15 },
    { baslangic: "2019-07-01", bitis: "2019-12-31", tutar: 6379.86 },
    { baslangic: "2019-01-01", bitis: "2019-06-30", tutar: 6017.60 },
    { baslangic: "2018-07-01", bitis: "2018-12-31", tutar: 5434.42 },
    { baslangic: "2018-01-01", bitis: "2018-06-30", tutar: 5001.76 },
    { baslangic: "2017-07-01", bitis: "2017-12-31", tutar: 4732.48 },
    { baslangic: "2017-01-01", bitis: "2017-06-30", tutar: 4426.16 },
    { baslangic: "2016-07-01", bitis: "2016-12-31", tutar: 4297.21 },
    { baslangic: "2016-01-01", bitis: "2016-06-30", tutar: 4092.53 },
    { baslangic: "2015-07-01", bitis: "2015-12-31", tutar: 3828.37 },
    { baslangic: "2015-01-01", bitis: "2015-06-30", tutar: 3541.37 },
    { baslangic: "2014-07-01", bitis: "2014-12-31", tutar: 3438.22 },
    { baslangic: "2014-01-01", bitis: "2014-06-30", tutar: 3254.44 },
    { baslangic: "2013-07-01", bitis: "2013-12-31", tutar: 3254.44 },
    { baslangic: "2013-01-01", bitis: "2013-06-30", tutar: 3129.25 },
    { baslangic: "2012-07-01", bitis: "2012-12-31", tutar: 3033.98 },
    { baslangic: "2012-01-01", bitis: "2012-06-30", tutar: 2917.27 },
    { baslangic: "2011-07-01", bitis: "2011-12-31", tutar: 2731.85 },
    { baslangic: "2011-01-01", bitis: "2011-06-30", tutar: 2623.23 },
    { baslangic: "2010-07-01", bitis: "2010-12-31", tutar: 2517.01 },
    { baslangic: "2010-01-01", bitis: "2010-06-30", tutar: 2427.04 },
    { baslangic: "2009-07-01", bitis: "2009-12-31", tutar: 2365.16 },
    { baslangic: "2009-01-01", bitis: "2009-06-30", tutar: 2260.05 },
    { baslangic: "2008-07-01", bitis: "2008-12-31", tutar: 2173.19 },
    { baslangic: "2008-01-01", bitis: "2008-06-30", tutar: 2030.19 },
    { baslangic: "2007-07-01", bitis: "2007-12-31", tutar: 1960.69 },
    { baslangic: "2007-01-01", bitis: "2007-06-30", tutar: 1857.44 },
    { baslangic: "2006-07-01", bitis: "2006-12-31", tutar: 1770.62 },
    { baslangic: "2006-01-01", bitis: "2006-06-30", tutar: 1727.15 },
    { baslangic: "2005-07-01", bitis: "2005-12-31", tutar: 1648.90 },
    { baslangic: "2005-01-01", bitis: "2005-06-30", tutar: 1600.81 },
];

// İhbar süreleri (İş Kanunu md. 17)
export interface IhbarSuresi {
    minAy: number;   // Minimum çalışma süresi (ay)
    maxAy: number;   // Maximum çalışma süresi (ay)
    hafta: number;    // İhbar süresi (hafta)
    gun: number;      // İhbar süresi (gün)
    aciklama: string;
}

export const IHBAR_SURELERI: IhbarSuresi[] = [
    { minAy: 0, maxAy: 6, hafta: 2, gun: 14, aciklama: "6 aydan az" },
    { minAy: 6, maxAy: 18, hafta: 4, gun: 28, aciklama: "6 ay - 1.5 yıl" },
    { minAy: 18, maxAy: 36, hafta: 6, gun: 42, aciklama: "1.5 yıl - 3 yıl" },
    { minAy: 36, maxAy: Infinity, hafta: 8, gun: 56, aciklama: "3 yıldan fazla" },
];

// Damga vergisi oranı (binde 7.59)
export const DAMGA_VERGISI_ORANI = 0.00759;

// 2026 asgari ücret bilgileri
export const ASGARI_UCRET_2026 = {
    brut: 33_030,
    net: 28_075.50,
};
