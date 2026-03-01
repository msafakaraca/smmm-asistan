"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

interface TerminalLog {
    percent: number
    message: string
}

interface TerminalState {
    isVisible: boolean
    isLoading: boolean
    isComplete: boolean
    title: string
    logs: TerminalLog[]
    progress: number
}

interface TerminalContextValue {
    state: TerminalState
    showTerminal: (title: string) => void
    hideTerminal: () => void
    addLog: (message: string, percent?: number) => void
    setProgress: (percent: number) => void
    setLoading: (loading: boolean) => void
    reset: () => void
    autoClose: (delay?: number) => void
}

const initialState: TerminalState = {
    isVisible: false,
    isLoading: false,
    isComplete: false,
    title: "",
    logs: [],
    progress: 0,
}

const TerminalContext = createContext<TerminalContextValue | null>(null)

export function TerminalProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<TerminalState>(initialState)

    const showTerminal = useCallback((title: string) => {
        setState({
            isVisible: true,
            isLoading: true,
            isComplete: false,
            title,
            logs: [],
            progress: 0,
        })
    }, [])

    const hideTerminal = useCallback(() => {
        setState(initialState)
    }, [])

    const addLog = useCallback((message: string, percent?: number) => {
        const timestamp = new Date().toLocaleTimeString("tr-TR")
        setState(prev => ({
            ...prev,
            logs: [...prev.logs, { percent: percent ?? prev.progress, message: `[${timestamp}] ${message}` }],
            progress: percent ?? prev.progress,
        }))
    }, [])

    const setProgress = useCallback((percent: number) => {
        setState(prev => ({ ...prev, progress: percent }))
    }, [])

    const setLoading = useCallback((loading: boolean) => {
        setState(prev => ({ ...prev, isLoading: loading }))
    }, [])

    const reset = useCallback(() => {
        setState(initialState)
    }, [])

    const autoClose = useCallback((delay: number = 3000) => {
        // İşlem tamamlandı olarak işaretle
        setState(prev => ({ ...prev, isComplete: true, isLoading: false }))
        // Belirli süre sonra terminali kapat
        setTimeout(() => {
            setState(initialState)
        }, delay)
    }, [])

    return (
        <TerminalContext.Provider value={{
            state,
            showTerminal,
            hideTerminal,
            addLog,
            setProgress,
            setLoading,
            reset,
            autoClose,
        }}>
            {children}
        </TerminalContext.Provider>
    )
}

export function useTerminal() {
    const context = useContext(TerminalContext)
    if (!context) {
        throw new Error("useTerminal must be used within a TerminalProvider")
    }
    return context
}
