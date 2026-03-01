"use client";

/**
 * GgeciciDetayPage Component
 *
 * Gelir Geçici Vergi (GGECICI) detay çizelgesi sayfası.
 * Şahıs mükellefleri için gelir geçici vergi tahakkuk takibi.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, TrendingUp, Info, CheckCircle, AlertCircle, Clock, XCircle, Edit3 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { GeciciVergiKontrolFilters } from "@/components/gecici-vergi-kontrol/gecici-vergi-kontrol-filters";
import { GeciciVergiKontrolTable } from "@/components/gecici-vergi-kontrol/gecici-vergi-kontrol-table";
import { useGeciciVergiKontrolData } from "@/components/gecici-vergi-kontrol/hooks/use-gecici-vergi-kontrol-data";
import { useRowSelection } from "@/hooks/use-row-selection";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { StatusChangeDialog, StatusOption } from "@/components/shared/status-change-dialog";
import type { GeciciVergiStatus } from "@/components/gecici-vergi-kontrol/types";

const STATUS_OPTIONS: StatusOption[] = [
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

export function GgeciciDetayPage() {
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
    statusFilter,
    setStatusFilter,
    activeCardFilter,
    setActiveCardFilter,
    selectedGroupId,
    setSelectedGroupId,
    groups,
    updateStatus,
    bulkUpdateStatus,
  } = useGeciciVergiKontrolData({ vergiTuru: "GGECICI" });

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
        status as GeciciVergiStatus
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
    <div className="h-[calc(100vh-6rem)] xl:h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/kontrol-cizelgesi")}
          className="h-10 w-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <TrendingUp className="h-8 w-8 text-teal-600" />
        <div>
          <h1 className="text-2xl font-bold">Gelir Geçici Vergi Detay</h1>
          <p className="text-muted-foreground">
            Gelir geçici vergi tahakkuk takibi (Şahıs mükellefleri)
          </p>
        </div>
      </div>

      {/* Info Alert */}
      <Alert className="bg-teal-50 border-teal-200 mt-4 xl:mt-6 flex-shrink-0">
        <Info className="h-4 w-4 text-teal-600" />
        <AlertDescription className="text-teal-700">
          <strong>Bilgi:</strong> Bu sayfa sadece <strong>şahıs</strong> ve <strong>basit usul</strong> mükelleflerin gelir geçici vergi (0032 GGV) tahakkuklarını gösterir.
          Çeyreklik dönemler: Q1 (Ocak-Mart), Q2 (Nisan-Haziran), Q3 (Temmuz-Eylül), Q4 (Ekim-Aralık).
        </AlertDescription>
      </Alert>

      {/* Filters */}
      <div className="mt-4 xl:mt-6 flex-shrink-0">
        <GeciciVergiKontrolFilters
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          activeCardFilter={activeCardFilter}
          setActiveCardFilter={setActiveCardFilter}
          selectedGroupId={selectedGroupId}
          setSelectedGroupId={setSelectedGroupId}
          groups={groups}
          stats={stats}
          isSelectionMode={isSelectionMode}
          onToggleSelectionMode={toggleSelectionMode}
        />
      </div>

      {/* Table */}
      <div className="mt-4 xl:mt-6 flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <TrendingUp className="h-12 w-12 mb-4 opacity-50" />
            <p>Bu dönem için gelir geçici vergi veren şahıs mükellef bulunamadı.</p>
          </div>
        ) : (
          <GeciciVergiKontrolTable
            data={filteredData}
            onUpdateStatus={updateStatus}
            vergiTuru="GGECICI"
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
            className="h-9 px-4 bg-teal-600 hover:bg-teal-700"
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
        title="Gelir Geçici Vergi Durumu Değiştir"
        description="Seçili kayıtların geçici vergi kontrol durumunu toplu olarak değiştirin."
        selectedCount={selectedCount}
        statusOptions={STATUS_OPTIONS}
        onConfirm={handleBulkStatusUpdate}
        isLoading={isBulkUpdating}
      />
    </div>
  );
}
