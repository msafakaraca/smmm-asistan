/**
 * Email Messages API
 * GET /api/email/messages - E-postaları listele
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

    const searchParams = req.nextUrl.searchParams;

    // Filter params
    const connectionId = searchParams.get('connectionId');
    const folder = searchParams.get('folder') || 'inbox';
    const search = searchParams.get('search');
    const isRead = searchParams.get('isRead');
    const customerId = searchParams.get('customerId');

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: {
      tenantId: string;
      folder: string;
      connectionId?: string;
      isRead?: boolean;
      customerId?: string;
      OR?: Array<{
        subject?: { contains: string; mode: 'insensitive' };
        fromEmail?: { contains: string; mode: 'insensitive' };
        fromName?: { contains: string; mode: 'insensitive' };
        snippet?: { contains: string; mode: 'insensitive' };
      }>;
    } = {
      tenantId: user.tenantId,
      folder,
    };

    if (connectionId) {
      where.connectionId = connectionId;
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { fromEmail: { contains: search, mode: 'insensitive' } },
        { fromName: { contains: search, mode: 'insensitive' } },
        { snippet: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isRead !== null && isRead !== undefined) {
      where.isRead = isRead === 'true';
    }

    if (customerId) {
      where.customerId = customerId;
    }

    // Fetch emails
    const [emails, total] = await Promise.all([
      prisma.email_messages.findMany({
        where,
        select: {
          id: true,
          provider: true,
          providerId: true,
          fromEmail: true,
          fromName: true,
          subject: true,
          snippet: true,
          isRead: true,
          isStarred: true,
          hasAttachments: true,
          receivedAt: true,
          connectionId: true,
          customerId: true,
          customers: {
            select: {
              id: true,
              kisaltma: true,
              unvan: true,
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
        orderBy: { receivedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.email_messages.count({ where }),
    ]);

    // Stats
    const unreadCount = await prisma.email_messages.count({
      where: {
        tenantId: user.tenantId,
        folder,
        isRead: false,
        ...(connectionId ? { connectionId } : {}),
      },
    });

    return NextResponse.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total,
        unread: unreadCount,
      },
    });
  } catch (error) {
    console.error('[Email Messages API] Error:', error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}
