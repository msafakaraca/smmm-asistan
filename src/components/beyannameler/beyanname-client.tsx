/**
 * Beyanname Sorgulama Client Component
 * =====================================
 * Mükellef seçimi, dönem seçimi, sorgulama ve beyanname tablosu.
 * GİB İnternet Vergi Dairesi üzerinden beyanname listesi görüntüleme.
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  ScrollText,
  Loader2,
  AlertTriangle,
  Search,
  Download,
  X,
  ExternalLink,
  ChevronsUpDown,
  Check,
  FileDown,
  Archive,
} from "lucide-react";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import { useBeyannameQuery } from "./hooks/use-beyanname-query";
import type { BeyannameItem } from "./hooks/use-beyanname-query";
import BeyannameGroupList from "./beyanname-group-list";
import { useQueryArchives, type OverlapInfo } from "@/components/query-archive/hooks/use-query-archives";
import ArchiveOverlapDialog from "@/components/query-archive/archive-overlap-dialog";
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

const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

/** Dönem formatı: "202501202503" → "01/2025-03/2025", "202501" → "01/2025-01/2025" */
function formatDonemSlash(donem: string): string {
  if (!donem) return "";
  if (donem.length === 12) {
    const basAy = donem.substring(4, 6);
    const basYil = donem.substring(0, 4);
    const bitAy = donem.substring(10, 12);
    const bitYil = donem.substring(6, 10);
    return `${basAy}/${basYil}-${bitAy}/${bitYil}`;
  }
  if (donem.length === 6) {
    const ay = donem.substring(4, 6);
    const yil = donem.substring(0, 4);
    return `${ay}/${yil}-${ay}/${yil}`;
  }
  return donem;
}

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

