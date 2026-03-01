"use client";

import { memo } from "react";
import { CustomerBarChart } from "./customer-bar-chart";
import { TakipProgressPanel } from "./takip-progress-panel";
import type { DashboardStats } from "@/types/dashboard";

interface ChartsSectionProps {
  stats: DashboardStats | null;
  loading?: boolean;
}

export const ChartsSection = memo(function ChartsSection({ stats, loading = false }: ChartsSectionProps) {
  return (
    <>
      <div>
        <CustomerBarChart stats={stats?.customers || null} credentials={stats?.credentials || null} loading={loading} className="h-full" />
      </div>
      <div>
        <TakipProgressPanel period={stats?.period} className="h-full" />
      </div>
    </>
  );
});

ChartsSection.displayName = "ChartsSection";
