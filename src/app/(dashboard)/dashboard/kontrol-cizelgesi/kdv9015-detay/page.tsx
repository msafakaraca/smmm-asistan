import { Metadata } from "next";
import { Kdv9015DetayPage } from "@/components/kontrol-cizelgesi/kdv9015-detay-page";

export const metadata: Metadata = {
  title: "KDV9015 Tevkifat Detay - Kontrol Çizelgesi",
  description: "KDV tevkifat (9015) tahakkuk takibi",
};

export default function Page() {
  return <Kdv9015DetayPage />;
}
