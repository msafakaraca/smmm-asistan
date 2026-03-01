import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import type { UpdateReminderInput } from "@/types/reminder";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * PATCH /api/reminders/[id]
 * Mevcut reminder'ı günceller
 *
 * Body: UpdateReminderInput
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: reminderId } = await context.params;

    // Ownership check
    const existing = await prisma.reminders.findUnique({
      where: { id: reminderId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Anımsatıcı bulunamadı" },
        { status: 404 }
      );
    }

    if (
      existing.tenantId !== user.tenantId ||
      existing.userId !== user.id
    ) {
      return NextResponse.json(
        { error: "Bu anımsatıcıyı düzenleme yetkiniz yok" },
        { status: 403 }
      );
    }

    const body: UpdateReminderInput = await req.json();

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) {
      updateData.title = body.title.trim();
    }
    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }
    if (body.type !== undefined) {
      updateData.type = body.type;
    }
    if (body.date !== undefined) {
      updateData.date = new Date(body.date);
    }
    if (body.isAllDay !== undefined) {
      updateData.isAllDay = body.isAllDay;
      if (body.isAllDay) {
        updateData.startTime = null;
        updateData.endTime = null;
      }
    }
    if (body.startTime !== undefined) {
      updateData.startTime = body.startTime || null;
    }
    if (body.endTime !== undefined) {
      updateData.endTime = body.endTime || null;
    }
    if (body.repeatPattern !== undefined) {
      updateData.repeatPattern = body.repeatPattern || null;
    }
    if (body.repeatDays !== undefined) {
      updateData.repeatDays = body.repeatDays || [];
    }
    if (body.repeatEndDate !== undefined) {
      updateData.repeatEndDate = body.repeatEndDate
        ? new Date(body.repeatEndDate)
        : null;
    }
    if (body.phoneNumber !== undefined) {
      updateData.phoneNumber = body.phoneNumber?.trim() || null;
    }
    if (body.sendWhatsApp !== undefined) {
      updateData.sendWhatsApp = body.sendWhatsApp;
    }
    if (body.location !== undefined) {
      updateData.location = body.location?.trim() || null;
    }
    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    // Customer validation (tekli - legacy)
    if (body.customerId !== undefined) {
      if (body.customerId) {
        const customer = await prisma.customers.findUnique({
          where: { id: body.customerId },
          select: { id: true, tenantId: true },
        });

        if (!customer) {
          return NextResponse.json(
            { error: "Mükellef bulunamadı" },
            { status: 404 }
          );
        }

        if (customer.tenantId !== user.tenantId) {
          return NextResponse.json(
            { error: "Bu mükellefi görüntüleme yetkiniz yok" },
            { status: 403 }
          );
        }
        updateData.customerId = body.customerId;
      } else {
        updateData.customerId = null;
      }
    }

    // CustomerIds validation (çoklu)
    if (body.customerIds !== undefined) {
      if (body.customerIds.length > 0) {
        const customers = await prisma.customers.findMany({
          where: { id: { in: body.customerIds } },
          select: { id: true, tenantId: true },
        });

        // Tüm müşteriler mevcut mu?
        if (customers.length !== body.customerIds.length) {
          return NextResponse.json(
            { error: "Bir veya daha fazla mükellef bulunamadı" },
            { status: 404 }
          );
        }

        // Tüm müşteriler aynı tenant'a mı ait?
        const invalidCustomers = customers.filter((c) => c.tenantId !== user.tenantId);
        if (invalidCustomers.length > 0) {
          return NextResponse.json(
            { error: "Bu mükellefleri görüntüleme yetkiniz yok" },
            { status: 403 }
          );
        }
        updateData.customerIds = body.customerIds;
      } else {
        updateData.customerIds = [];
      }
    }

    const updated = await prisma.reminders.update({
      where: { id: reminderId },
      data: updateData,
    });

    // Müşteri bilgilerini çek
    const allCustomerIds = new Set<string>();
    if (updated.customerId) allCustomerIds.add(updated.customerId);
    updated.customerIds?.forEach((id) => allCustomerIds.add(id));

    let customersData: { id: string; unvan: string; kisaltma: string | null; vknTckn: string }[] = [];
    if (allCustomerIds.size > 0) {
      customersData = await prisma.customers.findMany({
        where: { id: { in: Array.from(allCustomerIds) } },
        select: { id: true, unvan: true, kisaltma: true, vknTckn: true },
      });
    }

    // Frontend için customer ve customers alanlarını ekle
    const mappedReminder = {
      ...updated,
      customer: updated.customerId ? customersData.find((c) => c.id === updated.customerId) || null : null,
      customers: customersData,
    };

    // Audit log
    await auditLog.update(
      { id: user.id, email: user.email || "", tenantId: user.tenantId },
      "reminders",
      reminderId,
      { title: updated.title, status: updated.status }
    );

    return NextResponse.json(mappedReminder);
  } catch (error) {
    console.error("[PATCH /api/reminders/[id]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reminders/[id]
 * Reminder'ı siler (soft delete: status = "cancelled")
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: reminderId } = await context.params;

    // Ownership check
    const existing = await prisma.reminders.findUnique({
      where: { id: reminderId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Anımsatıcı bulunamadı" },
        { status: 404 }
      );
    }

    if (
      existing.tenantId !== user.tenantId ||
      existing.userId !== user.id
    ) {
      return NextResponse.json(
        { error: "Bu anımsatıcıyı silme yetkiniz yok" },
        { status: 403 }
      );
    }

    // Soft delete
    await prisma.reminders.update({
      where: { id: reminderId },
      data: {
        status: "cancelled",
        updatedAt: new Date(),
      },
    });

    // Audit log
    await auditLog.delete(
      { id: user.id, email: user.email || "", tenantId: user.tenantId },
      "reminders",
      reminderId,
      { title: existing.title }
    );

    return NextResponse.json({ success: true, message: "Anımsatıcı silindi" });
  } catch (error) {
    console.error("[DELETE /api/reminders/[id]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
