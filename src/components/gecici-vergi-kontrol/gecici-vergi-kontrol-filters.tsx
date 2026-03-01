"use client";

/**
 * Geçici Vergi Kontrol Filters Component
 *
 * Çeyrek dönem seçimi, arama ve filtreler.
 */

import { memo } from "react";
import { Search, Calendar, Users, CheckCircle, AlertCircle, Clock, XCircle, ListFilter, CheckSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QUARTERS } from "./hooks/use-gecici-vergi-kontrol-data";

interface CustomerGroup {
  id: string;
  name: string;
  color: string;
  beyannameTypes: string[];
  memberCount: number;
}

interface GeciciVergiKontrolFiltersProps {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  activeCardFilter: string | null;
  setActiveCardFilter: (filter: string | null) => void;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  groups: CustomerGroup[];
  stats: {
    total: number;
    verildi: number;
    eksik: number;
    bekliyor: number;
    verilmeyecek: number;
  };
  isSelectionMode?: boolean;
  onToggleSelectionMode?: () => void;
}

export const GeciciVergiKontrolFilters = memo(function GeciciVergiKontrolFilters({
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  activeCardFilter,
  setActiveCardFilter,
  selectedGroupId,
  setSelectedGroupId,
  groups,
  stats,
  isSelectionMode = false,
  onToggleSelectionMode,
}: GeciciVergiKontrolFiltersProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-4">
      {/* İstatistikler - Tıklanabilir Kartlar */}
      <div className="grid grid-cols-5 gap-3 p-0.5">
        <button
          onClick={() => setActiveCardFilter(null)}
          className={`bg-slate-100 border border-slate-300 rounded-lg p-3 text-left transition-all cursor-pointer hover:shadow-md ${
            activeCardFilter === null ? "ring-2 ring-blue-500 shadow-md" : ""
          }`}
        >
          <div className="text-xl font-bold text-slate-800">{stats.total}</div>
          <div className="text-xs text-slate-600">Toplam</div>
        </button>
        <button
          onClick={() => setActiveCardFilter(activeCardFilter === "verildi" ? null : "verildi")}
          className={`bg-green-100 border border-green-300 rounded-lg p-3 text-left transition-all cursor-pointer hover:shadow-md ${
            activeCardFilter === "verildi" ? "ring-2 ring-green-500 shadow-md" : ""
          }`}
        >
          <div className="text-xl font-bold text-green-800">{stats.verildi}</div>
          <div className="text-xs text-green-700">Verildi</div>
        </button>
        <button
          onClick={() => setActiveCardFilter(activeCardFilter === "eksik" ? null : "eksik")}
          className={`bg-yellow-100 border border-yellow-300 rounded-lg p-3 text-left transition-all cursor-pointer hover:shadow-md ${
            activeCardFilter === "eksik" ? "ring-2 ring-yellow-500 shadow-md" : ""
          }`}
        >
          <div className="text-xl font-bold text-yellow-800">{stats.eksik}</div>
          <div className="text-xs text-yellow-700">Eksik</div>
        </button>
        <button
          onClick={() => setActiveCardFilter(activeCardFilter === "bekliyor" ? null : "bekliyor")}
          className={`bg-gray-200 border border-gray-400 rounded-lg p-3 text-left transition-all cursor-pointer hover:shadow-md ${
            activeCardFilter === "bekliyor" ? "ring-2 ring-gray-500 shadow-md" : ""
          }`}
        >
          <div className="text-xl font-bold text-gray-800">{stats.bekliyor}</div>
          <div className="text-xs text-gray-700">Bekliyor</div>
        </button>
        <button
          onClick={() => setActiveCardFilter(activeCardFilter === "verilmeyecek" ? null : "verilmeyecek")}
          className={`bg-red-100 border border-red-300 rounded-lg p-3 text-left transition-all cursor-pointer hover:shadow-md ${
            activeCardFilter === "verilmeyecek" ? "ring-2 ring-red-500 shadow-md" : ""
          }`}
        >
          <div className="text-xl font-bold text-red-800">{stats.verilmeyecek}</div>
          <div className="text-xs text-red-700">Verilmeyecek</div>
        </button>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Çeyrek Dönem Seçimi */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedMonth.toString()}
            onValueChange={(v) => setSelectedMonth(parseInt(v))}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUARTERS.map((q) => (
                <SelectItem key={q.month} value={q.month.toString()}>
                  {q.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Arama */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Mükellef ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Grup Filtresi */}
        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
          <SelectTrigger className="w-48">
            <Users className="h-4 w-4 mr-2 flex-shrink-0" />
            <SelectValue placeholder="Tüm Gruplar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Mükellefler</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  {group.name} ({group.memberCount})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Durum Filtresi */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <span className="flex items-center gap-2">
                <ListFilter className="h-4 w-4 text-slate-500" />
                Tüm Durumlar
              </span>
            </SelectItem>
            <SelectItem value="verildi">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-700">Verildi</span>
              </span>
            </SelectItem>
            <SelectItem value="eksik">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-yellow-700">Eksik</span>
              </span>
            </SelectItem>
            <SelectItem value="bekliyor">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Bekliyor</span>
              </span>
            </SelectItem>
            <SelectItem value="verilmeyecek">
              <span className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-red-700">Verilmeyecek</span>
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Butonlar */}
        <div className="flex items-center gap-2 ml-auto">
          {onToggleSelectionMode && (
            <Button
              variant={isSelectionMode ? "default" : "outline"}
              onClick={onToggleSelectionMode}
              className={isSelectionMode ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              {isSelectionMode ? "Seçim Modundan Çık" : "Toplu İşlemler"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});
