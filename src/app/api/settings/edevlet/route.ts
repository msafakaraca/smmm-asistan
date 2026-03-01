import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit";
import { z } from "zod";

// ============================================
// GUVENLIK: TCKN Validation
// ============================================
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

// Input validation schema
const edevletSettingsSchema = z.object({
    tckn: z.string().refine(
        (val) => !val || isValidTCKN(val),
        { message: "Gecersiz T.C. Kimlik No" }
    ).optional(),
    password: z.string().max(100).optional(),
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
            select: { edevletSettings: true }
        });

        if (!tenant) {
            return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
        }

        const edevletSettings: any = tenant.edevletSettings || {};

        // Şifreyi decrypt et
        let decryptedPassword: string | null = null;
        if (edevletSettings.password) {
            try {
                decryptedPassword = decrypt(edevletSettings.password);
            } catch {
                decryptedPassword = null;
            }
        }

        return NextResponse.json({
            tckn: edevletSettings.tckn || "",
            password: decryptedPassword || ""
        });
    } catch (error) {
        console.error("Error fetching e-Devlet settings:", error);
        return NextResponse.json({ error: "Ayarlar yuklenirken hata olustu" }, { status: 500 });
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
        const validationResult = edevletSettingsSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                { error: "Gecersiz veri", details: validationResult.error.flatten() },
                { status: 400 }
            );
        }

        const { tckn, password } = validationResult.data;

        // Mevcut ayarlari al
        const currentTenant = await prisma.tenants.findUnique({
            where: { id: tenantId },
            select: { edevletSettings: true }
        });

        const currentSettings: any = currentTenant?.edevletSettings || {};

        // Yeni ayarlari hazirla - hassas verileri sifrele
        const newSettings = {
            tckn: tckn || currentSettings.tckn,
            // Sadece dolu gelirse guncelle ve sifrele, bos gelirse eskisini koru
            password: password ? encrypt(password) : currentSettings.password,
        };

        await prisma.tenants.update({
            where: { id: tenantId },
            data: {
                edevletSettings: newSettings,
            }
        });

        // Audit log
        await auditLog.update(
            { id: session.user.id || "", email: session.user.email || "", tenantId },
            "settings",
            tenantId,
            { type: "edevlet_settings" }
        );

        return NextResponse.json({ success: true, message: "e-Devlet ayarlari kaydedildi" });
    } catch (error) {
        console.error("Error saving e-Devlet settings:", error);
        return NextResponse.json({ error: "Ayarlar kaydedilirken hata olustu" }, { status: 500 });
    }
}
