"use client";

import { memo } from "react";
import { Users, FileText, CheckSquare, Key } from "lucide-react";
import { StatsCard } from "./stats-card";
import type { DashboardStats } from "@/types/dashboard";

interface StatsGridProps {
  stats: DashboardStats | null;
  loading?: boolean;
}

export const StatsGrid = memo(function StatsGrid({ stats, loading = false }: StatsGridProps) {
  if (loading || !stats) {
    return (
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Yükleniyor..." value={0} loading />
        <StatsCard title="Yükleniyor..." value={0} loading />
        <StatsCard title="Yükleniyor..." value={0} loading />
        <StatsCard title="Yükleniyor..." value={0} loading />
      </div>
    );
  }

  const { customers, declarations, tasks, credentials } = stats;

  return (
    <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
      <StatsCard
        title="Toplam Müşteri"
        value={customers.total}
        description={`${customers.firma} Firma, ${customers.sahis} Şahıs, ${customers.basitUsul} Basit Usul`}
        icon={Users}
        iconClassName="bg-blue-100 dark:bg-blue-900/30"
      />

      <StatsCard
        title="Beyanname Durumu"
        value={`%${declarations.completionRate}`}
        description={`${declarations.verildi} verildi, ${declarations.bekliyor} bekliyor`}
        icon={FileText}
        iconClassName="bg-emerald-100 dark:bg-emerald-900/30"
      />

      <StatsCard
        title="Görevler"
        value={tasks.total}
        description={
          tasks.overdue > 0
            ? `${tasks.overdue} gecikmiş, ${tasks.highPriority} yüksek öncelik`
            : `${tasks.completed} tamamlandı, ${tasks.todoCount} bekliyor`
        }
        icon={CheckSquare}
        iconClassName={
          tasks.overdue > 0
            ? "bg-red-100 dark:bg-red-900/30"
            : "bg-amber-100 dark:bg-amber-900/30"
        }
      />

      <StatsCard
        title="Şifre Tamamlanma"
        value={`%${credentials.gibCompletionRate}`}
        description={`GİB: ${credentials.gibComplete}/${credentials.totalCustomers}, SGK: ${credentials.sgkComplete}/${credentials.totalCustomers}`}
        icon={Key}
        iconClassName="bg-purple-100 dark:bg-purple-900/30"
      />
    </div>
  );
});

StatsGrid.displayName = "StatsGrid";
