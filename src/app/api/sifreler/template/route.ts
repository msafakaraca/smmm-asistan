import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import ExcelJS from "exceljs";

// Guvenli decrypt helper
function safeDecrypt(value: string | null): string {
  if (!value) return "";
  try {
    return decrypt(value) || "";
  } catch {
    return "";
  }
}

// GET /api/sifreler/template?type=gib|sgk&filled=true
// Excel sablonu olustur ve indir
// filled=true: Mevcut sifreleri dolu olarak export eder
export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const filled = searchParams.get("filled") === "true";

    // Tip kontrolu
    if (!type || !["gib", "sgk"].includes(type)) {
      return NextResponse.json(
        { error: 'Gecersiz tip. "gib" veya "sgk" olmali.' },
        { status: 400 }
      );
    }

    // Select alanlarini belirle
    const select: Record<string, boolean> = {
      unvan: true,
      vknTckn: true,
    };

    // Dolu export icin sifre alanlarini da cek
    if (filled && type === "gib") {
      select.gibKodu = true;
      select.gibSifre = true;
    } else if (filled && type === "sgk") {
      select.sgkKullaniciAdi = true;
      select.sgkIsyeriKodu = true;
      select.sgkSistemSifresi = true;
      select.sgkIsyeriSifresi = true;
    }

    // Tum mukellefleri cek
    const customers = await prisma.customers.findMany({
      where: {
        tenantId: user.tenantId,
        status: "active",
      },
      select,
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
    customers.forEach((c: Record<string, unknown>) => {
      if (type === "gib") {
        worksheet.addRow({
          mukellef: c.unvan,
          vkn: c.vknTckn,
          kod: filled ? safeDecrypt(c.gibKodu as string | null) : "",
          sifre: filled ? safeDecrypt(c.gibSifre as string | null) : "",
        });
      } else {
        worksheet.addRow({
          mukellef: c.unvan,
          vkn: c.vknTckn,
          kullanici: filled ? safeDecrypt(c.sgkKullaniciAdi as string | null) : "",
          isyeri: filled ? safeDecrypt(c.sgkIsyeriKodu as string | null) : "",
          sistem: filled ? safeDecrypt(c.sgkSistemSifresi as string | null) : "",
          isyeriSifre: filled ? safeDecrypt(c.sgkIsyeriSifresi as string | null) : "",
        });
      }
    });

    // Buffer olarak export et
    const buffer = await workbook.xlsx.writeBuffer();

    // Dosya adini olustur
    const date = new Date().toISOString().split("T")[0];
    const suffix = filled ? "Export" : "Sablonu";
    const filename = `${type.toUpperCase()}_Sifre_${suffix}_${date}.xlsx`;

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
