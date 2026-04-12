"use client";

/**
 * MuhsgkDetayPage Component
 *
 * MUHSGK Detay çizelgesi sayfası.
 * SGK tahakkuk ve hizmet listesi takibi.
 * SgkKontrolPage componentini wrapper olarak kullanır, geri butonu ile.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, Info, CheckCircle, AlertCircle, Clock, XCircle, FileCheck, Edit3 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SgkKontrolFilters } from "@/components/sgk-kontrol/sgk-kontrol-filters";
import { SgkKontrolTable } from "@/components/sgk-kontrol/sgk-kontrol-table";
import { useSgkKontrolData } from "@/components/sgk-kontrol/hooks/use-sgk-kontrol-data";
import { useRowSelection } from "@/hooks/use-row-selection";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { StatusChangeDialog, StatusOption } from "@/components/shared/status-change-dialog";
import type { SgkStatus } from "@/components/sgk-kontrol/types";

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

export function MuhsgkDetayPage() {
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
  } = useSgkKontrolData();

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
          <ShieldCheck className="h-8 w-8 text-green-600" />
          <div>
            <h1 className="text-2xl font-bold">MUHSGK Detay</h1>
            <p className="text-muted-foreground">
              SGK tahakkuk ve hizmet listesi takibi
            </p>
          </div>
        </div>

        {/* Info Alert */}
        <div className="px-6 py-3 border-b flex-shrink-0">
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700">
              <strong>İpucu:</strong> Mükellefler sayfasında &quot;Gruplar&quot; butonundan MUHSGK için özel bir grup oluşturabilirsiniz.
              Bu sayede sadece seçili mükelleflerin SGK dosyalarını filtreleyebilir ve işleyebilirsiniz.
            </AlertDescription>
          </Alert>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b flex-shrink-0">
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

        {/* Table */}
        <div className="flex-1 min-h-0">
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
              className="h-9 px-4 bg-green-600 hover:bg-green-700"
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
