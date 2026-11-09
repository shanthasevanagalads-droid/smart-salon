import { AppLanguage } from './database';

export type StaffPosition = 'owner' | 'senior_barber' | 'junior_barber' | 'assistant';

export type StaffAvailability = 'available' | 'busy' | 'on_break' | 'on_leave' | 'off_duty';

export type StaffLeaveType = 'annual' | 'medical' | 'personal';

export type StaffLeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface StaffScheduleDay {
  dayOfWeek: number; // 0=Sunday, 1=Monday...
  dayName: string;
  startTime: string; // '06:00'
  endTime: string; // '20:00'
  breakStart: string; // '13:00'
  breakEnd: string; // '14:00'
  isWorkingDay: boolean;
}

export interface StaffServiceAssignment {
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  sinhalaName: string;
  priceLkr: number;
  durationMinutes: number;
  isAssigned: boolean;
}

export interface StaffMember {
  id: string;
  branchId: string;
  profileId?: string | null;
  staffNumber: string; // 'STF-001'
  fullName: string;
  sinhalaName?: string | null;
  photoUrl?: string | null;
  phone: string;
  whatsapp?: string | null;
  position: StaffPosition;
  chairNumber: number; // 1 or 2 in Version 1
  joiningDate: string;
  status: 'active' | 'inactive' | 'suspended';
  availability: StaffAvailability;
  commissionPercentage: number; // e.g. 35.00
  rating: number; // e.g. 4.9
  reviewsCount: number;
  workingHours: {
    start: string;
    end: string;
    breakStart?: string;
    breakEnd?: string;
  };
  assignedServices?: StaffServiceAssignment[];
  schedule?: StaffScheduleDay[];
  // Performance metrics
  monthlyEarningsEstimateLkr?: number;
  todayCompletedJobs?: number;
  todayRevenueLkr?: number;
  todayCommissionLkr?: number;
  averageChairTimeMinutes?: number;
}

export interface StaffLeaveRequest {
  id: string;
  branchId: string;
  staffId: string;
  staffName?: string;
  chairNumber?: number;
  leaveType: StaffLeaveType;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  status: StaffLeaveStatus;
  approvedBy?: string | null;
  createdAt: string;
}

export interface StaffCommissionReport {
  staffId: string;
  staffNumber: string;
  staffName: string;
  position: StaffPosition;
  chairNumber: number;
  commissionPercentage: number;
  month: string; // '2026-11'
  totalServicesCount: number;
  grossRevenueLkr: number;
  netCommissionEarnedLkr: number;
  breakdownByService: Array<{
    serviceName: string;
    count: number;
    revenueLkr: number;
    commissionLkr: number;
  }>;
}

export interface BarberStationDashboardData {
  staff: StaffMember;
  activeTicket: {
    queueId: string;
    ticketNumber: number;
    ticketCode: string;
    customerName: string;
    customerPhone: string;
    serviceName: string;
    serviceSinhala: string;
    priceLkr: number;
    durationMinutes: number;
    startedAt: string;
    elapsedMinutes: number;
    isVip?: boolean;
  } | null;
  waitingQueue: Array<{
    queueId: string;
    ticketNumber: number;
    ticketCode: string;
    customerName: string;
    serviceName: string;
    estimatedWaitMinutes: number;
    isAppointment: boolean;
  }>;
  todayAppointments: Array<{
    id: string;
    appointmentNumber: string;
    time: string;
    customerName: string;
    customerPhone: string;
    serviceName: string;
    status: string;
  }>;
  todayStats: {
    completedJobs: number;
    revenueLkr: number;
    commissionLkr: number;
    avgChairDurationMinutes: number;
    cashCollectedLkr: number;
    lankaQrCollectedLkr: number;
  };
}

export interface StaffUpsertPayload {
  id?: string;
  branchId?: string;
  staffNumber?: string;
  fullName: string;
  sinhalaName?: string;
  photoUrl?: string;
  phone: string;
  whatsapp?: string;
  position: StaffPosition;
  chairNumber: number;
  joiningDate?: string;
  status?: 'active' | 'inactive' | 'suspended';
  commissionPercentage: number;
  assignedServiceIds?: string[];
  workingHours?: {
    start: string;
    end: string;
    breakStart?: string;
    breakEnd?: string;
  };
}

