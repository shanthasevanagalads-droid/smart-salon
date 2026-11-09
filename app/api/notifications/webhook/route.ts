import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'smart_salon_lk_whatsapp_verify_token';

// GET: Verification Challenge from Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// POST: Incoming Events & Status Updates from Meta Cloud API
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Check if this is a WhatsApp status update (sent, delivered, read)
    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const statuses = value?.statuses;

    if (Array.isArray(statuses) && statuses.length > 0) {
      const statusObj = statuses[0];
      const messageId = statusObj.id;
      const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
      const errors = statusObj.errors;
      const reason = errors?.[0]?.message;

      if (isSupabaseConfigured() && supabase) {
        await (supabase as any).rpc('fn_update_notification_status', {
          p_provider_message_id: messageId,
          p_status: status,
          p_error_reason: reason || null,
        });
      }
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error: any) {
    console.error('[API/notifications/webhook] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 200 }); // Always 200 to WhatsApp to avoid backoff
  }
}

