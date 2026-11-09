export type NavTab = 'home-book' | 'book-flow' | 'live-queue' | 'my-bookings' | 'owner-pos';

export interface ServiceItem {
  id: string;
  name: string;
  sinhalaName: string;
  category: 'haircut' | 'beard' | 'treatment';
  duration: string;
  price: number;
  icon: string;
  isPopular?: boolean;
}

export interface Stylist {
  id: string;
  name: string;
  sinhalaName: string;
  chair: string;
  role: string;
  rating: number;
  reviewsCount: number;
  status: 'Ready' | 'Busy' | 'Instant';
  statusText?: string;
  image: string;
}

export interface BookingState {
  serviceId: string;
  serviceName: string;
  serviceSinhala: string;
  servicePrice: number;
  serviceDuration: string;
  stylistId: string;
  stylistName: string;
  selectedDate: string;
  selectedDateLabel: string;
  selectedTimeSlot: string;
  customerName: string;
  customerPhone: string;
  tokenNumber: number;
  ticketCode: string;
}

