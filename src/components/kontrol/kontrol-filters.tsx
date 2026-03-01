/**
 * KontrolFilters Component
 *
 * Dönem seçimi, şirket tipi filtresi ve arama alanı.
 */

import { Icon } from "@iconify/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const aylar = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

interface KontrolFiltersProps {
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  sirketTipiFilter: string;
  setSirketTipiFilter: (tipi: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  hideDatePicker?: boolean;
}

export function KontrolFilters({
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  sirketTipiFilter,
  setSirketTipiFilter,
  searchTerm,
  setSearchTerm,
  onRefresh,
  isLoading,
  hideDatePicker = false,
}: KontrolFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center pb-4 border-b">
      {/* Dönem Seçimi - opsiyonel */}
      {!hideDatePicker && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Dönem:</span>
          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => setSelectedMonth(Number(v))}
          >
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {aylar.map((ay, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {ay}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-[90px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Şirket Tipi Filtresi */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Tip:</span>
        <Select value={sirketTipiFilter} onValueChange={setSirketTipiFilter}>
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="firma">Firma</SelectItem>
            <SelectItem value="sahis">Şahıs</SelectItem>
            <SelectItem value="basit_usul">Basit Usul</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Arama */}
      <div className="relative flex-1 max-w-xs">
        <Icon
          icon="solar:magnifer-bold"
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
        />
        <Input
          placeholder="Mükellef ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-8"
        />
      </div>

      {/* Durum Göstergeleri */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground ml-auto">
        <div className="flex items-center gap-1">
          <Icon icon="solar:check-read-linear" className="h-4 w-4 text-green-600" />
          <span>Verildi</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded border-2 border-dashed border-muted-foreground/50" />
          <span>Boş</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-zinc-600" />
          <span>Muaf</span>
        </div>
      </div>

      {/* Yenile & Excel */}
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
        <Icon
          icon="solar:refresh-bold"
          className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
        />
        Yenile
      </Button>
      <Button variant="outline" size="sm">
        <Icon icon="solar:download-bold" className="h-4 w-4 mr-2" />
        Excel
      </Button>
    </div>
  );
}
