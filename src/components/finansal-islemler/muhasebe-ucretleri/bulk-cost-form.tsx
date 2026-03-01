"use client";

import { memo, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { Loader2, Search, CheckCircle2, XCircle } from "lucide-react";
import { CategorySelector } from "../shared/category-selector";
import {
  type FinanceCategory,
  type FinanceSettings,
  type BulkCostDefinitionRequest,
  FREQUENCY_LABELS,
  CURRENCY_LABELS,
  FrequencyEnum,
  CurrencyEnum,
  KDV_RATE_OPTIONS,
  STOPAJ_RATE_OPTIONS,
} from "../shared/finance-types";

// Form schema
const bulkFormSchema = z.object({
  categoryId: z.string().uuid("Kategori seçiniz"),
  amount: z.number().positive("Tutar sıfırdan büyük olmalı"),
  currency: z.enum(["TRY", "USD", "EUR"]),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "BIANNUAL", "ANNUAL", "ONE_TIME"]),
  chargeStrategy: z.enum(["FULL", "DISTRIBUTED"]),
  hasSMM: z.boolean(),
  kdvRate: z.number().min(0).max(100).optional(),
  stopajRate: z.number().min(0).max(100).optional(),
  startDate: z.string().min(1, "Başlangıç tarihi zorunludur"),
  description: z.string().optional(),
});

type BulkFormValues = z.infer<typeof bulkFormSchema>;

interface CustomerOption {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
}

interface BulkCostFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerOption[];
  categories: FinanceCategory[];
  settings: FinanceSettings;
  onSubmit: (data: BulkCostDefinitionRequest) => Promise<{ successCount: number; failCount: number; results: { customerId: string; success: boolean; error?: string }[] }>;
}

