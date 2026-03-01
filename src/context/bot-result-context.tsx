"use client"

/**
 * Bot Result Context
 *
 * GIB Bot sonuçlarını sayfa geçişlerinde korur.
 * - localStorage ile kalıcılık sağlar (30 dakika TTL)
 * - Kullanıcı başka sayfadayken bot tamamlanırsa sonucu saklar
 * - Kontrol sayfasına dönüldüğünde sonuç modal'ı açılır
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"
import type { GibBotResult, BeyannameData } from "@/types/gib"

interface BotResultContextValue {
    pendingResult: GibBotResult | null
    setPendingResult: (result: GibBotResult | null) => void
    consumeResult: () => GibBotResult | null
    hasPendingResult: boolean
}

const BotResultContext = createContext<BotResultContextValue | null>(null)
const STORAGE_KEY = 'smmm-gib-bot-pending-result'
const RESULT_EXPIRY_MS = 30 * 60 * 1000 // 30 dakika

export function BotResultProvider({ children }: { children: ReactNode }) {
    const [pendingResult, setPendingResultState] = useState<GibBotResult | null>(null)

    // localStorage'dan yükle (mount'ta bir kez)
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                const { result, timestamp } = JSON.parse(stored)
                if (Date.now() - timestamp < RESULT_EXPIRY_MS) {
                    setPendingResultState(result)
                } else {
                    localStorage.removeItem(STORAGE_KEY)
                }
            }
        } catch {
            localStorage.removeItem(STORAGE_KEY)
        }
    }, [])

    const setPendingResult = useCallback((result: GibBotResult | null) => {
        setPendingResultState(result)
        if (result) {
            try {
                // Base64 PDF buffer'larını localStorage'dan çıkar (QuotaExceededError önleme)
                const stripBuffers = (items?: BeyannameData[]): BeyannameData[] | undefined => {
                    if (!items) return undefined
                    return items.map(({ beyannameBuffer, tahakkukBuffer, sgkTahakkukBuffer, sgkHizmetBuffer, ...rest }) => rest)
                }

                const lightweight: GibBotResult = {
                    ...result,
                    beyannameler: stripBuffers(result.beyannameler) || [],
                    unmatchedBeyannameler: stripBuffers(result.unmatchedBeyannameler),
                }

                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    result: lightweight,
                    timestamp: Date.now()
                }))
            } catch {
                // localStorage dolu veya erişilemez - in-memory state yeterli
                localStorage.removeItem(STORAGE_KEY)
            }
        } else {
            localStorage.removeItem(STORAGE_KEY)
        }
    }, [])

    const consumeResult = useCallback(() => {
        const result = pendingResult
        setPendingResult(null)
        return result
    }, [pendingResult, setPendingResult])

    return (
        <BotResultContext.Provider value={{
            pendingResult,
            setPendingResult,
            consumeResult,
            hasPendingResult: !!pendingResult
        }}>
            {children}
        </BotResultContext.Provider>
    )
}

export function useBotResult() {
    const context = useContext(BotResultContext)
    if (!context) {
        throw new Error("useBotResult must be used within BotResultProvider")
    }
    return context
}
