import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { TasksPage } from "@/components/tasks/tasks-page";

export const metadata: Metadata = {
  title: "Görevler | SMMM Asistan",
  description: "Ekip görev yönetimi ve takibi",
};

export const dynamic = "force-dynamic";

export default async function GorevlerPage() {
  const user = await getUserWithProfile();

  if (!user) {
    redirect("/login");
  }

  return <TasksPage userRole={user.role} />;
}
