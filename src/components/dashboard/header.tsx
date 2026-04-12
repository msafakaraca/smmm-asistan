"use client";

import React from "react";
import Link from "next/link";
import useSWR from "swr";
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
import { LogOut, User, Building2, Loader2, Wifi, WifiOff, Settings, Clock, Crown, Calculator } from "lucide-react";
import { CalculatorWidget } from "@/components/calculator/calculator-widget";

interface DashboardHeaderProps {
    user: {
        name?: string | null;
        email?: string | null;
        tenantName?: string;
    };
}

// SWR fetcher
const fetcher = (url: string) => fetch(url).then(res => res.json());

export const DashboardHeader = React.memo(function DashboardHeader({ user }: DashboardHeaderProps) {
    const supabase = createClient();
    const { isBotRunning, electronConnected } = useBotLog();
    const [calculatorOpen, setCalculatorOpen] = React.useState(false);

    // Canlı saat
    const [time, setTime] = React.useState(() => new Date());
    React.useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const formattedTime = React.useMemo(() => {
        return time.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }, [time]);

    // Abonelik bilgileri
    const { data: subscription } = useSWR("/api/settings/subscription", fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 60000,
    });

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
            {/* Sol - Tenant + Abonelik + Saat */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>{user.tenantName || "Ofisiniz"}</span>
                </div>

                {/* Ayırıcı */}
                <div className="h-4 w-px bg-border" />

                {/* Abonelik Bilgisi */}
                {subscription?.plan && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link href="/dashboard/ayarlar" className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors">
                                <Crown className="h-3.5 w-3.5" />
                                <span className="hidden md:inline">{subscription.plan.name}</span>
                                {subscription.plan.daysRemaining !== null && subscription.plan.daysRemaining <= 30 && (
                                    <span className="text-[10px] opacity-75">({subscription.plan.daysRemaining} gün)</span>
                                )}
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="text-xs space-y-1">
                                <p>Plan: {subscription.plan.name}</p>
                                {subscription.usage && (
                                    <>
                                        <p>Mükellef: {subscription.usage.customers.current}/{subscription.usage.customers.max}</p>
                                        <p>Kullanıcı: {subscription.usage.users.current}/{subscription.usage.users.max}</p>
                                    </>
                                )}
                                {subscription.plan.daysRemaining !== null && (
                                    <p>Kalan: {subscription.plan.daysRemaining} gün</p>
                                )}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                )}

                {/* Ayırıcı */}
                <div className="h-4 w-px bg-border" />

                {/* Canlı Saat */}
                <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formattedTime}</span>
                </div>

                {/* Ayırıcı */}
                <div className="h-4 w-px bg-border" />

                {/* Hesap Makinesi */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => setCalculatorOpen(prev => !prev)}
                            className={`flex items-center gap-1.5 text-xs font-medium rounded-md px-2 py-1 transition-colors ${
                                calculatorOpen
                                    ? "bg-primary/10 text-primary"
                                    : "hover:bg-accent hover:text-accent-foreground"
                            }`}
                        >
                            <Calculator className="h-3.5 w-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>Hesap Makinesi</TooltipContent>
                </Tooltip>
                <CalculatorWidget open={calculatorOpen} onClose={() => setCalculatorOpen(false)} />
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
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/ayarlar">
                                <Settings className="mr-2 h-4 w-4" />
                                Ayarlar
                            </Link>
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
