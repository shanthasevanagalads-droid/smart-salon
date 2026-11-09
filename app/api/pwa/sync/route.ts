import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { actions, branchId } = body;

    if (!Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json({ success: true, processedCount: 0, results: [] });
    }

    const targetBranch =
      branchId ||
      process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID ||
      'b0000000-0000-0000-0000-000000000001';

    if (isSupabaseConfigured()) {
      const { data, error } = await (supabase as any).rpc('fn_process_pwa_offline_batch', {
        p_branch_id: targetBranch,
        p_actions: actions,
      });

      if (error) {
        console.error('[API PWA Sync] Supabase RPC error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    // In-memory demo simulation when Supabase backend is offline
    const simulatedResults = actions.map((act) => ({
      actionId: act.actionId,
      status: 'success',
      type: act.type,
      entityId: `sim-${Date.now()}`,
    }));

    return NextResponse.json({
      success: true,
      processedCount: actions.length,
      skippedCount: 0,
      results: simulatedResults,
      mode: 'in-memory-reconciliation',
    });
  } catch (err: any) {
    console.error('[API PWA Sync] Handler error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

