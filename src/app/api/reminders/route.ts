import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";
import { auditLog } from "@/lib/audit";
import { invalidateDashboard } from "@/lib/dashboard-invalidation";
import type { CreateReminderInput } from "@/types/reminder";

/**
 * GET /api/reminders
 * Belirli ay/yıl için reminder listesini döner
 *
 * Query params:
 * - year: number (default: current year)
 * - month: number (1-12, default: current month)
 * - type: "event" | "task" (optional - filter by type)
 * - customerId: string (optional - filter by customer)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear())
    );
    const month = parseInt(
      searchParams.get("month") || String(new Date().getMonth() + 1)
    );
    const type = searchParams.get("type"); // "event" | "task"
    const customerId = searchParams.get("customerId");

    // Ay başlangıç ve bitiş tarihleri
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Build where clause
    const whereClause: Record<string, unknown> = {
      tenantId: user.tenantId,
      userId: user.id,
      date: {
        gte: startDate,
        lte: endDate,
      },
      status: { not: "cancelled" },
    };

    // Type filter
    if (type && (type === "event" || type === "task")) {
      whereClause.type = type;
    }

    // Customer filter - customerId veya customerIds içinde ara
    if (customerId) {
      whereClause.OR = [
        { customerId },
        { customerIds: { has: customerId } },
      ];
    }

    const reminders = await prisma.reminders.findMany({
      where: whereClause,
      include: {
        customers: {
          select: {
            id: true,
            unvan: true,
            kisaltma: true,
            vknTckn: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    // CustomerIds içindeki müşterileri çek
    const allCustomerIds = new Set<string>();
    reminders.forEach((r) => {
      if (r.customerId) allCustomerIds.add(r.customerId);
      r.customerIds?.forEach((id) => allCustomerIds.add(id));
    });

    const customersMap = new Map<string, { id: string; unvan: string; kisaltma: string | null; vknTckn: string }>();

    if (allCustomerIds.size > 0) {
      const customers = await prisma.customers.findMany({
        where: {
          id: { in: Array.from(allCustomerIds) },
          tenantId: user.tenantId,
        },
        select: {
          id: true,
          unvan: true,
          kisaltma: true,
          vknTckn: true,
        },
      });
      customers.forEach((c) => customersMap.set(c.id, c));
    }

    // Frontend için customer ve customers array'ini map'le
    const mappedReminders = reminders.map((r) => {
      // Tekli müşteri (legacy)
      const customer = r.customerId ? customersMap.get(r.customerId) || null : null;

      // Çoklu müşteriler
      const customersArray = r.customerIds
        ?.map((id) => customersMap.get(id))
        .filter(Boolean) || [];

      return {
        ...r,
        customer,
        customers: customersArray,
      };
    });

    return NextResponse.json(mappedReminders);
  } catch (error) {
    console.error("[GET /api/reminders] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reminders
 * Yeni reminder oluşturur
 *
 * Body: CreateReminderInput
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreateReminderInput = await req.json();
    const {
      title,
      description,
      type,
      date,
      isAllDay,
      startTime,
      endTime,
      repeatPattern,
      repeatDays,
      repeatEndDate,
      phoneNumber,
      sendWhatsApp,
      location,
      customerId,
      customerIds,
    } = body;

    // Validation
    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Başlık zorunludur" },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { error: "Tarih zorunludur" },
        { status: 400 }
      );
    }

    // Müşteri ID'lerini birleştir (tekli ve çoklu)
    const allCustomerIds = new Set<string>();
    if (customerId) allCustomerIds.add(customerId);
    customerIds?.forEach((id) => allCustomerIds.add(id));

    // Müşterilerin varlığını ve tenant uyumunu kontrol et
    if (allCustomerIds.size > 0) {
      const customers = await prisma.customers.findMany({
        where: {
          id: { in: Array.from(allCustomerIds) },
        },
        select: { id: true, tenantId: true },
      });

      // Tüm müşteriler mevcut mu?
      if (customers.length !== allCustomerIds.size) {
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
    }

    // isAllDay ise startTime ve endTime null olmalı
    const finalStartTime = isAllDay ? null : startTime || null;
    const finalEndTime = isAllDay ? null : endTime || null;

    // Kaydet
    const reminder = await prisma.reminders.create({
      data: {
        id: randomUUID(),
        title: title.trim(),
        description: description?.trim() || null,
        type: type || "event",
        date: new Date(date),
        isAllDay: isAllDay || false,
        startTime: finalStartTime,
        endTime: finalEndTime,
        repeatPattern: repeatPattern || null,
        repeatDays: repeatDays || [],
        repeatEndDate: repeatEndDate ? new Date(repeatEndDate) : null,
        phoneNumber: phoneNumber?.trim() || null,
        sendWhatsApp: sendWhatsApp || false,
        location: location?.trim() || null,
        customerId: customerId || null,
        customerIds: Array.from(allCustomerIds),
        userId: user.id,
        tenantId: user.tenantId,
        updatedAt: new Date(),
      },
    });

    // Müşteri bilgilerini çek
    let customersData: { id: string; unvan: string; kisaltma: string | null; vknTckn: string }[] = [];
    if (allCustomerIds.size > 0) {
      customersData = await prisma.customers.findMany({
        where: { id: { in: Array.from(allCustomerIds) } },
        select: { id: true, unvan: true, kisaltma: true, vknTckn: true },
      });
    }

    // Frontend için customer ve customers alanlarını ekle
    const mappedReminder = {
      ...reminder,
      customer: customerId ? customersData.find((c) => c.id === customerId) || null : null,
      customers: customersData,
    };

    // Audit log
    await auditLog.create(
      { id: user.id, email: user.email || "", tenantId: user.tenantId },
      "reminders",
      reminder.id,
      { title: reminder.title, type: reminder.type, date: reminder.date?.toISOString() }
    );

    invalidateDashboard(user.tenantId, ['upcoming']);

    return NextResponse.json(mappedReminder, { status: 201 });
  } catch (error) {
    console.error("[POST /api/reminders] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
