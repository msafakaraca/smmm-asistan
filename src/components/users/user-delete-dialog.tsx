'use client';

import { useState } from 'react';
import { toast } from "@/components/ui/sonner";
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { canManageUser, type UserRole } from '@/lib/permissions';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface UserDeleteDialogProps {
  user: User;
  currentUserId: string;
  currentUserRole: string;
  onSuccess: () => void;
}

export function UserDeleteDialog({
  user,
  currentUserId,
  currentUserRole,
  onSuccess,
}: UserDeleteDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const canManage = canManageUser(currentUserRole as UserRole, user.role as UserRole);
  const isOwnProfile = user.id === currentUserId;
  const isOwner = user.role === 'owner';

  // Silme butonu gösterilecek mi?
  if (!canManage || isOwnProfile || isOwner) {
    return null;
  }

  const handleDelete = async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Kullanıcı silinemedi');
      }

      toast.success('Kullanıcı silindi');
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

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="text-red-500 hover:text-red-600 hover:bg-red-50">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Kullanıcı Sil
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              <strong>{user.name}</strong> ({user.email}) kullanıcısını silmek istediğinize emin misiniz?
            </p>
            <p className="text-red-500">
              Bu işlem geri alınamaz. Kullanıcı sisteme erişimini kaybedecek.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>İptal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Siliniyor...
              </>
            ) : (
              'Sil'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
