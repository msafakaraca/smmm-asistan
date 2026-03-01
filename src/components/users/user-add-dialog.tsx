'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from "@/components/ui/sonner";
import { UserPlus, Loader2, Copy, Check, Eye, EyeOff } from 'lucide-react';
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
import { getDefaultPermissions, type UserRole } from '@/lib/permissions';
import { PermissionSelector } from './permission-selector';
import { PasswordStrengthMeter, calculateStrength } from '@/components/ui/password-strength-meter';

const schema = z.object({
  email: z.string().email('Geçerli bir email adresi girin'),
  name: z.string().min(2, 'İsim en az 2 karakter olmalı'),
  role: z.enum(['admin', 'user']),
  phoneNumber: z.string().optional(),
  password: z.string()
    .min(8, 'Şifre en az 8 karakter olmalı')
    .regex(/[A-Z]/, 'En az bir büyük harf içermeli')
    .regex(/[a-z]/, 'En az bir küçük harf içermeli')
    .regex(/[0-9]/, 'En az bir rakam içermeli'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Şifreler eşleşmiyor',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

interface UserAddDialogProps {
  currentUserRole: string;
  onSuccess: () => void;
}

export function UserAddDialog({ currentUserRole, onSuccess }: UserAddDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCustomPermissions, setShowCustomPermissions] = useState(false);
  const [customPermissions, setCustomPermissions] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Başarılı ekleme sonrası bilgi gösterimi
  const [createdUser, setCreatedUser] = useState<{ email: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      name: '',
      role: 'user',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange', // Canlı validasyon için
  });

  // Şifre değerini izle
  const passwordValue = form.watch('password');

  const selectedRole = form.watch('role');

  const handleRoleChange = (role: string) => {
    form.setValue('role', role as 'admin' | 'user');
    // Reset custom permissions when role changes
    setCustomPermissions(getDefaultPermissions(role as UserRole));
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setShowCustomPermissions(false);
      setCustomPermissions([]);
      setCreatedUser(null);
      setCopied(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
    setOpen(newOpen);
  };

  const copyToClipboard = async () => {
    if (!createdUser) return;
    const text = `Email: ${createdUser.email}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Kopyalandı');
  };

  const onSubmit = async (data: FormData) => {
    // Şifre güç kontrolü
    const { strength } = calculateStrength(data.password);
    if (strength === 'weak') {
      toast.error('Şifre çok zayıf', {
        description: 'Lütfen daha güçlü bir şifre belirleyin.',
      });
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        email: data.email,
        name: data.name,
        role: data.role,
        phoneNumber: data.phoneNumber || null,
        password: data.password, // Kullanıcının belirlediği şifre
      };

      // Özel yetkiler varsa ekle
      if (showCustomPermissions) {
        payload.permissions = customPermissions;
      }

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Kullanıcı eklenemedi');
      }

      const result = await response.json();

      // Başarı mesajı göster
      setCreatedUser({
        email: result.email,
        name: result.name,
      });

      toast.success('Kullanıcı başarıyla eklendi');
      form.reset();
      onSuccess();
    } catch (error) {
      toast.error('Hata', {
        description: error instanceof Error ? error.message : 'Bir hata oluştu',
      });
    } finally {
      setLoading(false);
    }
  };

  // Owner değilse admin ekleyemez
  const canAddAdmin = currentUserRole === 'owner';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Kullanıcı Ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        {/* Başarı ekranı */}
        {createdUser ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-green-600">Kullanıcı Oluşturuldu</DialogTitle>
              <DialogDescription>
                Kullanıcı başarıyla sisteme eklendi.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-700 dark:text-green-400">
                    {createdUser.name}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Email:</span>
                  <p className="font-mono font-medium">{createdUser.email}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Kullanıcı belirlediğiniz şifre ile giriş yapabilir.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Kopyalandı
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Email Kopyala
                  </>
                )}
              </Button>
              <Button onClick={() => setOpen(false)}>
                Tamam
              </Button>
            </DialogFooter>
          </>
        ) : (
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Yeni Kullanıcı Ekle</DialogTitle>
            <DialogDescription>
              Ekibinize yeni bir kullanıcı ekleyin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@email.com"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">İsim *</Label>
              <Input
                id="name"
                placeholder="Kullanıcı adı"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol *</Label>
              <Select
                value={selectedRole}
                onValueChange={handleRoleChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canAddAdmin && (
                    <SelectItem value="admin">Yönetici (Admin)</SelectItem>
                  )}
                  <SelectItem value="user">Kullanıcı</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedRole === 'admin'
                  ? 'Yöneticiler çoğu işlemi yapabilir, ancak kullanıcı ekleyemez.'
                  : 'Kullanıcılar sadece temel işlemleri yapabilir.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefon (opsiyonel)</Label>
              <Input
                id="phone"
                placeholder="05XX XXX XX XX"
                {...form.register('phoneNumber')}
              />
            </div>

            {/* Şifre Alanları */}
            <div className="space-y-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label htmlFor="password">Şifre *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Güçlü bir şifre belirleyin"
                      className="pr-10"
                      {...form.register('password')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.password.message}
                    </p>
                  )}
                  {/* Şifre güç ölçer */}
                  {passwordValue && (
                    <PasswordStrengthMeter
                      password={passwordValue}
                      showCriteria
                      className="mt-2"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Şifre Tekrar *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Şifreyi tekrar girin"
                      className="pr-10"
                      {...form.register('confirmPassword')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {form.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Yetkiler</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!showCustomPermissions) {
                      setCustomPermissions(getDefaultPermissions(selectedRole as UserRole));
                    }
                    setShowCustomPermissions(!showCustomPermissions);
                  }}
                >
                  {showCustomPermissions ? 'Varsayılanı Kullan' : 'Özelleştir'}
                </Button>
              </div>
              {showCustomPermissions ? (
                <div className="border rounded-lg p-3">
                  <PermissionSelector
                    selectedPermissions={customPermissions}
                    onChange={setCustomPermissions}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Varsayılan {selectedRole === 'admin' ? 'yönetici' : 'kullanıcı'} yetkileri uygulanacak.
                </p>
              )}
            </div>
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
                  Ekleniyor...
                </>
              ) : (
                'Kullanıcı Ekle'
              )}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
