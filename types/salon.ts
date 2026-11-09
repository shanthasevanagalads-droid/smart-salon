import {
  AppointmentStatus,
  QueueStatus,
  PaymentMethod,
  PaymentStatus,
  ServiceCategory,
  UserRole,
  AppLanguage,
  UserStatus,
} from './database';

export type { UserRole, AppLanguage, UserStatus };

export interface UserProfile {
  id: string;
  branchId?: string | null;
  roleId: string;
  fullName: string;
  phoneNumber: string;
  whatsappNumber?: string | null;
  status: 'active' | 'inactive' | 'suspended';
  language: 'si' | 'en' | 'ta';
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalonInfo {
  id: string;
  name: string;
  sinhalaName: string;
  slug: string;
  address: string;
  city: string;
  phone: string;
  whatsappNumber: string;
  openingTime: string;
  closingTime: string;
  isOpen: boolean;
  lankaQrMerchantId?: string;
  lankaQrAccountNumber?: string;
}

export interface BarberProfile {
  id: string;
  name: string;
  sinhalaName: string;
  chairNumber: 1 | 2;
  roleTitle: string;
  phone?: string;
  avatarUrl?: string;
  rating: number;
  reviewsCount: number;
  isActive: boolean;
  isOnDuty: boolean;
}

export interface ServiceDetail {
  id: string;
  code: string;
  name: string;
  sinhalaName: string;
  category: ServiceCategory;
  durationMinutes: number;
  priceLkr: number;
  iconName: string;
  isPopular: boolean;
  isActive: boolean;
}

export interface CustomerProfile {
  id: string;
  phone: string;
  fullName: string;
  whatsappEnabled: boolean;
  totalVisits: number;
  lastVisitAt?: string;
  notes?: string;
}

export interface QueueTicketDetail {
  id: string;
  tokenNumber: number;
  ticketCode: string;
  ticketType: 'walk_in' | 'appointment';
  status: QueueStatus;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  serviceSinhala: string;
  servicePriceLkr: number;
  durationMinutes: number;
  barberName?: string;
  chairNumber?: number;
  estimatedWaitMinutes: number;
  createdAt: string;
  calledAt?: string;
}

export interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  salonName: string;
  salonAddress: string;
  salonPhone: string;
  customerName: string;
  customerPhone: string;
  barberName?: string;
  items: {
    serviceName: string;
    unitPrice: number;
    quantity: number;
    total: number;
  }[];
  subtotalLkr: number;
  discountLkr: number;
  totalLkr: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  barcodeValue: string;
  lankaQrPayload?: string;
  createdAt: string;
}

export interface DailyReportSummary {
  date: string;
  grossRevenueLkr: number;
  cashRevenueLkr: number;
  lankaQrRevenueLkr: number;
  cardRevenueLkr: number;
  totalCustomersServed: number;
  averageChairTimeMinutes: number;
  walkInCount: number;
  appointmentCount: number;
  cancelledCount: number;
}

export interface BarberPerformanceMetric {
  barberId: string;
  barberName: string;
  chairNumber: number;
  customersServed: number;
  totalRevenueGeneratedLkr: number;
  avgRating: number;
  activeHours: number;
}

export interface PopularServiceMetric {
  serviceId: string;
  serviceName: string;
  sinhalaName: string;
  bookingsCount: number;
  totalRevenueLkr: number;
}

