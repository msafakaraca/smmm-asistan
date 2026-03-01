import type { Metadata } from "next";
import { KdvTevkifatHesaplama } from "@/components/hesaplama-araclari/kdv-tevkifat-hesaplama";

export const metadata: Metadata = {
    title: "KDV Tevkifat Hesaplama",
    description: "KDV tevkifat hesaplama aracı",
};

export default function KdvTevkifatHesaplamaPage() {
    return <KdvTevkifatHesaplama />;
}
