/**
 * Tekli Beyanname Sorgulama Dialog
 * ==================================
 * Mükellef seçimi, dönem seçimi, sorgulama progress gösterimi.
 * Sorgulama bitince dialog kapanır ve arşiv sayfası ilgili mükellefi filtreler.
 */

"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Search,
  Loader2,
  ChevronsUpDown,
  Check,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { useBeyannameQuery } from "./hooks/use-beyanname-query";

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  onQueryComplete: (customerId: string) => void;
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
    basAy: String(1).padStart(2, "0"),
    basYil: String(previousYear),
    bitAy: String(previousMonth).padStart(2, "0"),
    bitYil: String(previousYear),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function BeyannameQueryDialog({
  open,
  onOpenChange,
  customers,
  onQueryComplete,
}: Props) {
  // Mükellef seçimi
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);

  // Dönem seçimi
  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);
  const [basAy, setBasAy] = useState(defaultPeriod.basAy);
  const [basYil, setBasYil] = useState(defaultPeriod.basYil);
  const [bitAy, setBitAy] = useState(defaultPeriod.bitAy);
  const [bitYil, setBitYil] = useState(defaultPeriod.bitYil);

  // Hook
  const {
    beyannameler,
    isLoading,
    error,
    errorCode,
    queryDone,
    savesComplete,
    startQuery,
    clearResults,
  } = useBeyannameQuery();

  // Auto-close ref
  const queryCompleteCalledRef = useRef(false);

  // Dialog açıldığında state sıfırla
  useEffect(() => {
    if (open) {
      setSelectedCustomerId("");
      setCustomerSearch("");
      setComboboxOpen(false);
      const dp = getDefaultPeriod();
      setBasAy(dp.basAy);
      setBasYil(dp.basYil);
      setBitAy(dp.bitAy);
      setBitYil(dp.bitYil);
      clearResults();
      queryCompleteCalledRef.current = false;
    }
  }, [open, clearResults]);

  // Auto-close: savesComplete olunca mesajı göster, 1.5s sonra yönlendir
  useEffect(() => {
    if (!open || queryCompleteCalledRef.current) return;
    if (savesComplete && beyannameler.length > 0 && selectedCustomerId) {
      queryCompleteCalledRef.current = true;
      const timer = setTimeout(() => {
        onOpenChange(false);
        onQueryComplete(selectedCustomerId);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [savesComplete, beyannameler.length, selectedCustomerId, open, onOpenChange, onQueryComplete]);

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

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  // Çoklu yıl kontrolü
  const isMultiYear = useMemo(() => basYil !== bitYil, [basYil, bitYil]);

  // Sorgula
  const handleQuery = useCallback(async () => {
    if (!selectedCustomerId) return;
    queryCompleteCalledRef.current = false;
    await startQuery(selectedCustomerId, basAy, basYil, bitAy, bitYil);
  }, [selectedCustomerId, basAy, basYil, bitAy, bitYil, startQuery]);

  // Dialog kapatma — sorgulama veya kaydetme sırasında engelle
  const isBusy = isLoading || (queryDone && beyannameler.length > 0 && !savesComplete);
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && isBusy) return;
      onOpenChange(newOpen);
    },
    [isBusy, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Beyanname Sorgula
            </DialogTitle>
            <DialogDescription>
              Mükellef ve dönem seçerek GİB üzerinden beyanname sorgulayın.
            </DialogDescription>
          </DialogHeader>

          {/* Mükellef Seçimi — Popover Combobox */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Mükellef</label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen} modal>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={isLoading}
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setComboboxOpen(true)}
                >
                  <span className={`truncate ${selectedCustomer ? "text-foreground" : "text-muted-foreground"}`}>
                    {selectedCustomer
                      ? `${selectedCustomer.kisaltma || selectedCustomer.unvan} · ${selectedCustomer.vknTckn}`
                      : "Mükellef ara veya seçin..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="p-0"
                style={{ width: "var(--radix-popover-trigger-width)" }}
                align="start"
                sideOffset={4}
              >
                <div className="p-2">
                  <Input
                    placeholder="Mükellef ara (ünvan, kısaltma veya VKN)..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="h-8"
                    autoFocus
                  />
                </div>
                <div className="max-h-[220px] overflow-y-auto">
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
                        <span className="truncate flex-1 text-left">{c.kisaltma || c.unvan}</span>
                        <span className="text-xs font-mono text-rose-500 dark:text-rose-400 shrink-0">
                          {c.vknTckn}
                        </span>
                        {!c.hasGibCredentials && (
                          <span className="text-[10px] text-destructive whitespace-nowrap shrink-0">GİB eksik</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* GİB bilgileri eksik uyarısı */}
          {selectedCustomer && !selectedCustomer.hasGibCredentials && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center gap-2">
                GİB Dijital Vergi Dairesi bilgileri eksik.
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

          {/* Dönem Seçimi */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Dönem</label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Select value={basAy} onValueChange={setBasAy} disabled={isLoading}>
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
                <Select value={basYil} onValueChange={setBasYil} disabled={isLoading}>
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
                <Select value={bitAy} onValueChange={setBitAy} disabled={isLoading}>
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
                <Select value={bitYil} onValueChange={setBitYil} disabled={isLoading}>
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

          {/* Çoklu Yıl Uyarı */}
          {isMultiYear && !isLoading && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>
                Çoklu yıl sorgulaması: {MONTHS_TR[parseInt(basAy) - 1]} {basYil} - {MONTHS_TR[parseInt(bitAy) - 1]} {bitYil}
              </span>
            </div>
          )}

          {/* Sorgulanıyor */}
          {(isLoading || (queryDone && beyannameler.length > 0 && !savesComplete)) && (
            <div className="flex items-center gap-2 rounded-lg border bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              <span>Sorgulanıyor...</span>
            </div>
          )}

          {/* Tamamlandı — yönlendiriliyor */}
          {savesComplete && beyannameler.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700 dark:border-green-600 dark:bg-green-950/30 dark:text-green-300">
              <Check className="h-4 w-4 flex-shrink-0" />
              <span>
                {beyannameler.length} beyanname bulundu. Arşive yönlendiriliyor...
              </span>
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

          {/* Sorgulama bittiğinde sonuç yok */}
          {queryDone && beyannameler.length === 0 && !error && (
            <div className="text-center text-sm text-muted-foreground py-2">
              Seçilen dönemde beyanname bulunamadı.
            </div>
          )}
        </div>

        <div className="border-t px-6 py-4 shrink-0 space-y-3">
          {isBusy && (
            <p className="text-xs text-muted-foreground text-center">
              Sorgulama ve kaydetme işlemi tamamlanana kadar bu pencere kapatılamaz.
              Pencereyi kapatırsanız veriler arşive kaydedilemez ve sorgulama sonuçları kaybolur.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
              {isBusy ? "İşlem Devam Ediyor..." : "Vazgeç"}
            </Button>
            <Button
              onClick={handleQuery}
              disabled={!selectedCustomerId || isBusy || !selectedCustomer?.hasGibCredentials}
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
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
