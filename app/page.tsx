'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import NavigationHeader from '@/components/NavigationHeader';
import BottomNavigation from '@/components/BottomNavigation';
import HomeScreen from '@/components/HomeScreen';
import BookScreen from '@/components/BookScreen';
import LiveQueueScreen from '@/components/LiveQueueScreen';
import OwnerPosScreen from '@/components/OwnerPosScreen';
import MyBookingsScreen from '@/components/MyBookingsScreen';
import { NavTab, BookingState, ServiceItem } from '@/components/types';

function SmartSalonApp() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as NavTab) || 'home-book';

  const [currentTab, setCurrentTab] = useState<NavTab>(initialTab);
  const [selectedService, setSelectedService] = useState<ServiceItem | undefined>(undefined);
  const [bookingState, setBookingState] = useState<Partial<BookingState>>({
    serviceName: 'Hair Cut + Beard Grooming',
    serviceSinhala: 'කොණ්ඩය සහ රැවුල සම්පූර්ණ සත්කාරය',
    servicePrice: 1800,
    serviceDuration: '45m',
    stylistName: 'Master Kavi',
    tokenNumber: 10,
    ticketCode: 'SMART-SALON-LK-9021',
    customerName: 'Kasun Perera',
    customerPhone: '77 245 8901',
  });

  const handleStartBookingFlow = (service?: ServiceItem) => {
    if (service) {
      setSelectedService(service);
    }
    setCurrentTab('book-flow');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInstantTokenGenerated = (newBooking: Partial<BookingState>) => {
    setBookingState((prev) => ({ ...prev, ...newBooking }));
    setCurrentTab('live-queue');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookingConfirmed = (confirmedBooking: BookingState) => {
    setBookingState(confirmedBooking);
    setCurrentTab('live-queue');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelTicket = () => {
    setBookingState((prev) => ({
      ...prev,
      tokenNumber: 0,
      ticketCode: '',
    }));
    setCurrentTab('home-book');
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center selection:bg-secondary-container selection:text-on-secondary-container">
      {/* Top Header */}
      <NavigationHeader
        onProfileClick={() => {
          setCurrentTab('my-bookings');
        }}
      />

      {/* Main Screen Body */}
      <main className="w-full flex-1 flex flex-col items-center">
        {currentTab === 'home-book' && (
          <HomeScreen
            onStartBookingFlow={handleStartBookingFlow}
            onInstantTokenGenerated={handleInstantTokenGenerated}
            onOpenLiveQueue={() => setCurrentTab('live-queue')}
          />
        )}

        {currentTab === 'book-flow' && (
          <BookScreen
            onBackToHome={() => setCurrentTab('home-book')}
            onBookingConfirmed={handleBookingConfirmed}
            initialService={selectedService}
          />
        )}

        {currentTab === 'live-queue' && (
          <LiveQueueScreen
            bookingData={bookingState}
            onCancelTicket={handleCancelTicket}
          />
        )}

        {currentTab === 'owner-pos' && <OwnerPosScreen />}

        {currentTab === 'my-bookings' && (
          <MyBookingsScreen
            activeBooking={bookingState}
            onTrackQueue={() => setCurrentTab('live-queue')}
            onBookAgain={() => setCurrentTab('home-book')}
          />
        )}
      </main>

      {/* Bottom Sticky Safe Navigation Bar */}
      <BottomNavigation
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        activeTicketCount={bookingState.tokenNumber && bookingState.tokenNumber > 0 ? 1 : 0}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <div className="flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
              progress_activity
            </span>
            <span className="font-title-md text-primary font-bold">
              Loading Smart Salon LK...
            </span>
          </div>
        </div>
      }
    >
      <SmartSalonApp />
    </Suspense>
  );
}
