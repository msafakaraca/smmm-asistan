"use client";

import { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskForm } from "../forms/task-form";
import type { CreateTaskInput, TaskUser } from "@/types/task";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: TaskUser[];
  onSubmit: (data: CreateTaskInput) => Promise<void>;
  loading?: boolean;
}

export const CreateTaskDialog = memo(function CreateTaskDialog({
  open,
  onOpenChange,
  users,
  onSubmit,
  loading = false,
}: CreateTaskDialogProps) {
  const handleSubmit = async (data: CreateTaskInput) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Yeni Görev Oluştur</DialogTitle>
        </DialogHeader>
        <TaskForm
          users={users}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          loading={loading}
          isEdit={false}
        />
      </DialogContent>
    </Dialog>
  );
});
