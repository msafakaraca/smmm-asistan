"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SplitLayout } from "./split-layout";

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

export function RemindersPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12

  // Ay navigasyonu
  const goToPreviousMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const goToCurrentMonth = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  };

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  // Yıl seçenekleri (mevcut yıl ± 5)
  const yearOptions = Array.from({ length: 11 }, (_, i) => year - 5 + i);

  return (
    <div className="space-y-6">
      {/* Başlık ve Dönem Seçici */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Notlar & Anımsatıcılar
          </h1>
          <p className="text-muted-foreground">
            Mükelleflerinizle ilgili notları ve anımsatıcıları yönetin.
          </p>
        </div>

        {/* Dönem Seçici */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPreviousMonth}
            title="Önceki ay"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2">
            <Select
              value={String(month)}
              onValueChange={(value) => setMonth(parseInt(value))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((monthName, index) => (
                  <SelectItem key={index + 1} value={String(index + 1)}>
                    {monthName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(year)}
              onValueChange={(value) => setYear(parseInt(value))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            title="Sonraki ay"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {!isCurrentMonth && (
            <Button
              variant="ghost"
              size="sm"
              onClick={goToCurrentMonth}
              className="ml-2"
            >
              Bugün
            </Button>
          )}
        </div>
      </div>

      {/* Split Layout - Sol: Notlar, Sağ: Anımsatıcılar */}
      <SplitLayout year={year} month={month} />
    </div>
  );
}
