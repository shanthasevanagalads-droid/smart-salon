import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/services/notification-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Number(body.batchSize) || 10;

    const result = await NotificationService.processQueue(batchSize);

    return NextResponse.json({
      success: true,
      processedCount: result.processedCount,
      failedCount: result.failedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API/notifications/process] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process notification queue' },
      { status: 500 }
    );
  }
}

