import { promises as fs } from "fs"
import path from "path"
import { prisma } from "@/lib/db"

const STORAGE_ROOT = path.join(process.cwd(), "storage")

export async function ensureCustomerDirectory(tenantId: string, customerId: string, year?: number, month?: number) {
    let dirPath = path.join(STORAGE_ROOT, tenantId, customerId)

    if (year) {
        dirPath = path.join(dirPath, year.toString())
        if (month) {
            dirPath = path.join(dirPath, month.toString().padStart(2, "0"))
        }
    }

    await fs.mkdir(dirPath, { recursive: true })
    return dirPath
}

export async function saveDocument({
    tenantId,
    customerId,
    name,
    originalName,
    type,
    mimeType,
    size,
    buffer,
    year,
    month,
    parentId
}: {
    tenantId: string
    customerId: string
    name: string
    originalName: string
    type: string
    mimeType: string
    size: number
    buffer: Buffer
    year?: number
    month?: number
    parentId?: string
}) {
    const customerDir = await ensureCustomerDirectory(tenantId, customerId, year, month)
    const filePath = path.join(customerDir, name)

    await fs.writeFile(filePath, buffer)

    const relativePath = path.relative(STORAGE_ROOT, filePath)

    return await prisma.documents.create({
        data: {
            name,
            originalName,
            type,
            mimeType,
            size,
            path: relativePath,
            parentId,
            year,
            month,
            customerId,
            tenantId,
            storage: "local"
        }
    })
}

export async function getDocumentPath(docPath: string) {
    return path.join(STORAGE_ROOT, docPath)
}
