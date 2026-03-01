import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp/mock";

/**
 * POST /api/reminders/send
 * WhatsApp mesajı gönderir (mock)
 *
 * Body: { reminderId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reminderId } = await req.json();

    if (!reminderId) {
      return NextResponse.json(
        { error: "reminderId zorunludur" },
        { status: 400 }
      );
    }

    // Reminder'ı getir (user bilgisiyle birlikte)
    const reminder = await prisma.reminders.findUnique({
      where: { id: reminderId },
      include: {
        user_profiles: {
          select: {
            phoneNumber: true,
            name: true,
          },
        },
      },
    });

    if (!reminder) {
      return NextResponse.json(
        { error: "Anımsatıcı bulunamadı" },
        { status: 404 }
      );
    }

    // Ownership check
    if (
      reminder.tenantId !== user.tenantId ||
      reminder.userId !== user.id
    ) {
      return NextResponse.json(
        { error: "Bu anımsatıcı için mesaj gönderme yetkiniz yok" },
        { status: 403 }
      );
    }

    // Telefon numarası kontrolü (reminder'daki override veya user'ın default'u)
    const phoneNumber = reminder.phoneNumber || reminder.user_profiles?.phoneNumber;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Telefon numarası bulunamadı. Lütfen profil ayarlarınızdan telefon numaranızı ekleyin veya anımsatıcıda bir telefon numarası belirtin." },
        { status: 400 }
      );
    }

    // WhatsApp mesajı oluştur
    const formattedDate = reminder.date ? new Date(reminder.date).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }) : "Tarih belirtilmemiş";

    let timeInfo = "";
    if (!reminder.isAllDay && reminder.startTime) {
      timeInfo = `\n🕐 Saat: ${reminder.startTime}`;
      if (reminder.endTime) {
        timeInfo += ` - ${reminder.endTime}`;
      }
    }

    let locationInfo = "";
    if (reminder.location) {
      locationInfo = `\n📍 Konum: ${reminder.location}`;
    }

    const message = `🔔 *Anımsatıcı*\n\n📌 ${reminder.title}${
      reminder.description ? `\n\n${reminder.description}` : ""
    }\n\n📅 ${formattedDate}${timeInfo}${locationInfo}\n\n---\nSMMM Asistan`;

    // Mock WhatsApp send
    const result = await sendWhatsAppMessage({
      to: phoneNumber,
      message,
    });

    // Reminder'ı güncelle (whatsappSentAt)
    await prisma.reminders.update({
      where: { id: reminderId },
      data: {
        whatsappSentAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "WhatsApp mesajı gönderildi",
      result,
      to: phoneNumber,
    });
  } catch (error) {
    console.error("[POST /api/reminders/send] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
