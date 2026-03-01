/**
 * AddCustomerDialog Component
 *
 * Yeni mükellef ekleme formu.
 */

import { useState, useCallback } from "react";
import { Icon } from "@iconify/react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NewCustomerForm, Customer } from "../types";

interface AddCustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (customer: Customer) => void;
}

export function AddCustomerDialog({
  isOpen,
  onClose,
  onAdd,
}: AddCustomerDialogProps) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<NewCustomerForm>({
    unvan: "",
    vknTckn: "",
    sirketTipi: "firma",
  });

  const handleSubmit = useCallback(async () => {
    if (!form.unvan.trim() || !form.vknTckn.trim()) {
      toast.error("Ünvan ve VKN/TCKN zorunludur");
      return;
    }

    setAdding(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const newCustomer = await res.json();
        toast.success("Mükellef eklendi");
        onAdd(newCustomer);

        // Müşteri detay sayfasını aç
        window.open(`/dashboard/mukellefler/${newCustomer.id}`, "_blank");

        // Formu sıfırla ve kapat
        setForm({ unvan: "", vknTckn: "", sirketTipi: "firma" });
        onClose();
      } else {
        const err = await res.json();
        toast.error(err.error || "Ekleme başarısız");
      }
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setAdding(false);
    }
  }, [form, onAdd, onClose]);

  if (!isOpen) return null;

  return (
    <Card className="border-2 border-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon icon="solar:user-plus-bold" className="h-5 w-5" />
          Yeni Mükellef Ekle
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Ünvan *</Label>
            <Input
              placeholder="Firma ünvanı"
              value={form.unvan}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, unvan: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>VKN/TCKN *</Label>
            <Input
              placeholder="Vergi/TC No"
              value={form.vknTckn}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, vknTckn: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Şirket Tipi</Label>
            <select
              className="w-full h-10 px-3 rounded-md border bg-background"
              value={form.sirketTipi}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sirketTipi: e.target.value }))
              }
            >
              <option value="firma">Firma</option>
              <option value="sahis">Şahıs</option>
              <option value="basit_usul">Basit Usul</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={adding}>
            {adding ? (
              <Icon
                icon="solar:refresh-bold"
                className="h-4 w-4 animate-spin mr-2"
              />
            ) : (
              <Icon icon="solar:user-plus-bold" className="h-4 w-4 mr-2" />
            )}
            Kaydet ve Aç
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
