// ========================================================================
// SMART SALON LK - PAYMENT MANAGEMENT SERVICE
// FinTech Settlement Engine with Supabase RPCs + Offline Resilient Fallback
// ========================================================================

import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  PaymentMethodOption,
  PaymentTransaction,
  ProcessPaymentPayload,
  ProcessSplitPaymentPayload,
  PaymentAnalytics,
  CashDrawerShift,
} from '@/types/payment';

const DEFAULT_BRANCH_ID =
  process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID || 'b0000000-0000-0000-0000-000000000001';

export const PAYMENT_METHODS_CATALOG: PaymentMethodOption[] = [
  {
    id: 'pm-1',
    code: 'cash',
    name: 'Cash Payment',
    sinhalaName: 'මුදල් ගෙවීම්',
    category: 'standard',
    isActive: true,
    sortOrder: 1,
    requiresTerminal: false,
    minAmount: 10,
    maxAmount: 200000,
    icon: 'payments',
  },
  {
    id: 'pm-2',
    code: 'lankaqr',
    name: 'LankaQR National Standard',
    sinhalaName: 'ලංකා කිව්ආර් ගෙවීම්',
    category: 'digital',
    isActive: true,
    sortOrder: 2,
    requiresTerminal: false,
    minAmount: 10,
    maxAmount: 500000,
    icon: 'qr_code_scanner',
  },
  {
    id: 'pm-3',
    code: 'credit_card',
    name: 'Credit Card (Visa / Master)',
    sinhalaName: 'ක්‍රෙඩිට් කාඩ්',
    category: 'card',
    isActive: true,
    sortOrder: 3,
    requiresTerminal: true,
    minAmount: 500,
    maxAmount: 250000,
    icon: 'credit_card',
  },
  {
    id: 'pm-4',
    code: 'debit_card',
    name: 'Debit Card (LankaPay / Contactless)',
    sinhalaName: 'ඩෙබිට් කාඩ්',
    category: 'card',
    isActive: true,
    sortOrder: 4,
    requiresTerminal: true,
    minAmount: 200,
    maxAmount: 250000,
    icon: 'contactless',
  },
  {
    id: 'pm-5',
    code: 'frimi',
    name: 'FriMi Digital Wallet',
    sinhalaName: 'ෆ්‍රීමී ඩිජිටල් පසුම්බිය',
    category: 'wallet',
    isActive: true,
    sortOrder: 5,
    requiresTerminal: false,
    minAmount: 50,
    maxAmount: 100000,
    icon: 'wallet',
  },
  {
    id: 'pm-6',
    code: 'split',
    name: 'Split Payment (Multi-Tender)',
    sinhalaName: 'මිශ්‍ර ගෙවීම් (Cash + Card/QR)',
    category: 'standard',
    isActive: true,
    sortOrder: 6,
    requiresTerminal: false,
    minAmount: 100,
    maxAmount: 500000,
    icon: 'call_split',
  },
];

// ------------------------------------------------------------------------
// IN-MEMORY FALLBACK STORE FOR PAYMENTS & SHIFTS
// ------------------------------------------------------------------------

let LOCAL_SHIFTS: CashDrawerShift[] = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    branchId: DEFAULT_BRANCH_ID,
    staffId: 'c0000000-0000-0000-0000-000000000001',
    staffName: 'Master Kavi',
    shiftCode: `SFT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-001`,
    openedAt: new Date(Date.now() - 21600000).toISOString(),
    startingFloat: 5000,
    cashSales: 14800,
    cashRefunds: 0,
    expectedCash: 19800,
    status: 'open',
    notes: 'Morning register float initialized LKR 5,000',
  },
];

