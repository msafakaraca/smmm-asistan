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
  ToggleLeft, ToggleRight, Users,
} from "lucide-react";
import {
  type CostDefinition,
  type FinanceCategory,
  FREQUENCY_LABELS,
  CURRENCY_LABELS,
  CHARGE_STRATEGY_LABELS,
} from "../shared/finance-types";

interface CostDefinitionTableProps {
  definitions: CostDefinition[];
  categories: FinanceCategory[];
  loading: boolean;
  onEdit: (definition: CostDefinition) => void;
  onDelete: (definition: CostDefinition) => void;
  onToggleActive: (definition: CostDefinition) => void;
  onCreateNew: () => void;
  onBulkCreate: () => void;
}

export const CostDefinitionTable = memo(function CostDefinitionTable({
  definitions,
  categories,
  loading,
  onEdit,
  onDelete,
  onToggleActive,
  onCreateNew,
  onBulkCreate,
}: CostDefinitionTableProps) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("active");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtreleme
  const filtered = useMemo(() => {
    return definitions.filter((d) => {
      // Arama
      if (search) {
        const q = search.toLowerCase();
        const customerName = (d.customers?.kisaltma || d.customers?.unvan || "").toLowerCase();
        const catName = (d.category?.name || "").toLowerCase();
        const desc = (d.description || "").toLowerCase();
        if (!customerName.includes(q) && !catName.includes(q) && !desc.includes(q)) {
          return false;
        }
      }
      // Kategori filtresi
      if (filterCategory !== "all" && d.categoryId !== filterCategory) return false;
      // Aktif/Pasif filtresi
      if (filterActive === "active" && !d.isActive) return false;
      if (filterActive === "inactive" && d.isActive) return false;
      return true;
    });
  }, [definitions, search, filterCategory, filterActive]);

  const handleDelete = useCallback(async (def: CostDefinition) => {
    try {
      setDeletingId(def.id);
      await onDelete(def);
      toast.success("Maliyet kalemi pasif yapıldı");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Silme başarısız");
    } finally {
      setDeletingId(null);
    }
  }, [onDelete]);

  const incomeCategories = categories.filter((c) => c.type === "INCOME");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Üst Bar: Arama + Filtreler + Butonlar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Mükellef, kategori ara..."
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
          <Select value={filterActive} onValueChange={setFilterActive}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="inactive">Pasif</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBulkCreate}>
            <Users className="h-4 w-4 mr-1" />
            Toplu Tanımla
          </Button>
          <Button size="sm" onClick={onCreateNew}>
            <Plus className="h-4 w-4 mr-1" />
            Yeni Kalem
          </Button>
        </div>
      </div>

      {/* Tablo */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mükellef</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
              <TableHead>Periyot</TableHead>
              <TableHead>SMM</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="text-right w-28">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {definitions.length === 0
                    ? "Henüz maliyet kalemi tanımlanmamış"
                    : "Filtrelere uygun kayıt bulunamadı"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((def) => (
                <CostDefinitionRow
                  key={def.id}
                  definition={def}
                  onEdit={onEdit}
                  onDelete={handleDelete}
                  onToggleActive={onToggleActive}
                  deleting={deletingId === def.id}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Özet */}
      <div className="text-xs text-muted-foreground">
        {filtered.length} / {definitions.length} kayıt gösteriliyor
      </div>
    </div>
  );
});

// Tablo satırı
interface CostDefinitionRowProps {
  definition: CostDefinition;
  onEdit: (def: CostDefinition) => void;
  onDelete: (def: CostDefinition) => void;
  onToggleActive: (def: CostDefinition) => void;
  deleting: boolean;
}

const CostDefinitionRow = memo(function CostDefinitionRow({
  definition: def,
  onEdit,
  onDelete,
  onToggleActive,
  deleting,
}: CostDefinitionRowProps) {
  const currencySymbol = def.currency === "TRY" ? "₺" : def.currency === "USD" ? "$" : "€";

  return (
    <TableRow className={!def.isActive ? "opacity-50" : ""}>
      <TableCell>
        <div>
          <p className="font-medium text-sm">
            {def.customers?.kisaltma || def.customers?.unvan || "—"}
          </p>
          {def.description && (
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {def.description}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1.5">
          {def.category?.color && (
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: def.category.color }}
            />
          )}
          <span className="text-sm">{def.category?.name || "—"}</span>
        </span>
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {Number(def.amount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {currencySymbol}
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {FREQUENCY_LABELS[def.frequency]}
          {def.chargeStrategy === "DISTRIBUTED" && (
            <span className="text-xs text-muted-foreground ml-1">
              ({CHARGE_STRATEGY_LABELS.DISTRIBUTED})
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {def.hasSMM ? (
          <Badge variant="secondary" className="text-xs">
            KDV %{Number(def.kdvRate || 0)} / Stopaj %{Number(def.stopajRate || 0)}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Yok</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={def.isActive ? "default" : "outline"} className="text-xs">
          {def.isActive ? "Aktif" : "Pasif"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={def.isActive ? "Pasif Yap" : "Aktif Yap"}
            onClick={() => onToggleActive(def)}
          >
            {def.isActive ? (
              <ToggleRight className="h-4 w-4 text-green-600" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(def)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(def)}
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
