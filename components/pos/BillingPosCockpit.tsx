'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  Invoice,
  PaymentMethod,
  PosDailyKpis,
  InvoiceCheckoutPayload,
} from '@/types/billing';
import {
  BillingService,
  generateLankaQrPayload,
  generateWhatsAppReceiptUrl,
  DEFAULT_THERMAL_SETTINGS,
} from '@/lib/services/billing-service';
import { playSalonChime } from '@/lib/services/queue-service';

interface ServiceItemCatalog {
  id: string;
  name: string;
  sinhalaName: string;
  category: 'haircut' | 'beard' | 'treatment';
  price: number;
  durationMinutes: number;
  icon: string;
  isPopular?: boolean;
}

const CATALOG_SERVICES: ServiceItemCatalog[] = [
  {
    id: 'adult-cut',
    name: 'Adult Hair Cut',
    sinhalaName: 'වැඩිහිටි කොණ්ඩ කැපීම',
    category: 'haircut',
    price: 1200,
    durationMinutes: 30,
    icon: 'content_cut',
    isPopular: true,
  },
  {
    id: 'beard-trim',
    name: 'Beard Trim & Lineup',
    sinhalaName: 'රැවුල හැඩගැන්වීම සහ රේසර් ලයින්',
    category: 'beard',
    price: 800,
    durationMinutes: 20,
    icon: 'face',
    isPopular: true,
  },
  {
    id: 'cut-beard',
    name: 'Hair Cut + Beard Combo',
    sinhalaName: 'කොණ්ඩය සහ රැවුල පැකේජය',
    category: 'haircut',
    price: 1800,
    durationMinutes: 45,
    icon: 'auto_fix_high',
    isPopular: true,
  },
  {
    id: 'child-cut',
    name: 'Child Hair Cut',
    sinhalaName: 'ළමා කොණ්ඩ කැපීම',
    category: 'haircut',
    price: 900,
    durationMinutes: 20,
    icon: 'child_care',
  },
  {
    id: 'hair-dye',
    name: 'Hair Dye / Color Treatment',
    sinhalaName: 'කොණ්ඩය ඩයි කිරීම',
    category: 'treatment',
    price: 2200,
    durationMinutes: 40,
    icon: 'palette',
  },
  {
    id: 'head-massage',
    name: 'Herbal Head Massage',
    sinhalaName: 'හිස සම්බාහනය',
    category: 'treatment',
    price: 1200,
    durationMinutes: 20,
    icon: 'spa',
  },
  {
    id: 'oil-massage',
    name: 'Ayurvedic Oil Therapy',
    sinhalaName: 'ආයුර්වේද තෙල් සම්බාහනය',
    category: 'treatment',
    price: 1500,
    durationMinutes: 25,
    icon: 'self_improvement',
  },
];

const BARBERS = [
  { id: 'c0000000-0000-0000-0000-000000000001', name: 'Master Kavi (Chair 01)', chair: 1 },
  { id: 'c0000000-0000-0000-0000-000000000002', name: 'Sunil Shantha (Chair 02)', chair: 2 },
];

interface CartItem {
  serviceId: string;
  name: string;
  sinhalaName?: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  staffId: string;
}

