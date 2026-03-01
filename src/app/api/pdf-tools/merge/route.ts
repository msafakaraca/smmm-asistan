import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { STIRLING_CONFIG, getStirlingHeaders, validateFileSize } from "@/lib/stirling/config";

/**
 * POST /api/pdf-tools/merge
 *
 * Birden fazla PDF dosyasini birlestir.
 *
 * FormData:
 * - fileInput: File[] - Birlestirilecek PDF dosyalari
 *
 * Response: application/pdf - Birlestirilmis PDF
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
    const files = formData.getAll('fileInput') as File[];

    // 3. Dosya sayisi kontrolu
    if (!files || files.length < 2) {
      return NextResponse.json(
        { error: "En az 2 PDF dosyasi gerekli" },
        { status: 400 }
      );
    }

    if (files.length > STIRLING_CONFIG.FILE_LIMITS.MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${STIRLING_CONFIG.FILE_LIMITS.MAX_FILES} dosya birlestirilebilir` },
        { status: 400 }
      );
    }

    // 4. Dosya turleri ve boyut kontrolu
    let totalSize = 0;
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        return NextResponse.json(
          { error: `Gecersiz dosya turu: ${file.name}. Sadece PDF dosyalari kabul edilir.` },
          { status: 400 }
        );
      }
      totalSize += file.size;
    }

    const sizeCheck = validateFileSize(totalSize, true);
    if (!sizeCheck.valid) {
      return NextResponse.json({ error: sizeCheck.error }, { status: 400 });
    }

    // 5. Stirling-PDF'e forward et
    const stirlingFormData = new FormData();
    files.forEach((file) => {
      stirlingFormData.append('fileInput', file);
    });

    console.log(`[PDF-Tools] Merge: ${files.length} dosya, toplam ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STIRLING_CONFIG.TIMEOUTS.LARGE_FILE);

    const response = await fetch(
      `${STIRLING_CONFIG.BASE_URL}${STIRLING_CONFIG.ENDPOINTS.MERGE}`,
      {
        method: 'POST',
        body: stirlingFormData,
        headers: getStirlingHeaders(),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    // 6. Hata kontrolu
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Bilinmeyen hata');
      console.error(`[PDF-Tools] Merge hatasi: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `PDF birlestirme basarisiz: ${errorText}` },
        { status: response.status }
      );
    }

    // 7. PDF'i dondur
    const pdfBuffer = await response.arrayBuffer();
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    console.log(`[PDF-Tools] Merge basarili: ${(pdfBuffer.byteLength / 1024).toFixed(2)}KB`);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.byteLength.toString(),
        'Content-Disposition': `attachment; filename="merged_${timestamp}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[PDF-Tools] Merge timeout');
      return NextResponse.json(
        { error: "Islem zaman asimina ugradi. Daha kucuk dosyalar deneyin." },
        { status: 504 }
      );
    }

    console.error('[PDF-Tools] Merge error:', error);
    return NextResponse.json(
      { error: "PDF birlestirme sirasinda bir hata olustu" },
      { status: 500 }
    );
  }
}
