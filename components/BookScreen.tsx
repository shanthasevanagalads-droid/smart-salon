'use client';

import React, { useState } from 'react';
import { BookingState, Stylist } from './types';

interface BookScreenProps {
  onBackToHome: () => void;
  onBookingConfirmed: (booking: BookingState) => void;
  initialService?: {
    name: string;
    sinhalaName: string;
    price: number;
    duration: string;
  };
}

const STYLISTS: Stylist[] = [
  {
    id: 'kavi',
    name: 'Master Kavi',
    sinhalaName: 'කවිඳු',
    chair: 'Chair 01',
    role: 'Senior Stylist',
    rating: 4.9,
    reviewsCount: 180,
    status: 'Ready',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDdYsmqEToWqkhLyMB8Y2bFHS95FzmiIje__Q5F57JwDnjqvRoa62_OAlePc_dNjxMI1lb5HkhAwm9QyuRxGUXuCxXTP0qI_gZR96IgkpBiYd0OOfbyd6rSzkcBj44_OJR7ZpB8e9DPSWObbYhtmf7RpoVDy0G22Hfk_Dsa9tnGt3_r-KC8p3pm7W_zzKQKbPF4iX5LqebNt8E_wjLS2aVev5MFYMfOdYodRwwx4DQ',
  },
  {
    id: 'sunil',
    name: 'Sunil Shantha',
    sinhalaName: 'සුනිල්',
    chair: 'Chair 02',
    role: 'Beard Artisan',
    rating: 4.8,
    reviewsCount: 95,
    status: 'Busy',
    statusText: 'Busy till 11:30',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCsFnPnMzYxJ6xwVclhW0_CLiqeTfBaORMEOpfZGsEvL_nWkHooK6M3cYwxLqbj6TZd48qR0hWLjDHeAJWmmr5FKuBcIhyMXDGkY7aqpHgiKBX0PvkGtK9pTAmBVVf9wSIJzs95aQiAmjN24vrgl4llavZaWDqjKEduTj-DCEkuLv7svp5QrxLseoYLlzbFbKlAYooHQL6fU9tU7_wbAhT1H3uAMIwX6hD2KKcVU-s',
  },
  {
    id: 'express',
    name: 'Any Available Barber',
    sinhalaName: 'ඕනෑම අයෙක්',
    chair: 'First open chair',
    role: 'Express / Fastest',
    rating: 4.9,
    reviewsCount: 320,
    status: 'Instant',
    statusText: 'Fastest',
    image: '',
  },
];

const DATES = [
  { id: 'today', daySinhala: 'අද', dayEn: 'Today', dateNum: '24', fullDate: 'Thursday, 24 Oct' },
  { id: 'tomorrow', daySinhala: 'හෙට', dayEn: 'Fri', dateNum: '25', fullDate: 'Friday, 25 Oct' },
  { id: 'sat', daySinhala: 'සෙන', dayEn: 'Sat', dateNum: '26', fullDate: 'Saturday, 26 Oct' },
  { id: 'sun', daySinhala: 'ඉරිදා', dayEn: 'Sun', dateNum: '27', fullDate: 'Sunday, 27 Oct' },
];

const MORNING_SLOTS = ['08:30 AM', '09:15 AM', '10:00 AM', '11:00 AM'];
const AFTERNOON_SLOTS = ['01:30 PM', '02:15 PM', '03:00 PM', '04:15 PM'];
const EVENING_SLOTS = ['05:30 PM', '06:15 PM'];

