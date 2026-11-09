import { NextRequest, NextResponse } from 'next/server';
import { AppointmentService } from '@/lib/services/appointment-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const appointment = await AppointmentService.getAppointmentById(id);

    if (!appointment) {
      return NextResponse.json(
        { success: false, error: 'Appointment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: appointment });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch appointment' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.newDate && body.newStartTime) {
      const updated = await AppointmentService.rescheduleAppointment(id, {
        newDate: body.newDate,
        newStartTime: body.newStartTime,
        newBarberId: body.newBarberId,
        reason: body.reason,
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Appointment rescheduled successfully',
      });
    }

    return NextResponse.json(
      { success: false, error: 'newDate and newStartTime are required for rescheduling' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reschedule appointment' },
      { status: 409 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get('reason') || 'Cancelled by customer or salon request';

    const cancelled = await AppointmentService.cancelAppointment(id, reason);

    return NextResponse.json({
      success: true,
      data: cancelled,
      message: 'Appointment cancelled successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to cancel appointment' },
      { status: 500 }
    );
  }
}

