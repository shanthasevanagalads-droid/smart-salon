'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  CustomerSearchResult,
  QuickRegisterWalkInResponse,
  WalkInReportSummary,
} from '@/types/walk-in';
import { WalkInService, normalizeSriLankanPhone } from '@/lib/services/walk-in-service';
import { playSalonChime } from '@/lib/services/queue-service';

interface ServiceOption {
  id: string;
  name: string;
  sinhalaName: string;
  priceLkr: number;
  durationMinutes: number;
  icon: string;
  isPopular?: boolean;
}

const AVAILABLE_SERVICES: ServiceOption[] = [
  {
    id: 'adult-cut',
    name: 'Adult Hair Cut',
    sinhalaName: 'පිරිමි කොණ්ඩ කැපීම',
    priceLkr: 1200,
    durationMinutes: 30,
    icon: 'content_cut',
    isPopular: true,
  },
  {
    id: 'beard-trim',
    name: 'Beard Trim & Lineup',
    sinhalaName: 'රැවුල කැපීම සහ හැඩගැන්වීම',
    priceLkr: 800,
    durationMinutes: 20,
    icon: 'face',
    isPopular: true,
  },
  {
    id: 'cut-beard',
    name: 'Hair Cut + Beard Combo',
    sinhalaName: 'කොණ්ඩය සහ රැවුල පැකේජය',
    priceLkr: 1800,
    durationMinutes: 45,
    icon: 'auto_fix_high',
    isPopular: true,
  },
  {
    id: 'hair-dye',
    name: 'Hair Dye / Color',
    sinhalaName: 'කොණ්ඩය ඩයි කිරීම',
    priceLkr: 2500,
    durationMinutes: 50,
    icon: 'palette',
  },
  {
    id: 'head-massage',
    name: 'Head Massage',
    sinhalaName: 'හිස සම්බාහනය',
    priceLkr: 1500,
    durationMinutes: 25,
    icon: 'spa',
  },
  {
    id: 'kids-cut',
    name: 'Kids Hair Cut',
    sinhalaName: 'ළමා කොණ්ඩ කැපීම',
    priceLkr: 900,
    durationMinutes: 20,
    icon: 'child_care',
  },
];

const BARBERS = [
  { id: '', name: 'Any Available Barber (Fastest)', chair: 0, subtitle: 'පළමුවෙන් නිදහස් වන බාබර්' },
  { id: 'c0000000-0000-0000-0000-000000000001', name: 'Master Kavi', chair: 1, subtitle: 'Chair 01 • Senior Stylist' },
  { id: 'c0000000-0000-0000-0000-000000000002', name: 'Sunil Shantha', chair: 2, subtitle: 'Chair 02 • Beard Artisan' },
];

