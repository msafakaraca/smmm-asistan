import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default async function DashboardPage() {
    const session = await auth();

    if (!session) {
        redirect("/login");
    }

    return <DashboardContent session={session} />;
}
