import { NextRequest, NextResponse } from "next/server";
import { withAuth, createSupabaseClient } from "@/lib/api-helpers";

/**
 * POST /api/mail/reset
 *
 * Mail/WhatsApp durumlarını sıfırlar.
 * Body:
 *   - type: "all" | "single" - Tümünü veya tek müşteriyi sıfırla
 *   - customerId?: string - Tek müşteri için ID (type: "single" ise zorunlu)
 *   - year: Yıl
 *   - month: Ay
 *   - mode: "mukellef" | "banka"
 *   - field: "mail" | "whatsapp" | "both" - Hangi alanı sıfırla
 */
export const POST = withAuth(async (req: NextRequest, user) => {
    const supabase = await createSupabaseClient();
    const body = await req.json();

    const { type, customerId, year, month, mode, field } = body;

    // Validate required fields
    if (!type || !year || !month || !field) {
        return NextResponse.json(
            { error: "type, year, month ve field alanları zorunludur" },
            { status: 400 }
        );
    }

    // Validate type
    if (!['all', 'single'].includes(type)) {
        return NextResponse.json(
            { error: "type değeri 'all' veya 'single' olmalıdır" },
            { status: 400 }
        );
    }

    // Validate field
    if (!['mail', 'whatsapp', 'both'].includes(field)) {
        return NextResponse.json(
            { error: "field değeri 'mail', 'whatsapp' veya 'both' olmalıdır" },
            { status: 400 }
        );
    }

    // If single, customerId is required
    if (type === 'single' && !customerId) {
        return NextResponse.json(
            { error: "type 'single' ise customerId zorunludur" },
            { status: 400 }
        );
    }

    // Prepare update data based on field
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
        updatedAt: now
    };

    if (field === 'mail' || field === 'both') {
        updateData.mailSent = false;
        updateData.mailSentAt = null;
        updateData.mailSentBy = null;
        updateData.sentBeyannameler = [];
    }

    if (field === 'whatsapp' || field === 'both') {
        updateData.whatsappSent = false;
        updateData.whatsappSentAt = null;
    }

    try {
        if (type === 'single') {
            // Reset single customer
            const { error } = await supabase
                .from('mail_status')
                .update(updateData)
                .eq('customerId', customerId)
                .eq('year', year)
                .eq('month', month)
                .eq('mode', mode || 'mukellef');

            if (error) {
                console.error("[Mail Reset API] Single reset error:", error);
                return NextResponse.json(
                    { error: "Durum sıfırlanırken hata oluştu" },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                message: "Müşteri durumu sıfırlandı"
            });
        } else {
            // Reset all customers for the period
            const { error, count } = await supabase
                .from('mail_status')
                .update(updateData)
                .eq('year', year)
                .eq('month', month)
                .eq('mode', mode || 'mukellef');

            if (error) {
                console.error("[Mail Reset API] Bulk reset error:", error);
                return NextResponse.json(
                    { error: "Durumlar sıfırlanırken hata oluştu" },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                message: `${count || 0} kayıt sıfırlandı`
            });
        }
    } catch (error) {
        console.error("[Mail Reset API] Unexpected error:", error);
        return NextResponse.json(
            { error: "Beklenmeyen bir hata oluştu" },
            { status: 500 }
        );
    }
});
