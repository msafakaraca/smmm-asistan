import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { extractCellData } from "@/lib/takip-utils";
import ExcelJS from "exceljs";

const MONTH_NAMES = [
  "Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran",
  "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik",
];

/**
 * GET /api/takip/export?year=YYYY&month=MM
 * Takip çizelgesini Excel olarak export eder
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || "");
    const month = parseInt(searchParams.get("month") || "");

    if (!year || !month) {
      return NextResponse.json({ error: "year ve month parametreleri gerekli" }, { status: 400 });
    }

    const tenantId = user.tenantId;

    // Kolonlar + satırlar paralel çek
    const [kolonlar, satirlar] = await Promise.all([
      prisma.takip_kolonlar.findMany({
        where: { tenantId, aktif: true, sistem: false },
        orderBy: { siraNo: "asc" },
      }),
      prisma.takip_satirlar.findMany({
        where: { tenantId, year, month },
        orderBy: { siraNo: "asc" },
      }),
    ]);

    // NO'ya göre sırala
    const sortedSatirlar = satirlar.sort((a, b) => {
      const parseNo = (no: string): number => {
        const num = parseInt(no.replace(/\D/g, ""), 10);
        return isNaN(num) ? Infinity : num;
      };
      return parseNo(a.no || "") - parseNo(b.no || "");
    });

    // Excel workbook
    const workbook = new ExcelJS.Workbook();
    const monthLabel = MONTH_NAMES[month - 1] || String(month);
    const worksheet = workbook.addWorksheet(`${monthLabel} ${year}`);

    // Kolon tanımları
    const excelColumns: ExcelJS.Column[] = [
      { header: "No", key: "no", width: 8 } as ExcelJS.Column,
      { header: "İsim/Ünvan", key: "isim", width: 30 } as ExcelJS.Column,
      ...kolonlar.map((k) => ({
        header: k.baslik,
        key: k.kod,
        width: k.tip === "boolean" ? 10 : 20,
      } as ExcelJS.Column)),
      { header: "Son Durum", key: "SONDUR", width: 12 } as ExcelJS.Column,
    ];
    worksheet.columns = excelColumns;

    // Header stil
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF3B82F6" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    // Satır verileri
    for (const satir of sortedSatirlar) {
      const degerler = satir.degerler as Record<string, unknown> | null;
      const rowData: Record<string, string> = {
        no: satir.no || "",
        isim: satir.isim || "",
      };

      // Dinamik kolonlar
      for (const kolon of kolonlar) {
        const cellData = extractCellData(degerler?.[kolon.kod]);
        if (kolon.tip === "boolean") {
          rowData[kolon.kod] = cellData.value === true ? "\u2713" : cellData.value === false ? "\u2717" : "";
        } else {
          rowData[kolon.kod] = (cellData.value as string) ?? "";
        }
      }

      // Son Durum
      const sondurData = extractCellData(degerler?.["SONDUR"]);
      rowData["SONDUR"] = sondurData.value === true ? "\u2713 Tamam" : sondurData.value === false ? "\u2717 İptal" : "";

      const row = worksheet.addRow(rowData);

      // Satır renklendirme
      if (sondurData.value === true) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD1FAE5" }, // emerald-100
          };
        });
      } else if (sondurData.value === false) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF3C7" }, // amber-100
          };
        });
      }

      // Boolean hücre renkleri
      for (let colIdx = 0; colIdx < kolonlar.length; colIdx++) {
        const kolon = kolonlar[colIdx];
        if (kolon.tip !== "boolean") continue;

        const cellData = extractCellData(degerler?.[kolon.kod]);
        const cell = row.getCell(colIdx + 3); // +3: no, isim
        cell.alignment = { horizontal: "center" };

        if (cellData.value === true) {
          cell.font = { color: { argb: "FF059669" }, bold: true }; // emerald-600
        } else if (cellData.value === false) {
          cell.font = { color: { argb: "FFD97706" }, bold: true }; // amber-600
        }
      }
    }

    // Buffer olarak dön
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `takip_${monthLabel}_${year}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String((buffer as ArrayBuffer).byteLength),
      },
    });
  } catch (error) {
    console.error("[Takip Export API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
