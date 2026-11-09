// ========================================================================
// SMART SALON LK - BUSINESS INTELLIGENCE & ANALYTICS SERVICE
// PostgreSQL RPCs + Offline Resilient Fallback Engine with CSV Exporting
// ========================================================================

import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  BiDashboardOverview,
  BiFinancialReport,
  BiCustomerAnalytics,
  BiBarberPerformanceReport,
  BiQueueTrafficReport,
  BiServiceItemReport,
} from '@/types/analytics';

const DEFAULT_BRANCH_ID =
  process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID || 'b0000000-0000-0000-0000-000000000001';

// ------------------------------------------------------------------------
// IN-MEMORY REALISTIC FALLBACK DATA FOR ZERO-DOWNTIME DEMOS
// ------------------------------------------------------------------------
const getIsoDate = (offsetDays: number = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().split('T')[0];
};

const FALLBACK_OVERVIEW: BiDashboardOverview = {
  date: getIsoDate(0),
  todayRevenue: 38400,
  yesterdayRevenue: 34200,
  revenueGrowthPct: 12.28,
  todayInvoices: 24,
  avgInvoiceValue: 1600,
  todayCustomers: 26,
  walkInsCount: 16,
  appointmentsCount: 10,
  queueSummary: {
    waiting: 3,
    inService: 2,
    completed: 21,
    avgWaitMinutes: 18,
  },
  pendingPayments: {
    count: 1,
    amount: 1800,
  },
  paymentMethods: [
    { paymentMethod: 'cash', transactionCount: 14, totalAmount: 21400, percentage: 55.7 },
    { paymentMethod: 'lankaqr', transactionCount: 6, totalAmount: 11200, percentage: 29.2 },
    { paymentMethod: 'card', transactionCount: 4, totalAmount: 5800, percentage: 15.1 },
  ],
  barberActivity: [
    {
      staffId: 'c0000000-0000-0000-0000-000000000001',
      barberName: 'Master Kavi (Chief Stylist)',
      chairNumber: 1,
      availability: 'busy',
      activeTicket: 'LK-20261103-007',
      activeCustomer: 'Kasun Perera',
      activeService: 'Hair Cut + Beard Combo',
      servicePrice: 1800,
    },
    {
      staffId: 'c0000000-0000-0000-0000-000000000002',
      barberName: 'Sunil Shantha (Beard Artisan)',
      chairNumber: 2,
      availability: 'busy',
      activeTicket: 'LK-20261103-008',
      activeCustomer: 'Ruwan Pradeep',
      activeService: 'Adult Hair Cut + Head Massage',
      servicePrice: 2400,
    },
  ],
};

