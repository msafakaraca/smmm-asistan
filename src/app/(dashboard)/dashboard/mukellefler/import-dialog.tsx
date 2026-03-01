"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileSpreadsheet, Loader2, AlertCircle, Download, FileUp } from "lucide-react"
import ExcelJS from "exceljs"
import { toast } from "@/components/ui/sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface ImportDialogProps {
    onSuccess: () => void
}

export function ImportDialog({ onSuccess }: ImportDialogProps) {
    const [open, setOpen] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const [file, setFile] = React.useState<File | null>(null)
    const [preview, setPreview] = React.useState<any[]>([])
    const [error, setError] = React.useState<string | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            parseFile(selectedFile)
        }
    }

    const downloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet("Mukellef Listesi")

        worksheet.columns = [
            { header: "Ünvan", key: "unvan", width: 35 },
            { header: "VKN/TCKN", key: "vkn", width: 15 },
            { header: "Vergi Dairesi", key: "vd", width: 20 },
            { header: "Telefon", key: "tel", width: 15 },
            { header: "E-Posta", key: "email", width: 25 },
            { header: "Adres", key: "adres", width: 30 },
            { header: "Şirket Tipi (sahis/limited/anonim)", key: "tip", width: 30 },
        ]

        worksheet.getRow(1).font = { bold: true }
        worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } }

        worksheet.addRow({ unvan: "Örnek Ticaret Ltd. Şti.", vkn: "1234567890", vd: "Beşiktaş VD", tel: "05551234567", email: "ornek@sirket.com", adres: "Beşiktaş/İstanbul", tip: "limited" })
        worksheet.addRow({ unvan: "Ali Veli (Örnek Şahıs)", vkn: "11111111111", vd: "Şişli VD", tel: "05321234567", email: "ali@veli.com", adres: "Şişli/İstanbul", tip: "sahis" })

        const buffer = await workbook.xlsx.writeBuffer()
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "mukellef_sablon.xlsx"
        a.click()
        URL.revokeObjectURL(url)
    }

    const parseFile = async (file: File) => {
        setLoading(true)
        setError(null)
        try {
            const buffer = await file.arrayBuffer()
            const workbook = new ExcelJS.Workbook()
            await workbook.xlsx.load(buffer)

            const worksheet = workbook.worksheets[0]
            if (!worksheet) {
                throw new Error("Dosya boş veya başlık satırı yok.")
            }

            // Get headers from first row
            const headerRow = worksheet.getRow(1)
            const headers: string[] = []
            headerRow.eachCell((cell, colNumber) => {
                headers[colNumber - 1] = cell.value?.toString().toLowerCase() || ""
            })

            if (headers.length === 0) {
                throw new Error("Dosya boş veya başlık satırı yok.")
            }

            // Parse data rows
            const mappedData: any[] = []
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return // Skip header

                const map: any = {}
                row.eachCell((cell, colNumber) => {
                    const header = headers[colNumber - 1]
                    const value = cell.value
                    if (!value || !header) return

                    if (header.includes("unvan") || header.includes("ünvan")) map.unvan = value
                    else if (header.includes("vkn") || header.includes("tckn")) map.vknTckn = String(value)
                    else if (header.includes("vergi") && header.includes("daire")) map.vergiDairesi = value
                    else if (header.includes("telefon")) map.telefon1 = String(value)
                    else if (header.includes("kısa") || header.includes("kisaltma")) map.kisaltma = value
                    else if (header.includes("email") || header.includes("e-posta")) map.email = value
                    else if (header.includes("adres")) map.adres = value
                    else if (header.includes("tip") || header.includes("tür")) map.sirketTipi = value
                })

                if (map.unvan && map.vknTckn) {
                    mappedData.push(map)
                }
            })

            if (mappedData.length === 0) {
                throw new Error("Geçerli veri bulunamadı. Lütfen Ünvan ve VKN sütunlarının olduğundan emin olun.")
            }

            setPreview(mappedData)
        } catch (err: any) {
            setError(err.message || "Dosya okunamadı")
            setPreview([])
        } finally {
            setLoading(false)
        }
    }

    const handleImport = async () => {
        if (preview.length === 0) return

        setLoading(true)
        try {
            const res = await fetch("/api/customers/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customers: preview }),
            })

            if (!res.ok) throw new Error("İçe aktırma başarısız oldu")

            const result = await res.json()
            toast.success(`${result.count} mükellef başarıyla eklendi`)
            setOpen(false)
            setFile(null)
            setPreview([])
            if (fileInputRef.current) fileInputRef.current.value = ""
            onSuccess()
        } catch (error) {
            toast.error("İçe aktırma sırasında hata oluştu")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    Excel İle Yükle
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Toplu Mükellef Yükleme</DialogTitle>
                    <DialogDescription>
                        Excel dosyası ile hızlıca mükellef listesi yükleyebilirsiniz.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Step 1: Template */}
                    <div className="rounded-lg border bg-muted/50 p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium">1. Şablonu İndir</p>
                                <p className="text-xs text-muted-foreground">Doğru format için örnek dosyayı kullanın.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                                <Download className="h-4 w-4" />
                                Örnek Şablon
                            </Button>
                        </div>
                    </div>

                    {/* Step 2: Upload */}
                    <div className="rounded-lg border border-dashed p-8 text-center hover:bg-muted/50 transition-colors">
                        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                <FileUp className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <h3 className="mt-4 text-sm font-semibold">Dosya Seçin</h3>
                            <p className="mb-4 mt-2 text-xs text-muted-foreground">
                                .xlsx veya .xls formatında dosya yükleyin
                            </p>
                            <Input
                                ref={fileInputRef}
                                id="excel"
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <Label
                                htmlFor="excel"
                                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 cursor-pointer"
                            >
                                Dosya Seç
                            </Label>
                            {file && (
                                <p className="mt-2 text-sm text-green-600 font-medium flex items-center gap-1">
                                    <FileSpreadsheet className="h-4 w-4" />
                                    {file.name}
                                </p>
                            )}
                        </div>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Hata</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {preview.length > 0 && (
                        <div className="rounded-md border">
                            <div className="bg-muted px-4 py-2 border-b flex justify-between items-center">
                                <span className="text-sm font-medium">Önizleme</span>
                                <span className="text-xs text-muted-foreground">{preview.length} kayıt bulundu</span>
                            </div>
                            <div className="max-h-[150px] overflow-auto p-0">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium">Ünvan</th>
                                            <th className="px-4 py-2 text-left font-medium">VKN/TCKN</th>
                                            <th className="px-4 py-2 text-left font-medium">VD</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.map((p, i) => (
                                            <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                                                <td className="px-4 py-2 truncate max-w-[150px]" title={p.unvan}>{p.unvan}</td>
                                                <td className="px-4 py-2 font-mono">{p.vknTckn}</td>
                                                <td className="px-4 py-2">{p.vergiDairesi || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => setOpen(false)}>İptal</Button>
                    <Button onClick={handleImport} disabled={!file || loading || preview.length === 0}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {preview.length > 0 ? `${preview.length} Mükellefi Yükle` : 'Yükle'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
