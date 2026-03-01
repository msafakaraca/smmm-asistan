"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import type { TemplateWithCount, TemplateType, CreateTemplateRequest } from "../types";
import { TEMPLATE_VARIABLES } from "../types";

// ============================================
// TYPES
// ============================================

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: TemplateWithCount[];
  onSave: (template: CreateTemplateRequest, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

// ============================================
// CONSTANTS
// ============================================

const TEMPLATE_TYPES: { value: TemplateType; label: string }[] = [
  { value: "general", label: "Genel" },
  { value: "beyanname", label: "Beyanname" },
  { value: "vergi", label: "Vergi" },
  { value: "sgk", label: "SGK" },
  { value: "genel_duyuru", label: "Genel Duyuru" },
];

// ============================================
// COMPONENT
// ============================================

export function TemplateDialog({
  open,
  onOpenChange,
  templates,
  onSave,
  onDelete,
}: TemplateDialogProps) {
  // View state
  const [view, setView] = useState<"list" | "form">("list");
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithCount | null>(
    null
  );

  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<TemplateType>("general");
  const [isSaving, setIsSaving] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<TemplateWithCount | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset form when opening/closing
  useEffect(() => {
    if (!open) {
      setView("list");
      setEditingTemplate(null);
      resetForm();
    }
  }, [open]);

  // Reset form
  const resetForm = () => {
    setName("");
    setSubject("");
    setContent("");
    setType("general");
    setShowVariables(false);
  };

  // Open form for new template
  const handleNewTemplate = () => {
    setEditingTemplate(null);
    resetForm();
    setView("form");
  };

  // Open form for editing
  const handleEditTemplate = (template: TemplateWithCount) => {
    setEditingTemplate(template);
    setName(template.name);
    setSubject(template.subject || "");
    setContent(template.content);
    setType((template.type as TemplateType) || "general");
    setView("form");
  };

  // Insert variable into content
  const insertVariable = (variable: string) => {
    setContent((prev) => prev + variable);
  };

  // Handle save
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Şablon adı boş olamaz");
      return;
    }

    if (!content.trim()) {
      toast.error("Şablon içeriği boş olamaz");
      return;
    }

    setIsSaving(true);
    try {
      const templateData: CreateTemplateRequest = {
        name: name.trim(),
        subject: subject.trim() || undefined,
        content: content.trim(),
        type,
      };

      await onSave(templateData, editingTemplate?.id);

      toast.success(
        editingTemplate
          ? "Şablon güncellendi"
          : "Şablon oluşturuldu"
      );
      setView("list");
      resetForm();
      setEditingTemplate(null);
    } catch (error) {
      console.error("Kaydetme hatasi:", error);
      toast.error("Şablon kaydedilemedi");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete confirmation
  const handleDeleteClick = (template: TemplateWithCount) => {
    setTemplateToDelete(template);
    setDeleteConfirmOpen(true);
  };

  // Handle delete
  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(templateToDelete.id);
      toast.success("Şablon silindi");
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
    } catch (error) {
      console.error("Silme hatasi:", error);
      toast.error("Şablon silinemedi");
    } finally {
      setIsDeleting(false);
    }
  };

  // Back to list
  const handleBackToList = () => {
    setView("list");
    setEditingTemplate(null);
    resetForm();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon
                icon="solar:document-text-bold"
                className="w-5 h-5 text-blue-600"
              />
              {view === "list" ? "Şablon Yönetimi" : editingTemplate ? "Şablon Düzenle" : "Yeni Şablon"}
            </DialogTitle>
            <DialogDescription>
              {view === "list"
                ? "Duyuru şablonlarınızı yönetin"
                : editingTemplate
                ? "Mevcut şablonu güncelleyin"
                : "Yeni bir duyuru şablonu oluşturun"}
            </DialogDescription>
          </DialogHeader>

          {view === "list" ? (
            // Template List View
            <div className="space-y-4 py-4">
              {/* Add New Button */}
              <Button
                onClick={handleNewTemplate}
                variant="outline"
                className="w-full justify-start gap-2"
              >
                <Icon icon="solar:add-circle-bold" className="w-4 h-4" />
                Yeni Şablon Ekle
              </Button>

              {/* Template List */}
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon
                    icon="solar:document-text-linear"
                    className="w-12 h-12 mx-auto mb-3 opacity-50"
                  />
                  <p>Henüz şablon bulunmuyor</p>
                  <p className="text-sm">
                    Yeni bir şablon oluşturmak için yukarıdaki butonu kullanın
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-start justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm truncate">
                            {template.name}
                          </h4>
                          <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                            {TEMPLATE_TYPES.find((t) => t.value === template.type)
                              ?.label || "Genel"}
                          </span>
                        </div>
                        {template.subject && (
                          <p className="text-xs text-muted-foreground mb-1">
                            Konu: {template.subject}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {template.content}
                        </p>
                        {template._count?.scheduledAnnouncements !== undefined &&
                          template._count.scheduledAnnouncements > 0 && (
                            <p className="text-xs text-amber-600 mt-1">
                              {template._count.scheduledAnnouncements} zamanlı
                              duyuruda kullanılıyor
                            </p>
                          )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEditTemplate(template)}
                          title="Düzenle"
                        >
                          <Icon
                            icon="solar:pen-bold"
                            className="w-4 h-4 text-blue-600"
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeleteClick(template)}
                          title="Sil"
                        >
                          <Icon
                            icon="solar:trash-bin-trash-bold"
                            className="w-4 h-4 text-red-600"
                          />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Template Form View
            <div className="space-y-5 py-4">
              {/* Template Name */}
              <div className="space-y-2">
                <Label htmlFor="template-name">Şablon Adı *</Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Örneğin: KDV Beyanname Hatırlatması"
                  disabled={isSaving}
                />
              </div>

              {/* Template Type */}
              <div className="space-y-2">
                <Label htmlFor="template-type">Şablon Tipi</Label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as TemplateType)}
                >
                  <SelectTrigger id="template-type">
                    <SelectValue placeholder="Tip seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="template-subject">
                  Konu (Opsiyonel - Sadece Email)
                </Label>
                <Input
                  id="template-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email konusu..."
                  disabled={isSaving}
                />
              </div>

              {/* Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="template-content">Şablon İçeriği *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowVariables(!showVariables)}
                    className="text-xs"
                  >
                    <Icon
                      icon={
                        showVariables
                          ? "solar:alt-arrow-up-linear"
                          : "solar:alt-arrow-down-linear"
                      }
                      className="w-4 h-4 mr-1"
                    />
                    Değişkenler
                  </Button>
                </div>
                <Textarea
                  id="template-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Şablon içeriğini yazın..."
                  rows={6}
                  disabled={isSaving}
                  className="resize-none"
                />

                {/* Template Variables Help */}
                {showVariables && (
                  <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Kullanılabilir Değişkenler (tıkla ekle):
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {TEMPLATE_VARIABLES.map((variable) => (
                        <button
                          key={variable.key}
                          type="button"
                          onClick={() => insertVariable(variable.key)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-background border rounded hover:bg-accent transition-colors"
                          title={variable.description}
                        >
                          <code className="text-blue-600">{variable.key}</code>
                          <span className="text-muted-foreground">
                            {variable.label}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Bu değişkenler gönderim sırasında her mükellef için otomatik
                      olarak doldurulur.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            {view === "list" ? (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Kapat
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleBackToList}
                  disabled={isSaving}
                >
                  Geri
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={
                    isSaving || !name.trim() || !content.trim()
                  }
                  className="min-w-[100px]"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <Icon icon="solar:diskette-bold" className="w-4 h-4 mr-2" />
                      Kaydet
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Şablonu Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {templateToDelete?.name}
              </span>{" "}
              şablonunu silmek istediğinizden emin misiniz?
              {templateToDelete?._count?.scheduledAnnouncements !== undefined &&
                templateToDelete._count.scheduledAnnouncements > 0 && (
                  <span className="block mt-2 text-amber-600">
                    Uyarı: Bu şablon {templateToDelete._count.scheduledAnnouncements}{" "}
                    zamanlı duyuruda kullanılıyor.
                  </span>
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Siliniyor...
                </>
              ) : (
                "Sil"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
