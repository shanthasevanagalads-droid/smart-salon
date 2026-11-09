import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/lib/services/analytics-service';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  try {
    const analytics = await AnalyticsService.getCustomerAnalytics(undefined, startDate, endDate);

    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_')) {
      throw error;
    }
    console.error('[API/reports/customers] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve customer analytics' },
      { status: 500 }
    );
  }
}

