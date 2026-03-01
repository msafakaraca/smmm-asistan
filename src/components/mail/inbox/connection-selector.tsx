"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@iconify/react";
import type { EmailConnection } from "./hooks/use-email-connections";

interface ConnectionSelectorProps {
  connections: EmailConnection[];
  selectedConnectionId: string | null;
  onSelectConnection: (id: string | null) => void;
  onDeleteConnection: (id: string) => Promise<{ success: boolean }>;
  onSyncConnection: (id: string) => Promise<{ success: boolean }>;
  onSyncAll: () => Promise<{ success: boolean }>;
  isLoading: boolean;
}

export const ConnectionSelector = React.memo(function ConnectionSelector({
  connections,
  selectedConnectionId,
  onSelectConnection,
  onDeleteConnection,
  onSyncConnection,
  onSyncAll,
  isLoading,
}: ConnectionSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const selectedConnection = connections.find((c) => c.id === selectedConnectionId);

  const handleConnect = (provider: "gmail" | "outlook") => {
    // Redirect to OAuth
    window.location.href = `/api/email/auth/${provider === "gmail" ? "google" : "microsoft"}`;
  };

  return (
    <div className="relative">
      {/* Main Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm",
          selectedConnection
            ? "bg-white border-gray-200 hover:border-blue-300"
            : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
        )}
      >
        {selectedConnection ? (
          <>
            <Icon
              icon={
                selectedConnection.provider === "gmail"
                  ? "logos:google-gmail"
                  : "logos:microsoft-icon"
              }
              className="w-4 h-4"
            />
            <span className="font-medium truncate max-w-[150px]">
              {selectedConnection.email}
            </span>
            {selectedConnection.syncStatus === "syncing" && (
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
          </>
        ) : connections.length > 0 ? (
          <>
            <Icon icon="solar:inbox-bold" className="w-4 h-4" />
            <span>Tüm Hesaplar</span>
          </>
        ) : (
          <>
            <Icon icon="solar:add-circle-bold" className="w-4 h-4" />
            <span>Hesap Bağla</span>
          </>
        )}
        <Icon
          icon="solar:alt-arrow-down-line-duotone"
          className={cn("w-4 h-4 transition-transform", showDropdown && "rotate-180")}
        />
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
            {/* All accounts option */}
            {connections.length > 1 && (
              <>
                <button
                  onClick={() => {
                    onSelectConnection(null);
                    setShowDropdown(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors",
                    !selectedConnectionId && "bg-blue-50"
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Icon icon="solar:inbox-bold" className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-900">Tüm Hesaplar</div>
                    <div className="text-xs text-gray-500">
                      {connections.reduce((acc, c) => acc + c.emailCount, 0)} e-posta
                    </div>
                  </div>
                  {!selectedConnectionId && (
                    <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-blue-500" />
                  )}
                </button>
                <div className="border-t border-gray-100" />
              </>
            )}

            {/* Connection list */}
            {connections.map((conn) => (
              <div
                key={conn.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group",
                  conn.id === selectedConnectionId && "bg-blue-50"
                )}
              >
                <button
                  onClick={() => {
                    onSelectConnection(conn.id);
                    setShowDropdown(false);
                  }}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <Icon
                      icon={
                        conn.provider === "gmail"
                          ? "logos:google-gmail"
                          : "logos:microsoft-icon"
                      }
                      className="w-4 h-4"
                    />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {conn.email}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      {conn.syncStatus === "syncing" ? (
                        <>
                          <div className="w-2 h-2 border border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <span>Senkronize ediliyor...</span>
                        </>
                      ) : conn.syncStatus === "error" ? (
                        <>
                          <Icon icon="solar:danger-circle-bold" className="w-3 h-3 text-red-500" />
                          <span className="text-red-500">Hata</span>
                        </>
                      ) : (
                        <span>{conn.emailCount} e-posta</span>
                      )}
                    </div>
                  </div>
                  {conn.id === selectedConnectionId && (
                    <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-blue-500 shrink-0" />
                  )}
                </button>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSyncConnection(conn.id);
                    }}
                    disabled={conn.syncStatus === "syncing"}
                    className="p-1.5 rounded hover:bg-gray-200 text-gray-500"
                    title="Senkronize et"
                  >
                    <Icon
                      icon="solar:refresh-bold"
                      className={cn("w-4 h-4", conn.syncStatus === "syncing" && "animate-spin")}
                    />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`${conn.email} hesabını kaldırmak istediğinize emin misiniz?`)) {
                        onDeleteConnection(conn.id);
                      }
                    }}
                    className="p-1.5 rounded hover:bg-red-100 text-gray-500 hover:text-red-600"
                    title="Hesabı kaldır"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Add Account Button */}
            <div className="border-t border-gray-100">
              <button
                onClick={() => {
                  setShowDropdown(false);
                  setShowAddModal(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-blue-600"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                  <Icon icon="solar:add-circle-bold" className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Yeni Hesap Bağla</span>
              </button>
            </div>

            {/* Sync All Button */}
            {connections.length > 1 && (
              <div className="border-t border-gray-100">
                <button
                  onClick={() => {
                    onSyncAll();
                    setShowDropdown(false);
                  }}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-gray-600"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Icon
                      icon="solar:refresh-bold"
                      className={cn("w-4 h-4", isLoading && "animate-spin")}
                    />
                  </div>
                  <span className="text-sm font-medium">Tümünü Senkronize Et</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[400px] overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Icon icon="solar:inbox-in-bold" className="w-5 h-5" />
                <h3 className="font-semibold">E-Posta Hesabı Bağla</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="hover:bg-white/20 p-1 rounded"
              >
                <Icon icon="solar:close-circle-bold" className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500 mb-4">
                E-postalarınızı senkronize etmek için bir hesap seçin
              </p>

              {/* Gmail */}
              <button
                onClick={() => handleConnect("gmail")}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                  <Icon icon="logos:google-gmail" className="w-7 h-7" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900 group-hover:text-blue-700">
                    Gmail
                  </div>
                  <div className="text-xs text-gray-500">Google hesabınızla bağlayın</div>
                </div>
                <Icon
                  icon="solar:arrow-right-bold"
                  className="w-5 h-5 text-gray-400 group-hover:text-blue-500"
                />
              </button>

              {/* Outlook */}
              <button
                onClick={() => handleConnect("outlook")}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                  <Icon icon="logos:microsoft-icon" className="w-7 h-7" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900 group-hover:text-blue-700">
                    Outlook / Microsoft 365
                  </div>
                  <div className="text-xs text-gray-500">Microsoft hesabınızla bağlayın</div>
                </div>
                <Icon
                  icon="solar:arrow-right-bold"
                  className="w-5 h-5 text-gray-400 group-hover:text-blue-500"
                />
              </button>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t text-xs text-gray-500">
              <Icon icon="solar:shield-check-bold" className="w-4 h-4 inline mr-1 text-green-500" />
              E-postalarınız güvenli bir şekilde şifrelenerek saklanır.
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
