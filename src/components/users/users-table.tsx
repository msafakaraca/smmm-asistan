'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RoleBadge } from './role-badge';
import { StatusBadge } from './status-badge';
import { UserEditDialog } from './user-edit-dialog';
import { UserDeleteDialog } from './user-delete-dialog';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

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

interface UsersTableProps {
  users: User[];
  currentUserId: string;
  currentUserRole: string;
  onRefresh: () => void;
}

export function UsersTable({
  users,
  currentUserId,
  currentUserRole,
  onRefresh,
}: UsersTableProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: tr,
      });
    } catch {
      return '-';
    }
  };

  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Henüz ekip üyesi yok.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kullanıcı</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Son Giriş</TableHead>
            <TableHead className="text-right">İşlemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div>
                  <div className="font-medium">
                    {user.name}
                    {user.id === currentUserId && (
                      <span className="ml-2 text-xs text-muted-foreground">(Sen)</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                  {user.phoneNumber && (
                    <div className="text-xs text-muted-foreground">{user.phoneNumber}</div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <RoleBadge role={user.role} />
              </TableCell>
              <TableCell>
                <StatusBadge status={user.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {user.lastLoginAt ? formatDate(user.lastLoginAt) : (
                  user.status === 'pending' ? 'Davet bekliyor' : '-'
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <UserEditDialog
                    user={user}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                    onSuccess={onRefresh}
                  />
                  <UserDeleteDialog
                    user={user}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                    onSuccess={onRefresh}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
