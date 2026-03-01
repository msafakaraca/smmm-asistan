"use client";

import { useState, useEffect, useCallback } from "react";

export interface AnnouncementChannelStats {
  total: number;
  sent: number;
}

export interface AnnouncementUpcoming {
  id: string;
  name: string;
  nextExecuteAt: string;
  channels: string[];
}

export interface AnnouncementWidgetData {
  total: number;
  sent: number;
  failed: number;
  byChannel: {
    email: AnnouncementChannelStats;
    sms: AnnouncementChannelStats;
    whatsapp: AnnouncementChannelStats;
  };
  upcoming: AnnouncementUpcoming[];
}

export function useAnnouncementWidgetData() {
  const [data, setData] = useState<AnnouncementWidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/announcement-stats");
      if (!res.ok) throw new Error("Veri yüklenemedi");
      const result: AnnouncementWidgetData = await res.json();
      setData(result);
    } catch (err) {
      console.error("Duyuru widget verisi yüklenemedi:", err);
      setError("Veriler yüklenirken bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