export default function BillingPosCockpit() {
  const [isPending, startTransition] = useTransition();

  // Shop state
  const [isSalonOpen, setIsSalonOpen] = useState(true);

  // Active Customer Info
  const [customerName, setCustomerName] = useState('Kasun Perera');
  const [customerPhone, setCustomerPhone] = useState('+94771234567');
  const [customerId, setCustomerId] = useState<string | null>('a0000000-0000-0000-0000-000000000001');
  const [tokenCode, setTokenCode] = useState('#07');
  const [assignedBarberId, setAssignedBarberId] = useState(BARBERS[0].id);

  // Service Catalog & Cart
  const [activeCategory, setActiveCategory] = useState<'all' | 'haircut' | 'beard' | 'treatment'>('all');
  const [cart, setCart] = useState<CartItem[]>([
    {
      serviceId: 'cut-beard',
      name: 'Hair Cut + Beard Combo',
      sinhalaName: 'කොණ්ඩය සහ රැවුල පැකේජය',
      unitPrice: 1800,
      quantity: 1,
      discount: 0,
      staffId: BARBERS[0].id,
    },
  ]);

  // Billing & Payment States
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState<number>(2000);
  const [cardLastFour, setCardLastFour] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');

  // Settle States
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [toastMessage, setToMessage] = useState<string | null>(null);

  // Owner POS Dashboard / Telemetry
  const [kpis, setKpis] = useState<PosDailyKpis>({
    date: '',
    totalRevenue: 34200,
    invoicesCount: 21,
    avgBillValue: 1628,
    cashSales: 21400,
    cashCount: 14,
    cardSales: 4000,
    cardCount: 2,
    lankaqrSales: 8800,
    lankaqrCount: 5,
    pendingCount: 0,
    topServices: [
      { itemName: 'Adult Hair Cut', count: 14, revenue: 16800 },
      { itemName: 'Hair Cut + Beard Combo', count: 8, revenue: 14400 },
      { itemName: 'Beard Trim & Lineup', count: 6, revenue: 4800 },
    ],
  });

  // Recent Invoices Drawer
  const [isRecentDrawerOpen, setIsRecentDrawerOpen] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Initial load of telemetry & recent invoices
  useEffect(() => {
    loadTelemetry();
    loadRecentInvoices();
  }, []);

  const loadTelemetry = async () => {
    try {
      const data = await BillingService.getDailyKpis();
      if (data) setKpis(data);
    } catch (err) {
      console.warn('Failed to load telemetry:', err);
    }
  };

  const loadRecentInvoices = async (query = '') => {
    try {
      const invs = await BillingService.searchInvoices({ query });
      setRecentInvoices(invs);
    } catch (err) {
      console.warn('Failed to load recent invoices:', err);
    }
  };

  // Cart Calculations
  const subtotal = cart.reduce((acc, it) => acc + it.quantity * it.unitPrice - it.discount, 0);
  let computedDiscount = discountValue;
  if (discountType === 'percentage' && discountValue > 0) {
    computedDiscount = Math.round((subtotal * (discountValue / 100)) * 100) / 100;
  }
  const grandTotal = Math.max(0, subtotal - computedDiscount);
  const changeAmount = paymentMode === 'cash' ? Math.max(0, cashTendered - grandTotal) : 0;

  // Add service to cart
  const handleAddToCart = (svc: ServiceItemCatalog) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.serviceId === svc.id);
      if (existing) {
        return prev.map((i) =>
          i.serviceId === svc.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          serviceId: svc.id,
          name: svc.name,
          sinhalaName: svc.sinhalaName,
          unitPrice: svc.price,
          quantity: 1,
          discount: 0,
          staffId: assignedBarberId,
        },
      ];
    });
  };

  const handleUpdateQuantity = (serviceId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.serviceId === serviceId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveFromCart = (serviceId: string) => {
    setCart((prev) => prev.filter((i) => i.serviceId !== serviceId));
  };

  // Pull queue customer into POS active chair
  const handleSelectChair = (chairNum: number) => {
    if (chairNum === 1) {
      setAssignedBarberId(BARBERS[0].id);
      setTokenCode('#07');
      setCustomerName('Kasun Perera');
      setCustomerPhone('+94771234567');
      setCustomerId('a0000000-0000-0000-0000-000000000001');
      setCart([
        {
          serviceId: 'cut-beard',
          name: 'Hair Cut + Beard Combo',
          sinhalaName: 'කොණ්ඩය සහ රැවුල පැකේජය',
          unitPrice: 1800,
          quantity: 1,
          discount: 0,
          staffId: BARBERS[0].id,
        },
      ]);
    } else {
      setAssignedBarberId(BARBERS[1].id);
      setTokenCode('#08');
      setCustomerName('Ruwan Pradeep (Walk-in)');
      setCustomerPhone('+94712345678');
      setCustomerId('a0000000-0000-0000-0000-000000000002');
      setCart([
        {
          serviceId: 'beard-trim',
          name: 'Beard Trim & Lineup',
          sinhalaName: 'රැවුල හැඩගැන්වීම සහ රේසර් ලයින්',
          unitPrice: 800,
          quantity: 1,
          discount: 0,
          staffId: BARBERS[1].id,
        },
      ]);
    }
    setCashTendered(chairNum === 1 ? 2000 : 1000);
  };

  // Complete Payment & Settle Invoice
  const handleSettleInvoice = async () => {
    if (cart.length === 0) {
      alert('Cart is empty. Please select at least one grooming service.');
      return;
    }

    startTransition(async () => {
      const payload: InvoiceCheckoutPayload = {
        customerId,
        customerName,
        customerPhone,
        staffId: assignedBarberId,
        items: cart.map((i) => ({
          serviceId: i.serviceId,
          staffId: i.staffId,
          itemName: i.name,
          itemSinhalaName: i.sinhalaName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
        })),
        discountAmount: discountValue,
        discountType,
        discountReason: discountReason || undefined,
        paymentMethod: paymentMode,
        cashTendered: paymentMode === 'cash' ? cashTendered : grandTotal,
        cardLastFour: paymentMode === 'card' ? cardLastFour : undefined,
        notes: invoiceNotes || undefined,
      };

      const result = await BillingService.checkout(payload);

      if (result.success && result.invoice) {
        setActiveInvoice(result.invoice);
        setIsReceiptModalOpen(true);
        playSalonChime();
        loadTelemetry();
        loadRecentInvoices();

        // Advance to next token simulated
        setTokenCode('#09');
        setCustomerName('Walk-in Customer');
        setCustomerPhone('');
        setCustomerId(null);
        setCart([]);
        setDiscountValue(0);
      } else {
        alert(result.error || 'Failed to process checkout');
      }
    });
  };

  const handleQuickCash = (amount: number) => {
    setCashTendered(amount);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    if (!activeInvoice) return;
    const url = generateWhatsAppReceiptUrl(activeInvoice, customerPhone);
    window.open(url, '_blank');
  };

  const filteredCatalog =
    activeCategory === 'all'
      ? CATALOG_SERVICES
      : CATALOG_SERVICES.filter((s) => s.category === activeCategory);

  return (
    <div className="flex flex-col w-full pb-32 pt-20">
      <div className="max-w-2xl mx-auto w-full px-4 flex flex-col gap-4">
        {/* ============================================================== */}
        {/* 1. TOP HEADER & NAVIGATION BAR                                */}
        {/* ============================================================== */}
        <div className="flex items-center justify-between bg-surface-container-low p-3 rounded-2xl shadow-sm border border-surface-container-high/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[24px]">point_of_sale</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-title-md text-primary font-bold">POS Billing Station</span>
                <span className="text-[10px] bg-tertiary-container text-tertiary-fixed font-bold px-1.5 py-0.5 rounded uppercase">
                  v2.0 PWA
                </span>
              </div>
              <span className="text-xs text-on-surface-variant">
                The Royal Blade • Ampitiya Chair 01 &amp; 02
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSalonOpen(!isSalonOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isSalonOpen
                  ? 'bg-tertiary-container text-tertiary-fixed'
                  : 'bg-error-container text-on-error-container'
                }`}
            >
              <span
                className="material-symbols-outlined text-[14px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                store
              </span>
              <span>{isSalonOpen ? 'OPEN' : 'CLOSED'}</span>
            </button>

            <Link
              href="/reports"
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors"
              title="Business Intelligence Reports"
            >
              <span className="material-symbols-outlined text-[16px]">monitoring</span>
              <span>Reports</span>
            </Link>

            <Link
              href="/notifications"
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-colors"
              title="WhatsApp Notification Center"
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
              <span>WhatsApp</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsRecentDrawerOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-primary text-xs font-bold transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              <span>History</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. SHORTCUTS STRIP (Walk-in, Queue, Bookings, Barbers, CRM, Payments) */}
        {/* ============================================================== */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          <Link
            href="/walk-in"
            className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-tertiary-container text-on-tertiary-container text-xs font-bold shadow-xs hover:bg-tertiary-container/90 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            <span>Walk-in</span>
          </Link>
          <Link
            href="/queue-manager"
            className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-xs hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
            <span>Queue</span>
          </Link>
          <Link
            href="/payments"
            className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs hover:bg-emerald-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">payments</span>
            <span>Payments</span>
          </Link>
          <Link
            href="/appointments"
            className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-surface-container border border-surface-container-high/60 text-xs font-bold text-primary hover:bg-surface-container-high transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
            <span>Bookings</span>
          </Link>
          <Link
            href="/staff"
            className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-surface-container border border-surface-container-high/60 text-xs font-bold text-primary hover:bg-surface-container-high transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">badge</span>
            <span>Barbers</span>
          </Link>
          <Link
            href="/customers"
            className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-surface-container border border-surface-container-high/60 text-xs font-bold text-primary hover:bg-surface-container-high transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">groups</span>
            <span>CRM</span>
          </Link>
        </div>

        {/* ============================================================== */}
        {/* 3. OWNER POS DASHBOARD: DAILY FINANCIAL TELEMETRY CARDS        */}
        {/* ============================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Revenue */}
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-surface-container-high/40 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wide text-on-surface-variant font-medium">
              Today's Sales
            </span>
            <div className="text-lg font-extrabold text-primary tracking-tight mt-1">
              LKR {kpis.totalRevenue.toLocaleString()}
            </div>
            <span className="text-[11px] text-tertiary font-semibold mt-0.5">
              {kpis.invoicesCount} Invoices Paid
            </span>
          </div>

          {/* Average Bill */}
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-surface-container-high/40 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wide text-on-surface-variant font-medium">
              Avg Bill Value
            </span>
            <div className="text-lg font-extrabold text-secondary tracking-tight mt-1">
              LKR {kpis.avgBillValue.toLocaleString()}
            </div>
            <span className="text-[11px] text-on-surface-variant mt-0.5">Per Customer</span>
          </div>

          {/* Cash Sales */}
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-surface-container-high/40 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wide text-on-surface-variant font-medium">
              Cash Drawer
            </span>
            <div className="text-lg font-extrabold text-primary tracking-tight mt-1">
              LKR {kpis.cashSales.toLocaleString()}
            </div>
            <span className="text-[11px] text-on-surface-variant mt-0.5">
              {kpis.cashCount} Cash bills
            </span>
          </div>

          {/* LankaQR & Card */}
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-surface-container-high/40 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wide text-on-surface-variant font-medium">
              LankaQR / Digital
            </span>
            <div className="text-lg font-extrabold text-on-tertiary-container tracking-tight mt-1">
              LKR {(kpis.lankaqrSales + kpis.cardSales).toLocaleString()}
            </div>
            <span className="text-[11px] text-tertiary font-semibold mt-0.5">
              {kpis.lankaqrCount} QR • {kpis.cardCount} Card
            </span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 4. ACTIVE CHAIR & CUSTOMER RECOGNITION SELECTOR                */}
        {/* ============================================================== */}
        <div className="bg-primary-container text-on-primary rounded-2xl p-4 shadow-md flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectChair(1)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${assignedBarberId === BARBERS[0].id
                    ? 'bg-secondary text-on-secondary shadow-sm'
                    : 'bg-surface-container-highest/20 text-surface-bright hover:bg-surface-container-highest/30'
                  }`}
              >
                ✂️ Chair 01 (Master Kavi)
              </button>
              <button
                type="button"
                onClick={() => handleSelectChair(2)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${assignedBarberId === BARBERS[1].id
                    ? 'bg-secondary text-on-secondary shadow-sm'
                    : 'bg-surface-container-highest/20 text-surface-bright hover:bg-surface-container-highest/30'
                  }`}
              >
                ✂️ Chair 02 (Sunil)
              </button>
            </div>
            <span className="text-xs bg-tertiary-container text-tertiary-fixed font-bold px-2 py-0.5 rounded-full">
              Live in Seat
            </span>
          </div>

          <div className="flex items-center gap-3 bg-surface-container-lowest/10 p-3 rounded-xl backdrop-blur-xs">
            <div className="w-12 h-12 rounded-xl bg-surface-bright text-primary flex flex-col items-center justify-center shrink-0 font-bold shadow-sm">
              <span className="text-[9px] uppercase tracking-wider text-on-surface-variant">TOKEN</span>
              <span className="text-base leading-none">{tokenCode}</span>
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  className="bg-transparent text-surface-bright font-bold text-base truncate outline-none border-b border-surface-bright/20 focus:border-surface-bright transition-colors"
                />
                <span className="material-symbols-outlined text-[16px] text-tertiary-fixed">
                  verified
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+94 77..."
                  className="bg-transparent text-surface-container-highest text-xs truncate outline-none border-b border-surface-container-highest/20 focus:border-surface-bright transition-colors"
                />
                <span className="text-[11px] text-surface-container-highest/60">•</span>
                <span className="text-xs text-secondary-fixed font-bold">
                  {BARBERS.find((b) => b.id === assignedBarberId)?.name}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 5. SERVICE CATALOG GRID (Fast Touch Tap)                       */}
        {/* ============================================================== */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="font-title-md text-primary font-bold">Add Services (සේවාවන්)</h3>
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1">
              {(['all', 'haircut', 'beard', 'treatment'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${activeCategory === cat
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredCatalog.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => handleAddToCart(svc)}
                className="bg-surface-container-lowest p-3 rounded-xl border border-surface-container-high/50 hover:border-primary/50 text-left flex flex-col justify-between shadow-xs active:scale-[0.98] transition-all"
              >
                <div className="flex items-start justify-between">
                  <span className="material-symbols-outlined text-[20px] text-secondary">
                    {svc.icon}
                  </span>
                  <span className="text-xs font-extrabold text-primary bg-surface-container px-2 py-0.5 rounded-full">
                    Rs. {svc.price}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="font-bold text-xs text-primary leading-snug line-clamp-1">
                    {svc.name}
                  </div>
                  <div className="text-[11px] text-on-surface-variant line-clamp-1">
                    {svc.sinhalaName}
                  </div>
                  <span className="text-[10px] text-secondary font-medium">
                    ⏱️ {svc.durationMinutes} mins
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ============================================================== */}
        {/* 6. INVOICE CART & SERVICE LINE ITEMS                           */}
        {/* ============================================================== */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-container-high/60 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-title-md text-primary font-bold">
              Current Bill ({cart.length} items)
            </span>
            <span className="text-xs text-on-surface-variant font-mono">
              Auto-Seq: INV-2026-XXXXXX
            </span>
          </div>

          {cart.length === 0 ? (
            <div className="py-6 text-center text-on-surface-variant text-xs flex flex-col items-center gap-1">
              <span className="material-symbols-outlined text-[28px] text-surface-container-highest">
                shopping_cart
              </span>
              <span>Cart is empty. Tap any service above to add.</span>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-surface-container-high/40">
              {cart.map((item) => (
                <div key={item.serviceId} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-bold text-xs text-primary truncate">{item.name}</span>
                    <span className="text-[11px] text-on-surface-variant">
                      Rs. {item.unitPrice.toLocaleString()} × {item.quantity}
                    </span>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1.5 bg-surface-container px-2 py-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.serviceId, -1)}
                      className="w-5 h-5 flex items-center justify-center font-bold text-sm text-primary active:scale-90"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold text-primary min-w-[14px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuantity(item.serviceId, 1)}
                      className="w-5 h-5 flex items-center justify-center font-bold text-sm text-primary active:scale-90"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right min-w-[70px]">
                    <span className="font-bold text-xs text-primary">
                      Rs. {(item.quantity * item.unitPrice).toLocaleString()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveFromCart(item.serviceId)}
                    className="text-on-surface-variant hover:text-error transition-colors p-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ============================================================ */}
          {/* DISCOUNT CONTROLS                                             */}
          {/* ============================================================ */}
          <div className="bg-surface-container-low p-2.5 rounded-xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary">Discount (වට්ටම්)</span>
              <div className="flex items-center gap-1">
                {[0, 5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setDiscountType('percentage');
                      setDiscountValue(pct);
                      if (pct > 0) setDiscountReason(`${pct}% Loyalty Discount`);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${discountType === 'percentage' && discountValue === pct
                        ? 'bg-secondary text-on-secondary'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                  >
                    {pct === 0 ? 'None' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Or custom LKR discount..."
                value={discountType === 'fixed' && discountValue > 0 ? discountValue : ''}
                onChange={(e) => {
                  setDiscountType('fixed');
                  setDiscountValue(Number(e.target.value) || 0);
                  setDiscountReason('Custom Manual Discount');
                }}
                className="w-1/2 px-2.5 py-1 text-xs rounded bg-surface-container border border-surface-container-high outline-none text-primary"
              />
              <input
                type="text"
                placeholder="Discount reason (Optional)"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                className="w-1/2 px-2.5 py-1 text-xs rounded bg-surface-container border border-surface-container-high outline-none text-primary"
              />
            </div>
          </div>

          {/* ============================================================ */}
          {/* TOTAL SUMMARY CARD                                           */}
          {/* ============================================================ */}
          <div className="border-t border-surface-container-high pt-2 flex flex-col gap-1 text-xs">
            <div className="flex justify-between text-on-surface-variant">
              <span>Subtotal:</span>
              <span>Rs. {subtotal.toLocaleString()}</span>
            </div>
            {computedDiscount > 0 && (
              <div className="flex justify-between text-error font-semibold">
                <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Fixed'}):</span>
                <span>- Rs. {computedDiscount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 mt-1 border-t border-surface-container-high text-base font-extrabold text-primary">
              <span>Total Payable (මුළු මුදල):</span>
              <span className="text-secondary text-xl font-black">
                LKR {grandTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 7. PAYMENT METHOD SELECTOR & TENDERED PAD                      */}
        {/* ============================================================== */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-container-high/60 flex flex-col gap-3">
          <span className="font-title-md text-primary font-bold">Payment Method (ගෙවීම් ක්‍රමය)</span>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMode('cash')}
              className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all active:scale-95 ${paymentMode === 'cash'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
            >
              <span className="material-symbols-outlined text-[24px]">payments</span>
              <span>💵 Cash</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMode('lankaqr')}
              className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all active:scale-95 ${paymentMode === 'lankaqr'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
            >
              <span className="material-symbols-outlined text-[24px]">qr_code_scanner</span>
              <span>📱 LankaQR</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMode('card')}
              className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all active:scale-95 ${paymentMode === 'card'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
            >
              <span className="material-symbols-outlined text-[24px]">credit_card</span>
              <span>💳 Card Tap</span>
            </button>
          </div>

          {/* Mode Specific Body */}
          {paymentMode === 'cash' ? (
            <div className="bg-surface-container-low p-3 rounded-xl flex flex-col gap-2">
              <span className="text-xs font-bold text-primary">Quick Cash Keypad (මුදල් ලබා ගැනීම)</span>

              {/* Quick Cash Buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickCash(grandTotal)}
                  className="py-1.5 bg-surface-container-high hover:bg-surface-container-highest rounded text-xs font-bold text-primary"
                >
                  Exact ({grandTotal})
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCash(1000)}
                  className="py-1.5 bg-surface-container-high hover:bg-surface-container-highest rounded text-xs font-bold text-primary"
                >
                  Rs. 1,000
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCash(2000)}
                  className="py-1.5 bg-surface-container-high hover:bg-surface-container-highest rounded text-xs font-bold text-primary"
                >
                  Rs. 2,000
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCash(5000)}
                  className="py-1.5 bg-surface-container-high hover:bg-surface-container-highest rounded text-xs font-bold text-primary"
                >
                  Rs. 5,000
                </button>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1">
                  <label className="text-[11px] text-on-surface-variant font-medium block">
                    Cash Tendered (LKR):
                  </label>
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(Number(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-lg bg-surface-container text-primary font-bold text-base outline-none border border-surface-container-high focus:border-primary"
                  />
                </div>

                <div className="flex-1 bg-surface-container-lowest p-2 rounded-lg border border-surface-container-high/60 text-right">
                  <span className="text-[10px] text-on-surface-variant uppercase font-bold block">
                    Change Due (ඉතිරි මුදල)
                  </span>
                  <span className="text-lg font-black text-on-tertiary-container">
                    LKR {changeAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ) : paymentMode === 'lankaqr' ? (
            <div className="bg-surface-container-low p-4 rounded-xl flex flex-col items-center text-center gap-2">
              <div className="flex items-center gap-1.5 bg-surface-container px-3 py-1 rounded-full text-xs font-bold text-primary">
                <span className="material-symbols-outlined text-[16px] text-tertiary-container">
                  verified
                </span>
                <span>LankaQR Dynamic National Switch</span>
              </div>

              {/* LankaQR Standee SVG Matrix */}
              <div className="p-3 bg-surface-container-lowest rounded-xl shadow-xs border border-surface-container-high">
                <svg className="w-36 h-36 text-primary" fill="currentColor" viewBox="0 0 160 160">
                  <rect fill="#001428" height="40" rx="4" width="40" x="10" y="10" />
                  <rect fill="#ffffff" height="24" rx="2" width="24" x="18" y="18" />
                  <rect fill="#001428" height="12" width="12" x="24" y="24" />
                  <rect fill="#001428" height="40" rx="4" width="40" x="110" y="10" />
                  <rect fill="#ffffff" height="24" rx="2" width="24" x="118" y="18" />
                  <rect fill="#001428" height="12" width="12" x="124" y="24" />
                  <rect fill="#001428" height="40" rx="4" width="40" x="10" y="110" />
                  <rect fill="#ffffff" height="24" rx="2" width="24" x="18" y="118" />
                  <rect fill="#001428" height="12" width="12" x="24" y="124" />
                  <rect fill="#001428" height="8" width="8" x="60" y="15" />
                  <rect fill="#001428" height="8" width="8" x="75" y="15" />
                  <rect fill="#001428" height="8" width="8" x="90" y="25" />
                  <rect fill="#001428" height="8" width="16" x="60" y="35" />
                  <rect fill="#001428" height="16" width="8" x="85" y="45" />
                  <rect fill="#001428" height="16" width="8" x="15" y="60" />
                  <rect fill="#001428" height="8" width="12" x="35" y="65" />
                  <rect fill="#002e1d" height="40" rx="4" width="40" x="60" y="60" />
                  <rect fill="#85f8c4" height="20" rx="2" width="20" x="70" y="70" />
                  <rect fill="#001428" height="12" width="8" x="115" y="65" />
                  <rect fill="#001428" height="8" width="12" x="135" y="60" />
                  <rect fill="#001428" height="8" width="20" x="110" y="85" />
                  <rect fill="#001428" height="8" width="14" x="65" y="115" />
                  <rect fill="#001428" height="16" width="8" x="90" y="110" />
                  <rect fill="#001428" height="8" width="16" x="110" y="115" />
                  <rect fill="#001428" height="25" width="8" x="135" y="115" />
                  <rect fill="#001428" height="8" width="25" x="65" y="135" />
                  <rect fill="#001428" height="8" width="18" x="105" y="135" />
                </svg>
              </div>

              <span className="text-xs text-on-surface-variant font-medium">
                Customer scans with FriMi, Flash, Genie, Commercial Bank, or BOC
              </span>
              <span className="text-sm font-extrabold text-secondary">
                Amount: LKR {grandTotal.toLocaleString()}
              </span>
            </div>
          ) : (
            <div className="bg-surface-container-low p-4 rounded-xl flex flex-col items-center text-center gap-2">
              <span className="material-symbols-outlined text-[32px] text-primary">contactless</span>
              <span className="text-xs font-bold text-primary">Tap Card on Salon Wireless POS</span>
              <input
                type="text"
                placeholder="Card last 4 digits (optional)"
                maxLength={4}
                value={cardLastFour}
                onChange={(e) => setCardLastFour(e.target.value)}
                className="w-48 px-3 py-1.5 text-xs text-center rounded-lg bg-surface-container border border-surface-container-high outline-none text-primary font-mono"
              />
            </div>
          )}

          {/* Settle Action Button */}
          <button
            type="button"
            onClick={handleSettleInvoice}
            disabled={isPending || cart.length === 0}
            className="w-full min-h-[52px] rounded-xl bg-tertiary-container text-tertiary-fixed font-title-md font-bold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all hover:bg-opacity-90 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[24px]">check_circle</span>
            <span>
              {isPending
                ? 'Generating Invoice & Settling...'
                : `✓ Settle & Generate Bill (LKR ${grandTotal.toLocaleString()})`}
            </span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 8. THERMAL & DIGITAL RECEIPT POPUP MODAL                       */}
      {/* ============================================================== */}
      {isReceiptModalOpen && activeInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-sm w-full rounded-2xl p-5 shadow-2xl border border-surface-container-high flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            {/* Success Banner */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-on-tertiary-container">
                <span className="material-symbols-outlined text-[22px]">verified</span>
                <span className="font-bold text-sm">Invoice Settled &amp; Paid</span>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="text-on-surface-variant hover:text-primary"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* 80mm Printable Receipt Box */}
            <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high font-mono text-xs text-black leading-relaxed">
              <div className="text-center font-bold text-sm">THE ROYAL BLADE BARBER</div>
              <div className="text-center text-[10px]">රාජකීය බාබර් සාප්පුව • Ampitiya</div>
              <div className="text-center text-[10px]">Tel: +94 72 275 9020</div>
              <div className="border-t border-dashed border-black my-2" />

              <div className="flex justify-between">
                <span>INV:</span>
                <span className="font-bold">{activeInvoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>DATE:</span>
                <span>{new Date(activeInvoice.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>BARBER:</span>
                <span>{activeInvoice.staffName || 'Senior Stylist'}</span>
              </div>
              <div className="flex justify-between">
                <span>GUEST:</span>
                <span>{activeInvoice.customerName || 'Valued Client'}</span>
              </div>
              <div className="border-t border-dashed border-black my-2" />

              {(activeInvoice.items || []).map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="truncate max-w-[150px]">{it.itemName}</span>
                  <span>Rs. {it.total}</span>
                </div>
              ))}

              <div className="border-t border-dashed border-black my-2" />
              <div className="flex justify-between font-bold text-sm">
                <span>TOTAL:</span>
                <span>LKR {activeInvoice.grandTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>MODE:</span>
                <span>{activeInvoice.paymentMethod.toUpperCase()}</span>
              </div>

              {activeInvoice.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between text-[11px]">
                    <span>TENDERED:</span>
                    <span>Rs. {activeInvoice.cashTendered}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold">
                    <span>CHANGE:</span>
                    <span>Rs. {activeInvoice.changeAmount}</span>
                  </div>
                </>
              )}

              {/* Barcode representation */}
              <div className="text-center mt-3">
                <div className="inline-block h-8 w-44 bg-[repeating-linear-gradient(90deg,#000,#000_2px,#fff_2px,#fff_4px,#000_4px,#000_7px)]" />
                <div className="text-[9px] tracking-widest">{activeInvoice.barcodeValue}</div>
              </div>

              <div className="text-center text-[10px] mt-2 font-bold">
                ස්තූතියි! නැවත එන්න • Thank You!
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-primary/90"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>Print 80mm Slip / PDF</span>
              </button>

              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="w-full py-2.5 rounded-xl bg-tertiary-container text-tertiary-fixed font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:bg-opacity-90"
              >
                <span className="material-symbols-outlined text-[18px]">chat</span>
                <span>WhatsApp Digital Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 9. RECENT INVOICES & SEARCH SLIDE-OVER DRAWER                  */}
      {/* ============================================================== */}
      {isRecentDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3"
          onClick={() => setIsRecentDrawerOpen(false)}
        >
          <div
            className="bg-surface-container-lowest max-w-lg w-full rounded-2xl p-4 shadow-2xl border border-surface-container-high flex flex-col gap-3 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">
                  manage_search
                </span>
                <span className="font-title-md text-primary font-bold">Invoice Search &amp; History</span>
              </div>
              <button
                type="button"
                onClick={() => setIsRecentDrawerOpen(false)}
                className="text-on-surface-variant hover:text-primary"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search Invoice #, Phone, Name, or Barcode..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  loadRecentInvoices(e.target.value);
                }}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-surface-container border border-surface-container-high outline-none text-primary"
              />
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-2.5 top-2.5">
                search
              </span>
            </div>

            {/* List */}
            <div className="flex flex-col divide-y divide-surface-container-high/40 max-h-96 overflow-y-auto">
              {recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="py-2.5 flex items-center justify-between gap-2 hover:bg-surface-container/30 px-1 rounded-lg transition-colors cursor-pointer"
                  onClick={() => {
                    setActiveInvoice(inv);
                    setIsReceiptModalOpen(true);
                  }}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-xs text-primary font-mono">{inv.invoiceNumber}</span>
                    <span className="text-[11px] text-on-surface-variant truncate">
                      {inv.customerName || 'Walk-in Guest'} • {inv.customerPhone || 'No Phone'}
                    </span>
                    <span className="text-[10px] text-on-surface-variant">
                      {new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Mode: {inv.paymentMethod.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-extrabold text-xs text-secondary block">
                      Rs. {inv.grandTotal.toLocaleString()}
                    </span>
                    <span className="text-[9px] bg-tertiary-container text-tertiary-fixed font-bold px-1.5 py-0.2 rounded uppercase">
                      {inv.paymentStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

