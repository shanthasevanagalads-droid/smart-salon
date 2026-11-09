import CustomerManagementView from '@/components/crm/CustomerManagementView';

export const metadata = {
  title: 'Customer Management & CRM | Smart Salon LK',
  description: 'Manage repeat customers, visit histories, and client preferences for Smart Salon LK.',
};

export default function CustomersPage() {
  return <CustomerManagementView />;
}

