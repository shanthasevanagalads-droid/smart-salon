import { NextRequest, NextResponse } from 'next/server';
import { getStaffMemberById, upsertStaffMember } from '@/lib/services/staff-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staff = await getStaffMemberById(id);

    if (!staff) {
      return NextResponse.json({ success: false, error: 'Staff member not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, staff });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error retrieving staff.';
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

    const result = await upsertStaffMember({ ...body, id });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update staff member.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

