import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/services/notification-service';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  try {
    const analytics = await NotificationService.getAnalytics(startDate, endDate);
    const logs = await NotificationService.searchLogs();

    return NextResponse.json({
      success: true,
      analytics,
      recentLogs: logs.slice(0, 50),
    });
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_')) {
      throw error;
    }
    console.error('[API/notifications/analytics] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch notification analytics' },
      { status: 500 }
    );
  }
}

