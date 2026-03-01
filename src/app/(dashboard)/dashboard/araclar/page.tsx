import { Metadata } from "next";
import { AraclarModule } from "@/components/araclar/araclar-module";

export const metadata: Metadata = {
    title: "PDF Araçları",
    description: "PDF dosyalarını birleştir, ayır, sıkıştır ve dönüştür",
};

export default function AraclarPage() {
    return <AraclarModule />;
}
