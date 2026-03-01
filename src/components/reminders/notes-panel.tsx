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

import { InlineNoteForm } from "./inline-note-form";
import { CompactNoteList } from "./compact-note-card";
import { EmptyState } from "./empty-state";
import { TaxpayerSelect } from "./taxpayer-select";
import { formatDateForInput } from "./date-time-picker";

import type { Reminder, CreateReminderInput } from "@/types/reminder";

interface NotesPanelProps {
  year: number;
  month: number;
}

export function NotesPanel({ year, month }: NotesPanelProps) {
  const [notes, setNotes] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Reminder | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFormData, setEditFormData] = useState<CreateReminderInput>({
    title: "",
    description: "",
    type: "task",
    date: formatDateForInput(new Date()),
    isAllDay: true,
    customerId: undefined,
  });

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/reminders?year=${year}&month=${month}&type=task`
      );

      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      } else {
        toast.error("Notlar yüklenemedi");
      }
    } catch {
      toast.error("Notlar yüklenirken bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // ==================== OPTIMISTIC UPDATE FUNCTIONS ====================

  // Optimistic add - anında UI'a ekle
  const addNoteOptimistic = useCallback((tempNote: Partial<Reminder>) => {
    const optimisticNote: Reminder = {
      id: tempNote.id || `temp-${crypto.randomUUID()}`,
      title: tempNote.title || "",
      description: tempNote.description || null,
      type: "task",
      date: tempNote.date || new Date().toISOString(),
      isAllDay: true,
      startTime: null,
      endTime: null,
      repeatPattern: null,
      repeatDays: [],
      repeatEndDate: null,
      phoneNumber: null,
      sendWhatsApp: false,
      whatsappSentAt: null,
      status: "active",
      location: null,
      userId: "",
      tenantId: "",
      customerIds: tempNote.customerIds || [],
      customers: tempNote.customers || [],
      customerId: tempNote.customerId || null,
      customer: tempNote.customer || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes(prev => [optimisticNote, ...prev]);
  }, []);

  // Rollback - hata durumunda geri al
  const rollbackNote = useCallback((tempId: string) => {
    setNotes(prev => prev.filter(n => n.id !== tempId));
  }, []);

  // Confirm - API başarılı, gerçek veri ile değiştir
  const confirmNote = useCallback((tempId: string, realNote: Reminder) => {
    setNotes(prev => prev.map(n => n.id === tempId ? realNote : n));
  }, []);

  const handleEdit = (note: Reminder) => {
    setEditingNote(note);
    setEditFormData({
      title: note.title,
      description: note.description || "",
      type: "task",
      date: formatDateForInput(note.date),
      isAllDay: note.isAllDay,
      customerId: note.customerId || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingNote) return;

    if (!editFormData.title.trim()) {
      toast.error("Başlık zorunludur");
      return;
    }

    // Önceki state'i sakla (rollback için)
    const previousNote = { ...editingNote };

    // Hemen UI'da güncelle (optimistic)
    const updatedNote = {
      ...editingNote,
      title: editFormData.title,
      description: editFormData.description || null,
      date: editFormData.date,
      customerId: editFormData.customerId || null,
    };
    setNotes(prev => prev.map(n => n.id === editingNote.id ? { ...n, ...updatedNote } : n));
    setIsEditDialogOpen(false);
    setEditingNote(null);

    // Arka planda API'ye gönder
    try {
      const response = await fetch(`/api/reminders/${editingNote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editFormData.title,
          description: editFormData.description || null,
          date: editFormData.date,
          customerId: editFormData.customerId || null,
        }),
      });

      if (response.ok) {
        toast.success("Not güncellendi");
      } else {
        // Rollback
        setNotes(prev => prev.map(n => n.id === previousNote.id ? previousNote : n));
        const error = await response.json();
        toast.error(error.error || "Not güncellenemedi");
      }
    } catch {
      // Rollback
      setNotes(prev => prev.map(n => n.id === previousNote.id ? previousNote : n));
      toast.error("Bağlantı hatası");
    }
  };

  const handleDeleteClick = (note: Reminder) => {
    setEditingNote(note);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!editingNote) return;

    // Önceki listeyi sakla (rollback için)
    const previousNotes = [...notes];
    const noteToDelete = editingNote;

    // Hemen UI'dan kaldır (optimistic)
    setNotes(prev => prev.filter(n => n.id !== noteToDelete.id));
    setIsDeleteDialogOpen(false);
    setEditingNote(null);

    // Arka planda API'ye gönder
    try {
      const response = await fetch(`/api/reminders/${noteToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Not silindi");
      } else {
        // Rollback
        setNotes(previousNotes);
        const error = await response.json();
        toast.error(error.error || "Not silinemedi");
      }
    } catch {
      // Rollback
      setNotes(previousNotes);
      toast.error("Bağlantı hatası");
    }
  };

  const handleComplete = async (note: Reminder) => {
    // Önceki state'i sakla (rollback için)
    const previousStatus = note.status;

    // Hemen UI'da güncelle (optimistic)
    setNotes(prev => prev.map(n =>
      n.id === note.id ? { ...n, status: "completed" as const } : n
    ));

    // Arka planda API'ye gönder
    try {
      const response = await fetch(`/api/reminders/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      if (response.ok) {
        toast.success("Not tamamlandı");
      } else {
        // Rollback
        setNotes(prev => prev.map(n =>
          n.id === note.id ? { ...n, status: previousStatus } : n
        ));
        const error = await response.json();
        toast.error(error.error || "Not tamamlanamadı");
      }
    } catch {
      // Rollback
      setNotes(prev => prev.map(n =>
        n.id === note.id ? { ...n, status: previousStatus } : n
      ));
      toast.error("Bağlantı hatası");
    }
  };

  // Aktif ve tamamlanan notları ayır
  const activeNotes = notes.filter((n) => n.status === "active");
  const completedNotes = notes.filter((n) => n.status === "completed");

  return (
    <div className="h-full flex flex-col">
      {/* Panel Header */}
      <div className="p-4 border-b bg-muted/30">
        <h2 className="font-semibold flex items-center gap-2">
          <Icon icon="solar:document-text-bold" className="h-4 w-4" />
          Notlar
        </h2>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Inline Form */}
        <InlineNoteForm onSuccess={fetchNotes} />

        {/* Not Listesi */}
        {notes.length === 0 ? (
          <EmptyState
            icon="solar:document-text-bold"
            title="Henüz not yok"
            description="Yukarıdaki formu kullanarak ilk notunuzu ekleyin."
          />
        ) : (
          <div className="space-y-4">
            {activeNotes.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Aktif Notlar ({activeNotes.length})
                </h3>
                <CompactNoteList
                  notes={activeNotes}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                  onComplete={handleComplete}
                />
              </div>
            )}

            {completedNotes.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Tamamlanan ({completedNotes.length})
                </h3>
                <CompactNoteList
                  notes={completedNotes}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notu Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Başlık *</Label>
              <Input
                value={editFormData.title}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, title: e.target.value })
                }
                placeholder="Not başlığı..."
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
            <div className="space-y-2">
              <Label>Tarih</Label>
              <DatePickerInput
                value={editFormData.date as string}
                onChange={(date) =>
                  setEditFormData({ ...editFormData, date })
                }
                disabled={saving}
                placeholder="Tarih seçin"
              />
            </div>
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
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notu Sil</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{editingNote?.title}&quot; notunu silmek istediğinizden emin
              misiniz? Bu işlem geri alınamaz.
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
