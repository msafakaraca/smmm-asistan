"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    ClipboardCheck,
    CalendarDays,
    Mail,
    MailOpen,
    Lock,
    MessageSquare,
    Settings,
    Building2,
    Users,
    FolderOpen,
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
} from "lucide-react";

const navItems = [
    {
        title: "Ana Panel",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Mükellefler",
        href: "/dashboard/mukellefler",
        icon: Users,
        children: [
            {
                title: "Mükellef Listesi",
                href: "/dashboard/mukellefler",
                icon: Users,
            },
            {
                title: "Beyanname Türleri",
                href: "/dashboard/mukellefler/beyannameler",
                icon: FileText,
            },
        ],
    },
    {
        title: "Beyanname İşlemleri",
        href: "/dashboard/beyanname-kontrol",
        icon: ClipboardCheck,
        children: [
            {
                title: "Beyanname Kontrol",
                href: "/dashboard/beyanname-kontrol",
                icon: Bot,
            },
            {
                title: "Kontrol Çizelgesi",
                href: "/dashboard/kontrol-cizelgesi",
                icon: TableProperties,
            },
            {
                title: "Toplu Gönderim",
                href: "/dashboard/toplu-gonderim",
                icon: Send,
            },
            {
                title: "Beyanname Sorgulama",
                href: "/dashboard/beyannameler",
                icon: ScrollText,
            },
        ],
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
        title: "Takip Çizelgesi",
        href: "/dashboard/takip",
        icon: CalendarDays,
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
    {
        title: "Duyurular",
        href: "/dashboard/duyurular",
        icon: Megaphone,
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
        title: "Dosyalar",
        href: "/dashboard/dosyalar",
        icon: FolderOpen,
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
        title: "Şifreler",
        href: "/dashboard/sifreler",
        icon: Lock,
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

// Memoized nav item component with sub menu support
const NavItem = React.memo(function NavItem({
    item,
    isActive,
    pathname,
    isOpen,
    onToggle,
    onNavigate
}: {
    item: NavItemType;
    isActive: boolean;
    pathname: string;
    isOpen?: boolean;
    onToggle?: () => void;
    onNavigate?: () => void;
}) {
    // Sub menü olan item
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
                        <ChevronDown className="h-4 w-4" />
                    ) : (
                        <ChevronRight className="h-4 w-4" />
                    )}
                </button>
                {isOpen && (
                    <div className="mt-1 ml-4 pl-3 border-l-2 border-border space-y-1">
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

    // Normal item
    return (
        <Link
            href={item.href}
            onClick={onNavigate}
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

export const DashboardNav = React.memo(function DashboardNav() {
    const pathname = usePathname();

    // Açık menüleri takip et (children olan menüler için)
    const [openMenus, setOpenMenus] = React.useState<Set<string>>(() => {
        const initial = new Set<string>();
        // Aktif sayfanın parent menüsünü otomatik aç
        navItems.forEach(item => {
            if (item.children?.some(child => pathname === child.href || pathname.startsWith(child.href + "/"))) {
                initial.add(item.title);
            }
        });
        return initial;
    });

    // Memoize active states calculation
    const activeStates = React.useMemo(() => {
        return navItems.map(item => {
            // Sub menü olan itemler için children kontrolü yap
            if (item.children) {
                return item.children.some(
                    child => pathname === child.href || pathname.startsWith(child.href + "/")
                );
            }
            return pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
        });
    }, [pathname]);

    // Sub menü toggle
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

    // Normal menüye tıklandığında tüm sub menüleri kapat
    const handleNavigate = React.useCallback(() => {
        setOpenMenus(new Set());
    }, []);

    return (
        <aside className="w-64 xl:w-72 border-r bg-card flex flex-col sticky top-0 h-screen">
            {/* Logo */}
            <div className="h-16 flex items-center px-4 border-b">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <Building2 className="h-6 w-6 text-primary" />
                    <span className="font-bold text-lg">SMMM Asistan</span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navItems.map((item, index) => (
                    <NavItem
                        key={item.href + item.title}
                        item={item as NavItemType}
                        isActive={activeStates[index]}
                        pathname={pathname}
                        isOpen={openMenus.has(item.title)}
                        onToggle={() => handleToggle(item.title)}
                        onNavigate={handleNavigate}
                    />
                ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t">
                <div className="text-xs text-muted-foreground text-center">
                    © 2025 SMMM Asistan
                </div>
            </div>
        </aside>
    );
});
