import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";

const GIB_MTV_HESAPLA_URL =
    "https://dijital.gib.gov.tr/apigateway/verification/mtv/mtv-hesapla";
const GIB_MTV_DROPDOWN_URL =
    "https://dijital.gib.gov.tr/apigateway/verification/mtv/dropdown-list";

interface MtvHesaplaRequest {
    aracTipiKod: string;
    ilkIktisabi: string;
    aracYasi: string;
    motorSilindirHacmi: string;
    tasitDegeriAltLimit: string;
    tasitDegeriUstLimit: string;
    oturmaYeri: string;
    azamiToplamAgirlik: string;
    azamiKalkisAgirlik: string;
}

// GET: Dropdown verilerini getir
export async function GET() {
    const user = await getUserWithProfile();
    if (!user) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const gibResponse = await fetch(GIB_MTV_DROPDOWN_URL, {
            headers: { Accept: "application/json" },
        });

        if (!gibResponse.ok) {
            console.error("GİB MTV dropdown hatası:", gibResponse.status);
            return NextResponse.json(
                { error: "GİB servisi şu anda yanıt vermiyor. Lütfen daha sonra tekrar deneyin." },
                { status: 502 }
            );
        }

        const data = await gibResponse.json();

        if (data.messages) {
            return NextResponse.json(
                { error: "GİB servisinden veri alınamadı." },
                { status: 502 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("MTV dropdown hatası:", error);
        return NextResponse.json(
            { error: "Dropdown verileri alınırken bir hata oluştu." },
            { status: 500 }
        );
    }
}

// POST: MTV hesaplama
export async function POST(req: NextRequest) {
    const user = await getUserWithProfile();
    if (!user) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const body = (await req.json()) as MtvHesaplaRequest;

        // Zorunlu alan kontrolü
        if (!body.aracTipiKod || !body.aracYasi) {
            return NextResponse.json(
                { error: "Araç tipi ve araç yaşı zorunludur." },
                { status: 400 }
            );
        }

        // GİB API'sine proxy istek
        const gibResponse = await fetch(GIB_MTV_HESAPLA_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                aracTipiKod: body.aracTipiKod,
                ilkIktisabi: body.ilkIktisabi || "",
                aracYasi: body.aracYasi,
                motorSilindirHacmi: body.motorSilindirHacmi || "",
                tasitDegeriAltLimit: body.tasitDegeriAltLimit || "0.00",
                tasitDegeriUstLimit: body.tasitDegeriUstLimit || "0.00",
                oturmaYeri: body.oturmaYeri || "",
                azamiToplamAgirlik: body.azamiToplamAgirlik || "",
                azamiKalkisAgirlik: body.azamiKalkisAgirlik || "",
            }),
        });

        if (!gibResponse.ok) {
            console.error(
                "GİB MTV hesaplama hatası:",
                gibResponse.status,
                await gibResponse.text().catch(() => "")
            );
            return NextResponse.json(
                { error: "GİB servisi şu anda yanıt vermiyor. Lütfen daha sonra tekrar deneyin." },
                { status: 502 }
            );
        }

        const data = await gibResponse.json();

        // GİB hata mesajı kontrolü
        if (data.messages && Array.isArray(data.messages)) {
            const errorMsg = data.messages.find(
                (m: { type: string }) => m.type === "ERROR"
            );
            if (errorMsg) {
                return NextResponse.json(
                    { error: errorMsg.text || "Hesaplama yapılamadı." },
                    { status: 400 }
                );
            }
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("MTV hesaplama hatası:", error);
        return NextResponse.json(
            { error: "Hesaplama sırasında bir hata oluştu." },
            { status: 500 }
        );
    }
}
