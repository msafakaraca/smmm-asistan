/**
 * Email Sync API
 * POST /api/email/sync - Manuel senkronizasyon tetikle
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { syncConnection } from "@/lib/email/sync";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const connection = await prisma.email_oauth_connections.findFirst({
      where: { id: connectionId, tenantId: user.tenantId },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    // Check if already syncing
    if (connection.syncStatus === 'syncing') {
      return NextResponse.json(
        { error: "Sync already in progress" },
        { status: 409 }
      );
    }

    // Start sync
    const result = await syncConnection(connection);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Email Sync API] Error:', error);
    return NextResponse.json(
      { error: "Failed to sync emails" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/email/sync?all=true - Tüm bağlantıları senkronize et
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all connections for tenant
    const connections = await prisma.email_oauth_connections.findMany({
      where: {
        tenantId: user.tenantId,
        syncStatus: { not: 'syncing' },
      },
    });

    if (connections.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No connections to sync",
        results: [],
      });
    }

    // Sync all connections
    const results = await Promise.all(
      connections.map(async (conn) => ({
        connectionId: conn.id,
        email: conn.email,
        provider: conn.provider,
        ...(await syncConnection(conn)),
      }))
    );

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('[Email Sync API] Error:', error);
    return NextResponse.json(
      { error: "Failed to sync emails" },
      { status: 500 }
    );
  }
}
