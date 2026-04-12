/**
 * E-Arşiv Alış Faturaları Sayfası
 * ================================
 * Mükellef seçimi, dönem seçimi, sorgulama ve fatura tablosu.
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Receipt, Loader2, AlertTriangle, ExternalLink, Smartphone, Info, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DatePickerInput } from "@/components/ui/date-picker";
import { EarsivFaturaTable } from "./e-arsiv-fatura-table";
import { useEarsivQuery } from "./hooks/use-e-arsiv-query";
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
// Dönem Hesaplama — GİB Kuralı: Mevcut aydan önceki 2 aya kadar sorgulanabilir
// ═══════════════════════════════════════════════════════════════════════════

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** GİB limiti: 2 ay öncesinin 1'i → bugün */
function getGibDateLimits() {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // 2 ay öncesinin ayının 1'i
  let minMonth = now.getMonth() + 1 - 2; // 1-indexed
  let minYear = now.getFullYear();
  if (minMonth <= 0) {
    minMonth += 12;
    minYear -= 1;
  }
  const minDateStr = `${minYear}-${String(minMonth).padStart(2, "0")}-01`;

  return { minDate: minDateStr, maxDate: todayStr };
}

/** Varsayılan tarih aralığı: önceki ayın 1'i – son günü */
function getDefaultDateRange() {
  const now = new Date();
  let prevMonth = now.getMonth(); // 0-indexed önceki ay
  let prevYear = now.getFullYear();
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const lastDay = new Date(prevYear, prevMonth, 0).getDate();
  const startDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  const endDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startDate, endDate };
}

