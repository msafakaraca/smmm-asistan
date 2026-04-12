/**
 * E-Arşiv Fatura Tablosu
 * =======================
 * Virtual scrolling destekli fatura listesi.
 * Client-side sort, filter, Excel/PDF export.
 */

"use client";

import { memo, useMemo, useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { observeElementRectHeightOnly } from "@/lib/virtualizer-helpers";
import { ArrowUpDown, Download, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EarsivFatura } from "./hooks/use-e-arsiv-query";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface EarsivFaturaTableProps {
  invoices: EarsivFatura[];
  isLoading?: boolean;
  customerName?: string;
  periodLabel?: string;
  failedChunks?: string[];
}

type SortField = "duzenlenmeTarihi" | "toplamTutar" | "faturaNo" | "unvan";
type SortDir = "asc" | "desc";

// ═══════════════════════════════════════════════════════════════════════════
// Formatters
// ═══════════════════════════════════════════════════════════════════════════

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

function formatCurrency(val: number | string | null | undefined): string {
  if (val == null || val === "") return "-";
  const num = typeof val === "string" ? parseFloat(String(val).replace(",", ".")) : val;
  if (isNaN(num)) return "-";
  return currencyFormatter.format(num);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  // "2026-01-15 11:21:35" → "15.01.2026"
  const datePart = dateStr.split(" ")[0];
  if (datePart.includes("-")) {
    const [y, m, d] = datePart.split("-");
    return `${d}.${m}.${y}`;
  }
  return datePart;
}

// ═══════════════════════════════════════════════════════════════════════════
// Excel Export
// ═══════════════════════════════════════════════════════════════════════════

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9ÇçĞğİıÖöŞşÜü\s-]/g, "")
    .trim()
    .substring(0, 50);
}

