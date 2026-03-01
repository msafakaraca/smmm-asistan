'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from "@/components/ui/sonner";
import { Pencil, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PermissionSelector } from './permission-selector';
import { canAssignRole, canManageUser, type UserRole } from '@/lib/permissions';

const schema = z.object({
  name: z.string().min(2, 'İsim en az 2 karakter olmalı'),
  role: z.enum(['owner', 'admin', 'user']),
  phoneNumber: z.string().optional(),
  status: z.enum(['pending', 'active', 'suspended']),
});

type FormData = z.infer<typeof schema>;

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phoneNumber?: string;
  status: string;
  permissions: string[];
}

interface UserEditDialogProps {
  user: User;
  currentUserId: string;
  currentUserRole: string;
  onSuccess: () => void;
}

export function UserEditDialog({
  user,
  currentUserId,
  currentUserRole,
  onSuccess,
}: UserEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<string[]>(user.permissions || []);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name,
      role: user.role as 'owner' | 'admin' | 'user',
      phoneNumber: user.phoneNumber || '',
      status: user.status as 'pending' | 'active' | 'suspended',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: user.name,
        role: user.role as 'owner' | 'admin' | 'user',
        phoneNumber: user.phoneNumber || '',
        status: user.status as 'pending' | 'active' | 'suspended',
      });
      setPermissions(user.permissions || []);
    }
  }, [open, user, form]);

  const canManage = canManageUser(currentUserRole as UserRole, user.role as UserRole);
  const isOwnProfile = user.id === currentUserId;

  const onSubmit = async (data: FormData) => {
    setLoading(true);

    try {
      // 1. Kullanıcı bilgilerini güncelle
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          role: data.role,
          phoneNumber: data.phoneNumber || null,
          status: data.status,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Kullanıcı güncellenemedi');
      }

      // 2. Yetkileri güncelle (owner ve kendi profili hariç)
      if (user.role !== 'owner' && !isOwnProfile) {
        const permResponse = await fetch(`/api/users/${user.id}/permissions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions }),
        });

        if (!permResponse.ok) {
          console.error('Yetkiler güncellenemedi');
        }
      }

      toast.success('Kullanıcı güncellendi');
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error('Hata', {
        description: error instanceof Error ? error.message : 'Bir hata oluştu',
      });
    } finally {
      setLoading(false);
    }
  };

  // Edit butonu gösterilecek mi?
  if (!canManage && !isOwnProfile) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Kullanıcı Düzenle</DialogTitle>
            <DialogDescription>{user.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">İsim *</Label>
              <Input id="name" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                placeholder="05XX XXX XX XX"
                {...form.register('phoneNumber')}
              />
            </div>

            {/* Rol değiştirme (sadece canManage ve kendi profili değilse) */}
            {canManage && !isOwnProfile && user.role !== 'owner' && (
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={form.watch('role')}
                  onValueChange={(value) =>
                    form.setValue('role', value as 'admin' | 'user')
                  }
                  disabled={!canAssignRole(currentUserRole as UserRole, form.watch('role') as UserRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentUserRole === 'owner' && (
                      <SelectItem value="admin">Yönetici</SelectItem>
                    )}
                    <SelectItem value="user">Kullanıcı</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Durum değiştirme */}
            {canManage && !isOwnProfile && (
              <div className="space-y-2">
                <Label>Durum</Label>
                <Select
                  value={form.watch('status')}
                  onValueChange={(value) =>
                    form.setValue('status', value as 'pending' | 'active' | 'suspended')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="pending">Bekliyor</SelectItem>
                    <SelectItem value="suspended">Askıya Al</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Yetkiler (owner ve kendi profili hariç) */}
            {canManage && !isOwnProfile && user.role !== 'owner' && (
              <div className="space-y-2">
                <Label>Yetkiler</Label>
                <div className="border rounded-lg p-3">
                  <PermissionSelector
                    selectedPermissions={permissions}
                    onChange={setPermissions}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              İptal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                'Kaydet'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
