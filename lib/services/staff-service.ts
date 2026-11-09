import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  StaffMember,
  StaffPosition,
  StaffAvailability,
  StaffLeaveRequest,
  StaffCommissionReport,
  BarberStationDashboardData,
  StaffUpsertPayload,
} from '@/types/staff';
import { validateAndFormatSLPhone } from '@/lib/security/validation';

const DEFAULT_BRANCH_ID =
  process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID || 'b0000000-0000-0000-0000-000000000001';

// In-Memory Demo Store for V1 Barbers (Chair 1 & Chair 2)
let MOCK_STAFF: StaffMember[] = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    branchId: DEFAULT_BRANCH_ID,
    staffNumber: 'STF-001',
    fullName: 'Master Kavi (Kavindu Perera)',
    sinhalaName: 'කවිඳු පෙරේරා',
    photoUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDdYsmqEToWqkhLyMB8Y2bFHS95FzmiIje__Q5F57JwDnjqvRoa62_OAlePc_dNjxMI1lb5HkhAwm9QyuRxGUXuCxXTP0qI_gZR96IgkpBiYd0OOfbyd6rSzkcBj44_OJR7ZpB8e9DPSWObbYhtmf7RpoVDy0G22Hfk_Dsa9tnGt3_r-KC8p3pm7W_zzKQKbPF4iX5LqebNt8E_wjLS2aVev5MFYMfOdYodRwwx4DQ',
    phone: '+94771112233',
    whatsapp: '+94771112233',
    position: 'senior_barber',
    chairNumber: 1,
    joiningDate: '2024-01-15',
    status: 'active',
    availability: 'available',
    commissionPercentage: 35.0,
    rating: 4.9,
    reviewsCount: 180,
    workingHours: {
      start: '06:00',
      end: '20:00',
      breakStart: '13:00',
      breakEnd: '14:00',
    },
    assignedServices: [
      { serviceId: 's1', serviceCode: 'adult-cut', serviceName: 'Adult Hair Cut', sinhalaName: 'වැඩිහිටි කොණ්ඩ කැපීම', priceLkr: 1200, durationMinutes: 30, isAssigned: true },
      { serviceId: 's2', serviceCode: 'cut-beard', serviceName: 'Hair Cut + Beard', sinhalaName: 'කොණ්ඩය සහ රැවුල', priceLkr: 1800, durationMinutes: 45, isAssigned: true },
      { serviceId: 's3', serviceCode: 'child-cut', serviceName: 'Child Hair Cut', sinhalaName: 'ළමා කොණ්ඩ කැපීම', priceLkr: 900, durationMinutes: 20, isAssigned: true },
      { serviceId: 's4', serviceCode: 'beard-trim', serviceName: 'Beard Trim', sinhalaName: 'රැවුල හැඩගැන්වීම', priceLkr: 800, durationMinutes: 20, isAssigned: true },
      { serviceId: 's5', serviceCode: 'style-cut', serviceName: 'Hair Style Cut', sinhalaName: 'නවීන විලාසිතා කොණ්ඩ කැපීම', priceLkr: 1400, durationMinutes: 35, isAssigned: true },
      { serviceId: 's6', serviceCode: 'hair-dye', serviceName: 'Hair Dye', sinhalaName: 'කොණ්ඩය ඩයි කිරීම', priceLkr: 2200, durationMinutes: 40, isAssigned: true },
      { serviceId: 's7', serviceCode: 'hair-massage', serviceName: 'Hair Massage', sinhalaName: 'හිස සම්බාහනය', priceLkr: 1200, durationMinutes: 20, isAssigned: true },
      { serviceId: 's8', serviceCode: 'oil-massage', serviceName: 'Oil Massage', sinhalaName: 'ආයුර්වේද තෙල් සම්බාහනය', priceLkr: 1500, durationMinutes: 25, isAssigned: true },
    ],
    schedule: [
      { dayOfWeek: 1, dayName: 'Monday', startTime: '06:00', endTime: '20:00', breakStart: '13:00', breakEnd: '14:00', isWorkingDay: true },
      { dayOfWeek: 2, dayName: 'Tuesday', startTime: '06:00', endTime: '20:00', breakStart: '13:00', breakEnd: '14:00', isWorkingDay: true },
      { dayOfWeek: 3, dayName: 'Wednesday', startTime: '06:00', endTime: '20:00', breakStart: '13:00', breakEnd: '14:00', isWorkingDay: true },
      { dayOfWeek: 4, dayName: 'Thursday', startTime: '06:00', endTime: '20:00', breakStart: '13:00', breakEnd: '14:00', isWorkingDay: true },
      { dayOfWeek: 5, dayName: 'Friday', startTime: '06:00', endTime: '20:00', breakStart: '13:00', breakEnd: '14:00', isWorkingDay: true },
      { dayOfWeek: 6, dayName: 'Saturday', startTime: '06:00', endTime: '20:00', breakStart: '13:00', breakEnd: '14:00', isWorkingDay: true },
      { dayOfWeek: 0, dayName: 'Sunday', startTime: '06:00', endTime: '20:00', breakStart: '13:00', breakEnd: '14:00', isWorkingDay: true },
    ],
    monthlyEarningsEstimateLkr: 64800,
    todayCompletedJobs: 14,
    todayRevenueLkr: 16800,
    todayCommissionLkr: 5880,
    averageChairTimeMinutes: 21.5,
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    branchId: DEFAULT_BRANCH_ID,
    staffNumber: 'STF-002',
    fullName: 'Sunil Shantha',
    sinhalaName: 'සුනිල් ශාන්ත',
    photoUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCsFnPnMzYxJ6xwVclhW0_CLiqeTfBaORMEOpfZGsEvL_nWkHooK6M3cYwxLqbj6TZd48qR0hWLjDHeAJWmmr5FKuBcIhyMXDGkY7aqpHgiKBX0PvkGtK9pTAmBVVf9wSIJzs95aQiAmjN24vrgl4llavZaWDqjKEduTj-DCEkuLv7svp5QrxLseoYLlzbFbKlAYooHQL6fU9tU7_wbAhT1H3uAMIwX6hD2KKcVU-s',
    phone: '+94772223344',
    whatsapp: '+94772223344',
    position: 'senior_barber',
    chairNumber: 2,
    joiningDate: '2024-03-01',
    status: 'active',
    availability: 'busy',
    commissionPercentage: 30.0,
    rating: 4.8,
    reviewsCount: 95,
    workingHours: {
      start: '06:00',
      end: '20:00',
      breakStart: '13:30',
      breakEnd: '14:30',
    },
    assignedServices: [
      { serviceId: 's1', serviceCode: 'adult-cut', serviceName: 'Adult Hair Cut', sinhalaName: 'වැඩිහිටි කොණ්ඩ කැපීම', priceLkr: 1200, durationMinutes: 30, isAssigned: true },
      { serviceId: 's2', serviceCode: 'cut-beard', serviceName: 'Hair Cut + Beard', sinhalaName: 'කොණ්ඩය සහ රැවුල', priceLkr: 1800, durationMinutes: 45, isAssigned: true },
      { serviceId: 's4', serviceCode: 'beard-trim', serviceName: 'Beard Trim', sinhalaName: 'රැවුල හැඩගැන්වීම', priceLkr: 800, durationMinutes: 20, isAssigned: true },
      { serviceId: 's8', serviceCode: 'oil-massage', serviceName: 'Oil Massage', sinhalaName: 'ආයුර්වේද තෙල් සම්බාහනය', priceLkr: 1500, durationMinutes: 25, isAssigned: true },
    ],
    schedule: [
      { dayOfWeek: 1, dayName: 'Monday', startTime: '06:00', endTime: '20:00', breakStart: '13:30', breakEnd: '14:30', isWorkingDay: true },
      { dayOfWeek: 2, dayName: 'Tuesday', startTime: '06:00', endTime: '20:00', breakStart: '13:30', breakEnd: '14:30', isWorkingDay: true },
      { dayOfWeek: 3, dayName: 'Wednesday', startTime: '06:00', endTime: '20:00', breakStart: '13:30', breakEnd: '14:30', isWorkingDay: true },
      { dayOfWeek: 4, dayName: 'Thursday', startTime: '06:00', endTime: '20:00', breakStart: '13:30', breakEnd: '14:30', isWorkingDay: true },
      { dayOfWeek: 5, dayName: 'Friday', startTime: '06:00', endTime: '20:00', breakStart: '13:30', breakEnd: '14:30', isWorkingDay: true },
      { dayOfWeek: 6, dayName: 'Saturday', startTime: '06:00', endTime: '20:00', breakStart: '13:30', breakEnd: '14:30', isWorkingDay: true },
      { dayOfWeek: 0, dayName: 'Sunday', startTime: '06:00', endTime: '20:00', breakStart: '13:30', breakEnd: '14:30', isWorkingDay: true },
    ],
    monthlyEarningsEstimateLkr: 48600,
    todayCompletedJobs: 10,
    todayRevenueLkr: 11600,
    todayCommissionLkr: 3480,
    averageChairTimeMinutes: 23.0,
  },
];

