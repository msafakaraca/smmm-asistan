"use client";

import { useState, useMemo, useCallback } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

// ============================================================================
// TYPES
// ============================================================================

interface CalendarDatePickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (date: string) => void;
  disabled?: boolean;
  eventDates?: string[]; // Dates that have events (for indicators)
  className?: string;
  minDate?: string; // Minimum selectable date (YYYY-MM-DD)
  maxDate?: string; // Maximum selectable date (YYYY-MM-DD)
}

interface DatePickerInputProps {
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
  placeholder?: string;
  eventDates?: string[];
  minDate?: string;
  maxDate?: string;
  className?: string;
}

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  disabled?: boolean;
  startPlaceholder?: string;
  endPlaceholder?: string;
  className?: string;
}

type ViewMode = "days" | "months" | "years";

// ============================================================================
// CONSTANTS
// ============================================================================

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

const MONTHS_SHORT_TR = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"
];

const WEEKDAYS_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDisplayDate(dateStr: string, placeholder: string = "Tarih seçin"): string {
  if (!dateStr) return placeholder;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return placeholder;
  return `${date.getDate()} ${MONTHS_TR[date.getMonth()]} ${date.getFullYear()}`;
}

function isDateInRange(dateStr: string, minDate?: string, maxDate?: string): boolean {
  if (!minDate && !maxDate) return true;
  const date = new Date(dateStr);
  if (minDate && date < new Date(minDate)) return false;
  if (maxDate && date > new Date(maxDate)) return false;
  return true;
}

// ============================================================================
// CALENDAR DATE PICKER (Full Calendar View)
// ============================================================================

