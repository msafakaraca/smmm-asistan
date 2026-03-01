import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Known beyanname type patterns and their display names
const BEYANNAME_PATTERNS: Record<string, string> = {
    "MUHSGK": "Muhtasar ve SGK Prim Hizmet Beyannamesi",
    "MUHTASAR": "Muhtasar Beyannamesi",
    "KDV1": "KDV Beyannamesi (Aylık)",
    "KDV2": "KDV Beyannamesi (3 Aylık)",
    "KDV9015": "Katma Değer Vergisi Tevkifatı",
    "KDV3": "KDV Beyannamesi (İhracat)",
    "GECICI": "Geçici Vergi Beyannamesi",
    "KURUMLAR": "Kurumlar Vergisi Beyannamesi",
    "GELIR": "Gelir Vergisi Beyannamesi",
    "DAMGA": "Damga Vergisi Beyannamesi",
    "SORGU": "e-Arşiv Sorgu",
    "OTV1": "ÖTV Beyannamesi (I Sayılı Liste)",
    "OTV2C": "ÖTV Beyannamesi (II-C Sayılı Liste)",
    "OTV3A": "ÖTV Beyannamesi (III-A Sayılı Liste)",
    "OTV3B": "ÖTV Beyannamesi (III-B Sayılı Liste)",
    "OTV304": "ÖTV 304 Beyannamesi",
};

/**
 * GET /api/files/beyanname-types
 * Returns unique beyanname types found in tenant's documents
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get all PDF documents for this tenant
        const documents = await prisma.documents.findMany({
            where: {
                tenantId: session.user.tenantId,
                name: { endsWith: ".pdf" }
            },
            select: {
                name: true,
                path: true
            }
        });

        // Extract beyanname types from document names
        const typeCounts: Record<string, number> = {};

        for (const doc of documents) {
            const nameUpper = doc.name.toUpperCase();
            const pathUpper = (doc.path || "").toUpperCase();
            const combined = nameUpper + " " + pathUpper;

            // Check each known pattern
            for (const pattern of Object.keys(BEYANNAME_PATTERNS)) {
                if (combined.includes(pattern)) {
                    typeCounts[pattern] = (typeCounts[pattern] || 0) + 1;
                }
            }
        }

        // Convert to array with names and counts
        const types = Object.entries(typeCounts)
            .map(([code, count]) => ({
                code,
                name: BEYANNAME_PATTERNS[code] || code,
                count
            }))
            .sort((a, b) => b.count - a.count); // Sort by count descending

        return NextResponse.json({
            types,
            totalDocuments: documents.length
        });
    } catch (error) {
        console.error("[BEYANNAME TYPES] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
