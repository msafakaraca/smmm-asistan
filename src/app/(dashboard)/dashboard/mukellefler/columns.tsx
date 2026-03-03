"use client"

import { useState, useRef, useEffect } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown, Trash } from "lucide-react"
import { toTitleCase } from "@/lib/utils/text"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

// Düzenlenebilir No hücresi - Kompakt versiyon
function EditableNoCell({
    value,
    customerId,
    onUpdate
}: {
    value: string | null | undefined
    customerId: string
    onUpdate: (id: string, value: string) => void
}) {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(value || "")
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    useEffect(() => {
        setEditValue(value || "")
    }, [value])

    const handleSave = () => {
        if (editValue !== value) {
            onUpdate(customerId, editValue)
        }
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            handleSave()
        } else if (e.key === "Escape") {
            setEditValue(value || "")
            setIsEditing(false)
        }
    }

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="w-8 font-mono text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 outline-none rounded px-1 py-0.5"
                placeholder="-"
            />
        )
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        onClick={(e) => {
                            e.stopPropagation()
                            setIsEditing(true)
                        }}
                        className="inline-flex items-center px-1 py-0.5 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                        {value || "-"}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                    <p>Düzenlemek için tıklayın</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

// This type is directly related to the Prisma model but we select specific fields in API
export type Customer = {
    id: string
    unvan: string
    kisaltma: string | null
    vknTckn: string
    vergiKimlikNo: string | null
    tcKimlikNo: string | null
    vergiDairesi: string | null
    sirketTipi: string
    email: string | null
    telefon1: string | null
    status: string
    updatedAt: string
    siraNo?: string | null
    sozlesmeNo?: string | null
    sozlesmeTarihi?: string | null
}

// Şirket tipi sıralama önceliği
const sirketTipiOrder: Record<string, number> = {
    "firma": 1,
    "sahis": 2,
    "basit_usul": 3
}

// Kompakt kolonlar - Tam ekran liste için
export const columns: ColumnDef<Customer>[] = [
    {
        id: "select",
        size: 32,
        minSize: 32,
        maxSize: 32,
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Tümünü seç"
                className="h-3.5 w-3.5"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Satırı seç"
                className="h-3.5 w-3.5"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "siraNo",
        size: 45,
        minSize: 45,
        maxSize: 45,
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="h-7 px-0 text-xs"
                size="sm"
            >
                No
                <ArrowUpDown className="ml-0.5 h-3 w-3" />
            </Button>
        ),
        cell: ({ row, table }) => {
            const value = row.getValue("siraNo") as string | null | undefined
            const customerId = row.original.id
            const updateSiraNo = (table.options.meta as any)?.updateSiraNo

            return (
                <EditableNoCell
                    value={value}
                    customerId={customerId}
                    onUpdate={updateSiraNo || (() => {})}
                />
            )
        },
        sortingFn: (rowA, rowB) => {
            const a = parseInt(rowA.getValue("siraNo") || "9999")
            const b = parseInt(rowB.getValue("siraNo") || "9999")
            return a - b
        }
    },
    {
        accessorKey: "unvan",
        size: 160,
        minSize: 120,
        maxSize: 220,
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="px-0 h-7 text-xs"
            >
                Ünvan
                <ArrowUpDown className="ml-0.5 h-3 w-3" />
            </Button>
        ),
        cell: ({ row }) => {
            const rawUnvan = row.getValue("unvan") as string
            const unvan = toTitleCase(rawUnvan)

            return (
                <div className="font-medium text-xs whitespace-normal break-words">
                    {unvan}
                </div>
            )
        },
    },
    {
        accessorKey: "sirketTipi",
        size: 60,
        minSize: 60,
        maxSize: 60,
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="px-0 h-7 text-xs"
                size="sm"
            >
                Tip
                <ArrowUpDown className="ml-0.5 h-3 w-3" />
            </Button>
        ),
        cell: ({ row }) => {
            const type = row.getValue("sirketTipi") as string
            let label = "Firma"
            let variant: "default" | "secondary" | "outline" | "destructive" = "default"

            switch (type) {
                case "sahis": label = "Şahıs"; variant = "secondary"; break;
                case "basit_usul": label = "B.U"; variant = "outline"; break;
                case "firma": label = "Firma"; variant = "default"; break;
            }

            return <Badge variant={variant} className="text-[10px] px-1.5 py-0">{label}</Badge>
        },
        sortingFn: (rowA, rowB) => {
            const a = sirketTipiOrder[rowA.getValue("sirketTipi") as string] || 99
            const b = sirketTipiOrder[rowB.getValue("sirketTipi") as string] || 99
            return a - b
        }
    },
    {
        accessorKey: "vergiKimlikNo",
        size: 95,
        minSize: 95,
        maxSize: 95,
        header: () => <span className="text-[10px]">VKN</span>,
        cell: ({ row }) => {
            const vkn = row.original.vergiKimlikNo
            return vkn ? <span className="font-mono text-xs">{vkn}</span> : <span className="text-muted-foreground text-xs">-</span>
        }
    },
    {
        accessorKey: "tcKimlikNo",
        size: 105,
        minSize: 105,
        maxSize: 105,
        header: () => <span className="text-[10px]">TCKN</span>,
        cell: ({ row }) => {
            const tckn = row.original.tcKimlikNo
            return tckn ? <span className="font-mono text-xs">{tckn}</span> : <span className="text-muted-foreground text-xs">-</span>
        }
    },
    {
        accessorKey: "status",
        size: 55,
        minSize: 55,
        maxSize: 55,
        header: () => <span className="text-[10px]">Durum</span>,
        cell: ({ row }) => {
            const status = row.getValue("status") as string
            return (
                <Badge variant={status === "active" ? "secondary" : "destructive"} className="text-[10px] px-1.5 py-0">
                    {status === "active" ? "Aktif" : "Pasif"}
                </Badge>
            )
        },
    },
    {
        id: "actions",
        size: 36,
        minSize: 36,
        maxSize: 36,
        cell: ({ row, table }) => {
            const customer = row.original

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-6 w-6 p-0">
                            <span className="sr-only">Menü aç</span>
                            <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel className="text-xs">İşlemler</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 text-xs"
                            onClick={(e) => {
                                e.stopPropagation();
                                (table.options.meta as any)?.deleteCustomer(customer.id);
                            }}
                        >
                            <Trash className="mr-2 h-3.5 w-3.5" /> Sil
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