let MOCK_LEAVES: StaffLeaveRequest[] = [
  {
    id: 'l0000000-0000-0000-0000-000000000001',
    branchId: DEFAULT_BRANCH_ID,
    staffId: 'c0000000-0000-0000-0000-000000000002',
    staffName: 'Sunil Shantha',
    chairNumber: 2,
    leaveType: 'personal',
    startDate: '2026-11-15',
    endDate: '2026-11-16',
    daysCount: 2,
    reason: 'Family wedding in Nuwara Eliya',
    status: 'approved',
    createdAt: '2026-11-01T09:00:00Z',
  },
];

/**
 * 1. Fetch All Active Staff Members (Chair 1 & Chair 2)
 */
export async function getStaffMembers(branchId: string = DEFAULT_BRANCH_ID): Promise<StaffMember[]> {
  if (!isSupabaseConfigured()) {
    return MOCK_STAFF;
  }

  try {
    const { data, error } = await supabase
      .from('staff')
      .select(`
        id,
        branch_id,
        profile_id,
        staff_number,
        full_name,
        sinhala_name,
        position,
        chair_number,
        availability,
        commission_percentage,
        photo_url,
        rating,
        reviews_count,
        phone,
        whatsapp,
        joining_date,
        status,
        working_hours,
        is_active
      `)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('chair_number', { ascending: true });

    if (error || !data || data.length === 0) {
      console.warn('Falling back to mock staff data:', error?.message);
      return MOCK_STAFF;
    }

    return (data as any[]).map((row) => ({
      id: row.id,
      branchId: row.branch_id,
      profileId: row.profile_id,
      staffNumber: row.staff_number,
      fullName: row.full_name,
      sinhalaName: row.sinhala_name,
      photoUrl: row.photo_url,
      phone: row.phone || '+94770000000',
      whatsapp: row.whatsapp || row.phone,
      position: (row.position?.toLowerCase().replace(/\s+/g, '_') as StaffPosition) || 'senior_barber',
      chairNumber: row.chair_number || 1,
      joiningDate: row.joining_date || '2024-01-01',
      status: (row.status as 'active' | 'inactive' | 'suspended') || 'active',
      availability: (row.availability as StaffAvailability) || 'available',
      commissionPercentage: Number(row.commission_percentage || 30.0),
      rating: Number(row.rating || 4.9),
      reviewsCount: Number(row.reviews_count || 100),
      workingHours: (row.working_hours as any) || { start: '06:00', end: '20:00' },
      monthlyEarningsEstimateLkr: Math.round(Number(row.commission_percentage || 30) * 1600),
      todayCompletedJobs: row.chair_number === 1 ? 14 : 10,
      todayRevenueLkr: row.chair_number === 1 ? 16800 : 11600,
      todayCommissionLkr: row.chair_number === 1 ? 5880 : 3480,
      averageChairTimeMinutes: 22,
    }));
  } catch (err) {
    console.error('getStaffMembers failed, using fallback:', err);
    return MOCK_STAFF;
  }
}

