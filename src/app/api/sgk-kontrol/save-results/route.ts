/**
 * SGK Kontrol Save Results API
 *
 * POST: Electron bot'tan gelen parse sonuçlarını sgk_kontrol tablosuna kaydet
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyBearerOrInternal } from "@/lib/internal-auth";

interface ParsedResult {
  customerId: string;
  year: number;
  month: number;
  hizmet?: {
    isciSayisi: number;
    onayTarihi: string | null;
    documentId: string;
    dosyaSayisi?: number; // Kaç dosyanın toplandığı
  };
  tahakkuk?: {
    isciSayisi: number;
    gunSayisi: number;
    netTutar: number;
    kabulTarihi: string | null;
    documentId: string;
    dosyaSayisi?: number; // Kaç dosyanın toplandığı
  };
}

export async function POST(req: NextRequest) {
  try {
    // Internal veya Bearer token ile doğrulama
    const auth = verifyBearerOrInternal(req.headers);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const tenantId = auth.tenantId;

    const body = await req.json();
    const { results } = body as { results: ParsedResult[] };

    if (!results || !Array.isArray(results)) {
      return NextResponse.json(
        { error: "results array gerekli" },
        { status: 400 }
      );
    }

    console.log(`[SGK-SAVE] ${results.length} sonuç kaydediliyor...`);

    let saved = 0;
    let errors = 0;

    for (const result of results) {
      try {
        const { customerId, year, month, hizmet, tahakkuk } = result;

        // Durum belirleme
        // Bot parse çalıştı - dosya var/yok durumuna göre belirle
        // "Bekliyor" sadece henüz parse edilmemiş kayıtlar için kullanılır
        let status: string;
        if (hizmet && tahakkuk) {
          // Her iki dosya da var ve parse edildi
          status = "gonderildi";
        } else {
          // En az biri eksik veya hiçbiri yok - eksik
          status = "eksik";
        }

        // Upsert işlemi
        await prisma.sgk_kontrol.upsert({
          where: {
            customerId_year_month: { customerId, year, month },
          },
          update: {
            // Hizmet Listesi bilgileri
            ...(hizmet && {
              hizmetIsciSayisi: hizmet.isciSayisi,
              hizmetOnayTarihi: hizmet.onayTarihi
                ? new Date(hizmet.onayTarihi)
                : null,
              hizmetDocumentId: hizmet.documentId,
              hizmetDosyaSayisi: hizmet.dosyaSayisi || 1,
            }),
            // Tahakkuk bilgileri
            ...(tahakkuk && {
              tahakkukIsciSayisi: tahakkuk.isciSayisi,
              tahakkukGunSayisi: tahakkuk.gunSayisi,
              tahakkukNetTutar: tahakkuk.netTutar,
              tahakkukKabulTarihi: tahakkuk.kabulTarihi
                ? new Date(tahakkuk.kabulTarihi)
                : null,
              tahakkukDocumentId: tahakkuk.documentId,
              tahakkukDosyaSayisi: tahakkuk.dosyaSayisi || 1,
            }),
            status,
            updatedAt: new Date(),
          },
          create: {
            tenantId,
            customerId,
            year,
            month,
            // Hizmet Listesi bilgileri
            hizmetIsciSayisi: hizmet?.isciSayisi || null,
            hizmetOnayTarihi: hizmet?.onayTarihi
              ? new Date(hizmet.onayTarihi)
              : null,
            hizmetDocumentId: hizmet?.documentId || null,
            hizmetDosyaSayisi: hizmet?.dosyaSayisi || 1,
            // Tahakkuk bilgileri
            tahakkukIsciSayisi: tahakkuk?.isciSayisi || null,
            tahakkukGunSayisi: tahakkuk?.gunSayisi || null,
            tahakkukNetTutar: tahakkuk?.netTutar || null,
            tahakkukKabulTarihi: tahakkuk?.kabulTarihi
              ? new Date(tahakkuk.kabulTarihi)
              : null,
            tahakkukDocumentId: tahakkuk?.documentId || null,
            tahakkukDosyaSayisi: tahakkuk?.dosyaSayisi || 1,
            status,
          },
        });

        saved++;
      } catch (itemError) {
        console.error(
          `[SGK-SAVE] Kayıt hatası (${result.customerId}):`,
          itemError
        );
        errors++;
      }
    }

    console.log(`[SGK-SAVE] Tamamlandı: ${saved} başarılı, ${errors} hata`);

    return NextResponse.json({
      success: true,
      message: `${saved} kayıt güncellendi`,
      stats: {
        total: results.length,
        saved,
        errors,
      },
    });
  } catch (error) {
    console.error("[SGK-SAVE] Error:", error);
    return NextResponse.json(
      { error: "Sonuçlar kaydedilemedi" },
      { status: 500 }
    );
  }
}
