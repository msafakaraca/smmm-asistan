'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Loader2, RefreshCw } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UsersTable } from './users-table';
import { UserAddDialog } from './user-add-dialog';
import { hasPermission, type UserWithPermissions } from '@/lib/permissions';

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

interface UsersCardProps {
  currentUser: UserWithPermissions;
}

export function UsersCard({ currentUser }: UsersCardProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canRead = hasPermission(currentUser, 'users:read');
  const canManage = hasPermission(currentUser, 'users:manage');

  const fetchUsers = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch('/api/users');

      if (!response.ok) {
        throw new Error('Kullanıcılar yüklenemedi');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Yetki yoksa kart gösterme
  if (!canRead) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ekip Üyeleri
          </CardTitle>
          <CardDescription>
            Bu bölümü görüntüleme yetkiniz yok.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Ekip Üyeleri
            </CardTitle>
            <CardDescription>
              Ofisinizde çalışan kullanıcıları yönetin
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={fetchUsers}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {canManage && (
              <UserAddDialog
                currentUserRole={currentUser.role}
                onSuccess={fetchUsers}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUsers}
              className="mt-2"
            >
              Tekrar Dene
            </Button>
          </div>
        ) : (
          <UsersTable
            users={users}
            currentUserId={currentUser.id}
            currentUserRole={currentUser.role}
            onRefresh={fetchUsers}
          />
        )}

        {/* Özet bilgi */}
        {!loading && !error && users.length > 0 && (
          <div className="mt-4 pt-4 border-t flex gap-4 text-sm text-muted-foreground">
            <span>Toplam: {users.length} kullanıcı</span>
            <span>Aktif: {users.filter(u => u.status === 'active').length}</span>
            <span>Bekleyen: {users.filter(u => u.status === 'pending').length}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
