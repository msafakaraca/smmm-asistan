/**
 * Batch API Refactoring Script
 *
 * This script refactors simple API routes from Prisma to Supabase.
 * Only use for simple CRUD operations.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const API_FILES_TO_REFACTOR = [
    // Beyanname APIs
    'src/app/api/beyanname-turleri/route.ts',
    'src/app/api/beyanname-takip/route.ts',

    // Settings APIs
    'src/app/api/settings/gib/route.ts',
    'src/app/api/settings/turmob/route.ts',

    // Simple customer operations
    'src/app/api/customers/bulk-delete/route.ts',
    'src/app/api/customers/delete-all/route.ts',
    'src/app/api/customers/[id]/credentials/route.ts',
    'src/app/api/customers/[id]/verilmeyecek/route.ts',
];

interface RefactorRule {
    pattern: RegExp;
    replacement: string;
}

const REFACTOR_RULES: RefactorRule[] = [
    // Import statements
    {
        pattern: /import\s+\{\s*auth\s*\}\s+from\s+"@\/lib\/auth";?/g,
        replacement: 'import { withAuth, createSupabaseClient } from "@/lib/api-helpers";'
    },
    {
        pattern: /import\s+\{\s*prisma\s*\}\s+from\s+"@\/lib\/db";?/g,
        replacement: ''
    },

    // Function signatures - replace with withAuth
    {
        pattern: /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(\s*request:\s*Request\s*\)/g,
        replacement: 'export const $1 = withAuth(async (req: NextRequest, user)'
    },

    // Auth checks - remove (handled by withAuth)
    {
        pattern: /const\s+session\s*=\s*await\s+auth\(\);?\s*if\s*\(\s*!session\?\?\.user\?\.tenantId\s*\)\s*{[^}]+}/gs,
        replacement: ''
    },

    // Prisma findMany → Supabase select
    {
        pattern: /await\s+prisma\.(\w+)\.findMany\(\s*{\s*where:\s*{\s*tenantId:\s*session\.user\.tenantId\s*}\s*}\s*\)/g,
        replacement: 'const supabase = await createSupabaseClient();\n    const { data } = await supabase.from(\'$1\').select(\'*\')'
    },

    // Simple closing with return
    {
        pattern: /}\s*catch\s*\(\s*error[^}]+}\s*}$/g,
        replacement: '});\n}'
    }
];

function refactorFile(filePath: string): void {
    console.log(`\n📝 Refactoring: ${filePath}`);

    try {
        const fullPath = join(process.cwd(), filePath);
        let content = readFileSync(fullPath, 'utf-8');
        const original = content;

        // Apply refactoring rules
        for (const rule of REFACTOR_RULES) {
            content = content.replace(rule.pattern, rule.replacement);
        }

        // Check if anything changed
        if (content === original) {
            console.log('   ⚠️  No changes applied');
            return;
        }

        // Write back
        writeFileSync(fullPath, content, 'utf-8');
        console.log('   ✅ Refactored successfully');

    } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
    }
}

function main() {
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║   Batch API Refactoring                       ║');
    console.log('╚═══════════════════════════════════════════════╝');

    console.log(`\n📊 Files to refactor: ${API_FILES_TO_REFACTOR.length}`);

    for (const file of API_FILES_TO_REFACTOR) {
        refactorFile(file);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Batch refactoring complete!');
    console.log('\n⚠️  IMPORTANT: Review changes manually!');
    console.log('   Some APIs may need custom logic adjustments.');
}

main();
