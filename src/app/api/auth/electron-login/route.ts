/**
 * Electron Login API
 * ==================
 * Bot uygulaması için özel login endpoint
 * Supabase Auth kullanılarak güncellendi
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request: NextRequest) {
    if (!JWT_SECRET) {
        console.error('[ELECTRON-LOGIN] JWT_SECRET is not configured');
        return NextResponse.json({ error: "Sunucu yapılandırma hatası" }, { status: 500 });
    }

    try {
        const { email, password } = await request.json();
        console.log("[ELECTRON-LOGIN] Login attempt for:", email);

        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: "Email ve şifre gerekli" },
                { status: 400 }
            );
        }

        // Use Supabase Admin client to verify credentials
        const supabase = createAdminClient();

        // Sign in with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError || !authData.user) {
            console.log("[ELECTRON-LOGIN] Auth failed:", authError?.message);
            return NextResponse.json(
                { success: false, error: authError?.message || "Giriş başarısız" },
                { status: 401 }
            );
        }

        console.log("[ELECTRON-LOGIN] Supabase auth successful for:", authData.user.id);

        // Get user profile from user_profiles table using Supabase (not Prisma)
        const { data: userProfile, error: profileError } = await supabase
            .from('user_profiles')
            .select('id, tenantId, role')
            .eq('id', authData.user.id)
            .single();

        if (profileError || !userProfile) {
            console.error("[ELECTRON-LOGIN] User profile not found:", profileError);
            return NextResponse.json(
                { success: false, error: "Kullanıcı profili bulunamadı" },
                { status: 401 }
            );
        }

        console.log("[ELECTRON-LOGIN] User profile found for user:", userProfile.id);
        const profile = { tenantId: userProfile.tenantId, role: userProfile.role };

        // Get tenant info with license
        const tenant = await prisma.tenants.findUnique({
            where: { id: profile.tenantId },
            include: { licenses: true },
        });

        if (!tenant) {
            return NextResponse.json(
                { success: false, error: "Tenant bulunamadı" },
                { status: 401 }
            );
        }

        // Check license (optional - allow login but restrict bot usage)
        const license = tenant.licenses;
        const hasLicense = license?.isActive &&
            (!license.expiresAt || new Date(license.expiresAt) > new Date());

        // Generate JWT token for WebSocket connection
        const token = jwt.sign(
            {
                id: authData.user.id,
                userId: authData.user.id,
                tenantId: userProfile.tenantId,
                email: authData.user.email,
                hasLicense,
            },
            JWT_SECRET,
            { expiresIn: "30d" }
        );

        console.log("[ELECTRON-LOGIN] Success! Token generated for user:", authData.user.id);

        return NextResponse.json({
            success: true,
            user: {
                id: authData.user.id,
                email: authData.user.email,
                name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'Kullanıcı',
                tenantId: userProfile.tenantId,
                tenantName: tenant.name,
                role: userProfile.role,
                hasLicense,
            },
            token,
        });
    } catch (error: any) {
        console.error("[ELECTRON-LOGIN] Error:", error);
        return NextResponse.json(
            { success: false, error: "Sunucu hatası oluştu" },
            { status: 500 }
        );
    }
}
