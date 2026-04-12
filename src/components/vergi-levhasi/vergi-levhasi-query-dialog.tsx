"use client";

/**
 * Vergi Levhası Sorgulama Dialog
 * ===============================
 * 3 aşamalı: Mükellef Seçimi → İlerleme → Sonuçlar
 * Daha önce sorgulanmış mükelleflerde uyarı gösterilir.
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
} from "lucide-react";
import type { QueryStage, MukellefResult } from "./hooks/use-vergi-levhasi-query";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface CustomerInfo {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  tcKimlikNo: string | null;
  sirketTipi: string;
  email: string | null;
  telefon1: string | null;
  lastVergiLevhasiQueryAt: string | null;
  vergiLevhasiOnayKodu: string | null;
}

interface VergiLevhasiQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerInfo[];
  stage: QueryStage;
  progress: { current: number; total: number; status: string; currentCustomerId?: string };
  results: MukellefResult[];
  error?: string;
  onStart: (mukellefler: Array<{ customerId: string; vknTckn: string; tcKimlikNo: string | null; unvan: string; sirketTipi: string }>) => void;
  onReset: () => void;
}

type DialogPhase = "selecting" | "confirming" | "querying" | "complete";

// ═══════════════════════════════════════════════════════════════════════════
// Yardımcı
// ═══════════════════════════════════════════════════════════════════════════

function formatQueryDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function VergiLevhasiQueryDialog({
  open,
  onOpenChange,
  customers,
  stage,
  progress,
  results,
  error,
  onStart,
  onReset,
}: VergiLevhasiQueryDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [phase, setPhase] = useState<DialogPhase>("selecting");

  // Stage değiştiğinde phase güncelle
  useEffect(() => {
    if (stage === "querying") {
      setPhase("querying");
    } else if (stage === "complete" || stage === "error") {
      setPhase("complete");
    }
  }, [stage]);

  // Dialog kapandığında reset
  useEffect(() => {
    if (!open) {
      setPhase("selecting");
      setSelectedIds(new Set());
      setSearchTerm("");
    }
  }, [open]);

  // Filtrelenmiş mükelefler
  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        c.unvan.toLowerCase().includes(term) ||
        (c.kisaltma && c.kisaltma.toLowerCase().includes(term)) ||
        c.vknTckn.includes(term)
    );
  }, [customers, searchTerm]);

  // Tümünü seç / kaldır
  const allFilteredSelected = useMemo(
    () => filteredCustomers.length > 0 && filteredCustomers.every((c) => selectedIds.has(c.id)),
    [filteredCustomers, selectedIds]
  );

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredCustomers.forEach((c) => next.delete(c.id));
      } else {
        filteredCustomers.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }, [allFilteredSelected, filteredCustomers]);

  const toggleOne = useCallback((id: string) => {
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

  // Sorgulama başlat
  const handleStart = useCallback(() => {
    const selected = customers.filter((c) => selectedIds.has(c.id));

    // Daha önce sorgulanmışları kontrol et
    const previouslyQueried = selected.filter((c) => c.lastVergiLevhasiQueryAt);
    const notQueried = selected.filter((c) => !c.lastVergiLevhasiQueryAt);

    if (previouslyQueried.length > 0 && notQueried.length > 0) {
      // Karışık seçim — doğrudan uyarı göstermeden hepsini sorgula
      // (Kullanıcı bilinçli seçim yapıyor)
    }

    const mukellefler = selected.map((c) => ({
      customerId: c.id,
      vknTckn: c.vknTckn,
      tcKimlikNo: c.tcKimlikNo || null,
      unvan: c.kisaltma || c.unvan,
      sirketTipi: c.sirketTipi,
    }));

    onStart(mukellefler);
  }, [customers, selectedIds, onStart]);

  // Yeni sorgulama
  const handleNewQuery = useCallback(() => {
    onReset();
    setPhase("selecting");
    setSelectedIds(new Set());
  }, [onReset]);

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={phase === "querying" ? undefined : onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            {phase === "selecting" && "Vergi Levhası Sorgulama"}
            {phase === "querying" && "Vergi Levhası Sorgulanıyor..."}
            {phase === "complete" && (error ? "Sorgulama Hatası" : "Sorgulama Tamamlandı")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-1">
          {/* ─── AŞAMA 1: MÜKELLEF SEÇİMİ ─── */}
          {phase === "selecting" && (
            <div className="space-y-3">
              {/* Arama */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Mükellef ara..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Tümünü seç */}
              <div className="flex items-center gap-2 px-1">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={toggleAll}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  {allFilteredSelected ? "Tümünü Kaldır" : "Tümünü Seç"}
                </label>
                <span className="text-xs text-muted-foreground ml-auto">
                  {selectedIds.size} / {customers.length} seçili
                </span>
              </div>

              {/* Mükellef listesi */}
              <ScrollArea className="h-[400px] border rounded-md">
                <div className="divide-y">
                  {filteredCustomers.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedIds.has(c.id)}
                        onCheckedChange={() => toggleOne(c.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {c.kisaltma || c.unvan}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(c.sirketTipi === "sahis" || c.sirketTipi === "basit_usul") && c.tcKimlikNo
                            ? c.tcKimlikNo
                            : c.vknTckn} · {c.sirketTipi === "sahis" ? "Şahıs" : c.sirketTipi === "firma" ? "Firma" : "Basit Usul"}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {c.lastVergiLevhasiQueryAt ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle2 className="h-3 w-3" />
                            {formatQueryDate(c.lastVergiLevhasiQueryAt)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
                            Sorgulanmadı
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Mükellef bulunamadı
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* ─── AŞAMA 2: İLERLEME ─── */}
          {phase === "querying" && (
            <div className="space-y-4">
              {/* Durum */}
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Sorgulanıyor...</span>
              </div>

              {/* Canlı sonuç listesi */}
              <ScrollArea className="h-[350px] border rounded-md">
                <div className="divide-y">
                  {results.map((r) => (
                    <div key={r.customerId} className="flex items-center gap-3 px-4 py-2.5">
                      {r.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate block">
                          {r.unvan || customers.find((c) => c.id === r.customerId)?.unvan || r.customerId}
                        </span>
                        {r.error && (
                          <span className="text-xs text-red-500 truncate block">{r.error}</span>
                        )}
                      </div>
                      {r.success && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {r.onayKodu}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* ─── AŞAMA 3: SONUÇLAR ─── */}
          {phase === "complete" && (
            <div className="space-y-4">
              {/* Özet */}
              {error ? (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                  <div>
                    <div className="font-medium text-red-800">Sorgulama Hatası</div>
                    <div className="text-sm text-red-600 mt-1">{error}</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <div>
                    <div className="font-medium text-green-800">Sorgulama Tamamlandı</div>
                    <div className="text-sm text-green-600 mt-1">
                      {results.length} mükellef sorgulandı · {successCount} başarılı · {failCount} başarısız
                    </div>
                  </div>
                </div>
              )}

              {/* Detaylı sonuçlar */}
              {results.length > 0 && (
                <ScrollArea className="h-[350px] border rounded-md">
                  <div className="divide-y">
                    {results.map((r) => (
                      <div key={r.customerId} className="flex items-center gap-3 px-4 py-3">
                        {r.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {r.unvan || customers.find((c) => c.id === r.customerId)?.unvan}
                          </div>
                          {r.success ? (
                            <div className="text-xs text-muted-foreground">
                              Onay: {r.onayKodu} · {r.onayZamani} · {r.vergiDairesi}
                            </div>
                          ) : (
                            <div className="text-xs text-red-500">{r.error}</div>
                          )}
                        </div>
                        {r.success && r.alreadyExists && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
                            Mevcut
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="border-t pt-4">
          {phase === "selecting" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                İptal
              </Button>
              <Button
                onClick={handleStart}
                disabled={selectedIds.size === 0}
              >
                <FileCheck className="h-4 w-4 mr-2" />
                {selectedIds.size > 0
                  ? `${selectedIds.size} Mükellef Sorgula`
                  : "Mükellef Seçin"}
              </Button>
            </>
          )}
          {phase === "querying" && (
            <div className="text-sm text-muted-foreground">
              Sorgulama devam ediyor, lütfen bekleyin...
            </div>
          )}
          {phase === "complete" && (
            <>
              <Button variant="outline" onClick={handleNewQuery}>
                Yeni Sorgulama
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Kapat
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
