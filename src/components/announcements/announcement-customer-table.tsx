"use client";

import React, { useMemo, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import type { AnnouncementCustomer } from "./types";
import { SIRKET_TIPLERI } from "./types";

interface AnnouncementCustomerTableProps {
  customers: AnnouncementCustomer[];
  isLoading?: boolean;
  selectedIds: Set<string>;
  onRowSelect: (customerId: string) => void;
  onSelectAll: () => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;
}

export function AnnouncementCustomerTable({
  customers,
  isLoading = false,
  selectedIds,
  onRowSelect,
  onSelectAll,
  isAllSelected,
  isSomeSelected,
}: AnnouncementCustomerTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // Get sirket tipi label
  const getSirketTipiLabel = (value: string) => {
    const tip = SIRKET_TIPLERI.find((t) => t.value === value);
    return tip?.label || value;
  };

  // Columns
  const columns = useMemo<ColumnDef<AnnouncementCustomer>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <Checkbox
            checked={isAllSelected}
            ref={(el) => {
              if (el) {
                // @ts-expect-error - indeterminate is a valid property on HTMLInputElement
                el.indeterminate = isSomeSelected && !isAllSelected;
              }
            }}
            onCheckedChange={onSelectAll}
            aria-label="Tümünü seç"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={() => onRowSelect(row.original.id)}
            aria-label={`${row.original.unvan} seç`}
          />
        ),
        size: 40,
        enableSorting: false,
      },
      {
        accessorKey: "unvan",
        header: "Ünvan",
        cell: ({ row }) => (
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-foreground truncate">
              {row.original.kisaltma || row.original.unvan}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {row.original.vknTckn}
            </span>
          </div>
        ),
        size: 200,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <div className="flex items-center gap-2 min-w-0">
            {row.original.email ? (
              <>
                <Icon icon="solar:letter-bold" className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {row.original.email}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground italic">Email yok</span>
            )}
          </div>
        ),
        size: 200,
      },
      {
        accessorKey: "telefon1",
        header: "Telefon",
        cell: ({ row }) => (
          <div className="flex flex-col min-w-0 gap-0.5">
            {row.original.telefon1 ? (
              <div className="flex items-center gap-1.5">
                <Icon icon="solar:phone-bold" className="w-3.5 h-3.5 text-green-500 shrink-0" />
                <span className="text-sm text-muted-foreground">{row.original.telefon1}</span>
              </div>
            ) : null}
            {row.original.telefon2 ? (
              <div className="flex items-center gap-1.5">
                <Icon icon="solar:phone-bold" className="w-3.5 h-3.5 text-green-400 shrink-0" />
                <span className="text-xs text-muted-foreground">{row.original.telefon2}</span>
              </div>
            ) : null}
            {!row.original.telefon1 && !row.original.telefon2 && (
              <span className="text-xs text-muted-foreground italic">Telefon yok</span>
            )}
          </div>
        ),
        size: 150,
      },
      {
        accessorKey: "sirketTipi",
        header: "Şirket Tipi",
        cell: ({ row }) => {
          const tipValue = row.original.sirketTipi;
          const tipLabel = getSirketTipiLabel(tipValue);
          return (
            <span
              className={cn(
                "px-2 py-0.5 rounded text-xs font-medium",
                tipValue === "sahis" && "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300",
                tipValue === "firma" && "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300",
                tipValue === "basit_usul" && "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300"
              )}
            >
              {tipLabel}
            </span>
          );
        },
        size: 100,
      },
      {
        id: "groups",
        header: "Gruplar",
        cell: ({ row }) => {
          const groups = row.original.groups;
          if (!groups || groups.length === 0) {
            return <span className="text-xs text-muted-foreground italic">Grup yok</span>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {groups.slice(0, 2).map((group) => (
                <span
                  key={group.groupId}
                  className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px] truncate max-w-[80px]"
                  title={group.groupName}
                >
                  {group.groupName}
                </span>
              ))}
              {groups.length > 2 && (
                <span className="px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-[10px]">
                  +{groups.length - 2}
                </span>
              )}
            </div>
          );
        },
        size: 180,
        enableSorting: false,
      },
    ],
    [selectedIds, isAllSelected, isSomeSelected, onRowSelect, onSelectAll]
  );

  // Table instance
  const table = useReactTable({
    data: customers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Virtual rows for performance with large datasets
  const { rows } = table.getRowModel();
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Icon
            icon="solar:refresh-bold"
            className="w-8 h-8 text-blue-500 animate-spin"
          />
          <span className="text-sm text-muted-foreground">Yükleniyor...</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (customers.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-12">
        <Icon icon="solar:users-group-rounded-bold-duotone" className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">Mükellef bulunamadı</p>
        <p className="text-sm">Filtre ayarlarını değiştirerek tekrar arayın</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-background overflow-hidden">
      {/* Table Container with Virtual Scrolling */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <table className="w-full">
          {/* Sticky Header */}
          <thead className="bg-muted sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          "flex items-center gap-1",
                          header.column.getCanSort() && "cursor-pointer select-none hover:text-foreground"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <Icon
                            icon={
                              header.column.getIsSorted() === "asc"
                                ? "solar:alt-arrow-up-bold"
                                : "solar:alt-arrow-down-bold"
                            }
                            className="w-3 h-3"
                          />
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          {/* Virtual Body */}
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: `${paddingTop}px` }} colSpan={columns.length} />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isSelected = selectedIds.has(row.original.id);

              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className={cn(
                    "border-b border-border transition-colors",
                    isSelected && "bg-blue-50 dark:bg-blue-500/10",
                    !isSelected && "hover:bg-muted"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-2.5 text-sm"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: `${paddingBottom}px` }} colSpan={columns.length} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-2.5 bg-muted border-t border-border shrink-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              Toplam: <strong className="text-foreground">{customers.length}</strong> mükellef
            </span>
            {selectedIds.size > 0 && (
              <span>
                Seçili: <strong className="text-blue-600 dark:text-blue-400">{selectedIds.size}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:letter-bold" className="w-3.5 h-3.5 text-blue-500" />
              <span>
                Email: <strong>{customers.filter((c) => c.email).length}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:phone-bold" className="w-3.5 h-3.5 text-green-500" />
              <span>
                Telefon: <strong>{customers.filter((c) => c.telefon1 || c.telefon2).length}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
