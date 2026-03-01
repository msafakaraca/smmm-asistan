import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readFile, stat } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        const tenantId = (session.user as any).tenantId;

        if (!id) {
            return NextResponse.json({ error: "Missing file ID" }, { status: 400 });
        }

        // Fetch document info
        const document = await prisma.documents.findUnique({
            where: { id },
        });

        if (!document) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        // Security check: Ensure file belongs to user's tenant
        if (document.tenantId !== tenantId) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        if (document.isFolder) {
            return NextResponse.json({ error: "Cannot download a folder" }, { status: 400 });
        }

        // Construct file path
        // document.path is stored as relative path like "/uploads/[tenantId]/[uuid]_[name]"
        // We need absolute path on server
        const filePath = path.join(process.cwd(), "public", document.path || "");

        if (!existsSync(filePath)) {
            return NextResponse.json({ error: "Physical file not found" }, { status: 404 });
        }

        // Read file
        const fileStat = await stat(filePath);
        const fileBuffer = await readFile(filePath);

        // Prepare response
        // Encode filename for Content-Disposition to handle special characters
        const filename = encodeURIComponent(document.name);

        const response = new NextResponse(fileBuffer);
        response.headers.set("Content-Type", document.mimeType || "application/octet-stream");
        response.headers.set("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
        response.headers.set("Content-Length", fileStat.size.toString());

        return response;

    } catch (error) {
        console.error("Download error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
