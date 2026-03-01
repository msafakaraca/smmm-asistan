import { getUserWithProfile } from "@/lib/supabase/auth";
import { seedDefaultCategories, seedAllTenants } from "@/lib/finance/seed-categories";
import { NextRequest, NextResponse } from "next/server";

// Mevcut tenant için varsayılan kategorileri oluştur
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const allTenants = body.allTenants === true;

    // Admin kontrolü - tüm tenant'lar için sadece admin yapabilir
    if (allTenants && user.role !== "admin") {
      return NextResponse.json(
        { error: "Bu işlem için admin yetkisi gereklidir" },
        { status: 403 }
      );
    }

    if (allTenants) {
      const result = await seedAllTenants();
      return NextResponse.json({
        message: `${result.tenantCount} tenant için seed tamamlandı`,
        ...result,
      });
    }

    const result = await seedDefaultCategories(user.tenantId);
    return NextResponse.json({
      message: "Varsayılan kategoriler oluşturuldu",
      ...result,
    });
  } catch (error) {
    console.error("Kategori seed hatası:", error);
    return NextResponse.json(
      { error: "Kategori seed işlemi başarısız" },
      { status: 500 }
    );
  }
}
