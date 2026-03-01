import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit";

// Tip tanimlari
interface GibUpdate {
  vknTckn: string;
  kullaniciKodu?: string;
  sifre?: string;
}

interface SgkUpdate {
  vknTckn: string;
  kullaniciAdi?: string;
  isyeriKodu?: string;
  sistemSifresi?: string;
  isyeriSifresi?: string;
}

interface BulkUpdateRequest {
  type: "gib" | "sgk";
  updates: GibUpdate[] | SgkUpdate[];
}

interface UpdateResult {
  success: number;
  failed: number;
  errors: { vknTckn: string; error: string }[];
}

// POST /api/sifreler/bulk-update
// Toplu sifre guncelleme
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const body: BulkUpdateRequest = await req.json();

    // Validasyon
    if (!body.type || !["gib", "sgk"].includes(body.type)) {
      return NextResponse.json(
        { error: 'Gecersiz tip. "gib" veya "sgk" olmali.' },
        { status: 400 }
      );
    }

    if (!body.updates || !Array.isArray(body.updates) || body.updates.length === 0) {
      return NextResponse.json(
        { error: "Guncellenecek veri bulunamadi." },
        { status: 400 }
      );
    }

    const result: UpdateResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    // Her guncellemeyi isle
    for (const update of body.updates) {
      try {
        if (!update.vknTckn) {
          result.failed++;
          result.errors.push({
            vknTckn: "BILINEMEDI",
            error: "VKN/TCKN alani bos",
          });
          continue;
        }

        // Mukellefi bul
        const customer = await prisma.customers.findFirst({
          where: {
            tenantId: user.tenantId,
            vknTckn: update.vknTckn,
          },
          select: { id: true },
        });

        if (!customer) {
          result.failed++;
          result.errors.push({
            vknTckn: update.vknTckn,
            error: "Mukellef bulunamadi",
          });
          continue;
        }

        // Guncelleme datasini hazirla
        let updateData: Record<string, string | null> = {};

        if (body.type === "gib") {
          const gibUpdate = update as GibUpdate;
          if (gibUpdate.kullaniciKodu !== undefined) {
            updateData.gibKodu = gibUpdate.kullaniciKodu
              ? encrypt(gibUpdate.kullaniciKodu)
              : null;
          }
          if (gibUpdate.sifre !== undefined) {
            updateData.gibSifre = gibUpdate.sifre
              ? encrypt(gibUpdate.sifre)
              : null;
          }
        } else {
          const sgkUpdate = update as SgkUpdate;
          if (sgkUpdate.kullaniciAdi !== undefined) {
            updateData.sgkKullaniciAdi = sgkUpdate.kullaniciAdi
              ? encrypt(sgkUpdate.kullaniciAdi)
              : null;
          }
          if (sgkUpdate.isyeriKodu !== undefined) {
            updateData.sgkIsyeriKodu = sgkUpdate.isyeriKodu
              ? encrypt(sgkUpdate.isyeriKodu)
              : null;
          }
          if (sgkUpdate.sistemSifresi !== undefined) {
            updateData.sgkSistemSifresi = sgkUpdate.sistemSifresi
              ? encrypt(sgkUpdate.sistemSifresi)
              : null;
          }
          if (sgkUpdate.isyeriSifresi !== undefined) {
            updateData.sgkIsyeriSifresi = sgkUpdate.isyeriSifresi
              ? encrypt(sgkUpdate.isyeriSifresi)
              : null;
          }
        }

        // Guncellenecek veri var mi kontrol et
        if (Object.keys(updateData).length === 0) {
          result.failed++;
          result.errors.push({
            vknTckn: update.vknTckn,
            error: "Guncellenecek alan yok",
          });
          continue;
        }

        // Guncelle
        await prisma.customers.update({
          where: { id: customer.id },
          data: updateData,
        });

        result.success++;
      } catch (updateError) {
        result.failed++;
        result.errors.push({
          vknTckn: update.vknTckn || "BILINEMEDI",
          error: updateError instanceof Error ? updateError.message : "Bilinmeyen hata",
        });
      }
    }

    // Audit log - bulk password update
    if (result.success > 0) {
      await auditLog.bulk(
        { id: user.id, email: user.email || "", tenantId: user.tenantId },
        "credentials",
        "BULK_UPDATE",
        result.success,
        { type: body.type, totalAttempted: body.updates.length, failed: result.failed }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${result.success} mukellef guncellendi, ${result.failed} hata`,
      result,
    });
  } catch (error) {
    console.error("[Sifreler Bulk Update] Error:", error);
    return NextResponse.json(
      { error: "Toplu guncelleme sirasinda hata olustu" },
      { status: 500 }
    );
  }
});
