import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type {
  BulkSendDocument,
  BulkSendFilterState,
  BulkSendStats,
  SendResult,
} from '../types';

export interface UseBulkSendDataResult {
  // Data
  documents: BulkSendDocument[];
  stats: BulkSendStats;
  isLoading: boolean;
  error: string | null;

  // Actions
  refetch: () => Promise<void>;

  // Send operations
  sendMail: (
    documentIds: string[],
    params: { subject?: string; body?: string; groupByCustomer: boolean }
  ) => Promise<SendResult>;

  sendWhatsApp: (
    documentIds: string[],
    params: { message?: string; sendType: 'link' | 'document' | 'text' | 'document_text' }
  ) => Promise<SendResult>;

  sendSms: (
    documentIds: string[],
    params: { message?: string }
  ) => Promise<SendResult>;

  downloadZip: (documentIds: string[]) => Promise<void>;
  exportExcel: (documentIds: string[]) => Promise<void>;
  resetStatus: (documentIds: string[], resetType: 'all' | 'mail' | 'whatsapp' | 'sms') => Promise<void>;
}

export function useBulkSendData(filters: BulkSendFilterState): UseBulkSendDataResult {
  const [allDocuments, setAllDocuments] = useState<BulkSendDocument[]>([]);
  const [stats, setStats] = useState<BulkSendStats>({
    totalDocuments: 0,
    totalCustomers: 0,
    mailSent: 0,
    whatsappSent: 0,
    smsSent: 0,
    notSent: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AbortController ref - devam eden isteği iptal etmek için
  const abortControllerRef = useRef<AbortController | null>(null);
  // Debounce timer ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // API'ye gönderilecek filtrelerin stable key'i (searchTerm hariç - client-side)
  const apiFilterKey = useMemo(() => {
    return JSON.stringify({
      customerIds: filters.customerIds,
      groupIds: filters.groupIds,
      beyannameTypes: filters.beyannameTypes,
      documentTypes: filters.documentTypes,
      mailSentFilter: filters.mailSentFilter,
      whatsappSentFilter: filters.whatsappSentFilter,
      smsSentFilter: filters.smsSentFilter,
      yearStart: filters.yearStart,
      monthStart: filters.monthStart,
      yearEnd: filters.yearEnd,
      monthEnd: filters.monthEnd,
    });
  }, [
    filters.customerIds,
    filters.groupIds,
    filters.beyannameTypes,
    filters.documentTypes,
    filters.mailSentFilter,
    filters.whatsappSentFilter,
    filters.smsSentFilter,
    filters.yearStart,
    filters.monthStart,
    filters.yearEnd,
    filters.monthEnd,
  ]);

  // Filtre ref'i - fetchDocuments içinde güncel filtrelere erişmek için
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Fetch documents - stable callback (dependency yok, ref kullanıyor)
  const fetchDocuments = useCallback(async () => {
    // Önceki isteği iptal et
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const currentFilters = filtersRef.current;

      // Status filter'ı oluştur
      let statusFilter: { mailSent?: boolean; whatsappSent?: boolean; smsSent?: boolean } | undefined;

      if (currentFilters.mailSentFilter !== 'all') {
        statusFilter = statusFilter || {};
        statusFilter.mailSent = currentFilters.mailSentFilter === 'sent';
      }
      if (currentFilters.whatsappSentFilter !== 'all') {
        statusFilter = statusFilter || {};
        statusFilter.whatsappSent = currentFilters.whatsappSentFilter === 'sent';
      }
      if (currentFilters.smsSentFilter !== 'all') {
        statusFilter = statusFilter || {};
        statusFilter.smsSent = currentFilters.smsSentFilter === 'sent';
      }

      const response = await fetch('/api/bulk-send/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerIds: currentFilters.customerIds.length > 0 ? currentFilters.customerIds : undefined,
          groupIds: currentFilters.groupIds?.length > 0 ? currentFilters.groupIds : undefined,
          beyannameTypes: currentFilters.beyannameTypes.length > 0 ? currentFilters.beyannameTypes : undefined,
          documentTypes: currentFilters.documentTypes.length > 0 ? currentFilters.documentTypes : undefined,
          status: statusFilter,
          yearStart: currentFilters.yearStart,
          monthStart: currentFilters.monthStart,
          yearEnd: currentFilters.yearEnd,
          monthEnd: currentFilters.monthEnd,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Dosyalar yüklenemedi');
      }

      const data = await response.json();

      // İptal edildiyse state güncelleme
      if (controller.signal.aborted) return;

      setAllDocuments(data.documents as BulkSendDocument[]);
      setStats(data.stats);
    } catch (err) {
      // AbortError'ı yoksay (beklenen davranış)
      if (err instanceof DOMException && err.name === 'AbortError') return;

      console.error('[useBulkSendData] fetchDocuments error:', err);
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      // Sadece aktif controller ise loading'i kapat
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, []);

  // Client-side search filter (API çağrısı tetiklemez)
  const documents = useMemo(() => {
    if (!filters.searchTerm) return allDocuments;
    const term = filters.searchTerm.toLowerCase();
    return allDocuments.filter(
      (doc) =>
        doc.name.toLowerCase().includes(term) ||
        doc.customerName.toLowerCase().includes(term) ||
        doc.customerKisaltma?.toLowerCase().includes(term) ||
        doc.beyannameTuru.toLowerCase().includes(term)
    );
  }, [allDocuments, filters.searchTerm]);

  // Debounced auto-fetch: API filtreler değiştiğinde 400ms bekle
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchDocuments();
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [apiFilterKey, fetchDocuments]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Send mail
  const sendMail = useCallback(async (
    documentIds: string[],
    params: { subject?: string; body?: string; groupByCustomer: boolean }
  ): Promise<SendResult> => {
    const response = await fetch('/api/bulk-send/mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentIds,
        ...params,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Mail gönderme başarısız');
    }

    return result;
  }, []);

  // Send WhatsApp
  const sendWhatsApp = useCallback(async (
    documentIds: string[],
    params: { message?: string; sendType: 'link' | 'document' | 'text' | 'document_text' }
  ): Promise<SendResult> => {
    const response = await fetch('/api/bulk-send/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentIds,
        ...params,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'WhatsApp gönderme başarısız');
    }

    return result;
  }, []);

  // Send SMS
  const sendSms = useCallback(async (
    documentIds: string[],
    params: { message?: string }
  ): Promise<SendResult> => {
    const response = await fetch('/api/bulk-send/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentIds,
        ...params,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'SMS gönderme başarısız');
    }

    return result;
  }, []);

  // Download ZIP
  const downloadZip = useCallback(async (documentIds: string[]) => {
    const response = await fetch('/api/bulk-send/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentIds, groupByCustomer: true }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'ZIP indirme başarısız');
    }

    // Dosyayı indir
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'beyannameler.zip';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, []);

  // Export Excel
  const exportExcel = useCallback(async (documentIds: string[]) => {
    const response = await fetch('/api/bulk-send/export-excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentIds }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Excel export başarısız');
    }

    // Dosyayı indir
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'beyanname_raporu.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, []);

  // Reset status
  const resetStatus = useCallback(async (documentIds: string[], resetType: 'all' | 'mail' | 'whatsapp' | 'sms') => {
    const response = await fetch('/api/bulk-send/status', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentIds, resetType }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Sıfırlama başarısız');
    }
  }, []);

  return {
    documents,
    stats,
    isLoading,
    error,
    refetch: fetchDocuments,
    sendMail,
    sendWhatsApp,
    sendSms,
    downloadZip,
    exportExcel,
    resetStatus,
  };
}
