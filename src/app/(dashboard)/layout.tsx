import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard/nav";
import { DashboardHeader } from "@/components/dashboard/header";
import { DashboardClientLayout } from "@/components/dashboard/client-layout";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    return (
        <DashboardClientLayout>
            <div className="flex h-screen overflow-hidden">
                {/* Sidebar */}
                <DashboardNav />

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <DashboardHeader user={session.user} />
                    <main className="flex-1 min-h-0 overflow-auto p-4 xl:p-6 bg-muted/30">
                        {children}
                    </main>
                </div>
            </div>
        </DashboardClientLayout>
    );
}
