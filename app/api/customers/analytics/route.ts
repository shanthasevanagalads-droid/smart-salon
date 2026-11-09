import { NextRequest, NextResponse } from 'next/server';
import { getCustomerAnalytics } from '@/lib/services/customer-service';

export async function GET(request: NextRequest) {
  const branchId =
    request.nextUrl.searchParams.get('branchId') ||
    process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID ||
    'b0000000-0000-0000-0000-000000000001';

  try {
    const analytics = await getCustomerAnalytics(branchId);
    return NextResponse.json({ success: true, analytics });
  } catch (err: unknown) {
    if ((err as any)?.digest?.startsWith('NEXT_')) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Error retrieving CRM analytics.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

