/**
 * DosyalarSidebar Component
 *
 * Filtre paneli - şirket tipi, mükellef, beyanname türü, tarih filtreleri
 */

import { memo, useState, useMemo } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import type { Customer, BeyannameType } from "./types";
import { FILE_TYPE_OPTIONS, MONTH_OPTIONS, YEAR_OPTIONS } from "./types";
import { BEYANNAME_TYPE_OPTIONS } from "@/lib/constants/beyanname-types";

interface DosyalarSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  beyannameTypes: BeyannameType[];
  onApplyFilter: (params: FilterParams) => void;
  onClearFilter: () => void;
  hasFilterResults: boolean;
  filterLoading: boolean;
}

interface FilterParams {
  companyType: string;
  customerId: string;
  fileTypes: string[];
  beyannameType: string;
  month: number | null;
  year: number | null;
}

export const DosyalarSidebar = memo(function DosyalarSidebar({
  isOpen,
  onClose,
  customers,
  beyannameTypes,
  onApplyFilter,
  onClearFilter,
  hasFilterResults,
  filterLoading,
}: DosyalarSidebarProps) {
  // Filter state
  const [selectedCompanyType, setSelectedCompanyType] = useState("ALL");
  const [selectedCustomer, setSelectedCustomer] = useState("ALL");
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [selectedBeyannameType, setSelectedBeyannameType] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Filtered customers based on company type
  const filteredCustomers = useMemo(() => {
    if (selectedCompanyType === "ALL") return customers;
    return customers.filter(c => c.sirketTipi === selectedCompanyType);
  }, [customers, selectedCompanyType]);

  // Handle filter toggle
  const handleFileTypeToggle = (typeId: string, checked: boolean) => {
    setSelectedFileTypes(prev =>
      checked ? [...prev, typeId] : prev.filter(x => x !== typeId)
    );
  };

  // Handle apply filter - zorunlu parametreleri kontrol et
  const handleApplyFilter = () => {
    // Zorunlu parametreleri kontrol et
    const missingFields: string[] = [];

    if (!selectedBeyannameType) missingFields.push("Beyanname Türü");
    if (selectedFileTypes.length === 0) missingFields.push("Dosya Türü");
    if (!selectedMonth) missingFields.push("Ay");
    if (!selectedYear) missingFields.push("Yıl");

    if (missingFields.length > 0) {
      toast.error(`Lütfen zorunlu alanları doldurun: ${missingFields.join(", ")}`);
      return;
    }

    onApplyFilter({
      companyType: selectedCompanyType,
      customerId: selectedCustomer,
      fileTypes: selectedFileTypes,
      beyannameType: selectedBeyannameType,
      month: selectedMonth,
      year: selectedYear,
    });
  };

  // Handle clear filter
  const handleClearFilter = () => {
    setSelectedCompanyType("ALL");
    setSelectedCustomer("ALL");
    setSelectedFileTypes([]);
    setSelectedBeyannameType("");
    setSelectedMonth(null);
    setSelectedYear(null);
    onClearFilter();
  };

  if (!isOpen) return null;

  return (
    <div className="w-96 border-l bg-muted/30 flex flex-col">
      {/* Filter Header */}
      <div className="flex items-center justify-between p-3 border-b bg-background">
        <div className="flex items-center gap-2">
          <Icon icon="solar:filter-bold" className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Dosya Filtrele</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
          <Icon icon="solar:sidebar-minimalistic-bold" className="h-4 w-4" />
        </Button>
      </div>

      {/* Filter Controls */}
      <div className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto">
        {/* Company Type Selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Şirket Tipi
          </Label>
          <div className="grid grid-cols-2 gap-1">
            <Button
              variant={selectedCompanyType === "ALL" ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSelectedCompanyType("ALL")}
            >
              Hepsi
            </Button>
            <Button
              variant={selectedCompanyType === "Firma" ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSelectedCompanyType("Firma")}
            >
              <Icon icon="solar:buildings-bold" className="h-3 w-3 mr-1" />
              Firma
            </Button>
            <Button
              variant={selectedCompanyType === "Şahıs" ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSelectedCompanyType("Şahıs")}
            >
              <Icon icon="solar:user-bold" className="h-3 w-3 mr-1" />
              Şahıs
            </Button>
            <Button
              variant={selectedCompanyType === "Basit Usul" ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSelectedCompanyType("Basit Usul")}
            >
              <Icon icon="solar:case-bold" className="h-3 w-3 mr-1" />
              Basit Usul
            </Button>
          </div>
        </div>

        {/* Customer Selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Mükellef
          </Label>
          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Tüm Mükellefler" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="ALL">Tüm Mükellefler</SelectItem>
              {filteredCustomers.map(customer => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.unvan}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File Type Selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Dosya Türü
          </Label>
          <div className="grid grid-cols-1 gap-2 border rounded-md p-2 bg-background/50">
            {FILE_TYPE_OPTIONS.map(ft => (
              <div key={ft.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`ft-${ft.id}`}
                  checked={selectedFileTypes.includes(ft.id)}
                  onCheckedChange={(checked) =>
                    handleFileTypeToggle(ft.id, !!checked)
                  }
                />
                <label
                  htmlFor={`ft-${ft.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
                >
                  {ft.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Beyanname Type Selector */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Beyanname Türü
          </Label>
          <Select
            value={selectedBeyannameType}
            onValueChange={setSelectedBeyannameType}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Seçiniz..." />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {/* Önce API'den gelen türler, yoksa statik fallback */}
              {beyannameTypes.length > 0 ? (
                beyannameTypes.map(type => (
                  <SelectItem key={type.code} value={type.code}>
                    {type.name}
                    {type.count > 0 && (
                      <span className="text-muted-foreground text-xs ml-1">
                        ({type.count})
                      </span>
                    )}
                  </SelectItem>
                ))
              ) : (
                /* Fallback: Statik beyanname türleri */
                BEYANNAME_TYPE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Month and Year */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Ay
            </Label>
            <Select
              value={selectedMonth?.toString() || ""}
              onValueChange={(v) => setSelectedMonth(v ? parseInt(v) : null)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Seçiniz..." />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Yıl
            </Label>
            <Select
              value={selectedYear?.toString() || ""}
              onValueChange={(v) => setSelectedYear(v ? parseInt(v) : null)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Seçiniz..." />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-3 border-t">
          <Button
            onClick={handleApplyFilter}
            disabled={filterLoading}
            className="w-full"
          >
            {filterLoading ? (
              <>
                <Icon icon="solar:refresh-bold" className="h-4 w-4 mr-2 animate-spin" />
                Filtreleniyor...
              </>
            ) : (
              <>
                <Icon icon="solar:filter-bold" className="h-4 w-4 mr-2" />
                Filtrele
              </>
            )}
          </Button>

          {hasFilterResults && (
            <Button
              variant="outline"
              onClick={handleClearFilter}
              className="w-full h-9"
            >
              <Icon icon="solar:close-circle-bold" className="h-4 w-4 mr-2" />
              Filtreyi Temizle
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});
