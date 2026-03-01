"use client";

import { memo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { useCategories } from "../hooks/use-categories";
import { categoryFormSchema, type CategoryFormValues, type FinanceCategory, type FinanceCategoryType, CATEGORY_TYPE_LABELS } from "./finance-types";

// Renk seçenekleri
const COLOR_OPTIONS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#F97316", "#06B6D4", "#EC4899", "#6B7280", "#92400E",
  "#1F2937", "#14B8A6",
];

interface CategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: FinanceCategoryType;
}

export const CategoryManager = memo(function CategoryManager({
  open,
  onOpenChange,
  initialTab = "INCOME",
}: CategoryManagerProps) {
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useCategories();
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [editMode, setEditMode] = useState<{ type: "create" | "edit"; category?: FinanceCategory } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const incomeCategories = categories.filter((c) => c.type === "INCOME");
  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  const handleCreate = (type: FinanceCategoryType) => {
    setEditMode({ type: "create" });
    // Tab'a göre type belirlenir - form içinde yapılıyor
  };

  const handleEdit = (category: FinanceCategory) => {
    setEditMode({ type: "edit", category });
  };

  const handleDelete = async (category: FinanceCategory) => {
    if (category.isDefault) {
      toast.error("Varsayılan kategoriler silinemez");
      return;
    }
    try {
      setDeleting(category.id);
      await deleteCategory(category.id);
      toast.success("Kategori silindi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kategori silinemedi");
    } finally {
      setDeleting(null);
    }
  };

  const renderCategoryTable = (items: FinanceCategory[], type: FinanceCategoryType) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} {CATEGORY_TYPE_LABELS[type].toLowerCase()} kategorisi
        </p>
        <Button size="sm" onClick={() => handleCreate(type)}>
          <Plus className="h-4 w-4 mr-1" />
          Yeni Kategori
        </Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">Renk</TableHead>
              <TableHead>Ad</TableHead>
              <TableHead className="w-24">Durum</TableHead>
              <TableHead className="w-20 text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Kategori bulunamadı
                </TableCell>
              </TableRow>
            ) : (
              items.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell>
                    <span
                      className="inline-block h-4 w-4 rounded-full border"
                      style={{ backgroundColor: cat.color || "#6B7280" }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>
                    {cat.isDefault && (
                      <Badge variant="secondary" className="text-xs">Varsayılan</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEdit(cat)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!cat.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(cat)}
                          disabled={deleting === cat.id}
                        >
                          {deleting === cat.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kategori Yönetimi</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="INCOME">
                  Gelir Kategorileri ({incomeCategories.length})
                </TabsTrigger>
                <TabsTrigger value="EXPENSE">
                  Gider Kategorileri ({expenseCategories.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="INCOME" className="mt-4">
                {renderCategoryTable(incomeCategories, "INCOME")}
              </TabsContent>
              <TabsContent value="EXPENSE" className="mt-4">
                {renderCategoryTable(expenseCategories, "EXPENSE")}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {editMode && (
        <CategoryFormDialog
          open={true}
          onOpenChange={() => setEditMode(null)}
          mode={editMode.type}
          category={editMode.category}
          defaultType={activeTab as FinanceCategoryType}
          onSave={async (data) => {
            if (editMode.type === "edit" && editMode.category) {
              await updateCategory(editMode.category.id, data);
              toast.success("Kategori güncellendi");
            } else {
              await createCategory({ ...data, type: activeTab as FinanceCategoryType });
              toast.success("Kategori oluşturuldu");
            }
            setEditMode(null);
          }}
        />
      )}
    </>
  );
});

// Kategori formu dialog
interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  category?: FinanceCategory;
  defaultType: FinanceCategoryType;
  onSave: (data: CategoryFormValues) => Promise<void>;
}

const CategoryFormDialog = memo(function CategoryFormDialog({
  open,
  onOpenChange,
  mode,
  category,
  defaultType,
  onSave,
}: CategoryFormDialogProps) {
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name || "",
      type: category?.type || defaultType,
      color: category?.color || COLOR_OPTIONS[0],
      icon: category?.icon || "",
    },
  });

  useEffect(() => {
    if (category) {
      setValue("name", category.name);
      setValue("type", category.type);
      setValue("color", category.color || COLOR_OPTIONS[0]);
      setValue("icon", category.icon || "");
    }
  }, [category, setValue]);

  const selectedColor = watch("color");

  const onSubmit = async (data: CategoryFormValues) => {
    try {
      setSaving(true);
      await onSave(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Yeni Kategori" : "Kategori Düzenle"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Kategori Adı <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Kategori adını girin"
              disabled={saving}
              className={errors.name ? "border-red-500" : ""}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Renk</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                    selectedColor === color
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setValue("color", color)}
                  disabled={saving}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              İptal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : mode === "create" ? (
                "Oluştur"
              ) : (
                "Güncelle"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
