"use client";

/**
 * SGK Kontrol Page Component
 *
 * Ana orchestrator component. Filter, tablo ve dialogları yönetir.
 * Sayfa sabit, sadece tablo kaydırılabilir.
 */

import { useState } from "react";
import { ShieldCheck, Info, CheckCircle, AlertCircle, Clock, XCircle, FileCheck, Edit3 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SgkKontrolFilters } from "./sgk-kontrol-filters";
import { SgkKontrolTable } from "./sgk-kontrol-table";
import { useSgkKontrolData } from "./hooks/use-sgk-kontrol-data";
import { useRowSelection } from "@/hooks/use-row-selection";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { StatusChangeDialog, StatusOption } from "@/components/shared/status-change-dialog";
import type { SgkStatus } from "./types";

// SGK Status Options for bulk update dialog
const SGK_STATUS_OPTIONS: StatusOption[] = [
  {
    value: "gonderildi",
    label: "Gönderildi",
    icon: <CheckCircle className="h-4 w-4 text-green-600" />,
    color: "bg-green-100",
  },
  {
    value: "eksik",
    label: "Eksik",
    icon: <AlertCircle className="h-4 w-4 text-yellow-600" />,
    color: "bg-yellow-100",
  },
  {
    value: "bekliyor",
    label: "Bekliyor",
    icon: <Clock className="h-4 w-4 text-gray-600" />,
    color: "bg-gray-100",
  },
  {
    value: "gonderilmeyecek",
    label: "Gönderilmeyecek",
    icon: <XCircle className="h-4 w-4 text-red-600" />,
    color: "bg-red-100",
  },
  {
    value: "dilekce_gonderildi",
    label: "Dilekçe Gönderildi",
    icon: <FileCheck className="h-4 w-4 text-purple-600" />,
    color: "bg-purple-100",
  },
];

export function SgkKontrolPage() {
  const {
    filteredData,
    stats,
    loading,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    searchTerm,
    setSearchTerm,
    sirketTipiFilter,
    setSirketTipiFilter,
    statusFilter,
    setStatusFilter,
    activeCardFilter,
    setActiveCardFilter,
    selectedGroupId,
    setSelectedGroupId,
    groups,
    updateStatus,
    bulkUpdateStatus,
    parseCustomer,
    parseAll,
    clearAll,
    isParsing,
    isParsingAll,
    isClearing,
  } = useSgkKontrolData();

  // Row selection for bulk actions
  const {
    selectedIds,
    isSelectionMode,
    selectedCount,
    toggleSelectionMode,
    toggleRow,
    selectAll,
    deselectAll,
    isSelected,
    exitSelectionMode,
  } = useRowSelection();

  // Bulk status dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Handle bulk status update
  const handleBulkStatusUpdate = async (status: string) => {
    setIsBulkUpdating(true);
    try {
      const success = await bulkUpdateStatus(
        Array.from(selectedIds),
        status as SgkStatus
      );
      if (success) {
        setStatusDialogOpen(false);
        exitSelectionMode();
      }
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Get customer IDs for select all
  const allCustomerIds = filteredData.map((d) => d.customerId);

  return (
    <div className="h-[calc(100vh-6rem)] xl:h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
      {/* Header - Sabit */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">SGK Kontrol Çizelgesi</h1>
          <p className="text-muted-foreground">
            MUHSGK beyannamelerinin SGK Tahakkuk ve Hizmet Listesi takibi
          </p>
        </div>
      </div>

      {/* Bilgi Kutusu - Sabit */}
      <Alert className="bg-blue-50 border-blue-200 mt-4 xl:mt-6 flex-shrink-0">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700">
          <strong>İpucu:</strong> Mükellefler sayfasında &quot;Gruplar&quot; butonundan MUHSGK için özel bir grup oluşturabilirsiniz.
          Bu sayede sadece seçili mükelleflerin SGK dosyalarını filtreleyebilir ve işleyebilirsiniz.
        </AlertDescription>
      </Alert>

      {/* Filters - Sabit */}
      <div className="mt-4 xl:mt-6 flex-shrink-0">
        <SgkKontrolFilters
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sirketTipiFilter={sirketTipiFilter}
          setSirketTipiFilter={setSirketTipiFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          activeCardFilter={activeCardFilter}
          setActiveCardFilter={setActiveCardFilter}
          selectedGroupId={selectedGroupId}
          setSelectedGroupId={setSelectedGroupId}
          groups={groups}
          onParseAll={parseAll}
          isParsingAll={isParsingAll}
          onClearAll={clearAll}
          isClearing={isClearing}
          stats={stats}
          isSelectionMode={isSelectionMode}
          onToggleSelectionMode={toggleSelectionMode}
        />
      </div>

      {/* Table - Kalan alanı doldurur, kendi içinde scroll yapar */}
      <div className="mt-4 xl:mt-6 flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mb-4 opacity-50" />
            <p>Bu dönem için MUHSGK veren mükellef bulunamadı.</p>
          </div>
        ) : (
          <SgkKontrolTable
            data={filteredData}
            onUpdateStatus={updateStatus}
            onParseCustomer={parseCustomer}
            isParsing={isParsing}
            isSelectionMode={isSelectionMode}
            selectedIds={selectedIds}
            onToggleRow={toggleRow}
          />
        )}
      </div>

      {/* Bulk Action Bar */}
      {isSelectionMode && (
        <BulkActionBar
          selectedCount={selectedCount}
          totalCount={filteredData.length}
          onSelectAll={() => selectAll(allCustomerIds)}
          onDeselectAll={deselectAll}
          onCancel={exitSelectionMode}
        >
          <Button
            size="sm"
            onClick={() => setStatusDialogOpen(true)}
            disabled={selectedCount === 0}
            className="h-9 px-4"
          >
            <Edit3 className="h-4 w-4 mr-1.5" />
            Durum Değiştir
          </Button>
        </BulkActionBar>
      )}

      {/* Status Change Dialog */}
      <StatusChangeDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        title="SGK Durumu Değiştir"
        description="Seçili kayıtların SGK kontrol durumunu toplu olarak değiştirin."
        selectedCount={selectedCount}
        statusOptions={SGK_STATUS_OPTIONS}
        onConfirm={handleBulkStatusUpdate}
        isLoading={isBulkUpdating}
      />
    </div>
  );
}
