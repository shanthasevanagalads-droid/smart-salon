import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read auth token or session cookies
  const authToken = request.cookies.get('sb-access-token')?.value ||
                    request.cookies.get('smart_salon_auth')?.value;
  const userRole = request.cookies.get('smart_salon_role')?.value;

  // 1. Owner & Staff Counter POS Protection
  if (pathname.startsWith('/owner-pos')) {
    // If not authenticated in production, redirect to login
    if (!authToken && process.env.NODE_ENV === 'production') {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('reason', 'unauthorized');
      return NextResponse.redirect(loginUrl);
    }

    // Customer role is strictly barred from POS
    if (userRole === 'customer') {
      const homeUrl = new URL('/', request.url);
      return NextResponse.redirect(homeUrl);
    }

    // Owner-only sensitive POS routes (Settings, Staff Commission, Financial Reports)
    if (pathname.startsWith('/owner-pos/settings') || pathname.startsWith('/owner-pos/reports')) {
      if (userRole === 'staff') {
        const posUrl = new URL('/owner-pos', request.url);
        return NextResponse.redirect(posUrl);
      }
    }
  }

  // 2. Protected Customer Bookings Route
  if (pathname.startsWith('/bookings')) {
    if (!authToken && process.env.NODE_ENV === 'production') {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Protected API Routes
  if (pathname.startsWith('/api/admin') || pathname.startsWith('/api/staff')) {
    if (!authToken && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }
    if (pathname.startsWith('/api/admin') && userRole !== 'owner' && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Forbidden: Owner privilege required.' },
        { status: 403 }
      );
    }
  }

  // 4. Attach Security Headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  return response;
}

export const config = {
  matcher: [
    '/owner-pos/:path*',
    '/bookings/:path*',
    '/api/admin/:path*',
    '/api/staff/:path*',
  ],
};

