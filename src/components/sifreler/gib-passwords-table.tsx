"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useVirtualizer } from "@tanstack/react-virtual";
import { observeElementRectHeightOnly } from "@/lib/virtualizer-helpers";
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

interface CustomerPasswordSummary {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  gib: {
    kodu: string | null;
    sifre: string | null;
    hasKodu: boolean;
    hasSifre: boolean;
    hasParola: boolean;
    hasInteraktifSifre: boolean;
    hasEmuhurPin: boolean;
  };
  sgk: {
    kullaniciAdi: string | null;
    isyeriKodu: string | null;
    sistemSifresi: string | null;
    isyeriSifresi: string | null;
    hasKullaniciAdi: boolean;
    hasIsyeriKodu: boolean;
    hasSistemSifresi: boolean;
    hasIsyeriSifresi: boolean;
  };
}

// Form state for each customer
interface FormState {
  gibKodu: string;
  gibSifre: string;
  isDirty: boolean;
}

// Virtual scrolling threshold
const VIRTUAL_THRESHOLD = 100;

export function GibPasswordsTable() {
  const [customers, setCustomers] = useState<CustomerPasswordSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // Form states per customer
  const [formStates, setFormStates] = useState<Record<string, FormState>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>(
    {}
  );

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

  // Virtual scrolling
  const useVirtual = filteredCustomers.length > VIRTUAL_THRESHOLD;
  const rowVirtualizer = useVirtualizer({
    count: filteredCustomers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
    enabled: useVirtual,
    observeElementRect: observeElementRectHeightOnly,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Get or initialize form state for a customer
  const getFormState = (customerId: string): FormState => {
    return (
      formStates[customerId] || {
        gibKodu: "",
        gibSifre: "",
        isDirty: false,
      }
    );
  };

  // Update form state
  const updateFormState = (
    customerId: string,
    field: "gibKodu" | "gibSifre",
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
    if (!formState.gibKodu.trim() && !formState.gibSifre.trim()) {
      toast.error("En az bir alan doldurulmalı");
      return;
    }

    // OPTIMISTIC UPDATE: Hemen UI'ı güncelle
    const previousCustomers = customers;
    const previousFormStates = formStates;

    // UI'ı hemen güncelle - değerleri ve flag'leri güncelle
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          return {
            ...c,
            gib: {
              ...c.gib,
              kodu: formState.gibKodu.trim() || c.gib.kodu,
              sifre: formState.gibSifre.trim() || c.gib.sifre,
              hasKodu: formState.gibKodu.trim() ? true : c.gib.hasKodu,
              hasSifre: formState.gibSifre.trim() ? true : c.gib.hasSifre,
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
    const payload: Record<string, string> = { type: "gib" };
    if (formState.gibKodu.trim()) {
      payload.gibKodu = formState.gibKodu.trim();
    }
    if (formState.gibSifre.trim()) {
      payload.gibSifre = formState.gibSifre.trim();
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
    return customer.gib.hasKodu && customer.gib.hasSifre;
  };

  const togglePassword = (customerId: string) => {
    setShowPasswords((prev) => ({
      ...prev,
      [customerId]: !prev[customerId],
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
                GİB Kullanıcı Bilgileri
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
                icon="solar:lock-keyhole-bold"
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
                <div className="grid grid-cols-[minmax(200px,1.5fr)_minmax(140px,1fr)_minmax(140px,1fr)_auto] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div>Şirket</div>
                  <div>Kullanıcı Adı</div>
                  <div>Şifre</div>
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
                      const customer = filteredCustomers[virtualRow.index];
                      const formState = getFormState(customer.id);
                      const isSaving = savingId === customer.id;
                      const isComplete = getStatus(customer);

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
                            "grid grid-cols-[minmax(200px,1.5fr)_minmax(140px,1fr)_minmax(140px,1fr)_auto] gap-2 px-3 items-center transition-colors border-b border-border/50",
                            virtualRow.index % 2 === 0 ? "bg-background" : "bg-muted/20",
                            "hover:bg-muted/40"
                          )}
                        >
                          {/* Şirket */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full shrink-0",
                                  isComplete ? "bg-green-500" : "bg-yellow-500"
                                )}
                              />
                              <span className="font-medium text-sm truncate">
                                {customer.kisaltma || customer.unvan}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground ml-3.5">
                              {customer.vknTckn}
                            </span>
                          </div>

                          {/* Kullanıcı Adı */}
                          <div className="relative">
                            <Input
                              type="text"
                              placeholder="Kullanıcı adı girin"
                              value={formState.isDirty ? formState.gibKodu : (customer.gib.kodu || "")}
                              onChange={(e) =>
                                updateFormState(customer.id, "gibKodu", e.target.value)
                              }
                              disabled={isSaving}
                              className="h-8 text-xs"
                            />
                            {customer.gib.hasKodu && !formState.isDirty && (
                              <Icon
                                icon="solar:check-circle-bold"
                                className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-green-500"
                              />
                            )}
                          </div>

                          {/* Şifre */}
                          <div className="relative">
                            <Input
                              type={showPasswords[customer.id] ? "text" : "password"}
                              placeholder="Şifre girin"
                              value={formState.isDirty ? formState.gibSifre : (customer.gib.sifre || "")}
                              onChange={(e) =>
                                updateFormState(customer.id, "gibSifre", e.target.value)
                              }
                              disabled={isSaving}
                              className="h-8 text-xs pr-8"
                            />
                            {customer.gib.sifre && (
                              <button
                                type="button"
                                onClick={() => togglePassword(customer.id)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Icon
                                  icon={
                                    showPasswords[customer.id]
                                      ? "solar:eye-closed-linear"
                                      : "solar:eye-linear"
                                  }
                                  className="size-4"
                                />
                              </button>
                            )}
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
                        </div>
                      );
                    })
                  ) : (
                    <div className="divide-y divide-border/50">
                      {filteredCustomers.map((customer, index) => {
                        const formState = getFormState(customer.id);
                        const isSaving = savingId === customer.id;
                        const isComplete = getStatus(customer);

                        return (
                          <div
                            key={customer.id}
                            className={cn(
                              "grid grid-cols-[minmax(200px,1.5fr)_minmax(140px,1fr)_minmax(140px,1fr)_auto] gap-2 px-3 py-2 items-center transition-colors",
                              index % 2 === 0 ? "bg-background" : "bg-muted/20",
                              "hover:bg-muted/40"
                            )}
                          >
                            {/* Şirket */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                    isComplete ? "bg-green-500" : "bg-yellow-500"
                                  )}
                                />
                                <span className="font-medium text-sm truncate">
                                  {customer.kisaltma || customer.unvan}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground ml-3.5">
                                {customer.vknTckn}
                              </span>
                            </div>

                            {/* Kullanıcı Adı */}
                            <div className="relative">
                              <Input
                                type="text"
                                placeholder="Kullanıcı adı girin"
                                value={formState.isDirty ? formState.gibKodu : (customer.gib.kodu || "")}
                                onChange={(e) =>
                                  updateFormState(customer.id, "gibKodu", e.target.value)
                                }
                                disabled={isSaving}
                                className="h-8 text-xs"
                              />
                              {customer.gib.hasKodu && !formState.isDirty && (
                                <Icon
                                  icon="solar:check-circle-bold"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-green-500"
                                />
                              )}
                            </div>

                            {/* Şifre */}
                            <div className="relative">
                              <Input
                                type={showPasswords[customer.id] ? "text" : "password"}
                                placeholder="Şifre girin"
                                value={formState.isDirty ? formState.gibSifre : (customer.gib.sifre || "")}
                                onChange={(e) =>
                                  updateFormState(customer.id, "gibSifre", e.target.value)
                                }
                                disabled={isSaving}
                                className="h-8 text-xs pr-8"
                              />
                              {customer.gib.sifre && (
                                <button
                                  type="button"
                                  onClick={() => togglePassword(customer.id)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <Icon
                                    icon={
                                      showPasswords[customer.id]
                                        ? "solar:eye-closed-linear"
                                        : "solar:eye-linear"
                                    }
                                    className="size-4"
                                  />
                                </button>
                              )}
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
        type="gib"
        onSuccess={fetchCustomers}
      />
    </div>
  );
}
