"use client";

import { useState, useCallback, useEffect } from "react";
import {
  AnnouncementCustomer,
  AnnouncementFilterState,
  SendResult,
  ChannelSettings,
  TemplateWithCount,
  ScheduledAnnouncementWithRelations,
} from "../types";

interface UseAnnouncementDataProps {
  filters: AnnouncementFilterState;
}

interface Customer {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  sirketTipi: string;
  email: string | null;
  telefon1: string | null;
  telefon2: string | null;
  status: string;
  groupMemberships?: Array<{
    group: {
      id: string;
      name: string;
    };
  }>;
}

export function useAnnouncementData({ filters }: UseAnnouncementDataProps) {
  const [customers, setCustomers] = useState<AnnouncementCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateWithCount[]>([]);
  const [scheduledAnnouncements, setScheduledAnnouncements] = useState<
    ScheduledAnnouncementWithRelations[]
  >([]);

  // Müşterileri getir
  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/customers");
      if (!response.ok) {
        throw new Error("Müşteriler yüklenirken hata oluştu");
      }

      const data: Customer[] = await response.json();

      // Verileri dönüştür
      const transformed: AnnouncementCustomer[] = data.map((c) => ({
        id: c.id,
        unvan: c.unvan,
        kisaltma: c.kisaltma,
        vknTckn: c.vknTckn,
        sirketTipi: c.sirketTipi,
        email: c.email,
        telefon1: c.telefon1,
        telefon2: c.telefon2,
        status: c.status,
        groups:
          c.groupMemberships?.map((gm) => ({
            groupId: gm.group.id,
            groupName: gm.group.name,
          })) || [],
      }));

      // Filtreleri uygula
      let filtered = transformed;

      // Şirket tipi filtresi
      if (filters.sirketTipiFilter.length > 0) {
        filtered = filtered.filter((c) =>
          filters.sirketTipiFilter.includes(c.sirketTipi)
        );
      }

      // Grup filtresi
      if (filters.groupIds.length > 0) {
        filtered = filtered.filter((c) =>
          c.groups.some((g) => filters.groupIds.includes(g.groupId))
        );
      }

      // Email var/yok filtresi
      if (filters.hasEmailFilter === "yes") {
        filtered = filtered.filter((c) => c.email && c.email.trim() !== "");
      } else if (filters.hasEmailFilter === "no") {
        filtered = filtered.filter((c) => !c.email || c.email.trim() === "");
      }

      // Telefon var/yok filtresi
      if (filters.hasPhoneFilter === "yes") {
        filtered = filtered.filter(
          (c) =>
            (c.telefon1 && c.telefon1.trim() !== "") ||
            (c.telefon2 && c.telefon2?.trim() !== "")
        );
      } else if (filters.hasPhoneFilter === "no") {
        filtered = filtered.filter(
          (c) =>
            (!c.telefon1 || c.telefon1.trim() === "") &&
            (!c.telefon2 || c.telefon2?.trim() === "")
        );
      }

      // Durum filtresi
      if (filters.statusFilter !== "all") {
        filtered = filtered.filter((c) =>
          filters.statusFilter === "active"
            ? c.status === "active"
            : c.status !== "active"
        );
      }

      // Arama filtresi
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.unvan.toLowerCase().includes(term) ||
            c.kisaltma?.toLowerCase().includes(term) ||
            c.vknTckn.includes(term) ||
            c.email?.toLowerCase().includes(term) ||
            c.telefon1?.includes(term)
        );
      }

      setCustomers(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Şablonları getir
  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch("/api/announcements/templates?activeOnly=true");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error("Şablonlar yüklenirken hata:", err);
    }
  }, []);

  // Zamanlı duyuruları getir
  const fetchScheduledAnnouncements = useCallback(async () => {
    try {
      const response = await fetch("/api/announcements/scheduled");
      if (response.ok) {
        const data = await response.json();
        setScheduledAnnouncements(data.data || []);
      }
    } catch (err) {
      console.error("Zamanlı duyurular yüklenirken hata:", err);
    }
  }, []);

  // İlk yükleme
  useEffect(() => {
    fetchCustomers();
    fetchTemplates();
    fetchScheduledAnnouncements();
  }, [fetchCustomers, fetchTemplates, fetchScheduledAnnouncements]);

  // Duyuru gönder
  const sendAnnouncement = useCallback(
    async (params: {
      customerIds: string[];
      subject?: string;
      content: string;
      channels: ChannelSettings;
    }): Promise<SendResult> => {
      const response = await fetch("/api/announcements/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Duyuru gönderilirken hata oluştu");
      }

      return response.json();
    },
    []
  );

  // Şablon oluştur
  const createTemplate = useCallback(
    async (params: {
      name: string;
      subject?: string;
      content: string;
      type?: string;
      channels?: string[];
    }) => {
      const response = await fetch("/api/announcements/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Şablon oluşturulurken hata oluştu");
      }

      await fetchTemplates();
      return response.json();
    },
    [fetchTemplates]
  );

  // Şablon sil
  const deleteTemplate = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/announcements/templates?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Şablon silinirken hata oluştu");
      }

      await fetchTemplates();
    },
    [fetchTemplates]
  );

  // Zamanlı duyuru oluştur
  const createScheduledAnnouncement = useCallback(
    async (params: {
      name: string;
      subject?: string;
      content: string;
      sendEmail: boolean;
      sendSms: boolean;
      sendWhatsApp: boolean;
      scheduledAt: string;
      repeatPattern?: string;
      repeatDay?: number;
      repeatEndDate?: string;
      targetType: string;
      customerIds?: string[];
      groupIds?: string[];
      templateId?: string;
    }) => {
      const response = await fetch("/api/announcements/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Zamanlı duyuru oluşturulurken hata oluştu");
      }

      await fetchScheduledAnnouncements();
      return response.json();
    },
    [fetchScheduledAnnouncements]
  );

  // Zamanlı duyuru durum değiştir
  const toggleScheduledAnnouncement = useCallback(
    async (id: string, action: "pause" | "resume" | "cancel") => {
      const response = await fetch(
        `/api/announcements/scheduled?id=${id}&action=${action}`,
        { method: "PATCH" }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Durum değiştirilirken hata oluştu");
      }

      await fetchScheduledAnnouncements();
    },
    [fetchScheduledAnnouncements]
  );

  // Zamanlı duyuru sil
  const deleteScheduledAnnouncement = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/announcements/scheduled?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Duyuru silinirken hata oluştu");
      }

      await fetchScheduledAnnouncements();
    },
    [fetchScheduledAnnouncements]
  );

  return {
    customers,
    isLoading,
    error,
    templates,
    scheduledAnnouncements,
    refetch: fetchCustomers,
    refetchTemplates: fetchTemplates,
    refetchScheduled: fetchScheduledAnnouncements,
    sendAnnouncement,
    createTemplate,
    deleteTemplate,
    createScheduledAnnouncement,
    toggleScheduledAnnouncement,
    deleteScheduledAnnouncement,
  };
}
