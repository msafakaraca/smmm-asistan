"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label?: string;
  };
  loading?: boolean;
  className?: string;
  valueClassName?: string;
  iconClassName?: string;
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  loading = false,
  className,
  valueClassName,
  iconClassName,
}: StatsCardProps) {
  if (loading) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </Card>
    );
  }

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <ArrowUp className="h-3 w-3" />;
    if (trend.value < 0) return <ArrowDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (!trend) return "";
    if (trend.value > 0) return "text-emerald-600 dark:text-emerald-400";
    if (trend.value < 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">{title}</p>
          <div className="flex items-center gap-2">
            <span className={cn("text-2xl font-bold", valueClassName)}>
              {value}
            </span>
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
                  getTrendColor(),
                  trend.value > 0 && "bg-emerald-100 dark:bg-emerald-900/30",
                  trend.value < 0 && "bg-red-100 dark:bg-red-900/30",
                  trend.value === 0 && "bg-muted"
                )}
              >
                {getTrendIcon()}
                {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0",
              iconClassName
            )}
          >
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
      </div>
    </Card>
  );
}
