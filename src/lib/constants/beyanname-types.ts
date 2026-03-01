/**
 * GİB E-Beyanname Types
 * Tüm beyanname türlerinin listesi ve açıklamaları
 */

export interface BeyannameType {
    code: string;
    name: string;
    category: 'KDV' | 'MUHTASAR' | 'GELIR' | 'KURUMLAR' | 'DIGER';
    priority: number; // Lower number = higher priority in lists
    searchPattern?: string; // Regex pattern for file name matching
}

export const BEYANNAME_TYPES: BeyannameType[] = [
    // === KDV TEVKİFATI (KDV1/KDV2'den ÖNCE olmalı - regex çakışması önlenir) ===
    {
        code: 'KDV9015',
        name: 'Katma Değer Vergisi Tevkifatı',
        category: 'KDV',
        priority: 10,
        searchPattern: 'KDV.*9015|KDV9015|TEVK[İI]FAT',
    },

    // === ÖNCELIKLI BEYANNAMELER ===
    {
        code: 'KDV1',
        name: 'Aylık KDV Beyannamesi 1',
        category: 'KDV',
        priority: 1,
        searchPattern: 'KDV.*1|KDV1',
    },
    {
        code: 'KDV2',
        name: 'Aylık KDV Beyannamesi 2',
        category: 'KDV',
        priority: 2,
        searchPattern: 'KDV.*2|KDV2',
    },
    {
        code: 'MUHSGK',
        name: 'Muhtasar ve SGK Prim Hizmet Beyannamesi',
        category: 'MUHTASAR',
        priority: 3,
        searchPattern: 'MUHSGK|MUHTASAR|SGK',
    },
    {
        code: 'GV',
        name: 'Gelir Vergisi Beyannamesi',
        category: 'GELIR',
        priority: 4,
        searchPattern: 'GEL[İI]R.*VERG[İI]S[İI]|^GV$',
    },
    {
        code: 'GGECICI',
        name: 'Gelir Vergisi Geçici Vergi Beyannamesi',
        category: 'GELIR',
        priority: 5,
        searchPattern: 'GEL[İI]R.*GE[ÇC][İI]C[İI]|GVG|GGEC[İI]C[İI]',
    },
    {
        code: 'KV',
        name: 'Kurumlar Vergisi Beyannamesi',
        category: 'KURUMLAR',
        priority: 6,
        searchPattern: 'KURUMLAR.*VERG[İI]S[İI]|^KV$',
    },
    {
        code: 'KGECICI',
        name: 'Kurumlar Vergisi Geçici Vergi Beyannamesi',
        category: 'KURUMLAR',
        priority: 7,
        searchPattern: 'KURUMLAR.*GE[ÇC][İI]C[İI]|KVG|KGEC[İI]C[İI]',
    },
    {
        code: 'BABS',
        name: 'BA-BS Bildirim Formu',
        category: 'DIGER',
        priority: 8,
        searchPattern: 'BA.*BS|BABS',
    },
    {
        code: 'DAMGA',
        name: 'Damga Vergisi Beyannamesi',
        category: 'DIGER',
        priority: 9,
        searchPattern: 'DAMGA',
    },

    // === DİĞER KDV BEYANNAMELERİ ===
    {
        code: 'KDV3A',
        name: '3 Aylık KDV Beyannamesi',
        category: 'KDV',
        priority: 11,
        searchPattern: 'KDV.*3|3.*AYLIK.*KDV',
    },
    {
        code: 'KDV9',
        name: 'KDV İadesi Talep Formu',
        category: 'KDV',
        priority: 12,
        searchPattern: 'KDV.*9|KDV.*[İI]ADE',
    },
    {
        code: 'MSURET',
        name: 'Motorlu Taşıtlar Vergisi Mükellefiyet Bildirimi',
        category: 'DIGER',
        priority: 13,
        searchPattern: 'MSURET|MOTORLU.*TA[ŞS][ıI]T',
    },

    // === ÖZEL TÜKETIM VERGİSİ ===
    {
        code: 'OTV301',
        name: 'ÖTV Tahakkuk ve Ödeme Beyannamesi (I Sayılı Liste)',
        category: 'DIGER',
        priority: 14,
        searchPattern: 'OTV.*301|[ÖO]TV.*I.*SAYIL[ıI]',
    },
    {
        code: 'OTV302',
        name: 'ÖTV Tahakkuk ve Ödeme Beyannamesi (II Sayılı Liste)',
        category: 'DIGER',
        priority: 15,
        searchPattern: 'OTV.*302|[ÖO]TV.*II.*SAYIL[ıI]',
    },
    {
        code: 'OTV303',
        name: 'ÖTV Tahakkuk ve Ödeme Beyannamesi (III Sayılı Liste)',
        category: 'DIGER',
        priority: 16,
        searchPattern: 'OTV.*303|[ÖO]TV.*III.*SAYIL[ıI]',
    },
    {
        code: 'OTV304',
        name: 'ÖTV Tahakkuk ve Ödeme Beyannamesi (IV Sayılı Liste)',
        category: 'DIGER',
        priority: 17,
        searchPattern: 'OTV.*304|[ÖO]TV.*IV.*SAYIL[ıI]',
    },

    // === STOPAJ VE DİĞER MUHTASAR ===
    {
        code: 'MUH',
        name: 'Muhtasar ve Prim Hizmet Beyannamesi',
        category: 'MUHTASAR',
        priority: 18,
        searchPattern: '^MUH$|MUHTASAR',
    },
    {
        code: 'SGKPRIM',
        name: 'SGK Prim ve Hizmet Belgesi',
        category: 'MUHTASAR',
        priority: 19,
        searchPattern: 'SGK.*PR[İI]M|SGKPRIM',
    },

    // === TURİZM VE KONAKLAMA ===
    {
        code: 'TURZ',
        name: 'Turizm Payı Beyannamesi',
        category: 'DIGER',
        priority: 20,
        searchPattern: 'TUR[İI]ZM|TURZ',
    },
    {
        code: 'KONK',
        name: 'Konaklama Vergisi Beyannamesi',
        category: 'DIGER',
        priority: 21,
        searchPattern: 'KONAKLAMA|KONK',
    },

    // === EK BEYANNAMELER ===
    {
        code: 'EMLAK',
        name: 'Emlak Vergisi Beyannamesi',
        category: 'DIGER',
        priority: 22,
        searchPattern: 'EMLAK',
    },
    {
        code: 'CEVRE',
        name: 'Çevre Temizlik Vergisi Beyannamesi',
        category: 'DIGER',
        priority: 23,
        searchPattern: '[ÇC]EVRE',
    },
    {
        code: 'BANKA',
        name: 'Banka ve Sigorta Muameleleri Vergisi',
        category: 'DIGER',
        priority: 24,
        searchPattern: 'BANKA|S[İI]GORTA',
    },
    {
        code: 'VERASET',
        name: 'Veraset ve İntikal Vergisi Beyannamesi',
        category: 'DIGER',
        priority: 25,
        searchPattern: 'VERASET|[İI]NT[İI]KAL',
    },
    {
        code: 'OZELISLEM',
        name: 'Özel İşlem Vergisi Beyannamesi',
        category: 'DIGER',
        priority: 26,
        searchPattern: '[ÖO]ZEL.*[İI][ŞS]LEM',
    },
    {
        code: 'MTV',
        name: 'Motorlu Taşıtlar Vergisi',
        category: 'DIGER',
        priority: 27,
        searchPattern: 'MTV|MOTORLU.*TA[ŞS][ıI]T.*VERG[İI]',
    },
    {
        code: 'GECICI',
        name: 'Geçici Vergi Beyannamesi',
        category: 'DIGER',
        priority: 28,
        searchPattern: 'GE[ÇC][İI]C[İI].*VERG[İI]',
    },
    {
        code: 'YILLIK',
        name: 'Yıllık Gelir Vergisi Beyannamesi',
        category: 'GELIR',
        priority: 29,
        searchPattern: 'YILLIK.*GEL[İI]R',
    },
];

