"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@iconify/react";
import type { EmailListItem } from "./hooks/use-inbox-emails";

interface EmailListItemProps {
  email: EmailListItem;
  isSelected: boolean;
  onClick: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isThisYear = date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (isThisYear) {
    return date.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "short",
    });
  }

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export const EmailListItemComponent = React.memo(function EmailListItemComponent({
  email,
  isSelected,
  onClick,
}: EmailListItemProps) {
  const senderName = email.fromName || email.fromEmail.split("@")[0];
  const isUnread = !email.isRead;

  // Truncate helper
  const truncateText = (text: string, maxLength: number) => {
    if (!text) return "";
    return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "px-3 py-2.5 cursor-pointer transition-colors border-b border-gray-100 overflow-hidden",
        isSelected
          ? "bg-blue-50 border-l-2 border-l-blue-500"
          : isUnread
          ? "bg-white hover:bg-gray-50"
          : "bg-gray-50/50 hover:bg-gray-100"
      )}
    >
      {/* Top Row: Sender & Date */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div
          className={cn(
            "flex-1 min-w-0 text-sm truncate",
            isUnread ? "font-semibold text-gray-900" : "font-normal text-gray-700"
          )}
        >
          {truncateText(senderName, 30)}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {email.hasAttachments && (
            <Icon icon="solar:paperclip-bold" className="w-3.5 h-3.5 text-gray-400" />
          )}
          {email.customer && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-medium max-w-[80px] truncate">
              {email.customer.kisaltma || email.customer.unvan.slice(0, 8)}
            </span>
          )}
          <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(email.receivedAt)}</span>
        </div>
      </div>

      {/* Subject */}
      <div
        className={cn(
          "text-sm mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap",
          isUnread ? "font-medium text-gray-800" : "font-normal text-gray-600"
        )}
      >
        {truncateText(email.subject || "(Konu yok)", 60)}
      </div>

      {/* Snippet - max 80 karakter */}
      <div className="text-xs text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap">
        {truncateText(email.snippet || "", 80)}
      </div>

      {/* Provider Badge */}
      <div className="flex items-center gap-1 mt-1.5 overflow-hidden">
        <Icon
          icon={email.provider === "gmail" ? "logos:google-gmail" : "logos:microsoft-icon"}
          className="w-3 h-3 shrink-0"
        />
        <span className="text-[10px] text-gray-400 truncate max-w-[200px]">
          {email.connection.email}
        </span>
      </div>
    </div>
  );
});
