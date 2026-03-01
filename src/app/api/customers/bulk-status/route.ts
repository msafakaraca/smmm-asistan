import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { z } from "zod";

// Pasif Mükellefleri grubu adı
const PASSIVE_GROUP_NAME = "Pasif Mükellefleri";

// Request validation schema
const bulkStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "En az bir müşteri seçilmelidir"),
  status: z.enum(["active", "passive"], {
    errorMap: () => ({ message: "Geçersiz durum değeri" }),
  }),
});

/**
 * Pasif Mükellefleri grubunu getirir veya oluşturur
 */
async function getOrCreatePassiveGroup(tenantId: string) {
  let group = await prisma.customer_groups.findFirst({
    where: { tenantId, name: PASSIVE_GROUP_NAME },
  });

  if (!group) {
    group = await prisma.customer_groups.create({
      data: {
        name: PASSIVE_GROUP_NAME,
        description: "Sistem grubu - Pasif mükellefleri içerir",
        color: "#EF4444", // Kırmızı
        icon: "archive",
        tenantId,
      },
    });
  }

  return group;
}

/**
 * POST /api/customers/bulk-status
 *
 * Seçilen müşterilerin durumunu toplu olarak değiştirir.
 *
 * Pasife alma işlemi:
 * - Müşteri durumunu "passive" yapar
 * - Beyanname takip kayıtlarını siler
 * - Takip satırlarını siler
 * - "Pasif Mükellefleri" grubuna ekler
 *
 * Aktife alma işlemi:
 * - Müşteri durumunu "active" yapar
 * - "Pasif Mükellefleri" grubundan çıkarır
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const body = await request.json();

    // Validation
    const validation = bulkStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { ids, status } = validation.data;

    // Müşterilerin tenant'a ait olduğunu kontrol et
    const customers = await prisma.customers.findMany({
      where: {
        id: { in: ids },
        tenantId,
      },
      select: { id: true, status: true },
    });

    if (customers.length !== ids.length) {
      return NextResponse.json(
        { error: "Bazı müşteriler bulunamadı veya erişim yetkiniz yok" },
        { status: 400 }
      );
    }

    // Transaction içinde tüm işlemleri yap
    const result = await prisma.$transaction(async (tx) => {
      if (status === "passive") {
        // Pasife alma işlemi

        // 1. Beyanname takip kayıtlarını sil
        await tx.beyanname_takip.deleteMany({
          where: {
            customerId: { in: ids },
            tenantId,
          },
        });

        // 2. Takip satırlarını sil
        await tx.takip_satirlar.deleteMany({
          where: {
            customerId: { in: ids },
            tenantId,
          },
        });

        // 3. Pasif Mükellefleri grubunu al/oluştur
        const passiveGroup = await getOrCreatePassiveGroup(tenantId);

        // 4. Gruba ekle (zaten varsa atla)
        for (const id of ids) {
          await tx.customer_group_members.upsert({
            where: {
              groupId_customerId: {
                groupId: passiveGroup.id,
                customerId: id,
              },
            },
            create: {
              groupId: passiveGroup.id,
              customerId: id,
              tenantId,
            },
            update: {}, // Zaten varsa değişiklik yapma
          });
        }

        // 5. Müşteri durumunu güncelle
        await tx.customers.updateMany({
          where: {
            id: { in: ids },
            tenantId,
          },
          data: { status: "passive" },
        });

        return { status: "passive", count: ids.length };
      } else {
        // Aktife alma işlemi

        // 1. Pasif Mükellefleri grubundan çıkar
        const passiveGroup = await tx.customer_groups.findFirst({
          where: { tenantId, name: PASSIVE_GROUP_NAME },
        });

        if (passiveGroup) {
          await tx.customer_group_members.deleteMany({
            where: {
              groupId: passiveGroup.id,
              customerId: { in: ids },
            },
          });
        }

        // 2. Müşteri durumunu güncelle
        await tx.customers.updateMany({
          where: {
            id: { in: ids },
            tenantId,
          },
          data: { status: "active" },
        });

        return { status: "active", count: ids.length };
      }
    });

    // Audit log - bulk status change
    await auditLog.bulk(
      { id: session.user.id || "", email: session.user.email || "", tenantId },
      "customers",
      "BULK_UPDATE",
      result.count,
      { action: status === "passive" ? "set_passive" : "set_active", ids }
    );

    return NextResponse.json({
      success: true,
      message:
        status === "passive"
          ? `${result.count} mükellef pasife alındı`
          : `${result.count} mükellef aktife alındı`,
      ...result,
    });
  } catch (error) {
    console.error("[bulk-status] Error:", error);
    return NextResponse.json(
      { error: "Durum güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
