/**
 * SGK Kontrol Parse All API
 *
 * POST: Electron bot'a SGK dosyalarını parse etmesi için WebSocket mesajı gönder
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenantId = (session.user as { tenantId: string }).tenantId;
    const body = await req.json();
    const { year, month, groupId } = body;

    if (!year || !month) {
      return NextResponse.json(
        { error: "year ve month gerekli" },
        { status: 400 }
      );
    }

    // server.ts'teki internal endpoint'e istek at - Bot'a WebSocket mesajı gönder
    const port = process.env.PORT || 3000;

    try {
      const response = await fetch(
        `http://localhost:${port}/_internal/bot-command`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenantId,
            type: "sgk:parse-files",
            data: {
              year,
              month,
              tenantId,
              groupId, // Grup filtresi için
            },
          }),
        }
      );

      if (!response.ok) {
        console.error("[SGK-PARSE-ALL] WebSocket mesajı gönderilemedi");
        return NextResponse.json({
          success: false,
          message: "Electron bot'a bağlanılamadı. Bot çalışır durumda mı?",
        });
      }

      return NextResponse.json({
        success: true,
        message: "SGK parse isteği bot'a gönderildi. Dosyalar işleniyor...",
        year,
        month,
      });
    } catch (fetchError) {
      console.error("[SGK-PARSE-ALL] Fetch error:", fetchError);
      return NextResponse.json({
        success: false,
        message:
          "Electron bot'a bağlanılamadı. Bot'un çalıştığından emin olun.",
      });
    }
  } catch (error) {
    console.error("Error triggering SGK parse:", error);
    return NextResponse.json(
      { error: "SGK parse işlemi başlatılamadı" },
      { status: 500 }
    );
  }
}