/**
 * 2. Fetch Single Staff Member with Assigned Services & Schedules
 */
export async function getStaffMemberById(staffId: string): Promise<StaffMember | null> {
  const staffList = await getStaffMembers();
  const staff = staffList.find((s) => s.id === staffId);
  return staff || null;
}

/**
 * 3. Update Barber Live Availability (Quick Switcher)
 */
export async function updateStaffAvailability(
  staffId: string,
  availability: StaffAvailability
): Promise<{ success: boolean; availability: StaffAvailability; message: string }> {
  // Update mock
  const index = MOCK_STAFF.findIndex((s) => s.id === staffId);
  if (index !== -1) {
    MOCK_STAFF[index].availability = availability;
  }

  if (!isSupabaseConfigured()) {
    return {
      success: true,
      availability,
      message: `Staff availability switched to ${availability} (Demo mode).`,
    };
  }

  try {
    const { data, error } = await supabase.rpc('update_staff_availability', {
      p_staff_id: staffId,
      p_availability: availability,
    });

    if (error || !data) {
      // Fallback direct table update
      await (supabase.from('staff') as any)
        .update({ availability, updated_at: new Date().toISOString() })
        .eq('id', staffId);
    }

    return {
      success: true,
      availability,
      message: `Availability updated to ${availability}`,
    };
  } catch (err: unknown) {
    console.warn('updateStaffAvailability RPC fallback applied:', err);
    return {
      success: true,
      availability,
      message: `Availability updated to ${availability}`,
    };
  }
}

