"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@iconify/react";
import { toast } from "@/components/ui/sonner";

import { useEmailConnections } from "./hooks/use-email-connections";
import { useInboxEmails } from "./hooks/use-inbox-emails";
import { useEmailDetail } from "./hooks/use-email-detail";
import { EmailList } from "./email-list";
import { EmailDetailComponent } from "./email-detail";
import { ConnectionSelector } from "./connection-selector";

// Full screen hook - removes parent padding for mail page
function useFullScreen() {
  useEffect(() => {
    const mainElement = document.querySelector("main");
    if (mainElement) {
      mainElement.style.padding = "0";
      mainElement.style.background = "transparent";
      mainElement.style.overflow = "hidden";
    }
    return () => {
      if (mainElement) {
        mainElement.style.padding = "";
        mainElement.style.background = "";
        mainElement.style.overflow = "";
      }
    };
  }, []);
}

export interface InboxModuleProps {
  className?: string;
}

export default function InboxModule({ className }: InboxModuleProps) {
  // Enable full screen mode
  useFullScreen();

  // URL search params for connection success
  const searchParams = useSearchParams();

  // Show toast for successful connection
  useEffect(() => {
    const connected = searchParams.get("connected");
    const email = searchParams.get("email");
    const error = searchParams.get("error");

    if (connected && email) {
      toast.success(`${email} hesabı başarıyla bağlandı!`);
      // Clean up URL
      window.history.replaceState({}, "", "/dashboard/mail/inbox");
    }

    if (error) {
      toast.error(`Bağlantı hatası: ${error}`);
      window.history.replaceState({}, "", "/dashboard/mail/inbox");
    }
  }, [searchParams]);

  // State
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Hooks
  const {
    connections,
    isLoading: connectionsLoading,
    deleteConnection,
    syncConnection,
    syncAllConnections,
    refresh: refreshConnections,
  } = useEmailConnections();

  const {
    emails,
    stats,
    pagination,
    isLoading: emailsLoading,
    isRefreshing: emailsRefreshing,
    refresh: refreshEmails,
    markAsRead,
  } = useInboxEmails({
    connectionId: selectedConnectionId || undefined,
    search: debouncedSearch || undefined,
    page,
    limit: 50,
  });

  const {
    email: selectedEmail,
    isLoading: emailDetailLoading,
    toggleStarred,
  } = useEmailDetail(selectedEmailId);

  // Handlers
  const handleSelectEmail = useCallback(
    (id: string) => {
      setSelectedEmailId(id);
      // Mark as read
      const email = emails.find((e) => e.id === id);
      if (email && !email.isRead) {
        markAsRead(id);
      }
    },
    [emails, markAsRead]
  );

  const handleDeleteConnection = useCallback(
    async (id: string) => {
      const result = await deleteConnection(id);
      if (result.success) {
        toast.success("Hesap başarıyla kaldırıldı");
        if (selectedConnectionId === id) {
          setSelectedConnectionId(null);
        }
        setSelectedEmailId(null);
      } else {
        toast.error("Hesap kaldırılamadı");
      }
      return result;
    },
    [deleteConnection, selectedConnectionId]
  );

  const handleSyncConnection = useCallback(
    async (id: string) => {
      toast.info("Senkronizasyon başlatıldı...");
      const result = await syncConnection(id);
      if (result.success) {
        toast.success(`${result.synced} yeni e-posta senkronize edildi`);
        refreshEmails();
      } else {
        toast.error(result.error || "Senkronizasyon başarısız");
      }
      return result;
    },
    [syncConnection, refreshEmails]
  );

  const handleSyncAll = useCallback(async () => {
    toast.info("Tüm hesaplar senkronize ediliyor...");
    const result = await syncAllConnections();
    if (result.success) {
      const totalSynced = result.results?.reduce((acc: number, r: { synced?: number }) => acc + (r.synced || 0), 0) || 0;
      toast.success(`${totalSynced} yeni e-posta senkronize edildi`);
      refreshEmails();
    } else {
      toast.error("Senkronizasyon başarısız");
    }
    return result;
  }, [syncAllConnections, refreshEmails]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    setSelectedEmailId(null);
  }, []);

  // No connections state
  const hasNoConnections = !connectionsLoading && connections.length === 0;

  return (
    <div className={cn("h-[calc(100vh-4rem)] flex overflow-hidden", className)}>
      {hasNoConnections ? (
        // Empty state - no connections
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8">
          <div className="max-w-md text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-50 flex items-center justify-center">
              <Icon icon="solar:inbox-in-bold-duotone" className="w-10 h-10 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              E-Posta Hesabı Bağlayın
            </h2>
            <p className="text-gray-500 mb-8">
              Gelen kutunuzu görüntülemek için Gmail veya Outlook hesabınızı bağlayın.
              E-postalarınız güvenli bir şekilde senkronize edilecektir.
            </p>

            <div className="flex flex-col gap-3">
              <a
                href="/api/email/auth/google"
                className="flex items-center justify-center gap-3 px-6 py-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <Icon icon="logos:google-gmail" className="w-6 h-6" />
                <span className="font-medium text-gray-900 group-hover:text-blue-700">
                  Gmail ile Bağlan
                </span>
              </a>

              <a
                href="/api/email/auth/microsoft"
                className="flex items-center justify-center gap-3 px-6 py-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <Icon icon="logos:microsoft-icon" className="w-6 h-6" />
                <span className="font-medium text-gray-900 group-hover:text-blue-700">
                  Outlook ile Bağlan
                </span>
              </a>
            </div>

            <p className="text-xs text-gray-400 mt-6 flex items-center justify-center gap-1">
              <Icon icon="solar:shield-check-bold" className="w-4 h-4 text-green-500" />
              E-postalarınız şifrelenerek güvenle saklanır
            </p>
          </div>
        </div>
      ) : (
        // Main inbox layout
        <>
          {/* LEFT - Email List */}
          <div className="w-[440px] bg-white border-r border-gray-200 flex flex-col shrink-0">
            {/* Header */}
            <div className="h-14 px-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Icon icon="solar:inbox-bold-duotone" className="w-5 h-5 text-blue-600" />
                <h1 className="text-base font-bold text-gray-900">Gelen Kutusu</h1>
              </div>
              <ConnectionSelector
                connections={connections}
                selectedConnectionId={selectedConnectionId}
                onSelectConnection={setSelectedConnectionId}
                onDeleteConnection={handleDeleteConnection}
                onSyncConnection={handleSyncConnection}
                onSyncAll={handleSyncAll}
                isLoading={connectionsLoading}
              />
            </div>

            {/* Email List */}
            <EmailList
              emails={emails}
              stats={stats}
              pagination={pagination}
              isLoading={emailsLoading}
              isRefreshing={emailsRefreshing}
              selectedEmailId={selectedEmailId}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onSelectEmail={handleSelectEmail}
              onPageChange={handlePageChange}
              onRefresh={refreshEmails}
            />
          </div>

          {/* RIGHT - Email Detail */}
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
            <EmailDetailComponent
              email={selectedEmail}
              isLoading={emailDetailLoading}
              onToggleStarred={toggleStarred}
            />
          </div>
        </>
      )}
    </div>
  );
}
