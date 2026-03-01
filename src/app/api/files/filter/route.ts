import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * GET /api/files/filter
 * Filter documents by beyanname type, file type, and month
 * Searches ALL customer folders recursively
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type"); // e.g., "KDV1", "MUHSGK"
        const fileTypesParam = searchParams.get("fileTypes"); // e.g. "BEYANNAME", "TAHAKKUK,HIZMET_LISTESI"
        const month = searchParams.get("month"); // e.g., "11"
        const year = searchParams.get("year"); // e.g., "2025"
        const companyType = searchParams.get("companyType"); // "Firma", "Şahıs", "Basit Usul"

        if (!type || !fileTypesParam || !month || !year) {
            return NextResponse.json(
                { error: "type, fileTypes, month, and year are required" },
                { status: 400 }
            );
        }

        const fileTypes = fileTypesParam.split(",");
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);

        // Build month pattern for file name matching
        const monthStr = monthNum.toString().padStart(2, '0');
        const monthPatterns = [
            // YENİ FORMAT: "01/2025", "12/2025" (klasör adı)
            `${monthStr}/${yearNum}`,
            // ESKİ FORMATLAR (geriye uyumluluk)
            `-${monthStr}_`,    // e.g., "-11_"
            `_${monthStr}_`,    // e.g., "_11_"
            `/${monthNum}/`,    // e.g., "/11/"
            `\\${monthNum}\\`,  // Windows path: "\11\"
            `-${monthNum}-`,    // e.g., "-11-"
            `${yearNum}-${monthStr}`, // e.g., "2025-01" (dosya adı formatı)
        ];

        // For type matching, also check variations if necessary, though strict code match is preferred now
        // But users might still rely on generalized searches if we switch back, keeping variations for safety
        const typeVariations = [type];
        if (type === "MUH") {
            typeVariations.push("MUHSGK", "MUHTASAR");
        } else if (type === "KDV") {
            typeVariations.push("KDV1", "KDV2", "KDV3", "KDV9015");
        } else if (type === "KDV9015") {
            typeVariations.push("TEVKIFAT");
        }

        // Pagination parametreleri (opsiyonel, geriye uyumlu)
        const rawPage = parseInt(searchParams.get("page") || "1");
        const rawLimit = parseInt(searchParams.get("limit") || "50");
        const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
        const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 200);
        const skip = (page - 1) * limit;

        // Get optional customer filter
        const customerId = searchParams.get("customerId");

        // Construct where clause
        const whereClause: Prisma.documentsWhereInput = {
            tenantId: session.user.tenantId,
            name: { endsWith: ".pdf" },
            AND: [
                // Must contain beyanname type
                {
                    OR: typeVariations.flatMap(t => [
                        { name: { contains: t } },
                        { path: { contains: t } },
                    ])
                },
                // Must contain ANY of the selected file types (e.g. Beyanname OR Tahakkuk)
                {
                    OR: fileTypes.map(ft => ({ name: { contains: ft } }))
                },
                // Must match month (any pattern)
                {
                    OR: monthPatterns.flatMap(p => [
                        { name: { contains: p } },
                        { path: { contains: p } },
                    ])
                }
            ]
        };

        // Customer Logic
        if (customerId && customerId !== "ALL") {
            whereClause.customerId = customerId;
        } else if (companyType && companyType !== "ALL") {
            // If specific company type is selected (but not specific customer)
            whereClause.customers = {
                sirketTipi: companyType
            };
        }

        // Paralel: toplam kayit sayisi + sayfalanmis veri
        const [totalDocuments, documents] = await Promise.all([
            prisma.documents.count({ where: whereClause }),
            prisma.documents.findMany({
                where: whereClause,
                include: {
                    customers: {
                        select: {
                            id: true,
                            unvan: true,
                            vknTckn: true,
                            sirketTipi: true,
                        },
                    },
                },
                orderBy: [
                    { customers: { unvan: "asc" } },
                    { name: "asc" },
                ],
                skip,
                take: limit,
            }),
        ]);

        // Group by customer
        const groupedByCustomer = documents.reduce((acc, doc) => {
            if (!doc.customers) return acc;

            const custId = doc.customers.id;
            if (!acc[custId]) {
                acc[custId] = {
                    customer: doc.customers,
                    documents: [],
                };
            }
            acc[custId].documents.push({
                id: doc.id,
                name: doc.name,
                path: doc.path,
                size: doc.size,
                createdAt: doc.createdAt,
            });
            return acc;
        }, {} as Record<string, { customer: { id: string; unvan: string; vknTckn: string; sirketTipi: string }; documents: { id: string; name: string; path: string | null; size: number; createdAt: Date }[] }>);

        // Convert to array
        const results = Object.values(groupedByCustomer);
        const totalPages = Math.ceil(totalDocuments / limit);

        return NextResponse.json({
            results,
            pagination: {
                page,
                limit,
                totalDocuments,
                totalPages,
                hasNext: page * limit < totalDocuments,
            },
            filters: {
                type,
                fileTypes,
                month: monthNum,
                year: yearNum,
            },
            totalCustomers: results.length,
            totalDocuments,
        });
    } catch (error) {
        console.error("[FILES FILTER] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
