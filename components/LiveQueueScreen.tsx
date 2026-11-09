'use client';

import React, { useState } from 'react';
import { BookingState } from './types';

interface LiveQueueScreenProps {
  bookingData?: Partial<BookingState>;
  onCancelTicket?: () => void;
}

export default function LiveQueueScreen({
  bookingData,
  onCancelTicket,
}: LiveQueueScreenProps) {
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isLateAdded, setIsLateAdded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Grace period added: +10 mins saved!');
  const [isWhatsAppActive, setIsWhatsAppActive] = useState(true);
  const [waitMinutes, setWaitMinutes] = useState(22);
  const [callTime, setCallTime] = useState('10:15 AM');

  const ticketNumber = bookingData?.tokenNumber || 10;
  const ticketCode = bookingData?.ticketCode || 'SMART-SALON-LK-9021';
  const customerPhone = bookingData?.customerPhone || '77 ••• ••39';

  const handleRunningLate = () => {
    setIsLateAdded(true);
    setWaitMinutes((prev) => prev + 10);
    setCallTime('10:25 AM');
    setToastMessage('Grace period added: +10 mins saved!');
    setShowToast(true);

    setTimeout(() => {
      setShowToast(false);
    }, 3200);
  };

  const handleCancelClick = () => {
    if (
      window.confirm(
        `Cancel your queue token #${ticketNumber}? Your reserved slot will be released to the next customer.`
      )
    ) {
      if (onCancelTicket) onCancelTicket();
      alert('Token cancelled. You can generate a new token whenever you are ready.');
    }
  };

  return (
    <div className="flex flex-col w-full pb-28 pt-20">
      <div className="max-w-md mx-auto w-full px-gutter pt-space-sm pb-space-lg flex flex-col gap-space-md">
        {/* Live Status Banner & Header Info */}
        <div className="flex items-center justify-between bg-surface-container-low px-space-md py-space-sm rounded-xl shadow-sm">
          <div className="flex items-center gap-space-xs">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-on-tertiary-container opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-on-tertiary-container" />
            </span>
            <span className="font-label-md text-label-md text-on-tertiary-container uppercase tracking-wider font-bold">
              LIVE QUEUE ACTIVE
            </span>
          </div>
          <div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[15px] text-secondary">update</span>
            <span>Updated Just Now</span>
          </div>
        </div>

        {/* Now Serving Hero Card */}
        <div className="bg-primary-container text-on-primary rounded-xl p-space-md shadow-md flex flex-col gap-space-sm relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-primary-fixed/5 pointer-events-none" />

          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-primary-container uppercase tracking-widest">
                දැන් කැඳවන අංකය
              </span>
              <span className="font-title-md text-title-md text-primary-fixed font-bold">
                NOW SERVING
              </span>
            </div>
            <div className="bg-tertiary-container px-space-sm py-1 rounded-full flex items-center gap-1 text-tertiary-fixed">
              <span className="material-symbols-outlined text-[16px] animate-pulse">
                radio_button_checked
              </span>
              <span className="font-label-sm text-label-sm font-semibold">
                Chair 1 Active
              </span>
            </div>
          </div>

          <div className="flex items-baseline justify-between my-space-xs">
            <div className="font-token-number text-token-number text-white tracking-tighter drop-shadow-sm font-extrabold">
              07
            </div>
            <div className="flex flex-col items-end">
              <span className="font-label-sm text-label-sm text-primary-fixed-dim">
                Currently In Chair
              </span>
              <span className="font-title-md text-title-md text-white font-bold">
                Adult Hair Cut
              </span>
              <span className="font-label-sm text-label-sm text-on-primary-container">
                12 mins elapsed
              </span>
            </div>
          </div>

          <div className="bg-primary/50 backdrop-blur-md p-space-sm rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-10 h-10 rounded-full object-cover shadow-inner"
                alt="Master Kavi"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBGVnaAW5FE821l7R5YInj7YvTuH3ndQsKgSXphvGHijYx1QXEZlyqlbIrMRjFTwVUCO7VbZkPjvWnsGkwysgrmjU-R1Sb5t6cFL25p7YmHmm7c_ZZOZwXOBz_8NkDeUfLnaSSdGdUki8GZuWXncuJ3521uIIxyCx0E-HQorQ1TiyV_7GEvA6szUhdGnWKiqfsHs0WM56IFUf2kSQ7GhyDodXFA9ulMyAclxcBoZ-g"
              />
              <div className="flex flex-col leading-tight">
                <span className="font-label-lg text-label-lg text-white font-semibold">
                  Master Kavi
                </span>
                <span className="font-label-sm text-label-sm text-primary-fixed-dim">
                  Chief Stylist • Chair 01
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined text-secondary-container text-[24px]">
              content_cut
            </span>
          </div>
        </div>

        {/* Your Ticket Spotlight Card */}
        <div className="bg-surface-container-lowest rounded-xl shadow-lg p-space-md flex flex-col gap-space-md relative overflow-hidden border border-surface-container-high/40">
          {/* Gold/Navy Top Accent Indicator */}
          <div className="h-1.5 w-full bg-gradient-to-r from-secondary-container via-primary-container to-secondary-container absolute top-0 left-0" />

          <div className="flex items-start justify-between pt-1">
            <div>
              <span className="font-label-sm text-label-sm text-secondary font-bold uppercase tracking-wider">
                ඔබගේ ටෝකන් අංකය
              </span>
              <h2 className="font-headline-md text-headline-md text-on-surface font-extrabold flex items-center gap-1.5">
                YOUR TICKET:{' '}
                <span className="text-secondary-container font-headline-xl-mobile">
                  #{ticketNumber}
                </span>
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="bg-surface-container-high hover:bg-surface-container-highest transition-colors px-space-sm py-1.5 rounded-lg flex items-center gap-1 text-on-surface font-semibold text-sm shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
              <span className="font-label-sm text-label-sm font-semibold">Entry QR</span>
            </button>
          </div>

          {/* Quick Metrics Ribbon */}
          <div className="grid grid-cols-3 gap-space-xs bg-surface-container-low p-space-sm rounded-lg text-center">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Ahead</span>
              <span className="font-title-lg text-title-lg text-on-surface font-extrabold">
                3 People
              </span>
              <span className="font-label-sm text-[10px] text-on-surface-variant truncate">
                ඉදිරියෙන් 3
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Est. Wait</span>
              <span className="font-title-lg text-title-lg text-secondary font-extrabold">
                ⏱ {waitMinutes}m
              </span>
              <span className="font-label-sm text-[10px] text-on-surface-variant">Average pace</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Call Time</span>
              <span className="font-title-lg text-title-lg text-on-tertiary-container font-extrabold">
                {callTime}
              </span>
              <span className="font-label-sm text-[10px] text-on-surface-variant">Be near chair</span>
            </div>
          </div>

          {/* Linear Queue Progress Tracker */}
          <div className="flex flex-col gap-space-xs">
            <div className="flex justify-between items-center text-on-surface-variant">
              <span className="font-label-sm text-label-sm font-semibold">
                Queue Pipeline (පෝලිමේ ප්‍රගතිය)
              </span>
              <span className="font-label-sm text-label-sm text-on-tertiary-container font-medium">
                Chair Pace: 7 min/cut
              </span>
            </div>

            <div className="relative py-2">
              {/* Track line */}
              <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-on-tertiary-container w-2/3 rounded-full transition-all duration-500" />
              </div>

              {/* Stepper markers */}
              <div className="flex justify-between items-center mt-2 px-1">
                <div className="flex flex-col items-center">
                  <span className="w-6 h-6 rounded-full bg-on-tertiary-container text-white font-label-sm text-label-sm flex items-center justify-center font-bold">
                    07
                  </span>
                  <span className="font-label-sm text-[10px] text-on-tertiary-container font-bold mt-0.5">
                    Active
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="w-6 h-6 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm flex items-center justify-center font-semibold">
                    08
                  </span>
                  <span className="font-label-sm text-[10px] text-on-surface-variant mt-0.5">
                    Chair 2
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="w-6 h-6 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm flex items-center justify-center font-semibold">
                    09
                  </span>
                  <span className="font-label-sm text-[10px] text-on-surface-variant mt-0.5">
                    Prep
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="w-7 h-7 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm flex items-center justify-center font-black shadow-sm ring-2 ring-secondary-container/30">
                    {ticketNumber}
                  </span>
                  <span className="font-label-sm text-[10px] text-secondary font-black mt-0.5">
                    YOU
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons for Ticket */}
          <div className="flex items-center gap-space-sm pt-space-xs">
            <button
              type="button"
              onClick={handleRunningLate}
              disabled={isLateAdded}
              className={`flex-1 transition-colors py-2.5 px-space-sm rounded-lg font-label-md text-label-md flex items-center justify-center gap-1.5 shadow-sm ${
                isLateAdded
                  ? 'bg-surface-container-high text-on-tertiary-container font-bold'
                  : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">
                {isLateAdded ? 'done' : 'snooze'}
              </span>
              <span>{isLateAdded ? 'Postponed (+10m)' : 'Running Late (+10m)'}</span>
            </button>

            <button
              type="button"
              onClick={handleCancelClick}
              className="bg-error-container/60 hover:bg-error-container text-error px-space-sm py-2.5 rounded-lg font-label-md text-label-md flex items-center justify-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              <span>Cancel</span>
            </button>
          </div>
        </div>

        {/* Alert Preference & Graceful Postpone */}
        <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col gap-space-sm shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <div className="w-9 h-9 rounded-full bg-tertiary-container text-tertiary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">
                  notifications_active
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-lg text-label-lg text-on-surface font-semibold">
                  WhatsApp Turn Alert
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Notify when 1 customer left ahead
                </span>
              </div>
            </div>

            {/* Native Style Toggle */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isWhatsAppActive}
                onChange={(e) => setIsWhatsAppActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border-none after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-on-tertiary-container" />
            </label>
          </div>

          <p
            className={`font-label-sm text-label-sm bg-surface-container-lowest px-space-sm py-1.5 rounded-lg flex items-center gap-1 ${
              isWhatsAppActive ? 'text-on-tertiary-container' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">
              {isWhatsAppActive ? 'check_circle' : 'notifications_off'}
            </span>
            <span>
              {isWhatsAppActive
                ? `Active: SMS & WhatsApp ping enabled to +94 ${customerPhone}`
                : 'Alerts muted. Please watch the salon screen closely.'}
            </span>
          </p>
        </div>

        {/* Live Salon Floor Status Table */}
        <div className="flex flex-col gap-space-sm">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-title-md text-title-md text-on-surface font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[20px]">
                airline_seat_recline_extra
              </span>
              <span>Chairs in Salon (දැනට කරගෙන යන කටයුතු)</span>
            </h3>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
              3 of 3 Active
            </span>
          </div>

          {/* Chair 1 */}
          <div className="bg-surface-container-lowest rounded-xl p-space-sm shadow-sm flex items-center justify-between border border-surface-container-high/30">
            <div className="flex items-center gap-space-sm">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="w-11 h-11 rounded-lg object-cover"
                  alt="Kavi"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBZ3HWP_rk5RzNwVXKdeMHuEJjGeqb2eqUiY7U1_8O4fJp5luEiPiuYMAaqg0I3K2N8pc7ChcgN5opOapJp05a9Xv0PpJKOAUP_UZDdJ5IU0LmnSUH7DPwoKEe8zL_PZsdTq6UREJ-XbM3m0DmMIGyjqDAsPHb3Zu1kNTER4Qwh9VCG--4x1ttZAAzT3g6c6ouGFBRpS-slUA5obgMVZmR-jAOY3tLQAwsdkzAmUCY"
                />
                <span className="absolute -bottom-1 -right-1 bg-on-tertiary-container text-white text-[9px] font-bold px-1 rounded-sm">
                  CH 1
                </span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-label-lg text-label-lg text-on-surface font-bold">
                    Kavi
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    • Adult Hair Cut
                  </span>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Serving #07 (Est 8 mins remaining)
                </span>
              </div>
            </div>
            <div className="bg-surface-container-high px-2 py-1 rounded-md text-primary font-bold font-label-md text-label-md">
              #07
            </div>
          </div>

          {/* Chair 2 */}
          <div className="bg-surface-container-lowest rounded-xl p-space-sm shadow-sm flex items-center justify-between border border-surface-container-high/30">
            <div className="flex items-center gap-space-sm">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="w-11 h-11 rounded-lg object-cover"
                  alt="Sunil"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBVfHt8CHS_BjDJB9ozT-gbQIyhOXVNss6-0eiqke0yXRWUofnifcOouKavicWMUFN4YFmxZ1ME3xBvVSsGbn-FzJWt5em-a8_1LtrJkdezo9yTv4Yh6zgMP55TTfrSiWP1TVCK3A_vh8IRx_WYVb4qwPQDissQxChbjuxGbb-J8K1gQBjR4o9osrTSGzGQ1NdDgoAmWgkyIm-eGxXJBeVe8L8UVkQAB3dPCSfmsKQ"
                />
                <span className="absolute -bottom-1 -right-1 bg-primary text-white text-[9px] font-bold px-1 rounded-sm">
                  CH 2
                </span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-label-lg text-label-lg text-on-surface font-bold">
                    Sunil
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    • Beard Shape &amp; Trim
                  </span>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Serving #08 (Wrapping up)
                </span>
              </div>
            </div>
            <div className="bg-surface-container-high px-2 py-1 rounded-md text-primary font-bold font-label-md text-label-md">
              #08
            </div>
          </div>

          {/* Chair 3 */}
          <div className="bg-surface-container-lowest rounded-xl p-space-sm shadow-sm flex items-center justify-between border border-surface-container-high/30">
            <div className="flex items-center gap-space-sm">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="w-11 h-11 rounded-lg object-cover"
                  alt="Dinesh"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNjf8UsnH7Ikb8zt4t5wvxylb-1XXfSA_5e5ywNecJUt8-eT-bmsKTOu4KTzaQLRA331iG16FtYVgPK3dt6A3MaBqvz7g6PaAnHrDV6ur3eM8fa2-1L-oPVszOFI-tOzkVYesjaKYhSp-il3bdb8N0vNIIByfqGduS_0joFj6vGdKvX7bHtzNmgXfL7LyJAhb8f6oh5b_zvX3LM0TrtzSlrXJ9yh4ZW5veQ7HoSKI"
                />
                <span className="absolute -bottom-1 -right-1 bg-secondary text-white text-[9px] font-bold px-1 rounded-sm">
                  CH 3
                </span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-label-lg text-label-lg text-on-surface font-bold">
                    Dinesh
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary font-medium">
                    • Sanitizing Chair
                  </span>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Calling #09 in 2 mins
                </span>
              </div>
            </div>
            <div className="bg-surface-container-low text-on-surface-variant px-2 py-1 rounded-md font-bold font-label-md text-label-md">
              Next #09
            </div>
          </div>
        </div>

        {/* Direct Salon Hotline & Amenities */}
        <div className="mt-space-xs flex flex-col gap-space-sm">
          <div className="bg-surface-container-high/60 rounded-xl p-space-md flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">store</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-lg text-label-lg text-on-surface font-bold">
                  Smart Salon Kiribathgoda
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Free Wi-Fi &amp; Ceylon Tea Lounge
                </span>
              </div>
            </div>
            <a
              className="bg-primary text-white py-2 px-space-sm rounded-lg flex items-center gap-1 font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm"
              href="tel:+94112918844"
            >
              <span className="material-symbols-outlined text-[16px]">call</span>
              <span>Call Desk</span>
            </a>
          </div>

          {/* Quick Helpful Tip */}
          <div className="p-space-sm rounded-lg bg-surface-container-low text-center">
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              💡 <strong>Sri Lankan Hospitality Tip:</strong> Step inside anytime to relax in
              air-conditioned comfort with complimentary ginger tea while tracking your ticket.
            </span>
          </div>
        </div>
      </div>

      {/* QR Ticket Modal Sheet */}
      {isQrModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-space-sm"
          onClick={() => setIsQrModalOpen(false)}
        >
          <div
            className="bg-surface-container-lowest w-full max-w-sm rounded-xl p-space-md flex flex-col items-center gap-space-md shadow-2xl relative animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-3 right-3 text-on-surface-variant hover:text-on-surface p-1"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>

            <div className="flex flex-col items-center text-center mt-2">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
                Self Check-In Token
              </span>
              <h4 className="font-headline-md text-headline-md text-primary font-bold">
                Ticket #LK-9021
              </h4>
              <span className="font-label-sm text-label-sm text-secondary font-semibold">
                Token Number {ticketNumber}
              </span>
            </div>

            {/* High contrast Barcode & QR Box */}
            <div className="bg-white p-space-md rounded-xl shadow-inner flex flex-col items-center gap-space-sm border border-surface-container-high/60">
              <svg
                className="w-48 h-48"
                fill="none"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Stylized QR Pattern */}
                <rect fill="white" height="100" width="100" />
                <rect fill="#001428" height="26" width="26" x="10" y="10" />
                <rect fill="white" height="18" width="18" x="14" y="14" />
                <rect fill="#001428" height="10" width="10" x="18" y="18" />
                <rect fill="#001428" height="26" width="26" x="64" y="10" />
                <rect fill="white" height="18" width="18" x="68" y="14" />
                <rect fill="#001428" height="10" width="10" x="72" y="18" />
                <rect fill="#001428" height="26" width="26" x="10" y="64" />
                <rect fill="white" height="18" width="18" x="14" y="68" />
                <rect fill="#001428" height="10" width="10" x="18" y="72" />
                {/* Data Matrix Glyphs */}
                <rect fill="#001428" height="18" width="6" x="42" y="12" />
                <rect fill="#001428" height="12" width="6" x="52" y="18" />
                <rect fill="#001428" height="6" width="16" x="42" y="38" />
                <rect fill="#001428" height="6" width="22" x="12" y="42" />
                <rect fill="#001428" height="12" width="12" x="64" y="42" />
                <rect fill="#001428" height="6" width="8" x="80" y="42" />
                <rect fill="#001428" height="20" width="8" x="42" y="52" />
                <rect fill="#001428" height="6" width="14" x="56" y="56" />
                <rect fill="#001428" height="14" width="14" x="74" y="60" />
                <rect fill="#001428" height="8" width="24" x="42" y="78" />
                <rect fill="#001428" height="6" width="16" x="72" y="80" />
                {/* Center Accent */}
                <circle cx="50" cy="50" fill="#fe932c" r="7" />
              </svg>
              <span className="font-label-md text-label-md font-mono text-on-surface font-bold tracking-wider">
                {ticketCode}
              </span>
            </div>

            <div className="text-center font-label-sm text-label-sm text-on-surface-variant px-space-sm">
              Flash this screen at the entrance scanner when arriving at Kiribathgoda branch to
              confirm presence.
            </div>

            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="w-full bg-primary text-white py-3 rounded-lg font-label-lg text-label-lg font-bold hover:bg-primary-container transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Delay Confirmation Toast */}
      {showToast && (
        <div className="fixed bottom-20 left-4 right-4 z-40 max-w-md mx-auto bg-inverse-surface text-inverse-on-surface p-space-sm rounded-xl shadow-xl flex items-center justify-between transition-all">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-secondary-container">alarm_on</span>
            <span className="font-label-md text-label-md">{toastMessage}</span>
          </div>
          <span className="font-label-sm text-label-sm font-bold text-secondary-container">
            Updated
          </span>
        </div>
      )}
    </div>
  );
}

