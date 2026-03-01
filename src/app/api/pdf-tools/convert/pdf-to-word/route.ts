import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { STIRLING_CONFIG, getStirlingHeaders, validateFileSize } from "@/lib/stirling/config";

/**
 * POST /api/pdf-tools/convert/pdf-to-word
 *
 * PDF dosyasini Word'e donustur.
 *
 * FormData:
 * - fileInput: File - PDF dosyasi
 * - outputFormat: string - Cikti formati ("docx" veya "odt") - default: "docx"
 *
 * Response: application/vnd.openxmlformats-officedocument.wordprocessingml.document - Word dosyasi
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
    const outputFormat = (formData.get('outputFormat') as string) || 'docx';

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

    // 5. Output format kontrolu
    const validFormats = ['docx', 'odt'];
    if (!validFormats.includes(outputFormat.toLowerCase())) {
      return NextResponse.json(
        { error: "Gecersiz cikti formati. 'docx' veya 'odt' olmali." },
        { status: 400 }
      );
    }

    // 6. Stirling-PDF'e forward et
    const stirlingFormData = new FormData();
    stirlingFormData.append('fileInput', file);
    stirlingFormData.append('outputFormat', outputFormat);

    console.log(`[PDF-Tools] PDF to Word: ${file.name}, format: ${outputFormat}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STIRLING_CONFIG.TIMEOUTS.LARGE_FILE);

    const response = await fetch(
      `${STIRLING_CONFIG.BASE_URL}${STIRLING_CONFIG.ENDPOINTS.PDF_TO_WORD}`,
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
      console.error(`[PDF-Tools] PDF to Word hatasi: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `PDF -> Word donusturme basarisiz: ${errorText}` },
        { status: response.status }
      );
    }

    // 8. Word dosyasini dondur
    const wordBuffer = await response.arrayBuffer();
    const baseName = file.name.replace('.pdf', '');
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // MIME type belirleme
    const mimeType = outputFormat === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/vnd.oasis.opendocument.text';

    console.log(`[PDF-Tools] PDF to Word basarili: ${baseName}, ${(wordBuffer.byteLength / 1024).toFixed(2)}KB`);

    return new NextResponse(wordBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': wordBuffer.byteLength.toString(),
        'Content-Disposition': `attachment; filename="${baseName}_${timestamp}.${outputFormat}"`,
        'Cache-Control': 'no-store',
      },
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[PDF-Tools] PDF to Word timeout');
      return NextResponse.json(
        { error: "Islem zaman asimina ugradi" },
        { status: 504 }
      );
    }

    console.error('[PDF-Tools] PDF to Word error:', error);
    return NextResponse.json(
      { error: "PDF -> Word donusturme sirasinda bir hata olustu" },
      { status: 500 }
    );
  }
}
