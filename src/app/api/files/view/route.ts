import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { stat } from "fs/promises";
import { createReadStream, existsSync } from "fs";
import path from "path";
import { downloadFile as downloadFromSupabase } from "@/lib/storage-supabase";

/**
 * GET /api/files/view?id=documentId
 * PDF dosyasını inline olarak görüntüle (browser'da açılır)
 *
 * Dosya kaynakları:
 * 1. Supabase Storage (storage: "supabase" veya path formatı UUID/...)
 * 2. Legacy yerel storage (path: /uploads/... veya storage/...)
 */
export async function GET(req: NextRequest) {
    const user = await getUserWithProfile();
    if (!user?.id) {
        return new NextResponse(renderErrorPage("Oturum geçersiz", "Lütfen tekrar giriş yapın"), {
            status: 401,
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });
    }

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        const tenantId = user.tenantId;

        if (!id) {
            return new NextResponse(renderErrorPage("Dosya ID eksik", "Geçerli bir dosya ID'si belirtilmedi"), {
                status: 400,
                headers: { "Content-Type": "text/html; charset=utf-8" }
            });
        }

        // Fetch document info
        const document = await prisma.documents.findUnique({
            where: { id },
        });

        if (!document) {
            console.error(`[View] Document not found in DB: ${id}`);
            return new NextResponse(renderErrorPage("Dosya bulunamadı", `ID: ${id} veritabanında bulunamadı`), {
                status: 404,
                headers: { "Content-Type": "text/html; charset=utf-8" }
            });
        }

        // Security check: Ensure file belongs to user's tenant
        if (document.tenantId !== tenantId) {
            return new NextResponse(renderErrorPage("Erişim engellendi", "Bu dosyaya erişim yetkiniz yok"), {
                status: 403,
                headers: { "Content-Type": "text/html; charset=utf-8" }
            });
        }

        if (document.isFolder) {
            return new NextResponse(renderErrorPage("Klasör görüntülenemez", "Bu bir klasördür, dosya değil"), {
                status: 400,
                headers: { "Content-Type": "text/html; charset=utf-8" }
            });
        }

        console.log(`[View] Document path from DB: ${document.path}, storage: ${document.storage}`);

        // Encode filename for Content-Disposition
        const encodedFilename = encodeURIComponent(document.name);

        // ═══════════════════════════════════════════════════════════════════
        // STRATEGY 1: Check storage field first (most reliable)
        // STRATEGY 2: Detect Supabase path by format (UUID pattern)
        // STRATEGY 3: Fall back to local file system
        // ═══════════════════════════════════════════════════════════════════

        // Check if storage is explicitly set to supabase
        const isSupabaseStorage = document.storage === 'supabase' || document.storage === 's3';

        // Check if path looks like Supabase format:
        // - UUID/UUID/year/month/file.pdf (e.g., abc123.../def456.../2024/01/file.pdf)
        // - Doesn't start with / or storage/ or uploads/ or public/
        // - Doesn't contain Windows drive letters (C:, D:)
        const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const isSupabasePath = document.path &&
            !document.path.startsWith('/') &&
            !document.path.startsWith('storage/') &&
            !document.path.startsWith('uploads/') &&
            !document.path.startsWith('public/') &&
            !document.path.includes(':') && // Not Windows absolute path
            UUID_PATTERN.test(document.path); // Path starts with UUID (tenantId)

        // Try Supabase if either condition is met
        if ((isSupabaseStorage || isSupabasePath) && document.path) {
            try {
                console.log(`[View] Trying Supabase Storage: ${document.path}`);
                const blob = await downloadFromSupabase(document.path);
                const arrayBuffer = await blob.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                console.log(`[View] Supabase file loaded successfully. Size: ${buffer.length} bytes`);

                return new NextResponse(buffer, {
                    headers: {
                        "Content-Type": document.mimeType || "application/pdf",
                        "Content-Length": buffer.length.toString(),
                        "Content-Disposition": `inline; filename*=UTF-8''${encodedFilename}`,
                        "Cache-Control": "private, max-age=3600"
                    }
                });
            } catch (supabaseError: any) {
                console.error(`[View] Supabase download failed: ${supabaseError?.message || supabaseError}`);
                // If storage is explicitly supabase, don't fall back to local
                if (isSupabaseStorage) {
                    return new NextResponse(renderErrorPage(
                        "Supabase Storage Hatası",
                        `Dosya Supabase'den indirilemedi: ${supabaseError?.message || 'Bilinmeyen hata'}. Path: ${document.path}`
                    ), {
                        status: 500,
                        headers: { "Content-Type": "text/html; charset=utf-8" }
                    });
                }
                // Otherwise fall through to local file system
                console.log(`[View] Falling back to local file system...`);
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // LOCAL FILE SYSTEM (Legacy support)
        // ═══════════════════════════════════════════════════════════════════
        let filePath: string;

        if (document.path?.startsWith('storage/')) {
            filePath = path.join(process.cwd(), document.path);
        } else if (document.path?.startsWith('/uploads/') || document.path?.startsWith('uploads/')) {
            filePath = path.join(process.cwd(), "public", document.path);
        } else if (document.path) {
            filePath = document.path.startsWith('/') || document.path.includes(':')
                ? document.path
                : path.join(process.cwd(), document.path);
        } else {
            console.error(`[View] Document has no path: ${id}`);
            return new NextResponse(renderErrorPage("Dosya yolu bulunamadı", "Veritabanında dosya yolu kayıtlı değil"), {
                status: 404,
                headers: { "Content-Type": "text/html; charset=utf-8" }
            });
        }

        console.log(`[View] Resolved local file path: ${filePath}`);

        if (!existsSync(filePath)) {
            console.error(`[View] Physical file not found at: ${filePath}`);
            console.error(`[View] Debug info - storage: ${document.storage}, path: ${document.path}, isSupabasePath: ${isSupabasePath}`);

            // Provide more detailed error message
            const debugInfo = `
                <br><br>
                <div class="path">
                    <strong>Debug Bilgisi:</strong><br>
                    Storage: ${document.storage || 'local'}<br>
                    DB Path: ${document.path}<br>
                    Resolved Path: ${filePath}<br>
                    Supabase Path Algılandı: ${isSupabasePath ? 'Evet' : 'Hayır'}
                </div>
            `;

            return new NextResponse(renderErrorPage(
                "Fiziksel dosya bulunamadı",
                `Dosya sunucuda mevcut değil.${document.storage === 'local' ? ' Dosya Supabase Storage\'a taşınmış olabilir veya silinmiş.' : ''}${debugInfo}`
            ), {
                status: 404,
                headers: { "Content-Type": "text/html; charset=utf-8" }
            });
        }

        // Get file stats for content length
        const stats = await stat(filePath);

        console.log(`[View] Local file found. Size: ${stats.size} bytes. Streaming...`);

        // Stream file
        const stream = createReadStream(filePath);

        return new NextResponse(stream as any, {
            headers: {
                "Content-Type": document.mimeType || "application/pdf",
                "Content-Length": stats.size.toString(),
                "Content-Disposition": `inline; filename*=UTF-8''${encodedFilename}`,
                "Cache-Control": "private, max-age=3600"
            }
        });

    } catch (error) {
        console.error("View error:", error);
        return new NextResponse(renderErrorPage("Sunucu hatası", String(error)), {
            status: 500,
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });
    }
}

function renderErrorPage(title: string, message: string): string {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>PDF Görüntüleme Hatası</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #1a1a1a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .container { text-align: center; padding: 40px; background: #2a2a2a; border-radius: 12px; max-width: 600px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        h1 { color: #f87171; margin-bottom: 10px; font-size: 24px; }
        p { color: #d1d5db; margin-bottom: 20px; word-break: break-all; line-height: 1.5; }
        .path { font-family: monospace; background: #000; padding: 8px; border-radius: 4px; font-size: 12px; color: #fbbf24; margin-bottom: 20px; }
        button { background: #3b82f6; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s; }
        button:hover { background: #2563eb; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        <p>${message}</p>
        <button onclick="window.close()">Pencereyi Kapat</button>
    </div>
</body>
</html>`;
}
