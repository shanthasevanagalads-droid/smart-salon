import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/lib/services/analytics-service';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const date = searchParams.get('date') || undefined;

  try {
    const overview = await AnalyticsService.getOverview(undefined, date);

    return NextResponse.json({
      success: true,
      overview,
    });
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_')) {
      throw error;
    }
    console.error('[API/reports/overview] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve executive overview' },
      { status: 500 }
    );
  }
}

