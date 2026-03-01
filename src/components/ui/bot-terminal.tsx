"use client"

import { useState } from "react"
import { Terminal } from "lucide-react"

interface TerminalLog {
    percent: number
    message: string
}

interface BotTerminalProps {
    title: string
    isLoading: boolean
    logs: TerminalLog[]
    progress: number
    onClose?: () => void
}

export function BotTerminal({ title, isLoading, logs, progress, onClose }: BotTerminalProps) {
    const [isMinimized, setIsMinimized] = useState(false);

    if (!isLoading && logs.length === 0) {
        return null
    }

    // Always show last 4 logs
    const displayLogs = logs.slice(-4);

    return (
        <div className="bg-zinc-900 rounded-t-lg border-2 border-b-0 border-zinc-600 shadow-2xl overflow-hidden">
            {/* Mac-style title bar */}
            <div className="flex items-center gap-3 px-3 py-2 bg-zinc-800 border-b border-zinc-700">
                {/* Traffic light buttons - left corner */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={onClose}
                        className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors"
                        title="Kapat"
                    />
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors"
                        title={isMinimized ? "Genişlet" : "Küçült"}
                    />
                    <div className="w-3 h-3 rounded-full bg-green-500 opacity-50 cursor-not-allowed" title="Büyüt" />
                </div>

                {/* Title - centered */}
                <div className="flex-1 flex items-center justify-center gap-2 text-xs text-zinc-300">
                    <Terminal className="h-3.5 w-3.5" />
                    <span>{title}</span>
                </div>

                {/* Status badge - right side */}
                <div className="w-[72px] flex justify-end">
                    {isLoading && (
                        <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">
                            %{progress}
                        </span>
                    )}
                    {!isLoading && logs.length > 0 && progress === 100 && (
                        <span className="text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded">
                            Tamam
                        </span>
                    )}
                    {!isLoading && logs.length > 0 && progress < 100 && (
                        <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded">
                            Hata
                        </span>
                    )}
                </div>
            </div>

            {/* Terminal content - collapsible */}
            {!isMinimized && (
                <div className="px-3 py-2 bg-zinc-950">
                    <div className="font-mono text-[11px] space-y-1 text-zinc-300 min-h-[72px]">
                        {displayLogs.map((log, i) => (
                            <div key={i}>{log.message}</div>
                        ))}
                        {isLoading && (
                            <div className="text-zinc-500 animate-pulse">▍</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
