'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  AppointmentDetail,
  AppointmentStatus,
  DailyChairSchedule,
  TimeSlot,
  BarberRecommendation,
  WhatsAppNotificationPayload,
} from '@/types/appointment';
import { AppointmentService } from '@/lib/services/appointment-service';

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; sinhala: string; bg: string; text: string; border: string; dot: string }
> = {
  pending: {
    label: 'Pending',
    sinhala: 'තහවුරු කිරීම බලාපොරොත්තුවෙන්',
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  confirmed: {
    label: 'Confirmed',
    sinhala: 'තහවුරු කරන ලදී',
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  checked_in: {
    label: 'Checked In',
    sinhala: 'පැමිණ සිටී (පෝලිමේ)',
    bg: 'bg-teal-50 dark:bg-teal-950/50',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800',
    dot: 'bg-teal-500',
  },
  waiting: {
    label: 'Waiting',
    sinhala: 'කාමරයේ රැඳී සිටී',
    bg: 'bg-indigo-50 dark:bg-indigo-950/50',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
    dot: 'bg-indigo-500',
  },
  in_service: {
    label: 'In Service',
    sinhala: 'පුටුවේ සේවය ලබමින්',
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700',
    dot: 'bg-emerald-500 animate-ping',
  },
  completed: {
    label: 'Completed',
    sinhala: 'අවසන් කරන ලදී',
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  cancelled: {
    label: 'Cancelled',
    sinhala: 'අවලංගුයි',
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
  no_show: {
    label: 'No Show',
    sinhala: 'පැමිණියේ නැත',
    bg: 'bg-purple-50 dark:bg-purple-950/50',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-400',
  },
};

const AVAILABLE_SERVICES = [
  { id: 'adult-cut', name: 'Adult Hair Cut', sinhala: 'වැඩිහිටි කොණ්ඩ කැපීම', price: 1200, duration: 30 },
  { id: 'cut-beard', name: 'Hair Cut + Beard', sinhala: 'කොණ්ඩය සහ රැවුල', price: 1800, duration: 45 },
  { id: 'child-cut', name: 'Child Hair Cut', sinhala: 'ළමා කොණ්ඩ කැපීම', price: 900, duration: 20 },
  { id: 'beard-trim', name: 'Beard Trim & Sculpt', sinhala: 'රැවුල හැඩගැන්වීම', price: 800, duration: 20 },
  { id: 'style-cut', name: 'Hair Style Cut', sinhala: 'නවීන විලාසිතා කොණ්ඩ කැපීම', price: 1400, duration: 35 },
  { id: 'hair-dye', name: 'Hair Dye', sinhala: 'කොණ්ඩය ඩයි කිරීම', price: 2200, duration: 40 },
  { id: 'hair-massage', name: 'Head Massage', sinhala: 'හිස සම්බාහනය', price: 1200, duration: 20 },
  { id: 'oil-massage', name: 'Herbal Oil Therapy', sinhala: 'ආයුර්වේද තෙල් සම්බාහනය', price: 1500, duration: 25 },
];

const BARBERS = [
  { id: 'c0000000-0000-0000-0000-000000000001', name: 'Master Kavi', sinhala: 'කවිඳු', chair: 1 },
  { id: 'c0000000-0000-0000-0000-000000000002', name: 'Sunil Shantha', sinhala: 'සුනිල්', chair: 2 },
];

export default function AppointmentManagementView() {
  const [, startTransition] = useTransition();

  // Primary State
  const [activeView, setActiveView] = useState<'timeline' | 'list' | 'calendar'>('timeline');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [appointments, setAppointments] = useState<AppointmentDetail[]>([]);
  const [schedule, setSchedule] = useState<DailyChairSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedBarberFilter, setSelectedBarberFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDetail | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Booking State
  const [bookingCustomerName, setBookingCustomerName] = useState('');
  const [bookingCustomerPhone, setBookingCustomerPhone] = useState('');
  const [bookingSelectedServices, setBookingSelectedServices] = useState<string[]>(['adult-cut']);
  const [bookingBarberId, setBookingBarberId] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>('');
  const [bookingTimeSlot, setBookingTimeSlot] = useState<string>('09:00');
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [barberRecommendation, setBarberRecommendation] = useState<BarberRecommendation | null>(null);
  const [whatsappResult, setWhatsappResult] = useState<WhatsAppNotificationPayload | null>(null);

  // Reschedule State
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState('');
  const [rescheduleBarberId, setRescheduleBarberId] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([]);

  // Show Feedback Notification
  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // Set initial client date on mount to avoid prerender time mismatch
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    setBookingDate(today);
  }, []);

  // Load Appointments and Schedule
  const loadData = async (dateToUse?: string) => {
    const d = dateToUse || selectedDate;
    if (!d) return;
    setIsLoading(true);
    try {
      const [apts, dailySchedule] = await Promise.all([
        AppointmentService.getAppointments({
          date: d,
          barberId: selectedBarberFilter !== 'all' ? selectedBarberFilter : undefined,
          status: selectedStatusFilter !== 'all' ? (selectedStatusFilter as AppointmentStatus) : undefined,
          search: searchQuery || undefined,
        }),
        AppointmentService.getDailyChairSchedule(undefined, d),
      ]);
      setAppointments(apts);
      setSchedule(dailySchedule);
    } catch (err) {
      console.error('Failed to load appointments:', err);
      notify('Error loading appointment data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedDate) return;
    startTransition(() => {
      loadData(selectedDate);
    });
  }, [selectedDate, selectedBarberFilter, selectedStatusFilter, searchQuery]);

  // Load Available Slots for Booking Modal
  const loadBookingSlots = async (date: string, barberId?: string, serviceIds: string[] = ['adult-cut']) => {
    setIsLoadingSlots(true);
    try {
      const totalDuration = serviceIds.reduce((sum, id) => {
        const s = AVAILABLE_SERVICES.find((srv) => srv.id === id);
        return sum + (s?.duration || 30);
      }, 0);

      const [slots, rec] = await Promise.all([
        AppointmentService.generateAvailableSlots(undefined, date, totalDuration, barberId || undefined),
        AppointmentService.recommendBarber(undefined, undefined, serviceIds, date),
      ]);

      setAvailableSlots(slots);
      setBarberRecommendation(rec);

      // Auto-select recommended barber if none picked
      if (!bookingBarberId && rec) {
        setBookingBarberId(rec.recommendedBarberId);
      }

      // Auto-select first available slot if current is invalid
      const firstOpen = slots.find((s) => s.isAvailable);
      if (firstOpen && (!bookingTimeSlot || !slots.some((s) => s.slotTime === bookingTimeSlot && s.isAvailable))) {
        setBookingTimeSlot(firstOpen.slotTime);
      }
    } catch (err) {
      console.error('Failed to generate slots:', err);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  // Trigger slot reload when booking modal opens or options change
  useEffect(() => {
    if (isBookModalOpen) {
      loadBookingSlots(bookingDate, bookingBarberId, bookingSelectedServices);
    }
  }, [isBookModalOpen, bookingDate, bookingBarberId, bookingSelectedServices]);

  // Handle Quick Date Jumps
  const handleDateOffset = (offsetDays: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Open Booking Modal for a specific time and chair
  const handleBookSlotClick = (slotTime: string, barberId: string) => {
    setBookingDate(selectedDate);
    setBookingBarberId(barberId);
    setBookingTimeSlot(slotTime);
    setIsBookModalOpen(true);
  };

  // Submit New Appointment
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingCustomerName.trim() || !bookingCustomerPhone.trim()) {
      notify('Please enter customer name and Sri Lankan phone number', 'error');
      return;
    }
    if (bookingSelectedServices.length === 0) {
      notify('Please choose at least one service', 'error');
      return;
    }

    try {
      const res = await AppointmentService.createAppointment({
        customerName: bookingCustomerName,
        customerPhone: bookingCustomerPhone,
        preferredBarberId: bookingBarberId || undefined,
        date: bookingDate,
        startTime: bookingTimeSlot,
        serviceIds: bookingSelectedServices,
        notes: bookingNotes,
        bookingSource: 'online_pwa',
      });

      notify(`Appointment ${res.appointment.appointmentNumber} reserved successfully!`);
      setWhatsappResult(res.whatsappPayload);
      setIsBookModalOpen(false);
      // Reset form
      setBookingCustomerName('');
      setBookingCustomerPhone('');
      setBookingNotes('');
      loadData();
    } catch (err: any) {
      notify(err.message || 'Double booking conflict detected. Please pick another slot.', 'error');
    }
  };

  // Open Reschedule Modal
  const openRescheduleModal = async (apt: AppointmentDetail) => {
    setSelectedAppointment(apt);
    setRescheduleDate(apt.appointmentDate);
    setRescheduleBarberId(apt.barberId || BARBERS[0].id);
    setRescheduleTimeSlot(apt.appointmentTime);
    setRescheduleReason('');

    try {
      const totalDur = apt.services.reduce((s, item) => s + item.durationMinutes, 0) || 30;
      const slots = await AppointmentService.generateAvailableSlots(
        undefined,
        apt.appointmentDate,
        totalDur,
        apt.barberId || undefined
      );
      setRescheduleSlots(slots);
      setIsRescheduleModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Reschedule
  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    try {
      await AppointmentService.rescheduleAppointment(selectedAppointment.id, {
        newDate: rescheduleDate,
        newStartTime: rescheduleTimeSlot,
        newBarberId: rescheduleBarberId,
        reason: rescheduleReason,
      });

      notify(`Rescheduled to ${rescheduleDate} at ${rescheduleTimeSlot} successfully!`);
      setIsRescheduleModalOpen(false);
      loadData();
    } catch (err: any) {
      notify(err.message || 'Conflict on new slot. Please choose another time.', 'error');
    }
  };

  // Check In to Live Queue
  const handleCheckInToQueue = async (apt: AppointmentDetail) => {
    try {
      const res = await AppointmentService.checkInAppointmentToQueue(apt.id);
      notify(res.message, 'success');
      loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to check in appointment to live queue', 'error');
    }
  };

  // Cancel Appointment
  const handleCancelAppointment = async (apt: AppointmentDetail) => {
    const reason = window.prompt(
      `Cancel appointment ${apt.appointmentNumber} for ${apt.customerName}?\nPlease enter reason (e.g. Customer requested, delayed):`,
      'Customer cancellation request'
    );
    if (!reason) return;

    try {
      await AppointmentService.cancelAppointment(apt.id, reason);
      notify(`Appointment ${apt.appointmentNumber} cancelled`);
      loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to cancel appointment', 'error');
    }
  };

  // Status Change
  const handleStatusChange = async (apt: AppointmentDetail, newStatus: AppointmentStatus) => {
    try {
      await AppointmentService.updateAppointmentStatus(apt.id, newStatus);
      notify(`Status transitioned to ${STATUS_CONFIG[newStatus].label}`);
      loadData();
    } catch (err: any) {
      notify(err.message || 'Failed to update status', 'error');
    }
  };

  // Today Summary Metrics
  const activeCount = appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show').length;
  const inServiceCount = appointments.filter((a) => a.status === 'in_service').length;
  const estRevenueLkr = appointments
    .filter((a) => a.status !== 'cancelled' && a.status !== 'no_show')
    .reduce((sum, a) => sum + a.totalAmount, 0);

  return (
    <div className="flex flex-col w-full pb-28 pt-20 px-3 sm:px-6 max-w-7xl mx-auto">
      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 animate-bounce ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-700'
              : 'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-100 dark:border-rose-700'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {feedbackMessage.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* WhatsApp Modal Notification Banner (When newly created) */}
      {whatsappResult && (
        <div className="mb-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border-2 border-emerald-400 dark:border-emerald-700 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[24px]">chat</span>
            </div>
            <div>
              <p className="font-bold text-emerald-950 dark:text-emerald-100 text-sm">
                WhatsApp Confirmation Ready for {whatsappResult.recipientName}
              </p>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                Token: {whatsappResult.appointmentNumber} • {whatsappResult.appointmentTime} on {whatsappResult.appointmentDate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={whatsappResult.clickToChatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              <span>Send WhatsApp Confirmation</span>
            </a>
            <button
              type="button"
              onClick={() => setWhatsappResult(null)}
              className="p-2 rounded-xl bg-emerald-200/50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Header & Breadcrumb Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/owner-pos"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
            >
              <span className="material-symbols-outlined text-[14px]">arrow_back</span>
              <span>Back to POS</span>
            </Link>
            <span className="text-on-surface-variant text-xs">•</span>
            <span className="text-xs font-semibold text-on-surface-variant">
              Kiribathgoda / Ampitiya Branch
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary flex items-center gap-2">
            <span>Appointment Management</span>
            <span className="text-sm font-normal text-on-surface-variant">
              (වේලාවන් වෙන්කිරීම් පද්ධතිය)
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant">
            Intelligent dual-chair booking, double-booking shield, and live queue synchronization.
          </p>
        </div>

        {/* Global Action CTAs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setBookingDate(selectedDate);
              setIsBookModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary/90 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            <span>+ Book Appointment</span>
          </button>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-surface-container-low rounded-2xl p-3 border border-surface-container-high/60 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">calendar_today</span>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Scheduled
            </p>
            <p className="text-lg font-black text-primary">{activeCount} Bookings</p>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-2xl p-3 border border-surface-container-high/60 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">content_cut</span>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              In Service Now
            </p>
            <p className="text-lg font-black text-emerald-600">{inServiceCount} Active</p>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-2xl p-3 border border-surface-container-high/60 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">payments</span>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Est. Revenue
            </p>
            <p className="text-lg font-black text-secondary">LKR {estRevenueLkr.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-2xl p-3 border border-surface-container-high/60 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">airline_seat_recline_extra</span>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Active Chairs
            </p>
            <p className="text-lg font-black text-primary">Chair 01 &amp; 02</p>
          </div>
        </div>
      </div>

      {/* Control Strip: View Tabs, Date Navigator, Search, Filters */}
      <div className="bg-surface-container-low rounded-2xl p-3 border border-surface-container-high/60 shadow-xs mb-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Left: View Tabs */}
        <div className="flex items-center gap-1 bg-surface-container p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveView('timeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeView === 'timeline'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">view_timeline</span>
            <span>Chair Timeline</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeView === 'list'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
            <span>List &amp; Search ({appointments.length})</span>
          </button>
        </div>

        {/* Center: Date Picker & Quick Jumps */}
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => handleDateOffset(-1)}
            className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary"
            title="Previous Day"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-surface-container-high bg-surface text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <button
            type="button"
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-[11px] font-bold text-primary"
          >
            Today (අද)
          </button>

          <button
            type="button"
            onClick={() => handleDateOffset(1)}
            className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary"
            title="Next Day"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>

        {/* Right: Filters and Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 sm:w-48">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search customer, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-surface-container-high bg-surface text-xs text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Barber Filter */}
          <select
            value={selectedBarberFilter}
            onChange={(e) => setSelectedBarberFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-surface-container-high bg-surface text-xs font-semibold text-primary focus:outline-none"
          >
            <option value="all">All Chairs (කපුරු දෙකම)</option>
            <option value="c0000000-0000-0000-0000-000000000001">Chair 1: Master Kavi</option>
            <option value="c0000000-0000-0000-0000-000000000002">Chair 2: Sunil Shantha</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-surface-container-high bg-surface text-xs font-semibold text-primary focus:outline-none"
          >
            <option value="all">All Statuses (සියලුම)</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="in_service">In Service</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* VIEW 1: DUAL CHAIR TIMELINE (SIDE BY SIDE) */}
      {activeView === 'timeline' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chair 1 Column */}
            <div className="bg-surface-container-lowest rounded-2xl border-2 border-surface-container-high p-4 shadow-sm flex flex-col">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-surface-container-high">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-black text-sm shadow-xs">
                    01
                  </div>
                  <div>
                    <h3 className="font-bold text-primary text-base">Chair 01: Master Kavi</h3>
                    <p className="text-xs text-on-surface-variant font-medium">
                      Senior Stylist • කවිඳු පෙරේරා
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                  {schedule?.chair1.appointments.length || 0} Bookings Today
                </span>
              </div>

              {/* Chair 1 Appointments Track */}
              <div className="flex flex-col gap-2.5 min-h-[350px]">
                {schedule?.chair1.appointments.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-[36px] text-surface-container-highest mb-1">
                      event_available
                    </span>
                    <p className="text-xs font-semibold">No appointments booked for Chair 1 on this day.</p>
                    <button
                      type="button"
                      onClick={() => handleBookSlotClick('09:00', BARBERS[0].id)}
                      className="mt-3 px-3 py-1.5 rounded-xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20"
                    >
                      + Book First Slot (09:00 AM)
                    </button>
                  </div>
                ) : (
                  schedule?.chair1.appointments.map((apt) => (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      onCheckIn={handleCheckInToQueue}
                      onReschedule={openRescheduleModal}
                      onCancel={handleCancelAppointment}
                      onStatusChange={handleStatusChange}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Chair 2 Column */}
            <div className="bg-surface-container-lowest rounded-2xl border-2 border-surface-container-high p-4 shadow-sm flex flex-col">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-surface-container-high">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary text-on-secondary flex items-center justify-center font-black text-sm shadow-xs">
                    02
                  </div>
                  <div>
                    <h3 className="font-bold text-primary text-base">Chair 02: Sunil Shantha</h3>
                    <p className="text-xs text-on-surface-variant font-medium">
                      Beard Artisan • සුනිල් ශාන්ත
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200">
                  {schedule?.chair2.appointments.length || 0} Bookings Today
                </span>
              </div>

              {/* Chair 2 Appointments Track */}
              <div className="flex flex-col gap-2.5 min-h-[350px]">
                {schedule?.chair2.appointments.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-[36px] text-surface-container-highest mb-1">
                      event_available
                    </span>
                    <p className="text-xs font-semibold">No appointments booked for Chair 2 on this day.</p>
                    <button
                      type="button"
                      onClick={() => handleBookSlotClick('10:00', BARBERS[1].id)}
                      className="mt-3 px-3 py-1.5 rounded-xl bg-secondary/10 text-secondary font-bold text-xs hover:bg-secondary/20"
                    >
                      + Book First Slot (10:00 AM)
                    </button>
                  </div>
                ) : (
                  schedule?.chair2.appointments.map((apt) => (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      onCheckIn={handleCheckInToQueue}
                      onReschedule={openRescheduleModal}
                      onCancel={handleCancelAppointment}
                      onStatusChange={handleStatusChange}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: LIST & SEARCH VIEW */}
      {activeView === 'list' && (
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-primary">
              All Appointments for {selectedDate}
            </h2>
            <span className="text-xs text-on-surface-variant">
              Showing {appointments.length} appointments
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-on-surface-variant text-sm font-semibold">
              Loading appointments...
            </div>
          ) : appointments.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[40px] text-surface-container-highest mb-2">
                event_busy
              </span>
              <p className="text-sm font-bold">No appointments found matching your filters.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedBarberFilter('all');
                  setSelectedStatusFilter('all');
                  setSearchQuery('');
                }}
                className="mt-2 text-xs text-primary font-bold underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {appointments.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  appointment={apt}
                  onCheckIn={handleCheckInToQueue}
                  onReschedule={openRescheduleModal}
                  onCancel={handleCancelAppointment}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: CREATE NEW APPOINTMENT */}
      {/* ======================================================== */}
      {isBookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div>
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <span>New Appointment Reservation</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    Dual-Chair
                  </span>
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Select services, recommend barber, and pick an available time slot.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBookModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="flex flex-col gap-4">
              {/* Step 1: Customer Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1">
                    Customer Name (නම) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nuwan Silva"
                    value={bookingCustomerName}
                    onChange={(e) => setBookingCustomerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1">
                    Mobile / WhatsApp (දුරකථන අංකය) *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 077 123 4567"
                    value={bookingCustomerPhone}
                    onChange={(e) => setBookingCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Step 2: Multi-Service Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-on-surface-variant">
                    Select Service(s) • සේවාවන් තෝරන්න *
                  </label>
                  <span className="text-xs font-semibold text-secondary">
                    Total:{' '}
                    {bookingSelectedServices.reduce((acc, id) => {
                      const s = AVAILABLE_SERVICES.find((srv) => srv.id === id);
                      return acc + (s?.duration || 0);
                    }, 0)}{' '}
                    mins • LKR{' '}
                    {bookingSelectedServices
                      .reduce((acc, id) => {
                        const s = AVAILABLE_SERVICES.find((srv) => srv.id === id);
                        return acc + (s?.price || 0);
                      }, 0)
                      .toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {AVAILABLE_SERVICES.map((srv) => {
                    const isSelected = bookingSelectedServices.includes(srv.id);
                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (bookingSelectedServices.length > 1) {
                              setBookingSelectedServices(
                                bookingSelectedServices.filter((id) => id !== srv.id)
                              );
                            }
                          } else {
                            setBookingSelectedServices([...bookingSelectedServices, srv.id]);
                          }
                        }}
                        className={`p-2 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                            : 'bg-surface border-surface-container-high text-on-surface-variant hover:border-primary/50'
                        }`}
                      >
                        <span className="text-xs font-bold leading-tight">{srv.name}</span>
                        <span className="text-[10px] text-on-surface-variant">{srv.duration} mins</span>
                        <span className="text-xs font-extrabold text-secondary mt-1">
                          LKR {srv.price}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Date & Smart Barber Recommendation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1">
                    Appointment Date (දිනය) *
                  </label>
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1">
                    Select Barber / Chair (බාබර්වරයා)
                  </label>
                  <select
                    value={bookingBarberId}
                    onChange={(e) => setBookingBarberId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Recommended / Auto-Assign</option>
                    <option value="c0000000-0000-0000-0000-000000000001">
                      Chair 1: Master Kavi (කවිඳු)
                    </option>
                    <option value="c0000000-0000-0000-0000-000000000002">
                      Chair 2: Sunil Shantha (සුනිල්)
                    </option>
                  </select>
                </div>
              </div>

              {/* Smart Recommendation Chip */}
              {barberRecommendation && (
                <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      auto_awesome
                    </span>
                    <div>
                      <span className="font-bold text-primary">
                        Recommended: {barberRecommendation.recommendedBarberName} (Chair {barberRecommendation.chairNumber})
                      </span>
                      <p className="text-[11px] text-on-surface-variant">
                        {barberRecommendation.recommendationReasonSinhala} ({barberRecommendation.recommendationReason})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBookingBarberId(barberRecommendation.recommendedBarberId)}
                    className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-bold"
                  >
                    Use
                  </button>
                </div>
              )}

              {/* Step 4: Available Time Slots Picker */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  Available Time Slots (ලබාගත හැකි වේලාවන්) *
                </label>
                {isLoadingSlots ? (
                  <div className="py-4 text-center text-xs text-on-surface-variant">
                    Calculating available chair slots...
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-1 border border-surface-container-high rounded-xl bg-surface">
                    {availableSlots.map((slot, idx) => (
                      <button
                        key={`${slot.barberId}-${slot.slotTime}-${idx}`}
                        type="button"
                        disabled={!slot.isAvailable}
                        onClick={() => {
                          setBookingTimeSlot(slot.slotTime);
                          setBookingBarberId(slot.barberId);
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center flex flex-col items-center justify-center ${
                          slot.slotTime === bookingTimeSlot && slot.barberId === bookingBarberId
                            ? 'bg-primary text-on-primary shadow-xs ring-2 ring-primary ring-offset-1'
                            : slot.isAvailable
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-surface-container-high/40 text-on-surface-variant/40 line-through cursor-not-allowed'
                        }`}
                        title={slot.conflictReason || 'Available'}
                      >
                        <span>{slot.label}</span>
                        <span className="text-[9px] opacity-80">
                          {slot.chairNumber === 1 ? 'Ch 1' : 'Ch 2'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Notes */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  Styling Notes / Instructions (විශේෂ සටහන්)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Skin fade with razor sharp lineup, warm water shampoo"
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface text-xs text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setIsBookModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:bg-primary/90 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Confirm Reservation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: RESCHEDULE APPOINTMENT */}
      {/* ======================================================== */}
      {isRescheduleModalOpen && selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high w-full max-w-lg shadow-2xl p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div>
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <span>Reschedule Appointment</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">
                    {selectedAppointment.appointmentNumber}
                  </span>
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Change date, barber, or time slot for {selectedAppointment.customerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRescheduleModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1">
                    New Date (නව දිනය)
                  </label>
                  <input
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={async (e) => {
                      const newD = e.target.value;
                      setRescheduleDate(newD);
                      const slots = await AppointmentService.generateAvailableSlots(
                        undefined,
                        newD,
                        30,
                        rescheduleBarberId
                      );
                      setRescheduleSlots(slots);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface text-xs font-bold text-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1">
                    Assigned Barber / Chair
                  </label>
                  <select
                    value={rescheduleBarberId}
                    onChange={async (e) => {
                      const bId = e.target.value;
                      setRescheduleBarberId(bId);
                      const slots = await AppointmentService.generateAvailableSlots(
                        undefined,
                        rescheduleDate,
                        30,
                        bId
                      );
                      setRescheduleSlots(slots);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface text-xs font-semibold text-primary focus:outline-none"
                  >
                    <option value="c0000000-0000-0000-0000-000000000001">
                      Chair 1: Master Kavi
                    </option>
                    <option value="c0000000-0000-0000-0000-000000000002">
                      Chair 2: Sunil Shantha
                    </option>
                  </select>
                </div>
              </div>

              {/* Slot selector */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  Select New Time Slot
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-36 overflow-y-auto p-1 border border-surface-container-high rounded-xl bg-surface">
                  {rescheduleSlots.map((slot, idx) => (
                    <button
                      key={`resched-${slot.slotTime}-${idx}`}
                      type="button"
                      disabled={!slot.isAvailable}
                      onClick={() => setRescheduleTimeSlot(slot.slotTime)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                        slot.slotTime === rescheduleTimeSlot
                          ? 'bg-secondary text-on-secondary shadow-xs ring-2 ring-secondary'
                          : slot.isAvailable
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 border border-emerald-200'
                          : 'bg-surface-container-high/40 text-on-surface-variant/40 line-through'
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  Reschedule Reason (හේතුව)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Customer requested afternoon slot"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface text-xs text-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setIsRescheduleModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface-variant"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold shadow-md hover:bg-secondary/90"
                >
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// SUB-COMPONENT: INDIVIDUAL APPOINTMENT CARD
// -------------------------------------------------------------
interface AppointmentCardProps {
  appointment: AppointmentDetail;
  onCheckIn: (apt: AppointmentDetail) => void;
  onReschedule: (apt: AppointmentDetail) => void;
  onCancel: (apt: AppointmentDetail) => void;
  onStatusChange: (apt: AppointmentDetail, status: AppointmentStatus) => void;
}

function AppointmentCard({
  appointment,
  onCheckIn,
  onReschedule,
  onCancel,
  onStatusChange,
}: AppointmentCardProps) {
  const statusCfg = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.pending;
  const whatsappUrl = `https://wa.me/${appointment.customerPhone.replace(
    /[^0-9]/g,
    ''
  )}?text=${encodeURIComponent(
    `✂️ Smart Salon LK: ආයුබෝවන් ${appointment.customerName}, your appointment ${appointment.appointmentNumber} on ${appointment.appointmentDate} at ${appointment.appointmentTime} with ${appointment.barberName} is scheduled.`
  )}`;

  return (
    <div className="bg-surface-container-low rounded-2xl border border-surface-container-high p-3.5 shadow-xs flex flex-col gap-2 hover:border-primary/40 transition-colors">
      {/* Card Header: Time, Chair & Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-sm text-primary tracking-tight">
            {appointment.appointmentTime} - {appointment.expectedEndTime}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-surface-container-highest text-on-surface-variant">
            Chair {appointment.chairNumber}
          </span>
        </div>

        {/* Status Badge */}
        <span
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
        >
          <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
          <span>{statusCfg.label}</span>
        </span>
      </div>

      {/* Customer Info & Contact */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h4 className="font-bold text-sm text-primary">{appointment.customerName}</h4>
            {appointment.isVip && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-500 text-white uppercase">
                VIP
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant font-mono">{appointment.customerPhone}</p>
        </div>

        {/* Phone / WhatsApp Quick Icons */}
        <div className="flex items-center gap-1">
          <a
            href={`tel:${appointment.customerPhone}`}
            className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary"
            title="Call Customer"
          >
            <span className="material-symbols-outlined text-[16px]">call</span>
          </a>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300"
            title="WhatsApp Reminder"
          >
            <span className="material-symbols-outlined text-[16px]">chat</span>
          </a>
        </div>
      </div>

      {/* Services List & Price */}
      <div className="bg-surface-container rounded-xl p-2 flex items-center justify-between text-xs">
        <div className="flex flex-col min-w-0 pr-2">
          <span className="font-semibold text-primary truncate">
            {appointment.services.map((s) => s.name).join(', ')}
          </span>
          <span className="text-[10px] text-on-surface-variant">
            {appointment.services.reduce((acc, s) => acc + s.durationMinutes, 0)} mins total
          </span>
        </div>
        <span className="font-extrabold text-secondary shrink-0">
          LKR {appointment.totalAmount.toLocaleString()}
        </span>
      </div>

      {/* Customer / Styling Notes if any */}
      {appointment.notes && (
        <p className="text-[11px] text-on-surface-variant italic bg-surface-container-lowest/50 p-1.5 rounded-lg border border-surface-container-high/40">
          &quot;{appointment.notes}&quot;
        </p>
      )}

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between pt-1 gap-1 border-t border-surface-container-high/40">
        {/* Check-In / Live Queue Sync Button */}
        {appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
          <button
            type="button"
            onClick={() => onCheckIn(appointment)}
            disabled={appointment.status === 'checked_in' || appointment.status === 'in_service'}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
              appointment.status === 'checked_in'
                ? 'bg-teal-600 text-white cursor-default'
                : appointment.status === 'in_service'
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-primary text-on-primary hover:bg-primary/90'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
            <span>
              {appointment.status === 'checked_in'
                ? 'Checked In (Queue)'
                : appointment.status === 'in_service'
                ? 'In Chair'
                : 'Check In to Queue'}
            </span>
          </button>
        )}

        {/* Quick Status Dropdown */}
        <div className="flex items-center gap-1 ml-auto">
          <select
            value={appointment.status}
            onChange={(e) => onStatusChange(appointment, e.target.value as AppointmentStatus)}
            className="text-[11px] font-bold px-2 py-1 rounded-lg border border-surface-container-high bg-surface text-primary focus:outline-none"
          >
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="in_service">In Service</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>

          {/* Reschedule Button */}
          {appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
            <button
              type="button"
              onClick={() => onReschedule(appointment)}
              className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary"
              title="Reschedule"
            >
              <span className="material-symbols-outlined text-[16px]">edit_calendar</span>
            </button>
          )}

          {/* Cancel Button */}
          {appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
            <button
              type="button"
              onClick={() => onCancel(appointment)}
              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-300"
              title="Cancel Appointment"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

