import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit";
import { z } from "zod";

// ============================================
// GUVENLIK: Input Validation Schema
// ============================================
const gibSettingsSchema = z.object({
    gibCode: z.string().max(20).optional(),
    gibPassword: z.string().max(100).optional(),
    gibParola: z.string().max(100).optional(),
    captchaKey: z.string().max(100).optional(),
});

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const tenantId = (session.user as any).tenantId;

        const tenant = await prisma.tenants.findUnique({
            where: { id: tenantId },
            select: { gibSettings: true, captchaKey: true }
        });

        if (!tenant) {
            return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
        }

        const gibSettings: any = tenant.gibSettings || {};

        // Şifreleri decrypt et (sifreler modülü ile aynı davranış)
        let decryptedPassword: string | null = null;
        let decryptedParola: string | null = null;

        if (gibSettings.gibPassword) {
            try {
                decryptedPassword = decrypt(gibSettings.gibPassword);
            } catch {
                decryptedPassword = null;
            }
        }

        if (gibSettings.gibParola) {
            try {
                decryptedParola = decrypt(gibSettings.gibParola);
            } catch {
                decryptedParola = null;
            }
        }

        // hasGibPassword ve hasGibParola: Şifrelerin veritabanında kayıtlı olup olmadığını belirtir
        const hasGibPassword = !!(gibSettings.gibPassword && gibSettings.gibPassword.length > 0);
        const hasGibParola = !!(gibSettings.gibParola && gibSettings.gibParola.length > 0);

        return NextResponse.json({
            gibCode: gibSettings.gibCode || "",
            gibPassword: decryptedPassword || "",
            gibParola: decryptedParola || "",
            captchaKey: tenant.captchaKey || "",
            hasGibPassword,
            hasGibParola
        });
    } catch (error) {
        console.error("Error fetching GIB settings:", error);
        return NextResponse.json({ error: "Ayarlar yüklenirken hata oluştu" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const tenantId = (session.user as any).tenantId;
        const body = await req.json();

        // GUVENLIK: Zod ile input validation
        const validationResult = gibSettingsSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                { error: "Gecersiz veri", details: validationResult.error.flatten() },
                { status: 400 }
            );
        }

        const { gibCode, gibPassword, gibParola, captchaKey } = validationResult.data;

        // Mevcut ayarları al
        const currentTenant = await prisma.tenants.findUnique({
            where: { id: tenantId },
            select: { gibSettings: true }
        });

        const currentSettings: any = currentTenant?.gibSettings || {};

        // Yeni ayarları hazırla - hassas verileri şifrele
        const newSettings = {
            gibCode: gibCode || currentSettings.gibCode,
            // Sadece dolu gelirse güncelle ve şifrele, boş gelirse eskisini koru
            gibPassword: gibPassword ? encrypt(gibPassword) : currentSettings.gibPassword,
            gibParola: gibParola ? encrypt(gibParola) : currentSettings.gibParola
        };

        // Debug: Kaydetme öncesi değerleri logla
        console.log('[GIB Settings POST] tenantId:', tenantId);
        console.log('[GIB Settings POST] received gibCode:', gibCode ? 'present' : 'empty');
        console.log('[GIB Settings POST] received gibPassword:', gibPassword ? 'present' : 'empty');
        console.log('[GIB Settings POST] newSettings.gibCode:', newSettings.gibCode ? 'present' : 'empty');
        console.log('[GIB Settings POST] newSettings.gibPassword:', newSettings.gibPassword ? 'present' : 'empty');

        await prisma.tenants.update({
            where: { id: tenantId },
            data: {
                gibSettings: newSettings,
                captchaKey: captchaKey !== undefined ? captchaKey : undefined
            }
        });

        // Audit log
        await auditLog.update(
            { id: session.user.id || "", email: session.user.email || "", tenantId },
            "settings",
            tenantId,
            { type: "gib_settings" }
        );

        return NextResponse.json({ success: true, message: "Ayarlar kaydedildi" });
    } catch (error) {
        console.error("Error saving GIB settings:", error);
        return NextResponse.json({ error: "Ayarlar kaydedilirken hata oluştu" }, { status: 500 });
    }
}
