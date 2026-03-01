import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ToastProviderWithGlobal } from "@/components/ui/modern-toast";
import { BotResultProvider } from "@/context/bot-result-context";
import { BotLogProvider } from "@/context/bot-log-context";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
});

export const metadata: Metadata = {
    title: {
        default: "SMMM Asistan | Mali Müşavirlik Yönetim Sistemi",
        template: "%s | SMMM Asistan",
    },
    description: "Türkiye'nin en gelişmiş mali müşavirlik ofis yönetim sistemi. Beyanname takibi, müşteri yönetimi ve AI destekli muhasebe asistanı.",
    keywords: ["mali müşavir", "SMMM", "muhasebe", "beyanname", "e-defter", "GİB"],
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="tr" suppressHydrationWarning>
            <body className={`${inter.variable} font-sans antialiased`}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <BotResultProvider>
                        <BotLogProvider>
                            <ToastProviderWithGlobal>
                                {children}
                            </ToastProviderWithGlobal>
                        </BotLogProvider>
                    </BotResultProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
