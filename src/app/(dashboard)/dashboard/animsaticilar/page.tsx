import { Metadata } from "next";
import { RemindersPage } from "@/components/reminders";

export const metadata: Metadata = {
  title: "Anımsatıcılar & Notlar | SMMM-AI",
  description: "Takvim, anımsatıcılar ve notlar yönetimi",
};

export default function AnımsatıcılarPage() {
  return <RemindersPage />;
}
