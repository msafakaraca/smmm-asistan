"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

// Lazy load heavy Excel import dialog
const ExcelImportDialog = dynamic(
  () =>
    import("./excel-import-dialog").then((mod) => ({
      default: mod.ExcelImportDialog,
    })),
  { ssr: false }
);

interface BranchSgk {
  kullaniciAdi: string | null;
  isyeriKodu: string | null;
  sistemSifresi: string | null;
  isyeriSifresi: string | null;
  hasKullaniciAdi: boolean;
  hasIsyeriKodu: boolean;
  hasSistemSifresi: boolean;
  hasIsyeriSifresi: boolean;
}

interface BranchSummary {
  id: string;
  branchName: string;
  sgk: BranchSgk;
}

interface CustomerPasswordSummary {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  gib: {
    kodu: string | null;
    hasKodu: boolean;
    hasSifre: boolean;
    hasParola: boolean;
    hasInteraktifSifre: boolean;
    hasEmuhurPin: boolean;
  };
  sgk: {
    kullaniciAdi: string | null;
    isyeriKodu: string | null;
    hasKullaniciAdi: boolean;
    hasIsyeriKodu: boolean;
    hasSistemSifresi: boolean;
    hasIsyeriSifresi: boolean;
  };
  branches: BranchSummary[];
}

// Flat row type for rendering (customer or branch)
type FlatRow =
  | { type: "customer"; customer: CustomerPasswordSummary; index: number }
  | { type: "branch"; branch: BranchSummary; customer: CustomerPasswordSummary; index: number };

// Form state for each customer
interface FormState {
  sgkKullaniciAdi: string;
  sgkIsyeriKodu: string;
  sgkSistemSifresi: string;
  sgkIsyeriSifresi: string;
  isDirty: boolean;
}

type SgkField =
  | "sgkKullaniciAdi"
  | "sgkIsyeriKodu"
  | "sgkSistemSifresi"
  | "sgkIsyeriSifresi";

// Virtual scrolling threshold
const VIRTUAL_THRESHOLD = 100;

