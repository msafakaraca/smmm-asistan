"use client"

import { ReactNode } from "react"
import { SWRProvider } from "@/providers/swr-provider"
import { GlobalBotListener } from "@/components/global-bot-listener"

export function DashboardClientLayout({ children }: { children: ReactNode }) {
    return (
        <SWRProvider>
            <GlobalBotListener />
            {children}
        </SWRProvider>
    )
}
