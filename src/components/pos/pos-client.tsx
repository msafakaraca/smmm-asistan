/**
 * POS Sorgulama Client Component
 * ===============================
 * Mükellef seçimi, dönem seçimi, POS bilgileri sorgulama ve sonuç tablosu.
 * Tek düz tablo — expandable satır yok.
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  CreditCard,
  Loader2,
  AlertTriangle,
  Search,
  Download,
  FileText,
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
import { usePosQuery } from "./hooks/use-pos-query";
import type { PosBilgisi, PosMeta } from "./hooks/use-pos-query";
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
    ay: String(previousMonth).padStart(2, "0"),
    yil: String(previousYear),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Excel Export
// ═══════════════════════════════════════════════════════════════════════════

function exportToExcel(posBilgileri: PosBilgisi[], customerName: string, meta: PosMeta | null) {
  if (posBilgileri.length === 0) {
    toast.error("Dışa aktarılacak veri yok");
    return;
  }

  const rows: string[][] = [
    ["#", "Banka Adı", "Banka VKN", "Üye İşyeri No", "Tutar (TL)"],
  ];

  for (let i = 0; i < posBilgileri.length; i++) {
    const pos = posBilgileri[i];
    rows.push([
      String(i + 1),
      pos.pos_banka_adi,
      pos.pos_banka_vkn,
      pos.pos_uye_isy,
      pos.toplam,
    ]);
  }

  // Toplam satırı
  if (meta?.toplamGenel) {
    rows.push(["", "", "", "TOPLAM", meta.toplamGenel]);
  }

  // CSV oluştur (Excel uyumlu BOM)
  const BOM = "\uFEFF";
  const csv = BOM + rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pos-bilgileri-${customerName.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("POS bilgileri dışa aktarıldı");
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF Export
// ═══════════════════════════════════════════════════════════════════════════

async function exportToPdf(
  posBilgileri: PosBilgisi[],
  customerName: string,
  meta: PosMeta | null
) {
  if (posBilgileri.length === 0) {
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
    doc.setFont("helvetica");
  }

  // Başlık
  doc.setFontSize(14);
  doc.text("POS Satış Bilgileri", 14, 15);

  // Meta bilgileri
  doc.setFontSize(9);
  doc.text(`Mükellef: ${customerName}`, 14, 22);
  if (meta) {
    const ayAdi = MONTHS_TR[parseInt(meta.ay, 10) - 1] || meta.ay;
    doc.text(`Dönem: ${ayAdi} ${meta.yil}`, 14, 27);
    doc.text(`Toplam POS Kaydı: ${meta.posListeSize}`, 140, 22);
    doc.text(`Genel Toplam: ${meta.toplamGenel} TL`, 140, 27);
  }

  // Tablo verileri
  const headRow = ["#", "Banka Adı", "Banka VKN", "Üye İşyeri No", "Tutar (TL)"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bodyRows: any[][] = posBilgileri.map((pos, i) => [
    String(i + 1),
    pos.pos_banka_adi,
    pos.pos_banka_vkn,
    pos.pos_uye_isy,
    formatCurrency(pos.toplam),
  ]);

  // Toplam satırı
  if (meta?.toplamGenel) {
    bodyRows.push(["", "", "", "TOPLAM", formatCurrency(meta.toplamGenel)]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autoTable(doc, {
    head: [headRow],
    body: bodyRows,
    startY: 32,
    theme: "grid",
    margin: { left: 14, right: 14 },
    styles: {
      font: "Roboto",
      fontSize: 8,
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: 0.2,
    },
    headStyles: {
      font: "Roboto",
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    tableWidth: "auto",
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { halign: "left" },
      2: { cellWidth: 40, halign: "center" },
      3: { cellWidth: 45, halign: "center" },
      4: { cellWidth: 50, halign: "right" },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didParseCell(data: any) {
      if (data.section !== "body") return;
      // Son satır (TOPLAM)
      if (data.row.index === bodyRows.length - 1 && meta?.toplamGenel) {
        data.cell.styles.fillColor = [230, 236, 240];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = [30, 30, 30];
      }
    },
  } as never);

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
  doc.save(`POS_Bilgileri_${safeName}.pdf`);
  toast.success("PDF olarak indirildi");
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function PosClient() {
  // Mükellef listesi
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dönem
  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);
  const [ay, setAy] = useState(defaultPeriod.ay);
  const [yil, setYil] = useState(defaultPeriod.yil);

  // Hook
  const {
    posBilgileri,
    meta,
    isLoading,
    progress,
    error,
    errorCode,
    startQuery,
    clearResults,
  } = usePosQuery();

  // Mükellef listesi yükle
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

    await startQuery(selectedCustomerId, ay, yil);
  }, [selectedCustomerId, selectedCustomer, ay, yil, startQuery]);

  // Temizle
  const handleClear = useCallback(() => {
    clearResults();
  }, [clearResults]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">POS Sorgulama</h1>
      </div>

      {/* Filtreler */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          {/* Mükellef Seçimi — Combobox */}
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

          {/* Dönem Seçimi — Tek ay/yıl */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Dönem</label>
              <div className="flex gap-2">
                <Select value={ay} onValueChange={setAy} disabled={isLoading}>
                  <SelectTrigger className="w-[120px]">
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
                <Select value={yil} onValueChange={setYil} disabled={isLoading}>
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
              {posBilgileri.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportToExcel(posBilgileri, selectedCustomer?.kisaltma || selectedCustomer?.unvan || "mukellef", meta)
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportToPdf(
                        posBilgileri,
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

      {/* Sonuç Tablosu */}
      {posBilgileri.length > 0 && (
        <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border bg-muted/50">
                <th className="w-12 px-3 py-3 text-center font-medium">#</th>
                <th className="px-3 py-3 text-left font-medium max-w-[280px]">Banka Adı</th>
                <th className="px-3 py-3 text-left font-medium">Banka VKN</th>
                <th className="px-3 py-3 text-left font-medium">Üye İşyeri No</th>
                <th className="px-3 py-3 text-right font-medium">Tutar (TL)</th>
              </tr>
            </thead>
            <tbody>
              {posBilgileri.map((pos, index) => (
                <tr key={`${pos.pos_banka_vkn}-${pos.pos_uye_isy}-${index}`} className="border-b border-border/70 transition-colors hover:bg-muted/50">
                  <td className="px-3 py-2.5 text-center text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-2.5 font-medium max-w-[280px] truncate">{pos.pos_banka_adi}</td>
                  <td className="px-3 py-2.5">{pos.pos_banka_vkn}</td>
                  <td className="px-3 py-2.5">{pos.pos_uye_isy}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(pos.toplam)}</td>
                </tr>
              ))}
              {/* Toplam Satırı */}
              {meta?.toplamGenel && (
                <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                  <td className="px-3 py-3" colSpan={4}>
                    <span className="text-muted-foreground">TOPLAM</span>
                    {meta.posListeSize > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({meta.posListeSize} kayıt)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">{formatCurrency(meta.toplamGenel)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Sonuç yok — POS verisi gelmemiş */}
      {!isLoading && !error && posBilgileri.length === 0 && meta !== null && (
        <Alert>
          <CreditCard className="h-4 w-4" />
          <AlertDescription>
            Bu dönem için POS bilgisi GİB tarafından henüz gelmemiştir.
          </AlertDescription>
        </Alert>
      )}

      {/* Boş Durum — henüz sorgu yapılmadı */}
      {!isLoading && !error && posBilgileri.length === 0 && meta === null && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-card p-12 text-muted-foreground">
          <CreditCard className="h-12 w-12 opacity-30" />
          <p className="text-center">
            Mükellef seçip dönem belirledikten sonra <strong>Sorgula</strong> butonuna tıklayın.
          </p>
          <p className="text-center text-xs">
            POS (kredi kartı) satış bilgileri GİB İnternet Vergi Dairesi üzerinden sorgulanır.
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function formatCurrency(value: string): string {
  // GİB formatında gelen değer: "1.663.058,63" veya "7.070,00"
  // Önce Türkçe format mı kontrol et
  if (value.includes(",")) {
    // Zaten Türkçe formatlı — direkt döndür
    return value;
  }
  // Sayısal değer — formatla
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
