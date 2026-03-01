import { Metadata } from "next";
import { MuhsgkDetayPage } from "@/components/kontrol-cizelgesi/muhsgk-detay-page";

export const metadata: Metadata = {
  title: "MUHSGK Detay - Kontrol Çizelgesi",
  description: "SGK tahakkuk ve hizmet listesi takibi",
};

export default function Page() {
  return <MuhsgkDetayPage />;
}
