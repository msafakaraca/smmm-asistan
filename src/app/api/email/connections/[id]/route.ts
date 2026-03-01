/**
 * Email OAuth Connection Detail API
 * DELETE /api/email/connections/[id] - Hesap bağlantısını kaldır
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const connection = await prisma.email_oauth_connections.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    // Delete connection (cascade will delete emails)
    await prisma.email_oauth_connections.delete({
      where: { id, tenantId: user.tenantId },
    });

    console.log(`[Email Connections API] Connection ${id} deleted`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Email Connections API] Error:', error);
    return NextResponse.json(
      { error: "Failed to delete connection" },
      { status: 500 }
    );
  }
}
