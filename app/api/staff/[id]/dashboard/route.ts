import { NextRequest, NextResponse } from 'next/server';
import { getBarberStationDashboard } from '@/lib/services/staff-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dashboard = await getBarberStationDashboard(id);

    return NextResponse.json({ success: true, dashboard });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch barber dashboard.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

