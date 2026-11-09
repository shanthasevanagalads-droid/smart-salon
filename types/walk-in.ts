export interface WalkInCustomer {
  id: string;
  branchId: string;
  walkInNumber: string;
  customerId: string | null;
  name: string;
  mobile: string;
  whatsappNumber: string | null;
  serviceId?: string | null;
  serviceName?: string;
  servicePriceLkr?: number;
  staffId?: string | null;
  staffName?: string;
  chairNumber?: number;
  queueId?: string | null;
  queueNumber?: number;
  ticketCode?: string;
  notes?: string | null;
  createdAt: string;
}

export interface CustomerSearchResult {
  id: string;
  customerNumber: string;
  name: string;
  mobile: string;
  whatsapp: string | null;
  preferredBarberId: string | null;
  preferredBarberName: string | null;
  preferredChair: number | null;
  totalVisits: number;
  totalSpending: number;
  lastVisitAt: string;
  daysSinceLastVisit: number;
  isVip: boolean;
  notes: string | null;
  status: string;
}

export interface QuickRegisterWalkInPayload {
  branchId?: string;
  mobile: string;
  name?: string;
  whatsapp?: string;
  serviceId?: string;
  staffId?: string;
  priority?: 'normal' | 'priority' | 'vip' | 'emergency';
  notes?: string;
  directBilling?: boolean;
}

export interface QuickRegisterWalkInResponse {
  success: boolean;
  isReturning: boolean;
  customer: {
    id: string;
    customerNumber: string;
    name: string;
    mobile: string;
    whatsapp: string | null;
    totalVisits: number;
    isVip: boolean;
  };
  walkIn: {
    id: string;
    walkInNumber: string;
  };
  queueTicket: {
    queueId: string;
    queueNumber: number;
    ticketCode: string;
    estimatedWaitingTime: number;
    status: string;
    priority: string;
    serviceName: string;
    servicePrice: number;
    barberName: string;
    chairNumber: number;
  };
  message?: string;
}

export interface CustomerMergePayload {
  primaryId: string;
  secondaryId: string;
  reason?: string;
}

export interface CustomerMergeResult {
  success: boolean;
  primaryCustomerNumber: string;
  secondaryCustomerNumber: string;
  migratedAppointments: number;
  migratedQueueTickets: number;
  migratedWalkIns: number;
  migratedInvoices: number;
  message?: string;
}

export interface WalkInReportSummary {
  todayTotalWalkIns: number;
  todayRepeatWalkIns: number;
  todayServedCount: number;
  todayRevenueLkr: number;
  repeatCustomerRatePct: number;
  conversionRatePct: number;
  sevenDayTrend: Array<{ date: string; count: number }>;
}

