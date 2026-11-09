import { NextRequest, NextResponse } from 'next/server';
import { BillingService } from '@/lib/services/billing-service';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get('q') || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const paymentMethod = searchParams.get('paymentMethod') || undefined;
  const paymentStatus = searchParams.get('paymentStatus') || undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 25;

  try {
    const invoices = await BillingService.searchInvoices({
      query,
      startDate,
      endDate,
      paymentMethod,
      paymentStatus,
      limit,
    });

    return NextResponse.json({
      success: true,
      invoices,
      count: invoices.length,
    });
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) {
      throw err;
    }
    console.error('[API Billing Invoices Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

