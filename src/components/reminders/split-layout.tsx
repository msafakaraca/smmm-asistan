"use client";

import { NotesPanel } from "./notes-panel";
import { RemindersPanel } from "./reminders-panel";

interface SplitLayoutProps {
  year: number;
  month: number;
}

export function SplitLayout({ year, month }: SplitLayoutProps) {
  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Sol Panel - Notlar */}
      <div className="flex-1 min-h-[50vh] lg:min-h-0 lg:border-r overflow-hidden">
        <NotesPanel year={year} month={month} />
      </div>

      {/* Sağ Panel - Anımsatıcılar */}
      <div className="flex-1 min-h-[50vh] lg:min-h-0 border-t lg:border-t-0 overflow-hidden">
        <RemindersPanel year={year} month={month} />
      </div>
    </div>
  );
}