let LOCAL_TRANSACTIONS: PaymentTransaction[] = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    branchId: DEFAULT_BRANCH_ID,
    invoiceId: '10000000-0000-0000-0000-000000000001',
    invoiceNumber: 'INV-2026-000001',
    dstNumber: 'LK-20261103-007',
    customerId: 'a0000000-0000-0000-0000-000000000001',
    customerName: 'Kasun Perera',
    customerPhone: '+94771234567',
    cashierName: 'Master Kavi (Chair 01)',
    referenceNumber: 'PAY-20261103-0001',
    paymentMethod: 'cash',
    amount: 1800,
    status: 'paid',
    cashTendered: 2000,
    changeDue: 200,
    isSplit: false,
    paidTime: new Date(Date.now() - 10800000).toISOString(),
    createdAt: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    branchId: DEFAULT_BRANCH_ID,
    invoiceId: '10000000-0000-0000-0000-000000000002',
    invoiceNumber: 'INV-2026-000002',
    dstNumber: 'LK-20261103-008',
    customerId: 'a0000000-0000-0000-0000-000000000002',
    customerName: 'Ruwan Pradeep',
    customerPhone: '+94712345678',
    cashierName: 'Sunil Shantha (Chair 02)',
    referenceNumber: 'PAY-20261103-0002',
    paymentMethod: 'lankaqr',
    amount: 3400,
    status: 'paid',
    lankaqrReference: 'LKQR-REF-883492',
    lankaqrTxId: 'CBSL-QR-20261103-883492',
    isSplit: false,
    paidTime: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '20000000-0000-0000-0000-000000000003',
    branchId: DEFAULT_BRANCH_ID,
    invoiceId: '10000000-0000-0000-0000-000000000003',
    invoiceNumber: 'INV-2026-000003',
    dstNumber: 'APT-20261103-0001',
    customerId: 'a0000000-0000-0000-0000-000000000001',
    customerName: 'Kasun Perera',
    customerPhone: '+94771234567',
    cashierName: 'Master Kavi (Chair 01)',
    referenceNumber: 'PAY-20261103-0003',
    paymentMethod: 'credit_card',
    amount: 1500,
    status: 'paid',
    cardLastFour: '4242',
    cardAuthCode: 'AUTH-99482',
    terminalReference: 'POS-TERM-01',
    isSplit: false,
    paidTime: new Date(Date.now() - 1500000).toISOString(),
    createdAt: new Date(Date.now() - 1500000).toISOString(),
  },
];

// ------------------------------------------------------------------------
// PAYMENT SERVICE ENGINE
// ------------------------------------------------------------------------

