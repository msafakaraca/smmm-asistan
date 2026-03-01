import { prisma } from "@/lib/db";

// Varsayılan gelir kategorileri
const DEFAULT_INCOME_CATEGORIES = [
  { name: "Muhasebe Ücreti", color: "#3B82F6", icon: "calculator" },
  { name: "Beyanname Hizmeti", color: "#10B981", icon: "file-text" },
  { name: "SGK Hizmeti", color: "#F59E0B", icon: "shield" },
  { name: "Şirket Kuruluşu", color: "#8B5CF6", icon: "building" },
  { name: "Sermaye Artırımı", color: "#92400E", icon: "trending-up" },
  { name: "Adres Değişikliği", color: "#F97316", icon: "map-pin" },
  { name: "Defter Saklama", color: "#6B7280", icon: "archive" },
  { name: "Danışmanlık", color: "#EF4444", icon: "message-circle" },
  { name: "Diğer Hizmetler", color: "#1F2937", icon: "more-horizontal" },
];

// Varsayılan gider kategorileri
const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Personel Gideri", color: "#3B82F6", icon: "users" },
  { name: "Kira", color: "#10B981", icon: "home" },
  { name: "Elektrik", color: "#F59E0B", icon: "zap" },
  { name: "Su", color: "#06B6D4", icon: "droplet" },
  { name: "İnternet/Telefon", color: "#8B5CF6", icon: "wifi" },
  { name: "Kırtasiye", color: "#F97316", icon: "paperclip" },
  { name: "Demirbaş", color: "#6B7280", icon: "monitor" },
  { name: "Yazılım Lisansı", color: "#EC4899", icon: "code" },
  { name: "Ulaşım", color: "#92400E", icon: "car" },
  { name: "Diğer Giderler", color: "#1F2937", icon: "more-horizontal" },
];

/**
 * Belirli bir tenant için varsayılan finansal kategorileri oluşturur.
 * Idempotent: Zaten varsa tekrar oluşturmaz (unique constraint koruması).
 */
export async function seedDefaultCategories(tenantId: string): Promise<{
  created: number;
  skipped: number;
}> {
  let created = 0;
  let skipped = 0;

  // Gelir kategorileri
  for (const cat of DEFAULT_INCOME_CATEGORIES) {
    try {
      await prisma.finance_categories.upsert({
        where: {
          tenantId_name_type: {
            tenantId,
            name: cat.name,
            type: "INCOME",
          },
        },
        update: {},
        create: {
          name: cat.name,
          type: "INCOME",
          isDefault: true,
          color: cat.color,
          icon: cat.icon,
          tenantId,
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  // Gider kategorileri
  for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
    try {
      await prisma.finance_categories.upsert({
        where: {
          tenantId_name_type: {
            tenantId,
            name: cat.name,
            type: "EXPENSE",
          },
        },
        update: {},
        create: {
          name: cat.name,
          type: "EXPENSE",
          isDefault: true,
          color: cat.color,
          icon: cat.icon,
          tenantId,
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  return { created, skipped };
}

/**
 * Tüm mevcut tenant'lar için varsayılan kategorileri seed eder.
 * Idempotent: Zaten olan kategorileri atlar.
 */
export async function seedAllTenants(): Promise<{
  tenantCount: number;
  totalCreated: number;
  totalSkipped: number;
}> {
  const tenants = await prisma.tenants.findMany({
    select: { id: true },
  });

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const tenant of tenants) {
    const result = await seedDefaultCategories(tenant.id);
    totalCreated += result.created;
    totalSkipped += result.skipped;
  }

  return {
    tenantCount: tenants.length,
    totalCreated,
    totalSkipped,
  };
}
