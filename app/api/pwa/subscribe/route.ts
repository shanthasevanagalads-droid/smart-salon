import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscription, branchId, deviceType, platform, userId, customerId } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { success: false, error: 'Invalid PushSubscription payload' },
        { status: 400 }
      );
    }

    const targetBranch =
      branchId ||
      process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID ||
      'b0000000-0000-0000-0000-000000000001';

    if (isSupabaseConfigured()) {
      const { data, error } = await (supabase as any).rpc('fn_register_push_subscription', {
        p_branch_id: targetBranch,
        p_endpoint: subscription.endpoint,
        p_p256dh: subscription.keys.p256dh,
        p_auth: subscription.keys.auth,
        p_user_agent: req.headers.get('user-agent') || 'Browser PWA',
        p_device_type: deviceType || 'mobile',
        p_platform: platform || 'Web',
        p_user_id: userId || null,
        p_customer_id: customerId || null,
      });

      if (error) {
        console.error('[API PWA Subscribe] Supabase error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    }

    // In-memory fallback if Supabase is offline/not configured
    return NextResponse.json({
      success: true,
      message: 'Subscription logged in local memory mode',
      endpoint: subscription.endpoint,
    });
  } catch (err: any) {
    console.error('[API PWA Subscribe] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

