import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const supabase = createAdminClient();

    // Check auth via supabase
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Check if demo cookie is set
      const isDemo = cookieHeader.includes('smart_salon_auth=demo-token');
      if (isDemo) {
        const isOwner = cookieHeader.includes('smart_salon_role=owner');
        return NextResponse.json({
          authenticated: true,
          user: {
            id: 'demo-user-id',
            phone: '+94770000000',
            role: isOwner ? 'owner' : 'customer',
            fullName: isOwner ? 'Salon Owner' : 'Salon Customer',
            status: 'active',
          },
        });
      }

      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    // Retrieve active profile
    const { data: profile } = (await supabase
      .from('profiles')
      .select('id, full_name, phone_number, status, language, roles:role_id ( name, permissions )')
      .eq('user_id', user.id)
      .single()) as { data: any; error: any };

    const roleData = profile?.roles as unknown as { name?: string; permissions?: string[] };

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        phone: profile?.phone_number || user.phone,
        fullName: profile?.full_name,
        role: roleData?.name || 'customer',
        status: profile?.status || 'active',
        language: profile?.language || 'si',
        permissions: roleData?.permissions || [],
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

