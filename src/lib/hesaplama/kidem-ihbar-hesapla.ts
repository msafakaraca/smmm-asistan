// Kıdem ve ihbar tazminatı hesaplama fonksiyonları (pure functions)

import {
    KIDEM_TAVANLARI,
    IHBAR_SURELERI,
    DAMGA_VERGISI_ORANI,
    ASGARI_UCRET_2026,
} from "./kidem-ihbar-sabitleri";
import { hesaplaGelirVergisiKumulatif } from "./gelir-vergisi";

// --- Tipler ---

export interface CalismaSuresi {
    yil: number;
    ay: number;
    gun: number;
    toplamAy: number;
}

export interface KidemSonuc {
    calismaSuresi: CalismaSuresi;
    brutUcret: number;
    kidemTavani: number;
    kidemEsasBrutUcret: number; // min(brutUcret, tavan)
    brutKidemTazminati: number;
    damgaVergisi: number;
    netKidemTazminati: number;
    // İstisna uygulanmış (7194 sayılı kanun)
    istisnaTutari: number;
    istisnaliDamgaVergisi: number;
    istisnaliNetKidemTazminati: number;
    tavanDonemi: string;
}

export interface IhbarSonuc {
    ihbarSuresiHafta: number;
    ihbarSuresiGun: number;
    ihbarSuresiAciklama: string;
    brutIhbarTazminati: number;
    gelirVergisi: number;
    damgaVergisi: number;
    netIhbarTazminati: number;
    // İstisna uygulanmış
    istisnaTutari: number;
    istisnaliGelirVergisi: number;
    istisnaliDamgaVergisi: number;
    istisnaliNetIhbarTazminati: number;
}

export interface OzetSonuc {
    brutKidem: number;
    netKidem: number;
    istisnaliNetKidem: number;
    brutIhbar: number;
    netIhbar: number;
    istisnaliNetIhbar: number;
    brutToplam: number;
    netToplam: number;
    istisnaliNetToplam: number;
}

// --- Hesaplama Fonksiyonları ---

export function hesaplaCalismasuresi(
    baslangic: Date,
    bitis: Date
): CalismaSuresi {
    let yil = bitis.getFullYear() - baslangic.getFullYear();
    let ay = bitis.getMonth() - baslangic.getMonth();
    let gun = bitis.getDate() - baslangic.getDate();

    if (gun < 0) {
        ay--;
        // Önceki ayın son günü
        const oncekiAy = new Date(bitis.getFullYear(), bitis.getMonth(), 0);
        gun += oncekiAy.getDate();
    }
    if (ay < 0) {
        yil--;
        ay += 12;
    }

    const toplamAy = yil * 12 + ay;

    return { yil, ay, gun, toplamAy };
}

export function hesaplaKidemTavani(tarih: Date): {
    tutar: number;
    donem: string;
} {
    const tarihStr = tarih.toISOString().split("T")[0];

    for (const tavan of KIDEM_TAVANLARI) {
        if (tarihStr >= tavan.baslangic && tarihStr <= tavan.bitis) {
            return {
                tutar: tavan.tutar,
                donem: `${formatTarih(tavan.baslangic)} - ${formatTarih(tavan.bitis)}`,
            };
        }
    }

    // Tarih aralık dışındaysa en güncel tavanı kullan
    return {
        tutar: KIDEM_TAVANLARI[0].tutar,
        donem: `${formatTarih(KIDEM_TAVANLARI[0].baslangic)} - ${formatTarih(KIDEM_TAVANLARI[0].bitis)}`,
    };
}

function formatTarih(tarihStr: string): string {
    const [yil, ay, gun] = tarihStr.split("-");
    return `${gun}.${ay}.${yil}`;
}

export function hesaplaKidemTazminati(params: {
    baslangicTarihi: Date;
    bitisTarihi: Date;
    brutUcret: number;
}): KidemSonuc {
    const { baslangicTarihi, bitisTarihi, brutUcret } = params;

    const calismaSuresi = hesaplaCalismasuresi(baslangicTarihi, bitisTarihi);
    const { tutar: kidemTavani, donem: tavanDonemi } =
        hesaplaKidemTavani(bitisTarihi);

    // Kıdeme esas brüt ücret (tavan sınırı)
    const kidemEsasBrutUcret = Math.min(brutUcret, kidemTavani);

    // Brüt kıdem tazminatı = kıdeme esas ücret * (yıl + ay/12 + gün/365)
    const calismaSuresiKatsayi =
        calismaSuresi.yil +
        calismaSuresi.ay / 12 +
        calismaSuresi.gun / 365;
    const brutKidemTazminati = kidemEsasBrutUcret * calismaSuresiKatsayi;

    // Kıdem tazminatında sadece damga vergisi kesilir, gelir vergisi yok
    const damgaVergisi = brutKidemTazminati * DAMGA_VERGISI_ORANI;
    const netKidemTazminati = brutKidemTazminati - damgaVergisi;

    // İstisna tutarı hesabı (kıdem tazminatı tavanı üzerinden)
    // Tavan x çalışma süresi = istisna sınırı
    const istisnaSiniri = kidemTavani * calismaSuresiKatsayi;
    const istisnaTutari = Math.min(brutKidemTazminati, istisnaSiniri);
    // İstisna halinde tavan altında kalan kısımda vergi yok
    // Tavan altındaki brüt zaten = tüm brüt olduğundan istisna fark yaratmaz
    const istisnaliDamgaVergisi = brutKidemTazminati * DAMGA_VERGISI_ORANI;
    const istisnaliNetKidemTazminati =
        brutKidemTazminati - istisnaliDamgaVergisi;

    return {
        calismaSuresi,
        brutUcret,
        kidemTavani,
        kidemEsasBrutUcret,
        brutKidemTazminati,
        damgaVergisi,
        netKidemTazminati,
        istisnaTutari,
        istisnaliDamgaVergisi,
        istisnaliNetKidemTazminati,
        tavanDonemi,
    };
}

