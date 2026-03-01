import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/db";

/**
 * Email şablon değişkenleri:
 * - ${customerName}: Müşteri adı/ünvanı
 * - ${declarationTypes}: Beyanname türleri (virgülle ayrılmış)
 * - ${monthName}: Ay adı (Türkçe)
 * - ${year}: Yıl
 * - ${officeName}: Mali müşavir ofis adı
 * - ${documentTypes}: Belge türleri (banka modu için)
 */

const MONTH_NAMES = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

// Default email templates
const DEFAULT_TEMPLATES = {
    mukellef: {
        subject: "${declarationTypes} BEYANNAME TAHAKKUKU - ${monthName} ${year}",
        body: `Sayın \${customerName},

\${year} yılı \${monthName} ayına ait \${declarationTypes} beyanname tahakkukunuz ekte sunulmuştur.

Bilgilerinize sunar, iyi çalışmalar dileriz.

Saygılarımızla;
\${officeName}`
    },
    banka: {
        subject: "${customerName} - Banka Evrakları - ${documentTypes}",
        body: `Sayın Yetkili,

Müşterimiz \${customerName} adına tarafınızca talep edilen \${documentTypes} evrakları ekte sunulmuştur.

Bilgilerinize sunar, iyi çalışmalar dileriz.

Saygılarımızla;
\${officeName}`
    }
};

// Bank document types
const BANK_DOCUMENT_TYPES = [
    'KDV',
    'GELİR',
    'GELİR GEÇİCİ',
    'KURUM GEÇİCİ',
    'KURUMLAR',
    'MİZAN',
    'VERGİ LEVHASI'
];

/**
 * GET /api/mail/templates
 *
 * Email şablonlarını getirir.
 * Query params:
 *   - mode: "mukellef" | "banka" (opsiyonel, ikisini de getirir)
 */
export const GET = withAuth(async (req: NextRequest, user) => {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");

    // Get tenant name for office name
    let officeName = "Mali Müşavirlik Ofisi";
    try {
        const tenant = await prisma.tenants.findUnique({
            where: { id: user.tenantId },
            select: { name: true }
        });
        if (tenant?.name) {
            officeName = tenant.name;
        }
    } catch (error) {
        console.error("[Templates] Error fetching tenant:", error);
    }

    // Prepare response based on mode
    if (mode === 'mukellef') {
        return NextResponse.json({
            template: DEFAULT_TEMPLATES.mukellef,
            monthNames: MONTH_NAMES,
            officeName
        });
    }

    if (mode === 'banka') {
        return NextResponse.json({
            template: DEFAULT_TEMPLATES.banka,
            documentTypes: BANK_DOCUMENT_TYPES,
            monthNames: MONTH_NAMES,
            officeName
        });
    }

    // Return all templates
    return NextResponse.json({
        templates: DEFAULT_TEMPLATES,
        bankDocumentTypes: BANK_DOCUMENT_TYPES,
        monthNames: MONTH_NAMES,
        officeName
    });
});

// Note: renderTemplate function moved to @/lib/mail/template-renderer.ts
// Import from there if needed:
// import { renderTemplate } from '@/lib/mail/template-renderer';