export const BulkCostForm = memo(function BulkCostForm({
  open,
  onOpenChange,
  customers,
  categories,
  settings,
  onSubmit,
}: BulkCostFormProps) {
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<{ customerId: string; success: boolean; error?: string }[] | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<BulkFormValues>({
    resolver: zodResolver(bulkFormSchema),
    defaultValues: {
      categoryId: "",
      amount: 0,
      currency: "TRY",
      frequency: "MONTHLY",
      chargeStrategy: "FULL",
      hasSMM: settings.hasSMM,
      kdvRate: settings.defaultKdvRate,
      stopajRate: settings.defaultStopajRate,
      startDate: new Date().toISOString().split("T")[0],
      description: "",
    },
  });

  const watchHasSMM = watch("hasSMM");
  const watchFrequency = watch("frequency");
  const showChargeStrategy = ["QUARTERLY", "BIANNUAL", "ANNUAL"].includes(watchFrequency);

  // Müşteri filtreleme
  const filteredCustomers = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.unvan.toLowerCase().includes(q) ||
        (c.kisaltma && c.kisaltma.toLowerCase().includes(q)) ||
        c.vknTckn.includes(q)
    );
  }, [customers, search]);

  const toggleCustomer = (id: string) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedCustomerIds.size === filteredCustomers.length) {
      setSelectedCustomerIds(new Set());
    } else {
      setSelectedCustomerIds(new Set(filteredCustomers.map((c) => c.id)));
    }
  };

  const incomeCategories = categories.filter((c) => c.type === "INCOME");

  const onFormSubmit = async (data: BulkFormValues) => {
    if (selectedCustomerIds.size === 0) {
      toast.error("En az bir mükellef seçiniz");
      return;
    }

    try {
      setSaving(true);
      const result = await onSubmit({
        customerIds: Array.from(selectedCustomerIds),
        ...data,
      });
      setResults(result.results);
      toast.success(`${result.successCount} başarılı, ${result.failCount} başarısız`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toplu kayıt başarısız");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setResults(null);
    setSelectedCustomerIds(new Set());
    setSearch("");
    onOpenChange(false);
  };

  // Sonuç ekranı
  if (results) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Toplu Kayıt Sonucu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <Badge variant="default" className="text-sm">
                {results.filter((r) => r.success).length} Başarılı
              </Badge>
              {results.some((r) => !r.success) && (
                <Badge variant="destructive" className="text-sm">
                  {results.filter((r) => !r.success).length} Başarısız
                </Badge>
              )}
            </div>
            <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mükellef</TableHead>
                    <TableHead className="w-20">Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => {
                    const customer = customers.find((c) => c.id === r.customerId);
                    return (
                      <TableRow key={r.customerId}>
                        <TableCell className="text-sm">
                          {customer?.kisaltma || customer?.unvan || r.customerId}
                          {r.error && (
                            <p className="text-xs text-red-500 mt-0.5">{r.error}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleClose}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Toplu Ücret Belirleme</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          {/* Müşteri Seçimi */}
          <div className="space-y-2">
            <Label>
              Mükellefler <span className="text-red-500">*</span>
              <span className="text-muted-foreground ml-2 font-normal">
                ({selectedCustomerIds.size} seçili)
              </span>
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Mükellef ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="border rounded-lg max-h-[200px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          filteredCustomers.length > 0 &&
                          selectedCustomerIds.size === filteredCustomers.length
                        }
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Mükellef</TableHead>
                    <TableHead>VKN/TCKN</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-sm text-muted-foreground">
                        Mükellef bulunamadı
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((c) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleCustomer(c.id)}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedCustomerIds.has(c.id)}
                            onCheckedChange={() => toggleCustomer(c.id)}
                          />
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {c.kisaltma || c.unvan}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.vknTckn}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Ortak Maliyet Bilgileri */}
          <div className="space-y-3 rounded-lg border p-4">
            <h4 className="text-sm font-medium">Maliyet Kalemi Bilgileri</h4>

            {/* Kategori */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Kategori <span className="text-red-500">*</span>
              </Label>
              <CategorySelector
                categories={incomeCategories}
                value={watch("categoryId")}
                onValueChange={(v) => setValue("categoryId", v)}
                type="INCOME"
                disabled={saving}
              />
              {errors.categoryId && (
                <p className="text-xs text-red-500">{errors.categoryId.message}</p>
              )}
            </div>

            {/* Tutar + Para Birimi + Periyot */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Tutar <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  disabled={saving}
                  className={`h-8 ${errors.amount ? "border-red-500" : ""}`}
                  {...register("amount", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Para Birimi</Label>
                <Select
                  value={watch("currency")}
                  onValueChange={(v) => setValue("currency", v as typeof CurrencyEnum[number])}
                  disabled={saving}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CurrencyEnum.map((c) => (
                      <SelectItem key={c} value={c}>{CURRENCY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Periyot</Label>
                <Select
                  value={watch("frequency")}
                  onValueChange={(v) => setValue("frequency", v as typeof FrequencyEnum[number])}
                  disabled={saving}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FrequencyEnum.map((f) => (
                      <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {showChargeStrategy && (
              <div className="space-y-1.5">
                <Label className="text-xs">Dağıtım Stratejisi</Label>
                <Select
                  value={watch("chargeStrategy")}
                  onValueChange={(v) => setValue("chargeStrategy", v as "FULL" | "DISTRIBUTED")}
                  disabled={saving}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL">Tam Tutar</SelectItem>
                    <SelectItem value="DISTRIBUTED">Dağıtılmış</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* SMM */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">SMM</Label>
              <Switch
                checked={watchHasSMM}
                onCheckedChange={(v) => setValue("hasSMM", v)}
                disabled={saving}
              />
            </div>

            {watchHasSMM && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">KDV Oranı</Label>
                  <Select
                    value={String(watch("kdvRate"))}
                    onValueChange={(v) => setValue("kdvRate", Number(v))}
                    disabled={saving}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KDV_RATE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Stopaj Oranı</Label>
                  <Select
                    value={String(watch("stopajRate"))}
                    onValueChange={(v) => setValue("stopajRate", Number(v))}
                    disabled={saving}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STOPAJ_RATE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Başlangıç Tarihi + Açıklama */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Başlangıç Tarihi <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  disabled={saving}
                  className="h-8"
                  {...register("startDate")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Açıklama</Label>
                <Input
                  placeholder="Opsiyonel"
                  disabled={saving}
                  className="h-8"
                  {...register("description")}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={saving}
            >
              İptal
            </Button>
            <Button type="submit" disabled={saving || selectedCustomerIds.size === 0}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                `${selectedCustomerIds.size} Mükellefe Tanımla`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
