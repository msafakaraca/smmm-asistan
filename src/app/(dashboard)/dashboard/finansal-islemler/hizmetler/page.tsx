"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Banknote, FolderCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { useCategories } from "@/components/finansal-islemler/hooks/use-categories";
import { useServices } from "@/components/finansal-islemler/hooks/use-services";
import { useFinanceSettings } from "@/components/finansal-islemler/hooks/use-finance-settings";
import { useCustomers } from "@/components/finansal-islemler/hooks/use-customers";
import { ServiceTable } from "@/components/finansal-islemler/hizmetler/service-table";
import type { FinancialTransaction, ServiceFormValues } from "@/components/finansal-islemler/shared/finance-types";

// Dialog'lar lazy load
const ServiceForm = dynamic(
  () =>
    import(
      "@/components/finansal-islemler/hizmetler/service-form"
    ).then((m) => ({ default: m.ServiceForm })),
  { ssr: false }
);
const CategoryManager = dynamic(
  () =>
    import(
      "@/components/finansal-islemler/shared/category-manager"
    ).then((m) => ({ default: m.CategoryManager })),
  { ssr: false }
);

export default function HizmetlerPage() {
  const { categories, loading: categoriesLoading } = useCategories();
  const {
    services,
    loading: servicesLoading,
    createService,
    updateService,
    deleteService,
  } = useServices();
  const { settings, loading: settingsLoading } = useFinanceSettings();
  const { customers, loading: customersLoading } = useCustomers();

  // Dialog state'leri
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingService, setEditingService] = useState<FinancialTransaction | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // Yeni hizmet oluştur
  const handleCreate = async (data: ServiceFormValues) => {
    await createService(data);
    toast.success("Hizmet oluşturuldu");
    setShowCreateForm(false);
  };

  // Hizmet güncelle
  const handleUpdate = async (data: ServiceFormValues) => {
    if (!editingService) return;
    await updateService(editingService.id, data);
    toast.success("Hizmet güncellendi");
    setEditingService(null);
  };

  // Hizmet iptal et
  const handleDelete = async (service: FinancialTransaction) => {
    await deleteService(service.id);
  };

  const isLoading = categoriesLoading || customersLoading || settingsLoading;

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Sayfa Başlığı */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Banknote className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Hizmetler</h1>
            <p className="text-muted-foreground">
              Mükelleflere ek hizmet faturalandırma
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

      {/* Hizmetler Tablosu */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        <ServiceTable
          services={services}
          categories={categories}
          loading={servicesLoading}
          onEdit={(service) => setEditingService(service)}
          onDelete={handleDelete}
          onCreateNew={() => setShowCreateForm(true)}
        />
      )}

      {/* Yeni Hizmet Formu */}
      {showCreateForm && (
        <ServiceForm
          open={showCreateForm}
          onOpenChange={setShowCreateForm}
          customers={customers}
          categories={categories}
          settings={settings}
          onSave={handleCreate}
        />
      )}

      {/* Düzenleme Formu */}
      {editingService && (
        <ServiceForm
          open={true}
          onOpenChange={() => setEditingService(null)}
          customers={customers}
          categories={categories}
          settings={settings}
          editData={editingService}
          onSave={handleUpdate}
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
