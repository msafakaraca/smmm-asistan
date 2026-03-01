import type { Metadata } from "next";
import { GecikmeZammiYufeHesaplama } from "@/components/hesaplama-araclari/gecikme-zammi-yufe-hesaplama";

export const metadata: Metadata = {
    title: "Gecikme Zammı / Faizi - Yİ-ÜFE",
    description: "Yİ-ÜFE bazlı gecikme zammı ve faizi hesaplama aracı",
};

export default function GecikmeZammiYufeHesaplamaPage() {
    return <GecikmeZammiYufeHesaplama />;
}
