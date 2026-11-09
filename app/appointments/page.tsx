import { Suspense } from 'react';
import AppointmentManagementView from '@/components/appointments/AppointmentManagementView';

export const metadata = {
  title: 'Appointment Management | Smart Salon LK',
  description: 'Dual-chair calendar, double-booking prevention, and live queue synchronization for Smart Salon LK.',
};

export default function AppointmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          Loading Appointments...
        </div>
      }
    >
      <AppointmentManagementView />
    </Suspense>
  );
}

