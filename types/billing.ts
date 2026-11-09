// ========================================================================
// SMART SALON LK - DOMAIN TYPES: BILLING & POINT OF SALE (POS) MODULE
// ========================================================================

export type PaymentMethod = 'cash' | 'card' | 'lankaqr' | 'online' | 'wallet';

export type PaymentStatus = 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'cancelled';

export type RefundStatus = 'none' | 'requested' | 'approved' | 'refunded' | 'rejected';

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  serviceId?: string | null;
  staffId?: string | null;
  staffName?: string;
  itemName: string;
  name?: string;
  itemSinhalaName?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  lineTotal?: number;
  notes?: string | null;
}

export interface Payment {
  id: string;
  branchId: string;
  invoiceId: string;
  referenceNumber: string;
  paymentMethod: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  cashTendered?: number;
  changeDue?: number;
  cardLastFour?: string;
  cardAuthCode?: string;
  lankaqrReference?: string;
  paidTime: string;
  transactionMetadata?: Record<string, any>;
}

export interface Invoice {
  id: string;
  branchId: string;
  invoiceNumber: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerNumber?: string;
  walkInId?: string | null;
  walkInNumber?: string;
  appointmentId?: string | null;
  appointmentNumber?: string;
  queueId?: string | null;
  queueTicketCode?: string;
  staffId?: string | null;
  staffName?: string;
  chairNumber?: number;
  subtotal: number;
  discount: number;
  discountType: 'fixed' | 'percentage';
  discountPercentage?: number;
  discountReason?: string | null;
  tax: number;
  grandTotal: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  cashTendered: number;
  changeAmount: number;
  balance: number;
  barcodeValue: string;
  qrCodeValue: string;
  verificationCode?: string;
  verificationUrl?: string;
  refundStatus: RefundStatus;
  refundedAmount: number;
  refundReason?: string | null;
  printedCount: number;
  lastPrintedAt?: string | null;
  whatsappSentCount: number;
  lastWhatsappSentAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: InvoiceItem[];
  payments?: Payment[];
}

export interface InvoiceCheckoutPayload {
  branchId?: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  queueId?: string | null;
  appointmentId?: string | null;
  walkInId?: string | null;
  staffId?: string | null;
  items: {
    serviceId?: string;
    staffId?: string;
    itemName: string;
    itemSinhalaName?: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    notes?: string;
  }[];
  discountAmount?: number;
  discountType?: 'fixed' | 'percentage';
  discountReason?: string;
  taxPercentage?: number;
  paymentMethod: PaymentMethod;
  cashTendered?: number;
  cardLastFour?: string;
  notes?: string;
}

export interface InvoiceCheckoutResult {
  success: boolean;
  invoice?: Invoice;
  error?: string;
}

export interface PosDailyKpis {
  date: string;
  totalRevenue: number;
  invoicesCount: number;
  avgBillValue: number;
  cashSales: number;
  cashCount: number;
  cardSales: number;
  cardCount: number;
  lankaqrSales: number;
  lankaqrCount: number;
  pendingCount: number;
  topServices: {
    itemName: string;
    count: number;
    revenue: number;
  }[];
}

export interface ThermalReceiptSettings {
  salonName: string;
  sinhalaName: string;
  address: string;
  city: string;
  phone: string;
  whatsapp: string;
  brNumber?: string;
  footerMessage: string;
  currency: string;
}

