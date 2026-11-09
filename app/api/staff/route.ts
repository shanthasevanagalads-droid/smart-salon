import { NextRequest, NextResponse } from 'next/server';
import { getStaffMembers, upsertStaffMember } from '@/lib/services/staff-service';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const branchId = searchParams.get('branchId') || undefined;

  try {
    const staff = await getStaffMembers(branchId);
    return NextResponse.json({ success: true, count: staff.length, staff });
  } catch (err: unknown) {
    if ((err as any)?.digest?.startsWith('NEXT_')) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Failed to fetch staff members.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.fullName || !body.phone || !body.position || !body.chairNumber) {
      return NextResponse.json(
        { success: false, error: 'Full name, phone, position, and chair number are required.' },
        { status: 400 }
      );
    }

    const result = await upsertStaffMember(body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save staff member.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

