import type { Metadata } from "next";
import { MtvHesaplama } from "@/components/hesaplama-araclari/mtv-hesaplama";

export const metadata: Metadata = {
    title: "MTV Hesaplama",
    description: "Motorlu taşıtlar vergisi hesaplama aracı",
};

export default function MtvHesaplamaPage() {
    return <MtvHesaplama />;
}
