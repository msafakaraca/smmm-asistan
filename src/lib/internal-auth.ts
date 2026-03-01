/**
 * Internal Auth Helper
 *
 * Electron bot ve internal API'ler arasında güvenli iletişim için JWT token yönetimi.
 * Header-based tenant ID yerine imzalı token kullanarak güvenlik sağlar.
 */

import jwt from "jsonwebtoken";

// Internal API için ayrı secret key (JWT_SECRET'tan farklı)
const INTERNAL_SECRET =
  process.env.INTERNAL_API_SECRET ||
  process.env.JWT_SECRET;

// Token süresi - internal API çağrıları için 1 saat yeterli
const TOKEN_EXPIRY = "1h";

interface InternalTokenPayload {
  tenantId: string;
  purpose: "internal-api";
  iat?: number;
  exp?: number;
}

/**
 * Internal API çağrıları için JWT token oluşturur
 * @param tenantId - Tenant ID
 * @returns Signed JWT token
 */
export function signInternalToken(tenantId: string): string {
  if (!INTERNAL_SECRET) {
    throw new Error('[InternalAuth] INTERNAL_API_SECRET veya JWT_SECRET yapılandırılmamış');
  }

  const payload: InternalTokenPayload = {
    tenantId,
    purpose: "internal-api",
  };

  return jwt.sign(payload, INTERNAL_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
}

/**
 * Internal API token'ını doğrular
 * @param token - JWT token
 * @returns Decoded payload veya null
 */
export function verifyInternalToken(
  token: string
): { tenantId: string } | null {
  if (!INTERNAL_SECRET) {
    console.error('[InternalAuth] INTERNAL_API_SECRET veya JWT_SECRET yapılandırılmamış');
    return null;
  }

  try {
    const decoded = jwt.verify(token, INTERNAL_SECRET) as InternalTokenPayload;

    // Purpose kontrolü - sadece internal-api token'ları kabul et
    if (decoded.purpose !== "internal-api") {
      console.warn("[InternalAuth] Token purpose mismatch");
      return null;
    }

    return { tenantId: decoded.tenantId };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.warn("[InternalAuth] Token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn("[InternalAuth] Invalid token:", error.message);
    } else {
      console.error("[InternalAuth] Verification error:", error);
    }
    return null;
  }
}

/**
 * Internal API request headers helper
 * Electron bot tarafından kullanılır
 */
export function getInternalAuthHeaders(tenantId: string): HeadersInit {
  const token = signInternalToken(tenantId);
  return {
    "Content-Type": "application/json",
    "X-Internal-Token": token,
  };
}
