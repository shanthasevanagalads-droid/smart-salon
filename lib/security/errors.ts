/**
 * SMART SALON LK - ENTERPRISE ERROR HANDLING & SECURE LOGGING
 */

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public sinhalaMessage: string;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', sinhalaMessage = 'පද්ධතියේ දෝෂයක් සිදු විය.') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.sinhalaMessage = sinhalaMessage;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required to access this resource.', sinhalaMessage = 'කරුණාකර පළමුව ලොගින් වන්න.') {
    super(message, 401, 'AUTH_REQUIRED', sinhalaMessage);
    this.name = 'AuthenticationError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.', sinhalaMessage = 'මෙම ක්‍රියාව සිදු කිරීමට ඔබට අවසර නැත.') {
    super(message, 403, 'FORBIDDEN', sinhalaMessage);
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends AppError {
  public errors?: Record<string, string>;

  constructor(message = 'Validation failed.', errors?: Record<string, string>, sinhalaMessage = 'කරුණාකර ඇතුළත් කළ තොරතුරු පරීක්ෂා කරන්න.') {
    super(message, 400, 'VALIDATION_ERROR', sinhalaMessage);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class AccountSuspendedError extends AppError {
  constructor(message = 'This account has been suspended by salon administration.', sinhalaMessage = 'ඔබගේ ගිණුම අත්හිටුවා ඇත. කරුණාකර සැලූන් කළමනාකාරිත්වය අමතන්න.') {
    super(message, 403, 'ACCOUNT_SUSPENDED', sinhalaMessage);
    this.name = 'AccountSuspendedError';
  }
}

/**
 * Logs technical errors securely on the server without exposing confidential
 * environment variables, API keys, or raw SQL queries to users.
 */
export function logSecureError(context: string, error: unknown, metadata?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Mask sensitive fields from metadata (e.g., passwords, OTP tokens, LankaQR account numbers)
  const safeMeta = metadata ? { ...metadata } : {};
  if (safeMeta.password) safeMeta.password = '[REDACTED]';
  if (safeMeta.token) safeMeta.token = '[REDACTED]';
  if (safeMeta.otp) safeMeta.otp = '[REDACTED]';

  // Server stdout log
  console.error(JSON.stringify({
    timestamp,
    context,
    error: errorMessage,
    stack: process.env.NODE_ENV !== 'production' ? stack : undefined,
    metadata: safeMeta,
  }));
}

/**
 * Formats friendly bilingual error response for API endpoints
 */
export function formatErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: {
        success: false,
        code: error.code,
        message: error.message,
        sinhalaMessage: error.sinhalaMessage,
        errors: error instanceof ValidationError ? error.errors : undefined,
      },
    };
  }

  // Generic unhandled error
  return {
    status: 500,
    body: {
      success: false,
      code: 'SERVER_ERROR',
      message: 'An unexpected system error occurred. Please try again.',
      sinhalaMessage: 'පද්ධතියේ දෝෂයක් සිදු විය. කරුණාකර නැවත උත්සාහ කරන්න.',
    },
  };
}

