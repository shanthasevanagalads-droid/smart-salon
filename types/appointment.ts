export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'waiting'
  | 'in_service'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type BookingSource = 'online_pwa' | 'whatsapp' | 'walk_in' | 'phone_call';

export interface AppointmentServiceItem {
  id?: string;
  serviceId: string;
  code?: string;
  name: string;
  sinhalaName?: string;
  priceLkr: number;
  durationMinutes: number;
}

export interface AppointmentStatusHistoryItem {
  id: string;
  appointmentId: string;
  fromStatus?: string | null;
  toStatus: AppointmentStatus | string;
  changedBy?: string | null;
  changeReason?: string | null;
  createdAt: string;
}

export interface AppointmentNote {
  id: string;
  appointmentId: string;
  authorId?: string | null;
  authorName?: string | null;
  note: string;
  isInternal: boolean;
  createdAt: string;
}

export interface AppointmentDetail {
  id: string;
  branchId: string;
  appointmentNumber: string; // e.g. APT-20261102-0001
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerWhatsapp?: string | null;
  isVip?: boolean;
  barberId: string | null;
  barberName: string;
  barberSinhalaName?: string;
  chairNumber: number; // 1 or 2 in V1
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:MM:SS or HH:MM
  expectedEndTime: string; // HH:MM:SS or HH:MM
  bufferMinutes: number;
  status: AppointmentStatus;
  bookingSource: BookingSource;
  totalAmount: number;
  notes?: string | null;
  cancellationReason?: string | null;
  checkInTime?: string | null;
  startedTime?: string | null;
  completedTime?: string | null;
  services: AppointmentServiceItem[];
  statusHistory?: AppointmentStatusHistoryItem[];
  appointmentNotes?: AppointmentNote[];
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  slotTime: string; // "09:00:00" or "09:00"
  label: string; // "09:00 AM"
  barberId: string;
  barberName: string;
  chairNumber: number;
  isAvailable: boolean;
  conflictReason?: string | null;
}

export interface BarberRecommendation {
  recommendedBarberId: string;
  recommendedBarberName: string;
  chairNumber: number;
  recommendationReason: string;
  recommendationReasonSinhala: string;
  earliestAvailableSlot?: string | null;
  activeAppointmentsCount?: number;
}

export interface DailyChairSchedule {
  date: string;
  chair1: {
    barberId: string;
    barberName: string;
    chairNumber: 1;
    appointments: AppointmentDetail[];
  };
  chair2: {
    barberId: string;
    barberName: string;
    chairNumber: 2;
    appointments: AppointmentDetail[];
  };
}

export interface CreateAppointmentPayload {
  branchId?: string;
  customerName: string;
  customerPhone: string;
  customerWhatsapp?: string;
  preferredBarberId?: string | null;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  serviceIds: string[];
  bookingSource?: BookingSource;
  notes?: string;
}

export interface RescheduleAppointmentPayload {
  newDate: string; // YYYY-MM-DD
  newStartTime: string; // HH:MM
  newBarberId?: string;
  reason?: string;
}

export interface WhatsAppNotificationPayload {
  recipientPhone: string;
  recipientName: string;
  appointmentNumber: string;
  barberName: string;
  chairNumber: number;
  appointmentDate: string;
  appointmentTime: string;
  servicesList: string;
  totalAmountLkr: number;
  salonName: string;
  salonAddress: string;
  salonPhone: string;
  googleMapsUrl?: string;
  clickToChatUrl: string;
  messageText: string;
}

