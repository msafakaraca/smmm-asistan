/**
 * Toplu Beyanname Sorgulama Dialog — 3 Aşamalı
 * ==============================================
 * Aşama 1: Mükellef seçimi + dönem seçimi
 * Aşama 2: Sorgulama progress (dialog içinde)
 * Aşama 3: Tamamlandı — sonuç satırları tıklanabilir
 */

"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Play,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Loader2,
  Clock,
  Square,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CustomerResult } from "./hooks/use-bulk-query";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface Customer {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  hasGibCredentials: boolean;
  lastBeyannameQueryAt: string | null;
}

type BulkStatus = "idle" | "running" | "completed" | "cancelled";

interface BulkQueryState {
  status: BulkStatus;
  currentIndex: number;
  totalCount: number;
  currentCustomerName: string;
  progressMessage: string;
  customerResults: CustomerResult[];
  elapsedSeconds: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  bulkQueryState: BulkQueryState;
  onStart: (customerIds: string[], basAy: string, basYil: string, bitAy: string, bitYil: string) => void;
  onCancel: () => void;
  onReset: () => void;
  onCustomerClick: (customerId: string) => void;
}

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
    basAy: String(1).padStart(2, "0"),
    basYil: String(previousYear),
    bitAy: String(previousMonth).padStart(2, "0"),
    bitYil: String(previousYear),
  };
}

