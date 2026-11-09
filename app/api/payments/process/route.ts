import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/lib/services/payment-service';
import { ProcessPaymentPayload } from '@/types/payment';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ProcessPaymentPayload;

    if (!body.invoiceId || !body.paymentMethod || body.amount === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: invoiceId, paymentMethod, amount' },
        { status: 400 }
      );
    }

    if (body.amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Payment amount must be greater than zero' },
        { status: 400 }
      );
    }

    const result = await PaymentService.processPayment(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Payment failed' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      payment: result.payment,
    });
  } catch (error: any) {
    console.error('[API/payments/process] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error processing payment' },
      { status: 500 }
    );
  }
}

