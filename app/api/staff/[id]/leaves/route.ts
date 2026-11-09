import { NextRequest, NextResponse } from 'next/server';
import { getStaffLeaves, submitStaffLeave } from '@/lib/services/staff-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leaves = await getStaffLeaves(id);
    return NextResponse.json({ success: true, leaves });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch staff leaves.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.leaveType || !body.startDate || !body.endDate || !body.reason) {
      return NextResponse.json(
        { success: false, error: 'Leave type, start date, end date, and reason are required.' },
        { status: 400 }
      );
    }

    const result = await submitStaffLeave({
      staffId: id,
      leaveType: body.leaveType,
      startDate: body.startDate,
      endDate: body.endDate,
      reason: body.reason,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit leave.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