export function CalendarDatePicker({
  value,
  onChange,
  disabled = false,
  eventDates = [],
  className,
  minDate,
  maxDate
}: CalendarDatePickerProps) {
  const initialDate = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>("days");

  // Yıl seçim panelinde gösterilecek dekadın başlangıcı
  const [decadeStart, setDecadeStart] = useState(() => {
    const y = initialDate.getFullYear();
    return y - (y % 10);
  });

  const selectedDate = value ? new Date(value) : null;

  // Gün görünümü için takvim günleri
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);

    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    const days: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      hasEvent: boolean;
      isDisabled: boolean;
    }> = [];

    const prevMonth = new Date(viewYear, viewMonth, 0);
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonth.getDate() - i;
      const dateStr = formatDate(prevMonth.getFullYear(), prevMonth.getMonth(), day);
      days.push({
        day,
        month: prevMonth.getMonth(),
        year: prevMonth.getFullYear(),
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        hasEvent: eventDates.includes(dateStr),
        isDisabled: !isDateInRange(dateStr, minDate, maxDate)
      });
    }

    const today = new Date();
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = formatDate(viewYear, viewMonth, day);
      const isToday =
        today.getFullYear() === viewYear &&
        today.getMonth() === viewMonth &&
        today.getDate() === day;
      const isSelected = selectedDate
        ? selectedDate.getFullYear() === viewYear &&
          selectedDate.getMonth() === viewMonth &&
          selectedDate.getDate() === day
        : false;

      days.push({
        day,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true,
        isToday,
        isSelected,
        hasEvent: eventDates.includes(dateStr),
        isDisabled: !isDateInRange(dateStr, minDate, maxDate)
      });
    }

    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const nextMonth = viewMonth + 1;
      const nextYear = nextMonth > 11 ? viewYear + 1 : viewYear;
      const normalizedMonth = nextMonth > 11 ? 0 : nextMonth;
      const dateStr = formatDate(nextYear, normalizedMonth, day);
      days.push({
        day,
        month: normalizedMonth,
        year: nextYear,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        hasEvent: eventDates.includes(dateStr),
        isDisabled: !isDateInRange(dateStr, minDate, maxDate)
      });
    }

    return days;
  }, [viewYear, viewMonth, selectedDate, eventDates, minDate, maxDate]);

  const handlePrevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  }, [viewMonth]);

  const handleNextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  }, [viewMonth]);

  const handleDayClick = useCallback((dayInfo: typeof calendarDays[0]) => {
    if (disabled || dayInfo.isDisabled) return;
    const dateStr = formatDate(dayInfo.year, dayInfo.month, dayInfo.day);
    onChange(dateStr);
  }, [disabled, onChange, calendarDays]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setViewMode("days");
    const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());
    if (isDateInRange(todayStr, minDate, maxDate)) {
      onChange(todayStr);
    }
  }, [minDate, maxDate, onChange]);

  // Başlık tıklama: days → months → years
  const handleHeaderClick = useCallback(() => {
    if (viewMode === "days") {
      setViewMode("months");
    } else if (viewMode === "months") {
      setDecadeStart(viewYear - (viewYear % 10));
      setViewMode("years");
    }
  }, [viewMode, viewYear]);

  // Ay seçimi
  const handleMonthSelect = useCallback((month: number) => {
    setViewMonth(month);
    setViewMode("days");
  }, []);

  // Yıl seçimi
  const handleYearSelect = useCallback((year: number) => {
    setViewYear(year);
    setDecadeStart(year - (year % 10));
    setViewMode("months");
  }, []);

  // Navigasyon (mod'a göre)
  const handlePrev = useCallback(() => {
    if (viewMode === "days") {
      handlePrevMonth();
    } else if (viewMode === "months") {
      setViewYear(y => y - 1);
    } else {
      setDecadeStart(d => d - 10);
    }
  }, [viewMode, handlePrevMonth]);

  const handleNext = useCallback(() => {
    if (viewMode === "days") {
      handleNextMonth();
    } else if (viewMode === "months") {
      setViewYear(y => y + 1);
    } else {
      setDecadeStart(d => d + 10);
    }
  }, [viewMode, handleNextMonth]);

  // Başlık metni
  const headerText = useMemo(() => {
    if (viewMode === "days") return `${MONTHS_TR[viewMonth]} ${viewYear}`;
    if (viewMode === "months") return `${viewYear}`;
    return `${decadeStart} - ${decadeStart + 9}`;
  }, [viewMode, viewMonth, viewYear, decadeStart]);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  return (
    <div
      className={cn(
        "rounded-2xl bg-popover text-popover-foreground p-4 shadow-lg",
        disabled && "opacity-60 pointer-events-none",
        className
      )}
    >
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={handlePrev}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          disabled={disabled}
        >
          <Icon icon="solar:alt-arrow-left-linear" className="h-5 w-5 text-muted-foreground" />
        </button>

        <button
          type="button"
          onClick={handleHeaderClick}
          disabled={disabled || viewMode === "years"}
          className={cn(
            "text-sm font-medium uppercase tracking-wider px-2 py-1 rounded-lg transition-colors",
            "text-muted-foreground",
            viewMode !== "years" && "hover:bg-muted cursor-pointer"
          )}
        >
          {headerText}
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          disabled={disabled}
        >
          <Icon icon="solar:alt-arrow-right-linear" className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* === GÜN GÖRÜNÜMÜ === */}
      {viewMode === "days" && (
        <>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS_TR.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium py-1 text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((dayInfo, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleDayClick(dayInfo)}
                disabled={disabled || dayInfo.isDisabled}
                className={cn(
                  "relative aspect-square flex items-center justify-center text-sm font-medium rounded-[14px] transition-all",
                  // Temel renkler
                  dayInfo.isCurrentMonth
                    ? "text-foreground"
                    : "text-muted-foreground/40",
                  // Seçili
                  dayInfo.isSelected && "bg-primary/15 text-primary font-bold",
                  // Bugün (seçili değilse)
                  dayInfo.isToday && !dayInfo.isSelected && "ring-2 ring-amber-400",
                  // Etkinlik (seçili/bugün değilse)
                  dayInfo.hasEvent && !dayInfo.isSelected && !dayInfo.isToday && dayInfo.isCurrentMonth && "ring-2 ring-blue-400",
                  // Hover
                  !dayInfo.isSelected && !dayInfo.isDisabled && "hover:bg-muted",
                  // Disabled
                  dayInfo.isDisabled && "cursor-not-allowed opacity-40"
                )}
              >
                {dayInfo.day}

                {/* Event indicator dot */}
                {dayInfo.hasEvent && !dayInfo.isSelected && dayInfo.isCurrentMonth && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-400" />
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* === AY GÖRÜNÜMÜ === */}
      {viewMode === "months" && (
        <div className="grid grid-cols-3 gap-2">
          {MONTHS_SHORT_TR.map((month, index) => {
            const isCurrentMonth = viewYear === currentYear && index === currentMonth;
            const isSelectedMonth = selectedDate
              ? selectedDate.getFullYear() === viewYear && selectedDate.getMonth() === index
              : false;

            return (
              <button
                key={month}
                type="button"
                onClick={() => handleMonthSelect(index)}
                disabled={disabled}
                className={cn(
                  "py-3 rounded-xl text-sm font-medium transition-all",
                  isSelectedMonth
                    ? "bg-primary/15 text-primary font-bold"
                    : isCurrentMonth
                      ? "ring-2 ring-amber-400 text-foreground"
                      : "text-foreground hover:bg-muted"
                )}
              >
                {month}
              </button>
            );
          })}
        </div>
      )}

      {/* === YIL GÖRÜNÜMÜ === */}
      {viewMode === "years" && (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i).map((year) => {
            const isInDecade = year >= decadeStart && year <= decadeStart + 9;
            const isCurrentYear = year === currentYear;
            const isSelectedYear = selectedDate
              ? selectedDate.getFullYear() === year
              : false;

            return (
              <button
                key={year}
                type="button"
                onClick={() => handleYearSelect(year)}
                disabled={disabled}
                className={cn(
                  "py-3 rounded-xl text-sm font-medium transition-all",
                  !isInDecade && "text-muted-foreground/40",
                  isInDecade && "text-foreground",
                  isSelectedYear
                    ? "bg-primary/15 text-primary font-bold"
                    : isCurrentYear
                      ? "ring-2 ring-amber-400"
                      : isInDecade && "hover:bg-muted"
                )}
              >
                {year}
              </button>
            );
          })}
        </div>
      )}

      {/* Today button */}
      <button
        type="button"
        onClick={goToToday}
        className="w-full mt-3 text-xs font-medium py-2 rounded-lg hover:bg-muted transition-colors text-primary"
        disabled={disabled}
      >
        Bugün
      </button>
    </div>
  );
}

