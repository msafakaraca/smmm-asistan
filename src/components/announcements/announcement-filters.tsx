"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { AnnouncementFilterState } from "./types";
import { SIRKET_TIPLERI } from "./types";

interface CustomerGroup {
  id: string;
  name: string;
  color?: string | null;
  memberCount?: number;
}

interface AnnouncementFiltersProps {
  filters: AnnouncementFilterState;
  onFiltersChange: React.Dispatch<React.SetStateAction<AnnouncementFilterState>>;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onReset: () => void;
  customerGroups?: CustomerGroup[];
  isLoading?: boolean;
}

export function AnnouncementFilters({
  filters,
  onFiltersChange,
  searchTerm,
  onSearchChange,
  onReset,
  customerGroups = [],
  isLoading = false,
}: AnnouncementFiltersProps) {
  // Helper functions
  const updateFilter = <K extends keyof AnnouncementFilterState>(
    key: K,
    value: AnnouncementFilterState[K]
  ) => {
    onFiltersChange((prev) => ({ ...prev, [key]: value }));
  };

  const toggleArrayValue = <T,>(array: T[], value: T): T[] => {
    return array.includes(value)
      ? array.filter((v) => v !== value)
      : [...array, value];
  };

  // Check if any filter is active
  const hasActiveFilters =
    filters.sirketTipiFilter.length > 0 ||
    filters.groupIds.length > 0 ||
    filters.hasEmailFilter !== "all" ||
    filters.hasPhoneFilter !== "all" ||
    filters.statusFilter !== "active" ||
    searchTerm.length > 0;

  return (
    <div className="space-y-4">
      {/* Arama */}
      <div>
        <Label className="block text-xs font-medium text-foreground mb-2">
          Arama
        </Label>
        <div className="relative">
          <Icon
            icon="solar:magnifer-bold"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="Mükellef ara (ünvan, VKN, email, telefon)..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs h-9"
          />
        </div>
      </div>

      {/* Şirket Tipi Filtresi */}
      <div>
        <Label className="block text-xs font-medium text-foreground mb-2">
          Şirket Tipi
        </Label>
        <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-md border border-border">
          {SIRKET_TIPLERI.map((tip) => {
            const isSelected = filters.sirketTipiFilter.includes(tip.value);
            return (
              <label
                key={tip.value}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors",
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "bg-background border border-border text-muted-foreground hover:border-blue-300"
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() =>
                    updateFilter(
                      "sirketTipiFilter",
                      toggleArrayValue(filters.sirketTipiFilter, tip.value)
                    )
                  }
                  className={cn(
                    "border-border",
                    isSelected && "border-white data-[state=checked]:bg-white data-[state=checked]:text-blue-600"
                  )}
                />
                <span className="text-xs font-medium">{tip.label}</span>
              </label>
            );
          })}
        </div>
        {filters.sirketTipiFilter.length > 0 && (
          <button
            onClick={() => updateFilter("sirketTipiFilter", [])}
            className="mt-1 text-[10px] text-blue-600 hover:underline"
          >
            Temizle ({filters.sirketTipiFilter.length})
          </button>
        )}
      </div>

      {/* Grup Seçimi */}
      {customerGroups.length > 0 && (
        <div>
          <Label className="block text-xs font-medium text-foreground mb-2">
            Müşteri Grupları
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-xs border rounded-md transition-colors",
                  filters.groupIds.length > 0
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon icon="solar:users-group-rounded-bold" className="w-4 h-4" />
                  <span>
                    {filters.groupIds.length === 0
                      ? "Tüm Gruplar"
                      : filters.groupIds.length === 1
                      ? customerGroups.find((g) => g.id === filters.groupIds[0])?.name
                      : `${filters.groupIds.length} grup seçili`}
                  </span>
                </div>
                <Icon icon="solar:alt-arrow-down-linear" className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 max-h-72 overflow-y-auto" align="start">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
                <span className="text-xs font-medium text-foreground">Gruplar</span>
                {filters.groupIds.length > 0 && (
                  <button
                    onClick={() => updateFilter("groupIds", [])}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    Temizle
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {customerGroups.map((group) => {
                  const isSelected = filters.groupIds.includes(group.id);
                  return (
                    <label
                      key={group.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() =>
                          updateFilter(
                            "groupIds",
                            toggleArrayValue(filters.groupIds, group.id)
                          )
                        }
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: group.color || "#3B82F6" }}
                        />
                        <span className="text-xs text-foreground truncate">{group.name}</span>
                      </div>
                      {group.memberCount !== undefined && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {group.memberCount}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Email Var/Yok Filtresi */}
      <div>
        <Label className="block text-xs font-medium text-foreground mb-2">
          Email Durumu
        </Label>
        <div className="flex gap-1">
          {[
            { value: "all" as const, label: "Tümü" },
            { value: "yes" as const, label: "Email Var" },
            { value: "no" as const, label: "Email Yok" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => updateFilter("hasEmailFilter", option.value)}
              className={cn(
                "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                filters.hasEmailFilter === option.value
                  ? "bg-blue-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Telefon Var/Yok Filtresi */}
      <div>
        <Label className="block text-xs font-medium text-foreground mb-2">
          Telefon Durumu
        </Label>
        <div className="flex gap-1">
          {[
            { value: "all" as const, label: "Tümü" },
            { value: "yes" as const, label: "Telefon Var" },
            { value: "no" as const, label: "Telefon Yok" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => updateFilter("hasPhoneFilter", option.value)}
              className={cn(
                "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                filters.hasPhoneFilter === option.value
                  ? "bg-green-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Durum Filtresi */}
      <div>
        <Label className="block text-xs font-medium text-foreground mb-2">
          Mükellef Durumu
        </Label>
        <div className="flex gap-1">
          {[
            { value: "all" as const, label: "Tümü" },
            { value: "active" as const, label: "Aktif" },
            { value: "passive" as const, label: "Pasif" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => updateFilter("statusFilter", option.value)}
              className={cn(
                "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                filters.statusFilter === option.value
                  ? "bg-purple-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtreleri Sıfırla */}
      {hasActiveFilters && (
        <button
          onClick={onReset}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
        >
          <Icon icon="solar:restart-bold" className="w-3.5 h-3.5" />
          Tüm Filtreleri Sıfırla
        </button>
      )}
    </div>
  );
}