// Helper functions
export function getBeyannameTypeByCode(code: string): BeyannameType | undefined {
    return BEYANNAME_TYPES.find(t => t.code === code);
}

export function getBeyannameTypesByCategory(category: BeyannameType['category']): BeyannameType[] {
    return BEYANNAME_TYPES.filter(t => t.category === category).sort((a, b) => a.priority - b.priority);
}

export function getAllBeyannameTypes(): BeyannameType[] {
    return [...BEYANNAME_TYPES].sort((a, b) => a.priority - b.priority);
}

export function getPriorityBeyannameTypes(): BeyannameType[] {
    return BEYANNAME_TYPES.filter(t => t.priority <= 9).sort((a, b) => a.priority - b.priority);
}

// For dropdown options
export const BEYANNAME_TYPE_OPTIONS = BEYANNAME_TYPES.map(t => ({
    value: t.code,
    label: `${t.code} - ${t.name}`,
    priority: t.priority,
})).sort((a, b) => a.priority - b.priority);

// Categories for grouping
export const BEYANNAME_CATEGORIES = [
    { value: 'KDV', label: 'KDV Beyannameleri' },
    { value: 'MUHTASAR', label: 'Muhtasar ve SGK' },
    { value: 'GELIR', label: 'Gelir Vergisi' },
    { value: 'KURUMLAR', label: 'Kurumlar Vergisi' },
    { value: 'DIGER', label: 'Diğer Beyannameler' },
] as const;

// Month options for filter
export const MONTH_OPTIONS = [
    { value: 1, label: 'Ocak' },
    { value: 2, label: 'Şubat' },
    { value: 3, label: 'Mart' },
    { value: 4, label: 'Nisan' },
    { value: 5, label: 'Mayıs' },
    { value: 6, label: 'Haziran' },
    { value: 7, label: 'Temmuz' },
    { value: 8, label: 'Ağustos' },
    { value: 9, label: 'Eylül' },
    { value: 10, label: 'Ekim' },
    { value: 11, label: 'Kasım' },
    { value: 12, label: 'Aralık' },
];

// Year options (current year ± 2 years)
const currentYear = new Date().getFullYear();
export const YEAR_OPTIONS = [
    { value: currentYear - 2, label: String(currentYear - 2) },
    { value: currentYear - 1, label: String(currentYear - 1) },
    { value: currentYear, label: String(currentYear) },
    { value: currentYear + 1, label: String(currentYear + 1) },
];
