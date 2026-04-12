"use client";

/**
 * Geçici Vergi Kontrol Table Component
 *
 * GGECICI/KGECICI tahakkuk bilgilerini gösteren tablo.
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
import type { GeciciVergiKontrolData, GeciciVergiStatus } from "./types";
import { GeciciVergiFilePopover } from "./gecici-vergi-file-popover";

// Virtual scrolling threshold
const VIRTUAL_THRESHOLD = 100;

// Status -> Background color map
const STATUS_BG_MAP: Record<GeciciVergiStatus, string> = {
  verildi: 'bg-green-100',
  eksik: 'bg-yellow-100',
  verilmeyecek: 'bg-red-100',
  bekliyor: '',
};

const STATUS_CONFIG: Record<GeciciVergiStatus, { icon: typeof CheckCircle; color: string; label: string }> = {
  verildi: {
    icon: CheckCircle,
    color: "bg-green-100 text-green-700",
    label: "Verildi",
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
  verilmeyecek: {
    icon: XCircle,
    color: "bg-red-100 text-red-700",
    label: "Verilmeyecek",
  },
};

interface GeciciVergiKontrolTableProps {
  data: GeciciVergiKontrolData[];
  onUpdateStatus: (customerId: string, status: GeciciVergiStatus, notes?: string) => void;
  vergiTuru: "GGECICI" | "KGECICI";
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
    minimumFractionDigits: 2,
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

// Vergilendirme dönemi formatı: "2025/10-2025/12"
const formatVergilendirmeDonemi = (vergilendirmeDonemi: string | null, year: number, month: number): string => {
  // Eğer parse'dan gelen vergilendirmeDonemi varsa, doğru formata çevir
  if (vergilendirmeDonemi) {
    // "10/2025-12/2025" → "2025/10-2025/12" formatına çevir
    const match = vergilendirmeDonemi.match(/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{4})/);
    if (match) {
      const [, startMonth, startYear, endMonth, endYear] = match;
      return `${startYear}/${startMonth.padStart(2, "0")}-${endYear}/${endMonth.padStart(2, "0")}`;
    }
    return vergilendirmeDonemi;
  }
  // Fallback: çeyrek son ayından başlangıç ayını hesapla
  const startMonth = month - 2;
  if (startMonth > 0) {
    return `${year}/${String(startMonth).padStart(2, "0")}-${year}/${String(month).padStart(2, "0")}`;
  }
  // Q1 durumu: Ocak önceki yıla taşabilir (edge case)
  const prevYear = year - 1;
  const adjustedStart = startMonth + 12;
  return `${prevYear}/${String(adjustedStart).padStart(2, "0")}-${year}/${String(month).padStart(2, "0")}`;
};

// Durum badge
const StatusBadge = memo(function StatusBadge({ status }: { status: GeciciVergiStatus }) {
  const { icon: Icon, color, label } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
});

export const GeciciVergiKontrolTable = memo(function GeciciVergiKontrolTable({
  data,
  onUpdateStatus,
  vergiTuru,
  isSelectionMode = false,
  selectedIds = new Set(),
  onToggleRow,
}: GeciciVergiKontrolTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const useVirtual = data.length > VIRTUAL_THRESHOLD;

  const [notDialogOpen, setNotDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<GeciciVergiKontrolData | null>(null);
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

  const paddingTop = useVirtual && virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom = useVirtual && virtualRows.length > 0
    ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
    : 0;

  const handleOpenNote = (item: GeciciVergiKontrolData) => {
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

  const matrahLabel = vergiTuru === "KGECICI" ? "Kurumlar V. Matrah" : "Gelir V. Matrah";
  const colCount = isSelectionMode ? 16 : 15;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="border-2 border-border rounded-lg overflow-hidden h-full flex flex-col">
        <div ref={parentRef} className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted/80 backdrop-blur-sm">
                {isSelectionMode && (
                  <th className="border border-border px-2 py-2 w-10 font-bold text-center sticky left-0 bg-muted/80 backdrop-blur-sm z-30">
                    <span className="sr-only">Seç</span>
                  </th>
                )}
                <th className={`border border-border px-3 py-2 w-14 font-bold text-center sticky ${isSelectionMode ? 'left-10' : 'left-0'} bg-muted/80 backdrop-blur-sm z-30`}>
                  No
                </th>
                <th className={`border border-border px-3 py-2 text-left font-bold w-56 sticky ${isSelectionMode ? 'left-[96px]' : 'left-14'} bg-muted/80 backdrop-blur-sm z-30`}>
                  Mükellef
                </th>
                <th className="border border-border px-3 py-2 w-40 font-bold text-center">
                  Dönem
                </th>
                <th className="border border-border px-3 py-2 w-24 font-bold text-center">
                  Beyan Tarihi
                </th>
                <th className="border border-border px-3 py-2 w-32 font-bold text-center">
                  {matrahLabel}
                </th>
                <th className="border border-border px-3 py-2 w-28 font-bold text-center">
                  Tahakkuk Eden
                </th>
                <th className="border border-border px-3 py-2 w-28 font-bold text-center">
                  Mahsup Edilen
                </th>
                <th className="border border-border px-3 py-2 w-28 font-bold text-center">
                  Ödenecek Vergi
                </th>
                <th className="border border-border px-3 py-2 w-28 font-bold text-center whitespace-nowrap">
                  1047 Damga V.
                </th>
                <th className="border border-border px-3 py-2 w-28 font-bold text-center whitespace-nowrap">
                  1048 Damga V.
                </th>
                <th className="border border-border px-3 py-2 w-32 font-bold text-center">
                  Toplam Ödenecek
                </th>
                <th className="border border-border px-3 py-2 w-24 font-bold text-center">
                  Vade
                </th>
                <th className="border border-border px-3 py-2 w-24 font-bold text-center">
                  Durum
                </th>
                <th className="border border-border px-1 py-2 w-[72px] font-bold text-center">
                  Dosya
                </th>
                <th className="border border-border px-1 py-2 w-[100px] font-bold text-center">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: paddingTop }} colSpan={colCount} />
                </tr>
              )}
              {rowsToRender.map((virtualRow) => {
                const index = "index" in virtualRow ? virtualRow.index : 0;
                const item = data[index];
                if (!item) return null;

                // Ödenecek Vergi = max(0, Tahakkuk Eden - Mahsup Edilen)
                const odenecekVergi = Math.max(0, (item.tahakkukEden ?? 0) - (item.mahsupEdilen ?? 0));
                // Toplam Ödenecek = Ödenecek Vergi + 1047 Damga + 1048 Damga
                const toplamOdenecek = odenecekVergi + (item.damgaVergisi1047 ?? 0) + (item.damgaVergisi1048 ?? 0);
                const hasOdenecek = toplamOdenecek > 0;
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
                    <td className={`border border-border px-3 py-2 sticky ${isSelectionMode ? 'left-[96px]' : 'left-14'} ${stickyBgClass}`}>
                      <div className="flex flex-col">
                        <span className="font-medium truncate max-w-[200px]">
                          {item.unvan}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.vknTckn}
                        </span>
                      </div>
                    </td>
                    <td className="border border-border px-3 py-2 text-center text-xs">
                      {formatVergilendirmeDonemi(item.vergilendirmeDonemi, item.year, item.month)}
                    </td>
                    <td className="border border-border px-3 py-2 text-center text-xs">
                      {formatDate(item.beyanTarihi)}
                    </td>
                    <td className="border border-border px-3 py-2 text-right text-xs font-medium">
                      {formatCurrency(item.matrah)}
                    </td>
                    <td className="border border-border px-3 py-2 text-right text-xs font-medium">
                      {formatCurrency(item.tahakkukEden)}
                    </td>
                    <td className="border border-border px-3 py-2 text-right text-xs font-medium">
                      {formatCurrency(item.mahsupEdilen)}
                    </td>
                    <td className="border border-border px-3 py-2 text-right text-xs font-bold">
                      {formatCurrency(odenecekVergi)}
                    </td>
                    <td className="border border-border px-3 py-2 text-right text-xs font-bold">
                      {formatCurrency(item.damgaVergisi1047)}
                    </td>
                    <td className="border border-border px-3 py-2 text-right text-xs font-bold">
                      {formatCurrency(item.damgaVergisi1048)}
                    </td>
                    <td className={`border border-border px-3 py-2 text-right text-xs font-bold ${
                      hasOdenecek ? 'text-green-700 bg-green-50' : ''
                    }`}>
                      {formatCurrency(toplamOdenecek)}
                    </td>
                    <td className="border border-border px-3 py-2 text-center text-xs">
                      {formatDate(item.vade)}
                    </td>
                    <td className="border border-border px-3 py-2 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="border border-border px-1 py-1">
                      <div className="flex items-center justify-center gap-1">
                        <GeciciVergiFilePopover
                          customerId={item.customerId}
                          year={item.year}
                          month={item.month}
                          fileCount={item.beyannameFileCount || 0}
                          fileCategory="BEYANNAME"
                          beyannameTuru={vergiTuru}
                        >
                          <button
                            type="button"
                            title="Beyanname"
                            className={`relative flex items-center justify-center h-6 w-6 rounded border font-bold text-xs transition-all hover:scale-110 ${(item.beyannameFileCount || 0) > 0
                              ? "border-emerald-500 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                              : "border-gray-300 bg-gray-50 text-gray-400"
                              }`}
                          >
                            B
                            {(item.beyannameFileCount || 0) > 0 && (
                              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-emerald-600 text-white text-[9px] font-bold">
                                {item.beyannameFileCount}
                              </span>
                            )}
                          </button>
                        </GeciciVergiFilePopover>
                        <GeciciVergiFilePopover
                          customerId={item.customerId}
                          year={item.year}
                          month={item.month}
                          fileCount={item.tahakkukFileCount || 0}
                          fileCategory="TAHAKKUK"
                          beyannameTuru={vergiTuru}
                        >
                          <button
                            type="button"
                            title="Tahakkuk"
                            className={`relative flex items-center justify-center h-6 w-6 rounded border font-bold text-xs transition-all hover:scale-110 ${(item.tahakkukFileCount || 0) > 0
                              ? "border-blue-500 bg-blue-50 text-blue-600 hover:bg-blue-100"
                              : "border-gray-300 bg-gray-50 text-gray-400"
                              }`}
                          >
                            T
                            {(item.tahakkukFileCount || 0) > 0 && (
                              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-bold">
                                {item.tahakkukFileCount}
                              </span>
                            )}
                          </button>
                        </GeciciVergiFilePopover>
                      </div>
                    </td>
                    <td className="border border-border px-1 py-1">
                      <div className="flex items-center justify-center gap-0.5">
                        {/* Not Ekle */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handleOpenNote(item)}
                              className={`h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors ${item.notes ? 'bg-amber-50 ring-1 ring-amber-300' : ''}`}
                            >
                              <MessageSquare className={`h-4 w-4 ${item.notes ? 'text-amber-600' : 'text-gray-500'}`} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{item.notes ? 'Not Düzenle' : 'Not Ekle'}</p>
                          </TooltipContent>
                        </Tooltip>

                        <div className="w-px h-4 bg-border mx-0.5" />

                        {/* Verildi */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(item.customerId, "verildi")}
                              className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${item.status === 'verildi' ? 'bg-green-100 ring-1 ring-green-500' : 'hover:bg-green-50'}`}
                            >
                              <CheckCircle className={`h-4 w-4 ${item.status === 'verildi' ? 'text-green-600' : 'text-green-400'}`} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><p>Verildi</p></TooltipContent>
                        </Tooltip>

                        {/* Eksik */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(item.customerId, "eksik")}
                              className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${item.status === 'eksik' ? 'bg-yellow-100 ring-1 ring-yellow-500' : 'hover:bg-yellow-50'}`}
                            >
                              <AlertCircle className={`h-4 w-4 ${item.status === 'eksik' ? 'text-yellow-600' : 'text-yellow-400'}`} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><p>Eksik</p></TooltipContent>
                        </Tooltip>

                        {/* Bekliyor */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(item.customerId, "bekliyor")}
                              className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${item.status === 'bekliyor' ? 'bg-gray-200 ring-1 ring-gray-500' : 'hover:bg-gray-100'}`}
                            >
                              <Clock className={`h-4 w-4 ${item.status === 'bekliyor' ? 'text-gray-600' : 'text-gray-400'}`} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><p>Bekliyor</p></TooltipContent>
                        </Tooltip>

                        {/* Verilmeyecek */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(item.customerId, "verilmeyecek")}
                              className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${item.status === 'verilmeyecek' ? 'bg-red-100 ring-1 ring-red-500' : 'hover:bg-red-50'}`}
                            >
                              <XCircle className={`h-4 w-4 ${item.status === 'verilmeyecek' ? 'text-red-600' : 'text-red-400'}`} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><p>Verilmeyecek</p></TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: paddingBottom }} colSpan={colCount} />
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
