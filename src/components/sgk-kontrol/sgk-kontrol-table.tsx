"use client";

/**
 * SGK Kontrol Table Component
 *
 * SGK Tahakkuk ve Hizmet Listesi bilgilerini gösteren tablo.
 */

import { memo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { observeElementRectHeightOnly } from "@/lib/virtualizer-helpers";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  CheckCircle,
  AlertCircle,
  Clock,
  MessageSquare,
  XCircle,
  FileCheck,
  RefreshCw,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { SgkKontrolData, SgkStatus } from "./types";
import { SgkFilePopover } from "./sgk-file-popover";

// Virtual scrolling threshold
const VIRTUAL_THRESHOLD = 100;

// Status -> Background color map (sabit, component dışında)
const STATUS_BG_MAP: Record<SgkStatus, string> = {
  gonderildi: 'bg-green-100',
  dilekce_gonderildi: 'bg-purple-100',
  eksik: 'bg-yellow-100',
  gonderilmeyecek: 'bg-red-100',
  bekliyor: '',
};

// Status config for StatusBadge (sabit)
const STATUS_CONFIG: Record<SgkStatus, { icon: typeof CheckCircle; color: string; label: string }> = {
  gonderildi: {
    icon: CheckCircle,
    color: "bg-green-100 text-green-700",
    label: "Gönderildi",
  },
  eksik: {
    icon: AlertCircle,
    color: "bg-yellow-100 text-yellow-700",
    label: "Eksik",
  },
  bekliyor: {
    icon: Clock,
    color: "bg-gray-100 text-gray-700",
    label: "Bekliyor",
  },
  gonderilmeyecek: {
    icon: XCircle,
    color: "bg-red-100 text-red-700",
    label: "Gönderilmeyecek",
  },
  dilekce_gonderildi: {
    icon: FileCheck,
    color: "bg-purple-100 text-purple-700",
    label: "Dilekçe Gönderildi",
  },
};

interface SgkKontrolTableProps {
  data: SgkKontrolData[];
  onUpdateStatus: (customerId: string, status: SgkStatus, notes?: string) => void;
  onParseCustomer: (customerId: string) => void;
  isParsing: boolean;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleRow?: (id: string) => void;
}

// Para formatı
const formatCurrency = (value: number | null) => {
  if (value === null) return "-";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(value);
};

// Tarih formatı
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: tr });
  } catch {
    return "-";
  }
};

// Durum badge - memo ile optimize edildi
const StatusBadge = memo(function StatusBadge({ status }: { status: SgkStatus }) {
  const { icon: Icon, color, label } = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
});

