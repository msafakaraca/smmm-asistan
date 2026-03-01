"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock } from "lucide-react";

interface DateTimePickerProps {
  date: string;
  onDateChange: (date: string) => void;
  startTime?: string;
  onStartTimeChange?: (time: string) => void;
  endTime?: string;
  onEndTimeChange?: (time: string) => void;
  isAllDay: boolean;
  onAllDayChange: (isAllDay: boolean) => void;
  disabled?: boolean;
}

export function DateTimePicker({
  date,
  onDateChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  isAllDay,
  onAllDayChange,
  disabled = false,
}: DateTimePickerProps) {
  return (
    <div className="space-y-4">
      {/* Tarih */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Tarih
        </Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          disabled={disabled}
          className="w-full"
        />
      </div>

      {/* Tüm Gün Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="allDay"
          checked={isAllDay}
          onCheckedChange={(checked) => onAllDayChange(checked === true)}
          disabled={disabled}
        />
        <Label htmlFor="allDay" className="text-sm cursor-pointer">
          Tüm gün
        </Label>
      </div>

      {/* Saat Seçimi (Tüm gün değilse) */}
      {!isAllDay && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Başlangıç
            </Label>
            <Input
              type="time"
              value={startTime || ""}
              onChange={(e) => onStartTimeChange?.(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Bitiş
            </Label>
            <Input
              type="time"
              value={endTime || ""}
              onChange={(e) => onEndTimeChange?.(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Tarih formatlama yardımcı fonksiyonları
export function formatDateForInput(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

export function formatTimeForDisplay(time: string | null | undefined): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  return `${hours}:${minutes}`;
}

export function formatDateForDisplay(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTimeForDisplay(
  date: Date | string,
  startTime?: string | null,
  endTime?: string | null,
  isAllDay?: boolean
): string {
  const dateStr = formatDateForDisplay(date);

  if (isAllDay) {
    return `${dateStr} (Tüm gün)`;
  }

  if (startTime && endTime) {
    return `${dateStr}, ${formatTimeForDisplay(startTime)} - ${formatTimeForDisplay(endTime)}`;
  }

  if (startTime) {
    return `${dateStr}, ${formatTimeForDisplay(startTime)}`;
  }

  return dateStr;
}
