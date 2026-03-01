import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";

const GIB_API_URL =
    "https://dijital.gib.gov.tr/apigateway/verification/gelir-vergisi/hesapla";

interface GelirVergisiRow {
    tur: string;
    vergiDonemi: string;
    matrah: number;
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
        const body = await req.json();
        const { rows } = body as { rows: GelirVergisiRow[] };

        if (
            !rows ||
            !Array.isArray(rows) ||
            rows.length === 0 ||
            rows.length > 10
        ) {
            return NextResponse.json(
                { error: "Geçersiz istek. 1-10 arası satır gönderilebilir." },
                { status: 400 }
            );
        }

        // Satırları doğrula
        for (const row of rows) {
            if (!row.tur || !["0", "1"].includes(row.tur)) {
                return NextResponse.json(
                    {
                        error: "Geçersiz gelir unsuru. '0' (Ücret Dışı) veya '1' (Ücretli) olmalıdır.",
                    },
                    { status: 400 }
                );
            }
            if (!row.vergiDonemi || typeof row.vergiDonemi !== "string") {
                return NextResponse.json(
                    { error: "Geçersiz vergi dönemi." },
                    { status: 400 }
                );
            }
            if (typeof row.matrah !== "number" || row.matrah <= 0) {
                return NextResponse.json(
                    { error: "Matrah pozitif bir sayı olmalıdır." },
                    { status: 400 }
                );
            }
        }

        // GİB API'sine proxy istek gönder
        const gibResponse = await fetch(GIB_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                data: {
                    data: rows.map((row) => ({
                        tur: row.tur,
                        vergiDonemi: row.vergiDonemi,
                        matrah: row.matrah,
                    })),
                },
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
        console.error("Gelir vergisi hesaplama hatası:", error);
        return NextResponse.json(
            { error: "Hesaplama sırasında bir hata oluştu." },
            { status: 500 }
        );
    }
}
