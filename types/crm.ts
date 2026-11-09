import { AppLanguage } from '@/types/salon';

export type CustomerStatus = 'active' | 'inactive' | 'blocked';

export interface CustomerSummary {
  id: string;
  customerNumber: string;
  name: string;
  mobile: string;
  whatsapp: string;
  status: CustomerStatus;
  totalVisits: number;
  totalSpending: number;
  lastVisit: string | null;
  preferredBarberName?: string | null;
  notes?: string | null;
  isVip: boolean;
}

export interface CustomerDetailProfile {
  id: string;
  customerNumber: string;
  name: string;
  mobile: string;
  whatsapp: string;
  dateOfBirth?: string | null;
  address?: string | null;
  preferredLanguage: AppLanguage;
  status: CustomerStatus;
  notes?: string | null;
  isVip: boolean;
  preferredBarberId?: string | null;
  preferredBarberName?: string | null;
  createdAt: string;
}

export interface CustomerMetrics {
  totalSpending: number;
  totalVisits: number;
  lastVisit: string | null;
  upcomingAppointments: number;
  completedVisits: number;
  cancelledVisits: number;
  favouriteService: string;
}

export interface CustomerVisitRecord {
  invoiceId: string;
  invoiceNumber: string;
  visitDate: string;
  grandTotal: number;
  paymentMethod: string;
  barberName: string;
  services: string[];
}

export interface CustomerDashboardData {
  profile: CustomerDetailProfile;
  metrics: CustomerMetrics;
  visitHistory: CustomerVisitRecord[];
}

export interface CustomerUpsertPayload {
  branchId?: string;
  name: string;
  phone: string;
  whatsapp?: string;
  preferredBarberId?: string | null;
  notes?: string;
  address?: string;
  dateOfBirth?: string;
  language?: AppLanguage;
  status?: CustomerStatus;
}

export interface CustomerAnalyticsData {
  overview: {
    totalCustomers: number;
    newThisMonth: number;
    returningCustomers: number;
    retentionRatePct: number;
    activeCustomers: number;
    inactiveCustomers: number;
    blockedCustomers: number;
  };
  mostValuableCustomers: Array<{
    id: string;
    customerNumber: string;
    name: string;
    mobile: string;
    totalSpending: number;
    totalVisits: number;
    lastVisit: string | null;
  }>;
  mostFrequentCustomers: Array<{
    id: string;
    customerNumber: string;
    name: string;
    mobile: string;
    totalVisits: number;
    totalSpending: number;
    lastVisit: string | null;
  }>;
}

