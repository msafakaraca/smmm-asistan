import { Metadata } from "next";
import { SmmmAsistanPage } from "@/components/beyanname-kontrol/smmm-asistan-page";

export const metadata: Metadata = {
    title: "SMMM Asistan",
    description: "GİB Bot ile beyanname senkronizasyonu",
};

export default function BeyannameKontrolPageRoute() {
    return <SmmmAsistanPage />;
}
