// ========================================================================
// SMART SALON LK - DOMAIN TYPES: PAYMENT MANAGEMENT ENGINE
// ========================================================================

export type PaymentMethodCode =
  | 'cash'
  | 'lankaqr'
  | 'credit_card'
  | 'debit_card'
  | 'frimi'
  | 'genie'
  | 'split';

export type PaymentStatusCode =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export interface PaymentMethodOption {
  id: string;
  code: PaymentMethodCode;
  name: string;
  sinhalaName: string;
  category: 'standard' | 'digital' | 'card' | 'wallet';
  isActive: boolean;
  sortOrder: number;
  requiresTerminal: boolean;
  minAmount: number;
  maxAmount: number;
  icon: string;
}

export interface PaymentTransaction {
  id: string;
  branchId: string;
  invoiceId: string;
  invoiceNumber?: string;
  dstNumber?: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  cashierId?: string | null;
  cashierName?: string;
  referenceNumber: string;
  paymentMethod: PaymentMethodCode;
  amount: number;
  status: PaymentStatusCode;
  cashTendered?: number;
  changeDue?: number;
  cardLastFour?: string;
  cardAuthCode?: string;
  cardType?: 'credit' | 'debit';
  terminalReference?: string;
  lankaqrReference?: string;
  lankaqrTxId?: string;
  lankaqrBankResponse?: any;
  isSplit: boolean;
  splitParentId?: string | null;
  paidTime: string;
  createdAt: string;
}

export interface ProcessPaymentPayload {
  branchId?: string;
  invoiceId: string;
  paymentMethod: PaymentMethodCode;
  amount: number;
  dstNumber?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  cashierId?: string;
  cashTendered?: number;
  terminalReference?: string;
  cardAuthCode?: string;
  maskedCardNumber?: string;
  cardType?: 'credit' | 'debit';
  lankaqrReference?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export interface SplitPaymentLeg {
  method: PaymentMethodCode;
  amount: number;
  cashTendered?: number;
  cardLastFour?: string;
  cardAuthCode?: string;
  terminalReference?: string;
  lankaqrReference?: string;
}

export interface ProcessSplitPaymentPayload {
  branchId?: string;
  invoiceId: string;
  splits: SplitPaymentLeg[];
  dstNumber?: string;
  customerId?: string;
  cashierId?: string;
}

export interface CashDrawerShift {
  id: string;
  branchId: string;
  staffId?: string;
  staffName?: string;
  shiftCode: string;
  openedAt: string;
  closedAt?: string | null;
  startingFloat: number;
  cashSales: number;
  cashRefunds: number;
  expectedCash: number;
  actualCash?: number | null;
  discrepancy?: number | null;
  status: 'open' | 'closed' | 'audited';
  notes?: string | null;
}

export interface PaymentMethodBreakdown {
  paymentMethod: string;
  transactionCount: number;
  totalAmount: number;
  avgTicketSize: number;
}

export interface PaymentAnalytics {
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalTransactions: number;
  methodsBreakdown: PaymentMethodBreakdown[];
  failedTransactionsCount: number;
  outstandingInvoicesCount: number;
  outstandingInvoicesAmount: number;
  activeCashShift?: CashDrawerShift | null;
}

