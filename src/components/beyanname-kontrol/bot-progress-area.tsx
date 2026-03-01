"use client"

import React, { useMemo, useEffect, useRef } from "react"
import { Check, Loader2, XCircle, Circle } from "lucide-react"
import { Icon } from "@iconify/react"
import { cn } from "@/lib/utils"
import { useBotLog, type BotLogEntry, type LiveMessage } from "@/context/bot-log-context"
import type { SyncStatus } from "@/components/kontrol/types"

interface BotProgressAreaProps {
  progress: number
  syncStatus: SyncStatus
}

// Adımlar — ilk adım duruma göre dinamik label gösterir
const STEPS = [
  { key: "connect", label: "GİB'e bağlanıldı", runningLabel: "GİB'e bağlanılıyor..." },
  { key: "query", label: "Beyannameler sorgulanıyor" },
  { key: "download", label: "Beyannameler indiriliyor" },
  { key: "finish", label: "Tamamlanıyor" },
] as const

type StepStatus = "done" | "running" | "pending" | "error"

function getStepIcon(status: StepStatus) {
  switch (status) {
    case "done":
      return <Check className="h-4 w-4 text-green-500" />
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />
    case "pending":
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40" />
  }
}

// Log satırı için ikon ve renk belirleme
const getLogStyle = (type: BotLogEntry['type'] | LiveMessage['type']) => {
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

// **bold** sözdizimini parse eden yardımcı
function renderMessage(message: string, baseClass: string) {
  const parts = message.split(/(\*\*[^*]+\*\*)/)
  return (
    <span className={cn("break-words", baseClass)}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

// Memoized log satırı bileşeni
const LogLine = React.memo(function LogLine({ log }: { log: BotLogEntry }) {
  const style = getLogStyle(log.type)

  return (
    <div className="flex items-start gap-2.5 py-1.5 px-3 text-[13px] leading-5">
      <span className="text-muted-foreground/50 shrink-0 text-xs tabular-nums mt-px">
        {log.timestamp}
      </span>
      <Icon
        icon={style.icon}
        className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", style.iconClass)}
      />
      {renderMessage(log.message, style.textClass)}
    </div>
  )
})

// Canlı mesaj satırı — bot ilerlemesini yerinde gösterir
const LiveMessageLine = React.memo(function LiveMessageLine({ live }: { live: LiveMessage }) {
  const style = getLogStyle(live.type)
  const isSpinning = live.type === 'progress'

  return (
    <div className={cn(
      "flex items-start gap-2.5 py-1.5 px-3 text-[13px] leading-5",
      "bg-blue-50/50 dark:bg-blue-950/20"
    )}>
      <span className="text-muted-foreground/50 shrink-0 text-xs tabular-nums mt-px">
        {live.timestamp}
      </span>
      {isSpinning ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500 animate-spin" />
      ) : (
        <Icon
          icon={style.icon}
          className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", style.iconClass)}
        />
      )}
      {renderMessage(live.message, style.textClass)}
    </div>
  )
})

export const BotProgressArea = React.memo(function BotProgressArea({
  progress,
  syncStatus,
}: BotProgressAreaProps) {
  const { logs, liveMessage } = useBotLog()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll: log veya liveMessage değiştiğinde en alta kaydır
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, liveMessage])

  // Adım durumlarını loglardan ve liveMessage'dan hesapla
  const stepStatuses = useMemo((): StepStatus[] => {
    if (syncStatus === "error") {
      const currentStep = progress < 10 ? 0 : progress < 50 ? 1 : progress < 90 ? 2 : 3
      return STEPS.map((_, i) => {
        if (i < currentStep) return "done"
        if (i === currentStep) return "error"
        return "pending"
      })
    }

    if (syncStatus === "success") {
      return STEPS.map(() => "done")
    }

    if (syncStatus === "idle") {
      return STEPS.map(() => "pending")
    }

    // running durumu — progress yüzdesi ve mesaj anahtar kelimelerinden derive et
    let activeStep = 0

    // Progress yüzdesine göre adım belirle (birincil kaynak)
    if (progress >= 95) activeStep = 3
    else if (progress >= 75) activeStep = 2
    else if (progress >= 55) activeStep = 1
    else activeStep = 0

    // Mesaj anahtar kelimelerinden de kontrol (yedek)
    const currentMsg = liveMessage?.message?.toLowerCase() || ''
    if (currentMsg.includes("tamamla") || currentMsg.includes("bitti") || currentMsg.includes("sonuç")) {
      activeStep = Math.max(activeStep, 3)
    } else if (/\[\d+\/\d+\]/.test(liveMessage?.message || '') || currentMsg.includes("indiril") || currentMsg.includes("indirme")) {
      activeStep = Math.max(activeStep, 2)
    } else if (currentMsg.includes("sorgulanıyor") || currentMsg.includes("yapılıyor") || currentMsg.includes("sayfa") || currentMsg.includes("bulundu")) {
      activeStep = Math.max(activeStep, 1)
    }

    return STEPS.map((_, i) => {
      if (i < activeStep) return "done"
      if (i === activeStep) return "running"
      return "pending"
    })
  }, [logs, liveMessage, progress, syncStatus])

  // Progress bar rengi
  const progressBarColor =
    syncStatus === "success"
      ? "bg-green-500"
      : syncStatus === "error"
        ? "bg-red-500"
        : "bg-blue-500"

  const progressValue = syncStatus === "success" ? 100 : progress

  const hasContent = logs.length > 0 || liveMessage !== null

  return (
    <div className="rounded-lg border bg-card shadow-sm space-y-4">
      {/* Üst kısım: Progress bar + step list */}
      <div className="p-4 space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">İlerleme</span>
            <span className="font-medium tabular-nums">%{Math.round(progressValue)}</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(progressValue)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Bot ilerleme durumu"
            className="h-2 w-full rounded-full bg-muted overflow-hidden"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300 ease-out",
                progressBarColor
              )}
              style={{ width: `${progressValue}%` }}
            />
          </div>
        </div>

        {/* Step List */}
        <ul aria-label="İşlem adımları" className="space-y-2">
          {STEPS.map((step, i) => (
            <li key={step.key} className="flex items-center gap-3">
              {getStepIcon(stepStatuses[i])}
              <span
                className={cn(
                  "text-sm",
                  stepStatuses[i] === "done" && "text-foreground",
                  stepStatuses[i] === "running" && "text-blue-600 dark:text-blue-400 font-medium",
                  stepStatuses[i] === "pending" && "text-muted-foreground/60",
                  stepStatuses[i] === "error" && "text-red-600 dark:text-red-400 font-medium"
                )}
              >
                {"runningLabel" in step && stepStatuses[i] === "running" ? step.runningLabel : step.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Akan Log Alanı */}
      {hasContent && (
        <div className="border-t">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
            <span className="text-xs text-muted-foreground font-medium">
              İşlem Logları
            </span>
            <span className="text-xs text-muted-foreground">
              {logs.length} kayıt
            </span>
          </div>
          <div
            ref={scrollRef}
            className="max-h-[280px] overflow-y-auto"
          >
            <div className="divide-y divide-border/50">
              {logs.map((log) => (
                <LogLine key={log.id} log={log} />
              ))}
              {/* Canlı mesaj — yerinde güncellenen satır (indirme [X/Y], sayfa Sayfa X/Y vb.) */}
              {liveMessage && (
                <LiveMessageLine live={liveMessage} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
