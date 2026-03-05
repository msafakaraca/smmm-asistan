/**
 * Beyanname Arşiv Sayfası
 * =======================
 * Mükellef seçimi + Filtrele butonu ile arşivdeki tüm beyannameleri
 * BeyannameGroupList (mikro kart) tasarımında gösterir.
 * Sorgulama sayfasıyla birebir aynı görsel dil.
 *
 * Optimizasyon: /api/query-archives/customer-bulk endpoint'i ile
 * tek sorguda tüm resultData çekilir (N+1 problemi yok).
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  Archive,
  ArrowLeft,
  Loader2,
  Search,
  Download,
  FileDown,
  X,
  ChevronsUpDown,
  Check,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import type { BeyannameItem } from "./hooks/use-beyanname-query";
import type { PdfPreviewData } from "./pdf-preview-dialog";
import BeyannameGroupList from "./beyanname-group-list";
import PdfPreviewDialog from "./pdf-preview-dialog";

// ═══════════════════════════════════════════════════════════════════════════
// Tipler
// ═══════════════════════════════════════════════════════════════════════════

interface Customer {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  lastBeyannameQueryAt: string | null;
}

interface BeyannameArsivClientProps {
  initialCustomers?: {
    id: string;
    unvan: string;
    kisaltma: string | null;
    vknTckn: string;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Yardımcı fonksiyonlar
// ═══════════════════════════════════════════════════════════════════════════

/** Tarih formatı: ISO string → "15.02.2026 14:30" */
function formatQueryDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

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

