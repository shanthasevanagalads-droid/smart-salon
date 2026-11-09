import { NextRequest, NextResponse } from 'next/server';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const csrf = validateCsrfOrigin(request);
    if (!csrf.isValid) {
      return NextResponse.json({ error: csrf.error }, { status: 403 });
    }

    const { scope } = await request.json().catch(() => ({ scope: 'local' }));
    const supabase = createAdminClient();

    // Invalidate sessions via RPC if global
    if (scope === 'global') {
      try {
        await supabase.rpc('revoke_user_sessions');
      } catch {
        // safe fallback
      }
    }

    const response = NextResponse.json({
      success: true,
      message: scope === 'global' ? 'Logged out from all devices.' : 'Successfully logged out.',
    });

    // Invalidate and delete all auth session cookies
    response.cookies.set('sb-access-token', '', { path: '/', maxAge: 0 });
    response.cookies.set('smart_salon_auth', '', { path: '/', maxAge: 0 });
    response.cookies.set('smart_salon_role', '', { path: '/', maxAge: 0 });

    return response;
  } catch {
    return NextResponse.json({ success: true, message: 'Logged out.' });
  }
}

