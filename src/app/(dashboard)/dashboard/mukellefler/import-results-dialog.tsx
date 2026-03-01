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
} from "@/components/ui/dialog"
import { Icon } from "@iconify/react"
import { Badge } from "@/components/ui/badge"

interface ImportResultsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    results: {
        stats: {
            total: number
            created: number
            updated: number
            skipped: number
        }
        message: string
        taxpayers?: any[]
    } | null
    onClose: () => void
}

export function ImportResultsDialog({ open, onOpenChange, results, onClose }: ImportResultsDialogProps) {
    if (!results) return null

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val)
            if (!val) onClose()
        }}>
            <DialogContent className="sm:max-w-[800px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Icon icon="solar:check-read-bold" className="h-6 w-6 text-green-600" />
                        İçe Aktarım Tamamlandı
                    </DialogTitle>
                    <DialogDescription>
                        GİB sisteminden çekilen mükellef verileri başarıyla işlendi.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-4 gap-4 py-4">
                    <div className="flex flex-col items-center justify-center p-4 bg-muted/40 rounded-lg border">
                        <span className="text-2xl font-bold">{results.stats.total}</span>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Toplam</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900">
                        <span className="text-2xl font-bold text-green-600 dark:text-green-400">{results.stats.created}</span>
                        <span className="text-xs text-green-600/80 dark:text-green-400/80 uppercase tracking-wider">Yeni</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900">
                        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{results.stats.updated}</span>
                        <span className="text-xs text-blue-600/80 dark:text-blue-400/80 uppercase tracking-wider">Güncellenen</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 bg-muted/40 rounded-lg border">
                        <span className="text-2xl font-bold">{results.stats.skipped}</span>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Atlanan</span>
                    </div>
                </div>

                <div className="flex-1 overflow-auto border rounded-md">
                    <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium">Ünvan</th>
                                <th className="px-4 py-2 text-left font-medium">VKN/TCKN</th>
                                <th className="px-4 py-2 text-left font-medium">Tip</th>
                                <th className="px-4 py-2 text-left font-medium">Durum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {(results.taxpayers || []).map((t, i) => (
                                <tr key={i} className="hover:bg-muted/50">
                                    <td className="px-4 py-2 font-medium">
                                        <div className="truncate max-w-[300px]" title={t.unvan}>{t.unvan}</div>
                                    </td>
                                    <td className="px-4 py-2 font-mono">{t.vergiKimlikNo || t.tcKimlikNo}</td>
                                    <td className="px-4 py-2">
                                        <Badge variant="outline" className="text-xs font-normal">
                                            {t.sirketTipi === 'sahis' ? 'Şahıs' : 'Firma'}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-2 text-muted-foreground text-xs">
                                        İşlendi
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <DialogFooter>
                    <Button onClick={() => {
                        onOpenChange(false)
                        onClose()
                    }}>Kapat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
