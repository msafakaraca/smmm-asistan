"use client";

import { FileSpreadsheet } from "lucide-react";
import { AccountStatementTable } from "@/components/finansal-islemler/hesap-dokumu/account-statement-table";

export default function HesapDokumuPage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Hesap Dökümü</h1>
          <p className="text-muted-foreground">
            Müşteri bazlı detaylı hesap dökümü ve Excel export
          </p>
        </div>
      </div>
      <AccountStatementTable />
    </div>
  );
}
