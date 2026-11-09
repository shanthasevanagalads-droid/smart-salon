import { Metadata } from 'next';
import NotificationCenterCockpit from '@/components/notifications/NotificationCenterCockpit';

export const metadata: Metadata = {
  title: 'WhatsApp Notification Center | Smart Salon LK',
  description:
    'Centralized WhatsApp Communication & Notification Engine for Smart Salon LK. Manage automated appointment confirmations, live queue alerts, thermal invoice delivery, and customer message templates.',
};

export default function NotificationsPage() {
  return <NotificationCenterCockpit />;
}

