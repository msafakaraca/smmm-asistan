import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * PATCH /api/user/profile
 * Kullanıcı profili günceller (phoneNumber vb.)
 *
 * Body: { phoneNumber?: string, name?: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { phoneNumber, name } = body;

    // Admin client kullan (RLS bypass için)
    const supabase = createAdminClient();

    // Update data hazırla
    const updateData: any = {};
    if (phoneNumber !== undefined) {
      updateData.phoneNumber = phoneNumber?.trim() || null;
    }
    if (name !== undefined) {
      updateData.name = name?.trim() || user.name;
    }

    // Supabase'de user_profiles'ı güncelle
    const { data, error } = await supabase
      .from("user_profiles")
      .update(updateData)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("[PATCH /api/user/profile] Supabase error:", error);
      return NextResponse.json(
        { error: "Profil güncellenemedi" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profil güncellendi",
      user: data,
    });
  } catch (error) {
    console.error("[PATCH /api/user/profile] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/profile
 * Kullanıcı profili getirir
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      tenantName: user.tenant?.name || null,
    });
  } catch (error) {
    console.error("[GET /api/user/profile] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
