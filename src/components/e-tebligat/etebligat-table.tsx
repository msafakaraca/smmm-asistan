/**
 * E-Tebligat Tablosu
 * ===================
 * Virtual scrolling destekli tebligat listesi.
 * Client-side sort, filter, Excel export.
 */

"use client";

import { memo, useMemo, useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { observeElementRectHeightOnly } from "@/lib/virtualizer-helpers";
import { ArrowUpDown, Download, Search, Mail, MailOpen, FileText, Loader2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TebligatItem } from "./hooks/use-etebligat-query";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface EtebligatTableProps {
  tebligatlar: TebligatItem[];
  isLoading?: boolean;
  customerName?: string;
  zarfLoading: string | null;
  pdfLoading: string | null;
  onOpenZarf: (tarafId: string, tarafSecureId: string) => void;
  onViewPdf: (tebligId: string, tebligSecureId: string, tarafId: string, tarafSecureId: string) => void;
}

type SortField = "tebligZamani" | "kurumAciklama" | "belgeTuruAciklama" | "belgeNo";
type SortDir = "asc" | "desc";

type OkunmaDurumFilter = "all" | "okunmus" | "okunmamis";

// ═══════════════════════════════════════════════════════════════════════════
// Formatters
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tarih string'ini Date objesine çevir.
 * GİB API "DD.MM.YYYY HH:mm:ss" veya "DD/MM/YYYY" formatında dönebilir,
 * ISO "YYYY-MM-DDTHH:mm:ss" formatı da desteklenir.
 */
function parseToDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Önce standart ISO parse dene
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  // DD.MM.YYYY veya DD/MM/YYYY (opsiyonel saat kısmı)
  const match = dateStr.match(/^(\d{2})[./](\d{2})[./](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const [, dd, mm, yyyy, hh, min] = match;
    return new Date(+yyyy, +mm - 1, +dd, +(hh || 0), +(min || 0));
  }
  return null;
}

/** Sıralama için tarih string'ini timestamp'e çevir */
function parseDateToTimestamp(dateStr: string | null): number {
  if (!dateStr) return 0;
  return parseToDate(dateStr)?.getTime() || 0;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  // "2026-01-15T11:21:35" → "15/01/2026 11:21"
  // "31.08.2024 00:00:00" → "31/08/2024" (saat 00:00 ise sadece tarih)
  try {
    const d = parseToDate(dateStr);
    if (!d) return dateStr;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = d.getHours();
    const min = d.getMinutes();
    if (hh === 0 && min === 0) {
      return `${dd}/${mm}/${yyyy}`;
    }
    return `${dd}/${mm}/${yyyy} ${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  } catch {
    return dateStr;
  }
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

async function exportToExcel(tebligatlar: TebligatItem[], customerName?: string) {
  const XLSX = await import("xlsx");

  const rows = tebligatlar.map((t) => ({
    "Durum": t.mukellefOkumaZamani ? "Okunmuş" : "Okunmamış",
    "Kurum": t.kurumAciklama,
    "Alt Kurum": t.altKurum || "-",
    "Belge Türü": t.belgeTuruAciklama,
    "Belge No": t.belgeNo,
    "Tebliğ Zamanı": formatDate(t.tebligZamani),
    "Okunma Zamanı": t.mukellefOkumaZamani ? formatDate(t.mukellefOkumaZamani) : "Okunmadı",
    "Gönderim Zamanı": formatDate(t.gonderimZamani),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 12 }, { wch: 35 }, { wch: 25 }, { wch: 25 },
    { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "E-Tebligat");

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const safeName = sanitizeFilename(customerName || "tum");
  XLSX.writeFile(wb, `e-tebligat-${safeName}-${dateStr}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF Export — jsPDF
// ═══════════════════════════════════════════════════════════════════════════

async function exportToPdf(tebligatlar: TebligatItem[], customerName?: string, filterLabel?: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Türkçe karakter desteği — Roboto fontları
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
  doc.text(`E-Tebligat Raporu${filterLabel ? " — " + filterLabel : ""}`, 14, 21);

  // Sağ üst bilgi
  doc.setFontSize(9);
  doc.text(printDate, 283, 15, { align: "right" });
  doc.setFont("Roboto", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text(`${tebligatlar.length} tebligat`, 283, 20, { align: "right" });

  // Ayırıcı çizgi
  doc.setDrawColor(17, 24, 39);
  doc.setLineWidth(0.5);
  doc.line(14, 24, 283, 24);

  // Tablo verileri
  const tableHead = ["Durum", "Kurum", "Alt Kurum", "Belge Türü", "Belge No", "Tebliğ Zamanı", "Okunma Zamanı", "Gönderim Zamanı"];

  const tableBody = tebligatlar.map((t) => [
    t.mukellefOkumaZamani ? "Okunmuş" : "Okunmamış",
    t.kurumAciklama,
    t.altKurum || "-",
    t.belgeTuruAciklama,
    t.belgeNo,
    formatDate(t.tebligZamani),
    t.mukellefOkumaZamani ? formatDate(t.mukellefOkumaZamani) : "Okunmadı",
    formatDate(t.gonderimZamani),
  ]);

  // Özet sayılar
  const okunmus = tebligatlar.filter((t) => t.mukellefOkumaZamani).length;
  const okunmamis = tebligatlar.length - okunmus;

  autoTable(doc, {
    startY: 28,
    head: [tableHead],
    body: tableBody,
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
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      1: { cellWidth: 55 },
      2: { cellWidth: 40 },
      3: { cellWidth: 35 },
      4: { cellWidth: 30 },
      5: { cellWidth: 28, halign: "center" },
      6: { cellWidth: 28, halign: "center" },
      7: { cellWidth: 28, halign: "center" },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didParseCell: (data: any) => {
      // Durum sütununu renklendir
      if (data.section === "body" && data.column.index === 0) {
        if (data.cell.text[0] === "Okunmamış") {
          data.cell.styles.textColor = [180, 83, 9]; // amber-700
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = [21, 128, 61]; // green-700
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Alt bilgi — Özet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY || 200;
  doc.setFontSize(8);
  doc.setFont("Roboto", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text(
    `Toplam: ${tebligatlar.length} tebligat  |  Okunmuş: ${okunmus}  |  Okunmamış: ${okunmamis}`,
    14,
    finalY + 8
  );

  // Dosya adı
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const safeName = sanitizeFilename(customerName || "tum");
  doc.save(`e-tebligat-${safeName}-${dateStr}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Row Component (React.memo)
// ═══════════════════════════════════════════════════════════════════════════

const TebligatRow = memo(function TebligatRow({
  tebligat,
  style,
  zarfLoading,
  pdfLoading,
  onOpenZarf,
  onViewPdf,
}: {
  tebligat: TebligatItem;
  style: React.CSSProperties;
  zarfLoading: string | null;
  pdfLoading: string | null;
  onOpenZarf: (tarafId: string, tarafSecureId: string) => void;
  onViewPdf: (tebligId: string, tebligSecureId: string, tarafId: string, tarafSecureId: string) => void;
}) {
  const isOkunmamis = !tebligat.mukellefOkumaZamani;
  const isZarfLoading = zarfLoading === tebligat.tarafId;
  const isPdfLoading = pdfLoading === tebligat.tebligId;

  return (
    <div
      style={style}
      className={`flex items-center border-b border-border/50 text-sm hover:bg-muted/50 transition-colors ${
        isOkunmamis ? "bg-amber-50 dark:bg-amber-950/20" : ""
      }`}
    >
      {/* Durum */}
      <div className="w-[4%] px-3 py-2 flex justify-center">
        {isOkunmamis ? (
          <Mail className="h-4 w-4 text-amber-600" />
        ) : (
          <MailOpen className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      {/* Kurum */}
      <div className="w-[15%] px-3 py-2 truncate" title={tebligat.kurumAciklama}>
        {tebligat.kurumAciklama}
      </div>
      {/* Alt Kurum */}
      <div className="w-[14%] px-3 py-2 truncate text-muted-foreground" title={tebligat.altKurum || ""}>
        {tebligat.altKurum || "-"}
      </div>
      {/* Belge Türü */}
      <div className="w-[11%] px-3 py-2 truncate" title={tebligat.belgeTuruAciklama}>
        {tebligat.belgeTuruAciklama}
      </div>
      {/* Belge No */}
      <div className="w-[13%] px-3 py-2">
        {tebligat.belgeNo}
      </div>
      {/* Tebliğ Zamanı */}
      <div className="w-[10%] px-3 py-2 text-center text-xs">
        {formatDate(tebligat.tebligZamani)}
      </div>
      {/* Okunma Zamanı */}
      <div className={`w-[12%] px-3 py-2 text-center text-xs ${isOkunmamis ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
        {tebligat.mukellefOkumaZamani ? formatDate(tebligat.mukellefOkumaZamani) : "Okunmadı"}
      </div>
      {/* İşlemler */}
      <div className="w-[21%] px-3 py-2 flex items-center justify-center gap-1.5">
        {/* Aç butonu için sabit genişlik slotu - her zaman aynı yer ayrılır */}
        <div className="w-16 flex justify-end">
          {isOkunmamis && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs w-full"
              disabled={isZarfLoading}
              onClick={() => onOpenZarf(tebligat.tarafId, tebligat.tarafSecureId)}
            >
              {isZarfLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <MailOpen className="h-3 w-3 mr-1" />
                  Aç
                </>
              )}
            </Button>
          )}
        </div>
        {/* PDF butonu için sabit genişlik slotu */}
        <div className="w-16">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs w-full"
            disabled={isPdfLoading}
            onClick={() => onViewPdf(tebligat.tebligId, tebligat.tebligSecureId, tebligat.tarafId, tebligat.tarafSecureId)}
          >
            {isPdfLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <FileText className="h-3 w-3 mr-1" />
                PDF
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Table Component
// ═══════════════════════════════════════════════════════════════════════════

export const EtebligatTable = memo(function EtebligatTable({
  tebligatlar,
  isLoading,
  customerName,
  zarfLoading,
  pdfLoading,
  onOpenZarf,
  onViewPdf,
}: EtebligatTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("tebligZamani");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [okunmaFilter, setOkunmaFilter] = useState<OkunmaDurumFilter>("all");

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

  // Filtered + Sorted
  const filteredTebligatlar = useMemo(() => {
    let result = tebligatlar;

    // Okunma durumu filtresi
    if (okunmaFilter === "okunmus") {
      result = result.filter((t) => t.mukellefOkumaZamani !== null);
    } else if (okunmaFilter === "okunmamis") {
      result = result.filter((t) => t.mukellefOkumaZamani === null);
    }

    // Arama filtresi
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.kurumAciklama.toLowerCase().includes(q) ||
          (t.altKurum && t.altKurum.toLowerCase().includes(q)) ||
          t.belgeTuruAciklama.toLowerCase().includes(q) ||
          t.belgeNo.toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "tebligZamani":
          cmp = parseDateToTimestamp(a.tebligZamani) - parseDateToTimestamp(b.tebligZamani);
          break;
        case "kurumAciklama":
          cmp = a.kurumAciklama.localeCompare(b.kurumAciklama, "tr");
          break;
        case "belgeTuruAciklama":
          cmp = a.belgeTuruAciklama.localeCompare(b.belgeTuruAciklama, "tr");
          break;
        case "belgeNo":
          cmp = a.belgeNo.localeCompare(b.belgeNo);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [tebligatlar, search, sortField, sortDir, okunmaFilter]);

  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: filteredTebligatlar.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 20,
    observeElementRect: observeElementRectHeightOnly,
  });

  // Sayılar
  const okunmamisSayisi = useMemo(
    () => tebligatlar.filter((t) => !t.mukellefOkumaZamani).length,
    [tebligatlar]
  );

  const handleExportExcel = useCallback(() => {
    exportToExcel(filteredTebligatlar, customerName);
  }, [filteredTebligatlar, customerName]);

  // PDF export — filtrelenmiş listeyi kullan
  const filterLabel = okunmaFilter === "okunmus" ? "Okunmuş" : okunmaFilter === "okunmamis" ? "Okunmamış" : "Tümü";
  const handleExportPdf = useCallback(() => {
    void exportToPdf(filteredTebligatlar, customerName, filterLabel);
  }, [filteredTebligatlar, customerName, filterLabel]);

  if (tebligatlar.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Kurum, belge türü veya belge no ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {/* Okunma durumu filtresi */}
          <div className="flex items-center gap-1 text-sm">
            <button
              onClick={() => setOkunmaFilter("all")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                okunmaFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              Tümü ({tebligatlar.length})
            </button>
            <button
              onClick={() => setOkunmaFilter("okunmamis")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                okunmaFilter === "okunmamis"
                  ? "bg-amber-600 text-white"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              Okunmamış ({okunmamisSayisi})
            </button>
            <button
              onClick={() => setOkunmaFilter("okunmus")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                okunmaFilter === "okunmus"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              Okunmuş ({tebligatlar.length - okunmamisSayisi})
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={filteredTebligatlar.length === 0}
          >
            <FileDown className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={filteredTebligatlar.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            Excel
          </Button>
        </div>
      </div>

      {/* Filtre durumu */}
      {search && (
        <div className="text-sm text-muted-foreground">
          {filteredTebligatlar.length} / {tebligatlar.length} tebligat gösteriliyor
        </div>
      )}

      {/* Tablo */}
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center bg-muted/50 border-b text-xs font-medium text-muted-foreground sticky top-0 z-10">
          <div className="w-[4%] px-3 py-2.5 text-center">Durum</div>
          <button
            onClick={() => handleSort("kurumAciklama")}
            className="w-[15%] px-3 py-2.5 text-left flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Kurum <ArrowUpDown className="h-3 w-3" />
          </button>
          <div className="w-[14%] px-3 py-2.5 text-left">Alt Kurum</div>
          <button
            onClick={() => handleSort("belgeTuruAciklama")}
            className="w-[11%] px-3 py-2.5 text-left flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Belge Türü <ArrowUpDown className="h-3 w-3" />
          </button>
          <button
            onClick={() => handleSort("belgeNo")}
            className="w-[13%] px-3 py-2.5 text-left flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Belge No <ArrowUpDown className="h-3 w-3" />
          </button>
          <button
            onClick={() => handleSort("tebligZamani")}
            className="w-[10%] px-3 py-2.5 text-center flex items-center justify-center gap-1 hover:text-foreground transition-colors"
          >
            Tebliğ Zamanı <ArrowUpDown className="h-3 w-3" />
          </button>
          <div className="w-[12%] px-3 py-2.5 text-center">Okunma Zamanı</div>
          <div className="w-[21%] px-3 py-2.5 text-center">İşlemler</div>
        </div>

        {/* Body — Virtual Scrolled */}
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ height: Math.min(filteredTebligatlar.length * 40, 600) }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
              <TebligatRow
                key={filteredTebligatlar[virtualRow.index].tebligId}
                tebligat={filteredTebligatlar[virtualRow.index]}
                zarfLoading={zarfLoading}
                pdfLoading={pdfLoading}
                onOpenZarf={onOpenZarf}
                onViewPdf={onViewPdf}
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
