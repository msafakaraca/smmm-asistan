import type { Metadata } from "next";
import { GelirVergisiHesaplama } from "@/components/hesaplama-araclari/gelir-vergisi-hesaplama";

export const metadata: Metadata = {
    title: "Gelir Vergisi Hesaplama",
    description: "GİB üzerinden gelir vergisi hesaplama aracı",
};

export default function GelirVergisiHesaplamaPage() {
    return <GelirVergisiHesaplama />;
}
