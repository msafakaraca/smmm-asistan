"use client";

import { memo, useState, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Loader2 } from "lucide-react";
import {
  type FinancialTransaction,
  type TransactionStatus,
  TRANSACTION_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  TransactionStatusEnum,
  PaymentMethodEnum,
} from "../shared/finance-types";

interface CollectionTableProps {
  transactions: FinancialTransaction[];
  loading: boolean;
  onCollect: (customerId: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("tr-TR");
}

function getStatusColor(status: TransactionStatus): string {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "PENDING":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "PARTIAL":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "CANCELLED":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    default:
      return "";
  }
}

export const CollectionTable = memo(function CollectionTable({
  transactions,
  loading,
  onCollect,
}: CollectionTableProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Filtreleme
  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
        // Arama
        if (search) {
          const q = search.toLowerCase();
          const customerName = (t.customers?.kisaltma || t.customers?.unvan || "").toLowerCase();
          const desc = (t.description || "").toLowerCase();
          const catName = (t.category?.name || "").toLowerCase();
          if (!customerName.includes(q) && !desc.includes(q) && !catName.includes(q)) {
            return false;
          }
        }
        // Durum filtresi
        if (filterStatus !== "all" && t.status !== filterStatus) return false;
        // Ödeme yöntemi filtresi
        if (filterPaymentMethod !== "all" && t.paymentMethod !== filterPaymentMethod) return false;
        // Tarih aralığı
        if (startDate && t.date < startDate) return false;
        if (endDate && t.date > endDate) return false;
        return true;
      })
      .sort((a, b) => {
        // Vadesi yakın olan üste
        const dateA = a.dueDate || a.date;
        const dateB = b.dueDate || b.date;
        return dateA.localeCompare(dateB);
      });
  }, [transactions, search, filterStatus, filterPaymentMethod, startDate, endDate]);

  const isOverdue = useCallback(
    (t: FinancialTransaction) => {
      return (
        t.type === "DEBIT" &&
        (t.status === "PENDING" || t.status === "PARTIAL") &&
        t.dueDate &&
        t.dueDate < today
      );
    },
    [today]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtreler */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Müşteri, açıklama ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              {TransactionStatusEnum.map((s) => (
                <SelectItem key={s} value={s}>
                  {TRANSACTION_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Ödeme Yöntemi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Yöntemler</SelectItem>
              {PaymentMethodEnum.map((pm) => (
                <SelectItem key={pm} value={pm}>
                  {PAYMENT_METHOD_LABELS[pm]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[140px]"
            placeholder="Başlangıç"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[140px]"
            placeholder="Bitiş"
          />
        </div>
      </div>

      {/* Tablo */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Müşteri</TableHead>
              <TableHead>Kalem</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
              <TableHead>Vade Tarihi</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="text-right w-28">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {transactions.length === 0
                    ? "Henüz tahsilat kaydı bulunmuyor"
                    : "Filtrelere uygun kayıt bulunamadı"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow
                  key={t.id}
                  className={isOverdue(t) ? "bg-red-50/50 dark:bg-red-950/20" : ""}
                >
                  <TableCell>
                    <p className="font-medium text-sm">
                      {t.customers?.kisaltma || t.customers?.unvan || "—"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{t.category?.name || "—"}</p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {t.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(Number(t.netAmount))}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(t.dueDate)}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${getStatusColor(t.status)}`}>
                      {TRANSACTION_STATUS_LABELS[t.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {t.type === "DEBIT" && (t.status === "PENDING" || t.status === "PARTIAL") && t.customerId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onCollect(t.customerId!)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Tahsil
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Özet */}
      <div className="text-xs text-muted-foreground">
        {filtered.length} / {transactions.length} kayıt gösteriliyor
      </div>
    </div>
  );
});
