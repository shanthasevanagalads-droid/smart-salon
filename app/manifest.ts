import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smart Salon LK - Barbershop OS (ස්මාර්ට් සැලූන්)",
    short_name: "SmartSalon LK",
    description:
      "Progressive Web App for Sri Lankan Men's Barber Salons: Realtime Queue Engine, LankaQR POS, Appointments & Offline Resilience",
    start_url: '/',
    scope: '/',
    id: 'smart-salon-lk-pwa-v2',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#001428',
    theme_color: '#001428',
    lang: 'si-LK',
    categories: ['business', 'productivity', 'lifestyle', 'utilities'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/icon',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Point of Sale (POS)',
        short_name: 'POS Counter',
        description: 'Open Cashier & LankaQR Billing',
        url: '/pos',
        icons: [{ src: '/icon.svg', sizes: 'any' }],
      },
      {
        name: 'Live Queue Cockpit',
        short_name: 'Queue',
        description: 'Monitor and call chair queue tickets',
        url: '/queue-manager',
        icons: [{ src: '/icon.svg', sizes: 'any' }],
      },
      {
        name: 'Quick Walk-in Entry',
        short_name: 'Walk-in',
        description: 'Register customer in under 10 seconds',
        url: '/walk-in',
        icons: [{ src: '/icon.svg', sizes: 'any' }],
      },
      {
        name: 'Payment Terminal',
        short_name: 'Payments',
        description: 'Collect LankaQR, Card and Cash payments',
        url: '/payments',
        icons: [{ src: '/icon.svg', sizes: 'any' }],
      },
      {
        name: 'Business Intelligence',
        short_name: 'Reports',
        description: 'Daily turnover, barber metrics and analytics',
        url: '/reports',
        icons: [{ src: '/icon.svg', sizes: 'any' }],
      },
    ],
  };
}

