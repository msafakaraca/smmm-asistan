"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Icon } from "@iconify/react";
import { toast } from "@/components/ui/sonner";
import { AnnouncementFilters } from "./announcement-filters";
import { AnnouncementCustomerTable } from "./announcement-customer-table";
import { AnnouncementActions } from "./announcement-actions";
import { useAnnouncementData } from "./hooks/use-announcement-data";
import { SendDialog } from "./dialogs/send-dialog";
import { SendResultDialog } from "./dialogs/send-result-dialog";
import { ScheduledDialog } from "./dialogs/scheduled-dialog";
import { TemplateDialog } from "./dialogs/template-dialog";
import {
  getDefaultAnnouncementFilterState,
  type AnnouncementFilterState,
  type AnnouncementCustomer,
  type ChannelSettings,
  type SendResult,
  type CreateTemplateRequest,
} from "./types";

interface CustomerGroup {
  id: string;
  name: string;
  color?: string | null;
  memberCount?: number;
}

interface AnnouncementPageProps {
  customerGroups?: CustomerGroup[];
}

export function AnnouncementPage({ customerGroups = [] }: AnnouncementPageProps) {
  // Mobile filter panel state
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<AnnouncementFilterState>(
    getDefaultAnnouncementFilterState()
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog states
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendDialogChannels, setSendDialogChannels] = useState<ChannelSettings>({
    email: false,
    sms: false,
    whatsapp: false,
  });
  const [scheduledDialogOpen, setScheduledDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);

  // Apply search to filters
  const filtersWithSearch = useMemo(
    () => ({
      ...filters,
      searchTerm,
    }),
    [filters, searchTerm]
  );

  // Data hook
  const {
    customers,
    isLoading,
    error,
    refetch,
    templates,
    sendAnnouncement,
    createTemplate,
    deleteTemplate,
    createScheduledAnnouncement,
  } = useAnnouncementData({
    filters: filtersWithSearch,
  });

  // Selection helpers
  const isAllSelected = customers.length > 0 && selectedIds.size === customers.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < customers.length;

  const toggleSelection = useCallback((customerId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map((c) => c.id)));
    }
  }, [isAllSelected, customers]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Reset filters
  const resetFilters = useCallback(() => {
    setFilters(getDefaultAnnouncementFilterState());
    setSearchTerm("");
    clearSelection();
  }, [clearSelection]);

  // Get selected customers info
  const selectedCustomers = useMemo(() => {
    return customers.filter((c) => selectedIds.has(c.id));
  }, [customers, selectedIds]);

  const selectedWithEmail = useMemo(() => {
    return selectedCustomers.filter((c) => c.email && c.email.trim() !== "").length;
  }, [selectedCustomers]);

  const selectedWithPhone = useMemo(() => {
    return selectedCustomers.filter(
      (c) =>
        (c.telefon1 && c.telefon1.trim() !== "") ||
        (c.telefon2 && c.telefon2.trim() !== "")
    ).length;
  }, [selectedCustomers]);

  // Action handlers
  const handleSendEmail = useCallback(() => {
    if (selectedWithEmail === 0) {
      toast.error("Seçili mükelleflerde e-posta adresi bulunamadı");
      return;
    }
    setSendDialogChannels({ email: true, sms: false, whatsapp: false });
    setSendDialogOpen(true);
  }, [selectedWithEmail]);

  const handleSendSms = useCallback(() => {
    if (selectedWithPhone === 0) {
      toast.error("Seçili mükelleflerde telefon numarası bulunamadı");
      return;
    }
    setSendDialogChannels({ email: false, sms: true, whatsapp: false });
    setSendDialogOpen(true);
  }, [selectedWithPhone]);

  const handleSendWhatsApp = useCallback(() => {
    if (selectedWithPhone === 0) {
      toast.error("Seçili mükelleflerde telefon numarası bulunamadı");
      return;
    }
    setSendDialogChannels({ email: false, sms: false, whatsapp: true });
    setSendDialogOpen(true);
  }, [selectedWithPhone]);

  const handleSchedule = useCallback(() => {
    setScheduledDialogOpen(true);
  }, []);

  const handleUseTemplate = useCallback(() => {
    setTemplateDialogOpen(true);
  }, []);

  // Send handler
  const handleSend = useCallback(
    async (params: { subject?: string; content: string; channels: ChannelSettings }) => {
      const customerIds = Array.from(selectedIds);
      try {
        const result = await sendAnnouncement({
          customerIds,
          subject: params.subject,
          content: params.content,
          channels: params.channels,
        });
        setSendResult(result);
        setResultDialogOpen(true);
        // Clear selection on success
        if (result.success) {
          clearSelection();
        }
      } catch (error) {
        console.error("Gonderim hatasi:", error);
        throw error;
      }
    },
    [selectedIds, sendAnnouncement, clearSelection]
  );

  // Template save handler
  const handleSaveTemplate = useCallback(
    async (template: CreateTemplateRequest, id?: string) => {
      // For now, we only support creating new templates
      await createTemplate(template);
    },
    [createTemplate]
  );

  // Scheduled announcement handler
  const handleCreateScheduled = useCallback(
    async (params: {
      name: string;
      subject?: string;
      content: string;
      sendEmail: boolean;
      sendSms: boolean;
      sendWhatsApp: boolean;
      scheduledAt: string;
      repeatPattern?: string;
      repeatDay?: number;
      repeatEndDate?: string;
      targetType: string;
      customerIds?: string[];
      groupIds?: string[];
      templateId?: string;
    }) => {
      await createScheduledAnnouncement(params);
      toast.success("Zamanlı duyuru oluşturuldu");
    },
    [createScheduledAnnouncement]
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 xl:px-6 py-3 border-b border-border bg-background shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg border border-border hover:bg-muted"
          >
            <Icon icon="solar:filter-bold" className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Icon icon="solar:megaphone-bold" className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Mükellef Duyuruları</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Mükelleflere toplu e-posta, SMS ve WhatsApp duyuruları gönderin
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
            className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Yenile</span>
        </button>
      </div>

      {/* Two Column Layout */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {/* Mobile Overlay Backdrop */}
        {showMobileFilters && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setShowMobileFilters(false)}
          />
        )}

        {/* Left Panel - Filters */}
        <div
          className={`
            ${showMobileFilters ? "translate-x-0" : "-translate-x-full"}
            lg:translate-x-0
            fixed lg:relative
            top-0 bottom-0 left-0
            w-80 lg:w-[360px]
            border-r border-border bg-background
            flex flex-col overflow-hidden
            transition-transform duration-300
            z-40 lg:z-0
            shadow-lg lg:shadow-none
          `}
        >
          <div className="h-14 px-4 border-b border-border bg-background flex items-center justify-between">
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
            <AnnouncementFilters
              filters={filters}
              onFiltersChange={setFilters}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onReset={resetFilters}
              customerGroups={customerGroups}
              isLoading={isLoading}
            />
          </div>

          {/* Left Panel Footer - Stats */}
          <div className="p-4 border-t border-border bg-background shrink-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Toplam Mükellef</span>
                <span className="font-semibold text-foreground">{customers.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Seçili</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{selectedIds.size}</span>
              </div>
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon icon="solar:letter-bold" className="w-3.5 h-3.5 text-blue-500" />
                    <span>E-posta var</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {customers.filter((c) => c.email).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon icon="solar:phone-bold" className="w-3.5 h-3.5 text-green-500" />
                    <span>Telefon var</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {customers.filter((c) => c.telefon1 || c.telefon2).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon icon="solar:users-group-rounded-bold" className="w-3.5 h-3.5 text-purple-500" />
                    <span>Grup sayısı</span>
                  </div>
                  <span className="font-medium text-foreground">{customerGroups.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Table and Actions */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-background">
          {/* Actions Bar - Her zaman görünür, sol panel header ile aynı yükseklikte */}
          <div className={`h-14 px-4 border-b border-border shrink-0 flex items-center ${selectedIds.size > 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-muted'}`}>
            <AnnouncementActions
              selectedCount={selectedIds.size}
              onSendEmail={handleSendEmail}
              onSendSms={handleSendSms}
              onSendWhatsApp={handleSendWhatsApp}
              onSchedule={handleSchedule}
              onUseTemplate={handleUseTemplate}
              isLoading={isLoading}
              hasEmail={selectedWithEmail}
              hasPhone={selectedWithPhone}
              totalWithEmail={customers.filter((c) => c.email).length}
              totalWithPhone={customers.filter((c) => c.telefon1 || c.telefon2).length}
            />
          </div>

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
            ) : (
              <AnnouncementCustomerTable
                customers={customers}
                isLoading={isLoading}
                selectedIds={selectedIds}
                onRowSelect={toggleSelection}
                onSelectAll={toggleAll}
                isAllSelected={isAllSelected}
                isSomeSelected={isSomeSelected}
              />
            )}
          </div>
        </div>
      </div>

      {/* Send Dialog */}
      <SendDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        selectedCustomers={selectedCustomers}
        templates={templates}
        onSend={handleSend}
        initialChannels={sendDialogChannels}
      />

      {/* Send Result Dialog */}
      <SendResultDialog
        open={resultDialogOpen}
        onOpenChange={setResultDialogOpen}
        result={sendResult}
      />

      {/* Scheduled Dialog */}
      <ScheduledDialog
        open={scheduledDialogOpen}
        onOpenChange={setScheduledDialogOpen}
        selectedCustomerIds={Array.from(selectedIds)}
        selectedCustomerCount={selectedIds.size}
        onSave={handleCreateScheduled}
      />

      {/* Template Dialog */}
      <TemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        templates={templates}
        onSave={handleSaveTemplate}
        onDelete={deleteTemplate}
      />
    </div>
  );
}
