/**
 * GİB Sync API Endpoint
 * POST /api/gib/sync
 *
 * Electron Bot'a WebSocket üzerinden komut gönderir.
 * Bot işlemleri Electron uygulamasında çalışır.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export async function POST(request: Request) {
    // Auth check first
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { startDate, endDate, donemBasAy, donemBasYil, donemBitAy, donemBitYil, downloadFiles = true, vergiNo, tcKimlikNo, beyannameTuru } = body;

    // Validate dates
    if (!startDate || !endDate) {
        return NextResponse.json(
            { error: "Başlangıç ve bitiş tarihleri gerekli" },
            { status: 400 }
        );
    }

    // Get GIB credentials from DB (Tenant settings)
    const tenant = await prisma.tenants.findUnique({
        where: { id: session.user.tenantId },
        select: { gibSettings: true, captchaKey: true }
    });

    const gibSettings: any = tenant?.gibSettings || {};
    const GIB_USERNAME = gibSettings.gibCode;
    const GIB_PASSWORD = gibSettings.gibPassword;
    const GIB_PAROLA = gibSettings.gibParola;
    const CAPTCHA_KEY = gibSettings.captchaKey || tenant?.captchaKey || process.env.CAPTCHA_API_KEY || process.env.TWOCAPTCHA_API_KEY;

    if (!GIB_USERNAME || !GIB_PASSWORD) {
        return NextResponse.json(
            { error: "GİB kullanıcı bilgileri (Kod/Şifre) tanımlı değil. Ayarlardan giriniz." },
            { status: 400 }
        );
    }

    const tenantId = session.user.tenantId!;

    // Decrypt password if encrypted
    let decryptedPassword = GIB_PASSWORD;
    let decryptedParola = GIB_PAROLA;

    try {
        if (GIB_PASSWORD && GIB_PASSWORD.startsWith('{')) {
            decryptedPassword = decrypt(GIB_PASSWORD);
        }
        if (GIB_PAROLA && GIB_PAROLA.startsWith('{')) {
            decryptedParola = decrypt(GIB_PAROLA);
        }
    } catch (e) {
        console.error('[GIB Sync] Decrypt error:', e);
        return NextResponse.json({
            error: "Şifre çözümlenemedi. Lütfen şifreyi tekrar kaydedin."
        }, { status: 400 });
    }

    // Send command to Electron Bot via internal API
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: object) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                // Send bot:start command via internal API to WebSocket server
                const wsServerUrl = process.env.WS_SERVER_URL || 'http://localhost:3000';

                const response = await fetch(`${wsServerUrl}/_internal/bot-command`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tenantId,
                        userId: session.user.id,
                        type: 'bot:start',
                        data: {
                            tenantId,
                            username: GIB_USERNAME,
                            password: decryptedPassword,
                            parola: decryptedParola,
                            captchaApiKey: CAPTCHA_KEY,
                            ocrSpaceApiKey: process.env.OCR_SPACE_API_KEY,
                            startDate,
                            endDate,
                            donemBasAy,
                            donemBasYil,
                            donemBitAy,
                            donemBitYil,
                            downloadFiles,
                            vergiNo,
                            tcKimlikNo,
                            beyannameTuru,
                        }
                    })
                });

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`WebSocket server hatası: ${error}`);
                }

                send({ delegated: true });

                controller.close();
            } catch (error) {
                console.error("[GIB Sync] Error:", error);
                send({ error: (error as Error).message || "Sunucu hatası" });
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}

// GET - Check bot status or get settings info
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const tenant = await prisma.tenants.findUnique({
            where: { id: session.user.tenantId },
            select: { gibSettings: true, captchaKey: true }
        });

        const gibSettings: any = tenant?.gibSettings || {};

        // Debug: Hangi alanlar mevcut?
        const hasGibCode = !!(gibSettings.gibCode && gibSettings.gibCode.length > 0);
        const hasGibPassword = !!(gibSettings.gibPassword && gibSettings.gibPassword.length > 0);

        console.log('[GIB Sync GET] tenantId:', session.user.tenantId);
        console.log('[GIB Sync GET] gibSettings keys:', Object.keys(gibSettings));
        console.log('[GIB Sync GET] hasGibCode:', hasGibCode, '| hasGibPassword:', hasGibPassword);

        const hasDbCredentials = hasGibCode && hasGibPassword;
        const hasDbCaptcha = !!(gibSettings.captchaKey || tenant?.captchaKey);
        const hasEnvCaptcha = !!(process.env.CAPTCHA_API_KEY || process.env.TWOCAPTCHA_API_KEY);

        return NextResponse.json({
            hasCredentials: hasDbCredentials,
            hasCaptchaKey: hasDbCaptcha || hasEnvCaptcha,
            message: "Electron Bot kullanılıyor. Bot işlemleri masaüstü uygulamasında çalışır.",
            // Debug bilgisi (geliştirme için)
            _debug: {
                hasGibCode,
                hasGibPassword,
                gibSettingsKeys: Object.keys(gibSettings)
            }
        });

    } catch (error) {
        console.error("[GIB Sync GET] Error:", error);
        return NextResponse.json(
            { error: "Sunucu hatası" },
            { status: 500 }
        );
    }
}
