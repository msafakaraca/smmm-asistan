"use client";

import React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { toTitleCase } from "@/lib/utils/text";
import type { BeyannameData } from "@/components/kontrol/types";

interface EslesmeyenlerTabProps {
  unmatchedDeclarations: BeyannameData[];
}

export const EslesmeyenlerTab = React.memo(function EslesmeyenlerTab({
  unmatchedDeclarations,
}: EslesmeyenlerTabProps) {
  if (unmatchedDeclarations.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2
          className="h-12 w-12 mx-auto text-green-400/60 mb-3"
        />
        <h3 className="font-medium text-muted-foreground mb-1">
          Eşleştirilemeyen beyanname yok
        </h3>
        <p className="text-sm text-muted-foreground/70">
          Tüm beyannameler başarıyla mükelleflerle eşleştirildi veya henüz tarama yapılmadı.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Aşağıdaki beyannameler sistemdeki mükelleflerle eşleştirilemedi. VKN/TCKN bilgilerini kontrol edin.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-amber-50 dark:bg-amber-950/20">
              <th className="text-left p-2.5 font-medium">Beyanname Türü</th>
              <th className="text-left p-2.5 font-medium">TC/VKN</th>
              <th className="text-left p-2.5 font-medium">Ad Soyad/Unvan</th>
              <th className="text-left p-2.5 font-medium">Dönem</th>
            </tr>
          </thead>
          <tbody>
            {unmatchedDeclarations.map((b, i) => (
              <tr
                key={i}
                className="border-b hover:bg-amber-50/50 dark:hover:bg-amber-950/10"
              >
                <td className="p-2.5">{b.beyannameTuru}</td>
                <td className="p-2.5 font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {b.tcVkn}
                </td>
                <td className="p-2.5">
                  {toTitleCase(b.adSoyadUnvan).substring(0, 40)}
                </td>
                <td className="p-2.5">{b.vergilendirmeDonemi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
