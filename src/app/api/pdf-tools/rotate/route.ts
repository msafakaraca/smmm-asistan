import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { STIRLING_CONFIG, getStirlingHeaders, validateFileSize } from "@/lib/stirling/config";

/**
 * POST /api/pdf-tools/rotate
 *
 * PDF sayfalarini dondur.
 *
 * FormData:
 * - fileInput: File - PDF dosyasi
 * - angle: string - Dondurme acisi (90, 180, 270) - default: 90
 *
 * Response: application/pdf - Dondurulmus PDF
 */
export async function POST(req: NextRequest) {
  // 1. Auth kontrolu
  const user = await getUserWithProfile();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 });
  }

  try {
    // 2. FormData'yi al
    const formData = await req.formData();
    const file = formData.get('fileInput') as File | null;
    const angle = (formData.get('angle') as string) || '90';

    // 3. Dosya kontrolu
    if (!file) {
      return NextResponse.json({ error: "PDF dosyasi gerekli" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: "Gecersiz dosya turu. Sadece PDF dosyalari kabul edilir." },
        { status: 400 }
      );
    }

    // 4. Boyut kontrolu
    const sizeCheck = validateFileSize(file.size);
    if (!sizeCheck.valid) {
      return NextResponse.json({ error: sizeCheck.error }, { status: 400 });
    }

    // 5. Aci kontrolu
    const validAngles = ['90', '180', '270'];
    if (!validAngles.includes(angle)) {
      return NextResponse.json(
        { error: "Gecersiz aci. 90, 180 veya 270 olmali." },
        { status: 400 }
      );
    }

    // 6. Stirling-PDF'e forward et
    const stirlingFormData = new FormData();
    stirlingFormData.append('fileInput', file);
    stirlingFormData.append('angle', angle);

    console.log(`[PDF-Tools] Rotate: ${file.name}, aci: ${angle}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STIRLING_CONFIG.TIMEOUTS.DEFAULT);

    const response = await fetch(
      `${STIRLING_CONFIG.BASE_URL}${STIRLING_CONFIG.ENDPOINTS.ROTATE}`,
      {
        method: 'POST',
        body: stirlingFormData,
        headers: getStirlingHeaders(),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    // 7. Hata kontrolu
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Bilinmeyen hata');
      console.error(`[PDF-Tools] Rotate hatasi: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `PDF dondurme basarisiz: ${errorText}` },
        { status: response.status }
      );
    }

    // 8. PDF'i dondur
    const pdfBuffer = await response.arrayBuffer();
    const baseName = file.name.replace('.pdf', '');
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    console.log(`[PDF-Tools] Rotate basarili: ${baseName}, ${(pdfBuffer.byteLength / 1024).toFixed(2)}KB`);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.byteLength.toString(),
        'Content-Disposition': `attachment; filename="${baseName}_rotated_${timestamp}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[PDF-Tools] Rotate timeout');
      return NextResponse.json(
        { error: "Islem zaman asimina ugradi" },
        { status: 504 }
      );
    }

    console.error('[PDF-Tools] Rotate error:', error);
    return NextResponse.json(
      { error: "PDF dondurme sirasinda bir hata olustu" },
      { status: 500 }
    );
  }
}
