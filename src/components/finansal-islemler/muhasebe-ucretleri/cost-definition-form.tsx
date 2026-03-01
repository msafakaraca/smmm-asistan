"use client";

import { memo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";
import { CategorySelector } from "../shared/category-selector";
import { Separator } from "@/components/ui/separator";
import {
  costDefinitionFormSchema,
  type CostDefinitionFormValues,
  type CostDefinition,
  type FinanceCategory,
  type FinanceSettings,
  FREQUENCY_LABELS,
  CHARGE_STRATEGY_LABELS,
  CURRENCY_LABELS,
  FrequencyEnum,
  CurrencyEnum,
  KDV_RATE_OPTIONS,
  STOPAJ_RATE_OPTIONS,
} from "../shared/finance-types";

interface CustomerOption {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
}

interface CostDefinitionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerOption[];
  categories: FinanceCategory[];
  settings: FinanceSettings;
  editData?: CostDefinition | null;
  onSave: (data: CostDefinitionFormValues) => Promise<void>;
}

export const CostDefinitionForm = memo(function CostDefinitionForm({
  open,
  onOpenChange,
  customers,
  categories,
  settings,
  editData,
  onSave,
}: CostDefinitionFormProps) {
  const [saving, setSaving] = useState(false);
  const isEdit = !!editData;

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<CostDefinitionFormValues>({
    resolver: zodResolver(costDefinitionFormSchema),
    defaultValues: {
      customerId: editData?.customerId || "",
      categoryId: editData?.categoryId || "",
      description: editData?.description || "",
      amount: editData?.amount || 0,
      currency: editData?.currency || "TRY",
      frequency: editData?.frequency || "MONTHLY",
      chargeStrategy: editData?.chargeStrategy || "FULL",
      hasSMM: editData?.hasSMM ?? settings.hasSMM,
      kdvRate: editData?.kdvRate ?? settings.defaultKdvRate,
      stopajRate: editData?.stopajRate ?? settings.defaultStopajRate,
      startDate: editData?.startDate
        ? new Date(editData.startDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      endDate: editData?.endDate
        ? new Date(editData.endDate).toISOString().split("T")[0]
        : null,
    },
  });

  // Form'u editData değiştiğinde güncelle
  useEffect(() => {
    if (editData) {
      reset({
        customerId: editData.customerId,
        categoryId: editData.categoryId,
        description: editData.description || "",
        amount: editData.amount,
        currency: editData.currency,
        frequency: editData.frequency,
        chargeStrategy: editData.chargeStrategy,
        hasSMM: editData.hasSMM,
        kdvRate: editData.kdvRate,
        stopajRate: editData.stopajRate,
        startDate: new Date(editData.startDate).toISOString().split("T")[0],
        endDate: editData.endDate
          ? new Date(editData.endDate).toISOString().split("T")[0]
          : null,
      });
    } else {
      reset({
        customerId: "",
        categoryId: "",
        description: "",
        amount: 0,
        currency: "TRY",
        frequency: "MONTHLY",
        chargeStrategy: "FULL",
        hasSMM: settings.hasSMM,
        kdvRate: settings.defaultKdvRate,
        stopajRate: settings.defaultStopajRate,
        startDate: new Date().toISOString().split("T")[0],
        endDate: null,
      });
    }
  }, [editData, settings, reset]);

  const watchFrequency = watch("frequency");
  const watchHasSMM = watch("hasSMM");
  const watchAmount = watch("amount") || 0;
  const watchKdvRate = watch("kdvRate") || 0;
  const watchStopajRate = watch("stopajRate") || 0;

  // GİB SMM hesaplama formülü
  const brutUcretKDVHaric = watchAmount;
  const stopajTutari = watchHasSMM ? brutUcretKDVHaric * (watchStopajRate / 100) : 0;
  const netUcretKDVHaric = brutUcretKDVHaric - stopajTutari;
  const kdvTutari = watchHasSMM ? brutUcretKDVHaric * (watchKdvRate / 100) : 0;
  const brutUcretKDVDahil = brutUcretKDVHaric + kdvTutari;
  const netTahsilEdilen = netUcretKDVHaric + kdvTutari;

  // FULL/DISTRIBUTED sadece yıllık+ periyotlarda göster
  const showChargeStrategy = ["QUARTERLY", "BIANNUAL", "ANNUAL"].includes(watchFrequency);

  const onSubmit = async (data: CostDefinitionFormValues) => {
    try {
      setSaving(true);
      await onSave(data);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  const incomeCategories = categories.filter((c) => c.type === "INCOME");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Maliyet Kalemi Düzenle" : "Yeni Maliyet Kalemi"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Müşteri Seçimi */}
          <div className="space-y-2">
            <Label>
              Mükellef <span className="text-red-500">*</span>
            </Label>
            <Select
              value={watch("customerId")}
              onValueChange={(v) => setValue("customerId", v)}
              disabled={saving || isEdit}
            >
              <SelectTrigger className={errors.customerId ? "border-red-500" : ""}>
                <SelectValue placeholder="Mükellef seçiniz" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.kisaltma || c.unvan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.customerId && (
              <p className="text-xs text-red-500">{errors.customerId.message}</p>
            )}
          </div>

          {/* Kategori Seçimi */}
          <div className="space-y-2">
            <Label>
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

          {/* Tutar + Para Birimi */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>
                Tutar <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                disabled={saving}
                className={errors.amount ? "border-red-500" : ""}
                {...register("amount", { valueAsNumber: true })}
              />
              {errors.amount && (
                <p className="text-xs text-red-500">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Para Birimi</Label>
              <Select
                value={watch("currency")}
                onValueChange={(v) => setValue("currency", v as typeof CurrencyEnum[number])}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CurrencyEnum.map((c) => (
                    <SelectItem key={c} value={c}>{CURRENCY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Periyot */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>
                Ödeme Periyodu <span className="text-red-500">*</span>
              </Label>
              <Select
                value={watch("frequency")}
                onValueChange={(v) => setValue("frequency", v as typeof FrequencyEnum[number])}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FrequencyEnum.map((f) => (
                    <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showChargeStrategy && (
              <div className="space-y-2">
                <Label>Dağıtım Stratejisi</Label>
                <Select
                  value={watch("chargeStrategy")}
                  onValueChange={(v) => setValue("chargeStrategy", v as "FULL" | "DISTRIBUTED")}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL">{CHARGE_STRATEGY_LABELS.FULL}</SelectItem>
                    <SelectItem value="DISTRIBUTED">{CHARGE_STRATEGY_LABELS.DISTRIBUTED}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* SMM Toggle + KDV/Stopaj */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <Label>Serbest Meslek Makbuzu (SMM)</Label>
              <Switch
                checked={watchHasSMM}
                onCheckedChange={(v) => setValue("hasSMM", v)}
                disabled={saving}
              />
            </div>

            {watchHasSMM && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>KDV Oranı</Label>
                    <Select
                      value={String(watchKdvRate)}
                      onValueChange={(v) => setValue("kdvRate", Number(v))}
                      disabled={saving}
                    >
                      <SelectTrigger>
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
                  <div className="space-y-2">
                    <Label>Stopaj Oranı</Label>
                    <Select
                      value={String(watchStopajRate)}
                      onValueChange={(v) => setValue("stopajRate", Number(v))}
                      disabled={saving}
                    >
                      <SelectTrigger>
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

                {/* GİB uyumlu hesaplama detayları */}
                <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Brüt Ücret (KDV Hariç):</span>
                    <span className="font-medium tabular-nums">{brutUcretKDVHaric.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stopaj (%{watchStopajRate}):</span>
                    <span className="text-red-600 tabular-nums">-{stopajTutari.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net Ücret (KDV Hariç):</span>
                    <span className="tabular-nums">{netUcretKDVHaric.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">KDV (%{watchKdvRate}):</span>
                    <span className="text-green-600 tabular-nums">+{kdvTutari.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Brüt Ücret (KDV Dahil):</span>
                    <span className="font-semibold tabular-nums">{brutUcretKDVDahil.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Net Tahsil Edilen (KDV Dahil):</span>
                    <span className="tabular-nums text-primary">{netTahsilEdilen.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Tarihler */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>
                Başlangıç Tarihi <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                disabled={saving}
                className={errors.startDate ? "border-red-500" : ""}
                {...register("startDate")}
              />
              {errors.startDate && (
                <p className="text-xs text-red-500">{errors.startDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Bitiş Tarihi</Label>
              <Input
                type="date"
                disabled={saving}
                {...register("endDate")}
              />
            </div>
          </div>

          {/* Açıklama */}
          <div className="space-y-2">
            <Label>Açıklama</Label>
            <Input
              placeholder="Opsiyonel açıklama"
              disabled={saving}
              {...register("description")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              İptal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : isEdit ? (
                "Güncelle"
              ) : (
                "Oluştur"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
