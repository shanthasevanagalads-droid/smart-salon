'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  StaffMember,
  StaffAvailability,
  StaffPosition,
  StaffLeaveRequest,
  BarberStationDashboardData,
  StaffCommissionReport,
} from '@/types/staff';

const AVAILABILITY_CONFIG: Record<
  StaffAvailability,
  { label: string; sinhala: string; color: string; bg: string; dot: string }
> = {
  available: {
    label: 'Available',
    sinhala: 'ලෑස්තියි',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  busy: {
    label: 'In Chair',
    sinhala: 'කාර්යබහුලයි',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
  on_break: {
    label: 'Break',
    sinhala: 'විවේකයේ',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  on_leave: {
    label: 'On Leave',
    sinhala: 'නිවාඩු',
    color: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
  off_duty: {
    label: 'Off Duty',
    sinhala: 'වැඩ අවසන්',
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
};

export default function StaffManagementView() {
  const [, startTransition] = useTransition();

  // Navigation State
  const [activeTab, setActiveTab] = useState<'roster' | 'station' | 'schedule' | 'leaves'>('roster');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('c0000000-0000-0000-0000-000000000001');
  const [stationData, setStationData] = useState<BarberStationDashboardData | null>(null);
  const [leavesList, setLeavesList] = useState<StaffLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isUpsertOpen, setIsUpsertOpen] = useState(false);
  const [isCommissionOpen, setIsCommissionOpen] = useState(false);
  const [commissionReport, setCommissionReport] = useState<StaffCommissionReport | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  // Form State for Upsert Staff
  const [formStaffId, setFormStaffId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formSinhala, setFormSinhala] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWhatsApp, setFormWhatsApp] = useState('');
  const [formPosition, setFormPosition] = useState<StaffPosition>('senior_barber');
  const [formChair, setFormChair] = useState<number>(1);
  const [formCommission, setFormCommission] = useState<number>(35.0);
  const [formPhoto, setFormPhoto] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form State for Leave Request
  const [leaveStaffId, setLeaveStaffId] = useState<string>('c0000000-0000-0000-0000-000000000001');
  const [leaveType, setLeaveType] = useState<'annual' | 'medical' | 'personal'>('annual');
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  // 1. Fetch Staff List
  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff');
      const data = await res.json();
      if (data.success && data.staff) {
        setStaffList(data.staff);
        if (data.staff.length > 0 && !selectedStaffId) {
          setSelectedStaffId(data.staff[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Station Dashboard for Selected Staff
  const fetchStationDashboard = async (staffId: string) => {
    try {
      const res = await fetch(`/api/staff/${staffId}/dashboard`);
      const data = await res.json();
      if (data.success && data.dashboard) {
        setStationData(data.dashboard);
      }
    } catch (err) {
      console.error('Failed to load station dashboard:', err);
    }
  };

  // 3. Fetch Leaves
  const fetchLeaves = async () => {
    try {
      const res = await fetch('/api/staff/c0000000-0000-0000-0000-000000000001/leaves');
      const data = await res.json();
      if (data.success && data.leaves) {
        setLeavesList(data.leaves);
      }
    } catch (err) {
      console.error('Failed to load leaves:', err);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchLeaves();
  }, []);

  useEffect(() => {
    if (selectedStaffId) {
      fetchStationDashboard(selectedStaffId);
    }
  }, [selectedStaffId]);

  // Handle Availability Toggle
  const handleAvailabilityToggle = async (staffId: string, availability: StaffAvailability) => {
    // Optimistic update
    setStaffList((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, availability } : s))
    );
    if (stationData && stationData.staff.id === staffId) {
      setStationData({
        ...stationData,
        staff: { ...stationData.staff, availability },
      });
    }

    try {
      await fetch(`/api/staff/${staffId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability }),
      });
    } catch (err) {
      console.error('Availability update failed:', err);
    }
  };

  // Open Upsert Modal (Create or Edit)
  const openEditModal = (staff?: StaffMember) => {
    setFormError(null);
    if (staff) {
      setFormStaffId(staff.id);
      setFormName(staff.fullName);
      setFormSinhala(staff.sinhalaName || '');
      setFormPhone(staff.phone);
      setFormWhatsApp(staff.whatsapp || staff.phone);
      setFormPosition(staff.position);
      setFormChair(staff.chairNumber);
      setFormCommission(staff.commissionPercentage);
      setFormPhoto(staff.photoUrl || '');
    } else {
      setFormStaffId(null);
      setFormName('');
      setFormSinhala('');
      setFormPhone('+94');
      setFormWhatsApp('+94');
      setFormPosition('junior_barber');
      // Suggest vacant chair if possible
      const hasChair1 = staffList.some((s) => s.chairNumber === 1);
      setFormChair(hasChair1 ? 2 : 1);
      setFormCommission(30.0);
      setFormPhoto('');
    }
    setIsUpsertOpen(true);
  };

  // Submit Upsert Staff
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formStaffId || undefined,
          fullName: formName,
          sinhalaName: formSinhala,
          phone: formPhone,
          whatsapp: formWhatsApp,
          position: formPosition,
          chairNumber: formChair,
          commissionPercentage: formCommission,
          photoUrl: formPhoto || undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save barber profile.');
      }

      setIsUpsertOpen(false);
      fetchStaff();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error saving staff member.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // View Commission Report
  const handleOpenCommission = async (staffId: string) => {
    try {
      const res = await fetch(`/api/staff/${staffId}/commission`);
      const data = await res.json();
      if (data.success && data.report) {
        setCommissionReport(data.report);
        setIsCommissionOpen(true);
      }
    } catch (err) {
      console.error('Failed to load commission report:', err);
    }
  };

  // Submit Leave Request
  const handleSaveLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStartDate || !leaveEndDate || !leaveReason) {
      alert('Please fill out all leave dates and reason.');
      return;
    }

    try {
      const res = await fetch(`/api/staff/${leaveStaffId}/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveType,
          startDate: leaveStartDate,
          endDate: leaveEndDate,
          reason: leaveReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsLeaveModalOpen(false);
        setLeaveStartDate('');
        setLeaveEndDate('');
        setLeaveReason('');
        fetchLeaves();
        alert(data.message || 'Leave logged successfully.');
      } else {
        alert(data.error || 'Failed to submit leave.');
      }
    } catch {
      alert('Network error submitting leave.');
    }
  };

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId) || staffList[0];

  return (
    <div className="min-h-screen bg-surface-dim pb-24 text-on-surface">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high/60 shadow-sm px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/pos"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-surface-container-high hover:bg-surface-container-highest transition-colors text-primary"
              title="Return to Cashier POS"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-title-lg text-title-lg text-primary font-bold tracking-tight">
                  Barber & Staff Management
                </span>
                <span className="text-xs bg-tertiary-container text-tertiary-fixed font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  V1 Dual-Chair
                </span>
              </div>
              <p className="text-xs text-on-surface-variant font-medium">
                කාර්ය මණ්ඩල කළමනාකරණය • Smart Salon LK (Ampitiya)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/customers"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-xs font-semibold text-primary transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">groups</span>
              <span>CRM Customers</span>
            </Link>
            <button
              type="button"
              onClick={() => openEditModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold shadow-sm hover:opacity-95 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span>Add Barber</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="max-w-5xl mx-auto px-4 pt-4 flex flex-col gap-4">
        {/* Version 1 Architecture Info Pill */}
        <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-start gap-3 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">
            info
          </span>
          <div className="flex-1">
            <span className="font-bold text-primary">Version 1 Dual-Barber Standard:</span> Optimized for Sri
            Lankan small barbershops with <strong>Chair 01</strong> (Master Kavi) & <strong>Chair 02</strong> (Sunil
            Shantha). Multi-chair unlimited scaling is architecture-ready for V2.
          </div>
        </div>

        {/* 3. Navigation Tabs */}
        <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-surface-container-high/40 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'roster'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">badge</span>
            <span>Barber Team (කණ්ඩායම)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('station')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'station'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">chair</span>
            <span>Chair Station (ආසන පාලකය)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'schedule'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">schedule</span>
            <span>Working Shifts (වැඩ මුර)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leaves')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'leaves'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">event_busy</span>
            <span>Leave Log (නිවාඩු)</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: BARBER TEAM & PROFILES
           ========================================================================= */}
        {activeTab === 'roster' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {staffList.map((barber) => {
                const avail = AVAILABILITY_CONFIG[barber.availability] || AVAILABILITY_CONFIG.available;
                return (
                  <div
                    key={barber.id}
                    className="bg-surface rounded-2xl border border-surface-container-high/60 shadow-sm overflow-hidden flex flex-col justify-between"
                  >
                    {/* Top Identity Card Header */}
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {/* Barber Profile Photo */}
                          <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-surface-container-high border-2 border-surface shadow-md shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                barber.photoUrl ||
                                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80'
                              }
                              alt={barber.fullName}
                              className="w-full h-full object-cover"
                            />
                            {/* Status Dot Pill */}
                            <span
                              className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-surface ${avail.dot}`}
                              title={avail.label}
                            />
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="font-bold text-base text-primary leading-snug">
                                {barber.fullName}
                              </h3>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
                                Chair 0{barber.chairNumber}
                              </span>
                            </div>
                            <span className="text-xs text-on-surface-variant font-medium">
                              {barber.sinhalaName} • {barber.staffNumber}
                            </span>
                            <span className="text-xs font-semibold text-secondary mt-0.5">
                              {barber.position === 'senior_barber'
                                ? 'Senior Barber (ප්‍රධාන බාබර්)'
                                : barber.position === 'junior_barber'
                                ? 'Junior Barber (කනිෂ්ඨ බාබර්)'
                                : 'Artisan Stylist'}
                            </span>
                          </div>
                        </div>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => openEditModal(barber)}
                          className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant transition-colors cursor-pointer"
                          title="Edit Barber"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                      </div>

                      {/* Phone & WhatsApp Contacts */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-surface-container-high/40">
                        <a
                          href={`tel:${barber.phone}`}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-xs text-primary font-medium transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px] text-primary">call</span>
                          <span className="truncate">{barber.phone}</span>
                        </a>

                        <a
                          href={`https://wa.me/${barber.whatsapp?.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-xs text-emerald-800 dark:text-emerald-300 font-medium transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px] text-emerald-600">chat</span>
                          <span>WhatsApp</span>
                        </a>
                      </div>

                      {/* Live Availability Selector Buttons */}
                      <div className="flex flex-col gap-1.5 pt-1">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant">
                          Live Status (සජීවී තත්වය):
                        </span>
                        <div className="grid grid-cols-5 gap-1">
                          {(['available', 'busy', 'on_break', 'on_leave', 'off_duty'] as StaffAvailability[]).map(
                            (st) => {
                              const cfg = AVAILABILITY_CONFIG[st];
                              const isActive = barber.availability === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleAvailabilityToggle(barber.id, st)}
                                  className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                    isActive
                                      ? `${cfg.bg} ${cfg.color} ring-2 ring-primary/20 scale-102 font-extrabold shadow-sm`
                                      : 'bg-surface-container-lowest text-on-surface-variant border-surface-container-high/60 hover:bg-surface-container-high'
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full mb-1 ${cfg.dot}`} />
                                  <span className="leading-tight">{cfg.label}</span>
                                </button>
                              );
                            }
                          )}
                        </div>
                      </div>

                      {/* Today's Performance Metrics Strip */}
                      <div className="grid grid-cols-3 gap-2 bg-surface-container-low p-2.5 rounded-xl border border-surface-container-high/40">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
                            Cuts Today
                          </span>
                          <span className="text-sm font-extrabold text-primary">
                            {barber.todayCompletedJobs || 0}{' '}
                            <span className="text-[11px] font-normal text-on-surface-variant">heads</span>
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
                            Today Revenue
                          </span>
                          <span className="text-sm font-extrabold text-secondary font-mono">
                            LKR {(barber.todayRevenueLkr || 0).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
                            Commission ({barber.commissionPercentage}%)
                          </span>
                          <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                            LKR {(barber.todayCommissionLkr || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Assigned Services Pills */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant">
                          Assigned Services (සේවා හැකියාවන්):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {(barber.assignedServices || []).slice(0, 4).map((s) => (
                            <span
                              key={s.serviceId}
                              className="text-[11px] bg-surface-container px-2 py-0.5 rounded-md text-on-surface-variant font-medium"
                            >
                              {s.serviceName}
                            </span>
                          ))}
                          {(barber.assignedServices?.length || 0) > 4 && (
                            <span className="text-[11px] bg-surface-container-high px-2 py-0.5 rounded-md text-primary font-bold">
                              +{(barber.assignedServices?.length || 0) - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="bg-surface-container-low px-4 py-2.5 border-t border-surface-container-high/60 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStaffId(barber.id);
                          setActiveTab('station');
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">chair</span>
                        <span>Open Chair 0{barber.chairNumber} Station</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenCommission(barber.id)}
                        className="flex items-center gap-1 text-xs font-bold text-secondary hover:underline cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">payments</span>
                        <span>Commission Statement</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: BARBER CHAIR STATION (LIVE OPERATOR CONSOLE)
           ========================================================================= */}
        {activeTab === 'station' && stationData && (
          <div className="flex flex-col gap-4">
            {/* Chair Switcher Tabs */}
            <div className="flex items-center justify-between bg-surface p-2 rounded-2xl border border-surface-container-high/60 shadow-sm">
              <div className="flex items-center gap-2">
                {staffList.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStaffId(s.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedStaffId === s.id
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">chair</span>
                    <span>
                      Chair 0{s.chairNumber} • {s.fullName.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Station Current Availability Pill */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-on-surface-variant hidden sm:inline">Status:</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                    AVAILABILITY_CONFIG[stationData.staff.availability]?.bg || ''
                  } ${AVAILABILITY_CONFIG[stationData.staff.availability]?.color || ''}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      AVAILABILITY_CONFIG[stationData.staff.availability]?.dot || ''
                    }`}
                  />
                  <span>{AVAILABILITY_CONFIG[stationData.staff.availability]?.label}</span>
                </span>
              </div>
            </div>

            {/* Active Seat & Queue Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Left Column: Active Client in Chair (Hot Path) */}
              <div className="md:col-span-2 bg-gradient-to-br from-primary-container/20 to-primary-container/5 rounded-2xl border-2 border-primary/20 p-5 shadow-sm flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-primary">
                        content_cut
                      </span>
                      <span className="font-bold text-sm uppercase tracking-wider text-primary">
                        Chair 0{stationData.staff.chairNumber} Active Customer (දැනට ආසනයේ)
                      </span>
                    </div>

                    {stationData.activeTicket && (
                      <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs px-2.5 py-1 rounded-full animate-pulse">
                        ● IN PROGRESS
                      </span>
                    )}
                  </div>

                  {stationData.activeTicket ? (
                    <div className="bg-surface rounded-xl p-4 border border-surface-container-high/60 shadow-sm flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-primary font-mono">
                              #{stationData.activeTicket.ticketNumber}
                            </span>
                            <span className="text-lg font-bold text-on-surface">
                              {stationData.activeTicket.customerName}
                            </span>
                            {stationData.activeTicket.isVip && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                                VIP
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-on-surface-variant font-mono">
                            {stationData.activeTicket.customerPhone || 'Walk-in guest'}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-lg font-extrabold text-secondary font-mono">
                            LKR {stationData.activeTicket.priceLkr.toLocaleString()}
                          </span>
                          <div className="text-xs text-on-surface-variant font-medium">
                            ~{stationData.activeTicket.durationMinutes} mins
                          </div>
                        </div>
                      </div>

                      <div className="bg-surface-container-low p-2.5 rounded-lg flex items-center justify-between text-xs">
                        <span className="font-bold text-primary">
                          {stationData.activeTicket.serviceName} ({stationData.activeTicket.serviceSinhala})
                        </span>
                        <span className="text-on-surface-variant font-medium flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">timer</span>
                          Seat time: {stationData.activeTicket.elapsedMinutes}m elapsed
                        </span>
                      </div>

                      {/* Cashier CTA */}
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => alert(`Calling customer ${stationData.activeTicket?.customerName} again.`)}
                          className="py-2.5 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">volume_up</span>
                          <span>Chime Chime</span>
                        </button>

                        <Link
                          href="/pos"
                          className="py-2.5 px-3 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-1.5 shadow-md hover:opacity-95 transition-all"
                        >
                          <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                          <span>Finish & Open POS Bill</span>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-surface/60 rounded-xl p-8 border border-dashed border-surface-container-high flex flex-col items-center justify-center text-center gap-2">
                      <span className="material-symbols-outlined text-[36px] text-on-surface-variant">
                        chair_alt
                      </span>
                      <span className="font-bold text-sm text-primary">Chair is Currently Empty</span>
                      <p className="text-xs text-on-surface-variant max-w-xs">
                        Call the next waiting customer from the queue board below to start grooming.
                      </p>
                    </div>
                  )}
                </div>

                {/* Today's Cash & Commission Bar */}
                <div className="grid grid-cols-4 gap-2 bg-surface p-3 rounded-xl border border-surface-container-high/60 shadow-xs">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Heads Done</span>
                    <span className="text-base font-extrabold text-primary font-mono">
                      {stationData.todayStats.completedJobs}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Today Revenue</span>
                    <span className="text-base font-extrabold text-secondary font-mono">
                      LKR {stationData.todayStats.revenueLkr.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Commission</span>
                    <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                      LKR {stationData.todayStats.commissionLkr.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Avg Chair Time</span>
                    <span className="text-base font-extrabold text-primary font-mono">
                      {stationData.todayStats.avgChairDurationMinutes}m
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Waiting Queue for this Chair */}
              <div className="bg-surface rounded-2xl border border-surface-container-high/60 p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-surface-container-high/40 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-secondary">
                      groups
                    </span>
                    <span className="font-bold text-xs uppercase tracking-wider text-primary">
                      Next In Queue ({stationData.waitingQueue.length})
                    </span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant">පෝලිම</span>
                </div>

                <div className="flex flex-col gap-2 overflow-y-auto max-h-[360px]">
                  {stationData.waitingQueue.length === 0 ? (
                    <div className="text-center py-8 text-xs text-on-surface-variant">
                      No guests waiting in live queue.
                    </div>
                  ) : (
                    stationData.waitingQueue.map((q) => (
                      <div
                        key={q.queueId}
                        className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high/40 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center font-mono font-bold text-xs text-primary shadow-xs">
                            #{q.ticketNumber}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-on-surface truncate max-w-[120px]">
                              {q.customerName}
                            </span>
                            <span className="text-[10px] text-on-surface-variant">
                              {q.serviceName}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] font-bold text-secondary">
                            ~{q.estimatedWaitMinutes}m
                          </span>
                          <button
                            type="button"
                            onClick={() => alert(`Calling Ticket #${q.ticketNumber} to Chair 0${stationData.staff.chairNumber}`)}
                            className="text-[10px] bg-primary text-on-primary font-bold px-2 py-0.5 rounded-md block mt-1 hover:opacity-90"
                          >
                            Call Next
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: 7-DAY SHIFTS & WORKING SCHEDULES
           ========================================================================= */}
        {activeTab === 'schedule' && (
          <div className="bg-surface rounded-2xl border border-surface-container-high/60 p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-surface-container-high/40 pb-3">
              <div>
                <h3 className="font-bold text-base text-primary">
                  7-Day Working Hours & Shift Schedules
                </h3>
                <p className="text-xs text-on-surface-variant">
                  වැඩ මුර කාලසටහන • Standard salon operating hours (06:00 AM - 08:00 PM)
                </p>
              </div>

              {/* Staff Selector */}
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-bold text-primary"
              >
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    Chair 0{s.chairNumber}: {s.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-container-high/60 text-on-surface-variant uppercase text-[10px] tracking-wider font-bold">
                    <th className="py-2.5 px-3">Day of Week</th>
                    <th className="py-2.5 px-3">Shift Hours</th>
                    <th className="py-2.5 px-3">Lunch / Rest Break</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/30">
                  {[
                    { day: 'Monday (සඳුදා)', hours: '06:00 AM - 08:00 PM', breakTime: '01:00 PM - 02:00 PM', active: true },
                    { day: 'Tuesday (අඟහරුවාදා)', hours: '06:00 AM - 08:00 PM', breakTime: '01:00 PM - 02:00 PM', active: true },
                    { day: 'Wednesday (බදාදා)', hours: '06:00 AM - 08:00 PM', breakTime: '01:00 PM - 02:00 PM', active: true },
                    { day: 'Thursday (බ්‍රහස්පතින්දා)', hours: '06:00 AM - 08:00 PM', breakTime: '01:00 PM - 02:00 PM', active: true },
                    { day: 'Friday (සිකුරාදා)', hours: '06:00 AM - 08:00 PM', breakTime: '01:00 PM - 02:00 PM', active: true },
                    { day: 'Saturday (සෙනසුරාදා)', hours: '06:00 AM - 08:00 PM', breakTime: '01:00 PM - 02:00 PM', active: true },
                    { day: 'Sunday (ඉරිදා)', hours: '06:00 AM - 08:00 PM', breakTime: '01:00 PM - 02:00 PM', active: true },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3 px-3 font-bold text-primary">{row.day}</td>
                      <td className="py-3 px-3 font-mono text-on-surface">{row.hours}</td>
                      <td className="py-3 px-3 font-mono text-on-surface-variant">{row.breakTime}</td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          WORKING
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: LEAVE MANAGEMENT
           ========================================================================= */}
        {activeTab === 'leaves' && (
          <div className="flex flex-col gap-4">
            {/* 3 Leave Stat Balance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-surface p-4 rounded-2xl border border-surface-container-high/60 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase">
                    Annual Leave (වාර්ෂික)
                  </span>
                  <div className="text-xl font-black text-primary mt-0.5">14 Days</div>
                  <span className="text-[10px] text-emerald-700">Allocated per year</span>
                </div>
                <span className="material-symbols-outlined text-[28px] text-primary-container">
                  beach_access
                </span>
              </div>

              <div className="bg-surface p-4 rounded-2xl border border-surface-container-high/60 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase">
                    Medical Leave (වෛද්‍ය)
                  </span>
                  <div className="text-xl font-black text-primary mt-0.5">7 Days</div>
                  <span className="text-[10px] text-emerald-700">With medical proof</span>
                </div>
                <span className="material-symbols-outlined text-[28px] text-secondary">
                  medical_services
                </span>
              </div>

              <div className="bg-surface p-4 rounded-2xl border border-surface-container-high/60 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase">
                    Personal Leave (පුද්ගලික)
                  </span>
                  <div className="text-xl font-black text-primary mt-0.5">7 Days</div>
                  <span className="text-[10px] text-on-surface-variant">Emergency / family</span>
                </div>
                <span className="material-symbols-outlined text-[28px] text-on-tertiary-container">
                  event_available
                </span>
              </div>
            </div>

            {/* Leave History Table & Log Button */}
            <div className="bg-surface rounded-2xl border border-surface-container-high/60 p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-surface-container-high/40 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-primary">Barber Leave History & Approvals</h3>
                  <p className="text-xs text-on-surface-variant">නිවාඩු ඉල්ලීම් සහ අනුමත ලේඛනය</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold shadow-xs hover:opacity-95 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Request Leave</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-surface-container-high/60 text-on-surface-variant uppercase text-[10px] tracking-wider font-bold">
                      <th className="py-2 px-3">Barber</th>
                      <th className="py-2 px-3">Leave Type</th>
                      <th className="py-2 px-3">Dates</th>
                      <th className="py-2 px-3">Days</th>
                      <th className="py-2 px-3">Reason</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high/30">
                    {leavesList.map((lv) => (
                      <tr key={lv.id} className="hover:bg-surface-container-low/50">
                        <td className="py-2.5 px-3 font-bold text-primary">
                          {lv.staffName} (Chair 0{lv.chairNumber})
                        </td>
                        <td className="py-2.5 px-3 capitalize font-medium">{lv.leaveType}</td>
                        <td className="py-2.5 px-3 font-mono text-on-surface">
                          {lv.startDate} to {lv.endDate}
                        </td>
                        <td className="py-2.5 px-3 font-bold">{lv.daysCount} days</td>
                        <td className="py-2.5 px-3 text-on-surface-variant">{lv.reason}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              lv.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {lv.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          MODAL 1: UPSERT STAFF MEMBER (ENFORCES V1 LIMITS)
         ========================================================================= */}
      {isUpsertOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-2xl border border-surface-container-high shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-surface-container-low border-b border-surface-container-high/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-primary">
                  {formStaffId ? 'Edit Barber Profile' : 'Register New Barber'}
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Version 1 supports Chair 1 & Chair 2 assignments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUpsertOpen(false)}
                className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="p-5 flex flex-col gap-3.5 overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface">Full Name (English) *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Master Kavi"
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-primary"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface">Sinhala Name (සිංහල නම)</label>
                  <input
                    type="text"
                    value={formSinhala}
                    onChange={(e) => setFormSinhala(e.target.value)}
                    placeholder="උදා: කවිඳු පෙරේරා"
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface">Mobile Phone *</label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+94 77 123 4567"
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface font-mono focus:outline-primary"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface">WhatsApp Number</label>
                  <input
                    type="text"
                    value={formWhatsApp}
                    onChange={(e) => setFormWhatsApp(e.target.value)}
                    placeholder="+94 77 123 4567"
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface font-mono focus:outline-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface">Position *</label>
                  <select
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value as StaffPosition)}
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface font-bold focus:outline-primary"
                  >
                    <option value="owner">Owner</option>
                    <option value="senior_barber">Senior Barber</option>
                    <option value="junior_barber">Junior Barber</option>
                    <option value="assistant">Assistant</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-primary">Chair Number (V1 Max 2) *</label>
                  <select
                    value={formChair}
                    onChange={(e) => setFormChair(parseInt(e.target.value))}
                    className="px-3 py-2 rounded-xl bg-primary/10 border border-primary text-xs text-primary font-bold focus:outline-primary"
                  >
                    <option value={1}>Chair 01</option>
                    <option value={2}>Chair 02</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface">Commission % *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    required
                    value={formCommission}
                    onChange={(e) => setFormCommission(parseFloat(e.target.value) || 0)}
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface font-bold focus:outline-primary"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Profile Photo URL</label>
                <input
                  type="url"
                  value={formPhoto}
                  onChange={(e) => setFormPhoto(e.target.value)}
                  placeholder="https://..."
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high/60">
                <button
                  type="button"
                  onClick={() => setIsUpsertOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-container-high text-xs font-bold text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:opacity-95 disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: MONTHLY COMMISSION REPORT
         ========================================================================= */}
      {isCommissionOpen && commissionReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl border border-surface-container-high shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-surface-container-low border-b border-surface-container-high/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-primary">Monthly Commission Statement</h3>
                <p className="text-xs text-on-surface-variant">
                  {commissionReport.staffName} • Month: {commissionReport.month}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCommissionOpen(false)}
                className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-3 rounded-xl border border-surface-container-high/60">
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
                    Gross Salon Revenue
                  </span>
                  <div className="text-lg font-black text-primary font-mono">
                    LKR {commissionReport.grossRevenueLkr.toLocaleString()}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
                    Net Commission ({commissionReport.commissionPercentage}%)
                  </span>
                  <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">
                    LKR {commissionReport.netCommissionEarnedLkr.toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-primary mb-2 block">
                  Completed Services Breakdown
                </span>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {commissionReport.breakdownByService.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-surface-container-low/50"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-on-surface">{s.serviceName}</span>
                        <span className="text-[10px] text-on-surface-variant">{s.count} cuts</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-primary font-mono">
                          LKR {s.commissionLkr.toLocaleString()}
                        </span>
                        <div className="text-[10px] text-on-surface-variant">
                          Rev: LKR {s.revenueLkr.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm"
              >
                Print / Export Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: REQUEST LEAVE
         ========================================================================= */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-sm rounded-2xl border border-surface-container-high shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-surface-container-low border-b border-surface-container-high/60 flex items-center justify-between">
              <h3 className="font-bold text-base text-primary">Log Barber Leave</h3>
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(false)}
                className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveLeave} className="p-5 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Select Barber</label>
                <select
                  value={leaveStaffId}
                  onChange={(e) => setLeaveStaffId(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-bold text-primary"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      Chair 0{s.chairNumber}: {s.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Leave Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                >
                  <option value="annual">Annual Leave (වාර්ෂික)</option>
                  <option value="medical">Medical Leave (වෛද්‍ය)</option>
                  <option value="personal">Personal Leave (පුද්ගලික)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface">Start Date</label>
                  <input
                    type="date"
                    required
                    value={leaveStartDate}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-on-surface">End Date</label>
                  <input
                    type="date"
                    required
                    value={leaveEndDate}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Reason / Notes</label>
                <textarea
                  required
                  rows={2}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="e.g. Wedding in Nuwara Eliya"
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-surface-container-high text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md"
                >
                  Approve & Log Leave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

