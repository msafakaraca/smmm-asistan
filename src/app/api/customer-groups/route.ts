import { NextRequest, NextResponse } from "next/server";
import { getUserWithProfile } from "@/lib/supabase/auth";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { invalidateDashboard } from "@/lib/dashboard-invalidation";
import { z } from "zod";

// Validation schema
const createGroupSchema = z.object({
  name: z.string().min(1, "Grup adı zorunludur").max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#3B82F6"),
  icon: z.string().max(50).optional(),
  sirketTipiFilter: z.enum(["sahis", "firma", "basit_usul"]).nullable().optional(),
  customerIds: z.array(z.string().uuid()).optional().default([]),
  beyannameTypes: z.array(z.string()).optional().default([]),
});

// GET - List all groups with member count
export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groups = await prisma.customer_groups.findMany({
      where: { tenantId: user.tenantId },
      include: {
        _count: {
          select: { customer_group_members: true }
        }
      },
      orderBy: { name: "asc" },
    });

    // Transform response - members loaded on demand via /api/customer-groups/[id]
    const result = groups.map((group) => ({
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
      members: [],
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[CustomerGroups GET] Error:", error);
    return NextResponse.json(
      { error: "Gruplar yüklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// POST - Create a new group
export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithProfile();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = createGroupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Geçersiz veri", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { name, description, color, icon, sirketTipiFilter, customerIds, beyannameTypes } = validation.data;

    // Check if group name already exists
    const existing = await prisma.customer_groups.findUnique({
      where: {
        tenantId_name: {
          tenantId: user.tenantId,
          name,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Bu isimde bir grup zaten mevcut" },
        { status: 409 }
      );
    }

    // Create group with members in a transaction
    const group = await prisma.$transaction(async (tx) => {
      const { randomUUID } = await import("crypto");

      // Create the group
      const newGroup = await tx.customer_groups.create({
        data: {
          id: randomUUID(),
          name,
          description,
          color,
          icon,
          sirketTipiFilter,
          beyannameTypes,
          tenantId: user.tenantId,
          updatedAt: new Date(),
        },
      });

      // Add members if provided
      if (customerIds.length > 0) {
        // Verify all customers belong to the tenant
        const validCustomers = await tx.customers.findMany({
          where: {
            id: { in: customerIds },
            tenantId: user.tenantId,
            status: "active",
          },
          select: { id: true },
        });

        const validIds = validCustomers.map((c) => c.id);

        if (validIds.length > 0) {
          await tx.customer_group_members.createMany({
            data: validIds.map((customerId) => ({
              id: randomUUID(),
              groupId: newGroup.id,
              customerId,
              tenantId: user.tenantId,
            })),
          });
        }
      }

      // Return with member count
      return tx.customer_groups.findUnique({
        where: { id: newGroup.id },
        include: {
          _count: { select: { customer_group_members: true } },
          customer_group_members: {
            include: {
              customers: {
                select: {
                  id: true,
                  unvan: true,
                  kisaltma: true,
                }
              }
            }
          }
        },
      });
    });

    // Audit log
    await auditLog.create(
      { id: user.id, email: user.email || "", tenantId: user.tenantId },
      "customer_groups",
      group!.id,
      { name: group!.name, memberCount: group!._count.customer_group_members }
    );

    invalidateDashboard(user.tenantId, ['stats']);

    return NextResponse.json({
      id: group!.id,
      name: group!.name,
      description: group!.description,
      color: group!.color,
      icon: group!.icon,
      sirketTipiFilter: group!.sirketTipiFilter,
      beyannameTypes: group!.beyannameTypes,
      memberCount: group!._count.customer_group_members,
      members: group!.customer_group_members.map((m) => ({
        id: m.customers.id,
        unvan: m.customers.unvan,
        kisaltma: m.customers.kisaltma,
      })),
      createdAt: group!.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error("[CustomerGroups POST] Error:", error);
    return NextResponse.json(
      { error: "Grup oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}
