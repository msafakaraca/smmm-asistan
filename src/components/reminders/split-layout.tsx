"use client";

import { NotesPanel } from "./notes-panel";
import { RemindersPanel } from "./reminders-panel";

interface SplitLayoutProps {
  year: number;
  month: number;
}

export function SplitLayout({ year, month }: SplitLayoutProps) {
  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-10rem)] xl:h-[calc(100vh-12rem)] gap-4 lg:gap-4 xl:gap-6">
      {/* Sol Panel - Notlar */}
      <div className="flex-1 min-h-[50vh] lg:min-h-0 bg-card rounded-xl border overflow-hidden">
        <NotesPanel year={year} month={month} />
      </div>

      {/* Sağ Panel - Anımsatıcılar */}
      <div className="flex-1 min-h-[50vh] lg:min-h-0 bg-card rounded-xl border overflow-hidden">
        <RemindersPanel year={year} month={month} />
      </div>
    </div>
  );
}
