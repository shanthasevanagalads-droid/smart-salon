import { NextRequest, NextResponse } from 'next/server';
import { BillingService } from '@/lib/services/billing-service';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const date = searchParams.get('date') || undefined;
  const branchId = searchParams.get('branchId') || undefined;

  try {
    const kpis = await BillingService.getDailyKpis(branchId, date);

    return NextResponse.json({
      success: true,
      kpis,
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) {
      throw err;
    }
    console.error('[API Billing KPIs Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

