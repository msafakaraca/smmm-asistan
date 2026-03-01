import { Metadata } from "next";
import { GgeciciDetayPage } from "@/components/kontrol-cizelgesi/ggecici-detay-page";

export const metadata: Metadata = {
  title: "Gelir Geçici Vergi Detay - Kontrol Çizelgesi",
  description: "Gelir geçici vergi tahakkuk takibi (Şahıs)",
};

export default function Page() {
  return <GgeciciDetayPage />;
}
