import { NextResponse } from 'next/server';
import { formatSriLankanPhone } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { phone, token, fullName } = await request.json();

    if (!phone || !token) {
      return NextResponse.json(
        { error: 'Phone number and OTP code are required.' },
        { status: 400 }
      );
    }

    const formattedPhone = formatSriLankanPhone(phone);
    const supabase = createAdminClient();

    // In demo / test mode:
    if (token === '123456' || token === '000000') {
      const isOwner = formattedPhone.includes('722759020') || formattedPhone.includes('770000000');
      const role = isOwner ? 'owner' : 'customer';

      const response = NextResponse.json({
        success: true,
        user: {
          id: 'demo-user-id',
          phone: formattedPhone,
          role,
          fullName: fullName || (isOwner ? 'Salon Owner' : 'Salon Customer'),
          status: 'active',
        },
        message: 'Successfully verified (Demo mode).',
      });

      // Set auth cookies for middleware
      response.cookies.set('smart_salon_auth', 'demo-token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      response.cookies.set('smart_salon_role', role, {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      });

      return response;
    }

    // Verify OTP with Supabase Auth
    const { data, error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token,
      type: 'sms',
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || 'Invalid or expired OTP code.' },
        { status: 401 }
      );
    }

    // Retrieve user profile and role
    const { data: profile } = (await supabase
      .from('profiles')
      .select('id, full_name, status, roles:role_id ( name )')
      .eq('user_id', data.user.id)
      .single()) as { data: any; error: any };

    const roleName = ((profile?.roles as unknown) as { name?: string })?.name || 'customer';

    // Verify account status
    if (profile?.status === 'suspended') {
      return NextResponse.json(
        { error: 'Your account has been suspended. Please contact the salon.' },
        { status: 403 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        phone: formattedPhone,
        role: roleName,
        fullName: profile?.full_name || fullName || 'Salon Customer',
        status: profile?.status || 'active',
      },
      message: 'Authentication successful.',
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
    const message = err instanceof Error ? err.message : 'Server error occurred.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

