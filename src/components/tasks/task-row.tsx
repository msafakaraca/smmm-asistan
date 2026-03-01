"use client";

import { memo, useCallback } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PriorityBadge } from "./priority-badge";
import { StatusDropdown } from "./status-dropdown";
import { AssigneeAvatars } from "./assignee-avatars";
import type { TaskListItem, TaskStatus } from "@/types/task";

interface TaskRowProps {
  task: TaskListItem;
  isSelected: boolean;
  onSelect: (taskId: string, selected: boolean) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onEdit: (task: TaskListItem) => void;
  onDelete: (task: TaskListItem) => void;
  onClick: (task: TaskListItem) => void;
  userRole?: string;
}

// Tarih ve saat formatla
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // Temel tarih formatı
  const dateFormatted = date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Saat 00:00 değilse saati de göster
  if (hours !== 0 || minutes !== 0) {
    const timeFormatted = date.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateFormatted} ${timeFormatted}`;
  }

  return dateFormatted;
}

export const TaskRow = memo(
  function TaskRow({
    task,
    isSelected,
    onSelect,
    onStatusChange,
    onEdit,
    onDelete,
    onClick,
    userRole = "user",
  }: TaskRowProps) {
    const canEdit = userRole === "owner" || userRole === "admin";
    const handleCheckboxChange = useCallback(
      (checked: boolean) => {
        onSelect(task.id, checked);
      },
      [task.id, onSelect]
    );

    const handleStatusChange = useCallback(
      (status: TaskStatus) => {
        onStatusChange(task.id, status);
      },
      [task.id, onStatusChange]
    );

    const handleRowClick = useCallback(
      (e: React.MouseEvent) => {
        // Checkbox, dropdown veya butonlara tıklanmadıysa
        const target = e.target as HTMLElement;
        if (
          target.closest("button") ||
          target.closest('[role="checkbox"]') ||
          target.closest('[role="menu"]')
        ) {
          return;
        }
        onClick(task);
      },
      [task, onClick]
    );

    return (
      <tr
        className={cn(
          "border-b transition-colors hover:bg-muted/50",
          isSelected && "bg-muted/30",
          "cursor-pointer"
        )}
        onClick={handleRowClick}
      >
        {/* Checkbox */}
        <td className="w-[40px] px-4 py-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
          />
        </td>

        {/* Task Title + Comment/Attachment counts */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-medium text-sm">{task.title}</span>
            <div className="flex items-center gap-2 text-muted-foreground">
              {task._count.comments > 0 && (
                <div className="flex items-center gap-0.5 text-xs">
                  <Icon icon="solar:chat-round-dots-bold" className="h-3.5 w-3.5" />
                  <span>{task._count.comments}</span>
                </div>
              )}
              {task._count.attachments > 0 && (
                <div className="flex items-center gap-0.5 text-xs">
                  <Icon icon="solar:paperclip-bold" className="h-3.5 w-3.5" />
                  <span>{task._count.attachments}</span>
                </div>
              )}
            </div>
          </div>
        </td>

        {/* Description */}
        <td className="px-4 py-3 max-w-0">
          <span className="text-sm text-muted-foreground truncate block" title={task.description || ""}>
            {task.description || "-"}
          </span>
        </td>

        {/* Assigned To */}
        <td className="px-4 py-3">
          <AssigneeAvatars assignees={task.assignees} maxDisplay={2} size="sm" />
        </td>

        {/* Priority */}
        <td className="px-4 py-3">
          <PriorityBadge priority={task.priority} size="sm" />
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <StatusDropdown
            status={task.status}
            isOverdue={task.isOverdue}
            onStatusChange={handleStatusChange}
          />
        </td>

        {/* Due Date */}
        <td className="px-4 py-3 min-w-[150px]">
          <span
            className={cn(
              "text-sm whitespace-nowrap",
              task.isOverdue && "text-red-600 font-medium"
            )}
          >
            {formatDate(task.dueDate)}
          </span>
        </td>

        {/* Actions */}
        <td className="w-[60px] px-4 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 hover:bg-accent rounded-md">
                <Icon icon="solar:menu-dots-bold" className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onClick(task)}>
                <Icon icon="solar:eye-bold" className="h-4 w-4 mr-2" />
                Görüntüle
              </DropdownMenuItem>
              {canEdit && (
                <>
                  <DropdownMenuItem onClick={() => onEdit(task)}>
                    <Icon icon="solar:pen-bold" className="h-4 w-4 mr-2" />
                    Düzenle
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(task)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" className="h-4 w-4 mr-2" />
                    Sil
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>
    );
  },
  (prev, next) => {
    return (
      prev.task.id === next.task.id &&
      prev.task.status === next.task.status &&
      prev.task.priority === next.task.priority &&
      prev.task.description === next.task.description &&
      prev.task.isOverdue === next.task.isOverdue &&
      prev.task._count.comments === next.task._count.comments &&
      prev.task._count.attachments === next.task._count.attachments &&
      prev.isSelected === next.isSelected &&
      prev.task.assignees.length === next.task.assignees.length &&
      prev.userRole === next.userRole
    );
  }
);
