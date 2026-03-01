"use client";

import React, { useState, useCallback } from "react";
import useSWR from "swr";
import { Icon } from "@iconify/react";
import { toast } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BEYANNAME_TYPES } from "@/components/bulk-send/types";

// SWR fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Types
interface CustomerGroupMember {
  id: string;
  unvan: string;
  kisaltma?: string | null;
  sirketTipi?: string;
  addedAt?: string;
}

interface CustomerGroup {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  icon?: string | null;
  sirketTipiFilter?: string | null;
  beyannameTypes?: string[];
  memberCount: number;
  members: CustomerGroupMember[];
  createdAt: string;
}

interface Customer {
  id: string;
  unvan: string;
  kisaltma?: string | null;
  sirketTipi?: string;
}

interface CustomerGroupsDialogProps {
  customers: Customer[];
  selectedCustomerIds?: string[];
  onGroupsChange?: () => void;
  disabled?: boolean;
}

// Color palette for groups
const GROUP_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#84CC16", // Lime
];

export function CustomerGroupsDialog({
  customers,
  selectedCustomerIds = [],
  onGroupsChange,
  disabled
}: CustomerGroupsDialogProps) {
  const [open, setOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "create" | "edit">("list");
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);

  // SWR ile grupları yükle - cache sayesinde anında açılır
  const { data: groups = [], mutate: refreshGroups, isLoading } = useSWR<CustomerGroup[]>(
    "/api/customer-groups",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 saniye içinde tekrar sorgulamaz
    }
  );

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: GROUP_COLORS[0],
    sirketTipiFilter: "" as string,
    beyannameTypes: [] as string[],
  });
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Loading durumu - ilk yükleme veya action loading
  const loading = isLoading || actionLoading;

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      color: GROUP_COLORS[0],
      sirketTipiFilter: "",
      beyannameTypes: [],
    });
    setSelectedMembers([]);
    setEditingGroup(null);
  };

  // Create group
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Grup adı zorunludur");
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch("/api/customer-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          sirketTipiFilter: formData.sirketTipiFilter || null,
          customerIds: selectedMembers,
          beyannameTypes: formData.beyannameTypes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Grup oluşturulamadı");
      }

      toast.success("Grup oluşturuldu");
      resetForm();
      setActiveTab("list");
      refreshGroups();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Update group
  const handleUpdate = async () => {
    if (!editingGroup || !formData.name.trim()) return;

    try {
      setActionLoading(true);

      // Member değişikliklerini hesapla
      const currentMemberIds = new Set(editingGroup.members.map((m) => m.id));
      const newMemberIds = new Set(selectedMembers);
      const addedMembers = selectedMembers.filter((id) => !currentMemberIds.has(id));
      const removedMembers = editingGroup.members
        .map((m) => m.id)
        .filter((id) => !newMemberIds.has(id));

      // Tüm API çağrılarını paralel yap
      const promises: Promise<Response>[] = [];

      // 1. Grup metadata'sını güncelle
      promises.push(
        fetch(`/api/customer-groups/${editingGroup.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            sirketTipiFilter: formData.sirketTipiFilter || null,
            beyannameTypes: formData.beyannameTypes,
          }),
        })
      );

      // 2. Yeni üyeleri ekle (varsa)
      if (addedMembers.length > 0) {
        promises.push(
          fetch(`/api/customer-groups/${editingGroup.id}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerIds: addedMembers }),
          })
        );
      }

      // 3. Çıkarılan üyeleri sil (varsa)
      if (removedMembers.length > 0) {
        promises.push(
          fetch(`/api/customer-groups/${editingGroup.id}/members`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerIds: removedMembers }),
          })
        );
      }

      // Tüm istekleri paralel çalıştır
      const results = await Promise.all(promises);

      // İlk sonuç grup güncelleme - hata kontrolü yap
      if (!results[0].ok) {
        const data = await results[0].json();
        throw new Error(data.error || "Grup güncellenemedi");
      }

      toast.success("Grup güncellendi");
      resetForm();
      setActiveTab("list");
      refreshGroups();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete group
  const handleDelete = async (groupId: string) => {
    if (!confirm("Bu grubu silmek istediğinize emin misiniz?")) return;

    try {
      setActionLoading(true);
      const res = await fetch(`/api/customer-groups/${groupId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Grup silinemedi");

      toast.success("Grup silindi");
      refreshGroups();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Add selected customers to group
  const handleAddToGroup = async (groupId: string) => {
    if (selectedCustomerIds.length === 0) {
      toast.error("Önce müşteri seçin");
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`/api/customer-groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds: selectedCustomerIds }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Üyeler eklenemedi");
      }

      const result = await res.json();
      toast.success(`${result.added} müşteri eklendi`);
      refreshGroups();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Remove member from group
  const handleRemoveMember = async (groupId: string, customerId: string) => {
    try {
      const res = await fetch(`/api/customer-groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds: [customerId] }),
      });

      if (!res.ok) throw new Error("Üye çıkarılamadı");

      toast.success("Üye gruptan çıkarıldı");
      refreshGroups();
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  // Edit group - fetch full details with members
  const startEdit = async (group: CustomerGroup) => {
    setActiveTab("edit");
    setActionLoading(true);
    setFormData({
      name: group.name,
      description: group.description || "",
      color: group.color,
      sirketTipiFilter: group.sirketTipiFilter || "",
      beyannameTypes: group.beyannameTypes || [],
    });

    try {
      // Fetch full group details with members
      const res = await fetch(`/api/customer-groups/${group.id}`);
      if (!res.ok) throw new Error("Grup detayları yüklenemedi");
      const fullGroup = await res.json();

      setEditingGroup(fullGroup);
      setSelectedMembers(fullGroup.members.map((m: CustomerGroupMember) => m.id));
    } catch (error) {
      toast.error("Grup detayları yüklenirken hata oluştu");
      setActiveTab("list");
    } finally {
      setActionLoading(false);
    }
  };

  // Filter customers for member selection
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.unvan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.kisaltma?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSirketTipi =
      !formData.sirketTipiFilter || c.sirketTipi === formData.sirketTipiFilter;

    return matchesSearch && matchesSirketTipi;
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={disabled}>
          <Icon icon="solar:users-group-rounded-bold" className="h-4 w-4" />
          Gruplar
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[1000px] max-w-[95vw] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="solar:users-group-rounded-bold" className="h-5 w-5 text-blue-600" />
            Müşteri Grupları
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b pb-2">
          <button
            onClick={() => { setActiveTab("list"); resetForm(); }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === "list"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icon icon="solar:list-bold" className="inline mr-2 h-4 w-4" />
            Gruplar
          </button>
          <button
            onClick={() => { setActiveTab("create"); resetForm(); }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === "create"
                ? "bg-green-100 text-green-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icon icon="solar:add-circle-bold" className="inline mr-2 h-4 w-4" />
            Yeni Grup
          </button>
        </div>

        {/* Content */}
        <div className="py-4">
          {/* List Tab */}
          {activeTab === "list" && (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
              ) : groups.length === 0 ? (
                <div className="text-center py-8">
                  <Icon icon="solar:folder-open-bold" className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-2 text-gray-500">Henüz grup oluşturulmamış</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setActiveTab("create")}
                  >
                    <Icon icon="solar:add-circle-bold" className="mr-2 h-4 w-4" />
                    İlk Grubu Oluştur
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: group.color + "20" }}
                          >
                            <Icon
                              icon={group.icon || "solar:folder-bold"}
                              className="h-5 w-5"
                              style={{ color: group.color }}
                            />
                          </div>
                          <div>
                            <h3 className="font-medium">{group.name}</h3>
                            {group.description && (
                              <p className="text-sm text-gray-500">{group.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {group.memberCount} üye
                              </Badge>
                              {group.sirketTipiFilter && (
                                <Badge variant="outline" className="text-xs">
                                  {group.sirketTipiFilter === "sahis" ? "Şahıs" :
                                   group.sirketTipiFilter === "firma" ? "Firma" : "Basit Usul"}
                                </Badge>
                              )}
                              {group.beyannameTypes && group.beyannameTypes.length > 0 && (
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                  <Icon icon="solar:document-text-bold" className="w-3 h-3 mr-1" />
                                  {group.beyannameTypes.length} beyanname
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedCustomerIds.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddToGroup(group.id)}
                              disabled={loading}
                            >
                              <Icon icon="solar:add-circle-bold" className="mr-1 h-4 w-4" />
                              Ekle ({selectedCustomerIds.length})
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(group)}
                          >
                            <Icon icon="solar:pen-bold" className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(group.id)}
                          >
                            <Icon icon="solar:trash-bin-trash-bold" className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Members preview */}
                      {group.members.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex flex-wrap gap-1">
                            {group.members.slice(0, 5).map((member) => (
                              <Badge
                                key={member.id}
                                variant="outline"
                                className="text-xs gap-1"
                              >
                                {member.kisaltma || member.unvan.substring(0, 15)}
                                <button
                                  onClick={() => handleRemoveMember(group.id, member.id)}
                                  className="hover:text-red-600"
                                >
                                  <Icon icon="solar:close-circle-bold" className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                            {group.members.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{group.members.length - 5} daha
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create/Edit Tab */}
          {(activeTab === "create" || activeTab === "edit") && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Grup Adı *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="örn: KDV-1 Mükellefler"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Şirket Tipi Filtresi</Label>
                  <select
                    value={formData.sirketTipiFilter}
                    onChange={(e) => setFormData({ ...formData, sirketTipiFilter: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Tümü</option>
                    <option value="sahis">Şahıs</option>
                    <option value="firma">Firma</option>
                    <option value="basit_usul">Basit Usul</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Açıklama</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Grup hakkında kısa açıklama..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Renk</Label>
                <div className="flex gap-3 flex-wrap p-2 -m-2">
                  {GROUP_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={cn(
                        "w-9 h-9 rounded-full transition-all flex-shrink-0 border-2 border-transparent",
                        formData.color === color
                          ? "ring-2 ring-offset-2 ring-blue-500 scale-110 border-white shadow-lg"
                          : "hover:scale-110 hover:shadow-md"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Beyanname Türleri Seçimi */}
              <div className="space-y-2">
                <Label>Varsayılan Beyanname Türleri</Label>
                <p className="text-xs text-gray-500">
                  Bu grup seçildiğinde otomatik olarak bu beyanname türleri filtreye eklenir
                </p>
                <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {BEYANNAME_TYPES.map((type) => (
                    <label
                      key={type.code}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.beyannameTypes.includes(type.code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              beyannameTypes: [...formData.beyannameTypes, type.code],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              beyannameTypes: formData.beyannameTypes.filter((t) => t !== type.code),
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{type.label}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {type.code}
                      </Badge>
                    </label>
                  ))}
                </div>
                {formData.beyannameTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.beyannameTypes.map((code) => (
                      <Badge key={code} variant="secondary" className="text-xs gap-1 bg-purple-100 text-purple-700">
                        {BEYANNAME_TYPES.find((t) => t.code === code)?.label || code}
                        <button
                          onClick={() =>
                            setFormData({
                              ...formData,
                              beyannameTypes: formData.beyannameTypes.filter((t) => t !== code),
                            })
                          }
                          className="hover:text-red-600"
                        >
                          <Icon icon="solar:close-circle-bold" className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Member selection (create and edit) */}
              <div className="space-y-2">
                <Label>
                  {activeTab === "edit" ? "Üyeleri Düzenle" : "Üyeler"} ({selectedMembers.length} seçili)
                </Label>
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Müşteri ara..."
                  className="mb-2"
                />
                <div className="max-h-64 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {filteredCustomers.map((customer) => (
                    <label
                      key={customer.id}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(customer.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMembers([...selectedMembers, customer.id]);
                          } else {
                            setSelectedMembers(selectedMembers.filter((id) => id !== customer.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {customer.kisaltma || customer.unvan}
                      </span>
                      {customer.sirketTipi && (
                        <Badge variant="outline" className="text-xs ml-auto">
                          {customer.sirketTipi === "sahis" ? "Şahıs" :
                           customer.sirketTipi === "firma" ? "Firma" : "Basit"}
                        </Badge>
                      )}
                    </label>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <p className="text-center text-gray-500 py-4">Müşteri bulunamadı</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => { setActiveTab("list"); resetForm(); }}
                >
                  İptal
                </Button>
                {activeTab === "create" ? (
                  <Button onClick={handleCreate} disabled={loading}>
                    {loading ? "Oluşturuluyor..." : "Grup Oluştur"}
                  </Button>
                ) : (
                  <Button onClick={handleUpdate} disabled={loading}>
                    {loading ? "Güncelleniyor..." : "Güncelle"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