function exportToExcel(beyannameler: BeyannameItem[], customerName: string) {
  if (beyannameler.length === 0) {
    toast.error("Dışa aktarılacak veri yok");
    return;
  }

  const rows: string[][] = [
    ["Beyanname Türü", "Dönem", "Açıklama"],
  ];

  for (const b of beyannameler) {
    rows.push([
      `${b.turKodu}_${b.versiyon}`,
      formatDonemSlash(b.donem),
      b.aciklama,
    ]);
  }

  // CSV oluştur (Excel uyumlu BOM)
  const BOM = "\uFEFF";
  const csv = BOM + rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `beyannameler-${customerName.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Beyanname listesi dışa aktarıldı");
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF Export (Tablo yazdırma)
// ═══════════════════════════════════════════════════════════════════════════

function exportToPdf(beyannameler: BeyannameItem[], customerName: string, sorguDonemi: string) {
  if (beyannameler.length === 0) {
    toast.error("Dışa aktarılacak veri yok");
    return;
  }

  const rows = beyannameler
    .map(
      (b) =>
        `<tr>
          <td>${b.turKodu}_${b.versiyon}</td>
          <td style="text-align:center">${formatDonemSlash(b.donem)}</td>
          <td>${b.aciklama || ""}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Beyanname Listesi - ${customerName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;padding:24px;color:#1a1a1a}
  h1{font-size:16px;margin-bottom:4px}
  .info{font-size:12px;color:#666;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#f3f4f6;font-weight:700;text-align:left;padding:6px 10px;border:1px solid #d1d5db}
  td{padding:5px 10px;border:1px solid #d1d5db}
  tr:nth-child(even){background:#f9fafb}
  .footer{margin-top:16px;font-size:10px;color:#999;text-align:right}
  @media print{body{padding:12px}@page{margin:12mm}}
</style></head><body>
<h1>Beyanname Listesi</h1>
<div class="info">${customerName} &mdash; Sorgulama Dönemi: ${sorguDonemi} &mdash; ${beyannameler.length} adet beyanname &mdash; ${new Date().toLocaleDateString("tr-TR")}</div>
<table>
  <thead><tr>
    <th>Beyanname Türü</th>
    <th style="text-align:center">Vergilendirme Dönemi</th>
    <th>Düzeltme Gerekçesi</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">SMMM Asistan &mdash; ${new Date().toLocaleString("tr-TR")}</div>
</body></html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("Popup engellendi. Lütfen tarayıcı ayarlarından izin verin.");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
  toast.success("PDF yazdırma penceresi açıldı");
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function BeyannameClient() {
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

  // Hook
  const {
    beyannameler,
    isLoading,
    progress,
    error,
    errorCode,
    queryDone,
    isFromArchive,
    pdfLoading,
    multiQueryProgress,
    startQuery,
    clearResults,
    viewPdf,
    showArchiveData,
  } = useBeyannameQuery();

  // Arşiv overlap state
  const [overlapOpen, setOverlapOpen] = useState(false);
  const [overlapInfo, setOverlapInfo] = useState<OverlapInfo | null>(null);
  const { checkOverlap, loadArchiveDetail } = useQueryArchives();

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

  // Yıl filtresi
  const [yearFilter, setYearFilter] = useState<string>("all");

  // Benzersiz yıllar + adetleri (büyükten küçüğe)
  const availableYears = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of beyannameler) {
      if (b.donem && b.donem.length >= 4) {
        const y = b.donem.substring(0, 4);
        counts.set(y, (counts.get(y) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, count]) => ({ year, count }));
  }, [beyannameler]);

  // Yıl filtresine göre filtrelenmiş beyannameler
  const filteredBeyannameler = useMemo(() => {
    if (yearFilter === "all") return beyannameler;
    return beyannameler.filter(
      (b) => b.donem && b.donem.length >= 4 && b.donem.substring(0, 4) === yearFilter
    );
  }, [beyannameler, yearFilter]);

  // Çoklu yıl tespiti
  const isMultiYear = basYil !== bitYil;

  // Sorgula (overlap kontrolü ile)
  const handleQuery = useCallback(async () => {
    if (!selectedCustomerId) {
      toast.error("Lütfen bir mükellef seçin");
      return;
    }

    if (!selectedCustomer?.hasGibCredentials) {
      toast.error("Seçili mükellefin GİB bilgileri eksik. Şifreler sayfasından GİB kullanıcı adı ve şifresini girin.");
      return;
    }

    // Başlangıç > Bitiş validasyonu
    const basYilNum = parseInt(basYil, 10);
    const bitYilNum = parseInt(bitYil, 10);
    const basAyNum = parseInt(basAy, 10);
    const bitAyNum = parseInt(bitAy, 10);
    if (basYilNum > bitYilNum || (basYilNum === bitYilNum && basAyNum > bitAyNum)) {
      toast.error("Başlangıç tarihi bitiş tarihinden büyük olamaz");
      return;
    }

    // Bitiş ayı için overlap kontrolü
    const month = parseInt(bitAy, 10);
    const year = parseInt(bitYil, 10);
    const overlap = await checkOverlap("beyanname", selectedCustomerId, month, year);
    if (overlap.hasOverlap) {
      setOverlapInfo({
        ...overlap,
        customerName: selectedCustomer?.kisaltma || selectedCustomer?.unvan || "",
      });
      setOverlapOpen(true);
      return;
    }

    await startQuery(selectedCustomerId, basAy, basYil, bitAy, bitYil);
  }, [selectedCustomerId, selectedCustomer, basAy, basYil, bitAy, bitYil, startQuery, checkOverlap]);

  // Arşivden göster (overlap dialog'dan)
  const handleShowFromArchive = useCallback(async () => {
    if (!overlapInfo?.archiveId) return;
    setOverlapOpen(false);
    const detail = await loadArchiveDetail(overlapInfo.archiveId);
    if (detail) {
      showArchiveData(detail.resultData);
    } else {
      toast.error("Arşiv verisi yüklenemedi");
    }
    setOverlapInfo(null);
  }, [overlapInfo, loadArchiveDetail, showArchiveData]);

  // Yeniden sorgula (overlap dialog'dan)
  const handleRequery = useCallback(async () => {
    setOverlapOpen(false);
    setOverlapInfo(null);
    await startQuery(selectedCustomerId, basAy, basYil, bitAy, bitYil);
  }, [selectedCustomerId, basAy, basYil, bitAy, bitYil, startQuery]);

  // Temizle
  const handleClear = useCallback(() => {
    clearResults();
    setYearFilter("all");
  }, [clearResults]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <ScrollText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Beyanname Sorgulama</h1>
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
              <Link href="/dashboard/beyannameler/arsiv">
                <Button variant="outline">
                  <Archive className="mr-2 h-4 w-4" />
                  Arşiv
                </Button>
              </Link>
              {beyannameler.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportToExcel(beyannameler, selectedCustomer?.kisaltma || selectedCustomer?.unvan || "mukellef")
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const sorguDonemi = `${MONTHS_TR[parseInt(basAy) - 1]} ${basYil} - ${MONTHS_TR[parseInt(bitAy) - 1]} ${bitYil}`;
                      exportToPdf(beyannameler, selectedCustomer?.kisaltma || selectedCustomer?.unvan || "mukellef", sorguDonemi);
                    }}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
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

      {/* Yıl Filtresi */}
      {beyannameler.length > 0 && availableYears.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setYearFilter("all")}
            className={`text-sm font-bold px-4 py-1.5 rounded-md border transition-colors ${
              yearFilter === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-foreground hover:bg-muted"
            }`}
          >
            Tümü ({beyannameler.length})
          </button>
          {availableYears.map(({ year, count }) => (
            <button
              key={year}
              type="button"
              onClick={() => setYearFilter(year)}
              className={`text-sm font-bold px-4 py-1.5 rounded-md border transition-colors ${
                yearFilter === year
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              {year} ({count})
            </button>
          ))}
        </div>
      )}

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

      {/* Çoklu Yıl Uyarı Banner */}
      {isMultiYear && !isLoading && !queryDone && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            Çoklu yıl sorgulaması: {MONTHS_TR[parseInt(basAy) - 1]} {basYil} - {MONTHS_TR[parseInt(bitAy) - 1]} {bitYil} arasındaki beyannameler yıl bazında sırasıyla sorgulanacak.
          </span>
        </div>
      )}

      {/* İlerleme Durumu — Tek Yıl */}
      {isLoading && progress.status && !multiQueryProgress && (
        <div className="flex items-center gap-2 rounded-lg border bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
          <span>{progress.status}</span>
        </div>
      )}

      {/* İlerleme Durumu — Çoklu Yıl */}
      {isLoading && multiQueryProgress && (
        <div className="rounded-lg border bg-blue-50 p-4 dark:bg-blue-950/30">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium text-blue-700 dark:text-blue-300">
            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
            <span>
              Beyanname Sorgulanıyor ({multiQueryProgress.completedYears.length + 1}/{multiQueryProgress.totalChunks})
            </span>
          </div>
          {/* İlerleme çubuğu */}
          <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2 mb-3">
            <div
              className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${Math.round(((multiQueryProgress.completedYears.length) / multiQueryProgress.totalChunks) * 100)}%`,
              }}
            />
          </div>
          {/* Yıl bazlı durum listesi */}
          <div className="space-y-1">
            {Array.from({ length: multiQueryProgress.totalChunks }, (_, i) => {
              const startYear = parseInt(basYil, 10);
              const year = String(startYear + i);
              const completed = multiQueryProgress.completedYears.find(cy => cy.year === year);
              const isCurrent = multiQueryProgress.currentYear === year && !completed;

              return (
                <div key={year} className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                  {completed ? (
                    <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-blue-300 dark:border-blue-600 flex-shrink-0" />
                  )}
                  <span className={completed ? "text-green-700 dark:text-green-400" : ""}>
                    {year}
                    {completed && `: ${completed.count} beyanname bulundu`}
                    {isCurrent && ": Sorgulanıyor..."}
                    {!completed && !isCurrent && ": Bekliyor"}
                  </span>
                </div>
              );
            })}
          </div>
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

      {/* Arşiv Badge */}
      {isFromArchive && beyannameler.length > 0 && (
        <Badge variant="secondary" className="gap-1 w-fit">
          <Archive className="h-3 w-3" />
          Arşivden gösteriliyor
        </Badge>
      )}

      {/* Beyanname Grup Listesi */}
      {beyannameler.length > 0 && (
        <BeyannameGroupList
          beyannameler={filteredBeyannameler}
          pdfLoading={pdfLoading}
          onViewPdf={(beyoid: string) => {
            if (selectedCustomerId) {
              const item = beyannameler.find((b) => b.beyoid === beyoid);
              viewPdf(selectedCustomerId, beyoid, item ? `${item.turAdi} - ${formatDonemSlash(item.donem)}` : "Beyanname");
            }
          }}
          selectedCustomerId={selectedCustomerId}
        />
      )}

      {/* Boş Durum */}
      {!isLoading && !error && beyannameler.length === 0 && !queryDone && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-card p-12 text-muted-foreground">
          <ScrollText className="h-12 w-12 opacity-30" />
          <p className="text-center">
            Mükellef seçip dönem belirledikten sonra <strong>Sorgula</strong> butonuna tıklayın.
          </p>
        </div>
      )}

      {/* Sonuç yok */}
      {!isLoading && !error && beyannameler.length === 0 && queryDone && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-card p-12 text-muted-foreground">
          <ScrollText className="h-12 w-12 opacity-30" />
          <p className="text-center">
            Seçilen dönemde beyanname bulunamadı.
          </p>
        </div>
      )}

      {/* Arşiv Overlap Dialog */}
      <ArchiveOverlapDialog
        open={overlapOpen}
        onOpenChange={setOverlapOpen}
        overlapInfo={
          overlapInfo?.hasOverlap
            ? {
                month: overlapInfo.month!,
                year: overlapInfo.year!,
                totalCount: overlapInfo.totalCount!,
                lastQueriedAt: overlapInfo.lastQueriedAt!,
                customerName: overlapInfo.customerName!,
                archiveId: overlapInfo.archiveId!,
              }
            : null
        }
        onShowArchive={handleShowFromArchive}
        onRequery={handleRequery}
      />
    </div>
  );
}
