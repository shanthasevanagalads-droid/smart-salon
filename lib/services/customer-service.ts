import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  CustomerSummary,
  CustomerDashboardData,
  CustomerUpsertPayload,
  CustomerAnalyticsData,
  CustomerStatus,
} from '@/types/crm';
import { validateAndFormatSLPhone } from '@/lib/security/validation';

const DEFAULT_BRANCH_ID =
  process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID || 'b0000000-0000-0000-0000-000000000001';

// In-memory demo store for testing without active Supabase backend
const MOCK_CUSTOMERS: CustomerSummary[] = [
  {
    id: 'd1111111-1111-1111-1111-111111111111',
    customerNumber: 'CUST-00001',
    name: 'Kasun Chamara',
    mobile: '+94771234567',
    whatsapp: '+94771234567',
    status: 'active',
    totalVisits: 14,
    totalSpending: 24500,
    lastVisit: new Date(Date.now() - 3 * 86400000).toISOString(),
    preferredBarberName: 'Master Kavi',
    notes: 'Prefers zero fade on sides, warm towel, no menthol',
    isVip: true,
  },
  {
    id: 'd2222222-2222-2222-2222-222222222222',
    customerNumber: 'CUST-00002',
    name: 'Dineth Perera',
    mobile: '+94719876543',
    whatsapp: '+94719876543',
    status: 'active',
    totalVisits: 8,
    totalSpending: 12400,
    lastVisit: new Date(Date.now() - 7 * 86400000).toISOString(),
    preferredBarberName: 'Sunil Shantha',
    notes: 'Beard trim + shapeup only',
    isVip: false,
  },
  {
    id: 'd3333333-3333-3333-3333-333333333333',
    customerNumber: 'CUST-00003',
    name: 'Ruwan Wijesinghe',
    mobile: '+94723456789',
    whatsapp: '+94723456789',
    status: 'active',
    totalVisits: 22,
    totalSpending: 38900,
    lastVisit: new Date(Date.now() - 1 * 86400000).toISOString(),
    preferredBarberName: 'Master Kavi',
    notes: 'Executive haircut and scalp oil massage',
    isVip: true,
  },
  {
    id: 'd4444444-4444-4444-4444-444444444444',
    customerNumber: 'CUST-00004',
    name: 'Asanka Silva',
    mobile: '+94751122334',
    whatsapp: '+94751122334',
    status: 'inactive',
    totalVisits: 2,
    totalSpending: 2400,
    lastVisit: new Date(Date.now() - 45 * 86400000).toISOString(),
    preferredBarberName: 'Sunil Shantha',
    notes: '',
    isVip: false,
  },
  {
    id: 'd5555555-5555-5555-5555-555555555555',
    customerNumber: 'CUST-00005',
    name: 'Pradeep Kumara',
    mobile: '+94784455667',
    whatsapp: '+94784455667',
    status: 'blocked',
    totalVisits: 1,
    totalSpending: 1200,
    lastVisit: new Date(Date.now() - 80 * 86400000).toISOString(),
    notes: 'Repeated no-shows and queue ticket spam',
    isVip: false,
  },
];

/**
 * Fast search customers across name, mobile, whatsapp, customer_number
 */
export async function searchCustomers(
  query = '',
  status?: CustomerStatus,
  limit = 25,
  branchId = DEFAULT_BRANCH_ID
): Promise<CustomerSummary[]> {
  if (!isSupabaseConfigured()) {
    let results = [...MOCK_CUSTOMERS];
    if (status) {
      results = results.filter((c) => c.status === status);
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      results = results.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.mobile.includes(q) ||
          c.whatsapp.includes(q) ||
          c.customerNumber.toLowerCase().includes(q)
      );
    }
    return results.slice(0, limit);
  }

  const { data, error } = await supabase.rpc('search_salon_customers', {
    p_branch_id: branchId,
    p_query: query.trim(),
    p_status: status || null,
    p_limit: limit,
  });

  if (error || !data) {
    console.error('Error searching customers:', error);
    return [];
  }

  return data.map((item: {
    id: string;
    customer_number: string;
    name: string;
    mobile: string;
    whatsapp: string;
    status: string;
    total_visits: number;
    total_spending: number;
    last_visit: string | null;
    preferred_barber_name: string | null;
    notes: string | null;
    is_vip: boolean;
  }) => ({
    id: item.id,
    customerNumber: item.customer_number,
    name: item.name,
    mobile: item.mobile,
    whatsapp: item.whatsapp,
    status: (item.status as CustomerStatus) || 'active',
    totalVisits: Number(item.total_visits || 0),
    totalSpending: Number(item.total_spending || 0),
    lastVisit: item.last_visit,
    preferredBarberName: item.preferred_barber_name,
    notes: item.notes,
    isVip: Boolean(item.is_vip),
  }));
}

