import { NextRequest, NextResponse } from 'next/server';
import { AppointmentService } from '@/lib/services/appointment-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const durationMinutes = parseInt(searchParams.get('durationMinutes') || '30', 10);
    const barberId = searchParams.get('barberId') || undefined;

    const slots = await AppointmentService.generateAvailableSlots(
      undefined,
      date,
      durationMinutes,
      barberId
    );

    return NextResponse.json({
      success: true,
      date,
      slots,
      totalSlots: slots.length,
      availableSlotsCount: slots.filter((s) => s.isAvailable).length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate available slots' },
      { status: 500 }
    );
  }
}

