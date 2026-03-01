"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Building2, User, Loader2, Search, X, ChevronDown, Briefcase, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Customer {
  id: string;
  unvan: string;
  kisaltma?: string | null;
  vknTckn: string;
  sirketTipi: string;
}

type FilterType = "all" | "firma" | "sahis" | "basit_usul";

const FILTER_OPTIONS: { value: FilterType; label: string; icon?: React.ReactNode }[] = [
  { value: "all", label: "Tümü" },
  { value: "firma", label: "Firma", icon: <Building2 className="h-3 w-3" /> },
  { value: "sahis", label: "Şahıs", icon: <User className="h-3 w-3" /> },
  { value: "basit_usul", label: "Basit Usul", icon: <Briefcase className="h-3 w-3" /> },
];

const SIRKET_TIPI_LABELS: Record<string, { label: string; color: string }> = {
  firma: { label: "Firma", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  sahis: { label: "Şahıs", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  basit_usul: { label: "Basit Usul", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
};

// Tekli seçim props
interface SingleSelectProps {
  multiple?: false;
  value?: string;
  onValueChange: (value: string | undefined) => void;
}

// Çoklu seçim props
interface MultiSelectProps {
  multiple: true;
  value?: string[];
  onValueChange: (value: string[]) => void;
}

type TaxpayerSelectProps = {
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
} & (SingleSelectProps | MultiSelectProps);

export function TaxpayerSelect(props: TaxpayerSelectProps) {
  const {
    placeholder = "Mükellef seçin",
    disabled = false,
    allowClear = true,
    multiple = false,
  } = props;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");

  // Çoklu seçim için geçici seçimler (dialog açıkken)
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);

  const fetchCustomers = useCallback(async () => {
    if (hasFetched && customers.length > 0) return;

    try {
      setLoading(true);
      const response = await fetch("/api/customers?status=active");
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
        setHasFetched(true);
      }
    } catch (error) {
      console.error("Müşteriler yüklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  }, [hasFetched, customers.length]);

  // Dialog açıldığında müşterileri yükle
  useEffect(() => {
    if (open && !hasFetched) {
      fetchCustomers();
    }
  }, [open, hasFetched, fetchCustomers]);

  // Dialog açıldığında mevcut seçimleri tempSelectedIds'e kopyala
  useEffect(() => {
    if (open && multiple) {
      const currentValues = (props as MultiSelectProps).value || [];
      setTempSelectedIds(currentValues);
    }
  }, [open, multiple, props]);

  // Dialog kapandığında filtreleri sıfırla
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setFilterType("all");
    }
  }, [open]);

  // Mevcut seçili müşteriler
  const selectedCustomers = useMemo(() => {
    if (multiple) {
      const ids = (props as MultiSelectProps).value || [];
      return customers.filter((c) => ids.includes(c.id));
    } else {
      const id = (props as SingleSelectProps).value;
      const customer = customers.find((c) => c.id === id);
      return customer ? [customer] : [];
    }
  }, [customers, multiple, props]);

  // Filtrelenmiş müşteriler
  const filteredCustomers = useMemo(() => {
    let result = customers;

    // Firma tipi filtresi
    if (filterType !== "all") {
      result = result.filter((c) => c.sirketTipi === filterType);
    }

    // Arama filtresi
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.unvan.toLowerCase().includes(query) ||
          c.kisaltma?.toLowerCase().includes(query) ||
          c.vknTckn.includes(query)
      );
    }

    return result;
  }, [customers, searchQuery, filterType]);

  // Firma tipi sayıları
  const typeCounts = useMemo(() => {
    return {
      all: customers.length,
      firma: customers.filter((c) => c.sirketTipi === "firma").length,
      sahis: customers.filter((c) => c.sirketTipi === "sahis").length,
      basit_usul: customers.filter((c) => c.sirketTipi === "basit_usul").length,
    };
  }, [customers]);

  const handleSingleSelect = (customerId: string) => {
    if (!multiple) {
      (props as SingleSelectProps).onValueChange(customerId);
      setOpen(false);
    }
  };

  const handleMultiToggle = (customerId: string) => {
    if (multiple) {
      setTempSelectedIds((prev) =>
        prev.includes(customerId)
          ? prev.filter((id) => id !== customerId)
          : [...prev, customerId]
      );
    }
  };

  const handleMultiConfirm = () => {
    if (multiple) {
      (props as MultiSelectProps).onValueChange(tempSelectedIds);
      setOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiple) {
      (props as MultiSelectProps).onValueChange([]);
    } else {
      (props as SingleSelectProps).onValueChange(undefined);
    }
  };

  const handleRemoveOne = (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation();
    if (multiple) {
      const currentValues = (props as MultiSelectProps).value || [];
      (props as MultiSelectProps).onValueChange(
        currentValues.filter((id) => id !== customerId)
      );
    }
  };

  const getCustomerIcon = (sirketTipi: string) => {
    switch (sirketTipi) {
      case "firma":
        return <Building2 className="h-4 w-4 text-blue-600 shrink-0" />;
      case "basit_usul":
        return <Briefcase className="h-4 w-4 text-amber-600 shrink-0" />;
      default:
        return <User className="h-4 w-4 text-emerald-600 shrink-0" />;
    }
  };

  const hasValue = multiple
    ? ((props as MultiSelectProps).value || []).length > 0
    : !!(props as SingleSelectProps).value;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className={cn(
          "w-full justify-between font-normal h-auto min-h-9",
          !hasValue && "text-muted-foreground"
        )}
      >
        {selectedCustomers.length > 0 ? (
          <div className="flex items-center gap-1.5 flex-wrap py-0.5">
            {multiple ? (
              // Çoklu seçim - badge'ler göster
              <>
                {selectedCustomers.slice(0, 2).map((customer) => (
                  <Badge
                    key={customer.id}
                    variant="secondary"
                    className="text-xs px-2 py-0.5 flex items-center gap-1"
                  >
                    {getCustomerIcon(customer.sirketTipi)}
                    <span className="max-w-[100px] truncate">
                      {customer.kisaltma || customer.unvan}
                    </span>
                    <X
                      className="h-3 w-3 opacity-50 hover:opacity-100 cursor-pointer ml-0.5"
                      onClick={(e) => handleRemoveOne(e, customer.id)}
                    />
                  </Badge>
                ))}
                {selectedCustomers.length > 2 && (
                  <Badge variant="outline" className="text-xs px-2 py-0.5">
                    +{selectedCustomers.length - 2} daha
                  </Badge>
                )}
              </>
            ) : (
              // Tekli seçim
              <div className="flex items-center gap-2 truncate">
                {getCustomerIcon(selectedCustomers[0].sirketTipi)}
                <span className="truncate">
                  {selectedCustomers[0].kisaltma || selectedCustomers[0].unvan}
                </span>
              </div>
            )}
          </div>
        ) : (
          <span>{placeholder}</span>
        )}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {allowClear && hasValue && (
            <X
              className="h-4 w-4 opacity-50 hover:opacity-100 cursor-pointer"
              onClick={handleClear}
            />
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </div>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px] p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>
              {multiple ? "Mükellef Seç (Çoklu)" : "Mükellef Seç"}
            </DialogTitle>
          </DialogHeader>

          <div className="px-4 pb-2 space-y-3">
            {/* Arama inputu */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ara... (ünvan, kısaltma veya VKN)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            {/* Firma tipi filtreleri */}
            <div className="flex items-center gap-2 flex-wrap">
              {FILTER_OPTIONS.map((option) => {
                const count = typeCounts[option.value];
                const isActive = filterType === option.value;

                if (count === 0 && option.value !== "all") return null;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilterType(option.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    )}
                  >
                    {option.icon}
                    {option.label}
                    <span className={cn(
                      "ml-1 px-1.5 py-0.5 rounded-full text-[10px]",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-background text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Çoklu seçimde seçilen sayı */}
            {multiple && tempSelectedIds.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {tempSelectedIds.length} mükellef seçildi
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setTempSelectedIds([])}
                >
                  Temizle
                </Button>
              </div>
            )}

            {/* Mükellef listesi */}
            <ScrollArea className="h-[300px] rounded-md border">
              {loading ? (
                <div className="py-12 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {searchQuery || filterType !== "all"
                    ? "Sonuç bulunamadı"
                    : "Mükellef bulunamadı"}
                </div>
              ) : (
                <div className="p-2">
                  {filteredCustomers.map((customer) => {
                    const typeInfo = SIRKET_TIPI_LABELS[customer.sirketTipi] || SIRKET_TIPI_LABELS.sahis;
                    const isSelected = multiple
                      ? tempSelectedIds.includes(customer.id)
                      : (props as SingleSelectProps).value === customer.id;

                    return (
                      <div
                        key={customer.id}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          multiple
                            ? handleMultiToggle(customer.id)
                            : handleSingleSelect(customer.id)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            multiple
                              ? handleMultiToggle(customer.id)
                              : handleSingleSelect(customer.id);
                          }
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left hover:bg-accent transition-colors mb-1 cursor-pointer",
                          isSelected && "bg-accent ring-1 ring-primary/20"
                        )}
                      >
                        {/* Çoklu seçimde checkbox */}
                        {multiple && (
                          <div className="shrink-0">
                            <div
                              className={cn(
                                "h-4 w-4 rounded-[4px] border flex items-center justify-center transition-colors",
                                isSelected
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-input bg-background"
                              )}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                          </div>
                        )}

                        {/* İkon */}
                        <div className="shrink-0">
                          {getCustomerIcon(customer.sirketTipi)}
                        </div>

                        {/* İsim ve VKN */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm leading-tight">
                            {customer.kisaltma || customer.unvan}
                          </div>
                          {customer.kisaltma && customer.unvan !== customer.kisaltma && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {customer.unvan}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {customer.vknTckn.length === 10 ? "VKN" : "TCKN"}: {customer.vknTckn}
                          </div>
                        </div>

                        {/* Firma tipi badge */}
                        <Badge
                          variant="secondary"
                          className={cn(
                            "shrink-0 text-[10px] px-2 py-0.5",
                            typeInfo.color
                          )}
                        >
                          {typeInfo.label}
                        </Badge>

                        {/* Tekli seçimde seçim işareti */}
                        {!multiple && isSelected && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Alt bilgi */}
            <div className="text-xs text-muted-foreground text-center">
              {filteredCustomers.length} / {customers.length} mükellef gösteriliyor
            </div>
          </div>

          {/* Çoklu seçimde onay butonu */}
          {multiple && (
            <DialogFooter className="px-4 pb-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                İptal
              </Button>
              <Button onClick={handleMultiConfirm}>
                {tempSelectedIds.length > 0
                  ? `${tempSelectedIds.length} Mükellef Seç`
                  : "Seç"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