// ============================================================================
// DATE PICKER INPUT (Popover with Calendar)
// ============================================================================

export function DatePickerInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Tarih seçin",
  eventDates = [],
  minDate,
  maxDate,
  className
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Icon icon="solar:calendar-bold" className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="truncate">{formatDisplayDate(value, placeholder)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarDatePicker
          value={value}
          onChange={(date) => {
            onChange(date);
            setOpen(false);
          }}
          disabled={disabled}
          eventDates={eventDates}
          minDate={minDate}
          maxDate={maxDate}
        />
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// DATE RANGE PICKER (Two Date Inputs)
// ============================================================================

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  disabled = false,
  startPlaceholder = "Başlangıç tarihi",
  endPlaceholder = "Bitiş tarihi",
  className
}: DateRangePickerProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)}>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Başlangıç Tarihi</label>
        <DatePickerInput
          value={startDate}
          onChange={onStartDateChange}
          disabled={disabled}
          placeholder={startPlaceholder}
          maxDate={endDate || undefined}
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Bitiş Tarihi</label>
        <DatePickerInput
          value={endDate}
          onChange={onEndDateChange}
          disabled={disabled}
          placeholder={endPlaceholder}
          minDate={startDate || undefined}
        />
      </div>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { MONTHS_TR, WEEKDAYS_TR, formatDisplayDate };