export function SgkPasswordsTable() {
  const [customers, setCustomers] = useState<CustomerPasswordSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // Form states per customer
  const [formStates, setFormStates] = useState<Record<string, FormState>>({});
  const [showPasswords, setShowPasswords] = useState<
    Record<string, Record<string, boolean>>
  >({});

  // Branch states
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [branchFormStates, setBranchFormStates] = useState<Record<string, FormState>>({});
  const [savingBranchId, setSavingBranchId] = useState<string | null>(null);

  // Virtual scrolling
  const parentRef = useRef<HTMLDivElement>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/sifreler/summary");
      if (!response.ok) throw new Error("Veriler yüklenemedi");
      const data = await response.json();
      setCustomers(data);
      // Reset form states when data is fetched
      setFormStates({});
    } catch (error) {
      console.error("Şifreler yüklenirken hata:", error);
      toast.error("Şifreler yüklenirken bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Filtered customers based on search
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;

    const query = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.unvan.toLowerCase().includes(query) ||
        c.vknTckn.includes(query) ||
        (c.kisaltma && c.kisaltma.toLowerCase().includes(query))
    );
  }, [customers, searchQuery]);

  // Flatten customers + expanded branches into single list
  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = [];
    let idx = 0;
    for (const customer of filteredCustomers) {
      rows.push({ type: "customer", customer, index: idx++ });
      if (expandedCustomers[customer.id] && customer.branches?.length > 0) {
        for (const branch of customer.branches) {
          rows.push({ type: "branch", branch, customer, index: idx++ });
        }
      }
    }
    return rows;
  }, [filteredCustomers, expandedCustomers]);

  const toggleExpand = (customerId: string) => {
    setExpandedCustomers(prev => ({ ...prev, [customerId]: !prev[customerId] }));
  };

  const getBranchFormState = (branchId: string): FormState => {
    return branchFormStates[branchId] || {
      sgkKullaniciAdi: "",
      sgkIsyeriKodu: "",
      sgkSistemSifresi: "",
      sgkIsyeriSifresi: "",
      isDirty: false,
    };
  };

  const updateBranchFormState = (branchId: string, field: SgkField, value: string) => {
    setBranchFormStates(prev => ({
      ...prev,
      [branchId]: {
        ...getBranchFormState(branchId),
        [field]: value,
        isDirty: true,
      },
    }));
  };

  const handleBranchSave = async (branchId: string, customerId: string) => {
    const formState = getBranchFormState(branchId);
    if (!formState.isDirty) return;

    const hasValue =
      formState.sgkKullaniciAdi.trim() ||
      formState.sgkIsyeriKodu.trim() ||
      formState.sgkSistemSifresi.trim() ||
      formState.sgkIsyeriSifresi.trim();

    if (!hasValue) {
      toast.error("En az bir alan doldurulmalı");
      return;
    }

    setSavingBranchId(branchId);
    try {
      const payload: Record<string, string> = { branchId };
      if (formState.sgkKullaniciAdi.trim()) payload.sgkKullaniciAdi = formState.sgkKullaniciAdi.trim();
      if (formState.sgkIsyeriKodu.trim()) payload.sgkIsyeriKodu = formState.sgkIsyeriKodu.trim();
      if (formState.sgkSistemSifresi.trim()) payload.sgkSistemSifresi = formState.sgkSistemSifresi.trim();
      if (formState.sgkIsyeriSifresi.trim()) payload.sgkIsyeriSifresi = formState.sgkIsyeriSifresi.trim();

      const response = await fetch(`/api/customers/${customerId}/branches`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Kaydetme başarısız");

      setBranchFormStates(prev => {
        const newStates = { ...prev };
        delete newStates[branchId];
        return newStates;
      });

      toast.success("Şube bilgileri kaydedildi");
      fetchCustomers();
    } catch {
      toast.error("Kaydetme sırasında bir hata oluştu");
    } finally {
      setSavingBranchId(null);
    }
  };

  // Virtual scrolling
  const useVirtual = flatRows.length > VIRTUAL_THRESHOLD;
  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => flatRows[index]?.type === "branch" ? 56 : 64,
    overscan: 5,
    enabled: useVirtual,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Get or initialize form state for a customer
  const getFormState = (customerId: string): FormState => {
    return (
      formStates[customerId] || {
        sgkKullaniciAdi: "",
        sgkIsyeriKodu: "",
        sgkSistemSifresi: "",
        sgkIsyeriSifresi: "",
        isDirty: false,
      }
    );
  };

  // Update form state
  const updateFormState = (
    customerId: string,
    field: SgkField,
    value: string
  ) => {
    setFormStates((prev) => ({
      ...prev,
      [customerId]: {
        ...getFormState(customerId),
        [field]: value,
        isDirty: true,
      },
    }));
  };

  // Save customer credentials
  const handleSave = async (customerId: string) => {
    const formState = getFormState(customerId);
    if (!formState.isDirty) return;

    // At least one field should have value
    const hasValue =
      formState.sgkKullaniciAdi.trim() ||
      formState.sgkIsyeriKodu.trim() ||
      formState.sgkSistemSifresi.trim() ||
      formState.sgkIsyeriSifresi.trim();

    if (!hasValue) {
      toast.error("En az bir alan doldurulmalı");
      return;
    }

    // OPTIMISTIC UPDATE: Hemen UI'ı güncelle
    const previousCustomers = customers;
    const previousFormStates = formStates;

    // UI'ı hemen güncelle
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          return {
            ...c,
            sgk: {
              ...c.sgk,
              hasKullaniciAdi: formState.sgkKullaniciAdi.trim() ? true : c.sgk.hasKullaniciAdi,
              hasIsyeriKodu: formState.sgkIsyeriKodu.trim() ? true : c.sgk.hasIsyeriKodu,
              hasSistemSifresi: formState.sgkSistemSifresi.trim() ? true : c.sgk.hasSistemSifresi,
              hasIsyeriSifresi: formState.sgkIsyeriSifresi.trim() ? true : c.sgk.hasIsyeriSifresi,
            },
          };
        }
        return c;
      })
    );

    // Form state'i temizle
    setFormStates((prev) => {
      const newStates = { ...prev };
      delete newStates[customerId];
      return newStates;
    });

    toast.success("Kaydedildi");

    // Arka planda API'ye gönder
    const payload: Record<string, string> = { type: "sgk" };
    if (formState.sgkKullaniciAdi.trim()) {
      payload.sgkKullaniciAdi = formState.sgkKullaniciAdi.trim();
    }
    if (formState.sgkIsyeriKodu.trim()) {
      payload.sgkIsyeriKodu = formState.sgkIsyeriKodu.trim();
    }
    if (formState.sgkSistemSifresi.trim()) {
      payload.sgkSistemSifresi = formState.sgkSistemSifresi.trim();
    }
    if (formState.sgkIsyeriSifresi.trim()) {
      payload.sgkIsyeriSifresi = formState.sgkIsyeriSifresi.trim();
    }

    try {
      const response = await fetch(`/api/customers/${customerId}/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Kaydetme başarısız");
    } catch (error) {
      // Hata durumunda geri al
      console.error("Kaydetme hatası:", error);
      setCustomers(previousCustomers);
      setFormStates(previousFormStates);
      toast.error("Kaydetme sırasında bir hata oluştu");
    }
  };

  const getStatus = (customer: CustomerPasswordSummary) => {
    // Şubeli müşteri: tüm şubelerin credential'ları tamamsa yeşil
    if (customer.branches?.length > 0) {
      return customer.branches.every(b =>
        b.sgk.hasKullaniciAdi && b.sgk.hasIsyeriKodu && b.sgk.hasSistemSifresi && b.sgk.hasIsyeriSifresi
      );
    }
    return (
      customer.sgk.hasKullaniciAdi &&
      customer.sgk.hasIsyeriKodu &&
      customer.sgk.hasSistemSifresi &&
      customer.sgk.hasIsyeriSifresi
    );
  };

  const hasBranches = (customer: CustomerPasswordSummary) => customer.branches?.length > 0;

  const togglePassword = (customerId: string, field: string) => {
    setShowPasswords((prev) => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        [field]: !prev[customerId]?.[field],
      },
    }));
  };

  return (
    <div className="h-full flex flex-col p-6">
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">Şifreler</CardTitle>
              <CardDescription className="mt-1">
                SGK Kullanıcı Bilgileri
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-4">
          {/* Search and Actions */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Icon
                icon="solar:magnifer-linear"
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              />
              <Input
                placeholder="Mükellef ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportDialogOpen(true)}
              className="gap-2 shrink-0"
            >
              <Icon icon="solar:file-download-bold" className="size-4" />
              Excel ile Yükle
            </Button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center h-[calc(100%-60px)]">
              <Icon
                icon="solar:refresh-bold"
                className="size-6 animate-spin text-muted-foreground"
              />
              <span className="ml-2 text-muted-foreground">Yükleniyor...</span>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[calc(100%-60px)] text-muted-foreground">
              <Icon
                icon="solar:shield-user-bold"
                className="size-12 mb-4 opacity-50"
              />
              <p className="font-medium">
                {searchQuery
                  ? "Arama sonucu bulunamadı"
                  : "Henüz mükellef bulunmuyor"}
              </p>
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="mt-2"
                >
                  Aramayı Temizle
                </Button>
              )}
            </div>
          ) : (
            <div className="h-[calc(100%-60px)] flex flex-col">
              {/* Tablo Header */}
              <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b">
                <div className="grid grid-cols-[minmax(180px,1.2fr)_minmax(110px,1fr)_minmax(100px,1fr)_minmax(110px,1fr)_minmax(110px,1fr)_auto] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div>Şirket</div>
                  <div>Kullanıcı Adı</div>
                  <div>İşyeri Kodu</div>
                  <div>Sistem Şifresi</div>
                  <div>İşyeri Şifresi</div>
                  <div className="w-[70px]"></div>
                </div>
              </div>

              {/* Tablo Satırları - Virtual Scrolling */}
              <div ref={parentRef} className="flex-1 overflow-auto">
                <div
                  style={{
                    height: useVirtual ? totalSize : "auto",
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {useVirtual ? (
                    virtualRows.map((virtualRow) => {
                      const row = flatRows[virtualRow.index];
                      if (!row) return null;

                      // Branch row (virtual)
                      if (row.type === "branch") {
                        const { branch, customer } = row;
                        const branchForm = getBranchFormState(branch.id);
                        const isBranchSaving = savingBranchId === branch.id;

                        return (
                          <div
                            key={`vb-${branch.id}`}
                            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
                            className="grid grid-cols-[minmax(180px,1.2fr)_minmax(110px,1fr)_minmax(100px,1fr)_minmax(110px,1fr)_minmax(110px,1fr)_auto] gap-2 px-3 items-center bg-muted/30 border-l-2 border-primary/20 border-b border-border/50"
                          >
                            <div className="min-w-0 pl-6">
                              <div className="flex items-center gap-2">
                                <Icon icon="solar:branch-linear" className="size-3.5 text-muted-foreground shrink-0" />
                                <span className="text-xs font-medium truncate">{branch.branchName}</span>
                              </div>
                            </div>
                            <div className="relative"><Input type="text" placeholder={branch.sgk.kullaniciAdi || ""} value={branchForm.sgkKullaniciAdi} onChange={(e) => updateBranchFormState(branch.id, "sgkKullaniciAdi", e.target.value)} disabled={isBranchSaving} className="h-7 text-xs" /></div>
                            <div className="relative"><Input type="text" placeholder={branch.sgk.isyeriKodu || ""} value={branchForm.sgkIsyeriKodu} onChange={(e) => updateBranchFormState(branch.id, "sgkIsyeriKodu", e.target.value)} disabled={isBranchSaving} className="h-7 text-xs" /></div>
                            <div className="relative"><Input type="password" placeholder={branch.sgk.hasSistemSifresi ? "••••••" : ""} value={branchForm.sgkSistemSifresi} onChange={(e) => updateBranchFormState(branch.id, "sgkSistemSifresi", e.target.value)} disabled={isBranchSaving} className="h-7 text-xs" /></div>
                            <div className="relative"><Input type="password" placeholder={branch.sgk.hasIsyeriSifresi ? "••••••" : ""} value={branchForm.sgkIsyeriSifresi} onChange={(e) => updateBranchFormState(branch.id, "sgkIsyeriSifresi", e.target.value)} disabled={isBranchSaving} className="h-7 text-xs" /></div>
                            <div className="w-[70px]">
                              <Button size="sm" variant={branchForm.isDirty ? "default" : "ghost"} onClick={() => handleBranchSave(branch.id, customer.id)} disabled={!branchForm.isDirty || isBranchSaving} className="h-7 w-full text-xs gap-1">
                                {isBranchSaving ? <Icon icon="solar:refresh-bold" className="size-3 animate-spin" /> : <><Icon icon="solar:diskette-bold" className="size-3" />Kaydet</>}
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      // Customer row (virtual)
                      const { customer } = row;
                      const formState = getFormState(customer.id);
                      const isSaving = savingId === customer.id;
                      const isComplete = getStatus(customer);
                      const hasBr = hasBranches(customer);

                      return (
                        <div
                          key={customer.id}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: virtualRow.size,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                          className={cn(
                            "grid grid-cols-[minmax(180px,1.2fr)_minmax(110px,1fr)_minmax(100px,1fr)_minmax(110px,1fr)_minmax(110px,1fr)_auto] gap-2 px-3 items-center transition-colors border-b border-border/50",
                            virtualRow.index % 2 === 0 ? "bg-background" : "bg-muted/20",
                            "hover:bg-muted/40"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {hasBr ? (
                                <button type="button" onClick={() => toggleExpand(customer.id)} className="shrink-0 p-0.5 hover:bg-muted rounded">
                                  <Icon icon={expandedCustomers[customer.id] ? "solar:alt-arrow-down-linear" : "solar:alt-arrow-right-linear"} className="size-4 text-muted-foreground" />
                                </button>
                              ) : (
                                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", isComplete ? "bg-green-500" : "bg-yellow-500")} />
                              )}
                              <span className="font-medium text-sm truncate">{customer.kisaltma || customer.unvan}</span>
                              {hasBr && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 shrink-0">{customer.branches.length} şube</span>}
                            </div>
                            <span className="text-[10px] text-muted-foreground ml-3.5">{customer.vknTckn}</span>
                          </div>

                          {hasBr ? (
                            <><div className="text-xs text-muted-foreground italic col-span-4">{expandedCustomers[customer.id] ? "" : "Şubeleri görmek için tıklayın"}</div><div className="w-[70px]" /></>
                          ) : (
                            <>
                              <div className="relative"><Input type="text" placeholder={customer.sgk.kullaniciAdi || ""} value={formState.sgkKullaniciAdi} onChange={(e) => updateFormState(customer.id, "sgkKullaniciAdi", e.target.value)} disabled={isSaving} className={cn("h-8 text-xs", customer.sgk.kullaniciAdi && !formState.sgkKullaniciAdi && "placeholder:text-foreground/70")} />{customer.sgk.hasKullaniciAdi && !formState.sgkKullaniciAdi && <Icon icon="solar:check-circle-bold" className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-green-500" />}</div>
                              <div className="relative"><Input type="text" placeholder={customer.sgk.isyeriKodu || ""} value={formState.sgkIsyeriKodu} onChange={(e) => updateFormState(customer.id, "sgkIsyeriKodu", e.target.value)} disabled={isSaving} className={cn("h-8 text-xs", customer.sgk.isyeriKodu && !formState.sgkIsyeriKodu && "placeholder:text-foreground/70")} />{customer.sgk.hasIsyeriKodu && !formState.sgkIsyeriKodu && <Icon icon="solar:check-circle-bold" className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-green-500" />}</div>
                              <div className="relative"><Input type={showPasswords[customer.id]?.sgkSistemSifresi ? "text" : "password"} placeholder={customer.sgk.hasSistemSifresi ? "••••••" : ""} value={formState.sgkSistemSifresi} onChange={(e) => updateFormState(customer.id, "sgkSistemSifresi", e.target.value)} disabled={isSaving} className="h-8 text-xs pr-8" /><button type="button" onClick={() => togglePassword(customer.id, "sgkSistemSifresi")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"><Icon icon={showPasswords[customer.id]?.sgkSistemSifresi ? "solar:eye-closed-linear" : "solar:eye-linear"} className="size-4" /></button></div>
                              <div className="relative"><Input type={showPasswords[customer.id]?.sgkIsyeriSifresi ? "text" : "password"} placeholder={customer.sgk.hasIsyeriSifresi ? "••••••" : ""} value={formState.sgkIsyeriSifresi} onChange={(e) => updateFormState(customer.id, "sgkIsyeriSifresi", e.target.value)} disabled={isSaving} className="h-8 text-xs pr-8" /><button type="button" onClick={() => togglePassword(customer.id, "sgkIsyeriSifresi")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"><Icon icon={showPasswords[customer.id]?.sgkIsyeriSifresi ? "solar:eye-closed-linear" : "solar:eye-linear"} className="size-4" /></button></div>
                              <div className="w-[70px]"><Button size="sm" variant={formState.isDirty ? "default" : "ghost"} onClick={() => handleSave(customer.id)} disabled={!formState.isDirty || isSaving} className="h-8 w-full text-xs gap-1">{isSaving ? <Icon icon="solar:refresh-bold" className="size-3.5 animate-spin" /> : <><Icon icon="solar:diskette-bold" className="size-3.5" />Kaydet</>}</Button></div>
                            </>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="divide-y divide-border/50">
                      {flatRows.map((row) => {
                        if (row.type === "branch") {
                          const { branch, customer } = row;
                          const branchForm = getBranchFormState(branch.id);
                          const isBranchSaving = savingBranchId === branch.id;

                          return (
                            <div
                              key={`branch-${branch.id}`}
                              className="grid grid-cols-[minmax(180px,1.2fr)_minmax(110px,1fr)_minmax(100px,1fr)_minmax(110px,1fr)_minmax(110px,1fr)_auto] gap-2 px-3 py-1.5 items-center bg-muted/30 border-l-2 border-primary/20"
                            >
                              {/* Şube Adı */}
                              <div className="min-w-0 pl-6">
                                <div className="flex items-center gap-2">
                                  <Icon icon="solar:branch-linear" className="size-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-xs font-medium truncate">{branch.branchName}</span>
                                  {branch.sgk.hasKullaniciAdi && branch.sgk.hasIsyeriKodu && branch.sgk.hasSistemSifresi && branch.sgk.hasIsyeriSifresi ? (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">Tamam</span>
                                  ) : (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">Eksik</span>
                                  )}
                                </div>
                              </div>

                              {/* Kullanıcı Adı */}
                              <div className="relative">
                                <Input
                                  type="text"
                                  placeholder={branch.sgk.kullaniciAdi || ""}
                                  value={branchForm.sgkKullaniciAdi}
                                  onChange={(e) => updateBranchFormState(branch.id, "sgkKullaniciAdi", e.target.value)}
                                  disabled={isBranchSaving}
                                  className={cn("h-7 text-xs", branch.sgk.kullaniciAdi && !branchForm.sgkKullaniciAdi && "placeholder:text-foreground/70")}
                                />
                              </div>

                              {/* İşyeri Kodu */}
                              <div className="relative">
                                <Input
                                  type="text"
                                  placeholder={branch.sgk.isyeriKodu || ""}
                                  value={branchForm.sgkIsyeriKodu}
                                  onChange={(e) => updateBranchFormState(branch.id, "sgkIsyeriKodu", e.target.value)}
                                  disabled={isBranchSaving}
                                  className={cn("h-7 text-xs", branch.sgk.isyeriKodu && !branchForm.sgkIsyeriKodu && "placeholder:text-foreground/70")}
                                />
                              </div>

                              {/* Sistem Şifresi */}
                              <div className="relative">
                                <Input
                                  type={showPasswords[branch.id]?.sgkSistemSifresi ? "text" : "password"}
                                  placeholder={branch.sgk.hasSistemSifresi ? "••••••" : ""}
                                  value={branchForm.sgkSistemSifresi}
                                  onChange={(e) => updateBranchFormState(branch.id, "sgkSistemSifresi", e.target.value)}
                                  disabled={isBranchSaving}
                                  className="h-7 text-xs pr-8"
                                />
                                <button type="button" onClick={() => togglePassword(branch.id, "sgkSistemSifresi")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                  <Icon icon={showPasswords[branch.id]?.sgkSistemSifresi ? "solar:eye-closed-linear" : "solar:eye-linear"} className="size-3.5" />
                                </button>
                              </div>

                              {/* İşyeri Şifresi */}
                              <div className="relative">
                                <Input
                                  type={showPasswords[branch.id]?.sgkIsyeriSifresi ? "text" : "password"}
                                  placeholder={branch.sgk.hasIsyeriSifresi ? "••••••" : ""}
                                  value={branchForm.sgkIsyeriSifresi}
                                  onChange={(e) => updateBranchFormState(branch.id, "sgkIsyeriSifresi", e.target.value)}
                                  disabled={isBranchSaving}
                                  className="h-7 text-xs pr-8"
                                />
                                <button type="button" onClick={() => togglePassword(branch.id, "sgkIsyeriSifresi")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                  <Icon icon={showPasswords[branch.id]?.sgkIsyeriSifresi ? "solar:eye-closed-linear" : "solar:eye-linear"} className="size-3.5" />
                                </button>
                              </div>

                              {/* Kaydet Butonu */}
                              <div className="w-[70px]">
                                <Button
                                  size="sm"
                                  variant={branchForm.isDirty ? "default" : "ghost"}
                                  onClick={() => handleBranchSave(branch.id, customer.id)}
                                  disabled={!branchForm.isDirty || isBranchSaving}
                                  className="h-7 w-full text-xs gap-1"
                                >
                                  {isBranchSaving ? (
                                    <Icon icon="solar:refresh-bold" className="size-3 animate-spin" />
                                  ) : (
                                    <><Icon icon="solar:diskette-bold" className="size-3" />Kaydet</>
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        }

                        // Customer row
                        const { customer, index } = row;
                        const formState = getFormState(customer.id);
                        const isSaving = savingId === customer.id;
                        const isComplete = getStatus(customer);
                        const hasBr = hasBranches(customer);
                        const isExpanded = expandedCustomers[customer.id];

                        return (
                          <div
                            key={customer.id}
                            className={cn(
                              "grid grid-cols-[minmax(180px,1.2fr)_minmax(110px,1fr)_minmax(100px,1fr)_minmax(110px,1fr)_minmax(110px,1fr)_auto] gap-2 px-3 py-2 items-center transition-colors",
                              index % 2 === 0 ? "bg-background" : "bg-muted/20",
                              "hover:bg-muted/40"
                            )}
                          >
                            {/* Şirket */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {hasBr ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(customer.id)}
                                    className="shrink-0 p-0.5 hover:bg-muted rounded transition-colors"
                                  >
                                    <Icon
                                      icon={isExpanded ? "solar:alt-arrow-down-linear" : "solar:alt-arrow-right-linear"}
                                      className="size-4 text-muted-foreground transition-transform"
                                    />
                                  </button>
                                ) : (
                                  <div
                                    className={cn(
                                      "w-1.5 h-1.5 rounded-full shrink-0",
                                      isComplete ? "bg-green-500" : "bg-yellow-500"
                                    )}
                                  />
                                )}
                                <span className="font-medium text-sm truncate">
                                  {customer.kisaltma || customer.unvan}
                                </span>
                                {hasBr && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 shrink-0">
                                    {customer.branches.length} şube
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground ml-3.5">
                                {customer.vknTckn}
                              </span>
                            </div>

                            {hasBr ? (
                              <>
                                {/* Şubeli müşterinin SGK alanları boş */}
                                <div className="text-xs text-muted-foreground italic col-span-4">
                                  {isExpanded ? "" : "Şubeleri görmek için tıklayın"}
                                </div>
                                <div className="w-[70px]" />
                              </>
                            ) : (
                              <>
                                {/* Kullanıcı Adı */}
                                <div className="relative">
                                  <Input
                                    type="text"
                                    placeholder={customer.sgk.kullaniciAdi || ""}
                                    value={formState.sgkKullaniciAdi}
                                    onChange={(e) =>
                                      updateFormState(customer.id, "sgkKullaniciAdi", e.target.value)
                                    }
                                    disabled={isSaving}
                                    className={cn(
                                      "h-8 text-xs",
                                      customer.sgk.kullaniciAdi && !formState.sgkKullaniciAdi && "placeholder:text-foreground/70"
                                    )}
                                  />
                                  {customer.sgk.hasKullaniciAdi && !formState.sgkKullaniciAdi && (
                                    <Icon
                                      icon="solar:check-circle-bold"
                                      className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-green-500"
                                    />
                                  )}
                                </div>

                                {/* İşyeri Kodu */}
                                <div className="relative">
                                  <Input
                                    type="text"
                                    placeholder={customer.sgk.isyeriKodu || ""}
                                    value={formState.sgkIsyeriKodu}
                                    onChange={(e) =>
                                      updateFormState(customer.id, "sgkIsyeriKodu", e.target.value)
                                    }
                                    disabled={isSaving}
                                    className={cn(
                                      "h-8 text-xs",
                                      customer.sgk.isyeriKodu && !formState.sgkIsyeriKodu && "placeholder:text-foreground/70"
                                    )}
                                  />
                                  {customer.sgk.hasIsyeriKodu && !formState.sgkIsyeriKodu && (
                                    <Icon
                                      icon="solar:check-circle-bold"
                                      className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-green-500"
                                    />
                                  )}
                                </div>

                                {/* Sistem Şifresi */}
                                <div className="relative">
                                  <Input
                                    type={showPasswords[customer.id]?.sgkSistemSifresi ? "text" : "password"}
                                    placeholder={customer.sgk.hasSistemSifresi ? "••••••" : ""}
                                    value={formState.sgkSistemSifresi}
                                    onChange={(e) =>
                                      updateFormState(customer.id, "sgkSistemSifresi", e.target.value)
                                    }
                                    disabled={isSaving}
                                    className="h-8 text-xs pr-8"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => togglePassword(customer.id, "sgkSistemSifresi")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Icon
                                      icon={
                                        showPasswords[customer.id]?.sgkSistemSifresi
                                          ? "solar:eye-closed-linear"
                                          : "solar:eye-linear"
                                      }
                                      className="size-4"
                                    />
                                  </button>
                                </div>

                                {/* İşyeri Şifresi */}
                                <div className="relative">
                                  <Input
                                    type={showPasswords[customer.id]?.sgkIsyeriSifresi ? "text" : "password"}
                                    placeholder={customer.sgk.hasIsyeriSifresi ? "••••••" : ""}
                                    value={formState.sgkIsyeriSifresi}
                                    onChange={(e) =>
                                      updateFormState(customer.id, "sgkIsyeriSifresi", e.target.value)
                                    }
                                    disabled={isSaving}
                                    className="h-8 text-xs pr-8"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => togglePassword(customer.id, "sgkIsyeriSifresi")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Icon
                                      icon={
                                        showPasswords[customer.id]?.sgkIsyeriSifresi
                                          ? "solar:eye-closed-linear"
                                          : "solar:eye-linear"
                                      }
                                      className="size-4"
                                    />
                                  </button>
                                </div>

                                {/* Kaydet Butonu */}
                                <div className="w-[70px]">
                                  <Button
                                    size="sm"
                                    variant={formState.isDirty ? "default" : "ghost"}
                                    onClick={() => handleSave(customer.id)}
                                    disabled={!formState.isDirty || isSaving}
                                    className="h-8 w-full text-xs gap-1"
                                  >
                                    {isSaving ? (
                                      <Icon
                                        icon="solar:refresh-bold"
                                        className="size-3.5 animate-spin"
                                      />
                                    ) : (
                                      <>
                                        <Icon icon="solar:diskette-bold" className="size-3.5" />
                                        Kaydet
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ExcelImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        type="sgk"
        onSuccess={fetchCustomers}
      />
    </div>
  );
}
