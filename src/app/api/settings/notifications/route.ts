import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { z } from "zod";

// Bildirim ayarları şeması
const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  whatsappNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  reminderNotifications: z.boolean().optional(),
  taskNotifications: z.boolean().optional(),
  announcementNotifications: z.boolean().optional(),
  whatsappApiKey: z.string().optional().nullable(),
});

/**
 * GET /api/settings/notifications
 * Bildirim ayarlarını getir
 */
export async function GET() {
  try {
    const user = await getUserWithProfile();

    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: user.tenantId },
      select: {
        notificationSettings: true,
        whatsappApiKey: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Ofis bulunamadı" }, { status: 404 });
    }

    // Varsayılan değerlerle birleştir
    const defaultSettings = {
      emailNotifications: true,
      whatsappNotifications: false,
      smsNotifications: false,
      reminderNotifications: true,
      taskNotifications: true,
      announcementNotifications: true,
    };

    const settings = {
      ...defaultSettings,
      ...(tenant.notificationSettings as object || {}),
    };

    return NextResponse.json({
      ...settings,
      hasWhatsappApiKey: !!tenant.whatsappApiKey,
    });
  } catch (error) {
    console.error("Bildirim ayarları hatası:", error);
    return NextResponse.json(
      { error: "Bildirim ayarları alınamadı" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/notifications
 * Bildirim ayarlarını güncelle
 * Yetki: owner veya admin
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();

    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    // Sadece owner ve admin güncelleyebilir
    if (!["owner", "admin"].includes(user.role)) {
      return NextResponse.json(
        { error: "Bu işlem için yetkiniz yok" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = notificationSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { whatsappApiKey, ...notificationSettings } = validation.data;

    // Mevcut ayarları al
    const tenant = await prisma.tenants.findUnique({
      where: { id: user.tenantId },
      select: { notificationSettings: true },
    });

    // Ayarları birleştir
    const updatedSettings = {
      ...(tenant?.notificationSettings as object || {}),
      ...notificationSettings,
    };

    // Güncelleme verisi
    const updateData: {
      notificationSettings: object;
      whatsappApiKey?: string | null;
      updatedAt: Date;
    } = {
      notificationSettings: updatedSettings,
      updatedAt: new Date(),
    };

    // WhatsApp API key güncellemesi (şifrelenmiş)
    if (whatsappApiKey !== undefined) {
      updateData.whatsappApiKey = whatsappApiKey
        ? encrypt(whatsappApiKey)
        : null;
    }

    await prisma.tenants.update({
      where: { id: user.tenantId },
      data: updateData,
    });

    return NextResponse.json({
      message: "Bildirim ayarları güncellendi",
    });
  } catch (error) {
    console.error("Bildirim ayarları güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Bildirim ayarları güncellenemedi" },
      { status: 500 }
    );
  }
}
