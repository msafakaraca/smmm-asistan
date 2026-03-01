import { Metadata } from "next"
import { DosyalarPage } from "@/components/dosyalar/dosyalar-page"

export const metadata: Metadata = {
    title: "Dosyalar",
    description: "Tüm mükellef dosyaları ve beyannameler",
}

export default function DosyalarPageRoute() {
    return (
        <div className="h-[calc(100vh-4rem)] -m-4 xl:-m-6 overflow-hidden">
            <DosyalarPage />
        </div>
    )
}
