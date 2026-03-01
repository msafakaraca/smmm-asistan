import type { Metadata } from "next";
import { AsgariIscilikHesaplama } from "@/components/hesaplama-araclari/asgari-iscilik-hesaplama";

export const metadata: Metadata = {
    title: "SGK Asgari İşçilik Hesaplama",
    description: "SGK yapım işleri raporlamasında birim ve asgari işçilik hesaplama aracı",
};

export default function AsgariIscilikHesaplamaPage() {
    return <AsgariIscilikHesaplama />;
}
