"use client";

import { memo } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/types/task";
import { PRIORITY_CONFIG } from "@/types/task";

interface PriorityBadgeProps {
  priority: TaskPriority;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export const PriorityBadge = memo(function PriorityBadge({
  priority,
  showLabel = true,
  size = "md",
  className,
}: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap",
        size === "sm" ? "text-xs" : "text-sm",
        className
      )}
    >
      <Icon
        icon="solar:flag-bold"
        className={cn(
          size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
        )}
        style={{ color: config.iconColor }}
      />
      {showLabel && (
        <span className={cn(config.textClass, "font-medium")}>
          {config.labelTr}
        </span>
      )}
    </div>
  );
});

// Priority select option için
export const PriorityOption = memo(function PriorityOption({
  priority,
}: {
  priority: TaskPriority;
}) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <div className="flex items-center gap-2">
      <Icon
        icon="solar:flag-bold"
        className="h-4 w-4"
        style={{ color: config.iconColor }}
      />
      <span>{config.labelTr}</span>
    </div>
  );
});
