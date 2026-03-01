import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFile } from "@/lib/storage";
import { auditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get("parentId");
    const path = searchParams.get("path"); // New: direct file path parameter
    const tenantId = (session.user as any).tenantId;

    // --- CASE 1: Serve File Content (Download/View) ---
    if (path) {
        // Security check
        if (!path.startsWith(`storage/${tenantId}/`)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        try {
            const fileBuffer = await getFile(path);
            if (!fileBuffer) {
                return new NextResponse("File not found", { status: 404 });
            }

            return new NextResponse(new Uint8Array(fileBuffer), {
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": "inline",
                },
            });
        } catch (error) {
            console.error("File serve error:", error);
            return new NextResponse("Internal Server Error", { status: 500 });
        }
    }

    // --- CASE 2: List Directory Contents (JSON) ---
    try {
        const whereClause: any = {
            tenantId,
            ...(parentId && parentId !== "null" ? { parentId } : { parentId: null })
        };

        console.log(`[FilesAPI] GET params: parentId=${parentId}, path=${path}`);
        console.log(`[FilesAPI] Where:`, JSON.stringify(whereClause));

        const items = await prisma.documents.findMany({
            where: whereClause,
            orderBy: [
                { isFolder: 'desc' },
                { name: 'asc' }
            ]
        });

        // Breadcrumbs logic
        let breadcrumbs = [];
        if (parentId) {
            let currentId: string | null = parentId;
            while (currentId) {
                const folder: { id: string; name: string; parentId: string | null } | null = await prisma.documents.findUnique({
                    where: { id: currentId },
                    select: { id: true, name: true, parentId: true }
                });
                if (folder) {
                    breadcrumbs.unshift({ id: folder.id, name: folder.name });
                    currentId = folder.parentId;
                } else {
                    break;
                }
            }
        }

        return NextResponse.json({ items, breadcrumbs });
    } catch (error) {
        console.error("Error fetching files:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const body = await req.json();
        const { name, parentId, isFolder } = body;
        const tenantId = (session.user as any).tenantId;

        const newItem = await prisma.documents.create({
            data: {
                name,
                isFolder: isFolder || false,
                parentId: parentId || null,
                tenantId,
                customerId: null, // Optional, can be updated later
                type: isFolder ? "folder" : "file",
                size: 0,
                storage: "local"
            }
        });

        // Audit log
        await auditLog.create(
            { id: session.user.id || "", email: session.user.email || "", tenantId },
            "documents",
            newItem.id,
            { name, isFolder: isFolder || false }
        );

        return NextResponse.json(newItem);
    } catch (error) {
        console.error("Create error:", error);
        return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const body = await req.json();
        const { id, ids, name, parentId, color } = body;
        const tenantId = (session.user as any).tenantId;

        // Batch move
        if (ids && Array.isArray(ids)) {
            await prisma.documents.updateMany({
                where: {
                    id: { in: ids },
                    tenantId
                },
                data: { parentId: parentId || null }
            });

            // Audit log - batch move
            await auditLog.bulk(
                { id: session.user.id || "", email: session.user.email || "", tenantId },
                "documents",
                "BULK_UPDATE",
                ids.length,
                { action: "move", parentId }
            );

            return NextResponse.json({ message: "Moved successfully" });
        }

        // Single update (rename or move or color)
        if (id) {
            const updateData: any = {};
            if (name) updateData.name = name;
            if (parentId !== undefined) updateData.parentId = parentId;
            if (color !== undefined) updateData.color = color;

            const updated = await prisma.documents.update({
                where: { id, tenantId },
                data: updateData
            });

            // Audit log
            await auditLog.update(
                { id: session.user.id || "", email: session.user.email || "", tenantId },
                "documents",
                id,
                { name: updated.name }
            );

            return NextResponse.json(updated);
        }

        return new NextResponse("Bad Request", { status: 400 });

    } catch (error) {
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids")?.split(",");
    const tenantId = (session.user as any).tenantId;

    if (!ids) return new NextResponse("IDs required", { status: 400 });

    try {
        // Rekürsif olarak tüm alt dosya/klasör ID'lerini bul
        const allIdsToDelete = [...ids];
        let currentIds = ids;
        while (currentIds.length > 0) {
            const children = await prisma.documents.findMany({
                where: { parentId: { in: currentIds }, tenantId },
                select: { id: true }
            });
            const childIds = children.map(c => c.id);
            allIdsToDelete.push(...childIds);
            currentIds = childIds;
        }

        // Transaction: önce FK bağını kaldır, sonra sil
        await prisma.$transaction(async (tx) => {
            await tx.documents.updateMany({
                where: { id: { in: allIdsToDelete }, tenantId },
                data: { parentId: null }
            });
            await tx.documents.deleteMany({
                where: { id: { in: allIdsToDelete }, tenantId }
            });
        });

        // Audit log
        await auditLog.bulk(
            { id: session.user.id || "", email: session.user.email || "", tenantId },
            "documents",
            "BULK_DELETE",
            allIdsToDelete.length,
            { ids: allIdsToDelete }
        );

        return NextResponse.json({ message: "Deleted successfully" });
    } catch (error) {
        return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
}
