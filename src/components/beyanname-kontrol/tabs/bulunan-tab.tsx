"use client";

import React, { useRef } from "react";
import { FileText } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toTitleCase } from "@/lib/utils/text";
import type { BeyannameData } from "@/components/kontrol/types";

interface BulunanTabProps {
  beyannameler: BeyannameData[];
  startDate: string;
  endDate: string;
}

const ROW_HEIGHT = 40;

export const BulunanTab = React.memo(function BulunanTab({
  beyannameler,
  startDate,
  endDate,
}: BulunanTabProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: beyannameler.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  });

  if (beyannameler.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText
          className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3"
        />
        <h3 className="font-medium text-muted-foreground mb-1">
          Henüz beyanname bulunamadı
        </h3>
        <p className="text-sm text-muted-foreground/70">
          Senkronizasyon başlatıldığında bulunan beyannameler burada görünecek.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          {startDate} - {endDate} tarihleri arasındaki onaylı beyannameler
        </p>
        <span className="text-xs text-muted-foreground">
          {beyannameler.length} kayıt
        </span>
      </div>
      <div className="rounded-lg border overflow-hidden">
        {/* Sabit Thead */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-green-50 dark:bg-green-950/20">
              <th className="text-left p-2.5 font-medium w-[30%]">Beyanname Türü</th>
              <th className="text-left p-2.5 font-medium w-[18%]">TC/VKN</th>
              <th className="text-left p-2.5 font-medium w-[34%]">Ad Soyad/Unvan</th>
              <th className="text-left p-2.5 font-medium w-[18%]">Dönem</th>
            </tr>
          </thead>
        </table>

        {/* Virtual Scrollable Body */}
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ maxHeight: `${Math.min(beyannameler.length, 15) * ROW_HEIGHT + 2}px` }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const b = beyannameler[virtualRow.index];
              return (
                <div
                  key={virtualRow.index}
                  className="flex items-center border-b hover:bg-green-50/50 dark:hover:bg-green-950/10 text-sm absolute w-full"
                  style={{
                    height: `${ROW_HEIGHT}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="p-2.5 w-[30%] truncate">{b.beyannameTuru}</div>
                  <div className="p-2.5 w-[18%] font-mono text-xs">{b.tcVkn}</div>
                  <div className="p-2.5 w-[34%] truncate">
                    {toTitleCase(b.adSoyadUnvan || "").substring(0, 40)}
                  </div>
                  <div className="p-2.5 w-[18%]">{b.vergilendirmeDonemi}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
