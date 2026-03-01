import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { STIRLING_CONFIG, getStirlingHeaders, validateFileSize } from "@/lib/stirling/config";

/**
 * POST /api/pdf-tools/ocr
 *
 * Taranmis PDF'e OCR uygula (metin taninir hale getir).
 *
 * FormData:
 * - fileInput: File - PDF dosyasi (taranmis/goruntu bazli)
 * - languages: string - Dil kodlari, virgul ile ayrilmis (ornek: "tur,eng") - default: "tur"
 * - sidecar: string - Ayrica metin dosyasi olustur ("true" veya "false") - default: "false"
 * - deskew: string - Egri sayfalari duzelt ("true" veya "false") - default: "true"
 * - clean: string - Goruntu temizleme ("true" veya "false") - default: "true"
 *
 * Response: application/pdf - OCR uygulanmis PDF
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
    const languages = (formData.get('languages') as string) || 'tur';
    const sidecar = (formData.get('sidecar') as string) || 'false';
    const deskew = (formData.get('deskew') as string) || 'true';
    const clean = (formData.get('clean') as string) || 'true';

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

    // 5. Stirling-PDF'e forward et
    const stirlingFormData = new FormData();
    stirlingFormData.append('fileInput', file);
    stirlingFormData.append('languages', languages);
    stirlingFormData.append('sidecar', sidecar);
    stirlingFormData.append('deskew', deskew);
    stirlingFormData.append('clean', clean);
    stirlingFormData.append('ocrType', 'Normal');

    console.log(`[PDF-Tools] OCR: ${file.name}, diller: ${languages}, boyut: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STIRLING_CONFIG.TIMEOUTS.OCR);

    const response = await fetch(
      `${STIRLING_CONFIG.BASE_URL}${STIRLING_CONFIG.ENDPOINTS.OCR}`,
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
      console.error(`[PDF-Tools] OCR hatasi: ${response.status} - ${errorText}`);

      // OCR destegi yoksa ozel mesaj
      if (response.status === 404 || errorText.includes('not found')) {
        return NextResponse.json(
          { error: "OCR destegi bulunamadi. Stirling-PDF'in OCR modulu kurulu olmali." },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: `OCR islemi basarisiz: ${errorText}` },
        { status: response.status }
      );
    }

    // 7. PDF'i dondur
    const pdfBuffer = await response.arrayBuffer();
    const baseName = file.name.replace('.pdf', '');
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    console.log(`[PDF-Tools] OCR basarili: ${baseName}, ${(pdfBuffer.byteLength / 1024).toFixed(2)}KB`);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.byteLength.toString(),
        'Content-Disposition': `attachment; filename="${baseName}_ocr_${timestamp}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[PDF-Tools] OCR timeout');
      return NextResponse.json(
        { error: "OCR islemi zaman asimina ugradi. Bu islem buyuk dosyalarda uzun surebilir." },
        { status: 504 }
      );
    }

    console.error('[PDF-Tools] OCR error:', error);
    return NextResponse.json(
      { error: "OCR islemi sirasinda bir hata olustu" },
      { status: 500 }
    );
  }
}
