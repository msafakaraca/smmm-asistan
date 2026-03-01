import { NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/settings/subscription
 * Abonelik, lisans ve kullanım istatistiklerini getir
 */
export async function GET() {
  try {
    const user = await getUserWithProfile();

    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    // Paralel sorgular ile verileri getir
    const [tenant, license, userCount, customerCount] = await Promise.all([
      prisma.tenants.findUnique({
        where: { id: user.tenantId },
        select: {
          id: true,
          name: true,
          plan: true,
          status: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
      prisma.licenses.findUnique({
        where: { tenantId: user.tenantId },
        select: {
          id: true,
          key: true,
          type: true,
          status: true,
          isActive: true,
          maxUsers: true,
          maxCustomers: true,
          features: true,
          expiresAt: true,
          activatedAt: true,
        },
      }),
      prisma.user_profiles.count({
        where: { tenantId: user.tenantId },
      }),
      prisma.customers.count({
        where: { tenantId: user.tenantId },
      }),
    ]);

    if (!tenant) {
      return NextResponse.json({ error: "Ofis bulunamadı" }, { status: 404 });
    }

    // Plan bilgileri
    const planDetails = getPlanDetails(tenant.plan);

    // Kalan günler hesapla
    let daysRemaining: number | null = null;
    const expiryDate = license?.expiresAt || tenant.expiresAt;
    if (expiryDate) {
      const now = new Date();
      const expiry = new Date(expiryDate);
      daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    return NextResponse.json({
      plan: {
        name: planDetails.name,
        code: tenant.plan,
        status: tenant.status,
        expiresAt: expiryDate,
        daysRemaining,
        features: planDetails.features,
      },
      license: license
        ? {
            key: maskLicenseKey(license.key),
            type: license.type,
            status: license.status,
            isActive: license.isActive,
            activatedAt: license.activatedAt,
            features: license.features,
          }
        : null,
      usage: {
        users: {
          current: userCount,
          max: license?.maxUsers || planDetails.maxUsers,
          percentage: Math.round(
            (userCount / (license?.maxUsers || planDetails.maxUsers)) * 100
          ),
        },
        customers: {
          current: customerCount,
          max: license?.maxCustomers || planDetails.maxCustomers,
          percentage: Math.round(
            (customerCount / (license?.maxCustomers || planDetails.maxCustomers)) * 100
          ),
        },
      },
      createdAt: tenant.createdAt,
    });
  } catch (error) {
    console.error("Abonelik bilgileri hatası:", error);
    return NextResponse.json(
      { error: "Abonelik bilgileri alınamadı" },
      { status: 500 }
    );
  }
}

// Plan detayları
function getPlanDetails(plan: string) {
  const plans: Record<string, {
    name: string;
    maxUsers: number;
    maxCustomers: number;
    features: string[];
  }> = {
    trial: {
      name: "Deneme",
      maxUsers: 2,
      maxCustomers: 20,
      features: ["Temel özellikler", "14 gün ücretsiz"],
    },
    starter: {
      name: "Başlangıç",
      maxUsers: 3,
      maxCustomers: 50,
      features: ["Temel özellikler", "Email desteği"],
    },
    professional: {
      name: "Profesyonel",
      maxUsers: 10,
      maxCustomers: 200,
      features: ["Tüm özellikler", "Öncelikli destek", "API erişimi"],
    },
    enterprise: {
      name: "Kurumsal",
      maxUsers: 999,
      maxCustomers: 9999,
      features: ["Sınırsız kullanım", "7/24 destek", "Özel entegrasyonlar"],
    },
  };

  return plans[plan] || plans.trial;
}

// Lisans anahtarını maskele
function maskLicenseKey(key: string): string {
  if (key.length <= 8) return key;
  return `${key.slice(0, 4)}${"*".repeat(key.length - 8)}${key.slice(-4)}`;
}
