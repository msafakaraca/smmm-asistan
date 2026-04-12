"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    LayoutDashboard,
    ClipboardCheck,
    CalendarDays,
    Mail,
    MailOpen,
    Lock,
    MessageSquare,
    Settings,
    Briefcase,
    Building2,
    Users,
    FolderOpen,
    ClipboardList,
    StickyNote,
    Send,
    Inbox,
    PenSquare,
    ChevronDown,
    ChevronRight,
    FileText,
    Megaphone,
    ListTodo,
    Bot,
    TableProperties,
    Calculator,
    Percent,
    Scissors,
    Car,
    Landmark,
    Scale,
    Receipt,
    Clock,
    Timer,
    CalendarClock,
    Wallet,
    CreditCard,
    Cpu,
    Banknote,
    HandCoins,
    BarChart3,
    FileSpreadsheet,
    ScrollText,
    BookCheck,
    FileCheck,
    PanelLeftClose,
    PanelLeftOpen,
} from "lucide-react";

const SIDEBAR_KEY = "smmm-sidebar-collapsed";

const navItems = [
    {
        title: "Ana Panel",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Mükellef İşlemleri",
        href: "/dashboard/mukellefler",
        icon: ClipboardList,
        children: [
            {
                title: "Mükellef Listesi",
                href: "/dashboard/mukellefler",
                icon: Users,
            },
            {
                title: "Dosyalar",
                href: "/dashboard/dosyalar",
                icon: FolderOpen,
            },
            {
                title: "Şifreler",
                href: "/dashboard/sifreler",
                icon: Lock,
            },
        ],
    },
    {
        title: "Maliye İşlemleri",
        href: "/dashboard/beyanname-kontrol",
        icon: Landmark,
        children: [
            {
                title: "Beyanname Kontrol",
                href: "/dashboard/beyanname-kontrol",
                icon: Bot,
            },
            {
                title: "Beyannameler",
                href: "/dashboard/beyannameler",
                icon: ScrollText,
            },
            {
                title: "E-Arşiv Fatura",
                href: "/dashboard/e-arsiv-fatura",
                icon: Receipt,
            },
            {
                title: "Vergi Tahsil Alındıları",
                href: "/dashboard/tahsilat-alindilari",
                icon: Wallet,
            },
            {
                title: "POS Sorgulama",
                href: "/dashboard/pos-sorgulama",
                icon: CreditCard,
            },
            {
                title: "ÖKC Bildirim Sorgulama",
                href: "/dashboard/okc-bildirim",
                icon: Cpu,
            },
            {
                title: "E-Tebligat Sorgulama",
                href: "/dashboard/e-tebligat",
                icon: MailOpen,
            },
            {
                title: "E-Defter Kontrol",
                href: "/dashboard/e-defter-kontrol",
                icon: BookCheck,
            },
            {
                title: "Vergi Levhası",
                href: "/dashboard/vergi-levhasi",
                icon: FileCheck,
            },
        ],
    },
    {
        title: "SGK Sorgulama",
        href: "/dashboard/sgk-sorgulama",
        icon: Building2,
    },
    {
        title: "Ofis İşlemleri",
        href: "/dashboard/kontrol-cizelgesi",
        icon: Briefcase,
        children: [
            {
                title: "Kontrol Çizelgesi",
                href: "/dashboard/kontrol-cizelgesi",
                icon: TableProperties,
            },
            {
                title: "Takip Çizelgesi",
                href: "/dashboard/takip",
                icon: CalendarDays,
            },
            {
                title: "Toplu Gönderim",
                href: "/dashboard/toplu-gonderim",
                icon: Send,
            },
            {
                title: "Duyurular",
                href: "/dashboard/duyurular",
                icon: Megaphone,
            },
            {
                title: "Notlar",
                href: "/dashboard/notlar",
                icon: StickyNote,
            },
            {
                title: "Görevler",
                href: "/dashboard/gorevler",
                icon: ListTodo,
            },
        ],
    },
    {
        title: "Mail",
        href: "/dashboard/mail",
        icon: Mail,
        children: [
            {
                title: "Yeni Mesaj",
                href: "/dashboard/mail",
                icon: PenSquare,
            },
            {
                title: "Gelen Kutusu",
                href: "/dashboard/mail/inbox",
                icon: Inbox,
            },
        ],
    },
    {
        title: "PDF Araçları",
        href: "/dashboard/araclar",
        icon: FileText,
    },
    {
        title: "Hesaplama Araçları",
        href: "/dashboard/hesaplama-araclari",
        icon: Calculator,
        children: [
            {
                title: "Finansman Gider Kısıtlaması",
                href: "/dashboard/hesaplama-araclari/finansman-gider-kisitlamasi",
                icon: Percent,
            },
            {
                title: "KDV Tevkifat Hesaplama",
                href: "/dashboard/hesaplama-araclari/kdv-tevkifat",
                icon: Scissors,
            },
            {
                title: "SGK Asgari İşçilik",
                href: "/dashboard/hesaplama-araclari/asgari-iscilik",
                icon: Building2,
            },
            {
                title: "MTV Hesaplama",
                href: "/dashboard/hesaplama-araclari/mtv",
                icon: Car,
            },
            {
                title: "Gelir Vergisi Hesaplama",
                href: "/dashboard/hesaplama-araclari/gelir-vergisi",
                icon: Landmark,
            },
            {
                title: "Kıdem & İhbar Tazminatı",
                href: "/dashboard/hesaplama-araclari/kidem-ihbar-tazminati",
                icon: Scale,
            },
            {
                title: "Serbest Meslek Makbuzu",
                href: "/dashboard/hesaplama-araclari/smm",
                icon: Receipt,
            },
            {
                title: "Gecikme Zammı / Faizi",
                href: "/dashboard/hesaplama-araclari/gecikme-zammi",
                icon: Clock,
            },
            {
                title: "Gecikme Zammı - 7440 Kanun",
                href: "/dashboard/hesaplama-araclari/gecikme-zammi-7440",
                icon: Timer,
            },
            {
                title: "Gecikme Zammı - Yİ-ÜFE",
                href: "/dashboard/hesaplama-araclari/gecikme-zammi-yufe",
                icon: CalendarClock,
            },
        ],
    },
    {
        title: "Finansal İşlemler",
        href: "/dashboard/finansal-islemler",
        icon: Wallet,
        children: [
            {
                title: "Muhasebe Ücretleri",
                href: "/dashboard/finansal-islemler/muhasebe-ucretleri",
                icon: Calculator,
            },
            {
                title: "Tahsilatlar",
                href: "/dashboard/finansal-islemler/tahsilatlar",
                icon: HandCoins,
            },
            {
                title: "Hizmetler",
                href: "/dashboard/finansal-islemler/hizmetler",
                icon: Banknote,
            },
            {
                title: "Giderler",
                href: "/dashboard/finansal-islemler/giderler",
                icon: CreditCard,
            },
            {
                title: "İstatistikler",
                href: "/dashboard/finansal-islemler/istatistikler",
                icon: BarChart3,
            },
            {
                title: "Hesap Dökümü",
                href: "/dashboard/finansal-islemler/hesap-dokumu",
                icon: FileSpreadsheet,
            },
        ],
    },
    {
        title: "AI Asistan",
        href: "/dashboard/ai",
        icon: MessageSquare,
    },
    {
        title: "Ayarlar",
        href: "/dashboard/ayarlar",
        icon: Settings,
    },
];

