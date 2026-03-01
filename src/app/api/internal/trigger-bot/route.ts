/**
 * Internal Bot Trigger API
 *
 * POST: WebSocket server üzerinden bot'a mesaj gönderir
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Internal request header kontrolü
    const isInternal = req.headers.get("X-Internal-Request") === "true";
    const tenantId = req.headers.get("X-Tenant-Id");

    if (!isInternal || !tenantId) {
      return NextResponse.json(
        { error: "Unauthorized internal request" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { action, year, month } = body;

    // server.ts'teki internal endpoint'e istek at
    const port = process.env.PORT || 3000;
    const response = await fetch(`http://localhost:${port}/_internal/bot-command`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenantId,
        type: "sgk:parse-request",
        data: {
          action,
          year,
          month,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[TRIGGER-BOT] Internal command failed:", error);
      return NextResponse.json(
        { error: "Bot command failed" },
        { status: 500 }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[TRIGGER-BOT] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
