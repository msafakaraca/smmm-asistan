import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { AnnouncementPage } from "@/components/announcements/announcement-page";

export const metadata: Metadata = {
  title: "Mükellef Duyuruları | SMMM Asistan",
  description: "Mükelleflere toplu email, SMS ve WhatsApp duyuruları gönderin",
};

// Dinamik veri - cache devre dışı
export const dynamic = "force-dynamic";

export default async function DuyurularPage() {
  const user = await getUserWithProfile();

  if (!user) {
    redirect("/login");
  }

  // Müşteri gruplarını çek
  const groups = await prisma.customer_groups.findMany({
    where: {
      tenantId: user.tenantId,
    },
    include: {
      _count: { select: { customer_group_members: true } },
    },
    orderBy: { name: "asc" },
  });

  const customerGroups = groups.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    memberCount: g._count.customer_group_members,
  }));

  return (
    <div className="h-full overflow-hidden">
      <AnnouncementPage customerGroups={customerGroups} />
    </div>
  );
}
