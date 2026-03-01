"use client"

import * as React from "react"
import { Users, UserCheck, UserX, Clock, Building2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { Customer } from "../columns"

interface EmptyStateProps {
    customers: Customer[]
    onSelectCustomer?: (customerId: string) => void
}

function StatCard({
    label,
    value,
    icon: Icon,
    color = "blue"
}: {
    label: string
    value: number
    icon: React.ElementType
    color?: "blue" | "green" | "red"
}) {
    const colorClasses = {
        blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
        green: "bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400",
        red: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400",
    }

    const iconBgClasses = {
        blue: "bg-blue-100 dark:bg-blue-900/50",
        green: "bg-green-100 dark:bg-green-900/50",
        red: "bg-red-100 dark:bg-red-900/50",
    }

    return (
        <Card className={`${colorClasses[color]} border-0`}>
            <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${iconBgClasses[color]}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs opacity-80">{label}</p>
                </div>
            </CardContent>
        </Card>
    )
}

export function EmptyState({ customers, onSelectCustomer }: EmptyStateProps) {
    const stats = React.useMemo(() => ({
        total: customers.length,
        active: customers.filter(c => c.status === "active" || !c.status).length,
        passive: customers.filter(c => c.status === "passive").length,
    }), [customers])

    const recentCustomers = React.useMemo(() =>
        [...customers]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 5),
        [customers]
    )

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / (1000 * 60))
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (diffMins < 60) return `${diffMins} dk önce`
        if (diffHours < 24) return `${diffHours} saat önce`
        if (diffDays < 7) return `${diffDays} gün önce`
        return date.toLocaleDateString("tr-TR")
    }

    return (
        <div className="h-full flex flex-col items-center justify-center p-8">
            {/* İstatistik Kartları */}
            <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-lg">
                <StatCard
                    label="Toplam"
                    value={stats.total}
                    icon={Users}
                    color="blue"
                />
                <StatCard
                    label="Aktif"
                    value={stats.active}
                    icon={UserCheck}
                    color="green"
                />
                <StatCard
                    label="Pasif"
                    value={stats.passive}
                    icon={UserX}
                    color="red"
                />
            </div>

            {/* Son İşlemler */}
            {recentCustomers.length > 0 && (
                <div className="w-full max-w-lg mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium text-muted-foreground">Son Güncellenen Mükellefler</h3>
                    </div>
                    <Card>
                        <CardContent className="p-0">
                            <ul className="divide-y">
                                {recentCustomers.map((customer) => (
                                    <li
                                        key={customer.id}
                                        className="px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors flex items-center justify-between"
                                        onClick={() => onSelectCustomer?.(customer.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="text-sm font-medium line-clamp-1">{customer.unvan}</p>
                                                <p className="text-xs text-muted-foreground">{customer.vknTckn}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                                            {formatDate(customer.updatedAt)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Seçim Mesajı */}
            <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                    Detayları görüntülemek için sol listeden bir mükellef seçin
                </p>
            </div>
        </div>
    )
}
