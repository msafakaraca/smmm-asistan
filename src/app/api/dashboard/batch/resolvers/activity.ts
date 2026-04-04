import { prisma } from "@/lib/db";
import { buildDescription } from "@/lib/activity-descriptions";
import type { ActivityItem } from "@/types/dashboard";

interface UserProfile {
  id: string;
  tenantId: string;
}

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
 * Dashboard Activity Resolver
 * Mevcut activity/route.ts logic'ini resolver fonksiyona çıkarır.
 * Sadece dashboard modu: limit + diverse
 */
export async function resolveActivity(
  user: UserProfile,
  params: Record<string, string> = {}
): Promise<ActivityItem[]> {
  const tenantId = user.tenantId;
  const limit = parseInt(params.limit) || 8;
  const diverse = params.diverse === "true";

  const selectFields = {
    id: true,
    action: true,
    resource: true,
    resourceId: true,
    userId: true,
    userEmail: true,
    details: true,
    timestamp: true,
  } as const;

  let logs: AuditLogRow[];

  if (diverse) {
    const rawLogs = await prisma.audit_logs.findMany({
      where: { tenantId },
      orderBy: { timestamp: "desc" },
      take: 50,
      select: selectFields,
    });
    logs = diversifyActivities(rawLogs, limit);
  } else {
    logs = await prisma.audit_logs.findMany({
      where: { tenantId },
      orderBy: { timestamp: "desc" },
      take: limit,
      select: selectFields,
    });
  }

  return enrichActivities(logs);
}

/**
 * Diverse aktivite seçimi
 */
function diversifyActivities(logs: AuditLogRow[], targetCount: number): AuditLogRow[] {
  if (logs.length <= targetCount) return logs;

  const grouped = new Map<string, AuditLogRow[]>();
  for (const log of logs) {
    const group = grouped.get(log.action) || [];
    group.push(log);
    grouped.set(log.action, group);
  }

  const sortedGroups = Array.from(grouped.entries()).sort(
    (a, b) => b[1][0].timestamp.getTime() - a[1][0].timestamp.getTime()
  );

  const selected = new Set<string>();
  const result: AuditLogRow[] = [];

  for (const [, group] of sortedGroups) {
    if (result.length >= targetCount) break;
    const first = group[0];
    result.push(first);
    selected.add(first.id);
  }

  if (result.length < targetCount) {
    for (const log of logs) {
      if (result.length >= targetCount) break;
      if (!selected.has(log.id)) {
        result.push(log);
        selected.add(log.id);
      }
    }
  }

  result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return result.slice(0, targetCount);
}

/**
 * Audit log kayıtlarını ActivityItem formatına dönüştür
 */
async function enrichActivities(logs: AuditLogRow[]): Promise<ActivityItem[]> {
  const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];

  const users =
    userIds.length > 0
      ? await prisma.user_profiles.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, role: true },
        })
      : [];

  const userMap = new Map(users.map((u) => [u.id, u]));

  return logs.map((log) => {
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

function extractUserName(email: string): string {
  const namePart = email.split("@")[0];
  return namePart
    .split(/[._-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
