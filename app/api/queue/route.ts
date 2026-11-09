import { NextRequest, NextResponse } from 'next/server';
import { QueueService } from '@/lib/services/queue-service';
import { QueuePriority, QueueTicketType } from '@/types/queue';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const branchId = searchParams.get('branchId') || undefined;
  const ticketCode = searchParams.get('code');

  try {
    if (ticketCode) {
      const ticket = await QueueService.getTicketByCode(ticketCode);
      if (!ticket) {
        return NextResponse.json(
          { success: false, error: 'Queue ticket not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: ticket });
    }

    const dashboard = await QueueService.getLiveQueueDashboard(branchId);
    return NextResponse.json({ success: true, data: dashboard });
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_')) {
      throw error;
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch live queue board' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.customerName) {
      return NextResponse.json(
        { success: false, error: 'customerName is required' },
        { status: 400 }
      );
    }

    const result = await QueueService.enqueueCustomer({
      branchId: body.branchId,
      queueType: (body.queueType as QueueTicketType) || 'walk_in',
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      serviceId: body.serviceId,
      preferredStaffId: body.preferredStaffId,
      appointmentId: body.appointmentId,
      priority: (body.priority as QueuePriority) || 'normal',
      notes: body.notes,
    });

    return NextResponse.json(
      {
        success: true,
        data: result.ticket,
        message: result.message,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to enqueue customer' },
      { status: 500 }
    );
  }
}

