import { NextRequest, NextResponse } from 'next/server';
import { AppointmentService } from '@/lib/services/appointment-service';
import { AppointmentStatus, BookingSource } from '@/types/appointment';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get('date') || undefined;
  const barberId = searchParams.get('barberId') || undefined;
  const status = (searchParams.get('status') as AppointmentStatus | 'all') || undefined;
  const search = searchParams.get('search') || undefined;

  try {
    const appointments = await AppointmentService.getAppointments({
      date,
      barberId,
      status,
      search,
    });

    return NextResponse.json({
      success: true,
      data: appointments,
      count: appointments.length,
    });
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_')) {
      throw error;
    }
    console.error('Error fetching appointments:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch appointments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.customerName || !body.customerPhone || !body.date || !body.startTime || !body.serviceIds) {
      return NextResponse.json(
        {
          success: false,
          error: 'Required fields: customerName, customerPhone, date, startTime, serviceIds',
        },
        { status: 400 }
      );
    }

    const result = await AppointmentService.createAppointment({
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerWhatsapp: body.customerWhatsapp,
      preferredBarberId: body.preferredBarberId,
      date: body.date,
      startTime: body.startTime,
      serviceIds: body.serviceIds,
      bookingSource: (body.bookingSource as BookingSource) || 'online_pwa',
      notes: body.notes,
    });

    return NextResponse.json(
      {
        success: true,
        data: result.appointment,
        whatsappPayload: result.whatsappPayload,
        message: 'Appointment successfully reserved!',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create appointment' },
      { status: 409 }
    );
  }
}

