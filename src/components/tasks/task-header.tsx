"use client";

import { memo } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { TaskFilterStatus, TaskStats } from "@/types/task";

interface TaskHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  activeTab: TaskFilterStatus;
  onTabChange: (tab: TaskFilterStatus) => void;
  stats: TaskStats;
  onCreateClick: () => void;
  className?: string;
  userRole?: string;
}

interface TabItem {
  key: TaskFilterStatus;
  label: string;
  getCount: (stats: TaskStats) => number;
}

const tabs: TabItem[] = [
  { key: "todo", label: "Yapılacak", getCount: (s) => s.todoCount },
  { key: "in_progress", label: "Devam Ediyor", getCount: (s) => s.inProgressCount },
  { key: "overdue", label: "Gecikmiş", getCount: (s) => s.overdueTasks },
  { key: "completed", label: "Tamamlanan", getCount: (s) => s.completedTasks },
  { key: "all", label: "Tümü", getCount: (s) => s.totalTasks },
];

export const TaskHeader = memo(function TaskHeader({
  searchTerm,
  onSearchChange,
  activeTab,
  onTabChange,
  stats,
  onCreateClick,
  className,
  userRole = "user",
}: TaskHeaderProps) {
  const canCreate = userRole === "owner" || userRole === "admin";
  return (
    <div className={cn("space-y-4", className)}>
      {/* Top Row: Search + Tabs + Create Button */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-auto">
          <Icon
            icon="solar:magnifer-line-duotone"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          />
          <Input
            placeholder="Ara..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 w-full sm:w-[200px]"
          />
        </div>

        {/* View Toggle (placeholder - sadece list view aktif) */}
        <div className="hidden sm:flex items-center border rounded-md">
          <button
            className={cn(
              "p-2 rounded-l-md",
              "bg-accent text-accent-foreground"
            )}
          >
            <Icon icon="solar:list-bold" className="h-4 w-4" />
          </button>
          <button
            className={cn(
              "p-2 rounded-r-md",
              "hover:bg-accent/50 text-muted-foreground"
            )}
            disabled
            title="Kanban görünümü yakında"
          >
            <Icon icon="solar:widget-2-bold" className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 overflow-x-auto">
          {tabs.map((tab) => {
            const count = tab.getCount(stats);
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-xs",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Create Button - sadece owner/admin için */}
        {canCreate && (
          <Button onClick={onCreateClick} className="gap-2">
            <Icon icon="solar:add-circle-bold" className="h-4 w-4" />
            Görev Oluştur
          </Button>
        )}
      </div>
    </div>
  );
});
