"use client";

import { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface TimePickerInputProps {
  value: string; // HH:mm format
  onChange: (time: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function TimePickerInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Saat seçin",
  className
}: TimePickerInputProps) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("09");
  const [minutes, setMinutes] = useState("00");
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);

  // Parse value on mount/change
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":");
      setHours(h || "09");
      setMinutes(m || "00");
    }
  }, [value]);

  // Scroll to selected time when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const hourEl = hoursRef.current?.querySelector(`[data-hour="${hours}"]`);
        const minEl = minutesRef.current?.querySelector(`[data-minute="${minutes}"]`);
        hourEl?.scrollIntoView({ block: "center", behavior: "instant" });
        minEl?.scrollIntoView({ block: "center", behavior: "instant" });
      }, 50);
    }
  }, [open, hours, minutes]);

  const handleTimeSelect = (type: "hour" | "minute", val: string) => {
    if (type === "hour") {
      setHours(val);
      onChange(`${val}:${minutes}`);
    } else {
      setMinutes(val);
      onChange(`${hours}:${val}`);
      // Dakika seçildiğinde popover'ı otomatik kapat
      setOpen(false);
    }
  };

  const formatDisplayTime = (time: string): string => {
    if (!time) return placeholder;
    return time;
  };

  const hourOptions = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, "0")
  );

  const minuteOptions = Array.from({ length: 4 }, (_, i) =>
    String(i * 15).padStart(2, "0")
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-start text-left font-normal h-10",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Icon icon="solar:clock-circle-bold" className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="truncate">{formatDisplayTime(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <div className="flex p-2 gap-2 bg-popover rounded-md shadow-lg">
          {/* Hours */}
          <div
            ref={hoursRef}
            className="h-32 overflow-y-auto scrollbar-thin"
          >
            {hourOptions.map((hour) => (
              <button
                key={hour}
                type="button"
                data-hour={hour}
                onClick={() => handleTimeSelect("hour", hour)}
                className={cn(
                  "w-9 py-1 text-sm rounded transition-colors block text-center",
                  hours === hour
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted"
                )}
              >
                {hour}
              </button>
            ))}
          </div>

          <div className="flex items-center text-muted-foreground font-bold">:</div>

          {/* Minutes */}
          <div
            ref={minutesRef}
            className="h-32 overflow-y-auto scrollbar-thin"
          >
            {minuteOptions.map((minute) => (
              <button
                key={minute}
                type="button"
                data-minute={minute}
                onClick={() => handleTimeSelect("minute", minute)}
                className={cn(
                  "w-9 py-1 text-sm rounded transition-colors block text-center",
                  minutes === minute
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted"
                )}
              >
                {minute}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
