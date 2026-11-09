import OwnerQueueManager from '@/components/queue/OwnerQueueManager';

export const metadata = {
  title: 'Live Queue Operator Cockpit | Smart Salon LK',
  description: 'Realtime dual-chair queue management, customer call system, and waiting time engine for Smart Salon LK.',
};

export default function QueueManagerPage() {
  return <OwnerQueueManager />;
}

