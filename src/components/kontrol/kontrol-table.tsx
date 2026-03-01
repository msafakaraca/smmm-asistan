/**
 * KontrolTable Component
 *
 * Beyanname takip tablosu wrapper'ı.
 * Kolon başlıkları ve müşteri satırlarını render eder.
 * Virtual scrolling ile 500+ satır performansı optimize edilmiş.
 */

import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Icon } from "@iconify/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { KontrolCustomerRow } from "./kontrol-customer-row";
import type {
  Customer,
  BeyannameTuru,
  BeyannameStatuses,
} from "./types";

interface KontrolTableProps {
  customers: Customer[];
  beyannameTurleri: BeyannameTuru[];
  beyannameStatuses: BeyannameStatuses;
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  onColumnSort: (kolKod: string) => void;
  sirketTipiFilter: string;
  setSirketTipiFilter: (tipi: string) => void;
  // Edit states
  editingSiraNo: string | null;
  editingSiraNoValue: string;
  editingUnvan: string | null;
  editingUnvanValue: string;
  // Handlers
  onSiraNoClick: (customerId: string, currentSiraNo: string | null) => void;
  onSiraNoChange: (value: string) => void;
  onSiraNoSave: (customerId: string) => void;
  onSiraNoCancel: () => void;
  onUnvanClick: (customerId: string, currentUnvan: string) => void;
  onUnvanChange: (value: string) => void;
  onUnvanSave: (customerId: string) => void;
  onUnvanCancel: () => void;
  onOpenCustomer: (customerId: string) => void;
  onDeleteCustomer: (customerId: string) => void;
  onLeftClick: (
    customerId: string,
    beyannameKod: string,
    currentStatus: string
  ) => void;
  onRightClick: (
    e: React.MouseEvent,
    customerId: string,
    beyannameKod: string
  ) => void;
  // Layout
  fullHeight?: boolean;
}

// Virtual scrolling threshold
const VIRTUAL_THRESHOLD = 200;

