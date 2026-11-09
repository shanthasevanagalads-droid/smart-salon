import { Metadata } from 'next';
import BusinessIntelligenceDashboard from '@/components/analytics/BusinessIntelligenceDashboard';

export const metadata: Metadata = {
  title: 'Reports & Business Intelligence | Smart Salon LK',
  description:
    'Executive Business Intelligence, Financial Sales Reporting, Barber Station Productivity, Customer Retention, and Peak Queue Traffic Analytics for Smart Salon LK.',
};

export default function ReportsPage() {
  return <BusinessIntelligenceDashboard />;
}

