"use client"

import { useState, useEffect, useRef } from "react"
import { Terminal } from "lucide-react"
import { useTerminal } from "@/context/terminal-context"

export function GlobalTerminal() {
    const { state, hideTerminal } = useTerminal()
    const [isMinimized, setIsMinimized] = useState(false)
    const [isClosing, setIsClosing] = useState(false)
    const [shouldRender, setShouldRender] = useState(false)
    const prevVisible = useRef(false)

    // Handle visibility with animation
    useEffect(() => {
        if (state.isVisible && !prevVisible.current) {
            // Opening
            setShouldRender(true)
            setIsClosing(false)
        } else if (!state.isVisible && prevVisible.current) {
            // Closing - trigger animation first
            setIsClosing(true)
            const timer = setTimeout(() => {
                setShouldRender(false)
                setIsClosing(false)
            }, 400) // Match animation duration
            return () => clearTimeout(timer)
        }
        prevVisible.current = state.isVisible
    }, [state.isVisible])

    // Smooth close handler
    const handleClose = () => {
        setIsClosing(true)
        setTimeout(() => {
            hideTerminal()
        }, 350)
    }

    if (!shouldRender && !state.isVisible) {
        return null
    }

    // Always show last 4 logs
    const displayLogs = state.logs.slice(-4)

    return (
        <div className="fixed bottom-0 left-64 right-0 flex justify-center z-50 pointer-events-none">
            <div
                className={`w-full max-w-xl pointer-events-auto transition-all duration-400 ease-out ${isClosing
                    ? "translate-y-full opacity-0"
                    : "translate-y-0 opacity-100"
                    }`}
                style={{
                    animation: !isClosing ? "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)" : undefined,
                }}
            >
                <style jsx>{`
                    @keyframes slideUp {
                        from {
                            transform: translateY(100%);
                            opacity: 0;
                        }
                        to {
                            transform: translateY(0);
                            opacity: 1;
                        }
                    }
                `}</style>
                <div className="bg-zinc-900 rounded-t-xl border-2 border-b-0 border-zinc-600 shadow-2xl overflow-hidden backdrop-blur-sm">
                    {/* Mac-style title bar */}
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-gradient-to-b from-zinc-800 to-zinc-850 border-b border-zinc-700">
                        {/* Traffic light buttons - left corner */}
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={handleClose}
                                className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-all duration-200 hover:scale-110 shadow-sm"
                                title="Kapat"
                            />
                            <button
                                onClick={() => setIsMinimized(!isMinimized)}
                                className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-all duration-200 hover:scale-110 shadow-sm"
                                title={isMinimized ? "Genişlet" : "Küçült"}
                            />
                            <div className="w-3 h-3 rounded-full bg-green-500 opacity-50 cursor-not-allowed shadow-sm" title="Büyüt" />
                        </div>

                        {/* Title - centered */}
                        <div className="flex-1 flex items-center justify-center gap-2 text-xs text-zinc-300 font-medium">
                            <Terminal className="h-3.5 w-3.5" />
                            <span>{state.title}</span>
                        </div>

                        {/* Status badge - right side */}
                        <div className="w-[72px] flex justify-end">
                            {state.isLoading && !state.isComplete && (
                                <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium animate-pulse">
                                    %{state.progress}
                                </span>
                            )}
                            {state.isComplete && (
                                <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-medium">
                                    ✓ Tamamlandı
                                </span>
                            )}
                            {!state.isLoading && !state.isComplete && state.logs.length > 0 && (
                                <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-medium">
                                    Hata
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Terminal content - collapsible with smooth transition */}
                    <div
                        className={`overflow-hidden transition-all duration-300 ease-out ${isMinimized ? "max-h-0" : "max-h-40"
                            }`}
                    >
                        <div className="px-4 py-3 bg-zinc-950">
                            <div className="font-mono text-[11px] space-y-1.5 text-zinc-300 min-h-[72px]">
                                {displayLogs.map((log, i) => (
                                    <div
                                        key={i}
                                        className="animate-in fade-in slide-in-from-left-2 duration-200"
                                        style={{ animationDelay: `${i * 50}ms` }}
                                    >
                                        {log.message}
                                    </div>
                                ))}
                                {state.isLoading && (
                                    <div className="text-emerald-400 animate-pulse">▍</div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
