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
import { noteSchema, type NoteFormData } from "@/lib/validations/schemas";

function formatDateForInputFn(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface InlineNoteFormProps {
  onSuccess?: () => void;
}

export function InlineNoteForm({ onSuccess }: InlineNoteFormProps) {
  // Minimum date for date picker (today)
  const minDate = useMemo(() => formatDateForInputFn(new Date()), []);

  const form = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "task",
      date: formatDateForInput(new Date()),
      customerIds: [],
    },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: NoteFormData) => {
    try {
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          type: "task",
        }),
      });

      if (response.ok) {
        toast.success("Not eklendi");
        form.reset();
        onSuccess?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Not eklenemedi");
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
                      placeholder="Not başlığı..."
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

            {/* Tarih Seçici - Anımsatıcı formu ile hizalı grid */}
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
            Not Ekle
          </Button>
        </form>
      </Form>
    </Card>
  );
}
