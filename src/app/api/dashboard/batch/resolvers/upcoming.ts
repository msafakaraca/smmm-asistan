import { prisma } from "@/lib/db";

interface UserProfile {
  id: string;
  tenantId: string;
}

/**
 * Saat string'ini dakikaya çevirir
 */
function timeToMinutes(time: string | null): number {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

function compareByDateAndTime(
  a: { date: Date | null; startTime: string | null; isAllDay: boolean },
  b: { date: Date | null; startTime: string | null; isAllDay: boolean }
): number {
  if (!a.date && !b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;

  const dateA = new Date(a.date).setHours(0, 0, 0, 0);
  const dateB = new Date(b.date).setHours(0, 0, 0, 0);

  if (dateA !== dateB) return dateA - dateB;

  if (a.isAllDay && !b.isAllDay) return -1;
  if (!a.isAllDay && b.isAllDay) return 1;
  if (a.isAllDay && b.isAllDay) return 0;

  return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
}

/**
 * Dashboard Upcoming Resolver
 * Mevcut upcoming/route.ts logic'ini resolver fonksiyona çıkarır.
 */
export async function resolveUpcoming(
  user: UserProfile,
  params: Record<string, string> = {}
): Promise<{ events: unknown[]; tasks: unknown[] }> {
  const limit = parseInt(params.limit) || 3;
  const days = parseInt(params.days) || 30;

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
  const fetchLimit = limit * 3;

  const [upcomingEvents, upcomingTasks] = await Promise.all([
    prisma.reminders.findMany({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
        type: "event",
        status: "active",
        date: { gte: today, lte: endDate },
      },
      include: {
        customers: {
          select: { id: true, unvan: true, kisaltma: true },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: fetchLimit,
    }),
    prisma.reminders.findMany({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
        type: "task",
        status: "active",
        date: { gte: today, lte: endDate },
      },
      include: {
        customers: {
          select: { id: true, unvan: true, kisaltma: true },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: fetchLimit,
    }),
  ]);

  // Müşteri map oluştur
  const allCustomerIds = new Set<string>();
  [...upcomingEvents, ...upcomingTasks].forEach((r) => {
    if (r.customerId) allCustomerIds.add(r.customerId);
    r.customerIds?.forEach((id) => allCustomerIds.add(id));
  });

  const customersMap = new Map<string, { id: string; unvan: string; kisaltma: string | null }>();

  if (allCustomerIds.size > 0) {
    const customers = await prisma.customers.findMany({
      where: {
        id: { in: Array.from(allCustomerIds) },
        tenantId: user.tenantId,
      },
      select: { id: true, unvan: true, kisaltma: true },
    });
    customers.forEach((c) => customersMap.set(c.id, c));
  }

  const filterPastToday = (r: { date: Date | null; startTime: string | null; isAllDay: boolean }) => {
    if (!r.date) return false;
    const reminderDate = new Date(r.date);
    reminderDate.setHours(0, 0, 0, 0);

    if (reminderDate.getTime() > today.getTime()) return true;

    if (reminderDate.getTime() === today.getTime()) {
      if (r.isAllDay) return true;
      if (r.startTime) {
        return timeToMinutes(r.startTime) >= currentTimeMinutes;
      }
      return true;
    }

    return false;
  };

  const transformReminder = (r: (typeof upcomingEvents)[0]) => {
    const reminderDate = new Date(r.date!);
    reminderDate.setHours(0, 0, 0, 0);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const diffTime = reminderDate.getTime() - todayStart.getTime();
    const daysUntil = Math.round(diffTime / (1000 * 60 * 60 * 24));

    const customer = r.customerId
      ? customersMap.get(r.customerId) || null
      : null;

    const customers =
      r.customerIds
        ?.map((id) => customersMap.get(id))
        .filter(Boolean) || [];

    return {
      id: r.id,
      title: r.title,
      description: r.description,
      type: r.type,
      date: r.date!.toISOString(),
      isAllDay: r.isAllDay,
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status,
      customer,
      customers,
      daysUntil: Math.max(0, daysUntil),
    };
  };

  const filteredEvents = upcomingEvents
    .filter(filterPastToday)
    .sort(compareByDateAndTime)
    .slice(0, limit)
    .map(transformReminder);

  const filteredTasks = upcomingTasks
    .filter(filterPastToday)
    .sort(compareByDateAndTime)
    .slice(0, limit)
    .map(transformReminder);

  return {
    events: filteredEvents,
    tasks: filteredTasks,
  };
}
