'use client';

import React from 'react';
import { BookingState } from './types';

interface MyBookingsScreenProps {
  activeBooking?: Partial<BookingState>;
  onTrackQueue: () => void;
  onBookAgain: () => void;
}

export default function MyBookingsScreen({
  activeBooking,
  onTrackQueue,
  onBookAgain,
}: MyBookingsScreenProps) {
  const tokenNumber = activeBooking?.tokenNumber || 10;
  const ticketCode = activeBooking?.ticketCode || 'LK-9021';
  const serviceName = activeBooking?.serviceName || 'Hair Cut + Beard Grooming';
  const servicePrice = activeBooking?.servicePrice || 1800;
  const stylistName = activeBooking?.stylistName || 'Master Kavi';

  return (
    <div className="flex flex-col w-full pb-28 pt-20">
      <div className="max-w-md mx-auto w-full px-gutter pt-space-sm pb-space-lg flex flex-col gap-space-md">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-headline-md text-headline-md text-primary font-bold">
              My Appointments
            </h1>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              මගේ වෙන්කිරීම් සහ ඉතිහාසය
            </span>
          </div>
          <button
            type="button"
            onClick={onBookAgain}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold hover:bg-primary transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>New Seat</span>
          </button>
        </div>

        {/* Active Ticket Card */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-md flex flex-col gap-space-sm border-2 border-secondary-container/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold px-3 py-0.5 rounded-bl-lg">
            Active Token
          </div>

          <div className="flex items-center gap-space-sm pt-1">
            <div className="w-12 h-12 rounded-xl bg-primary-container text-primary-fixed flex flex-col items-center justify-center font-bold shadow-sm">
              <span className="text-[10px] uppercase font-mono tracking-wider text-on-primary-container">
                TOKEN
              </span>
              <span className="text-xl leading-none">#{tokenNumber}</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-title-md text-title-md text-primary font-bold truncate">
                {serviceName}
              </span>
              <div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[15px] text-secondary">
                  schedule
                </span>
                <span>Today • Est. 10:15 AM</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-lg p-space-sm flex justify-between items-center text-sm">
            <div className="flex flex-col">
              <span className="text-on-surface-variant text-xs">Stylist &amp; Chair</span>
              <span className="font-semibold text-primary">{stylistName} (Chair 01)</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-on-surface-variant text-xs">Amount (LKR)</span>
              <span className="font-bold text-secondary font-currency-display text-base">
                LKR {servicePrice.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onTrackQueue}
              className="flex-1 min-h-[44px] bg-tertiary-container text-tertiary-fixed rounded-lg font-label-md text-label-md font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-opacity-90 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
              <span>Track Live Queue</span>
            </button>
            <button
              type="button"
              onClick={() => alert(`Verification Ticket ID: ${ticketCode}\nCustomer Phone: +94 77 245 8901`)}
              className="min-h-[44px] px-3 bg-surface-container-high text-primary rounded-lg font-label-md text-label-md font-bold flex items-center justify-center gap-1 hover:bg-surface-container-highest transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
            </button>
          </div>
        </div>

        {/* Past Visits History Section */}
        <div className="flex flex-col gap-space-sm pt-space-xs">
          <h2 className="font-title-md text-title-md text-on-surface font-bold">
            Past Salon Visits
          </h2>

          {/* Past visit 1 */}
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-2 border border-surface-container-high/30">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-title-md text-title-md text-primary font-bold">
                  Adult Haircut &amp; Herbal Oil Care
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Completed on 18 Sep 2024 • Master Kavi
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-tertiary-fixed/60 text-on-tertiary-fixed-variant font-label-sm text-label-sm font-bold">
                Completed
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-surface-container-high/40">
              <span className="font-label-md text-label-md font-bold text-primary">
                LKR 2,700.00 (LankaQR)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => alert('Downloading official tax invoice PDF for INV-2024-712...')}
                  className="font-label-sm text-label-sm text-secondary font-semibold hover:underline flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  <span>Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={onBookAgain}
                  className="px-2.5 py-1 rounded bg-surface-container-high text-primary font-label-sm text-label-sm font-bold hover:bg-surface-container-highest"
                >
                  Book Again
                </button>
              </div>
            </div>
          </div>

          {/* Past visit 2 */}
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-2 border border-surface-container-high/30">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-title-md text-title-md text-primary font-bold">
                  Beard Trim &amp; Razor Lineup
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Completed on 28 Aug 2024 • Sunil Shantha
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-tertiary-fixed/60 text-on-tertiary-fixed-variant font-label-sm text-label-sm font-bold">
                Completed
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-surface-container-high/40">
              <span className="font-label-md text-label-md font-bold text-primary">
                LKR 800.00 (Cash)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => alert('Downloading official tax invoice PDF for INV-2024-601...')}
                  className="font-label-sm text-label-sm text-secondary font-semibold hover:underline flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  <span>Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={onBookAgain}
                  className="px-2.5 py-1 rounded bg-surface-container-high text-primary font-label-sm text-label-sm font-bold hover:bg-surface-container-highest"
                >
                  Book Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

