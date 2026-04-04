import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { invalidateDashboard } from "@/lib/dashboard-invalidation";
import { z } from "zod";

// Validation schema for update
const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).nullable().optional(),
  sirketTipiFilter: z.enum(["sahis", "firma", "basit_usul"]).nullable().optional(),
  beyannameTypes: z.array(z.string()).optional(),
});

// GET - Get a single group with members
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const group = await prisma.customer_groups.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
      include: {
        _count: { select: { customer_group_members: true } },
        customer_group_members: {
          include: {
            customers: {
              select: {
                id: true,
                unvan: true,
                kisaltma: true,
                sirketTipi: true,
                email: true,
                telefon1: true,
                status: true,
              }
            }
          },
          orderBy: { addedAt: "desc" },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Grup bulunamadı" }, { status: 404 });
    }

    return NextResponse.json({
      id: group.id,
      name: group.name,
      description: group.description,
      color: group.color,
      icon: group.icon,
      sirketTipiFilter: group.sirketTipiFilter,
      beyannameTypes: group.beyannameTypes,
      autoManaged: group.autoManaged,
      beyannameTypeCode: group.beyannameTypeCode,
      memberCount: group._count.customer_group_members,
      members: group.customer_group_members.map((m) => ({
        id: m.customers.id,
        unvan: m.customers.unvan,
        kisaltma: m.customers.kisaltma,
        sirketTipi: m.customers.sirketTipi,
        email: m.customers.email,
        telefon1: m.customers.telefon1,
        status: m.customers.status,
        addedAt: m.addedAt,
      })),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    });
  } catch (error) {
    console.error("[CustomerGroup GET] Error:", error);
    return NextResponse.json(
      { error: "Grup yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// PUT - Update a group
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validation = updateGroupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Geçersiz veri", details: validation.error.errors },
        { status: 400 }
      );
    }

    // Check group exists and belongs to tenant
    const existing = await prisma.customer_groups.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Grup bulunamadı" }, { status: 404 });
    }

    // Check name uniqueness if name is being updated
    if (validation.data.name && validation.data.name !== existing.name) {
      const nameExists = await prisma.customer_groups.findUnique({
        where: {
          tenantId_name: {
            tenantId: user.tenantId,
            name: validation.data.name,
          },
        },
      });

      if (nameExists) {
        return NextResponse.json(
          { error: "Bu isimde bir grup zaten mevcut" },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.customer_groups.update({
      where: { id },
      data: validation.data,
      include: {
        _count: { select: { customer_group_members: true } },
      },
    });

    // Audit log
    await auditLog.update(
      { id: user.id, email: user.email || "", tenantId: user.tenantId },
      "customer_groups",
      id,
      { name: updated.name }
    );

    invalidateDashboard(user.tenantId, ['stats']);

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      color: updated.color,
      icon: updated.icon,
      sirketTipiFilter: updated.sirketTipiFilter,
      beyannameTypes: updated.beyannameTypes,
      memberCount: updated._count.customer_group_members,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("[CustomerGroup PUT] Error:", error);
    return NextResponse.json(
      { error: "Grup güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a group
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check group exists and belongs to tenant
    const existing = await prisma.customer_groups.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Grup bulunamadı" }, { status: 404 });
    }

    // Delete group (cascade will delete members)
    await prisma.customer_groups.delete({
      where: { id },
    });

    // Audit log
    await auditLog.delete(
      { id: user.id, email: user.email || "", tenantId: user.tenantId },
      "customer_groups",
      id,
      { name: existing.name }
    );

    invalidateDashboard(user.tenantId, ['stats']);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CustomerGroup DELETE] Error:", error);
    return NextResponse.json(
      { error: "Grup silinirken bir hata oluştu" },
      { status: 500 }
    );
  }
}
