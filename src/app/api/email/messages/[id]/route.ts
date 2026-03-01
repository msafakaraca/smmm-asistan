/**
 * Email Message Detail API
 * GET /api/email/messages/[id] - E-posta detayı
 * PUT /api/email/messages/[id] - E-posta güncelle (isRead, isStarred, customerId)
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const email = await prisma.email_messages.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        customers: {
          select: {
            id: true,
            kisaltma: true,
            unvan: true,
            email: true,
          },
        },
        email_oauth_connections: {
          select: {
            id: true,
            email: true,
            provider: true,
          },
        },
      },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Mark as read automatically when viewing
    if (!email.isRead) {
      await prisma.email_messages.update({
        where: { id, tenantId: user.tenantId },
        data: { isRead: true },
      });
    }

    return NextResponse.json({
      ...email,
      isRead: true, // Return as read since we just marked it
    });
  } catch (error) {
    console.error('[Email Message API] Error:', error);
    return NextResponse.json(
      { error: "Failed to fetch email" },
      { status: 500 }
    );
  }
}

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

    // Verify ownership
    const existing = await prisma.email_messages.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Allowed updates
    const updateData: {
      isRead?: boolean;
      isStarred?: boolean;
      customerId?: string | null;
    } = {};

    if (typeof body.isRead === 'boolean') {
      updateData.isRead = body.isRead;
    }

    if (typeof body.isStarred === 'boolean') {
      updateData.isStarred = body.isStarred;
    }

    if (body.customerId !== undefined) {
      // Validate customer belongs to tenant
      if (body.customerId) {
        const customer = await prisma.customers.findFirst({
          where: { id: body.customerId, tenantId: user.tenantId },
        });
        if (!customer) {
          return NextResponse.json(
            { error: "Customer not found" },
            { status: 404 }
          );
        }
      }
      updateData.customerId = body.customerId || null;
    }

    const updated = await prisma.email_messages.update({
      where: { id, tenantId: user.tenantId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[Email Message API] Error:', error);
    return NextResponse.json(
      { error: "Failed to update email" },
      { status: 500 }
    );
  }
}
