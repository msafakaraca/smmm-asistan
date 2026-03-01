"use client";

import React from "react";
import Link from "next/link";
import { mutate } from "swr";
import { createClient } from "@/lib/supabase/client";
import { useBotLog } from "@/context/bot-log-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { LogOut, User, Building2, Loader2, Wifi, WifiOff } from "lucide-react";

interface DashboardHeaderProps {
    user: {
        name?: string | null;
        email?: string | null;
        tenantName?: string;
    };
}

export const DashboardHeader = React.memo(function DashboardHeader({ user }: DashboardHeaderProps) {
    const supabase = createClient();
    const { isBotRunning, electronConnected } = useBotLog();

    // Memoize initials calculation
    const initials = React.useMemo(() => {
        return user.name
            ?.split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "U";
    }, [user.name]);

    // Supabase sign out handler
    // SWR cache + localStorage + hard redirect ile tüm tenant verilerini sıfırla
    const handleSignOut = React.useCallback(async () => {
        // SWR cache'ini tamamen temizle
        mutate(() => true, undefined, { revalidate: false });

        // Tenant-spesifik localStorage verilerini temizle
        const keysToRemove = [
            "smmm-bot-logs",
            "smmm-gib-bot-pending-result",
            "smmm-scan-history",
            "mail_provider",
            "mail_provider_info",
            "dashboard_user_id",
        ];
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        sessionStorage.removeItem("dashboard_user_id");

        await supabase.auth.signOut();
        // Hard redirect: tüm React state, SWR cache ve WebSocket bağlantılarını temizler
        window.location.href = "/login";
    }, [supabase.auth]);

    return (
        <header className="h-16 border-b bg-card flex items-center justify-between px-4 xl:px-6">
            {/* Tenant Name */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{user.tenantName || "Ofisiniz"}</span>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-4">
                {/* Bot Running Badge */}
                {isBotRunning && (
                    <Link href="/dashboard/beyanname-kontrol">
                        <Badge
                            variant="outline"
                            className="gap-1.5 cursor-pointer bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/50"
                        >
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Bot Çalışıyor
                        </Badge>
                    </Link>
                )}

                {/* Bot Connection Status */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-default ${
                            electronConnected
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                                : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                        }`}>
                            {electronConnected ? (
                                <Wifi className="h-3.5 w-3.5" />
                            ) : (
                                <WifiOff className="h-3.5 w-3.5" />
                            )}
                            <span className="hidden sm:inline">
                                {electronConnected ? "Bağlı" : "Bağlı Değil"}
                            </span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        {electronConnected
                            ? "SMMM Asistan bağlı"
                            : "SMMM Asistan bağlı değil"}
                    </TooltipContent>
                </Tooltip>

                {/* Theme Toggle */}
                <ThemeToggle />

                {/* User Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <User className="mr-2 h-4 w-4" />
                            Profil
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={handleSignOut}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Çıkış Yap
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
});
