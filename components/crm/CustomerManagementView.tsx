'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  CustomerSummary,
  CustomerDashboardData,
  CustomerAnalyticsData,
  CustomerStatus,
} from '@/types/crm';
import { formatSriLankanPhone } from '@/lib/supabase/auth';

export default function CustomerManagementView() {
  const [, startTransition] = useTransition();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CustomerStatus | 'vip'>('all');
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Customer for Detailed Profile View
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDashboardData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<CustomerAnalyticsData | null>(null);

  // Registration Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWhatsApp, setFormWhatsApp] = useState('');
  const [formBarber, setFormBarber] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<CustomerStatus>('active');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch Customers
  const fetchCustomers = async (q = '', status?: string) => {
    setLoading(true);
    try {
      const url = new URL('/api/customers', window.location.origin);
      if (q) url.searchParams.set('q', q);
      if (status && status !== 'all' && status !== 'vip') {
        url.searchParams.set('status', status);
      }
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        let list: CustomerSummary[] = data.customers;
        if (status === 'vip') {
          list = list.filter((c) => c.isVip);
        }
        setCustomers(list);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(searchQuery, statusFilter);
  }, [statusFilter]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    startTransition(() => {
      fetchCustomers(val, statusFilter);
    });
  };

  // Open Customer Detail Profile
  const openCustomerProfile = async (customerId: string) => {
    setLoadingProfile(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedCustomer(data.data);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Open Analytics Report Modal
  const openAnalytics = async () => {
    setIsAnalyticsOpen(true);
    try {
      const res = await fetch('/api/customers/analytics');
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data.analytics);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
    }
  };

  // Save / Register Customer
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormFeedback(null);

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          phone: formPhone,
          whatsapp: formWhatsApp || formPhone,
          preferredBarberId: formBarber || undefined,
          address: formAddress || undefined,
          notes: formNotes || undefined,
          status: formStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save customer.');
      }

      setFormFeedback({
        type: 'success',
        message: data.is_new
          ? 'New customer registered successfully! • නව පාරිභෝගිකයා ලියාපදිංචි කරන ලදී.'
          : 'Existing customer found and profile updated! • පවතින පාරිභෝගිකයා යාවත්කාලීන විය.',
      });

      // Refresh list
      fetchCustomers(searchQuery, statusFilter);

      setTimeout(() => {
        setIsRegisterOpen(false);
        setFormFeedback(null);
        setFormName('');
        setFormPhone('');
        setFormWhatsApp('');
        setFormNotes('');
        setFormAddress('');
      }, 1200);
    } catch (err: unknown) {
      setFormFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error registering customer.',
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Update Customer Status (e.g. Block/Unblock)
  const handleUpdateStatus = async (newStatus: CustomerStatus) => {
    if (!selectedCustomer) return;
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedCustomer({
          ...selectedCustomer,
          profile: { ...selectedCustomer.profile, status: newStatus },
        });
        fetchCustomers(searchQuery, statusFilter);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col max-w-md mx-auto pb-24 font-body">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <Link
              href="/owner-pos"
              className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Customer CRM</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium">
                  පාරිභෝගික කළමනාකරණය
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">Smart Salon LK • Repeat Client Ledger</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/walk-in"
              className="px-3 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1.5 text-xs font-bold hover:bg-amber-500/20 transition shadow-sm"
              title="Fast Walk-in Registration"
            >
              <span className="material-symbols-outlined text-lg">bolt</span>
              <span className="hidden sm:inline">Walk-in</span>
            </Link>
            <button
              onClick={openAnalytics}
              className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 hover:bg-slate-800 transition shadow-sm cursor-pointer"
              title="CRM Analytics"
            >
              <span className="material-symbols-outlined text-xl">insights</span>
            </button>
            <button
              onClick={() => {
                setFormFeedback(null);
                setIsRegisterOpen(true);
              }}
              className="w-10 h-10 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20 transition cursor-pointer"
              title="Add Customer"
            >
              <span className="material-symbols-outlined text-2xl font-bold">person_add</span>
            </button>
          </div>
        </div>

        {/* Fast Search Input */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search by Name, Phone, WhatsApp or CUST-#..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                fetchCustomers('', statusFilter);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 text-[11px]">
          {(['all', 'active', 'vip', 'inactive', 'blocked'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-xl font-semibold capitalize whitespace-nowrap transition cursor-pointer ${
                statusFilter === filter
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {filter === 'all' ? 'All (සියල්ල)' : filter}
            </button>
          ))}
        </div>
      </header>

      {/* Main Customers List */}
      <main className="p-4 flex-1">
        {loading ? (
          <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined animate-spin text-3xl text-amber-500">
              progress_activity
            </span>
            <p className="text-xs">Searching client records... • සොයමින් පවතී</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
            <div className="w-14 h-14 mx-auto rounded-3xl bg-slate-800 flex items-center justify-center text-slate-500 mb-3">
              <span className="material-symbols-outlined text-3xl">group_off</span>
            </div>
            <h3 className="text-base font-bold text-white mb-1">No Customers Found</h3>
            <p className="text-xs text-slate-400 mb-4">
              {searchQuery
                ? `No matching customer for "${searchQuery}". Tap below to register.`
                : 'No customers recorded yet.'}
            </p>
            <button
              onClick={() => {
                setFormName(searchQuery);
                setIsRegisterOpen(true);
              }}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold px-4 py-2.5 rounded-2xl text-xs transition shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              <span>Register "{searchQuery || 'New Customer'}"</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-slate-400 px-1">
              Showing {customers.length} registered customers
            </p>

            {customers.map((c) => (
              <div
                key={c.id}
                onClick={() => openCustomerProfile(c.id)}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-[0.99] rounded-3xl p-4 transition shadow-md cursor-pointer relative overflow-hidden group"
              >
                {/* Status Indicator Bar */}
                <div
                  className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                    c.status === 'active'
                      ? 'bg-emerald-500'
                      : c.status === 'blocked'
                      ? 'bg-red-500'
                      : 'bg-slate-600'
                  }`}
                />

                <div className="flex items-start justify-between gap-3 pl-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-base shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-white group-hover:text-amber-400 transition">
                          {c.name}
                        </h4>
                        {c.isVip && (
                          <span className="bg-amber-500 text-slate-950 font-extrabold text-[9px] px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                            VIP
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            c.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : c.status === 'blocked'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <span className="font-mono font-medium text-slate-300">{c.mobile}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-[11px] text-slate-500">{c.customerNumber}</span>
                      </div>
                    </div>
                  </div>

                  <a
                    href={`https://wa.me/${c.whatsapp.replace('+', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-9 h-9 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center transition shrink-0"
                    title="Direct WhatsApp"
                  >
                    <span className="material-symbols-outlined text-lg">chat</span>
                  </a>
                </div>

                {/* Metrics Pill Grid */}
                <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-slate-800/80 text-center pl-2">
                  <div className="bg-slate-950/60 rounded-xl p-2 border border-slate-800/50">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Visits</p>
                    <p className="text-xs font-bold text-white mt-0.5">{c.totalVisits} visits</p>
                  </div>
                  <div className="bg-slate-950/60 rounded-xl p-2 border border-slate-800/50">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Spent</p>
                    <p className="text-xs font-bold text-amber-400 mt-0.5">
                      Rs. {c.totalSpending.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-slate-950/60 rounded-xl p-2 border border-slate-800/50">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Pref. Barber</p>
                    <p className="text-xs font-bold text-slate-300 mt-0.5 truncate">
                      {c.preferredBarberName || 'Any Stylist'}
                    </p>
                  </div>
                </div>

                {c.notes && (
                  <p className="text-[11px] text-slate-400 italic mt-2.5 pl-2 line-clamp-1 bg-slate-950/40 px-2 py-1 rounded-lg">
                    "{c.notes}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL 1: Registration / Upsert Customer */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <button
              onClick={() => setIsRegisterOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <span className="material-symbols-outlined text-xl">person_add</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Register Customer</h3>
                <p className="text-xs text-slate-400">One Phone = One Client Rule</p>
              </div>
            </div>

            {formFeedback && (
              <div
                className={`mb-4 p-3 rounded-2xl text-xs flex items-center gap-2 ${
                  formFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}
              >
                <span className="material-symbols-outlined text-base shrink-0">
                  {formFeedback.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span>{formFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleSaveCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name (නම) *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Kasun Chamara"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mobile Number (දුරකථන අංකය) *
                </label>
                <div className="flex rounded-xl overflow-hidden border border-slate-800 focus-within:border-amber-500">
                  <span className="bg-slate-950 px-3 py-2.5 text-xs text-slate-400 font-semibold border-r border-slate-800">
                    🇱🇰 +94
                  </span>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="77 123 4567"
                    className="w-full bg-slate-950 px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  WhatsApp Number (Optional)
                </label>
                <input
                  type="tel"
                  value={formWhatsApp}
                  onChange={(e) => setFormWhatsApp(e.target.value)}
                  placeholder="Leave empty if same as mobile"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Preferred Barber (කැමති බාබර්)
                </label>
                <select
                  value={formBarber}
                  onChange={(e) => setFormBarber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Any Available Barber (ඕනෑම අයෙක්)</option>
                  <option value="c0000000-0000-0000-0000-000000000001">Master Kavi (Chair 1)</option>
                  <option value="c0000000-0000-0000-0000-000000000002">Sunil Shantha (Chair 2)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Address / City (ලිපිනය)
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. Kiribathgoda"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Customer Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as CustomerStatus)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="active">Active (ක්‍රියාකාරී)</option>
                  <option value="inactive">Inactive (අක්‍රිය)</option>
                  <option value="blocked">Blocked (අත්හිටුවූ)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Styling Notes / Preferences (විශේෂ සටහන්)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Likes skin fade, hot towel finish"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={formSubmitting}
                className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {formSubmitting ? (
                  <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                ) : (
                  <>
                    <span>Save Customer • සුරකින්න</span>
                    <span className="material-symbols-outlined text-base">save</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Detailed Customer Profile & Visit History */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <button
              onClick={() => setSelectedCustomer(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            {/* Profile Header */}
            <div className="flex items-center gap-3.5 mb-4 pr-8">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xl font-bold shrink-0">
                {selectedCustomer.profile.name.charAt(0).toUpperCase()}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{selectedCustomer.profile.name}</h3>
                  {selectedCustomer.profile.isVip && (
                    <span className="bg-amber-500 text-slate-950 font-extrabold text-[9px] px-1.5 py-0.5 rounded-md">
                      VIP
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {selectedCustomer.profile.customerNumber} • {selectedCustomer.profile.mobile}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    onClick={() =>
                      handleUpdateStatus(
                        selectedCustomer.profile.status === 'active' ? 'blocked' : 'active'
                      )
                    }
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold transition cursor-pointer ${
                      selectedCustomer.profile.status === 'active'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'
                    }`}
                  >
                    Status: {selectedCustomer.profile.status} (Tap to toggle)
                  </button>
                </div>
              </div>
            </div>

            {/* Direct Contact Actions */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <a
                href={`tel:${selectedCustomer.profile.mobile}`}
                className="py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-800 transition"
              >
                <span className="material-symbols-outlined text-base text-blue-400">call</span>
                <span>Call Client</span>
              </a>
              <a
                href={`https://wa.me/${selectedCustomer.profile.whatsapp.replace('+', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-emerald-500/20 transition"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                <span>WhatsApp</span>
              </a>
            </div>

            {/* KPI Metrics */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800 mb-4">
              <div className="text-center">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Total Spent</p>
                <p className="text-sm font-bold text-amber-400 mt-0.5">
                  Rs. {selectedCustomer.metrics.totalSpending.toLocaleString()}
                </p>
              </div>
              <div className="text-center border-x border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Completed</p>
                <p className="text-sm font-bold text-white mt-0.5">
                  {selectedCustomer.metrics.completedVisits} visits
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Fav Service</p>
                <p className="text-xs font-bold text-slate-300 mt-1 truncate">
                  {selectedCustomer.metrics.favouriteService}
                </p>
              </div>
            </div>

            {/* Stylist Notes */}
            {selectedCustomer.profile.notes && (
              <div className="mb-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-xs text-amber-300">
                <p className="font-bold text-[10px] uppercase text-amber-400 mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">edit_note</span>
                  Barber Notes & Style Preferences
                </p>
                <p>{selectedCustomer.profile.notes}</p>
              </div>
            )}

            {/* Visit History Section */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>Visit & Service History</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {selectedCustomer.visitHistory.length} recorded invoices
                </span>
              </h4>

              {selectedCustomer.visitHistory.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center bg-slate-950/40 rounded-xl">
                  No completed service visits on record.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                  {selectedCustomer.visitHistory.map((v) => (
                    <div
                      key={v.invoiceId}
                      className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">{v.barberName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({v.invoiceNumber})</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {v.services.join(', ')}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(v.visitDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-amber-400">
                          Rs. {v.grandTotal.toLocaleString()}
                        </p>
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-medium uppercase tracking-wider">
                          {v.paymentMethod}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CRM Analytics & High-Value Clients */}
      {isAnalyticsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <button
              onClick={() => setIsAnalyticsOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <span className="material-symbols-outlined text-xl">insights</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">CRM Analytics & Reports</h3>
                <p className="text-xs text-slate-400">Retention & Top Performing Clients</p>
              </div>
            </div>

            {analyticsData ? (
              <div className="space-y-4">
                {/* 4 Stat Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Total Clients</p>
                    <p className="text-xl font-extrabold text-white mt-1">
                      {analyticsData.overview.totalCustomers}
                    </p>
                    <p className="text-[10px] text-emerald-400 mt-0.5">
                      +{analyticsData.overview.newThisMonth} new this month
                    </p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Retention Rate</p>
                    <p className="text-xl font-extrabold text-amber-400 mt-1">
                      {analyticsData.overview.retentionRatePct}%
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {analyticsData.overview.returningCustomers} repeat clients
                    </p>
                  </div>
                </div>

                {/* Top 5 Most Valuable Customers */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-amber-400">star</span>
                    Top 5 Most Valuable Clients (By Revenue)
                  </h4>
                  <div className="space-y-2">
                    {analyticsData.mostValuableCustomers.map((c, i) => (
                      <div
                        key={c.id}
                        className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 font-bold flex items-center justify-center text-[10px]">
                            {i + 1}
                          </span>
                          <div>
                            <p className="font-bold text-white">{c.name}</p>
                            <p className="text-[10px] text-slate-500">{c.mobile}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-amber-400">Rs. {c.totalSpending.toLocaleString()}</p>
                          <p className="text-[10px] text-slate-500">{c.totalVisits} visits</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top 5 Most Frequent Customers */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-blue-400">repeat</span>
                    Top 5 Most Frequent Clients (By Visits)
                  </h4>
                  <div className="space-y-2">
                    {analyticsData.mostFrequentCustomers.map((c, i) => (
                      <div
                        key={c.id}
                        className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 font-bold flex items-center justify-center text-[10px]">
                            {i + 1}
                          </span>
                          <div>
                            <p className="font-bold text-white">{c.name}</p>
                            <p className="text-[10px] text-slate-500">{c.mobile}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">{c.totalVisits} visits</p>
                          <p className="text-[10px] text-amber-400">Rs. {c.totalSpending.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-slate-500">
                <span className="material-symbols-outlined animate-spin text-2xl text-amber-500">
                  progress_activity
                </span>
                <p className="text-xs mt-2">Computing salon analytics...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

