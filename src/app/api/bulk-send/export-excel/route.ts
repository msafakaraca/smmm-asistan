import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import ExcelJS from "exceljs";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { documentIds } = body;

    if (!documentIds || documentIds.length === 0) {
      return NextResponse.json(
        { error: "No documents selected" },
        { status: 400 }
      );
    }

    // Dökümanları getir
    const documents = await prisma.documents.findMany({
      where: {
        id: { in: documentIds },
        tenantId: user.tenantId,
      },
      include: {
        customers: {
          select: {
            id: true,
            unvan: true,
            kisaltma: true,
            vknTckn: true,
            email: true,
            telefon1: true,
          },
        },
        bulk_send_logs: {
          where: { tenantId: user.tenantId },
          take: 1,
        },
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { name: 'asc' },
      ],
    });

    if (documents.length === 0) {
      return NextResponse.json(
        { error: "No valid documents found" },
        { status: 400 }
      );
    }

    // Excel workbook oluştur
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Beyannameler');

    // Kolonları tanımla
    worksheet.columns = [
      { header: 'Mükellef', key: 'mukellef', width: 25 },
      { header: 'VKN/TCKN', key: 'vkn', width: 15 },
      { header: 'E-posta', key: 'email', width: 25 },
      { header: 'Telefon', key: 'telefon', width: 15 },
      { header: 'Dosya Adı', key: 'dosya', width: 50 },
      { header: 'Beyanname Türü', key: 'tur', width: 15 },
      { header: 'Dönem', key: 'donem', width: 10 },
      { header: 'Dosya Tipi', key: 'tip', width: 15 },
      { header: 'Mail Gönderildi', key: 'mail', width: 12 },
      { header: 'Mail Tarihi', key: 'mailTarih', width: 12 },
      { header: 'WhatsApp Gönderildi', key: 'whatsapp', width: 15 },
      { header: 'WhatsApp Tarihi', key: 'whatsappTarih', width: 12 },
      { header: 'SMS Gönderildi', key: 'sms', width: 12 },
      { header: 'SMS Tarihi', key: 'smsTarih', width: 12 },
    ];

    // Başlık satırını biçimlendir
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Verileri ekle
    documents.forEach((doc) => {
      const sendLog = doc.bulk_send_logs[0];
      const regex = /_([A-Z0-9]+)_(\d{2})-(\d{4})(?:-\d{2}-\d{4})?_([A-Z_0-9]+)\.pdf$/i;
      const match = doc.name.match(regex);

      worksheet.addRow({
        mukellef: doc.customers?.kisaltma || doc.customers?.unvan || '-',
        vkn: doc.customers?.vknTckn || '-',
        email: doc.customers?.email || '-',
        telefon: doc.customers?.telefon1 || '-',
        dosya: doc.name,
        tur: match?.[1] || '-',
        donem: doc.year && doc.month ? `${doc.month}/${doc.year}` : '-',
        tip: match?.[4] || '-',
        mail: sendLog?.mailSent ? 'Evet' : 'Hayır',
        mailTarih: sendLog?.mailSentAt
          ? new Date(sendLog.mailSentAt).toLocaleDateString('tr-TR')
          : '-',
        whatsapp: sendLog?.whatsappSent ? 'Evet' : 'Hayır',
        whatsappTarih: sendLog?.whatsappSentAt
          ? new Date(sendLog.whatsappSentAt).toLocaleDateString('tr-TR')
          : '-',
        sms: sendLog?.smsSent ? 'Evet' : 'Hayır',
        smsTarih: sendLog?.smsSentAt
          ? new Date(sendLog.smsSentAt).toLocaleDateString('tr-TR')
          : '-',
      });
    });

    // Excel dosyasını buffer olarak al
    const buffer = await workbook.xlsx.writeBuffer();

    // Dosya adı oluştur
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const filename = `beyanname_raporu_${dateStr}.xlsx`;

    // Response döndür
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (error) {
    console.error("[Bulk Export Excel] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