/** Geçen süre formatı */
function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}dk ${s}s` : `${s}s`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function BeyannameBulkQueryDialog({
  open,
  onOpenChange,
  customers,
  bulkQueryState,
  onStart,
  onCancel,
  onReset,
  onCustomerClick,
}: Props) {
  const [search, setSearch] = useState("");

  // Dönem seçimi — dialog kendi state'ini tutar
  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);
  const [basAy, setBasAy] = useState(defaultPeriod.basAy);
  const [basYil, setBasYil] = useState(defaultPeriod.basYil);
  const [bitAy, setBitAy] = useState(defaultPeriod.bitAy);
  const [bitYil, setBitYil] = useState(defaultPeriod.bitYil);

  // Aşama belirleme
  const phase = useMemo(() => {
    if (bulkQueryState.status === "running") return 2;
    if (bulkQueryState.status === "completed" || bulkQueryState.status === "cancelled") {
      if (bulkQueryState.customerResults.length > 0) return 3;
    }
    return 1;
  }, [bulkQueryState.status, bulkQueryState.customerResults.length]);

  // Sorgulanabilir = GİB bilgileri olan mükelefler
  const { queryable, noCredentials, alreadyQueried } = useMemo(() => {
    const queryable: Customer[] = [];
    const noCredentials: Customer[] = [];
    const alreadyQueried: Customer[] = [];

    for (const c of customers) {
      if (!c.hasGibCredentials) {
        noCredentials.push(c);
      } else {
        queryable.push(c);
        if (c.lastBeyannameQueryAt) {
          alreadyQueried.push(c);
        }
      }
    }

    return { queryable, noCredentials, alreadyQueried };
  }, [customers]);

  // Seçili mükelleflerin ID'leri
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog açıldığında seçimi sıfırla
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(customers.filter((c) => c.hasGibCredentials).map((c) => c.id)));
      setSearch("");
      // Dönem sadece phase 1'e dönüldüğünde sıfırlansın
      if (bulkQueryState.status === "idle") {
        const dp = getDefaultPeriod();
        setBasAy(dp.basAy);
        setBasYil(dp.basYil);
        setBitAy(dp.bitAy);
        setBitYil(dp.bitYil);
      }
    }
  }, [open, customers, bulkQueryState.status]);

  // Checkbox toggle
  const toggleCustomer = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Tümünü seç / kaldır
  const toggleAll = useCallback(() => {
    if (selectedIds.size === queryable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(queryable.map((c) => c.id)));
    }
  }, [selectedIds.size, queryable]);

  // Filtreleme
  const filteredQueryable = useMemo(() => {
    if (!search.trim()) return queryable;
    const s = search.toLowerCase();
    return queryable.filter(
      (c) =>
        c.unvan.toLowerCase().includes(s) ||
        (c.kisaltma && c.kisaltma.toLowerCase().includes(s)) ||
        c.vknTckn.includes(s)
    );
  }, [queryable, search]);

  // Dönem bilgisi
  const donemStr = useMemo(() => {
    const basAyNum = parseInt(basAy, 10) - 1;
    const bitAyNum = parseInt(bitAy, 10) - 1;
    if (basYil === bitYil && basAy === bitAy) {
      return `${MONTHS_TR[basAyNum]} ${basYil}`;
    }
    return `${MONTHS_TR[basAyNum]} ${basYil} - ${MONTHS_TR[bitAyNum]} ${bitYil}`;
  }, [basAy, basYil, bitAy, bitYil]);

  const handleStart = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    onStart(ids, basAy, basYil, bitAy, bitYil);
  }, [selectedIds, onStart, basAy, basYil, bitAy, bitYil]);

  // Satır tıklama — dialog kapanır, arşiv filtreler
  const handleResultClick = useCallback(
    (customerId: string) => {
      onReset();
      onOpenChange(false);
      onCustomerClick(customerId);
    },
    [onReset, onOpenChange, onCustomerClick]
  );

  // Dialog kapatma — sadece çalışmıyorsa
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && bulkQueryState.status === "running") return; // Çalışırken kapatma
      if (!newOpen) onReset();
      onOpenChange(newOpen);
    },
    [bulkQueryState.status, onReset, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Toplu Beyanname Sorgulama
            </DialogTitle>
            <DialogDescription>
              {phase === 1 && <>Dönem: <strong>{donemStr}</strong> — Sorgulanacak mükellefleri seçin.</>}
              {phase === 2 && <>Sorgulama devam ediyor...</>}
              {phase === 3 && <>Sorgulama tamamlandı. Arşivde görüntülemek için satıra tıklayın.</>}
            </DialogDescription>
          </DialogHeader>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* AŞAMA 1: Mükellef Seçimi + Dönem */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {phase === 1 && (
          <>
            {/* Dönem Seçimi */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Dönem</label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Select value={basAy} onValueChange={setBasAy}>
                    <SelectTrigger className="h-9 w-[100px]">
                      <SelectValue placeholder="Ay" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS_TR.map((m, i) => (
                        <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={basYil} onValueChange={setBasYil}>
                    <SelectTrigger className="h-9 w-[90px]">
                      <SelectValue placeholder="Yıl" />
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
                <span className="text-sm text-muted-foreground">—</span>
                <div className="flex items-center gap-1.5">
                  <Select value={bitAy} onValueChange={setBitAy}>
                    <SelectTrigger className="h-9 w-[100px]">
                      <SelectValue placeholder="Ay" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS_TR.map((m, i) => (
                        <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={bitYil} onValueChange={setBitYil}>
                    <SelectTrigger className="h-9 w-[90px]">
                      <SelectValue placeholder="Yıl" />
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
            </div>

            {/* Arama */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Mükellef ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>

            {/* Sorgulanacak Mükelleflerin Listesi */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Sorgulanacak ({selectedIds.size}/{queryable.length})
                </span>
                <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 text-xs">
                  {selectedIds.size === queryable.length ? "Tümünü Kaldır" : "Tümünü Seç"}
                </Button>
              </div>

              <ScrollArea className="h-[280px] rounded-md border">
                <div className="p-2 space-y-0.5">
                  {filteredQueryable.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      {search ? "Sonuç bulunamadı" : "Sorgulanabilir mükellef yok"}
                    </div>
                  ) : (
                    filteredQueryable.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedIds.has(c.id)}
                          onCheckedChange={() => toggleCustomer(c.id)}
                          className="shrink-0"
                        />
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="text-sm truncate">{c.kisaltma || c.unvan}</div>
                          <div className="text-xs text-muted-foreground font-mono">{c.vknTckn}</div>
                        </div>
                        {c.lastBeyannameQueryAt && (
                          <Badge variant="secondary" className="text-[10px] h-5 shrink-0 whitespace-nowrap">
                            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                            Sorgulanmış
                          </Badge>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Sorgulanamayacak Mükelleflerin Özeti */}
            {noCredentials.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-1">
                  <XCircle className="h-4 w-4" />
                  GİB Bilgileri Eksik ({noCredentials.length})
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5 max-h-[100px] overflow-y-auto">
                  {noCredentials.map((c) => (
                    <div key={c.id}>{c.kisaltma || c.unvan}</div>
                  ))}
                </div>
              </div>
            )}

            {alreadyQueried.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>{alreadyQueried.length} mükellef daha önce sorgulanmış. Tekrar sorgulamada sadece yeni beyannameler indirilir.</span>
              </div>
            )}

          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* AŞAMA 2: Sorgulama Progress */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {phase === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-blue-50 p-4 dark:bg-blue-950/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Toplu Sorgulama ({bulkQueryState.currentIndex + 1}/{bulkQueryState.totalCount})
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatElapsed(bulkQueryState.elapsedSeconds)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={onCancel}
                  >
                    <Square className="mr-1 h-3 w-3" />
                    İptal
                  </Button>
                </div>
              </div>
              {/* İlerleme çubuğu */}
              <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2">
                <div
                  className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round(((bulkQueryState.currentIndex + 1) / bulkQueryState.totalCount) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400">{bulkQueryState.progressMessage}</p>
            </div>

            {/* Anlık müşteri sonuçları */}
            {bulkQueryState.customerResults.length > 0 && (
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-2 space-y-1">
                  {bulkQueryState.customerResults.map((r) => (
                    <div key={r.customerId} className="flex items-center gap-2 text-xs px-2 py-1">
                      {r.success ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : r.error ? (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />
                      )}
                      <span className="truncate">{r.customerName}</span>
                      {r.success ? (
                        <span className="text-muted-foreground ml-auto shrink-0">
                          {r.beyannameCount} beyanname, {r.pdfDownloaded} PDF
                          {r.pdfSkipped > 0 && ` (${r.pdfSkipped} daha önce sorgulanmış)`}
                        </span>
                      ) : r.error ? (
                        <span className="text-destructive ml-auto shrink-0 truncate max-w-[200px]">
                          {r.error}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* AŞAMA 3: Tamamlandı — Tıklanabilir Sonuç Satırları */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {phase === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                {bulkQueryState.status === "cancelled" ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                {bulkQueryState.progressMessage}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatElapsed(bulkQueryState.elapsedSeconds)}
              </span>
            </div>

            <ScrollArea className="h-[350px] rounded-md border">
              <div className="p-1">
                {bulkQueryState.customerResults.map((r) => (
                  <button
                    key={r.customerId}
                    type="button"
                    className="flex w-full items-center gap-2 text-sm py-2 px-3 border-b last:border-0 cursor-pointer rounded-sm hover:bg-muted transition-colors text-left"
                    onClick={() => r.success && handleResultClick(r.customerId)}
                    disabled={!r.success}
                  >
                    {r.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <span className="truncate flex-1">{r.customerName}</span>
                    {r.success ? (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {r.beyannameCount} beyanname · {r.pdfDownloaded} PDF kaydedildi
                        {r.pdfSkipped > 0 && ` · ${r.pdfSkipped} daha önce sorgulanmış`}
                      </span>
                    ) : (
                      <span className="text-xs text-destructive shrink-0 truncate max-w-[250px]">
                        {r.error}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>

          </div>
        )}
        </div>{/* scroll wrapper kapanış */}

        {/* Footer — scroll dışında sabit */}
        <div className="border-t px-6 py-4 shrink-0">
          <DialogFooter>
            {phase === 1 && (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Vazgeç
                </Button>
                <Button
                  onClick={handleStart}
                  disabled={selectedIds.size === 0}
                >
                  <Play className="mr-2 h-4 w-4" />
                  {selectedIds.size} Mükellef Sorgula
                </Button>
              </>
            )}
            {phase === 3 && (
              <Button
                variant="outline"
                onClick={() => {
                  onReset();
                  onOpenChange(false);
                }}
              >
                <X className="mr-1 h-3 w-3" />
                Kapat
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
