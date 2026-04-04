import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { invalidateDashboard } from "@/lib/dashboard-invalidation";
import { z } from "zod";

// Validation schema
const membersSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1, "En az bir müşteri seçilmeli"),
});

// POST - Add members to group
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await params;
    const body = await req.json();
    const validation = membersSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Geçersiz veri", details: validation.error.errors },
        { status: 400 }
      );
    }

    // Check group exists and belongs to tenant
    const group = await prisma.customer_groups.findFirst({
      where: {
        id: groupId,
        tenantId: user.tenantId,
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Grup bulunamadı" }, { status: 404 });
    }

    const { customerIds } = validation.data;

    // Verify all customers belong to the tenant and are active
    const validCustomers = await prisma.customers.findMany({
      where: {
        id: { in: customerIds },
        tenantId: user.tenantId,
        status: "active",
        // Apply sirket tipi filter if set
        ...(group.sirketTipiFilter ? { sirketTipi: group.sirketTipiFilter } : {}),
      },
      select: { id: true },
    });

    const validIds = validCustomers.map((c) => c.id);

    if (validIds.length === 0) {
      return NextResponse.json(
        { error: "Eklenecek geçerli müşteri bulunamadı" },
        { status: 400 }
      );
    }

    // Get existing members to avoid duplicates
    const existingMembers = await prisma.customer_group_members.findMany({
      where: {
        groupId,
        customerId: { in: validIds },
      },
      select: { customerId: true },
    });

    const existingIds = new Set(existingMembers.map((m) => m.customerId));
    const newIds = validIds.filter((id) => !existingIds.has(id));

    if (newIds.length === 0) {
      return NextResponse.json(
        { error: "Seçili müşteriler zaten grupta mevcut" },
        { status: 400 }
      );
    }

    // Add new members
    const { randomUUID } = await import("crypto");
    await prisma.customer_group_members.createMany({
      data: newIds.map((customerId) => ({
        id: randomUUID(),
        groupId,
        customerId,
        tenantId: user.tenantId,
      })),
    });

    // Get updated member count
    const memberCount = await prisma.customer_group_members.count({
      where: { groupId },
    });

    invalidateDashboard(user.tenantId, ['stats']);

    return NextResponse.json({
      success: true,
      added: newIds.length,
      skipped: validIds.length - newIds.length,
      memberCount,
    });
  } catch (error) {
    console.error("[CustomerGroup Members POST] Error:", error);
    return NextResponse.json(
      { error: "Üyeler eklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// DELETE - Remove members from group
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await params;
    const body = await req.json();
    const validation = membersSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Geçersiz veri", details: validation.error.errors },
        { status: 400 }
      );
    }

    // Check group exists and belongs to tenant
    const group = await prisma.customer_groups.findFirst({
      where: {
        id: groupId,
        tenantId: user.tenantId,
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Grup bulunamadı" }, { status: 404 });
    }

    const { customerIds } = validation.data;

    // Remove members
    const result = await prisma.customer_group_members.deleteMany({
      where: {
        groupId,
        customerId: { in: customerIds },
      },
    });

    // Get updated member count
    const memberCount = await prisma.customer_group_members.count({
      where: { groupId },
    });

    invalidateDashboard(user.tenantId, ['stats']);

    return NextResponse.json({
      success: true,
      removed: result.count,
      memberCount,
    });
  } catch (error) {
    console.error("[CustomerGroup Members DELETE] Error:", error);
    return NextResponse.json(
      { error: "Üyeler çıkarılırken bir hata oluştu" },
      { status: 500 }
    );
  }
}
