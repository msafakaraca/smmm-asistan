"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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

interface CustomerPasswordSummary {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  edevlet: {
    tckn: string | null;
    sifre: string | null;
    hasTckn: boolean;
    hasSifre: boolean;
  };
}

// Form state for each customer
interface FormState {
  edevletTckn: string;
  edevletSifre: string;
  isDirty: boolean;
}

// Virtual scrolling threshold
const VIRTUAL_THRESHOLD = 100;

export function EdevletPasswordsTable() {
  const [customers, setCustomers] = useState<CustomerPasswordSummary[]>([]);
  const [loading, setLoading] = useState(true);
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
      if (!response.ok) throw new Error("Veriler yuklenemedi");
      const data = await response.json();
      setCustomers(data);
      // Reset form states when data is fetched
      setFormStates({});
    } catch (error) {
      console.error("Sifreler yuklenirken hata:", error);
      toast.error("Sifreler yuklenirken bir hata olustu");
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
        edevletTckn: "",
        edevletSifre: "",
        isDirty: false,
      }
    );
  };

  // Update form state
  const updateFormState = (
    customerId: string,
    field: "edevletTckn" | "edevletSifre",
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
    if (!formState.edevletTckn.trim() && !formState.edevletSifre.trim()) {
      toast.error("En az bir alan doldurulmali");
      return;
    }

    // OPTIMISTIC UPDATE: Hemen UI'i guncelle
    const previousCustomers = customers;
    const previousFormStates = formStates;

    // UI'i hemen guncelle - degerleri ve flag'leri guncelle
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          return {
            ...c,
            edevlet: {
              ...c.edevlet,
              tckn: formState.edevletTckn.trim() || c.edevlet.tckn,
              sifre: formState.edevletSifre.trim() || c.edevlet.sifre,
              hasTckn: formState.edevletTckn.trim() ? true : c.edevlet.hasTckn,
              hasSifre: formState.edevletSifre.trim() ? true : c.edevlet.hasSifre,
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

    // Arka planda API'ye gonder
    const payload: Record<string, string> = { type: "edevlet" };
    if (formState.edevletTckn.trim()) {
      payload.edevletTckn = formState.edevletTckn.trim();
    }
    if (formState.edevletSifre.trim()) {
      payload.edevletSifre = formState.edevletSifre.trim();
    }

    try {
      const response = await fetch(`/api/customers/${customerId}/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Kaydetme basarisiz");
    } catch (error) {
      // Hata durumunda geri al
      console.error("Kaydetme hatasi:", error);
      setCustomers(previousCustomers);
      setFormStates(previousFormStates);
      toast.error("Kaydetme sirasinda bir hata olustu");
    }
  };

  const getStatus = (customer: CustomerPasswordSummary) => {
    return customer.edevlet.hasTckn && customer.edevlet.hasSifre;
  };

  const togglePassword = (customerId: string) => {
    setShowPasswords((prev) => ({
      ...prev,
      [customerId]: !prev[customerId],
    }));
  };

  // Render row content
  const renderRow = (customer: CustomerPasswordSummary, index: number) => {
    const formState = getFormState(customer.id);
    const isSaving = savingId === customer.id;
    const isComplete = getStatus(customer);

    return (
      <>
        {/* Sirket */}
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

        {/* T.C. Kimlik No */}
        <div className="relative">
          <Input
            type="text"
            placeholder="T.C. Kimlik No girin"
            value={formState.isDirty ? formState.edevletTckn : (customer.edevlet.tckn || "")}
            onChange={(e) =>
              updateFormState(customer.id, "edevletTckn", e.target.value)
            }
            disabled={isSaving}
            className="h-8 text-xs"
            maxLength={11}
          />
          {customer.edevlet.hasTckn && !formState.isDirty && (
            <Icon
              icon="solar:check-circle-bold"
              className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-green-500"
            />
          )}
        </div>

        {/* e-Devlet Sifresi */}
        <div className="relative">
          <Input
            type={showPasswords[customer.id] ? "text" : "password"}
            placeholder="e-Devlet sifresi girin"
            value={formState.isDirty ? formState.edevletSifre : (customer.edevlet.sifre || "")}
            onChange={(e) =>
              updateFormState(customer.id, "edevletSifre", e.target.value)
            }
            disabled={isSaving}
            className="h-8 text-xs pr-8"
          />
          {customer.edevlet.sifre && (
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
      </>
    );
  };

  return (
    <div className="h-full flex flex-col p-6">
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">Sifreler</CardTitle>
              <CardDescription className="mt-1">
                e-Devlet Kapisi Giris Bilgileri
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-4">
          {/* Search */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Icon
                icon="solar:magnifer-linear"
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              />
              <Input
                placeholder="Mukellef ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center h-[calc(100%-60px)]">
              <Icon
                icon="solar:refresh-bold"
                className="size-6 animate-spin text-muted-foreground"
              />
              <span className="ml-2 text-muted-foreground">Yukleniyor...</span>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[calc(100%-60px)] text-muted-foreground">
              <Icon
                icon="solar:shield-keyhole-bold"
                className="size-12 mb-4 opacity-50"
              />
              <p className="font-medium">
                {searchQuery
                  ? "Arama sonucu bulunamadi"
                  : "Henuz mukellef bulunmuyor"}
              </p>
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="mt-2"
                >
                  Aramayi Temizle
                </Button>
              )}
            </div>
          ) : (
            <div className="h-[calc(100%-60px)] flex flex-col">
              {/* Tablo Header */}
              <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b">
                <div className="grid grid-cols-[minmax(200px,1.5fr)_minmax(140px,1fr)_minmax(140px,1fr)_auto] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div>Sirket</div>
                  <div>T.C. Kimlik No</div>
                  <div>e-Devlet Sifresi</div>
                  <div className="w-[70px]"></div>
                </div>
              </div>

              {/* Tablo Satirlari - Virtual Scrolling */}
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
                          {renderRow(customer, virtualRow.index)}
                        </div>
                      );
                    })
                  ) : (
                    <div className="divide-y divide-border/50">
                      {filteredCustomers.map((customer, index) => (
                        <div
                          key={customer.id}
                          className={cn(
                            "grid grid-cols-[minmax(200px,1.5fr)_minmax(140px,1fr)_minmax(140px,1fr)_auto] gap-2 px-3 py-2 items-center transition-colors",
                            index % 2 === 0 ? "bg-background" : "bg-muted/20",
                            "hover:bg-muted/40"
                          )}
                        >
                          {renderRow(customer, index)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
