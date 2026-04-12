/**
 * Vergi Tahsil Alındıları Client Component
 * =========================================
 * Mükellef seçimi, dönem seçimi, sorgulama ve tahsilat tablosu.
 * Expandable rows ile detay gösterimi.
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  Receipt,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Search,
  Download,
  FileText,
  Filter,
  X,
  ExternalLink,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTahsilatQuery } from "./hooks/use-tahsilat-query";
import type { TahsilatFis, TahsilatMeta } from "./hooks/use-tahsilat-query";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface Customer {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  hasGibCredentials: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Sabitler
// ═══════════════════════════════════════════════════════════════════════════

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

/** Beyanname dönem kuralı: bir önceki ay */
function getDefaultPeriod() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  let previousMonth = currentMonth - 1;
  let previousYear = currentYear;
  if (previousMonth === 0) {
    previousMonth = 12;
    previousYear = currentYear - 1;
  }
  return {
    basAy: String(1).padStart(2, "0"),
    basYil: String(previousYear),
    bitAy: String(previousMonth).padStart(2, "0"),
    bitYil: String(previousYear),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Excel Export
// ═══════════════════════════════════════════════════════════════════════════

function exportToExcel(tahsilatlar: TahsilatFis[], customerName: string) {
  if (tahsilatlar.length === 0) {
    toast.error("Dışa aktarılacak veri yok");
    return;
  }

  const rows: string[][] = [
    ["Vergi Türü", "Vergilendirme Dönemi", "Ödeme Tarihi", "Tahsilat Fiş No", "Tahakkuk Fiş No", "Detay Vergi Kodu", "Taksit No", "Ödenen", "Gecikme Zammı", "Kesinleşen GZ"],
  ];

  for (const fis of tahsilatlar) {
    if (fis.detaylar && fis.detaylar.length > 0) {
      for (const detay of fis.detaylar) {
        rows.push([
          fis.vergikodu,
          fis.vergidonem,
          fis.odemetarihi,
          fis.thsfisno,
          fis.thkfisno,
          detay.detayvergikodu,
          detay.taksitno,
          detay.thsodenen,
          detay.thsgzammi,
          detay.thskesinlesengz,
        ]);
      }
      // Toplam satırı
      if (fis.toplam) {
        rows.push([
          fis.vergikodu,
          fis.vergidonem,
          fis.odemetarihi,
          fis.thsfisno,
          fis.thkfisno,
          "TOPLAM",
          "",
          fis.toplam.toplamodenen,
          fis.toplam.toplamgzammi,
          fis.toplam.toplamkesinlesengz,
        ]);
      }
    } else {
      rows.push([
        fis.vergikodu,
        fis.vergidonem,
        fis.odemetarihi,
        fis.thsfisno,
        fis.thkfisno,
        "",
        "",
        "",
        "",
        "",
      ]);
    }
  }

  // CSV oluştur (Excel uyumlu BOM)
  const BOM = "\uFEFF";
  const csv = BOM + rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tahsilat-alindilari-${customerName.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Tahsilat alındıları dışa aktarıldı");
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF Export
// ═══════════════════════════════════════════════════════════════════════════

async function exportToPdf(
  tahsilatlar: TahsilatFis[],
  customerName: string,
  meta: TahsilatMeta | null
) {
  if (tahsilatlar.length === 0) {
    toast.error("Dışa aktarılacak veri yok");
    return;
  }

  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Türkçe karakter destekli Roboto fontunu yükle
  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch("/fonts/Roboto-Regular.ttf"),
      fetch("/fonts/Roboto-Bold.ttf"),
    ]);
    const [regularBuf, boldBuf] = await Promise.all([
      regularRes.arrayBuffer(),
      boldRes.arrayBuffer(),
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
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", toBase64(boldBuf));
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    doc.setFont("Roboto");
  } catch {
    // Font yüklenemezse Helvetica'ya geri dön
    doc.setFont("helvetica");
  }

  // Başlık
  doc.setFontSize(14);
  doc.text("Vergi Tahsil Alındıları", 14, 15);

  // Meta bilgileri
  if (meta) {
    doc.setFontSize(9);
    doc.text(`Mükellef: ${meta.adsoyadunvan}`, 14, 22);
    doc.text(`VKN/TCKN: ${meta.vkntckn}`, 14, 27);
    doc.text(`Vergi Dairesi: ${meta.vergidairesi}`, 140, 22);
    doc.text(`Toplam Tahsilat: ${meta.toplamtahsilatsayisi} adet`, 140, 27);
  }

  // Her tahsilat grubunu ayrı tablo olarak çiz — grup bölünmeden tek sayfada kalır
  const COL_COUNT = 5;
  const headRow = [
    "Detay Vergi Kodu",
    "Taksit No",
    "Ödenen (TL)",
    "Gecikme Zammı (TL)",
    "Kesinleşen GZ (TL)",
  ];

  type RowType = "group" | "detail" | "total" | "empty";

  const pageHeight = doc.internal.pageSize.getHeight();
  const MARGIN_BOTTOM = 15;
  const ROW_H = 8; // tahmini satır yüksekliği (mm)
  const HEAD_H = 10; // kolon başlık yüksekliği (mm)

  let currentY = meta ? 32 : 22;
  let showHead = true; // sayfa başında kolon başlıkları göster

  // Ortak tablo stilleri
  // A4 landscape: 297mm genişlik, 14mm sol + 14mm sağ margin = 269mm kullanılabilir alan
  const tableStyles = {
    theme: "grid" as const,
    margin: { left: 14, right: 14 },
    styles: {
      font: "Roboto",
      fontSize: 7,
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: 0.2,
    },
    headStyles: {
      font: "Roboto",
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: "bold" as const,
      fontSize: 7.5,
      halign: "center" as const,
    },
    columnStyles: {
      0: { cellWidth: 79, halign: "left" as const },    // Detay Vergi Kodu
      1: { cellWidth: 22, halign: "center" as const },  // Taksit No
      2: { cellWidth: 56, halign: "right" as const },   // Ödenen (TL)
      3: { cellWidth: 56, halign: "right" as const },   // Gecikme Zammı (TL)
      4: { cellWidth: 56, halign: "right" as const },   // Kesinleşen GZ (TL)
    },
  };

  for (const fis of tahsilatlar) {
    // Grup body ve row tiplerini hazırla
    const groupRowTypes: RowType[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupBody: any[][] = [];

    // Grup başlık satırı
    const groupLabel = [
      fis.vergikodu,
      `Dönem: ${fis.vergidonem}`,
      `Ödeme: ${fis.odemetarihi}`,
      `Tahsilat Fiş: ${fis.thsfisno}`,
      `Tahakkuk Fiş: ${fis.thkfisno}`,
    ].join("   |   ");

    groupBody.push([{ content: groupLabel, colSpan: COL_COUNT }]);
    groupRowTypes.push("group");

    if (fis.detaylar && fis.detaylar.length > 0) {
      for (const detay of fis.detaylar) {
        groupBody.push([
          detay.detayvergikodu,
          detay.taksitno,
          formatCurrency(detay.thsodenen),
          formatCurrency(detay.thsgzammi),
          formatCurrency(detay.thskesinlesengz),
        ]);
        groupRowTypes.push("detail");
      }
      if (fis.toplam) {
        groupBody.push([
          "TOPLAM",
          "",
          formatCurrency(fis.toplam.toplamodenen),
          formatCurrency(fis.toplam.toplamgzammi),
          formatCurrency(fis.toplam.toplamkesinlesengz),
        ]);
        groupRowTypes.push("total");
      }
    } else {
      groupBody.push([
        { content: "Detay bilgisi yok", colSpan: COL_COUNT },
      ]);
      groupRowTypes.push("empty");
    }

    // Tahmini grup yüksekliği: satır sayısı * ROW_H + (başlık varsa HEAD_H)
    const estimatedH = groupBody.length * ROW_H + (showHead ? HEAD_H : 0);
    const availableH = pageHeight - currentY - MARGIN_BOTTOM;

    // Sığmıyorsa yeni sayfaya geç
    if (estimatedH > availableH && currentY > 40) {
      doc.addPage();
      currentY = 15;
      showHead = true;
    }

    // Bu grubu tablo olarak çiz
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    autoTable(doc, {
      ...(tableStyles as any),
      head: showHead ? [headRow] : undefined,
      body: groupBody,
      startY: currentY,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      didParseCell(data: any) {
        if (data.section !== "body") return;
        const type = groupRowTypes[data.row.index];

        if (type === "group") {
          data.cell.styles.fillColor = [44, 62, 80];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 7.5;
          data.cell.styles.halign = "left";
        } else if (type === "total") {
          data.cell.styles.fillColor = [230, 236, 240];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [30, 30, 30];
        } else if (type === "detail") {
          data.cell.styles.fillColor = [255, 255, 255];
        } else if (type === "empty") {
          data.cell.styles.fillColor = [250, 250, 250];
          data.cell.styles.textColor = [150, 150, 150];
          data.cell.styles.fontStyle = "italic";
          data.cell.styles.halign = "center";
        }
      },
    });

    // Sonraki grubun başlangıç Y pozisyonunu al
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentY = (doc as any).lastAutoTable.finalY + 1;
    showHead = false;
  }

  // Altbilgi
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Sayfa ${i} / ${pageCount} - Oluşturulma: ${new Date().toLocaleDateString("tr-TR")} ${new Date().toLocaleTimeString("tr-TR")}`,
      14,
      doc.internal.pageSize.getHeight() - 7
    );
  }

  const safeName = customerName.replace(/\s+/g, "_");
  doc.save(`Vergi_Tahsil_Alındıları_${safeName}.pdf`);
  toast.success("PDF olarak indirildi");
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function TahsilatClient() {
  // Mükellef listesi
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dönem
  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);
  const [basAy, setBasAy] = useState(defaultPeriod.basAy);
  const [basYil, setBasYil] = useState(defaultPeriod.basYil);
  const [bitAy, setBitAy] = useState(defaultPeriod.bitAy);
  const [bitYil, setBitYil] = useState(defaultPeriod.bitYil);

  // Vergi türü filtresi
  const [vergiTuruFilter, setVergiTuruFilter] = useState<string>("all");

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Hook
  const {
    tahsilatlar,
    meta,
    isLoading,
    progress,
    error,
    errorCode,
    startQuery,
    clearResults,
  } = useTahsilatQuery();

  // Mükellef listesi yükle — fields=minimal ile hasGibCredentials flag'i döner
  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch("/api/customers?fields=minimal");
        if (!res.ok) return;
        const data = await res.json();
        const mapped: Customer[] = (data || []).map((c: { id: string; unvan: string; kisaltma: string | null; vknTckn: string; hasGibCredentials: boolean }) => ({
          id: c.id,
          unvan: c.unvan,
          kisaltma: c.kisaltma,
          vknTckn: c.vknTckn,
          hasGibCredentials: c.hasGibCredentials,
        }));
        setCustomers(mapped);
      } catch {
        toast.error("Mükellef listesi yüklenemedi");
      } finally {
        setCustomersLoading(false);
      }
    }
    loadCustomers();
  }, []);

  // Filtrelenmiş mükellefler
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const search = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.unvan.toLowerCase().includes(search) ||
        (c.kisaltma && c.kisaltma.toLowerCase().includes(search)) ||
        c.vknTckn.includes(search)
    );
  }, [customers, customerSearch]);

  // Seçili mükellef
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  // Benzersiz vergi türleri (filtre seçenekleri)
  const vergiTurleri = useMemo(() => {
    const set = new Set<string>();
    for (const fis of tahsilatlar) {
      if (fis.vergikodu) set.add(fis.vergikodu);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [tahsilatlar]);

  // Vergi türüne göre filtrelenmiş tahsilatlar
  const filteredTahsilatlar = useMemo(() => {
    if (vergiTuruFilter === "all") return tahsilatlar;
    return tahsilatlar.filter((fis) => fis.vergikodu === vergiTuruFilter);
  }, [tahsilatlar, vergiTuruFilter]);

  // Sorgula
  const handleQuery = useCallback(async () => {
    if (!selectedCustomerId) {
      toast.error("Lütfen bir mükellef seçin");
      return;
    }

    if (!selectedCustomer?.hasGibCredentials) {
      toast.error("Seçili mükellefin GİB bilgileri eksik. Şifreler sayfasından GİB kullanıcı adı ve şifresini girin.");
      return;
    }

    setExpandedRows(new Set());
    setVergiTuruFilter("all");
    await startQuery(selectedCustomerId, basAy, basYil, bitAy, bitYil);
  }, [selectedCustomerId, selectedCustomer, basAy, basYil, bitAy, bitYil, startQuery]);

  // Satır expand/collapse
  const toggleRow = useCallback((tahsilatoid: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(tahsilatoid)) {
        next.delete(tahsilatoid);
      } else {
        next.add(tahsilatoid);
      }
      return next;
    });
  }, []);

  // Temizle
  const handleClear = useCallback(() => {
    clearResults();
    setExpandedRows(new Set());
    setVergiTuruFilter("all");
  }, [clearResults]);

  return (
    <div className="flex flex-col h-full p-1">
     <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border/60 bg-card/50 shadow-sm overflow-hidden">
      {/* Başlık */}
      <div className="flex items-center gap-3 px-6 py-4 border-b">
        <Receipt className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Vergi Tahsil Alındıları</h1>
      </div>

      {/* Filtreler */}
      <div className="px-6 py-3 border-b">
        <div className="flex flex-col gap-4">
          {/* Mükellef Seçimi — Combobox (arama + dropdown tek bileşen) */}
          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={isLoading || customersLoading}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setComboboxOpen(true)}
              >
                <span className={selectedCustomer ? "text-foreground" : "text-muted-foreground"}>
                  {customersLoading
                    ? "Yükleniyor..."
                    : selectedCustomer
                      ? (selectedCustomer.kisaltma || selectedCustomer.unvan)
                      : "Mükellef ara veya seçin..."
                  }
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="p-0"
              style={{ width: "var(--radix-popover-trigger-width)" }}
              align="start"
            >
              <div className="p-2">
                <Input
                  ref={inputRef}
                  placeholder="Mükellef ara (ünvan, kısaltma veya VKN)..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="h-8"
                  autoFocus
                />
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <div className="py-4 px-3 text-center text-sm text-muted-foreground">
                    {customerSearch ? "Sonuç bulunamadı" : "Mükellef yok"}
                  </div>
                ) : (
                  filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setCustomerSearch("");
                        setComboboxOpen(false);
                      }}
                    >
                      <Check
                        className={`h-4 w-4 shrink-0 ${
                          selectedCustomerId === c.id ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <span className="truncate">{c.kisaltma || c.unvan}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({c.vknTckn})
                      </span>
                      {!c.hasGibCredentials && (
                        <span className="text-xs text-destructive shrink-0">GİB eksik</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Dönem Seçimi */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Başlangıç */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Başlangıç</label>
              <div className="flex gap-2">
                <Select value={basAy} onValueChange={setBasAy} disabled={isLoading}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS_TR.map((name, i) => (
                      <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={basYil} onValueChange={setBasYil} disabled={isLoading}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Ayırıcı */}
            <div className="hidden sm:flex h-9 items-center">
              <span className="text-muted-foreground text-lg">|</span>
            </div>
            {/* Bitiş */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Bitiş</label>
              <div className="flex gap-2">
                <Select value={bitAy} onValueChange={setBitAy} disabled={isLoading}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS_TR.map((name, i) => (
                      <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={bitYil} onValueChange={setBitYil} disabled={isLoading}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Butonlar */}
            <div className="flex items-end gap-2">
              <Button onClick={handleQuery} disabled={isLoading || !selectedCustomerId || !selectedCustomer?.hasGibCredentials}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sorgulanıyor...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Sorgula
                  </>
                )}
              </Button>
              {tahsilatlar.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportToExcel(filteredTahsilatlar, selectedCustomer?.kisaltma || selectedCustomer?.unvan || "mukellef")
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportToPdf(
                        filteredTahsilatlar,
                        selectedCustomer?.kisaltma || selectedCustomer?.unvan || "mukellef",
                        meta
                      )
                    }
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                  <Button variant="ghost" onClick={handleClear}>
                    <X className="mr-2 h-4 w-4" />
                    Temizle
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ana içerik alanı */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">

      {/* GİB bilgileri eksik uyarısı */}
      {selectedCustomer && !selectedCustomer.hasGibCredentials && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-2">
            {selectedCustomer.kisaltma || selectedCustomer.unvan} için GİB Dijital Vergi Dairesi bilgileri eksik.
            <a
              href="/dashboard/sifreler"
              className="inline-flex items-center gap-1 underline hover:no-underline"
            >
              Şifreler sayfasından girin
              <ExternalLink className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>
      )}

      {/* İlerleme Durumu */}
      {isLoading && progress.status && (
        <div className="flex items-center gap-2 rounded-lg border bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
          <span>{progress.status}</span>
        </div>
      )}

      {/* Hata Mesajı */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-1 items-center justify-between gap-4">
            <span>{error}</span>
            {errorCode === "CAPTCHA_FAILED" && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={handleQuery}
                disabled={isLoading}
              >
                Tekrar Deneyin
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Meta Bilgi */}
      {meta && tahsilatlar.length > 0 && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/40 p-4 text-sm sm:grid-cols-4">
          <div>
            <span className="text-muted-foreground">Mükellef:</span>
            <div className="font-medium">{meta.adsoyadunvan}</div>
          </div>
          <div>
            <span className="text-muted-foreground">VKN/TCKN:</span>
            <div className="font-medium">{meta.vkntckn}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Vergi Dairesi:</span>
            <div className="font-medium">{meta.vergidairesi}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Toplam Tahsilat:</span>
            <div className="font-medium">{meta.toplamtahsilatsayisi} adet</div>
          </div>
        </div>
      )}

      {/* Vergi Türü Filtresi */}
      {tahsilatlar.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Vergi Türü:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setVergiTuruFilter("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                vergiTuruFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-foreground"
              }`}
            >
              Tümü ({tahsilatlar.length})
            </button>
            {vergiTurleri.map((tur) => {
              const count = tahsilatlar.filter((f) => f.vergikodu === tur).length;
              return (
                <button
                  key={tur}
                  onClick={() => setVergiTuruFilter(tur)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    vergiTuruFilter === tur
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  }`}
                >
                  {tur} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tahsilat Tablosu */}
      {filteredTahsilatlar.length > 0 && (
        <div className="rounded-lg border border-border/40 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border bg-muted/50">
                <th className="w-10 px-3 py-3"></th>
                <th className="px-3 py-3 text-left font-medium">Vergi Türü</th>
                <th className="px-3 py-3 text-left font-medium">Vergilendirme Dönemi</th>
                <th className="px-3 py-3 text-left font-medium">Ödeme Tarihi</th>
                <th className="px-3 py-3 text-left font-medium">Tahsilat Fiş No</th>
                <th className="px-3 py-3 text-left font-medium">Tahakkuk Fiş No</th>
              </tr>
            </thead>
            <tbody>
              {filteredTahsilatlar.map((fis) => (
                <TahsilatRow
                  key={fis.tahsilatoid}
                  fis={fis}
                  isExpanded={expandedRows.has(fis.tahsilatoid)}
                  onToggle={() => toggleRow(fis.tahsilatoid)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filtre sonucu boş */}
      {tahsilatlar.length > 0 && filteredTahsilatlar.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border/40 p-8 text-muted-foreground">
          <Filter className="h-10 w-10 opacity-30" />
          <p className="text-center text-sm">
            <strong>{vergiTuruFilter}</strong> türünde tahsilat bulunamadı.
          </p>
          <Button variant="outline" size="sm" onClick={() => setVergiTuruFilter("all")}>
            Filtreyi Kaldır
          </Button>
        </div>
      )}

      {/* Boş Durum */}
      {!isLoading && !error && tahsilatlar.length === 0 && meta === null && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border/40 p-12 text-muted-foreground">
          <Receipt className="h-12 w-12 opacity-30" />
          <p className="text-center">
            Mükellef seçip dönem belirledikten sonra <strong>Sorgula</strong> butonuna tıklayın.
          </p>
        </div>
      )}

      {/* Sonuç yok */}
      {!isLoading && !error && tahsilatlar.length === 0 && meta !== null && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border/40 p-12 text-muted-foreground">
          <Receipt className="h-12 w-12 opacity-30" />
          <p className="text-center">
            Seçilen dönemde tahsilat alındısı bulunamadı.
          </p>
        </div>
      )}

      </div>{/* Ana içerik sonu */}
     </div>{/* İç çerçeve sonu */}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TahsilatRow — expand/collapse detay
// ═══════════════════════════════════════════════════════════════════════════

interface TahsilatRowProps {
  fis: TahsilatFis;
  isExpanded: boolean;
  onToggle: () => void;
}

function TahsilatRow({ fis, isExpanded, onToggle }: TahsilatRowProps) {
  const hasDetail = fis.detaylar && fis.detaylar.length > 0;

  return (
    <>
      {/* Ana satır */}
      <tr
        className={`border-b border-border/70 transition-colors hover:bg-muted/50 ${hasDetail ? "cursor-pointer" : ""}`}
        onClick={hasDetail ? onToggle : undefined}
      >
        <td className="px-3 py-2.5 text-center">
          {hasDetail && (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          )}
        </td>
        <td className="px-3 py-2.5 font-medium">{fis.vergikodu}</td>
        <td className="px-3 py-2.5">{fis.vergidonem}</td>
        <td className="px-3 py-2.5">{fis.odemetarihi}</td>
        <td className="px-3 py-2.5 text-xs">{fis.thsfisno}</td>
        <td className="px-3 py-2.5 text-xs">{fis.thkfisno}</td>
      </tr>

      {/* Detay satırları */}
      {isExpanded && hasDetail && (
        <tr>
          <td colSpan={6} className="border-b-2 border-border bg-muted/30 px-3 py-0">
            <div className="py-3 pl-8">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-foreground/20">
                    <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Vergi Kodu</th>
                    <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Taksit No</th>
                    <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Ödenen</th>
                    <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Gecikme Zammı</th>
                    <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Kesinleşen GZ</th>
                  </tr>
                </thead>
                <tbody>
                  {fis.detaylar!.map((detay, idx) => (
                    <tr key={idx} className="border-b border-foreground/15">
                      <td className="px-2 py-2">{detay.detayvergikodu}</td>
                      <td className="px-2 py-2">{detay.taksitno}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(detay.thsodenen)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(detay.thsgzammi)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(detay.thskesinlesengz)}</td>
                    </tr>
                  ))}
                  {fis.toplam && (
                    <tr className="border-t-2 border-foreground/25 font-semibold">
                      <td className="px-2 py-2" colSpan={2}>TOPLAM</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(fis.toplam.toplamodenen)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(fis.toplam.toplamgzammi)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(fis.toplam.toplamkesinlesengz)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