const FALLBACK_FINANCIAL_TREND: BiFinancialReport = {
  startDate: getIsoDate(13),
  endDate: getIsoDate(0),
  totalRevenue: 432800,
  totalInvoices: 271,
  totalDiscounts: 14200,
  avgOrderValue: 1597,
  dailyTrend: [
    { reportDate: getIsoDate(13), totalInvoices: 18, grossSales: 29800, totalDiscounts: 800, netRevenue: 29000, avgInvoiceValue: 1611, cashRevenue: 18000, lankaqrRevenue: 7000, cardRevenue: 4000 },
    { reportDate: getIsoDate(12), totalInvoices: 20, grossSales: 32400, totalDiscounts: 1000, netRevenue: 31400, avgInvoiceValue: 1570, cashRevenue: 20000, lankaqrRevenue: 7400, cardRevenue: 4000 },
    { reportDate: getIsoDate(11), totalInvoices: 22, grossSales: 36200, totalDiscounts: 1200, netRevenue: 35000, avgInvoiceValue: 1590, cashRevenue: 21000, lankaqrRevenue: 9000, cardRevenue: 5000 },
    { reportDate: getIsoDate(10), totalInvoices: 19, grossSales: 31000, totalDiscounts: 600, netRevenue: 30400, avgInvoiceValue: 1600, cashRevenue: 17000, lankaqrRevenue: 8400, cardRevenue: 5000 },
    { reportDate: getIsoDate(9), totalInvoices: 21, grossSales: 33800, totalDiscounts: 1000, netRevenue: 32800, avgInvoiceValue: 1561, cashRevenue: 19000, lankaqrRevenue: 8800, cardRevenue: 5000 },
    { reportDate: getIsoDate(8), totalInvoices: 26, grossSales: 43000, totalDiscounts: 1500, netRevenue: 41500, avgInvoiceValue: 1596, cashRevenue: 24000, lankaqrRevenue: 11500, cardRevenue: 6000 },
    { reportDate: getIsoDate(7), totalInvoices: 28, grossSales: 46800, totalDiscounts: 1800, netRevenue: 45000, avgInvoiceValue: 1607, cashRevenue: 26000, lankaqrRevenue: 12000, cardRevenue: 7000 },
    { reportDate: getIsoDate(6), totalInvoices: 17, grossSales: 27500, totalDiscounts: 700, netRevenue: 26800, avgInvoiceValue: 1576, cashRevenue: 16000, lankaqrRevenue: 6800, cardRevenue: 4000 },
    { reportDate: getIsoDate(5), totalInvoices: 19, grossSales: 30600, totalDiscounts: 900, netRevenue: 29700, avgInvoiceValue: 1563, cashRevenue: 18000, lankaqrRevenue: 7700, cardRevenue: 4000 },
    { reportDate: getIsoDate(4), totalInvoices: 21, grossSales: 34200, totalDiscounts: 1100, netRevenue: 33100, avgInvoiceValue: 1576, cashRevenue: 19000, lankaqrRevenue: 9100, cardRevenue: 5000 },
    { reportDate: getIsoDate(3), totalInvoices: 20, grossSales: 32600, totalDiscounts: 800, netRevenue: 31800, avgInvoiceValue: 1590, cashRevenue: 18000, lankaqrRevenue: 8800, cardRevenue: 5000 },
    { reportDate: getIsoDate(2), totalInvoices: 24, grossSales: 39000, totalDiscounts: 1200, netRevenue: 37800, avgInvoiceValue: 1575, cashRevenue: 22000, lankaqrRevenue: 10800, cardRevenue: 5000 },
    { reportDate: getIsoDate(1), totalInvoices: 22, grossSales: 35500, totalDiscounts: 1300, netRevenue: 34200, avgInvoiceValue: 1554, cashRevenue: 19000, lankaqrRevenue: 10200, cardRevenue: 5000 },
    { reportDate: getIsoDate(0), totalInvoices: 24, grossSales: 39600, totalDiscounts: 1200, netRevenue: 38400, avgInvoiceValue: 1600, cashRevenue: 21400, lankaqrRevenue: 11200, cardRevenue: 5800 },
  ],
  methodSummary: [
    { paymentMethod: 'cash', transactions: 158, totalAmount: 242400, sharePct: 56.0 },
    { paymentMethod: 'lankaqr', transactions: 74, totalAmount: 124700, sharePct: 28.8 },
    { paymentMethod: 'card', transactions: 39, totalAmount: 65700, sharePct: 15.2 },
  ],
};

const FALLBACK_CUSTOMERS: BiCustomerAnalytics = {
  totalCustomers: 184,
  newCustomers: 46,
  returningCustomers: 138,
  retentionRatePct: 75.0,
  topSpenders: [
    { id: 'c1', customerNumber: 'CUST-0001', name: 'Kasun Perera', mobile: '+94771234567', totalVisits: 14, totalSpending: 24800, isVip: true, lastVisitAt: getIsoDate(2), preferredBarber: 'Master Kavi' },
    { id: 'c2', customerNumber: 'CUST-0002', name: 'Ruwan Pradeep', mobile: '+94712345678', totalVisits: 9, totalSpending: 16400, isVip: true, lastVisitAt: getIsoDate(0), preferredBarber: 'Sunil Shantha' },
    { id: 'c3', customerNumber: 'CUST-0003', name: 'Dinesh Kumara', mobile: '+94761234567', totalVisits: 8, totalSpending: 14200, isVip: false, lastVisitAt: getIsoDate(3), preferredBarber: 'Master Kavi' },
    { id: 'c4', customerNumber: 'CUST-0004', name: 'Nuwan Jayasinghe', mobile: '+94778899001', totalVisits: 7, totalSpending: 12600, isVip: true, lastVisitAt: getIsoDate(5), preferredBarber: 'Sunil Shantha' },
    { id: 'c5', customerNumber: 'CUST-0005', name: 'Charith Dilshan', mobile: '+94769876543', totalVisits: 6, totalSpending: 10800, isVip: false, lastVisitAt: getIsoDate(6), preferredBarber: 'Master Kavi' },
  ],
};

