import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { buildDescription } from "@/lib/activity-descriptions";
import type { ActivityItem, ActivityPageResponse } from "@/types/dashboard";
import type { Prisma } from "@prisma/client";

/**
 * Dashboard Activity API
 *
 * audit_logs tablosundan son aktiviteleri döner.
 * 3 Response Modu:
 *   1. ?limit=8             → ActivityItem[] (eski format, geriye uyumlu)
 *   2. ?limit=8&diverse=true → ActivityItem[] (diverse, eski format)
 *   3. ?page=1&pageSize=25  → ActivityPageResponse (paginated)
 *
 * Filtreleme: userId, action, resource, startDate, endDate
 */

// ============================================
// INPUT VALIDATION HELPERS (F1, F5)
// ============================================

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateDate(dateStr: string | undefined): Date | null {
  if (!dateStr || !DATE_REGEX.test(dateStr)) return null;
  const date = new Date(dateStr + "T00:00:00.000Z");
  return isNaN(date.getTime()) ? null : date;
}

function validateInt(value: string | null, min: number, max: number, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) return defaultValue;
  return parsed;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tenantId = user.tenantId;

    // Parametre okuma (F5: validated integers)
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const limitParam = searchParams.get("limit");
    const diverseParam = searchParams.get("diverse") === "true";

    // Filtreler
    const filterUserId = searchParams.get("userId") || undefined;
    const filterAction = searchParams.get("action") || undefined;
    const filterResource = searchParams.get("resource") || undefined;
    const filterStartDate = searchParams.get("startDate") || undefined;
    const filterEndDate = searchParams.get("endDate") || undefined;

    // Mod tespiti (F5: safe integer parsing)
    const isPaginated = pageParam != null;
    const page = isPaginated ? validateInt(pageParam, 1, 10000, 1) : 1;
    const pageSize = isPaginated ? validateInt(pageSizeParam, 1, 50, 25) : undefined;
    const limit = !isPaginated ? validateInt(limitParam, 1, 50, 10) : undefined;

    // F1: Date validation
    const startDate = validateDate(filterStartDate);
    const endDate = validateDate(filterEndDate);
    const endDateEnd = endDate ? new Date(endDate.getTime()) : null;
    if (endDateEnd) {
      endDateEnd.setUTCHours(23, 59, 59, 999);
    }

    // Where koşulu (S3: Prisma type safety)
    const where: Prisma.audit_logsWhereInput = {
      tenantId,
      ...(filterUserId && { userId: filterUserId }),
      ...(filterAction && { action: filterAction }),
      ...(filterResource && { resource: filterResource }),
      ...(startDate || endDateEnd
        ? {
            timestamp: {
              ...(startDate && { gte: startDate }),
              ...(endDateEnd && { lte: endDateEnd }),
            },
          }
        : {}),
    };

    // ============================================
    // MOD 1 & 2: Limit-based (eski format)
    // ============================================
    if (!isPaginated) {
      let logs;

      if (diverseParam) {
        // Diverse algoritma: son 50 kayıt -> action bazlı grupla -> her gruptan 1 -> kalan slotları kronolojik
        logs = await prisma.audit_logs.findMany({
          where,
          orderBy: { timestamp: "desc" },
          take: 50,
          select: {
            id: true,
            action: true,
            resource: true,
            resourceId: true,
            userId: true,
            userEmail: true,
            details: true,
            timestamp: true,
          },
        });

        // Diverse seçim
        const targetCount = limit || 8;
        logs = diversifyActivities(logs, targetCount);
      } else {
        logs = await prisma.audit_logs.findMany({
          where,
          orderBy: { timestamp: "desc" },
          take: limit,
          select: {
            id: true,
            action: true,
            resource: true,
            resourceId: true,
            userId: true,
            userEmail: true,
            details: true,
            timestamp: true,
          },
        });
      }

      // User resolve + description build
      const activities = await enrichActivities(logs);
      return NextResponse.json(activities);
    }

    // ============================================
    // MOD 3: Paginated response
    // ============================================
    const [logs, total] = await Promise.all([
      prisma.audit_logs.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: pageSize!,
        skip: (page - 1) * pageSize!,
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          userId: true,
          userEmail: true,
          details: true,
          timestamp: true,
        },
      }),
      prisma.audit_logs.count({ where }),
    ]);

    const activities = await enrichActivities(logs);

    const response: ActivityPageResponse = {
      activities,
      total,
      page,
      pageSize: pageSize!,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Dashboard Activity API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================
// HELPERS
// ============================================

interface AuditLogRow {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userId: string | null;
  userEmail: string | null;
  details: unknown;
  timestamp: Date;
}

/**
 * Diverse aktivite seçimi (kesin algoritma):
 * 1. Son 50 kayıt -> action bazlı grupla
 * 2. Her gruptan en son 1'er tane al
 * 3. Kalan slotları kronolojik sırayla doldur
 * 4. Tümünü timestamp'e göre sırala
 * 5. İlk targetCount kadarını döndür
 */
function diversifyActivities(logs: AuditLogRow[], targetCount: number): AuditLogRow[] {
  if (logs.length <= targetCount) return logs;

  // Action bazlı grupla
  const grouped = new Map<string, AuditLogRow[]>();
  for (const log of logs) {
    const group = grouped.get(log.action) || [];
    group.push(log);
    grouped.set(log.action, group);
  }

  // F3: Deterministik sıralama - en güncel action grupları önce
  const sortedGroups = Array.from(grouped.entries()).sort(
    (a, b) => b[1][0].timestamp.getTime() - a[1][0].timestamp.getTime()
  );

  // Her gruptan en son 1'er tane al
  const selected = new Set<string>();
  const result: AuditLogRow[] = [];

  for (const [, group] of sortedGroups) {
    if (result.length >= targetCount) break;
    const first = group[0]; // Zaten timestamp DESC sıralı
    result.push(first);
    selected.add(first.id);
  }

  // Kalan slotları kronolojik sırayla doldur
  if (result.length < targetCount) {
    for (const log of logs) {
      if (result.length >= targetCount) break;
      if (!selected.has(log.id)) {
        result.push(log);
        selected.add(log.id);
      }
    }
  }

  // Timestamp'e göre sırala (en yeni üstte)
  result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return result.slice(0, targetCount);
}

/**
 * Audit log kayıtlarını ActivityItem formatına dönüştür.
 * User resolve: ayrı query + Map (schema migration YOK)
 * SMMM prefix: role === "admin"
 */
async function enrichActivities(logs: AuditLogRow[]): Promise<ActivityItem[]> {
  // Benzersiz userId'leri topla
  const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];

  // Toplu user_profiles sorgusu
  const users =
    userIds.length > 0
      ? await prisma.user_profiles.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, role: true },
        })
      : [];

  const userMap = new Map(users.map((u) => [u.id, u]));

  return logs.map((log) => {
    // 3 katmanlı fallback: userId -> email parse -> "Bilinmeyen Kullanıcı"
    let userName = "Bilinmeyen Kullanıcı";
    let userRole: string | undefined;

    const userProfile = log.userId ? userMap.get(log.userId) : null;
    if (userProfile?.name) {
      userName = userProfile.role === "admin" ? `SMMM ${userProfile.name}` : userProfile.name;
      userRole = userProfile.role || undefined;
    } else if (log.userEmail) {
      userName = extractUserName(log.userEmail);
    }

    const details = (log.details as Record<string, unknown>) || null;

    // Description builder (PURE FUNCTION)
    const description = buildDescription(log.action, log.resource, details, userName);

    return {
      id: log.id,
      action: log.action as ActivityItem["action"],
      resource: log.resource,
      resourceId: log.resourceId || undefined,
      userEmail: log.userEmail || undefined,
      userName,
      userRole,
      details: details || undefined,
      description,
      timestamp: log.timestamp.toISOString(),
    };
  });
}

/**
 * E-posta adresinden kullanıcı adını çıkarır (fallback)
 */
function extractUserName(email: string): string {
  const namePart = email.split("@")[0];
  return namePart
    .split(/[._-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
