import { NextRequest } from 'next/server';

/**
 * Validates request origin against allowed origins for CSRF protection
 */
export function validateCsrfOrigin(request: NextRequest): { isValid: boolean; error?: string } {
  // Safe HTTP methods do not require CSRF origin validation
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(request.method)) {
    return { isValid: true };
  }

  const originHeader = request.headers.get('origin');
  const hostHeader = request.headers.get('host');

  if (!originHeader) {
    // Some server-to-server or native PWA requests may lack origin; check referer
    const refererHeader = request.headers.get('referer');
    if (refererHeader && hostHeader) {
      const refererHost = new URL(refererHeader).host;
      if (refererHost === hostHeader) {
        return { isValid: true };
      }
    }

    // Allow in local development
    if (process.env.NODE_ENV !== 'production') {
      return { isValid: true };
    }

    return { isValid: false, error: 'CSRF check failed: Origin header missing.' };
  }

  const originHost = new URL(originHeader).host;
  if (hostHeader && originHost === hostHeader) {
    return { isValid: true };
  }

  return { isValid: false, error: 'CSRF check failed: Origin does not match Host.' };
}

