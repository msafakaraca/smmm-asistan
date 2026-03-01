import type { Metadata } from "next";
import { FinansmanGiderKisitlamasi } from "@/components/hesaplama-araclari/finansman-gider-kisitlamasi";

export const metadata: Metadata = {
    title: "Finansman Gider Kısıtlaması Hesaplama",
    description: "Finansman gider kısıtlaması hesaplama aracı",
};

export default function FinansmanGiderKisitlamasiPage() {
    return <FinansmanGiderKisitlamasi />;
}
