import type { Metadata } from "next";
import { GecikmeZammi7440Hesaplama } from "@/components/hesaplama-araclari/gecikme-zammi-7440-hesaplama";

export const metadata: Metadata = {
    title: "Gecikme Zammı / Faizi - 7440 Sayılı Kanun",
    description: "7440 sayılı Yapılandırma Kanunu kapsamında Yİ-ÜFE bazlı gecikme hesaplama aracı",
};

export default function GecikmeZammi7440HesaplamaPage() {
    return <GecikmeZammi7440Hesaplama />;
}
