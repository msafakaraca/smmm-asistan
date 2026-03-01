"use client";

import { memo } from "react";
import { Icon } from "@iconify/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { TaskListItem } from "@/types/task";

interface DeleteTaskDialogProps {
  task: TaskListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  loading?: boolean;
}

export const DeleteTaskDialog = memo(function DeleteTaskDialog({
  task,
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: DeleteTaskDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  if (!task) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon icon="solar:trash-bin-trash-bold" className="h-5 w-5 text-red-500" />
            Görevi Sil
          </AlertDialogTitle>
          <AlertDialogDescription>
            <strong>&quot;{task.title}&quot;</strong> görevini silmek istediğinize emin misiniz?
            <br />
            <br />
            Bu işlem geri alınamaz. Göreve ait tüm yorumlar ve dosyalar da silinecektir.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>İptal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600"
          >
            {loading ? (
              <>
                <Icon icon="svg-spinners:ring-resize" className="h-4 w-4 mr-2" />
                Siliniyor...
              </>
            ) : (
              "Evet, Sil"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});
