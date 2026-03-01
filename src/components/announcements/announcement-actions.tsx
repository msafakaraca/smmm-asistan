"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface AnnouncementActionsProps {
  selectedCount: number;
  onSendEmail: () => void;
  onSendSms: () => void;
  onSendWhatsApp: () => void;
  onSchedule: () => void;
  onUseTemplate: () => void;
  isLoading?: boolean;
  hasEmail?: number;
  hasPhone?: number;
  totalWithEmail?: number;
  totalWithPhone?: number;
}

export function AnnouncementActions({
  selectedCount,
  onSendEmail,
  onSendSms,
  onSendWhatsApp,
  onSchedule,
  onUseTemplate,
  isLoading = false,
  hasEmail = 0,
  hasPhone = 0,
  totalWithEmail = 0,
  totalWithPhone = 0,
}: AnnouncementActionsProps) {
  const hasSelection = selectedCount > 0;
  const isDisabled = !hasSelection || isLoading;
  // Email butonu: seçili mükellef ve email'i olan mükellef varsa aktif
  const canSendEmail = hasSelection && hasEmail > 0;
  // SMS/WhatsApp butonu: seçili mükellef ve telefonu olan mükellef varsa aktif
  const canSendPhone = hasSelection && hasPhone > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Seçim Bilgisi */}
      <div className={cn(
        "flex items-center gap-2 text-sm pr-4 border-r border-border",
        hasSelection ? "text-muted-foreground" : "text-muted-foreground/60"
      )}>
        <Icon icon="solar:check-square-bold" className={cn("w-4 h-4", hasSelection ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground/60")} />
        <span>
          <strong className={hasSelection ? "text-foreground" : "text-muted-foreground"}>
            {hasSelection ? selectedCount : 0}
          </strong> mükellef seçili
        </span>
      </div>

      {/* İletişim Bilgisi */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground pr-4 border-r border-border">
        <div className="flex items-center gap-1">
          <Icon icon="solar:letter-bold" className={cn("w-3.5 h-3.5", hasSelection && hasEmail > 0 ? "text-blue-500" : "text-muted-foreground/60")} />
          <span className={hasSelection && hasEmail > 0 ? "text-foreground" : "text-muted-foreground/60"}>
            {hasSelection ? hasEmail : totalWithEmail} E-posta
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Icon icon="solar:phone-bold" className={cn("w-3.5 h-3.5", hasSelection && hasPhone > 0 ? "text-green-500" : "text-muted-foreground/60")} />
          <span className={hasSelection && hasPhone > 0 ? "text-foreground" : "text-muted-foreground/60"}>
            {hasSelection ? hasPhone : totalWithPhone} Telefon
          </span>
        </div>
      </div>

      {/* E-posta Gönder */}
      <button
        onClick={onSendEmail}
        disabled={!canSendEmail}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
          !canSendEmail
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        )}
        title={!hasSelection ? "Önce mükellef seçin" : hasEmail === 0 ? "Seçili mükelleflerde e-posta adresi yok" : "E-posta ile duyuru gönder"}
      >
        <Icon icon="solar:letter-bold" className="w-4 h-4" />
        <span className="hidden sm:inline">E-posta Gönder</span>
        <span className="sm:hidden">E-posta</span>
      </button>

      {/* SMS Gönder */}
      <button
        onClick={onSendSms}
        disabled={!canSendPhone}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
          !canSendPhone
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-purple-600 hover:bg-purple-700 text-white"
        )}
        title={!hasSelection ? "Önce mükellef seçin" : hasPhone === 0 ? "Seçili mükelleflerde telefon numarası yok" : "SMS ile duyuru gönder"}
      >
        <Icon icon="solar:smartphone-bold" className="w-4 h-4" />
        <span className="hidden sm:inline">SMS Gönder</span>
        <span className="sm:hidden">SMS</span>
      </button>

      {/* WhatsApp Gönder */}
      <button
        onClick={onSendWhatsApp}
        disabled={!canSendPhone}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
          !canSendPhone
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-green-600 hover:bg-green-700 text-white"
        )}
        title={!hasSelection ? "Önce mükellef seçin" : hasPhone === 0 ? "Seçili mükelleflerde telefon numarası yok" : "WhatsApp ile duyuru gönder"}
      >
        <Icon icon="solar:chat-round-dots-bold" className="w-4 h-4" />
        <span className="hidden sm:inline">WhatsApp</span>
        <span className="sm:hidden">WA</span>
      </button>

      {/* Ayırıcı */}
      <div className="w-px h-8 bg-border mx-1 hidden md:block" />

      {/* Zamanlı Duyuru */}
      <button
        onClick={onSchedule}
        disabled={isDisabled}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isDisabled
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-orange-100 dark:bg-orange-500/20 hover:bg-orange-200 dark:hover:bg-orange-500/30 text-orange-700 dark:text-orange-300"
        )}
        title={!hasSelection ? "Önce mükellef seçin" : "Zamanlı duyuru oluştur"}
      >
        <Icon icon="solar:clock-circle-bold" className="w-4 h-4" />
        <span className="hidden lg:inline">Zamanla</span>
      </button>

      {/* Şablon Kullan - Her zaman aktif */}
      <button
        onClick={onUseTemplate}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isLoading
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-indigo-100 dark:bg-indigo-500/20 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300"
        )}
        title="Şablonları görüntüle ve düzenle"
      >
        <Icon icon="solar:document-text-bold" className="w-4 h-4" />
        <span className="hidden lg:inline">Şablon</span>
      </button>
    </div>
  );
}
