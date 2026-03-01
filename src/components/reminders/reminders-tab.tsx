"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Plus, Bell, Loader2, Search, MapPin } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { ReminderList } from "./reminder-card";
import { EmptyState } from "./empty-state";
import { TaxpayerSelect } from "./taxpayer-select";
import { DateTimePicker, formatDateForInput } from "./date-time-picker";
import { PhoneInput } from "./phone-input-multi";
import type {
  Reminder,
  CreateReminderInput,
  RepeatPattern,
} from "@/types/reminder";

interface RemindersTabProps {
  year: number;
  month: number;
}

export function RemindersTab({ year, month }: RemindersTabProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateReminderInput>({
    title: "",
    description: "",
    type: "event",
    date: formatDateForInput(new Date()),
    isAllDay: false,
    startTime: "09:00",
    endTime: "10:00",
    repeatPattern: undefined,
    phoneNumber: "",
    sendWhatsApp: false,
    location: "",
    customerId: undefined,
  });

  useEffect(() => {
    fetchReminders();
  }, [year, month]);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/reminders?year=${year}&month=${month}&type=event`
      );
      if (response.ok) {
        const data = await response.json();
        setReminders(data);
      }
    } catch (error) {
      console.error("Anımsatıcılar yüklenirken hata:", error);
      toast.error("Anımsatıcılar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      type: "event",
      date: formatDateForInput(new Date()),
      isAllDay: false,
      startTime: "09:00",
      endTime: "10:00",
      repeatPattern: undefined,
      phoneNumber: "",
      sendWhatsApp: false,
      location: "",
      customerId: undefined,
    });
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast.error("Başlık zorunludur");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Anımsatıcı eklendi");
        setIsCreateDialogOpen(false);
        resetForm();
        fetchReminders();
      } else {
        const error = await response.json();
        toast.error(error.error || "Anımsatıcı eklenemedi");
      }
    } catch (error) {
      toast.error("Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setFormData({
      title: reminder.title,
      description: reminder.description || "",
      type: "event",
      date: formatDateForInput(reminder.date),
      isAllDay: reminder.isAllDay,
      startTime: reminder.startTime || "09:00",
      endTime: reminder.endTime || "10:00",
      repeatPattern: reminder.repeatPattern as RepeatPattern,
      phoneNumber: reminder.phoneNumber || "",
      sendWhatsApp: reminder.sendWhatsApp,
      location: reminder.location || "",
      customerId: reminder.customerId || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedReminder || !formData.title.trim()) {
      toast.error("Başlık zorunludur");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/reminders/${selectedReminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Anımsatıcı güncellendi");
        setIsEditDialogOpen(false);
        setSelectedReminder(null);
        resetForm();
        fetchReminders();
      } else {
        const error = await response.json();
        toast.error(error.error || "Anımsatıcı güncellenemedi");
      }
    } catch (error) {
      toast.error("Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedReminder) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/reminders/${selectedReminder.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Anımsatıcı silindi");
        setIsDeleteDialogOpen(false);
        setSelectedReminder(null);
        fetchReminders();
      } else {
        toast.error("Anımsatıcı silinemedi");
      }
    } catch (error) {
      toast.error("Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (reminder: Reminder) => {
    try {
      const response = await fetch(`/api/reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      if (response.ok) {
        toast.success("Anımsatıcı tamamlandı");
        fetchReminders();
      } else {
        toast.error("İşlem başarısız");
      }
    } catch (error) {
      toast.error("Bir hata oluştu");
    }
  };

  // Filtrelenmiş anımsatıcılar
  const filteredReminders = reminders.filter((reminder) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      reminder.title.toLowerCase().includes(query) ||
      reminder.description?.toLowerCase().includes(query) ||
      reminder.location?.toLowerCase().includes(query) ||
      reminder.customer?.unvan?.toLowerCase().includes(query)
    );
  });

  // Aktif ve tamamlananları ayır
  const activeReminders = filteredReminders.filter(
    (r) => r.status === "active"
  );
  const completedReminders = filteredReminders.filter(
    (r) => r.status === "completed"
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Form dialog içeriği
  const FormContent = () => (
    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
      <div className="space-y-2">
        <Label htmlFor="title">Başlık *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Anımsatıcı başlığı"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Açıklama</Label>
        <Textarea
          id="description"
          value={formData.description || ""}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Anımsatıcı detayları..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Mükellef (Opsiyonel)</Label>
        <TaxpayerSelect
          value={formData.customerId}
          onValueChange={(value) =>
            setFormData({ ...formData, customerId: value })
          }
          placeholder="Mükellef seçin"
        />
      </div>

      <DateTimePicker
        date={formData.date as string}
        onDateChange={(date) => setFormData({ ...formData, date })}
        startTime={formData.startTime}
        onStartTimeChange={(startTime) =>
          setFormData({ ...formData, startTime })
        }
        endTime={formData.endTime}
        onEndTimeChange={(endTime) => setFormData({ ...formData, endTime })}
        isAllDay={formData.isAllDay || false}
        onAllDayChange={(isAllDay) => setFormData({ ...formData, isAllDay })}
      />

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Konum (Opsiyonel)
        </Label>
        <Input
          value={formData.location || ""}
          onChange={(e) =>
            setFormData({ ...formData, location: e.target.value })
          }
          placeholder="Toplantı yeri, adres vb."
        />
      </div>

      <div className="space-y-2">
        <Label>Tekrarlama</Label>
        <Select
          value={formData.repeatPattern || "none"}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              repeatPattern:
                value === "none"
                  ? undefined
                  : (value as Exclude<RepeatPattern, null>),
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Tekrarlama seçin" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Tekrarlama yok</SelectItem>
            <SelectItem value="daily">Her gün</SelectItem>
            <SelectItem value="weekly">Her hafta</SelectItem>
            <SelectItem value="monthly">Her ay</SelectItem>
            <SelectItem value="yearly">Her yıl</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <PhoneInput
        phoneNumber={formData.phoneNumber}
        onPhoneNumberChange={(phoneNumber) =>
          setFormData({ ...formData, phoneNumber })
        }
        sendWhatsApp={formData.sendWhatsApp || false}
        onSendWhatsAppChange={(sendWhatsApp) =>
          setFormData({ ...formData, sendWhatsApp })
        }
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Üst bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Anımsatıcı ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Anımsatıcı
        </Button>
      </div>

      {/* Anımsatıcı listesi veya boş durum */}
      {reminders.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Henüz anımsatıcı yok"
          description="Bu dönem için henüz anımsatıcı eklenmemiş. Yeni bir anımsatıcı ekleyerek başlayabilirsiniz."
          action={
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              İlk Anımsatıcıyı Ekle
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Aktif anımsatıcılar */}
          {activeReminders.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Aktif Anımsatıcılar ({activeReminders.length})
              </h3>
              <ReminderList
                reminders={activeReminders}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onComplete={handleComplete}
              />
            </div>
          )}

          {/* Tamamlanan anımsatıcılar */}
          {completedReminders.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Tamamlanan Anımsatıcılar ({completedReminders.length})
              </h3>
              <ReminderList
                reminders={completedReminders}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
              />
            </div>
          )}
        </div>
      )}

      {/* Oluşturma Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Yeni Anımsatıcı</DialogTitle>
            <DialogDescription>
              Hatırlatılması gereken bir etkinlik veya görev ekleyin.
            </DialogDescription>
          </DialogHeader>
          <FormContent />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                resetForm();
              }}
            >
              İptal
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Düzenleme Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Anımsatıcıyı Düzenle</DialogTitle>
          </DialogHeader>
          <FormContent />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setSelectedReminder(null);
                resetForm();
              }}
            >
              İptal
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Silme Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anımsatıcıyı Sil</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{selectedReminder?.title}&quot; anımsatıcısını silmek istediğinizden
              emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
