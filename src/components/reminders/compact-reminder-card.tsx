"use client";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Icon } from "@iconify/react";

// Small tick icon for completed state
const SmallTick = () => (
  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
import { cn } from "@/lib/utils";
import type { Reminder } from "@/types/reminder";
import { formatTimeForDisplay, formatDateForDisplay } from "./date-time-picker";

interface CompactReminderCardProps {
  reminder: Reminder;
  onEdit?: (reminder: Reminder) => void;
  onDelete?: (reminder: Reminder) => void;
  onComplete?: (reminder: Reminder) => void;
}

export function CompactReminderCard({
  reminder,
  onEdit,
  onDelete,
  onComplete,
}: CompactReminderCardProps) {
  const isCompleted = reminder.status === "completed";
  const isPast =
    new Date(reminder.date) < new Date() &&
    !isCompleted &&
    !reminder.repeatPattern;

  // Çoklu mükellef desteği - customers array kullan, yoksa legacy customer'a bak
  const customers = reminder.customers || (reminder.customer ? [reminder.customer] : []);
  const hasCustomers = customers.length > 0;

  // Saat gösterimi - sadece tek saat
  const getTimeDisplay = () => {
    if (reminder.startTime) {
      return formatTimeForDisplay(reminder.startTime);
    }
    return null;
  };

  const timeDisplay = getTimeDisplay();

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCompleted && onComplete) {
      onComplete(reminder);
    }
  };

  return (
    <div
      className={cn(
        "relative p-4 rounded-xl border bg-card hover:shadow-md transition-all group",
        isCompleted && "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900",
        isPast && !isCompleted && "border-destructive/50 bg-destructive/5"
      )}
    >
      {/* Üst: Checkbox + Başlık + Badge'ler + Menu */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Yuvarlak tamamlama checkbox */}
          <button
            type="button"
            onClick={handleComplete}
            disabled={isCompleted}
            className={cn(
              "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
              isCompleted
                ? "bg-green-500 border-green-500 text-white cursor-default"
                : isPast
                  ? "border-destructive/50 hover:border-destructive hover:bg-destructive/10 cursor-pointer"
                  : "border-muted-foreground/40 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer"
            )}
          >
            {isCompleted && <SmallTick />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h4
                  className={cn(
                    "font-semibold text-sm truncate",
                    isCompleted && "line-through text-muted-foreground"
                  )}
                >
                  {reminder.title}
                </h4>

                {/* WhatsApp Badge */}
                {reminder.sendWhatsApp && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 text-green-600 border-green-600 shrink-0 flex items-center"
                  >
                    <Icon icon="solar:chat-round-bold" className="h-3 w-3 mr-0.5" />
                    WA
                  </Badge>
                )}

                {/* Gecikmiş Badge */}
                {isPast && !isCompleted && (
                  <Badge
                    variant="destructive"
                    className="text-[10px] px-1.5 py-0 h-5 shrink-0"
                  >
                    Gecikmiş
                  </Badge>
                )}
              </div>

              {/* Mükellef Badge'leri (Çoklu) - Başlığın sağında */}
              {hasCustomers && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {customers.slice(0, 3).map((customer) => {
                    // Firma adını kısalt (max 18 karakter)
                    const displayName = customer.kisaltma || customer.unvan;
                    const shortName = displayName.length > 18
                      ? displayName.slice(0, 18) + "..."
                      : displayName;

                    return (
                      <Badge
                        key={customer.id}
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-5 flex items-center",
                          customer.vknTckn?.length === 10
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        )}
                        title={displayName}
                      >
                        {customer.vknTckn?.length === 10 ? (
                          <Icon icon="solar:case-bold" className="h-3 w-3 mr-1 shrink-0" />
                        ) : (
                          <Icon icon="solar:user-bold" className="h-3 w-3 mr-1 shrink-0" />
                        )}
                        <span>{shortName}</span>
                      </Badge>
                    );
                  })}
                  {customers.length > 3 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-5 cursor-pointer hover:bg-accent"
                        >
                          +{customers.length - 3}
                        </Badge>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2" align="end">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Diğer Mükellefler ({customers.length - 3})
                          </p>
                          {customers.slice(3).map((customer) => (
                            <div
                              key={customer.id}
                              className="flex items-center gap-2 text-sm py-1"
                            >
                              {customer.vknTckn?.length === 10 ? (
                                <Icon icon="solar:case-bold" className="h-3.5 w-3.5 text-blue-600" />
                              ) : (
                                <Icon icon="solar:user-bold" className="h-3.5 w-3.5 text-emerald-600" />
                              )}
                              <span>{customer.kisaltma || customer.unvan}</span>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3 nokta menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mr-2 -mt-1"
            >
              <Icon icon="solar:menu-dots-square-bold" className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(reminder)}>
                <Icon icon="solar:pen-bold" className="h-4 w-4 mr-2" />
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
                  <Icon icon="solar:trash-bin-trash-bold" className="h-4 w-4 mr-2" />
                  Sil
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Açıklama (varsa) */}
      {reminder.description && (
        <p
          className={cn(
            "text-sm text-muted-foreground mb-3 line-clamp-2 ml-8",
            isCompleted && "line-through"
          )}
        >
          {reminder.description}
        </p>
      )}

      {/* Alt: Tarih, Saat, Konum */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap ml-8">
        {/* Tarih */}
        <span className="flex items-center gap-1">
          <Icon icon="solar:calendar-bold" className="h-3.5 w-3.5" />
          {formatDateForDisplay(reminder.date)}
        </span>

        {/* Saat */}
        {timeDisplay && (
          <>
            <span>-</span>
            <span className="flex items-center gap-1">
              <Icon icon="solar:clock-circle-bold" className="h-3.5 w-3.5" />
              {timeDisplay}
            </span>
          </>
        )}

        {/* Konum */}
        {reminder.location && (
          <>
            <span>-</span>
            <span className="flex items-center gap-1 truncate">
              <Icon icon="solar:map-point-bold" className="h-3.5 w-3.5" />
              <span className="truncate">{reminder.location}</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// Kompakt anımsatıcı listesi bileşeni
interface CompactReminderListProps {
  reminders: Reminder[];
  onEdit?: (reminder: Reminder) => void;
  onDelete?: (reminder: Reminder) => void;
  onComplete?: (reminder: Reminder) => void;
  emptyMessage?: string;
}

export function CompactReminderList({
  reminders,
  onEdit,
  onDelete,
  onComplete,
  emptyMessage = "Henüz anımsatıcı eklenmemiş",
}: CompactReminderListProps) {
  if (reminders.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reminders.map((reminder) => (
        <CompactReminderCard
          key={reminder.id}
          reminder={reminder}
          onEdit={onEdit}
          onDelete={onDelete}
          onComplete={onComplete}
        />
      ))}
    </div>
  );
}
