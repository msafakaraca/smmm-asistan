/**
 * E-Defter Kontrol Sayfası
 * =========================
 * Mükellef seçimi + yıl/ay aralığı ile e-defter paket yükleme durumlarını kontrol eder.
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { BookCheck, Loader2, AlertTriangle, ExternalLink, ChevronsUpDown, Check, CheckCircle2, XCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEdefterQuery } from "./hooks/use-edefter-query";
import type { EdefterAySonuc } from "./hooks/use-edefter-query";

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

const AY_ADLARI = [
  "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const YILLAR = (() => {
  const suAnkiYil = new Date().getFullYear();
  const yillar: number[] = [];
  for (let y = suAnkiYil; y >= suAnkiYil - 5; y--) {
    yillar.push(y);
  }
  return yillar;
})();

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function EdefterKontrolPage() {
  // Müşteri listesi
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtreler
  const currentYear = new Date().getFullYear();
  const [yil, setYil] = useState<number>(currentYear);
  const [basAy, setBasAy] = useState<number>(1);
  const [bitAy, setBitAy] = useState<number>(12);

  // E-Defter sorgu hook'u
  const {
    aylar,
    isLoading,
    progress,
    error,
    errorCode,
    tamamlanan,
    eksik,
    kismenEksik,
    startQuery,
    clearResults,
  } = useEdefterQuery();

  // Müşteri listesini yükle
  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch("/api/customers?fields=minimal");
        if (res.ok) {
          const data = await res.json();
          setCustomers(data);
        }
      } catch {
        console.error("Müşteri listesi yüklenemedi");
      } finally {
        setCustomersLoading(false);
      }
    }
    loadCustomers();
  }, []);

  // Filtrelenmiş müşteri listesi
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.unvan.toLowerCase().includes(q) ||
        (c.kisaltma && c.kisaltma.toLowerCase().includes(q)) ||
        c.vknTckn.includes(q)
    );
  }, [customers, customerSearch]);

  // Seçili müşteri
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const hasGibCredentials = selectedCustomer?.hasGibCredentials;

  // Sorgulama
  const handleQuery = useCallback(async () => {
    if (!selectedCustomerId || isLoading) return;
    clearResults();
    await startQuery(selectedCustomerId, yil, basAy, bitAy);
  }, [selectedCustomerId, isLoading, yil, basAy, bitAy, startQuery, clearResults]);

  // Sorgu yapılmış mı
  const hasQueried = aylar.length > 0 || error !== null;

  // PDF indirme — jsPDF + autotable ile doğrudan dosya indir
  const handleDownloadPdf = useCallback(async () => {
    if (aylar.length === 0) return;

    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const mukellefAdi = selectedCustomer?.kisaltma || selectedCustomer?.unvan || "Mükellef";
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

    // Başlık
    doc.setFontSize(16);
    doc.setFont("Roboto", "bold");
    doc.text("E-Defter Kontrol Raporu", 14, 18);

    // Alt başlık
    doc.setFontSize(11);
    doc.setFont("Roboto", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(`${mukellefAdi} — ${yil} (${AY_ADLARI[basAy]} - ${AY_ADLARI[bitAy]})`, 14, 26);

    // Özet
    doc.setFontSize(10);
    doc.setTextColor(22, 163, 74);
    doc.text(`Tamam: ${tamamlanan}`, 14, 34);
    doc.setTextColor(220, 38, 38);
    doc.text(`Eksik: ${eksik}`, 60, 34);
    doc.setTextColor(0, 0, 0);

    // Tablo verileri
    const tableRows = aylar.map((ay) => {
      const durum = ay.tamam ? "Tamam" : (ay.kbYuklendi || ay.ybYuklendi || ay.yYuklendi) ? "Kısmen" : "Eksik";
      return [
        `${AY_ADLARI[ay.ay]} ${ay.yil}`,
        ay.kbYuklendi ? "Evet" : "Hayır",
        ay.ybYuklendi ? "Evet" : "Hayır",
        ay.yYuklendi ? "Evet" : "Hayır",
        ay.yuklemeTarihi || "-",
        durum,
      ];
    });

    // A4 landscape: 297mm genişlik, 210mm yükseklik
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const tableWidth = pageWidth - marginX * 2;
    const colWidth = tableWidth / 6;

    // Tabloyu sayfanın tamamına yayacak şekilde satır yüksekliğini hesapla
    const tableStartY = 40;
    const footerY = pageHeight - 10;
    const availableHeight = footerY - tableStartY;
    const totalRows = tableRows.length + 1; // +1 header
    const rowHeight = availableHeight / totalRows;
    // cellPadding dikey = (rowHeight - fontSize*0.35) / 2 — yaklaşık hesap
    const verticalPadding = Math.max(2, (rowHeight - 9 * 0.35) / 2 - 1);

    autoTable(doc, {
      startY: tableStartY,
      margin: { left: marginX, right: marginX },
      tableWidth: tableWidth,
      head: [["Ay", "Büyük Defter Beratı", "Yevmiye Beratı", "Yevmiye", "Yükleme Tarihi", "Durum"]],
      body: tableRows,
      styles: {
        font: "Roboto",
        fontSize: 9,
        cellPadding: { top: verticalPadding, right: 3, bottom: verticalPadding, left: 3 },
        halign: "center",
        valign: "middle",
        lineWidth: 0.3,
        lineColor: [209, 213, 219],
      },
      headStyles: {
        fillColor: [31, 41, 55],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9.5,
        lineWidth: 0.3,
        lineColor: [31, 41, 55],
      },
      columnStyles: {
        0: { cellWidth: colWidth },
        1: { cellWidth: colWidth },
        2: { cellWidth: colWidth },
        3: { cellWidth: colWidth },
        4: { cellWidth: colWidth },
        5: { cellWidth: colWidth },
      },
      didParseCell: (data) => {
        if (data.section === "body") {
          const durum = (data.row.raw as string[])?.[5] as string | undefined;

          // Satır arka plan rengi
          if (durum === "Tamam") {
            data.cell.styles.fillColor = [240, 253, 244];
          } else if (durum === "Kısmen") {
            data.cell.styles.fillColor = [255, 251, 235];
          } else if (durum === "Eksik") {
            data.cell.styles.fillColor = [254, 242, 242];
          }

          // Durum kolonu rengi
          if (data.column.index === 5) {
            data.cell.styles.fontStyle = "bold";
            if (durum === "Tamam") data.cell.styles.textColor = [22, 163, 74];
            else if (durum === "Kısmen") data.cell.styles.textColor = [217, 119, 6];
            else if (durum === "Eksik") data.cell.styles.textColor = [220, 38, 38];
          }

          // Evet/Hayır renklendirme
          if (data.column.index >= 1 && data.column.index <= 3) {
            const val = data.cell.raw as string;
            if (val === "Evet") data.cell.styles.textColor = [22, 163, 74];
            else if (val === "Hayır") data.cell.styles.textColor = [220, 38, 38];
          }

          // Ay kolonu bold
          if (data.column.index === 0) {
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.setFont("Roboto", "normal");
    doc.text(
      `Oluşturulma: ${new Date().toLocaleDateString("tr-TR")} ${new Date().toLocaleTimeString("tr-TR")} — SMMM Asistan`,
      pageWidth - marginX,
      pageHeight - 5,
      { align: "right" }
    );

    // Dosya olarak indir
    doc.save(`E-Defter-Kontrol_${mukellefAdi}_${yil}.pdf`);
  }, [aylar, selectedCustomer, yil, basAy, bitAy, tamamlanan, eksik]);

  return (
    <div className="flex flex-col h-full p-1">
     <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border/60 bg-card/50 shadow-sm overflow-hidden">
      {/* Başlık */}
      <div className="flex items-center gap-3 px-6 py-4 border-b">
        <BookCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">E-Defter Kontrol</h1>
          <p className="text-sm text-muted-foreground">
            GİB E-Defter portalından paket yükleme durumlarını kontrol edin
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-3 px-6 py-3 border-b">
        {/* Mükellef Seçimi */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
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
          </div>
        </div>

        {/* Yıl + Ay Aralığı + Sorgula */}
        <div className="flex items-center gap-3">
          {/* Yıl */}
          <Select
            value={String(yil)}
            onValueChange={(v) => setYil(Number(v))}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[110px] h-9">
              <SelectValue placeholder="Yıl" />
            </SelectTrigger>
            <SelectContent>
              {YILLAR.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Başlangıç Ay */}
          <Select
            value={String(basAy)}
            onValueChange={(v) => {
              const newVal = Number(v);
              setBasAy(newVal);
              if (newVal > bitAy) setBitAy(newVal);
            }}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Başlangıç" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {AY_ADLARI[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground">—</span>

          {/* Bitiş Ay */}
          <Select
            value={String(bitAy)}
            onValueChange={(v) => setBitAy(Number(v))}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Bitiş" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1)
                .filter((m) => m >= basAy)
                .map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {AY_ADLARI[m]}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {/* Sorgula butonu */}
          <Button
            onClick={handleQuery}
            disabled={!selectedCustomerId || isLoading || !hasGibCredentials}
            className="h-9"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sorgulanıyor...
              </>
            ) : (
              <>
                <BookCheck className="h-4 w-4 mr-2" />
                Sorgula
              </>
            )}
          </Button>

          {/* PDF İndir butonu — sonuç varsa göster */}
          {aylar.length > 0 && (
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              className="h-9"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
          )}
        </div>
      </div>

      {/* İçerik alanı */}
      <div className="flex-1 overflow-auto p-6 space-y-4">

      {/* GİB bilgileri eksik uyarısı */}
      {selectedCustomer && !hasGibCredentials && (
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

      {/* Progress */}
      {isLoading && progress.status && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {progress.status}
          </span>
        </div>
      )}

      {/* Hata mesajı */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
            {errorCode === "AUTH_FAILED" && (
              <span className="ml-2">
                <a
                  href="/dashboard/sifreler"
                  className="inline-flex items-center gap-1 underline hover:no-underline"
                >
                  Şifreler sayfasından GİB bilgilerini güncelleyin
                  <ExternalLink className="h-3 w-3" />
                </a>
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Özet kartlar (sorgulama sonrası) */}
      {hasQueried && !isLoading && !error && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border border-border/60 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Tamam</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{tamamlanan}</p>
          </div>
          <div className="p-4 border border-border/60 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-muted-foreground">Eksik</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{eksik}</p>
          </div>
        </div>
      )}

      {/* Sonuç Tablosu */}
      {aylar.length > 0 && (
        <div className="border border-border/60 rounded-lg overflow-hidden">
          {/* Tablo başlığı */}
          <div className="px-4 py-3 border-b bg-muted/30">
            <span className="text-sm font-medium text-muted-foreground">
              {selectedCustomer?.kisaltma || selectedCustomer?.unvan} — {yil} E-Defter Durumu
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Ay</th>
                  <th className="text-center px-4 py-3 font-medium">Büyük Defter Beratı</th>
                  <th className="text-center px-4 py-3 font-medium">Yevmiye Beratı</th>
                  <th className="text-center px-4 py-3 font-medium">Yevmiye</th>
                  <th className="text-center px-4 py-3 font-medium">Yükleme Tarihi</th>
                  <th className="text-center px-4 py-3 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {aylar.map((ay) => (
                  <AyRow key={ay.donem} ay={ay} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Boş sonuç */}
      {!isLoading && aylar.length === 0 && hasQueried && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <BookCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Sonuç bulunamadı</p>
          <p className="text-sm">
            Belirtilen dönemde e-Defter bilgisi bulunmamaktadır
          </p>
        </div>
      )}

      </div>
     </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Alt Bileşenler
// ═══════════════════════════════════════════════════════════════════════════

function AyRow({ ay }: { ay: EdefterAySonuc }) {
  // Arka plan rengi
  let rowClass = "";
  if (ay.tamam) {
    rowClass = "bg-green-50 dark:bg-green-950/20";
  } else if (ay.kbYuklendi || ay.ybYuklendi || ay.yYuklendi) {
    rowClass = "bg-amber-50 dark:bg-amber-950/20";
  } else {
    rowClass = "bg-red-50 dark:bg-red-950/20";
  }

  // Durum etiketi
  let durumLabel: string;
  let durumClass: string;
  if (ay.tamam) {
    durumLabel = "Tamam";
    durumClass = "text-green-700 dark:text-green-400 font-medium";
  } else if (ay.kbYuklendi || ay.ybYuklendi || ay.yYuklendi) {
    durumLabel = "Kısmen";
    durumClass = "text-amber-700 dark:text-amber-400 font-medium";
  } else {
    durumLabel = "Eksik";
    durumClass = "text-red-700 dark:text-red-400 font-medium";
  }

  return (
    <tr className={`border-b last:border-b-0 ${rowClass}`}>
      <td className="px-4 py-2.5 font-medium">
        {AY_ADLARI[ay.ay]} {ay.yil}
      </td>
      <td className="text-center px-4 py-2.5">
        <PaketDurum yuklendi={ay.kbYuklendi} />
      </td>
      <td className="text-center px-4 py-2.5">
        <PaketDurum yuklendi={ay.ybYuklendi} />
      </td>
      <td className="text-center px-4 py-2.5">
        <PaketDurum yuklendi={ay.yYuklendi} />
      </td>
      <td className="text-center px-4 py-2.5 text-muted-foreground">
        {ay.yuklemeTarihi || "-"}
      </td>
      <td className={`text-center px-4 py-2.5 ${durumClass}`}>
        {durumLabel}
      </td>
    </tr>
  );
}

function PaketDurum({ yuklendi }: { yuklendi: boolean }) {
  if (yuklendi) {
    return <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />;
  }
  return <XCircle className="h-5 w-5 text-red-400 mx-auto" />;
}
