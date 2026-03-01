/**
 * Beyanname Arşiv Sayfası
 * =======================
 * QueryArchiveFilter ile arşivden beyanname verisi çeker,
 * virtual scrolling ile gösterir, PDF görüntüleme ve export destekler.
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  Archive,
  ArrowLeft,
  Filter,
  Download,
  FileDown,
  Eye,
  Loader2,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import QueryArchiveFilter from "@/components/query-archive/query-archive-filter";
import { useBeyannameQuery } from "./hooks/use-beyanname-query";
import type { BeyannameItem } from "./hooks/use-beyanname-query";

// ═══════════════════════════════════════════════════════════════════════════
// Tipler
// ═══════════════════════════════════════════════════════════════════════════

interface Customer {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
}

interface BeyannameWithDonem extends BeyannameItem {
  _donemAy?: number;
  _donemYil?: number;
}

type RenderItem =
  | { type: "header"; label: string; count: number }
  | { type: "row"; data: BeyannameWithDonem };

// ═══════════════════════════════════════════════════════════════════════════
// Sabitler
// ═══════════════════════════════════════════════════════════════════════════

const AY_ISIMLERI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** Dönem formatı: "202501202503" → "01/2025-03/2025" */
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

// ═══════════════════════════════════════════════════════════════════════════
// Excel Export
// ═══════════════════════════════════════════════════════════════════════════

