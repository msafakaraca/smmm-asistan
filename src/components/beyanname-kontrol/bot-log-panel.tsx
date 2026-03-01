"use client"

/**
 * BotLogPanel Component
 *
 * GİB Bot'un canlı loglarını gösteren panel.
 * - Progress bar ile ilerleme durumu
 * - Renk kodlu log satırları
 * - Auto-scroll ile son loga odaklanma
 * - Temizleme butonu
 */

import React, { useEffect, useRef } from "react"
import { Icon } from "@iconify/react"
import { useBotLog, type BotLogEntry } from "@/context/bot-log-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Log satırı için ikon ve renk belirleme
const getLogStyle = (type: BotLogEntry['type']) => {
    switch (type) {
        case 'success':
            return {
                icon: 'solar:check-circle-bold',
                iconClass: 'text-green-500',
                textClass: 'text-green-700 dark:text-green-400'
            }
        case 'error':
            return {
                icon: 'solar:close-circle-bold',
                iconClass: 'text-red-500',
                textClass: 'text-red-700 dark:text-red-400'
            }
        case 'warning':
            return {
                icon: 'solar:danger-triangle-bold',
                iconClass: 'text-amber-500',
                textClass: 'text-amber-700 dark:text-amber-400'
            }
        case 'batch':
            return {
                icon: 'solar:check-read-bold',
                iconClass: 'text-green-500',
                textClass: 'text-foreground'
            }
        case 'progress':
        default:
            return {
                icon: 'solar:refresh-bold',
                iconClass: 'text-blue-500',
                textClass: 'text-muted-foreground'
            }
    }
}

// Memoized log satırı bileşeni
const LogLine = React.memo(function LogLine({ log }: { log: BotLogEntry }) {
    const style = getLogStyle(log.type)

    return (
        <div className="flex items-start gap-2 py-1 px-2 hover:bg-muted/50 rounded text-sm font-mono">
            <span className="text-muted-foreground shrink-0 text-xs">
                [{log.timestamp}]
            </span>
            <Icon
                icon={style.icon}
                className={cn("h-4 w-4 shrink-0 mt-0.5", style.iconClass)}
            />
            <span className={cn("break-words whitespace-normal", style.textClass)}>
                {log.message}
            </span>
        </div>
    )
})

interface BotLogPanelProps {
    onStop?: () => void;
}

export const BotLogPanel = React.memo(function BotLogPanel({ onStop }: BotLogPanelProps) {
    const { logs, isBotRunning, botStatus, stopBot, clearLogs } = useBotLog()
    const scrollRef = useRef<HTMLDivElement>(null)
    const lastLogIdRef = useRef<string | null>(null)

    const isCompleted = botStatus === 'completed'
    const isError = botStatus === 'error'
    const isFinished = isCompleted || isError

    // Bot durdurma işlemi
    const handleStopBot = () => {
        stopBot()
        onStop?.()
    }

    // Son progress değerini bul
    const lastProgress = React.useMemo(() => {
        for (let i = logs.length - 1; i >= 0; i--) {
            if (logs[i].progress !== undefined) {
                return logs[i].progress
            }
        }
        return 0
    }, [logs])

    // Tamamlandığında otomatik temizleme yapılmaz - kullanıcı "Temizle" butonuyla temizler

    // Auto-scroll: yeni log geldiğinde en alta kaydır
    useEffect(() => {
        const lastLog = logs[logs.length - 1]
        if (lastLog && lastLog.id !== lastLogIdRef.current) {
            lastLogIdRef.current = lastLog.id

            // ScrollArea içindeki viewport'u bul ve scroll et
            if (scrollRef.current) {
                const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
                if (viewport) {
                    viewport.scrollTop = viewport.scrollHeight
                }
            }
        }
    }, [logs])

    // Panel sadece bot çalışıyorsa, tamamlandıysa veya loglar varsa gösterilir
    if (!isBotRunning && !isFinished && logs.length === 0) {
        return null
    }

    // Panel border rengi duruma göre değişir
    const borderClass = isCompleted
        ? "border-green-200 dark:border-green-800"
        : isError
            ? "border-red-200 dark:border-red-800"
            : "border-blue-200 dark:border-blue-800"

    // Header rengi duruma göre değişir
    const headerClass = isCompleted
        ? "text-green-700 dark:text-green-400"
        : isError
            ? "text-red-700 dark:text-red-400"
            : "text-blue-700 dark:text-blue-400"

    // Header ikonu duruma göre değişir
    const headerIcon = isBotRunning
        ? "svg-spinners:pulse-3"
        : isCompleted
            ? "solar:check-circle-bold"
            : isError
                ? "solar:close-circle-bold"
                : "solar:monitor-bold"

    return (
        <Card className={borderClass}>
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <CardTitle className={cn("flex items-center gap-2", headerClass)}>
                        <Icon
                            icon={headerIcon}
                            className="h-5 w-5"
                        />
                        Bot Logları
                    </CardTitle>
                    {isBotRunning && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                            Çalışıyor
                        </span>
                    )}
                    {isCompleted && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                            Tamamlandı
                        </span>
                    )}
                    {isError && (
                        <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">
                            Hata
                        </span>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                        <span className="text-xs text-muted-foreground">
                            {logs.length} kayıt
                        </span>
                        {isBotRunning && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleStopBot}
                                className="h-7 px-3 text-xs"
                            >
                                <Icon icon="solar:stop-bold" className="h-3.5 w-3.5 mr-1" />
                                Botu Durdur
                            </Button>
                        )}
                        {isFinished && logs.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={clearLogs}
                                className="h-7 px-3 text-xs"
                            >
                                <Icon icon="solar:trash-bin-trash-bold" className="h-3.5 w-3.5 mr-1" />
                                Temizle
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-3">
                {/* Progress Bar - sadece bot çalışırken göster */}
                {isBotRunning && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>İlerleme</span>
                            <span>%{lastProgress}</span>
                        </div>
                        <Progress value={lastProgress} className="h-2" />
                    </div>
                )}

                {/* Tamamlandı - full progress bar */}
                {isCompleted && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-green-600 dark:text-green-400">
                            <span>Tamamlandı</span>
                            <span>%100</span>
                        </div>
                        <Progress value={100} className="h-2" />
                    </div>
                )}

                {/* Log Area */}
                <div ref={scrollRef}>
                    <ScrollArea className="h-[300px] rounded-md border bg-muted/30">
                        <div className="p-2 space-y-0.5">
                            {logs.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    <Icon icon="solar:document-text-bold-duotone" className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    Henüz log yok
                                </div>
                            ) : (
                                logs.map((log) => (
                                    <LogLine key={log.id} log={log} />
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </CardContent>
        </Card>
    )
})
