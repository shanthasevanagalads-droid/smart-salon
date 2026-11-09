import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  AppointmentDetail,
  AppointmentStatus,
  AppointmentServiceItem,
  TimeSlot,
  BarberRecommendation,
  DailyChairSchedule,
  CreateAppointmentPayload,
  RescheduleAppointmentPayload,
  WhatsAppNotificationPayload,
} from '@/types/appointment';
import { validateAndFormatSLPhone } from '@/lib/security/validation';

const DEFAULT_BRANCH_ID =
  process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID || 'b0000000-0000-0000-0000-000000000001';

const SALON_INFO = {
  name: 'Smart Salon LK - Ampitiya',
  sinhalaName: 'ස්මාර්ට් සැලෝන් - අම්පිටිය',
  address: 'No. 42, Ampitiya Road, Kandy',
  phone: '+94812233445',
  whatsapp: '+94771112233',
  googleMapsUrl: 'https://maps.google.com/?q=Ampitiya+Kandy',
};

// Available services reference
const SERVICE_CATALOG: Record<string, { code: string; name: string; sinhalaName: string; price: number; duration: number }> = {
  'adult-cut': { code: 'adult-cut', name: 'Adult Hair Cut', sinhalaName: 'වැඩිහිටි කොණ්ඩ කැපීම', price: 1200, duration: 30 },
  'cut-beard': { code: 'cut-beard', name: 'Hair Cut + Beard', sinhalaName: 'කොණ්ඩය සහ රැවුල', price: 1800, duration: 45 },
  'child-cut': { code: 'child-cut', name: 'Child Hair Cut', sinhalaName: 'ළමා කොණ්ඩ කැපීම', price: 900, duration: 20 },
  'beard-trim': { code: 'beard-trim', name: 'Beard Trim & Sculpt', sinhalaName: 'රැවුල හැඩගැන්වීම', price: 800, duration: 20 },
  'style-cut': { code: 'style-cut', name: 'Hair Style Cut', sinhalaName: 'නවීන විලාසිතා කොණ්ඩ කැපීම', price: 1400, duration: 35 },
  'hair-dye': { code: 'hair-dye', name: 'Hair Dye', sinhalaName: 'කොණ්ඩය ඩයි කිරීම', price: 2200, duration: 40 },
  'hair-massage': { code: 'hair-massage', name: 'Head Massage', sinhalaName: 'හිස සම්බාහනය', price: 1200, duration: 20 },
  'oil-massage': { code: 'oil-massage', name: 'Herbal Oil Therapy', sinhalaName: 'ආයුර්වේද තෙල් සම්බාහනය', price: 1500, duration: 25 },
};

// Barbers reference (V1 dual chair)
const BARBERS = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    name: 'Master Kavi (Kavindu Perera)',
    sinhalaName: 'කවිඳු පෙරේරා',
    chairNumber: 1,
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    name: 'Sunil Shantha',
    sinhalaName: 'සුනිල් ශාන්ත',
    chairNumber: 2,
  },
];

// In-Memory Mock Store for Offline & Fast UI Testing
const getTodayIso = () => new Date().toISOString().split('T')[0];

