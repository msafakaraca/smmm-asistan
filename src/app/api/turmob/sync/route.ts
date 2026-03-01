
import { NextRequest } from "next/server";
import { runTurmobBot } from "@/lib/turmob/bot";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toTitleCase } from "@/lib/utils/text";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    const tenantId = (session.user as any).tenantId;

    // Fetch TÜRMOB credentials from settings
    const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { turmobSettings: true }
    });

    const turmobSettings: any = tenant?.turmobSettings || {};
    const username = turmobSettings.username;
    const password = turmobSettings.password;

    if (!username || !password) {
        return new Response(JSON.stringify({
            error: "TÜRMOB kullanıcı adı ve şifre ayarlanmamış. Lütfen ayarlar sayfasından giriş bilgilerinizi kaydedin."
        }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    // Get CAPTCHA key from environment
    const captchaKey = process.env.CAPTCHA_API_KEY;

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const sendMessage = (percent: number, message: string) => {
                const data = `data: ${JSON.stringify({ percent, message })}\n\n`;
                controller.enqueue(encoder.encode(data));
            };

            try {
                // Run the bot with progress callback
                const result: any = await runTurmobBot({
                    tenantId,
                    username,
                    password,
                    captchaKey,
                    onProgress: sendMessage
                });

                if (result.success && Array.isArray(result.data)) {
                    sendMessage(95, "Veriler işleniyor...");

                    let processedData = [];

                    // 1. Pre-process and Normalize Data
                    for (const row of result.data) {
                        const rowKeys = Object.keys(row);

                        const findKey = (candidates: string[]) => {
                            return rowKeys.find(key =>
                                candidates.some(c => key.trim().toLowerCase() === c.toLowerCase() || key.trim().toLowerCase().includes(c.toLowerCase()))
                            );
                        };

                        // UNVAN MAPPING
                        const unvanKey = findKey(["Müşteri Ünvanı", "Unvan", "Ünvan", "Müşteri Adı"]);
                        const unvan = unvanKey ? row[unvanKey] : null;

                        // VKN/TCKN MAPPING
                        const vknKey = findKey(["Müşteri T.C./Vergi No", "Müşteri Vergi No", "Vergi No", "TCKN", "T.C. Kimlik No"]);
                        const vknTckn = vknKey ? row[vknKey]?.toString().replace(/\s/g, '').replace(/\D/g, '') : null;

                        // PHONE MAPPING
                        const phoneKey = findKey(["Cep Telefonu", "Phone Number", "Telefon", "Gsm"]);
                        const phone = phoneKey ? row[phoneKey]?.toString() : null;

                        // VERGI DAIRESI MAPPING
                        const vergiDairesiKey = findKey(["Vergi Dairesi", "VD", "Müşteri Vergi Dairesi"]);
                        const vergiDairesi = vergiDairesiKey ? row[vergiDairesiKey]?.toString() : null;

                        // S.N. MAPPING
                        const siraNoKey = findKey(["S.N.", "Sıra No", "Sira No"]);
                        const siraNo = siraNoKey ? row[siraNoKey]?.toString() : null;

                        // CONTRACT MAPPING
                        const sozlesmeNoKey = findKey(["Sözleşme No", "Sozlesme No"]);
                        const sozlesmeNo = sozlesmeNoKey ? row[sozlesmeNoKey]?.toString() : null;

                        // CONTRACT DATE MAPPING - Handle Excel numeric dates
                        const sozlesmeTarihiKey = findKey(["Sözleşme Tarihi", "Sozlesme Tarihi"]);
                        let sozlesmeTarihi: string | null = null;
                        if (sozlesmeTarihiKey && row[sozlesmeTarihiKey] != null) {
                            const rawDate = row[sozlesmeTarihiKey];
                            if (typeof rawDate === 'number') {
                                // Excel serial date to JS Date
                                const excelEpoch = new Date(1899, 11, 30);
                                const jsDate = new Date(excelEpoch.getTime() + rawDate * 86400000);
                                sozlesmeTarihi = jsDate.toLocaleDateString('tr-TR');
                            } else {
                                sozlesmeTarihi = rawDate.toString();
                            }
                        }

                        if (!unvan || !vknTckn) {
                            continue;
                        }

                        processedData.push({
                            unvan,
                            vknTckn,
                            phone,
                            vergiDairesi,
                            siraNo,
                            sozlesmeNo,
                            sozlesmeTarihi,
                            raw: row
                        });
                    }

                    // 2. Sort by S.N.
                    processedData.sort((a, b) => {
                        const numA = parseInt(a.siraNo || "0");
                        const numB = parseInt(b.siraNo || "0");
                        return numA - numB;
                    });

                    sendMessage(97, "Veritabanına kaydediliyor...");

                    // 3. Process and Stats
                    let stats = {
                        total: 0,
                        sahis: 0,
                        basit_usul: 0,
                        firma: 0
                    };

                    // Firma keywords
                    const firmaKeywords = [
                        'ltd', 'limited', 'şti', 'ştİ', 'a.ş', 'a.ş.', 'aş',
                        'anonim', 'şirketi', 'şirketİ', 'holding', 'san.', 'tic.',
                        'sanayi', 'ticaret', 'pazarlama', 'danışmanlık', 'danismanlik',
                        'inşaat', 'insaat', 'mühendislik', 'muhendislik', 'turizm',
                        'lojistik', 'taşımacılık', 'tasimacilik', 'otomotiv', 'gıda', 'gida',
                        'tekstil', 'makina', 'makine', 'elektronik', 'yazılım', 'yazilim',
                        'bilişim', 'bilisim', 'medya', 'reklam', 'ajans', 'grup', 'group',
                        'merkezi', 'kooperatif', 'dernek', 'vakıf', 'vakif', 'birlik',
                        'odası', 'odasi', 'belediye', 'müdürlüğü', 'mudurlugu',
                        'enerji', 'uretim', 'üretim', 'tarımsal', 'tarimsal', 'kalkınma', 'kalkinma',
                        'kooperatifi', 'sigorta', 'aracılık', 'aracilik', 'hizmetleri'
                    ];

                    for (const data of processedData) {
                        const unvanLower = data.unvan.toLowerCase().replace(/İ/g, 'i').replace(/I/g, 'ı');
                        let sirketTipi = "sahis";

                        if (unvanLower.includes("basit usul") || unvanLower.includes("basit usül")) {
                            sirketTipi = "basit_usul";
                        } else if (firmaKeywords.some(keyword => unvanLower.includes(keyword.toLowerCase()))) {
                            sirketTipi = "firma";
                        }

                        const numericId = data.vknTckn.replace(/\D/g, '');
                        let tcKimlikNo: string | null = null;
                        let vergiKimlikNo: string | null = null;

                        if (numericId.length === 11) {
                            tcKimlikNo = numericId;
                        } else {
                            vergiKimlikNo = numericId;
                        }

                        if (sirketTipi === "basit_usul") stats.basit_usul++;
                        else if (sirketTipi === "sahis") stats.sahis++;
                        else stats.firma++;

                        stats.total++;

                        await prisma.customers.upsert({
                            where: {
                                tenantId_vknTckn: {
                                    tenantId: tenantId,
                                    vknTckn: data.vknTckn
                                }
                            },
                            update: {
                                unvan: toTitleCase(data.unvan),
                                telefon1: data.phone || undefined,
                                vergiDairesi: data.vergiDairesi || undefined,
                                siraNo: data.siraNo,
                                sozlesmeNo: data.sozlesmeNo,
                                sozlesmeTarihi: data.sozlesmeTarihi,
                                sirketTipi: sirketTipi,
                                tcKimlikNo: tcKimlikNo,
                                vergiKimlikNo: vergiKimlikNo
                            },
                            create: {
                                tenantId: tenantId,
                                unvan: toTitleCase(data.unvan),
                                vknTckn: data.vknTckn,
                                tcKimlikNo: tcKimlikNo,
                                vergiKimlikNo: vergiKimlikNo,
                                vergiDairesi: data.vergiDairesi,
                                telefon1: data.phone,
                                siraNo: data.siraNo,
                                sozlesmeNo: data.sozlesmeNo,
                                sozlesmeTarihi: data.sozlesmeTarihi,
                                sirketTipi: sirketTipi,
                                status: "active"
                            }
                        });
                    }

                    // Send completion message with stats
                    const completionData = `data: ${JSON.stringify({
                        percent: 100,
                        message: "Tamamlandı!",
                        complete: true,
                        stats
                    })}\n\n`;
                    controller.enqueue(encoder.encode(completionData));
                } else {
                    const errorData = `data: ${JSON.stringify({
                        error: result.error || "Veri çekilemedi",
                        complete: true
                    })}\n\n`;
                    controller.enqueue(encoder.encode(errorData));
                }
            } catch (error: any) {
                console.error("TÜRMOB Sync Error:", error);
                const errorData = `data: ${JSON.stringify({
                    error: error.message || "Bilinmeyen hata",
                    complete: true
                })}\n\n`;
                controller.enqueue(encoder.encode(errorData));
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
