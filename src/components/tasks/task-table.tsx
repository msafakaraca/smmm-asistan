"use client";

import { memo, useCallback, useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { TaskRow } from "./task-row";
import type { TaskListItem, TaskStatus } from "@/types/task";

interface TaskTableProps {
  tasks: TaskListItem[];
  loading?: boolean;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onEdit: (task: TaskListItem) => void;
  onDelete: (task: TaskListItem) => void;
  onTaskClick: (task: TaskListItem) => void;
  onBulkDelete?: (taskIds: string[]) => void;
  bulkDeleting?: boolean;
  className?: string;
  userRole?: string;
}

// Tablo header'ları
const headers = [
  { key: "checkbox", label: "", width: "w-[40px]", sortable: false },
  { key: "task", label: "Görev", width: "w-[250px]", sortable: true },
  { key: "description", label: "Açıklama", width: "flex-1", sortable: false },
  { key: "assignee", label: "Atanan", width: "w-[200px]", sortable: true },
  { key: "priority", label: "Öncelik", width: "w-[120px]", sortable: true },
  { key: "status", label: "Durum", width: "w-[150px]", sortable: true },
  { key: "dueDate", label: "Bitiş Tarihi", width: "w-[160px]", sortable: true },
  { key: "actions", label: "", width: "w-[60px]", sortable: false },
];

// Loading skeleton
const TableSkeleton = memo(function TableSkeleton() {
  return (
    <tbody>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="border-b animate-pulse">
          <td className="px-4 py-3">
            <div className="h-4 w-4 bg-muted rounded" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-48 bg-muted rounded" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-32 bg-muted rounded" />
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-muted rounded-full" />
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-16 bg-muted rounded" />
          </td>
          <td className="px-4 py-3">
            <div className="h-6 w-20 bg-muted rounded" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-24 bg-muted rounded" />
          </td>
          <td className="px-4 py-3">
            <div className="h-5 w-5 bg-muted rounded" />
          </td>
        </tr>
      ))}
    </tbody>
  );
});

// Empty state
const EmptyState = memo(function EmptyState() {
  return (
    <tbody>
      <tr>
        <td colSpan={8} className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Icon
              icon="solar:clipboard-list-bold-duotone"
              className="h-16 w-16 text-muted-foreground/50 mb-4"
            />
            <h3 className="text-lg font-medium text-muted-foreground">
              Görev bulunamadı
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Yeni bir görev oluşturmak için &quot;Görev Oluştur&quot; butonuna tıklayın.
            </p>
          </div>
        </td>
      </tr>
    </tbody>
  );
});

export const TaskTable = memo(function TaskTable({
  tasks,
  loading = false,
  onStatusChange,
  onEdit,
  onDelete,
  onTaskClick,
  onBulkDelete,
  bulkDeleting = false,
  className,
  userRole = "user",
}: TaskTableProps) {
  const canEdit = userRole === "owner" || userRole === "admin";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Tümünü seç/bırak
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(tasks.map((t) => t.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [tasks]
  );

  // Tekli seçim
  const handleSelect = useCallback((taskId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  }, []);

  // Toplu silme
  const handleBulkDelete = useCallback(() => {
    if (onBulkDelete && selectedIds.size > 0 && !bulkDeleting) {
      onBulkDelete(Array.from(selectedIds));
      // Seçimi temizle - optimistic update sonrası görevler listeden kaldırılacak
      setSelectedIds(new Set());
    }
  }, [selectedIds, onBulkDelete, bulkDeleting]);

  const allSelected = tasks.length > 0 && selectedIds.size === tasks.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < tasks.length;

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      {/* Bulk Actions Bar */}
      {(selectedIds.size > 0 || bulkDeleting) && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
          <span className="text-sm font-medium">
            {bulkDeleting ? (
              <span className="flex items-center gap-2">
                <Icon icon="svg-spinners:ring-resize" className="h-4 w-4" />
                Siliniyor...
              </span>
            ) : (
              `${selectedIds.size} görev seçildi`
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkDeleting}
            >
              Seçimi Temizle
            </Button>
            {canEdit && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="gap-1"
              >
                {bulkDeleting ? (
                  <Icon icon="svg-spinners:ring-resize" className="h-4 w-4" />
                ) : (
                  <Icon icon="solar:trash-bin-trash-bold" className="h-4 w-4" />
                )}
                {bulkDeleting ? "Siliniyor..." : "Sil"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/30">
              {/* Checkbox Header */}
              <th className="w-[40px] px-4 py-3 text-left">
                <Checkbox
                  checked={allSelected || (someSelected ? "indeterminate" : false)}
                  onCheckedChange={handleSelectAll}
                />
              </th>

              {/* Other Headers */}
              {headers.slice(1).map((header) => (
                <th
                  key={header.key}
                  className={cn(
                    "px-4 py-3 text-left text-sm font-medium text-muted-foreground",
                    header.width
                  )}
                >
                  {header.label && (
                    <div className="flex items-center gap-1">
                      {header.label}
                      {header.sortable && (
                        <Icon
                          icon="solar:sort-vertical-line-duotone"
                          className="h-4 w-4 opacity-50"
                        />
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {loading ? (
            <TableSkeleton />
          ) : tasks.length === 0 ? (
            <EmptyState />
          ) : (
            <tbody>
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isSelected={selectedIds.has(task.id)}
                  onSelect={handleSelect}
                  onStatusChange={onStatusChange}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onClick={onTaskClick}
                  userRole={userRole}
                />
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
});
