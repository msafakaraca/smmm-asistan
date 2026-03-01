import fs from "fs";
import path from "path";

/**
 * Dosya kaydetme servisi
 * Dosyalar storage/{tenantId}/{vknTckn}/{year}/{month}/ altında saklanır
 */

const STORAGE_ROOT = path.join(process.cwd(), "storage");

interface SaveFileOptions {
    tenantId: string;
    vknTckn: string;
    year: string;
    month: string;
    fileName: string;
    data: string; // base64 data url or string
    skipIfExists?: boolean; // Varsayılan: true - Dosya zaten varsa kaydetme
}

interface SaveFileResult {
    path: string | null;
    skipped: boolean; // true ise dosya zaten vardı
}

export async function saveFile({ tenantId, vknTckn, year, month, fileName, data, skipIfExists = true }: SaveFileOptions): Promise<SaveFileResult> {
    try {
        // Create directory structure
        const dirPath = path.join(STORAGE_ROOT, tenantId, vknTckn, year, month);

        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const filePath = path.join(dirPath, fileName);
        const relativePath = path.posix.join("storage", tenantId, vknTckn, year, month, fileName);

        // Dosya zaten varsa ve skipIfExists aktifse, kaydetmeyi atla
        if (skipIfExists && fs.existsSync(filePath)) {
            console.log(`[Storage] Dosya zaten mevcut, atlanıyor: ${fileName}`);
            return { path: relativePath, skipped: true };
        }

        // Remove data URL prefix if present
        const base64Data = data.replace(/^data:application\/pdf;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        // Write file
        fs.writeFileSync(filePath, buffer);
        console.log(`[Storage] Dosya kaydedildi: ${fileName}`);

        // Return relative path for storage in DB
        // storage/tenantId/vkn/year/month/file.pdf
        return { path: relativePath, skipped: false };
    } catch (error) {
        console.error("File save error:", error);
        return { path: null, skipped: false };
    }
}

export async function getFile(relativePath: string): Promise<Buffer | null> {
    try {
        // Security check: Ensure path is within STORAGE_ROOT
        const fullPath = path.join(process.cwd(), relativePath);
        if (!fullPath.startsWith(STORAGE_ROOT)) {
            throw new Error("Invalid path");
        }

        if (fs.existsSync(fullPath)) {
            return fs.readFileSync(fullPath);
        }
        return null;
    } catch (error) {
        console.error("File read error:", error);
        return null;
    }
}
