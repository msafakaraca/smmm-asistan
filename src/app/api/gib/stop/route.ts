/**
 * GİB Bot Stop API
 *
 * Bot'u durdurmak için WebSocket üzerinden stop komutu gönderir.
 */

import { NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";

export async function POST() {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Internal bot-command API'sine POST yaparak stop komutunu broadcast et
    const wsPort = process.env.WS_PORT || '3001';
    const response = await fetch(`http://localhost:${process.env.PORT || 3000}/_internal/bot-command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        tenantId: user.tenantId,
        type: 'bot:stop',
        data: { reason: 'user_requested' }
      })
    });

    if (!response.ok) {
      console.error('[STOP-API] Internal API error:', response.status);
      return NextResponse.json(
        { error: "Stop komutu gönderilemedi" },
        { status: 500 }
      );
    }

    console.log(`[STOP-API] Bot stop command sent for tenant: ${user.tenantId}`);

    return NextResponse.json({
      success: true,
      message: "Bot durdurma komutu gönderildi"
    });

  } catch (error) {
    console.error('[STOP-API] Error:', error);
    return NextResponse.json(
      { error: "İşlem sırasında hata oluştu" },
      { status: 500 }
    );
  }
}
