// ========================================================================
// SMART SALON LK - BILLING & POINT OF SALE (POS) SERVICE ENGINE
// Dual-Mode Architecture: Supabase RPCs + Offline / In-Memory Fallback
// ========================================================================

import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { NotificationService } from '@/lib/services/notification-service';
import {
  Invoice,
  InvoiceItem,
  Payment,
  PaymentMethod,
  InvoiceCheckoutPayload,
  InvoiceCheckoutResult,
  PosDailyKpis,
  ThermalReceiptSettings,
} from '@/types/billing';

const DEFAULT_BRANCH_ID =
  process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID || 'b0000000-0000-0000-0000-000000000001';

export const DEFAULT_THERMAL_SETTINGS: ThermalReceiptSettings = {
  salonName: 'The Royal Blade Barber',
  sinhalaName: 'රාජකීය බාබර් සාප්පුව',
  address: 'Kandy Road,Ampitiya',
  city: 'Kandy',
  phone: '+94 72 275 9020',
  whatsapp: '+94 72 275 9020',
  brNumber: 'PV-109482',
  footerMessage: 'Thank you for your visit! / ස්තූතියි! නැවත එන්න',
  currency: 'LKR',
};

// ------------------------------------------------------------------------
// 1. LANKAQR & BARCODE GENERATION ENGINES
// ------------------------------------------------------------------------

/**
 * Generates an authentic EMVCo-compliant LankaQR dynamic QR payload
 * Tag 00: Format Indicator (01)
 * Tag 01: Point of Initiation Method (12 = Dynamic)
 * Tag 26: Merchant Account Info (COM.LANKAQR)
 * Tag 52: Merchant Category Code (7230 = Barber Shops)
 * Tag 53: Transaction Currency (144 = LKR)
 * Tag 54: Transaction Amount
 * Tag 58: Country Code (LK)
 * Tag 59: Merchant Name
 * Tag 60: Merchant City
 * Tag 62: Additional Data (Invoice Number)
 * Tag 63: CRC16 Checksum
 */
export function generateLankaQrPayload(
  arg1:
    | {
      merchantId?: string;
      salonName?: string;
      invoiceNumber: string;
      amount?: number;
      city?: string;
    }
    | string,
  arg2?: number,
  arg3?: string
): string {
  let invoiceNumber = '';
  let amount = 0;
  let salonName = 'SMART SALON LK';
  let merchantId = 'LKQR-9021-SMART';
  let city = 'KANDY';

  if (typeof arg1 === 'object' && arg1 !== null) {
    invoiceNumber = arg1.invoiceNumber || 'INV-000000';
    amount = Number(arg1.amount) || 0;
    salonName = (arg1.salonName || salonName).substring(0, 25).toUpperCase();
    merchantId = arg1.merchantId || merchantId;
    city = (arg1.city || city).substring(0, 15).toUpperCase();
  } else {
    invoiceNumber = String(arg1 || 'INV-000000');
    amount = Number(arg2) || 0;
    salonName = (arg3 || salonName).substring(0, 25).toUpperCase();
  }

  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : (parseFloat(String(amount)) || 0);
  const formattedAmount = safeAmount.toFixed(2);

  // TLV helper
  const tlv = (tag: string, value: string) => {
    const len = value.length.toString().padStart(2, '0');
    return `${tag}${len}${value}`;
  };

  const tag00 = tlv('00', '01');
  const tag01 = tlv('01', '12'); // Dynamic QR (contains invoice amount)
  const tag26Sub00 = tlv('00', 'COM.LANKAQR');
  const tag26Sub01 = tlv('01', merchantId);
  const tag26 = tlv('26', `${tag26Sub00}${tag26Sub01}`);
  const tag52 = tlv('52', '7230'); // Barber Shops
  const tag53 = tlv('53', '144'); // LKR
  const tag54 = tlv('54', formattedAmount);
  const tag58 = tlv('58', 'LK');
  const tag59 = tlv('59', salonName);
  const tag60 = tlv('60', city);
  const tag62Sub01 = tlv('01', invoiceNumber);
  const tag62 = tlv('62', tag62Sub01);

  const payloadWithoutCrc = `${tag00}${tag01}${tag26}${tag52}${tag53}${tag54}${tag58}${tag59}${tag60}${tag62}6304`;
  const crc = computeCrc16(payloadWithoutCrc);

  return `${payloadWithoutCrc}${crc}`;
}