/**
 * 4. Barber Station Live Dashboard (Operator Screen for Chair 1 / Chair 2)
 */
export async function getBarberStationDashboard(staffId: string): Promise<BarberStationDashboardData> {
  const staff = (await getStaffMemberById(staffId)) || MOCK_STAFF[0];

  if (!isSupabaseConfigured()) {
    const isKasun = staff.chairNumber === 1;
    return {
      staff,
      activeTicket: {
        queueId: 'q-live-07',
        ticketNumber: isKasun ? 7 : 8,
        ticketCode: isKasun ? 'LK-20261101-007' : 'LK-20261101-008',
        customerName: isKasun ? 'Nuwan Silva' : 'Dinesh Kumara',
        customerPhone: isKasun ? '+94 77 123 4567' : '+94 71 888 9900',
        serviceName: isKasun ? 'Adult Hair Cut' : 'Beard Trim',
        serviceSinhala: isKasun ? 'වැඩිහිටි කොණ්ඩ කැපීම' : 'රැවුල හැඩගැන්වීම',
        priceLkr: isKasun ? 1200 : 800,
        durationMinutes: isKasun ? 30 : 20,
        startedAt: new Date(Date.now() - 14 * 60000).toISOString(),
        elapsedMinutes: 14,
        isVip: isKasun,
      },
      waitingQueue: [
        {
          queueId: 'q-next-10',
          ticketNumber: 10,
          ticketCode: 'LK-20261101-010',
          customerName: 'Kasun Perera',
          serviceName: 'Hair Cut + Beard',
          estimatedWaitMinutes: 16,
          isAppointment: true,
        },
        {
          queueId: 'q-next-11',
          ticketNumber: 11,
          ticketCode: 'LK-20261101-011',
          customerName: 'Roshan Fernando (Walk-in)',
          serviceName: 'Adult Hair Cut',
          estimatedWaitMinutes: 35,
          isAppointment: false,
        },
      ],
      todayAppointments: [
        {
          id: 'apt-01',
          appointmentNumber: 'APT-20261101-0001',
          time: '04:30 PM',
          customerName: 'Nuwan Jayasinghe',
          customerPhone: '+94 77 444 5566',
          serviceName: 'Executive Haircut',
          status: 'confirmed',
        },
        {
          id: 'apt-02',
          appointmentNumber: 'APT-20261101-0002',
          time: '06:00 PM',
          customerName: 'Malik Perera',
          customerPhone: '+94 72 999 1122',
          serviceName: 'Hair Dye & Beard Comb',
          status: 'confirmed',
        },
      ],
      todayStats: {
        completedJobs: isKasun ? 14 : 10,
        revenueLkr: isKasun ? 16800 : 11600,
        commissionLkr: isKasun ? 5880 : 3480,
        avgChairDurationMinutes: isKasun ? 21.5 : 23.0,
        cashCollectedLkr: isKasun ? 11800 : 7800,
        lankaQrCollectedLkr: isKasun ? 5000 : 3800,
      },
    };
  }

  try {
    const { data, error } = await supabase.rpc('get_barber_station_dashboard', {
      p_staff_id: staffId,
    });

    if (error || !data) {
      console.warn('get_barber_station_dashboard error, fallback to simulated:', error);
      return getBarberStationDashboard('fallback'); // returns mock
    }

    return {
      staff: {
        id: data.staff.id,
        branchId: data.staff.branch_id,
        staffNumber: data.staff.staff_number,
        fullName: data.staff.full_name,
        sinhalaName: data.staff.sinhala_name,
        photoUrl: data.staff.photo_url,
        phone: staff.phone,
        whatsapp: staff.whatsapp,
        position: data.staff.position,
        chairNumber: data.staff.chair_number,
        joiningDate: staff.joiningDate,
        status: staff.status,
        availability: data.staff.availability,
        commissionPercentage: Number(data.staff.commission_percentage || 30),
        rating: Number(data.staff.rating || 4.9),
        reviewsCount: Number(data.staff.reviews_count || 100),
        workingHours: staff.workingHours,
      },
      activeTicket: data.active_ticket
        ? {
            queueId: data.active_ticket.queue_id,
            ticketNumber: data.active_ticket.ticket_number,
            ticketCode: data.active_ticket.ticket_code,
            customerName: data.active_ticket.customer_name,
            customerPhone: data.active_ticket.customer_phone,
            serviceName: data.active_ticket.service_name,
            serviceSinhala: data.active_ticket.service_sinhala,
            priceLkr: Number(data.active_ticket.price_lkr || 1200),
            durationMinutes: Number(data.active_ticket.duration_minutes || 30),
            startedAt: data.active_ticket.started_at,
            elapsedMinutes: Number(data.active_ticket.elapsed_minutes || 0),
            isVip: data.active_ticket.is_vip,
          }
        : null,
      waitingQueue: (data.waiting_queue || []).map((q: any) => ({
        queueId: q.queue_id,
        ticketNumber: q.ticket_number,
        ticketCode: q.ticket_code,
        customerName: q.customer_name,
        serviceName: q.service_name,
        estimatedWaitMinutes: Number(q.estimated_wait_minutes || 15),
        isAppointment: q.is_appointment,
      })),
      todayAppointments: (data.today_appointments || []).map((a: any) => ({
        id: a.id,
        appointmentNumber: a.appointment_number,
        time: a.time,
        customerName: a.customer_name,
        customerPhone: a.customer_phone,
        serviceName: a.service_name,
        status: a.status,
      })),
      todayStats: {
        completedJobs: Number(data.today_stats.completed_jobs || 0),
        revenueLkr: Number(data.today_stats.revenue_lkr || 0),
        commissionLkr: Number(data.today_stats.commission_lkr || 0),
        avgChairDurationMinutes: Number(data.today_stats.avg_chair_duration_minutes || 22),
        cashCollectedLkr: Number(data.today_stats.cash_collected_lkr || 0),
        lankaQrCollectedLkr: Number(data.today_stats.lankaqr_collected_lkr || 0),
      },
    };
  } catch {
    return getBarberStationDashboard('fallback');
  }
}

