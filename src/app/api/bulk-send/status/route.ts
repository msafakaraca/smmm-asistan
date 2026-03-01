import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

// GET - Gönderim durumlarını getir
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const documentIds = searchParams.get('documentIds')?.split(',').filter(Boolean);

    if (!documentIds || documentIds.length === 0) {
      return NextResponse.json({ error: "documentIds required" }, { status: 400 });
    }

    // Gönderim loglarını getir
    const logs = await prisma.bulk_send_logs.findMany({
      where: {
        documentId: { in: documentIds },
        tenantId: user.tenantId,
      },
      select: {
        documentId: true,
        mailSent: true,
        mailSentAt: true,
        mailSentTo: true,
        mailError: true,
        whatsappSent: true,
        whatsappSentAt: true,
        whatsappSentTo: true,
        whatsappType: true,
        whatsappError: true,
        smsSent: true,
        smsSentAt: true,
        smsSentTo: true,
        smsError: true,
      },
    });

    // DocumentId bazında map'e çevir
    const statusMap: Record<string, {
      mailSent: boolean;
      mailSentAt: string | null;
      mailSentTo: string | null;
      mailError: string | null;
      whatsappSent: boolean;
      whatsappSentAt: string | null;
      whatsappSentTo: string | null;
      whatsappType: string | null;
      whatsappError: string | null;
      smsSent: boolean;
      smsSentAt: string | null;
      smsSentTo: string | null;
      smsError: string | null;
    }> = {};

    for (const log of logs) {
      if (!log.documentId) continue;
      statusMap[log.documentId] = {
        mailSent: log.mailSent,
        mailSentAt: log.mailSentAt?.toISOString() || null,
        mailSentTo: log.mailSentTo,
        mailError: log.mailError,
        whatsappSent: log.whatsappSent,
        whatsappSentAt: log.whatsappSentAt?.toISOString() || null,
        whatsappSentTo: log.whatsappSentTo,
        whatsappType: log.whatsappType,
        whatsappError: log.whatsappError,
        smsSent: log.smsSent,
        smsSentAt: log.smsSentAt?.toISOString() || null,
        smsSentTo: log.smsSentTo,
        smsError: log.smsError,
      };
    }

    return NextResponse.json(statusMap);
  } catch (error) {
    console.error("[Bulk Status] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Gönderim durumlarını sıfırla
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { documentIds, resetType = 'all' } = body;

    if (!documentIds || documentIds.length === 0) {
      return NextResponse.json({ error: "documentIds required" }, { status: 400 });
    }

    // Sıfırlanacak alanları belirle
    const updateData: Record<string, boolean | null> = {};

    if (resetType === 'all' || resetType === 'mail') {
      updateData.mailSent = false;
      updateData.mailSentAt = null;
      updateData.mailSentTo = null;
      updateData.mailError = null;
    }

    if (resetType === 'all' || resetType === 'whatsapp') {
      updateData.whatsappSent = false;
      updateData.whatsappSentAt = null;
      updateData.whatsappSentTo = null;
      updateData.whatsappType = null;
      updateData.whatsappError = null;
    }

    if (resetType === 'all' || resetType === 'sms') {
      updateData.smsSent = false;
      updateData.smsSentAt = null;
      updateData.smsSentTo = null;
      updateData.smsError = null;
    }

    // Toplu güncelle
    await prisma.bulk_send_logs.updateMany({
      where: {
        documentId: { in: documentIds },
        tenantId: user.tenantId,
      },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Bulk Status Reset] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
