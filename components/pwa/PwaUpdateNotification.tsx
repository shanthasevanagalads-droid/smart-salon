'use client';

import React from 'react';
import { usePwa } from '@/lib/pwa/usePwa';

export function PwaUpdateNotification() {
  const { hasUpdate, applyUpdate } = usePwa();

  if (!hasUpdate) return null;

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 bg-primary-container/95 border border-primary text-on-primary-container rounded-2xl p-3.5 shadow-2xl backdrop-blur-md animate-slide-down flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[18px]">system_update</span>
        </div>
        <div>
          <h5 className="text-xs font-black leading-tight">App Update Available</h5>
          <span className="text-[10px] opacity-80">අලුත් යාවත්කාලීන කිරීමක් තිබේ</span>
        </div>
      </div>

      <button
        type="button"
        onClick={applyUpdate}
        className="px-3 py-1.5 bg-primary text-on-primary rounded-xl text-xs font-extrabold hover:brightness-110 active:scale-95 transition-all shadow-sm"
      >
        Update Now
      </button>
    </div>
  );
}

