"use client";

import { Icon as IconifyIcon } from "@iconify/react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon | string; // LucideIcon veya iconify string
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        {typeof icon === "string" ? (
          <IconifyIcon icon={icon} className="h-8 w-8 text-muted-foreground" />
        ) : (
          (() => {
            const LucideIconComponent = icon;
            return <LucideIconComponent className="h-8 w-8 text-muted-foreground" />;
          })()
        )}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
