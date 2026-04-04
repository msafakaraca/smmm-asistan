import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { ToastProviderWithGlobal } from "@/components/ui/modern-toast";
import { BotResultProvider } from "@/context/bot-result-context";
import { BotLogProvider } from "@/context/bot-log-context";
import "./globals.css";

const inter = localFont({
    src: [
        { path: "../../public/fonts/inter-latin-400.woff2", weight: "400", style: "normal" },
        { path: "../../public/fonts/inter-latin-ext-400.woff2", weight: "400", style: "normal" },
        { path: "../../public/fonts/inter-latin-600.woff2", weight: "600", style: "normal" },
        { path: "../../public/fonts/inter-latin-ext-600.woff2", weight: "600", style: "normal" },
    ],
    variable: "--font-inter",
    display: "swap",
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
