import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

// Profil güncelleme şeması
const profileUpdateSchema = z.object({
  name: z.string().min(2, "Ofis adı en az 2 karakter olmalı").optional(),
  email: z.string().email("Geçerli bir email adresi girin").optional().nullable(),
  telefon: z.string().optional().nullable(),
  adres: z.string().optional().nullable(),
  vergiDairesi: z.string().optional().nullable(),
  vknTckn: z.string().optional().nullable(),
  smmmSicilNo: z.string().optional().nullable(),
});

/**
 * GET /api/settings/profile
 * Ofis profil bilgilerini getir
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
        id: true,
        name: true,
        slug: true,
        email: true,
        telefon: true,
        adres: true,
        vergiDairesi: true,
        vknTckn: true,
        smmmSicilNo: true,
        plan: true,
        status: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Ofis bulunamadı" }, { status: 404 });
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Profil getirme hatası:", error);
    return NextResponse.json(
      { error: "Profil bilgileri alınamadı" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/profile
 * Ofis profil bilgilerini güncelle
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
    const validation = profileUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    const updatedTenant = await prisma.tenants.update({
      where: { id: user.tenantId },
      data: {
        ...(data.name && { name: data.name }),
        email: data.email,
        telefon: data.telefon,
        adres: data.adres,
        vergiDairesi: data.vergiDairesi,
        vknTckn: data.vknTckn,
        smmmSicilNo: data.smmmSicilNo,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        telefon: true,
        adres: true,
        vergiDairesi: true,
        vknTckn: true,
        smmmSicilNo: true,
      },
    });

    return NextResponse.json({
      message: "Profil bilgileri güncellendi",
      data: updatedTenant,
    });
  } catch (error) {
    console.error("Profil güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Profil güncellenemedi" },
      { status: 500 }
    );
  }
}
