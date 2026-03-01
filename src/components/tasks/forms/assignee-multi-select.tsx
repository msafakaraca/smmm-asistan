"use client";

import { memo, useState, useMemo } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TaskUser } from "@/types/task";

interface AssigneeMultiSelectProps {
  users: TaskUser[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getColorFromName(name: string): string {
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-green-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-purple-500",
    "bg-pink-500",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const AssigneeMultiSelect = memo(function AssigneeMultiSelect({
  users,
  selectedIds,
  onChange,
  disabled = false,
  placeholder = "Kullanıcı seç...",
}: AssigneeMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const lower = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(lower) ||
        u.email.toLowerCase().includes(lower)
    );
  }, [users, search]);

  const selectedUsers = useMemo(() => {
    return users.filter((u) => selectedIds.includes(u.id));
  }, [users, selectedIds]);

  const handleToggle = (userId: string) => {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
    } else {
      onChange([...selectedIds, userId]);
    }
  };

  const handleRemove = (userId: string) => {
    onChange(selectedIds.filter((id) => id !== userId));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-auto min-h-[40px] py-2",
            !selectedIds.length && "text-muted-foreground"
          )}
        >
          {selectedIds.length === 0 ? (
            <span>{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {selectedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent text-sm"
                >
                  <Avatar className="h-5 w-5">
                    {user.image && (
                      <AvatarImage src={user.image} alt={user.name} />
                    )}
                    <AvatarFallback
                      className={cn(
                        getColorFromName(user.name),
                        "text-white text-[10px]"
                      )}
                    >
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{user.name}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleRemove(user.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        e.preventDefault();
                        handleRemove(user.id);
                      }
                    }}
                    className="ml-1 hover:text-red-500 cursor-pointer"
                  >
                    <Icon icon="solar:close-circle-bold" className="h-4 w-4" />
                  </span>
                </div>
              ))}
            </div>
          )}
          <Icon
            icon="solar:alt-arrow-down-line-duotone"
            className="ml-2 h-4 w-4 shrink-0 opacity-50"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        {/* Search */}
        <div className="p-2 border-b">
          <Input
            placeholder="Kullanıcı ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>

        {/* User List */}
        <div className="max-h-[200px] overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Kullanıcı bulunamadı
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-2 px-2 py-2 hover:bg-accent cursor-pointer"
                onClick={() => handleToggle(user.id)}
              >
                <Checkbox
                  checked={selectedIds.includes(user.id)}
                  onCheckedChange={() => handleToggle(user.id)}
                />
                <Avatar className="h-7 w-7">
                  {user.image && (
                    <AvatarImage src={user.image} alt={user.name} />
                  )}
                  <AvatarFallback
                    className={cn(
                      getColorFromName(user.name),
                      "text-white text-xs"
                    )}
                  >
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Clear All */}
        {selectedIds.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange([])}
            >
              Seçimi Temizle
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
});
