"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@iconify/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EmailDetail as EmailDetailType } from "./hooks/use-email-detail";

interface EmailDetailProps {
  email: EmailDetailType | null;
  isLoading: boolean;
  onToggleStarred: () => void;
}

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "solar:gallery-bold";
  if (mimeType.includes("pdf")) return "solar:document-bold";
  if (mimeType.includes("word") || mimeType.includes("document")) return "solar:document-text-bold";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "solar:chart-square-bold";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("archive")) return "solar:archive-bold";
  return "solar:file-bold";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const EmailDetailComponent = React.memo(function EmailDetailComponent({
  email,
  isLoading,
  onToggleStarred,
}: EmailDetailProps) {
  // Sanitize HTML content (client-side only)
  const [sanitizedHtml, setSanitizedHtml] = useState<string | null>(null);

  // Cevapla butonu handler - yeni sekmede mail modülüne yönlendir
  const handleReply = (mode: "yeniMesaj" | "mukellef" | "banka") => {
    if (!email) return;
    const replyTo = encodeURIComponent(email.fromEmail);
    const subject = encodeURIComponent(`RE: ${email.subject || ""}`);
    // Yeni sekmede aç:
    // - yeniMesaj: pop-up açılır
    // - mukellef: mükellefler modunda açılır
    // - banka: banka modunda açılır
    window.open(`/dashboard/mail?mode=${mode}&replyTo=${replyTo}&subject=${subject}`, '_blank');
  };

  useEffect(() => {
    if (!email?.bodyHtml) {
      setSanitizedHtml(null);
      return;
    }

    // Dynamic import DOMPurify for client-side only
    import("dompurify").then((DOMPurify) => {
      const clean = DOMPurify.default.sanitize(email.bodyHtml!, {
        ALLOWED_TAGS: [
          "p",
          "br",
          "b",
          "i",
          "u",
          "strong",
          "em",
          "a",
          "ul",
          "ol",
          "li",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "blockquote",
          "pre",
          "code",
          "div",
          "span",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
          "img",
        ],
        ALLOWED_ATTR: ["href", "src", "alt", "style", "class", "target"],
        ALLOW_DATA_ATTR: false,
      });
      setSanitizedHtml(clean);
    });
  }, [email?.bodyHtml]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <Icon icon="solar:letter-opened-bold-duotone" className="w-16 h-16 mb-3 opacity-30" />
        <p className="text-sm font-medium">E-posta seçin</p>
        <p className="text-xs mt-1">Sol panelden bir e-posta seçerek içeriğini görüntüleyin</p>
      </div>
    );
  }

  const senderName = email.fromName || email.fromEmail.split("@")[0];
  const initials = getInitials(senderName);

  return (
    <div className="flex flex-col h-full">
      {/* Header - Meta bilgileri */}
      <div className="p-4 border-b border-gray-200 shrink-0 bg-white">
        {/* From & Actions */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm">
              {initials}
            </div>
            <div>
              <div className="font-medium text-gray-900">{senderName}</div>
              <div className="text-xs text-gray-500">{email.fromEmail}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Cevapla Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Icon icon="solar:reply-bold" className="w-4 h-4" />
                  Cevapla
                  <Icon icon="solar:alt-arrow-down-linear" className="w-3 h-3 ml-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => handleReply("yeniMesaj")}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Icon icon="solar:pen-new-square-bold" className="w-4 h-4 text-purple-600" />
                  <span>Yeni Mesaj</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleReply("mukellef")}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Icon icon="solar:users-group-rounded-bold" className="w-4 h-4 text-blue-600" />
                  <span>Mükellefler</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleReply("banka")}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Icon icon="solar:buildings-2-bold" className="w-4 h-4 text-emerald-600" />
                  <span>Banka</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={onToggleStarred}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                email.isStarred
                  ? "text-yellow-500 bg-yellow-50 hover:bg-yellow-100"
                  : "text-gray-400 hover:bg-gray-100"
              )}
              title={email.isStarred ? "Yıldızı kaldır" : "Yıldızla"}
            >
              <Icon
                icon={email.isStarred ? "solar:star-bold" : "solar:star-line-duotone"}
                className="w-5 h-5"
              />
            </button>
            <span className="text-xs text-gray-400">{formatFullDate(email.receivedAt)}</span>
          </div>
        </div>

        {/* Subject */}
        <h1 className="text-lg font-semibold text-gray-900 mb-2">{email.subject}</h1>

        {/* Recipients */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span className="font-medium text-gray-600">Alıcı:</span>
            {email.toEmails.join(", ") || "-"}
          </div>
          {email.ccEmails.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="font-medium text-gray-600">CC:</span>
              {email.ccEmails.join(", ")}
            </div>
          )}
        </div>

        {/* Customer Link */}
        {email.customer && (
          <div className="mt-2 flex items-center gap-1">
            <Icon icon="solar:user-check-bold" className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs text-gray-500">Mükellef:</span>
            <span className="text-xs font-medium text-blue-600">
              {email.customer.kisaltma || email.customer.unvan}
            </span>
          </div>
        )}

        {/* Provider */}
        <div className="mt-2 flex items-center gap-1.5">
          <Icon
            icon={email.provider === "gmail" ? "logos:google-gmail" : "logos:microsoft-icon"}
            className="w-3.5 h-3.5"
          />
          <span className="text-xs text-gray-400">{email.connection.email}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-white">
        {sanitizedHtml ? (
          <div
            className="prose prose-sm max-w-none prose-a:text-blue-600 prose-img:max-w-full break-words [word-break:break-word] [overflow-wrap:anywhere]"
            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        ) : email.bodyText ? (
          <div className="whitespace-pre-wrap text-sm text-gray-700 break-words [word-break:break-word]">{email.bodyText}</div>
        ) : (
          <div className="text-sm text-gray-400 italic">E-posta içeriği yok</div>
        )}
      </div>

      {/* Attachments */}
      {email.hasAttachments && email.attachments && email.attachments.length > 0 && (
        <div className="p-4 border-t border-gray-200 shrink-0 bg-gray-50">
          <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <Icon icon="solar:paperclip-bold" className="w-3.5 h-3.5" />
            Ekler ({email.attachments.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {email.attachments.map((attachment, idx) => (
              <div
                key={idx}
                className="group flex items-center gap-2 pl-3 pr-2 py-2 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
              >
                <Icon
                  icon={getFileIcon(attachment.mimeType)}
                  className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-gray-700 truncate max-w-[180px]" title={attachment.name}>
                    {attachment.name}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {formatFileSize(attachment.size)}
                  </span>
                </div>
                <a
                  href={`/api/email/messages/${email.id}/attachments/${attachment.id}`}
                  download={attachment.name}
                  className="ml-1 p-1.5 rounded-md hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
                  title="İndir"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Icon icon="solar:download-bold" className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
