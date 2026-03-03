/**
 * KontrolPage Component
 *
 * Ana orchestrator bileşeni.
 * Tüm hook'ları ve alt bileşenleri koordine eder.
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";
import { toast } from "@/components/ui/sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTerminal } from "@/context/terminal-context";

// Lazy load heavy modal
const BotReportModal = dynamic(
  () => import("@/components/kontrol/bot-report-modal").then(mod => ({ default: mod.BotReportModal })),
  { ssr: false }
);
import type { GibBotResult } from "@/types/gib";

// Components
import { KontrolHeader } from "./kontrol-header";
import { KontrolBotPanel } from "./kontrol-bot-panel";
import { KontrolFilters } from "./kontrol-filters";
import { KontrolTable } from "./kontrol-table";
import { KontrolStatsDisplay } from "./kontrol-stats";
import { AddCustomerDialog } from "./dialogs/add-customer-dialog";

// Hooks
import { useKontrolData } from "./hooks/use-kontrol-data";
import { useBotConnection } from "./hooks/use-bot-connection";
import { useBeyannameEdit } from "./hooks/use-beyanname-edit";

// Types
import type { Customer, DeclarationStatus, BeyannameStatusMeta } from "./types";

const aylar = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export function KontrolPage() {
  const terminal = useTerminal();

  // Data hook
  const {
    customers,
    filteredCustomers,
    beyannameTurleri,
    activeBeyannameTurleri,
    beyannameStatuses,
    botInfo,
    gibCode,
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
  } = useKontrolData();

  // Bot connection hook
  const {
    syncStatus,
    setSyncStatus,
    beyannameler,
    unmatchedDeclarations,
    startBot,
  } = useBotConnection({
    onComplete: (data) => {
      setReportData(data);
      setReportModalOpen(true);
      fetchTakipData();
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  // Beyanname edit hook
  const editHook = useBeyannameEdit({
    customers,
    setCustomers,
  });

  // UI states
  const [showSettings, setShowSettings] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportData, setReportData] = useState<GibBotResult | null>(null);

  // Bot settings
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const [startDate, setStartDate] = useState(
    `${lastMonthYear}-${String(lastMonth + 1).padStart(2, "0")}-01`
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [usePeriodFilter, setUsePeriodFilter] = useState(false);
  const [donemBasAy, setDonemBasAy] = useState(lastMonth + 1);
  const [donemBasYil, setDonemBasYil] = useState(lastMonthYear);
  const [donemBitAy, setDonemBitAy] = useState(lastMonth + 1);
  const [donemBitYil, setDonemBitYil] = useState(lastMonthYear);
  const [shouldDownloadFiles, setShouldDownloadFiles] = useState(true);

  // Sorting states
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Sorted customers
  const sortedCustomers = useMemo(() => {
    let sorted = [...filteredCustomers];

    // Önce sıra numarasına göre sırala
    sorted.sort((a, b) => {
      const aNum = parseInt(a.siraNo || "9999", 10);
      const bNum = parseInt(b.siraNo || "9999", 10);
      return aNum - bNum;
    });

    // Kolon sıralaması
    if (sortColumn) {
      sorted.sort((a, b) => {
        const aStatus = beyannameStatuses[a.id]?.[sortColumn]?.status || "bos";
        const bStatus = beyannameStatuses[b.id]?.[sortColumn]?.status || "bos";

        const statusOrder: Record<string, number> = {
          onaylandi: 0, verildi: 0, dilekce_verildi: 1,
          onay_bekliyor: 2, dilekce_gonderilecek: 3,
          verilmedi: 4, bos: 5, gonderilmeyecek: 6,
          "3aylik": 2, muaf: 6,
        };
        const aOrder = statusOrder[aStatus] ?? 5;
        const bOrder = statusOrder[bStatus] ?? 5;

        return sortDirection === "asc" ? aOrder - bOrder : bOrder - aOrder;
      });
    }

    return sorted;
  }, [filteredCustomers, sortColumn, sortDirection, beyannameStatuses]);

  // Handlers
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

  const handleSync = useCallback(async () => {
    startBot({
      startDate,
      endDate,
      donemBasAy: usePeriodFilter ? donemBasAy : undefined,
      donemBasYil: usePeriodFilter ? donemBasYil : undefined,
      donemBitAy: usePeriodFilter ? donemBitAy : undefined,
      donemBitYil: usePeriodFilter ? donemBitYil : undefined,
      downloadFiles: shouldDownloadFiles,
    });
  }, [startBot, startDate, endDate, usePeriodFilter, donemBasAy, donemBasYil, donemBitAy, donemBitYil, shouldDownloadFiles]);

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

  const handleReportClose = useCallback(() => {
    setReportModalOpen(false);
    setReportData(null);
    fetchTakipData();
  }, [fetchTakipData]);

  const handleLeftClick = useCallback(
    async (customerId: string, beyannameKod: string, currentStatus: string) => {
      const customer = customers.find((c) => c.id === customerId);
      if (customer?.verilmeyecekBeyannameler?.includes(beyannameKod)) {
        return;
      }
      if (currentStatus === "gonderilmeyecek") return;

      // Toggle: verildi/onaylandi ↔ bos
      const newStatus: DeclarationStatus =
        (currentStatus === "verildi" || currentStatus === "onaylandi") ? "bos" : "verildi";
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

      try {
        const res = await fetch(`/api/customers/${customerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verilmeyecekBeyannameler: newMuaflar }),
        });

        if (res.ok) {
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === customerId
                ? { ...c, verilmeyecekBeyannameler: newMuaflar }
                : c
            )
          );
          toast.success(isMuaf ? "Muafiyet kaldırıldı" : "Muaf yapıldı");
        }
      } catch {
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
    <div className="space-y-6">
      {/* Header */}
      <KontrolHeader
        syncStatus={syncStatus}
        botInfo={botInfo}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        onSync={handleSync}
        onClearList={handleClearList}
        onRenumberAll={editHook.handleRenumberAll}
        onAddCustomer={() => setShowAddModal(true)}
        onPrint={handlePrint}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      {/* Bot Report Modal */}
      <BotReportModal
        isOpen={reportModalOpen}
        onClose={handleReportClose}
        data={reportData}
      />

      {/* Add Customer Dialog */}
      <AddCustomerDialog
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddCustomer}
      />

      {/* Bot Settings Panel */}
      <KontrolBotPanel
        isOpen={showSettings}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        usePeriodFilter={usePeriodFilter}
        setUsePeriodFilter={setUsePeriodFilter}
        donemBasAy={donemBasAy}
        setDonemBasAy={setDonemBasAy}
        donemBasYil={donemBasYil}
        setDonemBasYil={setDonemBasYil}
        donemBitAy={donemBitAy}
        setDonemBitAy={setDonemBitAy}
        donemBitYil={donemBitYil}
        setDonemBitYil={setDonemBitYil}
        shouldDownloadFiles={shouldDownloadFiles}
        setShouldDownloadFiles={setShouldDownloadFiles}
        gibCode={gibCode}
      />

      {/* Beyanname Takip Çizelgesi */}
      <Card className="border-2 border-primary/20">
        <CardHeader
          className="cursor-pointer"
          onClick={() => setIsPanelOpen(!isPanelOpen)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Icon icon="solar:clipboard-check-bold" className="h-5 w-5 text-primary" />
                Beyanname Takip Çizelgesi
              </CardTitle>
              <CardDescription>
                {aylar[selectedMonth - 1]} {selectedYear} - Mükelleflerin beyanname durumlarını takip edin
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <KontrolStatsDisplay stats={stats} />
              {isPanelOpen ? (
                <Icon icon="solar:alt-arrow-up-linear" className="h-5 w-5" />
              ) : (
                <Icon icon="solar:alt-arrow-down-linear" className="h-5 w-5" />
              )}
            </div>
          </div>
        </CardHeader>

        {isPanelOpen && (
          <CardContent className="space-y-4">
            {/* Filters */}
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
            />

            {/* Table */}
            {customersLoading ? (
              <div className="flex items-center justify-center h-64">
                <Icon icon="solar:refresh-bold" className="h-8 w-8 animate-spin text-muted-foreground" />
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
                editingSiraNo={editHook.editingSiraNo}
                editingSiraNoValue={editHook.editingSiraNoValue}
                editingUnvan={editHook.editingUnvan}
                editingUnvanValue={editHook.editingUnvanValue}
                onSiraNoClick={editHook.handleSiraNoClick}
                onSiraNoChange={editHook.setEditingSiraNoValue}
                onSiraNoSave={editHook.handleSiraNoSave}
                onSiraNoCancel={() => editHook.setEditingSiraNo(null)}
                onUnvanClick={editHook.handleUnvanClick}
                onUnvanChange={editHook.setEditingUnvanValue}
                onUnvanSave={editHook.handleUnvanSave}
                onUnvanCancel={() => editHook.setEditingUnvan(null)}
                onOpenCustomer={handleOpenCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                onLeftClick={handleLeftClick}
                onRightClick={handleRightClick}
              />
            )}

            {/* Footer Legend */}
            <div className="flex items-center justify-end gap-4 text-[10px] font-medium text-muted-foreground">
              <span>Sol tık: Durum değiştir</span>
              <span>Sağ tık: Gönderilmeyecek</span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Results Table from GIB Sync */}
      {beyannameler.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bulunan Beyannameler ({beyannameler.length})</CardTitle>
            <CardDescription>
              {startDate} - {endDate} tarihleri arasındaki onaylı beyannameler
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Beyanname Türü</th>
                    <th className="text-left p-2">TC/VKN</th>
                    <th className="text-left p-2">Ad Soyad/Unvan</th>
                    <th className="text-left p-2">Dönem</th>
                  </tr>
                </thead>
                <tbody>
                  {beyannameler.slice(0, 20).map((b, i) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="p-2">{b.beyannameTuru}</td>
                      <td className="p-2 font-mono">{b.tcVkn}</td>
                      <td className="p-2">{(b.adSoyadUnvan || "").substring(0, 40)}</td>
                      <td className="p-2">{b.vergilendirmeDonemi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {beyannameler.length > 20 && (
                <p className="text-sm text-muted-foreground mt-2">
                  ... ve {beyannameler.length - 20} kayıt daha
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unmatched Declarations */}
      {unmatchedDeclarations.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Icon icon="solar:danger-triangle-bold" className="h-5 w-5" />
              Eşleştirilemeyen Beyannameler ({unmatchedDeclarations.length})
            </CardTitle>
            <CardDescription>
              Aşağıdaki beyannameler sistemdeki mükelleflerle eşleştirilemedi. VKN/TCKN bilgilerini kontrol edin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-amber-50 dark:bg-amber-950/20">
                    <th className="text-left p-2">Beyanname Türü</th>
                    <th className="text-left p-2">TC/VKN</th>
                    <th className="text-left p-2">Ad Soyad/Unvan</th>
                    <th className="text-left p-2">Dönem</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedDeclarations.map((b, i) => (
                    <tr key={i} className="border-b hover:bg-amber-50/50 dark:hover:bg-amber-950/10">
                      <td className="p-2">{b.beyannameTuru}</td>
                      <td className="p-2 font-mono font-semibold text-amber-700 dark:text-amber-400">
                        {b.tcVkn}
                      </td>
                      <td className="p-2">{b.adSoyadUnvan.substring(0, 40)}</td>
                      <td className="p-2">{b.vergilendirmeDonemi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {syncStatus === "idle" && beyannameler.length === 0 && customers.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <Icon icon="solar:clipboard-check-bold" className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-2">Beyanname Senkronizasyonu</h3>
            <p className="text-muted-foreground mb-4">
              GİB E-Beyanname sisteminden onaylı beyannameleri çekmek için yukarıdaki butona tıklayın.
            </p>
            {botInfo.lastSync && (
              <p className="text-xs text-muted-foreground">
                Son senkronizasyon: {new Date(botInfo.lastSync).toLocaleString("tr-TR")}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
