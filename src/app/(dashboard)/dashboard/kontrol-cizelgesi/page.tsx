import { Metadata } from "next";
import { DashboardCards } from "@/components/kontrol-cizelgesi/dashboard-cards";

export const metadata: Metadata = {
  title: "Kontrol Çizelgesi",
  description: "Beyanname, SGK ve KDV durumlarını takip edin",
};

export default function KontrolCizelgesiPageRoute() {
  return <DashboardCards />;
}
