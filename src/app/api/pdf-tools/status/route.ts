import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { STIRLING_CONFIG, getStirlingHeaders } from "@/lib/stirling/config";

/**
 * GET /api/pdf-tools/status
 *
 * Stirling-PDF servis durumunu kontrol et.
 *
 * Response:
 * {
 *   available: boolean,
 *   baseUrl: string,
 *   version?: string,
 *   message?: string
 * }
 */
export async function GET(req: NextRequest) {
  // 1. Auth kontrolu
  const user = await getUserWithProfile();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 });
  }

  try {
    console.log(`[PDF-Tools] Status check: ${STIRLING_CONFIG.BASE_URL}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 saniye timeout

    // Stirling-PDF ana sayfasina veya API'ye ping at
    const response = await fetch(
      `${STIRLING_CONFIG.BASE_URL}/api/v1/info/status`,
      {
        method: 'GET',
        headers: getStirlingHeaders(),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Status endpoint yoksa root'a dene
      const rootResponse = await fetch(STIRLING_CONFIG.BASE_URL, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      });

      if (rootResponse.ok) {
        return NextResponse.json({
          available: true,
          baseUrl: STIRLING_CONFIG.BASE_URL,
          message: "Stirling-PDF servisi aktif (status endpoint bulunamadi)",
        });
      }

      return NextResponse.json({
        available: false,
        baseUrl: STIRLING_CONFIG.BASE_URL,
        message: "Stirling-PDF servisi yanit vermiyor",
      });
    }

    // Status bilgisini parse et
    const statusData = await response.json().catch(() => ({}));

    return NextResponse.json({
      available: true,
      baseUrl: STIRLING_CONFIG.BASE_URL,
      version: statusData.version || 'unknown',
      message: "Stirling-PDF servisi aktif",
    });

  } catch (error: any) {
    console.error('[PDF-Tools] Status check error:', error.message || error);

    if (error.name === 'AbortError') {
      return NextResponse.json({
        available: false,
        baseUrl: STIRLING_CONFIG.BASE_URL,
        message: "Stirling-PDF servisi zaman asimina ugradi",
      });
    }

    // Connection refused veya network error
    return NextResponse.json({
      available: false,
      baseUrl: STIRLING_CONFIG.BASE_URL,
      message: `Stirling-PDF servisine baglanilamiyor: ${error.message || 'Bilinmeyen hata'}`,
    });
  }
}
