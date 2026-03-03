import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit";
import { z } from "zod";

// ============================================
// GUVENLIK: Input Validation Schemas
// ============================================

// UUID format kontrolu
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// TCKN validation (11 haneli, algoritma kontrolu)
function isValidTCKN(tckn: string): boolean {
    if (!/^\d{11}$/.test(tckn)) return false;
    if (tckn[0] === '0') return false;

    const digits = tckn.split('').map(Number);

    // 10. hane kontrolu
    const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
    const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
    const check10 = ((oddSum * 7) - evenSum) % 10;
    if (check10 !== digits[9]) return false;

    // 11. hane kontrolu
    const sum10 = digits.slice(0, 10).reduce((a, b) => a + b, 0);
    if (sum10 % 10 !== digits[10]) return false;

    return true;
}

// VKN validation (10 haneli)
function isValidVKN(vkn: string): boolean {
    return /^\d{10}$/.test(vkn);
}

// Credentials update schema
const credentialsUpdateSchema = z.object({
    gibKodu: z.string().max(100).optional(),
    gibSifre: z.string().max(100).optional(),
    gibParola: z.string().max(100).optional(),
    turmobKullaniciAdi: z.string().max(100).optional(),
    turmobSifre: z.string().max(100).optional(),
    edevletTckn: z.string().refine(
        (val) => !val || isValidTCKN(val),
        { message: "Gecersiz T.C. Kimlik No" }
    ).optional(),
    edevletSifre: z.string().max(100).optional(),
    type: z.string().optional(), // gib, sgk, turmob, edevlet
});

// GET /api/customers/[id]/credentials
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const customer = await prisma.customers.findUnique({
            where: {
                id: id,
                tenantId: session.user.tenantId,
            },
            select: {
                gibKodu: true,
                gibSifre: true,
                gibParola: true,
                sgkKullaniciAdi: true,
                sgkIsyeriKodu: true,
                sgkSistemSifresi: true,
                sgkIsyeriSifresi: true,
                turmobKullaniciAdi: true,
                turmobSifre: true,
                edevletTckn: true,
                edevletSifre: true,
            },
        });

        if (!customer) {
            return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
        }

        // Decrypt credentials
        // Safe to return plain text here because this endpoint is protected
        // and specifically requested by the authorized user (e.g. for viewing/editing)
        const decryptedCredentials = {
            gibKodu: customer.gibKodu ? decrypt(customer.gibKodu) : "",
            gibSifre: customer.gibSifre ? decrypt(customer.gibSifre) : "",
            gibParola: customer.gibParola ? decrypt(customer.gibParola) : "",
            sgkKullaniciAdi: customer.sgkKullaniciAdi ? decrypt(customer.sgkKullaniciAdi) : "",
            sgkIsyeriKodu: customer.sgkIsyeriKodu ? decrypt(customer.sgkIsyeriKodu) : "",
            sgkSistemSifresi: customer.sgkSistemSifresi ? decrypt(customer.sgkSistemSifresi) : "",
            sgkIsyeriSifresi: customer.sgkIsyeriSifresi ? decrypt(customer.sgkIsyeriSifresi) : "",
            turmobKullaniciAdi: customer.turmobKullaniciAdi ? decrypt(customer.turmobKullaniciAdi) : "",
            turmobSifre: customer.turmobSifre ? decrypt(customer.turmobSifre) : "",
            edevletTckn: customer.edevletTckn ? decrypt(customer.edevletTckn) : "",
            edevletSifre: customer.edevletSifre ? decrypt(customer.edevletSifre) : "",
        };

        // Audit log - viewing sensitive data
        await auditLog.viewSensitive(
            { id: session.user.id || "", email: session.user.email || "", tenantId: session.user.tenantId },
            "credentials",
            id,
            "gib_credentials"
        );

        return NextResponse.json(decryptedCredentials);

    } catch (error) {
        console.error("Error fetching credentials:", error);
        return NextResponse.json(
            { error: "Şifreler çözülürken hata oluştu" },
            { status: 500 }
        );
    }
}

// PUT /api/customers/[id]/credentials
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // GUVENLIK: UUID format kontrolu
        if (!uuidRegex.test(id)) {
            return NextResponse.json({ error: "Gecersiz ID formati" }, { status: 400 });
        }

        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        // GUVENLIK: Zod ile input validation
        const validationResult = credentialsUpdateSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                { error: "Gecersiz veri", details: validationResult.error.flatten() },
                { status: 400 }
            );
        }

        const { gibKodu, gibSifre, gibParola, turmobKullaniciAdi, turmobSifre, edevletTckn, edevletSifre } = validationResult.data;

        // Musterinin var oldugunu ve tenant'a ait oldugunu kontrol et
        const customer = await prisma.customers.findUnique({
            where: {
                id: id,
                tenantId: session.user.tenantId,
            },
        });

        if (!customer) {
            return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
        }

        // Şifreleri encrypt et ve güncelle
        const updateData: {
            gibKodu?: string | null;
            gibSifre?: string | null;
            gibParola?: string | null;
            turmobKullaniciAdi?: string | null;
            turmobSifre?: string | null;
            edevletTckn?: string | null;
            edevletSifre?: string | null;
        } = {};

        if (gibKodu !== undefined) {
            updateData.gibKodu = gibKodu ? encrypt(gibKodu) : null;
        }
        if (gibSifre !== undefined) {
            updateData.gibSifre = gibSifre ? encrypt(gibSifre) : null;
        }
        if (gibParola !== undefined) {
            updateData.gibParola = gibParola ? encrypt(gibParola) : null;
        }
        if (turmobKullaniciAdi !== undefined) {
            updateData.turmobKullaniciAdi = turmobKullaniciAdi ? encrypt(turmobKullaniciAdi) : null;
        }
        if (turmobSifre !== undefined) {
            updateData.turmobSifre = turmobSifre ? encrypt(turmobSifre) : null;
        }
        if (edevletTckn !== undefined) {
            updateData.edevletTckn = edevletTckn ? encrypt(edevletTckn) : null;
        }
        if (edevletSifre !== undefined) {
            updateData.edevletSifre = edevletSifre ? encrypt(edevletSifre) : null;
        }

        await prisma.customers.update({
            where: { id: id, tenantId: session.user.tenantId },
            data: updateData,
        });

        // Audit log - updating sensitive data
        await auditLog.update(
            { id: session.user.id || "", email: session.user.email || "", tenantId: session.user.tenantId },
            "customers",
            id,
            { fields: Object.keys(updateData), action: "credentials_update" }
        );

        return NextResponse.json({ success: true, message: "Şifreler başarıyla güncellendi" });

    } catch (error) {
        console.error("Error updating credentials:", error);
        return NextResponse.json(
            { error: "Şifreler güncellenirken hata oluştu" },
            { status: 500 }
        );
    }
}
