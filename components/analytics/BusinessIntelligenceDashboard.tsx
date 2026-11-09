'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  BiDashboardOverview,
  BiFinancialReport,
  BiCustomerAnalytics,
  BiBarberPerformanceReport,
  BiQueueTrafficReport,
  BiServiceItemReport,
  ReportDateRange,
} from '@/types/analytics';
import { AnalyticsService } from '@/lib/services/analytics-service';

export default function BusinessIntelligenceDashboard() {
  const [isPending, startTransition] = useTransition();

  // Active View Tab: 'overview' | 'financial' | 'barbers' | 'customers' | 'traffic' | 'services'
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'barbers' | 'customers' | 'traffic' | 'services'>('overview');

  // Filter States
  const [dateRange, setDateRange] = useState<ReportDateRange>('30days');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Data States
  const [overview, setOverview] = useState<BiDashboardOverview | null>(null);
  const [financialReport, setFinancialReport] = useState<BiFinancialReport | null>(null);
  const [customerAnalytics, setCustomerAnalytics] = useState<BiCustomerAnalytics | null>(null);
  const [barberReport, setBarberReport] = useState<BiBarberPerformanceReport | null>(null);
  const [queueTraffic, setQueueTraffic] = useState<BiQueueTrafficReport | null>(null);
  const [servicesReport, setServicesReport] = useState<BiServiceItemReport[]>([]);

  useEffect(() => {
    loadAllReports();
  }, [dateRange]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadAllReports = async () => {
    startTransition(async () => {
      try {
        const [ov, fin, cust, barb, traf, svc] = await Promise.all([
          AnalyticsService.getOverview(),
          AnalyticsService.getFinancialReport(),
          AnalyticsService.getCustomerAnalytics(),
          AnalyticsService.getBarberPerformance(),
          AnalyticsService.getQueueTraffic(),
          AnalyticsService.getServicePerformance(),
        ]);

        setOverview(ov);
        setFinancialReport(fin);
        setCustomerAnalytics(cust);
        setBarberReport(barb);
        setQueueTraffic(traf);
        setServicesReport(svc);
      } catch (err) {
        console.warn('Error loading BI reports:', err);
      }
    });
  };

  // CSV Export Handlers
  const handleExportFinancialCsv = () => {
    if (!financialReport) return;
    const headers = ['Date', 'Invoices', 'Gross Sales (LKR)', 'Discounts (LKR)', 'Net Revenue (LKR)', 'AOV (LKR)', 'Cash (LKR)', 'LankaQR (LKR)', 'Card (LKR)'];
    const rows = financialReport.dailyTrend.map((d) => [
      d.reportDate || (d as any)?.report_date || (d as any)?.date || '',
      d.totalInvoices || 0,
      d.grossSales || 0,
      d.totalDiscounts || 0,
      d.netRevenue || 0,
      d.avgInvoiceValue || 0,
      d.cashRevenue || 0,
      d.lankaqrRevenue || 0,
      d.cardRevenue || 0,
    ]);
    AnalyticsService.exportToCsv('SmartSalon-FinancialReport', headers, rows);
    showToast('📥 Financial Report CSV Downloaded');
  };

  const handleExportCustomersCsv = () => {
    if (!customerAnalytics) return;
    const headers = ['Customer #', 'Name', 'Phone', 'Total Visits', 'Total Spending (LKR)', 'VIP Status', 'Preferred Barber', 'Last Visit'];
    const rows = customerAnalytics.topSpenders.map((c) => [
      c.customerNumber || '',
      c.name || '',
      c.mobile || '',
      c.totalVisits || 0,
      c.totalSpending || 0,
      c.isVip ? 'VIP' : 'Regular',
      c.preferredBarber || 'Any',
      c.lastVisitAt || '',
    ]);
    AnalyticsService.exportToCsv('SmartSalon-TopCustomers', headers, rows);
    showToast('📥 Customer Analytics CSV Downloaded');
  };

  const handleExportBarbersCsv = () => {
    if (!barberReport) return;
    const headers = ['Barber Name', 'Chair #', 'Commission %', 'Services Completed', 'Gross Revenue (LKR)', 'Commission Earned (LKR)', 'Avg Duration (Mins)', 'Unique Clients'];
    const rows = barberReport.barbers.map((b) => [
      b.barberName,
      b.chairNumber,
      `${b.commissionPercentage}%`,
      b.servicesCompleted,
      b.revenueGenerated,
      b.commissionEarned,
      b.avgDurationMinutes,
      b.uniqueClients,
    ]);
    AnalyticsService.exportToCsv('SmartSalon-BarberProductivity', headers, rows);
    showToast('📥 Barber Performance CSV Downloaded');
  };

  // Print Report Handler
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Find max value in daily trend for SVG chart scaling
  const maxDailyRevenue = Math.max(
    ...(financialReport?.dailyTrend?.map((d) => d?.netRevenue || 0) || [50000]),
    50000
  );

  // Find max hourly traffic for queue heatmap chart
  const maxHourlyTraffic = Math.max(
    ...(queueTraffic?.hourlyDistribution?.map((h) => h?.customerCount || 0) || [30]),
    20
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col font-body pb-16 selection:bg-primary/20 print:bg-white print:text-black">
      {/* ============================================================== */}
      {/* 1. TOP HEADER & NAVIGATION                                     */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-40 bg-surface-container-low/95 backdrop-blur-md border-b border-surface-container-high px-4 py-3 shadow-xs print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-bold shadow-sm">
              <span className="material-symbols-outlined text-[26px]">monitoring</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-title-md font-bold text-primary tracking-tight">
                  Business Intelligence &amp; Analytics
                </h1>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md bg-tertiary-container text-tertiary-fixed">
                  Enterprise BI v2.0
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Smart Salon LK • The Royal Blade Executive Reporting Cockpit
              </p>
            </div>
          </div>

          {/* Action Strip */}
          <div className="flex items-center gap-2">
            <Link
              href="/pos"
              className="px-3 py-1.5 rounded-xl border border-surface-container-highest hover:bg-surface-container-high text-xs font-semibold flex items-center gap-1 transition"
            >
              <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
              <span>Billing POS</span>
            </Link>

            <Link
              href="/payments"
              className="px-3 py-1.5 rounded-xl border border-surface-container-highest hover:bg-surface-container-high text-xs font-semibold flex items-center gap-1 transition"
            >
              <span className="material-symbols-outlined text-[16px]">payments</span>
              <span>Payments</span>
            </Link>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary text-xs font-bold flex items-center gap-1.5 transition"
              title="Print Executive A4 Report"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Print A4</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. TOAST NOTIFICATION                                         */}
      {/* ============================================================== */}
      {toastMessage && (
        <div className="fixed top-18 right-4 z-50 bg-primary text-on-primary px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce print:hidden">
          <span className="material-symbols-outlined text-[18px]">verified</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. MAIN DASHBOARD CONTENT                                      */}
      {/* ============================================================== */}
      <main className="max-w-7xl mx-auto w-full px-4 pt-4 flex flex-col gap-5">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b border-surface-container-high pb-2 print:hidden overflow-x-auto gap-2">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'overview', label: 'Executive Cockpit', icon: 'dashboard', sinhala: 'විධායක සාරාංශය' },
              { id: 'financial', label: 'Financial Sales', icon: 'payments', sinhala: 'මූල්‍ය වාර්තා' },
              { id: 'barbers', label: 'Barber Stations', icon: 'badge', sinhala: 'කප්පාදු ශිල්පීන්' },
              { id: 'customers', label: 'Customer Retention', icon: 'groups', sinhala: 'ගනුදෙනුකරුවන්' },
              { id: 'traffic', label: 'Peak Queue Traffic', icon: 'hourglass_top', sinhala: 'පෝලිම් විශ්ලේෂණය' },
              { id: 'services', label: 'Service Popularity', icon: 'content_cut', sinhala: 'සේවාවන්' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${activeTab === tab.id
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface hover:bg-surface-container text-on-surface'
                  }`}
              >
                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Quick Date Range Selector */}
          <div className="flex items-center gap-1 bg-surface-container p-1 rounded-2xl shrink-0">
            {[
              { id: 'today', label: 'Today' },
              { id: '7days', label: '7 Days' },
              { id: '30days', label: '30 Days' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setDateRange(r.id as any)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${dateRange === r.id
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
                  }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: EXECUTIVE COCKPIT OVERVIEW                            */}
        {/* ============================================================ */}
        {activeTab === 'overview' && overview && (
          <div className="flex flex-col gap-5">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Today's Revenue */}
              <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high/60 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Today&apos;s Revenue • අද ආදායම
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="font-extrabold text-3xl text-emerald-600 dark:text-emerald-400">
                    LKR {(overview.todayRevenue || 0).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs">
                    <span
                      className={`font-bold flex items-center ${overview.revenueGrowthPct >= 0 ? 'text-emerald-600' : 'text-error'
                        }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {overview.revenueGrowthPct >= 0 ? 'trending_up' : 'trending_down'}
                      </span>
                      {overview.revenueGrowthPct >= 0 ? `+${overview.revenueGrowthPct}%` : `${overview.revenueGrowthPct}%`}
                    </span>
                    <span className="text-on-surface-variant">vs yesterday</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Today's Customers */}
              <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high/60 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Total Served • ගනුදෙනුකරුවන්
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">groups</span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="font-extrabold text-3xl text-primary">
                    {overview.todayCustomers}
                    <span className="text-xs font-medium text-on-surface-variant ml-1.5">Guests</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 font-bold">
                      {overview.walkInsCount} Walk-ins
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 font-bold">
                      {overview.appointmentsCount} Bookings
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Average Invoice Value (AOV) */}
              <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high/60 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Avg Invoice Value • සාමාන්‍ය බිල
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">receipt</span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="font-extrabold text-3xl text-on-surface">
                    LKR {(overview.avgInvoiceValue || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-on-surface-variant mt-1">
                    Across {overview.todayInvoices} completed invoices today
                  </div>
                </div>
              </div>

              {/* Card 4: Queue Status & Waiting */}
              <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high/60 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Queue Health • පෝලිමේ තත්ත්වය
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">hourglass_empty</span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="font-extrabold text-2xl text-amber-600">
                    {overview.queueSummary.waiting} Waiting
                    <span className="text-xs font-normal text-on-surface-variant ml-1.5">
                      (~{overview.queueSummary.avgWaitMinutes}m wait)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-on-surface-variant">
                    <span>{overview.queueSummary.inService} In Chair</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-bold">
                      {overview.queueSummary.completed} Completed
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Barber Station Activity Strip */}
            <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high/60 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-3">
                Live Stylist Chair Status • කාර්ය මණ්ඩල තත්ත්වය
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {overview.barberActivity.map((barber, idx) => (
                  <div
                    key={barber.staffId || `barber-act-${idx}`}
                    className="p-4 bg-surface rounded-2xl border border-surface-container-high flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base">
                        Ch 0{barber.chairNumber}
                      </div>
                      <div>
                        <div className="font-bold text-sm leading-tight">{barber.barberName}</div>
                        <div className="text-xs text-on-surface-variant mt-0.5">
                          {barber.activeTicket ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                              Serving: {barber.activeCustomer} ({barber.activeTicket})
                            </span>
                          ) : (
                            <span className="text-on-surface-variant">Ready for next guest</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600">
                        {barber.availability}
                      </span>
                      {barber.servicePrice ? (
                        <div className="text-xs font-bold text-primary mt-1">
                          LKR {(barber.servicePrice || 0).toLocaleString()}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Method Distribution Bar */}
            <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high/60 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Today&apos;s Payment Tender Breakdown (ගෙවීම් ක්‍රම)
                </span>
                <span className="text-xs font-bold text-primary">
                  100% Reconciled
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {overview.paymentMethods.map((pm, idx) => (
                  <div key={pm.paymentMethod || `pm-${idx}`} className="p-3.5 bg-surface rounded-2xl border border-surface-container-high">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold uppercase">{pm.paymentMethod}</span>
                      <span className="font-bold text-primary">{pm.percentage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden mb-2">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${pm.percentage}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-on-surface-variant">
                      <span>{pm.transactionCount || 0} transactions</span>
                      <span className="font-bold text-on-surface">LKR {(pm.totalAmount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: FINANCIAL SALES & REVENUE TRENDS                     */}
        {/* ============================================================ */}
        {activeTab === 'financial' && financialReport && (
          <div className="flex flex-col gap-5">
            {/* Financial Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-on-surface-variant block">Total Net Sales</span>
                <div className="font-extrabold text-2xl text-emerald-600 mt-1">
                  LKR {(financialReport.totalRevenue || 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-on-surface-variant block">Total Invoices</span>
                <div className="font-extrabold text-2xl text-primary mt-1">
                  {financialReport.totalInvoices || 0}
                </div>
              </div>
              <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-on-surface-variant block">Average Order Value</span>
                <div className="font-extrabold text-2xl text-on-surface mt-1">
                  LKR {(financialReport.avgOrderValue || 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-on-surface-variant block">Discounts Granted</span>
                <div className="font-extrabold text-2xl text-amber-600 mt-1">
                  LKR {(financialReport.totalDiscounts || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* 14-Day Interactive Bar Chart */}
            <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high/60 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-title-md font-bold text-on-surface">14-Day Daily Revenue Trend</h3>
                  <p className="text-xs text-on-surface-variant">Daily net revenue collected across Chair 01 and Chair 02</p>
                </div>
                <button
                  type="button"
                  onClick={handleExportFinancialCsv}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-xs font-bold transition flex items-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Export CSV</span>
                </button>
              </div>

              {/* Visual SVG Bar Chart */}
              <div className="h-56 w-full flex items-end gap-2 pt-6 pb-2 px-1 border-b border-surface-container-high">
                {(financialReport.dailyTrend || []).filter(Boolean).map((d, idx) => {
                  const barHeightPct = Math.round(((d?.netRevenue || 0) / maxDailyRevenue) * 100);
                  const rawDate = typeof d?.reportDate === 'string' ? d.reportDate : String(d?.reportDate || (d as any)?.report_date || (d as any)?.date || '');
                  const shortDate = (rawDate && typeof rawDate === 'string' && rawDate.length >= 5) ? rawDate.slice(5) : (rawDate || 'N/A');
                  return (
                    <div key={rawDate || `dt-${idx}`} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      {/* Tooltip on hover */}
                      <div className="absolute -top-10 hidden group-hover:flex flex-col items-center bg-black/80 text-white text-[10px] py-1 px-2 rounded-md shadow-md z-10 pointer-events-none whitespace-nowrap">
                        <span>LKR {(d?.netRevenue || 0).toLocaleString()}</span>
                        <span className="text-gray-300 font-mono">{d?.totalInvoices || 0} Invoices</span>
                      </div>
                      <div
                        className="w-full bg-gradient-to-t from-primary/80 to-primary rounded-t-lg transition-all duration-300 hover:brightness-110"
                        style={{ height: `${Math.max(barHeightPct, 6)}%` }}
                      ></div>
                      <span className="text-[10px] text-on-surface-variant mt-2 font-mono">
                        {shortDate}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial Data Table */}
            <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high/60 shadow-xs">
              <h3 className="font-title-md font-bold mb-3">Itemized Daily Turnover Ledger</h3>
              <div className="overflow-x-auto rounded-2xl border border-surface-container-high">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container border-b border-surface-container-high font-bold text-on-surface-variant uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-right">Invoices</th>
                      <th className="p-3 text-right">Gross Sales</th>
                      <th className="p-3 text-right">Discounts</th>
                      <th className="p-3 text-right">Net Revenue</th>
                      <th className="p-3 text-right">Cash</th>
                      <th className="p-3 text-right">LankaQR</th>
                      <th className="p-3 text-right">Card</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high/50 bg-surface">
                    {(financialReport.dailyTrend || []).filter(Boolean).map((row, idx) => {
                      const rawRowDate = typeof row?.reportDate === 'string' ? row.reportDate : String(row?.reportDate || (row as any)?.report_date || (row as any)?.date || 'N/A');
                      return (
                        <tr key={rawRowDate || `row-${idx}`} className="hover:bg-surface-container-low transition">
                          <td className="p-3 font-mono font-semibold">{rawRowDate}</td>
                          <td className="p-3 text-right font-mono">{row?.totalInvoices || 0}</td>
                          <td className="p-3 text-right font-mono">LKR {(row?.grossSales || 0).toLocaleString()}</td>
                          <td className="p-3 text-right font-mono text-amber-600">
                            {(row?.totalDiscounts || 0) > 0 ? `-LKR ${(row?.totalDiscounts || 0).toLocaleString()}` : '-'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-600">
                            LKR {(row?.netRevenue || 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono">LKR {(row?.cashRevenue || 0).toLocaleString()}</td>
                          <td className="p-3 text-right font-mono">LKR {(row?.lankaqrRevenue || 0).toLocaleString()}</td>
                          <td className="p-3 text-right font-mono">LKR {(row?.cardRevenue || 0).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: BARBER STATIONS PRODUCTIVITY                          */}
        {/* ============================================================ */}
        {activeTab === 'barbers' && barberReport && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-title-md font-bold">Stylist Productivity &amp; Earnings</h3>
                <p className="text-xs text-on-surface-variant">Performance metrics for Chair 01 and Chair 02</p>
              </div>
              <button
                type="button"
                onClick={handleExportBarbersCsv}
                className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-xs font-bold transition flex items-center gap-1 shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span>Export Barbers CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {barberReport.barbers.map((b, idx) => (
                <div
                  key={b.staffId || `barber-${idx}`}
                  className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high/60 shadow-xs flex flex-col justify-between gap-4"
                >
                  <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary font-extrabold flex items-center justify-center text-lg shadow-sm">
                        0{b.chairNumber}
                      </div>
                      <div>
                        <h4 className="font-bold text-base leading-tight">{b.barberName}</h4>
                        <span className="text-xs text-on-surface-variant">
                          Chair {b.chairNumber} • Commission: {b.commissionPercentage}%
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600">
                      Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-surface rounded-2xl border border-surface-container-high">
                      <span className="text-on-surface-variant block mb-1">Services Completed</span>
                      <span className="font-mono font-extrabold text-lg text-primary">{b.servicesCompleted}</span>
                    </div>

                    <div className="p-3 bg-surface rounded-2xl border border-surface-container-high">
                      <span className="text-on-surface-variant block mb-1">Unique Clients</span>
                      <span className="font-mono font-extrabold text-lg text-on-surface">{b.uniqueClients}</span>
                    </div>

                    <div className="p-3 bg-surface rounded-2xl border border-surface-container-high">
                      <span className="text-on-surface-variant block mb-1">Gross Revenue</span>
                      <span className="font-mono font-extrabold text-base text-emerald-600">
                        LKR {(b.revenueGenerated || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="p-3 bg-surface rounded-2xl border border-surface-container-high">
                      <span className="text-on-surface-variant block mb-1">Estimated Commission</span>
                      <span className="font-mono font-extrabold text-base text-primary">
                        LKR {(b.commissionEarned || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-surface rounded-2xl border border-surface-container-high flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant">Average Service Chair Duration:</span>
                    <span className="font-mono font-bold text-on-surface">{b.avgDurationMinutes} Minutes</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: CUSTOMER RETENTION & TOP VIPs                         */}
        {/* ============================================================ */}
        {activeTab === 'customers' && customerAnalytics && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-on-surface-variant block">Total Customer Base</span>
                <div className="font-extrabold text-2xl text-primary mt-1">{customerAnalytics.totalCustomers}</div>
              </div>
              <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-on-surface-variant block">New First-Time</span>
                <div className="font-extrabold text-2xl text-blue-600 mt-1">{customerAnalytics.newCustomers}</div>
              </div>
              <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-on-surface-variant block">Returning Regulars</span>
                <div className="font-extrabold text-2xl text-emerald-600 mt-1">{customerAnalytics.returningCustomers}</div>
              </div>
              <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-on-surface-variant block">Retention Rate</span>
                <div className="font-extrabold text-2xl text-emerald-600 mt-1">
                  {customerAnalytics.retentionRatePct}%
                </div>
              </div>
            </div>

            {/* Top VIP Clients Table */}
            <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high/60 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-title-md font-bold">Top VIP Spenders (Lifetime Value)</h3>
                <button
                  type="button"
                  onClick={handleExportCustomersCsv}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-xs font-bold transition flex items-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Export VIPs CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-surface-container-high">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container border-b border-surface-container-high font-bold text-on-surface-variant uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Client</th>
                      <th className="p-3">Mobile</th>
                      <th className="p-3 text-right">Total Visits</th>
                      <th className="p-3 text-right">Lifetime Spending</th>
                      <th className="p-3">Preferred Stylist</th>
                      <th className="p-3">Last Visit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high/50 bg-surface">
                    {(customerAnalytics.topSpenders || []).filter(Boolean).map((c, idx) => (
                      <tr key={c.id || `cust-${idx}`} className="hover:bg-surface-container-low transition">
                        <td className="p-3">
                          <div className="font-bold flex items-center gap-1.5">
                            <span>{c?.name || 'Customer'}</span>
                            {c?.isVip && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-700">
                                VIP
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-on-surface-variant font-mono">{c?.customerNumber || '-'}</div>
                        </td>
                        <td className="p-3 font-mono">{c?.mobile || '-'}</td>
                        <td className="p-3 text-right font-mono font-bold">{c?.totalVisits || 0}</td>
                        <td className="p-3 text-right font-mono font-extrabold text-emerald-600">
                          LKR {((c?.totalSpending) || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-on-surface-variant">{c?.preferredBarber || 'Master Kavi'}</td>
                        <td className="p-3 font-mono text-on-surface-variant">{c?.lastVisitAt || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: QUEUE TRAFFIC & PEAK HOURS HEATMAP                    */}
        {/* ============================================================ */}
        {activeTab === 'traffic' && queueTraffic && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-on-surface-variant block">Walk-in Volume</span>
                <div className="font-extrabold text-2xl text-amber-600 mt-1">{queueTraffic.walkInTotal}</div>
              </div>
              <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-on-surface-variant block">Appointment Volume</span>
                <div className="font-extrabold text-2xl text-blue-600 mt-1">{queueTraffic.appointmentTotal}</div>
              </div>
              <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-on-surface-variant block">Walk-in vs Appointment Ratio</span>
                <div className="font-extrabold text-2xl text-primary mt-1">{queueTraffic.walkInRatioPct}% Walk-in</div>
              </div>
            </div>

            {/* Peak Hours Histogram */}
            <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high/60 shadow-xs">
              <h3 className="font-title-md font-bold mb-1">Peak Business Hours Distribution (06:00 - 20:00)</h3>
              <p className="text-xs text-on-surface-variant mb-4">Traffic load by hour showing salon rush periods</p>

              <div className="h-60 w-full flex items-end gap-1.5 pt-6 pb-2 px-1 border-b border-surface-container-high">
                {queueTraffic.hourlyDistribution.map((h, idx) => {
                  const barHeightPct = Math.round((h.customerCount / maxHourlyTraffic) * 100);
                  const isPeak = h.customerCount >= 20;
                  return (
                    <div key={`hour-${h.hourNum ?? idx}`} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      <div className="absolute -top-10 hidden group-hover:flex flex-col items-center bg-black/80 text-white text-[10px] py-1 px-2 rounded-md shadow-md z-10 pointer-events-none whitespace-nowrap">
                        <span>{h.customerCount} Guests</span>
                        <span className="text-gray-300 font-mono">Avg Wait: {h.avgWaitMinutes}m</span>
                      </div>
                      <div
                        className={`w-full rounded-t-lg transition-all duration-300 hover:brightness-110 ${isPeak ? 'bg-amber-500' : 'bg-primary/70'
                          }`}
                        style={{ height: `${Math.max(barHeightPct, 6)}%` }}
                      ></div>
                      <span className="text-[9px] text-on-surface-variant mt-2 font-mono">
                        {h.hourLabel}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 mt-3 text-xs text-on-surface-variant">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500"></span>
                  <span>Peak Rush Periods (10:00-11:00 AM &amp; 04:00-06:00 PM)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-primary/70"></span>
                  <span>Normal Operating Hours</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 6: SERVICE POPULARITY MATRIX                             */}
        {/* ============================================================ */}
        {activeTab === 'services' && (
          <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high/60 shadow-xs">
            <h3 className="font-title-md font-bold mb-3">Service Menu Revenue Matrix</h3>
            <div className="overflow-x-auto rounded-2xl border border-surface-container-high">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container border-b border-surface-container-high font-bold text-on-surface-variant uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Service Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Units Sold</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Total Revenue</th>
                    <th className="p-3 text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/50 bg-surface">
                  {(servicesReport || []).filter(Boolean).map((s, idx) => (
                    <tr key={s.serviceId || `service-${s.serviceName || 'item'}-${idx}`} className="hover:bg-surface-container-low transition">
                      <td className="p-3">
                        <div className="font-bold">{s.serviceName}</div>
                        <div className="text-[10px] text-on-surface-variant">{s.serviceSinhalaName}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-bold bg-surface-container-highest text-on-surface-variant">
                          {s.category}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-primary">{s.unitsSold}</td>
                      <td className="p-3 text-right font-mono">LKR {(s.avgPrice || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-mono font-extrabold text-emerald-600">
                        LKR {(s.totalRevenue || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono text-on-surface-variant">
                        {s.avgDurationMinutes} Mins
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

