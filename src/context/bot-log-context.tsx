"use client"

/**
 * Bot Log Context
 *
 * GIB Bot loglarını sayfa geçişlerinde korur.
 * - localStorage ile kalıcılık sağlar (sadece bot çalışırken)
 * - Canlı log paneli için detaylı log formatı
 * - Bot çalışma durumu takibi (header badge için)
 * - Bot tamamlandığında/hata verdiğinde sayfa yenilenince otomatik temizlenir
 * - liveMessage: Electron bot ilerlemesini ayrı state'te tutar (log array'e dokunmaz)
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"

export interface BotLogEntry {
    id: string
    timestamp: string
    type: 'progress' | 'success' | 'error' | 'warning' | 'batch'
    message: string
    details?: {
        beyannameTuru?: string
        mukellefAdi?: string
    }
    progress?: number
}

type BotStatus = 'idle' | 'running' | 'completed' | 'error'

export interface LiveMessage {
    message: string
    type: 'progress' | 'success' | 'error' | 'warning' | 'batch'
    timestamp: string
    progress?: number
}

interface BotLogContextValue {
    logs: BotLogEntry[]
    isBotRunning: boolean
    botStatus: BotStatus
    electronConnected: boolean
    liveMessage: LiveMessage | null
    addLog: (type: BotLogEntry['type'], message: string, details?: BotLogEntry['details'], progress?: number) => void
    setLiveMessage: (message: string, type?: LiveMessage['type'], progress?: number) => void
    clearLiveMessage: () => void
    clearLogs: () => void
    setBotRunning: (running: boolean) => void
    setBotStatus: (status: BotStatus) => void
    setElectronConnected: (connected: boolean) => void
    stopBot: () => void
    /** WebSocket referansını set eder (GlobalBotListener kullanır) */
    setWsRef: (ws: WebSocket | null) => void
    /** WebSocket üzerinden mesaj gönder — API'yi bypass eder */
    sendWsMessage: (type: string, data?: Record<string, unknown>) => boolean
}

const BotLogContext = createContext<BotLogContextValue | null>(null)
const STORAGE_KEY = 'smmm-bot-logs'
const MAX_LOGS = 500

export function BotLogProvider({ children }: { children: ReactNode }) {
    const [logs, setLogs] = useState<BotLogEntry[]>([])
    const [isBotRunning, setIsBotRunning] = useState(false)
    const [botStatus, setBotStatusState] = useState<BotStatus>('idle')
    const [electronConnected, setElectronConnected] = useState(false)
    const [liveMessage, setLiveMessageState] = useState<LiveMessage | null>(null)

    // localStorage'dan yükle (mount'ta bir kez)
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                const { logs: storedLogs, running, status } = JSON.parse(stored)
                if (running && status === 'running') {
                    setLogs(storedLogs || [])
                    setIsBotRunning(true)
                    setBotStatusState('running')
                } else {
                    localStorage.removeItem(STORAGE_KEY)
                }
            }
        } catch {
            localStorage.removeItem(STORAGE_KEY)
        }
    }, [])

    // localStorage'a kaydet (sadece bot çalışıyorsa)
    useEffect(() => {
        if (isBotRunning && botStatus === 'running') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                logs,
                running: isBotRunning,
                status: botStatus
            }))
        }
    }, [logs, isBotRunning, botStatus])

    const addLog = useCallback((
        type: BotLogEntry['type'],
        message: string,
        details?: BotLogEntry['details'],
        progress?: number
    ) => {
        const newLog: BotLogEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            timestamp: new Date().toLocaleTimeString("tr-TR"),
            type,
            message,
            details,
            progress
        }

        setLogs(prev => {
            const newLogs = [...prev, newLog]
            if (newLogs.length > MAX_LOGS) {
                return newLogs.slice(-MAX_LOGS)
            }
            return newLogs
        })
    }, [])

    // Canlı mesaj: Electron bot ilerlemesi için ayrı state
    // Log array'e dokunmaz, sadece son durumu gösterir
    const setLiveMessage = useCallback((
        message: string,
        type: LiveMessage['type'] = 'progress',
        progress?: number
    ) => {
        setLiveMessageState({
            message,
            type,
            timestamp: new Date().toLocaleTimeString("tr-TR"),
            progress,
        })
    }, [])

    const clearLiveMessage = useCallback(() => {
        setLiveMessageState(null)
    }, [])

    const clearLogs = useCallback(() => {
        setLogs([])
        setLiveMessageState(null)
        setIsBotRunning(false)
        setBotStatusState('idle')
        localStorage.removeItem(STORAGE_KEY)
    }, [])

    const setBotRunning = useCallback((running: boolean) => {
        setIsBotRunning(running)
        if (running) {
            setBotStatusState('running')
        }
    }, [])

    const setBotStatus = useCallback((status: BotStatus) => {
        setBotStatusState(status)
        if (status === 'completed' || status === 'error') {
            setIsBotRunning(false)
            localStorage.removeItem(STORAGE_KEY)
        }
    }, [])

    const stopBot = useCallback(() => {
        setLogs([])
        setLiveMessageState(null)
        setIsBotRunning(false)
        setBotStatusState('idle')
        localStorage.removeItem(STORAGE_KEY)
    }, [])

    // WebSocket referansı — GlobalBotListener tarafından set edilir
    const [wsInstance, setWsInstance] = useState<WebSocket | null>(null)

    const setWsRef = useCallback((ws: WebSocket | null) => {
        setWsInstance(ws)
    }, [])

    const sendWsMessage = useCallback((type: string, data?: Record<string, unknown>): boolean => {
        if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
            wsInstance.send(JSON.stringify({ type, data }))
            return true
        }
        return false
    }, [wsInstance])

    return (
        <BotLogContext.Provider value={{
            logs,
            isBotRunning,
            botStatus,
            electronConnected,
            liveMessage,
            addLog,
            setLiveMessage,
            clearLiveMessage,
            clearLogs,
            setBotRunning,
            setBotStatus,
            setElectronConnected,
            stopBot,
            setWsRef,
            sendWsMessage,
        }}>
            {children}
        </BotLogContext.Provider>
    )
}

export function useBotLog() {
    const context = useContext(BotLogContext)
    if (!context) {
        throw new Error("useBotLog must be used within BotLogProvider")
    }
    return context
}
