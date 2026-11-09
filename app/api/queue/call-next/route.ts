import { NextRequest, NextResponse } from 'next/server';
import { QueueService } from '@/lib/services/queue-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chairNumber = Number(body.chairNumber || 1);
    const staffId = body.staffId || undefined;
    const branchId = body.branchId || undefined;

    const result = await QueueService.callNextCustomer(chairNumber, staffId, branchId);

    return NextResponse.json({
      success: !!result.ticket,
      ticket: result.ticket,
      message: result.message,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to call next customer' },
      { status: 500 }
    );
  }
}

