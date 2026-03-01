import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { CreateTemplateRequest, UpdateTemplateRequest } from "@/components/announcements/types";

/**
 * GET /api/announcements/templates
 * Şablon listesini getir
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const activeOnly = searchParams.get("activeOnly") === "true";
    const type = searchParams.get("type");

    const templates = await prisma.announcement_templates.findMany({
      where: {
        tenantId: user.tenantId,
        ...(activeOnly && { isActive: true }),
        ...(type && { type }),
      },
      include: {
        _count: {
          select: { scheduled_announcements: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("[Templates GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/announcements/templates
 * Yeni şablon oluştur
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreateTemplateRequest = await req.json();
    const { name, subject, content, type, channels } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Şablon adı zorunludur" },
        { status: 400 }
      );
    }

    if (!content || content.trim() === "") {
      return NextResponse.json(
        { error: "Şablon içeriği zorunludur" },
        { status: 400 }
      );
    }

    // Aynı isimde şablon var mı kontrol et
    const existing = await prisma.announcement_templates.findUnique({
      where: {
        tenantId_name: {
          tenantId: user.tenantId,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Bu isimde bir şablon zaten mevcut" },
        { status: 400 }
      );
    }

    const template = await prisma.announcement_templates.create({
      data: {
        name: name.trim(),
        subject: subject?.trim() || null,
        content: content.trim(),
        type: type || "general",
        channels: channels || [],
        tenantId: user.tenantId,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("[Templates POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/announcements/templates
 * Şablon güncelle (id query param ile)
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Şablon ID gerekli" },
        { status: 400 }
      );
    }

    const body: UpdateTemplateRequest = await req.json();

    // Şablonun var olduğunu ve kullanıcının tenant'ına ait olduğunu kontrol et
    const existing = await prisma.announcement_templates.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Şablon bulunamadı" },
        { status: 404 }
      );
    }

    // İsim değişiyorsa, aynı isimde başka şablon var mı kontrol et
    if (body.name && body.name.trim() !== existing.name) {
      const duplicateName = await prisma.announcement_templates.findUnique({
        where: {
          tenantId_name: {
            tenantId: user.tenantId,
            name: body.name.trim(),
          },
        },
      });

      if (duplicateName) {
        return NextResponse.json(
          { error: "Bu isimde bir şablon zaten mevcut" },
          { status: 400 }
        );
      }
    }

    const template = await prisma.announcement_templates.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.subject !== undefined && { subject: body.subject?.trim() || null }),
        ...(body.content && { content: body.content.trim() }),
        ...(body.type && { type: body.type }),
        ...(body.channels && { channels: body.channels }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("[Templates PUT] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/announcements/templates
 * Şablon sil (id query param ile)
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Şablon ID gerekli" },
        { status: 400 }
      );
    }

    // Şablonun var olduğunu ve kullanıcının tenant'ına ait olduğunu kontrol et
    const existing = await prisma.announcement_templates.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Şablon bulunamadı" },
        { status: 404 }
      );
    }

    await prisma.announcement_templates.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Templates DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
