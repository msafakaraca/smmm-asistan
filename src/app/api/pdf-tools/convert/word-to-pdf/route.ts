import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { STIRLING_CONFIG, getStirlingHeaders, validateFileSize, isFileTypeSupported } from "@/lib/stirling/config";

/**
 * POST /api/pdf-tools/convert/word-to-pdf
 *
 * Word dosyasini PDF'e donustur.
 *
 * FormData:
 * - fileInput: File - Word dosyasi (.doc, .docx, .odt, .rtf)
 *
 * Response: application/pdf - Donusturulmus PDF
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

    // 3. Dosya kontrolu
    if (!file) {
      return NextResponse.json({ error: "Word dosyasi gerekli" }, { status: 400 });
    }

    // 4. Dosya turu kontrolu
    if (!isFileTypeSupported(file.name, 'WORD')) {
      const supportedTypes = STIRLING_CONFIG.SUPPORTED_TYPES.WORD.join(', ');
      return NextResponse.json(
        { error: `Gecersiz dosya turu. Desteklenen turler: ${supportedTypes}` },
        { status: 400 }
      );
    }

    // 5. Boyut kontrolu
    const sizeCheck = validateFileSize(file.size);
    if (!sizeCheck.valid) {
      return NextResponse.json({ error: sizeCheck.error }, { status: 400 });
    }

    // 6. Stirling-PDF'e forward et
    const stirlingFormData = new FormData();
    stirlingFormData.append('fileInput', file);

    console.log(`[PDF-Tools] Word to PDF: ${file.name}, boyut: ${(file.size / 1024).toFixed(2)}KB`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STIRLING_CONFIG.TIMEOUTS.DEFAULT);

    const response = await fetch(
      `${STIRLING_CONFIG.BASE_URL}${STIRLING_CONFIG.ENDPOINTS.FILE_TO_PDF}`,
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
      console.error(`[PDF-Tools] Word to PDF hatasi: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Word -> PDF donusturme basarisiz: ${errorText}` },
        { status: response.status }
      );
    }

    // 8. PDF'i dondur
    const pdfBuffer = await response.arrayBuffer();
    const baseName = file.name.replace(/\.(doc|docx|odt|rtf)$/i, '');
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    console.log(`[PDF-Tools] Word to PDF basarili: ${baseName}, ${(pdfBuffer.byteLength / 1024).toFixed(2)}KB`);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.byteLength.toString(),
        'Content-Disposition': `attachment; filename="${baseName}_${timestamp}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[PDF-Tools] Word to PDF timeout');
      return NextResponse.json(
        { error: "Islem zaman asimina ugradi" },
        { status: 504 }
      );
    }

    console.error('[PDF-Tools] Word to PDF error:', error);
    return NextResponse.json(
      { error: "Word -> PDF donusturme sirasinda bir hata olustu" },
      { status: 500 }
    );
  }
}
