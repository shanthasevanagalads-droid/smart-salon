'use client';

import React, { useState } from 'react';
import { ServiceItem, BookingState } from './types';

interface HomeScreenProps {
  onStartBookingFlow: (service?: ServiceItem) => void;
  onInstantTokenGenerated: (bookingData: Partial<BookingState>) => void;
  onOpenLiveQueue: () => void;
}

const SERVICES: ServiceItem[] = [
  {
    id: 'haircut-adult',
    name: 'Adult Hair Cut',
    sinhalaName: 'වැඩිහිටි කොණ්ඩ කැපීම',
    category: 'haircut',
    duration: '30 Mins',
    price: 1200,
    icon: 'content_cut',
  },
  {
    id: 'haircut-beard-combo',
    name: 'Hair Cut + Beard Grooming',
    sinhalaName: 'කොණ්ඩය සහ රැවුල සම්පූර්ණ සත්කාරය',
    category: 'haircut',
    duration: '45 Mins',
    price: 1800,
    icon: 'face',
    isPopular: true,
  },
  {
    id: 'haircut-child',
    name: 'Child Hair Cut',
    sinhalaName: 'ළමා කොණ්ඩ කැපීම (Below 12 yrs)',
    category: 'haircut',
    duration: '20 Mins',
    price: 900,
    icon: 'child_care',
  },
  {
    id: 'haircut-style',
    name: 'Hair Style Cut',
    sinhalaName: 'නවීන විලාසිතා කොණ්ඩ කැපීම',
    category: 'haircut',
    duration: '35 Mins',
    price: 1400,
    icon: 'auto_fix_high',
  },
  {
    id: 'beard-classic-trim',
    name: 'Beard Trim & Razor Lineup',
    sinhalaName: 'රැවුල හැඩගැන්වීම සහ රේසර් ලයින්',
    category: 'beard',
    duration: '20 Mins',
    price: 800,
    icon: 'dry_cleaning',
  },
  {
    id: 'hair-dye',
    name: 'Hair Dye & Conditioner',
    sinhalaName: 'කොණ්ඩය ඩයි කිරීම සහ කන්ඩිෂනර්',
    category: 'treatment',
    duration: '40 Mins',
    price: 2200,
    icon: 'palette',
  },
  {
    id: 'hair-massage',
    name: 'Hair Massage',
    sinhalaName: 'හිස සම්බාහනය',
    category: 'treatment',
    duration: '20 Mins',
    price: 1200,
    icon: 'spa',
  },
  {
    id: 'oil-massage',
    name: 'Herbal Oil Massage',
    sinhalaName: 'ආයුර්වේද තෙල් සම්බාහනය',
    category: 'treatment',
    duration: '25 Mins',
    price: 1500,
    icon: 'self_improvement',
  },
];