export default function WalkInRegistrationCockpit() {
  const [, startTransition] = useTransition();

  // Active view tab
  const [activeTab, setActiveTab] = useState<'register' | 'merge' | 'reports'>('register');

  // Registration Form State
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('adult-cut');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [priority, setPriority] = useState<'normal' | 'priority' | 'vip' | 'emergency'>('normal');
  const [whatsappSync, setWhatsappSync] = useState(true);
  const [notesInput, setNotesInput] = useState('');

  // Search Results & Detected Customer
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Submitting & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [issuedTicketModal, setIssuedTicketModal] = useState<QuickRegisterWalkInResponse | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Daily Reports State
  const [reports, setReports] = useState<WalkInReportSummary | null>(null);

  // Merge Tab State
  const [mergePrimaryQuery, setMergePrimaryQuery] = useState('');
  const [mergeSecondaryQuery, setMergeSecondaryQuery] = useState('');
  const [primaryMatches, setPrimaryMatches] = useState<CustomerSearchResult[]>([]);
  const [secondaryMatches, setSecondaryMatches] = useState<CustomerSearchResult[]>([]);
  const [selectedPrimary, setSelectedPrimary] = useState<CustomerSearchResult | null>(null);
  const [selectedSecondary, setSelectedSecondary] = useState<CustomerSearchResult | null>(null);
  const [mergeReason, setMergeReason] = useState('Duplicate phone record');
  const [mergeSubmitting, setMergeSubmitting] = useState(false);
  const [mergeResultMsg, setMergeResultMsg] = useState<string | null>(null);

  // Load KPI reports on mount
  useEffect(() => {
    WalkInService.getWalkInReports().then((data) => setReports(data));
  }, []);

  // Debounced Phone Search
  useEffect(() => {
    const trimmed = phoneInput.trim();
    if (trimmed.length < 3) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await WalkInService.searchCustomers(trimmed);
        setSearchResults(results);

        // Auto-select exact phone match
        const norm = normalizeSriLankanPhone(trimmed);
        const exact = results.find((c) => c.mobile === norm || c.mobile === trimmed);
        if (exact && !selectedCustomer) {
          handleSelectCustomer(exact);
        }
      } catch (err) {
        console.error('Error during customer search:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [phoneInput]);

  // Select an existing customer
  const handleSelectCustomer = (customer: CustomerSearchResult) => {
    setSelectedCustomer(customer);
    setNameInput(customer.name);
    setPhoneInput(customer.mobile);
    if (customer.preferredBarberId) {
      setSelectedStaffId(customer.preferredBarberId);
    }
    if (customer.isVip) {
      setPriority('vip');
    }
    setSearchResults([]);
  };

  // Reset form to clean state
  const handleResetForm = () => {
    setPhoneInput('');
    setNameInput('');
    setSelectedServiceId('adult-cut');
    setSelectedStaffId('');
    setPriority('normal');
    setNotesInput('');
    setSelectedCustomer(null);
    setSearchResults([]);
  };

  // Register Walk-in & Enqueue
  const handleQuickRegister = async (directBilling = false) => {
    if (!phoneInput.trim()) {
      showToast('⚠️ Please enter a mobile number (දුරකථන අංකය ඇතුළත් කරන්න)');
      return;
    }

    setSubmitting(true);
    try {
      const response = await WalkInService.quickRegisterAndEnqueue({
        mobile: phoneInput.trim(),
        name: nameInput.trim() || undefined,
        whatsapp: whatsappSync ? phoneInput.trim() : undefined,
        serviceId: selectedServiceId,
        staffId: selectedStaffId || undefined,
        priority,
        notes: notesInput.trim() || undefined,
        directBilling,
      });

      if (response.success) {
        playSalonChime('ding');
        setIssuedTicketModal(response);
        handleResetForm();

        // Refresh reports
        WalkInService.getWalkInReports().then((data) => setReports(data));
      } else {
        showToast(response.message || 'Registration failed');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to register walk-in');
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Customer Merge
  const handleExecuteMerge = async () => {
    if (!selectedPrimary || !selectedSecondary) {
      showToast('⚠️ Please select both primary and secondary customer profiles');
      return;
    }

    if (selectedPrimary.id === selectedSecondary.id) {
      showToast('⚠️ Primary and duplicate cannot be the same customer profile');
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to merge ${selectedSecondary.name} (${selectedSecondary.customerNumber}) into ${selectedPrimary.name} (${selectedPrimary.customerNumber})? This will transfer all history and remove the duplicate.`
      )
    ) {
      return;
    }

    setMergeSubmitting(true);
    try {
      const result = await WalkInService.mergeCustomers({
        primaryId: selectedPrimary.id,
        secondaryId: selectedSecondary.id,
        reason: mergeReason,
      });

      if (result.success) {
        setMergeResultMsg(
          `✅ Successfully merged! Migrated ${result.migratedQueueTickets} queue tickets, ${result.migratedWalkIns} walk-ins, and ${result.migratedAppointments} appointments into ${result.primaryCustomerNumber}.`
        );
        setSelectedPrimary(null);
        setSelectedSecondary(null);
        setMergePrimaryQuery('');
        setMergeSecondaryQuery('');
      } else {
        showToast(result.message || 'Merge failed');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to merge profiles');
    } finally {
      setMergeSubmitting(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const activeService = AVAILABLE_SERVICES.find((s) => s.id === selectedServiceId);

  return (
    <div className="flex flex-col w-full pb-28 pt-20">
      <div className="max-w-2xl mx-auto w-full px-4 flex flex-col gap-5">
        {/* Top Header & Navigation Shortcuts */}
        <div className="flex items-center justify-between bg-surface-container-low p-4 rounded-2xl shadow-sm border border-outline/10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-2xl">person_add</span>
            </div>
            <div>
              <h1 className="font-title-lg text-title-lg font-bold text-on-surface">
                Walk-in Registration
              </h1>
              <p className="text-body-sm text-on-surface-variant">
                ක්ෂණික පාරිභෝගික ලියාපදිංචිය • Sub-30s Token Dispatch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/queue-manager"
              className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-primary flex items-center gap-1 border border-outline/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
              <span className="hidden sm:inline">Live Queue</span>
            </Link>
            <Link
              href="/pos"
              className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface flex items-center gap-1 border border-outline/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
              <span className="hidden sm:inline">POS Cockpit</span>
            </Link>
          </div>
        </div>

        {/* Live KPI Summary Bar */}
        {reports && (
          <div className="grid grid-cols-4 gap-2.5">
            <div className="bg-surface-container-low p-3 rounded-xl border border-outline/10 flex flex-col items-center text-center">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Walk-ins
              </span>
              <span className="font-headline-sm text-headline-sm font-black text-primary">
                {reports.todayTotalWalkIns}
              </span>
              <span className="text-[10px] text-on-surface-variant">අද පැමිණි</span>
            </div>
            <div className="bg-surface-container-low p-3 rounded-xl border border-outline/10 flex flex-col items-center text-center">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Repeats
              </span>
              <span className="font-headline-sm text-headline-sm font-black text-tertiary">
                {reports.todayRepeatWalkIns}
              </span>
              <span className="text-[10px] text-tertiary font-bold">
                {reports.repeatCustomerRatePct}% Repeat
              </span>
            </div>
            <div className="bg-surface-container-low p-3 rounded-xl border border-outline/10 flex flex-col items-center text-center">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Served
              </span>
              <span className="font-headline-sm text-headline-sm font-black text-on-surface">
                {reports.todayServedCount}
              </span>
              <span className="text-[10px] text-on-surface-variant">
                {reports.conversionRatePct}% Conv
              </span>
            </div>
            <div className="bg-surface-container-low p-3 rounded-xl border border-outline/10 flex flex-col items-center text-center">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Revenue
              </span>
              <span className="font-headline-sm text-headline-sm font-black text-primary">
                {(reports.todayRevenueLkr / 1000).toFixed(1)}k
              </span>
              <span className="text-[10px] text-on-surface-variant">LKR Walk-in</span>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex rounded-xl bg-surface-container p-1 border border-outline/10">
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${activeTab === 'register'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
              }`}
          >
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            <span>Quick Register (වේගවත් ලියාපදිංචිය)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('merge')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${activeTab === 'merge'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
              }`}
          >
            <span className="material-symbols-outlined text-[18px]">merge</span>
            <span>Merge Duplicates (පැතිකඩ එකතු කිරීම)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${activeTab === 'reports'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
              }`}
          >
            <span className="material-symbols-outlined text-[18px]">insights</span>
            <span>Reports & Analytics</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: QUICK REGISTER WORKFLOW (< 30 SECONDS)                  */}
        {/* ============================================================== */}
        {activeTab === 'register' && (
          <div className="flex flex-col gap-5">
            {/* Step 1: Customer Phone & Instant Match Card */}
            <div className="bg-surface-container-low p-5 rounded-2xl border border-outline/10 flex flex-col gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">phone_iphone</span>
                  <span>Step 1: Phone Number (දුරකථන අංකය)</span>
                </label>
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="text-xs text-error font-bold flex items-center gap-1 hover:underline"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                    <span>Clear & New</span>
                  </button>
                )}
              </div>

              {/* Large Input Bar */}
              <div className="relative">
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="e.g. 077 123 4567 or 771234567"
                  className="w-full h-14 pl-12 pr-12 text-xl font-bold font-mono tracking-wider rounded-xl bg-surface-container border-2 border-outline/20 focus:border-primary focus:outline-none transition-all placeholder:text-on-surface-variant/40"
                  autoFocus
                />
                <span className="material-symbols-outlined absolute left-4 top-4 text-on-surface-variant text-2xl">
                  search
                </span>
                {phoneInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneInput('');
                      setSelectedCustomer(null);
                    }}
                    className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-2xl">cancel</span>
                  </button>
                )}
              </div>

              {/* Returning Customer Banner (Zero Duplicate Guarantee) */}
              {selectedCustomer && (
                <div className="p-4 rounded-xl bg-primary-container/20 border-2 border-primary flex items-start gap-3 animate-fadeIn">
                  <div className="h-10 w-10 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-xl">verified</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-on-surface text-base">
                        {selectedCustomer.name}
                      </span>
                      {selectedCustomer.isVip && (
                        <span className="px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container text-[11px] font-bold">
                          ⭐ VIP Client
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-bold">
                        {selectedCustomer.customerNumber}
                      </span>
                    </div>
                    <div className="text-xs text-on-surface-variant mt-1 flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-primary">
                        Visit #{selectedCustomer.totalVisits}
                      </span>
                      <span>•</span>
                      <span>
                        Last seen:{' '}
                        {selectedCustomer.daysSinceLastVisit === 0
                          ? 'Today'
                          : `${selectedCustomer.daysSinceLastVisit} days ago`}
                      </span>
                      {selectedCustomer.preferredBarberName && (
                        <>
                          <span>•</span>
                          <span>Fav: {selectedCustomer.preferredBarberName}</span>
                        </>
                      )}
                    </div>
                    {selectedCustomer.notes && (
                      <p className="text-xs text-on-surface-variant/90 italic mt-1 bg-surface-container/60 p-1.5 rounded-md">
                        &quot;{selectedCustomer.notes}&quot;
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Instant Search Results Dropdown */}
              {!selectedCustomer && searchResults.length > 0 && (
                <div className="flex flex-col gap-2 mt-1 border border-outline/20 rounded-xl p-2 bg-surface-container">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase px-2">
                    Matching Customer Profiles ({searchResults.length})
                  </span>
                  {searchResults.map((cust) => (
                    <button
                      key={cust.id}
                      type="button"
                      onClick={() => handleSelectCustomer(cust)}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low hover:bg-primary/10 border border-transparent hover:border-primary/40 transition-all text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-xs text-primary">
                          {cust.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-on-surface flex items-center gap-1.5">
                            <span>{cust.name}</span>
                            {cust.isVip && <span className="text-tertiary">★</span>}
                          </div>
                          <div className="text-[11px] text-on-surface-variant font-mono">
                            {cust.mobile} • {cust.customerNumber}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-primary block">
                          {cust.totalVisits} visits
                        </span>
                        <span className="text-[10px] text-on-surface-variant">Tap to reuse</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Name Input (For New Customers or Name Update) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                <div>
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase mb-1 block">
                    Customer Name (නම)
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g. Kasun Perera (or leave blank)"
                    className="w-full h-11 px-3 text-sm rounded-xl bg-surface-container border border-outline/20 focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={whatsappSync}
                      onChange={(e) => setWhatsappSync(e.target.checked)}
                      className="h-5 w-5 rounded border-outline/30 text-primary focus:ring-primary"
                    />
                    <span className="text-xs font-bold text-on-surface">
                      WhatsApp Token & LankaQR Bill (+94)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Step 2: Select Service (Large Touch Buttons) */}
            <div className="bg-surface-container-low p-5 rounded-2xl border border-outline/10 flex flex-col gap-3 shadow-xs">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">content_cut</span>
                <span>Step 2: Select Service (සේවාව තෝරන්න)</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {AVAILABLE_SERVICES.map((serv) => {
                  const isSelected = selectedServiceId === serv.id;
                  return (
                    <button
                      key={serv.id}
                      type="button"
                      onClick={() => setSelectedServiceId(serv.id)}
                      className={`min-h-[72px] p-3 rounded-xl border-2 flex flex-col justify-between text-left transition-all active:scale-95 ${isSelected
                        ? 'border-primary bg-primary/10 shadow-xs'
                        : 'border-outline/15 bg-surface-container hover:border-outline/30'
                        }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`material-symbols-outlined text-xl ${isSelected ? 'text-primary' : 'text-on-surface-variant'
                            }`}
                        >
                          {serv.icon}
                        </span>
                        {serv.isPopular && (
                          <span className="text-[10px] uppercase font-bold text-tertiary bg-tertiary-container/30 px-1.5 py-0.5 rounded">
                            Popular
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-on-surface leading-tight mt-1">
                          {serv.name}
                        </div>
                        <div className="text-[11px] text-on-surface-variant mt-0.5">
                          {serv.sinhalaName}
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[11px] font-bold">
                          <span className="text-primary font-mono">
                            Rs. {serv.priceLkr.toLocaleString()}
                          </span>
                          <span className="text-on-surface-variant font-mono">
                            {serv.durationMinutes}m
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Barber & Priority Quick Picks */}
            <div className="bg-surface-container-low p-5 rounded-2xl border border-outline/10 flex flex-col gap-3 shadow-xs">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">badge</span>
                <span>Step 3: Preferred Barber & Priority (බාබර් සහ ප්‍රමුඛතාව)</span>
              </label>

              {/* Barber Selector Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {BARBERS.map((barber) => {
                  const isSelected = selectedStaffId === barber.id;
                  return (
                    <button
                      key={barber.id}
                      type="button"
                      onClick={() => setSelectedStaffId(barber.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${isSelected
                        ? 'border-primary bg-primary/10 font-bold'
                        : 'border-outline/15 bg-surface-container text-on-surface-variant'
                        }`}
                    >
                      <div className="text-xs font-bold text-on-surface">{barber.name}</div>
                      <div className="text-[10px] text-on-surface-variant mt-0.5">
                        {barber.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Priority Chips */}
              <div className="flex items-center gap-2 pt-2 flex-wrap">
                <span className="text-xs font-bold text-on-surface-variant">Priority:</span>
                {(['normal', 'priority', 'vip', 'emergency'] as const).map((p) => {
                  const isP = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${isP
                        ? p === 'vip'
                          ? 'bg-tertiary-container text-on-tertiary-container border border-tertiary'
                          : p === 'emergency'
                            ? 'bg-error text-on-error'
                            : 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                    >
                      {p === 'vip'
                        ? '⭐ VIP'
                        : p === 'emergency'
                          ? '🚨 Emergency'
                          : p === 'priority'
                            ? '⚡ Priority'
                            : 'Normal'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Execution Actions (Touch-Friendly 64px Button) */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleQuickRegister(false)}
                disabled={submitting}
                className="flex-1 min-h-[64px] rounded-2xl bg-primary text-on-primary font-title-medium text-title-medium font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-primary/95 active:scale-98 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-2xl">confirmation_number</span>
                <span>
                  {submitting ? 'Generating Token...' : 'Generate Token & Enqueue (ටෝකන් නිකුත් කරන්න)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickRegister(true)}
                disabled={submitting}
                className="sm:w-60 min-h-[64px] rounded-2xl bg-secondary-container text-on-secondary-container font-title-medium text-sm font-bold flex items-center justify-center gap-2 border border-outline/10 hover:bg-secondary-container/90 active:scale-98 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-xl">payments</span>
                <span>Direct Billing (ක්ෂණික බිල්)</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: CUSTOMER MERGE ENGINE                                   */}
        {/* ============================================================== */}
        {activeTab === 'merge' && (
          <div className="bg-surface-container-low p-5 rounded-2xl border border-outline/10 flex flex-col gap-4 shadow-xs">
            <div>
              <h2 className="font-title-medium text-title-medium font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">merge</span>
                <span>Customer Profile Deduplication Engine</span>
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Merge duplicate customer records created with different phone formats (e.g. 077 vs +9477).
                All visit counts, past appointments, invoices, and queue tickets are migrated into the primary profile.
              </p>
            </div>

            {mergeResultMsg && (
              <div className="p-3 rounded-xl bg-tertiary-container/30 border border-tertiary text-xs font-bold text-on-tertiary-container">
                {mergeResultMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Primary Profile Selector */}
              <div className="p-4 rounded-xl bg-surface-container border border-outline/10 flex flex-col gap-2">
                <span className="text-xs font-bold text-primary uppercase">
                  1. Primary Profile (To Keep)
                </span>
                <input
                  type="text"
                  value={mergePrimaryQuery}
                  onChange={async (e) => {
                    setMergePrimaryQuery(e.target.value);
                    if (e.target.value.length >= 2) {
                      const res = await WalkInService.searchCustomers(e.target.value);
                      setPrimaryMatches(res);
                    } else {
                      setPrimaryMatches([]);
                    }
                  }}
                  placeholder="Search by phone, name or number..."
                  className="w-full h-10 px-3 text-xs rounded-lg bg-surface-container-low border border-outline/20 focus:outline-none focus:border-primary"
                />

                {selectedPrimary ? (
                  <div className="p-2.5 rounded-lg bg-primary/10 border border-primary flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-on-surface">{selectedPrimary.name}</div>
                      <div className="text-[11px] font-mono text-on-surface-variant">
                        {selectedPrimary.mobile} ({selectedPrimary.customerNumber})
                      </div>
                      <div className="text-[10px] text-primary font-bold">
                        {selectedPrimary.totalVisits} visits • Rs. {selectedPrimary.totalSpending}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPrimary(null)}
                      className="text-xs text-error hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  primaryMatches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedPrimary(c);
                        setPrimaryMatches([]);
                      }}
                      className="p-2 rounded-lg bg-surface-container-low hover:bg-primary/5 text-left border border-outline/10 text-xs"
                    >
                      <div className="font-bold">{c.name}</div>
                      <div className="text-[11px] text-on-surface-variant font-mono">
                        {c.mobile} • {c.customerNumber}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Secondary Profile Selector */}
              <div className="p-4 rounded-xl bg-surface-container border border-outline/10 flex flex-col gap-2">
                <span className="text-xs font-bold text-error uppercase">
                  2. Duplicate Profile (To Merge & Remove)
                </span>
                <input
                  type="text"
                  value={mergeSecondaryQuery}
                  onChange={async (e) => {
                    setMergeSecondaryQuery(e.target.value);
                    if (e.target.value.length >= 2) {
                      const res = await WalkInService.searchCustomers(e.target.value);
                      setSecondaryMatches(res);
                    } else {
                      setSecondaryMatches([]);
                    }
                  }}
                  placeholder="Search duplicate by phone or name..."
                  className="w-full h-10 px-3 text-xs rounded-lg bg-surface-container-low border border-outline/20 focus:outline-none focus:border-error"
                />

                {selectedSecondary ? (
                  <div className="p-2.5 rounded-lg bg-error-container/20 border border-error flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-on-surface">{selectedSecondary.name}</div>
                      <div className="text-[11px] font-mono text-on-surface-variant">
                        {selectedSecondary.mobile} ({selectedSecondary.customerNumber})
                      </div>
                      <div className="text-[10px] text-error font-bold">
                        {selectedSecondary.totalVisits} visits • Rs. {selectedSecondary.totalSpending}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSecondary(null)}
                      className="text-xs text-error hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  secondaryMatches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedSecondary(c);
                        setSecondaryMatches([]);
                      }}
                      className="p-2 rounded-lg bg-surface-container-low hover:bg-error/5 text-left border border-outline/10 text-xs"
                    >
                      <div className="font-bold">{c.name}</div>
                      <div className="text-[11px] text-on-surface-variant font-mono">
                        {c.mobile} • {c.customerNumber}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-on-surface-variant uppercase mb-1 block">
                Audit Reason
              </label>
              <input
                type="text"
                value={mergeReason}
                onChange={(e) => setMergeReason(e.target.value)}
                placeholder="e.g. Duplicate customer record entered during rush hours"
                className="w-full h-10 px-3 text-xs rounded-lg bg-surface-container border border-outline/20"
              />
            </div>

            <button
              type="button"
              onClick={handleExecuteMerge}
              disabled={mergeSubmitting || !selectedPrimary || !selectedSecondary}
              className="h-12 rounded-xl bg-error text-on-error font-bold text-xs flex items-center justify-center gap-2 hover:bg-error/90 active:scale-98 transition-all disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-lg">merge</span>
              <span>{mergeSubmitting ? 'Merging Profiles...' : 'Confirm & Merge Customer Profiles'}</span>
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: DAILY WALK-IN REPORTS & ANALYTICS                       */}
        {/* ============================================================== */}
        {activeTab === 'reports' && reports && (
          <div className="bg-surface-container-low p-5 rounded-2xl border border-outline/10 flex flex-col gap-4 shadow-xs">
            <div>
              <h2 className="font-title-medium text-title-medium font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">analytics</span>
                <span>Walk-in Performance Metrics</span>
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Conversion and repeat customer telemetry for walk-in operations.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-surface-container border border-outline/10">
                <span className="text-xs text-on-surface-variant font-bold">Repeat Walk-in Rate</span>
                <div className="text-2xl font-black text-primary mt-1">
                  {reports.repeatCustomerRatePct}%
                </div>
                <span className="text-[11px] text-on-surface-variant">
                  {reports.todayRepeatWalkIns} of {reports.todayTotalWalkIns} visitors are returning clients
                </span>
              </div>
              <div className="p-4 rounded-xl bg-surface-container border border-outline/10">
                <span className="text-xs text-on-surface-variant font-bold">Service Conversion Rate</span>
                <div className="text-2xl font-black text-tertiary mt-1">
                  {reports.conversionRatePct}%
                </div>
                <span className="text-[11px] text-on-surface-variant">
                  {reports.todayServedCount} of {reports.todayTotalWalkIns} completed and billed
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-container border border-outline/10">
              <span className="text-xs font-bold text-on-surface-variant uppercase mb-3 block">
                7-Day Walk-in Volume Trend
              </span>
              <div className="flex items-end justify-between h-32 gap-2 pt-4">
                {reports.sevenDayTrend.map((d) => {
                  const maxCount = Math.max(...reports.sevenDayTrend.map((t) => t.count), 1);
                  const heightPct = Math.round((d.count / maxCount) * 100);
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="text-[11px] font-bold text-primary">{d.count}</span>
                      <div
                        style={{ height: `${Math.max(heightPct, 10)}%` }}
                        className="w-full max-w-[36px] bg-primary rounded-t-md transition-all hover:bg-primary/80"
                      />
                      <span className="text-[10px] text-on-surface-variant font-mono">
                        {d.date && d.date.length >= 5 ? d.date.slice(5) : d.date || ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ISSUED TOKEN CONFIRMATION MODAL                                */}
        {/* ============================================================== */}
        {issuedTicketModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest max-w-sm w-full rounded-3xl p-6 shadow-2xl border border-outline/10 flex flex-col items-center text-center animate-scaleUp">
              <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-4xl">check_circle</span>
              </div>

              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Smart Salon LK • Kiribathgoda
              </span>
              <h3 className="font-title-large text-title-large font-bold text-on-surface mt-1">
                Walk-in Token Issued
              </h3>

              {/* Big Token Number Display */}
              <div className="my-4 py-4 px-6 rounded-2xl bg-surface-container border-2 border-primary/40 w-full flex flex-col items-center">
                <span className="text-xs text-on-surface-variant font-bold uppercase">
                  Your Queue Number (ඔබගේ අංකය)
                </span>
                <span className="text-5xl font-black font-mono text-primary tracking-tight my-1">
                  #{issuedTicketModal.queueTicket.queueNumber}
                </span>
                <span className="text-xs font-mono text-on-surface-variant">
                  {issuedTicketModal.queueTicket.ticketCode}
                </span>
              </div>

              {/* Details List */}
              <div className="w-full bg-surface-container-low rounded-xl p-3 text-xs space-y-1.5 text-left mb-4">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Customer:</span>
                  <span className="font-bold text-on-surface">
                    {issuedTicketModal.customer.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Mobile:</span>
                  <span className="font-mono text-on-surface">
                    {issuedTicketModal.customer.mobile}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Service:</span>
                  <span className="font-bold text-on-surface">
                    {issuedTicketModal.queueTicket.serviceName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Barber:</span>
                  <span className="font-bold text-primary">
                    {issuedTicketModal.queueTicket.barberName}
                  </span>
                </div>
                <div className="flex justify-between border-t border-outline/10 pt-1.5 font-bold">
                  <span className="text-on-surface-variant">Est. Waiting Time:</span>
                  <span className="text-tertiary">
                    ~{issuedTicketModal.queueTicket.estimatedWaitingTime} Mins
                  </span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex flex-col gap-2 w-full">
                {issuedTicketModal.customer.whatsapp && (
                  <a
                    href={`https://wa.me/${issuedTicketModal.customer.whatsapp.replace(
                      /[^0-9]/g,
                      ''
                    )}?text=${encodeURIComponent(
                      `💈 *Smart Salon LK - Token Confirmation*\n\nHello ${issuedTicketModal.customer.name},\nYour Walk-in Token is *#${issuedTicketModal.queueTicket.queueNumber}* (${issuedTicketModal.queueTicket.ticketCode}).\nService: ${issuedTicketModal.queueTicket.serviceName}\nEst. Wait: ~${issuedTicketModal.queueTicket.estimatedWaitingTime} mins.\n\nTrack Live Queue: https://smart-salon.lk/live-queue?code=${issuedTicketModal.queueTicket.ticketCode}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 rounded-xl bg-tertiary text-on-tertiary font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-tertiary/90 transition-all shadow-xs"
                  >
                    <span className="material-symbols-outlined text-base">chat</span>
                    <span>Send WhatsApp Slip (වට්ස්ඇප් යවන්න)</span>
                  </a>
                )}

                <div className="flex gap-2">
                  <Link
                    href="/pos"
                    className="flex-1 h-10 rounded-xl bg-secondary text-on-secondary font-bold text-xs flex items-center justify-center gap-1 shadow-xs hover:opacity-90 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
                    <span>Go to POS</span>
                  </Link>

                  <Link
                    href={`/live-queue?code=${issuedTicketModal.queueTicket.ticketCode}`}
                    className="flex-1 h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs flex items-center justify-center gap-1 border border-outline/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    <span>Live Board</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setIssuedTicketModal(null)}
                    className="flex-1 h-10 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/95 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-full shadow-lg text-xs font-bold animate-fadeIn">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}