const FALLBACK_BARBERS: BiBarberPerformanceReport = {
  startDate: getIsoDate(30),
  endDate: getIsoDate(0),
  barbers: [
    {
      staffId: 'c0000000-0000-0000-0000-000000000001',
      barberName: 'Master Kavi (Chair 01)',
      chairNumber: 1,
      commissionPercentage: 35.0,
      servicesCompleted: 248,
      revenueGenerated: 278400,
      commissionEarned: 97440,
      avgDurationMinutes: 24.5,
      uniqueClients: 142,
    },
    {
      staffId: 'c0000000-0000-0000-0000-000000000002',
      barberName: 'Sunil Shantha (Chair 02)',
      chairNumber: 2,
      commissionPercentage: 30.0,
      servicesCompleted: 196,
      revenueGenerated: 194800,
      commissionEarned: 58440,
      avgDurationMinutes: 21.0,
      uniqueClients: 118,
    },
  ],
};

const FALLBACK_SERVICES: BiServiceItemReport[] = [
  { serviceId: 's1', serviceName: 'Adult Hair Cut', serviceSinhalaName: 'වැඩිහිටි කොණ්ඩ කැපීම', category: 'haircut', totalExecuted: 194, unitsSold: 194, totalRevenue: 232800, avgPrice: 1200, avgDurationMinutes: 30 },
  { serviceId: 's2', serviceName: 'Hair Cut + Beard Combo', serviceSinhalaName: 'කොණ්ඩය සහ රැවුල පැකේජය', category: 'combo', totalExecuted: 112, unitsSold: 112, totalRevenue: 201600, avgPrice: 1800, avgDurationMinutes: 45 },
  { serviceId: 's3', serviceName: 'Beard Trim & Lineup', serviceSinhalaName: 'රැවුල හැඩගැන්වීම සහ රේසර් ලයින්', category: 'beard', totalExecuted: 88, unitsSold: 88, totalRevenue: 70400, avgPrice: 800, avgDurationMinutes: 20 },
  { serviceId: 's4', serviceName: 'Hair Dye / Treatment', serviceSinhalaName: 'කොණ්ඩය ඩයි කිරීම', category: 'treatment', totalExecuted: 28, unitsSold: 28, totalRevenue: 61600, avgPrice: 2200, avgDurationMinutes: 40 },
  { serviceId: 's5', serviceName: 'Ayurvedic Oil Therapy', serviceSinhalaName: 'ආයුර්වේද තෙල් සම්බාහනය', category: 'treatment', totalExecuted: 22, unitsSold: 22, totalRevenue: 33000, avgPrice: 1500, avgDurationMinutes: 25 },
];

const FALLBACK_QUEUE_TRAFFIC: BiQueueTrafficReport = {
  startDate: getIsoDate(7),
  endDate: getIsoDate(0),
  walkInTotal: 124,
  appointmentTotal: 68,
  walkInRatioPct: 64.6,
  hourlyDistribution: [
    { hourNum: 6, hourLabel: '06 AM', customerCount: 4, walkIns: 3, appointments: 1, avgWaitMinutes: 8 },
    { hourNum: 7, hourLabel: '07 AM', customerCount: 8, walkIns: 6, appointments: 2, avgWaitMinutes: 12 },
    { hourNum: 8, hourLabel: '08 AM', customerCount: 14, walkIns: 9, appointments: 5, avgWaitMinutes: 18 },
    { hourNum: 9, hourLabel: '09 AM', customerCount: 18, walkIns: 11, appointments: 7, avgWaitMinutes: 22 },
    { hourNum: 10, hourLabel: '10 AM', customerCount: 22, walkIns: 14, appointments: 8, avgWaitMinutes: 28 },
    { hourNum: 11, hourLabel: '11 AM', customerCount: 20, walkIns: 13, appointments: 7, avgWaitMinutes: 25 },
    { hourNum: 12, hourLabel: '12 PM', customerCount: 12, walkIns: 8, appointments: 4, avgWaitMinutes: 15 },
    { hourNum: 13, hourLabel: '01 PM', customerCount: 8, walkIns: 6, appointments: 2, avgWaitMinutes: 10 },
    { hourNum: 14, hourLabel: '02 PM', customerCount: 10, walkIns: 7, appointments: 3, avgWaitMinutes: 14 },
    { hourNum: 15, hourLabel: '03 PM', customerCount: 14, walkIns: 9, appointments: 5, avgWaitMinutes: 18 },
    { hourNum: 16, hourLabel: '04 PM', customerCount: 24, walkIns: 15, appointments: 9, avgWaitMinutes: 30 },
    { hourNum: 17, hourLabel: '05 PM', customerCount: 26, walkIns: 16, appointments: 10, avgWaitMinutes: 32 },
    { hourNum: 18, hourLabel: '06 PM', customerCount: 28, walkIns: 18, appointments: 10, avgWaitMinutes: 35 },
    { hourNum: 19, hourLabel: '07 PM', customerCount: 16, walkIns: 11, appointments: 5, avgWaitMinutes: 20 },
    { hourNum: 20, hourLabel: '08 PM', customerCount: 6, walkIns: 5, appointments: 1, avgWaitMinutes: 10 },
  ],
};

