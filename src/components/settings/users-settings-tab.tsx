"use client";

import { Users, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { UsersTable } from "@/components/users/users-table";
import { UserAddDialog } from "@/components/users/user-add-dialog";
import { hasPermission, type UserWithPermissions } from "@/lib/permissions";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phoneNumber?: string;
  status: string;
  permissions: string[];
  lastLoginAt?: string;
  invitedAt?: string;
  createdAt: string;
}

interface UsersSettingsTabProps {
  currentUser: UserWithPermissions;
}

export function UsersSettingsTab({ currentUser }: UsersSettingsTabProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canRead = hasPermission(currentUser, "users:read");
  const canManage = hasPermission(currentUser, "users:manage");

  const fetchUsers = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      const response = await fetch("/api/users");

      if (!response.ok) {
        throw new Error("Kullanıcılar yüklenemedi");
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Yetki yoksa bilgi mesajı göster
  if (!canRead) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Ekip Üyeleri</h3>
            <p className="text-sm text-muted-foreground">
              Bu bölümü görüntüleme yetkiniz yok
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Ekip Üyeleri</h3>
            <p className="text-sm text-muted-foreground">
              Ofisinizde çalışan kullanıcıları yönetin
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchUsers}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {canManage && (
            <UserAddDialog
              currentUserRole={currentUser.role}
              onSuccess={fetchUsers}
            />
          )}
        </div>
      </div>

      {/* İçerik */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            Tekrar Dene
          </Button>
        </div>
      ) : (
        <>
          <UsersTable
            users={users}
            currentUserId={currentUser.id}
            currentUserRole={currentUser.role}
            onRefresh={fetchUsers}
          />

          {/* Özet bilgi */}
          {users.length > 0 && (
            <div className="pt-4 border-t flex gap-6 text-sm text-muted-foreground">
              <span>
                <strong className="text-foreground">{users.length}</strong> kullanıcı
              </span>
              <span>
                <strong className="text-foreground">
                  {users.filter((u) => u.status === "active").length}
                </strong>{" "}
                aktif
              </span>
              <span>
                <strong className="text-foreground">
                  {users.filter((u) => u.status === "pending").length}
                </strong>{" "}
                bekleyen
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
