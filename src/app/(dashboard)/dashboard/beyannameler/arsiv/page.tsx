import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import BeyannameArsivClient from "@/components/beyannameler/beyanname-arsiv-client";

interface MinimalCustomer {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
}

export default async function BeyannameArsivPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const raw = await prisma.customers.findMany({
    where: { tenantId: session.user.tenantId },
    select: {
      id: true,
      unvan: true,
      kisaltma: true,
      vknTckn: true,
      sirketTipi: true,
      siraNo: true,
    },
    orderBy: [
      { sirketTipi: "asc" },
      { siraNo: "asc" },
      { unvan: "asc" },
    ],
  });

  const customers: MinimalCustomer[] = raw.map((c) => ({
    id: c.id,
    unvan: c.unvan,
    kisaltma: c.kisaltma,
    vknTckn: c.vknTckn,
  }));

  return <BeyannameArsivClient initialCustomers={customers} />;
}