export const KontrolTable = memo(function KontrolTable({
  customers,
  beyannameTurleri,
  beyannameStatuses,
  sortColumn,
  sortDirection,
  onColumnSort,
  sirketTipiFilter,
  setSirketTipiFilter,
  editingSiraNo,
  editingSiraNoValue,
  editingUnvan,
  editingUnvanValue,
  onSiraNoClick,
  onSiraNoChange,
  onSiraNoSave,
  onSiraNoCancel,
  onUnvanClick,
  onUnvanChange,
  onUnvanSave,
  onUnvanCancel,
  onOpenCustomer,
  onDeleteCustomer,
  onLeftClick,
  onRightClick,
  fullHeight = false,
}: KontrolTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const useVirtual = customers.length > VIRTUAL_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: customers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
    enabled: useVirtual,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Virtual scrolling için padding hesapla
  const paddingTop = useVirtual && virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    useVirtual && virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  return (
    <div className={`border-2 border-border rounded-lg overflow-hidden ${fullHeight ? 'h-full flex flex-col' : ''}`}>
      <div ref={parentRef} className={`overflow-x-auto overflow-y-auto ${fullHeight ? 'flex-1' : 'max-h-[calc(100vh-280px)]'}`}>
        <table className="w-full text-xs border-separate border-spacing-0" data-print-table>
          <thead className="sticky top-0 z-20 bg-muted">
            <tr className="bg-muted">
              <th className="border border-border px-3 py-2 w-16 font-bold text-center bg-muted">
                No
              </th>
              <th className="border border-border px-2 py-1 text-left font-bold w-64 bg-muted">
                <div className="flex items-center gap-1">
                  <span>Mükellef</span>
                  <div className="flex gap-0.5 ml-auto">
                    <button
                      className={`text-[9px] px-1.5 py-0.5 rounded ${
                        sirketTipiFilter === "firma"
                          ? "bg-blue-600 text-white"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      }`}
                      onClick={() =>
                        setSirketTipiFilter(
                          sirketTipiFilter === "firma" ? "all" : "firma"
                        )
                      }
                    >
                      Firma
                    </button>
                    <button
                      className={`text-[9px] px-1.5 py-0.5 rounded ${
                        sirketTipiFilter === "sahis"
                          ? "bg-green-600 text-white"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      }`}
                      onClick={() =>
                        setSirketTipiFilter(
                          sirketTipiFilter === "sahis" ? "all" : "sahis"
                        )
                      }
                    >
                      Şahıs
                    </button>
                    <button
                      className={`text-[9px] px-1.5 py-0.5 rounded ${
                        sirketTipiFilter === "basit_usul"
                          ? "bg-amber-600 text-white"
                          : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      }`}
                      onClick={() =>
                        setSirketTipiFilter(
                          sirketTipiFilter === "basit_usul" ? "all" : "basit_usul"
                        )
                      }
                    >
                      Basit
                    </button>
                  </div>
                </div>
              </th>
              {beyannameTurleri.map((tur) => (
                <th
                  key={tur.kod}
                  className="border border-border px-2 py-2 font-bold text-center min-w-[48px] cursor-pointer hover:bg-muted/50 transition-colors sticky top-0 bg-muted"
                  onClick={() => onColumnSort(tur.kod)}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="cursor-pointer flex items-center justify-center gap-1 w-full">
                        <span>{tur.kisaAd || tur.kod}</span>
                        <Icon
                          icon="solar:sort-vertical-bold"
                          className={`h-3 w-3 ${
                            sortColumn === tur.kod
                              ? sortDirection === "asc"
                                ? "text-green-600"
                                : "text-amber-600"
                              : "text-muted-foreground/40"
                          }`}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{tur.aciklama}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Tıkla: Sırala
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {useVirtual ? (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: paddingTop }} colSpan={beyannameTurleri.length + 2} />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => {
                  const customer = customers[virtualRow.index];
                  return (
                    <KontrolCustomerRow
                      key={customer.id}
                      customer={customer}
                      index={virtualRow.index}
                      beyannameTurleri={beyannameTurleri}
                      customerStatuses={beyannameStatuses[customer.id] || {}}
                      editingSiraNo={editingSiraNo}
                      editingSiraNoValue={editingSiraNoValue}
                      editingUnvan={editingUnvan}
                      editingUnvanValue={editingUnvanValue}
                      onSiraNoClick={onSiraNoClick}
                      onSiraNoChange={onSiraNoChange}
                      onSiraNoSave={onSiraNoSave}
                      onSiraNoCancel={onSiraNoCancel}
                      onUnvanClick={onUnvanClick}
                      onUnvanChange={onUnvanChange}
                      onUnvanSave={onUnvanSave}
                      onUnvanCancel={onUnvanCancel}
                      onOpenCustomer={onOpenCustomer}
                      onDeleteCustomer={onDeleteCustomer}
                      onLeftClick={onLeftClick}
                      onRightClick={onRightClick}
                    />
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: paddingBottom }} colSpan={beyannameTurleri.length + 2} />
                  </tr>
                )}
              </>
            ) : (
              customers.map((customer, index) => (
                <KontrolCustomerRow
                  key={customer.id}
                  customer={customer}
                  index={index}
                  beyannameTurleri={beyannameTurleri}
                  customerStatuses={beyannameStatuses[customer.id] || {}}
                  editingSiraNo={editingSiraNo}
                  editingSiraNoValue={editingSiraNoValue}
                  editingUnvan={editingUnvan}
                  editingUnvanValue={editingUnvanValue}
                  onSiraNoClick={onSiraNoClick}
                  onSiraNoChange={onSiraNoChange}
                  onSiraNoSave={onSiraNoSave}
                  onSiraNoCancel={onSiraNoCancel}
                  onUnvanClick={onUnvanClick}
                  onUnvanChange={onUnvanChange}
                  onUnvanSave={onUnvanSave}
                  onUnvanCancel={onUnvanCancel}
                  onOpenCustomer={onOpenCustomer}
                  onDeleteCustomer={onDeleteCustomer}
                  onLeftClick={onLeftClick}
                  onRightClick={onRightClick}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {customers.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Icon
            icon="solar:clipboard-check-bold"
            className="h-12 w-12 mx-auto mb-4 opacity-20"
          />
          <p>Mükellef bulunamadı.</p>
        </div>
      )}
    </div>
  );
});
