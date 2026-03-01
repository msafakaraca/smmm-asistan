"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TaskAssignee } from "@/types/task";

interface AssigneeAvatarsProps {
  assignees: TaskAssignee[];
  maxDisplay?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// İsimden baş harfleri al
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Renkli background için hash
function getColorFromName(name: string): string {
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-sky-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-purple-500",
    "bg-fuchsia-500",
    "bg-pink-500",
    "bg-rose-500",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const sizeClasses = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

const overlapClasses = {
  sm: "-ml-2",
  md: "-ml-2.5",
  lg: "-ml-3",
};

export const AssigneeAvatars = memo(function AssigneeAvatars({
  assignees = [],
  maxDisplay = 3,
  size = "md",
  className,
}: AssigneeAvatarsProps) {
  if (!assignees || assignees.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">Atanmamış</span>
    );
  }

  const displayAssignees = assignees.slice(0, maxDisplay);
  const remainingCount = assignees.length - maxDisplay;

  return (
    <TooltipProvider>
      <div className={cn("flex items-center", className)}>
        {/* Avatar Stack */}
        <div className="flex items-center">
          {displayAssignees.map((assignee, index) => (
            <Tooltip key={assignee.id}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    index > 0 && overlapClasses[size],
                    "relative"
                  )}
                  style={{ zIndex: displayAssignees.length - index }}
                >
                  <Avatar
                    className={cn(
                      sizeClasses[size],
                      "border-2 border-background"
                    )}
                  >
                    {assignee.user.image && (
                      <AvatarImage
                        src={assignee.user.image}
                        alt={assignee.user.name}
                      />
                    )}
                    <AvatarFallback
                      className={cn(
                        getColorFromName(assignee.user.name),
                        "text-white font-medium"
                      )}
                    >
                      {getInitials(assignee.user.name)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{assignee.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {assignee.user.email}
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* +N Badge */}
        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  overlapClasses[size],
                  sizeClasses[size],
                  "relative flex items-center justify-center rounded-full",
                  "bg-muted border-2 border-background text-muted-foreground font-medium"
                )}
                style={{ zIndex: 0 }}
              >
                +{remainingCount}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Diğer atananlar:</p>
              {assignees.slice(maxDisplay).map((a) => (
                <p key={a.id} className="text-xs">
                  {a.user.name}
                </p>
              ))}
            </TooltipContent>
          </Tooltip>
        )}

        {/* İlk kişinin adı */}
        {assignees.length > 0 && (
          <span className="ml-2 text-sm truncate max-w-[120px]">
            {assignees[0].user.name}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
});

// Tekli avatar
export const SingleAssigneeAvatar = memo(function SingleAssigneeAvatar({
  name,
  email,
  image,
  size = "md",
  showName = true,
}: {
  name: string;
  email?: string;
  image?: string | null;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className={cn(sizeClasses[size])}>
        {image && <AvatarImage src={image} alt={name} />}
        <AvatarFallback
          className={cn(getColorFromName(name), "text-white font-medium")}
        >
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      {showName && (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{name}</span>
          {email && (
            <span className="text-xs text-muted-foreground">{email}</span>
          )}
        </div>
      )}
    </div>
  );
});
