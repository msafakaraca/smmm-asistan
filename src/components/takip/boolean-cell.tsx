"use client";

import { memo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Custom SVG icons for boolean cell states
const CheckIcon = ({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const XIcon = ({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const CircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="4"/>
  </svg>
);

// Metadata interface for tracking who modified the cell
interface CellMetadata {
  modifiedBy?: string;
  modifiedByName?: string;
  modifiedAt?: string;
}

interface BooleanCellProps {
  value: boolean | null;
  onClick: () => void;
  isCompleted?: boolean;
  metadata?: CellMetadata;
}

/**
 * Boolean cycle: null (●) → true (✓) → false (✗) → null
 */
export function cycleBoolean(current: boolean | null): boolean | null {
  if (current === null) return true;
  if (current === true) return false;
  return null;
}

// Format date for display
function formatDate(dateString?: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// Durum bilgisi
function getStatusInfo(value: boolean | null) {
  if (value === true) {
    return {
      label: "Tamam",
      bgClass: "bg-green-500 dark:bg-green-600",
      textClass: "text-white",
      Icon: CheckIcon,
    };
  }
  if (value === false) {
    return {
      label: "İptal (Yapılmayacak)",
      bgClass: "bg-amber-500 dark:bg-amber-600",
      textClass: "text-white",
      Icon: XIcon,
    };
  }
  return {
    label: "Bekliyor",
    bgClass: "bg-slate-400 dark:bg-slate-500",
    textClass: "text-white",
    Icon: CircleIcon,
  };
}

export const BooleanCell = memo(function BooleanCell({
  value,
  onClick,
  isCompleted = false,
  metadata,
}: BooleanCellProps) {
  const hasMetadata = metadata?.modifiedByName && metadata?.modifiedAt;
  const statusInfo = getStatusInfo(value);

  const cellContent = (
    <td
      className={cn(
        "border-x border-slate-300 dark:border-slate-600 p-1 text-center cursor-pointer select-none transition-colors duration-200",
        "hover:bg-indigo-50 dark:hover:bg-indigo-900/30",
        isCompleted && "bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30"
      )}
      onClick={onClick}
    >
      {value === true && (
        <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-500 mx-auto" strokeWidth={3} />
      )}
      {value === false && (
        <XIcon className="w-4 h-4 text-red-600 dark:text-red-400 mx-auto" strokeWidth={3} />
      )}
      {value === null && (
        <CircleIcon className="w-2 h-2 text-slate-400 dark:text-slate-500 mx-auto" />
      )}
    </td>
  );

  // If no metadata, return cell without tooltip
  if (!hasMetadata) {
    return cellContent;
  }

  // With metadata, wrap in tooltip
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{cellContent}</TooltipTrigger>
        <TooltipContent
          side="top"
          className={cn(
            "text-xs border-0 shadow-lg",
            statusInfo.bgClass,
            statusInfo.textClass
          )}
        >
          <div className="space-y-1 py-0.5">
            {/* Durum satırı */}
            <div className="flex items-center gap-1.5 font-semibold">
              {value === null ? (
                <CircleIcon className="w-2.5 h-2.5" />
              ) : (
                <statusInfo.Icon className="w-3.5 h-3.5" strokeWidth={3} />
              )}
              <span>{statusInfo.label}</span>
            </div>
            {/* Kullanıcı ve tarih */}
            <div className="flex items-center gap-1.5 opacity-90">
              <span>{metadata.modifiedByName}</span>
              <span>•</span>
              <span>{formatDate(metadata.modifiedAt)}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
