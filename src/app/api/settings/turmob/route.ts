import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";

// Simple encryption/decryption (matching GIB settings pattern)
function simpleEncrypt(text: string) {
    if (!text) return null;
    return Buffer.from(text).toString('base64');
}

function simpleDecrypt(text: string | null) {
    if (!text) return null;
    return Buffer.from(text, 'base64').toString('utf-8');
}

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const tenantId = (session.user as any).tenantId;

        const tenant = await prisma.tenants.findUnique({
            where: { id: tenantId },
            select: { turmobSettings: true }
        });

        if (!tenant) {
            return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
        }

        const turmobSettings: any = tenant.turmobSettings || {};

        // Şifreyi decrypt et (base64)
        let decryptedPassword: string | null = null;
        if (turmobSettings.password) {
            decryptedPassword = simpleDecrypt(turmobSettings.password);
        }

        return NextResponse.json({
            username: turmobSettings.username || "",
            password: decryptedPassword || ""
        });
    } catch (error) {
        console.error("Error fetching TÜRMOB settings:", error);
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
        const { username, password } = body;

        // Get current settings
        const currentTenant = await prisma.tenants.findUnique({
            where: { id: tenantId },
            select: { turmobSettings: true }
        });

        const currentSettings: any = currentTenant?.turmobSettings || {};

        // Prepare new settings - şifreyi encrypt et
        const newSettings = {
            username: username || currentSettings.username,
            // Only update password if provided (not empty) - encrypt with base64
            password: password ? simpleEncrypt(password) : currentSettings.password
        };

        await prisma.tenants.update({
            where: { id: tenantId },
            data: {
                turmobSettings: newSettings
            }
        });

        // Audit log
        await auditLog.update(
            { id: session.user.id || "", email: session.user.email || "", tenantId },
            "settings",
            tenantId,
            { type: "turmob_settings" }
        );

        return NextResponse.json({ success: true, message: "TÜRMOB ayarları kaydedildi" });
    } catch (error) {
        console.error("Error saving TÜRMOB settings:", error);
        return NextResponse.json({ error: "Ayarlar kaydedilirken hata oluştu" }, { status: 500 });
    }
}