export default function BookScreen({
  onBackToHome,
  onBookingConfirmed,
  initialService,
}: BookScreenProps) {
  const serviceName = initialService?.name || 'Hair Cut + Beard Grooming';
  const serviceSinhala = initialService?.sinhalaName || 'කොණ්ඩය සහ රැවුල කැපීම';
  const servicePrice = initialService?.price || 1800;
  const serviceDuration = initialService?.duration || '45m';

  const [selectedStylistId, setSelectedStylistId] = useState('kavi');
  const [selectedDateId, setSelectedDateId] = useState('today');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('09:15 AM');
  const [customerName, setCustomerName] = useState('Kasun Perera');
  const [customerPhone, setCustomerPhone] = useState('77 245 8901');
  const [isReserving, setIsReserving] = useState(false);
  const [isReserved, setIsReserved] = useState(false);

  const selectedStylist = STYLISTS.find((s) => s.id === selectedStylistId) || STYLISTS[0];
  const selectedDateObj = DATES.find((d) => d.id === selectedDateId) || DATES[0];

  const handleConfirm = () => {
    setIsReserving(true);
    setTimeout(() => {
      setIsReserving(false);
      setIsReserved(true);
      setTimeout(() => {
        onBookingConfirmed({
          serviceId: 'service-selected',
          serviceName,
          serviceSinhala,
          servicePrice,
          serviceDuration,
          stylistId: selectedStylist.id,
          stylistName: selectedStylist.name,
          selectedDate: selectedDateObj.dateNum,
          selectedDateLabel: `${selectedDateObj.daySinhala} (${selectedDateObj.fullDate})`,
          selectedTimeSlot,
          customerName,
          customerPhone,
          tokenNumber: 10,
          ticketCode: 'LK-9021',
        });
      }, 700);
    }, 700);
  };

  return (
    <div className="flex flex-col w-full pb-36 pt-20">
      <div className="max-w-md mx-auto w-full flex flex-col">
        {/* Top Back Nav & Stepper */}
        <div className="px-gutter pt-space-sm pb-space-xs">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={onBackToHome}
              className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-primary hover:bg-surface-container-highest transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <span className="font-label-md text-label-md font-bold text-on-surface">
              Appointment Booking
            </span>
          </div>

          <div className="bg-surface-container-low rounded-xl p-space-sm shadow-sm flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-primary font-bold">
                Step 2 of 3
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                බාබර් සහ වේලාව තෝරන්න
              </span>
            </div>

            {/* Stepper Track */}
            <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full">
              <div className="rounded-full bg-on-tertiary-container h-full" />
              <div className="rounded-full bg-secondary-container h-full" />
              <div className="rounded-full bg-surface-container-highest h-full" />
            </div>

            {/* Compact Active Summary Pill */}
            <div className="flex items-center justify-between bg-surface-container-lowest rounded-lg px-space-sm py-1.5 mt-0.5 shadow-sm">
              <div className="flex items-center gap-space-xs min-w-0">
                <span className="material-symbols-outlined text-[18px] text-secondary">
                  content_cut
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-md text-label-md text-primary truncate font-bold">
                    {serviceName}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                    {serviceSinhala} ({serviceDuration})
                  </span>
                </div>
              </div>
              <span className="font-label-md text-label-md text-primary font-bold shrink-0">
                LKR {servicePrice.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Section 1: Choose Stylist */}
        <div className="px-gutter pt-space-sm pb-space-xs">
          <div className="flex items-center justify-between mb-space-xs">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-secondary">group</span>
              <h2 className="font-title-md text-title-md text-primary">Choose Stylist</h2>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                (බාබර් තෝරන්න)
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-on-tertiary-container font-semibold">
              3 Available
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {STYLISTS.map((stylist) => {
              const isSelected = selectedStylistId === stylist.id;
              return (
                <div
                  key={stylist.id}
                  onClick={() => setSelectedStylistId(stylist.id)}
                  className={`barber-card relative rounded-xl p-space-sm shadow-sm transition-all cursor-pointer active:scale-[0.99] ${
                    isSelected
                      ? 'bg-surface-container-high ring-2 ring-primary/20'
                      : 'bg-surface-container-lowest hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center justify-between gap-space-sm">
                    <div className="flex items-center gap-space-sm min-w-0">
                      <div className="relative shrink-0">
                        {stylist.image ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              className="w-12 h-12 rounded-full object-cover"
                              alt={stylist.name}
                              src={stylist.image}
                            />
                            <span
                              className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full ring-2 ring-surface-container-lowest ${
                                stylist.status === 'Ready'
                                  ? 'bg-on-tertiary-container'
                                  : 'bg-secondary-container'
                              }`}
                            />
                          </>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0 text-primary">
                            <span className="material-symbols-outlined text-[24px]">flash_on</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-title-md text-title-md text-primary truncate">
                            {stylist.name}
                          </span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            ({stylist.sinhalaName})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            {stylist.role}
                          </span>
                          <span className="font-label-sm text-label-sm flex items-center text-secondary font-bold">
                            <span
                              className="material-symbols-outlined text-[14px] leading-none"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              star
                            </span>
                            {stylist.rating}
                            <span className="text-on-surface-variant font-normal ml-0.5">
                              ({stylist.reviewsCount})
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {stylist.status === 'Ready' && (
                        <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant font-bold">
                          Ready
                        </span>
                      )}
                      {stylist.status === 'Busy' && (
                        <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-semibold">
                          Busy till 11:30
                        </span>
                      )}
                      {stylist.status === 'Instant' && (
                        <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-bold">
                          Instant
                        </span>
                      )}

                      {isSelected && (
                        <span
                          className="material-symbols-outlined text-[20px] text-primary"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check_circle
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Choose Date */}
        <div className="px-gutter pt-space-sm pb-space-xs">
          <div className="flex items-center justify-between mb-space-xs">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-secondary">
                calendar_month
              </span>
              <h2 className="font-title-md text-title-md text-primary">Select Date</h2>
              <span className="font-label-sm text-label-sm text-on-surface-variant">(දිනය)</span>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
              October 2024
            </span>
          </div>

          {/* Horizontal Date Pill Scroller */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {DATES.map((date) => {
              const isSelected = selectedDateId === date.id;
              return (
                <button
                  key={date.id}
                  type="button"
                  onClick={() => setSelectedDateId(date.id)}
                  className={`date-pill shrink-0 flex flex-col items-center justify-center w-[76px] py-2.5 rounded-xl shadow-sm transition-all ${
                    isSelected
                      ? 'bg-primary text-on-primary ring-2 ring-primary/20'
                      : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <span
                    className={`font-label-sm text-label-sm uppercase tracking-wide ${
                      isSelected ? 'opacity-90' : 'text-on-surface-variant'
                    }`}
                  >
                    {date.daySinhala}
                  </span>
                  <span
                    className={`font-currency-display text-currency-display leading-tight my-0.5 ${
                      isSelected ? 'text-white' : 'text-primary'
                    }`}
                  >
                    {date.dateNum}
                  </span>
                  <span
                    className={`font-label-sm text-label-sm ${
                      isSelected ? 'opacity-90' : 'text-on-surface-variant'
                    }`}
                  >
                    {date.dayEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Time Slot Groups */}
        <div className="px-gutter pt-space-sm pb-space-xs flex flex-col gap-space-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-secondary">
                schedule
              </span>
              <h2 className="font-title-md text-title-md text-primary">Available Slots</h2>
              <span className="font-label-sm text-label-sm text-on-surface-variant">(වේලාව)</span>
            </div>
            <div className="flex items-center gap-1 text-on-tertiary-container font-label-sm text-label-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse" />
              <span>Live Chair Sync</span>
            </div>
          </div>

          {/* Morning Block */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">wb_twilight</span>
              <span className="font-label-md text-label-md font-bold">Morning (උදෑසන)</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {MORNING_SLOTS.map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTimeSlot(slot)}
                    className={`time-slot-btn py-2 px-1 rounded-lg font-label-md text-label-md shadow-sm transition-all active:scale-95 text-center ${
                      isSelected
                        ? 'bg-primary text-on-primary font-bold'
                        : 'bg-surface-container-lowest text-primary hover:bg-surface-container-low'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Afternoon Block */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">wb_sunny</span>
              <span className="font-label-md text-label-md font-bold">Afternoon (දහවල්)</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {AFTERNOON_SLOTS.map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTimeSlot(slot)}
                    className={`time-slot-btn py-2 px-1 rounded-lg font-label-md text-label-md shadow-sm transition-all active:scale-95 text-center ${
                      isSelected
                        ? 'bg-primary text-on-primary font-bold'
                        : 'bg-surface-container-lowest text-primary hover:bg-surface-container-low'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Evening Block */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">bedtime</span>
              <span className="font-label-md text-label-md font-bold">Evening (සවස)</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {EVENING_SLOTS.map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTimeSlot(slot)}
                    className={`time-slot-btn py-2 px-1 rounded-lg font-label-md text-label-md shadow-sm transition-all active:scale-95 text-center ${
                      isSelected
                        ? 'bg-primary text-on-primary font-bold'
                        : 'bg-surface-container-lowest text-primary hover:bg-surface-container-low'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
              <button
                disabled
                type="button"
                className="py-2 px-1 rounded-lg bg-surface-container-highest text-on-surface-variant opacity-60 font-label-md text-label-md line-through text-center cursor-not-allowed"
              >
                07:00 PM
              </button>
              <div className="py-2 px-1 rounded-lg bg-transparent flex items-center justify-center text-on-surface-variant font-label-sm text-label-sm">
                Full
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Customer Details Card */}
        <div className="px-gutter pt-space-sm pb-space-lg">
          <div className="bg-surface-container-lowest rounded-xl p-space-sm shadow-sm flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-secondary">person</span>
                <h2 className="font-title-md text-title-md text-primary">Your Booking Details</h2>
              </div>
              <span className="font-label-sm text-label-sm text-on-tertiary-container font-semibold">
                One-Tap Autofill
              </span>
            </div>

            {/* Input: Name */}
            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                Customer Full Name (නම)
              </label>
              <div className="flex items-center bg-surface-container-low rounded-lg px-3 py-2.5 border border-surface-container-high/50">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant mr-2">
                  badge
                </span>
                <input
                  className="w-full bg-transparent font-body-md text-body-md text-primary outline-none focus:ring-0"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
            </div>

            {/* Input: Phone */}
            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                Mobile / WhatsApp Number (දුරකථන අංකය)
              </label>
              <div className="flex items-center bg-surface-container-low rounded-lg px-3 py-2.5 border border-surface-container-high/50">
                <span className="font-label-md text-label-md text-primary font-bold mr-2 shrink-0">
                  +94
                </span>
                <input
                  className="w-full bg-transparent font-body-md text-body-md text-primary outline-none focus:ring-0"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                <span className="material-symbols-outlined text-[20px] text-on-tertiary-container shrink-0">
                  check_circle
                </span>
              </div>
              <div className="flex items-start gap-1.5 mt-1 px-1">
                <span className="material-symbols-outlined text-[16px] text-on-tertiary-container shrink-0 mt-0.5">
                  chat
                </span>
                <p className="font-label-sm text-label-sm text-on-surface-variant leading-tight">
                  WhatsApp හරහා තහවුරු කිරීමේ SMS පණිවිඩය සහ ටෝකන් අංකය ක්ෂණිකව ලැබෙනු ඇත.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Persistent Booking Summary & Action Bar */}
        <div className="fixed bottom-16 left-0 right-0 z-40 bg-surface-container-lowest border-t border-surface-container-high/40 shadow-[0_-4px_16px_rgba(0,20,40,0.08)] px-gutter py-space-sm pb-safe">
          <div className="flex items-center justify-between gap-space-sm max-w-md mx-auto w-full">
            <div className="flex flex-col min-w-0">
              <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                Total Amount • 1 Seat
              </span>
              <div className="flex items-baseline gap-1">
                <span className="font-currency-display text-currency-display text-primary leading-tight font-extrabold">
                  LKR {servicePrice.toLocaleString()}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">.00</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={isReserving}
              className={`flex-1 max-w-[210px] min-h-[48px] px-space-sm rounded-lg font-label-lg text-label-lg font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all ${
                isReserved
                  ? 'bg-on-tertiary-container text-white'
                  : 'bg-primary-container text-on-primary hover:bg-primary'
              }`}
            >
              {isReserving ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    refresh
                  </span>
                  <span>Reserving...</span>
                </>
              ) : isReserved ? (
                <>
                  <span className="material-symbols-outlined text-[18px]">done</span>
                  <span>Reserved!</span>
                </>
              ) : (
                <>
                  <span>Confirm Slot</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

