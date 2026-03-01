import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const config = {
    api: {
        bodyParser: false,
    },
};

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const parentId = formData.get("parentId") as string | null;
        const tenantId = (session.user as any).tenantId;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = file.name.replace(/\s+/g, "_");
        const uniqueName = `${crypto.randomUUID()}_${filename}`;

        // Ensure upload directory exists
        const uploadDir = path.join(process.cwd(), "public", "uploads", tenantId);
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (e) {
            // Ignore error if it already exists
        }

        const filePath = path.join(uploadDir, uniqueName);
        await writeFile(filePath, buffer);

        // Database record
        const newFile = await prisma.documents.create({
            data: {
                name: file.name,
                isFolder: false,
                type: "FILE", // Required by schema
                parentId: parentId === "null" ? null : parentId,
                tenantId: tenantId,
                size: file.size,
                path: `/uploads/${tenantId}/${uniqueName}`,
                mimeType: file.type,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });

        // Audit log
        await auditLog.create(
            { id: session.user.id || "", email: session.user.email || "", tenantId },
            "documents",
            newFile.id,
            { name: file.name, size: file.size, mimeType: file.type }
        );

        return NextResponse.json({ success: true, file: newFile });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
