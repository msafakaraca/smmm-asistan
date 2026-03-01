'use client';

import { UsersCard } from './users-card';
import { type UserWithPermissions } from '@/lib/permissions';

interface UsersCardWrapperProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
  };
}

export function UsersCardWrapper({ user }: UsersCardWrapperProps) {
  // Server'dan gelen user'ı UserWithPermissions formatına dönüştür
  const currentUser: UserWithPermissions = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as 'owner' | 'admin' | 'user',
    tenantId: user.tenantId,
    status: 'active', // Giriş yapmış kullanıcı aktif
  };

  return <UsersCard currentUser={currentUser} />;
}
