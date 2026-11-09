import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/lib/services/analytics-service';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  try {
    const report = await AnalyticsService.getQueueTraffic(undefined, startDate, endDate);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_')) {
      throw error;
    }
    console.error('[API/reports/queue] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve queue traffic report' },
      { status: 500 }
    );
  }
}

