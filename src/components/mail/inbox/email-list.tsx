"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@iconify/react";
import { EmailListItemComponent } from "./email-list-item";
import type { EmailListItem, EmailStats, Pagination } from "./hooks/use-inbox-emails";

interface EmailListProps {
  emails: EmailListItem[];
  stats: EmailStats;
  pagination: Pagination;
  isLoading: boolean;
  isRefreshing?: boolean;
  selectedEmailId: string | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSelectEmail: (id: string) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
}

export const EmailList = React.memo(function EmailList({
  emails,
  stats,
  pagination,
  isLoading,
  isRefreshing = false,
  selectedEmailId,
  searchTerm,
  onSearchChange,
  onSelectEmail,
  onPageChange,
  onRefresh,
}: EmailListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-3 border-b border-gray-200 shrink-0">
        <div className="relative">
          <Icon
            icon="solar:magnifer-bold"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          />
          <input
            type="text"
            placeholder="E-posta ara..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Icon icon="solar:inbox-bold-duotone" className="w-12 h-12 mb-2 opacity-40" />
            <p className="text-sm font-medium">
              {searchTerm ? "Aramayla eşleşen e-posta bulunamadı" : "Gelen kutusu boş"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {emails.map((email) => (
              <EmailListItemComponent
                key={email.id}
                email={email}
                isSelected={email.id === selectedEmailId}
                onClick={() => onSelectEmail(email.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stats & Pagination Footer */}
      <div className="p-3 border-t shrink-0 bg-gray-50">
        <div className="flex items-center justify-between">
          {/* Stats */}
          <div className="text-xs text-gray-500">
            <span className="font-semibold text-gray-900">{stats.total}</span> e-posta
            {stats.unread > 0 && (
              <span className="ml-2">
                (<span className="font-semibold text-blue-600">{stats.unread}</span> okunmamış)
              </span>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className={cn(
                  "p-1 rounded hover:bg-gray-200 transition-colors",
                  pagination.page <= 1 && "opacity-50 cursor-not-allowed"
                )}
              >
                <Icon icon="solar:alt-arrow-left-bold" className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-600 px-2">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className={cn(
                  "p-1 rounded hover:bg-gray-200 transition-colors",
                  pagination.page >= pagination.totalPages && "opacity-50 cursor-not-allowed"
                )}
              >
                <Icon icon="solar:alt-arrow-right-bold" className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Auto-sync indicator & Refresh */}
          <div className="flex items-center gap-2">
            {/* Otomatik senkronizasyon göstergesi */}
            <div className="flex items-center gap-1 text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                isRefreshing ? "bg-green-500 animate-pulse" : "bg-gray-300"
              )} />
              <span className="text-[10px] font-medium">
                {isRefreshing ? 'Senkronize...' : 'Canlı'}
              </span>
            </div>

            {/* Manuel yenile butonu */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded hover:bg-gray-200 transition-colors"
              title="Manuel Yenile"
            >
              <Icon
                icon="solar:refresh-bold"
                className={cn("w-4 h-4 text-gray-600", (isLoading || isRefreshing) && "animate-spin")}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
