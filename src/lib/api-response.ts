/**
 * API Response Helpers
 *
 * Standart API response formatı ve error handling sağlar.
 * Tüm API route'larında bu helper'lar kullanılmalıdır.
 *
 * Kullanım:
 *   return apiSuccess(data);
 *   return apiError(new NotFoundError("Mükellef bulunamadı"));
 *   return apiHandler(async () => { ... });
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  AppError,
  AuthError,
  ValidationError,
  DatabaseError,
  ErrorCode,
} from "@/lib/errors";
import { Prisma } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================
// SUCCESS RESPONSES
// ============================================

/**
 * Başarılı response döndür
 */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    } satisfies ApiSuccessResponse<T>,
    { status }
  );
}

/**
 * Oluşturma başarılı (201)
 */
export function apiCreated<T>(data: T): NextResponse {
  return apiSuccess(data, 201);
}

/**
 * İçerik yok (204)
 */
export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// ============================================
// ERROR RESPONSES
// ============================================

/**
 * Hata response döndür
 */
export function apiError(error: AppError): NextResponse {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error instanceof ValidationError && {
        fieldErrors: error.fieldErrors,
      }),
      ...(process.env.NODE_ENV === "development" && {
        details: error.details,
      }),
    },
  };

  return NextResponse.json(response, { status: error.statusCode });
}

/**
 * Zod validation hatasını ValidationError'a çevir
 */
export function fromZodError(zodError: ZodError): ValidationError {
  const fieldErrors: Record<string, string[]> = {};

  zodError.errors.forEach((err) => {
    const path = err.path.join(".");
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(err.message);
  });

  return new ValidationError("Geçersiz veri gönderildi", fieldErrors);
}

/**
 * Prisma hatasını AppError'a çevir
 */
export function fromPrismaError(error: unknown): AppError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": // Unique constraint violation
        const target = (error.meta?.target as string[])?.join(", ") || "alan";
        return new AppError(
          `Bu ${target} zaten kullanılıyor`,
          ErrorCode.DUPLICATE_ENTRY,
          409
        );

      case "P2025": // Record not found
        return new AppError("Kayıt bulunamadı", ErrorCode.NOT_FOUND, 404);

      case "P2003": // Foreign key constraint failed
        return new AppError(
          "İlişkili kayıt bulunamadı",
          ErrorCode.VALIDATION_ERROR,
          400
        );

      default:
        return new DatabaseError(`Veritabanı hatası: ${error.code}`, {
          prismaCode: error.code,
        });
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new ValidationError("Geçersiz veritabanı sorgusu");
  }

  return new DatabaseError("Beklenmeyen veritabanı hatası");
}

/**
 * Bilinmeyen hatayı AppError'a çevir
 */
export function normalizeError(error: unknown): AppError {
  // Zaten AppError ise döndür
  if (error instanceof AppError) {
    return error;
  }

  // Zod Error
  if (error instanceof ZodError) {
    return fromZodError(error);
  }

  // Prisma Error
  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    return fromPrismaError(error);
  }

  // Standart Error
  if (error instanceof Error) {
    return new AppError(
      process.env.NODE_ENV === "development"
        ? error.message
        : "Beklenmeyen bir hata oluştu",
      ErrorCode.INTERNAL_ERROR,
      500,
      process.env.NODE_ENV === "development"
        ? { originalMessage: error.message, stack: error.stack }
        : undefined
    );
  }

  // Bilinmeyen
  return new AppError("Beklenmeyen bir hata oluştu", ErrorCode.INTERNAL_ERROR, 500);
}

// ============================================
// API HANDLER WRAPPER
// ============================================

type ApiHandlerFn<T> = () => Promise<T>;

/**
 * API route handler wrapper
 * Otomatik error handling ve response formatting sağlar
 *
 * Kullanım:
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   return apiHandler(async () => {
 *     const user = await requireAuth();
 *     const data = await prisma.customers.findMany({ where: { tenantId: user.tenantId } });
 *     return data;
 *   });
 * }
 * ```
 */
export async function apiHandler<T>(
  handler: ApiHandlerFn<T>,
  options?: {
    successStatus?: number;
  }
): Promise<NextResponse> {
  try {
    const result = await handler();
    return apiSuccess(result, options?.successStatus ?? 200);
  } catch (error) {
    const appError = normalizeError(error);

    // Development'ta console'a yaz
    if (process.env.NODE_ENV === "development") {
      console.error("[API Error]", {
        code: appError.code,
        message: appError.message,
        details: appError.details,
        stack: appError.stack,
      });
    }

    return apiError(appError);
  }
}

// ============================================
// AUTH HELPERS
// ============================================

import { getUserWithProfile } from "@/lib/supabase/auth";

export interface AuthUser {
  id: string;
  email: string;
  tenantId: string;
  role: string;
  permissions: string[];
}

/**
 * Auth kontrolü yap, yoksa AuthError fırlat
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getUserWithProfile();

  if (!user) {
    throw new AuthError("Oturum açmanız gerekiyor", ErrorCode.UNAUTHORIZED);
  }

  return user as AuthUser;
}

/**
 * Admin yetkisi kontrolü
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();

  if (user.role !== "admin") {
    throw new AuthError(
      "Bu işlem için admin yetkisi gerekiyor",
      ErrorCode.INSUFFICIENT_PERMISSIONS
    );
  }

  return user;
}

/**
 * Belirli bir permission kontrolü
 */
export async function requirePermission(permission: string): Promise<AuthUser> {
  const user = await requireAuth();

  if (user.role !== "admin" && !user.permissions.includes(permission)) {
    throw new AuthError(
      `Bu işlem için "${permission}" yetkisi gerekiyor`,
      ErrorCode.INSUFFICIENT_PERMISSIONS
    );
  }

  return user;
}
