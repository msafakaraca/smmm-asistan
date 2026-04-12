"use client";

/**
 * Vergi Levhası Ana Sayfa Bileşeni
 * ==================================
 * Tüm mükelleflerin vergi levhası durumlarını listeler.
 * Sorgulama dialog'u ile toplu sorgulama yapılır.
 * Sorgulanmış mükelleflerin PDF'leri arka planda cache'lenir.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  FileCheck,
  Loader2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import VergiLevhasiPdfDialog from "./vergi-levhasi-pdf-dialog";
import type { VergiLevhasiPdfData } from "./vergi-levhasi-pdf-dialog";
import VergiLevhasiQueryDialog from "./vergi-levhasi-query-dialog";
import VergiLevhasiWhatsAppDialog from "./vergi-levhasi-whatsapp-dialog";
import BeyannameMailDialog from "@/components/beyannameler/beyanname-mail-dialog";
import { useVergiLevhasiQuery } from "./hooks/use-vergi-levhasi-query";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface InitialCustomerInfo {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  tcKimlikNo: string | null;
  sirketTipi: string;
  email: string | null;
  telefon1: string | null;
  lastVergiLevhasiQueryAt: string | null;
  vergiLevhasiOnayKodu: string | null;
  vergiLevhasiOnayZamani: string | null;
}

interface CustomerInfo extends InitialCustomerInfo {
  vergiLevhasiError: string | null;
}

type FilterType = "all" | "queried" | "not-queried";

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

interface VergiLevhasiClientProps {
  initialCustomers: InitialCustomerInfo[];
}

export default function VergiLevhasiClient({ initialCustomers }: VergiLevhasiClientProps) {
  // Mükellef state — server'dan gelen verilerle hazır başla
  const [customers, setCustomers] = useState<CustomerInfo[]>(() =>
    initialCustomers.map((c) => ({
      ...c,
      vergiLevhasiError: null,
    }))
  );

  // Filtre & arama
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialoglar
  const [queryDialogOpen, setQueryDialogOpen] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<VergiLevhasiPdfData | null>(null);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [whatsappDialog, setWhatsappDialog] = useState<{
    open: boolean;
    customer: CustomerInfo | null;
  }>({ open: false, customer: null });
  const [mailDialog, setMailDialog] = useState<{
    open: boolean;
    customer: CustomerInfo | null;
  }>({ open: false, customer: null });

  // PDF blob cache: customerId → blobUrl
  const blobCacheRef = useRef<Map<string, string>>(new Map());
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
  const [cacheProgress, setCacheProgress] = useState<{ done: number; total: number } | null>(null);
  const cacheAbortRef = useRef<AbortController | null>(null);

  // Hook
  const queryHook = useVergiLevhasiQuery();

  // Unmount'ta blob URL'leri temizle
  useEffect(() => {
    return () => {
      cacheAbortRef.current?.abort();
      for (const url of blobCacheRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      blobCacheRef.current.clear();
    };
  }, []);

  // Sorgulama tamamlandığında müşteri listesini güncelle
  useEffect(() => {
    if (queryHook.stage === "complete" && queryHook.results.length > 0) {
      setCustomers((prev) =>
        prev.map((c) => {
          const result = queryHook.results.find((r) => r.customerId === c.id);
          if (!result) return c;

          if (result.success) {
            return {
              ...c,
              lastVergiLevhasiQueryAt: new Date().toISOString(),
              vergiLevhasiOnayKodu: result.onayKodu || null,
              vergiLevhasiOnayZamani: result.onayZamani || null,
              vergiLevhasiError: null,
            };
          } else {
            return {
              ...c,
              lastVergiLevhasiQueryAt: new Date().toISOString(),
              vergiLevhasiError: result.error || "Hata",
            };
          }
        })
      );
    }
  }, [queryHook.stage, queryHook.results]);

  // ═══════════════════════════════════════════════════════════════════════
  // Arka planda tüm PDF'leri cache'le (batch signed URL + paralel indirme)
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const toCache = customers.filter(
      (c) => c.vergiLevhasiOnayKodu && !blobCacheRef.current.has(c.id)
    );
    if (toCache.length === 0) return;

    cacheAbortRef.current?.abort();
    const abort = new AbortController();
    cacheAbortRef.current = abort;

    setCacheProgress({ done: 0, total: toCache.length });

    const cacheAll = async () => {
      // 1) Tüm signed URL'leri tek istekte al
      const batchItems = toCache.map((c) => ({
        customerId: c.id,
        onayKodu: c.vergiLevhasiOnayKodu!,
      }));

      let urlMap: Map<string, string>;
      try {
        const res = await fetch("/api/intvrg/vergi-levhasi-pdf-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: batchItems }),
          signal: abort.signal,
        });
        if (!res.ok) { setCacheProgress(null); return; }
        const data = await res.json();
        urlMap = new Map(
          (data.results || [])
            .filter((r: { signedUrl: string | null }) => r.signedUrl)
            .map((r: { customerId: string; signedUrl: string }) => [r.customerId, r.signedUrl])
        );
      } catch {
        setCacheProgress(null);
        return;
      }

      if (abort.signal.aborted || urlMap.size === 0) { setCacheProgress(null); return; }

      // 2) PDF'leri 6'lı paralel indir
      let done = 0;
      let idx = 0;
      const downloadList = toCache.filter((c) => urlMap.has(c.id));
      const total = downloadList.length;
      setCacheProgress({ done: 0, total });

      const worker = async () => {
        while (idx < downloadList.length) {
          if (abort.signal.aborted) return;
          const current = idx++;
          const c = downloadList[current];
          const signedUrl = urlMap.get(c.id)!;
          try {
            const pdfRes = await fetch(signedUrl, { signal: abort.signal });
            if (!pdfRes.ok) continue;
            const blob = await pdfRes.blob();
            if (blob.size < 100) continue;

            const blobUrl = URL.createObjectURL(blob);
            blobCacheRef.current.set(c.id, blobUrl);
            done++;
            setCachedIds((prev) => new Set(prev).add(c.id));
            setCacheProgress({ done, total });
          } catch {
            // Abort veya network hatası
          }
        }
      };

      const concurrency = 6;
      const workers = Array.from({ length: Math.min(concurrency, downloadList.length) }, () => worker());
      await Promise.all(workers);

      if (!abort.signal.aborted) {
        setCacheProgress(null);
      }
    };

    cacheAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  // Filtrelenmiş mükelefler
  const filteredCustomers = useMemo(() => {
    let list = customers;

    if (filter === "queried") {
      list = list.filter((c) => c.vergiLevhasiOnayKodu);
    } else if (filter === "not-queried") {
      list = list.filter((c) => !c.vergiLevhasiOnayKodu && !c.vergiLevhasiError);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (c) =>
          c.unvan.toLowerCase().includes(term) ||
          (c.kisaltma && c.kisaltma.toLowerCase().includes(term)) ||
          c.vknTckn.includes(term)
      );
    }

    return list;
  }, [customers, filter, searchTerm]);

  // İstatistikler
  const stats = useMemo(() => {
    const total = customers.length;
    const queried = customers.filter((c) => c.vergiLevhasiOnayKodu).length;
    const failed = customers.filter((c) => c.vergiLevhasiError).length;
    const notQueried = total - queried - failed;
    return { total, queried, failed, notQueried };
  }, [customers]);

  // PDF görüntüle — cache'den anında veya fetch ile
  const handleViewPdf = useCallback(async (customer: CustomerInfo) => {
    if (!customer.vergiLevhasiOnayKodu) return;

    // Cache'de varsa anında aç
    const cached = blobCacheRef.current.get(customer.id);
    if (cached) {
      setPdfPreview({
        blobUrl: cached,
        customerName: customer.kisaltma || customer.unvan,
        onayZamani: customer.vergiLevhasiOnayZamani || "",
      });
      return;
    }

    // Cache'de yok — dialog'u loading ile aç
    setPdfPreview({
      blobUrl: null,
      customerName: customer.kisaltma || customer.unvan,
      onayZamani: customer.vergiLevhasiOnayZamani || "",
    });
    setPdfLoading(customer.id);

    try {
      const res = await fetch(
        `/api/intvrg/vergi-levhasi-pdf?customerId=${customer.id}&onayKodu=${customer.vergiLevhasiOnayKodu}`
      );
      const data = await res.json();

      if (!res.ok || !data.signedUrl) {
        toast.error(data.error || "PDF bulunamadı");
        setPdfPreview(null);
        return;
      }

      const pdfRes = await fetch(data.signedUrl);
      const blob = await pdfRes.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Cache'e ekle
      blobCacheRef.current.set(customer.id, blobUrl);
      setCachedIds((prev) => new Set(prev).add(customer.id));

      setPdfPreview({
        blobUrl,
        customerName: customer.kisaltma || customer.unvan,
        onayZamani: customer.vergiLevhasiOnayZamani || "",
      });
    } catch {
      toast.error("PDF yüklenirken hata oluştu");
      setPdfPreview(null);
    } finally {
      setPdfLoading(null);
    }
  }, []);

  // Sorgulama başlat
  const handleStartQuery = useCallback(
    (mukellefler: Array<{ customerId: string; vknTckn: string; tcKimlikNo: string | null; unvan: string; sirketTipi: string }>) => {
      queryHook.startQuery(mukellefler);
    },
    [queryHook]
  );

  return (
    <div className="flex flex-col h-full p-1">
      <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border/60 bg-card/50 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <FileCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Vergi Levhası</h1>
            <p className="text-sm text-muted-foreground">
              Mükelleflerin vergi levhalarını sorgulayın ve indirin
            </p>
          </div>
        </div>
        <Button onClick={() => setQueryDialogOpen(true)}>
          <FileCheck className="h-4 w-4 mr-2" />
          Sorgula
        </Button>
      </div>

      {/* İstatistik bar */}
      <div className="flex items-center gap-4 px-6 py-3 bg-muted/30 border-b text-sm">
        <span className="text-muted-foreground">Toplam: <strong>{stats.total}</strong></span>
        <span className="text-green-600">Sorgulanmış: <strong>{stats.queried}</strong></span>
        {stats.failed > 0 && (
          <span className="text-red-600">Hatalı: <strong>{stats.failed}</strong></span>
        )}
        <span className="text-gray-500">Sorgulanmamış: <strong>{stats.notQueried}</strong></span>
      </div>

      {/* Filtre & Arama */}
      <div className="flex items-center gap-3 px-6 py-3 border-b">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Mükellef ara..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(["all", "queried", "not-queried"] as FilterType[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all" && "Tümü"}
              {f === "queried" && "Sorgulanmış"}
              {f === "not-queried" && "Sorgulanmamış"}
            </Button>
          ))}
        </div>
      </div>

      {/* Mükellef Listesi */}
      <ScrollArea className="flex-1">
        {filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileCheck className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">
              {searchTerm ? "Aramayla eşleşen mükellef bulunamadı" : "Mükellef bulunamadı"}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredCustomers.map((c) => {
              const isClickable = !!c.vergiLevhasiOnayKodu;
              const isLoadingPdf = pdfLoading === c.id;
              const isCached = cachedIds.has(c.id);
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-4 px-6 py-3.5 transition-[colors,transform] ${
                    isClickable
                      ? "hover:bg-muted/50 cursor-pointer"
                      : "hover:bg-muted/30"
                  }`}
                  onClick={(e) => {
                    if (!isClickable || isLoadingPdf) return;
                    if ((e.target as HTMLElement).closest("button")) return;
                    handleViewPdf(c);
                  }}
                  onMouseDown={(e) => {
                    if (!isClickable) return;
                    if ((e.target as HTMLElement).closest("button")) return;
                    (e.currentTarget as HTMLElement).style.setProperty("transform", "scale(0.99)");
                  }}
                  onMouseUp={(e) => (e.currentTarget as HTMLElement).style.removeProperty("transform")}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.removeProperty("transform")}
                  title={isClickable ? `${c.kisaltma || c.unvan} - Vergi Levhası PDF görüntüle` : undefined}
                >
                  {/* Mükellef bilgisi */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {c.kisaltma || c.unvan}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(c.sirketTipi === "sahis" || c.sirketTipi === "basit_usul") && c.tcKimlikNo
                          ? c.tcKimlikNo
                          : c.vknTckn}
                      </span>
                    </div>
                    {/* Durum satırı */}
                    <div className="mt-0.5">
                      {c.vergiLevhasiOnayKodu ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Sorgulandı · {c.vergiLevhasiOnayZamani} · Onay: {c.vergiLevhasiOnayKodu}
                        </span>
                      ) : c.vergiLevhasiError ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          {c.vergiLevhasiError}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          Sorgulanmadı
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Aksiyon butonları — sadece sorgulanmış mükelleflerde */}
                  {c.vergiLevhasiOnayKodu && (
                    <div className="flex items-center gap-1 shrink-0">
                      {/* WhatsApp */}
                      <button
                        type="button"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-full shrink-0 transition-all duration-200 hover:bg-green-100 dark:hover:bg-green-900/30"
                        onClick={() => setWhatsappDialog({ open: true, customer: c })}
                        title="WhatsApp ile gönder"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="#4aba5a">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </button>

                      {/* Mail */}
                      <button
                        type="button"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-full shrink-0 transition-all duration-200 text-blue-500 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                        onClick={() => setMailDialog({ open: true, customer: c })}
                        title="Mail ile gönder"
                      >
                        <Mail className="h-5 w-5" />
                      </button>

                      {/* PDF İkonu — cache durumuna göre renk */}
                      <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full shrink-0 transition-colors ${
                        isCached ? "text-emerald-500" : "text-muted-foreground/40"
                      }`}>
                        {isLoadingPdf ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
      </div>

      {/* ─── Dialoglar ─── */}

      {/* Sorgulama dialog */}
      <VergiLevhasiQueryDialog
        open={queryDialogOpen}
        onOpenChange={setQueryDialogOpen}
        customers={customers}
        stage={queryHook.stage}
        progress={queryHook.progress}
        results={queryHook.results}
        error={queryHook.error}
        onStart={handleStartQuery}
        onReset={queryHook.reset}
      />

      {/* PDF preview — vergi levhasına özel küçük dialog */}
      <VergiLevhasiPdfDialog
        data={pdfPreview}
        onClose={() => {
          // Cache'deki blob URL'leri silme — tekrar kullanılacak
          setPdfPreview(null);
        }}
      />

      {/* WhatsApp dialog */}
      {whatsappDialog.customer && (
        <VergiLevhasiWhatsAppDialog
          open={whatsappDialog.open}
          onOpenChange={(open) => setWhatsappDialog((prev) => ({ ...prev, open }))}
          customerName={whatsappDialog.customer.kisaltma || whatsappDialog.customer.unvan}
          customerId={whatsappDialog.customer.id}
          customerTelefon1={whatsappDialog.customer.telefon1}
          onayKodu={whatsappDialog.customer.vergiLevhasiOnayKodu || ""}
          onayZamani={whatsappDialog.customer.vergiLevhasiOnayZamani || ""}
        />
      )}

      {/* Mail dialog */}
      {mailDialog.customer && (
        <BeyannameMailDialog
          open={mailDialog.open}
          onOpenChange={(open) => setMailDialog((prev) => ({ ...prev, open }))}
          item={{
            turKodu: "VL",
            turAdi: "Vergi Levhası",
            donem: "",
            donemFormatli: mailDialog.customer.vergiLevhasiOnayZamani || "",
            versiyon: "",
            kaynak: "",
            aciklama: "",
            beyoid: mailDialog.customer.vergiLevhasiOnayKodu || "",
          }}
          customerName={mailDialog.customer.kisaltma || mailDialog.customer.unvan}
          customerId={mailDialog.customer.id}
          customerEmail={mailDialog.customer.email}
        />
      )}
    </div>
  );
}
