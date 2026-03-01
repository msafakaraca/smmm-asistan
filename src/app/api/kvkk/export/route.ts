/**
 * KVKK Veri Export API
 * Kullanıcının tüm verilerini JSON formatında indirir
 *
 * GET /api/kvkk/export
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiHandler, requireAuth } from "@/lib/api-response";
import { auditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const user = await requireAuth();

    // Audit log
    await auditLog.log(user, "users", "EXPORT", user.id, {
      type: "kvkk_data_export",
    });

    // Tüm kullanıcı verilerini topla
    const [
      profile,
      customers,
      documents,
      reminders,
      tasks,
      beyannameTakip,
      sgkKontrol,
      kdvKontrol,
    ] = await Promise.all([
      // Kullanıcı profili
      prisma.user_profiles.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phoneNumber: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),

      // Müşteriler (credential'lar hariç)
      prisma.customers.findMany({
        where: { tenantId: user.tenantId },
        select: {
          id: true,
          unvan: true,
          kisaltma: true,
          vknTckn: true,
          vergiDairesi: true,
          sirketTipi: true,
          email: true,
          telefon1: true,
          telefon2: true,
          adres: true,
          yetkiliKisi: true,
          status: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          // GİB/SGK şifreleri dahil EDİLMEZ (güvenlik)
        },
      }),

      // Dokümanlar (metadata only)
      prisma.documents.findMany({
        where: { tenantId: user.tenantId },
        select: {
          id: true,
          name: true,
          originalName: true,
          type: true,
          mimeType: true,
          size: true,
          path: true,
          year: true,
          month: true,
          beyannameTuru: true,
          createdAt: true,
        },
      }),

      // Hatırlatıcılar
      prisma.reminders.findMany({
        where: { tenantId: user.tenantId },
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          date: true,
          completed: true,
          createdAt: true,
        },
      }),

      // Görevler
      prisma.tasks.findMany({
        where: { tenantId: user.tenantId },
        select: {
          id: true,
          title: true,
          description: true,
          priority: true,
          status: true,
          dueDate: true,
          createdAt: true,
        },
      }),

      // Beyanname takip
      prisma.beyanname_takip.findMany({
        where: { tenantId: user.tenantId },
        select: {
          id: true,
          year: true,
          month: true,
          customerId: true,
          beyannameler: true,
          createdAt: true,
        },
      }),

      // SGK kontrol
      prisma.sgk_kontrol.findMany({
        where: { tenantId: user.tenantId },
        select: {
          id: true,
          year: true,
          month: true,
          customerId: true,
          status: true,
          createdAt: true,
        },
      }),

      // KDV kontrol
      prisma.kdv_kontrol.findMany({
        where: { tenantId: user.tenantId },
        select: {
          id: true,
          year: true,
          month: true,
          customerId: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    // Export verisi
    const exportData = {
      exportDate: new Date().toISOString(),
      exportType: "KVKK Veri Talebi",
      user: {
        profile,
      },
      data: {
        customers,
        documents,
        reminders,
        tasks,
        beyannameTakip,
        sgkKontrol,
        kdvKontrol,
      },
      statistics: {
        customerCount: customers.length,
        documentCount: documents.length,
        reminderCount: reminders.length,
        taskCount: tasks.length,
      },
      notice:
        "Bu dosya KVKK kapsamında veri taşınabilirliği hakkınız gereği oluşturulmuştur. GİB/SGK şifreleri güvenlik nedeniyle dahil edilmemiştir.",
    };

    return exportData;
  });
}
