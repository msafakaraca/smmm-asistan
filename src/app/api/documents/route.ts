import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const documents = await prisma.documents.findMany({
            where: {
                tenantId: (session.user as any).tenantId,
            },
            include: {
                customers: {
                    select: {
                        unvan: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc",
            },
        })

        return NextResponse.json(documents)
    } catch (error) {
        console.error("Error fetching documents:", error)
        return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
    }
}