function exportToExcel(beyannameler: BeyannameItem[], customerName: string) {
  if (beyannameler.length === 0) {
    toast.error("Dışa aktarılacak veri yok");
    return;
  }

  const rows: string[][] = [["Beyanname Türü", "Dönem", "Açıklama"]];

  for (const b of beyannameler) {
    rows.push([
      `${b.turKodu}_${b.versiyon}`,
      formatDonemSlash(b.donem),
      b.aciklama,
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

function exportToPdf(beyannameler: BeyannameItem[], customerName: string) {
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

export default function BeyannameArsivClient({ initialCustomers }: BeyannameArsivClientProps) {
  // Mükellef listesi — server-side'dan geliyorsa anında hazır
  const [customers, setCustomers] = useState<Customer[]>(() =>
    (initialCustomers || []).map((c) => ({
      ...c,
      lastBeyannameQueryAt: null,
    }))
  );
  const [customersLoading, setCustomersLoading] = useState(!initialCustomers);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const statusLoadedRef = useRef(false);

  // Arşiv verileri
  const [archiveBeyannameler, setArchiveBeyannameler] = useState<BeyannameItem[]>([]);
  const [archiveCustomerName, setArchiveCustomerName] = useState("");
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [filterDone, setFilterDone] = useState(false);

  // Yıl filtresi
  const [yearFilter, setYearFilter] = useState<string>("all");

  // PDF önbellek ve dialog durumu
  const [pdfCache, setPdfCache] = useState<Record<string, string>>({});
  const pdfCacheRef = useRef<Record<string, string>>({});
  pdfCacheRef.current = pdfCache;
  const signedUrlCacheRef = useRef<Record<string, string>>({}); // beyoid → signedUrl (API bypass)
  const preloadAbortRef = useRef<AbortController | null>(null);
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewData | null>(null);
  const hoverPreloadRef = useRef<string | null>(null);
  const archiveBeyannamelerRef = useRef<BeyannameItem[]>([]);
  archiveBeyannamelerRef.current = archiveBeyannameler;

  // PDF mevcut değil takibi — preload sonrası belirlenir
  const [unavailableBeyoids, setUnavailableBeyoids] = useState<Set<string>>(new Set());
  const unavailableBeyoidsRef = useRef<Set<string>>(new Set());
  unavailableBeyoidsRef.current = unavailableBeyoids;

  // Fallback: initialCustomers yoksa client-side yükle
  useEffect(() => {
    if (initialCustomers) return;
    async function loadCustomers() {
      try {
        const res = await fetch("/api/customers?fields=minimal");
        if (!res.ok) {
          toast.error("Mükellef listesi yüklenemedi");
          return;
        }
        const data = await res.json();
        const mapped: Customer[] = (data || []).map(
          (c: { id: string; unvan: string; kisaltma: string | null; vknTckn: string }) => ({
            id: c.id,
            unvan: c.unvan,
            kisaltma: c.kisaltma,
            vknTckn: c.vknTckn,
            lastBeyannameQueryAt: null,
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
  }, [initialCustomers]);

  // Sorgulama durumlarını arka planda yükle (combobox'ı bloklamaz)
  useEffect(() => {
    if (customersLoading || statusLoadedRef.current || customers.length === 0) return;
    statusLoadedRef.current = true;
    fetch("/api/query-archives/customer-status?queryType=beyanname")
      .then((r) => (r.ok ? r.json() : { statuses: {} }))
      .then((data) => {
        const statuses: Record<string, string> = data.statuses || {};
        setCustomers((prev) =>
          prev.map((c) => ({
            ...c,
            lastBeyannameQueryAt: statuses[c.id] || c.lastBeyannameQueryAt,
          }))
        );
      })
      .catch(() => {});
  }, [customersLoading, customers.length]);

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

  // Benzersiz yıllar + adetleri (büyükten küçüğe)
  const availableYears = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of archiveBeyannameler) {
      if (b.donem && b.donem.length >= 4) {
        const y = b.donem.substring(0, 4);
        counts.set(y, (counts.get(y) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, count]) => ({ year, count }));
  }, [archiveBeyannameler]);

  // Yıl filtresine göre filtrelenmiş beyannameler
  const filteredBeyannameler = useMemo(() => {
    if (yearFilter === "all") return archiveBeyannameler;
    return archiveBeyannameler.filter(
      (b) => b.donem && b.donem.length >= 4 && b.donem.substring(0, 4) === yearFilter
    );
  }, [archiveBeyannameler, yearFilter]);

  // PDF preload — toplu signed URL al + cache'le, arka planda agresif indir
  const preloadPdfs = useCallback((custId: string, items: BeyannameItem[]) => {
    if (preloadAbortRef.current) preloadAbortRef.current.abort();

    const uncached = items.filter(item => item.beyoid && !pdfCacheRef.current[item.beyoid]);
    if (uncached.length === 0) return;

    const controller = new AbortController();
    preloadAbortRef.current = controller;
    const signal = controller.signal;

    (async () => {
      try {
        // Tek istek ile tüm signed URL'leri al
        const res = await fetch("/api/intvrg/beyanname-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "bulk-signed",
            customerId: custId,
            items: uncached.map(item => ({
              turKodu: item.turKodu,
              donem: item.donem,
              beyoid: item.beyoid,
            })),
          }),
          signal,
        });

        if (!res.ok || signal.aborted) return;
        const { signedUrls } = await res.json() as { signedUrls: Record<string, string> };
        if (!signedUrls || signal.aborted) return;

        // Signed URL'leri hemen cache'le — tıklamada API bypass için
        signedUrlCacheRef.current = { ...signedUrlCacheRef.current, ...signedUrls };

        // PDF'i olmayan beyoid'leri tespit et
        const availableSet = new Set(Object.keys(signedUrls));
        const newUnavailable = new Set<string>();
        for (const item of uncached) {
          if (item.beyoid && !availableSet.has(item.beyoid)) {
            newUnavailable.add(item.beyoid);
          }
        }
        if (newUnavailable.size > 0 && !signal.aborted) {
          setUnavailableBeyoids(newUnavailable);
        }

        // 8'li paralel batch — agresif preload
        const entries = Object.entries(signedUrls);
        const CONCURRENCY = 8;
        for (let i = 0; i < entries.length; i += CONCURRENCY) {
          if (signal.aborted) return;
          const batch = entries.slice(i, i + CONCURRENCY);
          await Promise.all(
            batch.map(async ([beyoid, signedUrl]) => {
              if (signal.aborted || pdfCacheRef.current[beyoid]) return;
              try {
                const pdfRes = await fetch(signedUrl, { signal });
                if (pdfRes.ok && !signal.aborted) {
                  const blob = await pdfRes.blob();
                  if (blob.size >= 100) {
                    const blobUrl = URL.createObjectURL(blob);
                    setPdfCache(prev => ({ ...prev, [beyoid]: blobUrl }));
                  }
                }
              } catch { /* abort veya network — sessiz geç */ }
            })
          );
        }
      } catch { /* API hatası — sessiz geç */ }
    })();
  }, []);

  // Filtrele — tek sorgu ile arşivden tüm veriyi çek
  const handleFilter = useCallback(async () => {
    if (!selectedCustomerId) {
      toast.error("Lütfen bir mükellef seçin");
      return;
    }

    setArchiveLoading(true);
    setArchiveBeyannameler([]);
    setYearFilter("all");
    setFilterDone(false);
    setUnavailableBeyoids(new Set());

    try {
      // Tek HTTP isteği — PostgreSQL tarafında JSON birleştirme
      const res = await fetch(
        `/api/query-archives/customer-bulk?customerId=${selectedCustomerId}&queryType=beyanname`
      );

      if (!res.ok) {
        toast.error("Arşiv verileri yüklenemedi");
        setFilterDone(true);
        setArchiveLoading(false);
        return;
      }

      const data = await res.json();
      const items = (data.items || []) as BeyannameItem[];

      if (items.length === 0) {
        toast.info("Bu mükellef için arşivde kayıt bulunamadı");
        setFilterDone(true);
        setArchiveLoading(false);
        return;
      }

      // Dedup (aynı beyoid birden fazla arşivde olabilir)
      const seen = new Set<string>();
      const uniqueItems: BeyannameItem[] = [];
      for (const item of items) {
        const key = item.beyoid || `${item.turKodu}-${item.donem}-${item.versiyon}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueItems.push(item);
        }
      }

      setArchiveBeyannameler(uniqueItems);
      setArchiveCustomerName(
        selectedCustomer?.kisaltma || selectedCustomer?.unvan || ""
      );
      setFilterDone(true);

      // Arka planda PDF'leri preload et
      if (uniqueItems.length > 0) {
        preloadPdfs(selectedCustomerId, uniqueItems);
      }

      if (uniqueItems.length === 0) {
        toast.info("Bu mükellef için arşivde beyanname bulunamadı");
      } else {
        toast.success(
          `${selectedCustomer?.kisaltma || selectedCustomer?.unvan} için ${uniqueItems.length} beyanname arşivden yüklendi`
        );
      }
    } catch {
      toast.error("Arşiv verileri yüklenemedi");
      setFilterDone(true);
    } finally {
      setArchiveLoading(false);
    }
  }, [selectedCustomerId, selectedCustomer, preloadPdfs]);

  // Temizle
  const handleClear = useCallback(() => {
    if (preloadAbortRef.current) preloadAbortRef.current.abort();
    for (const url of Object.values(pdfCacheRef.current)) {
      URL.revokeObjectURL(url);
    }
    setPdfCache({});
    signedUrlCacheRef.current = {};
    setArchiveBeyannameler([]);
    setArchiveCustomerName("");
    setYearFilter("all");
    setFilterDone(false);
    setUnavailableBeyoids(new Set());
  }, []);

  // Tüm sorgulamaları sil (test amaçlı)
  const [deleteLoading, setDeleteLoading] = useState(false);
  const handleDeleteAll = useCallback(async () => {
    if (!confirm("TÜM beyanname arşiv kayıtları silinecek. Bu işlem geri alınamaz!\n\nDevam etmek istiyor musunuz?")) {
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await fetch("/api/query-archives?queryType=beyanname", {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error("Silme işlemi başarısız oldu");
        return;
      }

      const data = await res.json();
      toast.success(`${data.deletedCount} arşiv kaydı silindi`);

      // UI'ı temizle
      handleClear();

      // Müşteri listesindeki sorgulama durumlarını sıfırla
      setCustomers(prev => prev.map(c => ({ ...c, lastBeyannameQueryAt: null })));
    } catch {
      toast.error("Silme işlemi sırasında hata oluştu");
    } finally {
      setDeleteLoading(false);
    }
  }, [handleClear]);

  // PDF görüntüleme — dialog ANINDA açılır, PDF ultra-hızlı yüklenir
  const handleViewPdf = useCallback(async (beyoid: string) => {
    if (!selectedCustomerId) return;

    // PDF mevcut değilse atla
    if (unavailableBeyoidsRef.current.has(beyoid)) {
      toast.error("Bu beyannamenin PDF'i mevcut değil. Sorgulama sayfasından tekrar sorgulayın.");
      return;
    }

    const item = archiveBeyannamelerRef.current.find(b => b.beyoid === beyoid);
    if (!item) return;

    const customerName = selectedCustomer?.kisaltma || selectedCustomer?.unvan || "";
    const donem = formatDonemSlash(item.donem);

    // 1. Blob cache'de varsa → ANINDA göster (0ms)
    if (pdfCacheRef.current[beyoid]) {
      setPdfPreview({
        blobUrl: pdfCacheRef.current[beyoid],
        turAdi: item.turAdi,
        donem,
        customerName,
      });
      return;
    }

    // Dialog'u HEMEN aç (loading spinner ile)
    setPdfPreview({
      blobUrl: null,
      turAdi: item.turAdi,
      donem,
      customerName,
    });

    try {
      let signedUrl = signedUrlCacheRef.current[beyoid];

      // 2. Signed URL cache'de varsa → tek fetch (API bypass, ~500ms tasarruf)
      // 3. Hiçbir cache yoksa → API'den al + fetch
      if (!signedUrl) {
        const params = new URLSearchParams({
          customerId: selectedCustomerId,
          turKodu: item.turKodu,
          donem: item.donem,
        });
        const metaRes = await fetch(`/api/intvrg/beyanname-pdf?${params}`);

        if (!metaRes.ok) {
          const err = await metaRes.json().catch(() => null);
          toast.error(err?.error || "PDF alınamadı");
          setPdfPreview(null);
          return;
        }

        const data = await metaRes.json();
        signedUrl = data.signedUrl;
        // Signed URL'i cache'le
        signedUrlCacheRef.current[beyoid] = signedUrl;
      }

      const pdfRes = await fetch(signedUrl);

      if (!pdfRes.ok) {
        // Signed URL geçersiz olabilir — cache'den sil
        delete signedUrlCacheRef.current[beyoid];
        toast.error("PDF dosyası bulunamadı. Sorgulama sayfasından tekrar sorgulayın.");
        setPdfPreview(null);
        return;
      }

      const blob = await pdfRes.blob();

      if (blob.size < 100) {
        toast.error("PDF dosyası bozuk veya geçersiz.");
        setPdfPreview(null);
        return;
      }

      const blobUrl = URL.createObjectURL(blob);
      setPdfCache(prev => ({ ...prev, [beyoid]: blobUrl }));

      setPdfPreview({
        blobUrl,
        turAdi: item.turAdi,
        donem,
        customerName,
      });
    } catch {
      toast.error("PDF yüklenirken hata oluştu");
      setPdfPreview(null);
    }
  }, [selectedCustomerId, selectedCustomer]);

  // Hover intent preload — signed URL cache ile tek fetch, API bypass
  const handleHoverStart = useCallback((item: BeyannameItem) => {
    if (!item.beyoid || !selectedCustomerId) return;
    if (unavailableBeyoidsRef.current.has(item.beyoid)) return;
    if (pdfCacheRef.current[item.beyoid]) return;
    if (hoverPreloadRef.current === item.beyoid) return;

    hoverPreloadRef.current = item.beyoid;

    (async () => {
      try {
        let signedUrl = signedUrlCacheRef.current[item.beyoid];

        // Signed URL cache'de yoksa API'den al
        if (!signedUrl) {
          const params = new URLSearchParams({
            customerId: selectedCustomerId,
            turKodu: item.turKodu,
            donem: item.donem,
          });
          const metaRes = await fetch(`/api/intvrg/beyanname-pdf?${params}`);
          if (!metaRes.ok) return;
          const data = await metaRes.json();
          signedUrl = data.signedUrl;
          if (!signedUrl) return;
          signedUrlCacheRef.current[item.beyoid] = signedUrl;
        }

        const pdfRes = await fetch(signedUrl);
        if (!pdfRes.ok) return;
        const blob = await pdfRes.blob();
        if (blob.size < 100) return;
        const blobUrl = URL.createObjectURL(blob);
        setPdfCache(prev => ({ ...prev, [item.beyoid]: blobUrl }));
      } catch { /* sessiz */ }
      finally { hoverPreloadRef.current = null; }
    })();
  }, [selectedCustomerId]);

  // PDF dialog kapatma — blob URL cache'de kalır, revoke etme
  const closePdfPreview = useCallback(() => {
    setPdfPreview(null);
  }, []);

  // Cleanup: blob URL'ler ve preload abort
  useEffect(() => {
    return () => {
      if (preloadAbortRef.current) preloadAbortRef.current.abort();
      for (const url of Object.values(pdfCacheRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

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
        <div className="ml-auto">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteAll}
            disabled={deleteLoading}
          >
            {deleteLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Tüm Sorgulamaları Sil
          </Button>
        </div>
      </div>

      {/* Filtreler — Tek satır: Combobox + Filtrele + Export butonları */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mükellef Seçimi — Combobox */}
          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={archiveLoading}
                className="flex h-9 min-w-[280px] max-w-[700px] flex-1 items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
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
              style={{ width: "var(--radix-popover-trigger-width)", minWidth: 600 }}
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
                      className="grid grid-cols-[16px_1fr_1px_100px_1px_110px_1px_110px] w-full items-center gap-x-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setCustomerSearch("");
                        setComboboxOpen(false);
                      }}
                    >
                      <Check
                        className={`h-4 w-4 ${
                          selectedCustomerId === c.id ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <span className="truncate text-sm text-left">{c.kisaltma || c.unvan}</span>
                      <span className="h-4 bg-border" />
                      <span className="text-xs font-mono text-rose-500 dark:text-rose-400 text-right">
                        {c.vknTckn}
                      </span>
                      <span className="h-4 bg-border" />
                      <span className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.lastBeyannameQueryAt ? "bg-emerald-500 dark:bg-emerald-400" : "bg-slate-300 dark:bg-zinc-600"}`} />
                        <span className={`text-[11px] whitespace-nowrap ${c.lastBeyannameQueryAt ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                          {c.lastBeyannameQueryAt ? "Sorgulandı" : "Sorgulanmamış"}
                        </span>
                      </span>
                      <span className="h-4 bg-border" />
                      <span className={`text-[11px] text-right whitespace-nowrap ${c.lastBeyannameQueryAt ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                        {c.lastBeyannameQueryAt ? formatQueryDate(c.lastBeyannameQueryAt) : "—"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Filtrele Butonu */}
          <Button
            onClick={handleFilter}
            disabled={archiveLoading || !selectedCustomerId}
            className="shrink-0"
          >
            {archiveLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Yükleniyor...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Filtrele
              </>
            )}
          </Button>

          {/* Export + Temizle Butonları */}
          {archiveBeyannameler.length > 0 && (
            <>
              <Button
                variant="outline"
                className="shrink-0"
                onClick={() =>
                  exportToExcel(
                    filteredBeyannameler,
                    archiveCustomerName || "arsiv"
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                className="shrink-0"
                onClick={() =>
                  exportToPdf(
                    filteredBeyannameler,
                    archiveCustomerName || "arsiv"
                  )
                }
              >
                <FileDown className="mr-2 h-4 w-4" />
                PDF
              </Button>
              <Button variant="ghost" className="shrink-0" onClick={handleClear}>
                <X className="mr-2 h-4 w-4" />
                Temizle
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Yıl Filtresi */}
      {archiveBeyannameler.length > 0 && availableYears.length > 0 && (
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
            Tümü ({archiveBeyannameler.length})
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

      {/* Beyanname Grup Listesi — Mikro Kartlar */}
      {archiveBeyannameler.length > 0 && (
        <BeyannameGroupList
          beyannameler={filteredBeyannameler}
          pdfLoading={null}
          onViewPdf={handleViewPdf}
          selectedCustomerId={selectedCustomerId}
          onHoverStart={handleHoverStart}
          unavailableBeyoids={unavailableBeyoids}
        />
      )}

      {/* Boş Durum — Henüz filtrelenmemiş */}
      {!archiveLoading && archiveBeyannameler.length === 0 && !filterDone && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-card p-12 text-muted-foreground">
          <Archive className="h-12 w-12 opacity-30" />
          <p className="text-center">
            Mükellef seçip <strong>Filtrele</strong> butonuna tıklayarak
            arşivdeki beyannameleri görüntüleyin.
          </p>
        </div>
      )}

      {/* Boş Durum — Filtrelendi ama sonuç yok */}
      {!archiveLoading && archiveBeyannameler.length === 0 && filterDone && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-card p-12 text-muted-foreground">
          <Archive className="h-12 w-12 opacity-30" />
          <p className="text-center">
            Seçilen mükellef için arşivde beyanname bulunamadı.
          </p>
        </div>
      )}

      {/* PDF Önizleme Dialog */}
      <PdfPreviewDialog data={pdfPreview} onClose={closePdfPreview} />
    </div>
  );
}
