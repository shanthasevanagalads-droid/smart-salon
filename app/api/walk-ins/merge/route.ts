import { NextRequest, NextResponse } from 'next/server';
import { WalkInService } from '@/lib/services/walk-in-service';
import { CustomerMergePayload } from '@/types/walk-in';

export async function POST(request: NextRequest) {
  try {
    const body: CustomerMergePayload = await request.json();

    if (!body.primaryId || !body.secondaryId) {
      return NextResponse.json(
        { success: false, message: 'Primary and secondary customer IDs are both required' },
        { status: 400 }
      );
    }

    const result = await WalkInService.mergeCustomers(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Customer merge error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to merge customers' },
      { status: 500 }
    );
  }
}