/**
 * Register or update customer (One Phone Number = One Customer)
 */
export async function upsertCustomer(payload: CustomerUpsertPayload) {
  const phoneValidation = validateAndFormatSLPhone(payload.phone);
  if (!phoneValidation.isValid) {
    throw new Error(phoneValidation.error || 'Invalid Sri Lankan phone number.');
  }

  const branchId = payload.branchId || DEFAULT_BRANCH_ID;

  if (!isSupabaseConfigured()) {
    const existingIndex = MOCK_CUSTOMERS.findIndex(
      (c) => c.mobile === phoneValidation.formatted || c.whatsapp === phoneValidation.formatted
    );

    if (existingIndex >= 0) {
      MOCK_CUSTOMERS[existingIndex] = {
        ...MOCK_CUSTOMERS[existingIndex],
        name: payload.name || MOCK_CUSTOMERS[existingIndex].name,
        notes: payload.notes || MOCK_CUSTOMERS[existingIndex].notes,
        status: payload.status || MOCK_CUSTOMERS[existingIndex].status,
      };
      return {
        success: true,
        isNew: false,
        customer: MOCK_CUSTOMERS[existingIndex],
      };
    }

    const newCustomer: CustomerSummary = {
      id: `mock-cust-${Date.now()}`,
      customerNumber: `CUST-0000${MOCK_CUSTOMERS.length + 1}`,
      name: payload.name,
      mobile: phoneValidation.formatted,
      whatsapp: payload.whatsapp ? validateAndFormatSLPhone(payload.whatsapp).formatted : phoneValidation.formatted,
      status: payload.status || 'active',
      totalVisits: 0,
      totalSpending: 0,
      lastVisit: null,
      notes: payload.notes || null,
      isVip: false,
    };
    MOCK_CUSTOMERS.unshift(newCustomer);
    return { success: true, isNew: true, customer: newCustomer };
  }

  const { data, error } = await supabase.rpc('upsert_salon_customer', {
    p_branch_id: branchId,
    p_name: payload.name,
    p_phone: phoneValidation.formatted,
    p_whatsapp: payload.whatsapp || phoneValidation.formatted,
    p_preferred_barber_id: payload.preferredBarberId || null,
    p_notes: payload.notes || null,
    p_address: payload.address || null,
    p_date_of_birth: payload.dateOfBirth || null,
    p_language: payload.language || 'si',
    p_status: payload.status || 'active',
  });

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save customer.');
  }

  return {
    success: data.success,
    isNew: data.is_new,
    customer: data.customer,
  };
}

/**
 * Fetch detailed customer profile with metrics & history
 */
export async function getCustomerDashboardProfile(customerId: string): Promise<CustomerDashboardData> {
  if (!isSupabaseConfigured()) {
    const found = MOCK_CUSTOMERS.find((c) => c.id === customerId) || MOCK_CUSTOMERS[0];
    return {
      profile: {
        id: found.id,
        customerNumber: found.customerNumber,
        name: found.name,
        mobile: found.mobile,
        whatsapp: found.whatsapp,
        status: found.status,
        notes: found.notes,
        isVip: found.isVip,
        preferredLanguage: 'si',
        preferredBarberName: found.preferredBarberName,
        createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      },
      metrics: {
        totalSpending: found.totalSpending,
        totalVisits: found.totalVisits,
        lastVisit: found.lastVisit,
        upcomingAppointments: 1,
        completedVisits: found.totalVisits,
        cancelledVisits: 0,
        favouriteService: 'Hair Cut + Beard',
      },
      visitHistory: [
        {
          invoiceId: 'inv-001',
          invoiceNumber: 'INV-2026-000142',
          visitDate: found.lastVisit || new Date().toISOString(),
          grandTotal: 1800,
          paymentMethod: 'cash',
          barberName: found.preferredBarberName || 'Master Kavi',
          services: ['Hair Cut + Beard', 'Hot Towel Finish'],
        },
        {
          invoiceId: 'inv-002',
          invoiceNumber: 'INV-2026-000088',
          visitDate: new Date(Date.now() - 25 * 86400000).toISOString(),
          grandTotal: 1200,
          paymentMethod: 'lankaqr',
          barberName: 'Master Kavi',
          services: ['Adult Hair Cut'],
        },
      ],
    };
  }

  const { data, error } = await supabase.rpc('get_customer_dashboard_profile', {
    p_customer_id: customerId,
  });

  if (error || !data || data.error) {
    throw new Error(error?.message || data?.error || 'Customer profile not found.');
  }

  return {
    profile: {
      id: data.profile.id,
      customerNumber: data.profile.customer_number,
      name: data.profile.name,
      mobile: data.profile.mobile,
      whatsapp: data.profile.whatsapp,
      dateOfBirth: data.profile.date_of_birth,
      address: data.profile.address,
      preferredLanguage: data.profile.preferred_language,
      status: data.profile.status,
      notes: data.profile.notes,
      isVip: data.profile.is_vip,
      preferredBarberId: data.profile.preferred_barber_id,
      preferredBarberName: data.profile.preferred_barber_name,
      createdAt: data.profile.created_at,
    },
    metrics: {
      totalSpending: Number(data.metrics.total_spending || 0),
      totalVisits: Number(data.metrics.total_visits || 0),
      lastVisit: data.metrics.last_visit,
      upcomingAppointments: Number(data.metrics.upcoming_appointments || 0),
      completedVisits: Number(data.metrics.completed_visits || 0),
      cancelledVisits: Number(data.metrics.cancelled_visits || 0),
      favouriteService: data.metrics.favourite_service,
    },
    visitHistory: (data.visit_history || []).map((v: {
      invoice_id: string;
      invoice_number: string;
      visit_date: string;
      grand_total: number;
      payment_method: string;
      barber_name: string;
      services: string[];
    }) => ({
      invoiceId: v.invoice_id,
      invoiceNumber: v.invoice_number,
      visitDate: v.visit_date,
      grandTotal: Number(v.grand_total || 0),
      paymentMethod: v.payment_method,
      barberName: v.barber_name,
      services: v.services || [],
    })),
  };
}

