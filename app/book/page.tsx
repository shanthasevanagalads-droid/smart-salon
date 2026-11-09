'use client';

import React, { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import NavigationHeader from '@/components/NavigationHeader';
import BottomNavigation from '@/components/BottomNavigation';
import BookScreen from '@/components/BookScreen';
import { BookingState } from '@/components/types';

export default function BookPage() {
  const router = useRouter();

  const handleConfirmed = (_booking: BookingState) => {
    router.push('/live-queue');
  };

  return (
    <Suspense>
      <div className="min-h-screen bg-surface flex flex-col items-center">
        <NavigationHeader />
        <main className="w-full flex-1 flex flex-col items-center">
          <BookScreen
            onBackToHome={() => router.push('/')}
            onBookingConfirmed={handleConfirmed}
          />
        </main>
        <BottomNavigation
          currentTab="book-flow"
          onTabChange={(tab) => {
            if (tab === 'home-book') router.push('/');
            else if (tab === 'live-queue') router.push('/live-queue');
            else if (tab === 'my-bookings') router.push('/bookings');
            else if (tab === 'owner-pos') router.push('/owner-pos');
          }}
        />
      </div>
    </Suspense>
  );
}

