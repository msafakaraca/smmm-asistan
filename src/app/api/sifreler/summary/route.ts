import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit";

// Response tip tanimlari
interface PasswordSummary {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  gib: {
    kodu: string | null; // Decrypt edilmis kullanici adi
    sifre: string | null; // Decrypt edilmis sifre
    hasKodu: boolean;
    hasSifre: boolean;
    hasParola: boolean;
    hasInteraktifSifre: boolean;
    hasEmuhurPin: boolean;
  };
  sgk: {
    kullaniciAdi: string | null; // Decrypt edilmis kullanici adi
    isyeriKodu: string | null; // Decrypt edilmis isyeri kodu
    sistemSifresi: string | null; // Decrypt edilmis sistem sifresi
    isyeriSifresi: string | null; // Decrypt edilmis isyeri sifresi
    hasKullaniciAdi: boolean;
    hasIsyeriKodu: boolean;
    hasSistemSifresi: boolean;
    hasIsyeriSifresi: boolean;
  };
  turmob: {
    kullaniciAdi: string | null; // Decrypt edilmis TCKN/VKN
    sifre: string | null; // Decrypt edilmis sifre
    hasKullaniciAdi: boolean;
    hasSifre: boolean;
  };
  edevlet: {
    tckn: string | null; // Decrypt edilmis TCKN
    sifre: string | null; // Decrypt edilmis sifre
    hasTckn: boolean;
    hasSifre: boolean;
  };
  branches: Array<{
    id: string;
    branchName: string;
    sgk: {
      kullaniciAdi: string | null;
      isyeriKodu: string | null;
      sistemSifresi: string | null;
      isyeriSifresi: string | null;
      hasKullaniciAdi: boolean;
      hasIsyeriKodu: boolean;
      hasSistemSifresi: boolean;
      hasIsyeriSifresi: boolean;
    };
  }>;
}

// Helper: Guvenli decrypt
function safeDecrypt(value: string | null): string | null {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch {
    return null;
  }
}

// GET /api/sifreler/summary
// Tum mukelleflerin sifre durumunu dondur (sifrelerin kendisini DEGIL)
export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    // Tum mukellefleri cek (pagination olmadan - ozet oldugu icin)
    // NOT: Cok fazla mukellef varsa pagination eklenebilir
    const customers = await prisma.customers.findMany({
      where: {
        tenantId: user.tenantId,
        status: "active",
      },
      select: {
        id: true,
        unvan: true,
        kisaltma: true,
        vknTckn: true,
        // GIB alanlari - sadece var/yok kontrolu icin
        gibKodu: true,
        gibSifre: true,
        gibParola: true,
        interaktifSifre: true,
        emuhurPin: true,
        // SGK alanlari
        sgkKullaniciAdi: true,
        sgkIsyeriKodu: true,
        sgkSistemSifresi: true,
        sgkIsyeriSifresi: true,
        // TURMOB alanlari
        turmobKullaniciAdi: true,
        turmobSifre: true,
        // e-Devlet alanlari
        edevletTckn: true,
        edevletSifre: true,
        // Subeler
        customer_branches: {
          select: {
            id: true,
            branchName: true,
            sgkKullaniciAdi: true,
            sgkIsyeriKodu: true,
            sgkSistemSifresi: true,
            sgkIsyeriSifresi: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { unvan: "asc" }],
    });

    // GUVENLIK: Audit log - hassas veri erisimi
    await auditLog.viewSensitive(
      { id: user.id, email: user.email, tenantId: user.tenantId },
      "credentials",
      user.tenantId,
      "all_customer_credentials_summary"
    );

    // Sifre durumlarini hazirla (tum degerler decrypt edilir)
    const summary: PasswordSummary[] = customers.map((c) => ({
      id: c.id,
      unvan: c.unvan,
      kisaltma: c.kisaltma,
      vknTckn: c.vknTckn,
      gib: {
        kodu: safeDecrypt(c.gibKodu),
        sifre: safeDecrypt(c.gibSifre),
        hasKodu: !!c.gibKodu,
        hasSifre: !!c.gibSifre,
        hasParola: !!c.gibParola,
        hasInteraktifSifre: !!c.interaktifSifre,
        hasEmuhurPin: !!c.emuhurPin,
      },
      sgk: {
        kullaniciAdi: safeDecrypt(c.sgkKullaniciAdi),
        isyeriKodu: safeDecrypt(c.sgkIsyeriKodu),
        sistemSifresi: safeDecrypt(c.sgkSistemSifresi),
        isyeriSifresi: safeDecrypt(c.sgkIsyeriSifresi),
        hasKullaniciAdi: !!c.sgkKullaniciAdi,
        hasIsyeriKodu: !!c.sgkIsyeriKodu,
        hasSistemSifresi: !!c.sgkSistemSifresi,
        hasIsyeriSifresi: !!c.sgkIsyeriSifresi,
      },
      turmob: {
        kullaniciAdi: safeDecrypt(c.turmobKullaniciAdi),
        sifre: safeDecrypt(c.turmobSifre),
        hasKullaniciAdi: !!c.turmobKullaniciAdi,
        hasSifre: !!c.turmobSifre,
      },
      edevlet: {
        tckn: safeDecrypt(c.edevletTckn),
        sifre: safeDecrypt(c.edevletSifre),
        hasTckn: !!c.edevletTckn,
        hasSifre: !!c.edevletSifre,
      },
      branches: (c.customer_branches || []).map((b) => ({
        id: b.id,
        branchName: b.branchName,
        sgk: {
          kullaniciAdi: safeDecrypt(b.sgkKullaniciAdi),
          isyeriKodu: safeDecrypt(b.sgkIsyeriKodu),
          sistemSifresi: safeDecrypt(b.sgkSistemSifresi),
          isyeriSifresi: safeDecrypt(b.sgkIsyeriSifresi),
          hasKullaniciAdi: !!b.sgkKullaniciAdi,
          hasIsyeriKodu: !!b.sgkIsyeriKodu,
          hasSistemSifresi: !!b.sgkSistemSifresi,
          hasIsyeriSifresi: !!b.sgkIsyeriSifresi,
        },
      })),
    }));

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[Sifreler Summary] Error:", error);
    return NextResponse.json(
      { error: "Sifre ozeti alinirken hata olustu" },
      { status: 500 }
    );
  }
});
