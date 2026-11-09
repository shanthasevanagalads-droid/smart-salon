'use client';

import React from 'react';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-surface-container-low border border-surface-container-high rounded-3xl p-8 shadow-2xl backdrop-blur-md">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-4xl mb-6 shadow-inner text-amber-400">
          <span className="material-symbols-outlined text-[44px]">wifi_off</span>
        </div>

        <h1 className="text-2xl font-black text-on-surface tracking-tight mb-2">
          Offline Mode Active
        </h1>
        <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-bold mb-4">
          අන්තර්ජාල සම්බන්ධතාවය බිඳවැටී ඇත
        </div>

        <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
          Smart Salon LK is designed for rural resiliency. You can still register walk-in customers,
          view cached queues, and record cash bills. Everything is stored in local IndexedDB and will
          auto-sync to Supabase as soon as your 3G/4G or Wi-Fi reconnects.
        </p>

        <div className="bg-surface-container-lowest/80 rounded-2xl p-4 border border-surface-container-high mb-6 text-left space-y-2.5">
          <div className="flex items-center gap-2.5 text-xs text-on-surface font-semibold">
            <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
            <span>Local Outbox Buffer is Online</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-on-surface font-semibold">
            <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
            <span>Cash Tender and Change Calculator operational</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-on-surface font-semibold">
            <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
            <span>Zero Data Loss Guarantee</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-3.5 bg-primary text-on-primary rounded-xl font-black text-sm hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">refresh</span>
            <span>Check Connection & Retry</span>
          </button>

          <Link
            href="/pos"
            className="w-full py-3 bg-surface-container-high text-on-surface rounded-xl font-bold text-xs hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
            <span>Continue POS in Offline Mode</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