/** "2026-01-15" → "Ocak 2026" gibi dönem etiketi */
function getPeriodLabel(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return "";
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${MONTHS_TR[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${String(s.getDate()).padStart(2, "0")}.${String(s.getMonth() + 1).padStart(2, "0")}.${s.getFullYear()} - ${String(e.getDate()).padStart(2, "0")}.${String(e.getMonth() + 1).padStart(2, "0")}.${e.getFullYear()}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function EarsivFaturaPage() {
  // Müşteri listesi
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tarih aralığı seçimi — varsayılan: bir önceki ay
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const gibLimits = useMemo(() => getGibDateLimits(), []);
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);

  // E-Arşiv sorgu hook'u
  const {
    invoices,
    isLoading,
    progress,
    error,
    errorCode,
    totalCount,
    completedChunks,
    failedChunks,
    isPartialResult,
    startQuery,
    clearResults,
  } = useEarsivQuery();

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

  // UF-4: Filtrelenmiş müşteri listesi (searchable)
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

  // GİB bilgileri kontrolü (şifreler sayfasından gelen flag)
  const hasGibCredentials = selectedCustomer?.hasGibCredentials;

  // Sorgulama — tarih aralığı kontrolü ile
  const handleQuery = useCallback(async () => {
    if (!selectedCustomerId || isLoading) return;

    if (!startDate || !endDate) {
      toast.error("Başlangıç ve bitiş tarihi seçin.");
      return;
    }

    if (startDate > endDate) {
      toast.error("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
      return;
    }

    // GİB dönem sınırı ön kontrolü
    const { minDate, maxDate } = getGibDateLimits();
    if (startDate < minDate) {
      toast.error("Seçilen tarih GİB'in izin verdiği aralığın dışında. e-Arşiv sorgulaması yalnızca son 2 aya kadar yapılabilir.");
      return;
    }
    if (endDate > maxDate) {
      toast.error("Bitiş tarihi bugünden sonra olamaz.");
      return;
    }

    clearResults();
    await startQuery(selectedCustomerId, startDate, endDate);
  }, [selectedCustomerId, startDate, endDate, isLoading, startQuery, clearResults]);

  // Dönem etiketi (tablo ve export için)
  const periodLabel = useMemo(() => getPeriodLabel(startDate, endDate), [startDate, endDate]);

  return (
    <div className="flex flex-col h-full p-1">
      <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border/60 bg-card/50 shadow-sm overflow-hidden">
      {/* Başlık */}
      <div className="flex items-center gap-3 px-6 py-4 border-b">
        <Receipt className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">E-Arşiv Alış Faturaları</h1>
          <p className="text-sm text-muted-foreground">
            GİB Dijital Vergi Dairesi üzerinden e-Arşiv alış faturalarını sorgulayın
          </p>
        </div>
      </div>

      {/* GİB sorgulama limiti bilgisi */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-4 py-2 border-b">
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span>
          GİB e-Arşiv sorgulaması yalnızca içinde bulunulan aydan önceki 2 aya kadar yapılabilir.
        </span>
      </div>

      {/* Form */}
      <div className="space-y-3 px-6 py-4 border-b">
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

        {/* Satır 2: Tarih aralığı + Sorgula */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <DatePickerInput
              value={startDate}
              onChange={setStartDate}
              disabled={isLoading}
              placeholder="Başlangıç"
              minDate={gibLimits.minDate}
              maxDate={endDate || gibLimits.maxDate}
              className="h-9 w-[170px]"
            />
            <span className="text-muted-foreground text-sm">—</span>
            <DatePickerInput
              value={endDate}
              onChange={setEndDate}
              disabled={isLoading}
              placeholder="Bitiş"
              minDate={startDate || gibLimits.minDate}
              maxDate={gibLimits.maxDate}
              className="h-9 w-[170px]"
            />
          </div>

          {/* Sorgula butonu */}
          <Button
            onClick={handleQuery}
            disabled={!selectedCustomerId || isLoading || !hasGibCredentials || !startDate || !endDate}
            className="h-9"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sorgulanıyor...
              </>
            ) : (
              <>
                <Receipt className="h-4 w-4 mr-2" />
                Sorgula
              </>
            )}
          </Button>
        </div>
      </div>

      {/* İçerik alanı */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
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

      {/* Hata mesajı — UF-3: Auth hatasında mükellef linki */}
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

      {/* WR-6: Partial failure banner */}
      {isPartialResult && !isLoading && (
        failedChunks.some((c) => c.includes("tdvd.auth.servis.yetki.hata") || c.includes("yetkiniz bulunmamaktadır")) ? (
          <Alert variant="destructive">
            <AlertDescription className="flex items-start gap-2">
              <Smartphone className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <span className="font-medium">Cep Telefonu Güncelleme Gerekli: </span>
                Bu mükellefin GİB Dijital Vergi Dairesi hesabında cep telefonu numarası güncellenmesi isteniyor.
                Telefon güncellenmeden e-Arşiv faturaları sorgulanamaz.
                <a
                  href="https://dijital.gib.gov.tr/portal/telefon-no-guncelle"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center gap-1 underline hover:no-underline font-medium"
                >
                  GİB Dijital VD&apos;den telefon güncelleyin
                  <ExternalLink className="h-3 w-3" />
                </a>
              </span>
            </AlertDescription>
          </Alert>
        ) : failedChunks.some((c) => c.includes("önceki 2 aya kadar")) ? (
          <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30">
            <AlertDescription className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600" />
              <span>
                <span className="font-medium">Dönem sınırı: </span>
                Seçilen dönem GİB&apos;in izin verdiği aralığın dışında. e-Arşiv sorgulaması yalnızca son 2 aya kadar yapılabilir.
              </span>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30">
            <AlertDescription className="flex items-start gap-2 text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600" />
              <span>
                <span className="font-medium">Dikkat: </span>
                Bazı tarih aralıkları sorgulanamadı, sonuçlar eksik olabilir.
                <ul className="mt-1 list-disc list-inside text-xs">
                  {failedChunks.map((chunk, i) => {
                    const dateOnly = chunk.replace(/\s*\(.*\)$/, "");
                    return <li key={i}>{dateOnly}</li>;
                  })}
                </ul>
              </span>
            </AlertDescription>
          </Alert>
        )
      )}

      {/* Fatura Tablosu */}
      <EarsivFaturaTable
        invoices={invoices}
        isLoading={isLoading}
        customerName={selectedCustomer?.kisaltma || selectedCustomer?.unvan}
        periodLabel={periodLabel}
        failedChunks={failedChunks}
      />

      {/* Boş sonuç */}
      {!isLoading && invoices.length === 0 && completedChunks.length > 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Fatura bulunamadı</p>
          <p className="text-sm">
            Seçilen dönemde e-Arşiv alış faturası bulunmamaktadır
          </p>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
