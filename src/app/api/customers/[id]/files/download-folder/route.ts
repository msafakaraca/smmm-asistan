import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import JSZip from "jszip"
import { readFile } from "fs/promises"
import path from "path"
import { existsSync } from "fs"

interface DocumentItem {
    id: string
    name: string
    isFolder: boolean
    path: string | null
    parentId: string | null
}

// Recursive function to collect all files in a folder
async function collectFilesRecursively(
    folderId: string,
    tenantId: string,
    basePath: string = ""
): Promise<{ name: string; path: string; fullPath: string }[]> {
    const files: { name: string; path: string; fullPath: string }[] = []

    const items = await prisma.documents.findMany({
        where: {
            parentId: folderId,
            tenantId,
        },
        select: {
            id: true,
            name: true,
            isFolder: true,
            path: true,
        },
    })

    for (const item of items) {
        const itemPath = basePath ? `${basePath}/${item.name}` : item.name

        if (item.isFolder) {
            // Recursively get files from subfolder
            const subFiles = await collectFilesRecursively(item.id, tenantId, itemPath)
            files.push(...subFiles)
        } else if (item.path) {
            files.push({
                name: item.name,
                path: itemPath,
                fullPath: item.path,
            })
        }
    }

    return files
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: customerId } = await params
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantId = (session.user as any).tenantId
    const { searchParams } = new URL(req.url)
    const folderId = searchParams.get("folderId")
    const downloadAll = searchParams.get("all") === "true"

    try {
        const zip = new JSZip()
        let folderName = "dosyalar"
        let filesToZip: { name: string; path: string; fullPath: string }[] = []

        if (downloadAll) {
            // Tüm müşteri dosyalarını indir
            const customer = await prisma.customers.findUnique({
                where: { id: customerId },
                select: { unvan: true },
            })
            folderName = customer?.unvan?.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, "").trim() || "musteri-dosyalari"

            // Root seviyedeki tüm dosya ve klasörleri al
            const rootItems = await prisma.documents.findMany({
                where: {
                    customerId,
                    tenantId,
                    parentId: null,
                },
                select: {
                    id: true,
                    name: true,
                    isFolder: true,
                    path: true,
                },
            })

            for (const item of rootItems) {
                if (item.isFolder) {
                    const subFiles = await collectFilesRecursively(item.id, tenantId, item.name)
                    filesToZip.push(...subFiles)
                } else if (item.path) {
                    filesToZip.push({
                        name: item.name,
                        path: item.name,
                        fullPath: item.path,
                    })
                }
            }
        } else if (folderId) {
            // Belirli bir klasörü indir
            const folder = await prisma.documents.findUnique({
                where: { id: folderId },
                select: { name: true, tenantId: true, customerId: true },
            })

            if (!folder || folder.tenantId !== tenantId || folder.customerId !== customerId) {
                return NextResponse.json({ error: "Folder not found" }, { status: 404 })
            }

            folderName = folder.name.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, "").trim()
            filesToZip = await collectFilesRecursively(folderId, tenantId)
        } else {
            return NextResponse.json({ error: "folderId or all parameter required" }, { status: 400 })
        }

        if (filesToZip.length === 0) {
            return NextResponse.json({ error: "No files found in folder" }, { status: 404 })
        }

        // ZIP'e dosyaları ekle
        let addedFiles = 0
        for (const file of filesToZip) {
            const absolutePath = path.join(process.cwd(), "public", file.fullPath)

            if (existsSync(absolutePath)) {
                try {
                    const fileBuffer = await readFile(absolutePath)
                    zip.file(file.path, fileBuffer)
                    addedFiles++
                } catch (e) {
                    console.error(`Failed to read file: ${absolutePath}`, e)
                }
            }
        }

        if (addedFiles === 0) {
            return NextResponse.json({ error: "No physical files found" }, { status: 404 })
        }

        // ZIP oluştur
        const zipBuffer = await zip.generateAsync({
            type: "nodebuffer",
            compression: "DEFLATE",
            compressionOptions: { level: 6 },
        })

        const filename = encodeURIComponent(`${folderName}.zip`)

        return new NextResponse(zipBuffer as unknown as BodyInit, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
                "Content-Length": zipBuffer.length.toString(),
            },
        })
    } catch (error) {
        console.error("Download folder error:", error)
        return NextResponse.json({ error: "Failed to create zip" }, { status: 500 })
    }
}
