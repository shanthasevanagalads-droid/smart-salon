import { NextRequest, NextResponse } from 'next/server';
import { getStaffCommissionReport } from '@/lib/services/staff-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;

    const report = await getStaffCommissionReport(id, year, month);
    return NextResponse.json({ success: true, report });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch commission report.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

