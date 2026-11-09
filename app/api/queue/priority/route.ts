import { NextRequest, NextResponse } from 'next/server';
import { QueueService } from '@/lib/services/queue-service';
import { QueuePriority } from '@/types/queue';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.queueId || !body.priority) {
      return NextResponse.json(
        { success: false, error: 'queueId and priority are required' },
        { status: 400 }
      );
    }

    const result = await QueueService.setPriority(
      body.queueId,
      body.priority as QueuePriority,
      body.reason
    );
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update priority' },
      { status: 500 }
    );
  }
}

