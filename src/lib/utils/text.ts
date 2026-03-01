/**
 * Türkçe locale ile küçük harfe çevirir
 */
function turkishLowerCase(str: string): string {
    return str
        .replace(/I/g, "ı")
        .replace(/İ/g, "i")
        .replace(/Ş/g, "ş")
        .replace(/Ğ/g, "ğ")
        .replace(/Ü/g, "ü")
        .replace(/Ö/g, "ö")
        .replace(/Ç/g, "ç")
        .toLowerCase();
}

/**
 * Türkçe locale ile büyük harfe çevirir
 */
function turkishUpperCase(char: string): string {
    if (char === "i") return "İ";
    if (char === "ı") return "I";
    if (char === "ş") return "Ş";
    if (char === "ğ") return "Ğ";
    if (char === "ü") return "Ü";
    if (char === "ö") return "Ö";
    if (char === "ç") return "Ç";
    return char.toUpperCase();
}

/**
 * Yaygın Türkçe yazım hatalarını düzeltir
 */
function fixTurkishSpelling(str: string): string {
    const corrections: Record<string, string> = {
        // Şirket tipleri
        "sirketi": "şirketi",
        "limited": "limited",
        "anonim": "anonim",
        "kollektif": "kollektif",
        "komandit": "komandit",

        // Yaygın kelimeler
        "insaat": "inşaat",
        "nakliyat": "nakliyat",
        "nakliye": "nakliye",
        "otomotiv": "otomotiv",
        "turizm": "turizm",
        "tekstil": "tekstil",
        "gida": "gıda",
        "tarim": "tarım",
        "saglik": "sağlık",
        "egitim": "eğitim",
        "danismanlik": "danışmanlık",
        "muhendislik": "mühendislik",
        "mimarlik": "mimarlık",
        "yazilim": "yazılım",
        "bilisim": "bilişim",
        "elektrik": "elektrik",
        "elektronik": "elektronik",
        "makina": "makina",
        "makine": "makine",
        "mobilya": "mobilya",
        "dekorasyon": "dekorasyon",
        "taahhut": "taahhüt",
        "ticaret": "ticaret",
        "sanayi": "sanayi",
        "uretim": "üretim",
        "ithalat": "ithalat",
        "ihracat": "ihracat",
        "pazarlama": "pazarlama",
        "reklamcilik": "reklamcılık",
        "matbaacilik": "matbaacılık",
        "yayincilik": "yayıncılık",
        "aracilik": "aracılık",
        "sigortacilik": "sigortacılık",
        "tasimacilik": "taşımacılık",
        "lojistik": "lojistik",
        "depolama": "depolama",
        "gumruk": "gümrük",
        "musavirlik": "müşavirlik",
        "avukatlik": "avukatlık",
        "muhasebe": "muhasebe",
        "denetim": "denetim",
        "yatirim": "yatırım",
        "finansman": "finansman",
        "leasing": "leasing",
        "faktoring": "faktoring",
        "holding": "holding",
        "grup": "grup",
        "sirketler": "şirketler",
        "ortaklik": "ortaklık",
        "isletme": "işletme",
        "isletmeleri": "işletmeleri",
        "hizmetleri": "hizmetleri",
        "urunleri": "ürünleri",
        "sistemleri": "sistemleri",
        "cozumleri": "çözümleri",
        "teknolojileri": "teknolojileri",
        "endustriyel": "endüstriyel",
        "endustri": "endüstri",
        "kimya": "kimya",
        "plastik": "plastik",
        "metal": "metal",
        "celik": "çelik",
        "demir": "demir",
        "aluminyum": "alüminyum",
        "bakir": "bakır",
        "madencilik": "madencilik",
        "mermer": "mermer",
        "granit": "granit",
        "seramik": "seramik",
        "cam": "cam",
        "kagit": "kağıt",
        "ambalaj": "ambalaj",
        "boya": "boya",
        "vernik": "vernik",
        "ilac": "ilaç",
        "eczacilik": "eczacılık",
        "tibbi": "tıbbi",
        "kozmetik": "kozmetik",
        "parfumeri": "parfümeri",
        "temizlik": "temizlik",
        "hijyen": "hijyen",
        "guvenlik": "güvenlik",
        "ozel": "özel",
        "genel": "genel",
        "merkez": "merkez",
        "sube": "şube",
        "magaza": "mağaza",
        "market": "market",
        "restoran": "restoran",
        "lokanta": "lokanta",
        "otel": "otel",
        "pansiyon": "pansiyon",
        "konaklama": "konaklama",
        "emlak": "emlak",
        "gayrimenkul": "gayrimenkul",
        "yapi": "yapı",
        "konut": "konut",
        "villa": "villa",
        "residence": "residence",
        "plaza": "plaza",
        "is": "iş",
        "isi": "işi",
        "isleri": "işleri",

        // Şehir isimleri
        "istanbul": "istanbul",
        "ankara": "ankara",
        "izmir": "izmir",
        "bursa": "bursa",
        "antalya": "antalya",
        "adana": "adana",
        "konya": "konya",
        "gaziantep": "gaziantep",
        "sanliurfa": "şanlıurfa",
        "diyarbakir": "diyarbakır",
        "mersin": "mersin",
        "kayseri": "kayseri",
        "eskisehir": "eskişehir",
        "gebze": "gebze",
        "denizli": "denizli",
        "samsun": "samsun",
        "malatya": "malatya",
        "kahramanmaras": "kahramanmaraş",
        "erzurum": "erzurum",
        "van": "van",
        "batman": "batman",
        "elazig": "elazığ",
        "manisa": "manisa",
        "balikesir": "balıkesir",
        "kocaeli": "kocaeli",
        "sakarya": "sakarya",
        "tekirdag": "tekirdağ",
        "trabzon": "trabzon",
        "aydin": "aydın",
        "mugla": "muğla",
        "hatay": "hatay",
        "afyon": "afyon",
        "kutahya": "kütahya",
        "usak": "uşak",
        "isparta": "ısparta",
        "burdur": "burdur",
        "aksaray": "aksaray",
        "nevsehir": "nevşehir",
        "nigde": "niğde",
        "kirsehir": "kırşehir",
        "kirikkale": "kırıkkale",
        "corum": "çorum",
        "tokat": "tokat",
        "yozgat": "yozgat",
        "sivas": "sivas",
        "giresun": "giresun",
        "ordu": "ordu",
        "rize": "rize",
        "artvin": "artvin",
        "gumushane": "gümüşhane",
        "bayburt": "bayburt",
        "agri": "ağrı",
        "kars": "kars",
        "igdir": "iğdır",
        "ardahan": "ardahan",
        "mus": "muş",
        "bitlis": "bitlis",
        "siirt": "siirt",
        "sirnak": "şırnak",
        "hakkari": "hakkari",
        "bingol": "bingöl",
        "tunceli": "tunceli",
        "mardin": "mardin",
        "adiyaman": "adıyaman",
        "kilis": "kilis",
        "osmaniye": "osmaniye",
        "zonguldak": "zonguldak",
        "bartin": "bartın",
        "karabuk": "karabük",
        "kastamonu": "kastamonu",
        "sinop": "sinop",
        "cankiri": "çankırı",
        "bolu": "bolu",
        "duzce": "düzce",
        "bilecik": "bilecik",
        "canakkale": "çanakkale",
        "edirne": "edirne",
        "kirklareli": "kırklareli",
        "yalova": "yalova",
    };

    let result = str;
    for (const [wrong, correct] of Object.entries(corrections)) {
        const regex = new RegExp(`\\b${wrong}\\b`, "gi");
        result = result.replace(regex, correct);
    }
    return result;
}

