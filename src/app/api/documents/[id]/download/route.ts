import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getDocumentPath } from "@/lib/documents"
import { promises as fs } from "fs"

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const doc = await prisma.documents.findUnique({
            where: {
                id: id,
                tenantId: (session.user as any).tenantId,
            },
        })

        if (!doc) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 })
        }

        if (!doc.path) {
            return NextResponse.json({ error: "Document has no file path" }, { status: 400 })
        }

        const filePath = await getDocumentPath(doc.path)
        const fileBuffer = await fs.readFile(filePath)

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": doc.mimeType || "application/octet-stream",
                "Content-Disposition": `attachment; filename="${doc.originalName}"`,
            },
        })
    } catch (error) {
        console.error("Error downloading document:", error)
        return NextResponse.json({ error: "Failed to download document" }, { status: 500 })
    }
}
