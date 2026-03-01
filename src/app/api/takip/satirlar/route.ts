import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";

/**
 * GET /api/takip/satirlar?year=2026&month=1
 * Tenant'a ait belirli dönem satirlarini getirir
 * Otomatik olarak Customer tablosundan eksik mukellefleri senkronize eder
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    // Dönem parametreleri (varsayılan: mevcut ay/yıl)
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());

    // 1. Aktif mukellefleri getir
    const musteriler = await prisma.customers.findMany({
      where: {
        tenantId,
        status: "active"
      },
      orderBy: { sortOrder: "asc" },
    });

    // 2. Mevcut satirlari getir (customerId ile + dönem)
    const mevcutSatirlar = await prisma.takip_satirlar.findMany({
      where: {
        tenantId,
        year,
        month
      },
    });

    // 3. customerId'ye gore mevcut satirlari indexle
    const mevcutCustomerIds = new Set(
      mevcutSatirlar
        .filter(s => s.customerId)
        .map(s => s.customerId)
    );

    // 4. Eksik mukellefleri bul ve ekle
    const eksikMusteriler = musteriler.filter(m => !mevcutCustomerIds.has(m.id));

    if (eksikMusteriler.length > 0) {
      const { randomUUID } = await import("crypto");
      const now = new Date();

      // Son sira numarasini bul
      const maxSiraNo = mevcutSatirlar.reduce(
        (max, s) => Math.max(max, s.siraNo),
        -1
      );

      // Eksik mukellefleri toplu ekle
      const yeniSatirlar = eksikMusteriler.map((musteri, index) => ({
        id: randomUUID(),
        no: musteri.sortOrder?.toString() || (maxSiraNo + index + 2).toString(),
        isim: musteri.unvan,
        siraNo: maxSiraNo + index + 1,
        degerler: {},
        customerId: musteri.id,
        tenantId,
        year,
        month,
        updatedAt: now,
      }));

      await prisma.takip_satirlar.createMany({
        data: yeniSatirlar,
        skipDuplicates: true,
      });
    }

    // 5. Guncel satirlari getir ve dondur
    const satirlar = await prisma.takip_satirlar.findMany({
      where: {
        tenantId,
        year,
        month
      },
      include: {
        customers: {
          select: {
            id: true,
            unvan: true,
            vknTckn: true,
            status: true,
            siraNo: true,
          }
        }
      }
    });

    // Customer.siraNo'yu no olarak kullan ve sırala
    const satirlarWithCustomerNo = satirlar
      .map(satir => ({
        ...satir,
        no: satir.customers?.siraNo || satir.no || "-"
      }))
      // Customer.siraNo'ya göre küçükten büyüğe sırala
      .sort((a, b) => {
        const aNum = parseInt(a.no?.toString().replace(/\D/g, "") || "9999");
        const bNum = parseInt(b.no?.toString().replace(/\D/g, "") || "9999");
        return aNum - bNum;
      });

    return NextResponse.json(satirlarWithCustomerNo);
  } catch (error) {
    console.error("[TakipSatir] GET Error:", error);
    return NextResponse.json(
      { error: "Satırlar yüklenirken hata oluştu" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/takip/satirlar
 * Yeni satir ekler (dönem bazlı)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    const body = await req.json();
    const { no, isim, year, month } = body;

    // Dönem kontrolü (varsayılan: mevcut)
    const satirYear = year || new Date().getFullYear();
    const satirMonth = month || (new Date().getMonth() + 1);

    // Son sira numarasini bul (dönem bazlı)
    const sonSatir = await prisma.takip_satirlar.findFirst({
      where: {
        tenantId,
        year: satirYear,
        month: satirMonth
      },
      orderBy: { siraNo: "desc" },
    });

    const yeniSiraNo = (sonSatir?.siraNo ?? -1) + 1;

    // Eger no verilmediyse otomatik olustur
    let satirNo = no;
    if (!satirNo) {
      const sonNumaraliSatir = await prisma.takip_satirlar.findFirst({
        where: {
          tenantId,
          year: satirYear,
          month: satirMonth
        },
        orderBy: { createdAt: "desc" },
      });

      if (sonNumaraliSatir && sonNumaraliSatir.no) {
        const sonNoSayi = parseInt(sonNumaraliSatir.no.replace(/\D/g, ""), 10);
        satirNo = isNaN(sonNoSayi) ? "1" : String(sonNoSayi + 1);
      } else {
        satirNo = "1";
      }
    }

    const { randomUUID } = await import("crypto");
    const yeniSatir = await prisma.takip_satirlar.create({
      data: {
        id: randomUUID(),
        no: satirNo,
        isim: isim || "",
        siraNo: yeniSiraNo,
        degerler: {},
        tenantId,
        year: satirYear,
        month: satirMonth,
        updatedAt: new Date(),
      },
    });

    // Audit log
    await auditLog.create(
      { id: user.id, email: user.email || "", tenantId },
      "takip_satirlar",
      yeniSatir.id,
      { customerName: isim || undefined, no: satirNo, year: satirYear, month: satirMonth }
    );

    return NextResponse.json(yeniSatir);
  } catch (error) {
    console.error("[TakipSatir] POST Error:", error);
    return NextResponse.json(
      { error: "Satır eklenirken hata oluştu" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/takip/satirlar
 * Satir gunceller (no, isim, degerler, siraNo)
 *
 * Degerler JSON formatı:
 * - Eski format (backward compatible): { "ALIS": true }
 * - Yeni format (metadata ile): { "ALIS": { value: true, modifiedBy: "uuid", modifiedByName: "Ahmet", modifiedAt: "ISO" } }
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    const body = await req.json();
    const { id, no, isim, degerler, siraNo } = body;

    if (!id) {
      return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
    }

    // Satiri bul ve tenant kontrolu yap
    const mevcutSatir = await prisma.takip_satirlar.findFirst({
      where: { id, tenantId },
    });

    if (!mevcutSatir) {
      return NextResponse.json({ error: "Satır bulunamadı" }, { status: 404 });
    }

    // Guncelleme verilerini hazirla
    const updateData: Record<string, unknown> = {};
    if (no !== undefined) updateData.no = no;
    if (isim !== undefined) updateData.isim = isim;
    if (siraNo !== undefined) updateData.siraNo = siraNo;

    // Degerler icin mevcut verileri koru, sadece verilen alanlari guncelle
    // Her değişiklikte metadata ekle (kim, ne zaman)
    if (degerler !== undefined) {
      const mevcutDegerler =
        typeof mevcutSatir.degerler === "object" && mevcutSatir.degerler !== null
          ? (mevcutSatir.degerler as Record<string, unknown>)
          : {};

      // Her değişen alan için metadata ekle
      const yeniDegerler = { ...mevcutDegerler };
      const now = new Date().toISOString();

      for (const [key, value] of Object.entries(degerler)) {
        // Eğer gelen değer primitive (boolean, string, number) ise metadata ile sar
        if (typeof value !== 'object' || value === null) {
          yeniDegerler[key] = {
            value,
            modifiedBy: user.id,
            modifiedByName: user.name,
            modifiedAt: now,
          };
        } else {
          // Eğer gelen değer zaten metadata formatındaysa, kullanıcı bilgilerini güncelle
          const existingMeta = value as Record<string, unknown>;
          yeniDegerler[key] = {
            value: existingMeta.value,
            modifiedBy: user.id,
            modifiedByName: user.name,
            modifiedAt: now,
          };
        }
      }

      updateData.degerler = yeniDegerler;
    }

    // SONDUR kolonu değişikliğini kontrol et (audit log için)
    let sonDurumDegisti = false;
    let yeniSonDurum: boolean | null = null;
    let eskiSonDurum: boolean | null = null;

    if (degerler !== undefined && "SONDUR" in degerler) {
      // Eski SONDUR değerini al
      const mevcutDegerlerObj =
        typeof mevcutSatir.degerler === "object" && mevcutSatir.degerler !== null
          ? (mevcutSatir.degerler as Record<string, unknown>)
          : {};

      const eskiSondur = mevcutDegerlerObj["SONDUR"];
      if (typeof eskiSondur === "object" && eskiSondur !== null && "value" in (eskiSondur as Record<string, unknown>)) {
        eskiSonDurum = (eskiSondur as Record<string, unknown>).value as boolean | null;
      } else if (typeof eskiSondur === "boolean" || eskiSondur === null) {
        eskiSonDurum = eskiSondur as boolean | null;
      }

      // Yeni SONDUR değerini al
      const yeniSondur = degerler["SONDUR"];
      if (typeof yeniSondur === "object" && yeniSondur !== null && "value" in (yeniSondur as Record<string, unknown>)) {
        yeniSonDurum = (yeniSondur as Record<string, unknown>).value as boolean | null;
      } else if (typeof yeniSondur === "boolean" || yeniSondur === null) {
        yeniSonDurum = yeniSondur as boolean | null;
      }

      // Değişiklik var mı kontrol et
      if (eskiSonDurum !== yeniSonDurum) {
        sonDurumDegisti = true;
      }
    }

    const guncellenmis = await prisma.takip_satirlar.update({
      where: { id },
      data: updateData,
    });

    // Audit log: kolon değer değişiklikleri
    if (degerler !== undefined) {
      const no = guncellenmis.no || "-";
      const isim = guncellenmis.isim || "Bilinmeyen";
      const changedColumns = Object.keys(degerler);

      if (sonDurumDegisti) {
        // SONDUR özel mesajı
        await auditLog.update(
          { id: user.id, email: user.email, tenantId: user.tenantId },
          "takip_satirlar",
          guncellenmis.id,
          {
            oldValue: eskiSonDurum,
            newValue: yeniSonDurum,
            customerName: isim,
            customerNo: no,
            field: "SONDUR",
          }
        );
      } else if (changedColumns.length > 0) {
        // Normal kolon değişikliği - kolon başlığını DB'den çek
        const kolonKod = changedColumns[0];
        const rawValue = degerler[kolonKod];
        const value = typeof rawValue === "object" && rawValue !== null && "value" in (rawValue as Record<string, unknown>)
          ? (rawValue as Record<string, unknown>).value
          : rawValue;

        // Kolon başlığını Türkçe göstermek için DB'den çek
        const kolon = await prisma.takip_kolonlar.findFirst({
          where: { tenantId, kod: kolonKod },
          select: { baslik: true },
        });
        const kolonBaslik = kolon?.baslik || kolonKod;

        await auditLog.update(
          { id: user.id, email: user.email, tenantId: user.tenantId },
          "takip_satirlar",
          guncellenmis.id,
          {
            customerName: isim,
            customerNo: no,
            kolonKod,
            kolonBaslik,
            value,
            changedColumns,
          }
        );
      }
    }

    return NextResponse.json(guncellenmis);
  } catch (error) {
    console.error("[TakipSatir] PUT Error:", error);
    return NextResponse.json(
      { error: "Satır güncellenirken hata oluştu" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/takip/satirlar?id=xxx
 * Satir siler
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
    }

    // Satiri bul ve tenant kontrolu yap
    const satir = await prisma.takip_satirlar.findFirst({
      where: { id, tenantId },
    });

    if (!satir) {
      return NextResponse.json({ error: "Satır bulunamadı" }, { status: 404 });
    }

    await prisma.takip_satirlar.delete({
      where: { id },
    });

    // Audit log
    await auditLog.delete(
      { id: user.id, email: user.email || "", tenantId },
      "takip_satirlar",
      id,
      { customerName: satir.isim || undefined, no: satir.no || undefined }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TakipSatir] DELETE Error:", error);
    return NextResponse.json(
      { error: "Satır silinirken hata oluştu" },
      { status: 500 }
    );
  }
}
