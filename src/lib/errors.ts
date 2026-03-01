/**
 * Custom Error Classes
 *
 * Standart hata sınıfları ile tutarlı error handling sağlar.
 * Tüm API'lerde bu sınıflar kullanılmalıdır.
 *
 * Kullanım:
 *   throw new AuthError("Oturum süresi doldu");
 *   throw new NotFoundError("Mükellef bulunamadı");
 *   throw new ValidationError("Geçersiz veri", zodErrors);
 */

// ============================================
// ERROR CODES
// ============================================

export const ErrorCode = {
  // Auth Errors (401, 403)
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  FORBIDDEN: "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",

  // Validation Errors (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

  // Not Found Errors (404)
  NOT_FOUND: "NOT_FOUND",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  CUSTOMER_NOT_FOUND: "CUSTOMER_NOT_FOUND",
  DOCUMENT_NOT_FOUND: "DOCUMENT_NOT_FOUND",

  // Conflict Errors (409)
  CONFLICT: "CONFLICT",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  ALREADY_EXISTS: "ALREADY_EXISTS",

  // Rate Limit (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server Errors (500)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",

  // Bot Errors
  BOT_ERROR: "BOT_ERROR",
  GIB_LOGIN_FAILED: "GIB_LOGIN_FAILED",
  GIB_SESSION_EXPIRED: "GIB_SESSION_EXPIRED",
  CAPTCHA_FAILED: "CAPTCHA_FAILED",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================
// BASE ERROR CLASS
// ============================================

export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCodeType = ErrorCode.INTERNAL_ERROR,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true; // Operational errors (expected)
    this.details = details;
    this.timestamp = new Date();

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(process.env.NODE_ENV === "development" && {
          details: this.details,
          stack: this.stack,
        }),
      },
    };
  }
}

// ============================================
// SPECIFIC ERROR CLASSES
// ============================================

/**
 * Authentication Error (401)
 * Kullanıcı kimliği doğrulanamadı
 */
export class AuthError extends AppError {
  constructor(
    message: string = "Oturum açmanız gerekiyor",
    code: ErrorCodeType = ErrorCode.UNAUTHORIZED,
    details?: Record<string, unknown>
  ) {
    super(message, code, 401, details);
  }
}

/**
 * Forbidden Error (403)
 * Kullanıcının yetkisi yok
 */
export class ForbiddenError extends AppError {
  constructor(
    message: string = "Bu işlem için yetkiniz yok",
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.FORBIDDEN, 403, details);
  }
}

/**
 * Not Found Error (404)
 * Kaynak bulunamadı
 */
export class NotFoundError extends AppError {
  constructor(
    message: string = "Kaynak bulunamadı",
    code: ErrorCodeType = ErrorCode.NOT_FOUND,
    details?: Record<string, unknown>
  ) {
    super(message, code, 404, details);
  }
}

/**
 * Validation Error (400)
 * Giriş verileri geçersiz
 */
export class ValidationError extends AppError {
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message: string = "Geçersiz veri",
    fieldErrors?: Record<string, string[]>,
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, {
      ...details,
      fieldErrors,
    });
    this.fieldErrors = fieldErrors;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        fieldErrors: this.fieldErrors,
        ...(process.env.NODE_ENV === "development" && {
          details: this.details,
        }),
      },
    };
  }
}

/**
 * Conflict Error (409)
 * Kaynak zaten mevcut veya çakışma var
 */
export class ConflictError extends AppError {
  constructor(
    message: string = "Bu kayıt zaten mevcut",
    code: ErrorCodeType = ErrorCode.CONFLICT,
    details?: Record<string, unknown>
  ) {
    super(message, code, 409, details);
  }
}

/**
 * Rate Limit Error (429)
 * İstek limiti aşıldı
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60, details?: Record<string, unknown>) {
    super(
      "Çok fazla istek gönderildi. Lütfen biraz bekleyin.",
      ErrorCode.RATE_LIMIT_EXCEEDED,
      429,
      { ...details, retryAfter }
    );
    this.retryAfter = retryAfter;
  }
}

/**
 * Database Error (500)
 * Veritabanı işlemi başarısız
 */
export class DatabaseError extends AppError {
  constructor(
    message: string = "Veritabanı hatası oluştu",
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.DATABASE_ERROR, 500, details);
  }
}

/**
 * Bot Error (500)
 * GİB/TÜRMOB bot hatası
 */
export class BotError extends AppError {
  constructor(
    message: string = "Bot işlemi başarısız",
    code: ErrorCodeType = ErrorCode.BOT_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message, code, 500, details);
  }
}

/**
 * External Service Error (502)
 * Dış servis hatası
 */
export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    message: string = "Dış servis hatası",
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.EXTERNAL_SERVICE_ERROR, 502, {
      ...details,
      service,
    });
  }
}
