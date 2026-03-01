"use client";

import React, { useState, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { toast } from "@/components/ui/sonner";
import { BulkSendFilters } from './bulk-send-filters';
import { BulkSendTable } from './bulk-send-table';
import { BulkSendActions } from './bulk-send-actions';
import { MailDialog } from './dialogs/mail-dialog';
import { WhatsAppDialog } from './dialogs/whatsapp-dialog';
import { SmsDialog } from './dialogs/sms-dialog';
import { SendResultDialog } from './dialogs/send-result-dialog';
import { useBulkSendData } from './hooks/use-bulk-send-data';
import { useBulkSendFilters } from './hooks/use-bulk-send-filters';
import { useDocumentSelection } from './hooks/use-document-selection';
import type { BulkSendDocument, SendResult } from './types';

interface BulkSendPageProps {
  customers: Array<{
    id: string;
    unvan: string;
    kisaltma?: string | null;
  }>;
  customerGroups?: Array<{
    id: string;
    name: string;
    color?: string;
    memberCount?: number;
    members?: Array<{ id: string }>;
    beyannameTypes?: string[];
  }>;
}

export function BulkSendPage({ customers, customerGroups = [] }: BulkSendPageProps) {
  // Mobile filter panel state
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Filters hook
  const {
    filters,
    setFilters,
    searchTerm,
    setSearchTerm,
    showAdvancedFilters,
    setShowAdvancedFilters,
    resetFilters,
  } = useBulkSendFilters();

  // Data hook
  const {
    documents,
    isLoading,
    error,
    refetch,
    sendMail,
    sendWhatsApp,
    sendSms,
    downloadZip,
    exportExcel,
    resetStatus,
  } = useBulkSendData(filters);

  // Selection hook
  const {
    selectedIds,
    toggleSelection,
    toggleAll,
    clearSelection,
    isAllSelected,
    isSomeSelected,
    selectedDocuments,
  } = useDocumentSelection(documents);

  // Dialog states
  const [mailDialogOpen, setMailDialogOpen] = useState(false);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [resultType, setResultType] = useState<'mail' | 'whatsapp' | 'sms'>('mail');

  // Mail gönderimi
  const handleSendMail = useCallback(
    async (params: { subject?: string; body?: string; groupByCustomer: boolean }) => {
      try {
        const result = await sendMail(selectedIds, params);
        setSendResult(result);
        setResultType('mail');
        setResultDialogOpen(true);
        clearSelection();
        refetch();
      } catch (err) {
        toast.error('Mail gönderilirken bir hata oluştu');
        throw err;
      }
    },
    [selectedIds, sendMail, clearSelection, refetch]
  );

  // WhatsApp gönderimi
  const handleSendWhatsApp = useCallback(
    async (params: { message?: string; sendType: 'link' | 'document' | 'text' | 'document_text' }) => {
      try {
        const result = await sendWhatsApp(selectedIds, params);
        setSendResult(result);
        setResultType('whatsapp');
        setResultDialogOpen(true);
        clearSelection();
        refetch();
      } catch (err) {
        toast.error('WhatsApp gönderilirken bir hata oluştu');
        throw err;
      }
    },
    [selectedIds, sendWhatsApp, clearSelection, refetch]
  );

  // SMS gönderimi
  const handleSendSms = useCallback(
    async (params: { message?: string }) => {
      try {
        const result = await sendSms(selectedIds, params);
        setSendResult(result);
        setResultType('sms');
        setResultDialogOpen(true);
        clearSelection();
        refetch();
      } catch (err) {
        toast.error('SMS gönderilirken bir hata oluştu');
        throw err;
      }
    },
    [selectedIds, sendSms, clearSelection, refetch]
  );

  // ZIP indirme
  const handleDownload = useCallback(async () => {
    try {
      await downloadZip(selectedIds);
      toast.success('Dosyalar indirildi');
    } catch (err) {
      toast.error('Dosyalar indirilirken bir hata oluştu');
    }
  }, [selectedIds, downloadZip]);

  // Excel export
  const handleExportExcel = useCallback(async () => {
    try {
      await exportExcel(selectedIds);
      toast.success('Excel dosyası indirildi');
    } catch (err) {
      toast.error('Excel oluşturulurken bir hata oluştu');
    }
  }, [selectedIds, exportExcel]);

  // Durum sıfırlama
  const handleResetStatus = useCallback(
    async (type: 'all' | 'mail' | 'whatsapp' | 'sms') => {
      try {
        await resetStatus(selectedIds, type);
        toast.success('Gönderim durumları sıfırlandı');
        clearSelection();
        refetch();
      } catch (err) {
        toast.error('Durumlar sıfırlanırken bir hata oluştu');
      }
    },
    [selectedIds, resetStatus, clearSelection, refetch]
  );

  // Satır seçimi handler
  const handleRowSelect = useCallback(
    (doc: BulkSendDocument) => {
      toggleSelection(doc.id);
    },
    [toggleSelection]
  );

  // Tümünü seç handler
  const handleSelectAll = useCallback(() => {
    toggleAll();
  }, [toggleAll]);

  // Dosya önizleme handler - yeni sekmede PDF aç
  const handlePreviewDocument = useCallback((doc: BulkSendDocument) => {
    window.open(`/api/files/view?id=${doc.id}`, '_blank');
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg border border-border hover:bg-muted"
          >
            <Icon icon="solar:filter-bold" className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Icon icon="solar:plain-2-bold" className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Toplu Gönderim</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Beyanname ve tahakkukları mükelleflere toplu olarak gönderin
            </p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-lg hover:bg-muted disabled:opacity-50"
        >
          <Icon
            icon="solar:refresh-bold"
            className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
          />
          <span className="hidden sm:inline">Yenile</span>
        </button>
      </div>

      {/* İki Kolonlu Layout */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {/* Mobil Overlay Backdrop */}
        {showMobileFilters && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setShowMobileFilters(false)}
          />
        )}

        {/* Sol Panel - Filtreler */}
        <div
          className={`
            ${showMobileFilters ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0
            fixed lg:relative
            top-0 bottom-0 left-0
            w-80 lg:w-[420px]
            border-r border-border bg-background
            flex flex-col overflow-hidden
            transition-transform duration-300
            z-40 lg:z-0
            shadow-lg lg:shadow-none
          `}
        >
          <div className="p-4 border-b border-border bg-background flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Icon icon="solar:filter-bold" className="w-4 h-4" />
              Filtreler
            </h2>
            <button
              onClick={() => setShowMobileFilters(false)}
              className="lg:hidden p-1 hover:bg-muted rounded"
            >
              <Icon icon="solar:close-circle-bold" className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <BulkSendFilters
              filters={filters}
              onFiltersChange={setFilters}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              showAdvanced={showAdvancedFilters}
              onToggleAdvanced={() => setShowAdvancedFilters(!showAdvancedFilters)}
              onReset={resetFilters}
              customers={customers}
              customerGroups={customerGroups}
            />
          </div>

          {/* Sol Panel Footer - İstatistikler */}
          <div className="p-4 border-t border-border bg-background shrink-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Toplam Dosya</span>
                <span className="font-semibold text-foreground">{documents.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Seçili</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{selectedIds.length}</span>
              </div>
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon icon="solar:letter-bold" className="w-3.5 h-3.5 text-blue-500" />
                    <span>Mail</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {documents.filter((d) => d.sendStatus?.mailSent).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon icon="solar:chat-round-dots-bold" className="w-3.5 h-3.5 text-green-500" />
                    <span>WhatsApp</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {documents.filter((d) => d.sendStatus?.whatsappSent).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon icon="solar:smartphone-bold" className="w-3.5 h-3.5 text-purple-500" />
                    <span>SMS</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {documents.filter((d) => d.sendStatus?.smsSent).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sağ Panel - Dosyalar ve Aksiyonlar */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-background">
          {/* Actions Bar */}
          {selectedIds.length > 0 && (
            <div className="px-4 py-2.5 border-b border-border bg-blue-50 dark:bg-blue-900/20 shrink-0">
              <BulkSendActions
                selectedCount={selectedIds.length}
                onSendMail={() => setMailDialogOpen(true)}
                onSendWhatsApp={() => setWhatsappDialogOpen(true)}
                onSendSms={() => setSmsDialogOpen(true)}
                onDownload={handleDownload}
                onExportExcel={handleExportExcel}
                onResetStatus={handleResetStatus}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-hidden min-h-0 p-4">
            {error ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Icon icon="solar:danger-triangle-bold" className="w-16 h-16 text-red-400 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Bir hata oluştu</h3>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  Tekrar Dene
                </button>
              </div>
            ) : documents.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Icon icon="solar:inbox-bold" className="w-16 h-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Dosya bulunamadı</h3>
                <p className="text-sm text-muted-foreground">
                  Seçili kriterlere uygun dosya bulunmuyor. Filtreleri değiştirmeyi deneyin.
                </p>
              </div>
            ) : (
              <BulkSendTable
                documents={documents}
                isLoading={isLoading}
                selectedIds={selectedIds}
                onRowSelect={handleRowSelect}
                onSelectAll={handleSelectAll}
                isAllSelected={isAllSelected}
                isSomeSelected={isSomeSelected}
                onPreviewDocument={handlePreviewDocument}
              />
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <MailDialog
        open={mailDialogOpen}
        onOpenChange={setMailDialogOpen}
        selectedDocuments={selectedDocuments}
        onSend={handleSendMail}
      />

      <WhatsAppDialog
        open={whatsappDialogOpen}
        onOpenChange={setWhatsappDialogOpen}
        selectedDocuments={selectedDocuments}
        onSend={handleSendWhatsApp}
      />

      <SmsDialog
        open={smsDialogOpen}
        onOpenChange={setSmsDialogOpen}
        selectedDocuments={selectedDocuments}
        onSend={handleSendSms}
      />

      <SendResultDialog
        open={resultDialogOpen}
        onOpenChange={setResultDialogOpen}
        result={sendResult}
        type={resultType}
      />
    </div>
  );
}
