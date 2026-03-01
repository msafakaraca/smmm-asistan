"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// Design system colors from JSON spec
const COLORS = {
  primary: {
    main: "#7F56D9",
    text: "#6941C6",
    light_bg: "#F9F5FF",
    border: "#E9D7FE"
  },
  neutral: {
    text_primary: "#101828",
    text_secondary: "#667085",
    background: "#FFFFFF",
    background_offset: "#F2F4F7",
    border: "#EAECF0"
  }
};

const WEEKDAYS_TR = ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"];
const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS_SHORT = ["Oca", "Sub", "Mar", "Nis", "May", "Haz", "Tem", "Agu", "Eyl", "Eki", "Kas", "Ara"];

// Default time slots
const DEFAULT_TIME_SLOTS = [
  "08:00", "09:00", "10:00",
  "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00",
  "17:00", "18:00", "19:00"
];

interface HorizontalDatePickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (date: string) => void;
  disabled?: boolean;
  className?: string;
}

export function HorizontalDatePicker({
  value,
  onChange,
  disabled = false,
  className
}: HorizontalDatePickerProps) {
  // Parse initial date or use today
  const initialDate = value ? new Date(value) : new Date();

  // Get Monday of the current week
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  };

  const [weekStart, setWeekStart] = useState(() => getWeekStart(initialDate));

  // Generate 7 days starting from weekStart
  const weekDays = useMemo(() => {
    const days: Array<{
      date: Date;
      dayNum: number;
      weekday: string;
      weekdayShort: string;
      month: string;
      isSelected: boolean;
      isToday: boolean;
      dateStr: string;
    }> = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedDate = value ? new Date(value) : null;
    if (selectedDate) selectedDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      d.setHours(0, 0, 0, 0);

      const dateStr = formatDate(d);
      const isToday = d.getTime() === today.getTime();
      const isSelected = selectedDate ? d.getTime() === selectedDate.getTime() : false;

      days.push({
        date: d,
        dayNum: d.getDate(),
        weekday: WEEKDAYS_TR[i],
        weekdayShort: WEEKDAYS_SHORT[i],
        month: MONTHS_SHORT[d.getMonth()],
        isSelected,
        isToday,
        dateStr
      });
    }

    return days;
  }, [weekStart, value]);

  function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const handlePrevWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() - 7);
    setWeekStart(newStart);
  };

  const handleNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() + 7);
    setWeekStart(newStart);
  };

  const handleDayClick = (dateStr: string) => {
    if (disabled) return;
    onChange(dateStr);
  };

  return (
    <div className={cn("w-full", disabled && "opacity-60 pointer-events-none", className)}>
      <div className="flex items-center gap-2">
        {/* Previous Week Button */}
        <button
          type="button"
          onClick={handlePrevWeek}
          disabled={disabled}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-[#EAECF0] bg-white hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-[#667085]" />
        </button>

        {/* Week Strip */}
        <div className="flex-1 overflow-hidden rounded-xl border border-[#EAECF0]">
          {/* Header Row - Weekdays */}
          <div
            className="grid grid-cols-7"
            style={{ backgroundColor: COLORS.neutral.background_offset }}
          >
            {weekDays.map((day, idx) => (
              <div
                key={`header-${idx}`}
                className={cn(
                  "py-1.5 text-center text-xs font-medium",
                  day.isSelected && "bg-[#7F56D9] text-white"
                )}
                style={{
                  color: day.isSelected ? "#FFFFFF" : COLORS.neutral.text_secondary,
                  borderTopLeftRadius: idx === 0 && day.isSelected ? "12px" : "0",
                  borderTopRightRadius: idx === 6 && day.isSelected ? "12px" : "0"
                }}
              >
                {day.weekday}
              </div>
            ))}
          </div>

          {/* Date Row */}
          <div className="grid grid-cols-7 bg-white">
            {weekDays.map((day, idx) => (
              <button
                key={`date-${idx}`}
                type="button"
                onClick={() => handleDayClick(day.dateStr)}
                disabled={disabled}
                className={cn(
                  "py-2 flex flex-col items-center justify-center transition-colors",
                  "hover:bg-[#F9F5FF]",
                  day.isSelected && "bg-[#7F56D9]",
                  day.isToday && !day.isSelected && "ring-2 ring-inset ring-[#7F56D9]"
                )}
                style={{
                  borderBottomLeftRadius: idx === 0 ? "12px" : "0",
                  borderBottomRightRadius: idx === 6 ? "12px" : "0"
                }}
              >
                <span
                  className={cn(
                    "text-base font-semibold",
                    day.isSelected ? "text-white" : "text-[#6941C6]"
                  )}
                >
                  {day.dayNum}
                </span>
                <span
                  className={cn(
                    "text-[10px]",
                    day.isSelected ? "text-white/80" : "text-[#667085]"
                  )}
                >
                  {day.month}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Next Week Button */}
        <button
          type="button"
          onClick={handleNextWeek}
          disabled={disabled}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-[#EAECF0] bg-white hover:bg-gray-50 transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-[#667085]" />
        </button>
      </div>
    </div>
  );
}

// Time Slot Picker Component
interface TimeSlotPickerProps {
  value: string; // HH:MM format
  onChange: (time: string) => void;
  disabled?: boolean;
  slots?: string[];
  className?: string;
}

export function TimeSlotPicker({
  value,
  onChange,
  disabled = false,
  slots = DEFAULT_TIME_SLOTS,
  className
}: TimeSlotPickerProps) {
  return (
    <div className={cn("w-full", disabled && "opacity-60 pointer-events-none", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-4 w-4 text-[#667085]" />
        <span className="text-sm font-medium text-[#101828]">Saat Secin</span>
      </div>

      {/* Time Slots Grid */}
      <div className="grid grid-cols-4 gap-2">
        {slots.map((slot) => {
          const isSelected = value === slot;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onChange(slot)}
              disabled={disabled}
              className={cn(
                "py-2 px-3 text-sm font-medium rounded-lg border transition-all",
                "hover:bg-[#F9F5FF] hover:border-[#7F56D9]",
                isSelected
                  ? "bg-[#7F56D9] border-[#7F56D9] text-white"
                  : "bg-white border-[#E9D7FE] text-[#6941C6]"
              )}
            >
              {slot}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Combined Date Time Picker for Reminders
interface DateTimePickerCombinedProps {
  date: string;
  time: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  disabled?: boolean;
  className?: string;
}

export function DateTimePickerCombined({
  date,
  time,
  onDateChange,
  onTimeChange,
  disabled = false,
  className
}: DateTimePickerCombinedProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <HorizontalDatePicker
        value={date}
        onChange={onDateChange}
        disabled={disabled}
      />
      <TimeSlotPicker
        value={time}
        onChange={onTimeChange}
        disabled={disabled}
      />
    </div>
  );
}