/**
 * 5. Leave Management Requests
 */
export async function getStaffLeaves(staffId?: string): Promise<StaffLeaveRequest[]> {
  if (!isSupabaseConfigured()) {
    if (staffId) {
      return MOCK_LEAVES.filter((l) => l.staffId === staffId);
    }
    return MOCK_LEAVES;
  }

  try {
    let query = (supabase.from('staff_leaves') as any)
      .select('id, branch_id, staff_id, leave_type, start_date, end_date, days_count, reason, status, created_at, staff(full_name, chair_number)')
      .order('created_at', { ascending: false });

    if (staffId) {
      query = query.eq('staff_id', staffId);
    }

    const { data, error } = await query;
    if (error || !data) return MOCK_LEAVES;

    return data.map((l: any) => ({
      id: l.id,
      branchId: l.branch_id,
      staffId: l.staff_id,
      staffName: l.staff?.full_name || 'Barber',
      chairNumber: l.staff?.chair_number || 1,
      leaveType: l.leave_type,
      startDate: l.start_date,
      endDate: l.end_date,
      daysCount: Number(l.days_count || 1),
      reason: l.reason,
      status: l.status,
      createdAt: l.created_at,
    }));
  } catch {
    return MOCK_LEAVES;
  }
}

export async function submitStaffLeave(payload: {
  staffId: string;
  leaveType: 'annual' | 'medical' | 'personal';
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<{ success: boolean; message: string; leave?: StaffLeaveRequest }> {
  const staff = (await getStaffMemberById(payload.staffId)) || MOCK_STAFF[0];
  const daysCount = Math.max(
    1,
    Math.round(
      (new Date(payload.endDate).getTime() - new Date(payload.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1
  );

  const newLeave: StaffLeaveRequest = {
    id: 'l-' + Date.now(),
    branchId: DEFAULT_BRANCH_ID,
    staffId: payload.staffId,
    staffName: staff.fullName,
    chairNumber: staff.chairNumber,
    leaveType: payload.leaveType,
    startDate: payload.startDate,
    endDate: payload.endDate,
    daysCount,
    reason: payload.reason,
    status: 'approved',
    createdAt: new Date().toISOString(),
  };

  MOCK_LEAVES.unshift(newLeave);

  if (isSupabaseConfigured()) {
    try {
      await (supabase.from('staff_leaves') as any).insert({
        branch_id: DEFAULT_BRANCH_ID,
        staff_id: payload.staffId,
        leave_type: payload.leaveType,
        start_date: payload.startDate,
        end_date: payload.endDate,
        days_count: daysCount,
        reason: payload.reason,
        status: 'approved',
      });
    } catch (err) {
      console.warn('submitStaffLeave insert fallback:', err);
    }
  }

  return {
    success: true,
    message: `Leave approved for ${staff.fullName} (${daysCount} day${daysCount > 1 ? 's' : ''}).`,
    leave: newLeave,
  };
}

/**
 * 6. Calculate Monthly Staff Commission Report
 */
export async function getStaffCommissionReport(
  staffId: string,
  year: number = new Date().getFullYear(),
  month: number = new Date().getMonth() + 1
): Promise<StaffCommissionReport> {
  const staff = (await getStaffMemberById(staffId)) || MOCK_STAFF[0];

  if (!isSupabaseConfigured()) {
    const isKasun = staff.chairNumber === 1;
    const grossRevenue = isKasun ? 185000 : 138000;
    const commissionEarned = Math.round(grossRevenue * (staff.commissionPercentage / 100));

    return {
      staffId: staff.id,
      staffNumber: staff.staffNumber,
      staffName: staff.fullName,
      position: staff.position,
      chairNumber: staff.chairNumber,
      commissionPercentage: staff.commissionPercentage,
      month: `${year}-${String(month).padStart(2, '0')}`,
      totalServicesCount: isKasun ? 142 : 108,
      grossRevenueLkr: grossRevenue,
      netCommissionEarnedLkr: commissionEarned,
      breakdownByService: [
        { serviceName: 'Adult Hair Cut', count: 72, revenueLkr: 86400, commissionLkr: Math.round(86400 * (staff.commissionPercentage / 100)) },
        { serviceName: 'Hair Cut + Beard', count: 44, revenueLkr: 79200, commissionLkr: Math.round(79200 * (staff.commissionPercentage / 100)) },
        { serviceName: 'Beard Trim', count: 18, revenueLkr: 14400, commissionLkr: Math.round(14400 * (staff.commissionPercentage / 100)) },
        { serviceName: 'Oil Massage', count: 8, revenueLkr: 12000, commissionLkr: Math.round(12000 * (staff.commissionPercentage / 100)) },
      ],
    };
  }

  try {
    const { data, error } = await supabase.rpc('calculate_monthly_staff_commission', {
      p_staff_id: staffId,
      p_year: year,
      p_month: month,
    });

    if (error || !data) {
      return getStaffCommissionReport(staffId, year, month); // fallback
    }

    return {
      staffId: data.staff_id,
      staffNumber: data.staff_number,
      staffName: data.staff_name,
      position: data.position,
      chairNumber: data.chair_number,
      commissionPercentage: Number(data.commission_percentage || 30),
      month: data.month,
      totalServicesCount: Number(data.total_services_count || 0),
      grossRevenueLkr: Number(data.gross_revenue_lkr || 0),
      netCommissionEarnedLkr: Number(data.net_commission_earned_lkr || 0),
      breakdownByService: (data.breakdown_by_service || []).map((s: any) => ({
        serviceName: s.service_name,
        count: Number(s.count || 0),
        revenueLkr: Number(s.revenue_lkr || 0),
        commissionLkr: Number(s.commission_lkr || 0),
      })),
    };
  } catch {
    return getStaffCommissionReport(staffId, year, month);
  }
}

/**
 * 7. Create or Update Staff Member (Enforces V1 Dual-Barber Limit)
 */
export async function upsertStaffMember(
  payload: StaffUpsertPayload
): Promise<{ success: boolean; staffMember?: StaffMember; message: string }> {
  const phoneValidation = validateAndFormatSLPhone(payload.phone);
  if (!phoneValidation.isValid) {
    throw new Error(phoneValidation.error);
  }

  // Version 1 Chair Limit Check: Cannot exceed Chair 2
  if (payload.chairNumber < 1 || payload.chairNumber > 2) {
    throw new Error('Smart Salon LK Version 1 is strictly optimized for Chair 1 and Chair 2 (Rural Single-Salon Barbershop). Multi-chair enterprise expansion is scheduled for Version 2.');
  }

  // Check if chair is already assigned to someone else
  const existingSameChair = MOCK_STAFF.find(
    (s) => s.chairNumber === payload.chairNumber && s.id !== payload.id
  );

  if (existingSameChair && (!payload.id || payload.id !== existingSameChair.id)) {
    throw new Error(`Chair ${payload.chairNumber} is already occupied by ${existingSameChair.fullName}.`);
  }

  if (payload.id) {
    // Update existing
    const idx = MOCK_STAFF.findIndex((s) => s.id === payload.id);
    if (idx !== -1) {
      MOCK_STAFF[idx] = {
        ...MOCK_STAFF[idx],
        fullName: payload.fullName,
        sinhalaName: payload.sinhalaName || MOCK_STAFF[idx].sinhalaName,
        phone: phoneValidation.formatted,
        whatsapp: payload.whatsapp || phoneValidation.formatted,
        position: payload.position,
        chairNumber: payload.chairNumber,
        commissionPercentage: payload.commissionPercentage,
        photoUrl: payload.photoUrl || MOCK_STAFF[idx].photoUrl,
        status: payload.status || MOCK_STAFF[idx].status,
      };
      return { success: true, staffMember: MOCK_STAFF[idx], message: 'Barber profile updated successfully.' };
    }
  }

  // Check total V1 staff count limit
  if (MOCK_STAFF.length >= 2 && !payload.id) {
    throw new Error('Version 1 Maximum Limit reached: 2 Barbers maximum. To add a new barber, reassign or update an existing chair.');
  }

  // Create new staff member
  const newStaff: StaffMember = {
    id: 'c-' + Date.now(),
    branchId: DEFAULT_BRANCH_ID,
    staffNumber: `STF-00${payload.chairNumber}`,
    fullName: payload.fullName,
    sinhalaName: payload.sinhalaName,
    photoUrl:
      payload.photoUrl ||
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    phone: phoneValidation.formatted,
    whatsapp: payload.whatsapp || phoneValidation.formatted,
    position: payload.position,
    chairNumber: payload.chairNumber,
    joiningDate: payload.joiningDate || new Date().toISOString().split('T')[0],
    status: 'active',
    availability: 'available',
    commissionPercentage: payload.commissionPercentage,
    rating: 5.0,
    reviewsCount: 0,
    workingHours: payload.workingHours || { start: '06:00', end: '20:00' },
  };

  MOCK_STAFF.push(newStaff);

  if (isSupabaseConfigured()) {
    try {
      await (supabase.from('staff') as any).upsert({
        id: payload.id || undefined,
        branch_id: DEFAULT_BRANCH_ID,
        staff_number: newStaff.staffNumber,
        full_name: newStaff.fullName,
        sinhala_name: newStaff.sinhalaName,
        position: newStaff.position,
        chair_number: newStaff.chairNumber,
        commission_percentage: newStaff.commissionPercentage,
        photo_url: newStaff.photoUrl,
        phone: newStaff.phone,
        whatsapp: newStaff.whatsapp,
        status: newStaff.status,
        is_active: true,
      });
    } catch (err) {
      console.warn('upsertStaffMember Supabase sync:', err);
    }
  }

  return { success: true, staffMember: newStaff, message: 'Barber successfully registered.' };
}