interface NavItemType {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    children?: NavItemType[];
}

// Genişletilmiş sidebar nav item bileşeni
const NavItem = React.memo(function NavItem({
    item,
    isActive,
    pathname,
    isOpen,
    onToggle,
}: {
    item: NavItemType;
    isActive: boolean;
    pathname: string;
    isOpen?: boolean;
    onToggle?: () => void;
}) {
    if (item.children) {
        const isChildActive = item.children.some(
            child => pathname === child.href || pathname.startsWith(child.href + "/")
        );

        return (
            <div>
                <button
                    onClick={onToggle}
                    className={cn(
                        "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm",
                        isChildActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{item.title}</span>
                    </div>
                    {isOpen ? (
                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    ) : (
                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    )}
                </button>
                {isOpen && (
                    <div className="mt-1 ml-3 pl-2 border-l-2 border-border space-y-1">
                        {item.children.map((child) => {
                            const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                            return (
                                <Link
                                    key={child.href}
                                    href={child.href}
                                    className={cn(
                                        "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm",
                                        childActive
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <child.icon className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="truncate">{child.title}</span>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    return (
        <Link
            href={item.href}
            className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm min-w-0",
                isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
        >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{item.title}</span>
        </Link>
    );
});

// Daraltılmış sidebar nav item bileşeni — sadece ikon + tooltip
const CollapsedNavItem = React.memo(function CollapsedNavItem({
    item,
    isActive,
    onExpand,
}: {
    item: NavItemType;
    isActive: boolean;
    onExpand: () => void;
}) {
    if (item.children) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={onExpand}
                        className={cn(
                            "w-full flex items-center justify-center p-2.5 rounded-lg transition-colors",
                            isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                    {item.title}
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Link
                    href={item.href}
                    className={cn(
                        "flex items-center justify-center p-2.5 rounded-lg transition-colors",
                        isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
                {item.title}
            </TooltipContent>
        </Tooltip>
    );
});

export const DashboardNav = React.memo(function DashboardNav() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Etkin daraltma durumu: kullanıcı tercihi + hover
    const effectiveCollapsed = collapsed && !isHovered;

    // localStorage'dan başlangıç durumunu oku (hydration sonrası)
    React.useEffect(() => {
        const saved = localStorage.getItem(SIDEBAR_KEY);
        if (saved === "true") setCollapsed(true);
    }, []);

    // Timeout cleanup
    React.useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        };
    }, []);

    const handleMouseEnter = React.useCallback(() => {
        if (!collapsed) return;
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setIsHovered(true);
    }, [collapsed]);

    const handleMouseLeave = React.useCallback(() => {
        if (!collapsed) return;
        hoverTimeoutRef.current = setTimeout(() => setIsHovered(false), 300);
    }, [collapsed]);

    const [openMenus, setOpenMenus] = React.useState<Set<string>>(() => {
        const initial = new Set<string>();
        navItems.forEach(item => {
            if (item.children?.some(child => pathname === child.href || pathname.startsWith(child.href + "/"))) {
                initial.add(item.title);
            }
        });
        return initial;
    });

    const activeStates = React.useMemo(() => {
        return navItems.map(item => {
            if (item.children) {
                return item.children.some(
                    child => pathname === child.href || pathname.startsWith(child.href + "/")
                );
            }
            return pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
        });
    }, [pathname]);

    const toggleCollapsed = React.useCallback(() => {
        setCollapsed(prev => {
            const next = !prev;
            localStorage.setItem(SIDEBAR_KEY, String(next));
            return next;
        });
    }, []);

    // Daraltıldığında açık menüleri kapat
    React.useEffect(() => {
        if (collapsed) {
            setOpenMenus(new Set());
        }
    }, [collapsed]);

    const handleToggle = React.useCallback((title: string) => {
        setOpenMenus(prev => {
            const next = new Set(prev);
            if (next.has(title)) {
                next.delete(title);
            } else {
                next.add(title);
            }
            return next;
        });
    }, []);

    // Pathname değiştiğinde ilgili parent menüyü açık tut
    React.useEffect(() => {
        navItems.forEach(item => {
            if (item.children?.some(child => pathname === child.href || pathname.startsWith(child.href + "/"))) {
                setOpenMenus(prev => {
                    if (prev.has(item.title)) return prev;
                    const next = new Set(prev);
                    next.add(item.title);
                    return next;
                });
            }
        });
    }, [pathname]);

    // Daraltılmış modda bir üst menüye tıklandığında sidebar'ı aç ve menüyü genişlet
    const handleExpandWithMenu = React.useCallback((title: string) => {
        setCollapsed(false);
        localStorage.setItem(SIDEBAR_KEY, "false");
        setOpenMenus(new Set([title]));
    }, []);

    return (
        <div
            className={cn(
                "flex-shrink-0 relative",
                collapsed ? "w-16" : "w-64 xl:w-72"
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
        <aside
            className={cn(
                "border-r bg-card flex flex-col h-screen overflow-hidden rounded-r-2xl",
                collapsed
                    ? cn(
                        "absolute top-0 left-0 z-50 transition-[width,box-shadow] duration-200 ease-out",
                        isHovered ? "w-64 xl:w-72 shadow-2xl" : "w-16 shadow-none"
                      )
                    : "w-64 xl:w-72"
            )}
        >
            {/* Logo */}
            <div className="h-16 flex items-center justify-center border-b flex-shrink-0 overflow-hidden">
                <Link href="/dashboard" className={cn("flex items-center", effectiveCollapsed ? "justify-center" : "gap-2")}>
                    <Building2 className="h-6 w-6 text-primary flex-shrink-0" />
                    <span className={cn(
                        "font-bold text-lg whitespace-nowrap transition-[opacity,width] duration-200",
                        effectiveCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                    )}>SMMM Asistan</span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto scrollbar-thin">
                <div className={cn("space-y-1 p-2", effectiveCollapsed ? "block" : "hidden")} aria-hidden={!effectiveCollapsed}>
                    {navItems.map((item, index) => (
                        <CollapsedNavItem
                            key={item.href + item.title}
                            item={item as NavItemType}
                            isActive={activeStates[index]}
                            onExpand={() => handleExpandWithMenu(item.title)}
                        />
                    ))}
                </div>
                <div className={cn("space-y-1 px-2 py-3", effectiveCollapsed ? "hidden" : "block")} aria-hidden={effectiveCollapsed}>
                    {navItems.map((item, index) => (
                        <NavItem
                            key={item.href + item.title}
                            item={item as NavItemType}
                            isActive={activeStates[index]}
                            pathname={pathname}
                            isOpen={openMenus.has(item.title)}
                            onToggle={() => handleToggle(item.title)}
                        />
                    ))}
                </div>
            </nav>

            {/* Footer */}
            <div className="h-12 flex items-center justify-center border-t flex-shrink-0">
                {effectiveCollapsed ? (
                    <button
                        onClick={toggleCollapsed}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Sidebar'ı genişlet"
                    >
                        <PanelLeftOpen className="h-4 w-4" />
                    </button>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        © 2025 SMMM Asistan
                    </span>
                )}
            </div>
        </aside>
        </div>
    );
});
