import { NextRequest, NextResponse } from 'next/server';
import { QueueService } from '@/lib/services/queue-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.queueId) {
      return NextResponse.json({ success: false, error: 'queueId is required' }, { status: 400 });
    }

    const result = await QueueService.recallCustomer(body.queueId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to recall customer' },
      { status: 500 }
    );
  }
}

