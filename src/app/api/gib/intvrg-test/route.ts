/**
 * INTVRG Beyanname Test API Endpoint
 * POST /api/gib/intvrg-test
 *
 * Electron Bot'a WebSocket üzerinden INTVRG test komutu gönderir.
 * Mevcut /api/gib/sync endpoint'ine dokunmaz.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
    }

    const {
        baslangicTarihi,
        bitisTarihi,
        donemBasAy,
        donemBasYil,
        donemBitAy,
        donemBitYil,
        durumFiltresi,
        downloadBeyanname,
        downloadTahakkuk,
        downloadSgk,
    } = body;

    if (!baslangicTarihi || !bitisTarihi) {
        return NextResponse.json(
            { error: "Başlangıç ve bitiş tarihleri gerekli" },
            { status: 400 }
        );
    }

    // Tenant GİB ayarlarını al
    const tenant = await prisma.tenants.findUnique({
        where: { id: session.user.tenantId },
        select: { gibSettings: true, captchaKey: true }
    });

    const gibSettings: any = tenant?.gibSettings || {};
    const GIB_USERNAME = gibSettings.gibCode;
    const GIB_PASSWORD = gibSettings.gibPassword;
    const CAPTCHA_KEY = gibSettings.captchaKey || tenant?.captchaKey || process.env.CAPTCHA_API_KEY || process.env.TWOCAPTCHA_API_KEY;

    if (!GIB_USERNAME || !GIB_PASSWORD) {
        return NextResponse.json(
            { error: "GİB kullanıcı bilgileri (Kod/Şifre) tanımlı değil. Ayarlardan giriniz." },
            { status: 400 }
        );
    }

    const tenantId = session.user.tenantId!;

    // Şifre çözme
    let decryptedPassword = GIB_PASSWORD;
    try {
        if (GIB_PASSWORD && GIB_PASSWORD.startsWith('{')) {
            decryptedPassword = decrypt(GIB_PASSWORD);
        }
    } catch (e) {
        console.error('[INTVRG-TEST] Decrypt error:', e);
        return NextResponse.json({
            error: "Şifre çözümlenemedi. Lütfen şifreyi tekrar kaydedin."
        }, { status: 400 });
    }

    // Electron Bot'a komutu gönder
    try {
        const wsServerUrl = process.env.WS_SERVER_URL || 'http://localhost:3000';

        const response = await fetch(`${wsServerUrl}/_internal/bot-command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenantId,
                userId: session.user.id,
                type: 'bot:start-intvrg-test',
                data: {
                    tenantId,
                    username: GIB_USERNAME,
                    password: decryptedPassword,
                    captchaApiKey: CAPTCHA_KEY,
                    ocrSpaceApiKey: process.env.OCR_SPACE_API_KEY,
                    baslangicTarihi,
                    bitisTarihi,
                    donemBasAy: donemBasAy || '01',
                    donemBasYil: donemBasYil || '2026',
                    donemBitAy: donemBitAy || '12',
                    donemBitYil: donemBitYil || '2026',
                    durumFiltresi: durumFiltresi || 'onaylandi',
                    downloadBeyanname: downloadBeyanname ?? true,
                    downloadTahakkuk: downloadTahakkuk ?? true,
                    downloadSgk: downloadSgk ?? true,
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`WebSocket server hatası: ${error}`);
        }

        return NextResponse.json({
            success: true,
            delegated: true,
            message: "INTVRG test komutu Electron Bot'a gönderildi"
        });

    } catch (error) {
        console.error("[INTVRG-TEST] Error:", error);
        return NextResponse.json(
            { error: (error as Error).message || "Sunucu hatası" },
            { status: 500 }
        );
    }
}
