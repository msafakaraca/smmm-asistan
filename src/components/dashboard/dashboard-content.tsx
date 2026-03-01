"use client";

import Link from "next/link";
import { ClipboardList, CheckSquare, Bot, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "./hooks/use-dashboard-data";
import { StatsGrid } from "./stats-grid";
import { AlertsPanel } from "./alerts-panel";
import { ActivityFeed } from "./activity-feed";
import { UpcomingPanel } from "./upcoming-panel";
import { DeclarationStatusPanel } from "./charts/declaration-status-panel";
import { TakipProgressPanel } from "./charts/takip-progress-panel";
import { CustomerBarChart } from "./charts/customer-bar-chart";
import { PeriodSelector } from "./period-selector";
import { TaskSummaryWidget } from "./tasks/task-summary-widget";
import { QuickActionsPanel } from "./quick-actions-panel";
import { BulkSendWidget } from "./bulk-send-widget";
import { AnnouncementWidget } from "./announcement-widget";

interface DashboardContentProps {
  session: {
    user: {
      name?: string | null;
      tenantName?: string;
    };
  };
}

export function DashboardContent({ session }: DashboardContentProps) {
  const {
    stats,
    alerts,
    activities,
    upcomingEvents,
    upcomingTasks,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    statsLoading,
    alertsLoading,
    activitiesLoading,
    upcomingLoading,
    refresh,
  } = useDashboardData();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Hoş Geldiniz, {session.user.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {session.user.tenantName} ofis paneline hoş geldiniz
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector
            year={selectedYear}
            month={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={refresh}
            className="h-8 w-8"
            title="Yenile"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <StatsGrid stats={stats} loading={statsLoading} />

      {/* GİB/SGK Hızlı İşlemler Paneli */}
      <QuickActionsPanel />

      {/* Beyanname Durumu + Takip Çizelgesi + Müşteri Portföyü */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DeclarationStatusPanel period={stats?.period} />
        <TakipProgressPanel period={stats?.period} />
        <CustomerBarChart
          stats={stats?.customers || null}
          credentials={stats?.credentials || null}
          loading={statsLoading}
        />
      </div>

      {/* Son Aktiviteler + Toplu Gönderim + Duyuru Merkezi */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ActivityFeed activities={activities} loading={activitiesLoading} className="h-[420px]" />
        <BulkSendWidget />
        <AnnouncementWidget className="h-[420px]" />
      </div>

      {/* Görev Özeti + Uyarılar + Yaklaşan */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="min-h-[350px] xl:min-h-[420px]">
          <TaskSummaryWidget className="h-full" />
        </div>
        <div className="min-h-[350px] xl:min-h-[420px]">
          <AlertsPanel alerts={alerts} loading={alertsLoading} className="h-full" />
        </div>
        <div className="min-h-[350px] xl:min-h-[420px]">
          <UpcomingPanel
            events={upcomingEvents}
            tasks={upcomingTasks}
            loading={upcomingLoading}
            className="h-full"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Hızlı Erişim</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/dashboard/takip">
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardHeader className="pb-3">
                <ClipboardList className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">Takip Çizelgesi</CardTitle>
                <CardDescription>
                  Aylık muhasebe işlemlerini müşteri bazlı takip edin
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/kontrol">
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardHeader className="pb-3">
                <CheckSquare className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">Beyanname Kontrol</CardTitle>
                <CardDescription>
                  GİB portalından beyanname durumlarını takip edin
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/ai">
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardHeader className="pb-3">
                <Bot className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">AI Asistan</CardTitle>
                <CardDescription>
                  Vergi mevzuatı sorularınızı yapay zekaya sorun
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
