"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Plus, StickyNote, Loader2, Search } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { NoteList } from "./note-card";
import { EmptyState } from "./empty-state";
import { TaxpayerSelect } from "./taxpayer-select";
import { DateTimePicker, formatDateForInput } from "./date-time-picker";
import type { Reminder, CreateReminderInput } from "@/types/reminder";

interface NotesTabProps {
  year: number;
  month: number;
}

export function NotesTab({ year, month }: NotesTabProps) {
  const [notes, setNotes] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Reminder | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateReminderInput>({
    title: "",
    description: "",
    type: "task",
    date: formatDateForInput(new Date()),
    isAllDay: true,
    customerId: undefined,
  });

  useEffect(() => {
    fetchNotes();
  }, [year, month]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/reminders?year=${year}&month=${month}&type=task`
      );
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      }
    } catch (error) {
      console.error("Notlar yüklenirken hata:", error);
      toast.error("Notlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      type: "task",
      date: formatDateForInput(new Date()),
      isAllDay: true,
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
        toast.success("Not eklendi");
        setIsCreateDialogOpen(false);
        resetForm();
        fetchNotes();
      } else {
        const error = await response.json();
        toast.error(error.error || "Not eklenemedi");
      }
    } catch (error) {
      toast.error("Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (note: Reminder) => {
    setSelectedNote(note);
    setFormData({
      title: note.title,
      description: note.description || "",
      type: "task",
      date: formatDateForInput(note.date),
      isAllDay: note.isAllDay,
      startTime: note.startTime || undefined,
      endTime: note.endTime || undefined,
      customerId: note.customerId || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedNote || !formData.title.trim()) {
      toast.error("Başlık zorunludur");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/reminders/${selectedNote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Not güncellendi");
        setIsEditDialogOpen(false);
        setSelectedNote(null);
        resetForm();
        fetchNotes();
      } else {
        const error = await response.json();
        toast.error(error.error || "Not güncellenemedi");
      }
    } catch (error) {
      toast.error("Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (note: Reminder) => {
    setSelectedNote(note);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedNote) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/reminders/${selectedNote.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Not silindi");
        setIsDeleteDialogOpen(false);
        setSelectedNote(null);
        fetchNotes();
      } else {
        toast.error("Not silinemedi");
      }
    } catch (error) {
      toast.error("Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (note: Reminder) => {
    try {
      const response = await fetch(`/api/reminders/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      if (response.ok) {
        toast.success("Not tamamlandı");
        fetchNotes();
      } else {
        toast.error("İşlem başarısız");
      }
    } catch (error) {
      toast.error("Bir hata oluştu");
    }
  };

  // Filtrelenmiş notlar
  const filteredNotes = notes.filter((note) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      note.title.toLowerCase().includes(query) ||
      note.description?.toLowerCase().includes(query) ||
      note.customer?.unvan?.toLowerCase().includes(query)
    );
  });

  // Aktif ve tamamlananları ayır
  const activeNotes = filteredNotes.filter((n) => n.status === "active");
  const completedNotes = filteredNotes.filter((n) => n.status === "completed");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Üst bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Not ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Not
        </Button>
      </div>

      {/* Not listesi veya boş durum */}
      {notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="Henüz not yok"
          description="Bu dönem için henüz not eklenmemiş. Yeni bir not ekleyerek başlayabilirsiniz."
          action={
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              İlk Notu Ekle
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Aktif notlar */}
          {activeNotes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Aktif Notlar ({activeNotes.length})
              </h3>
              <NoteList
                notes={activeNotes}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onComplete={handleComplete}
              />
            </div>
          )}

          {/* Tamamlanan notlar */}
          {completedNotes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Tamamlanan Notlar ({completedNotes.length})
              </h3>
              <NoteList
                notes={completedNotes}
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
            <DialogTitle>Yeni Not</DialogTitle>
            <DialogDescription>
              Mükellef ile ilişkili bir not ekleyin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Başlık *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Not başlığı"
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
                placeholder="Not detayları..."
                rows={3}
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
              onEndTimeChange={(endTime) =>
                setFormData({ ...formData, endTime })
              }
              isAllDay={formData.isAllDay || false}
              onAllDayChange={(isAllDay) =>
                setFormData({ ...formData, isAllDay })
              }
            />
          </div>
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
            <DialogTitle>Notu Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Başlık *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Not başlığı"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Açıklama</Label>
              <Textarea
                id="edit-description"
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Not detayları..."
                rows={3}
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
              onEndTimeChange={(endTime) =>
                setFormData({ ...formData, endTime })
              }
              isAllDay={formData.isAllDay || false}
              onAllDayChange={(isAllDay) =>
                setFormData({ ...formData, isAllDay })
              }
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setSelectedNote(null);
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
            <AlertDialogTitle>Notu Sil</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{selectedNote?.title}&quot; notunu silmek istediğinizden emin misiniz?
              Bu işlem geri alınamaz.
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
