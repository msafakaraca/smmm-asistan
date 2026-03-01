import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit";
import { z } from "zod";

// ============================================
// CONSTANTS
// ============================================
const MAX_BRANCHES_PER_CUSTOMER = 50;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================
// ZOD SCHEMAS
// ============================================
const createBranchSchema = z.object({
  branchName: z.string().trim().min(1, "Şube adı zorunludur").max(100),
  sgkKullaniciAdi: z.string().max(50).optional(),
  sgkIsyeriKodu: z.string().max(20).optional(),
  sgkSistemSifresi: z.string().max(100).optional(),
  sgkIsyeriSifresi: z.string().max(100).optional(),
  copyFromCustomer: z.boolean().optional(),
});

const updateBranchSchema = z.object({
  branchId: z.string().uuid("Geçersiz şube ID"),
  branchName: z.string().trim().min(1).max(100).optional(),
  sgkKullaniciAdi: z.string().max(50).optional(),
  sgkIsyeriKodu: z.string().max(20).optional(),
  sgkSistemSifresi: z.string().max(100).optional(),
  sgkIsyeriSifresi: z.string().max(100).optional(),
});

// ============================================
// HELPERS
// ============================================
function safeDecrypt(val: string | null): string | null {
  if (!val) return null;
  try {
    const result = decrypt(val);
    return result || null;
  } catch {
    return null;
  }
}

// ============================================
// GET /api/customers/[id]/branches
// ============================================
export const GET = withAuth(async (req: NextRequest, user) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const customerId = segments[segments.indexOf("customers") + 1];

  if (!uuidRegex.test(customerId)) {
    return NextResponse.json({ error: "Geçersiz ID formatı" }, { status: 400 });
  }

  // Müşteri tenant kontrolü
  const customer = await prisma.customers.findFirst({
    where: { id: customerId, tenantId: user.tenantId },
    select: { id: true },
  });

  if (!customer) {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
  }

  const branches = await prisma.customer_branches.findMany({
    where: { customerId, tenantId: user.tenantId },
    orderBy: { createdAt: "asc" },
  });

  const fields = url.searchParams.get("fields");

  if (fields === "minimal") {
    const minimalBranches = branches.map((b) => ({
      id: b.id,
      branchName: b.branchName,
      hasCompleteCredentials: !!(
        b.sgkKullaniciAdi &&
        b.sgkIsyeriKodu &&
        b.sgkSistemSifresi &&
        b.sgkIsyeriSifresi
      ),
    }));
    return NextResponse.json(minimalBranches);
  }

  // Full response with decrypted credentials
  const fullBranches = branches.map((b) => ({
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
  }));

  return NextResponse.json(fullBranches);
});

// ============================================
// POST /api/customers/[id]/branches
// ============================================
export const POST = withAuth(async (req: NextRequest, user) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const customerId = segments[segments.indexOf("customers") + 1];

  if (!uuidRegex.test(customerId)) {
    return NextResponse.json({ error: "Geçersiz ID formatı" }, { status: 400 });
  }

  const body = await req.json();
  const validation = createBranchSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Geçersiz veri", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { branchName, sgkKullaniciAdi, sgkIsyeriKodu, sgkSistemSifresi, sgkIsyeriSifresi, copyFromCustomer } = validation.data;

  // Müşteri tenant kontrolü
  const customer = await prisma.customers.findFirst({
    where: { id: customerId, tenantId: user.tenantId },
    select: {
      id: true,
      sgkKullaniciAdi: true,
      sgkIsyeriKodu: true,
      sgkSistemSifresi: true,
      sgkIsyeriSifresi: true,
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
  }

  // Şube sayısı limiti
  const branchCount = await prisma.customer_branches.count({
    where: { customerId, tenantId: user.tenantId },
  });

  if (branchCount >= MAX_BRANCHES_PER_CUSTOMER) {
    return NextResponse.json(
      { error: `Maksimum ${MAX_BRANCHES_PER_CUSTOMER} şube eklenebilir` },
      { status: 400 }
    );
  }

  // Case-insensitive duplicate kontrolü
  const existing = await prisma.customer_branches.findFirst({
    where: {
      customerId,
      tenantId: user.tenantId,
      branchName: { equals: branchName, mode: "insensitive" },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Bu isimde bir şube zaten mevcut" },
      { status: 409 }
    );
  }

  const isFirstBranch = branchCount === 0;

  // Şube credential'larını hazırla
  let branchCredentials: {
    sgkKullaniciAdi?: string | null;
    sgkIsyeriKodu?: string | null;
    sgkSistemSifresi?: string | null;
    sgkIsyeriSifresi?: string | null;
  } = {};

  if (isFirstBranch && copyFromCustomer) {
    // İlk şube: Mevcut müşteri credential'larını kopyala
    branchCredentials = {
      sgkKullaniciAdi: customer.sgkKullaniciAdi,
      sgkIsyeriKodu: customer.sgkIsyeriKodu,
      sgkSistemSifresi: customer.sgkSistemSifresi,
      sgkIsyeriSifresi: customer.sgkIsyeriSifresi,
    };
  } else {
    // Manuel credential (opsiyonel)
    if (sgkKullaniciAdi) branchCredentials.sgkKullaniciAdi = encrypt(sgkKullaniciAdi);
    if (sgkIsyeriKodu) branchCredentials.sgkIsyeriKodu = encrypt(sgkIsyeriKodu);
    if (sgkSistemSifresi) branchCredentials.sgkSistemSifresi = encrypt(sgkSistemSifresi);
    if (sgkIsyeriSifresi) branchCredentials.sgkIsyeriSifresi = encrypt(sgkIsyeriSifresi);
  }

  try {
    // Transaction: şube oluştur + ilk şube ise müşteri SGK alanlarını null yap
    const result = await prisma.$transaction(async (tx) => {
      const branch = await tx.customer_branches.create({
        data: {
          branchName,
          customerId,
          tenantId: user.tenantId,
          ...branchCredentials,
        },
      });

      // İlk şube ise müşteri SGK alanlarını null yap
      if (isFirstBranch) {
        await tx.customers.update({
          where: { id: customerId },
          data: {
            sgkKullaniciAdi: null,
            sgkIsyeriKodu: null,
            sgkSistemSifresi: null,
            sgkIsyeriSifresi: null,
          },
        });
      }

      return branch;
    });

    await auditLog.create(
      { id: user.id, email: user.email, tenantId: user.tenantId },
      "customer_branches",
      result.id,
      {
        action: "CREATE_BRANCH",
        customerId,
        branchName,
        isFirstBranch,
        copiedFromCustomer: !!(isFirstBranch && copyFromCustomer),
      }
    );

    return NextResponse.json({
      id: result.id,
      branchName: result.branchName,
      isFirstBranch,
    }, { status: 201 });

  } catch (error: any) {
    // Prisma unique constraint hata yakalama (fallback)
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Bu isimde bir şube zaten mevcut" },
        { status: 409 }
      );
    }
    throw error;
  }
});

