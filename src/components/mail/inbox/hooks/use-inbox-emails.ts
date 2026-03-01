"use client";

import { useState, useEffect, useCallback } from "react";

export interface EmailListItem {
  id: string;
  provider: "gmail" | "outlook";
  providerId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  snippet: string | null;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  receivedAt: string;
  connectionId: string;
  customerId: string | null;
  customer: {
    id: string;
    kisaltma: string | null;
    unvan: string;
  } | null;
  connection: {
    id: string;
    email: string;
    provider: string;
  };
}

export interface EmailStats {
  total: number;
  unread: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UseInboxEmailsParams {
  connectionId?: string;
  folder?: string;
  search?: string;
  isRead?: boolean;
  customerId?: string;
  page?: number;
  limit?: number;
}

export function useInboxEmails(params: UseInboxEmailsParams = {}) {
  const [emails, setEmails] = useState<EmailListItem[]>([]);
  const [stats, setStats] = useState<EmailStats>({ total: 0, unread: 0 });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const {
    connectionId,
    folder = "inbox",
    search,
    isRead,
    customerId,
    page = 1,
    limit = 50,
  } = params;

  const fetchEmails = useCallback(async (silent = false) => {
    try {
      // İlk yüklemede isLoading, arka plan yenilemesinde isRefreshing
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const queryParams = new URLSearchParams();
      queryParams.set("page", page.toString());
      queryParams.set("limit", limit.toString());
      queryParams.set("folder", folder);

      if (connectionId) queryParams.set("connectionId", connectionId);
      if (search) queryParams.set("search", search);
      if (isRead !== undefined) queryParams.set("isRead", isRead.toString());
      if (customerId) queryParams.set("customerId", customerId);

      const response = await fetch(`/api/email/messages?${queryParams}`);

      if (!response.ok) {
        throw new Error("Failed to fetch emails");
      }

      const data = await response.json();

      setEmails(data.emails);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [connectionId, folder, search, isRead, customerId, page, limit]);

  // İlk yükleme ve parametreler değiştiğinde fetch
  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // Otomatik senkronizasyon - Her 30 saniyede bir (silent mode)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchEmails(true); // Silent mode - arka planda yenile
    }, 30000); // 30 saniye

    return () => clearInterval(interval);
  }, [fetchEmails]);

  const markAsRead = useCallback(async (emailId: string, read = true) => {
    try {
      const response = await fetch(`/api/email/messages/${emailId}/read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: read }),
      });

      if (!response.ok) {
        throw new Error("Failed to update read status");
      }

      // Update local state
      setEmails((prev) =>
        prev.map((e) => (e.id === emailId ? { ...e, isRead: read } : e))
      );

      // Update stats
      setStats((prev) => ({
        ...prev,
        unread: read ? prev.unread - 1 : prev.unread + 1,
      }));

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }, []);

  const markMultipleAsRead = useCallback(
    async (emailIds: string[], read = true) => {
      try {
        const response = await fetch(`/api/email/messages/bulk/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageIds: emailIds, isRead: read }),
        });

        if (!response.ok) {
          throw new Error("Failed to update read status");
        }

        // Update local state
        setEmails((prev) =>
          prev.map((e) =>
            emailIds.includes(e.id) ? { ...e, isRead: read } : e
          )
        );

        // Refresh stats
        await fetchEmails();

        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },
    [fetchEmails]
  );

  return {
    emails,
    stats,
    pagination,
    isLoading,
    isRefreshing,
    error,
    refresh: fetchEmails,
    markAsRead,
    markMultipleAsRead,
  };
}
