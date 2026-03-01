/**
 * File Sync API
 * Tüm müşteriler için klasör yapısını senkronize eder
 * 
 * POST /api/files/sync - Klasörleri senkronize et (SSE streaming)
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { syncAllCustomerFolders } from "@/lib/file-system";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    const tenantId = (session.user as any).tenantId;

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const sendMessage = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                sendMessage({ percent: 5, message: "Senkronizasyon başlatılıyor..." });

                const result = await syncAllCustomerFolders(tenantId, (percent, message) => {
                    sendMessage({ percent, message });
                });

                // Send completion message
                sendMessage({
                    percent: 100,
                    message: "✅ Senkronizasyon Tamamlandı!",
                    complete: true,
                    stats: {
                        created: result.created,
                        existing: result.existing,
                        total: result.created + result.existing
                    }
                });

                controller.close();
            } catch (error) {
                console.error("Error syncing folders:", error);
                const errorMessage = error instanceof Error ? error.message : "Bilinmeyen hata";
                sendMessage({
                    percent: 100,
                    error: `Senkronizasyon hatası: ${errorMessage}`
                });
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