/**
 * Fetch CRM Reporting & Customer Analytics
 */
export async function getCustomerAnalytics(branchId = DEFAULT_BRANCH_ID): Promise<CustomerAnalyticsData> {
  const getFallbackAnalytics = (): CustomerAnalyticsData => ({
    overview: {
      totalCustomers: MOCK_CUSTOMERS.length,
      newThisMonth: 2,
      returningCustomers: 3,
      retentionRatePct: 60.0,
      activeCustomers: MOCK_CUSTOMERS.filter((c) => c.status === 'active').length,
      inactiveCustomers: MOCK_CUSTOMERS.filter((c) => c.status === 'inactive').length,
      blockedCustomers: MOCK_CUSTOMERS.filter((c) => c.status === 'blocked').length,
    },
    mostValuableCustomers: [...MOCK_CUSTOMERS]
      .sort((a, b) => b.totalSpending - a.totalSpending)
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        customerNumber: c.customerNumber,
        name: c.name,
        mobile: c.mobile,
        totalSpending: c.totalSpending,
        totalVisits: c.totalVisits,
        lastVisit: c.lastVisit,
      })),
    mostFrequentCustomers: [...MOCK_CUSTOMERS]
      .sort((a, b) => b.totalVisits - a.totalVisits)
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        customerNumber: c.customerNumber,
        name: c.name,
        mobile: c.mobile,
        totalVisits: c.totalVisits,
        totalSpending: c.totalSpending,
        lastVisit: c.lastVisit,
      })),
  });

  if (!isSupabaseConfigured() || !supabase) {
    return getFallbackAnalytics();
  }

  try {
    const { data, error } = await supabase.rpc('get_crm_customer_analytics', {
      p_branch_id: branchId,
    });

    if (error || !data) {
      console.warn('Notice: get_crm_customer_analytics unavailable, using fallback:', error?.message);
      return getFallbackAnalytics();
    }

    return {
      overview: {
        totalCustomers: Number(data.overview?.total_customers || 0),
        newThisMonth: Number(data.overview?.new_this_month || 0),
        returningCustomers: Number(data.overview?.returning_customers || 0),
        retentionRatePct: Number(data.overview?.retention_rate_pct || 0),
        activeCustomers: Number(data.overview?.active_customers || 0),
        inactiveCustomers: Number(data.overview?.inactive_customers || 0),
        blockedCustomers: Number(data.overview?.blocked_customers || 0),
      },
      mostValuableCustomers: (data.most_valuable_customers || []).map((c: any) => ({
        id: c.id,
        customerNumber: c.customer_number || c.customerNumber || '',
        name: c.name || '',
        mobile: c.mobile || '',
        totalSpending: Number(c.total_spending ?? c.totalSpending ?? 0),
        totalVisits: Number(c.total_visits ?? c.totalVisits ?? 0),
        lastVisit: c.last_visit ?? c.lastVisit ?? null,
      })),
      mostFrequentCustomers: (data.most_frequent_customers || []).map((c: any) => ({
        id: c.id,
        customerNumber: c.customer_number || c.customerNumber || '',
        name: c.name || '',
        mobile: c.mobile || '',
        totalVisits: Number(c.total_visits ?? c.totalVisits ?? 0),
        totalSpending: Number(c.total_spending ?? c.totalSpending ?? 0),
        lastVisit: c.last_visit ?? c.lastVisit ?? null,
      })),
    };
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_')) {
      throw err;
    }
    console.warn('Customer analytics exception, using fallback:', err?.message || err);
    return getFallbackAnalytics();
  }
}

