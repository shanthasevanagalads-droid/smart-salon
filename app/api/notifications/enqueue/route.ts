import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/services/notification-service';
import { EnqueueNotificationPayload } from '@/types/notification';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EnqueueNotificationPayload;

    if (!body.recipientPhone || !body.templateCode) {
      return NextResponse.json(
        { success: false, error: 'Recipient phone number and template code are required' },
        { status: 400 }
      );
    }

    const result = await NotificationService.enqueueNotification(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to enqueue notification' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      queueId: result.queueId,
      renderedBody: result.renderedBody,
      whatsappUrl: result.whatsappUrl,
      isDuplicate: result.isDuplicate,
    });
  } catch (error: any) {
    console.error('[API/notifications/enqueue] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error enqueuing notification' },
      { status: 500 }
    );
  }
}