/**
 * Metni Title Case formatına dönüştürür (her kelimenin baş harfi büyük)
 * Türkçe karakterleri destekler
 */
export function toTitleCase(str: string | null | undefined): string {
    if (!str) return "";

    // Önce Türkçe locale ile küçük harfe çevir
    let processed = turkishLowerCase(str);

    // Yaygın Türkçe yazım hatalarını düzelt
    processed = fixTurkishSpelling(processed);

    return processed
        .split(" ")
        .map(word => {
            if (word.length === 0) return word;

            // Kelime içindeki noktalardan sonraki harfleri de büyük yap
            // Örn: "ltd." -> "Ltd.", "a.ş." -> "A.Ş."
            let result = "";
            let capitalizeNext = true;

            for (let i = 0; i < word.length; i++) {
                const char = word.charAt(i);

                if (capitalizeNext && /[a-zçğıöşüi]/i.test(char)) {
                    result += turkishUpperCase(char);
                    capitalizeNext = false;
                } else {
                    result += char;
                }

                // Noktadan sonra büyük harf yap
                if (char === ".") {
                    capitalizeNext = true;
                }
            }

            return result;
        })
        .join(" ");
}

/**
 * Unvan'ı normalize eder - Title Case formatına dönüştürür
 */
export function normalizeUnvan(unvan: string | null | undefined): string {
    return toTitleCase(unvan);
}
