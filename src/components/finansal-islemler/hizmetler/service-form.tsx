"use client";

import { memo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";
import { CategorySelector } from "../shared/category-selector";
import { SMMCalculator } from "../muhasebe-ucretleri/smm-calculator";
import {
  serviceFormSchema,
  type ServiceFormValues,
  type FinancialTransaction,
  type FinanceCategory,
  type FinanceSettings,
  CURRENCY_LABELS,
  CurrencyEnum,
} from "../shared/finance-types";

interface CustomerOption {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
}

interface ServiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerOption[];
  categories: FinanceCategory[];
  settings: FinanceSettings;
  editData?: FinancialTransaction | null;
  onSave: (data: ServiceFormValues) => Promise<void>;
}

export const ServiceForm = memo(function ServiceForm({
  open,
  onOpenChange,
  customers,
  categories,
  settings,
  editData,
  onSave,
}: ServiceFormProps) {
  const [saving, setSaving] = useState(false);
  const isEdit = !!editData;

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      customerId: editData?.customerId || "",
      categoryId: editData?.categoryId || "",
      amount: editData ? Number(editData.grossAmount || editData.amount) : 0,
      currency: editData?.currency || "TRY",
      hasSMM: editData ? !!(editData.kdvAmount || editData.stopajAmount) : settings.hasSMM,
      kdvRate: editData?.kdvAmount && editData?.grossAmount
        ? Math.round((Number(editData.kdvAmount) / Number(editData.grossAmount)) * 10000) / 100
        : settings.defaultKdvRate,
      stopajRate: editData?.stopajAmount && editData?.grossAmount
        ? Math.round((Number(editData.stopajAmount) / Number(editData.grossAmount)) * 10000) / 100
        : settings.defaultStopajRate,
      date: editData?.date
        ? new Date(editData.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      dueDate: editData?.dueDate
        ? new Date(editData.dueDate).toISOString().split("T")[0]
        : null,
      description: editData?.description || "",
    },
  });

  useEffect(() => {
    if (editData) {
      const grossAmt = Number(editData.grossAmount || editData.amount);
      reset({
        customerId: editData.customerId || "",
        categoryId: editData.categoryId,
        amount: grossAmt,
        currency: editData.currency,
        hasSMM: !!(editData.kdvAmount || editData.stopajAmount),
        kdvRate: editData.kdvAmount && grossAmt
          ? Math.round((Number(editData.kdvAmount) / grossAmt) * 10000) / 100
          : settings.defaultKdvRate,
        stopajRate: editData.stopajAmount && grossAmt
          ? Math.round((Number(editData.stopajAmount) / grossAmt) * 10000) / 100
          : settings.defaultStopajRate,
        date: new Date(editData.date).toISOString().split("T")[0],
        dueDate: editData.dueDate
          ? new Date(editData.dueDate).toISOString().split("T")[0]
          : null,
        description: editData.description || "",
      });
    } else {
      reset({
        customerId: "",
        categoryId: "",
        amount: 0,
        currency: "TRY",
        hasSMM: settings.hasSMM,
        kdvRate: settings.defaultKdvRate,
        stopajRate: settings.defaultStopajRate,
        date: new Date().toISOString().split("T")[0],
        dueDate: null,
        description: "",
      });
    }
  }, [editData, settings, reset]);

  const watchAmount = watch("amount") || 0;
  const watchHasSMM = watch("hasSMM");
  const watchKdvRate = watch("kdvRate") || 0;
  const watchStopajRate = watch("stopajRate") || 0;

  const onSubmit = async (data: ServiceFormValues) => {
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
            {isEdit ? "Hizmet Düzenle" : "Yeni Hizmet"}
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
              disabled={saving}
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

          {/* Kategori */}
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
                Brüt Tutar <span className="text-red-500">*</span>
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

          {/* SMM Hesaplayıcı */}
          <SMMCalculator
            hasSMM={watchHasSMM}
            onHasSMMChange={(v) => setValue("hasSMM", v)}
            kdvRate={watchKdvRate}
            onKdvRateChange={(v) => setValue("kdvRate", v)}
            stopajRate={watchStopajRate}
            onStopajRateChange={(v) => setValue("stopajRate", v)}
            amount={watchAmount}
            disabled={saving}
          />

          {/* Tarihler */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>
                Hizmet Tarihi <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                disabled={saving}
                className={errors.date ? "border-red-500" : ""}
                {...register("date")}
              />
              {errors.date && (
                <p className="text-xs text-red-500">{errors.date.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Vade Tarihi</Label>
              <Input
                type="date"
                disabled={saving}
                {...register("dueDate")}
              />
            </div>
          </div>

          {/* Açıklama */}
          <div className="space-y-2">
            <Label>Açıklama</Label>
            <Input
              placeholder="Hizmet açıklaması (opsiyonel)"
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
