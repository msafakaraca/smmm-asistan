import { Metadata } from "next";
import { KdvDetayPage } from "@/components/kontrol-cizelgesi/kdv-detay-page";

export const metadata: Metadata = {
  title: "KDV Detay - Kontrol Çizelgesi",
  description: "KDV tahakkuk ve beyanname takibi",
};

export default function Page() {
  return <KdvDetayPage />;
}
