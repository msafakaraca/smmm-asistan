"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CreditCard, FolderCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { useCategories } from "@/components/finansal-islemler/hooks/use-categories";
import { useExpenses } from "@/components/finansal-islemler/hooks/use-expenses";
import { ExpenseTable } from "@/components/finansal-islemler/giderler/expense-table";
import type { Expense, ExpenseFormValues } from "@/components/finansal-islemler/shared/finance-types";

// Dialog'lar lazy load
const ExpenseForm = dynamic(
  () =>
    import(
      "@/components/finansal-islemler/giderler/expense-form"
    ).then((m) => ({ default: m.ExpenseForm })),
  { ssr: false }
);
const CategoryManager = dynamic(
  () =>
    import(
      "@/components/finansal-islemler/shared/category-manager"
    ).then((m) => ({ default: m.CategoryManager })),
  { ssr: false }
);

export default function GiderlerPage() {
  const { categories, loading: categoriesLoading } = useCategories();
  const {
    expenses,
    loading: expensesLoading,
    createExpense,
    updateExpense,
    deleteExpense,
  } = useExpenses();

  // Dialog state'leri
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // Yeni gider oluştur
  const handleCreate = async (data: ExpenseFormValues) => {
    await createExpense(data);
    toast.success("Gider oluşturuldu");
    setShowCreateForm(false);
  };

  // Gider güncelle
  const handleUpdate = async (data: ExpenseFormValues) => {
    if (!editingExpense) return;
    await updateExpense(editingExpense.id, data);
    toast.success("Gider güncellendi");
    setEditingExpense(null);
  };

  // Gider sil
  const handleDelete = async (expense: Expense) => {
    await deleteExpense(expense.id);
  };

  const isLoading = categoriesLoading;

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Sayfa Başlığı */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Giderler</h1>
            <p className="text-muted-foreground">
              Ofis giderleri takibi ve tekrarlayan gider yönetimi
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

      {/* Giderler Tablosu */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        <ExpenseTable
          expenses={expenses}
          categories={categories}
          loading={expensesLoading}
          onEdit={(expense) => setEditingExpense(expense)}
          onDelete={handleDelete}
          onCreateNew={() => setShowCreateForm(true)}
        />
      )}

      {/* Yeni Gider Formu */}
      {showCreateForm && (
        <ExpenseForm
          open={showCreateForm}
          onOpenChange={setShowCreateForm}
          categories={categories}
          onSave={handleCreate}
        />
      )}

      {/* Düzenleme Formu */}
      {editingExpense && (
        <ExpenseForm
          open={true}
          onOpenChange={() => setEditingExpense(null)}
          categories={categories}
          editData={editingExpense}
          onSave={handleUpdate}
        />
      )}

      {/* Kategori Yönetimi */}
      {showCategoryManager && (
        <CategoryManager
          open={showCategoryManager}
          onOpenChange={setShowCategoryManager}
          initialTab="EXPENSE"
        />
      )}
    </div>
  );
}