let MOCK_APPOINTMENTS: AppointmentDetail[] = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    branchId: DEFAULT_BRANCH_ID,
    appointmentNumber: `APT-${getTodayIso().replace(/-/g, '')}-0001`,
    customerId: 'cust-001',
    customerName: 'Nuwan Silva',
    customerPhone: '+94771234567',
    customerWhatsapp: '+94771234567',
    isVip: true,
    barberId: 'c0000000-0000-0000-0000-000000000001',
    barberName: 'Master Kavi (Kavindu Perera)',
    barberSinhalaName: 'කවිඳු පෙරේරා',
    chairNumber: 1,
    appointmentDate: getTodayIso(),
    appointmentTime: '09:00',
    expectedEndTime: '09:45',
    bufferMinutes: 5,
    status: 'confirmed',
    bookingSource: 'online_pwa',
    totalAmount: 1800,
    notes: 'Zero fade on sides and clean beard line',
    services: [
      {
        serviceId: 'cut-beard',
        code: 'cut-beard',
        name: 'Hair Cut + Beard',
        sinhalaName: 'කොණ්ඩය සහ රැවුල',
        priceLkr: 1800,
        durationMinutes: 45,
      },
    ],
    statusHistory: [
      {
        id: 'hist-1',
        appointmentId: 'd0000000-0000-0000-0000-000000000001',
        fromStatus: null,
        toStatus: 'confirmed',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    branchId: DEFAULT_BRANCH_ID,
    appointmentNumber: `APT-${getTodayIso().replace(/-/g, '')}-0002`,
    customerId: 'cust-002',
    customerName: 'Dinesh Kumara',
    customerPhone: '+94719876543',
    customerWhatsapp: '+94719876543',
    isVip: false,
    barberId: 'c0000000-0000-0000-0000-000000000002',
    barberName: 'Sunil Shantha',
    barberSinhalaName: 'සුනිල් ශාන්ත',
    chairNumber: 2,
    appointmentDate: getTodayIso(),
    appointmentTime: '10:00',
    expectedEndTime: '10:40',
    bufferMinutes: 5,
    status: 'in_service',
    bookingSource: 'whatsapp',
    totalAmount: 2200,
    notes: 'Black hair dye and quick wash',
    services: [
      {
        serviceId: 'hair-dye',
        code: 'hair-dye',
        name: 'Hair Dye',
        sinhalaName: 'කොණ්ඩය ඩයි කිරීම',
        priceLkr: 2200,
        durationMinutes: 40,
      },
    ],
    statusHistory: [
      {
        id: 'hist-2',
        appointmentId: 'd0000000-0000-0000-0000-000000000002',
        fromStatus: 'confirmed',
        toStatus: 'in_service',
        createdAt: new Date(Date.now() - 1200000).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 1200000).toISOString(),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000003',
    branchId: DEFAULT_BRANCH_ID,
    appointmentNumber: `APT-${getTodayIso().replace(/-/g, '')}-0003`,
    customerId: 'cust-003',
    customerName: 'Chaminda Bandara',
    customerPhone: '+94765432109',
    customerWhatsapp: '+94765432109',
    isVip: true,
    barberId: 'c0000000-0000-0000-0000-000000000001',
    barberName: 'Master Kavi (Kavindu Perera)',
    barberSinhalaName: 'කවිඳු පෙරේරා',
    chairNumber: 1,
    appointmentDate: getTodayIso(),
    appointmentTime: '14:30',
    expectedEndTime: '15:00',
    bufferMinutes: 5,
    status: 'pending',
    bookingSource: 'online_pwa',
    totalAmount: 1200,
    notes: 'Father coming with son',
    services: [
      {
        serviceId: 'adult-cut',
        code: 'adult-cut',
        name: 'Adult Hair Cut',
        sinhalaName: 'වැඩිහිටි කොණ්ඩ කැපීම',
        priceLkr: 1200,
        durationMinutes: 30,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Helper: Calculate finish time
function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10) + minutes;
  while (m >= 60) {
    h += 1;
    m -= 60;
  }
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Helper: Format Time string for display
function formatTimeLabel(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// Helper: Check if two time intervals overlap (including buffer)
function doIntervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
  bufferMinutes: number = 5
): boolean {
  const bufferedEndA = addMinutesToTime(endA, bufferMinutes);
  const bufferedEndB = addMinutesToTime(endB, bufferMinutes);
  return startA < bufferedEndB && bufferedEndA > startB;
}

export class AppointmentService {
  /**
   * Get all appointments matching filters
   */
  static async getAppointments(filters: {
    branchId?: string;
    date?: string;
    barberId?: string;
    status?: AppointmentStatus | 'all';
    search?: string;
  } = {}): Promise<AppointmentDetail[]> {
    const branchId = filters.branchId || DEFAULT_BRANCH_ID;

    if (isSupabaseConfigured()) {
      try {
        let query = (supabase as any)
          .from('appointments')
          .select(`
            *,
            customer:customers(id, name, mobile, whatsapp, is_vip),
            barber:staff(id, full_name, sinhala_name, chair_number),
            services:appointment_services(
              id,
              service_id,
              price,
              duration_minutes,
              service:services(code, name, sinhala_name)
            )
          `)
          .eq('branch_id', branchId)
          .is('deleted_at', null);

        if (filters.date) {
          query = query.eq('appointment_date', filters.date);
        }
        if (filters.barberId) {
          query = query.eq('barber_id', filters.barberId);
        }
        if (filters.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }

        const { data, error } = await query.order('appointment_time', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((apt: any) => ({
            id: apt.id,
            branchId: apt.branch_id,
            appointmentNumber: apt.appointment_number,
            customerId: apt.customer?.id || apt.customer_id,
            customerName: apt.customer?.name || 'Walk-in / Guest',
            customerPhone: apt.customer?.mobile || '',
            customerWhatsapp: apt.customer?.whatsapp,
            isVip: !!apt.customer?.is_vip,
            barberId: apt.barber?.id || apt.barber_id,
            barberName: apt.barber?.full_name || 'Unassigned',
            barberSinhalaName: apt.barber?.sinhala_name,
            chairNumber: apt.barber?.chair_number || 1,
            appointmentDate: apt.appointment_date,
            appointmentTime: apt.appointment_time?.slice(0, 5) || '09:00',
            expectedEndTime: apt.expected_end_time?.slice(0, 5) || '09:30',
            bufferMinutes: apt.buffer_minutes || 5,
            status: apt.status as AppointmentStatus,
            bookingSource: apt.booking_source,
            totalAmount: Number(apt.total_amount),
            notes: apt.notes,
            cancellationReason: apt.cancellation_reason,
            checkInTime: apt.check_in_time,
            startedTime: apt.started_time,
            completedTime: apt.completed_time,
            services: (apt.services || []).map((s: any) => ({
              id: s.id,
              serviceId: s.service_id,
              code: s.service?.code || '',
              name: s.service?.name || 'Salon Service',
              sinhalaName: s.service?.sinhala_name,
              priceLkr: Number(s.price),
              durationMinutes: s.duration_minutes,
            })),
            createdAt: apt.created_at,
            updatedAt: apt.updated_at,
          }));
        }
      } catch (err) {
        console.warn('Supabase getAppointments fallback to local store:', err);
      }
    }

    // Fallback In-Memory Store
    let results = [...MOCK_APPOINTMENTS];
    if (filters.date) {
      results = results.filter((a) => a.appointmentDate === filters.date);
    }
    if (filters.barberId) {
      results = results.filter((a) => a.barberId === filters.barberId);
    }
    if (filters.status && filters.status !== 'all') {
      results = results.filter((a) => a.status === filters.status);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      results = results.filter(
        (a) =>
          a.customerName.toLowerCase().includes(q) ||
          a.customerPhone.includes(q) ||
          a.appointmentNumber.toLowerCase().includes(q) ||
          a.services.some((s) => s.name.toLowerCase().includes(q))
      );
    }

    return results.sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
  }

  /**
   * Get single appointment by ID
   */
  static async getAppointmentById(id: string): Promise<AppointmentDetail | null> {
    const list = await this.getAppointments();
    return list.find((a) => a.id === id) || null;
  }

  /**
   * Get Daily Dual-Chair Schedule
   */
  static async getDailyChairSchedule(
    branchId: string = DEFAULT_BRANCH_ID,
    date: string = getTodayIso()
  ): Promise<DailyChairSchedule> {
    const appointments = await this.getAppointments({ branchId, date });

    const chair1Barber = BARBERS[0];
    const chair2Barber = BARBERS[1];

    const chair1Apts = appointments.filter(
      (a) => a.barberId === chair1Barber.id || a.chairNumber === 1
    );
    const chair2Apts = appointments.filter(
      (a) => a.barberId === chair2Barber.id || a.chairNumber === 2
    );

    return {
      date,
      chair1: {
        barberId: chair1Barber.id,
        barberName: chair1Barber.name,
        chairNumber: 1,
        appointments: chair1Apts,
      },
      chair2: {
        barberId: chair2Barber.id,
        barberName: chair2Barber.name,
        chairNumber: 2,
        appointments: chair2Apts,
      },
    };
  }

  /**
   * Generate available time slots dynamically
   */
  static async generateAvailableSlots(
    branchId: string = DEFAULT_BRANCH_ID,
    date: string = getTodayIso(),
    durationMinutes: number = 30,
    barberId?: string
  ): Promise<TimeSlot[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase as any).rpc('generate_available_time_slots', {
          p_branch_id: branchId,
          p_date: date,
          p_duration_minutes: durationMinutes,
          p_barber_id: barberId || null,
        });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((d: any) => ({
            slotTime: d.slot_time ? d.slot_time.slice(0, 5) : '09:00',
            label: d.slot_label,
            barberId: d.barber_id,
            barberName: d.barber_name,
            chairNumber: d.chair_number,
            isAvailable: d.is_available,
            conflictReason: d.conflict_reason,
          }));
        }
      } catch (err) {
        console.warn('Supabase generateAvailableSlots fallback to local engine:', err);
      }
    }

    // Local Slot Engine
    const slots: TimeSlot[] = [];
    const barbersToEvaluate = barberId
      ? BARBERS.filter((b) => b.id === barberId)
      : BARBERS;

    // Working hours: 06:00 to 20:00 (Every 30 mins)
    const activeApts = MOCK_APPOINTMENTS.filter(
      (a) => a.appointmentDate === date && a.status !== 'cancelled' && a.status !== 'no_show'
    );

    for (const barber of barbersToEvaluate) {
      let currentHour = 6;
      let currentMinute = 0;

      while (currentHour < 20) {
        const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute
          .toString()
          .padStart(2, '0')}`;
        const slotEnd = addMinutesToTime(timeStr, durationMinutes);

        // Disallow if slot extends past 20:00 closing
        if (slotEnd > '20:00') break;

        let isAvailable = true;
        let conflictReason: string | null = null;

        // Lunch Break Check (13:00 - 14:00)
        if (timeStr < '14:00' && slotEnd > '13:00') {
          isAvailable = false;
          conflictReason = 'Lunch & Rest Break (1:00 PM - 2:00 PM)';
        }

        // Overlapping Bookings Check
        if (isAvailable) {
          const conflict = activeApts.find(
            (a) =>
              a.barberId === barber.id &&
              doIntervalsOverlap(timeStr, slotEnd, a.appointmentTime, a.expectedEndTime, 5)
          );
          if (conflict) {
            isAvailable = false;
            conflictReason = `Booked (${conflict.appointmentNumber})`;
          }
        }

        slots.push({
          slotTime: timeStr,
          label: formatTimeLabel(timeStr),
          barberId: barber.id,
          barberName: barber.name,
          chairNumber: barber.chairNumber,
          isAvailable,
          conflictReason,
        });

        // 30 min increments
        currentMinute += 30;
        if (currentMinute >= 60) {
          currentHour += 1;
          currentMinute = 0;
        }
      }
    }

    return slots;
  }

  /**
   * Recommend the optimal barber
   */
  static async recommendBarber(
    branchId: string = DEFAULT_BRANCH_ID,
    customerId?: string,
    serviceIds: string[] = [],
    date: string = getTodayIso()
  ): Promise<BarberRecommendation> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase as any).rpc('recommend_barber', {
          p_branch_id: branchId,
          p_customer_id: customerId || null,
          p_service_ids: serviceIds,
          p_date: date,
        });

        if (!error && Array.isArray(data) && data.length > 0) {
          const rec = data[0];
          return {
            recommendedBarberId: rec.recommended_barber_id,
            recommendedBarberName: rec.recommended_barber_name,
            chairNumber: rec.chair_number,
            recommendationReason: rec.recommendation_reason,
            recommendationReasonSinhala: rec.recommendation_reason_sinhala,
            earliestAvailableSlot: rec.earliest_available_slot?.slice(0, 5),
            activeAppointmentsCount: Number(rec.active_appointments_count || 0),
          };
        }
      } catch (err) {
        console.warn('Supabase recommendBarber fallback:', err);
      }
    }

    // Local Smart Recommendation Logic
    const slots = await this.generateAvailableSlots(branchId, date, 30);
    const kaviSlots = slots.filter((s) => s.barberId === BARBERS[0].id && s.isAvailable);
    const sunilSlots = slots.filter((s) => s.barberId === BARBERS[1].id && s.isAvailable);

    if (kaviSlots.length >= sunilSlots.length) {
      return {
        recommendedBarberId: BARBERS[0].id,
        recommendedBarberName: BARBERS[0].name,
        chairNumber: 1,
        recommendationReason: 'Earliest Available & Master Stylist',
        recommendationReasonSinhala: 'පළමුවෙන්ම වේලාවක් ලබාගත හැකි ප්‍රවීණ බාබර්වරයා',
        earliestAvailableSlot: kaviSlots[0]?.slotTime || '09:00',
        activeAppointmentsCount: 2,
      };
    } else {
      return {
        recommendedBarberId: BARBERS[1].id,
        recommendedBarberName: BARBERS[1].name,
        chairNumber: 2,
        recommendationReason: 'Shortest Waiting Queue Today',
        recommendationReasonSinhala: 'අවම පෝලිමක් ඇති බාබර්වරයා',
        earliestAvailableSlot: sunilSlots[0]?.slotTime || '09:00',
        activeAppointmentsCount: 1,
      };
    }
  }

  /**
   * Create a new Appointment (with double-booking check & WhatsApp payload)
   */
  static async createAppointment(
    payload: CreateAppointmentPayload
  ): Promise<{ appointment: AppointmentDetail; whatsappPayload: WhatsAppNotificationPayload }> {
    const branchId = payload.branchId || DEFAULT_BRANCH_ID;
    const phoneValid = validateAndFormatSLPhone(payload.customerPhone);
    const customerPhone = phoneValid.formatted || payload.customerPhone;

    // 1. Calculate duration and total amount from services
    const resolvedServices: AppointmentServiceItem[] = payload.serviceIds.map((sid) => {
      const match = SERVICE_CATALOG[sid] || {
        code: sid,
        name: 'Barber Service',
        sinhalaName: 'බාබර් සේවාව',
        price: 1200,
        duration: 30,
      };
      return {
        serviceId: sid,
        code: match.code,
        name: match.name,
        sinhalaName: match.sinhalaName,
        priceLkr: match.price,
        durationMinutes: match.duration,
      };
    });

    const totalDuration = resolvedServices.reduce((sum, s) => sum + s.durationMinutes, 0) || 30;
    const totalAmount = resolvedServices.reduce((sum, s) => sum + s.priceLkr, 0) || 1200;
    const startTime = payload.startTime;
    const endTime = addMinutesToTime(startTime, totalDuration);

    // 2. Select or recommend barber if not provided
    let barberId = payload.preferredBarberId;
    if (!barberId) {
      const rec = await this.recommendBarber(branchId, undefined, payload.serviceIds, payload.date);
      barberId = rec.recommendedBarberId;
    }

    const assignedBarber = BARBERS.find((b) => b.id === barberId) || BARBERS[0];

    // 3. Double-Booking Conflict Prevention Check
    const existingSlots = await this.generateAvailableSlots(
      branchId,
      payload.date,
      totalDuration,
      assignedBarber.id
    );
    const requestedSlot = existingSlots.find((s) => s.slotTime === startTime);

    if (requestedSlot && !requestedSlot.isAvailable) {
      throw new Error(
        `Time slot ${formatTimeLabel(startTime)} is not available for ${assignedBarber.name}: ${requestedSlot.conflictReason || 'Already booked'
        }`
      );
    }

    // 4. Unique Appointment Number: APT-YYYYMMDD-XXXX
    const dateCode = payload.date.replace(/-/g, '');
    const dailyCount = MOCK_APPOINTMENTS.filter((a) => a.appointmentDate === payload.date).length + 1;
    const appointmentNumber = `APT-${dateCode}-${dailyCount.toString().padStart(4, '0')}`;

    const newAppointment: AppointmentDetail = {
      id: `apt-${Date.now()}`,
      branchId,
      appointmentNumber,
      customerId: `cust-${Date.now()}`,
      customerName: payload.customerName.trim() || 'Valued Customer',
      customerPhone,
      customerWhatsapp: payload.customerWhatsapp || customerPhone,
      barberId: assignedBarber.id,
      barberName: assignedBarber.name,
      barberSinhalaName: assignedBarber.sinhalaName,
      chairNumber: assignedBarber.chairNumber,
      appointmentDate: payload.date,
      appointmentTime: startTime,
      expectedEndTime: endTime,
      bufferMinutes: 5,
      status: 'confirmed',
      bookingSource: payload.bookingSource || 'online_pwa',
      totalAmount,
      notes: payload.notes || null,
      services: resolvedServices,
      statusHistory: [
        {
          id: `hist-${Date.now()}`,
          appointmentId: `apt-${Date.now()}`,
          fromStatus: null,
          toStatus: 'confirmed',
          changeReason: 'Customer reservation confirmed',
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to local store
    MOCK_APPOINTMENTS.unshift(newAppointment);

    // Save to Supabase if available
    if (isSupabaseConfigured()) {
      try {
        const { data: aptData } = await (supabase as any)
          .from('appointments')
          .insert({
            branch_id: branchId,
            appointment_number: appointmentNumber,
            customer_id: 'c0000000-0000-0000-0000-000000000001', // Fallback customer
            barber_id: assignedBarber.id,
            appointment_date: payload.date,
            appointment_time: `${startTime}:00`,
            expected_end_time: `${endTime}:00`,
            status: 'confirmed',
            bookingSource: payload.bookingSource || 'online_pwa',
            total_amount: totalAmount,
            notes: payload.notes,
          })
          .select()
          .single();

        if (aptData) {
          newAppointment.id = aptData.id;
        }
      } catch (err) {
        console.warn('Supabase createAppointment sync deferred:', err);
      }
    }

    // 5. Generate WhatsApp Confirmation Payload
    const whatsappPayload = this.generateWhatsAppNotification(newAppointment);

    return { appointment: newAppointment, whatsappPayload };
  }

  /**
   * Reschedule an existing appointment
   */
  static async rescheduleAppointment(
    id: string,
    payload: RescheduleAppointmentPayload
  ): Promise<AppointmentDetail> {
    const aptIndex = MOCK_APPOINTMENTS.findIndex((a) => a.id === id);
    if (aptIndex === -1) {
      throw new Error(`Appointment ${id} not found`);
    }

    const currentApt = MOCK_APPOINTMENTS[aptIndex];
    const barberId = payload.newBarberId || currentApt.barberId;
    const assignedBarber = BARBERS.find((b) => b.id === barberId) || BARBERS[0];

    const totalDuration = currentApt.services.reduce((s, item) => s + item.durationMinutes, 0) || 30;
    const newEndTime = addMinutesToTime(payload.newStartTime, totalDuration);

    // Conflict Check
    const activeConflicts = MOCK_APPOINTMENTS.filter(
      (a) =>
        a.id !== id &&
        a.appointmentDate === payload.newDate &&
        a.barberId === assignedBarber.id &&
        a.status !== 'cancelled' &&
        a.status !== 'no_show' &&
        doIntervalsOverlap(payload.newStartTime, newEndTime, a.appointmentTime, a.expectedEndTime, 5)
    );

    if (activeConflicts.length > 0) {
      throw new Error(
        `Chair conflict: ${assignedBarber.name} already has an appointment during this time.`
      );
    }

    const updatedApt: AppointmentDetail = {
      ...currentApt,
      appointmentDate: payload.newDate,
      appointmentTime: payload.newStartTime,
      expectedEndTime: newEndTime,
      barberId: assignedBarber.id,
      barberName: assignedBarber.name,
      chairNumber: assignedBarber.chairNumber,
      status: 'confirmed',
      notes: payload.reason ? `${currentApt.notes ? currentApt.notes + ' | ' : ''}Rescheduled: ${payload.reason}` : currentApt.notes,
      updatedAt: new Date().toISOString(),
      statusHistory: [
        ...(currentApt.statusHistory || []),
        {
          id: `hist-${Date.now()}`,
          appointmentId: id,
          fromStatus: currentApt.status,
          toStatus: 'confirmed',
          changeReason: `Rescheduled to ${payload.newDate} at ${formatTimeLabel(payload.newStartTime)}. Reason: ${payload.reason || 'Customer request'}`,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    MOCK_APPOINTMENTS[aptIndex] = updatedApt;

    if (isSupabaseConfigured()) {
      try {
        await (supabase as any)
          .from('appointments')
          .update({
            appointment_date: payload.newDate,
            appointment_time: `${payload.newStartTime}:00`,
            expected_end_time: `${newEndTime}:00`,
            barber_id: assignedBarber.id,
            status: 'confirmed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase reschedule sync deferred:', err);
      }
    }

    return updatedApt;
  }

  /**
   * Cancel an appointment
   */
  static async cancelAppointment(id: string, reason: string): Promise<AppointmentDetail> {
    return this.updateAppointmentStatus(id, 'cancelled', reason);
  }

  /**
   * Update Appointment Status with audit history
   */
  static async updateAppointmentStatus(
    id: string,
    newStatus: AppointmentStatus,
    reason?: string
  ): Promise<AppointmentDetail> {
    const aptIndex = MOCK_APPOINTMENTS.findIndex((a) => a.id === id);
    if (aptIndex === -1) {
      throw new Error(`Appointment ${id} not found`);
    }

    const apt = MOCK_APPOINTMENTS[aptIndex];
    const prevStatus = apt.status;

    apt.status = newStatus;
    apt.updatedAt = new Date().toISOString();

    if (newStatus === 'checked_in') {
      apt.checkInTime = new Date().toISOString();
    } else if (newStatus === 'in_service') {
      apt.startedTime = new Date().toISOString();
    } else if (newStatus === 'completed') {
      apt.completedTime = new Date().toISOString();
    } else if (newStatus === 'cancelled') {
      apt.cancellationReason = reason || 'Cancelled by staff or customer';
    }

    apt.statusHistory = [
      ...(apt.statusHistory || []),
      {
        id: `hist-${Date.now()}`,
        appointmentId: id,
        fromStatus: prevStatus,
        toStatus: newStatus,
        changeReason: reason || `Status changed from ${prevStatus} to ${newStatus}`,
        createdAt: new Date().toISOString(),
      },
    ];

    MOCK_APPOINTMENTS[aptIndex] = { ...apt };

    if (isSupabaseConfigured()) {
      try {
        await (supabase as any)
          .from('appointments')
          .update({
            status: newStatus,
            cancellation_reason: newStatus === 'cancelled' ? reason : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase status update sync deferred:', err);
      }
    }

    return apt;
  }

  /**
   * Check In Appointment to Live Queue Engine
   */
  static async checkInAppointmentToQueue(
    appointmentId: string
  ): Promise<{ success: boolean; queueNumber: number; ticketCode: string; message: string }> {
    const apt = await this.getAppointmentById(appointmentId);
    if (!apt) throw new Error('Appointment not found');

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase as any).rpc('check_in_appointment_to_queue', {
          p_appointment_id: appointmentId,
        });

        if (!error && data?.success) {
          await this.updateAppointmentStatus(appointmentId, 'checked_in', 'Registered into Live Queue');
          return {
            success: true,
            queueNumber: data.queue_number || 12,
            ticketCode: data.ticket_code || `LK-${getTodayIso().replace(/-/g, '')}-012`,
            message: 'Appointment successfully registered in live queue display!',
          };
        }
      } catch (err) {
        console.warn('Supabase checkInAppointmentToQueue fallback:', err);
      }
    }

    // Local Queue Ticket Simulation
    await this.updateAppointmentStatus(appointmentId, 'checked_in', 'Registered into Live Queue');
    const queueNumber = 14;
    const ticketCode = `LK-${getTodayIso().replace(/-/g, '')}-014`;

    return {
      success: true,
      queueNumber,
      ticketCode,
      message: `Token #${queueNumber} issued! Customer checked in to Live Queue display.`,
    };
  }

  /**
   * Generate bilingual Sri Lankan WhatsApp confirmation payload
   */
  static generateWhatsAppNotification(
    appointment: AppointmentDetail
  ): WhatsAppNotificationPayload {
    const phone = appointment.customerWhatsapp || appointment.customerPhone;
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    const servicesList = appointment.services.map((s) => `• ${s.name} (LKR ${s.priceLkr})`).join('\n');
    const timeFormatted = formatTimeLabel(appointment.appointmentTime);

    const messageText = `✂️ *${SALON_INFO.sinhalaName}* | *${SALON_INFO.name}*
━━━━━━━━━━━━━━━━━━━━━━━━
👋 ආයුබෝවන් ${appointment.customerName},

ඔබගේ වේලාව සාර්ථකව වෙන්කර ගන්නා ලදී!
Your appointment has been confirmed!

📌 *Appointment No:* ${appointment.appointmentNumber}
🗓️ *Date:* ${appointment.appointmentDate}
⏰ *Time:* ${timeFormatted}
💺 *Chair / Barber:* Chair ${appointment.chairNumber} - ${appointment.barberName}

📋 *Services Booked:*
${servicesList}

💰 *Estimated Total:* LKR ${appointment.totalAmount.toLocaleString()}

📍 *Location:* ${SALON_INFO.address}
📞 *Contact:* ${SALON_INFO.phone}
🗺️ *Map:* ${SALON_INFO.googleMapsUrl}

_කරුණාකර නියමිත වේලාවට මිනිත්තු 5කට පෙර පැමිණෙන්න._
_Please arrive 5 minutes before your reserved time slot._`;

    const clickToChatUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;

    return {
      recipientPhone: phone,
      recipientName: appointment.customerName,
      appointmentNumber: appointment.appointmentNumber,
      barberName: appointment.barberName,
      chairNumber: appointment.chairNumber,
      appointmentDate: appointment.appointmentDate,
      appointmentTime: timeFormatted,
      servicesList,
      totalAmountLkr: appointment.totalAmount,
      salonName: SALON_INFO.name,
      salonAddress: SALON_INFO.address,
      salonPhone: SALON_INFO.phone,
      googleMapsUrl: SALON_INFO.googleMapsUrl,
      clickToChatUrl,
      messageText,
    };
  }
}

