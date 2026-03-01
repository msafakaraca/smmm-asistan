"use client";

import { memo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FinanceCategory, FinanceCategoryType } from "./finance-types";

interface CategorySelectorProps {
  categories: FinanceCategory[];
  value: string;
  onValueChange: (value: string) => void;
  type?: FinanceCategoryType;
  placeholder?: string;
  disabled?: boolean;
}

export const CategorySelector = memo(function CategorySelector({
  categories,
  value,
  onValueChange,
  type,
  placeholder = "Kategori seçiniz",
  disabled = false,
}: CategorySelectorProps) {
  const filtered = type ? categories.filter((c) => c.type === type) : categories;

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {filtered.map((cat) => (
          <SelectItem key={cat.id} value={cat.id}>
            <span className="flex items-center gap-2">
              {cat.color && (
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
              )}
              {cat.name}
            </span>
          </SelectItem>
        ))}
        {filtered.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Kategori bulunamadı
          </div>
        )}
      </SelectContent>
    </Select>
  );
});
