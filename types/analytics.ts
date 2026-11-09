// ========================================================================
// SMART SALON LK - DOMAIN TYPES: REPORTING & BUSINESS INTELLIGENCE (BI)
// ========================================================================

export type ReportDateRange = 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'year' | 'custom';

export interface BiPaymentMethodBreakdown {
  paymentMethod: string;
  transactionCount: number;
  totalAmount: number;
  percentage: number;
}

export interface BiBarberActivity {
  staffId: string;
  barberName: string;
  chairNumber: number;
  availability: 'available' | 'busy' | 'break' | 'off';
  activeTicket?: string | null;
  activeCustomer?: string | null;
  activeService?: string | null;
  servicePrice?: number;
}

export interface BiDashboardOverview {
  date: string;
  todayRevenue: number;
  yesterdayRevenue: number;
  revenueGrowthPct: number;
  todayInvoices: number;
  avgInvoiceValue: number;
  todayCustomers: number;
  walkInsCount: number;
  appointmentsCount: number;
  queueSummary: {
    waiting: number;
    inService: number;
    completed: number;
    avgWaitMinutes: number;
  };
  pendingPayments: {
    count: number;
    amount: number;
  };
  paymentMethods: BiPaymentMethodBreakdown[];
  barberActivity: BiBarberActivity[];
}

export interface BiDailyFinancialItem {
  reportDate: string;
  totalInvoices: number;
  grossSales: number;
  totalDiscounts: number;
  netRevenue: number;
  avgInvoiceValue: number;
  cashRevenue: number;
  lankaqrRevenue: number;
  cardRevenue: number;
}

export interface BiPaymentMethodSummary {
  paymentMethod: string;
  transactions: number;
  totalAmount: number;
  sharePct: number;
}

export interface BiFinancialReport {
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalInvoices: number;
  totalDiscounts: number;
  avgOrderValue: number;
  dailyTrend: BiDailyFinancialItem[];
  methodSummary: BiPaymentMethodSummary[];
}

export interface BiVipCustomer {
  id: string;
  customerNumber: string;
  name: string;
  mobile: string;
  totalVisits: number;
  totalSpending: number;
  isVip: boolean;
  lastVisitAt: string;
  preferredBarber?: string | null;
}

export interface BiCustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  retentionRatePct: number;
  topSpenders: BiVipCustomer[];
}

export interface BiBarberPerformanceItem {
  staffId: string;
  barberName: string;
  chairNumber: number;
  commissionPercentage: number;
  servicesCompleted: number;
  revenueGenerated: number;
  commissionEarned: number;
  avgDurationMinutes: number;
  uniqueClients: number;
}

export interface BiBarberPerformanceReport {
  startDate: string;
  endDate: string;
  barbers: BiBarberPerformanceItem[];
}

export interface BiHourlyTrafficItem {
  hourNum: number;
  hourLabel: string;
  customerCount: number;
  walkIns: number;
  appointments: number;
  avgWaitMinutes: number;
}

export interface BiQueueTrafficReport {
  startDate: string;
  endDate: string;
  walkInTotal: number;
  appointmentTotal: number;
  walkInRatioPct: number;
  hourlyDistribution: BiHourlyTrafficItem[];
}

export interface BiServiceItemReport {
  serviceId: string;
  serviceName: string;
  serviceSinhalaName?: string;
  category: string;
  totalExecuted: number;
  unitsSold: number;
  totalRevenue: number;
  avgPrice: number;
  avgDurationMinutes: number;
}

