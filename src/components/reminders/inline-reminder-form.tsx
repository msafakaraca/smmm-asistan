"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/card";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { DatePickerInput } from "@/components/ui/date-picker";
import { TaxpayerSelect } from "./taxpayer-select";
import { formatDateForInput } from "./date-time-picker";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { reminderSchema, type ReminderFormData } from "@/lib/validations/schemas";

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
];

function formatDateForInputFn(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface InlineReminderFormProps {
  onSuccess?: () => void;
}

export function InlineReminderForm({ onSuccess }: InlineReminderFormProps) {
  // Minimum date for scheduler (today)
  const minDate = useMemo(() => formatDateForInputFn(new Date()), []);

  const form = useForm<ReminderFormData>({
    resolver: zodResolver(reminderSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "event",
      date: formatDateForInput(new Date()),
      isAllDay: false,
      startTime: "09:00",
      phoneNumber: "",
      sendWhatsApp: false,
      customerIds: [],
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: ReminderFormData) => {
    try {
      const payload = {
        ...data,
        type: "event" as const,
        isAllDay: false,
        // Sadece tek saat kullan - bitiş saati başlangıçla aynı
        startTime: data.startTime,
        endTime: data.startTime,
        // Boş telefon numarasını gönderme
        phoneNumber: data.phoneNumber?.replace(/\D/g, "").length === 10
          ? data.phoneNumber
          : undefined,
        sendWhatsApp: data.phoneNumber?.replace(/\D/g, "").length === 10
          ? data.sendWhatsApp
          : false,
      };

      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success("Anımsatıcı eklendi");
        form.reset();
        onSuccess?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Anımsatıcı eklenemedi");
      }
    } catch {
      toast.error("Bir hata oluştu");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey && form.getValues("title").trim()) {
      form.handleSubmit(onSubmit)();
    }
  };

  return (
    <Card className="p-4 bg-muted/30">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-[400px]">
          <div className="space-y-3 flex-1">
            {/* Başlık */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Anımsatıcı başlığı..."
                      onKeyDown={handleKeyDown}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Açıklama */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Açıklama (opsiyonel)..."
                      rows={2}
                      onKeyDown={handleKeyDown}
                      className="resize-none min-h-[56px]"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Mükellef Seçimi (Çoklu) */}
            <FormField
              control={form.control}
              name="customerIds"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <TaxpayerSelect
                      multiple
                      value={field.value || []}
                      onValueChange={field.onChange}
                      placeholder="Mükellef seçin (çoklu)"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tarih ve Saat Seçimi */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tarih</Label>
                    <FormControl>
                      <DatePickerInput
                        value={field.value}
                        onChange={field.onChange}
                        disabled={isSubmitting}
                        minDate={minDate}
                        placeholder="Tarih seçin"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Saat</Label>
                    <Select
                      value={field.value || "09:00"}
                      onValueChange={field.onChange}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Saat seçin" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIME_SLOTS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-auto"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Anımsatıcı Ekle
          </Button>
        </form>
      </Form>
    </Card>
  );
}
