/**
 * SGK E-Bildirge Sorgulama Client Component
 * ==========================================
 * Mükellef seçimi, dönem seçimi, sorgulama ve bildirge tablosu.
 * SGK E-Bildirge V2 üzerinden onaylı bildirge listesi görüntüleme.
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  Building2,
  Loader2,
  AlertTriangle,
  Search,
  Download,
  X,
  ExternalLink,
  ChevronsUpDown,
  Check,
  FileDown,
  FileText,
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
import { Badge } from "@/components/ui/badge";
import { useSgkQuery } from "./hooks/use-sgk-query";
import type { BildirgeItem, IsyeriInfo } from "./hooks/use-sgk-query";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface Customer {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  hasSgkCredentials: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Sabitler
// ═══════════════════════════════════════════════════════════════════════════

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

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
    basAy: String(previousMonth).padStart(2, "0"),
    basYil: String(previousYear),
    bitAy: String(previousMonth).padStart(2, "0"),
    bitYil: String(previousYear),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Excel Export
// ═══════════════════════════════════════════════════════════════════════════

function exportToExcel(bildirgeler: BildirgeItem[], customerName: string) {
  if (bildirgeler.length === 0) {
    toast.error("Dışa aktarılacak veri yok");
    return;
  }

  const rows: string[][] = [
    ["Dönem", "Belge Türü", "Mahiyet", "Kanun No", "Çalışan", "Gün", "Tutar", "Ref No"],
  ];

  for (const b of bildirgeler) {
    rows.push([
      b.hizmetDonem,
      b.belgeTuru,
      b.belgeMahiyeti,
      b.kanunNo,
      String(b.calisanSayisi),
      String(b.gunSayisi),
      b.pekTutar,
      b.bildirgeRefNo,
    ]);
  }

  const BOM = "\uFEFF";
  const csv = BOM + rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sgk-bildirgeler-${customerName.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Bildirge listesi dışa aktarıldı");
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF Export (Yazdır)
// ═══════════════════════════════════════════════════════════════════════════

function exportToPdf(bildirgeler: BildirgeItem[], customerName: string, sorguDonemi: string) {
  if (bildirgeler.length === 0) {
    toast.error("Dışa aktarılacak veri yok");
    return;
  }

  const rows = bildirgeler
    .map(
      (b) =>
        `<tr>
          <td style="text-align:center">${b.hizmetDonem}</td>
          <td style="text-align:center">${b.belgeTuru}</td>
          <td style="text-align:center">${b.belgeMahiyeti}</td>
          <td style="text-align:center">${b.kanunNo}</td>
          <td style="text-align:right">${b.calisanSayisi}</td>
          <td style="text-align:right">${b.gunSayisi}</td>
          <td style="text-align:right">${b.pekTutar}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>SGK Bildirge Listesi - ${customerName}</title>
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
<h1>SGK Onaylı Bildirge Listesi</h1>
<div class="info">${customerName} &mdash; Dönem: ${sorguDonemi} &mdash; ${bildirgeler.length} adet bildirge &mdash; ${new Date().toLocaleDateString("tr-TR")}</div>
<table>
  <thead><tr>
    <th style="text-align:center">Dönem</th>
    <th style="text-align:center">Belge Türü</th>
    <th style="text-align:center">Mahiyet</th>
    <th style="text-align:center">Kanun No</th>
    <th style="text-align:right">Çalışan</th>
    <th style="text-align:right">Gün</th>
    <th style="text-align:right">Tutar</th>
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
// İşyeri Bilgileri Alt Bileşeni
// ═══════════════════════════════════════════════════════════════════════════

function InfoItem({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <span className="text-xs text-muted-foreground block mb-0.5">{label}</span>
      <p className="font-medium text-sm leading-snug break-words">{value || "—"}</p>
    </div>
  );
}

function IsyeriInfoPanel({ info }: { info: IsyeriInfo }) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <Building2 className="h-4 w-4" />
        İşyeri Bilgileri
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
        <InfoItem label="Sicil No" value={info.sicilNo} />
        <InfoItem label="Ünvan" value={info.unvan} />
        <InfoItem label="İşyeri Tipi" value={info.isyeriTipi} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function SgkClient() {
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
    bildirgeler,
    isyeriInfo,
    isLoading,
    progress,
    error,
    errorCode,
    queryDone,
    saveProgress,
    isPipelineActive,
    downloadedRefNos,
    pdfDocumentIds,
    startQuery,
    clearResults,
    openPdf,
  } = useSgkQuery();

  // Mükellef listesini yükle
  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch("/api/customers?fields=minimal");
        if (!res.ok) {
          toast.error("Mükellef listesi yüklenemedi");
          return;
        }
        const data = await res.json();
        const mapped: Customer[] = (data || []).map(
          (c: {
            id: string;
            unvan: string;
            kisaltma: string | null;
            vknTckn: string;
            hasSgkCredentials?: boolean;
            sgkSistemSifresi?: string | null;
          }) => ({
            id: c.id,
            unvan: c.unvan,
            kisaltma: c.kisaltma,
            vknTckn: c.vknTckn,
            hasSgkCredentials: c.hasSgkCredentials ?? !!c.sgkSistemSifresi,
          })
        );
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

    if (!selectedCustomer?.hasSgkCredentials) {
      toast.error(
        "Seçili mükellefin SGK E-Bildirge bilgileri eksik. Şifreler sayfasından SGK bilgilerini girin."
      );
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

    await startQuery(selectedCustomerId, basAy, basYil, bitAy, bitYil);
  }, [selectedCustomerId, selectedCustomer, basAy, basYil, bitAy, bitYil, startQuery]);

  // Temizle
  const handleClear = useCallback(() => {
    clearResults();
  }, [clearResults]);

  // İndirilmiş ref'ler seti
  const downloadedSet = useMemo(() => new Set(downloadedRefNos), [downloadedRefNos]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">SGK Sorgulama</h1>
      </div>

      {/* Filtreler */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          {/* Mükellef Seçimi — Combobox */}
          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={isLoading}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setComboboxOpen(true)}
              >
                <span className={selectedCustomer ? "text-foreground" : "text-muted-foreground"}>
                  {customersLoading
                    ? "Yükleniyor..."
                    : selectedCustomer
                      ? <>
                          {selectedCustomer.kisaltma || selectedCustomer.unvan}
                          <span className="text-rose-600 dark:text-rose-400"> · {selectedCustomer.vknTckn}</span>
                        </>
                      : "Mükellef ara veya seçin..."
                  }
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="p-0"
              style={{ width: "var(--radix-popover-trigger-width)", minWidth: 500 }}
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
                {customersLoading ? (
                  <div className="py-4 px-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mükellefler yükleniyor...
                  </div>
                ) : filteredCustomers.length === 0 ? (
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
                      <span className="truncate flex-1 text-left">
                        {c.kisaltma || c.unvan}
                        {!c.hasSgkCredentials && (
                          <span className="text-[10px] text-destructive font-medium ml-1">SGK eksik</span>
                        )}
                      </span>
                      <span className="text-xs font-mono text-rose-500 dark:text-rose-400 shrink-0">
                        {c.vknTckn}
                      </span>
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
              <Button
                onClick={handleQuery}
                disabled={isLoading || !selectedCustomerId || !selectedCustomer?.hasSgkCredentials}
              >
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
              {bildirgeler.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportToExcel(bildirgeler, selectedCustomer?.kisaltma || selectedCustomer?.unvan || "mukellef")
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const sorguDonemi = `${MONTHS_TR[parseInt(basAy) - 1]} ${basYil} - ${MONTHS_TR[parseInt(bitAy) - 1]} ${bitYil}`;
                      exportToPdf(bildirgeler, selectedCustomer?.kisaltma || selectedCustomer?.unvan || "mukellef", sorguDonemi);
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

      {/* SGK bilgileri eksik uyarısı */}
      {selectedCustomer && !selectedCustomer.hasSgkCredentials && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-2">
            {selectedCustomer.kisaltma || selectedCustomer.unvan} için SGK E-Bildirge bilgileri eksik.
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

      {/* Pipeline Save Progress */}
      {isPipelineActive && saveProgress.total > 0 && (
        <div className="rounded-lg border bg-blue-50 p-3 dark:bg-blue-950/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              PDF Kaydediliyor
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-400">
              {saveProgress.saved + saveProgress.skipped}/{saveProgress.total}
            </span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2">
            <div
              className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${Math.round(
                  ((saveProgress.saved + saveProgress.skipped + saveProgress.failed) / saveProgress.total) * 100
                )}%`,
              }}
            />
          </div>
          <div className="flex gap-3 mt-1 text-xs text-blue-600 dark:text-blue-400">
            {saveProgress.saved > 0 && <span>{saveProgress.saved} kaydedildi</span>}
            {saveProgress.skipped > 0 && <span>{saveProgress.skipped} atlandı</span>}
            {saveProgress.failed > 0 && <span className="text-destructive">{saveProgress.failed} başarısız</span>}
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

      {/* İşyeri Bilgileri */}
      {isyeriInfo && <IsyeriInfoPanel info={isyeriInfo} />}

      {/* Bildirge Tablosu */}
      {bildirgeler.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
          <div className="p-3 border-b bg-muted/30">
            <span className="text-sm font-medium">
              {bildirgeler.length} Bildirge Bulundu
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Dönem</th>
                  <th className="px-3 py-2 text-center font-medium">Belge Türü</th>
                  <th className="px-3 py-2 text-center font-medium">Mahiyet</th>
                  <th className="px-3 py-2 text-center font-medium">Kanun No</th>
                  <th className="px-3 py-2 text-right font-medium">Çalışan</th>
                  <th className="px-3 py-2 text-right font-medium">Gün</th>
                  <th className="px-3 py-2 text-right font-medium">Tutar</th>
                  <th className="px-3 py-2 text-center font-medium">PDF</th>
                  <th className="px-3 py-2 text-center font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {bildirgeler.map((b) => {
                  const isDownloaded = downloadedSet.has(b.bildirgeRefNo);
                  return (
                    <tr key={b.bildirgeRefNo} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 font-mono text-xs">{b.hizmetDonem}</td>
                      <td className="px-3 py-2 text-center">{b.belgeTuru}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={b.belgeMahiyeti === "ASIL" ? "default" : "secondary"} className="text-xs">
                          {b.belgeMahiyeti}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-xs">{b.kanunNo}</td>
                      <td className="px-3 py-2 text-right">{b.calisanSayisi}</td>
                      <td className="px-3 py-2 text-right">{b.gunSayisi}</td>
                      <td className="px-3 py-2 text-right font-medium">{b.pekTutar}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex justify-center gap-1">
                          {b.hasTahakkukPdf && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 px-2 text-xs ${pdfDocumentIds[`${b.bildirgeRefNo}_SGK_TAHAKKUK`] ? "text-emerald-600 hover:text-emerald-700" : ""}`}
                              title="Tahakkuk Fişi"
                              disabled={!pdfDocumentIds[`${b.bildirgeRefNo}_SGK_TAHAKKUK`]}
                              onClick={() => openPdf(b.bildirgeRefNo, "tahakkuk")}
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              T
                            </Button>
                          )}
                          {b.hasHizmetPdf && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 px-2 text-xs ${pdfDocumentIds[`${b.bildirgeRefNo}_HIZMET_LISTESI`] ? "text-emerald-600 hover:text-emerald-700" : ""}`}
                              title="Hizmet Listesi"
                              disabled={!pdfDocumentIds[`${b.bildirgeRefNo}_HIZMET_LISTESI`]}
                              onClick={() => openPdf(b.bildirgeRefNo, "hizmet")}
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              H
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isDownloaded ? (
                          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                            Kaydedildi
                          </Badge>
                        ) : isPipelineActive ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground" />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Boş Durum */}
      {!isLoading && !error && bildirgeler.length === 0 && !queryDone && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-card p-12 text-muted-foreground">
          <Building2 className="h-12 w-12 opacity-30" />
          <p className="text-center">
            Mükellef seçip dönem belirledikten sonra <strong>Sorgula</strong> butonuna tıklayın.
          </p>
        </div>
      )}

      {/* Sonuç yok */}
      {!isLoading && !error && bildirgeler.length === 0 && queryDone && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-card p-12 text-muted-foreground">
          <Building2 className="h-12 w-12 opacity-30" />
          <p className="text-center">
            Seçilen dönemde bildirge bulunamadı.
          </p>
        </div>
      )}
    </div>
  );
}
