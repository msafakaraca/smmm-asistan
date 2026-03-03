"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { preload } from "swr"
import {
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, Plus, Trash2, X, UserCheck, UserX, FileText } from "lucide-react"
import { toast } from "@/components/ui/sonner"

// Grupları arka planda önceden yükle
const fetcher = (url: string) => fetch(url).then((res) => res.json());
if (typeof window !== 'undefined') {
    preload("/api/customer-groups", fetcher);
}

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import { Customer, columns } from "./columns"
import Link from "next/link"
import { ImportDialog } from "./import-dialog"
import { ImportResultsDialog } from "./import-results-dialog"
import { CustomerGroupsDialog } from "@/components/customer-groups/customer-groups-dialog"
import { Icon } from "@iconify/react"

export function CustomerListClient() {
    const router = useRouter()
    const [data, setData] = React.useState<Customer[]>([])
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = React.useState({})
    const [loading, setLoading] = React.useState(true)
    const [gibLoading, setGibLoading] = React.useState(false)
    const [deleteAllLoading, setDeleteAllLoading] = React.useState(false)
    const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "passive">("all")
    const [bulkStatusLoading, setBulkStatusLoading] = React.useState(false)

    // GİB Import Results Dialog State
    const [importResultsOpen, setImportResultsOpen] = React.useState(false)
    const [importResults, setImportResults] = React.useState<{
        stats: { total: number; created: number; updated: number; skipped: number }
        message: string
        taxpayers?: any[]
    } | null>(null)

    // Memoize fetch function
    const fetchCustomers = React.useCallback(async () => {
        try {
            const params = new URLSearchParams()
            if (statusFilter !== "all") {
                params.set("status", statusFilter)
            }
            const url = params.toString() ? `/api/customers?${params.toString()}` : "/api/customers"
            const res = await fetch(url)
            const json = await res.json()
            if (Array.isArray(json)) {
                setData(json)
            }
        } catch (error) {
            console.error("Failed to fetch customers", error)
        } finally {
            setLoading(false)
        }
    }, [statusFilter])

    React.useEffect(() => {
        fetchCustomers()
    }, [fetchCustomers])

    // fetchCustomers ref - WebSocket callback'te kullanmak için
    const fetchCustomersRef = React.useRef(fetchCustomers)
    React.useEffect(() => {
        fetchCustomersRef.current = fetchCustomers
    }, [fetchCustomers])

    // WebSocket listener for GİB import completion
    React.useEffect(() => {
        let ws: WebSocket | null = null
        let reconnectTimeout: NodeJS.Timeout | null = null

        const connect = async () => {
            try {
                const tokenRes = await fetch("/api/auth/token")
                if (!tokenRes.ok) {
                    console.log("[WS] Token fetch failed, retrying...")
                    reconnectTimeout = setTimeout(connect, 3000)
                    return
                }
                const { token } = await tokenRes.json()

                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
                const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3001'
                const wsHost = `${window.location.hostname}:${wsPort}`
                ws = new WebSocket(`${protocol}//${wsHost}?token=${token}`)

                ws.onopen = () => {
                    console.log("[WS] Mükellefler sayfası WebSocket bağlantısı kuruldu")
                }

                ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data)
                        console.log("[WS-CLIENT] Mesaj alındı:", message.type, message)

                        if (message.type === 'gib:mukellef-import-complete') {
                            const { stats, taxpayers, message: msg } = message.data || {}
                            console.log("[WS-CLIENT] Import complete! Stats:", stats)

                            fetchCustomersRef.current()
                            setGibLoading(false)

                            if (stats) {
                                setImportResults({
                                    stats: stats,
                                    message: msg || `${stats.created} yeni mükellef eklendi`,
                                    taxpayers: taxpayers || []
                                })
                                setImportResultsOpen(true)
                            }
                        }

                        if (message.type === 'gib:mukellef-import-error') {
                            toast.error(message.data?.error || 'Import hatası')
                            setGibLoading(false)
                        }
                    } catch (e) {
                        console.error("[WS] Parse error:", e)
                    }
                }

                ws.onclose = () => {
                    console.log("[WS] Bağlantı kapandı, yeniden bağlanılıyor...")
                    reconnectTimeout = setTimeout(connect, 3000)
                }

                ws.onerror = (error) => {
                    console.error("[WS] Hata:", error)
                    ws?.close()
                }
            } catch (e) {
                console.error("[WS] Bağlantı hatası:", e)
                reconnectTimeout = setTimeout(connect, 3000)
            }
        }

        connect()

        return () => {
            if (reconnectTimeout) clearTimeout(reconnectTimeout)
            if (ws) ws.close()
        }
    }, [])

    const handleDelete = React.useCallback(async () => {
        const selectedIds = Object.keys(rowSelection).map(index => data[parseInt(index)]?.id).filter(Boolean)

        if (selectedIds.length === 0) return

        if (!confirm(`${selectedIds.length} mükellefi silmek istediğinize emin misiniz?`)) return

        try {
            const res = await fetch("/api/customers/bulk-delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedIds }),
            })

            if (!res.ok) throw new Error("Silme işlemi başarısız")

            const result = await res.json()
            toast.success(`${result.count} mükellef silindi`)
            setRowSelection({})
            fetchCustomers()
        } catch (error) {
            toast.error("Silme işlemi sırasında hata oluştu")
        }
    }, [rowSelection, data, fetchCustomers])

    // Toplu durum değiştirme
    const handleBulkStatus = React.useCallback(async (newStatus: "active" | "passive") => {
        const selectedIds = Object.keys(rowSelection).map(index => data[parseInt(index)]?.id).filter(Boolean)

        if (selectedIds.length === 0) return

        const actionText = newStatus === "passive" ? "pasife almak" : "aktife almak"
        const warningText = newStatus === "passive"
            ? `\n\n⚠️ Pasif mükelleflerin beyanname takip kayıtları silinecektir.`
            : ""

        if (!confirm(`${selectedIds.length} mükellefi ${actionText} istediğinize emin misiniz?${warningText}`)) return

        setBulkStatusLoading(true)
        try {
            const res = await fetch("/api/customers/bulk-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedIds, status: newStatus }),
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || "İşlem başarısız")
            }

            const result = await res.json()
            toast.success(result.message)
            setRowSelection({})
            fetchCustomers()
        } catch (error) {
            toast.error((error as Error).message || "İşlem sırasında hata oluştu")
        } finally {
            setBulkStatusLoading(false)
        }
    }, [rowSelection, data, fetchCustomers])

    const handleDeleteAll = React.useCallback(async () => {
        const customerCount = data.length
        if (customerCount === 0) return

        if (!confirm(`⚠️ DİKKAT: ${customerCount} mükellefi silmek üzeresiniz!\n\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?`)) return

        const confirmText = prompt(`Bu işlemi onaylamak için "SİL" yazın:`)
        if (confirmText !== "SİL") {
            toast.error("İşlem iptal edildi")
            return
        }

        setDeleteAllLoading(true)

        try {
            const res = await fetch("/api/customers/delete-all", {
                method: "DELETE",
            })

            if (!res.ok) throw new Error("Silme işlemi başarısız")

            const result = await res.json()

            toast.success(`${result.count} mükellef silindi`)
            setRowSelection({})
            fetchCustomers()

        } catch (error) {
            toast.error("Silme işlemi sırasında hata oluştu")
        } finally {
            setDeleteAllLoading(false)
        }
    }, [data, fetchCustomers])

    const handleSingleDelete = React.useCallback(async (id: string) => {
        if (!confirm("Bu mükellefi silmek istediğinize emin misiniz?")) return;

        try {
            const res = await fetch("/api/customers/bulk-delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [id] }),
            });

            if (!res.ok) throw new Error("Silme işlemi başarısız");

            toast.success("Mükellef silindi");
            fetchCustomers();
        } catch (error) {
            toast.error("Silme işlemi sırasında hata oluştu");
        }
    }, [fetchCustomers]);

    // SiraNo güncelleme
    const handleUpdateSiraNo = React.useCallback(async (id: string, value: string) => {
        setData(prev => prev.map(c => c.id === id ? { ...c, siraNo: value } : c));

        try {
            const res = await fetch("/api/customers", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, field: "siraNo", value }),
            });

            if (!res.ok) {
                throw new Error("Güncelleme başarısız");
            }
        } catch (error) {
            console.error("SiraNo update error:", error);
            toast.error("No güncellenemedi");
            fetchCustomers();
        }
    }, [fetchCustomers]);

    // Satır tıklama → detay sayfasına git
    const handleRowClick = React.useCallback((customerId: string) => {
        router.push(`/dashboard/mukellefler/${customerId}`)
    }, [router])

    // Memoize table configuration - Sayfalama kapalı, tüm veriler gösteriliyor
    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
        meta: {
            deleteCustomer: handleSingleDelete,
            updateSiraNo: handleUpdateSiraNo
        },
    })

    const handleGibSync = React.useCallback(async () => {
        setGibLoading(true)

        try {
            const response = await fetch("/api/gib/mukellefler/sync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            })

            const data = await response.json()

            if (!response.ok) {
                toast.error(data.error || "Bağlantı hatası")
                setGibLoading(false)
                return
            }

            toast.success(data.message || "Bot başlatıldı. Electron penceresini takip edin.")
            // gibLoading, WebSocket'ten gelen gib:mukellef-import-complete veya
            // gib:mukellef-import-error mesajlarıyla kapatılacak

        } catch (error) {
            console.error("GİB sync error:", error)
            toast.error("Bağlantı hatası")
            setGibLoading(false)
        }
    }, [])

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] -m-4 xl:-m-6">
            {/* Üst Toolbar - Tam genişlik */}
            <div className="flex flex-wrap items-center justify-between p-3 border-b gap-2 shrink-0">
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="İsim veya VKN ile ara..."
                        value={(table.getColumn("unvan")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("unvan")?.setFilterValue(event.target.value)
                        }
                        className="w-[140px] lg:w-[180px] xl:w-[220px] h-8 text-sm"
                    />
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | "active" | "passive")}>
                        <SelectTrigger className="w-[100px] h-8 text-sm">
                            <SelectValue placeholder="Durum" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tümü</SelectItem>
                            <SelectItem value="active">Aktif</SelectItem>
                            <SelectItem value="passive">Pasif</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/dashboard/mukellefler/yeni">
                        <Button size="sm" className="h-8">
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Yeni
                        </Button>
                    </Link>
                    <Button variant="outline" size="sm" className="h-8" onClick={handleGibSync} disabled={gibLoading}>
                        <Icon icon={gibLoading ? "solar:refresh-bold" : "solar:buildings-2-bold"} className={`mr-1.5 h-3.5 w-3.5 ${gibLoading ? "animate-spin" : ""}`} />
                        {gibLoading ? "Çekiliyor..." : "Mükellefleri Çek"}
                    </Button>
                    <Link href="/dashboard/mukellefler/beyannameler">
                        <Button variant="outline" size="sm" className="h-8">
                            <FileText className="mr-1.5 h-3.5 w-3.5" />
                            Beyanname Türleri
                        </Button>
                    </Link>
                    <CustomerGroupsDialog
                        customers={data}
                        selectedCustomerIds={Object.keys(rowSelection).map(index => data[parseInt(index)]?.id).filter(Boolean)}
                        onGroupsChange={fetchCustomers}
                    />
                    <ImportDialog onSuccess={fetchCustomers} />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8">
                                Sütunlar <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {table
                                .getAllColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => {
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="capitalize text-xs"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) =>
                                                column.toggleVisibility(!!value)
                                            }
                                        >
                                            {column.id}
                                        </DropdownMenuCheckboxItem>
                                    )
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {data.length > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            className="h-8"
                            onClick={handleDeleteAll}
                            disabled={deleteAllLoading}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Liste */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto scrollbar-thin">
                    <Table className="table-fixed w-full">
                        <TableHeader className="sticky top-0 bg-background z-10">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableHead
                                                key={header.id}
                                                style={{ width: header.getSize() }}
                                                className={`px-1.5 py-2 ${header.column.id === 'unvan' ? 'text-left' : 'text-center'}`}
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center text-sm">
                                        Yükleniyor...
                                    </TableCell>
                                </TableRow>
                            ) : table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => {
                                    const isPassive = (row.original as any).status === "passive"

                                    return (
                                        <TableRow
                                            key={row.id}
                                            data-state={row.getIsSelected() && "selected"}
                                            onClick={() => handleRowClick((row.original as any).id)}
                                            className={`cursor-pointer transition-colors ${
                                                isPassive
                                                    ? "bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                                                    : "hover:bg-muted/50"
                                            }`}
                                        >
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell
                                                    key={cell.id}
                                                    style={{ width: cell.column.getSize() }}
                                                    className={`px-1.5 py-1.5 overflow-hidden ${cell.column.id === 'unvan' ? 'text-left' : 'text-center'}`}
                                                    onClick={(e) => {
                                                        if (cell.column.id === 'select') {
                                                            e.stopPropagation()
                                                        }
                                                    }}
                                                >
                                                    {flexRender(
                                                        cell.column.columnDef.cell,
                                                        cell.getContext()
                                                    )}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-24 text-center text-sm"
                                    >
                                        Kayıt bulunamadı.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Alt Bilgi Bar */}
                <div className="flex items-center justify-between px-3 py-1.5 border-t shrink-0 bg-background">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{table.getFilteredSelectedRowModel().rows.length} seçili</span>
                        <span className="text-muted-foreground/60">•</span>
                        <span>Toplam {table.getFilteredRowModel().rows.length} mükellef</span>
                    </div>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {Object.keys(rowSelection).length > 0 && (() => {
                const selectedCustomers = Object.keys(rowSelection).map(index => data[parseInt(index)]).filter(Boolean)
                const hasActiveSelected = selectedCustomers.some(c => c.status === "active" || !c.status)
                const hasPassiveSelected = selectedCustomers.some(c => c.status === "passive")

                return (
                    <div className="sticky bottom-0 mx-2 mb-2 rounded-lg border bg-background p-3 shadow-lg animate-in slide-in-from-bottom-5 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="font-semibold">{Object.keys(rowSelection).length}</span>
                                <span className="text-muted-foreground">seçildi</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setRowSelection({})}>
                                    <X className="mr-1.5 h-3.5 w-3.5" /> İptal
                                </Button>
                                {hasActiveSelected && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleBulkStatus("passive")}
                                        disabled={bulkStatusLoading}
                                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                    >
                                        <UserX className="mr-1.5 h-3.5 w-3.5" />
                                        Pasife Al
                                    </Button>
                                )}
                                {hasPassiveSelected && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleBulkStatus("active")}
                                        disabled={bulkStatusLoading}
                                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    >
                                        <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                                        Aktife Al
                                    </Button>
                                )}
                                <Button variant="destructive" size="sm" onClick={handleDelete}>
                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Sil
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* GİB Import Results Dialog */}
            <ImportResultsDialog
                open={importResultsOpen}
                onOpenChange={setImportResultsOpen}
                results={importResults}
                onClose={() => {
                    setImportResults(null)
                }}
            />
        </div>
    )
}
