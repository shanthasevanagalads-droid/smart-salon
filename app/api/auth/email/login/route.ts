import { NextRequest, NextResponse } from 'next/server';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import { isValidEmail } from '@/lib/security/validation';
import { logSecureError } from '@/lib/security/errors';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF Origin Check
    const csrf = validateCsrfOrigin(request);
    if (!csrf.isValid) {
      return NextResponse.json({ error: csrf.error }, { status: 403 });
    }

    const { email, password } = await request.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Authenticate with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      // Log failed login event in PostgreSQL audit trail
      try {
        await supabase.rpc('log_security_event', {
          p_action: 'FAILED_LOGIN',
          p_details: { email, reason: error?.message || 'Invalid credentials' },
          p_table_name: 'auth_users',
          p_ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
          p_user_agent: request.headers.get('user-agent'),
        });
      } catch {
        // fail silently for audit
      }

      return NextResponse.json(
        { error: 'Invalid email or password. Please try again.' },
        { status: 401 }
      );
    }

    // Retrieve profile & role
    const { data: profile } = (await supabase
      .from('profiles')
      .select('id, full_name, phone_number, status, roles:role_id ( name )')
      .eq('user_id', data.user.id)
      .single()) as { data: any; error: any };

    const roleName = ((profile?.roles as unknown) as { name?: string })?.name || 'customer';

    if (profile?.status === 'suspended') {
      return NextResponse.json(
        { error: 'Your account is suspended. Contact the salon administrator.' },
        { status: 403 }
      );
    }

    // Log successful login audit
    try {
      await supabase.rpc('log_security_event', {
        p_action: 'LOGIN',
        p_record_id: data.user.id,
        p_details: { method: 'email', role: roleName },
        p_table_name: 'auth_users',
        p_user_id: data.user.id,
        p_ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
        p_user_agent: request.headers.get('user-agent'),
      });
    } catch {
      // audit logging safe
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email,
        phone: profile?.phone_number,
        fullName: profile?.full_name || 'Salon User',
        role: roleName,
        status: profile?.status || 'active',
      },
    });

    if (data.session) {
      response.cookies.set('sb-access-token', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: data.session.expires_in,
      });
      response.cookies.set('smart_salon_role', roleName, {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return response;
  } catch (err: unknown) {
    logSecureError('EMAIL_LOGIN_API', err);
    return NextResponse.json({ error: 'An unexpected system error occurred.' }, { status: 500 });
  }
}

