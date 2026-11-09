import { NextRequest, NextResponse } from 'next/server';
import { WalkInService } from '@/lib/services/walk-in-service';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const branchId = searchParams.get('branchId') || undefined;

  try {
    const reports = await WalkInService.getWalkInReports(branchId);
    return NextResponse.json({ success: true, reports });
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_')) {
      throw error;
    }
    console.error('Walk-in reports error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to fetch walk-in reports' },
      { status: 500 }
    );
  }
}