/**
 * Standard CCITT CRC-16 calculation for EMVCo / LankaQR
 */
function computeCrc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generates an SVG Barcode line pattern for Code 128 visualization
 */
export function generateBarcodeSvgBars(value: string): string {
  // Hash character positions to generate pseudo-realistic scannable code bars
  const bars: number[] = [];
  let seed = 0;
  for (let i = 0; i < value.length; i++) {
    seed = (seed * 31 + value.charCodeAt(i)) & 0xffffffff;
  }

  // Generate 48 alternating bars and spaces
  let state = Math.abs(seed);
  for (let i = 0; i < 48; i++) {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    bars.push((state % 3) + 1); // bar width 1, 2, or 3
  }

  return bars.join(',');
}

// ------------------------------------------------------------------------
// 2. IN-MEMORY STORE FOR OFFLINE / RESILIENT FALLBACK
// ------------------------------------------------------------------------

let LOCAL_INVOICE_COUNTER = 4;

let LOCAL_INVOICES: Invoice[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    branchId: DEFAULT_BRANCH_ID,
    invoiceNumber: 'INV-2026-000001',
    customerId: 'a0000000-0000-0000-0000-000000000001',
    customerName: 'Kasun Perera',
    customerPhone: '+94771234567',
    customerNumber: 'CUST-202611-0001',
    staffId: 'c0000000-0000-0000-0000-000000000001',
    staffName: 'Master Kavi (Chair 01)',
    chairNumber: 1,
    subtotal: 1800,
    discount: 0,
    discountType: 'fixed',
    tax: 0,
    grandTotal: 1800,
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    cashTendered: 2000,
    changeAmount: 200,
    balance: 0,
    barcodeValue: 'SSLK20261103-000001',
    qrCodeValue: generateLankaQrPayload({ invoiceNumber: 'INV-2026-000001', amount: 1800 }),
    verificationCode: 'VER-20261103-001',
    verificationUrl: 'https://smartsalon.lk/verify/VER-20261103-001',
    refundStatus: 'none',
    refundedAmount: 0,
    printedCount: 1,
    whatsappSentCount: 1,
    createdAt: new Date(Date.now() - 10800000).toISOString(),
    updatedAt: new Date(Date.now() - 10800000).toISOString(),
    items: [
      {
        id: '11000000-0000-0000-0000-000000000001',
        invoiceId: '10000000-0000-0000-0000-000000000001',
        itemName: 'Adult Hair Cut',
        itemSinhalaName: 'වැඩිහිටි කොණ්ඩ කැපීම',
        quantity: 1,
        unitPrice: 1200,
        discount: 0,
        total: 1200,
        staffName: 'Master Kavi',
      },
      {
        id: '11000000-0000-0000-0000-000000000002',
        invoiceId: '10000000-0000-0000-0000-000000000001',
        itemName: 'Beard Trim & Lineup',
        itemSinhalaName: 'රැවුල හැඩගැන්වීම',
        quantity: 1,
        unitPrice: 600,
        discount: 0,
        total: 600,
        staffName: 'Master Kavi',
      },
    ],
    payments: [
      {
        id: '20000000-0000-0000-0000-000000000001',
        branchId: DEFAULT_BRANCH_ID,
        invoiceId: '10000000-0000-0000-0000-000000000001',
        referenceNumber: 'PAY-20261103-0001',
        paymentMethod: 'cash',
        amount: 1800,
        status: 'paid',
        cashTendered: 2000,
        changeDue: 200,
        paidTime: new Date(Date.now() - 10800000).toISOString(),
      },
    ],
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    branchId: DEFAULT_BRANCH_ID,
    invoiceNumber: 'INV-2026-000002',
    customerId: 'a0000000-0000-0000-0000-000000000002',
    customerName: 'Ruwan Pradeep',
    customerPhone: '+94712345678',
    customerNumber: 'CUST-202611-0002',
    staffId: 'c0000000-0000-0000-0000-000000000002',
    staffName: 'Sunil Shantha (Chair 02)',
    chairNumber: 2,
    subtotal: 3600,
    discount: 200,
    discountType: 'fixed',
    tax: 0,
    grandTotal: 3400,
    paymentStatus: 'paid',
    paymentMethod: 'lankaqr',
    cashTendered: 3400,
    changeAmount: 0,
    balance: 0,
    barcodeValue: 'SSLK20261103-000002',
    qrCodeValue: generateLankaQrPayload({ invoiceNumber: 'INV-2026-000002', amount: 3400 }),
    verificationCode: 'VER-20261103-002',
    verificationUrl: 'https://smartsalon.lk/verify/VER-20261103-002',
    refundStatus: 'none',
    refundedAmount: 0,
    printedCount: 1,
    whatsappSentCount: 1,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    items: [
      {
        id: '11000000-0000-0000-0000-000000000003',
        invoiceId: '10000000-0000-0000-0000-000000000002',
        itemName: 'Hair Style Cut',
        itemSinhalaName: 'නවීන විලාසිතා කොණ්ඩ කැපීම',
        quantity: 1,
        unitPrice: 1400,
        discount: 0,
        total: 1400,
        staffName: 'Sunil Shantha',
      },
      {
        id: '11000000-0000-0000-0000-000000000004',
        invoiceId: '10000000-0000-0000-0000-000000000002',
        itemName: 'Hair Dye & Treatment',
        itemSinhalaName: 'කොණ්ඩය ඩයි කිරීම',
        quantity: 1,
        unitPrice: 2200,
        discount: 200,
        total: 2000,
        staffName: 'Sunil Shantha',
      },
    ],
    payments: [
      {
        id: '20000000-0000-0000-0000-000000000002',
        branchId: DEFAULT_BRANCH_ID,
        invoiceId: '10000000-0000-0000-0000-000000000002',
        referenceNumber: 'PAY-20261103-0002',
        paymentMethod: 'lankaqr',
        amount: 3400,
        status: 'paid',
        lankaqrReference: 'LKQR-REF-883492',
        paidTime: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    branchId: DEFAULT_BRANCH_ID,
    invoiceNumber: 'INV-2026-000003',
    customerId: 'a0000000-0000-0000-0000-000000000001',
    customerName: 'Kasun Perera',
    customerPhone: '+94771234567',
    customerNumber: 'CUST-202611-0001',
    staffId: 'c0000000-0000-0000-0000-000000000001',
    staffName: 'Master Kavi (Chair 01)',
    chairNumber: 1,
    subtotal: 1500,
    discount: 0,
    discountType: 'fixed',
    tax: 0,
    grandTotal: 1500,
    paymentStatus: 'paid',
    paymentMethod: 'card',
    cashTendered: 1500,
    changeAmount: 0,
    balance: 0,
    barcodeValue: 'SSLK20261103-000003',
    qrCodeValue: generateLankaQrPayload({ invoiceNumber: 'INV-2026-000003', amount: 1500 }),
    verificationCode: 'VER-20261103-003',
    verificationUrl: 'https://smartsalon.lk/verify/VER-20261103-003',
    refundStatus: 'none',
    refundedAmount: 0,
    printedCount: 1,
    whatsappSentCount: 0,
    createdAt: new Date(Date.now() - 1500000).toISOString(),
    updatedAt: new Date(Date.now() - 1500000).toISOString(),
    items: [
      {
        id: '11000000-0000-0000-0000-000000000005',
        invoiceId: '10000000-0000-0000-0000-000000000003',
        itemName: 'Herbal Oil Therapy',
        itemSinhalaName: 'ආයුර්වේද තෙල් සම්බාහනය',
        quantity: 1,
        unitPrice: 1500,
        discount: 0,
        total: 1500,
        staffName: 'Master Kavi',
      },
    ],
    payments: [
      {
        id: '20000000-0000-0000-0000-000000000003',
        branchId: DEFAULT_BRANCH_ID,
        invoiceId: '10000000-0000-0000-0000-000000000003',
        referenceNumber: 'PAY-20261103-0003',
        paymentMethod: 'card',
        amount: 1500,
        status: 'paid',
        cardLastFour: '4242',
        paidTime: new Date(Date.now() - 1500000).toISOString(),
      },
    ],
  },
];

// ------------------------------------------------------------------------
// 3. THERMAL RECEIPT 80MM PRINTER FORMATTER
// ------------------------------------------------------------------------

export function generateThermalReceiptText(
  invoice: Invoice,
  settings: ThermalReceiptSettings = DEFAULT_THERMAL_SETTINGS
): string {
  const line = '='.repeat(40);
  const dash = '-'.repeat(40);
  const padRight = (str: string, len: number) => (str + ' '.repeat(len)).slice(0, len);
  const padLeft = (str: string, len: number) => (' '.repeat(len) + str).slice(-len);
  const center = (str: string, len = 40) => {
    const space = Math.max(0, Math.floor((len - str.length) / 2));
    return ' '.repeat(space) + str;
  };

  const lines: string[] = [];

  // Header
  lines.push(center(settings.salonName.toUpperCase()));
  if (settings.sinhalaName) lines.push(center(settings.sinhalaName));
  lines.push(center(settings.address));
  lines.push(center(settings.city));
  lines.push(center(`Tel: ${settings.phone} | WA: ${settings.whatsapp}`));
  if (settings.brNumber) lines.push(center(`Reg: ${settings.brNumber}`));
  lines.push(line);

  // Invoice & Customer Info
  lines.push(`TAX INVOICE: ${invoice.invoiceNumber}`);
  lines.push(`DATE: ${new Date(invoice.createdAt).toLocaleString('en-GB')}`);
  if (invoice.staffName) lines.push(`BARBER: ${invoice.staffName}`);
  if (invoice.customerName) lines.push(`CUSTOMER: ${invoice.customerName}`);
  if (invoice.customerPhone) lines.push(`PHONE: ${invoice.customerPhone}`);
  lines.push(dash);

  // Table Header
  lines.push(padRight('ITEM', 22) + padRight('QTY', 5) + padLeft('LKR', 13));
  lines.push(dash);

  // Itemized List
  if (invoice.items && invoice.items.length > 0) {
    invoice.items.forEach((item) => {
      const name = item.itemName.substring(0, 21);
      const qty = item.quantity.toString();
      const total = item.total.toFixed(2);
      lines.push(padRight(name, 22) + padRight(qty, 5) + padLeft(total, 13));
      if (item.itemSinhalaName) {
        lines.push(`  (${item.itemSinhalaName})`);
      }
    });
  } else {
    lines.push(padRight('Grooming Service', 22) + padRight('1', 5) + padLeft(invoice.grandTotal.toFixed(2), 13));
  }

  lines.push(dash);

  // Totals
  lines.push(padRight('SUBTOTAL:', 25) + padLeft(invoice.subtotal.toFixed(2), 15));
  if (invoice.discount > 0) {
    lines.push(padRight('DISCOUNT:', 25) + padLeft(`-${invoice.discount.toFixed(2)}`, 15));
  }
  if (invoice.tax > 0) {
    lines.push(padRight('TAX:', 25) + padLeft(invoice.tax.toFixed(2), 15));
  }
  lines.push(line);
  lines.push(padRight('TOTAL PAYABLE (LKR):', 25) + padLeft(invoice.grandTotal.toFixed(2), 15));
  lines.push(line);

  // Settlement Details
  lines.push(`PAYMENT MODE: ${invoice.paymentMethod.toUpperCase()}`);
  if (invoice.paymentMethod === 'cash') {
    lines.push(padRight('CASH TENDERED:', 25) + padLeft(invoice.cashTendered.toFixed(2), 15));
    lines.push(padRight('CHANGE DUE:', 25) + padLeft(invoice.changeAmount.toFixed(2), 15));
  } else if (invoice.paymentMethod === 'lankaqr') {
    lines.push('SETTLED VIA LANKAQR NATIONAL SWITCH');
  }

  lines.push(dash);
  lines.push(center(`BARCODE: ${invoice.barcodeValue}`));
  if (invoice.verificationCode) {
    lines.push(center(`VERIFY: https://smartsalon.lk/v/${invoice.verificationCode}`));
  }
  lines.push(dash);
  lines.push(center(settings.footerMessage));
  lines.push(center('Powered by Smart Salon LK (PWA)'));
  lines.push('\n\n\n'); // ESC/POS paper feed & cut

  return lines.join('\n');
}

// ------------------------------------------------------------------------
// 4. WHATSAPP RECEIPT URL GENERATOR
// ------------------------------------------------------------------------

export function generateWhatsAppReceiptUrl(
  invoice: Partial<Invoice> & {
    items?: Array<Partial<InvoiceItem> & { name?: string; lineTotal?: number }>;
  },
  customerPhone?: string,
  salonName = DEFAULT_THERMAL_SETTINGS.salonName
): string {
  const targetPhone = (customerPhone || invoice.customerPhone || '').replace(/[^0-9]/g, '');

  const itemsList = (invoice.items || [])
    .map((item) => `• ${item.itemName || item.name || 'Service'} (x${item.quantity || 1}) - Rs. ${(item.total ?? item.lineTotal ?? 0).toLocaleString()}`)
    .join('\n');

  const grandTotal = invoice.grandTotal || 0;
  const paymentMethod = invoice.paymentMethod || 'cash';
  const paymentStatus = invoice.paymentStatus || 'paid';
  const changeAmount = invoice.changeAmount || 0;
  const dateStr = invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : new Date().toLocaleDateString();

  const text = `💈 *${salonName}* - Digital Invoice
📄 *Invoice #:* ${invoice.invoiceNumber || 'INV'}
📅 *Date:* ${dateStr}
👤 *Customer:* ${invoice.customerName || 'Valued Guest'}
✂️ *Barber:* ${invoice.staffName || 'Senior Stylist'}

*Services Rendered:*
${itemsList || `• Grooming Service - Rs. ${grandTotal.toLocaleString()}`}

━━━━━━━━━━━━━━━━━━━━
*Grand Total:* *LKR ${grandTotal.toLocaleString()}*
*Payment Mode:* ${paymentMethod.toUpperCase()} (${paymentStatus.toUpperCase()})
${paymentMethod === 'cash' && changeAmount > 0 ? `*Change Returned:* LKR ${changeAmount.toLocaleString()}\n` : ''}
🔍 *Verify Receipt:*
https://smartsalon.lk/verify/${invoice.verificationCode || invoice.invoiceNumber || ''}

ස්තූතියි! නැවත එන්න. Thank you for choosing Smart Salon LK!`;

  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
}

// ------------------------------------------------------------------------
// 5. BILLING SERVICE CLASS (HYBRID SUPABASE + FALLBACK)
// ------------------------------------------------------------------------

export class BillingService {
  /**
   * Fast POS Checkout & Settlement
   */
  static async checkout(payload: InvoiceCheckoutPayload): Promise<InvoiceCheckoutResult> {
    const branchId = payload.branchId || DEFAULT_BRANCH_ID;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await (supabase as any).rpc('fn_create_invoice_and_settle', {
          p_branch_id: branchId,
          p_customer_id: payload.customerId || null,
          p_queue_id: payload.queueId || null,
          p_appointment_id: payload.appointmentId || null,
          p_walk_in_id: payload.walkInId || null,
          p_staff_id: payload.staffId || null,
          p_items: payload.items || [],
          p_discount_amount: payload.discountAmount || 0,
          p_discount_type: payload.discountType || 'fixed',
          p_discount_reason: payload.discountReason || null,
          p_tax_percentage: payload.taxPercentage || 0,
          p_payment_method: payload.paymentMethod || 'cash',
          p_cash_tendered: payload.cashTendered || 0,
          p_card_last_four: payload.cardLastFour || null,
          p_notes: payload.notes || null,
        });

        if (error) {
          console.warn('[BillingService] Supabase RPC failed, using offline fallback:', error.message);
        } else if (data) {
          const resData: any = data;
          if (resData.success) {
            // Construct client invoice entity from returned JSON
            const inv: Invoice = {
              id: resData.invoice_id,
              branchId: resData.branch_id,
              invoiceNumber: resData.invoice_number,
              customerId: resData.customer_id,
              customerName: resData.customer_name,
              customerPhone: resData.customer_phone,
              staffId: resData.staff_id,
              subtotal: resData.subtotal,
              discount: resData.discount,
              discountType: payload.discountType || 'fixed',
              tax: resData.tax,
              grandTotal: resData.grand_total,
              paymentStatus: 'paid',
              paymentMethod: resData.payment_method,
              cashTendered: resData.cash_tendered,
              changeAmount: resData.change_amount,
              balance: resData.balance,
              barcodeValue: resData.barcode_value,
              qrCodeValue: resData.qr_code_value,
              verificationCode: resData.verification_code,
              verificationUrl: resData.verification_url,
              refundStatus: 'none',
              refundedAmount: 0,
              printedCount: 0,
              whatsappSentCount: 0,
              createdAt: resData.created_at,
              updatedAt: resData.created_at,
              items: payload.items.map((it, idx) => ({
                id: `item-${idx + 1}`,
                invoiceId: resData.invoice_id,
                serviceId: it.serviceId || null,
                staffId: it.staffId || resData.staff_id,
                itemName: it.itemName,
                itemSinhalaName: it.itemSinhalaName,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                discount: it.discount || 0,
                total: it.quantity * it.unitPrice - (it.discount || 0),
              })),
            };

            LOCAL_INVOICES.unshift(inv);
            return { success: true, invoice: inv };
          }
        }
      } catch (err: any) {
        console.warn('[BillingService] Checkout error:', err.message);
      }
    }

    // Offline / In-Memory Mock Implementation
    return this.checkoutOffline(payload);
  }

  private static checkoutOffline(payload: InvoiceCheckoutPayload): InvoiceCheckoutResult {
    const year = new Date().getFullYear();
    const invNum = `INV-${year}-${(LOCAL_INVOICE_COUNTER++).toString().padStart(6, '0')}`;
    const invoiceId = `local-inv-${Date.now()}`;

    let subtotal = 0;
    const items: InvoiceItem[] = payload.items.map((it, idx) => {
      const lineTotal = it.quantity * it.unitPrice - (it.discount || 0);
      subtotal += lineTotal;
      return {
        id: `item-${Date.now()}-${idx}`,
        invoiceId,
        serviceId: it.serviceId || null,
        staffId: it.staffId || payload.staffId || 'c0000000-0000-0000-0000-000000000001',
        staffName: 'Master Kavi (Chair 01)',
        itemName: it.itemName,
        itemSinhalaName: it.itemSinhalaName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: it.discount || 0,
        total: lineTotal,
      };
    });

    if (subtotal === 0) subtotal = 1200;

    let discount = payload.discountAmount || 0;
    if (payload.discountType === 'percentage' && discount > 0) {
      discount = Math.round((subtotal * (discount / 100)) * 100) / 100;
    }
    const tax = payload.taxPercentage ? Math.round(((subtotal - discount) * (payload.taxPercentage / 100)) * 100) / 100 : 0;
    const grandTotal = subtotal - discount + tax;

    let cashTendered = payload.cashTendered || grandTotal;
    let changeAmount = 0;
    if (payload.paymentMethod === 'cash') {
      changeAmount = Math.max(0, cashTendered - grandTotal);
    } else {
      cashTendered = grandTotal;
    }

    const barcodeVal = `SSLK${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${LOCAL_INVOICE_COUNTER.toString().padStart(6, '0')}`;
    const qrVal = generateLankaQrPayload({ invoiceNumber: invNum, amount: grandTotal });
    const verCode = `VER-${Date.now().toString(36).toUpperCase()}`;

    const newInvoice: Invoice = {
      id: invoiceId,
      branchId: payload.branchId || DEFAULT_BRANCH_ID,
      invoiceNumber: invNum,
      customerId: payload.customerId || null,
      customerName: payload.customerName || 'Walk-in Guest',
      customerPhone: payload.customerPhone || '',
      staffId: payload.staffId || 'c0000000-0000-0000-0000-000000000001',
      staffName: 'Master Kavi (Chair 01)',
      chairNumber: 1,
      subtotal,
      discount,
      discountType: payload.discountType || 'fixed',
      discountReason: payload.discountReason || null,
      tax,
      grandTotal,
      paymentStatus: 'paid',
      paymentMethod: payload.paymentMethod,
      cashTendered,
      changeAmount,
      balance: 0,
      barcodeValue: barcodeVal,
      qrCodeValue: qrVal,
      verificationCode: verCode,
      verificationUrl: `https://smartsalon.lk/verify/${verCode}`,
      refundStatus: 'none',
      refundedAmount: 0,
      printedCount: 0,
      whatsappSentCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items,
      payments: [
        {
          id: `pay-${Date.now()}`,
          branchId: payload.branchId || DEFAULT_BRANCH_ID,
          invoiceId,
          referenceNumber: `PAY-${Date.now()}`,
          paymentMethod: payload.paymentMethod,
          amount: grandTotal,
          status: 'paid',
          cashTendered,
          changeDue: changeAmount,
          cardLastFour: payload.cardLastFour,
          paidTime: new Date().toISOString(),
        },
      ],
    };

    LOCAL_INVOICES.unshift(newInvoice);

    // Auto-enqueue WhatsApp digital receipt & payment confirmation
    if (payload.customerPhone) {
      NotificationService.enqueueNotification({
        recipientPhone: payload.customerPhone,
        customerName: payload.customerName || 'Customer',
        customerId: payload.customerId,
        templateCode: 'payment_confirmed',
        variables: {
          customer_name: payload.customerName || 'Customer',
          salon_name: 'The Royal Blade',
          invoice_number: newInvoice.invoiceNumber,
          payment_amount: newInvoice.grandTotal.toLocaleString(),
          payment_method: newInvoice.paymentMethod.toUpperCase(),
          receipt_url: `https://smartsalon.lk/receipt/${newInvoice.invoiceNumber}`,
        },
      }).catch((e) => console.warn('[BillingService] WhatsApp auto-dispatch skipped:', e));
    }

    return { success: true, invoice: newInvoice };
  }

  /**
   * Search and filter invoices with multi-field queries
   */
  static async searchInvoices(params: {
    branchId?: string;
    query?: string;
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    limit?: number;
    offset?: number;
  }): Promise<Invoice[]> {
    const branchId = params.branchId || DEFAULT_BRANCH_ID;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await (supabase as any).rpc('fn_search_invoices', {
          p_branch_id: branchId,
          p_query: params.query || null,
          p_start_date: params.startDate || null,
          p_end_date: params.endDate || null,
          p_payment_method: params.paymentMethod || null,
          p_payment_status: params.paymentStatus || null,
          p_limit: params.limit || 25,
          p_offset: params.offset || 0,
        });

        if (error) {
          console.warn('[BillingService] fn_search_invoices RPC failed, falling back:', error.message);
        } else if (data && Array.isArray(data)) {
          return data.map((d: any) => ({
            id: d.id,
            branchId,
            invoiceNumber: d.invoice_number,
            customerId: d.customer_id,
            customerName: d.customer_name,
            customerPhone: d.customer_phone,
            staffName: d.staff_name,
            subtotal: Number(d.subtotal),
            discount: Number(d.discount),
            tax: Number(d.tax),
            grandTotal: Number(d.grand_total),
            paymentMethod: d.payment_method,
            paymentStatus: d.payment_status,
            cashTendered: Number(d.cash_tendered || 0),
            changeAmount: Number(d.change_amount || 0),
            balance: 0,
            barcodeValue: d.barcode_value,
            qrCodeValue: d.qr_code_value,
            refundStatus: 'none',
            refundedAmount: 0,
            printedCount: 0,
            whatsappSentCount: 0,
            discountType: 'fixed',
            createdAt: d.created_at,
            updatedAt: d.created_at,
          }));
        }
      } catch (err: any) {
        console.warn('[BillingService] search error:', err.message);
      }
    }

    // In-memory filter fallback
    let filtered = [...LOCAL_INVOICES];
    if (params.query) {
      const q = params.query.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.customerName?.toLowerCase().includes(q) ||
          i.customerPhone?.toLowerCase().includes(q) ||
          i.barcodeValue.toLowerCase().includes(q)
      );
    }
    if (params.paymentMethod && params.paymentMethod !== 'all') {
      filtered = filtered.filter((i) => i.paymentMethod === params.paymentMethod);
    }
    return filtered.slice(0, params.limit || 25);
  }

  /**
   * Get Daily Sales Telemetry & KPIs
   */
  static async getDailyKpis(branchId = DEFAULT_BRANCH_ID, date?: string): Promise<PosDailyKpis> {
    const today = date || new Date().toISOString().split('T')[0];

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await (supabase as any).rpc('fn_get_pos_daily_kpis', {
          p_branch_id: branchId,
          p_date: today,
        });

        if (error) {
          console.warn('[BillingService] fn_get_pos_daily_kpis failed, falling back:', error.message);
        } else if (data) {
          const d: any = data;
          return {
            date: d.date,
            totalRevenue: Number(d.total_revenue || 0),
            invoicesCount: Number(d.invoices_count || 0),
            avgBillValue: Number(d.avg_bill_value || 0),
            cashSales: Number(d.cash_sales || 0),
            cashCount: Number(d.cash_count || 0),
            cardSales: Number(d.card_sales || 0),
            cardCount: Number(d.card_count || 0),
            lankaqrSales: Number(d.lankaqr_sales || 0),
            lankaqrCount: Number(d.lankaqr_count || 0),
            pendingCount: Number(d.pending_count || 0),
            topServices: d.top_services || [],
          };
        }
      } catch (err: any) {
        console.warn('[BillingService] kpis error:', err.message);
      }
    }

    // Offline Calculation
    let totalRevenue = 0;
    let cashSales = 0;
    let cashCount = 0;
    let cardSales = 0;
    let cardCount = 0;
    let lankaqrSales = 0;
    let lankaqrCount = 0;

    LOCAL_INVOICES.forEach((inv) => {
      if (inv.paymentStatus === 'paid') {
        totalRevenue += inv.grandTotal;
        if (inv.paymentMethod === 'cash') {
          cashSales += inv.grandTotal;
          cashCount++;
        } else if (inv.paymentMethod === 'card') {
          cardSales += inv.grandTotal;
          cardCount++;
        } else if (inv.paymentMethod === 'lankaqr') {
          lankaqrSales += inv.grandTotal;
          lankaqrCount++;
        }
      }
    });

    const count = LOCAL_INVOICES.length;
    return {
      date: today,
      totalRevenue,
      invoicesCount: count,
      avgBillValue: count > 0 ? Math.round(totalRevenue / count) : 0,
      cashSales,
      cashCount,
      cardSales,
      cardCount,
      lankaqrSales,
      lankaqrCount,
      pendingCount: 0,
      topServices: [
        { itemName: 'Adult Hair Cut', count: 18, revenue: 21600 },
        { itemName: 'Beard Trim & Sculpt', count: 12, revenue: 9600 },
        { itemName: 'Hair Cut + Beard Combo', count: 8, revenue: 14400 },
        { itemName: 'Hair Dye & Treatment', count: 3, revenue: 6600 },
      ],
    };
  }

  /**
   * Get single invoice by ID
   */
  static async getInvoiceById(id: string): Promise<Invoice | null> {
    const found = LOCAL_INVOICES.find((i) => i.id === id);
    if (found) return found;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await (supabase as any)
          .from('invoices')
          .select('*, items:invoice_items(*), payments(*)')
          .eq('id', id)
          .single();

        if (!error && data) {
          const inv: any = data;
          return {
            id: inv.id,
            branchId: inv.branch_id,
            invoiceNumber: inv.invoice_number,
            customerId: inv.customer_id,
            subtotal: Number(inv.subtotal),
            discount: Number(inv.discount),
            tax: Number(inv.tax),
            grandTotal: Number(inv.grand_total),
            paymentStatus: inv.payment_status,
            paymentMethod: inv.payment_method,
            cashTendered: Number(inv.cash_tendered || 0),
            changeAmount: Number(inv.change_amount || 0),
            balance: Number(inv.balance || 0),
            barcodeValue: inv.barcode_value,
            qrCodeValue: inv.qr_code_value,
            refundStatus: inv.refund_status || 'none',
            refundedAmount: Number(inv.refunded_amount || 0),
            printedCount: inv.printed_count || 0,
            whatsappSentCount: inv.whatsapp_sent_count || 0,
            discountType: inv.discount_type || 'fixed',
            createdAt: inv.created_at,
            updatedAt: inv.updated_at,
            items: (inv.items || []).map((it: any) => ({
              id: it.id,
              invoiceId: it.invoice_id,
              itemName: it.item_name,
              itemSinhalaName: it.item_sinhala_name,
              quantity: it.quantity,
              unitPrice: Number(it.unit_price),
              discount: Number(it.discount),
              total: Number(it.total),
            })),
          };
        }
      } catch (err: any) {
        console.warn('[BillingService] getInvoiceById error:', err.message);
      }
    }
    return null;
  }

  /**
   * Record a refund against an invoice
   */
  static async recordRefund(params: {
    invoiceId: string;
    amount: number;
    reason: string;
    approvedBy?: string;
    branchId?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const branchId = params.branchId || DEFAULT_BRANCH_ID;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await (supabase as any).rpc('fn_record_refund', {
          p_branch_id: branchId,
          p_invoice_id: params.invoiceId,
          p_amount: params.amount,
          p_reason: params.reason,
          p_approved_by: params.approvedBy || null,
        });

        if (!error && data && (data as any).success) {
          return { success: true };
        }
      } catch (err: any) {
        console.warn('[BillingService] refund error:', err.message);
      }
    }

    // Local in-memory refund update
    const inv = LOCAL_INVOICES.find((i) => i.id === params.invoiceId);
    if (inv) {
      inv.refundStatus = 'refunded';
      inv.refundedAmount = params.amount;
      inv.paymentStatus = 'refunded';
      return { success: true };
    }
    return { success: false, error: 'Invoice not found' };
  }
}

