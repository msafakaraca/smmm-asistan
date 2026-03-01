import type { Metadata } from "next";
import { GecikmeZammiHesaplama } from "@/components/hesaplama-araclari/gecikme-zammi-hesaplama";

export const metadata: Metadata = {
    title: "Gecikme Zammı / Faizi Hesaplama",
    description: "GİB üzerinden gecikme zammı ve faizi hesaplama aracı",
};

export default function GecikmeZammiHesaplamaPage() {
    return <GecikmeZammiHesaplama />;
}
