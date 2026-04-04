/**
 * Bot Dashboard Launch API
 * Bearer token auth ile credential decrypt edip döner
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyBearerOrInternal } from "@/lib/internal-auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

interface LaunchRequest {
  linkId: string;
  customerId?: string;
  credentialType:
    | "gib"
    | "gib-mm"
    | "edevlet"
    | "edevlet-mm"
    | "turmob"
    | "iskur"
    | "diger";
}

export async function POST(req: NextRequest) {
  const auth = verifyBearerOrInternal(req.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as LaunchRequest;
    const { credentialType, customerId } = body;

    // Diğer işlemler credential gerektirmez
    if (credentialType === "diger") {
      return NextResponse.json({ success: true });
    }

    // Meslek mensubu credential'ları tenant'tan gelir
    if (credentialType === "gib-mm" || credentialType === "edevlet-mm") {
      const tenant = await prisma.tenants.findUnique({
        where: { id: auth.tenantId },
        select: { gibSettings: true, edevletSettings: true },
      });

      if (!tenant) {
        return NextResponse.json(
          { error: "Tenant bulunamadı" },
          { status: 404 }
        );
      }

      if (credentialType === "gib-mm") {
        const settings: Record<string, unknown> = (tenant.gibSettings as Record<string, unknown>) || {};
        if (!settings.gibCode || !settings.gibPassword) {
          return NextResponse.json(
            { error: "Meslek mensubu GİB bilgileri tanımlı değil. Ayarlar sayfasından tanımlayın." },
            { status: 400 }
          );
        }
        try {
          return NextResponse.json({
            success: true,
            credentials: {
              userid: settings.gibCode as string,
              password: decrypt(settings.gibPassword as string),
            },
          });
        } catch (decryptError) {
          console.error("[dashboard-launch] GİB MM şifre çözümleme hatası:", decryptError);
          return NextResponse.json(
            { error: "GİB şifresi çözümlenemedi. Lütfen ayarlardan şifrenizi tekrar girin." },
            { status: 400 }
          );
        }
      }

      if (credentialType === "edevlet-mm") {
        const settings: Record<string, unknown> = (tenant.edevletSettings as Record<string, unknown>) || {};
        if (!settings.tckn || !settings.password) {
          return NextResponse.json(
            { error: "Meslek mensubu E-Devlet bilgileri tanımlı değil. Ayarlar sayfasından tanımlayın." },
            { status: 400 }
          );
        }
        try {
          return NextResponse.json({
            success: true,
            credentials: {
              tckn: settings.tckn as string,
              password: decrypt(settings.password as string),
            },
          });
        } catch (decryptError) {
          console.error("[dashboard-launch] E-Devlet MM şifre çözümleme hatası:", decryptError);
          return NextResponse.json(
            { error: "E-Devlet şifresi çözümlenemedi. Lütfen ayarlardan şifrenizi tekrar girin." },
            { status: 400 }
          );
        }
      }
    }

    // Mükellef credential'ları customer'dan gelir
    if (!customerId) {
      return NextResponse.json(
        { error: "Mükellef seçilmedi" },
        { status: 400 }
      );
    }

    const customer = await prisma.customers.findFirst({
      where: { id: customerId, tenantId: auth.tenantId },
      select: {
        unvan: true,
        kisaltma: true,
        vknTckn: true,
        gibKodu: true,
        gibSifre: true,
        edevletTckn: true,
        edevletSifre: true,
        turmobKullaniciAdi: true,
        turmobSifre: true,
        iskurTckn: true,
        iskurSifre: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Mükellef bulunamadı" },
        { status: 404 }
      );
    }

    const customerName = customer.kisaltma || customer.unvan;

    switch (credentialType) {
      case "gib": {
        if (!customer.gibKodu || !customer.gibSifre) {
          return NextResponse.json(
            { error: `${customerName} için GİB bilgileri tanımlı değil` },
            { status: 400 }
          );
        }
        try {
          return NextResponse.json({
            success: true,
            credentials: {
              userid: decrypt(customer.gibKodu),
              password: decrypt(customer.gibSifre),
              customerName,
            },
          });
        } catch {
          return NextResponse.json(
            { error: `${customerName} GİB şifresi çözümlenemedi` },
            { status: 400 }
          );
        }
      }

      case "edevlet": {
        if (!customer.edevletTckn || !customer.edevletSifre) {
          return NextResponse.json(
            { error: `${customerName} için E-Devlet bilgileri tanımlı değil` },
            { status: 400 }
          );
        }
        try {
          return NextResponse.json({
            success: true,
            credentials: {
              tckn: decrypt(customer.edevletTckn),
              password: decrypt(customer.edevletSifre),
              customerName,
            },
          });
        } catch {
          return NextResponse.json(
            { error: `${customerName} E-Devlet şifresi çözümlenemedi` },
            { status: 400 }
          );
        }
      }

      case "turmob": {
        if (!customer.turmobKullaniciAdi || !customer.turmobSifre) {
          return NextResponse.json(
            { error: `${customerName} için TÜRMOB bilgileri tanımlı değil` },
            { status: 400 }
          );
        }
        try {
          return NextResponse.json({
            success: true,
            credentials: {
              userid: decrypt(customer.turmobKullaniciAdi),
              password: decrypt(customer.turmobSifre),
              customerName,
            },
          });
        } catch {
          return NextResponse.json(
            { error: `${customerName} TÜRMOB şifresi çözümlenemedi` },
            { status: 400 }
          );
        }
      }

      case "iskur": {
        if (!customer.edevletTckn || !customer.edevletSifre) {
          return NextResponse.json(
            { error: `${customerName} için E-Devlet bilgileri tanımlı değil (İŞKUR girişi için gerekli)` },
            { status: 400 }
          );
        }
        try {
          return NextResponse.json({
            success: true,
            credentials: {
              tckn: decrypt(customer.edevletTckn),
              password: decrypt(customer.edevletSifre),
              customerName,
            },
          });
        } catch {
          return NextResponse.json(
            { error: `${customerName} İŞKUR şifresi çözümlenemedi` },
            { status: 400 }
          );
        }
      }

      default:
        return NextResponse.json(
          { error: "Geçersiz credential türü" },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    console.error("[dashboard-launch] Hata:", error);
    return NextResponse.json(
      { error: "Credential bilgileri alınamadı" },
      { status: 500 }
    );
  }
}
