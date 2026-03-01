import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { STIRLING_CONFIG, getStirlingHeaders, validateFileSize } from "@/lib/stirling/config";

/**
 * POST /api/pdf-tools/compress
 *
 * PDF dosyasini sikistir.
 *
 * FormData:
 * - fileInput: File - Sikistirilacak PDF dosyasi
 * - optimizeLevel: string - Sikistirma seviyesi (0=dusuk, 1=orta, 2=yuksek) - default: 1
 * - expectedOutputSize: string - Hedef boyut (bytes) - opsiyonel
 *
 * Response: application/pdf - Sikistirilmis PDF
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
    const optimizeLevel = formData.get('optimizeLevel') as string || '1';
    const expectedOutputSize = formData.get('expectedOutputSize') as string | null;

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

    // 5. Optimize level kontrolu
    const level = parseInt(optimizeLevel, 10);
    if (isNaN(level) || level < 0 || level > 2) {
      return NextResponse.json(
        { error: "Gecersiz sikistirma seviyesi. 0, 1 veya 2 olmali." },
        { status: 400 }
      );
    }

    // 6. Stirling-PDF'e forward et
    const stirlingFormData = new FormData();
    stirlingFormData.append('fileInput', file);
    stirlingFormData.append('optimizeLevel', level.toString());

    if (expectedOutputSize) {
      stirlingFormData.append('expectedOutputSize', expectedOutputSize);
    }

    const originalSize = file.size;
    console.log(`[PDF-Tools] Compress: ${file.name}, boyut: ${(originalSize / 1024 / 1024).toFixed(2)}MB, seviye: ${level}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STIRLING_CONFIG.TIMEOUTS.LARGE_FILE);

    const response = await fetch(
      `${STIRLING_CONFIG.BASE_URL}${STIRLING_CONFIG.ENDPOINTS.COMPRESS}`,
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
      console.error(`[PDF-Tools] Compress hatasi: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `PDF sikistirma basarisiz: ${errorText}` },
        { status: response.status }
      );
    }

    // 8. Sonucu dondur
    const pdfBuffer = await response.arrayBuffer();
    const newSize = pdfBuffer.byteLength;
    const reduction = ((1 - newSize / originalSize) * 100).toFixed(1);

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const baseName = file.name.replace('.pdf', '');

    console.log(`[PDF-Tools] Compress basarili: ${(originalSize / 1024).toFixed(2)}KB -> ${(newSize / 1024).toFixed(2)}KB (${reduction}% azalma)`);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': newSize.toString(),
        'Content-Disposition': `attachment; filename="${baseName}_compressed_${timestamp}.pdf"`,
        'X-Original-Size': originalSize.toString(),
        'X-Compressed-Size': newSize.toString(),
        'X-Compression-Ratio': reduction,
        'Cache-Control': 'no-store',
      },
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[PDF-Tools] Compress timeout');
      return NextResponse.json(
        { error: "Islem zaman asimina ugradi. Daha kucuk dosya deneyin." },
        { status: 504 }
      );
    }

    console.error('[PDF-Tools] Compress error:', error);
    return NextResponse.json(
      { error: "PDF sikistirma sirasinda bir hata olustu" },
      { status: 500 }
    );
  }
}
