"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { PriorityBadge } from "../priority-badge";
import { StatusBadge } from "../status-dropdown";
import { AssigneeAvatars } from "../assignee-avatars";
import type { Task, TaskComment, CreateTaskInput, TaskUser } from "@/types/task";
import { TaskForm } from "../forms/task-form";

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: TaskUser[];
  onUpdate: (taskId: string, data: CreateTaskInput) => Promise<void>;
  onAddComment: (taskId: string, content: string) => Promise<void>;
  onUploadFile: (taskId: string, file: File) => Promise<void>;
  onDeleteFile: (taskId: string, attachmentId: string) => Promise<void>;
  loading?: boolean;
  userRole?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getColorFromName(name: string): string {
  const colors = [
    "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-green-500",
    "bg-teal-500", "bg-cyan-500", "bg-blue-500", "bg-indigo-500",
    "bg-violet-500", "bg-purple-500", "bg-pink-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // Temel tarih formatı (kısa ay)
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

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Comment Item
const CommentItem = memo(function CommentItem({
  comment,
}: {
  comment: TaskComment;
}) {
  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8">
        {comment.user.image && (
          <AvatarImage src={comment.user.image} alt={comment.user.name} />
        )}
        <AvatarFallback
          className={cn(getColorFromName(comment.user.name), "text-white text-xs")}
        >
          {getInitials(comment.user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{comment.user.name}</span>
          <span className="text-xs text-muted-foreground">
            {formatDateTime(comment.createdAt)}
          </span>
        </div>
        <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
      </div>
    </div>
  );
});

export const TaskDetailDialog = memo(function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  users,
  onUpdate,
  onAddComment,
  onUploadFile,
  onDeleteFile,
  loading = false,
  userRole = "user",
}: TaskDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const canEdit = userRole === "owner" || userRole === "admin";

  // Dialog kapanınca edit modunu kapat
  useEffect(() => {
    if (!open) {
      setIsEditing(false);
      setNewComment("");
    }
  }, [open]);

  const handleUpdate = useCallback(
    async (data: CreateTaskInput) => {
      if (!task) return;
      await onUpdate(task.id, data);
      setIsEditing(false);
    },
    [task, onUpdate]
  );

  const handleAddComment = useCallback(async () => {
    if (!task || !newComment.trim()) return;

    setSubmittingComment(true);
    try {
      await onAddComment(task.id, newComment.trim());
      setNewComment("");
      toast.success("Yorum eklendi");
    } catch {
      toast.error("Yorum eklenemedi");
    } finally {
      setSubmittingComment(false);
    }
  }, [task, newComment, onAddComment]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!task || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Dosya boyutu 10MB'dan büyük olamaz");
      return;
    }

    setUploadingFile(true);
    try {
      await onUploadFile(task.id, file);
      toast.success("Dosya yüklendi");
      // Input'u temizle
      e.target.value = "";
    } catch {
      toast.error("Dosya yüklenemedi");
    } finally {
      setUploadingFile(false);
    }
  }, [task, onUploadFile]);

  const handleDeleteFile = useCallback(async (attachmentId: string) => {
    if (!task) return;

    try {
      await onDeleteFile(task.id, attachmentId);
      toast.success("Dosya silindi");
    } catch {
      toast.error("Dosya silinemedi");
    }
  }, [task, onDeleteFile]);

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[650px] sm:max-w-[650px] max-h-[90vh] overflow-hidden border-2 shadow-2xl p-0">
        <div className="p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="pr-4">
                {isEditing ? "Görevi Düzenle" : task.title}
              </DialogTitle>
              {!isEditing && canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="gap-1 mr-2"
                >
                  <Icon icon="solar:pen-bold" className="h-4 w-4" />
                  Düzenle
                </Button>
              )}
            </div>
          </DialogHeader>

          {isEditing ? (
            <TaskForm
              initialData={task}
              users={users}
              onSubmit={handleUpdate}
              onCancel={() => setIsEditing(false)}
              loading={loading}
              isEdit
            />
          ) : (
            <div className="space-y-4 mt-4">
            {/* Status & Priority Card */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Durum:</span>
                  <StatusBadge status={task.status} isOverdue={task.isOverdue} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Öncelik:</span>
                  <PriorityBadge priority={task.priority} />
                </div>
              </div>
            </div>

            {/* Description Card */}
            {task.description && (
              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Icon icon="solar:document-text-bold" className="h-4 w-4 text-muted-foreground" />
                  Açıklama
                </h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded-md p-3">
                  {task.description}
                </p>
              </div>
            )}

            {/* Details Grid Card */}
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Icon icon="solar:calendar-bold" className="h-4 w-4 text-muted-foreground" />
                Tarih Bilgileri
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-md bg-muted/50 p-3">
                  <span className="text-xs text-muted-foreground block mb-1">Bitiş Tarihi</span>
                  <p className={cn("font-medium", task.isOverdue && "text-red-600")}>
                    {formatDate(task.dueDate)}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <span className="text-xs text-muted-foreground block mb-1">Oluşturan</span>
                  <p className="font-medium">{task.createdBy?.name || "Bilinmiyor"}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <span className="text-xs text-muted-foreground block mb-1">Oluşturulma</span>
                  <p className="font-medium text-xs">{formatDateTime(task.createdAt)}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <span className="text-xs text-muted-foreground block mb-1">Güncelleme</span>
                  <p className="font-medium text-xs">{formatDateTime(task.updatedAt)}</p>
                </div>
              </div>
            </div>

            {/* Assignees Card */}
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Icon icon="solar:users-group-rounded-bold" className="h-4 w-4 text-muted-foreground" />
                Atananlar
              </h4>
              <div className="bg-muted/50 rounded-md p-3">
                {task.assignees && task.assignees.length > 0 ? (
                  <AssigneeAvatars assignees={task.assignees} maxDisplay={5} />
                ) : (
                  <span className="text-sm text-muted-foreground">Atanmamış</span>
                )}
              </div>
            </div>

            {/* Attachments Card */}
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Icon icon="solar:folder-bold" className="h-4 w-4 text-muted-foreground" />
                Dosyalar ({task.attachments?.length || 0})
              </h4>

              {/* File Upload */}
              <div className="mb-3">
                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                  />
                  {uploadingFile ? (
                    <>
                      <Icon icon="svg-spinners:ring-resize" className="h-5 w-5 text-primary" />
                      <span className="text-sm text-muted-foreground">Yükleniyor...</span>
                    </>
                  ) : (
                    <>
                      <Icon icon="solar:upload-bold" className="h-5 w-5 text-primary" />
                      <span className="text-sm text-muted-foreground">Dosya yükle (max 10MB)</span>
                    </>
                  )}
                </label>
              </div>

              {/* File List */}
              <div className="space-y-2">
                {task.attachments && task.attachments.length > 0 ? (
                  task.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 p-2 rounded-md bg-muted/50 overflow-hidden"
                    >
                      <Icon icon="solar:file-bold" className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm truncate block hover:text-primary transition-colors max-w-[calc(100%-2rem)]"
                          title={att.originalName}
                        >
                          {att.originalName}
                        </a>
                        <span className="text-xs text-muted-foreground">
                          {(att.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500 shrink-0 ml-auto"
                        onClick={() => handleDeleteFile(att.id)}
                      >
                        <Icon icon="solar:trash-bin-trash-bold" className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2 bg-muted/50 rounded-md">
                    Henüz dosya yok
                  </p>
                )}
              </div>
            </div>

            {/* Comments Section Card */}
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Icon icon="solar:chat-round-dots-bold" className="h-4 w-4 text-muted-foreground" />
                Yorumlar ({task.comments?.length || 0})
              </h4>

              {/* Comment Input */}
              <div className="flex gap-2 mb-4">
                <Textarea
                  placeholder="Yorum yazın..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  className="flex-1 bg-muted/50"
                  disabled={submittingComment}
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || submittingComment}
                  className="self-end"
                >
                  {submittingComment ? (
                    <Icon icon="svg-spinners:ring-resize" className="h-4 w-4" />
                  ) : (
                    <Icon icon="solar:plain-bold" className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Comments List */}
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {task.comments && task.comments.length > 0 ? (
                  task.comments.map((comment) => (
                    <div key={comment.id} className="bg-muted/50 rounded-md p-3">
                      <CommentItem comment={comment} />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4 bg-muted/50 rounded-md">
                    Henüz yorum yok
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
