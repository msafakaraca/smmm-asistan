import { Metadata } from "next";
import { Kdv2DetayPage } from "@/components/kontrol-cizelgesi/kdv2-detay-page";

export const metadata: Metadata = {
  title: "KDV-2 Detay - Kontrol Çizelgesi",
  description: "KDV tevkifat tahakkuk takibi",
};

export default function Page() {
  return <Kdv2DetayPage />;
}
