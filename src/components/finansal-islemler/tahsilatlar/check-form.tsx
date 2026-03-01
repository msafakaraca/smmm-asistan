"use client";

import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CheckFormValues } from "../shared/finance-types";

interface CheckFormProps {
  value: CheckFormValues;
  onChange: (value: CheckFormValues) => void;
  errors?: Partial<Record<keyof CheckFormValues, string>>;
}

export const CheckForm = memo(function CheckForm({
  value,
  onChange,
  errors,
}: CheckFormProps) {
  const handleChange = (field: keyof CheckFormValues, val: string | number) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <div className="space-y-4 rounded-lg border border-dashed p-4 bg-muted/30">
      <p className="text-sm font-medium text-muted-foreground">Çek Bilgileri</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="checkNumber">Çek No</Label>
          <Input
            id="checkNumber"
            placeholder="Çek numarası"
            value={value.checkNumber || ""}
            onChange={(e) => handleChange("checkNumber", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bankName">Banka</Label>
          <Input
            id="bankName"
            placeholder="Banka adı"
            value={value.bankName || ""}
            onChange={(e) => handleChange("bankName", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="checkDueDate">
            Vade Tarihi <span className="text-destructive">*</span>
          </Label>
          <Input
            id="checkDueDate"
            type="date"
            value={value.dueDate || ""}
            onChange={(e) => handleChange("dueDate", e.target.value)}
          />
          {errors?.dueDate && (
            <p className="text-xs text-destructive">{errors.dueDate}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="checkAmount">
            Tutar <span className="text-destructive">*</span>
          </Label>
          <Input
            id="checkAmount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={value.amount || ""}
            onChange={(e) => handleChange("amount", parseFloat(e.target.value) || 0)}
          />
          {errors?.amount && (
            <p className="text-xs text-destructive">{errors.amount}</p>
          )}
        </div>
      </div>
    </div>
  );
});
