/**
 * Toplu Beyanname Sorgulama Dialog
 * =================================
 * Sorgulanacak ve sorgulanmayacak mükellefleri gösterir.
 * Checkbox ile seçim yapılır ve "Sorgulamayı Başlat" ile başlatılır.
 */

"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  Play,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface Customer {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  hasGibCredentials: boolean;
  lastBeyannameQueryAt: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  basAy: string;
  basYil: string;
  bitAy: string;
  bitYil: string;
  onStart: (customerIds: string[]) => void;
  isRunning: boolean;
}

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function BeyannameBulkQueryDialog({
  open,
  onOpenChange,
  customers,
  basAy,
  basYil,
  bitAy,
  bitYil,
  onStart,
  isRunning,
}: Props) {
  const [search, setSearch] = useState("");

  // Sorgulanabilir = GİB bilgileri olan mükelefler
  const { queryable, noCredentials, alreadyQueried } = useMemo(() => {
    const queryable: Customer[] = [];
    const noCredentials: Customer[] = [];
    const alreadyQueried: Customer[] = [];

    for (const c of customers) {
      if (!c.hasGibCredentials) {
        noCredentials.push(c);
      } else {
        queryable.push(c);
        if (c.lastBeyannameQueryAt) {
          alreadyQueried.push(c);
        }
      }
    }

    return { queryable, noCredentials, alreadyQueried };
  }, [customers]);

  // Seçili mükelleflerin ID'leri
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog açıldığında seçimi sıfırla — useEffect ile parent'tan gelen open değişimini yakala
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(customers.filter((c) => c.hasGibCredentials).map((c) => c.id)));
      setSearch("");
    }
  }, [open, customers]);

  // Checkbox toggle
  const toggleCustomer = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Tümünü seç / kaldır
  const toggleAll = useCallback(() => {
    if (selectedIds.size === queryable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(queryable.map((c) => c.id)));
    }
  }, [selectedIds.size, queryable]);

  // Filtreleme
  const filteredQueryable = useMemo(() => {
    if (!search.trim()) return queryable;
    const s = search.toLowerCase();
    return queryable.filter(
      (c) =>
        c.unvan.toLowerCase().includes(s) ||
        (c.kisaltma && c.kisaltma.toLowerCase().includes(s)) ||
        c.vknTckn.includes(s)
    );
  }, [queryable, search]);

  // Dönem bilgisi
  const donemStr = useMemo(() => {
    const basAyNum = parseInt(basAy, 10) - 1;
    const bitAyNum = parseInt(bitAy, 10) - 1;
    if (basYil === bitYil && basAy === bitAy) {
      return `${MONTHS_TR[basAyNum]} ${basYil}`;
    }
    return `${MONTHS_TR[basAyNum]} ${basYil} - ${MONTHS_TR[bitAyNum]} ${bitYil}`;
  }, [basAy, basYil, bitAy, bitYil]);

  const handleStart = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    onStart(ids);
    onOpenChange(false);
  }, [selectedIds, onStart, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Toplu Beyanname Sorgulama
          </DialogTitle>
          <DialogDescription>
            Dönem: <strong>{donemStr}</strong> — Sorgulanacak mükellefleri seçin.
          </DialogDescription>
        </DialogHeader>

        {/* Arama */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Mükellef ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        {/* Sorgulanacak Mükelleflerin Listesi */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Sorgulanacak ({selectedIds.size}/{queryable.length})
            </span>
            <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 text-xs">
              {selectedIds.size === queryable.length ? "Tümünü Kaldır" : "Tümünü Seç"}
            </Button>
          </div>

          <ScrollArea className="h-[320px] rounded-md border">
            <div className="p-2 space-y-0.5">
              {filteredQueryable.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  {search ? "Sonuç bulunamadı" : "Sorgulanabilir mükellef yok"}
                </div>
              ) : (
                filteredQueryable.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.has(c.id)}
                      onCheckedChange={() => toggleCustomer(c.id)}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="text-sm truncate">{c.kisaltma || c.unvan}</div>
                      <div className="text-xs text-muted-foreground font-mono">{c.vknTckn}</div>
                    </div>
                    {c.lastBeyannameQueryAt && (
                      <Badge variant="secondary" className="text-[10px] h-5 shrink-0 whitespace-nowrap">
                        <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                        Sorgulanmış
                      </Badge>
                    )}
                  </label>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Sorgulanamayacak Mükelleflerin Özeti */}
        {noCredentials.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-1">
              <XCircle className="h-4 w-4" />
              GİB Bilgileri Eksik ({noCredentials.length})
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5 max-h-[100px] overflow-y-auto">
              {noCredentials.map((c) => (
                <div key={c.id}>{c.kisaltma || c.unvan}</div>
              ))}
            </div>
          </div>
        )}

        {alreadyQueried.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>{alreadyQueried.length} mükellef daha önce sorgulanmış. Tekrar sorgulamada sadece yeni beyannameler indirilir.</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            onClick={handleStart}
            disabled={selectedIds.size === 0 || isRunning}
          >
            <Play className="mr-2 h-4 w-4" />
            {selectedIds.size} Mükellef Sorgula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
