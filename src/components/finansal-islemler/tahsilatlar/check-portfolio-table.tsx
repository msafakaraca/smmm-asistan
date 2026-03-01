"use client";

import { memo, useState, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { Search, Loader2, Check as CheckIcon, X, RotateCcw } from "lucide-react";
import {
  type Check,
  type CheckStatus,
  CHECK_STATUS_LABELS,
  CheckStatusEnum,
} from "../shared/finance-types";

interface CheckPortfolioTableProps {
  checks: Check[];
  loading: boolean;
  onUpdateStatus: (id: string, newStatus: "COLLECTED" | "BOUNCED" | "RETURNED") => Promise<void>;
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

function getCheckStatusColor(status: CheckStatus): string {
  switch (status) {
    case "IN_PORTFOLIO":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "COLLECTED":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "BOUNCED":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "RETURNED":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    default:
      return "";
  }
}

export const CheckPortfolioTable = memo(function CheckPortfolioTable({
  checks,
  loading,
  onUpdateStatus,
}: CheckPortfolioTableProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Onay dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    checkId: string;
    newStatus: "COLLECTED" | "BOUNCED" | "RETURNED";
    checkNumber: string;
  } | null>(null);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const nextWeek = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  }, []);

  // Filtreleme
  const filtered = useMemo(() => {
    return checks
      .filter((c) => {
        // Arama
        if (search) {
          const q = search.toLowerCase();
          const customerName = (c.customers?.kisaltma || c.customers?.unvan || "").toLowerCase();
          const checkNum = (c.checkNumber || "").toLowerCase();
          const bank = (c.bankName || "").toLowerCase();
          if (!customerName.includes(q) && !checkNum.includes(q) && !bank.includes(q)) {
            return false;
          }
        }
        // Durum filtresi
        if (filterStatus !== "all" && c.status !== filterStatus) return false;
        // Vade aralığı
        if (startDate && c.dueDate < startDate) return false;
        if (endDate && c.dueDate > endDate) return false;
        return true;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [checks, search, filterStatus, startDate, endDate]);

  // Satır arka plan rengi
  const getRowBg = useCallback(
    (check: Check): string => {
      if (check.status !== "IN_PORTFOLIO") return "";
      if (check.dueDate < today) return "bg-red-50/60 dark:bg-red-950/20";
      if (check.dueDate <= nextWeek) return "bg-yellow-50/60 dark:bg-yellow-950/20";
      return "";
    },
    [today, nextWeek]
  );

  // Durum değiştirme
  const handleStatusChange = useCallback(
    async (checkId: string, newStatus: "COLLECTED" | "BOUNCED" | "RETURNED") => {
      try {
        setUpdatingId(checkId);
        await onUpdateStatus(checkId, newStatus);
        toast.success(`Çek durumu "${CHECK_STATUS_LABELS[newStatus]}" olarak güncellendi`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Durum güncellenemedi");
      } finally {
        setUpdatingId(null);
        setConfirmDialog(null);
      }
    },
    [onUpdateStatus]
  );

  const openConfirm = useCallback(
    (checkId: string, newStatus: "COLLECTED" | "BOUNCED" | "RETURNED", checkNumber: string) => {
      setConfirmDialog({ open: true, checkId, newStatus, checkNumber });
    },
    []
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Çek no, müşteri, banka ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              {CheckStatusEnum.map((s) => (
                <SelectItem key={s} value={s}>
                  {CHECK_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[140px]"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[140px]"
          />
        </div>
      </div>

      {/* Tablo */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Çek No</TableHead>
              <TableHead>Banka</TableHead>
              <TableHead>Müşteri</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
              <TableHead>Vade Tarihi</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="text-right w-36">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {checks.length === 0
                    ? "Henüz çek kaydı bulunmuyor"
                    : "Filtrelere uygun çek bulunamadı"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((check) => (
                <TableRow key={check.id} className={getRowBg(check)}>
                  <TableCell className="font-medium text-sm">
                    {check.checkNumber || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {check.bankName || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {check.customers?.kisaltma || check.customers?.unvan || "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(Number(check.amount))}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(check.dueDate)}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${getCheckStatusColor(check.status)}`}>
                      {CHECK_STATUS_LABELS[check.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {check.status === "IN_PORTFOLIO" && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-600 hover:text-green-700"
                          title="Tahsil Edildi"
                          disabled={updatingId === check.id}
                          onClick={() => openConfirm(check.id, "COLLECTED", check.checkNumber || "—")}
                        >
                          {updatingId === check.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckIcon className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600 hover:text-red-700"
                          title="Karşılıksız"
                          disabled={updatingId === check.id}
                          onClick={() => openConfirm(check.id, "BOUNCED", check.checkNumber || "—")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-orange-600 hover:text-orange-700"
                          title="İade"
                          disabled={updatingId === check.id}
                          onClick={() => openConfirm(check.id, "RETURNED", check.checkNumber || "—")}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
        {filtered.length} / {checks.length} çek gösteriliyor
      </div>

      {/* Onay Dialogu */}
      {confirmDialog && (
        <AlertDialog open={confirmDialog.open} onOpenChange={() => setConfirmDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Çek Durumu Değiştir</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmDialog.checkNumber} numaralı çekin durumunu{" "}
                <strong>&quot;{CHECK_STATUS_LABELS[confirmDialog.newStatus]}&quot;</strong> olarak
                değiştirmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  handleStatusChange(confirmDialog.checkId, confirmDialog.newStatus)
                }
              >
                Onayla
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
});
