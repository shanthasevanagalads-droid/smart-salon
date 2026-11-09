import { NextRequest, NextResponse } from 'next/server';
import { AppointmentService } from '@/lib/services/appointment-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || undefined;
    const serviceIds = searchParams.get('serviceIds')?.split(',') || [];
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const recommendation = await AppointmentService.recommendBarber(
      undefined,
      customerId,
      serviceIds,
      date
    );

    return NextResponse.json({
      success: true,
      recommendation,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to recommend barber' },
      { status: 500 }
    );
  }
}

