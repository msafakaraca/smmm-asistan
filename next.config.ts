import type { NextConfig } from "next";

// ============================================
// GUVENLIK: Security Headers (OWASP Standards)
// ============================================
const securityHeaders = [
    {
        // XSS koruması
        key: 'X-XSS-Protection',
        value: '1; mode=block'
    },
    {
        // MIME sniffing koruması
        key: 'X-Content-Type-Options',
        value: 'nosniff'
    },
    {
        // Clickjacking koruması
        key: 'X-Frame-Options',
        value: 'DENY'
    },
    {
        // Referrer policy - hassas URL bilgisi sızdırmayı önle
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin'
    },
    {
        // Tarayıcı özelliklerini kısıtla
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=()'
    },
    {
        // HTTPS zorunlu (production için)
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains'
    },
    {
        // Content Security Policy - XSS ve injection koruması
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js için gerekli
            "style-src 'self' 'unsafe-inline'", // Tailwind için gerekli
            "img-src 'self' data: https: blob:",
            "font-src 'self' data:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co http://213.142.150.183 https://213.142.150.183 ws://213.142.150.183 wss://213.142.150.183 https://api.iconify.design ws://localhost:3001 wss://localhost:3001",
            "frame-src 'self' blob:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ].join('; ')
    }
];

const nextConfig: NextConfig = {
    // Disable strict mode for better performance (avoids double renders)
    reactStrictMode: false,

    // Experimental features
    experimental: {
        // Enable server actions
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },

    // Exclude puppeteer and related packages from webpack bundling
    serverExternalPackages: [
        'puppeteer',
        'puppeteer-extra',
        'puppeteer-extra-plugin-stealth',
        'clone-deep',
    ],

    // ============================================
    // GUVENLIK: Security Headers
    // ============================================
    async headers() {
        return [
            {
                // Tum route'lara uygula
                source: '/:path*',
                headers: securityHeaders,
            },
        ];
    },

};

export default nextConfig;
