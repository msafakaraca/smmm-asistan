"use client";

/**
 * BeyannameTakipPage Component
 *
 * Beyanname Takip çizelgesi sayfası.
 * Mükelleflerin beyanname durumlarını takip eder.
 * URL parametreleri ile dönem seçimi destekler (?year=2025&month=11)
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { ClipboardCheck } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBotResult } from "@/context/bot-result-context";
import { PageHeader } from "./page-header";
import { KontrolFilters } from "@/components/kontrol/kontrol-filters";
import { KontrolTable } from "@/components/kontrol/kontrol-table";
import { KontrolStatsDisplay } from "@/components/kontrol/kontrol-stats";
import { AddCustomerDialog } from "@/components/kontrol/dialogs/add-customer-dialog";
import { useKontrolData } from "@/components/kontrol/hooks/use-kontrol-data";
import type { Customer, DeclarationStatus } from "@/components/kontrol/types";

const aylar = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export function BeyannameTakipPage() {
  const botResult = useBotResult();
  const searchParams = useSearchParams();

  // URL'den dönem parametrelerini oku (GİB bot yönlendirmesi için)
  const urlYear = searchParams.get("year");
  const urlMonth = searchParams.get("month");

  const {
    customers,
    filteredCustomers,
    beyannameTurleri,
    activeBeyannameTurleri,
    beyannameStatuses,
    stats,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    searchTerm,
    setSearchTerm,
    sirketTipiFilter,
    setSirketTipiFilter,
    customersLoading,
    fetchCustomers,
    fetchTakipData,
    updateBeyannameStatus,
    setCustomers,
    setBeyannameStatuses,
  } = useKontrolData({
    initialYear: urlYear ? parseInt(urlYear, 10) : undefined,
    initialMonth: urlMonth ? parseInt(urlMonth, 10) : undefined,
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUnvan, setEditingUnvan] = useState<string | null>(null);
  const [editingUnvanValue, setEditingUnvanValue] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    if (botResult.hasPendingResult) {
      const result = botResult.consumeResult();
      if (result) {
        toast.success(`${result.stats?.matched || 0} beyanname eşleştirildi`);
        fetchTakipData();
      }
    }
  }, [botResult, fetchTakipData]);

  const sortedCustomers = useMemo(() => {
    let sorted = [...filteredCustomers];

    sorted.sort((a, b) => {
      const aNum = parseInt(a.siraNo || "9999", 10);
      const bNum = parseInt(b.siraNo || "9999", 10);
      return aNum - bNum;
    });

    if (sortColumn) {
      sorted.sort((a, b) => {
        const aStatus = beyannameStatuses[a.id]?.[sortColumn]?.status || "bos";
        const bStatus = beyannameStatuses[b.id]?.[sortColumn]?.status || "bos";

        const statusOrder = { verildi: 0, "3aylik": 1, bos: 2, muaf: 3 };
        const aOrder = statusOrder[aStatus as keyof typeof statusOrder] ?? 2;
        const bOrder = statusOrder[bStatus as keyof typeof statusOrder] ?? 2;

        return sortDirection === "asc" ? aOrder - bOrder : bOrder - aOrder;
      });
    }

    return sorted;
  }, [filteredCustomers, sortColumn, sortDirection, beyannameStatuses]);

  const handleColumnSort = useCallback((kolKod: string) => {
    setSortColumn((prev) => {
      if (prev === kolKod) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        return kolKod;
      }
      setSortDirection("asc");
      return kolKod;
    });
  }, []);

  const handleUnvanClick = useCallback((customerId: string, currentUnvan: string) => {
    setEditingUnvan(customerId);
    setEditingUnvanValue(currentUnvan);
  }, []);

  const handleUnvanSave = useCallback(async (customerId: string) => {
    if (!editingUnvanValue.trim()) {
      setEditingUnvan(null);
      return;
    }

    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unvan: editingUnvanValue.trim() }),
      });

      if (res.ok) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customerId ? { ...c, unvan: editingUnvanValue.trim() } : c
          )
        );
        toast.success("Ünvan güncellendi");
      } else {
        toast.error("Güncelleme başarısız");
      }
    } catch {
      toast.error("Bir hata oluştu");
    }

    setEditingUnvan(null);
  }, [editingUnvanValue, setCustomers]);

  const handleClearList = useCallback(async () => {
    if (!confirm("Tüm beyanname durumları temizlenecek. Devam?")) return;
    try {
      const res = await fetch(
        `/api/beyanname-takip?year=${selectedYear}&month=${selectedMonth}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setBeyannameStatuses({});
        toast.success("Liste temizlendi");
      }
    } catch {
      toast.error("Temizleme başarısız");
    }
  }, [selectedYear, selectedMonth, setBeyannameStatuses]);

  const handleLeftClick = useCallback(
    async (customerId: string, beyannameKod: string, currentStatus: string) => {
      const customer = customers.find((c) => c.id === customerId);
      if (customer?.verilmeyecekBeyannameler?.includes(beyannameKod)) {
        return;
      }

      const newStatus: DeclarationStatus = currentStatus === "verildi" ? "bos" : "verildi";
      try {
        await updateBeyannameStatus(customerId, beyannameKod, newStatus);
      } catch {
        toast.error("Güncelleme başarısız");
      }
    },
    [customers, updateBeyannameStatus]
  );

  const handleRightClick = useCallback(
    async (e: React.MouseEvent, customerId: string, beyannameKod: string) => {
      e.preventDefault();
      const customer = customers.find((c) => c.id === customerId);
      if (!customer) return;

      const currentMuaflar = customer.verilmeyecekBeyannameler || [];
      const isMuaf = currentMuaflar.includes(beyannameKod);
      const newMuaflar = isMuaf
        ? currentMuaflar.filter((k) => k !== beyannameKod)
        : [...currentMuaflar, beyannameKod];

      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerId
            ? { ...c, verilmeyecekBeyannameler: newMuaflar }
            : c
        )
      );

      try {
        const res = await fetch(`/api/customers/${customerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verilmeyecekBeyannameler: newMuaflar }),
        });

        if (!res.ok) {
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === customerId
                ? { ...c, verilmeyecekBeyannameler: currentMuaflar }
                : c
            )
          );
          toast.error("Güncelleme başarısız");
        }
      } catch {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customerId
              ? { ...c, verilmeyecekBeyannameler: currentMuaflar }
              : c
          )
        );
        toast.error("Güncelleme başarısız");
      }
    },
    [customers, setCustomers]
  );

  const handleDeleteCustomer = useCallback(
    async (customerId: string) => {
      if (!confirm("Bu mükellef silinecek. Devam?")) return;
      try {
        const res = await fetch(`/api/customers/${customerId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setCustomers((prev) => prev.filter((c) => c.id !== customerId));
          toast.success("Mükellef silindi");
        } else {
          const err = await res.json();
          toast.error(err.error || "Silme başarısız");
        }
      } catch {
        toast.error("Bir hata oluştu");
      }
    },
    [setCustomers]
  );

  const handleOpenCustomer = useCallback((customerId: string) => {
    window.open(`/dashboard/mukellefler/${customerId}`, "_blank");
  }, []);

  const handleAddCustomer = useCallback((customer: Customer) => {
    setCustomers((prev) => [...prev, customer]);
  }, [setCustomers]);

  const handlePrint = useCallback(() => {
    const printTable = document.querySelector("[data-print-table]");
    if (!printTable) {
      toast.error("Yazdırılacak tablo bulunamadı");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup engelleyici aktif olabilir");
      return;
    }
    printWindow.document.write(`
      <html>
      <head>
        <title>Beyanname Takip - ${aylar[selectedMonth - 1]} ${selectedYear}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; }
          th { background: #f5f5f5; font-weight: bold; }
          .bg-green-100 { background: #d1fae5 !important; }
          .bg-zinc-600 { background: #52525b !important; color: white; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { size: landscape; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <h2 style="text-align: center; margin-bottom: 20px;">Beyanname Takip - ${aylar[selectedMonth - 1]} ${selectedYear}</h2>
        ${printTable.outerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  }, [selectedMonth, selectedYear]);

  return (
    <div className="h-[calc(100vh-6rem)] xl:h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <PageHeader
          title="Beyanname Takip"
          description="Mükelleflerin beyanname durumlarını takip edin"
          icon={ClipboardCheck}
          iconColor="text-primary"
        />

        {/* Sağ taraf: Dönem seçici ve butonlar */}
        <div className="flex flex-wrap items-center gap-2 xl:gap-4">
          {/* Dönem Seçici */}
          <div className="flex items-center gap-2">
            <Icon icon="solar:calendar-bold" className="h-5 w-5 text-muted-foreground" />
            <Select
              value={String(selectedMonth)}
              onValueChange={(v) => setSelectedMonth(Number(v))}
            >
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aylar.map((ay, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {ay}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger className="w-[90px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <KontrolStatsDisplay stats={stats} />

          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Icon icon="solar:printer-bold" className="h-4 w-4" />
            Yazdır
          </Button>
          <Button
            variant="outline"
            onClick={handleClearList}
            className="gap-2 text-destructive hover:text-destructive"
          >
            <Icon icon="solar:trash-bin-trash-bold" className="h-4 w-4" />
            Temizle
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="gap-2">
            <Icon icon="solar:user-plus-bold" className="h-4 w-4" />
            Mükellef Ekle
          </Button>
        </div>
      </div>

      {/* Add Customer Dialog */}
      <AddCustomerDialog
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddCustomer}
      />

      {/* Filters */}
      <div className="mt-4 xl:mt-6 flex-shrink-0">
        <KontrolFilters
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          sirketTipiFilter={sirketTipiFilter}
          setSirketTipiFilter={setSirketTipiFilter}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onRefresh={fetchCustomers}
          isLoading={customersLoading}
          hideDatePicker
        />
      </div>

      {/* Table */}
      <div className="mt-4 xl:mt-6 flex-1 min-h-0">
        {customersLoading ? (
          <div className="flex items-center justify-center h-full">
            <Icon icon="solar:refresh-bold" className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Icon icon="solar:users-group-rounded-bold" className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-2">Henüz Mükellef Yok</h3>
            <p className="text-muted-foreground mb-4">
              Çizelgeyi görüntülemek için önce mükellef eklemeniz gerekiyor.
            </p>
            <Button onClick={() => setShowAddModal(true)} className="gap-2">
              <Icon icon="solar:user-plus-bold" className="h-4 w-4" />
              Mükellef Ekle
            </Button>
          </div>
        ) : (
          <KontrolTable
            customers={sortedCustomers}
            beyannameTurleri={activeBeyannameTurleri}
            beyannameStatuses={beyannameStatuses}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onColumnSort={handleColumnSort}
            sirketTipiFilter={sirketTipiFilter}
            setSirketTipiFilter={setSirketTipiFilter}
            editingSiraNo={null}
            editingSiraNoValue=""
            editingUnvan={editingUnvan}
            editingUnvanValue={editingUnvanValue}
            onSiraNoClick={() => {}}
            onSiraNoChange={() => {}}
            onSiraNoSave={() => {}}
            onSiraNoCancel={() => {}}
            onUnvanClick={handleUnvanClick}
            onUnvanChange={setEditingUnvanValue}
            onUnvanSave={handleUnvanSave}
            onUnvanCancel={() => setEditingUnvan(null)}
            onOpenCustomer={handleOpenCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onLeftClick={handleLeftClick}
            onRightClick={handleRightClick}
            fullHeight
          />
        )}
      </div>

      {/* Footer Legend */}
      <div className="flex items-center justify-between gap-4 text-[10px] font-medium text-muted-foreground py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <a
            href="/dashboard/beyanname-kontrol"
            className="text-primary hover:underline flex items-center gap-1"
          >
            <Icon icon="solar:link-bold" className="h-3 w-3" />
            GİB Senkronizasyonu
          </a>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-background border-2 border-border rounded" />
            Sol Tık: Değiştir
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-zinc-600 border-2 border-border rounded" />
            Sağ Tık: Muaf/Var
          </div>
        </div>
      </div>
    </div>
  );
}
