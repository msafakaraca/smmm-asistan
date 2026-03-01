"use client";

import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';

interface BulkSendActionsProps {
  selectedCount: number;
  onSendMail: () => void;
  onSendWhatsApp: () => void;
  onSendSms: () => void;
  onDownload: () => void;
  onExportExcel: () => void;
  onResetStatus: (type: 'all' | 'mail' | 'whatsapp' | 'sms') => void;
  isLoading?: boolean;
}

export function BulkSendActions({
  selectedCount,
  onSendMail,
  onSendWhatsApp,
  onSendSms,
  onDownload,
  onExportExcel,
  onResetStatus,
  isLoading = false,
}: BulkSendActionsProps) {
  const [showResetMenu, setShowResetMenu] = useState(false);

  const isDisabled = selectedCount === 0 || isLoading;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Seçim Bilgisi */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground pr-4 border-r border-border">
        <Icon icon="solar:check-square-bold" className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span>
          <strong className="text-foreground">{selectedCount}</strong> dosya seçili
        </span>
      </div>

      {/* Mail Gönder */}
      <button
        onClick={onSendMail}
        disabled={isDisabled}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          isDisabled
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        )}
      >
        <Icon icon="solar:letter-bold" className="w-4 h-4" />
        Mail Gönder
      </button>

      {/* WhatsApp Gönder */}
      <button
        onClick={onSendWhatsApp}
        disabled={isDisabled}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          isDisabled
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700 text-white'
        )}
      >
        <Icon icon="solar:chat-round-dots-bold" className="w-4 h-4" />
        WhatsApp
      </button>

      {/* SMS Gönder */}
      <button
        onClick={onSendSms}
        disabled={isDisabled}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          isDisabled
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-purple-600 hover:bg-purple-700 text-white'
        )}
      >
        <Icon icon="solar:smartphone-bold" className="w-4 h-4" />
        SMS
      </button>

      {/* Ayırıcı */}
      <div className="w-px h-8 bg-border mx-2" />

      {/* ZIP İndir */}
      <button
        onClick={onDownload}
        disabled={isDisabled}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isDisabled
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
        )}
      >
        <Icon icon="solar:download-bold" className="w-4 h-4" />
        ZIP İndir
      </button>

      {/* Excel Export */}
      <button
        onClick={onExportExcel}
        disabled={isDisabled}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isDisabled
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300'
        )}
      >
        <Icon icon="solar:file-check-bold" className="w-4 h-4" />
        Excel
      </button>

      {/* Sıfırla */}
      <div className="relative">
        <button
          onClick={() => setShowResetMenu(!showResetMenu)}
          disabled={isDisabled}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            isDisabled
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-700 dark:text-red-300'
          )}
        >
          <Icon icon="solar:restart-bold" className="w-4 h-4" />
          Sıfırla
          <Icon icon="solar:alt-arrow-down-bold" className="w-3 h-3" />
        </button>

        {showResetMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowResetMenu(false)}
            />
            {/* Menu */}
            <div className="absolute right-0 top-full mt-1 bg-popover rounded-lg shadow-lg border border-border py-1 z-20 min-w-[180px]">
              <button
                onClick={() => {
                  onResetStatus('all');
                  setShowResetMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-muted flex items-center gap-2"
              >
                <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4 text-red-500" />
                Tümünü Sıfırla
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => {
                  onResetStatus('mail');
                  setShowResetMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-muted flex items-center gap-2"
              >
                <Icon icon="solar:letter-bold" className="w-4 h-4 text-blue-500" />
                Mail Durumunu Sıfırla
              </button>
              <button
                onClick={() => {
                  onResetStatus('whatsapp');
                  setShowResetMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-muted flex items-center gap-2"
              >
                <Icon icon="solar:chat-round-dots-bold" className="w-4 h-4 text-green-500" />
                WhatsApp Durumunu Sıfırla
              </button>
              <button
                onClick={() => {
                  onResetStatus('sms');
                  setShowResetMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-muted flex items-center gap-2"
              >
                <Icon icon="solar:smartphone-bold" className="w-4 h-4 text-purple-500" />
                SMS Durumunu Sıfırla
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
