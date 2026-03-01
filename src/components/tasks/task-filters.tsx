"use client";

import { memo } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskPriority, TaskUser } from "@/types/task";
import { PRIORITY_CONFIG } from "@/types/task";

interface TaskFiltersProps {
  priorityFilter: TaskPriority | "all";
  onPriorityChange: (value: TaskPriority | "all") => void;
  assigneeFilter: string;
  onAssigneeChange: (value: string) => void;
  users: TaskUser[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  className?: string;
}

export const TaskFilters = memo(function TaskFilters({
  priorityFilter,
  onPriorityChange,
  assigneeFilter,
  onAssigneeChange,
  users,
  onClearFilters,
  hasActiveFilters,
  className,
}: TaskFiltersProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {/* Assignee Filter */}
      <Select value={assigneeFilter} onValueChange={onAssigneeChange}>
        <SelectTrigger className="w-[160px] h-9">
          <div className="flex items-center gap-2">
            <Icon icon="solar:user-bold" className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Atanan" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tümü</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Priority Filter */}
      <Select
        value={priorityFilter}
        onValueChange={(v) => onPriorityChange(v as TaskPriority | "all")}
      >
        <SelectTrigger className="w-[140px] h-9">
          <div className="flex items-center gap-2">
            <Icon icon="solar:flag-bold" className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Öncelik" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tümü</SelectItem>
          {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((priority) => (
            <SelectItem key={priority} value={priority}>
              <div className="flex items-center gap-2">
                <Icon
                  icon="solar:flag-bold"
                  className="h-4 w-4"
                  style={{ color: PRIORITY_CONFIG[priority].iconColor }}
                />
                {PRIORITY_CONFIG[priority].labelTr}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filter Button (placeholder for advanced filters) */}
      <Button variant="outline" size="sm" className="gap-2 h-9">
        <Icon icon="solar:filter-bold" className="h-4 w-4" />
        Filtrele
      </Button>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="gap-1 h-9 text-muted-foreground"
        >
          <Icon icon="solar:close-circle-bold" className="h-4 w-4" />
          Temizle
        </Button>
      )}
    </div>
  );
});
