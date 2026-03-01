"use client";

import { memo, useState, useEffect, useMemo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useAccountStatement } from "../hooks/use-account-statement";
import type { StatementRow } from "../hooks/use-account-statement";
import { useCategories } from "../hooks/use-categories";
import {
  TRANSACTION_TYPE_LABELS,
} from "../shared/finance-types";

interface CustomerOption {
  id: string;
  unvan: string;
  kisaltma: string | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("tr-TR");
}

// Son 3 ay varsayilan tarih araligi
function getDefaultDates(): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end,
  };
}

export const AccountStatementTable = memo(function AccountStatementTable() {
  const { statementRows, totals, loading, fetchStatement } =
    useAccountStatement();
  const { categories } = useCategories();

  // Filtre state
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");

  const defaults = useMemo(() => getDefaultDates(), []);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);

  const [exporting, setExporting] = useState(false);

  // Musteri listesini cek
  useEffect(() => {
    fetch("/api/customers?limit=500")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.data || [];
        setCustomers(list);
      })
      .catch(() => {});
  }, []);

  // Filtre degistiginde yeniden fetch
  useEffect(() => {
    fetchStatement({
      customerId: customerId !== "all" ? customerId : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      type:
        typeFilter === "DEBIT" || typeFilter === "CREDIT"
          ? typeFilter
          : undefined,
      categoryId: categoryId !== "all" ? categoryId : undefined,
    });
  }, [customerId, startDate, endDate, typeFilter, categoryId, fetchStatement]);

  // Musteriye gore musteri kolonu gizleme
  const showCustomerColumn = customerId === "all";

  // Excel export
  const handleExport = useCallback(async () => {
    if (statementRows.length === 0) {
      toast.error("Dışa aktarılacak veri yok");
      return;
    }
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (customerId !== "all") params.set("customerId", customerId);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (categoryId !== "all") params.set("categoryId", categoryId);

      const res = await fetch(
        `/api/finance/account-statement/export?${params}`
      );
      if (!res.ok) {
        toast.error("Excel export başarısız");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Dosya adi
      const customerName =
        customerId !== "all"
          ? customers.find((c) => c.id === customerId)?.kisaltma ||
            customers.find((c) => c.id === customerId)?.unvan ||
            "musteri"
          : "tum_musteriler";
      a.download = `hesap_dokumu_${customerName}_${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel dosyası indirildi");
    } catch {
      toast.error("Excel export sırasında hata oluştu");
    } finally {
      setExporting(false);
    }
  }, [statementRows, customerId, startDate, endDate, typeFilter, categoryId, customers]);

  // Kategoriye gore filtrele (client-side ek filtre)
  const displayRows = useMemo(() => {
    return statementRows;
  }, [statementRows]);

  return (
    <div className="space-y-4">
      {/* Filtreler */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-wrap items-end gap-2">
          {/* Musteri */}
          <div className="min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Müşteri
            </label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Müşteri seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Müşteriler</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.kisaltma || c.unvan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Baslangic Tarihi */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Başlangıç
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[145px]"
            />
          </div>

          {/* Bitiş Tarihi */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Bitiş
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[145px]"
            />
          </div>

          {/* Islem Turu */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              İşlem Türü
            </label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Tür" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="DEBIT">
                  {TRANSACTION_TYPE_LABELS.DEBIT}
                </SelectItem>
                <SelectItem value="CREDIT">
                  {TRANSACTION_TYPE_LABELS.CREDIT}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Kategori */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Kategori
            </label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Export butonu */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting || displayRows.length === 0}
          className="shrink-0"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Excel İndir
        </Button>
      </div>

      {/* Tablo */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Tarih</TableHead>
              {showCustomerColumn && <TableHead>Müşteri</TableHead>}
              <TableHead className="w-[120px]">Kategori</TableHead>
              <TableHead>Açıklama</TableHead>
              <TableHead className="text-right w-[120px]">Borç</TableHead>
              <TableHead className="text-right w-[120px]">Alacak</TableHead>
              <TableHead className="text-right w-[120px]">Bakiye</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={showCustomerColumn ? 7 : 6}
                  className="text-center py-12"
                >
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                </TableCell>
              </TableRow>
            ) : displayRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showCustomerColumn ? 7 : 6}
                  className="text-center py-12 text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground/50" />
                    <p>Hesap dökümü görüntülemek için filtre seçin</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map((row: StatementRow) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm tabular-nums">
                    {formatDate(row.date)}
                  </TableCell>
                  {showCustomerColumn && (
                    <TableCell>
                      <span className="text-sm font-medium">
                        {row.customers?.kisaltma ||
                          row.customers?.unvan ||
                          "\u2014"}
                      </span>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {row.category?.color && (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: row.category.color }}
                        />
                      )}
                      <span className="text-sm">
                        {row.category?.name || "\u2014"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground truncate max-w-[250px] block">
                      {row.description || "\u2014"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.debitAmount > 0 ? (
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        {formatCurrency(row.debitAmount)}
                      </span>
                    ) : (
                      "\u2014"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.creditAmount > 0 ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {formatCurrency(row.creditAmount)}
                      </span>
                    ) : (
                      "\u2014"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    <span
                      className={
                        row.balance > 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-green-600 dark:text-green-400"
                      }
                    >
                      {formatCurrency(row.balance)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Alt ozet satiri */}
      {displayRows.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1">
          <span className="text-xs text-muted-foreground">
            {displayRows.length} kayıt gösteriliyor
          </span>
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Toplam Borç:</span>
              <span className="text-red-600 dark:text-red-400 tabular-nums">
                {formatCurrency(totals.totalDebit)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Toplam Alacak:</span>
              <span className="text-green-600 dark:text-green-400 tabular-nums">
                {formatCurrency(totals.totalCredit)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Bakiye:</span>
              <span
                className={`tabular-nums font-bold ${
                  totals.finalBalance > 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                }`}
              >
                {formatCurrency(totals.finalBalance)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
