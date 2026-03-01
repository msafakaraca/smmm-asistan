"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  MoreVertical,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  MapPin,
  Repeat,
  MessageCircle,
  Building2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Reminder, RepeatPattern } from "@/types/reminder";
import {
  formatDateForDisplay,
  formatTimeForDisplay,
  formatDateTimeForDisplay,
} from "./date-time-picker";

interface ReminderCardProps {
  reminder: Reminder;
  onEdit?: (reminder: Reminder) => void;
  onDelete?: (reminder: Reminder) => void;
  onComplete?: (reminder: Reminder) => void;
}

const repeatPatternLabels: Record<Exclude<RepeatPattern, null>, string> = {
  daily: "Her gün",
  weekly: "Her hafta",
  monthly: "Her ay",
  yearly: "Her yıl",
};

export function ReminderCard({
  reminder,
  onEdit,
  onDelete,
  onComplete,
}: ReminderCardProps) {
  const isCompleted = reminder.status === "completed";
  const isPast =
    new Date(reminder.date) < new Date() &&
    !isCompleted &&
    !reminder.repeatPattern;
  const customerName = reminder.customer?.kisaltma || reminder.customer?.unvan;

  // Zaman bilgisi
  const timeDisplay = reminder.isAllDay
    ? "Tüm gün"
    : reminder.startTime
      ? `${formatTimeForDisplay(reminder.startTime)}${reminder.endTime ? ` - ${formatTimeForDisplay(reminder.endTime)}` : ""}`
      : null;

  return (
    <Card
      className={cn(
        "group transition-all hover:shadow-md",
        isCompleted && "opacity-60",
        isPast && "border-destructive/50 bg-destructive/5"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* İçerik */}
          <div className="flex-1 min-w-0">
            {/* Başlık ve Badge'ler */}
            <div className="flex items-start gap-2">
              <Bell
                className={cn(
                  "h-4 w-4 mt-1 shrink-0",
                  isCompleted
                    ? "text-muted-foreground"
                    : isPast
                      ? "text-destructive"
                      : "text-blue-500"
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4
                    className={cn(
                      "font-medium leading-tight",
                      isCompleted && "line-through text-muted-foreground"
                    )}
                  >
                    {reminder.title}
                  </h4>

                  {/* Badge'ler */}
                  {isPast && (
                    <Badge variant="destructive" className="text-xs">
                      Gecikmiş
                    </Badge>
                  )}
                  {reminder.sendWhatsApp && (
                    <Badge
                      variant="outline"
                      className="text-xs text-green-600 border-green-600"
                    >
                      <MessageCircle className="h-3 w-3 mr-1" />
                      WhatsApp
                    </Badge>
                  )}
                </div>

                {/* Açıklama */}
                {reminder.description && (
                  <p
                    className={cn(
                      "text-sm text-muted-foreground mt-1 line-clamp-2",
                      isCompleted && "line-through"
                    )}
                  >
                    {reminder.description}
                  </p>
                )}

                {/* Meta bilgiler */}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {/* Tarih */}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDateForDisplay(reminder.date)}
                    {timeDisplay && `, ${timeDisplay}`}
                  </span>

                  {/* Konum */}
                  {reminder.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {reminder.location}
                    </span>
                  )}

                  {/* Tekrarlama */}
                  {reminder.repeatPattern && (
                    <span className="flex items-center gap-1">
                      <Repeat className="h-3 w-3" />
                      {repeatPatternLabels[reminder.repeatPattern]}
                    </span>
                  )}

                  {/* Mükellef */}
                  {customerName && (
                    <span className="flex items-center gap-1">
                      {reminder.customer?.vknTckn?.length === 10 ? (
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
                <DropdownMenuItem onClick={() => onComplete(reminder)}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Tamamla
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(reminder)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Düzenle
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(reminder)}
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

// Anımsatıcı listesi bileşeni
interface ReminderListProps {
  reminders: Reminder[];
  onEdit?: (reminder: Reminder) => void;
  onDelete?: (reminder: Reminder) => void;
  onComplete?: (reminder: Reminder) => void;
  emptyMessage?: string;
}

export function ReminderList({
  reminders,
  onEdit,
  onDelete,
  onComplete,
  emptyMessage = "Henüz anımsatıcı eklenmemiş",
}: ReminderListProps) {
  if (reminders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  // Tarihe göre grupla
  const groupedReminders = reminders.reduce(
    (groups, reminder) => {
      const dateKey = new Date(reminder.date).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(reminder);
      return groups;
    },
    {} as Record<string, Reminder[]>
  );

  const sortedDates = Object.keys(groupedReminders).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <div className="space-y-6">
      {sortedDates.map((dateKey) => (
        <div key={dateKey}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {formatDateForDisplay(dateKey)}
          </h3>
          <div className="space-y-3">
            {groupedReminders[dateKey].map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onEdit={onEdit}
                onDelete={onDelete}
                onComplete={onComplete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
