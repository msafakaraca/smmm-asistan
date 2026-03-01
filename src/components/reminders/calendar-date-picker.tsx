"use client";

/**
 * Re-export from UI component for backward compatibility
 *
 * Bu dosya artık src/components/ui/date-picker.tsx'den
 * re-export yapıyor. Tüm date picker bileşenleri
 * merkezi olarak UI klasöründe tanımlı.
 */

export {
  CalendarDatePicker,
  DatePickerInput,
  DateRangePicker,
  MONTHS_TR,
  WEEKDAYS_TR,
  formatDisplayDate,
} from "@/components/ui/date-picker";