export const SgkKontrolTable = memo(function SgkKontrolTable({
  data,
  onUpdateStatus,
  onParseCustomer,
  isParsing,
  isSelectionMode = false,
  selectedIds = new Set(),
  onToggleRow,
}: SgkKontrolTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const useVirtual = data.length > VIRTUAL_THRESHOLD;

  // Not dialogu
  const [notDialogOpen, setNotDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SgkKontrolData | null>(
    null
  );
  const [noteText, setNoteText] = useState("");

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
    enabled: useVirtual,
    observeElementRect: observeElementRectHeightOnly,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop =
    useVirtual && virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    useVirtual && virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  const handleOpenNote = (item: SgkKontrolData) => {
    setSelectedCustomer(item);
    setNoteText(item.notes || "");
    setNotDialogOpen(true);
  };

  const handleSaveNote = () => {
    if (selectedCustomer) {
      onUpdateStatus(selectedCustomer.customerId, selectedCustomer.status, noteText);
    }
    setNotDialogOpen(false);
    setSelectedCustomer(null);
  };

  const rowsToRender = useVirtual ? virtualRows : data.map((_, i) => ({ index: i }));

  return (
    <TooltipProvider delayDuration={0}>
      <div className="border-2 border-border rounded-lg overflow-hidden h-full flex flex-col">
        <div
          ref={parentRef}
          className="overflow-x-auto overflow-y-auto flex-1"
        >
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted/80 backdrop-blur-sm">
                {isSelectionMode && (
                  <th className="border border-border px-2 py-2 w-10 font-bold text-center sticky left-0 bg-muted/80 backdrop-blur-sm z-30">
                    <span className="sr-only">Seç</span>
                  </th>
                )}
                <th className={`border border-border px-3 py-2 w-16 font-bold text-center sticky ${isSelectionMode ? 'left-10' : 'left-0'} bg-muted/80 backdrop-blur-sm z-30`}>
                  No
                </th>
                <th className={`border border-border px-3 py-2 text-left font-bold w-64 sticky ${isSelectionMode ? 'left-[104px]' : 'left-16'} bg-muted/80 backdrop-blur-sm z-30`}>
                  Mükellef
                </th>
                <th className="border border-border px-3 py-2 w-24 font-bold text-center">
                  Dönem
                </th>
                <th className="border border-border px-3 py-2 w-28 font-bold text-center">
                  Beyan Tarihi
                </th>
                <th className="border border-border px-3 py-2 w-40 font-bold text-center">
                  Hizmet Listesi İşçi Sayısı
                </th>
                <th className="border border-border px-3 py-2 w-40 font-bold text-center">
                  Tahakkuk İşçi Sayısı
                </th>
                <th className="border border-border px-3 py-2 w-32 font-bold text-center">
                  Net Tutar
                </th>
                <th className="border border-border px-3 py-2 w-28 font-bold text-center">
                  Durum
                </th>
                <th className="border border-border px-1 py-2 w-[120px] font-bold text-center">
                  Dosyalar
                </th>
                <th className="border border-border px-1 py-2 w-[128px] font-bold text-center">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: paddingTop }} colSpan={isSelectionMode ? 11 : 10} />
                </tr>
              )}
              {rowsToRender.map((virtualRow) => {
                const index = "index" in virtualRow ? virtualRow.index : 0;
                const item = data[index];
                if (!item) return null;

                const isMatch =
                  item.hizmetIsciSayisi !== null &&
                  item.tahakkukIsciSayisi !== null &&
                  item.hizmetIsciSayisi === item.tahakkukIsciSayisi;

                const rowBgClass = STATUS_BG_MAP[item.status] || 'hover:bg-muted/50';
                const stickyBgClass = STATUS_BG_MAP[item.status] || 'bg-card';

                const isRowSelected = selectedIds.has(item.customerId);

                return (
                  <tr
                    key={item.customerId}
                    className={`${rowBgClass} ${isRowSelected ? 'ring-2 ring-inset ring-blue-500' : ''}`}
                  >
                    {isSelectionMode && (
                      <td className={`border border-border px-2 py-2 text-center sticky left-0 ${stickyBgClass}`}>
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => onToggleRow?.(item.customerId)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className={`border border-border px-3 py-2 text-center font-medium sticky ${isSelectionMode ? 'left-10' : 'left-0'} ${stickyBgClass}`}>
                      {item.siraNo || "-"}
                    </td>
                    <td className={`border border-border px-3 py-2 sticky ${isSelectionMode ? 'left-[104px]' : 'left-16'} ${stickyBgClass}`}>
                      <div className="flex flex-col">
                        <span className="font-medium truncate max-w-[200px]">
                          {item.unvan}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.vknTckn}
                        </span>
                      </div>
                    </td>
                    <td className="border border-border px-3 py-2 text-center">
                      {item.year}/{String(item.month).padStart(2, "0")}
                    </td>
                    <td className="border border-border px-3 py-2 text-center">
                      {formatDate(item.tahakkukKabulTarihi)}
                    </td>
                    <td className="border border-border px-3 py-2 text-center">
                      {item.hizmetIsciSayisi ?? "-"}
                    </td>
                    <td
                      className={`border border-border px-3 py-2 text-center ${isMatch
                        ? "text-green-600"
                        : item.tahakkukIsciSayisi !== null &&
                          item.hizmetIsciSayisi !== null
                          ? "text-red-600 font-bold"
                          : ""
                        }`}
                    >
                      {item.tahakkukIsciSayisi ?? "-"}
                    </td>
                    <td className="border border-border px-3 py-2 text-center font-medium">
                      {formatCurrency(item.tahakkukNetTutar)}
                    </td>
                    <td className="border border-border px-3 py-2 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="border border-border px-1 py-1">
                      <div className="flex items-center justify-center gap-0.5">
                        {/* MUHSGK Beyanname */}
                        <SgkFilePopover
                          customerId={item.customerId}
                          year={item.year}
                          month={item.month}
                          type="beyanname"
                          fileCount={item.beyannameFileCount || 0}
                        >
                          <button
                            type="button"
                            title="MUHSGK Beyanname"
                            className={`relative flex items-center justify-center h-6 w-6 rounded border font-bold text-xs transition-all hover:scale-110 ${(item.beyannameFileCount || 0) > 0
                              ? "border-amber-500 bg-amber-50 text-amber-600 hover:bg-amber-100"
                              : "border-gray-300 bg-gray-50 text-gray-400"
                              }`}
                          >
                            B
                            {(item.beyannameFileCount || 0) > 0 && (
                              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-amber-600 text-white text-[9px] font-bold">
                                {item.beyannameFileCount}
                              </span>
                            )}
                          </button>
                        </SgkFilePopover>
                        {/* Tahakkuk */}
                        <SgkFilePopover
                          customerId={item.customerId}
                          year={item.year}
                          month={item.month}
                          type="muhsgk_tahakkuk"
                          fileCount={item.muhsgkTahakkukFileCount || 0}
                        >
                          <button
                            type="button"
                            title="Tahakkuk"
                            className={`relative flex items-center justify-center h-6 w-6 rounded border font-bold text-xs transition-all hover:scale-110 ${(item.muhsgkTahakkukFileCount || 0) > 0
                              ? "border-violet-500 bg-violet-50 text-violet-600 hover:bg-violet-100"
                              : "border-gray-300 bg-gray-50 text-gray-400"
                              }`}
                          >
                            T
                            {(item.muhsgkTahakkukFileCount || 0) > 0 && (
                              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-violet-600 text-white text-[9px] font-bold">
                                {item.muhsgkTahakkukFileCount}
                              </span>
                            )}
                          </button>
                        </SgkFilePopover>
                        {/* SGK Tahakkuk */}
                        <SgkFilePopover
                          customerId={item.customerId}
                          year={item.year}
                          month={item.month}
                          type="tahakkuk"
                          fileCount={item.tahakkukFileCount || 0}
                        >
                          <button
                            type="button"
                            title="SGK Tahakkuk Fişi"
                            className={`relative flex items-center justify-center h-6 w-6 rounded border font-bold text-xs transition-all hover:scale-110 ${(item.tahakkukFileCount || 0) > 0
                              ? "border-blue-500 bg-blue-50 text-blue-600 hover:bg-blue-100"
                              : "border-gray-300 bg-gray-50 text-gray-400"
                              }`}
                          >
                            S
                            {(item.tahakkukFileCount || 0) > 0 && (
                              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-bold">
                                {item.tahakkukFileCount}
                              </span>
                            )}
                          </button>
                        </SgkFilePopover>
                        {/* Hizmet Listesi */}
                        <SgkFilePopover
                          customerId={item.customerId}
                          year={item.year}
                          month={item.month}
                          type="hizmet"
                          fileCount={item.hizmetFileCount || 0}
                        >
                          <button
                            type="button"
                            title="Hizmet Listesi"
                            className={`relative flex items-center justify-center h-6 w-6 rounded border font-bold text-xs transition-all hover:scale-110 ${(item.hizmetFileCount || 0) > 0
                              ? "border-green-500 bg-green-50 text-green-600 hover:bg-green-100"
                              : "border-gray-300 bg-gray-50 text-gray-400"
                              }`}
                          >
                            H
                            {(item.hizmetFileCount || 0) > 0 && (
                              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-green-600 text-white text-[9px] font-bold">
                                {item.hizmetFileCount}
                              </span>
                            )}
                          </button>
                        </SgkFilePopover>
                      </div>
                    </td>
                    <td className="border border-border px-1 py-1">
                      <div className="flex items-center justify-center gap-0.5">
                        {/* Dosyalardan Çek */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onParseCustomer(item.customerId)}
                              disabled={isParsing}
                              className="h-6 w-6 flex items-center justify-center rounded hover:bg-blue-100 transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className={`h-4 w-4 text-blue-600 ${isParsing ? 'animate-spin' : ''}`} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Dosyalardan Çek</p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Not Ekle */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handleOpenNote(item)}
                              className={`h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors ${item.notes ? 'bg-amber-50 ring-1 ring-amber-300' : ''
                                }`}
                            >
                              <MessageSquare className={`h-4 w-4 ${item.notes ? 'text-amber-600' : 'text-gray-500'}`} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{item.notes ? 'Not Düzenle' : 'Not Ekle'}</p>
                          </TooltipContent>
                        </Tooltip>

                        <div className="w-px h-4 bg-border mx-0.5" />

                        {/* Gönderildi */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(item.customerId, "gonderildi")}
                              className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${item.status === 'gonderildi'
                                ? 'bg-green-100 ring-1 ring-green-500'
                                : 'hover:bg-green-50'
                                }`}
                            >
                              <CheckCircle className={`h-4 w-4 ${item.status === 'gonderildi' ? 'text-green-600' : 'text-green-400'
                                }`} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Gönderildi</p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Eksik */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(item.customerId, "eksik")}
                              className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${item.status === 'eksik'
                                ? 'bg-yellow-100 ring-1 ring-yellow-500'
                                : 'hover:bg-yellow-50'
                                }`}
                            >
                              <AlertCircle className={`h-4 w-4 ${item.status === 'eksik' ? 'text-yellow-600' : 'text-yellow-400'
                                }`} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Eksik</p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Bekliyor */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(item.customerId, "bekliyor")}
                              className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${item.status === 'bekliyor'
                                ? 'bg-gray-200 ring-1 ring-gray-500'
                                : 'hover:bg-gray-100'
                                }`}
                            >
                              <Clock className={`h-4 w-4 ${item.status === 'bekliyor' ? 'text-gray-600' : 'text-gray-400'
                                }`} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Bekliyor</p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Gönderilmeyecek */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(item.customerId, "gonderilmeyecek")}
                              className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${item.status === 'gonderilmeyecek'
                                ? 'bg-red-100 ring-1 ring-red-500'
                                : 'hover:bg-red-50'
                                }`}
                            >
                              <XCircle className={`h-4 w-4 ${item.status === 'gonderilmeyecek' ? 'text-red-600' : 'text-red-400'
                                }`} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Gönderilmeyecek</p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Dilekçe Gönderildi */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(item.customerId, "dilekce_gonderildi")}
                              className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${item.status === 'dilekce_gonderildi'
                                ? 'bg-purple-100 ring-1 ring-purple-500'
                                : 'hover:bg-purple-50'
                                }`}
                            >
                              <FileCheck className={`h-4 w-4 ${item.status === 'dilekce_gonderildi' ? 'text-purple-600' : 'text-purple-400'
                                }`} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Dilekçe Gönderildi</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: paddingBottom }} colSpan={isSelectionMode ? 11 : 10} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Not Dialog */}
      <Dialog open={notDialogOpen} onOpenChange={setNotDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Not Ekle - {selectedCustomer?.unvan}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Not giriniz..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSaveNote}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
});
