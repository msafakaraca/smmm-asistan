"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Calculator, FolderCog, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/components/finansal-islemler/hooks/use-categories";
import { useCostDefinitions } from "@/components/finansal-islemler/hooks/use-cost-definitions";
import { useFinanceSettings } from "@/components/finansal-islemler/hooks/use-finance-settings";
import { useCustomers } from "@/components/finansal-islemler/hooks/use-customers";
import { CostDefinitionTable } from "@/components/finansal-islemler/muhasebe-ucretleri/cost-definition-table";
import { DefaultSettingsPanel } from "@/components/finansal-islemler/muhasebe-ucretleri/default-settings-panel";
import type { CostDefinition, CostDefinitionFormValues, BulkCostDefinitionRequest } from "@/components/finansal-islemler/shared/finance-types";

// Dialog'lar lazy load
const CostDefinitionForm = dynamic(
  () =>
    import(
      "@/components/finansal-islemler/muhasebe-ucretleri/cost-definition-form"
    ).then((m) => ({ default: m.CostDefinitionForm })),
  { ssr: false }
);
const BulkCostForm = dynamic(
  () =>
    import(
      "@/components/finansal-islemler/muhasebe-ucretleri/bulk-cost-form"
    ).then((m) => ({ default: m.BulkCostForm })),
  { ssr: false }
);
const CategoryManager = dynamic(
  () =>
    import(
      "@/components/finansal-islemler/shared/category-manager"
    ).then((m) => ({ default: m.CategoryManager })),
  { ssr: false }
);

export default function MuhasebeUcretleriPage() {
  // Hooks
  const { categories, loading: categoriesLoading } = useCategories();
  const {
    definitions,
    loading: definitionsLoading,
    createDefinition,
    updateDefinition,
    deleteDefinition,
    bulkCreate,
  } = useCostDefinitions();
  const { settings, loading: settingsLoading, saving: settingsSaving, updateSettings } = useFinanceSettings();
  const { customers, loading: customersLoading } = useCustomers();

  // Dialog state'leri
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState<CostDefinition | null>(null);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [isCharging, setIsCharging] = useState(false);

  // Yeni maliyet kalemi oluştur
  const handleCreate = useCallback(async (data: CostDefinitionFormValues) => {
    await createDefinition(data);
    toast.success("Maliyet kalemi oluşturuldu");
    setShowCreateForm(false);
  }, [createDefinition]);

  // Maliyet kalemi güncelle
  const handleUpdate = useCallback(async (data: CostDefinitionFormValues) => {
    if (!editingDefinition) return;
    await updateDefinition(editingDefinition.id, data);
    toast.success("Maliyet kalemi güncellendi");
    setEditingDefinition(null);
  }, [editingDefinition, updateDefinition]);

  // Maliyet kalemi sil
  const handleDelete = useCallback(async (def: CostDefinition) => {
    await deleteDefinition(def.id);
  }, [deleteDefinition]);

  // Aktif/Pasif toggle
  const handleToggleActive = useCallback(async (def: CostDefinition) => {
    try {
      await updateDefinition(def.id, { isActive: !def.isActive });
      toast.success(def.isActive ? "Maliyet kalemi pasif yapıldı" : "Maliyet kalemi aktif yapıldı");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Durum değiştirilemedi");
    }
  }, [updateDefinition]);

  // Toplu kayıt
  const handleBulkCreate = useCallback(async (data: BulkCostDefinitionRequest) => {
    return await bulkCreate(data);
  }, [bulkCreate]);

  // Manuel faturalama
  const handleAutoCharge = useCallback(async () => {
    try {
      setIsCharging(true);
      const res = await fetch("/api/finance/auto-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Faturalama başarısız");
      const data = await res.json();
      if (data.created > 0) {
        toast.success(`${data.created} adet borç kaydı oluşturuldu`);
      } else if (data.skipped > 0) {
        toast.info("Bu dönem için tüm faturalar zaten oluşturulmuş");
      } else {
        toast.info("Aktif maliyet tanımı bulunamadı");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Faturalama sırasında hata oluştu");
    } finally {
      setIsCharging(false);
    }
  }, []);

  const isLoading = categoriesLoading || customersLoading;

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Sayfa Başlığı */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Muhasebe Ücretleri</h1>
            <p className="text-muted-foreground">
              Mükelleflere tanımlanan maliyet kalemleri ve ücret yönetimi
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleAutoCharge}
            disabled={isCharging || definitionsLoading}
          >
            {isCharging ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-1.5" />
            )}
            {isCharging ? "Oluşturuluyor..." : "Bu Ay Faturaları Oluştur"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCategoryManager(true)}
          >
            <FolderCog className="h-4 w-4 mr-1.5" />
            Kategoriler
          </Button>
        </div>
      </div>

      {/* Varsayılan Ayarlar Paneli */}
      <DefaultSettingsPanel
        settings={settings}
        loading={settingsLoading}
        saving={settingsSaving}
        onSave={updateSettings}
      />

      {/* Maliyet Kalemleri Tablosu */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        <CostDefinitionTable
          definitions={definitions}
          categories={categories}
          loading={definitionsLoading}
          onEdit={(def) => setEditingDefinition(def)}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
          onCreateNew={() => setShowCreateForm(true)}
          onBulkCreate={() => setShowBulkForm(true)}
        />
      )}

      {/* Yeni Maliyet Kalemi Formu */}
      {showCreateForm && (
        <CostDefinitionForm
          open={showCreateForm}
          onOpenChange={setShowCreateForm}
          customers={customers}
          categories={categories}
          settings={settings}
          onSave={handleCreate}
        />
      )}

      {/* Düzenleme Formu */}
      {editingDefinition && (
        <CostDefinitionForm
          open={true}
          onOpenChange={() => setEditingDefinition(null)}
          customers={customers}
          categories={categories}
          settings={settings}
          editData={editingDefinition}
          onSave={handleUpdate}
        />
      )}

      {/* Toplu Ücret Belirleme */}
      {showBulkForm && (
        <BulkCostForm
          open={showBulkForm}
          onOpenChange={setShowBulkForm}
          customers={customers}
          categories={categories}
          settings={settings}
          onSubmit={handleBulkCreate}
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
