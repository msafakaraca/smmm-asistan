import { Metadata } from "next";
import { KgeciciDetayPage } from "@/components/kontrol-cizelgesi/kgecici-detay-page";

export const metadata: Metadata = {
  title: "Kurum Geçici Vergi Detay - Kontrol Çizelgesi",
  description: "Kurum geçici vergi tahakkuk takibi (Firma)",
};

export default function Page() {
  return <KgeciciDetayPage />;
}
