/**
 * E-Tebligat Sorgulama Sayfası
 * =============================
 * Mükellef seçimi, tebligat sorgulama, zarf açma ve PDF görüntüleme.
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { MailOpen, Loader2, AlertTriangle, ExternalLink, Info, ChevronsUpDown, Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EtebligatTable } from "./etebligat-table";
import { useEtebligatQuery } from "./hooks/use-etebligat-query";
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
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function EtebligatClient() {
  // Müşteri listesi
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Zarf açma onay dialog
  const [zarfDialogOpen, setZarfDialogOpen] = useState(false);
  const [pendingZarf, setPendingZarf] = useState<{ tarafId: string; tarafSecureId: string } | null>(null);

  // E-Tebligat sorgu hook'u
  const {
    tebligatlar,
    isLoading,
    progress,
    error,
    errorCode,
    totalCount,
    sayilar,
    zarfLoading,
    pdfLoading,
    startQuery,
    openZarf,
    viewPdf,
    clearResults,
  } = useEtebligatQuery();

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
    await startQuery(selectedCustomerId);
  }, [selectedCustomerId, isLoading, startQuery, clearResults]);

  // Zarf açma — önce dialog göster
  const handleOpenZarf = useCallback((tarafId: string, tarafSecureId: string) => {
    setPendingZarf({ tarafId, tarafSecureId });
    setZarfDialogOpen(true);
  }, []);

  // Zarf açma onayı
  const handleConfirmZarf = useCallback(async () => {
    if (!pendingZarf || !selectedCustomerId) return;
    setZarfDialogOpen(false);
    await openZarf(selectedCustomerId, pendingZarf.tarafId, pendingZarf.tarafSecureId);
    setPendingZarf(null);
  }, [pendingZarf, selectedCustomerId, openZarf]);

  // PDF görüntüleme
  const handleViewPdf = useCallback(
    (tebligId: string, tebligSecureId: string, tarafId: string, tarafSecureId: string) => {
      if (!selectedCustomerId) return;
      viewPdf(selectedCustomerId, tebligId, tebligSecureId, tarafId, tarafSecureId);
    },
    [selectedCustomerId, viewPdf]
  );

  // Sorgu yapılmış mı (sonuç veya hata varsa true)
  const hasQueried = tebligatlar.length > 0 || error !== null || (totalCount === 0 && !isLoading && progress.status === "Sorgulama tamamlandı");

  return (
    <div className="space-y-6 p-6">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <MailOpen className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">E-Tebligat Sorgulama</h1>
          <p className="text-sm text-muted-foreground">
            GİB Dijital Vergi Dairesi üzerinden e-Tebligatları sorgulayın
          </p>
        </div>
      </div>

      {/* Uyarı banner */}
      <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
        <AlertDescription className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <span className="font-medium">Dikkat: </span>
            Zarf açıldığında tebligat kalıcı olarak &quot;okundu&quot; işaretlenir. Bu işlem geri alınamaz.
          </span>
        </AlertDescription>
      </Alert>

      {/* Form */}
      <div className="space-y-3 p-4 bg-card border rounded-lg">
        {/* Mükellef Seçimi + Sorgula */}
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
                <MailOpen className="h-4 w-4 mr-2" />
                Sorgula
              </>
            )}
          </Button>
        </div>
      </div>

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

      {/* Sayı kartları (sorgulama sonrası) */}
      {sayilar && !isLoading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-card border rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <MailOpen className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Okunmuş</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{sayilar.okunmus}</p>
          </div>
          <div className="p-4 bg-card border rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-muted-foreground">Okunmamış</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{sayilar.okunmamis}</p>
          </div>
          <div className="p-4 bg-card border rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Info className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Arşivlenmiş</span>
            </div>
            <p className="text-2xl font-bold">{sayilar.arsivlenmis}</p>
          </div>
        </div>
      )}

      {/* Tebligat Tablosu */}
      <EtebligatTable
        tebligatlar={tebligatlar}
        isLoading={isLoading}
        customerName={selectedCustomer?.kisaltma || selectedCustomer?.unvan}
        zarfLoading={zarfLoading}
        pdfLoading={pdfLoading}
        onOpenZarf={handleOpenZarf}
        onViewPdf={handleViewPdf}
      />

      {/* Boş sonuç */}
      {!isLoading && tebligatlar.length === 0 && hasQueried && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <MailOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Tebligat bulunamadı</p>
          <p className="text-sm">
            Bu mükellefe ait e-Tebligat bulunmamaktadır
          </p>
        </div>
      )}

      {/* Zarf Açma Onay Dialog */}
      <AlertDialog open={zarfDialogOpen} onOpenChange={setZarfDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zarfı açmak istediğinize emin misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem geri alınamaz! Tebligat kalıcı olarak &quot;okundu&quot; olarak işaretlenecektir.
              Yasal süre hesaplaması bu tarihten itibaren başlayacaktır.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingZarf(null)}>
              İptal
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmZarf}>
              Zarfı Aç
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
