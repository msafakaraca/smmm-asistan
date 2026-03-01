"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  StickyNote,
  MoreVertical,
  Pencil,
  Trash2,
  CheckCircle2,
  Building2,
  User,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Reminder } from "@/types/reminder";
import { formatDateForDisplay } from "./date-time-picker";

interface NoteCardProps {
  note: Reminder;
  onEdit?: (note: Reminder) => void;
  onDelete?: (note: Reminder) => void;
  onComplete?: (note: Reminder) => void;
}

export function NoteCard({ note, onEdit, onDelete, onComplete }: NoteCardProps) {
  const isCompleted = note.status === "completed";
  const customerName = note.customer?.kisaltma || note.customer?.unvan;

  return (
    <Card
      className={cn(
        "group transition-all hover:shadow-md",
        isCompleted && "opacity-60"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* İçerik */}
          <div className="flex-1 min-w-0">
            {/* Başlık */}
            <div className="flex items-start gap-2">
              <StickyNote
                className={cn(
                  "h-4 w-4 mt-1 shrink-0",
                  isCompleted ? "text-muted-foreground" : "text-amber-500"
                )}
              />
              <div className="flex-1 min-w-0">
                <h4
                  className={cn(
                    "font-medium leading-tight",
                    isCompleted && "line-through text-muted-foreground"
                  )}
                >
                  {note.title}
                </h4>

                {/* Açıklama */}
                {note.description && (
                  <p
                    className={cn(
                      "text-sm text-muted-foreground mt-1 line-clamp-2",
                      isCompleted && "line-through"
                    )}
                  >
                    {note.description}
                  </p>
                )}

                {/* Meta bilgiler */}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {/* Tarih */}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDateForDisplay(note.date)}
                  </span>

                  {/* Mükellef */}
                  {customerName && (
                    <span className="flex items-center gap-1">
                      {note.customer?.vknTckn?.length === 10 ? (
                        <Building2 className="h-3 w-3" />
                      ) : (
                        <User className="h-3 w-3" />
                      )}
                      {customerName}
                    </span>
                  )}

                  {/* Tamamlandı işareti */}
                  {isCompleted && (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Tamamlandı
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Aksiyonlar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isCompleted && onComplete && (
                <DropdownMenuItem onClick={() => onComplete(note)}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Tamamla
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(note)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Düzenle
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(note)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Sil
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

// Not listesi bileşeni
interface NoteListProps {
  notes: Reminder[];
  onEdit?: (note: Reminder) => void;
  onDelete?: (note: Reminder) => void;
  onComplete?: (note: Reminder) => void;
  emptyMessage?: string;
}

export function NoteList({
  notes,
  onEdit,
  onDelete,
  onComplete,
  emptyMessage = "Henüz not eklenmemiş",
}: NoteListProps) {
  if (notes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onEdit={onEdit}
          onDelete={onDelete}
          onComplete={onComplete}
        />
      ))}
    </div>
  );
}
