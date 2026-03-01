'use client';

import { cn } from '@/lib/utils';

interface RoleBadgeProps {
  role: string;
  className?: string;
}

const roleConfig: Record<string, { label: string; className: string }> = {
  owner: {
    label: 'Sahip',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  admin: {
    label: 'Yönetici',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  user: {
    label: 'Kullanıcı',
    className: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  },
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const config = roleConfig[role] || roleConfig.user;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
