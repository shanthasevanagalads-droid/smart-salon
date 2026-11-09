import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/lib/services/payment-service';
import { ProcessSplitPaymentPayload } from '@/types/payment';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ProcessSplitPaymentPayload;

    if (!body.invoiceId || !Array.isArray(body.splits) || body.splits.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Multi-tender split payment requires an invoiceId and at least 2 split payment legs',
        },
        { status: 400 }
      );
    }

    const totalSplitAmount = body.splits.reduce((acc, leg) => acc + (leg.amount || 0), 0);
    if (totalSplitAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Total split payment amount must be greater than zero' },
        { status: 400 }
      );
    }

    const result = await PaymentService.processSplitPayment(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to process split payment' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      parentReference: result.parentReference,
      totalSettled: result.totalSettled,
    });
  } catch (error: any) {
    console.error('[API/payments/split] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error processing split payment' },
      { status: 500 }
    );
  }
}

