import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { STIRLING_CONFIG, getStirlingHeaders, validateFileSize } from "@/lib/stirling/config";

/**
 * POST /api/pdf-tools/split
 *
 * PDF dosyasini sayfalara bol.
 *
 * FormData:
 * - fileInput: File - Bolunecek PDF dosyasi
 * - pageNumbers: string - Sayfa numaralari (ornek: "1,3,5-7" veya "1-3")
 *
 * Response: application/zip - Bolunmus sayfalar (ZIP)
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
    const pageNumbers = formData.get('pageNumbers') as string | null;

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

    // 5. Sayfa numaralari kontrolu
    if (!pageNumbers || pageNumbers.trim() === '') {
      return NextResponse.json(
        { error: "Sayfa numaralari gerekli (ornek: '1,3,5-7' veya '1-3')" },
        { status: 400 }
      );
    }

    // 6. Stirling-PDF'e forward et
    const stirlingFormData = new FormData();
    stirlingFormData.append('fileInput', file);

    // "all" secilmisse her sayfayi ayri PDF yap (1,2,3,4,... gibi)
    // Stirling-PDF bunu otomatik yapar, biz sadece splitType parametresi gonderiyoruz
    if (pageNumbers.toLowerCase() === 'all') {
      // Her sayfayi ayri dosya olarak bol
      stirlingFormData.append('splitType', '0'); // 0 = her sayfa ayri
      stirlingFormData.append('splitValue', '1'); // 1 sayfa per dosya
    } else {
      stirlingFormData.append('pageNumbers', pageNumbers);
    }

    console.log(`[PDF-Tools] Split: ${file.name}, sayfalar: ${pageNumbers}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STIRLING_CONFIG.TIMEOUTS.DEFAULT);

    const response = await fetch(
      `${STIRLING_CONFIG.BASE_URL}${STIRLING_CONFIG.ENDPOINTS.SPLIT}`,
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
      console.error(`[PDF-Tools] Split hatasi: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `PDF bolme basarisiz: ${errorText}` },
        { status: response.status }
      );
    }

    // 8. Content-Type kontrol et - ZIP mi PDF mi?
    const contentType = response.headers.get('content-type') || 'application/pdf';
    const buffer = await response.arrayBuffer();
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const baseName = file.name.replace('.pdf', '');

    console.log(`[PDF-Tools] Split basarili: ${(buffer.byteLength / 1024).toFixed(2)}KB, type: ${contentType}`);

    // Tek sayfa secilmisse PDF, birden fazlaysa ZIP doner
    const isZip = contentType.includes('zip') || contentType.includes('octet-stream');
    const extension = isZip ? 'zip' : 'pdf';
    const mimeType = isZip ? 'application/zip' : 'application/pdf';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': buffer.byteLength.toString(),
        'Content-Disposition': `attachment; filename="${baseName}_split_${timestamp}.${extension}"`,
        'Cache-Control': 'no-store',
      },
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[PDF-Tools] Split timeout');
      return NextResponse.json(
        { error: "Islem zaman asimina ugradi" },
        { status: 504 }
      );
    }

    console.error('[PDF-Tools] Split error:', error);
    return NextResponse.json(
      { error: "PDF bolme sirasinda bir hata olustu" },
      { status: 500 }
    );
  }
}
