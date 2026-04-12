import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import VergiLevhasiClient from "@/components/vergi-levhasi/vergi-levhasi-client";
import type { InitialCustomerInfo } from "@/components/vergi-levhasi/vergi-levhasi-client";

export default async function Page() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  const tenantId = session.user.tenantId;

  // Paralel: müşteriler + sorgulama durumları + arşiv verileri
  const [raw, statusResults, archives] = await Promise.all([
    prisma.customers.findMany({
      where: { tenantId, status: "active" },
      select: {
        id: true,
        unvan: true,
        kisaltma: true,
        vknTckn: true,
        tcKimlikNo: true,
        sirketTipi: true,
        siraNo: true,
        email: true,
        telefon1: true,
      },
      orderBy: [
        { sirketTipi: "asc" },
        { siraNo: "asc" },
        { unvan: "asc" },
      ],
    }),
    prisma.query_archives.groupBy({
      by: ["customerId"],
      where: { tenantId, queryType: "vergiLevhasi" },
      _max: { lastQueriedAt: true },
    }),
    prisma.query_archives.findMany({
      where: { tenantId, queryType: "vergiLevhasi" },
      select: {
        customerId: true,
        resultData: true,
      },
      orderBy: { lastQueriedAt: "desc" },
    }),
  ]);

  // Durum map'i: customerId → ISO date
  const statusMap = new Map<string, string>();
  for (const r of statusResults) {
    if (r._max.lastQueriedAt) {
      statusMap.set(r.customerId, r._max.lastQueriedAt.toISOString());
    }
  }

  // Arşiv map'i: customerId → { onayKodu, onayZamani }
  const archiveMap = new Map<string, { onayKodu: string; onayZamani: string }>();
  for (const archive of archives) {
    if (archiveMap.has(archive.customerId)) continue; // İlk (en son) kaydı al
    const resultData = archive.resultData as Array<{
      onayKodu?: string;
      onayZamani?: string;
    }> | null;
    if (resultData && resultData.length > 0) {
      const latest = resultData[resultData.length - 1];
      if (latest.onayKodu) {
        archiveMap.set(archive.customerId, {
          onayKodu: latest.onayKodu,
          onayZamani: latest.onayZamani || "",
        });
      }
    }
  }

  const customers: InitialCustomerInfo[] = raw.map((c) => ({
    id: c.id,
    unvan: c.unvan,
    kisaltma: c.kisaltma,
    vknTckn: c.vknTckn,
    tcKimlikNo: c.tcKimlikNo ?? null,
    sirketTipi: c.sirketTipi,
    email: c.email ?? null,
    telefon1: c.telefon1 ?? null,
    lastVergiLevhasiQueryAt: statusMap.get(c.id) ?? null,
    vergiLevhasiOnayKodu: archiveMap.get(c.id)?.onayKodu ?? null,
    vergiLevhasiOnayZamani: archiveMap.get(c.id)?.onayZamani ?? null,
  }));

  return <VergiLevhasiClient initialCustomers={customers} />;
}
