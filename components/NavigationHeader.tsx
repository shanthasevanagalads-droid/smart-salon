'use client';

import React from 'react';

interface NavigationHeaderProps {
  onProfileClick?: () => void;
}

export default function NavigationHeader({ onProfileClick }: NavigationHeaderProps) {
  return (
    <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="max-w-md mx-auto h-20 px-gutter flex items-center justify-between gap-space-sm">
        {/* Brand & Location */}
        <div className="flex items-center gap-space-sm min-w-0 flex-1">
          {/* Logo */}
          <div className="h-8 w-8 rounded-lg bg-primary-container flex items-center justify-center text-primary-fixed shrink-0">
            <span className="material-symbols-outlined text-[20px]">content_cut</span>
          </div>

          <div className="flex flex-col min-w-0 leading-tight">
            <div className="flex items-center gap-space-xs">
              <span className="font-headline-md text-headline-md text-primary tracking-tight truncate">
                Smart Salon LK
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-normal shrink-0">
                (ස්මාර්ට් සැලූන්)
              </span>
            </div>
            <div className="flex items-center gap-1 text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px] leading-none text-secondary">
                location_on
              </span>
              <span className="font-label-sm text-label-sm truncate">
                Kandy Road,Ampitiya
              </span>
            </div>
          </div>
        </div>

        {/* Action icons: WhatsApp & Profile */}
        <div className="flex items-center gap-space-xs shrink-0">
          <a
            aria-label="WhatsApp Direct Dial"
            className="min-w-[44px] min-h-[44px] px-space-xs flex items-center justify-center rounded-lg bg-tertiary-container text-tertiary-fixed hover:bg-primary-container transition-colors shadow-sm"
            href="https://wa.me/94722759020"
            rel="noopener noreferrer"
            target="_blank"
          >
            <span className="material-symbols-outlined text-[20px]">chat</span>
          </a>

          <button
            type="button"
            onClick={onProfileClick || (() => { if (typeof window !== 'undefined') window.location.href = '/auth/login'; })}
            aria-label="User Profile"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:opacity-85 transition-opacity cursor-pointer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover ring-2 ring-primary-fixed"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuClWzoNnnNVyHGu3z3Oq4Uy46Dr9KE7ptxkCm5t_gmQc8WgOQ2goopuQsKC3nAV3HaObMvSRTuCZD64Lp8hH53M1ypG3hnMQwVkXwHxuG5vt0mfGlcyQ9FCEkA4DAFAdVdHRmJPatGTRyDjrmmr1nk-LgrZ3JDcUqq9j8qP3-cZDFzYVP1si1QDgPq_QLwPaUGHbHTFPh0ed6MSWRwkhxjsc4AxaxzEJzSGz3cX6ik"
            />
          </button>
        </div>
      </div>
    </header>
  );
}

