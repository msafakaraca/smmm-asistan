import { getUserWithProfile } from "@/lib/supabase/auth";
import { NextRequest, NextResponse } from "next/server";

import { resolveStats } from "./resolvers/stats";
import { resolveAlerts } from "./resolvers/alerts";
import { resolveActivity } from "./resolvers/activity";
import { resolveUpcoming } from "./resolvers/upcoming";

// Resolver tipi: user + opsiyonel params alır, data döner
type Resolver = (
  user: { id: string; tenantId: string },
  params?: Record<string, string>
) => Promise<unknown>;

const RESOLVERS: Record<string, Resolver> = {
  stats: resolveStats,
  alerts: resolveAlerts,
  activity: resolveActivity,
  upcoming: resolveUpcoming,
};

/**
 * POST /api/dashboard/batch
 *
 * Tek roundtrip'te birden fazla dashboard widget verisini döner.
 * Body: { widgets: string[], params?: Record<string, Record<string, string>> }
 *
 * Response: Record<string, { ok: boolean; data?: unknown; error?: string }>
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { widgets, params = {} } = await req.json();

    if (!Array.isArray(widgets) || widgets.length === 0) {
      return NextResponse.json(
        { error: "widgets array gerekli" },
        { status: 400 }
      );
    }

    // Maksimum 10 widget (abuse önleme)
    if (widgets.length > 10) {
      return NextResponse.json(
        { error: "Maksimum 10 widget desteklenir" },
        { status: 400 }
      );
    }

    const results = await Promise.allSettled(
      widgets.map((w: string) => {
        const resolver = RESOLVERS[w];
        if (!resolver) return Promise.reject(new Error(`Bilinmeyen widget: ${w}`));
        return resolver(user, params[w] || {});
      })
    );

    const response: Record<string, { ok: boolean; data?: unknown; error?: string }> = {};
    widgets.forEach((w: string, i: number) => {
      const r = results[i];
      response[w] =
        r.status === "fulfilled"
          ? { ok: true, data: r.value }
          : { ok: false, error: r.reason?.message || "Bilinmeyen hata" };
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Dashboard Batch API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
