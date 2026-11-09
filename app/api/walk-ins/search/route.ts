import { NextRequest, NextResponse } from 'next/server';
import { WalkInService } from '@/lib/services/walk-in-service';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const branchId = searchParams.get('branchId') || undefined;

  try {
    if (!query.trim()) {
      return NextResponse.json({ success: true, customers: [] });
    }

    const customers = await WalkInService.searchCustomers(query, branchId);
    return NextResponse.json({ success: true, customers });
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_')) {
      throw error;
    }
    console.error('Walk-in search error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to search customers' },
      { status: 500 }
    );
  }
}

