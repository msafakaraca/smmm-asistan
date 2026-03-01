import { NextRequest, NextResponse } from "next/server";
import { withAuth, createSupabaseClient } from "@/lib/api-helpers";
import { randomUUID } from "crypto";

/**
 * GET /api/mail
 *
 * Müşteri listesini mail durumları ile birlikte getirir.
 * Query params:
 *   - year: Yıl (zorunlu)
 *   - month: Ay (zorunlu)
 *   - mode: "mukellef" | "banka" (varsayılan: "mukellef")
 *   - search: Arama terimi
 */
export const GET = withAuth(async (req: NextRequest, user) => {
    const supabase = await createSupabaseClient();
    const { searchParams } = new URL(req.url);

    const year = parseInt(searchParams.get("year") || "0");
    const month = parseInt(searchParams.get("month") || "0");
    const mode = searchParams.get("mode") || "mukellef";
    const search = searchParams.get("search") || "";

    // Validate required params
    if (!year || !month) {
        return NextResponse.json(
            { error: "year ve month parametreleri zorunludur" },
            { status: 400 }
        );
    }

    // Fetch customers with their mail status
    let customerQuery = supabase
        .from('Customer')
        .select(`
            id,
            unvan,
            kisaltma,
            vknTckn,
            email,
            telefon1,
            status,
            sirketTipi,
            siraNo
        `)
        .eq('status', 'active')
        .order('sirketTipi', { ascending: true })
        .order('siraNo', { ascending: true, nullsFirst: false })
        .order('unvan', { ascending: true });

    // Apply search filter
    if (search) {
        customerQuery = customerQuery.or(`unvan.ilike.%${search}%,kisaltma.ilike.%${search}%,vknTckn.ilike.%${search}%`);
    }

    const { data: customers, error: customerError } = await customerQuery;

    if (customerError) {
        console.error("[Mail API] Customer fetch error:", customerError);
        return NextResponse.json(
            { error: "Müşteriler yüklenirken hata oluştu" },
            { status: 500 }
        );
    }

    // Fetch mail status for the given period
    const { data: mailStatuses, error: statusError } = await supabase
        .from('mail_status')
        .select('customerId, mailSent, mailSentAt, whatsappSent, whatsappSentAt, sentBeyannameler')
        .eq('year', year)
        .eq('month', month)
        .eq('mode', mode);

    if (statusError) {
        console.error("[Mail API] MailStatus fetch error:", statusError);
        // Continue without status - not critical
    }

    // Create a map for quick lookup
    const statusMap = new Map<string, {
        mailSent: boolean;
        mailSentAt: string | null;
        whatsappSent: boolean;
        whatsappSentAt: string | null;
        sentBeyannameler: string[];
    }>();

    mailStatuses?.forEach(status => {
        statusMap.set(status.customerId, {
            mailSent: status.mailSent,
            mailSentAt: status.mailSentAt,
            whatsappSent: status.whatsappSent,
            whatsappSentAt: status.whatsappSentAt,
            sentBeyannameler: status.sentBeyannameler || []
        });
    });

    // Merge customers with their status
    const customersWithStatus = customers?.map(customer => {
        const status = statusMap.get(customer.id);
        return {
            ...customer,
            mailSent: status?.mailSent || false,
            mailSentAt: status?.mailSentAt || null,
            whatsappSent: status?.whatsappSent || false,
            whatsappSentAt: status?.whatsappSentAt || null,
            sentBeyannameler: status?.sentBeyannameler || []
        };
    }) || [];

    // Şirket tipi sıralama
    const sirketTipiOrder: Record<string, number> = {
        "firma": 1,
        "sahis": 2,
        "basit_usul": 3
    };

    customersWithStatus.sort((a, b) => {
        const tipiA = sirketTipiOrder[a.sirketTipi] || 99;
        const tipiB = sirketTipiOrder[b.sirketTipi] || 99;

        if (tipiA !== tipiB) {
            return tipiA - tipiB;
        }

        if (a.siraNo && b.siraNo) {
            const numA = parseInt(a.siraNo);
            const numB = parseInt(b.siraNo);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.siraNo.localeCompare(b.siraNo);
        }
        if (a.siraNo) return -1;
        if (b.siraNo) return 1;

        return a.unvan.localeCompare(b.unvan, 'tr');
    });

    return NextResponse.json({
        customers: customersWithStatus,
        total: customersWithStatus.length,
        year,
        month,
        mode
    });
});

/**
 * POST /api/mail
 *
 * Mail/WhatsApp gönderim durumunu günceller.
 * Body:
 *   - customerId: Müşteri ID
 *   - year: Yıl
 *   - month: Ay
 *   - mode: "mukellef" | "banka"
 *   - action: "mailSent" | "whatsappSent"
 *   - value: boolean
 *   - sentBeyannameler?: string[] (opsiyonel)
 */
