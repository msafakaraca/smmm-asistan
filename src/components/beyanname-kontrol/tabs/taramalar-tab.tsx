"use client";

import React from "react";
import { History, CheckCircle2, XCircle, Calendar, FileText, Download, Clock } from "lucide-react";

interface LastScanInfo {
  completedAt: string;
  startDate: string;
  endDate: string;
  totalBeyanname: number;
  downloaded: number;
  skipped: number;
  duration: number;
  success: boolean;
}

interface TaramalarTabProps {
  scanHistory: LastScanInfo[];
}

export const TaramalarTab = React.memo(function TaramalarTab({
  scanHistory,
}: TaramalarTabProps) {
  if (scanHistory.length === 0) {
    return (
      <div className="text-center py-12">
        <History
          className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3"
        />
        <h3 className="font-medium text-muted-foreground mb-1">
          Tarama geçmişi boş
        </h3>
        <p className="text-sm text-muted-foreground/70">
          İlk senkronizasyonunuzu başlattığınızda taramalar burada görünecek.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {scanHistory.map((scan) => {
        const date = new Date(scan.completedAt);
        const dateStr = date.toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
        const timeStr = date.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const rangeStart = new Date(scan.startDate).toLocaleDateString(
          "tr-TR",
          { day: "2-digit", month: "2-digit", year: "numeric" }
        );
        const rangeEnd = new Date(scan.endDate).toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

        const durationMin = Math.floor(scan.duration / 60);
        const durationSec = scan.duration % 60;
        const durationStr =
          durationMin > 0
            ? `${durationMin}dk ${durationSec}sn`
            : `${durationSec}sn`;

        return (
          <div
            key={scan.completedAt}
            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 shrink-0">
              {scan.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">{dateStr}</span>
              <span className="text-xs text-muted-foreground">{timeStr}</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {rangeStart} - {rangeEnd}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {scan.totalBeyanname} beyanname
              </span>
              {scan.downloaded > 0 && (
                <span className="flex items-center gap-1">
                  <Download className="h-3.5 w-3.5" />
                  {scan.downloaded} indirilen
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {durationStr}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
});
