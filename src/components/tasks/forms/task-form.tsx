"use client";

import { memo, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerInput } from "@/components/ui/date-picker";
import { AssigneeMultiSelect } from "./assignee-multi-select";
import type {
  CreateTaskInput,
  TaskPriority,
  TaskStatus,
  TaskUser,
  Task,
} from "@/types/task";
import { PRIORITY_CONFIG, STATUS_CONFIG } from "@/types/task";

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00", "21:30", "22:00", "22:30",
  "23:00", "23:30",
];

interface TaskFormProps {
  initialData?: Partial<Task>;
  users: TaskUser[];
  onSubmit: (data: CreateTaskInput) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  isEdit?: boolean;
}

export const TaskForm = memo(function TaskForm({
  initialData,
  users,
  onSubmit,
  onCancel,
  loading = false,
  isEdit = false,
}: TaskFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [priority, setPriority] = useState<TaskPriority>(
    initialData?.priority || "medium"
  );
  const [status, setStatus] = useState<TaskStatus>(
    initialData?.status || "todo"
  );
  const [dueDate, setDueDate] = useState(
    initialData?.dueDate
      ? new Date(initialData.dueDate).toISOString().split("T")[0]
      : ""
  );
  const [dueTime, setDueTime] = useState(() => {
    if (initialData?.dueDate) {
      const date = new Date(initialData.dueDate);
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      // Sadece 00:00 değilse saat göster
      return hours !== "00" || minutes !== "00" ? `${hours}:${minutes}` : "";
    }
    return "";
  });
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    initialData?.assignees?.map((a) => a.userId) || []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // initialData değişince formu güncelle
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setPriority(initialData.priority || "medium");
      setStatus(initialData.status || "todo");
      setDueDate(
        initialData.dueDate
          ? new Date(initialData.dueDate).toISOString().split("T")[0]
          : ""
      );
      if (initialData.dueDate) {
        const date = new Date(initialData.dueDate);
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        setDueTime(hours !== "00" || minutes !== "00" ? `${hours}:${minutes}` : "");
      } else {
        setDueTime("");
      }
      setAssigneeIds(initialData.assignees?.map((a) => a.userId) || []);
    }
  }, [initialData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Görev başlığı zorunludur";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // Tarih ve saati birleştir
    let dueDateTimeStr: string | undefined;
    if (dueDate) {
      if (dueTime) {
        dueDateTimeStr = `${dueDate}T${dueTime}:00`;
      } else {
        dueDateTimeStr = dueDate;
      }
    }

    await onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status,
      dueDate: dueDateTimeStr,
      assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">
          Başlık <span className="text-red-500">*</span>
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Görev başlığını girin..."
          className={cn(errors.title && "border-red-500")}
          disabled={loading}
        />
        {errors.title && (
          <p className="text-xs text-red-500">{errors.title}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Açıklama</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Görev açıklaması (opsiyonel)..."
          rows={3}
          disabled={loading}
        />
      </div>

      {/* Priority & Status Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Priority */}
        <div className="space-y-2">
          <Label>Öncelik</Label>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as TaskPriority)}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => (
                <SelectItem key={p} value={p}>
                  <div className="flex items-center gap-2">
                    <Icon
                      icon="solar:flag-bold"
                      className="h-4 w-4"
                      style={{ color: PRIORITY_CONFIG[p].iconColor }}
                    />
                    {PRIORITY_CONFIG[p].labelTr}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status (sadece edit modda göster) */}
        {isEdit && (
          <div className="space-y-2">
            <Label>Durum</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as TaskStatus)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          STATUS_CONFIG[s].bgClass
                        )}
                      />
                      {STATUS_CONFIG[s].labelTr}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Due Date & Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tarih</Label>
          <DatePickerInput
            value={dueDate}
            onChange={(date) => setDueDate(date)}
            disabled={loading}
            placeholder="Tarih seçin"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Saat</Label>
          <Select
            value={dueTime || ""}
            onValueChange={(time) => setDueTime(time)}
            disabled={loading}
          >
            <SelectTrigger>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Saat seçin" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Assignees */}
      <div className="space-y-2">
        <Label>Atananlar</Label>
        <AssigneeMultiSelect
          users={users}
          selectedIds={assigneeIds}
          onChange={setAssigneeIds}
          disabled={loading}
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          İptal
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Icon icon="svg-spinners:ring-resize" className="h-4 w-4 mr-2" />
              Kaydediliyor...
            </>
          ) : isEdit ? (
            "Güncelle"
          ) : (
            "Oluştur"
          )}
        </Button>
      </div>
    </form>
  );
});
