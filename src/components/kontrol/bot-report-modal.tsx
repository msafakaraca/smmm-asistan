"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GibBotResult } from "@/types/gib";
import { CheckCircle2, AlertTriangle, XCircle, Clock, Download, UserPlus, SkipForward } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface BotReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: GibBotResult | null;
}

export function BotReportModal({ isOpen, onClose, data }: BotReportModalProps) {
    if (!data) return null;

    const { stats, processedFiles = [], error } = data;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {data.success ? (
                            <CheckCircle2 className="h-6 w-6 text-green-500" />
                        ) : (
                            <AlertTriangle className="h-6 w-6 text-amber-500" />
                        )}
                        GİB Bot İşlem Raporu
                    </DialogTitle>
                    <DialogDescription>
                        İşlem tamamlandı. Detaylı sonuçlar aşağıdadır.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
                    <div className="bg-muted/50 p-3 rounded-lg flex flex-col items-center justify-center text-center">
                        <Clock className="h-5 w-5 mb-2 text-muted-foreground" />
                        <span className="text-2xl font-bold">{stats.duration}s</span>
                        <span className="text-xs text-muted-foreground">Toplam Süre</span>
                    </div>
                    <div className="bg-green-500/10 p-3 rounded-lg flex flex-col items-center justify-center text-center border border-green-200 dark:border-green-900">
                        <Download className="h-5 w-5 mb-2 text-green-600 dark:text-green-400" />
                        <span className="text-2xl font-bold text-green-700 dark:text-green-300">
                            {stats.downloaded}
                        </span>
                        <span className="text-xs text-green-600/80 dark:text-green-400/80">İndirilen</span>
                    </div>
                    <div className="bg-blue-500/10 p-3 rounded-lg flex flex-col items-center justify-center text-center border border-blue-200 dark:border-blue-900">
                        <SkipForward className="h-5 w-5 mb-2 text-blue-600 dark:text-blue-400" />
                        <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                            {stats.skipped}
                        </span>
                        <span className="text-xs text-blue-600/80 dark:text-blue-400/80">Atlanan (Zaten Var)</span>
                    </div>
                    <div className="bg-purple-500/10 p-3 rounded-lg flex flex-col items-center justify-center text-center border border-purple-200 dark:border-purple-900">
                        <UserPlus className="h-5 w-5 mb-2 text-purple-600 dark:text-purple-400" />
                        <span className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                            {stats.newCustomers || 0}
                        </span>
                        <span className="text-xs text-purple-600/80 dark:text-purple-400/80">Yeni Müşteri</span>
                    </div>
                </div>

                {error && (
                    <div className="bg-destructive/15 text-destructive p-3 rounded-md mb-4 flex items-center gap-2 text-sm font-medium">
                        <XCircle className="h-4 w-4" />
                        Bot Hatası: {error}
                    </div>
                )}

                {stats.failed > 0 && (
                    <div className="bg-amber-500/15 text-amber-600 dark:text-amber-400 p-3 rounded-md mb-4 flex items-center gap-2 text-sm font-medium">
                        <AlertTriangle className="h-4 w-4" />
                        {stats.failed} adet dosya indirilemedi! Lütfen aşağıdaki listeyi kontrol edin.
                    </div>
                )}

                <div className="flex-1 min-h-0 border rounded-md overflow-hidden flex flex-col">
                    <div className="bg-muted px-4 py-2 text-sm font-medium border-b flex justify-between items-center">
                        <span>İşlem Detayları</span>
                        <Badge variant="outline">{processedFiles.length} Dosya</Badge>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[250px]">
                        <table className="w-full text-sm table-fixed">
                            <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                    <th className="w-[45%] text-left px-3 py-2 font-medium">Müşteri</th>
                                    <th className="w-[25%] text-left px-3 py-2 font-medium">VKN</th>
                                    <th className="w-[20%] text-left px-3 py-2 font-medium">Tür</th>
                                    <th className="w-[10%] text-center px-2 py-2 font-medium">D</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedFiles.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-muted-foreground">
                                            İşlenen dosya kaydı bulunamadı.
                                        </td>
                                    </tr>
                                ) : (
                                    processedFiles.map((file, idx) => (
                                        <tr key={idx} className={`border-b border-border/50 ${file.status === 'failed' ? 'bg-destructive/5' : ''}`}>
                                            <td className="px-3 py-1.5 truncate" title={file.customerName}>
                                                {file.customerName}
                                            </td>
                                            <td className="px-3 py-1.5 font-mono text-xs">{file.vkn}</td>
                                            <td className="px-3 py-1.5 truncate text-xs" title={file.fileName}>
                                                {file.fileName.includes('BEYANNAME') ? 'BEY' : file.fileName.includes('TAHAKKUK') ? 'TAH' : 'DİĞ'}
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                {file.status === 'downloaded' && <span className="text-green-600">✓</span>}
                                                {file.status === 'skipped' && <span className="text-blue-500">⏭</span>}
                                                {file.status === 'failed' && <span className="text-red-500">✗</span>}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <DialogFooter className="mt-4 sm:justify-between items-center">
                    <div className="text-xs text-muted-foreground mr-auto">
                        Pencere kapatıldığında otomatik olarak <b>önceki aya</b> geçiş yapılacaktır.
                    </div>
                    <Button onClick={onClose}>Tamam, Listeye Dön</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
