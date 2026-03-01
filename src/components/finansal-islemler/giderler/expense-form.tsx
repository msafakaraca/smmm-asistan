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
import {
  expenseFormSchema,
  type ExpenseFormValues,
  type Expense,
  type FinanceCategory,
  CURRENCY_LABELS,
  RECURRING_FREQUENCY_LABELS,
  CurrencyEnum,
  RecurringFrequencyEnum,
} from "../shared/finance-types";

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FinanceCategory[];
  editData?: Expense | null;
  onSave: (data: ExpenseFormValues) => Promise<void>;
}

export const ExpenseForm = memo(function ExpenseForm({
  open,
  onOpenChange,
  categories,
  editData,
  onSave,
}: ExpenseFormProps) {
  const [saving, setSaving] = useState(false);
  const isEdit = !!editData;

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      categoryId: editData?.categoryId || "",
      amount: editData?.amount || 0,
      currency: editData?.currency || "TRY",
      date: editData?.date
        ? new Date(editData.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      description: editData?.description || "",
      isRecurring: editData?.isRecurring ?? false,
      recurringFrequency: editData?.recurringFrequency || null,
    },
  });

  useEffect(() => {
    if (editData) {
      reset({
        categoryId: editData.categoryId,
        amount: Number(editData.amount),
        currency: editData.currency,
        date: new Date(editData.date).toISOString().split("T")[0],
        description: editData.description || "",
        isRecurring: editData.isRecurring,
        recurringFrequency: editData.recurringFrequency || null,
      });
    } else {
      reset({
        categoryId: "",
        amount: 0,
        currency: "TRY",
        date: new Date().toISOString().split("T")[0],
        description: "",
        isRecurring: false,
        recurringFrequency: null,
      });
    }
  }, [editData, reset]);

  const watchIsRecurring = watch("isRecurring");

  const onSubmit = async (data: ExpenseFormValues) => {
    try {
      setSaving(true);
      // Tekrarlayan değilse frequency'yi temizle
      if (!data.isRecurring) {
        data.recurringFrequency = null;
      }
      await onSave(data);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Gider Düzenle" : "Yeni Gider"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Kategori */}
          <div className="space-y-2">
            <Label>
              Kategori <span className="text-red-500">*</span>
            </Label>
            <CategorySelector
              categories={expenseCategories}
              value={watch("categoryId")}
              onValueChange={(v) => setValue("categoryId", v)}
              type="EXPENSE"
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

          {/* Tarih */}
          <div className="space-y-2">
            <Label>
              Tarih <span className="text-red-500">*</span>
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

          {/* Açıklama */}
          <div className="space-y-2">
            <Label>Açıklama</Label>
            <Input
              placeholder="Gider açıklaması (opsiyonel)"
              disabled={saving}
              {...register("description")}
            />
          </div>

          {/* Tekrarlayan Gider */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Tekrarlayan Gider</Label>
                <p className="text-xs text-muted-foreground">
                  Bu gider belirli aralıklarla tekrar edecek mi?
                </p>
              </div>
              <Switch
                checked={watchIsRecurring}
                onCheckedChange={(v) => setValue("isRecurring", v)}
                disabled={saving}
              />
            </div>

            {watchIsRecurring && (
              <div className="space-y-2">
                <Label className="text-xs">Periyot</Label>
                <Select
                  value={watch("recurringFrequency") || ""}
                  onValueChange={(v) => setValue("recurringFrequency", v as typeof RecurringFrequencyEnum[number])}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Periyot seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    {RecurringFrequencyEnum.map((f) => (
                      <SelectItem key={f} value={f}>
                        {RECURRING_FREQUENCY_LABELS[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