async function exportToExcel(
  invoices: EarsivFatura[],
  customerName?: string,
  failedChunks?: string[]
) {
  const XLSX = await import("xlsx");

  const rows = invoices.map((inv) => ({
    "Ünvan": inv.unvan,
    "VKN/TCKN": inv.tcknVkn,
    "Fatura No": inv.faturaNo,
    "Düzenlenme Tarihi": formatDate(inv.duzenlenmeTarihi),
    "Toplam Tutar": inv.toplamTutar,
    "Vergiler Tutarı": inv.vergilerTutari,
    "Ödenecek Tutar": inv.odenecekTutar != null && inv.odenecekTutar !== ""
      ? parseFloat(String(inv.odenecekTutar).replace(",", ".")) || 0
      : 0,
    "Para Birimi": inv.paraBirimi,
    "Gönderim Şekli": inv.gonderimSekli,
    "İptal/İtiraz Durum": inv.iptalItirazDurum || "-",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // F3: Partial result uyarısı
  if (failedChunks && failedChunks.length > 0) {
    const warningRow = failedChunks.length + 2;
    XLSX.utils.sheet_add_aoa(
      ws,
      [
        [""],
        [`DİKKAT: Aşağıdaki tarih aralıkları sorgulanamadı — sonuçlar eksik olabilir:`],
        ...failedChunks.map((c) => [c]),
      ],
      { origin: `A${rows.length + 3}` }
    );
    // Kolon genişliği
    ws["!cols"] = [
      { wch: 50 }, { wch: 15 }, { wch: 20 }, { wch: 18 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
      { wch: 18 }, { wch: 20 },
    ];
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "E-Arşiv Alış Faturaları");

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const safeName = sanitizeFilename(customerName || "tum");
  XLSX.writeFile(wb, `e-arsiv-alis-${safeName}-${dateStr}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF Export — jsPDF ile doğrudan PDF indirme
// ═══════════════════════════════════════════════════════════════════════════

async function exportToPdf(
  invoices: EarsivFatura[],
  customerName?: string,
  periodLabel?: string,
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Türkçe karakter desteği — Roboto fontlarını yükle
  const [regularBuf, boldBuf] = await Promise.all([
    fetch("/fonts/Roboto-Regular.ttf").then((r) => r.arrayBuffer()),
    fetch("/fonts/Roboto-Bold.ttf").then((r) => r.arrayBuffer()),
  ]);

  const toBase64 = (buf: ArrayBuffer) => {
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  doc.addFileToVFS("Roboto-Regular.ttf", toBase64(regularBuf));
  doc.addFileToVFS("Roboto-Bold.ttf", toBase64(boldBuf));
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  doc.setFont("Roboto");

  const now = new Date();
  const printDate = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // Başlık
  doc.setFontSize(16);
  doc.setFont("Roboto", "bold");
  doc.text(customerName || "Tüm Mükellefler", 14, 15);

  doc.setFontSize(10);
  doc.setFont("Roboto", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text(`E-Arşiv Alış Faturaları${periodLabel ? " — " + periodLabel : ""}`, 14, 21);

  // Sağ üst bilgi
  doc.setFontSize(9);
  doc.text(printDate, 283, 15, { align: "right" });
  doc.setFont("Roboto", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text(`${invoices.length} fatura`, 283, 20, { align: "right" });

  // Ayırıcı çizgi
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.5);
  doc.line(14, 24, 283, 24);

  // Toplamlar
  const totalTutar = invoices.reduce((s, i) => s + (i.toplamTutar || 0), 0);
  const totalVergi = invoices.reduce((s, i) => s + (i.vergilerTutari || 0), 0);
  const totalOdenecek = invoices.reduce((s, i) => {
    const v = i.odenecekTutar != null && i.odenecekTutar !== ""
      ? parseFloat(String(i.odenecekTutar).replace(",", ".")) || 0
      : 0;
    return s + v;
  }, 0);

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 }).format(v);

  // 8 sütunlu tablo
  const tableHead = ["Ünvan", "VKN/TCKN", "Fatura No", "Tarih", "Toplam Tutar", "Vergiler", "Ödenecek", "Durum"];

  const tableBody = invoices.map((inv) => [
    inv.unvan,
    inv.tcknVkn,
    inv.faturaNo,
    formatDate(inv.duzenlenmeTarihi),
    formatCurrency(inv.toplamTutar),
    formatCurrency(inv.vergilerTutari),
    formatCurrency(inv.odenecekTutar),
    inv.iptalItirazDurum || "-",
  ]);

  const tableFoot = [
    "TOPLAM", "", "", "",
    fmtCurrency(totalTutar),
    fmtCurrency(totalVergi),
    fmtCurrency(totalOdenecek),
    "",
  ];

  autoTable(doc, {
    startY: 28,
    head: [tableHead],
    body: tableBody,
    foot: [tableFoot],
    styles: {
      font: "Roboto",
      fontSize: 7.5,
      cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
      overflow: "linebreak",
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
    },
    footStyles: {
      fillColor: [226, 232, 240],
      textColor: [17, 24, 39],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    // Toplam 269mm — Ünvan geniş tutuldu (tek satıra sığması için)
    columnStyles: {
      0: { cellWidth: 70, halign: "left" },                        // Ünvan
      1: { cellWidth: 26, halign: "center", fontSize: 7 },         // VKN/TCKN
      2: { cellWidth: 42, halign: "center", fontSize: 7 },         // Fatura No
      3: { cellWidth: 24, halign: "center" },                      // Tarih
      4: { cellWidth: 30, halign: "center" },                      // Toplam Tutar
      5: { cellWidth: 28, halign: "center" },                      // Vergiler
      6: { cellWidth: 30, halign: "center" },                      // Ödenecek
      7: { cellWidth: 19, halign: "center", fontSize: 7 },         // Durum
    },
    didParseCell: (data) => {
      // Gövdede para sütunları bold
      if (data.section === "body" && (data.column.index === 4 || data.column.index === 6)) {
        data.cell.styles.fontStyle = "bold";
      }
      // Gövdede VKN/Fatura No soluk renk
      if (data.section === "body" && (data.column.index === 1 || data.column.index === 2)) {
        data.cell.styles.textColor = [55, 65, 81];
      }
      // Footer — TOPLAM sola, geri kalan ortalı
      if (data.section === "foot") {
        data.cell.styles.halign = data.column.index === 0 ? "left" : "center";
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Alt bilgi
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.setFont("Roboto", "normal");
    doc.text(
      "SMMM Asistan — GİB Dijital Vergi Dairesi E-Arşiv Alış Faturaları Sorgulaması",
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
    doc.text(
      `Sayfa ${i} / ${pageCount}`,
      doc.internal.pageSize.getWidth() - 14,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" }
    );
  }

  // PDF'i indir
  const safeName = sanitizeFilename(customerName || "tum");
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  doc.save(`e-arsiv-alis-${safeName}-${dateStr}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Row Component (React.memo)
// ═══════════════════════════════════════════════════════════════════════════

const InvoiceRow = memo(function InvoiceRow({
  invoice,
  style,
}: {
  invoice: EarsivFatura;
  style: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className="flex items-center border-b border-border/50 text-sm hover:bg-muted/50 transition-colors"
    >
      <div className="w-[22%] px-3 py-2 truncate" title={invoice.unvan}>
        {invoice.unvan}
      </div>
      <div className="w-[10%] px-3 py-2">
        {invoice.tcknVkn}
      </div>
      <div className="w-[13%] px-3 py-2">
        {invoice.faturaNo}
      </div>
      <div className="w-[10%] px-3 py-2 text-center">
        {formatDate(invoice.duzenlenmeTarihi)}
      </div>
      <div className="w-[10%] px-3 py-2 text-right font-medium">
        {formatCurrency(invoice.toplamTutar)}
      </div>
      <div className="w-[9%] px-3 py-2 text-right text-muted-foreground">
        {formatCurrency(invoice.vergilerTutari)}
      </div>
      <div className="w-[10%] px-3 py-2 text-right font-medium">
        {formatCurrency(invoice.odenecekTutar)}
      </div>
      <div className="w-[5%] px-3 py-2 text-center text-xs text-muted-foreground">
        {invoice.paraBirimi}
      </div>
      <div className="w-[6%] px-3 py-2 text-center text-xs">
        {invoice.gonderimSekli === "ELEKTRONİK" ? "E" : invoice.gonderimSekli}
      </div>
      <div className="w-[5%] px-3 py-2 text-center text-xs text-muted-foreground">
        {invoice.iptalItirazDurum || "-"}
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Table Component
// ═══════════════════════════════════════════════════════════════════════════

export const EarsivFaturaTable = memo(function EarsivFaturaTable({
  invoices,
  isLoading,
  customerName,
  periodLabel,
  failedChunks,
}: EarsivFaturaTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("duzenlenmeTarihi");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Sort handler
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
    },
    [sortField]
  );

  // Filtered + Sorted invoices
  const filteredInvoices = useMemo(() => {
    let result = invoices;

    // Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.unvan.toLowerCase().includes(q) ||
          inv.tcknVkn.includes(q) ||
          inv.faturaNo.toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "duzenlenmeTarihi":
          cmp = a.duzenlenmeTarihi.localeCompare(b.duzenlenmeTarihi);
          break;
        case "toplamTutar":
          cmp = (a.toplamTutar || 0) - (b.toplamTutar || 0);
          break;
        case "faturaNo":
          cmp = a.faturaNo.localeCompare(b.faturaNo);
          break;
        case "unvan":
          cmp = a.unvan.localeCompare(b.unvan, "tr");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [invoices, search, sortField, sortDir]);

  // Toplam tutar
  const totalAmount = useMemo(
    () => invoices.reduce((sum, inv) => sum + (inv.toplamTutar || 0), 0),
    [invoices]
  );

  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: filteredInvoices.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 20,
    observeElementRect: observeElementRectHeightOnly,
  });

  const handleExportExcel = useCallback(() => {
    exportToExcel(invoices, customerName, failedChunks);
  }, [invoices, customerName, failedChunks]);

  const handleExportPdf = useCallback(() => {
    void exportToPdf(filteredInvoices, customerName, periodLabel);
  }, [filteredInvoices, customerName, periodLabel]);

  if (invoices.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ünvan, VKN veya fatura no ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Toplam {invoices.length} fatura, {formatCurrency(totalAmount)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={invoices.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={invoices.length === 0}
          >
            <Printer className="h-4 w-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filtre durumu */}
      {search && (
        <div className="text-sm text-muted-foreground">
          {filteredInvoices.length} / {invoices.length} fatura gösteriliyor
        </div>
      )}

      {/* Tablo */}
      <div className="border rounded-lg overflow-hidden">
        {/* Header — Sticky */}
        <div className="flex items-center bg-muted/50 border-b text-xs font-medium text-muted-foreground sticky top-0 z-10">
          <button
            onClick={() => handleSort("unvan")}
            className="w-[22%] px-3 py-2.5 text-left flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Ünvan <ArrowUpDown className="h-3 w-3" />
          </button>
          <div className="w-[10%] px-3 py-2.5">VKN/TCKN</div>
          <button
            onClick={() => handleSort("faturaNo")}
            className="w-[13%] px-3 py-2.5 text-left flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Fatura No <ArrowUpDown className="h-3 w-3" />
          </button>
          <button
            onClick={() => handleSort("duzenlenmeTarihi")}
            className="w-[10%] px-3 py-2.5 text-center flex items-center justify-center gap-1 hover:text-foreground transition-colors"
          >
            Tarih <ArrowUpDown className="h-3 w-3" />
          </button>
          <button
            onClick={() => handleSort("toplamTutar")}
            className="w-[10%] px-3 py-2.5 text-right flex items-center justify-end gap-1 hover:text-foreground transition-colors"
          >
            Toplam <ArrowUpDown className="h-3 w-3" />
          </button>
          <div className="w-[9%] px-3 py-2.5 text-right">Vergiler</div>
          <div className="w-[10%] px-3 py-2.5 text-right">Ödenecek</div>
          <div className="w-[5%] px-3 py-2.5 text-center">PB</div>
          <div className="w-[6%] px-3 py-2.5 text-center">Gönd.</div>
          <div className="w-[5%] px-3 py-2.5 text-center">İptal</div>
        </div>

        {/* Body — Virtual Scrolled */}
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ height: Math.min(filteredInvoices.length * 40, 600) }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
              <InvoiceRow
                key={filteredInvoices[virtualRow.index].faturaNo + "-" + virtualRow.index}
                invoice={filteredInvoices[virtualRow.index]}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

    </div>
  );
});
