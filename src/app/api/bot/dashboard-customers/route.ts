/**
 * Bot Dashboard Müşteri Listesi API
 * Bearer token auth ile müşteri listesi + credential flag'ları döner
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyBearerOrInternal } from "@/lib/internal-auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = verifyBearerOrInternal(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const customers = await prisma.customers.findMany({
      where: { tenantId: auth.tenantId, status: "active" },
      select: {
        id: true,
        unvan: true,
        kisaltma: true,
        vknTckn: true,
        sirketTipi: true,
        gibKodu: true,
        gibSifre: true,
        edevletTckn: true,
        edevletSifre: true,
        turmobKullaniciAdi: true,
        turmobSifre: true,
        iskurTckn: true,
        iskurSifre: true,
      },
      orderBy: { unvan: "asc" },
    });

    // Credential varlığını bool flag'a dönüştür (ham veriyi gönderme)
    const mapped = customers.map((c) => ({
      id: c.id,
      unvan: c.unvan,
      kisaltma: c.kisaltma,
      vknTckn: c.vknTckn,
      sirketTipi: c.sirketTipi,
      hasGibCredentials: !!(c.gibKodu && c.gibSifre),
      hasEdevletCredentials: !!(c.edevletTckn && c.edevletSifre),
      hasTurmobCredentials: !!(c.turmobKullaniciAdi && c.turmobSifre),
      hasIskurCredentials: !!(c.iskurTckn && c.iskurSifre),
    }));

    return NextResponse.json({ customers: mapped });
  } catch (error: unknown) {
    console.error("[dashboard-customers] Hata:", error);
    return NextResponse.json(
      { error: "Müşteri listesi alınamadı" },
      { status: 500 }
    );
  }
}
