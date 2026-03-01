import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";

const GIB_API_URL =
    "https://dijital.gib.gov.tr/apigateway/verification/gecikmeZammiFaiziHesaplama/gecikme-zammi-faizi-hesapla";

// Geçerli gecikme tipleri
const VALID_TYPES = [1, 2, 6, 7, 12, 13];
// toBeLink gerektiren tipler
const TOBELINK_TYPES = [6, 7, 12, 13];

interface GecikmeRow {
    gecikmeTipi: number;
    vadeTarihi: string;
    odemeTarihi: string;
    odenecekMiktar: string;
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
        const { rows } = body as { rows: GecikmeRow[] };

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
            if (!VALID_TYPES.includes(row.gecikmeTipi)) {
                return NextResponse.json(
                    { error: "Geçersiz gecikme tipi." },
                    { status: 400 }
                );
            }

            // Tarih formatı doğrula (YYYYMMDD)
            const dateRegex = /^\d{8}$/;
            if (!dateRegex.test(row.vadeTarihi) || !dateRegex.test(row.odemeTarihi)) {
                return NextResponse.json(
                    { error: "Tarih formatı geçersiz. YYYYMMDD formatında olmalıdır." },
                    { status: 400 }
                );
            }

            if (row.odemeTarihi < row.vadeTarihi) {
                return NextResponse.json(
                    { error: "Ödeme tarihi vade tarihinden önce olamaz." },
                    { status: 400 }
                );
            }

            if (!row.odenecekMiktar || parseFloat(row.odenecekMiktar) <= 0) {
                return NextResponse.json(
                    { error: "Ödenecek miktar pozitif bir değer olmalıdır." },
                    { status: 400 }
                );
            }
        }

        // GİB API formatına dönüştür
        const gibRows = rows.map((row) => {
            const base: Record<string, unknown> = {
                gecikmeTipi: row.gecikmeTipi,
                vadeTarihi: row.vadeTarihi,
                odemeTarihi: row.odemeTarihi,
                odenecekMiktar: row.odenecekMiktar,
            };

            // 7440 ve Yİ-ÜFE tipleri için toBeLink ekle
            if (TOBELINK_TYPES.includes(row.gecikmeTipi)) {
                base.toBeLink = false;
            }

            return base;
        });

        // GİB API'sine proxy istek gönder
        const gibResponse = await fetch(GIB_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                data: {
                    data: gibRows,
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
        console.error("Gecikme zammı/faizi hesaplama hatası:", error);
        return NextResponse.json(
            { error: "Hesaplama sırasında bir hata oluştu." },
            { status: 500 }
        );
    }
}
