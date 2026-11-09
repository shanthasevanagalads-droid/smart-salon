import { NextRequest, NextResponse } from 'next/server';
import { BillingService, generateThermalReceiptText, DEFAULT_THERMAL_SETTINGS } from '@/lib/services/billing-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await BillingService.getInvoiceById(id);

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'html';

    if (format === 'raw') {
      const rawText = generateThermalReceiptText(invoice);
      return new NextResponse(rawText, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.txt"`,
        },
      });
    }

    // Render 80mm high-contrast thermal printable HTML layout
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt ${invoice.invoiceNumber}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    body {
      width: 76mm;
      margin: 0 auto;
      padding: 10px 4px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.35;
      color: #000;
      background: #fff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .double-divider { border-top: 2px solid #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; }
    .barcode-box { text-align: center; margin: 10px 0 6px 0; }
    .barcode-lines {
      display: inline-block;
      height: 44px;
      background: repeating-linear-gradient(
        90deg,
        #000,
        #000 2px,
        #fff 2px,
        #fff 4px,
        #000 4px,
        #000 7px,
        #fff 7px,
        #fff 9px
      );
      width: 190px;
    }
    .qr-standee {
      border: 1px solid #000;
      padding: 8px;
      text-align: center;
      margin: 8px auto;
      width: 140px;
    }
    @media print {
      body { width: 100%; margin: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 12px; text-align: center;">
    <button onclick="window.print()" style="padding: 6px 16px; font-weight: bold; cursor: pointer;">
      🖨️ Print 80mm Receipt
    </button>
  </div>

  <div class="text-center bold" style="font-size: 15px;">${DEFAULT_THERMAL_SETTINGS.salonName.toUpperCase()}</div>
  <div class="text-center" style="font-size: 13px;">${DEFAULT_THERMAL_SETTINGS.sinhalaName}</div>
  <div class="text-center">${DEFAULT_THERMAL_SETTINGS.address}</div>
  <div class="text-center">${DEFAULT_THERMAL_SETTINGS.city}</div>
  <div class="text-center">Tel: ${DEFAULT_THERMAL_SETTINGS.phone}</div>
  <div class="text-center">Reg No: ${DEFAULT_THERMAL_SETTINGS.brNumber || 'PV-109482'}</div>

  <div class="divider"></div>

  <div class="row"><span>INVOICE:</span><span class="bold">${invoice.invoiceNumber}</span></div>
  <div class="row"><span>DATE:</span><span>${new Date(invoice.createdAt).toLocaleDateString('en-GB')} ${new Date(invoice.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
  ${invoice.staffName ? `<div class="row"><span>BARBER:</span><span>${invoice.staffName}</span></div>` : ''}
  ${invoice.customerName ? `<div class="row"><span>CUSTOMER:</span><span>${invoice.customerName}</span></div>` : ''}
  ${invoice.customerPhone ? `<div class="row"><span>PHONE:</span><span>${invoice.customerPhone}</span></div>` : ''}

  <div class="divider"></div>
  <div class="row bold">
    <span style="flex: 2;">SERVICE</span>
    <span style="flex: 1; text-align: center;">QTY</span>
    <span style="flex: 1; text-align: right;">LKR</span>
  </div>
  <div class="divider"></div>

  ${(invoice.items || [])
    .map(
      (it) => `
    <div class="row">
      <span style="flex: 2;">${it.itemName}</span>
      <span style="flex: 1; text-align: center;">${it.quantity}</span>
      <span style="flex: 1; text-align: right;">${it.total.toFixed(2)}</span>
    </div>
    ${it.itemSinhalaName ? `<div style="font-size: 10px; color: #333; margin-left: 6px;">${it.itemSinhalaName}</div>` : ''}
  `
    )
    .join('')}

  <div class="divider"></div>
  <div class="row"><span>SUBTOTAL:</span><span>${invoice.subtotal.toFixed(2)}</span></div>
  ${invoice.discount > 0 ? `<div class="row"><span>DISCOUNT:</span><span>-${invoice.discount.toFixed(2)}</span></div>` : ''}
  ${invoice.tax > 0 ? `<div class="row"><span>TAX:</span><span>${invoice.tax.toFixed(2)}</span></div>` : ''}
  
  <div class="double-divider"></div>
  <div class="row bold" style="font-size: 14px;">
    <span>TOTAL PAYABLE:</span>
    <span>LKR ${invoice.grandTotal.toFixed(2)}</span>
  </div>
  <div class="double-divider"></div>

  <div class="row"><span>PAYMENT MODE:</span><span class="bold">${invoice.paymentMethod.toUpperCase()}</span></div>
  ${
    invoice.paymentMethod === 'cash'
      ? `
    <div class="row"><span>CASH TENDERED:</span><span>${invoice.cashTendered.toFixed(2)}</span></div>
    <div class="row bold"><span>CHANGE RETURNED:</span><span>LKR ${invoice.changeAmount.toFixed(2)}</span></div>
  `
      : invoice.paymentMethod === 'lankaqr'
      ? `
    <div style="font-size: 11px; text-align: center; margin: 4px 0;">Paid via LankaQR National Switch</div>
  `
      : `
    <div class="row"><span>CARD:</span><span>APPROVED</span></div>
  `
  }

  <div class="divider"></div>

  <div class="barcode-box">
    <div class="barcode-lines"></div>
    <div style="font-size: 10px; letter-spacing: 2px; margin-top: 2px;">${invoice.barcodeValue}</div>
  </div>

  <div class="text-center" style="margin-top: 8px;">
    <div class="bold" style="font-size: 11px;">ස්තූතියි! නැවත එන්න.</div>
    <div style="font-size: 11px;">${DEFAULT_THERMAL_SETTINGS.footerMessage}</div>
    <div style="font-size: 9px; margin-top: 4px; color: #555;">Smart Salon LK • Cloud POS Engine</div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (err: any) {
    console.error('[API Thermal Receipt Error]:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}