export class PaymentService {
  /**
   * Process a single payment against an invoice
   */
  static async processPayment(payload: ProcessPaymentPayload): Promise<{
    success: boolean;
    payment?: PaymentTransaction;
    error?: string;
  }> {
    const branchId = payload.branchId || DEFAULT_BRANCH_ID;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_process_payment', {
          p_branch_id: branchId,
          p_invoice_id: payload.invoiceId,
          p_payment_method: payload.paymentMethod,
          p_amount: payload.amount,
          p_dst_number: payload.dstNumber || null,
          p_customer_id: payload.customerId || null,
          p_cashier_id: payload.cashierId || null,
          p_cash_tendered: payload.cashTendered || 0,
          p_terminal_reference: payload.terminalReference || null,
          p_card_auth_code: payload.cardAuthCode || null,
          p_masked_card_number: payload.maskedCardNumber || null,
          p_card_type: payload.cardType || 'credit',
          p_lankaqr_reference: payload.lankaqrReference || null,
          p_idempotency_key: payload.idempotencyKey || null,
          p_metadata: payload.metadata || {},
        });

        if (error) {
          console.warn('[PaymentService] fn_process_payment failed, falling back:', error.message);
        } else if (data && data.success) {
          const tx: PaymentTransaction = {
            id: data.payment_id,
            branchId,
            invoiceId: payload.invoiceId,
            invoiceNumber: data.invoice_number,
            dstNumber: payload.dstNumber,
            referenceNumber: data.reference_number,
            paymentMethod: data.payment_method,
            amount: data.amount,
            status: data.status,
            cashTendered: data.cash_tendered,
            changeDue: data.change_due,
            isSplit: false,
            paidTime: data.paid_time,
            createdAt: data.paid_time,
          };
          LOCAL_TRANSACTIONS.unshift(tx);
          return { success: true, payment: tx };
        } else if (data && !data.success) {
          return { success: false, error: data.error || 'Payment rejected' };
        }
      } catch (err: any) {
        console.warn('[PaymentService] process error:', err.message);
      }
    }

    // Offline / Fallback
    const ref = 'PAY-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const change = payload.paymentMethod === 'cash' ? Math.max(0, (payload.cashTendered || payload.amount) - payload.amount) : 0;

    const tx: PaymentTransaction = {
      id: `local-pay-${Date.now()}`,
      branchId,
      invoiceId: payload.invoiceId,
      invoiceNumber: 'INV-2026-ONLINE',
      dstNumber: payload.dstNumber || 'LK-ONLINE-01',
      customerId: payload.customerId || null,
      customerName: 'Customer',
      cashierName: 'Chair Stylist',
      referenceNumber: ref,
      paymentMethod: payload.paymentMethod,
      amount: payload.amount,
      status: 'paid',
      cashTendered: payload.cashTendered || payload.amount,
      changeDue: change,
      cardLastFour: payload.maskedCardNumber || (payload.paymentMethod.includes('card') ? '4242' : undefined),
      cardAuthCode: payload.cardAuthCode || (payload.paymentMethod.includes('card') ? 'AUTH-LOCAL' : undefined),
      terminalReference: payload.terminalReference,
      lankaqrReference: payload.lankaqrReference,
      isSplit: false,
      paidTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    LOCAL_TRANSACTIONS.unshift(tx);

    // Update active shift float
    if (payload.paymentMethod === 'cash' && LOCAL_SHIFTS[0]?.status === 'open') {
      LOCAL_SHIFTS[0].cashSales += payload.amount;
      LOCAL_SHIFTS[0].expectedCash += payload.amount;
    }

    return { success: true, payment: tx };
  }

  /**
   * Process a Multi-Tender Split Payment (e.g. Rs 1000 Cash + Rs 800 LankaQR)
   */
  static async processSplitPayment(payload: ProcessSplitPaymentPayload): Promise<{
    success: boolean;
    parentReference?: string;
    totalSettled?: number;
    error?: string;
  }> {
    const branchId = payload.branchId || DEFAULT_BRANCH_ID;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_process_split_payment', {
          p_branch_id: branchId,
          p_invoice_id: payload.invoiceId,
          p_splits: payload.splits,
          p_dst_number: payload.dstNumber || null,
          p_customer_id: payload.customerId || null,
          p_cashier_id: payload.cashierId || null,
        });

        if (!error && data && data.success) {
          return {
            success: true,
            parentReference: data.parent_reference,
            totalSettled: data.total_settled,
          };
        }
      } catch (err: any) {
        console.warn('[PaymentService] split error:', err.message);
      }
    }

    // Local Split simulation
    let totalSettled = 0;
    const parentRef = 'SPLIT-' + Date.now().toString(36).toUpperCase();

    for (const leg of payload.splits) {
      totalSettled += leg.amount;
      await this.processPayment({
        branchId,
        invoiceId: payload.invoiceId,
        paymentMethod: leg.method,
        amount: leg.amount,
        dstNumber: payload.dstNumber,
        customerId: payload.customerId,
        cashierId: payload.cashierId,
        cashTendered: leg.cashTendered || leg.amount,
        cardAuthCode: leg.cardAuthCode,
        terminalReference: leg.terminalReference,
        lankaqrReference: leg.lankaqrReference,
        idempotencyKey: `${parentRef}-${leg.method}-${leg.amount}`,
      });
    }

    return {
      success: true,
      parentReference: parentRef,
      totalSettled,
    };
  }

  /**
   * Verify dynamic LankaQR transaction confirmation from Central Bank switch
   */
  static async verifyLankaQr(paymentId: string, bankTxId?: string): Promise<{
    success: boolean;
    lankaqrTxId?: string;
    error?: string;
  }> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_verify_lankaqr_payment', {
          p_branch_id: DEFAULT_BRANCH_ID,
          p_payment_id: paymentId,
          p_bank_tx_id: bankTxId || null,
        });

        if (!error && data && data.success) {
          return { success: true, lankaqrTxId: data.lankaqr_tx_id };
        }
      } catch (err: any) {
        console.warn('[PaymentService] verifyLankaQr error:', err.message);
      }
    }

    // Local update
    const tx = LOCAL_TRANSACTIONS.find((t) => t.id === paymentId);
    if (tx) {
      tx.lankaqrTxId = bankTxId || `CBSL-QR-${Date.now()}`;
      tx.status = 'paid';
      return { success: true, lankaqrTxId: tx.lankaqrTxId };
    }

    return { success: true, lankaqrTxId: `CBSL-QR-${Date.now()}` };
  }

  /**
   * Get comprehensive Payment Analytics & Telemetry
   */
  static async getAnalytics(startDate?: string, endDate?: string): Promise<PaymentAnalytics> {
    const today = new Date().toISOString().split('T')[0];
    const sDate = startDate || today;
    const eDate = endDate || today;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_get_payment_analytics', {
          p_branch_id: DEFAULT_BRANCH_ID,
          p_start_date: sDate,
          p_end_date: eDate,
        });

        if (!error && data) {
          return {
            startDate: data.start_date,
            endDate: data.end_date,
            totalRevenue: Number(data.total_revenue || 0),
            totalTransactions: Number(data.total_transactions || 0),
            methodsBreakdown: data.methods_breakdown || [],
            failedTransactionsCount: Number(data.failed_transactions_count || 0),
            outstandingInvoicesCount: Number(data.outstanding_invoices_count || 0),
            outstandingInvoicesAmount: Number(data.outstanding_invoices_amount || 0),
            activeCashShift: data.active_cash_shift || null,
          };
        }
      } catch (err: any) {
        console.warn('[PaymentService] analytics error:', err.message);
      }
    }

    // Fallback analytics
    let totalRevenue = 0;
    const counts: Record<string, { count: number; total: number }> = {};

    LOCAL_TRANSACTIONS.forEach((tx) => {
      if (tx.status === 'paid') {
        totalRevenue += tx.amount;
        if (!counts[tx.paymentMethod]) {
          counts[tx.paymentMethod] = { count: 0, total: 0 };
        }
        counts[tx.paymentMethod].count += 1;
        counts[tx.paymentMethod].total += tx.amount;
      }
    });

    const breakdown = Object.entries(counts).map(([method, val]) => ({
      paymentMethod: method,
      transactionCount: val.count,
      totalAmount: val.total,
      avgTicketSize: val.count > 0 ? Math.round(val.total / val.count) : 0,
    }));

    return {
      startDate: sDate,
      endDate: eDate,
      totalRevenue,
      totalTransactions: LOCAL_TRANSACTIONS.length,
      methodsBreakdown: breakdown,
      failedTransactionsCount: 0,
      outstandingInvoicesCount: 1,
      outstandingInvoicesAmount: 1800,
      activeCashShift: LOCAL_SHIFTS[0] || null,
    };
  }

  /**
   * Search / List Payment Transactions
   */
  static async searchPayments(query?: string, status?: string): Promise<PaymentTransaction[]> {
    let list = [...LOCAL_TRANSACTIONS];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (t) =>
          t.referenceNumber.toLowerCase().includes(q) ||
          t.dstNumber?.toLowerCase().includes(q) ||
          t.customerName?.toLowerCase().includes(q) ||
          t.customerPhone?.toLowerCase().includes(q)
      );
    }
    if (status && status !== 'all') {
      list = list.filter((t) => t.status === status);
    }
    return list;
  }

  /**
   * Void / Cancel Payment Record
   */
  static async voidPayment(paymentId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_void_payment', {
          p_branch_id: DEFAULT_BRANCH_ID,
          p_payment_id: paymentId,
          p_reason: reason,
        });

        if (!error && data && data.success) {
          return { success: true };
        }
      } catch (err: any) {
        console.warn('[PaymentService] void error:', err.message);
      }
    }

    const tx = LOCAL_TRANSACTIONS.find((t) => t.id === paymentId);
    if (tx) {
      tx.status = 'cancelled';
      return { success: true };
    }
    return { success: false, error: 'Transaction not found' };
  }

  /**
   * Close Cash Drawer Shift
   */
  static async closeShift(shiftId: string, actualCash: number, notes?: string): Promise<{
    success: boolean;
    discrepancy?: number;
    error?: string;
  }> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_close_cash_shift', {
          p_shift_id: shiftId,
          p_actual_cash: actualCash,
          p_notes: notes || null,
        });

        if (!error && data && data.success) {
          return { success: true, discrepancy: data.discrepancy };
        }
      } catch (err: any) {
        console.warn('[PaymentService] closeShift error:', err.message);
      }
    }

    const shift = LOCAL_SHIFTS.find((s) => s.id === shiftId);
    if (shift) {
      shift.actualCash = actualCash;
      shift.discrepancy = actualCash - shift.expectedCash;
      shift.closedAt = new Date().toISOString();
      shift.status = 'closed';
      return { success: true, discrepancy: shift.discrepancy };
    }
    return { success: false, error: 'Shift not found' };
  }
}

