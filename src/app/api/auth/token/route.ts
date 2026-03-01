import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export async function GET() {
    if (!JWT_SECRET) {
        console.error('[TOKEN] JWT_SECRET is not configured');
        return NextResponse.json({ error: "Sunucu yapılandırma hatası" }, { status: 500 });
    }

    const session = await auth();

    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create a token for WS connection
    // NOT: server.ts DecodedToken interface'inde alan adı 'id' olmalı
    const token = jwt.sign(
        {
            id: session.user.id,
            email: session.user.email,
            tenantId: session.user.tenantId
        },
        JWT_SECRET,
        { expiresIn: "1h" }
    );

    return NextResponse.json({ token });
}
