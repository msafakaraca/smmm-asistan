/**
 * GİB Mükellef Listesi Sync API
 * WebSocket üzerinden Electron bot'a komut gönderir
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.tenantId) {
        return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;

    try {
        // GİB credentials from tenant settings
        const tenant = await prisma.tenants.findUnique({
            where: { id: tenantId },
            select: { gibSettings: true, captchaKey: true }
        });

        const gibSettings = tenant?.gibSettings as { gibCode?: string; gibPassword?: string; captchaKey?: string } | null;
        const captchaApiKey = gibSettings?.captchaKey || tenant?.captchaKey || process.env.CAPTCHA_API_KEY || process.env.TWOCAPTCHA_API_KEY;

        if (!gibSettings?.gibCode || !gibSettings?.gibPassword) {
            return NextResponse.json({
                error: "GİB giriş bilgileri eksik. Lütfen Ayarlar > Şifreler bölümünden giriş bilgilerini kaydedin."
            }, { status: 400 });
        }

        // Decrypt password if encrypted (JSON format with v2 encryption)
        let decryptedPassword = gibSettings.gibPassword;
        try {
            if (gibSettings.gibPassword && gibSettings.gibPassword.startsWith('{')) {
                decryptedPassword = decrypt(gibSettings.gibPassword);
            }
        } catch (e) {
            console.error('[GİB Mükellef Sync] Şifre decrypt hatası:', e);
            return NextResponse.json({
                error: "Şifre çözümlenemedi. Lütfen şifreyi tekrar kaydedin."
            }, { status: 400 });
        }

        // Send command to Electron bot via WebSocket (using internal server endpoint)
        // IMPORTANT: Use tenantId for tenant-wide broadcast (so ALL tenant users including Electron receive the command)
        const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/_internal/bot-command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: session.user.id,
                tenantId: tenantId, // Tenant-wide broadcast
                type: 'gib:sync-taxpayers',
                data: {
                    username: gibSettings.gibCode,
                    password: decryptedPassword,
                    captchaApiKey: captchaApiKey,
                    tenantId: tenantId
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Bot komutu gönderilemedi");
        }

        return NextResponse.json({
            success: true,
            message: "Bot başlatıldı. Lütfen açılan Electron penceresini takip edin."
        });

    } catch (error) {
        console.error("GİB sync error:", error);
        return NextResponse.json({
            error: (error as Error).message
        }, { status: 500 });
    }
}
