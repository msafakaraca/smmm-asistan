"use client";

import { useState, useEffect, useCallback } from "react";

export interface EmailConnection {
  id: string;
  provider: "gmail" | "outlook";
  email: string;
  lastSyncAt: string | null;
  syncStatus: "idle" | "syncing" | "error";
  syncError: string | null;
  createdAt: string;
  emailCount: number;
}

export function useEmailConnections() {
  const [connections, setConnections] = useState<EmailConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/email/connections");

      if (!response.ok) {
        throw new Error("Failed to fetch connections");
      }

      const data = await response.json();
      setConnections(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const deleteConnection = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/email/connections/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete connection");
      }

      // Remove from local state
      setConnections((prev) => prev.filter((c) => c.id !== id));

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }, []);

  const syncConnection = useCallback(async (id: string) => {
    try {
      // Update local state to show syncing
      setConnections((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, syncStatus: "syncing" as const } : c
        )
      );

      const response = await fetch("/api/email/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: id }),
      });

      if (!response.ok) {
        throw new Error("Failed to sync");
      }

      const result = await response.json();

      // Refresh connections to get updated state
      await fetchConnections();

      return result;
    } catch (err) {
      // Refresh to get actual state
      await fetchConnections();
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }, [fetchConnections]);

  const syncAllConnections = useCallback(async () => {
    try {
      // Update all to syncing
      setConnections((prev) =>
        prev.map((c) => ({ ...c, syncStatus: "syncing" as const }))
      );

      const response = await fetch("/api/email/sync", {
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error("Failed to sync");
      }

      const result = await response.json();

      // Refresh connections
      await fetchConnections();

      return result;
    } catch (err) {
      await fetchConnections();
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }, [fetchConnections]);

  return {
    connections,
    isLoading,
    error,
    refresh: fetchConnections,
    deleteConnection,
    syncConnection,
    syncAllConnections,
  };
}
