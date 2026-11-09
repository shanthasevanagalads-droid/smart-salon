'use client';

import React from 'react';
import { NavTab } from './types';

interface BottomNavigationProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  activeTicketCount?: number;
}

export default function BottomNavigation({
  currentTab,
  onTabChange,
  activeTicketCount = 1,
}: BottomNavigationProps) {
  const isBookActive = currentTab === 'home-book' || currentTab === 'book-flow';
  const isLiveQueueActive = currentTab === 'live-queue';
  const isBookingsActive = currentTab === 'my-bookings';
  const isOwnerPosActive = currentTab === 'owner-pos';

  return (
    <nav className="fixed bottom-0 w-full z-50 pb-safe bg-surface/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(15,41,66,0.08)] border-t border-surface-container-high/40">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-gutter">
        {/* Book */}
        <button
          type="button"
          onClick={() => onTabChange('home-book')}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] flex-1 transition-colors ${
            isBookActive
              ? 'text-tertiary-container font-semibold'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">storefront</span>
          <span className="font-label-sm text-label-sm">Book</span>
        </button>

        {/* Live Queue */}
        <button
          type="button"
          onClick={() => onTabChange('live-queue')}
          className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] flex-1 transition-colors ${
            isLiveQueueActive
              ? 'text-tertiary-container font-semibold'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <div className="relative">
            <span className="material-symbols-outlined text-[24px]">hourglass_top</span>
            {activeTicketCount > 0 && (
              <span className="absolute -top-1 -right-2 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary"></span>
              </span>
            )}
          </div>
          <span className="font-label-sm text-label-sm">Live Queue</span>
        </button>

        {/* My Bookings */}
        <button
          type="button"
          onClick={() => onTabChange('my-bookings')}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] flex-1 transition-colors ${
            isBookingsActive
              ? 'text-tertiary-container font-semibold'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">confirmation_number</span>
          <span className="font-label-sm text-label-sm">Bookings</span>
        </button>

        {/* Owner POS */}
        <button
          type="button"
          onClick={() => onTabChange('owner-pos')}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] flex-1 transition-colors ${
            isOwnerPosActive
              ? 'text-tertiary-container font-semibold'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">point_of_sale</span>
          <span className="font-label-sm text-label-sm">Owner POS</span>
        </button>
      </div>
    </nav>
  );
}

