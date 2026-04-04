import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: ["error"],
        datasourceUrl: process.env.DATABASE_URL,
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Veritabanı bağlantı kontrolü ve yeniden bağlanma
export async function ensureDbConnection(): Promise<boolean> {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
    } catch {
        try {
            await prisma.$disconnect();
            await prisma.$connect();
            await prisma.$queryRaw`SELECT 1`;
            return true;
        } catch {
            return false;
        }
    }
}
