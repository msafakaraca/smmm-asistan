"use client";

import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BulkSendDocument } from './types';
import { formatFileSize, getPeriodLabel } from './types';

interface BulkSendTableProps {
  documents: BulkSendDocument[];
  isLoading?: boolean;
  selectedIds: string[];
  onRowSelect: (doc: BulkSendDocument) => void;
  onSelectAll: () => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onPreviewDocument?: (doc: BulkSendDocument) => void;
}

export function BulkSendTable({
  documents,
  isLoading = false,
  selectedIds,
  onRowSelect,
  onSelectAll,
  isAllSelected,
  isSomeSelected,
  onPreviewDocument,
}: BulkSendTableProps) {
  // Convert to Set for O(1) lookup
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // Columns
  const columns = useMemo<ColumnDef<BulkSendDocument>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(el) => {
              if (el) el.indeterminate = isSomeSelected;
            }}
            onChange={onSelectAll}
            className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500 bg-background"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedIdSet.has(row.original.id)}
            onChange={() => onRowSelect(row.original)}
            className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500 bg-background"
          />
        ),
        size: 40,
      },
      {
        accessorKey: 'customerName',
        header: 'Mükellef',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground truncate max-w-[200px]">
              {row.original.customerKisaltma || row.original.customerName}
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {row.original.customerEmail || 'E-posta yok'}
            </span>
          </div>
        ),
        size: 200,
      },
      {
        accessorKey: 'name',
        header: 'Dosya',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Icon icon="solar:document-bold" className="w-4 h-4 text-red-500 shrink-0" />
            <span
              className="truncate max-w-[250px] cursor-pointer hover:text-blue-600 hover:underline"
              onClick={() => onPreviewDocument?.(row.original)}
              title={row.original.name}
            >
              {row.original.name}
            </span>
          </div>
        ),
        size: 300,
      },
      {
        accessorKey: 'beyannameTuru',
        header: 'Tür',
        cell: ({ row }) => (
          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">
            {row.original.beyannameTuru}
          </span>
        ),
        size: 100,
      },
      {
        accessorKey: 'dosyaTipi',
        header: 'Dosya Tipi',
        cell: ({ row }) => (
          <span
            className={cn(
              'px-2 py-0.5 rounded text-xs font-medium',
              row.original.dosyaTipi === 'BEYANNAME' && 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300',
              row.original.dosyaTipi === 'TAHAKKUK' && 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
              row.original.dosyaTipi === 'SGK_TAHAKKUK' && 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300',
              row.original.dosyaTipi === 'HIZMET_LISTESI' && 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
            )}
          >
            {row.original.dosyaTipi.replace(/_/g, ' ')}
          </span>
        ),
        size: 120,
      },
      {
        id: 'period',
        header: 'Dönem',
        cell: ({ row }) =>
          row.original.year && row.original.month
            ? getPeriodLabel(row.original.year, row.original.month)
            : '-',
        size: 100,
      },
      {
        accessorKey: 'size',
        header: 'Boyut',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatFileSize(row.original.size)}</span>
        ),
        size: 80,
      },
      {
        id: 'status',
        header: 'Gönderim',
        cell: ({ row }) => {
          const status = row.original.sendStatus;
          if (!status) {
            return (
              <span className="text-muted-foreground text-xs">Gönderilmedi</span>
            );
          }

          return (
            <div className="flex items-center gap-1">
              {status.mailSent && (
                <div
                  className="w-5 h-5 bg-blue-100 dark:bg-blue-500/20 rounded flex items-center justify-center"
                  title={`Mail: ${status.mailSentTo}`}
                >
                  <Icon icon="solar:letter-bold" className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                </div>
              )}
              {status.whatsappSent && (
                <div
                  className="w-5 h-5 bg-green-100 dark:bg-green-500/20 rounded flex items-center justify-center"
                  title={`WhatsApp: ${status.whatsappSentTo}`}
                >
                  <Icon icon="solar:chat-round-dots-bold" className="w-3 h-3 text-green-600 dark:text-green-400" />
                </div>
              )}
              {status.smsSent && (
                <div
                  className="w-5 h-5 bg-purple-100 dark:bg-purple-500/20 rounded flex items-center justify-center"
                  title={`SMS: ${status.smsSentTo}`}
                >
                  <Icon icon="solar:smartphone-bold" className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                </div>
              )}
            </div>
          );
        },
        size: 100,
      },
    ],
    [selectedIdSet, isAllSelected, isSomeSelected, onRowSelect, onSelectAll, onPreviewDocument]
  );

  // Table instance with pagination
  const table = useReactTable({
    data: documents,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  if (documents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-12">
        <Icon icon="solar:inbox-bold-duotone" className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">Dosya bulunamadı</p>
        <p className="text-sm">Filtre ayarlarını değiştirerek tekrar arayın</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-background overflow-hidden">
      {/* Scrollable Table Container */}
      <div className="flex-1 overflow-auto">
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
                          'flex items-center gap-1',
                          header.column.getCanSort() && 'cursor-pointer select-none'
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <Icon
                            icon={
                              header.column.getIsSorted() === 'asc'
                                ? 'solar:alt-arrow-up-bold'
                                : 'solar:alt-arrow-down-bold'
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

          {/* Body */}
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isSelected = selectedIdSet.has(row.original.id);
              const hasSendStatus = row.original.sendStatus;

              return (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-border transition-colors',
                    isSelected && 'bg-blue-50 dark:bg-blue-500/10',
                    hasSendStatus?.mailSent && !isSelected && 'bg-blue-50/30 dark:bg-blue-500/5',
                    hasSendStatus?.whatsappSent && !hasSendStatus?.mailSent && !isSelected && 'bg-green-50/30 dark:bg-green-500/5',
                    !isSelected && !hasSendStatus?.mailSent && !hasSendStatus?.whatsappSent && 'hover:bg-muted'
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
          </tbody>
        </table>
      </div>

      {/* Sticky Footer */}
      <div className="border-t border-border bg-background shrink-0">
        {/* Stats Bar */}
        <div className="px-4 py-2 bg-muted text-xs text-muted-foreground flex items-center justify-between">
          <span>
            {selectedIds.length > 0
              ? `${selectedIds.length} / ${documents.length} seçili`
              : `${documents.length} dosya`}
          </span>
          <span>
            Toplam: {formatFileSize(documents.reduce((acc, d) => acc + d.size, 0))}
          </span>
        </div>

        {/* Pagination Controls */}
        <div className="px-4 py-2.5 flex items-center justify-between border-t border-border">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <Icon icon="solar:double-alt-arrow-left-bold" className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <Icon icon="solar:alt-arrow-left-bold" className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Sayfa {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <Icon icon="solar:alt-arrow-right-bold" className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <Icon icon="solar:double-alt-arrow-right-bold" className="w-4 h-4" />
            </Button>
          </div>

          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue placeholder="Sayfa boyutu" />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize} dosya
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