function exportToExcel(beyannameler: BeyannameWithDonem[], customerName: string) {
  if (beyannameler.length === 0) {
    toast.error("Dışa aktarılacak veri yok");
    return;
  }

  const rows: string[][] = [["Beyanname Türü", "Dönem", "Açıklama", "Kaynak"]];

  for (const b of beyannameler) {
    rows.push([
      `${b.turKodu}_${b.versiyon}`,
      formatDonemSlash(b.donem),
      b.aciklama,
      b.kaynak,
    ]);
  }

  const BOM = "\uFEFF";
  const csv = BOM + rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `beyanname-arsiv-${customerName.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Arşiv verileri dışa aktarıldı");
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF Export (Tablo yazdırma)
// ═══════════════════════════════════════════════════════════════════════════

function exportToPdf(beyannameler: BeyannameWithDonem[], customerName: string) {
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
          <td style="text-align:center">${b.kaynak}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Beyanname Arşivi - ${customerName}</title>
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
<h1>Beyanname Arşivi</h1>
<div class="info">${customerName} &mdash; ${beyannameler.length} adet beyanname &mdash; ${new Date().toLocaleDateString("tr-TR")}</div>
<table>
  <thead><tr>
    <th>Beyanname Türü</th>
    <th style="text-align:center">Vergilendirme Dönemi</th>
    <th>Düzeltme Gerekçesi</th>
    <th style="text-align:center">Kaynak</th>
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
// Bileşen
// ═══════════════════════════════════════════════════════════════════════════

export default function BeyannameArsivClient() {
  // Mükellef listesi
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Arşiv verileri
  const [archiveBeyannameler, setArchiveBeyannameler] = useState<BeyannameWithDonem[]>([]);
  const [archiveCustomerName, setArchiveCustomerName] = useState("");

  // Beyanname türü filtresi
  const [turFilter, setTurFilter] = useState<string>("all");

  // PDF için hook (sadece viewPdf ve pdfLoading kullanılıyor)
  const { viewPdf, pdfLoading } = useBeyannameQuery();

  // Virtual scroll ref
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Mükellef listesi yükle
  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch("/api/customers?fields=minimal");
        if (!res.ok) return;
        const data = await res.json();
        setCustomers(
          (data || []).map((c: { id: string; unvan: string; kisaltma: string | null; vknTckn: string }) => ({
            id: c.id,
            unvan: c.unvan,
            kisaltma: c.kisaltma,
            vknTckn: c.vknTckn,
          }))
        );
      } catch {
        toast.error("Mükellef listesi yüklenemedi");
      }
    }
    loadCustomers();
  }, []);

  // Arşivden göster callback
  const handleShowArchiveData = useCallback(
    (_archiveId: string, data: unknown[], customerName?: string) => {
      const mapped = data as BeyannameWithDonem[];
      setArchiveBeyannameler(mapped);
      setArchiveCustomerName(customerName || "");
      setTurFilter("all");
    },
    []
  );

  // Temizle
  const handleClear = useCallback(() => {
    setArchiveBeyannameler([]);
    setArchiveCustomerName("");
    setTurFilter("all");
  }, []);

  // Dönem bilgisi var mı kontrol (yıllık modda _donemAy ekleniyor)
  const hasDonemInfo = useMemo(() => {
    return archiveBeyannameler.length > 0 && archiveBeyannameler[0]._donemAy !== undefined;
  }, [archiveBeyannameler]);

  // Beyanname türleri
  const beyannameTurleri = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of archiveBeyannameler) {
      if (b.turKodu && !map.has(b.turKodu)) {
        map.set(b.turKodu, b.turAdi);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "tr"))
      .map(([kod, adi]) => ({ kod, adi }));
  }, [archiveBeyannameler]);

  // Filtrelenmiş beyannameler
  const filteredBeyannameler = useMemo(() => {
    if (turFilter === "all") return archiveBeyannameler;
    return archiveBeyannameler.filter((b) => b.turKodu === turFilter);
  }, [archiveBeyannameler, turFilter]);

  // Render items: section headers + data rows
  const renderItems = useMemo<RenderItem[]>(() => {
    if (!hasDonemInfo) {
      // Aylık mod: header yok, sadece satırlar
      return filteredBeyannameler.map((b) => ({ type: "row" as const, data: b }));
    }

    // Yıllık mod: dönem başlıkları + satırlar
    const items: RenderItem[] = [];
    const groups = new Map<string, BeyannameWithDonem[]>();

    for (const b of filteredBeyannameler) {
      const key = `${b._donemYil}-${String(b._donemAy).padStart(2, "0")}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(b);
    }

    // Sıralama: yıl-ay azalan
    const sortedKeys = Array.from(groups.keys()).sort().reverse();

    for (const key of sortedKeys) {
      const [yilStr, ayStr] = key.split("-");
      const ay = parseInt(ayStr, 10);
      const yil = parseInt(yilStr, 10);
      const groupItems = groups.get(key)!;

      items.push({
        type: "header",
        label: `${AY_ISIMLERI[ay - 1]} ${yil}`,
        count: groupItems.length,
      });

      for (const b of groupItems) {
        items.push({ type: "row", data: b });
      }
    }

    return items;
  }, [filteredBeyannameler, hasDonemInfo]);

  // Virtual scrolling
  const virtualizer = useVirtualizer({
    count: renderItems.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: (index) => {
      return renderItems[index].type === "header" ? 44 : 40;
    },
    overscan: 20,
  });

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/beyannameler">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Archive className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Beyanname Arşivi</h1>
      </div>

      {/* Filtre Paneli */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <QueryArchiveFilter
          queryType="beyanname"
          customers={customers}
          onShowArchiveData={handleShowArchiveData}
          onClearArchiveData={handleClear}
          showAmount={false}
        />
      </div>

      {/* Arşiv gösteriliyorsa */}
      {archiveBeyannameler.length > 0 && (
        <>
          {/* Bilgi Badge'i */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Archive className="h-3 w-3" />
              Arşivden gösteriliyor
            </Badge>
            {archiveCustomerName && (
              <span className="text-sm font-medium">{archiveCustomerName}</span>
            )}
            <span className="text-sm text-muted-foreground">
              — {archiveBeyannameler.length} beyanname
            </span>
          </div>

          {/* Beyanname Türü Filtresi */}
          {beyannameTurleri.length > 1 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>Beyanname Türü:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setTurFilter("all")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    turFilter === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  }`}
                >
                  Tümü ({archiveBeyannameler.length})
                </button>
                {beyannameTurleri.map(({ kod }) => {
                  const count = archiveBeyannameler.filter(
                    (b) => b.turKodu === kod
                  ).length;
                  return (
                    <button
                      key={kod}
                      onClick={() => setTurFilter(kod)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        turFilter === kod
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80 text-foreground"
                      }`}
                    >
                      {kod} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Export Butonları */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToExcel(filteredBeyannameler, archiveCustomerName || "arsiv")
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToPdf(filteredBeyannameler, archiveCustomerName || "arsiv")
              }
            >
              <FileDown className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </div>

          {/* Tablo — Virtual Scrolling */}
          <div className="border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            {/* Sticky Header */}
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted/80 backdrop-blur-sm">
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-bold">
                    Beyanname Türü
                  </th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center font-bold">
                    Vergilendirme Dönemi
                  </th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-bold">
                    Düzeltme Gerekçesi
                  </th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center font-bold">
                    Kaynak
                  </th>
                  <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center font-bold whitespace-nowrap w-50">
                    PDF Görüntüle
                  </th>
                </tr>
              </thead>
            </table>

            {/* Virtual Scroll Body */}
            <div
              ref={tableContainerRef}
              className="overflow-auto"
              style={{ maxHeight: "calc(100vh - 450px)", minHeight: "200px" }}
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const item = renderItems[virtualRow.index];

                  if (item.type === "header") {
                    return (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border-y border-gray-200 dark:border-gray-700 font-medium text-sm text-blue-700 dark:text-blue-300"
                      >
                        <CalendarDays className="h-4 w-4" />
                        <span>{item.label}</span>
                        <span className="text-xs font-normal">— {item.count} kayıt</span>
                      </div>
                    );
                  }

                  const b = item.data;
                  return (
                    <div
                      key={virtualRow.key}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="flex items-center hover:bg-muted/50 text-sm"
                    >
                      <div className="flex-1 min-w-0 grid grid-cols-[minmax(140px,1fr)_140px_minmax(120px,2fr)_80px_80px] items-center">
                        <span className="px-3 py-1 whitespace-nowrap font-medium truncate border-r border-gray-200 dark:border-gray-700">
                          {b.turKodu}_{b.versiyon}
                        </span>
                        <span className="px-3 py-1 text-center whitespace-nowrap border-r border-gray-200 dark:border-gray-700">
                          {formatDonemSlash(b.donem)}
                        </span>
                        <span
                          className="px-3 py-1 truncate border-r border-gray-200 dark:border-gray-700"
                          title={b.aciklama}
                        >
                          {b.aciklama || ""}
                        </span>
                        <span className="px-3 py-1 text-center whitespace-nowrap border-r border-gray-200 dark:border-gray-700">
                          {b.kaynak}
                        </span>
                        <span className="px-2 py-1 text-center">
                          <button
                            type="button"
                            disabled={!b.beyoid || pdfLoading === b.beyoid}
                            title={
                              b.beyoid
                                ? `${b.turAdi} PDF görüntüle`
                                : "PDF mevcut değil"
                            }
                            className="inline-flex items-center justify-center h-7 w-7 rounded-full text-blue-500 hover:text-blue-700 hover:bg-blue-50 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            onClick={() => {
                              if (!b.beyoid) return;
                              // Arşivdeki customerName ile customerId'ye erişemiyoruz,
                              // bu nedenle toast ile uyarı verilir
                              toast.info(
                                "Arşivden PDF görüntüleme için önce ilgili mükellefi sorgulayın."
                              );
                            }}
                          >
                            {pdfLoading === b.beyoid ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tablo Alt Bilgi */}
            <div className="flex items-center justify-end border-t border-gray-300 dark:border-gray-600 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span>
                {turFilter === "all"
                  ? `Toplam Kayıt: ${filteredBeyannameler.length}`
                  : `${filteredBeyannameler.length} / ${archiveBeyannameler.length} beyanname (${turFilter} filtresi)`}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Boş Durum */}
      {archiveBeyannameler.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-card p-12 text-muted-foreground">
          <Archive className="h-12 w-12 opacity-30" />
          <p className="text-center">
            Arşivden beyanname görüntülemek için yukarıdan dönem ve mükellef seçip{" "}
            <strong>Filtrele</strong> butonuna tıklayın.
          </p>
        </div>
      )}
    </div>
  );
}