// ============================================
// PUT /api/customers/[id]/branches
// ============================================
export const PUT = withAuth(async (req: NextRequest, user) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const customerId = segments[segments.indexOf("customers") + 1];

  if (!uuidRegex.test(customerId)) {
    return NextResponse.json({ error: "Geçersiz ID formatı" }, { status: 400 });
  }

  const body = await req.json();
  const validation = updateBranchSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Geçersiz veri", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { branchId, branchName, sgkKullaniciAdi, sgkIsyeriKodu, sgkSistemSifresi, sgkIsyeriSifresi } = validation.data;

  // Şube + tenant + ownership kontrolü
  const branch = await prisma.customer_branches.findFirst({
    where: { id: branchId, customerId, tenantId: user.tenantId },
  });

  if (!branch) {
    return NextResponse.json({ error: "Şube bulunamadı" }, { status: 404 });
  }

  // İsim değişikliği varsa duplicate kontrolü
  if (branchName && branchName.toLowerCase() !== branch.branchName.toLowerCase()) {
    const existing = await prisma.customer_branches.findFirst({
      where: {
        customerId,
        tenantId: user.tenantId,
        branchName: { equals: branchName, mode: "insensitive" },
        id: { not: branchId },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Bu isimde bir şube zaten mevcut" },
        { status: 409 }
      );
    }
  }

  const updateData: Record<string, string | null> = {};
  const updatedFields: string[] = [];

  if (branchName !== undefined) {
    updateData.branchName = branchName;
    updatedFields.push("branchName");
  }
  if (sgkKullaniciAdi !== undefined) {
    updateData.sgkKullaniciAdi = sgkKullaniciAdi ? encrypt(sgkKullaniciAdi) : null;
    updatedFields.push("sgkKullaniciAdi");
  }
  if (sgkIsyeriKodu !== undefined) {
    updateData.sgkIsyeriKodu = sgkIsyeriKodu ? encrypt(sgkIsyeriKodu) : null;
    updatedFields.push("sgkIsyeriKodu");
  }
  if (sgkSistemSifresi !== undefined) {
    updateData.sgkSistemSifresi = sgkSistemSifresi ? encrypt(sgkSistemSifresi) : null;
    updatedFields.push("sgkSistemSifresi");
  }
  if (sgkIsyeriSifresi !== undefined) {
    updateData.sgkIsyeriSifresi = sgkIsyeriSifresi ? encrypt(sgkIsyeriSifresi) : null;
    updatedFields.push("sgkIsyeriSifresi");
  }

  if (updatedFields.length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan bulunamadı" }, { status: 400 });
  }

  await prisma.customer_branches.update({
    where: { id: branchId },
    data: updateData,
  });

  await auditLog.update(
    { id: user.id, email: user.email, tenantId: user.tenantId },
    "customer_branches",
    branchId,
    {
      action: "UPDATE_BRANCH_CREDENTIALS",
      customerId,
      fields: updatedFields,
    }
  );

  return NextResponse.json({ success: true, message: "Şube başarıyla güncellendi" });
});

// ============================================
// DELETE /api/customers/[id]/branches
// ============================================
export const DELETE = withAuth(async (req: NextRequest, user) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const customerId = segments[segments.indexOf("customers") + 1];
  const branchId = url.searchParams.get("branchId");

  if (!uuidRegex.test(customerId)) {
    return NextResponse.json({ error: "Geçersiz müşteri ID formatı" }, { status: 400 });
  }

  if (!branchId || !uuidRegex.test(branchId)) {
    return NextResponse.json({ error: "Geçersiz şube ID formatı" }, { status: 400 });
  }

  // Şube + tenant + ownership kontrolü
  const branch = await prisma.customer_branches.findFirst({
    where: { id: branchId, customerId, tenantId: user.tenantId },
  });

  if (!branch) {
    return NextResponse.json({ error: "Şube bulunamadı" }, { status: 404 });
  }

  await prisma.customer_branches.delete({
    where: { id: branchId },
  });

  await auditLog.delete(
    { id: user.id, email: user.email, tenantId: user.tenantId },
    "customer_branches",
    branchId,
    {
      action: "DELETE_BRANCH",
      customerId,
      branchName: branch.branchName,
    }
  );

  return NextResponse.json({ success: true, message: "Şube başarıyla silindi" });
});
