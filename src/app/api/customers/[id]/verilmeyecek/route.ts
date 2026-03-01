import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// PATCH - Müşterinin verilmeyecek beyanname türlerini güncelle
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const tenantId = (session.user as any).tenantId;
        const { id: customerId } = await params;
        const body = await req.json();
        const { kod, action } = body; // action: "add" veya "remove"

        if (!kod || !action) {
            return NextResponse.json(
                { error: "kod ve action gerekli" },
                { status: 400 }
            );
        }

        // Mevcut müşteriyi bul
        const customer = await prisma.customers.findFirst({
            where: {
                id: customerId,
                tenantId
            }
        });

        if (!customer) {
            return NextResponse.json(
                { error: "Müşteri bulunamadı" },
                { status: 404 }
            );
        }

        const currentList = customer.verilmeyecekBeyannameler || [];
        let newList: string[];

        if (action === "add") {
            // Listeye ekle (duplicate kontrolü)
            newList = currentList.includes(kod) ? currentList : [...currentList, kod];
        } else if (action === "remove") {
            // Listeden çıkar
            newList = currentList.filter(item => item !== kod);
        } else {
            return NextResponse.json(
                { error: "Geçersiz action. 'add' veya 'remove' olmalı" },
                { status: 400 }
            );
        }

        // Güncelle
        const updated = await prisma.customers.update({
            where: { id: customerId },
            data: {
                verilmeyecekBeyannameler: newList
            },
            select: {
                id: true,
                verilmeyecekBeyannameler: true
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating verilmeyecek:", error);
        return NextResponse.json(
            { error: "Verilmeyecek listesi güncellenirken hata oluştu" },
            { status: 500 }
        );
    }
}
