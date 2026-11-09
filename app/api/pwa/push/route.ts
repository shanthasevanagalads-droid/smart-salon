import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, message, url, branchId, recipientType } = body;

    const targetBranch =
      branchId ||
      process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID ||
      'b0000000-0000-0000-0000-000000000001';

    let subscriberCount = 1;

    if (isSupabaseConfigured()) {
      let query = supabase
        .from('pwa_push_subscriptions')
        .select('id, endpoint')
        .eq('branch_id', targetBranch)
        .eq('is_active', true);

      if (recipientType === 'mobile') {
        query = query.eq('device_type', 'mobile');
      }

      const { data, error } = await query;
      if (!error && data) {
        subscriberCount = data.length;
      }
    }

    return NextResponse.json({
      success: true,
      deliveredCount: subscriberCount,
      notification: {
        title: title || 'Smart Salon LK Notice',
        message: message || 'Chair queue update or salon notification',
        url: url || '/live-queue',
      },
      dispatchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[API PWA Push Dispatch] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