export default function HomeScreen({
  onStartBookingFlow,
  onInstantTokenGenerated,
  onOpenLiveQueue,
}: HomeScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'haircut' | 'beard' | 'treatment'>('all');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetService, setSheetService] = useState<ServiceItem>(SERVICES[1]);
  const [phoneNumber, setPhoneNumber] = useState('77 234 5678');
  const [isIssuingToken, setIsIssuingToken] = useState(false);

  const filteredServices = SERVICES.filter((s) => {
    if (selectedCategory === 'all') return true;
    return s.category === selectedCategory;
  });

  const handleOpenSheetForService = (service: ServiceItem) => {
    setSheetService(service);
    setIsSheetOpen(true);
  };

  const handleConfirmInstantToken = () => {
    setIsIssuingToken(true);
    setTimeout(() => {
      setIsIssuingToken(false);
      setIsSheetOpen(false);
      onInstantTokenGenerated({
        serviceId: sheetService.id,
        serviceName: sheetService.name,
        serviceSinhala: sheetService.sinhalaName,
        servicePrice: sheetService.price,
        serviceDuration: sheetService.duration,
        customerPhone: phoneNumber,
        tokenNumber: 10,
        ticketCode: 'LK-9021',
      });
    }, 800);
  };

  return (
    <div className="flex flex-col w-full pb-28 pt-20">
      <div className="max-w-md mx-auto w-full px-gutter pt-space-sm pb-space-lg flex flex-col gap-space-md">
        {/* Salon Hero Showcase Card */}
        <div className="relative overflow-hidden rounded-xl bg-primary-container text-on-primary shadow-xl">
          {/* Ambient Visual Layer */}
          <div className="absolute inset-0 opacity-25 mix-blend-luminosity">
            <div
              className="w-full h-full bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuD0gK7BHFPDSUucKYHwSV-6S7Eqd7JYnNv1J7d-9G6htPYsaOcYqoxf--GGiOqmOKyj-iyj2GFlYGmQ-rzEkwn1HnQdOuGqw7erPnVvNnWJN950a4muO4OHXzWNgrky0xLPhD_zNk_5_l2EZfto6ydQXXHTygYEdpkBtwf6MLY0mVvwnJUVKVoUJ4VIaCxHUU_9yNunGOwHEc4mkHRH2X_3lG-ZzO0zPPsJIcsq9IY')",
              }}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-primary-container via-primary-container/85 to-transparent" />

          <div className="relative p-space-md flex flex-col gap-space-md z-10">
            {/* Live Status Indicators */}
            <div className="flex items-center justify-between gap-space-xs flex-wrap">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary-container text-tertiary-fixed shadow-sm">
                <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-pulse" />
                <span className="font-label-sm text-label-sm font-semibold tracking-wide">
                  Open Now • 6:00 AM - 8:00 PM
                </span>
              </div>
              <div
                onClick={onOpenLiveQueue}
                className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container/20 text-secondary-fixed shadow-sm hover:bg-secondary-container/30 transition-colors"
              >
                <span className="material-symbols-outlined text-[15px] text-secondary-fixed">
                  local_fire_department
                </span>
                <span className="font-label-sm text-label-sm font-medium">
                  Wait: ~15m (3 in queue)
                </span>
              </div>
            </div>

            {/* Salon Identity */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-space-xs text-secondary-fixed">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">
                  Premium Chair Craft
                </span>
              </div>
              <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-primary font-bold tracking-tight">
                The Royal Blade Barber
              </h1>
              <span className="font-body-md text-body-md text-on-primary-container">
                රාජකීය බාබර් සාප්පුව • Ampitiya
              </span>
            </div>

            {/* Primary Dual Flow CTAs */}
            <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
              <button
                type="button"
                onClick={() => onStartBookingFlow()}
                className="flex items-center justify-center gap-1.5 h-12 px-space-sm rounded-lg bg-surface-container-lowest text-primary font-label-lg text-label-lg font-bold shadow-md active:scale-95 transition-all hover:bg-white"
              >
                <span className="material-symbols-outlined text-[20px] text-primary">
                  calendar_today
                </span>
                <span>Book Seat</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenSheetForService(SERVICES[0])}
                className="flex items-center justify-center gap-1.5 h-12 px-space-sm rounded-lg bg-secondary text-on-secondary font-label-lg text-label-lg font-bold shadow-md active:scale-95 transition-all hover:opacity-90"
              >
                <span className="material-symbols-outlined text-[20px]">bolt</span>
                <span>Walk-in Token</span>
              </button>
            </div>
          </div>
        </div>

        {/* WhatsApp Support Banner */}
        <a
          className="flex items-center justify-between px-space-md py-3 rounded-xl bg-tertiary-container text-tertiary-fixed shadow-sm active:opacity-90 transition-opacity"
          href="https://wa.me/94722759020"
          rel="noopener noreferrer"
          target="_blank"
        >
          <div className="flex items-center gap-space-sm min-w-0">
            <div className="w-9 h-9 rounded-full bg-on-tertiary-container/30 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px] text-tertiary-fixed">
                chat
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-md text-label-md font-bold truncate">
                Need Help? Chat on WhatsApp
              </span>
              <span className="font-label-sm text-label-sm text-tertiary-fixed/80">
                +94 72 275 9020 • Immediate reply
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-[20px] text-tertiary-fixed shrink-0">
            arrow_forward
          </span>
        </a>

        {/* Service Catalog Filter Categories */}
        <div className="flex flex-col gap-space-sm pt-space-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
              Select Grooming Service
            </h2>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
              LKR Currency
            </span>
          </div>

          {/* Scrollable Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-gutter px-gutter">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`filter-tab shrink-0 px-3.5 py-2 rounded-full font-label-md text-label-md transition-colors ${selectedCategory === 'all'
                ? 'bg-primary-container text-on-primary shadow-sm'
                : 'bg-surface-container-high text-on-surface-variant'
                }`}
            >
              All Services (සියලුම)
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('haircut')}
              className={`filter-tab shrink-0 px-3.5 py-2 rounded-full font-label-md text-label-md transition-colors ${selectedCategory === 'haircut'
                ? 'bg-primary-container text-on-primary shadow-sm'
                : 'bg-surface-container-high text-on-surface-variant'
                }`}
            >
              Haircuts (කොණ්ඩය)
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('beard')}
              className={`filter-tab shrink-0 px-3.5 py-2 rounded-full font-label-md text-label-md transition-colors ${selectedCategory === 'beard'
                ? 'bg-primary-container text-on-primary shadow-sm'
                : 'bg-surface-container-high text-on-surface-variant'
                }`}
            >
              Beard &amp; Shave
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('treatment')}
              className={`filter-tab shrink-0 px-3.5 py-2 rounded-full font-label-md text-label-md transition-colors ${selectedCategory === 'treatment'
                ? 'bg-primary-container text-on-primary shadow-sm'
                : 'bg-surface-container-high text-on-surface-variant'
                }`}
            >
              Treatments &amp; Massage
            </button>
          </div>
        </div>

        {/* Service Cards Feed */}
        <div className="flex flex-col gap-space-sm" id="servicesFeed">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className={`service-card relative flex items-center justify-between p-space-md rounded-xl bg-surface-container-lowest text-on-surface ${service.isPopular ? 'shadow-md border border-secondary-container/20' : 'shadow-sm'
                }`}
            >
              {service.isPopular && (
                <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold shadow-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">star</span>
                  Most Popular
                </div>
              )}

              <div className={`flex items-start gap-space-sm min-w-0 pr-2 ${service.isPopular ? 'pt-1' : ''}`}>
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${service.isPopular
                    ? 'bg-secondary-fixed/40 text-secondary'
                    : service.category === 'treatment'
                      ? 'bg-tertiary-container/30 text-on-tertiary-fixed-variant'
                      : 'bg-surface-container-low text-primary'
                    }`}
                >
                  <span className="material-symbols-outlined text-[26px]">
                    {service.icon}
                  </span>
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="font-title-md text-title-md font-bold truncate">
                    {service.name}
                  </div>
                  <div className="font-label-sm text-label-sm text-on-surface-variant">
                    {service.sinhalaName}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-0.5 font-label-sm text-label-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      {service.duration}
                    </span>
                    <span className="font-label-md text-label-md font-bold text-secondary">
                      LKR {service.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenSheetForService(service)}
                className={`book-action-btn shrink-0 min-h-[44px] px-3.5 rounded-lg font-label-md text-label-md font-bold shadow active:scale-95 transition-all ${service.isPopular
                  ? 'bg-secondary text-on-secondary hover:opacity-90'
                  : 'bg-primary-container text-on-primary hover:bg-primary'
                  }`}
              >
                Book
              </button>
            </div>
          ))}
        </div>

        {/* Stylist Spotlight Reel */}
        <div className="flex flex-col gap-space-sm pt-space-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-title-md text-title-md text-on-surface font-bold">
              Chairs on Duty Today
            </h3>
            <span className="font-label-sm text-label-sm text-secondary font-semibold">
              3 Master Stylists
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Kasun P. */}
            <div className="flex flex-col items-center p-2.5 rounded-xl bg-surface-container-lowest text-on-surface shadow-sm text-center">
              <div className="relative mb-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="w-12 h-12 rounded-full object-cover"
                  alt="Portrait of Master Kasun"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB6xd0Iv1b6UZCTO1NXTC5m32RtHSPaeZwvL6USgH75t-GlJZU9d1n2ZZ3iAeqR66BfnHrJqlBiLmN7qFnkgxshqYVmMUOvSH0sh5IHk4cKKCHhhOV9LNVoAEIT15vDrA5uBJV-DZ2UX3hHCUdblUfVcPfU1edXIukB-6rkBpZC7xLZEB4KVu6RQ5XAzAZ73w6-_uvSNNWwhjipW2cGz9mdqDnLK3bN6HIsGecJknI"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-on-tertiary-container ring-1 ring-white" />
              </div>
              <span className="font-label-md text-label-md font-bold truncate w-full">
                Kasun P.
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant truncate w-full">
                Chair 01
              </span>
            </div>

            {/* Nuwan R. */}
            <div className="flex flex-col items-center p-2.5 rounded-xl bg-surface-container-lowest text-on-surface shadow-sm text-center">
              <div className="relative mb-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="w-12 h-12 rounded-full object-cover"
                  alt="Portrait of Nuwan R."
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBVRdFiS_VDMoANNPvSuKjHcXMQP9_SnRq1VMBrBt-7CTMBj3wm66uP8TCTmimjH0KsR38ZBSmbPg3zkXwmg4CMrvJRREl_y4YpE9OeWuvIwSmWSe0_hg6kS5G2fkVWZAWbnMj3_2QB9wFp71hRXYIcU0wBeU4lVwk2ahEe1hBUapg5JQUWvYVvJE0h6YxK5Z67nMamUn6ja7akQjcIwvTw1cMokPLsI1OCEE-bINc"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-on-tertiary-container ring-1 ring-white" />
              </div>
              <span className="font-label-md text-label-md font-bold truncate w-full">
                Nuwan R.
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant truncate w-full">
                Chair 02
              </span>
            </div>

            {/* Dhammika */}
            <div className="flex flex-col items-center p-2.5 rounded-xl bg-surface-container-lowest text-on-surface shadow-sm text-center">
              <div className="relative mb-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="w-12 h-12 rounded-full object-cover"
                  alt="Portrait of Dhammika"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDjsmUrS-FZBbTQh1G3TFGvrbPGdh_KWVuB-5Wiq6sgXMazSw9b9sk9unUibCOQXLQ6U4E6dgwosEyI0bbyhpCapTvxQLqipCfGhFTFb_RcaKPy424SpTk4tR7W3yZqqUyey_otsX8TPJ8i53XwXHEaG4rWYLBXWh7_-MLc1xc5YskaOqaNtMO0TfkS1xZjeMIU8ZjYGMqRG9PTmxZVKF-Cg4BpWEmM-nGTZSds-J4"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-secondary-container ring-1 ring-white" />
              </div>
              <span className="font-label-md text-label-md font-bold truncate w-full">
                Dhammika
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant truncate w-full">
                Chair 03
              </span>
            </div>
          </div>
        </div>

        {/* Salon Info Quick Summary Drawer */}
        <div className="rounded-xl bg-surface-container text-on-surface p-space-md shadow-sm flex flex-col gap-space-sm mt-space-xs">
          <div className="flex items-center gap-space-xs text-primary font-bold font-title-md text-title-md">
            <span className="material-symbols-outlined text-[20px] text-secondary">
              store
            </span>
            <span>Branch Information</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-space-xs">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0 mt-0.5">
                location_on
              </span>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md font-medium">
                  Smart Salon LK, Kandy Road, Ampitiya.
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Near Ampitiya Bus Stand.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">
                call
              </span>
              <a
                className="font-label-md text-label-md text-primary font-semibold hover:underline"
                href="tel:+94722759020"
              >
                +94 72 275 9020
              </a>
            </div>

            <div className="flex items-center justify-between pt-1 text-on-surface-variant">
              <div className="flex items-center gap-1.5 font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[16px] text-on-tertiary-container">
                  local_parking
                </span>
                <span>Customer Parking Available</span>
              </div>
              <div className="flex items-center gap-1.5 font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[16px] text-on-tertiary-container">
                  qr_code_2
                </span>
                <span>LankaQR Enabled</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Modal Drawer for Instant Booking Confirmation */}
      {isSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-primary/60 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setIsSheetOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface-container-lowest rounded-t-2xl p-space-lg text-on-surface shadow-2xl flex flex-col gap-space-md animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-outline-variant/60 rounded-full mx-auto mb-1" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-tertiary-container text-tertiary-fixed flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">check</span>
                </div>
                <span className="font-title-lg text-title-lg font-bold">Confirm Service</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className="font-label-md text-label-md text-on-surface-variant">
                  Selected Treatment
                </span>
                <span className="font-title-md text-title-md font-bold text-primary">
                  {sheetService.name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-label-md text-label-md text-on-surface-variant">
                  Standard Rate
                </span>
                <span className="font-currency-display text-currency-display text-secondary">
                  LKR {sheetService.price.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-label-md text-label-md text-on-surface-variant">
                  Est. Chair Time
                </span>
                <span className="font-label-md text-label-md font-semibold text-on-surface">
                  {sheetService.duration}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                Customer Mobile (WhatsApp for Token Alert)
              </label>
              <div className="flex items-center rounded-lg bg-surface-container-low px-3 py-2 border border-surface-container-high">
                <span className="font-label-md text-label-md font-bold text-primary mr-2">
                  +94
                </span>
                <input
                  className="bg-transparent font-label-md text-label-md text-on-surface w-full focus:outline-none"
                  placeholder="722759020"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-space-sm pt-space-xs">
              <button
                type="button"
                onClick={handleConfirmInstantToken}
                disabled={isIssuingToken}
                className="flex-1 h-12 rounded-lg bg-primary-container text-on-primary font-label-lg text-label-lg font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-primary"
              >
                {isIssuingToken ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">
                      progress_activity
                    </span>
                    <span>Ticket Issued!</span>
                  </>
                ) : (
                  <span>Generate Instant Token</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

