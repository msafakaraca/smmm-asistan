/**
 * useBeyannameEdit Hook
 *
 * Inline düzenleme (sıra no, ünvan) işlemlerini yönetir.
 */

import { useState, useCallback } from "react";
import { toast } from "@/components/ui/sonner";
import type { Customer } from "../types";

interface UseBeyannameEditOptions {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

export function useBeyannameEdit({
  customers,
  setCustomers,
}: UseBeyannameEditOptions) {
  // Inline edit states
  const [editingSiraNo, setEditingSiraNo] = useState<string | null>(null);
  const [editingSiraNoValue, setEditingSiraNoValue] = useState("");
  const [editingUnvan, setEditingUnvan] = useState<string | null>(null);
  const [editingUnvanValue, setEditingUnvanValue] = useState("");

  // Sıra No düzenleme
  const handleSiraNoClick = useCallback(
    (customerId: string, currentSiraNo: string | null) => {
      setEditingSiraNo(customerId);
      setEditingSiraNoValue(currentSiraNo || "");
    },
    []
  );

  const handleSiraNoSave = useCallback(
    async (customerId: string) => {
      const trimmedValue = editingSiraNoValue.trim();

      // Hiçbir değişiklik yoksa kapat
      const customer = customers.find((c) => c.id === customerId);
      if (customer && (customer.siraNo || "") === trimmedValue) {
        setEditingSiraNo(null);
        return;
      }

      try {
        const res = await fetch(`/api/customers/${customerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siraNo: trimmedValue || null }),
        });

        if (res.ok) {
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === customerId ? { ...c, siraNo: trimmedValue || null } : c
            )
          );
          toast.success("Sıra numarası güncellendi");
        } else {
          toast.error("Güncelleme başarısız");
        }
      } catch {
        toast.error("Bir hata oluştu");
      }

      setEditingSiraNo(null);
    },
    [editingSiraNoValue, customers, setCustomers]
  );

  // Ünvan düzenleme
  const handleUnvanClick = useCallback(
    (customerId: string, currentUnvan: string) => {
      setEditingUnvan(customerId);
      setEditingUnvanValue(currentUnvan);
    },
    []
  );

  const handleUnvanSave = useCallback(
    async (customerId: string) => {
      const trimmedValue = editingUnvanValue.trim();

      if (!trimmedValue) {
        toast.error("Ünvan boş bırakılamaz");
        setEditingUnvan(null);
        return;
      }

      // Hiçbir değişiklik yoksa kapat
      const customer = customers.find((c) => c.id === customerId);
      if (customer && customer.unvan === trimmedValue) {
        setEditingUnvan(null);
        return;
      }

      try {
        const res = await fetch(`/api/customers/${customerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unvan: trimmedValue }),
        });

        if (res.ok) {
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === customerId ? { ...c, unvan: trimmedValue } : c
            )
          );
          toast.success("Ünvan güncellendi");
        } else {
          toast.error("Güncelleme başarısız");
        }
      } catch {
        toast.error("Bir hata oluştu");
      }

      setEditingUnvan(null);
    },
    [editingUnvanValue, customers, setCustomers]
  );

  // Tüm müşterileri yeniden numaralandır
  const handleRenumberAll = useCallback(async () => {
    const sortedCustomers = [...customers].sort((a, b) => {
      const aNum = parseInt(a.siraNo || "9999", 10);
      const bNum = parseInt(b.siraNo || "9999", 10);
      return aNum - bNum;
    });

    const updatedCustomers = sortedCustomers.map((c, index) => ({
      ...c,
      siraNo: String(index + 1),
      sortOrder: index + 1,
    }));

    setCustomers(updatedCustomers);

    try {
      const updatePromises = updatedCustomers.map((c, index) =>
        fetch(`/api/customers/${c.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siraNo: String(index + 1), sortOrder: index + 1 }),
        })
      );

      await Promise.all(updatePromises);
      toast.success("Tüm mükellefler yeniden numaralandırıldı");
    } catch {
      toast.error("Numaralandırma kaydedilemedi");
    }
  }, [customers, setCustomers]);

  return {
    // Sıra No edit
    editingSiraNo,
    setEditingSiraNo,
    editingSiraNoValue,
    setEditingSiraNoValue,
    handleSiraNoClick,
    handleSiraNoSave,

    // Ünvan edit
    editingUnvan,
    setEditingUnvan,
    editingUnvanValue,
    setEditingUnvanValue,
    handleUnvanClick,
    handleUnvanSave,

    // Renumber
    handleRenumberAll,
  };
}
