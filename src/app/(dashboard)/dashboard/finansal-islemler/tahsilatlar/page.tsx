"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { HandCoins, FolderCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTransactions } from "@/components/finansal-islemler/hooks/use-transactions";
import { useChecks } from "@/components/finansal-islemler/hooks/use-checks";
import { useFinanceSettings } from "@/components/finansal-islemler/hooks/use-finance-settings";
import { useCategories } from "@/components/finansal-islemler/hooks/use-categories";
import { useCustomers } from "@/components/finansal-islemler/hooks/use-customers";
import { SummaryCards } from "@/components/finansal-islemler/tahsilatlar/summary-cards";
import { CollectionTable } from "@/components/finansal-islemler/tahsilatlar/collection-table";
import { CheckPortfolioTable } from "@/components/finansal-islemler/tahsilatlar/check-portfolio-table";
import { AutoChargeSettings } from "@/components/finansal-islemler/tahsilatlar/auto-charge-settings";
import type { CollectRequest } from "@/components/finansal-islemler/shared/finance-types";

// Dialog'lar lazy load - ilk yüklemede bundle'a dahil edilmez
const CollectionForm = dynamic(
  () =>
    import(
      "@/components/finansal-islemler/tahsilatlar/collection-form"
    ).then((m) => ({ default: m.CollectionForm })),
  { ssr: false }
);
const CategoryManager = dynamic(
  () =>
    import(
      "@/components/finansal-islemler/shared/category-manager"
    ).then((m) => ({ default: m.CategoryManager })),
  { ssr: false }
);

export default function TahsilatlarPage() {
  const {
    transactions,
    loading: transactionsLoading,
    summaryStats,
    fetchPendingDebts,
    collectPayment,
    fetchTransactions,
  } = useTransactions({ limit: 500 });

  const {
    checks,
    loading: checksLoading,
    updateCheckStatus,
    fetchChecks,
  } = useChecks();

  const { settings, loading: settingsLoading, saving: settingsSaving, updateSettings } = useFinanceSettings();
  const { categories, loading: categoriesLoading } = useCategories();
  const { customers, loading: customersLoading } = useCustomers();

  // Dialog state'leri
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [activeTab, setActiveTab] = useState("collections");

  // Tahsilat al - tablodan tetiklendiğinde
  const handleCollect = useCallback((customerId: string) => {
    setSelectedCustomerId(customerId);
    setShowCollectionForm(true);
  }, []);

  // Tahsilat kaydet
  const handleCollectSubmit = useCallback(async (data: CollectRequest) => {
    await collectPayment(data);
    fetchChecks();
  }, [collectPayment, fetchChecks]);

  // Çek durumu güncelle
  const handleUpdateCheckStatus = useCallback(async (id: string, newStatus: "COLLECTED" | "BOUNCED" | "RETURNED") => {
    await updateCheckStatus(id, newStatus);
    fetchTransactions();
  }, [updateCheckStatus, fetchTransactions]);

  const isLoading = transactionsLoading || customersLoading || categoriesLoading;

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Sayfa Başlığı */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HandCoins className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Tahsilatlar</h1>
            <p className="text-muted-foreground">
              Müşterilerden tahsilat kaydı ve çek portföy yönetimi
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCategoryManager(true)}
        >
          <FolderCog className="h-4 w-4 mr-1.5" />
          Kategoriler
        </Button>
      </div>

      {/* Otomatik Borçlandırma Ayarları */}
      <AutoChargeSettings
        settings={settings}
        loading={settingsLoading}
        saving={settingsSaving}
        onSave={updateSettings}
      />

      {/* Özet Kartları */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-[80px]" />
          <Skeleton className="h-[80px]" />
          <Skeleton className="h-[80px]" />
        </div>
      ) : (
        <SummaryCards
          pendingTotal={summaryStats.pendingTotal}
          thisMonthCollected={summaryStats.thisMonthCollected}
          overdueTotal={summaryStats.overdueTotal}
        />
      )}

      {/* Tabs: Tahsilatlar + Çek Portföyü */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="collections">Tahsilatlar</TabsTrigger>
            <TabsTrigger value="checks">Çek Portföyü</TabsTrigger>
          </TabsList>
          {activeTab === "collections" && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedCustomerId(undefined);
                setShowCollectionForm(true);
              }}
            >
              Tahsilat Al
            </Button>
          )}
        </div>

        <TabsContent value="collections" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-[400px] w-full" />
            </div>
          ) : (
            <CollectionTable
              transactions={transactions}
              loading={transactionsLoading}
              onCollect={handleCollect}
            />
          )}
        </TabsContent>

        <TabsContent value="checks" className="mt-4">
          {checksLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-[400px] w-full" />
            </div>
          ) : (
            <CheckPortfolioTable
              checks={checks}
              loading={checksLoading}
              onUpdateStatus={handleUpdateCheckStatus}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Tahsilat Formu */}
      {showCollectionForm && (
        <CollectionForm
          open={showCollectionForm}
          onOpenChange={setShowCollectionForm}
          customers={customers}
          preSelectedCustomerId={selectedCustomerId}
          fetchPendingDebts={fetchPendingDebts}
          onCollect={handleCollectSubmit}
        />
      )}

      {/* Kategori Yönetimi */}
      {showCategoryManager && (
        <CategoryManager
          open={showCategoryManager}
          onOpenChange={setShowCategoryManager}
          initialTab="INCOME"
        />
      )}
    </div>
  );
}
