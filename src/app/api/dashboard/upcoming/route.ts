import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

/**
 * Saat string'ini dakikaya çevirir (karşılaştırma için)
 * Örn: "09:30" -> 570, "14:00" -> 840
 */
function timeToMinutes(time: string | null): number {
  if (!time) return 0; // Saat yoksa en başa koy (tüm gün etkinlikleri)
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

/**
 * Tarih ve saate göre karşılaştırma fonksiyonu
 * Önce tarihe, sonra saate göre sıralar
 */
function compareByDateAndTime(
  a: { date: Date | null; startTime: string | null; isAllDay: boolean },
  b: { date: Date | null; startTime: string | null; isAllDay: boolean }
): number {
  // Null date'leri sona koy
  if (!a.date && !b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;

  // Önce tarihe göre karşılaştır
  const dateA = new Date(a.date).setHours(0, 0, 0, 0);
  const dateB = new Date(b.date).setHours(0, 0, 0, 0);

  if (dateA !== dateB) {
    return dateA - dateB;
  }

  // Aynı gündeyse saate göre sırala
  // Tüm gün etkinlikleri en başta
  if (a.isAllDay && !b.isAllDay) return -1;
  if (!a.isAllDay && b.isAllDay) return 1;
  if (a.isAllDay && b.isAllDay) return 0;

  // Her ikisinde de saat varsa saate göre sırala
  return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
}

/**
 * GET /api/dashboard/upcoming
 * Yaklaşan anımsatıcıları ve notları getirir
 * Tarihe ve saate göre en yakından uzağa sıralar
 *
 * Query params:
 * - limit: number (default: 3) - Her tip için maksimum kayıt
 * - days: number (default: 30) - Kaç gün içindeki kayıtlar
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "3");
    const days = parseInt(searchParams.get("days") || "30");

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0); // Bugünün başlangıcı

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

    // Sıralama için daha fazla kayıt al (saat bazlı filtreleme yapacağız)
    const fetchLimit = limit * 3; // Güvenlik marjı

    // Yaklaşan anımsatıcılar (type = "event")
    const upcomingEvents = await prisma.reminders.findMany({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
        type: "event",
        status: "active",
        date: {
          gte: today, // Bugünden itibaren
          lte: endDate,
        },
      },
      include: {
        customers: {
          select: {
            id: true,
            unvan: true,
            kisaltma: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: fetchLimit,
    });

    // Yaklaşan notlar/görevler (type = "task")
    const upcomingTasks = await prisma.reminders.findMany({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
        type: "task",
        status: "active",
        date: {
          gte: today, // Bugünden itibaren
          lte: endDate,
        },
      },
      include: {
        customers: {
          select: {
            id: true,
            unvan: true,
            kisaltma: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: fetchLimit,
    });

    // Customer IDs'den müşterileri çek
    const allCustomerIds = new Set<string>();
    [...upcomingEvents, ...upcomingTasks].forEach((r) => {
      if (r.customerId) allCustomerIds.add(r.customerId);
      r.customerIds?.forEach((id) => allCustomerIds.add(id));
    });

    const customersMap = new Map<
      string,
      { id: string; unvan: string; kisaltma: string | null }
    >();

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
        },
      });
      customers.forEach((c) => customersMap.set(c.id, c));
    }

    /**
     * Bugün için saati geçmiş kayıtları filtrele
     * Saati olan kayıtlar için: sadece henüz geçmemiş olanları göster
     * Tüm gün kayıtları: bugün hala göster
     */
    const filterPastToday = (r: { date: Date | null; startTime: string | null; isAllDay: boolean }) => {
      if (!r.date) return false;
      const reminderDate = new Date(r.date);
      reminderDate.setHours(0, 0, 0, 0);

      // Bugün değilse (gelecekte) her zaman göster
      if (reminderDate.getTime() > today.getTime()) {
        return true;
      }

      // Bugünse
      if (reminderDate.getTime() === today.getTime()) {
        // Tüm gün etkinliği ise göster
        if (r.isAllDay) return true;

        // Saat varsa, henüz geçmemişse göster
        if (r.startTime) {
          const reminderMinutes = timeToMinutes(r.startTime);
          return reminderMinutes >= currentTimeMinutes;
        }

        // Saat yoksa (ama tüm gün de değil) göster
        return true;
      }

      return false;
    };

    // Transform function
    const transformReminder = (r: (typeof upcomingEvents)[0]) => {
      const reminderDate = new Date(r.date!);
      reminderDate.setHours(0, 0, 0, 0);
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      // Gün farkını hesapla
      const diffTime = reminderDate.getTime() - todayStart.getTime();
      const daysUntil = Math.round(diffTime / (1000 * 60 * 60 * 24));

      // Tekli müşteri
      const customer = r.customerId
        ? customersMap.get(r.customerId) || null
        : null;

      // Çoklu müşteriler
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
        daysUntil: Math.max(0, daysUntil), // Negatif olmasın
      };
    };

    // Filtrele, sırala ve limit uygula
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

    return NextResponse.json({
      events: filteredEvents, // Anımsatıcılar
      tasks: filteredTasks, // Notlar/Görevler
    });
  } catch (error) {
    console.error("[Dashboard Upcoming] Error:", error);
    return NextResponse.json(
      { error: "Yaklaşan hatırlatıcılar yüklenirken hata oluştu" },
      { status: 500 }
    );
  }
}
