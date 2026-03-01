"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Icon } from "@iconify/react";
import { toast } from "@/components/ui/sonner";
import { TaskHeader } from "./task-header";
import { TaskStatsDisplay } from "./task-stats";
import { TaskFilters } from "./task-filters";
import { TaskTable } from "./task-table";
import { CreateTaskDialog } from "./dialogs/create-task-dialog";
import { TaskDetailDialog } from "./dialogs/task-detail-dialog";
import { DeleteTaskDialog } from "./dialogs/delete-task-dialog";
import type {
  TaskListItem,
  Task,
  TaskStats,
  TaskFilterStatus,
  TaskPriority,
  TaskStatus,
  TaskUser,
  CreateTaskInput,
} from "@/types/task";

// Initial stats
const initialStats: TaskStats = {
  lowPriority: 0,
  mediumPriority: 0,
  highPriority: 0,
  totalTasks: 0,
  completedTasks: 0,
  overdueTasks: 0,
  todoCount: 0,
  inProgressCount: 0,
};

interface TasksPageProps {
  userRole?: string;
}

export function TasksPage({ userRole = "user" }: TasksPageProps) {
  // Data state
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [stats, setStats] = useState<TaskStats>(initialStats);
  const [users, setUsers] = useState<TaskUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<TaskFilterStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskListItem | null>(null);
  const [taskDetail, setTaskDetail] = useState<Task | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== "all") params.set("status", activeTab);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (assigneeFilter !== "all") params.set("assigneeId", assigneeFilter);
      if (searchTerm) params.set("search", searchTerm);

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error("Görevler yüklenemedi");

      const data = await res.json();
      setTasks(data.tasks);
    } catch (error) {
      console.error("Fetch tasks error:", error);
      toast.error("Görevler yüklenirken hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [activeTab, priorityFilter, assigneeFilter, searchTerm]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/tasks/stats");
      if (!res.ok) throw new Error("İstatistikler yüklenemedi");

      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Fetch stats error:", error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch users (for filters and assignee select)
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Kullanıcılar yüklenemedi");

      const data = await res.json();
      // API direkt array dönüyor, data.users değil
      const userList = Array.isArray(data) ? data : (data.users || []);
      setUsers(
        userList.map((u: { id: string; name: string; email: string; image?: string }) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          image: u.image,
        }))
      );
    } catch (error) {
      console.error("Fetch users error:", error);
    }
  }, []);

  // Fetch task detail
  const fetchTaskDetail = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error("Görev detayı yüklenemedi");

      const data = await res.json();
      setTaskDetail(data.task);
    } catch (error) {
      console.error("Fetch task detail error:", error);
      toast.error("Görev detayı yüklenemedi");
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [fetchUsers, fetchStats]);

  // Fetch tasks when filters change
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Handlers
  const handleCreateTask = useCallback(
    async (data: CreateTaskInput) => {
      setActionLoading(true);
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Görev oluşturulamadı");
        }

        toast.success("Görev oluşturuldu");
        fetchTasks();
        fetchStats();
      } catch (error) {
        console.error("Create task error:", error);
        toast.error(error instanceof Error ? error.message : "Görev oluşturulamadı");
        throw error;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchTasks, fetchStats]
  );

  const handleUpdateTask = useCallback(
    async (taskId: string, data: CreateTaskInput) => {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Görev güncellenemedi");
        }

        toast.success("Görev güncellendi");
        fetchTasks();
        fetchStats();
        // Detail'i güncelle
        await fetchTaskDetail(taskId);
      } catch (error) {
        console.error("Update task error:", error);
        toast.error(error instanceof Error ? error.message : "Görev güncellenemedi");
        throw error;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchTasks, fetchStats, fetchTaskDetail]
  );

  const handleStatusChange = useCallback(
    async (taskId: string, status: TaskStatus) => {
      // Önceki değeri sakla (rollback için)
      const previousTasks = tasks;
      const previousStats = stats;

      // Optimistic update - task
      const taskToUpdate = tasks.find(t => t.id === taskId);
      const oldStatus = taskToUpdate?.status;

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            const now = new Date();
            const isOverdue = status !== "completed" && t.dueDate != null && new Date(t.dueDate) < now;
            return { ...t, status, isOverdue };
          }
          return t;
        })
      );

      // Optimistic update - stats
      if (oldStatus && oldStatus !== status) {
        setStats((prev) => {
          const newStats = { ...prev };

          // Eski durumdan çıkar
          if (oldStatus === "todo") newStats.todoCount--;
          else if (oldStatus === "in_progress") newStats.inProgressCount--;
          else if (oldStatus === "completed") newStats.completedTasks--;

          // Yeni duruma ekle
          if (status === "todo") newStats.todoCount++;
          else if (status === "in_progress") newStats.inProgressCount++;
          else if (status === "completed") newStats.completedTasks++;

          return newStats;
        });
      }

      try {
        const res = await fetch(`/api/tasks/${taskId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });

        if (!res.ok) throw new Error("Durum güncellenemedi");

        // Başarılı - arka planda stats'ı senkronize et
        fetchStats();
      } catch (error) {
        console.error("Status change error:", error);
        toast.error("Durum güncellenemedi");
        // Rollback - önceki değerlere dön
        setTasks(previousTasks);
        setStats(previousStats);
      }
    },
    [tasks, stats, fetchStats]
  );

  const handleDeleteTask = useCallback(async () => {
    if (!selectedTask) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Görev silinemedi");
      }

      toast.success("Görev silindi");
      setSelectedTask(null);
      fetchTasks();
      fetchStats();
    } catch (error) {
      console.error("Delete task error:", error);
      toast.error(error instanceof Error ? error.message : "Görev silinemedi");
    } finally {
      setActionLoading(false);
    }
  }, [selectedTask, fetchTasks, fetchStats]);

  // Bulk delete state
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const handleBulkDelete = useCallback(
    async (taskIds: string[]) => {
      setBulkDeleting(true);

      // Optimistic update - seçili görevleri hemen listeden kaldır
      const previousTasks = tasks;
      setTasks((prev) => prev.filter((t) => !taskIds.includes(t.id)));

      try {
        const res = await fetch("/api/tasks/bulk-delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: taskIds }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Görevler silinemedi");
        }

        const data = await res.json();
        toast.success(`${data.count} görev silindi`);
        fetchStats();
      } catch (error) {
        console.error("Bulk delete error:", error);
        toast.error(error instanceof Error ? error.message : "Görevler silinemedi");
        // Rollback - önceki listeye dön
        setTasks(previousTasks);
      } finally {
        setBulkDeleting(false);
      }
    },
    [tasks, fetchStats]
  );

  const handleAddComment = useCallback(
    async (taskId: string, content: string) => {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error("Yorum eklenemedi");

      // Detail'i güncelle
      await fetchTaskDetail(taskId);
      // Liste'deki count'u güncelle
      fetchTasks();
    },
    [fetchTaskDetail, fetchTasks]
  );

  const handleUploadFile = useCallback(
    async (taskId: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Dosya yüklenemedi");
      }

      // Detail'i güncelle
      await fetchTaskDetail(taskId);
      // Liste'deki count'u güncelle
      fetchTasks();
    },
    [fetchTaskDetail, fetchTasks]
  );

  const handleDeleteFile = useCallback(
    async (taskId: string, attachmentId: string) => {
      const res = await fetch(`/api/tasks/${taskId}/attachments?attachmentId=${attachmentId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Dosya silinemedi");
      }

      // Detail'i güncelle
      await fetchTaskDetail(taskId);
      // Liste'deki count'u güncelle
      fetchTasks();
    },
    [fetchTaskDetail, fetchTasks]
  );

  const handleTaskClick = useCallback(
    (task: TaskListItem) => {
      setSelectedTask(task);
      fetchTaskDetail(task.id);
      setDetailDialogOpen(true);
    },
    [fetchTaskDetail]
  );

  const handleEditClick = useCallback(
    (task: TaskListItem) => {
      setSelectedTask(task);
      fetchTaskDetail(task.id);
      setDetailDialogOpen(true);
    },
    [fetchTaskDetail]
  );

  const handleDeleteClick = useCallback((task: TaskListItem) => {
    setSelectedTask(task);
    setDeleteDialogOpen(true);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setPriorityFilter("all");
    setAssigneeFilter("all");
    setActiveTab("all");
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      searchTerm !== "" ||
      priorityFilter !== "all" ||
      assigneeFilter !== "all" ||
      activeTab !== "all"
    );
  }, [searchTerm, priorityFilter, assigneeFilter, activeTab]);

  return (
    <div className="p-0">
      {/* Main Container - Çerçeve */}
      <div className="bg-card rounded-xl border shadow-sm">
        {/* Page Header */}
        <div className="flex items-center gap-3 px-4 xl:px-6 py-4 border-b">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon icon="solar:clipboard-list-bold-duotone" className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Görevler</h1>
        </div>

        {/* Content */}
        <div className="p-4 xl:p-6 space-y-4 xl:space-y-6">
          {/* Header: Search + Tabs + Create */}
          <TaskHeader
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            stats={stats}
            onCreateClick={() => setCreateDialogOpen(true)}
            userRole={userRole}
          />

          {/* Stats Cards */}
          <TaskStatsDisplay stats={stats} loading={statsLoading} />

          {/* Filters */}
          <TaskFilters
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
            assigneeFilter={assigneeFilter}
            onAssigneeChange={setAssigneeFilter}
            users={users}
            onClearFilters={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
          />

          {/* Table */}
          <TaskTable
            tasks={tasks}
            loading={loading}
            onStatusChange={handleStatusChange}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onTaskClick={handleTaskClick}
            onBulkDelete={handleBulkDelete}
            bulkDeleting={bulkDeleting}
            userRole={userRole}
          />

          {/* Dialogs */}
          <CreateTaskDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            users={users}
            onSubmit={handleCreateTask}
            loading={actionLoading}
          />

          <TaskDetailDialog
            task={taskDetail}
            open={detailDialogOpen}
            onOpenChange={setDetailDialogOpen}
            users={users}
            onUpdate={handleUpdateTask}
            onAddComment={handleAddComment}
            onUploadFile={handleUploadFile}
            onDeleteFile={handleDeleteFile}
            loading={actionLoading}
            userRole={userRole}
          />

          <DeleteTaskDialog
            task={selectedTask}
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onConfirm={handleDeleteTask}
            loading={actionLoading}
          />
        </div>
      </div>
    </div>
  );
}
