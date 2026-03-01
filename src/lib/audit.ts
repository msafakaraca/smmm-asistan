/**
 * Audit Logging System
 *
 * Bu modül güvenlik ve uyumluluk için audit log kaydı sağlar.
 * Tüm kritik işlemler bu sistem üzerinden loglanmalıdır.
 *
 * Kullanım:
 *   await auditLog.create(user, "customers", "CREATE", customerId, { name: "Yeni Müşteri" });
 *   await auditLog.login(user, ipAddress, userAgent);
 *   await auditLog.viewSensitive(user, "customers", customerId, "credentials");
 */

import { prisma } from "@/lib/db";
import { headers } from "next/headers";

// ============================================
// TYPES
// ============================================

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "VIEW"
  | "VIEW_SENSITIVE"
  | "EXPORT"
  | "IMPORT"
  | "BULK_DELETE"
  | "BULK_UPDATE"
  | "BOT_START"
  | "BOT_COMPLETE"
  | "BOT_ERROR"
  | "SETTINGS_UPDATE"
  | "PASSWORD_CHANGE"
  | "PERMISSION_CHANGE";

export type AuditResource =
  | "customers"
  | "documents"
  | "beyanname_takip"
  | "beyanname_turleri"
  | "credentials"
  | "users"
  | "settings"
  | "reminders"
  | "tasks"
  | "gib_bot"
  | "turmob_bot"
  | "email"
  | "announcements"
  | "sgk_kontrol"
  | "kdv_kontrol"
  | "takip"
  | "takip_satirlar"
  | "takip_kolonlar"
  | "customer_groups"
  | "customer_branches";

export interface AuditUser {
  id: string;
  email?: string;
  tenantId: string;
}

export interface AuditDetails {
  [key: string]: unknown;
  oldValue?: unknown;
  newValue?: unknown;
  error?: string;
  count?: number;
  fields?: string[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Request header'larından IP ve User-Agent al
 */
async function getRequestInfo(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  try {
    const headersList = await headers();
    const forwardedFor = headersList.get("x-forwarded-for");
    const realIp = headersList.get("x-real-ip");
    const userAgent = headersList.get("user-agent");

    return {
      ipAddress: forwardedFor?.split(",")[0]?.trim() || realIp || null,
      userAgent: userAgent || null,
    };
  } catch {
    // headers() server component dışında çağrılırsa hata verir
    return { ipAddress: null, userAgent: null };
  }
}

// ============================================
// AUDIT LOG CLASS
// ============================================

class AuditLogger {
  /**
   * Genel audit log kaydı
   */
  async log(
    user: AuditUser | null,
    resource: AuditResource,
    action: AuditAction,
    resourceId?: string | null,
    details?: AuditDetails
  ): Promise<void> {
    try {
      const { ipAddress, userAgent } = await getRequestInfo();

      await prisma.audit_logs.create({
        data: {
          userId: user?.id || null,
          userEmail: user?.email || null,
          tenantId: user?.tenantId || "00000000-0000-0000-0000-000000000000", // System logs için
          action,
          resource,
          resourceId: resourceId || null,
          details: details ? JSON.parse(JSON.stringify(details)) : null,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      // Audit log hatası ana işlemi engellememeli
      console.error("[AuditLog] Error:", error);
    }
  }

  /**
   * Kayıt oluşturma
   */
  async create(
    user: AuditUser,
    resource: AuditResource,
    resourceId: string,
    details?: AuditDetails
  ): Promise<void> {
    await this.log(user, resource, "CREATE", resourceId, details);
  }

  /**
   * Kayıt güncelleme
   */
  async update(
    user: AuditUser,
    resource: AuditResource,
    resourceId: string,
    details?: AuditDetails
  ): Promise<void> {
    await this.log(user, resource, "UPDATE", resourceId, details);
  }

  /**
   * Kayıt silme
   */
  async delete(
    user: AuditUser,
    resource: AuditResource,
    resourceId: string,
    details?: AuditDetails
  ): Promise<void> {
    await this.log(user, resource, "DELETE", resourceId, details);
  }

  /**
   * Hassas veri görüntüleme (credentials, vb.)
   */
  async viewSensitive(
    user: AuditUser,
    resource: AuditResource,
    resourceId: string,
    field: string
  ): Promise<void> {
    await this.log(user, resource, "VIEW_SENSITIVE", resourceId, { field });
  }

  /**
   * Başarılı login
   */
  async login(
    user: AuditUser,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log(user, "users", "LOGIN", user.id, { ipAddress, userAgent });
  }

  /**
   * Logout
   */
  async logout(user: AuditUser): Promise<void> {
    await this.log(user, "users", "LOGOUT", user.id);
  }

  /**
   * Başarısız login denemesi
   */
  async loginFailed(
    email: string,
    tenantId: string,
    reason: string
  ): Promise<void> {
    await this.log(
      { id: "", email, tenantId },
      "users",
      "LOGIN_FAILED",
      null,
      { email, reason }
    );
  }

  /**
   * Toplu işlem (bulk)
   */
  async bulk(
    user: AuditUser,
    resource: AuditResource,
    action: "BULK_DELETE" | "BULK_UPDATE" | "IMPORT" | "EXPORT",
    count: number,
    details?: AuditDetails
  ): Promise<void> {
    await this.log(user, resource, action, null, { count, ...details });
  }

  /**
   * Bot işlemi başlatma
   */
  async botStart(
    user: AuditUser,
    botType: "gib_bot" | "turmob_bot",
    details?: AuditDetails
  ): Promise<void> {
    await this.log(user, botType, "BOT_START", null, details);
  }

  /**
   * Bot işlemi tamamlama
   */
  async botComplete(
    user: AuditUser,
    botType: "gib_bot" | "turmob_bot",
    details?: AuditDetails
  ): Promise<void> {
    await this.log(user, botType, "BOT_COMPLETE", null, details);
  }

  /**
   * Bot hatası
   */
  async botError(
    user: AuditUser,
    botType: "gib_bot" | "turmob_bot",
    error: string,
    details?: AuditDetails
  ): Promise<void> {
    await this.log(user, botType, "BOT_ERROR", null, { error, ...details });
  }

  /**
   * Ayarlar güncelleme
   */
  async settingsUpdate(
    user: AuditUser,
    settingType: string,
    details?: AuditDetails
  ): Promise<void> {
    await this.log(user, "settings", "SETTINGS_UPDATE", null, {
      settingType,
      ...details,
    });
  }

  // ============================================
  // QUERY METHODS
  // ============================================

  /**
   * Tenant'ın audit loglarını getir
   */
  async getByTenant(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      action?: AuditAction;
      resource?: AuditResource;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const {
      limit = 100,
      offset = 0,
      action,
      resource,
      userId,
      startDate,
      endDate,
    } = options || {};

    return prisma.audit_logs.findMany({
      where: {
        tenantId,
        ...(action && { action }),
        ...(resource && { resource }),
        ...(userId && { userId }),
        ...(startDate || endDate
          ? {
              timestamp: {
                ...(startDate && { gte: startDate }),
                ...(endDate && { lte: endDate }),
              },
            }
          : {}),
      },
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Belirli bir kaynağın geçmişini getir
   */
  async getResourceHistory(
    tenantId: string,
    resource: AuditResource,
    resourceId: string
  ) {
    return prisma.audit_logs.findMany({
      where: {
        tenantId,
        resource,
        resourceId,
      },
      orderBy: { timestamp: "desc" },
    });
  }
}

// Singleton instance
export const auditLog = new AuditLogger();
