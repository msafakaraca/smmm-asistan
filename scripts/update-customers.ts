/**
 * Mükellef Bilgilerini Güncelleme Script'i
 * LUCA verisinden alınan bilgilerle müşterileri günceller
 * 
 * Çalıştırma: npx ts-node scripts/update-customers.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Resimdeki veriler - VKN bazlı eşleştirme yapılacak
const customerUpdates = [
    { vkn: "5210606814", kisaltma: "100-EV EŞY", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "" },
    { vkn: "8644072015", kisaltma: "106-BAYART", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "" },
    { vkn: "5495871594", kisaltma: "108-DYG.C", vergiDairesi: "KARADENİZ EREĞLİSİ VERGİ DAİRESİ", tcNo: "" },
    { vkn: "7115394927", kisaltma: "112-FİKODEL", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "" },
    { vkn: "7038981447", kisaltma: "114-ARZURT", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "" },
    { vkn: "4686787966", kisaltma: "116-AYTÜN", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "" },
    { vkn: "2494094708", kisaltma: "118-ÇEVİR", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "" },
    { vkn: "5087090779", kisaltma: "118-CANHAN", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "" },
    { vkn: "7351616314", kisaltma: "119-RODE", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "" },
    { vkn: "3431620642", kisaltma: "118-GARIŞ", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "" },
    { vkn: "1315728200", kisaltma: "119-BAYKAL", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "" },
    { vkn: "6398828988", kisaltma: "11B-DADAŞL", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "" },
    { vkn: "", kisaltma: "120-EVYAP", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "43077801118", vknField: "43077801118" },
    { vkn: "", kisaltma: "200-EVDİL", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "21087821742", vknField: "21087821742" },
    { vkn: "9930091870", kisaltma: "206-C5.G.L", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "" },
    { vkn: "", kisaltma: "208-MWRT", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "34406015696", vknField: "34406015696" },
    { vkn: "", kisaltma: "212-HARCIA", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "25608097962", vknField: "25608097962" },
    { vkn: "", kisaltma: "210-ERBEN", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "18491069296", vknField: "18491069296" },
    { vkn: "", kisaltma: "214-GÖZBE", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "11628009634", vknField: "11628009634" },
    { vkn: "7115316486", kisaltma: "222-PPL", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "" },
    { vkn: "", kisaltma: "223-KOÇBEY", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "49508011192", vknField: "49508011192" },
    { vkn: "5039900338", kisaltma: "228-SAPAY", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "" },
    { vkn: "1312141257", kisaltma: "302-ARK", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "" },
    { vkn: "", kisaltma: "310-BRC", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "19416141326", vknField: "19416141326" },
    { vkn: "5050036469", kisaltma: "306-İKARC", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "" },
    { vkn: "", kisaltma: "308-HAŞKOÇ", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "39600801368", vknField: "39600801368" },
    { vkn: "", kisaltma: "310-AYOĞUZ", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "36938448072", vknField: "36938448072" },
    { vkn: "7400061934", kisaltma: "318-MSAKAR", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "" },
    { vkn: "", kisaltma: "320-SYÜK", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "19365432626", vknField: "19365432626" },
    { vkn: "", kisaltma: "208-ERHAN", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "22124661916", vknField: "22124661916" },
    { vkn: "", kisaltma: "318-KYVKSL", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "32379965116", vknField: "32379965116" },
    { vkn: "2490807756", kisaltma: "402-ÇEVKİŞL", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "" },
    { vkn: "", kisaltma: "404-ESAKOZ", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "39003803462", vknField: "39003803462" },
    { vkn: "", kisaltma: "406-ERMMC", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "18608071640", vknField: "18608071640" },
    { vkn: "3940123250", kisaltma: "403-SERKAN-Z", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "" },
    { vkn: "9390442252", kisaltma: "404-HBEC", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "" },
    { vkn: "", kisaltma: "406-HMRSA", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "43918507118", vknField: "43918507118" },
    { vkn: "", kisaltma: "410-FKRHM", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "10912120806", vknField: "10912120806" },
    { vkn: "", kisaltma: "412-SDLBR", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "42027625918", vknField: "42027625918" },
    { vkn: "", kisaltma: "414-EŞMAR", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "11461276719", vknField: "11461276719" },
    { vkn: "", kisaltma: "416-OŞNB", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "30851893684", vknField: "30851893684" },
    { vkn: "", kisaltma: "434-OĞUZ", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "47464791542", vknField: "47464791542" },
    { vkn: "5253071645", kisaltma: "434-AÇŞFR", vergiDairesi: "ALMUS VERGİ DAİRESİ", tcNo: "" },
    { vkn: "", kisaltma: "500-SEYRES", vergiDairesi: "TOKAT VERGİ DAİRESİ", tcNo: "", vknField: "" },
];

async function main() {
    console.log("🔄 Mükellef bilgileri güncelleniyor...\n");

    let updated = 0;
    let notFound = 0;
    let errors = 0;

    for (const data of customerUpdates) {
        // VKN veya TC ile eşleştir
        const searchVkn = data.vkn || data.vknField || data.tcNo;

        if (!searchVkn) {
            console.log(`⏭️ VKN/TC yok, atlanıyor: ${data.kisaltma}`);
            continue;
        }

        try {
            // Müşteriyi bul
            const customer = await prisma.customer.findFirst({
                where: {
                    vknTckn: searchVkn
                }
            });

            if (!customer) {
                console.log(`❌ Bulunamadı: ${searchVkn} - ${data.kisaltma}`);
                notFound++;
                continue;
            }

            // Güncelle
            const updateData: any = {
                kisaltma: data.kisaltma,
                vergiDairesi: data.vergiDairesi
            };

            // VKN 10 haneli ise vergiKimlikNo
            if (data.vkn && data.vkn.length === 10) {
                updateData.vergiKimlikNo = data.vkn;
            }

            // TC 11 haneli ise tcKimlikNo
            if (data.tcNo && data.tcNo.length === 11) {
                updateData.tcKimlikNo = data.tcNo;
            }

            await prisma.customer.update({
                where: { id: customer.id },
                data: updateData
            });

            console.log(`✅ Güncellendi: ${customer.unvan} → ${data.kisaltma}`);
            updated++;

        } catch (e: any) {
            console.error(`❌ Hata: ${searchVkn} - ${e.message}`);
            errors++;
        }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`📊 Sonuç: ${updated} güncellendi, ${notFound} bulunamadı, ${errors} hata`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