// ------------------------------------------------------------------------
// BUSINESS INTELLIGENCE SERVICE IMPLEMENTATION
// ------------------------------------------------------------------------
export class AnalyticsService {
  /**
   * 1. Executive Dashboard Overview (Today's Key Metrics)
   */
  static async getOverview(branchId = DEFAULT_BRANCH_ID, date?: string): Promise<BiDashboardOverview> {
    const targetDate = date || getIsoDate(0);

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_get_bi_dashboard_overview', {
          p_branch_id: branchId,
          p_date: targetDate,
        });

        if (!error && data) {
          return {
            date: data.date,
            todayRevenue: Number(data.today_revenue || 0),
            yesterdayRevenue: Number(data.yesterday_revenue || 0),
            revenueGrowthPct: Number(data.revenue_growth_pct || 0),
            todayInvoices: Number(data.today_invoices || 0),
            avgInvoiceValue: Number(data.avg_invoice_value || 0),
            todayCustomers: Number(data.today_customers || 0),
            walkInsCount: Number(data.walk_ins_count || 0),
            appointmentsCount: Number(data.appointments_count || 0),
            queueSummary: {
              waiting: data.queue_summary?.waiting || 0,
              inService: data.queue_summary?.in_service || 0,
              completed: data.queue_summary?.completed || 0,
              avgWaitMinutes: data.queue_summary?.avg_wait_minutes || 0,
            },
            pendingPayments: {
              count: data.pending_payments?.count || 0,
              amount: Number(data.pending_payments?.amount || 0),
            },
            paymentMethods: (data.payment_methods || []).map((pm: any) => ({
              paymentMethod: pm.payment_method || pm.paymentMethod || 'cash',
              transactionCount: Number(pm.transaction_count ?? pm.transactionCount ?? pm.transactions ?? 0),
              totalAmount: Number(pm.total_amount ?? pm.totalAmount ?? pm.amount ?? 0),
              percentage: Number(pm.percentage ?? pm.share_pct ?? pm.sharePct ?? 0),
            })),
            barberActivity: (data.barber_activity || []).map((ba: any) => ({
              staffId: ba.staff_id || ba.staffId || '',
              barberName: ba.barber_name || ba.barberName || '',
              chairNumber: Number(ba.chair_number ?? ba.chairNumber ?? 1),
              availability: ba.availability || 'available',
              activeTicket: ba.active_ticket ?? ba.activeTicket ?? null,
              activeCustomer: ba.active_customer ?? ba.activeCustomer ?? null,
              activeService: ba.active_service ?? ba.activeService ?? null,
              servicePrice: Number(ba.service_price ?? ba.servicePrice ?? 0),
            })),
          };
        }
      } catch (err: any) {
        console.warn('[AnalyticsService] getOverview error, using fallback:', err.message);
      }
    }

    return { ...FALLBACK_OVERVIEW, date: targetDate };
  }

  /**
   * 2. Financial Sales & Revenue Trends Report
   */
  static async getFinancialReport(
    branchId = DEFAULT_BRANCH_ID,
    startDate?: string,
    endDate?: string
  ): Promise<BiFinancialReport> {
    const sDate = startDate || getIsoDate(13);
    const eDate = endDate || getIsoDate(0);

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_get_bi_financial_report', {
          p_branch_id: branchId,
          p_start_date: sDate,
          p_end_date: eDate,
        });

        if (!error && data) {
          return {
            startDate: data.start_date,
            endDate: data.end_date,
            totalRevenue: Number(data.total_revenue || 0),
            totalInvoices: Number(data.total_invoices || 0),
            totalDiscounts: Number(data.total_discounts || 0),
            avgOrderValue: Number(data.avg_order_value || 0),
            dailyTrend: (data.daily_trend || data.dailyTrend || []).map((dt: any) => ({
              reportDate: String(dt.report_date ?? dt.reportDate ?? dt.date ?? ''),
              totalInvoices: Number(dt.total_invoices ?? dt.totalInvoices ?? dt.invoices ?? 0),
              grossSales: Number(dt.gross_sales ?? dt.grossSales ?? 0),
              totalDiscounts: Number(dt.total_discounts ?? dt.totalDiscounts ?? dt.discounts ?? 0),
              netRevenue: Number(dt.net_revenue ?? dt.netRevenue ?? dt.revenue ?? 0),
              avgInvoiceValue: Number(dt.avg_invoice_value ?? dt.avgInvoiceValue ?? dt.aov ?? 0),
              cashRevenue: Number(dt.cash_revenue ?? dt.cashRevenue ?? dt.cash ?? 0),
              lankaqrRevenue: Number(dt.lankaqr_revenue ?? dt.lankaqrRevenue ?? dt.lankaqr ?? 0),
              cardRevenue: Number(dt.card_revenue ?? dt.cardRevenue ?? dt.card ?? 0),
            })),
            methodSummary: (data.method_summary || []).map((ms: any) => ({
              paymentMethod: ms.payment_method || ms.paymentMethod || 'cash',
              transactions: Number(ms.transactions ?? ms.count ?? 0),
              totalAmount: Number(ms.total_amount ?? ms.totalAmount ?? ms.amount ?? 0),
              sharePct: Number(ms.share_pct ?? ms.sharePct ?? ms.percentage ?? 0),
            })),
          };
        }
      } catch (err: any) {
        console.warn('[AnalyticsService] getFinancialReport error, using fallback:', err.message);
      }
    }

    return FALLBACK_FINANCIAL_TREND;
  }

  /**
   * 3. Customer Retention & VIP Spenders Report
   */
  static async getCustomerAnalytics(
    branchId = DEFAULT_BRANCH_ID,
    startDate?: string,
    endDate?: string
  ): Promise<BiCustomerAnalytics> {
    const sDate = startDate || getIsoDate(30);
    const eDate = endDate || getIsoDate(0);

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_get_bi_customer_analytics', {
          p_branch_id: branchId,
          p_start_date: sDate,
          p_end_date: eDate,
        });

        if (!error && data) {
          return {
            totalCustomers: Number(data.total_customers ?? data.totalCustomers ?? 0),
            newCustomers: Number(data.new_customers ?? data.newCustomers ?? 0),
            returningCustomers: Number(data.returning_customers ?? data.returningCustomers ?? 0),
            retentionRatePct: Number(data.retention_rate_pct ?? data.retentionRatePct ?? 0),
            topSpenders: (data.top_spenders || []).map((c: any) => ({
              id: c.id || `c-${Math.random()}`,
              customerNumber: c.customer_number || c.customerNumber || 'CUST-0000',
              name: c.name || c.full_name || 'Customer',
              mobile: c.mobile || c.phone || '',
              totalVisits: Number(c.total_visits ?? c.totalVisits ?? 0),
              totalSpending: Number(c.total_spending ?? c.totalSpending ?? c.spending ?? 0),
              isVip: Boolean(c.is_vip ?? c.isVip),
              lastVisitAt: c.last_visit_at || c.last_visit || c.lastVisitAt || '',
              preferredBarber: c.preferred_barber || c.preferredBarber || c.preferred_barber_name || null,
            })),
          };
        }
      } catch (err: any) {
        console.warn('[AnalyticsService] getCustomerAnalytics error, using fallback:', err.message);
      }
    }

    return FALLBACK_CUSTOMERS;
  }

  /**
   * 4. Barber Station Productivity & Commission Report
   */
  static async getBarberPerformance(
    branchId = DEFAULT_BRANCH_ID,
    startDate?: string,
    endDate?: string
  ): Promise<BiBarberPerformanceReport> {
    const sDate = startDate || getIsoDate(30);
    const eDate = endDate || getIsoDate(0);

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_get_bi_barber_performance', {
          p_branch_id: branchId,
          p_start_date: sDate,
          p_end_date: eDate,
        });

        if (!error && data) {
          return {
            startDate: data.start_date,
            endDate: data.end_date,
            barbers: (data.barbers || []).map((b: any) => ({
              staffId: b.staff_id,
              barberName: b.barber_name,
              chairNumber: b.chair_number,
              commissionPercentage: Number(b.commission_percentage || 30),
              servicesCompleted: Number(b.services_completed || 0),
              revenueGenerated: Number(b.revenue_generated || 0),
              commissionEarned: Number(b.commission_earned || 0),
              avgDurationMinutes: Number(b.avg_duration_minutes || 22),
              uniqueClients: Number(b.unique_clients || 0),
            })),
          };
        }
      } catch (err: any) {
        console.warn('[AnalyticsService] getBarberPerformance error, using fallback:', err.message);
      }
    }

    return FALLBACK_BARBERS;
  }

  /**
   * 5. Queue Traffic & Peak Business Hours Heatmap
   */
  static async getQueueTraffic(
    branchId = DEFAULT_BRANCH_ID,
    startDate?: string,
    endDate?: string
  ): Promise<BiQueueTrafficReport> {
    const sDate = startDate || getIsoDate(7);
    const eDate = endDate || getIsoDate(0);

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_get_bi_queue_traffic', {
          p_branch_id: branchId,
          p_start_date: sDate,
          p_end_date: eDate,
        });

        if (!error && data) {
          return {
            startDate: data.start_date,
            endDate: data.end_date,
            walkInTotal: Number(data.walk_in_total || 0),
            appointmentTotal: Number(data.appointment_total || 0),
            walkInRatioPct: Number(data.walk_in_ratio_pct ?? data.walkInRatioPct ?? 65),
            hourlyDistribution: (data.hourly_distribution || []).map((h: any) => ({
              hourNum: Number(h.hour_num ?? h.hourNum ?? 0),
              hourLabel: h.hour_label || h.hourLabel || `${h.hour_num ?? h.hourNum ?? 0}:00`,
              customerCount: Number(h.customer_count ?? h.customerCount ?? 0),
              walkIns: Number(h.walk_ins ?? h.walkIns ?? 0),
              appointments: Number(h.appointments ?? 0),
              avgWaitMinutes: Number(h.avg_wait_minutes ?? h.avgWaitMinutes ?? 0),
            })),
          };
        }
      } catch (err: any) {
        console.warn('[AnalyticsService] getQueueTraffic error, using fallback:', err.message);
      }
    }

    return FALLBACK_QUEUE_TRAFFIC;
  }

  /**
   * 6. Service Popularity & Revenue Matrix
   */
  static async getServicePerformance(): Promise<BiServiceItemReport[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('vw_service_performance_summary')
          .select('*')
          .order('total_revenue', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((d: any, idx: number) => ({
            serviceId: d.service_id || d.id || `svc-${idx}-${encodeURIComponent(d.service_name || d.name || 'custom')}`,
            serviceName: d.service_name || d.name || 'Custom Service',
            serviceSinhalaName: d.service_sinhala_name || d.sinhala_name || '',
            category: d.category || 'haircut',
            totalExecuted: Number(d.total_executed || 0),
            unitsSold: Number(d.units_sold || 0),
            totalRevenue: Number(d.total_revenue || 0),
            avgPrice: Number(d.avg_price || 0),
            avgDurationMinutes: Number(d.avg_duration_minutes || 30),
          }));
        }
      } catch (err: any) {
        console.warn('[AnalyticsService] getServicePerformance error, using fallback:', err.message);
      }
    }

    return FALLBACK_SERVICES;
  }

  /**
   * 7. Export RFC-4180 Compliant CSV with UTF-8 BOM
   */
  static exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
    const csvContent =
      '\uFEFF' + // UTF-8 Byte Order Mark for Excel Sinhala & Currency support
      [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

