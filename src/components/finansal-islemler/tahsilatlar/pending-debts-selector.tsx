"use client";

import { memo, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PendingDebtWithBalance } from "../shared/finance-types";

interface PendingDebtsSelectorProps {
  debts: PendingDebtWithBalance[];
  loading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[], totalAmount: number) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

export const PendingDebtsSelector = memo(function PendingDebtsSelector({
  debts,
  loading,
  selectedIds,
  onSelectionChange,
}: PendingDebtsSelectorProps) {
  const handleToggle = useCallback(
    (id: string, remaining: number) => {
      let newIds: string[];
      if (selectedIds.includes(id)) {
        newIds = selectedIds.filter((sid) => sid !== id);
      } else {
        newIds = [...selectedIds, id];
      }
      const total = debts
        .filter((d) => newIds.includes(d.id))
        .reduce((sum, d) => sum + Number(d.remaining), 0);
      onSelectionChange(newIds, total);
    },
    [selectedIds, debts, onSelectionChange]
  );

  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === debts.length) {
      onSelectionChange([], 0);
    } else {
      const allIds = debts.map((d) => d.id);
      const total = debts.reduce((sum, d) => sum + Number(d.remaining), 0);
      onSelectionChange(allIds, total);
    }
  }, [selectedIds.length, debts, onSelectionChange]);

  const selectedTotal = useMemo(() => {
    return debts
      .filter((d) => selectedIds.includes(d.id))
      .reduce((sum, d) => sum + Number(d.remaining), 0);
  }, [debts, selectedIds]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (debts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Bu müşterinin bekleyen borcu bulunmuyor
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedIds.length === debts.length && debts.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Açıklama</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
              <TableHead className="text-right">Kalan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debts.map((debt) => {
              const isPartial = Number(debt.remaining) < Number(debt.netAmount);
              return (
                <TableRow
                  key={debt.id}
                  className={selectedIds.includes(debt.id) ? "bg-muted/50" : ""}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(debt.id)}
                      onCheckedChange={() => handleToggle(debt.id, Number(debt.remaining))}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {debt.category?.name || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{debt.description || "—"}</span>
                      {isPartial && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                          Kısmi ödenmiş
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatCurrency(Number(debt.netAmount))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">
                    {formatCurrency(Number(debt.remaining))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Alt bar: seçili toplam + tümünü seç */}
      <div className="flex items-center justify-between px-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSelectAll}
          className="text-xs"
        >
          {selectedIds.length === debts.length ? "Seçimi Kaldır" : "Tümünü Seç"}
        </Button>
        <div className="text-sm font-medium">
          Seçili Toplam:{" "}
          <span className="text-primary tabular-nums">
            {formatCurrency(selectedTotal)}
          </span>
        </div>
      </div>
    </div>
  );
});
