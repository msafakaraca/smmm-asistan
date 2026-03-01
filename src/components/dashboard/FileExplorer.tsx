"use client"

import * as React from "react"
import {
    FileText,
    Download,
    Trash2,
    FolderOpen,
    Calendar,
    Search,
    Filter,
    MoreVertical,
    Send
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/sonner"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface Document {
    id: string
    name: string
    originalName: string
    type: string
    mimeType: string
    size: number
    path: string
    year: number | null
    month: number | null
    createdAt: string
    customerId: string
    customer?: {
        unvan: string
    }
}

interface FileExplorerProps {
    customerId?: string
    title?: string
    description?: string
}

export function FileExplorer({ customerId, title = "Dosyalar", description = "Sistemdeki tüm belgeleri görüntüleyin ve yönetin." }: FileExplorerProps) {
    const [documents, setDocuments] = React.useState<Document[]>([])
    const [loading, setLoading] = React.useState(true)
    const [search, setSearch] = React.useState("")
    const [typeFilter, setTypeFilter] = React.useState("all")

    const fetchDocuments = async () => {
        setLoading(true)
        try {
            const url = customerId
                ? `/api/customers/${customerId}/files`
                : `/api/documents`
            const res = await fetch(url)
            if (!res.ok) throw new Error("Dosyalar alınamadı")
            const data = await res.json()
            setDocuments(data)
        } catch (error) {
            toast.error("Dosyalar yüklenemedi")
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        fetchDocuments()
    }, [customerId])

    const downloadDocument = async (docId: string, fileName: string) => {
        try {
            const res = await fetch(`/api/documents/${docId}/download`)
            if (!res.ok) throw new Error("İndirme başarısız")
            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = fileName
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
        } catch (error) {
            toast.error("Dosya indirilemedi")
        }
    }

    const filteredDocs = documents.filter(doc => {
        const matchesSearch = doc.originalName.toLowerCase().includes(search.toLowerCase()) ||
            doc.customer?.unvan.toLowerCase().includes(search.toLowerCase())
        const matchesType = typeFilter === "all" || doc.type === typeFilter
        return matchesSearch && matchesType
    })

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                <div>
                    <CardTitle className="text-2xl font-bold">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchDocuments} disabled={loading}>
                    Yenile
                </Button>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Dosya adı veya mükellef ara..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[150px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Tür Seç" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Türler</SelectItem>
                                <SelectItem value="beyanname">Beyanname</SelectItem>
                                <SelectItem value="tahakkuk">Tahakkuk</SelectItem>
                                <SelectItem value="dilekce">Dilekçe</SelectItem>
                                <SelectItem value="diger">Diğer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-lg" />
                        ))}
                    </div>
                ) : filteredDocs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg bg-muted/10 text-muted-foreground">
                        <FolderOpen className="h-12 w-12 mb-4 opacity-20" />
                        <p className="text-lg font-medium">Dosya bulunamadı</p>
                        <p className="text-sm">Arama kriterlerini değiştirin veya yeni dosya eklenmesini bekleyin.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredDocs.map((doc) => (
                            <div
                                key={doc.id}
                                className="group relative flex flex-col p-4 border rounded-xl hover:shadow-md transition-all bg-card hover:border-primary/20"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                        <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => downloadDocument(doc.id, doc.originalName)}>
                                                <Download className="h-4 w-4 mr-2" /> İndir
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-blue-600">
                                                <Send className="h-4 w-4 mr-2" /> Mail Gönder
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive">
                                                <Trash2 className="h-4 w-4 mr-2" /> Sil
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-semibold text-sm truncate pr-6" title={doc.originalName}>
                                        {doc.originalName}
                                    </h3>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {doc.customer?.unvan || "Mükellef Belirtilmemiş"}
                                    </p>
                                </div>
                                <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground border-t pt-3">
                                    <div className="flex items-center gap-2">
                                        <span className="capitalize px-1.5 py-0.5 rounded bg-muted">
                                            {doc.type}
                                        </span>
                                        {doc.year && (
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {doc.month}/{doc.year}
                                            </span>
                                        )}
                                    </div>
                                    <span>{new Date(doc.createdAt).toLocaleDateString("tr-TR")}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
