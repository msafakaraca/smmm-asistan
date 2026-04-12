"use client";

/**
 * KdvDetayPage Component
 *
 * KDV Detay çizelgesi sayfası.
 * KDV tahakkuk ve beyanname takibi.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calculator, Info, CheckCircle, AlertCircle, Clock, XCircle, Edit3 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { KdvKontrolFilters } from "@/components/kdv-kontrol/kdv-kontrol-filters";
import { KdvKontrolTable } from "@/components/kdv-kontrol/kdv-kontrol-table";
import { useKdvKontrolData } from "@/components/kdv-kontrol/hooks/use-kdv-kontrol-data";
import { useRowSelection } from "@/hooks/use-row-selection";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { StatusChangeDialog, StatusOption } from "@/components/shared/status-change-dialog";
import type { KdvStatus } from "@/components/kdv-kontrol/types";

const KDV_STATUS_OPTIONS: StatusOption[] = [
  {
    value: "verildi",
    label: "Verildi",
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
    value: "verilmeyecek",
    label: "Verilmeyecek",
    icon: <XCircle className="h-4 w-4 text-red-600" />,
    color: "bg-red-100",
  },
];

export function KdvDetayPage() {
  const router = useRouter();

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
  } = useKdvKontrolData();

  const {
    selectedIds,
    isSelectionMode,
    selectedCount,
    toggleSelectionMode,
    toggleRow,
    selectAll,
    deselectAll,
    exitSelectionMode,
  } = useRowSelection();

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const handleBulkStatusUpdate = async (status: string) => {
    setIsBulkUpdating(true);
    try {
      const success = await bulkUpdateStatus(
        Array.from(selectedIds),
        status as KdvStatus
      );
      if (success) {
        setStatusDialogOpen(false);
        exitSelectionMode();
      }
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const allCustomerIds = filteredData.map((d) => d.customerId);

  return (
    <div className="flex flex-col h-full p-1">
      <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border/60 bg-card/50 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/kontrol-cizelgesi")}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Calculator className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">KDV Detay</h1>
            <p className="text-muted-foreground">
              KDV tahakkuk ve beyanname takibi
            </p>
          </div>
        </div>

        {/* Info Alert */}
        <div className="px-6 py-3 border-b flex-shrink-0">
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700">
              <strong>İpucu:</strong> Mükellefler sayfasında &quot;Gruplar&quot; butonundan KDV için özel bir grup oluşturabilirsiniz.
              Bu sayede sadece seçili mükelleflerin KDV dosyalarını filtreleyebilir ve işleyebilirsiniz.
            </AlertDescription>
          </Alert>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b flex-shrink-0">
          <KdvKontrolFilters
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

        {/* Table */}
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Calculator className="h-12 w-12 mb-4 opacity-50" />
              <p>Bu dönem için KDV veren mükellef bulunamadı.</p>
            </div>
          ) : (
            <KdvKontrolTable
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
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700"
            >
              <Edit3 className="h-4 w-4 mr-1.5" />
              Durum Değiştir
            </Button>
          </BulkActionBar>
        )}
      </div>

      {/* Status Change Dialog */}
      <StatusChangeDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        title="KDV Durumu Değiştir"
        description="Seçili kayıtların KDV kontrol durumunu toplu olarak değiştirin."
        selectedCount={selectedCount}
        statusOptions={KDV_STATUS_OPTIONS}
        onConfirm={handleBulkStatusUpdate}
        isLoading={isBulkUpdating}
      />
    </div>
  );
}
