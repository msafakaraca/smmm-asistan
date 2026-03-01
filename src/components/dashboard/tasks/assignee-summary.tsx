"use client";

import { cn } from "@/lib/utils";
import { User, CheckCircle2, AlertTriangle, PlayCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AssigneeTaskSummary } from "@/types/dashboard";

interface AssigneeSummaryProps {
  assignees: AssigneeTaskSummary[];
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AssigneeSummary({ assignees, className }: AssigneeSummaryProps) {
  if (assignees.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-4 text-center", className)}>
        <User className="h-6 w-6 text-muted-foreground/40 mb-1" />
        <p className="text-xs text-muted-foreground">Atanan kişi yok</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <TooltipProvider>
        {assignees.map((assignee) => (
          <AssigneeRow key={assignee.id} assignee={assignee} />
        ))}
      </TooltipProvider>
    </div>
  );
}

function AssigneeRow({ assignee }: { assignee: AssigneeTaskSummary }) {
  const activeTasks = assignee.totalTasks - assignee.completedTasks;

  return (
    <div className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors">
      {/* Avatar */}
      <Avatar className="h-7 w-7">
        <AvatarImage src={assignee.image || undefined} alt={assignee.fullName} />
        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
          {getInitials(assignee.fullName)}
        </AvatarFallback>
      </Avatar>

      {/* İsim ve Progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-medium truncate">{assignee.fullName}</span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {assignee.completedTasks}/{assignee.totalTasks}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${assignee.completionRate}%` }}
          />
        </div>
      </div>

      {/* Mini Stats */}
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-0.5">
              <PlayCircle className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] font-medium">{assignee.inProgressTasks}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {assignee.inProgressTasks} devam eden
          </TooltipContent>
        </Tooltip>

        {assignee.overdueTasks > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-0.5">
                <AlertTriangle className="h-3 w-3 text-red-500" />
                <span className="text-[10px] font-medium text-red-600">{assignee.overdueTasks}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {assignee.overdueTasks} geciken
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
