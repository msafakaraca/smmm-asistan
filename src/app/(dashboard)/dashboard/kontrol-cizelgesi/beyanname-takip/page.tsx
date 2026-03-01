import { Metadata } from "next";
import { BeyannameTakipPage } from "@/components/kontrol-cizelgesi/beyanname-takip-page";

export const metadata: Metadata = {
  title: "Beyanname Takip - Kontrol Çizelgesi",
  description: "Mükelleflerin beyanname durumlarını takip edin",
};

export default function Page() {
  return <BeyannameTakipPage />;
}
