import { NextRequest, NextResponse } from "next/server";
import { withAuth, createSupabaseClient } from "@/lib/api-helpers";
import { sendWhatsAppMessage, createDeclarationNotificationMessage } from "@/lib/whatsapp/whapi";
import { randomUUID } from "crypto";

/**
 * POST /api/mail/whatsapp
 *
 * WhatsApp mesajı gönderir ve durumu günceller.
 * Body:
 *   - customerId: Müşteri ID
 *   - year: Yıl
 *   - month: Ay
 *   - mode: "mukellef" | "banka"
 *   - beyannameler: string[] - Gönderilen beyanname türleri
 */
export const POST = withAuth(async (req: NextRequest, user) => {
    const supabase = await createSupabaseClient();
    const body = await req.json();

    const { customerId, year, month, mode, beyannameler } = body;

    // Validate required fields
    if (!customerId || !year || !month) {
        return NextResponse.json(
            { error: "customerId, year ve month alanları zorunludur" },
            { status: 400 }
        );
    }

    if (!beyannameler || !Array.isArray(beyannameler) || beyannameler.length === 0) {
        return NextResponse.json(
            { error: "En az bir beyanname türü seçilmelidir" },
            { status: 400 }
        );
    }

    // Fetch customer
    const { data: customer, error: customerError } = await supabase
        .from('Customer')
        .select('id, unvan, kisaltma, telefon1')
        .eq('id', customerId)
        .single();

    if (customerError || !customer) {
        return NextResponse.json(
            { error: "Müşteri bulunamadı" },
            { status: 404 }
        );
    }

    // Check phone number
    if (!customer.telefon1) {
        return NextResponse.json(
            { error: "Müşterinin telefon numarası tanımlı değil" },
            { status: 400 }
        );
    }

    // Create message
    const customerName = customer.kisaltma || customer.unvan;
    const message = createDeclarationNotificationMessage(
        customerName,
        year,
        month,
        beyannameler
    );

    // Send WhatsApp message
    const result = await sendWhatsAppMessage({
        to: customer.telefon1,
        message
    });

    if (!result.success) {
        return NextResponse.json(
            { error: result.error || "WhatsApp gönderimi başarısız" },
            { status: 500 }
        );
    }

    // Update mail status
    const now = new Date().toISOString();

    // Check if record exists
    const { data: existing } = await supabase
        .from('mail_status')
        .select('id, sentBeyannameler')
        .eq('customerId', customerId)
        .eq('year', year)
        .eq('month', month)
        .eq('mode', mode || 'mukellef')
        .single();

    if (existing) {
        // Update existing record
        await supabase
            .from('mail_status')
            .update({
                whatsappSent: true,
                whatsappSentAt: now,
                sentBeyannameler: beyannameler,
                updatedAt: now
            })
            .eq('id', existing.id);
    } else {
        // Create new record
        await supabase
            .from('mail_status')
            .insert({
                id: randomUUID(),
                customerId,
                year,
                month,
                mode: mode || 'mukellef',
                tenantId: user.tenantId,
                whatsappSent: true,
                whatsappSentAt: now,
                sentBeyannameler: beyannameler,
                createdAt: now,
                updatedAt: now
            });
    }

    return NextResponse.json({
        success: true,
        messageId: result.messageId,
        timestamp: result.timestamp
    });
});

/**
 * PUT /api/mail/whatsapp
 *
 * Toplu WhatsApp mesajı gönderir.
 * Body:
 *   - customerIds: string[] - Müşteri ID listesi
 *   - year: Yıl
 *   - month: Ay
 *   - mode: "mukellef" | "banka"
 *   - beyannameler: string[]
 */
export const PUT = withAuth(async (req: NextRequest, user) => {
    const supabase = await createSupabaseClient();
    const body = await req.json();

    const { customerIds, year, month, mode, beyannameler } = body;

    // Validate
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
        return NextResponse.json(
            { error: "customerIds listesi zorunludur" },
            { status: 400 }
        );
    }

    if (!year || !month) {
        return NextResponse.json(
            { error: "year ve month alanları zorunludur" },
            { status: 400 }
        );
    }

    if (!beyannameler || !Array.isArray(beyannameler) || beyannameler.length === 0) {
        return NextResponse.json(
            { error: "En az bir beyanname türü seçilmelidir" },
            { status: 400 }
        );
    }

    // Fetch all customers
    const { data: customers, error: customersError } = await supabase
        .from('Customer')
        .select('id, unvan, kisaltma, telefon1')
        .in('id', customerIds);

    if (customersError || !customers) {
        return NextResponse.json(
            { error: "Müşteriler getirilemedi" },
            { status: 500 }
        );
    }

    const results = {
        success: 0,
        failed: 0,
        noPhone: 0,
        errors: [] as { customerId: string; customerName: string; error: string }[]
    };

    const now = new Date().toISOString();

    // Process each customer
    for (const customer of customers) {
        if (!customer.telefon1) {
            results.noPhone++;
            results.errors.push({
                customerId: customer.id,
                customerName: customer.unvan,
                error: "Telefon numarası yok"
            });
            continue;
        }

        const customerName = customer.kisaltma || customer.unvan;
        const message = createDeclarationNotificationMessage(
            customerName,
            year,
            month,
            beyannameler
        );

        const sendResult = await sendWhatsAppMessage({
            to: customer.telefon1,
            message
        });

        if (sendResult.success) {
            results.success++;

            // Update mail status
            const { data: existing } = await supabase
                .from('mail_status')
                .select('id')
                .eq('customerId', customer.id)
                .eq('year', year)
                .eq('month', month)
                .eq('mode', mode || 'mukellef')
                .single();

            if (existing) {
                await supabase
                    .from('mail_status')
                    .update({
                        whatsappSent: true,
                        whatsappSentAt: now,
                        sentBeyannameler: beyannameler,
                        updatedAt: now
                    })
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('mail_status')
                    .insert({
                        id: randomUUID(),
                        customerId: customer.id,
                        year,
                        month,
                        mode: mode || 'mukellef',
                        tenantId: user.tenantId,
                        whatsappSent: true,
                        whatsappSentAt: now,
                        sentBeyannameler: beyannameler,
                        createdAt: now,
                        updatedAt: now
                    });
            }
        } else {
            results.failed++;
            results.errors.push({
                customerId: customer.id,
                customerName: customer.unvan,
                error: sendResult.error || "Gönderim başarısız"
            });
        }

        // Add delay between messages to avoid rate limiting (1 second)
        if (customers.indexOf(customer) < customers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return NextResponse.json({
        success: true,
        results
    });
});
