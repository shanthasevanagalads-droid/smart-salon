import { NextRequest, NextResponse } from 'next/server';
import { WalkInService } from '@/lib/services/walk-in-service';
import { QuickRegisterWalkInPayload } from '@/types/walk-in';

export async function POST(request: NextRequest) {
  try {
    const body: QuickRegisterWalkInPayload = await request.json();

    if (!body.mobile || !body.mobile.trim()) {
      return NextResponse.json(
        { success: false, message: 'Customer mobile number is required' },
        { status: 400 }
      );
    }

    const result = await WalkInService.quickRegisterAndEnqueue(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Walk-in quick register error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to register walk-in customer' },
      { status: 500 }
    );
  }
}

