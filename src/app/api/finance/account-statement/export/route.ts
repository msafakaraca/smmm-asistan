import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import ExcelJS from "exceljs";

/**
 * GET /api/finance/account-statement/export
 * Hesap dökümünü Excel olarak export eder
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const type = searchParams.get("type");
    const categoryId = searchParams.get("categoryId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Filtre oluştur
    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (customerId) where.customerId = customerId;
    if (type === "DEBIT" || type === "CREDIT") where.type = type;
    if (categoryId) where.categoryId = categoryId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate)
        (where.date as Record<string, unknown>).gte = new Date(startDate);
      if (endDate)
        (where.date as Record<string, unknown>).lte = new Date(endDate);
    }

    // İşlemleri çek (tarih sırasıyla, max 5000)
    const transactions = await prisma.financial_transactions.findMany({
      where,
      include: {
        customers: { select: { id: true, unvan: true, kisaltma: true } },
        category: { select: { id: true, name: true, color: true } },
      },
      orderBy: { date: "asc" },
      take: 5000,
    });

    // Müşteri bilgisi
    let customerName = "Tüm Müşteriler";
    if (customerId) {
      const customer = await prisma.customers.findFirst({
        where: { id: customerId, tenantId: user.tenantId },
        select: { unvan: true, kisaltma: true },
      });
      if (customer) {
        customerName = customer.kisaltma || customer.unvan;
      }
    }

    // Running balance hesapla
    let balance = 0;
    const rows = transactions.map((t) => {
      const amount = Number(t.netAmount);
      const debitAmount = t.type === "DEBIT" ? amount : 0;
      const creditAmount = t.type === "CREDIT" ? amount : 0;
      if (t.type === "DEBIT") {
        balance += amount;
      } else {
        balance -= amount;
      }
      return {
        date: t.date,
        customerName: t.customers?.kisaltma || t.customers?.unvan || "",
        categoryName: t.category?.name || "",
        description: t.description || "",
        debitAmount,
        creditAmount,
        balance,
      };
    });

    // Toplamlar
    let totalDebit = 0;
    let totalCredit = 0;
    for (const r of rows) {
      totalDebit += r.debitAmount;
      totalCredit += r.creditAmount;
    }

    // Excel oluştur
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Hesap Dökümü");

    // Başlık satırı (merge)
    const dateRange = [
      startDate
        ? new Date(startDate).toLocaleDateString("tr-TR")
        : "",
      endDate
        ? new Date(endDate).toLocaleDateString("tr-TR")
        : "",
    ]
      .filter(Boolean)
      .join(" - ");

    worksheet.mergeCells("A1:G1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = `Hesap Dökümü - ${customerName}${dateRange ? ` (${dateRange})` : ""}`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 30;

    // Boş satır
    worksheet.addRow([]);

    // Kolon tanımları
    worksheet.columns = [
      { key: "date", width: 14 },
      { key: "customer", width: 25 },
      { key: "category", width: 18 },
      { key: "description", width: 35 },
      { key: "debit", width: 16 },
      { key: "credit", width: 16 },
      { key: "balance", width: 16 },
    ];

    // Header satırı
    const headerRow = worksheet.addRow([
      "Tarih",
      "Müşteri",
      "Kategori",
      "Açıklama",
      "Borç",
      "Alacak",
      "Bakiye",
    ]);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF3B82F6" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    // Veri satırları
    for (const row of rows) {
      const dataRow = worksheet.addRow([
        row.date
          ? new Date(row.date).toLocaleDateString("tr-TR")
          : "",
        row.customerName,
        row.categoryName,
        row.description,
        row.debitAmount || null,
        row.creditAmount || null,
        row.balance,
      ]);

      // Borç hücresi (kırmızı)
      const debitCell = dataRow.getCell(5);
      if (row.debitAmount > 0) {
        debitCell.font = { color: { argb: "FFDC2626" } };
      }
      debitCell.numFmt = "₺#,##0.00";

      // Alacak hücresi (yeşil)
      const creditCell = dataRow.getCell(6);
      if (row.creditAmount > 0) {
        creditCell.font = { color: { argb: "FF16A34A" } };
      }
      creditCell.numFmt = "₺#,##0.00";

      // Bakiye hücresi
      const balanceCell = dataRow.getCell(7);
      balanceCell.font = {
        color: { argb: row.balance > 0 ? "FFDC2626" : "FF16A34A" },
      };
      balanceCell.numFmt = "₺#,##0.00";

      // Tutar kolonları sağa hizalı
      debitCell.alignment = { horizontal: "right" };
      creditCell.alignment = { horizontal: "right" };
      balanceCell.alignment = { horizontal: "right" };
    }

    // Alt toplam satırı
    const summaryRow = worksheet.addRow([
      "",
      "",
      "",
      "TOPLAM",
      totalDebit,
      totalCredit,
      totalDebit - totalCredit,
    ]);
    summaryRow.font = { bold: true };
    summaryRow.getCell(5).numFmt = "₺#,##0.00";
    summaryRow.getCell(6).numFmt = "₺#,##0.00";
    summaryRow.getCell(7).numFmt = "₺#,##0.00";
    summaryRow.getCell(5).font = {
      bold: true,
      color: { argb: "FFDC2626" },
    };
    summaryRow.getCell(6).font = {
      bold: true,
      color: { argb: "FF16A34A" },
    };
    summaryRow.getCell(7).font = {
      bold: true,
      color: {
        argb: totalDebit - totalCredit > 0 ? "FFDC2626" : "FF16A34A",
      },
    };
    summaryRow.getCell(5).alignment = { horizontal: "right" };
    summaryRow.getCell(6).alignment = { horizontal: "right" };
    summaryRow.getCell(7).alignment = { horizontal: "right" };

    // Toplam satırı üst border
    for (let i = 1; i <= 7; i++) {
      summaryRow.getCell(i).border = {
        top: { style: "thin" },
        bottom: { style: "double" },
      };
    }

    // Buffer oluştur
    const buffer = await workbook.xlsx.writeBuffer();
    const safeCustomer = customerName
      .replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ\s]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 30);
    const today = new Date().toISOString().split("T")[0];
    const filename = `hesap_dokumu_${safeCustomer}_${today}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String((buffer as ArrayBuffer).byteLength),
      },
    });
  } catch (error) {
    console.error("[Hesap Dökümü Export] Hata:", error);
    return NextResponse.json(
      { error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
