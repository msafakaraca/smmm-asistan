"use client";

import { memo, useState, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import {
  Pencil, Trash2, Plus, Search, Filter, Loader2,
} from "lucide-react";
import {
  type FinancialTransaction,
  type FinanceCategory,
  TRANSACTION_STATUS_LABELS,
  type TransactionStatus,
} from "../shared/finance-types";

interface ServiceTableProps {
  services: FinancialTransaction[];
  categories: FinanceCategory[];
  loading: boolean;
  onEdit: (service: FinancialTransaction) => void;
  onDelete: (service: FinancialTransaction) => void;
  onCreateNew: () => void;
}

const STATUS_COLORS: Record<TransactionStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  PARTIAL: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  CANCELLED: "bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400",
};

export const ServiceTable = memo(function ServiceTable({
  services,
  categories,
  loading,
  onEdit,
  onDelete,
  onCreateNew,
}: ServiceTableProps) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return services.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        const customerName = (s.customers?.kisaltma || s.customers?.unvan || "").toLowerCase();
        const catName = (s.category?.name || "").toLowerCase();
        const desc = (s.description || "").toLowerCase();
        if (!customerName.includes(q) && !catName.includes(q) && !desc.includes(q)) {
          return false;
        }
      }
      if (filterCategory !== "all" && s.categoryId !== filterCategory) return false;
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      return true;
    });
  }, [services, search, filterCategory, filterStatus]);

  const handleDelete = useCallback(async (service: FinancialTransaction) => {
    try {
      setDeletingId(service.id);
      await onDelete(service);
      toast.success("Hizmet iptal edildi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "İptal başarısız");
    } finally {
      setDeletingId(null);
    }
  }, [onDelete]);

  const incomeCategories = categories.filter((c) => c.type === "INCOME");

  // Toplam
  const totalNet = useMemo(() => {
    return filtered
      .filter((s) => s.status !== "CANCELLED")
      .reduce((sum, s) => sum + Number(s.netAmount), 0);
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
              placeholder="Mükellef, kategori, açıklama ara..."
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
              {incomeCategories.map((c) => (
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
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              <SelectItem value="PENDING">Bekliyor</SelectItem>
              <SelectItem value="COMPLETED">Tamamlandı</SelectItem>
              <SelectItem value="PARTIAL">Kısmi</SelectItem>
              <SelectItem value="CANCELLED">İptal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={onCreateNew}>
          <Plus className="h-4 w-4 mr-1" />
          Yeni Hizmet
        </Button>
      </div>

      {/* Tablo */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mükellef</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Brüt</TableHead>
              <TableHead className="text-right">Net Tutar</TableHead>
              <TableHead>Tarih</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="text-right w-24">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {services.length === 0
                    ? "Henüz hizmet kaydı bulunmuyor"
                    : "Filtrelere uygun kayıt bulunamadı"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((service) => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  onEdit={onEdit}
                  onDelete={handleDelete}
                  deleting={deletingId === service.id}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Alt Bilgi */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filtered.length} / {services.length} kayıt gösteriliyor</span>
        <span className="font-medium">
          Net Toplam: {totalNet.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
        </span>
      </div>
    </div>
  );
});

// Tablo satırı
interface ServiceRowProps {
  service: FinancialTransaction;
  onEdit: (service: FinancialTransaction) => void;
  onDelete: (service: FinancialTransaction) => void;
  deleting: boolean;
}

const ServiceRow = memo(function ServiceRow({
  service,
  onEdit,
  onDelete,
  deleting,
}: ServiceRowProps) {
  const currencySymbol = service.currency === "TRY" ? "₺" : service.currency === "USD" ? "$" : "€";
  const dateStr = new Date(service.date).toLocaleDateString("tr-TR");
  const isCancelled = service.status === "CANCELLED";

  const smmInfo = service.kdvAmount || service.stopajAmount
    ? `KDV: ${Number(service.kdvAmount || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} / Stopaj: ${Number(service.stopajAmount || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`
    : null;

  return (
    <TableRow className={isCancelled ? "opacity-50" : ""}>
      <TableCell>
        <div>
          <p className="font-medium text-sm">
            {service.customers?.kisaltma || service.customers?.unvan || "—"}
          </p>
          {service.description && (
            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
              {service.description}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1.5">
          {service.category?.color && (
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: service.category.color }}
            />
          )}
          <span className="text-sm">{service.category?.name || "—"}</span>
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        <div>
          {Number(service.grossAmount || service.amount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {currencySymbol}
        </div>
        {smmInfo && (
          <p className="text-xs text-muted-foreground">{smmInfo}</p>
        )}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {Number(service.netAmount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {currencySymbol}
      </TableCell>
      <TableCell className="text-sm">{dateStr}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-xs ${STATUS_COLORS[service.status as TransactionStatus] || ""}`}
        >
          {TRANSACTION_STATUS_LABELS[service.status as TransactionStatus] || service.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(service)}
            disabled={isCancelled}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(service)}
            disabled={deleting || isCancelled}
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
