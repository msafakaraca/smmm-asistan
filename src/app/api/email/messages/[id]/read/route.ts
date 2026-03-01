/**
 * Email Message Read Status API
 * PUT /api/email/messages/[id]/read - Okundu olarak işaretle
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { isRead = true } = body;

    // Verify ownership
    const existing = await prisma.email_messages.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Update read status
    const updated = await prisma.email_messages.update({
      where: { id, tenantId: user.tenantId },
      data: { isRead },
    });

    return NextResponse.json({
      success: true,
      isRead: updated.isRead,
    });
  } catch (error) {
    console.error('[Email Read API] Error:', error);
    return NextResponse.json(
      { error: "Failed to update read status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/email/messages/[id]/read - Batch read status update
 * Body: { messageIds: string[], isRead: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { messageIds, isRead = true } = body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json(
        { error: "messageIds array is required" },
        { status: 400 }
      );
    }

    // Update all messages
    const result = await prisma.email_messages.updateMany({
      where: {
        id: { in: messageIds },
        tenantId: user.tenantId,
      },
      data: { isRead },
    });

    return NextResponse.json({
      success: true,
      updated: result.count,
    });
  } catch (error) {
    console.error('[Email Read API] Error:', error);
    return NextResponse.json(
      { error: "Failed to update read status" },
      { status: 500 }
    );
  }
}