export function hesaplaIhbarTazminati(params: {
    baslangicTarihi: Date;
    bitisTarihi: Date;
    brutUcret: number;
    kumulatifVergiMatrahi: number;
    asgarIUcretGvmKumulatif: number;
}): IhbarSonuc {
    const {
        baslangicTarihi,
        bitisTarihi,
        brutUcret,
        kumulatifVergiMatrahi,
        asgarIUcretGvmKumulatif,
    } = params;

    const calismaSuresi = hesaplaCalismasuresi(baslangicTarihi, bitisTarihi);
    const yil = bitisTarihi.getFullYear();

    // İhbar süresini belirle
    const ihbarBilgisi =
        IHBAR_SURELERI.find(
            (s) =>
                calismaSuresi.toplamAy >= s.minAy &&
                calismaSuresi.toplamAy < s.maxAy
        ) || IHBAR_SURELERI[IHBAR_SURELERI.length - 1];

    // Brüt ihbar tazminatı = günlük ücret * ihbar süresi (gün)
    const gunlukUcret = brutUcret / 30;
    const brutIhbarTazminati = gunlukUcret * ihbarBilgisi.gun;

    // Gelir vergisi hesabı (kümülatif matrah bazlı)
    const gelirVergisi = hesaplaGelirVergisiKumulatif(
        yil,
        brutIhbarTazminati,
        kumulatifVergiMatrahi,
        true
    );

    // Damga vergisi
    const damgaVergisi = brutIhbarTazminati * DAMGA_VERGISI_ORANI;

    // Net ihbar tazminatı
    const netIhbarTazminati = brutIhbarTazminati - gelirVergisi - damgaVergisi;

    // İstisna hesabı (7194 sayılı kanun - ihbar tazminatında da asgari ücret istisnası)
    // İstisna tutarı: asgari ücretin kıdem tazminatı tavanı kadar kısmı
    // İhbar tazminatı için istisna = asgari ücret günlük * ihbar gün sayısı
    const asgarIUcretGunluk = ASGARI_UCRET_2026.brut / 30;
    const istisnaTutari = asgarIUcretGunluk * ihbarBilgisi.gun;
    const vergilendirilebilirGelir = Math.max(
        0,
        brutIhbarTazminati - istisnaTutari
    );

    // İstisnalı gelir vergisi
    const istisnaliGelirVergisi = hesaplaGelirVergisiKumulatif(
        yil,
        vergilendirilebilirGelir,
        asgarIUcretGvmKumulatif,
        true
    );

    // İstisnalı damga vergisi (istisna tutarı düşüldükten sonra)
    const istisnaliDamgaVergisi =
        vergilendirilebilirGelir * DAMGA_VERGISI_ORANI;

    // İstisnalı net ihbar tazminatı
    const istisnaliNetIhbarTazminati =
        brutIhbarTazminati - istisnaliGelirVergisi - istisnaliDamgaVergisi;

    return {
        ihbarSuresiHafta: ihbarBilgisi.hafta,
        ihbarSuresiGun: ihbarBilgisi.gun,
        ihbarSuresiAciklama: ihbarBilgisi.aciklama,
        brutIhbarTazminati,
        gelirVergisi,
        damgaVergisi,
        netIhbarTazminati,
        istisnaTutari,
        istisnaliGelirVergisi,
        istisnaliDamgaVergisi,
        istisnaliNetIhbarTazminati,
    };
}

export function hesaplaOzet(
    kidem: KidemSonuc,
    ihbar: IhbarSonuc
): OzetSonuc {
    return {
        brutKidem: kidem.brutKidemTazminati,
        netKidem: kidem.netKidemTazminati,
        istisnaliNetKidem: kidem.istisnaliNetKidemTazminati,
        brutIhbar: ihbar.brutIhbarTazminati,
        netIhbar: ihbar.netIhbarTazminati,
        istisnaliNetIhbar: ihbar.istisnaliNetIhbarTazminati,
        brutToplam: kidem.brutKidemTazminati + ihbar.brutIhbarTazminati,
        netToplam: kidem.netKidemTazminati + ihbar.netIhbarTazminati,
        istisnaliNetToplam:
            kidem.istisnaliNetKidemTazminati +
            ihbar.istisnaliNetIhbarTazminati,
    };
}
