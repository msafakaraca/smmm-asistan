import { useState, useCallback, useMemo } from 'react';
import type { BulkSendFilterState, DosyaTipi } from '../types';
import { getDefaultFilterState } from '../types';

export interface UseBulkSendFiltersResult {
  filters: BulkSendFilterState;
  setFilters: React.Dispatch<React.SetStateAction<BulkSendFilterState>>;

  // Direct values for convenience
  searchTerm: string;
  showAdvancedFilters: boolean;

  // Individual setters
  setCustomerIds: (ids: string[]) => void;
  setBeyannameTypes: (types: string[]) => void;
  setDocumentTypes: (types: DosyaTipi[]) => void;
  setMailSentFilter: (filter: 'all' | 'sent' | 'not_sent') => void;
  setWhatsappSentFilter: (filter: 'all' | 'sent' | 'not_sent') => void;
  setSmsSentFilter: (filter: 'all' | 'sent' | 'not_sent') => void;
  setYearStart: (year: number) => void;
  setMonthStart: (month: number) => void;
  setYearEnd: (year: number) => void;
  setMonthEnd: (month: number) => void;
  setSearchTerm: (term: string) => void;
  setShowAdvancedFilters: (show: boolean) => void;

  // Bulk setters
  setPeriod: (yearStart: number, monthStart: number, yearEnd: number, monthEnd: number) => void;
  setCurrentMonth: () => void;
  setPreviousMonth: () => void;

  // Reset
  resetFilters: () => void;

  // Computed
  isFiltered: boolean;
  filterCount: number;
}

export function useBulkSendFilters(): UseBulkSendFiltersResult {
  const [filters, setFilters] = useState<BulkSendFilterState>(getDefaultFilterState);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Individual setters
  const setCustomerIds = useCallback((ids: string[]) => {
    setFilters((prev) => ({ ...prev, customerIds: ids }));
  }, []);

  const setBeyannameTypes = useCallback((types: string[]) => {
    setFilters((prev) => ({ ...prev, beyannameTypes: types }));
  }, []);

  const setDocumentTypes = useCallback((types: DosyaTipi[]) => {
    setFilters((prev) => ({ ...prev, documentTypes: types }));
  }, []);

  const setMailSentFilter = useCallback((filter: 'all' | 'sent' | 'not_sent') => {
    setFilters((prev) => ({ ...prev, mailSentFilter: filter }));
  }, []);

  const setWhatsappSentFilter = useCallback((filter: 'all' | 'sent' | 'not_sent') => {
    setFilters((prev) => ({ ...prev, whatsappSentFilter: filter }));
  }, []);

  const setSmsSentFilter = useCallback((filter: 'all' | 'sent' | 'not_sent') => {
    setFilters((prev) => ({ ...prev, smsSentFilter: filter }));
  }, []);

  const setYearStart = useCallback((year: number) => {
    setFilters((prev) => ({ ...prev, yearStart: year }));
  }, []);

  const setMonthStart = useCallback((month: number) => {
    setFilters((prev) => ({ ...prev, monthStart: month }));
  }, []);

  const setYearEnd = useCallback((year: number) => {
    setFilters((prev) => ({ ...prev, yearEnd: year }));
  }, []);

  const setMonthEnd = useCallback((month: number) => {
    setFilters((prev) => ({ ...prev, monthEnd: month }));
  }, []);

  const setSearchTerm = useCallback((term: string) => {
    setFilters((prev) => ({ ...prev, searchTerm: term }));
  }, []);

  // Bulk setters
  const setPeriod = useCallback((yearStart: number, monthStart: number, yearEnd: number, monthEnd: number) => {
    setFilters((prev) => ({
      ...prev,
      yearStart,
      monthStart,
      yearEnd,
      monthEnd,
    }));
  }, []);

  const setCurrentMonth = useCallback(() => {
    const now = new Date();
    let month = now.getMonth();
    let year = now.getFullYear();

    // Muhasebe 1 ay geriden gelir
    if (month === 0) {
      month = 12;
      year = year - 1;
    }

    setFilters((prev) => ({
      ...prev,
      yearStart: year,
      monthStart: month,
      yearEnd: year,
      monthEnd: month,
    }));
  }, []);

  const setPreviousMonth = useCallback(() => {
    const now = new Date();
    let month = now.getMonth() - 1;
    let year = now.getFullYear();

    // Muhasebe 1 ay geriden gelir
    if (month === 0) {
      month = 12;
      year = year - 1;
    } else if (month < 0) {
      month = 11;
      year = year - 1;
    }

    setFilters((prev) => ({
      ...prev,
      yearStart: year,
      monthStart: month,
      yearEnd: year,
      monthEnd: month,
    }));
  }, []);

  // Reset
  const resetFilters = useCallback(() => {
    setFilters(getDefaultFilterState());
  }, []);

  // Computed
  const isFiltered = useMemo(() => {
    const defaults = getDefaultFilterState();
    return (
      filters.customerIds.length > 0 ||
      filters.beyannameTypes.length > 0 ||
      filters.documentTypes.length > 0 ||
      filters.mailSentFilter !== 'all' ||
      filters.whatsappSentFilter !== 'all' ||
      filters.smsSentFilter !== 'all' ||
      filters.searchTerm !== '' ||
      filters.yearStart !== defaults.yearStart ||
      filters.monthStart !== defaults.monthStart ||
      filters.yearEnd !== defaults.yearEnd ||
      filters.monthEnd !== defaults.monthEnd
    );
  }, [filters]);

  const filterCount = useMemo(() => {
    let count = 0;
    if (filters.customerIds.length > 0) count++;
    if (filters.beyannameTypes.length > 0) count++;
    if (filters.documentTypes.length > 0) count++;
    if (filters.mailSentFilter !== 'all') count++;
    if (filters.whatsappSentFilter !== 'all') count++;
    if (filters.smsSentFilter !== 'all') count++;
    if (filters.searchTerm !== '') count++;
    return count;
  }, [filters]);

  return {
    filters,
    setFilters,
    searchTerm: filters.searchTerm,
    showAdvancedFilters,
    setCustomerIds,
    setBeyannameTypes,
    setDocumentTypes,
    setMailSentFilter,
    setWhatsappSentFilter,
    setSmsSentFilter,
    setYearStart,
    setMonthStart,
    setYearEnd,
    setMonthEnd,
    setSearchTerm,
    setShowAdvancedFilters,
    setPeriod,
    setCurrentMonth,
    setPreviousMonth,
    resetFilters,
    isFiltered,
    filterCount,
  };
}
