"use client";

import { useState, useEffect, useCallback } from "react";

export interface EmailDetail {
  id: string;
  provider: "gmail" | "outlook";
  providerId: string;
  threadId: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  snippet: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  isRead: boolean;
  isStarred: boolean;
  labelIds: string[];
  folder: string;
  hasAttachments: boolean;
  attachments: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
  }> | null;
  receivedAt: string;
  customerId: string | null;
  customer: {
    id: string;
    kisaltma: string | null;
    unvan: string;
    email: string | null;
  } | null;
  connection: {
    id: string;
    email: string;
    provider: string;
  };
}

export function useEmailDetail(emailId: string | null) {
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchEmail = useCallback(async () => {
    if (!emailId) {
      setEmail(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/email/messages/${emailId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch email");
      }

      const data = await response.json();
      setEmail(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [emailId]);

  useEffect(() => {
    fetchEmail();
  }, [fetchEmail]);

  const updateEmail = useCallback(
    async (updates: { isRead?: boolean; isStarred?: boolean; customerId?: string | null }) => {
      if (!emailId) return { success: false, error: "No email selected" };

      try {
        const response = await fetch(`/api/email/messages/${emailId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error("Failed to update email");
        }

        const data = await response.json();

        // Update local state
        setEmail((prev) => (prev ? { ...prev, ...updates } : null));

        return { success: true, data };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },
    [emailId]
  );

  const toggleStarred = useCallback(async () => {
    if (!email) return { success: false };
    return updateEmail({ isStarred: !email.isStarred });
  }, [email, updateEmail]);

  const linkToCustomer = useCallback(
    async (customerId: string | null) => {
      return updateEmail({ customerId });
    },
    [updateEmail]
  );

  return {
    email,
    isLoading,
    error,
    refresh: fetchEmail,
    updateEmail,
    toggleStarred,
    linkToCustomer,
  };
}
