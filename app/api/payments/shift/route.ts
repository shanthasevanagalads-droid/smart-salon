import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '@/lib/services/payment-service';

export async function GET(req: NextRequest) {
  const _ = req.nextUrl.searchParams;
  try {
    const analytics = await PaymentService.getAnalytics();
    return NextResponse.json({
      success: true,
      activeShift: analytics.activeCashShift,
    });
  } catch (error: any) {
    if (error?.digest?.startsWith('NEXT_')) {
      throw error;
    }
    console.error('[API/payments/shift] Error getting shift:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to inspect shift status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, shiftId, actualCash, notes } = body;

    if (action === 'close') {
      if (!shiftId || actualCash === undefined) {
        return NextResponse.json(
          { success: false, error: 'Shift ID and counted actual cash are required for reconciliation' },
          { status: 400 }
        );
      }

      const result = await PaymentService.closeShift(shiftId, Number(actualCash), notes);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to close register shift' },
          { status: 422 }
        );
      }

      return NextResponse.json({
        success: true,
        discrepancy: result.discrepancy,
        message:
          result.discrepancy === 0
            ? 'Cash drawer balanced perfectly.'
            : result.discrepancy! > 0
            ? `Drawer has an overage of LKR ${result.discrepancy!.toLocaleString()}`
            : `Drawer has a shortage of LKR ${Math.abs(result.discrepancy!).toLocaleString()}`,
      });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported shift action '${action}'` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API/payments/shift] Error updating shift:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Shift management operation failed' },
      { status: 500 }
    );
  }
}

