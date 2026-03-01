import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const tenantId = (session.user as any).tenantId;

    if (!id) {
        return NextResponse.json([]);
    }

    try {
        // Fetch all folders for this tenant in single query
        const allFolders = await prisma.documents.findMany({
            where: { tenantId, isFolder: true },
            select: { id: true, name: true, parentId: true }
        });

        // Build a map for O(1) lookups
        const folderMap = new Map(allFolders.map(f => [f.id, f]));

        // Traverse up the tree in memory
        const breadcrumbs: { id: string; name: string }[] = [];
        const visited = new Set<string>();
        let currentId: string | null = id;

        while (currentId && !visited.has(currentId)) {
            visited.add(currentId);
            const folder = folderMap.get(currentId);
            if (folder) {
                breadcrumbs.unshift({ id: folder.id, name: folder.name });
                currentId = folder.parentId;
            } else {
                break;
            }
        }

        return NextResponse.json(breadcrumbs);
    } catch (error) {
        console.error("Error fetching breadcrumbs:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
