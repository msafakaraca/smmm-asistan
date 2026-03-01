"use client";

import { memo, useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskStatus } from "@/types/task";
import { STATUS_CONFIG, OVERDUE_CONFIG } from "@/types/task";

interface StatusDropdownProps {
  status: TaskStatus;
  isOverdue?: boolean;
  onStatusChange: (status: TaskStatus) => void;
  disabled?: boolean;
  className?: string;
}

export const StatusDropdown = memo(function StatusDropdown({
  status,
  isOverdue = false,
  onStatusChange,
  disabled = false,
  className,
}: StatusDropdownProps) {
  const [open, setOpen] = useState(false);

  // Overdue ise kırmızı göster
  const displayConfig = isOverdue && status !== "completed"
    ? OVERDUE_CONFIG
    : STATUS_CONFIG[status];

  const displayLabel = isOverdue && status !== "completed"
    ? OVERDUE_CONFIG.labelTr
    : STATUS_CONFIG[status].labelTr;

  const handleSelect = (newStatus: TaskStatus) => {
    if (newStatus !== status) {
      onStatusChange(newStatus);
    }
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
            displayConfig.bgClass,
            displayConfig.textClass,
            "hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-1",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <span>{displayLabel}</span>
          <Icon icon="solar:alt-arrow-down-line-duotone" className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[120px]">
        {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((statusKey) => {
          const config = STATUS_CONFIG[statusKey];
          const isSelected = statusKey === status;

          return (
            <DropdownMenuItem
              key={statusKey}
              onClick={() => handleSelect(statusKey)}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                isSelected && "bg-accent"
              )}
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  config.bgClass,
                  config.borderClass,
                  "border"
                )}
              />
              <span>{config.labelTr}</span>
              {isSelected && (
                <Icon icon="solar:check-circle-bold" className="h-4 w-4 ml-auto text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

// Status badge (read-only)
export const StatusBadge = memo(function StatusBadge({
  status,
  isOverdue = false,
  className,
}: {
  status: TaskStatus;
  isOverdue?: boolean;
  className?: string;
}) {
  const displayConfig = isOverdue && status !== "completed"
    ? OVERDUE_CONFIG
    : STATUS_CONFIG[status];

  const displayLabel = isOverdue && status !== "completed"
    ? OVERDUE_CONFIG.labelTr
    : STATUS_CONFIG[status].labelTr;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
        displayConfig.bgClass,
        displayConfig.textClass,
        className
      )}
    >
      {displayLabel}
    </span>
  );
});
