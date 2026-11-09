import { Metadata } from 'next';
import PaymentTerminalCockpit from '@/components/payment/PaymentTerminalCockpit';

export const metadata: Metadata = {
  title: 'Payment Terminal | Smart Salon LK',
  description:
    'FinTech Multi-Tender Payment Processing Station for Smart Salon LK. Supports Cash, LankaQR EMVCo, Credit/Debit Cards, and Split Payments.',
};

export default function PaymentsPage() {
  return <PaymentTerminalCockpit />;
}

