import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/lib/services/payment-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId, bankTxId } = body;

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: 'Payment ID is required to verify LankaQR confirmation' },
        { status: 400 }
      );
    }

    const result = await PaymentService.verifyLankaQr(paymentId, bankTxId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'LankaQR verification failed' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      lankaqrTxId: result.lankaqrTxId,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API/payments/verify-lankaqr] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error verifying LankaQR payment' },
      { status: 500 }
    );
  }
}

