'use client';

import React, { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import NavigationHeader from '@/components/NavigationHeader';
import BottomNavigation from '@/components/BottomNavigation';
import CustomerQueueLiveView from '@/components/queue/CustomerQueueLiveView';

export default function LiveQueuePage() {
  const router = useRouter();

  return (
    <Suspense>
      <div className="min-h-screen bg-surface flex flex-col items-center">
        <NavigationHeader />
        <main className="w-full flex-1 flex flex-col items-center">
          <CustomerQueueLiveView
            onCancelTicket={() => router.push('/')}
          />
        </main>
        <BottomNavigation
          currentTab="live-queue"
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

