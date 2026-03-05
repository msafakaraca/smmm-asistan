import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import BeyannameClient from "@/components/beyannameler/beyanname-client";

interface MinimalCustomer {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  hasGibCredentials: boolean;
}

export default async function Page() {
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
      gibKodu: true,
      gibSifre: true,
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
    hasGibCredentials: !!(c.gibKodu && c.gibSifre),
  }));

  return <BeyannameClient initialCustomers={customers} />;
}
