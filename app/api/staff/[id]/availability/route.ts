import { NextRequest, NextResponse } from 'next/server';
import { updateStaffAvailability } from '@/lib/services/staff-service';
import { StaffAvailability } from '@/types/staff';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const allowed: StaffAvailability[] = ['available', 'busy', 'on_break', 'on_leave', 'off_duty'];
    if (!body.availability || !allowed.includes(body.availability)) {
      return NextResponse.json(
        { success: false, error: `Invalid availability. Allowed: ${allowed.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await updateStaffAvailability(id, body.availability);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update availability.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

