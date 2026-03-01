import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";

const GIB_API_URL =
    "https://dijital.gib.gov.tr/apigateway/verification/smm/hesapla";

const VALID_HESAPLAMA_TIPLERI = [
    "BRUT_UCRET_KDV_HARIC",
    "BRUT_UCRET_KDV_DAHIL",
    "NET_UCRET_KDV_HARIC",
    "NET_TAHSIL_EDILEN_UCRET_KDV_DAHIL",
] as const;

const VALID_STOPAJ_ORANLARI = [
    "YUZDE_YIRMI",
    "YUZDE_ONYEDI",
    "YUZDE_SIFIR",
] as const;

const VALID_KDV_ORANLARI = [
    "YUZDE_YIRMI",
    "YUZDE_ON",
    "YUZDE_BIR",
    "YUZDE_SIFIR",
] as const;

interface SmmRequest {
    hesaplamaTipi: string;
    stopajOrani: string;
    kdvOrani: string;
    hesaplanacakTutar: number;
}

export async function POST(req: NextRequest) {
    const user = await getUserWithProfile();
    if (!user) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const body = (await req.json()) as SmmRequest;

        // Doğrulama
        if (
            !body.hesaplamaTipi ||
            !(VALID_HESAPLAMA_TIPLERI as readonly string[]).includes(body.hesaplamaTipi)
        ) {
            return NextResponse.json(
                { error: "Geçersiz hesaplama tipi." },
                { status: 400 }
            );
        }

        if (
            !body.stopajOrani ||
            !(VALID_STOPAJ_ORANLARI as readonly string[]).includes(body.stopajOrani)
        ) {
            return NextResponse.json(
                { error: "Geçersiz stopaj oranı." },
                { status: 400 }
            );
        }

        if (
            !body.kdvOrani ||
            !(VALID_KDV_ORANLARI as readonly string[]).includes(body.kdvOrani)
        ) {
            return NextResponse.json(
                { error: "Geçersiz KDV oranı." },
                { status: 400 }
            );
        }

        if (typeof body.hesaplanacakTutar !== "number" || body.hesaplanacakTutar <= 0) {
            return NextResponse.json(
                { error: "Tutar pozitif bir sayı olmalıdır." },
                { status: 400 }
            );
        }

        // GİB API'sine proxy istek
        const gibResponse = await fetch(GIB_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                hesaplamaTipi: body.hesaplamaTipi,
                stopajOrani: body.stopajOrani,
                kdvOrani: body.kdvOrani,
                hesaplanacakTutar: body.hesaplanacakTutar,
            }),
        });

        if (!gibResponse.ok) {
            console.error(
                "GİB API hatası:",
                gibResponse.status,
                await gibResponse.text().catch(() => "")
            );
            return NextResponse.json(
                {
                    error: "GİB servisi şu anda yanıt vermiyor. Lütfen daha sonra tekrar deneyin.",
                },
                { status: 502 }
            );
        }

        const data = await gibResponse.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("SMM hesaplama hatası:", error);
        return NextResponse.json(
            { error: "Hesaplama sırasında bir hata oluştu." },
            { status: 500 }
        );
    }
}
