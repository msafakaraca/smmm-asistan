"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon } from "@iconify/react";
// LoadingSpinner component for Loader2 replacement
const LoadingSpinner = ({ size = 16 }: { size?: number }) => (
  <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
  </svg>
);

import { toast } from "@/components/ui/sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePickerInput } from "@/components/ui/date-picker";
import { TimePickerInput } from "@/components/ui/time-picker";

import { InlineReminderForm } from "./inline-reminder-form";
import { CompactReminderList } from "./compact-reminder-card";
import { EmptyState } from "./empty-state";
import { TaxpayerSelect } from "./taxpayer-select";
import { WhatsAppNotification } from "./whatsapp-notification";
import { formatDateForInput } from "./date-time-picker";

import type { Reminder, CreateReminderInput } from "@/types/reminder";

interface RemindersPanelProps {
  year: number;
  month: number;
}

export function RemindersPanel({ year, month }: RemindersPanelProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFormData, setEditFormData] = useState<CreateReminderInput>({
    title: "",
    description: "",
    type: "event",
    date: formatDateForInput(new Date()),
    isAllDay: false,
    startTime: "09:00",
    endTime: "10:00",
    phoneNumber: "",
    sendWhatsApp: false,
    customerId: undefined,
  });

  const fetchReminders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/reminders?year=${year}&month=${month}&type=event`
      );

      if (response.ok) {
        const data = await response.json();
        setReminders(data);
      } else {
        toast.error("Anımsatıcılar yüklenemedi");
      }
    } catch {
      toast.error("Anımsatıcılar yüklenirken bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // ==================== OPTIMISTIC UPDATE FUNCTIONS ====================

  // Optimistic add - anında UI'a ekle
  const addReminderOptimistic = useCallback((tempReminder: Partial<Reminder>) => {
    const optimisticReminder: Reminder = {
      id: tempReminder.id || `temp-${crypto.randomUUID()}`,
      title: tempReminder.title || "",
      description: tempReminder.description || null,
      type: "event",
      date: tempReminder.date || new Date().toISOString(),
      isAllDay: tempReminder.isAllDay || false,
      startTime: tempReminder.startTime || "09:00",
      endTime: tempReminder.endTime || "09:00",
      repeatPattern: null,
      repeatDays: [],
      repeatEndDate: null,
      phoneNumber: tempReminder.phoneNumber || null,
      sendWhatsApp: tempReminder.sendWhatsApp || false,
      whatsappSentAt: null,
      status: "active",
      location: null,
      userId: "",
      tenantId: "",
      customerIds: tempReminder.customerIds || [],
      customers: tempReminder.customers || [],
      customerId: tempReminder.customerId || null,
      customer: tempReminder.customer || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setReminders(prev => [optimisticReminder, ...prev]);
  }, []);

  // Rollback - hata durumunda geri al
  const rollbackReminder = useCallback((tempId: string) => {
    setReminders(prev => prev.filter(r => r.id !== tempId));
  }, []);

  // Confirm - API başarılı, gerçek veri ile değiştir
  const confirmReminder = useCallback((tempId: string, realReminder: Reminder) => {
    setReminders(prev => prev.map(r => r.id === tempId ? realReminder : r));
  }, []);

  const handleEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setEditFormData({
      title: reminder.title,
      description: reminder.description || "",
      type: "event",
      date: formatDateForInput(reminder.date),
      isAllDay: reminder.isAllDay,
      startTime: reminder.startTime || "09:00",
      endTime: reminder.endTime || "10:00",
      phoneNumber: reminder.phoneNumber || "",
      sendWhatsApp: reminder.sendWhatsApp,
      customerId: reminder.customerId || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingReminder) return;

    if (!editFormData.title.trim()) {
      toast.error("Başlık zorunludur");
      return;
    }

    // Önceki state'i sakla (rollback için)
    const previousReminder = { ...editingReminder };

    // Telefon numarasını temizle
    const cleanPhone = editFormData.phoneNumber?.replace(/\D/g, "") || "";
    const isValidPhone = cleanPhone.length === 10;

    const payload = {
      title: editFormData.title,
      description: editFormData.description || null,
      date: editFormData.date,
      isAllDay: false,
      startTime: editFormData.startTime || "09:00",
      endTime: editFormData.startTime || "09:00",
      phoneNumber: isValidPhone ? (editFormData.phoneNumber || null) : null,
      sendWhatsApp: isValidPhone ? (editFormData.sendWhatsApp || false) : false,
      customerId: editFormData.customerId || null,
    };

    // Hemen UI'da güncelle (optimistic)
    setReminders(prev => prev.map(r => r.id === editingReminder.id ? { ...r, ...payload } : r));
    setIsEditDialogOpen(false);
    setEditingReminder(null);

    // Arka planda API'ye gönder
    try {
      const response = await fetch(`/api/reminders/${editingReminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success("Anımsatıcı güncellendi");
      } else {
        // Rollback
        setReminders(prev => prev.map(r => r.id === previousReminder.id ? previousReminder : r));
        const error = await response.json();
        toast.error(error.error || "Anımsatıcı güncellenemedi");
      }
    } catch {
      // Rollback
      setReminders(prev => prev.map(r => r.id === previousReminder.id ? previousReminder : r));
      toast.error("Bağlantı hatası");
    }
  };

  const handleDeleteClick = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!editingReminder) return;

    // Önceki listeyi sakla (rollback için)
    const previousReminders = [...reminders];
    const reminderToDelete = editingReminder;

    // Hemen UI'dan kaldır (optimistic)
    setReminders(prev => prev.filter(r => r.id !== reminderToDelete.id));
    setIsDeleteDialogOpen(false);
    setEditingReminder(null);

    // Arka planda API'ye gönder
    try {
      const response = await fetch(`/api/reminders/${reminderToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Anımsatıcı silindi");
      } else {
        // Rollback
        setReminders(previousReminders);
        const error = await response.json();
        toast.error(error.error || "Anımsatıcı silinemedi");
      }
    } catch {
      // Rollback
      setReminders(previousReminders);
      toast.error("Bağlantı hatası");
    }
  };

  const handleComplete = async (reminder: Reminder) => {
    // Önceki state'i sakla (rollback için)
    const previousStatus = reminder.status;

    // Hemen UI'da güncelle (optimistic)
    setReminders(prev => prev.map(r =>
      r.id === reminder.id ? { ...r, status: "completed" as const } : r
    ));

    // Arka planda API'ye gönder
    try {
      const response = await fetch(`/api/reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      if (response.ok) {
        toast.success("Anımsatıcı tamamlandı");
      } else {
        // Rollback
        setReminders(prev => prev.map(r =>
          r.id === reminder.id ? { ...r, status: previousStatus } : r
        ));
        const error = await response.json();
        toast.error(error.error || "Anımsatıcı tamamlanamadı");
      }
    } catch {
      // Rollback
      setReminders(prev => prev.map(r =>
        r.id === reminder.id ? { ...r, status: previousStatus } : r
      ));
      toast.error("Bağlantı hatası");
    }
  };

  // Aktif ve tamamlanan anımsatıcıları ayır
  const activeReminders = reminders.filter((r) => r.status === "active");
  const completedReminders = reminders.filter((r) => r.status === "completed");

  return (
    <div className="h-full flex flex-col">
      {/* Panel Header */}
      <div className="p-4 border-b bg-muted/30">
        <h2 className="font-semibold flex items-center gap-2">
          <Icon icon="solar:bell-bold" className="h-4 w-4" />
          Anımsatıcılar
        </h2>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Inline Form */}
        <InlineReminderForm onSuccess={fetchReminders} />

        {/* Anımsatıcı Listesi */}
        {reminders.length === 0 ? (
          <EmptyState
            icon="solar:bell-bold"
            title="Henüz anımsatıcı yok"
            description="Yukarıdaki formu kullanarak ilk anımsatıcınızı ekleyin."
          />
        ) : (
          <div className="space-y-4">
            {activeReminders.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Aktif Anımsatıcılar ({activeReminders.length})
                </h3>
                <CompactReminderList
                  reminders={activeReminders}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                  onComplete={handleComplete}
                />
              </div>
            )}

            {completedReminders.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Tamamlanan ({completedReminders.length})
                </h3>
                <CompactReminderList
                  reminders={completedReminders}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Anımsatıcıyı Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Başlık *</Label>
              <Input
                value={editFormData.title}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, title: e.target.value })
                }
                placeholder="Anımsatıcı başlığı..."
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Textarea
                value={editFormData.description || ""}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    description: e.target.value,
                  })
                }
                placeholder="Açıklama (opsiyonel)..."
                rows={3}
                className="resize-none"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Mükellef</Label>
              <TaxpayerSelect
                value={editFormData.customerId}
                onValueChange={(v) =>
                  setEditFormData({ ...editFormData, customerId: v })
                }
                placeholder="Mükellef seçin"
                disabled={saving}
              />
            </div>
            {/* Tarih ve Saat - Yan yana */}
            <div className="space-y-2">
              <Label>Tarih ve Saat</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <DatePickerInput
                    value={editFormData.date as string}
                    onChange={(date) =>
                      setEditFormData({ ...editFormData, date })
                    }
                    disabled={saving}
                    placeholder="Tarih seçin"
                  />
                </div>
                <TimePickerInput
                  value={editFormData.startTime || "09:00"}
                  onChange={(time) =>
                    setEditFormData({
                      ...editFormData,
                      startTime: time,
                    })
                  }
                  className="w-28"
                  disabled={saving}
                />
              </div>
            </div>

            {/* WhatsApp - Basit Checkbox */}
            <WhatsAppNotification
              enabled={editFormData.sendWhatsApp || false}
              onEnabledChange={(send) =>
                setEditFormData({ ...editFormData, sendWhatsApp: send })
              }
              disabled={saving}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={saving}
            >
              İptal
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <LoadingSpinner size={16} />}
              Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anımsatıcıyı Sil</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{editingReminder?.title}&quot; anımsatıcısını silmek
              istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
            >
              {saving && <LoadingSpinner size={16} />}
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
