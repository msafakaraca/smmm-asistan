import type { Metadata } from "next";
import { KidemIhbarTazminati } from "@/components/hesaplama-araclari/kidem-ihbar-tazminati";

export const metadata: Metadata = {
    title: "Kıdem & İhbar Tazminatı Hesaplama",
    description: "Kıdem ve ihbar tazminatı hesaplama aracı",
};

export default function KidemIhbarTazminatiPage() {
    return <KidemIhbarTazminati />;
}
