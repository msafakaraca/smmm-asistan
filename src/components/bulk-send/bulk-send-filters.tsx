"use client";

import React from 'react';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import type { BulkSendFilterState, DosyaTipi } from './types';
import { BEYANNAME_TYPES, DOCUMENT_TYPES } from './types';
import { MONTH_OPTIONS, YEAR_OPTIONS } from '@/lib/constants/beyanname-types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

interface Customer {
  id: string;
  unvan: string;
  kisaltma?: string | null;
}

interface CustomerGroup {
  id: string;
  name: string;
  color?: string;
  memberCount?: number;
  members?: Array<{ id: string }>;
  beyannameTypes?: string[];
}

interface BulkSendFiltersProps {
  filters: BulkSendFilterState;
  onFiltersChange: React.Dispatch<React.SetStateAction<BulkSendFilterState>>;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onReset: () => void;
  customers: Customer[];
  customerGroups?: CustomerGroup[];
  isLoading?: boolean;
}

export function BulkSendFilters({
  filters,
  onFiltersChange,
  searchTerm,
  onSearchChange,
  showAdvanced,
  onToggleAdvanced,
  onReset,
  customers,
  customerGroups = [],
  isLoading = false,
}: BulkSendFiltersProps) {
  // Helper functions
  const updateFilter = <K extends keyof BulkSendFilterState>(
    key: K,
    value: BulkSendFilterState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayValue = <T,>(array: T[], value: T): T[] => {
    return array.includes(value)
      ? array.filter((v) => v !== value)
      : [...array, value];
  };

  return (
    <div className="space-y-4">
      {/* Dönem Seçimi */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-2">
          Dönem Aralığı
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
              Başlangıç
            </label>
            <div className="flex gap-1">
              <select
                value={filters.monthStart}
                onChange={(e) => updateFilter('monthStart', Number(e.target.value))}
                className="flex-1 px-2 py-1.5 text-xs border border-border bg-background text-foreground rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {MONTH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={filters.yearStart}
                onChange={(e) => updateFilter('yearStart', Number(e.target.value))}
                className="w-20 px-2 py-1.5 text-xs border border-border bg-background text-foreground rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {YEAR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
              Bitiş
            </label>
            <div className="flex gap-1">
              <select
                value={filters.monthEnd}
                onChange={(e) => updateFilter('monthEnd', Number(e.target.value))}
                className="flex-1 px-2 py-1.5 text-xs border border-border bg-background text-foreground rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {MONTH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={filters.yearEnd}
                onChange={(e) => updateFilter('yearEnd', Number(e.target.value))}
                className="w-20 px-2 py-1.5 text-xs border border-border bg-background text-foreground rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {YEAR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Arama */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-2">
          Arama
        </label>
        <div className="relative">
          <Icon
            icon="solar:magnifer-bold"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Mükellef veya dosya ara..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-border bg-background text-foreground placeholder:text-muted-foreground rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Filtre ve Sıfırla Butonları */}
      <div className="flex gap-2">
        <button
          onClick={onToggleAdvanced}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors',
            showAdvanced
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'border-border text-muted-foreground hover:bg-muted'
          )}
        >
          <Icon icon="solar:filter-bold" className="w-3.5 h-3.5" />
          Gelişmiş
          {(filters.beyannameTypes.length > 0 ||
            filters.documentTypes.length > 0 ||
            filters.customerIds.length > 0 ||
            filters.mailSentFilter !== 'all' ||
            filters.whatsappSentFilter !== 'all' ||
            filters.smsSentFilter !== 'all') && (
            <span className="w-4 h-4 bg-blue-600 text-white rounded-full text-[10px] flex items-center justify-center">
              {filters.beyannameTypes.length +
                filters.documentTypes.length +
                (filters.customerIds.length > 0 ? 1 : 0) +
                (filters.mailSentFilter !== 'all' ? 1 : 0) +
                (filters.whatsappSentFilter !== 'all' ? 1 : 0) +
                (filters.smsSentFilter !== 'all' ? 1 : 0)}
            </span>
          )}
        </button>
        <button
          onClick={onReset}
          disabled={isLoading}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-border text-muted-foreground hover:bg-muted rounded-md text-xs font-medium transition-colors"
        >
          <Icon icon="solar:restart-bold" className="w-3.5 h-3.5" />
          Sıfırla
        </button>
      </div>

      {/* Gelişmiş Filtreler */}
      {showAdvanced && (
        <div className="pt-3 border-t border-border space-y-3">
          {/* Grup Seçimi */}
          {customerGroups.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Müşteri Grupları
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-muted rounded-md border border-border">
                {customerGroups.map((group) => {
                  const isSelected = filters.groupIds?.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      onClick={() => {
                        const newGroupIds = isSelected
                          ? (filters.groupIds || []).filter((id) => id !== group.id)
                          : [...(filters.groupIds || []), group.id];

                        // Müşteri ID'lerini güncelle
                        let newCustomerIds = [...filters.customerIds];
                        if (!isSelected && group.members) {
                          const memberIds = group.members.map((m) => m.id);
                          newCustomerIds = [...new Set([...filters.customerIds, ...memberIds])];
                        } else if (isSelected && group.members) {
                          const memberIds = new Set(group.members.map((m) => m.id));
                          newCustomerIds = filters.customerIds.filter((id) => !memberIds.has(id));
                        }

                        // Beyanname türlerini otomatik seç/kaldır
                        let newBeyannameTypes = [...filters.beyannameTypes];
                        if (!isSelected && group.beyannameTypes && group.beyannameTypes.length > 0) {
                          // Grubun beyanname türlerini ekle (duplicate'leri kaldır)
                          newBeyannameTypes = [...new Set([...filters.beyannameTypes, ...group.beyannameTypes])];
                        } else if (isSelected && group.beyannameTypes && group.beyannameTypes.length > 0) {
                          // Grup kaldırıldığında, o gruba ait beyanname türlerini kaldır
                          // (sadece başka bir seçili grupta yoksa)
                          const otherSelectedGroups = customerGroups.filter(
                            (g) => newGroupIds.includes(g.id) && g.id !== group.id
                          );
                          const otherGroupBeyannameTypes = new Set(
                            otherSelectedGroups.flatMap((g) => g.beyannameTypes || [])
                          );
                          newBeyannameTypes = filters.beyannameTypes.filter(
                            (type) => !group.beyannameTypes?.includes(type) || otherGroupBeyannameTypes.has(type)
                          );
                        }

                        onFiltersChange({
                          ...filters,
                          groupIds: newGroupIds,
                          customerIds: newCustomerIds,
                          beyannameTypes: newBeyannameTypes,
                        });
                      }}
                      className={cn(
                        'px-2 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5',
                        isSelected
                          ? 'text-white'
                          : 'bg-background border border-border text-muted-foreground hover:border-blue-400'
                      )}
                      style={isSelected ? { backgroundColor: group.color || '#3B82F6' } : {}}
                    >
                      <Icon icon="solar:users-group-rounded-bold" className="w-3 h-3" />
                      <span className="truncate max-w-[100px]">{group.name}</span>
                      {group.memberCount !== undefined && (
                        <span className={cn(
                          'text-[9px] px-1 py-0.5 rounded-full',
                          isSelected ? 'bg-white/20' : 'bg-muted'
                        )}>
                          {group.memberCount}
                        </span>
                      )}
                      {group.beyannameTypes && group.beyannameTypes.length > 0 && (
                        <span className={cn(
                          'text-[9px] px-1 py-0.5 rounded-full',
                          isSelected ? 'bg-white/20' : 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                        )}>
                          <Icon icon="solar:document-text-bold" className="w-2.5 h-2.5 inline" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {(filters.groupIds?.length || 0) > 0 && (
                <button
                  onClick={() => onFiltersChange({ ...filters, groupIds: [], customerIds: [], beyannameTypes: [] })}
                  className="mt-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Temizle ({filters.groupIds?.length})
                </button>
              )}
            </div>
          )}

          {/* Mükellef Seçimi */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Mükellef Filtresi {filters.groupIds?.length ? <span className="text-[10px] text-muted-foreground">(Grup aktif)</span> : ''}
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto p-2 bg-muted rounded-md border border-border">
              {customers.length === 0 ? (
                <div className="text-xs text-muted-foreground w-full text-center py-4">Mükellef bulunamadı</div>
              ) : (
                <>
                  {/* Seçili mükellefler üstte */}
                  {customers
                    .filter((c) => filters.customerIds.includes(c.id))
                    .map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() =>
                          updateFilter(
                            'customerIds',
                            toggleArrayValue(filters.customerIds, customer.id)
                          )
                        }
                        className="px-2 py-1 rounded text-[11px] font-medium transition-colors truncate max-w-[140px] bg-blue-600 text-white"
                        title={customer.kisaltma || customer.unvan}
                      >
                        {customer.kisaltma || customer.unvan}
                      </button>
                    ))}
                  {/* Seçili olmayanlar */}
                  {customers
                    .filter((c) => !filters.customerIds.includes(c.id))
                    .map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() =>
                          updateFilter(
                            'customerIds',
                            toggleArrayValue(filters.customerIds, customer.id)
                          )
                        }
                        className="px-2 py-1 rounded text-[11px] font-medium transition-colors truncate max-w-[140px] bg-background border border-border text-muted-foreground hover:border-blue-400"
                        title={customer.kisaltma || customer.unvan}
                      >
                        {customer.kisaltma || customer.unvan}
                      </button>
                    ))}
                </>
              )}
            </div>
            {filters.customerIds.length > 0 && (
              <button
                onClick={() => updateFilter('customerIds', [])}
                className="mt-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
              >
                Temizle ({filters.customerIds.length})
              </button>
            )}
          </div>

          {/* Beyanname Türleri - Popover Dropdown */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Beyanname Türü
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-xs border rounded-md transition-colors",
                    filters.beyannameTypes.length > 0
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:document-text-bold" className="w-4 h-4" />
                    <span>
                      {filters.beyannameTypes.length === 0
                        ? "Tümü"
                        : filters.beyannameTypes.length === 1
                        ? BEYANNAME_TYPES.find(t => t.code === filters.beyannameTypes[0])?.label
                        : `${filters.beyannameTypes.length} seçili`}
                    </span>
                  </div>
                  <Icon icon="solar:alt-arrow-down-linear" className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2 max-h-72 overflow-y-auto" align="start">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
                  <span className="text-xs font-medium text-foreground">Beyanname Türleri</span>
                  {filters.beyannameTypes.length > 0 && (
                    <button
                      onClick={() => updateFilter('beyannameTypes', [])}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Temizle
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {BEYANNAME_TYPES.map((type) => {
                    const isSelected = filters.beyannameTypes.includes(type.code);
                    return (
                      <label
                        key={type.code}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            updateFilter('beyannameTypes', toggleArrayValue(filters.beyannameTypes, type.code))
                          }
                        />
                        <span className="text-xs text-foreground">{type.label}</span>
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Dosya Türleri - Popover Dropdown */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Dosya Türü
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-xs border rounded-md transition-colors",
                    filters.documentTypes.length > 0
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:file-bold" className="w-4 h-4" />
                    <span>
                      {filters.documentTypes.length === 0
                        ? "Tümü"
                        : filters.documentTypes.length === 1
                        ? DOCUMENT_TYPES.find(t => t.code === filters.documentTypes[0])?.label
                        : `${filters.documentTypes.length} seçili`}
                    </span>
                  </div>
                  <Icon icon="solar:alt-arrow-down-linear" className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
                  <span className="text-xs font-medium text-foreground">Dosya Türleri</span>
                  {filters.documentTypes.length > 0 && (
                    <button
                      onClick={() => updateFilter('documentTypes', [])}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Temizle
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {DOCUMENT_TYPES.map((type) => {
                    const isSelected = filters.documentTypes.includes(type.code);
                    return (
                      <label
                        key={type.code}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            updateFilter('documentTypes', toggleArrayValue(filters.documentTypes, type.code as DosyaTipi))
                          }
                        />
                        <span className="text-xs text-foreground">{type.label}</span>
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Gönderim Durumu Filtreleri */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Gönderim Durumu
            </label>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  Mail
                </label>
                <select
                  value={filters.mailSentFilter}
                  onChange={(e) =>
                    updateFilter(
                      'mailSentFilter',
                      e.target.value as 'all' | 'sent' | 'not_sent'
                    )
                  }
                  className="w-full px-2 py-1.5 text-xs border border-border bg-background text-foreground rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="all">Tümü</option>
                  <option value="sent">Gönderildi</option>
                  <option value="not_sent">Gönderilmedi</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  WhatsApp
                </label>
                <select
                  value={filters.whatsappSentFilter}
                  onChange={(e) =>
                    updateFilter(
                      'whatsappSentFilter',
                      e.target.value as 'all' | 'sent' | 'not_sent'
                    )
                  }
                  className="w-full px-2 py-1.5 text-xs border border-border bg-background text-foreground rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="all">Tümü</option>
                  <option value="sent">Gönderildi</option>
                  <option value="not_sent">Gönderilmedi</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                  SMS
                </label>
                <select
                  value={filters.smsSentFilter}
                  onChange={(e) =>
                    updateFilter(
                      'smsSentFilter',
                      e.target.value as 'all' | 'sent' | 'not_sent'
                    )
                  }
                  className="w-full px-2 py-1.5 text-xs border border-border bg-background text-foreground rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="all">Tümü</option>
                  <option value="sent">Gönderildi</option>
                  <option value="not_sent">Gönderilmedi</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
