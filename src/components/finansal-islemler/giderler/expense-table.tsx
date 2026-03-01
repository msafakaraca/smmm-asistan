"use client";

import { memo, useState, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import {
  Pencil, Trash2, Plus, Search, Filter, Loader2, RefreshCw,
} from "lucide-react";
import {
  type Expense,
  type FinanceCategory,
  CURRENCY_LABELS,
  RECURRING_FREQUENCY_LABELS,
  type RecurringFrequency,
} from "../shared/finance-types";

interface ExpenseTableProps {
  expenses: Expense[];
  categories: FinanceCategory[];
  loading: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  onCreateNew: () => void;
}

export const ExpenseTable = memo(function ExpenseTable({
  expenses,
  categories,
  loading,
  onEdit,
  onDelete,
  onCreateNew,
}: ExpenseTableProps) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterRecurring, setFilterRecurring] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (search) {
        const q = search.toLowerCase();
        const catName = (e.category?.name || "").toLowerCase();
        const desc = (e.description || "").toLowerCase();
        if (!catName.includes(q) && !desc.includes(q)) return false;
      }
      if (filterCategory !== "all" && e.categoryId !== filterCategory) return false;
      if (filterRecurring === "recurring" && !e.isRecurring) return false;
      if (filterRecurring === "one_time" && e.isRecurring) return false;
      return true;
    });
  }, [expenses, search, filterCategory, filterRecurring]);

  const handleDelete = useCallback(async (expense: Expense) => {
    try {
      setDeletingId(expense.id);
      await onDelete(expense);
      toast.success("Gider silindi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Silme başarısız");
    } finally {
      setDeletingId(null);
    }
  }, [onDelete]);

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  // Aylık toplam
  const monthlyTotal = useMemo(() => {
    return filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Üst Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Açıklama, kategori ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Kategoriler</SelectItem>
              {expenseCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    {c.color && (
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    )}
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterRecurring} onValueChange={setFilterRecurring}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="recurring">Tekrarlayan</SelectItem>
              <SelectItem value="one_time">Tek Seferlik</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={onCreateNew}>
          <Plus className="h-4 w-4 mr-1" />
          Yeni Gider
        </Button>
      </div>

      {/* Tablo */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
              <TableHead>Tarih</TableHead>
              <TableHead>Açıklama</TableHead>
              <TableHead>Tekrarlayan</TableHead>
              <TableHead className="text-right w-24">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {expenses.length === 0
                    ? "Henüz gider kaydı bulunmuyor"
                    : "Filtrelere uygun kayıt bulunamadı"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  onEdit={onEdit}
                  onDelete={handleDelete}
                  deleting={deletingId === expense.id}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Alt Bilgi */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filtered.length} / {expenses.length} kayıt gösteriliyor</span>
        <span className="font-medium">
          Toplam: {monthlyTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
        </span>
      </div>
    </div>
  );
});

// Tablo satırı
interface ExpenseRowProps {
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  deleting: boolean;
}

const ExpenseRow = memo(function ExpenseRow({
  expense,
  onEdit,
  onDelete,
  deleting,
}: ExpenseRowProps) {
  const currencySymbol = expense.currency === "TRY" ? "₺" : expense.currency === "USD" ? "$" : "€";
  const dateStr = new Date(expense.date).toLocaleDateString("tr-TR");

  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-1.5">
          {expense.category?.color && (
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: expense.category.color }}
            />
          )}
          <span className="text-sm">{expense.category?.name || "—"}</span>
        </span>
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {Number(expense.amount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {currencySymbol}
      </TableCell>
      <TableCell className="text-sm">{dateStr}</TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
          {expense.description || "—"}
        </span>
      </TableCell>
      <TableCell>
        {expense.isRecurring ? (
          <Badge variant="secondary" className="text-xs gap-1">
            <RefreshCw className="h-3 w-3" />
            {expense.recurringFrequency
              ? RECURRING_FREQUENCY_LABELS[expense.recurringFrequency as RecurringFrequency]
              : "Tekrarlayan"}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Tek seferlik</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(expense)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(expense)}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});
