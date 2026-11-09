import { NextRequest, NextResponse } from 'next/server';
import { getCustomerDashboardProfile } from '@/lib/services/customer-service';
import { isValidUUID } from '@/lib/security/validation';
import { createAdminClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id) && !id.startsWith('mock-')) {
      return NextResponse.json({ success: false, error: 'Invalid customer UUID.' }, { status: 400 });
    }

    const data = await getCustomerDashboardProfile(id);
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching customer profile.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!isValidUUID(id) && !id.startsWith('mock-')) {
      return NextResponse.json({ success: false, error: 'Invalid customer UUID.' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const supabase = createAdminClient();
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (body.status && ['active', 'inactive', 'blocked'].includes(body.status)) {
        updates.status = body.status;
      }
      if (body.notes !== undefined) updates.notes = body.notes;
      if (body.name) updates.name = body.name;
      if (body.preferredBarberId) updates.preferred_barber_id = body.preferredBarberId;
      if (body.address !== undefined) updates.address = body.address;

      const { data, error } = await (supabase
        .from('customers') as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, customer: data });
    }

    return NextResponse.json({
      success: true,
      message: 'Customer updated successfully (Demo Mode).',
      updates: body,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update customer.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

