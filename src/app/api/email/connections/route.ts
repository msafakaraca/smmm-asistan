/**
 * Email OAuth Connections API
 * GET /api/email/connections - Bağlı hesapları listele
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connections = await prisma.email_oauth_connections.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        provider: true,
        email: true,
        lastSyncAt: true,
        syncStatus: true,
        syncError: true,
        createdAt: true,
        _count: {
          select: { email_messages: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform response
    const transformed = connections.map((conn) => ({
      id: conn.id,
      provider: conn.provider,
      email: conn.email,
      lastSyncAt: conn.lastSyncAt,
      syncStatus: conn.syncStatus,
      syncError: conn.syncError,
      createdAt: conn.createdAt,
      emailCount: conn._count.email_messages,
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('[Email Connections API] Error:', error);
    return NextResponse.json(
      { error: "Failed to fetch connections" },
      { status: 500 }
    );
  }
}