export const POST = withAuth(async (req: NextRequest, user) => {
    const supabase = await createSupabaseClient();
    const body = await req.json();

    const { customerId, year, month, mode, action, value, sentBeyannameler } = body;

    // Validate required fields
    if (!customerId || !year || !month || !action) {
        return NextResponse.json(
            { error: "customerId, year, month ve action alanları zorunludur" },
            { status: 400 }
        );
    }

    // Validate action
    if (!['mailSent', 'whatsappSent'].includes(action)) {
        return NextResponse.json(
            { error: "action değeri 'mailSent' veya 'whatsappSent' olmalıdır" },
            { status: 400 }
        );
    }

    // Check if customer exists
    const { data: customer, error: customerError } = await supabase
        .from('Customer')
        .select('id')
        .eq('id', customerId)
        .single();

    if (customerError || !customer) {
        return NextResponse.json(
            { error: "Müşteri bulunamadı" },
            { status: 404 }
        );
    }

    // Prepare update data
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
        [action]: value,
        [`${action}At`]: value ? now : null,
        updatedAt: now
    };

    // Add sentBeyannameler if provided
    if (sentBeyannameler && Array.isArray(sentBeyannameler)) {
        updateData.sentBeyannameler = sentBeyannameler;
    }

    // Add mailSentBy if it's a mail action
    if (action === 'mailSent' && value) {
        updateData.mailSentBy = user.email;
    }

    // Check if record exists
    const { data: existing } = await supabase
        .from('mail_status')
        .select('id')
        .eq('customerId', customerId)
        .eq('year', year)
        .eq('month', month)
        .eq('mode', mode || 'mukellef')
        .single();

    if (existing) {
        // Update existing record
        const { error: updateError } = await supabase
            .from('mail_status')
            .update(updateData)
            .eq('id', existing.id);

        if (updateError) {
            console.error("[Mail API] Update error:", updateError);
            return NextResponse.json(
                { error: "Durum güncellenirken hata oluştu" },
                { status: 500 }
            );
        }
    } else {
        // Create new record
        const { error: insertError } = await supabase
            .from('mail_status')
            .insert({
                id: randomUUID(),
                customerId,
                year,
                month,
                mode: mode || 'mukellef',
                tenantId: user.tenantId,
                ...updateData,
                createdAt: now
            });

        if (insertError) {
            console.error("[Mail API] Insert error:", insertError);
            return NextResponse.json(
                { error: "Durum kaydedilirken hata oluştu" },
                { status: 500 }
            );
        }
    }

    return NextResponse.json({ success: true });
});

/**
 * PUT /api/mail
 *
 * Toplu mail durumu güncelleme (bulk update).
 * Body:
 *   - customerIds: string[] - Müşteri ID listesi
 *   - year: Yıl
 *   - month: Ay
 *   - mode: "mukellef" | "banka"
 *   - action: "mailSent" | "whatsappSent"
 *   - value: boolean
 *   - sentBeyannameler?: string[]
 */
export const PUT = withAuth(async (req: NextRequest, user) => {
    const supabase = await createSupabaseClient();
    const body = await req.json();

    const { customerIds, year, month, mode, action, value, sentBeyannameler } = body;

    // Validate
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
        return NextResponse.json(
            { error: "customerIds listesi zorunludur" },
            { status: 400 }
        );
    }

    if (!year || !month || !action) {
        return NextResponse.json(
            { error: "year, month ve action alanları zorunludur" },
            { status: 400 }
        );
    }

    const now = new Date().toISOString();
    const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
    };

    // Process each customer
    for (const customerId of customerIds) {
        try {
            const updateData: Record<string, unknown> = {
                [action]: value,
                [`${action}At`]: value ? now : null,
                updatedAt: now
            };

            if (sentBeyannameler && Array.isArray(sentBeyannameler)) {
                updateData.sentBeyannameler = sentBeyannameler;
            }

            if (action === 'mailSent' && value) {
                updateData.mailSentBy = user.email;
            }

            // Check if record exists
            const { data: existing } = await supabase
                .from('mail_status')
                .select('id')
                .eq('customerId', customerId)
                .eq('year', year)
                .eq('month', month)
                .eq('mode', mode || 'mukellef')
                .single();

            if (existing) {
                await supabase
                    .from('mail_status')
                    .update(updateData)
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('mail_status')
                    .insert({
                        id: randomUUID(),
                        customerId,
                        year,
                        month,
                        mode: mode || 'mukellef',
                        tenantId: user.tenantId,
                        ...updateData,
                        createdAt: now
                    });
            }

            results.success++;
        } catch (error) {
            results.failed++;
            results.errors.push(`${customerId}: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
        }
    }

    return NextResponse.json({
        success: true,
        results
    });
});
