import type { Metadata } from "next";
import { SmmHesaplama } from "@/components/hesaplama-araclari/smm-hesaplama";

export const metadata: Metadata = {
    title: "Serbest Meslek Makbuzu Hesaplama",
    description: "GİB üzerinden serbest meslek makbuzu hesaplama aracı",
};

export default function SmmHesaplamaPage() {
    return <SmmHesaplama />;
}
