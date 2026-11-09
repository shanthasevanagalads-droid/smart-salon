import { NextRequest, NextResponse } from 'next/server';
import { BillingService } from '@/lib/services/billing-service';
import { InvoiceCheckoutPayload } from '@/types/billing';

export async function POST(req: NextRequest) {
  try {
    const body: InvoiceCheckoutPayload = await req.json();

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one service item is required' },
        { status: 400 }
      );
    }

    if (!body.paymentMethod) {
      return NextResponse.json(
        { success: false, error: 'Payment method is required' },
        { status: 400 }
      );
    }

    const result = await BillingService.checkout(body);

    if (!result.success || !result.invoice) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to settle invoice' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice: result.invoice,
    });
  } catch (err: any) {
    console.error('[API Billing Checkout Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

