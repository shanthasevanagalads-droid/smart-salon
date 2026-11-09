import { Suspense } from 'react';
import BillingPosCockpit from '@/components/pos/BillingPosCockpit';

export const metadata = {
  title: 'Billing & POS Station | Smart Salon LK',
  description:
    'High-speed touch point-of-sale, sequential invoice generation, LankaQR national standard payment, barcode & thermal slip printing for Smart Salon LK.',
};

export default function PosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <div className="flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
              progress_activity
            </span>
            <span className="font-title-md text-primary font-bold">
              Loading POS Cockpit...
            </span>
          </div>
        </div>
      }
    >
      <BillingPosCockpit />
    </Suspense>
  );
}

