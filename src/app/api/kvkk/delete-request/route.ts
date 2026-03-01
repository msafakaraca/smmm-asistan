/**
 * KVKK Veri Silme Talebi API
 * Kullanıcının verilerini silme talebi oluşturur
 *
 * POST /api/kvkk/delete-request
 *
 * Not: Gerçek silme işlemi admin onayı gerektirir.
 * Bu endpoint sadece talep kaydı oluşturur.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiHandler, requireAuth } from "@/lib/api-response";
import { auditLog } from "@/lib/audit";
import { z } from "zod";
import { fromZodError } from "@/lib/api-response";

const deleteRequestSchema = z.object({
  reason: z.string().min(10, "Silme gerekçesi en az 10 karakter olmalı"),
  confirmation: z.literal(true, {
    errorMap: () => ({ message: "Silme işlemini onaylamalısınız" }),
  }),
  deleteType: z.enum(["full", "anonymize"], {
    errorMap: () => ({
      message: "Silme tipi 'full' veya 'anonymize' olmalı",
    }),
  }),
});

export async function POST(req: NextRequest) {
  return apiHandler(
    async () => {
      const user = await requireAuth();
      const body = await req.json();

      // Validation
      const parsed = deleteRequestSchema.safeParse(body);
      if (!parsed.success) {
        throw fromZodError(parsed.error);
      }

      const { reason, deleteType } = parsed.data;

      // Audit log - kritik işlem
      await auditLog.log(user, "users", "DELETE", user.id, {
        type: "kvkk_delete_request",
        deleteType,
        reason,
        status: "pending",
      });

      // Silme talebi kaydı (audit_logs üzerinden takip edilir)
      // Gerçek bir tablo oluşturmak yerine audit log kullanıyoruz

      // Admin'e bildirim gönderilebilir (opsiyonel)
      // await sendAdminNotification({ type: 'kvkk_delete_request', userId: user.id });

      return {
        success: true,
        message: "Veri silme talebiniz alınmıştır",
        details: {
          requestId: `KVKK-${Date.now()}`,
          requestDate: new Date().toISOString(),
          deleteType,
          status: "pending",
          estimatedProcessingTime: "7 iş günü içinde",
          note:
            deleteType === "full"
              ? "Tüm verileriniz kalıcı olarak silinecektir. Bu işlem geri alınamaz."
              : "Verileriniz anonim hale getirilecektir. İstatistiksel amaçlarla anonim veriler saklanabilir.",
        },
      };
    },
    { successStatus: 201 }
  );
}

/**
 * Mevcut silme taleplerini getir
 * GET /api/kvkk/delete-request
 */
export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const user = await requireAuth();

    // Audit log'dan silme taleplerini getir
    const deleteRequests = await prisma.audit_logs.findMany({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
        action: "DELETE",
        resource: "users",
        details: {
          path: ["type"],
          equals: "kvkk_delete_request",
        },
      },
      orderBy: { timestamp: "desc" },
      take: 10,
    });

    return {
      requests: deleteRequests.map((r) => ({
        id: r.id,
        requestDate: r.timestamp,
        details: r.details,
      })),
    };
  });
}
