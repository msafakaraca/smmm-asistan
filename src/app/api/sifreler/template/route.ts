import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import ExcelJS from "exceljs";

// GET /api/sifreler/template?type=gib|sgk
// Excel sablonu olustur ve indir
export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    // Tip kontrolu
    if (!type || !["gib", "sgk"].includes(type)) {
      return NextResponse.json(
        { error: 'Gecersiz tip. "gib" veya "sgk" olmali.' },
        { status: 400 }
      );
    }

    // Tum mukellefleri cek
    const customers = await prisma.customers.findMany({
      where: {
        tenantId: user.tenantId,
        status: "active",
      },
      select: {
        unvan: true,
        vknTckn: true,
      },
      orderBy: [{ sortOrder: "asc" }, { unvan: "asc" }],
    });

    // Workbook olustur
    const workbook = new ExcelJS.Workbook();
    const sheetName = type === "gib" ? "GIB Sifreleri" : "SGK Sifreleri";
    const worksheet = workbook.addWorksheet(sheetName);

    // Kolonlari tanimla
    if (type === "gib") {
      worksheet.columns = [
        { header: "Mukellef", key: "mukellef", width: 40 },
        { header: "VKN/TCKN", key: "vkn", width: 15 },
        { header: "Kullanici Kodu", key: "kod", width: 20 },
        { header: "Sifre", key: "sifre", width: 20 },
      ];
    } else {
      worksheet.columns = [
        { header: "Mukellef", key: "mukellef", width: 40 },
        { header: "VKN/TCKN", key: "vkn", width: 15 },
        { header: "Kullanici Adi", key: "kullanici", width: 25 },
        { header: "Isyeri Kodu", key: "isyeri", width: 15 },
        { header: "Sistem Sifresi", key: "sistem", width: 20 },
        { header: "Isyeri Sifresi", key: "isyeriSifre", width: 20 },
      ];
    }

    // Baslik satirini bicimlendir
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Verileri ekle
    customers.forEach((c) => {
      if (type === "gib") {
        worksheet.addRow({ mukellef: c.unvan, vkn: c.vknTckn, kod: "", sifre: "" });
      } else {
        worksheet.addRow({
          mukellef: c.unvan,
          vkn: c.vknTckn,
          kullanici: "",
          isyeri: "",
          sistem: "",
          isyeriSifre: "",
        });
      }
    });

    // Buffer olarak export et
    const buffer = await workbook.xlsx.writeBuffer();

    // Dosya adini olustur
    const date = new Date().toISOString().split("T")[0];
    const filename = `${type.toUpperCase()}_Sifre_Sablonu_${date}.xlsx`;

    // Response dondur
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[Sifreler Template] Error:", error);
    return NextResponse.json(
      { error: "Sablon olusturulurken hata olustu" },
      { status: 500 }
    );
  }
});
