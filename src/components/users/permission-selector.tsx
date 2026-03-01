'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  type Permission,
} from '@/lib/permissions';

interface PermissionSelectorProps {
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  disabled?: boolean;
}

export function PermissionSelector({
  selectedPermissions,
  onChange,
  disabled = false,
}: PermissionSelectorProps) {
  const handleToggle = (permission: string) => {
    if (selectedPermissions.includes(permission)) {
      onChange(selectedPermissions.filter(p => p !== permission));
    } else {
      onChange([...selectedPermissions, permission]);
    }
  };

  const handleGroupToggle = (permissions: readonly string[]) => {
    const allSelected = permissions.every(p => selectedPermissions.includes(p));
    if (allSelected) {
      onChange(selectedPermissions.filter(p => !permissions.includes(p)));
    } else {
      const newPermissions = [...selectedPermissions];
      permissions.forEach(p => {
        if (!newPermissions.includes(p)) {
          newPermissions.push(p);
        }
      });
      onChange(newPermissions);
    }
  };

  return (
    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
      {Object.entries(PERMISSION_GROUPS).map(([groupName, permissions]) => {
        const allSelected = permissions.every(p => selectedPermissions.includes(p));
        const someSelected = permissions.some(p => selectedPermissions.includes(p));

        return (
          <div key={groupName} className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`group-${groupName}`}
                checked={allSelected}
                data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
                onCheckedChange={() => handleGroupToggle(permissions)}
                disabled={disabled}
              />
              <Label
                htmlFor={`group-${groupName}`}
                className="text-sm font-medium cursor-pointer"
              >
                {groupName}
              </Label>
            </div>
            <div className="ml-6 space-y-1.5">
              {permissions.map(permission => (
                <div key={permission} className="flex items-center space-x-2">
                  <Checkbox
                    id={permission}
                    checked={selectedPermissions.includes(permission)}
                    onCheckedChange={() => handleToggle(permission)}
                    disabled={disabled}
                  />
                  <Label
                    htmlFor={permission}
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    {PERMISSION_LABELS[permission as Permission]}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
