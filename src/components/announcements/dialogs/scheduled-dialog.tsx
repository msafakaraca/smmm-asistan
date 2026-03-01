"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerInput } from "@/components/ui/date-picker";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import type {
  ChannelSettings,
  RepeatPattern,
  CreateScheduledAnnouncementRequest,
} from "../types";
import { REPEAT_PATTERNS, TEMPLATE_VARIABLES } from "../types";

// ============================================
// TYPES
// ============================================

interface ScheduledDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCustomerIds: string[];
  selectedCustomerCount?: number;
  onSave: (data: CreateScheduledAnnouncementRequest) => Promise<void>;
}

// ============================================
// CONSTANTS
// ============================================

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function combineDateAndTime(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00.000Z`;
}

// ============================================
// COMPONENT
// ============================================

export function ScheduledDialog({
  open,
  onOpenChange,
  selectedCustomerIds,
  selectedCustomerCount,
  onSave,
}: ScheduledDialogProps) {
  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [channels, setChannels] = useState<ChannelSettings>({
    email: true,
    sms: false,
    whatsapp: false,
  });
  const [scheduledDate, setScheduledDate] = useState(
    formatDateForInput(new Date())
  );
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [repeatPattern, setRepeatPattern] = useState<RepeatPattern>("once");
  const [repeatEndDate, setRepeatEndDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  // Customer count to display
  const customerCount = selectedCustomerCount ?? selectedCustomerIds.length;

  // Validation
  const isNameValid = name.trim().length > 0;
  const isContentValid = content.trim().length > 0;
  const hasSelectedChannel = channels.email || channels.sms || channels.whatsapp;
  const hasCustomers = selectedCustomerIds.length > 0;

  // Minimum date for scheduler (today)
  const minDate = useMemo(() => formatDateForInput(new Date()), []);

  // Insert variable into content
  const insertVariable = (variable: string) => {
    setContent((prev) => prev + variable);
  };

  // Handle save
  const handleSave = async () => {
    if (!isNameValid) {
      toast.error("Duyuru adı boş olamaz");
      return;
    }

    if (!isContentValid) {
      toast.error("Mesaj içeriği boş olamaz");
      return;
    }

    if (!hasSelectedChannel) {
      toast.error("En az bir kanal seçmelisiniz");
      return;
    }

    if (!hasCustomers) {
      toast.error("En az bir müşteri seçmelisiniz");
      return;
    }

    setIsSaving(true);
    try {
      const scheduledAt = combineDateAndTime(scheduledDate, scheduledTime);

      const data: CreateScheduledAnnouncementRequest = {
        name,
        subject: subject || undefined,
        content,
        sendEmail: channels.email,
        sendSms: channels.sms,
        sendWhatsApp: channels.whatsapp,
        scheduledAt,
        repeatPattern,
        repeatEndDate: repeatPattern !== "once" && repeatEndDate ? repeatEndDate : undefined,
        targetType: "selected",
        customerIds: selectedCustomerIds,
      };

      await onSave(data);

      // Reset form on success
      resetForm();
      onOpenChange(false);
      toast.success("Zamanlı duyuru oluşturuldu");
    } catch (error) {
      console.error("Kaydetme hatasi:", error);
      toast.error("Zamanlı duyuru oluşturulamadı");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setName("");
    setSubject("");
    setContent("");
    setChannels({ email: true, sms: false, whatsapp: false });
    setScheduledDate(formatDateForInput(new Date()));
    setScheduledTime("09:00");
    setRepeatPattern("once");
    setRepeatEndDate("");
    setShowVariables(false);
  };

  // Handle dialog close
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon
              icon="solar:clock-circle-bold"
              className="w-5 h-5 text-blue-600"
            />
            Zamanlı Duyuru Oluştur
          </DialogTitle>
          <DialogDescription>
            Belirli bir tarih ve saatte otomatik gönderilecek duyuru oluşturun
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Target Info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Icon
              icon="solar:users-group-rounded-bold"
              className="w-5 h-5 text-blue-600"
            />
            <div>
              <span className="text-sm font-medium">{customerCount}</span>
              <span className="text-sm text-muted-foreground ml-1">
                mükellef seçili
              </span>
            </div>
          </div>

          {/* Announcement Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Duyuru Adı *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örneğin: Ocak 2026 KDV Hatırlatması"
              disabled={isSaving}
            />
          </div>

          {/* Channel Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Gönderim Kanalları *</Label>
            <div className="flex flex-wrap gap-3">
              {/* Email */}
              <label
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                  channels.email
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <Checkbox
                  checked={channels.email}
                  onCheckedChange={(checked) =>
                    setChannels((prev) => ({ ...prev, email: !!checked }))
                  }
                  aria-label="Email kanalı"
                />
                <Icon
                  icon="solar:letter-bold"
                  className={cn(
                    "w-4 h-4",
                    channels.email ? "text-blue-600" : "text-muted-foreground"
                  )}
                />
                <span className="text-sm">Email</span>
              </label>

              {/* SMS */}
              <label
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                  channels.sms
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <Checkbox
                  checked={channels.sms}
                  onCheckedChange={(checked) =>
                    setChannels((prev) => ({ ...prev, sms: !!checked }))
                  }
                  aria-label="SMS kanalı"
                />
                <Icon
                  icon="solar:smartphone-bold"
                  className={cn(
                    "w-4 h-4",
                    channels.sms ? "text-purple-600" : "text-muted-foreground"
                  )}
                />
                <span className="text-sm">SMS</span>
              </label>

              {/* WhatsApp */}
              <label
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                  channels.whatsapp
                    ? "border-green-500 bg-green-50 dark:bg-green-950"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <Checkbox
                  checked={channels.whatsapp}
                  onCheckedChange={(checked) =>
                    setChannels((prev) => ({ ...prev, whatsapp: !!checked }))
                  }
                  aria-label="WhatsApp kanalı"
                />
                <Icon icon="logos:whatsapp-icon" className="w-4 h-4" />
                <span className="text-sm">WhatsApp</span>
              </label>
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gönderim Tarihi *</Label>
              <DatePickerInput
                value={scheduledDate}
                onChange={setScheduledDate}
                disabled={isSaving}
                minDate={minDate}
                placeholder="Tarih seçin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Gönderim Saati *</Label>
              <Select value={scheduledTime} onValueChange={setScheduledTime}>
                <SelectTrigger id="time">
                  <SelectValue placeholder="Saat seçin" />
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

          {/* Repeat Pattern */}
          <div className="space-y-3">
            <Label htmlFor="repeat">Tekrarlama</Label>
            <Select
              value={repeatPattern}
              onValueChange={(v) => setRepeatPattern(v as RepeatPattern)}
            >
              <SelectTrigger id="repeat">
                <SelectValue placeholder="Tekrarlama seçin" />
              </SelectTrigger>
              <SelectContent>
                {REPEAT_PATTERNS.map((pattern) => (
                  <SelectItem key={pattern.value} value={pattern.value}>
                    {pattern.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Repeat End Date */}
            {repeatPattern !== "once" && (
              <div className="space-y-2">
                <Label>Tekrarlama Bitiş Tarihi (Opsiyonel)</Label>
                <DatePickerInput
                  value={repeatEndDate}
                  onChange={setRepeatEndDate}
                  disabled={isSaving}
                  minDate={scheduledDate}
                  placeholder="Bitiş tarihi seçin"
                />
                <p className="text-xs text-muted-foreground">
                  Boş bırakırsanız sürekli tekrarlanır
                </p>
              </div>
            )}
          </div>

          {/* Subject (Email only) */}
          <div className="space-y-2">
            <Label htmlFor="subject">Konu (Opsiyonel - Sadece Email)</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email konusu..."
              disabled={isSaving}
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Mesaj İçeriği *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowVariables(!showVariables)}
                className="text-xs"
              >
                <Icon
                  icon={
                    showVariables
                      ? "solar:alt-arrow-up-linear"
                      : "solar:alt-arrow-down-linear"
                  }
                  className="w-4 h-4 mr-1"
                />
                Değişkenler
              </Button>
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Mesaj içeriğini yazın..."
              rows={5}
              disabled={isSaving}
              className="resize-none"
            />

            {/* Template Variables Help */}
            {showVariables && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Kullanılabilir Değişkenler (tıkla ekle):
                </div>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_VARIABLES.map((variable) => (
                    <button
                      key={variable.key}
                      type="button"
                      onClick={() => insertVariable(variable.key)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-background border rounded hover:bg-accent transition-colors"
                      title={variable.description}
                    >
                      <code className="text-blue-600">{variable.key}</code>
                      <span className="text-muted-foreground">
                        {variable.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Warnings */}
          {!hasSelectedChannel && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
              <Icon
                icon="solar:danger-triangle-bold"
                className="w-5 h-5 shrink-0"
              />
              <span>En az bir gönderim kanalı seçmelisiniz.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSaving}
          >
            İptal
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              isSaving ||
              !isNameValid ||
              !isContentValid ||
              !hasSelectedChannel ||
              !hasCustomers
            }
            className="min-w-[140px]"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Icon icon="solar:clock-circle-bold" className="w-4 h-4 mr-2" />
                Zamanla
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
