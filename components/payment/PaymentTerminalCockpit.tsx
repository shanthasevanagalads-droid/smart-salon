'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  PaymentMethodCode,
  PaymentTransaction,
  PaymentAnalytics,
  CashDrawerShift,
  ProcessPaymentPayload,
  ProcessSplitPaymentPayload,
} from '@/types/payment';
import { PaymentService, PAYMENT_METHODS_CATALOG } from '@/lib/services/payment-service';
import { generateLankaQrPayload, generateWhatsAppReceiptUrl } from '@/lib/services/billing-service';

// Web Audio API Synthesized Payment Chime
const playSuccessChime = () => {
  if (typeof window !== 'undefined' && 'AudioContext' in window) {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }
};

interface PendingTicket {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  dstNumber: string;
  customerName: string;
  customerPhone: string;
  barberName: string;
  services: string;
  totalAmount: number;
}

const SAMPLE_PENDING_TICKETS: PendingTicket[] = [
  {
    id: 'ticket-1',
    invoiceId: '10000000-0000-0000-0000-000000000001',
    invoiceNumber: 'INV-2026-000001',
    dstNumber: 'LK-20261103-007',
    customerName: 'Kasun Perera',
    customerPhone: '+94771234567',
    barberName: 'Master Kavi (Chair 01)',
    services: 'Hair Cut + Beard Combo',
    totalAmount: 1800,
  },
  {
    id: 'ticket-2',
    invoiceId: '10000000-0000-0000-0000-000000000002',
    invoiceNumber: 'INV-2026-000002',
    dstNumber: 'LK-20261103-008',
    customerName: 'Ruwan Pradeep',
    customerPhone: '+94712345678',
    barberName: 'Sunil Shantha (Chair 02)',
    services: 'Adult Hair Cut + Head Massage',
    totalAmount: 3400,
  },
  {
    id: 'ticket-3',
    invoiceId: '10000000-0000-0000-0000-000000000003',
    invoiceNumber: 'INV-2026-000003',
    dstNumber: 'APT-20261103-0001',
    customerName: 'Dinesh Kumara',
    customerPhone: '+94761234567',
    barberName: 'Master Kavi (Chair 01)',
    services: 'Beard Trim & Lineup',
    totalAmount: 800,
  },
];

export default function PaymentTerminalCockpit() {
  const [isPending, startTransition] = useTransition();

  // Selected Service Ticket / Bill
  const [selectedTicket, setSelectedTicket] = useState<PendingTicket>(SAMPLE_PENDING_TICKETS[0]);
  const [billAmount, setBillAmount] = useState<number>(SAMPLE_PENDING_TICKETS[0].totalAmount);

  // Active Payment Method
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodCode>('cash');

  // Cash Payment States
  const [cashTendered, setCashTendered] = useState<number>(2000);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Card Payment States
  const [cardType, setCardType] = useState<'credit' | 'debit'>('credit');
  const [cardTerminalRef, setCardTerminalRef] = useState('POS-TERM-01');
  const [cardAuthCode, setCardAuthCode] = useState('AUTH-99120');
  const [cardLastFour, setCardLastFour] = useState('4242');

  // LankaQR Payment States
  const [lankaqrReference, setLankaqrReference] = useState('LKQR-REF-884192');
  const [lankaqrVerified, setLankaqrVerified] = useState(false);
  const [isQrSimulating, setIsQrSimulating] = useState(false);

  // Split Payment States
  const [splitLeg1Method, setSplitLeg1Method] = useState<PaymentMethodCode>('cash');
  const [splitLeg1Amount, setSplitLeg1Amount] = useState<number>(1000);
  const [splitLeg2Method, setSplitLeg2Method] = useState<PaymentMethodCode>('lankaqr');
  const [splitLeg2Amount, setSplitLeg2Amount] = useState<number>(800);

  // Modals & Panels
  const [completedPayment, setCompletedPayment] = useState<PaymentTransaction | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyFilterMethod, setHistoryFilterMethod] = useState('all');

  // Drawer Shift & Reconciliation
  const [countedCash, setCountedCash] = useState<number>(19800);
  const [shiftNotes, setShiftNotes] = useState('');
  const [activeShift, setActiveShift] = useState<CashDrawerShift | null>(null);

  // Analytics & History
  const [analytics, setAnalytics] = useState<PaymentAnalytics | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initial Load
  useEffect(() => {
    loadShiftAndAnalytics();
    loadTransactions();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadShiftAndAnalytics = async () => {
    try {
      const data = await PaymentService.getAnalytics();
      setAnalytics(data);
      if (data.activeCashShift) {
        setActiveShift(data.activeCashShift);
        setCountedCash(data.activeCashShift.expectedCash);
      }
    } catch (err) {
      console.warn('Error loading analytics:', err);
    }
  };

  const loadTransactions = async () => {
    try {
      const list = await PaymentService.searchPayments();
      setTransactions(list);
    } catch (err) {
      console.warn('Error loading transactions:', err);
    }
  };

  // Change Ticket
  const handleSelectTicket = (t: PendingTicket) => {
    setSelectedTicket(t);
    setBillAmount(t.totalAmount);
    setCashTendered(t.totalAmount >= 1000 ? Math.ceil(t.totalAmount / 500) * 500 : 1000);
    setSplitLeg1Amount(Math.floor(t.totalAmount / 2));
    setSplitLeg2Amount(t.totalAmount - Math.floor(t.totalAmount / 2));
    setLankaqrVerified(false);
    setLankaqrReference(`LKQR-REF-${Math.floor(100000 + Math.random() * 900000)}`);
  };

  // Calculations
  const changeDue = Math.max(0, cashTendered - billAmount);
  const isCashInsufficient = selectedMethod === 'cash' && cashTendered < billAmount;
  const splitTotal = splitLeg1Amount + splitLeg2Amount;
  const splitRemaining = billAmount - splitTotal;

  // Process Checkout
  const handleExecutePayment = async () => {
    if (selectedMethod === 'cash' && cashTendered < billAmount) {
      showToast('❌ Cash tendered is less than the bill amount!');
      return;
    }

    if (selectedMethod === 'split' && splitRemaining !== 0) {
      showToast('❌ Split allocations do not equal the bill total!');
      return;
    }

    startTransition(async () => {
      if (selectedMethod === 'split') {
        const payload: ProcessSplitPaymentPayload = {
          invoiceId: selectedTicket.invoiceId,
          dstNumber: selectedTicket.dstNumber,
          customerId: undefined,
          cashierId: 'c0000000-0000-0000-0000-000000000001',
          splits: [
            {
              method: splitLeg1Method,
              amount: splitLeg1Amount,
              cashTendered: splitLeg1Method === 'cash' ? splitLeg1Amount : undefined,
            },
            {
              method: splitLeg2Method,
              amount: splitLeg2Amount,
              cardAuthCode: splitLeg2Method.includes('card') ? cardAuthCode : undefined,
              terminalReference: splitLeg2Method.includes('card') ? cardTerminalRef : undefined,
              lankaqrReference: splitLeg2Method === 'lankaqr' ? lankaqrReference : undefined,
            },
          ],
        };

        const res = await PaymentService.processSplitPayment(payload);
        if (res.success) {
          playSuccessChime();
          showToast(`✅ Split payment settled successfully! [${res.parentReference}]`);
          loadShiftAndAnalytics();
          loadTransactions();

          setCompletedPayment({
            id: `split-${Date.now()}`,
            branchId: 'b0000000-0000-0000-0000-000000000001',
            invoiceId: selectedTicket.invoiceId,
            invoiceNumber: selectedTicket.invoiceNumber,
            dstNumber: selectedTicket.dstNumber,
            customerName: selectedTicket.customerName,
            customerPhone: selectedTicket.customerPhone,
            cashierName: selectedTicket.barberName,
            referenceNumber: res.parentReference || `SPLIT-${Date.now()}`,
            paymentMethod: 'split',
            amount: billAmount,
            status: 'paid',
            isSplit: true,
            paidTime: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
          setIsReceiptModalOpen(true);
        } else {
          showToast(`❌ Error: ${res.error || 'Failed to settle split payment'}`);
        }
        return;
      }

      // Single Tender Payment
      const payload: ProcessPaymentPayload = {
        invoiceId: selectedTicket.invoiceId,
        dstNumber: selectedTicket.dstNumber,
        customerName: selectedTicket.customerName,
        customerPhone: selectedTicket.customerPhone,
        cashierId: 'c0000000-0000-0000-0000-000000000001',
        paymentMethod: selectedMethod,
        amount: billAmount,
        cashTendered: selectedMethod === 'cash' ? cashTendered : undefined,
        cardAuthCode: selectedMethod.includes('card') ? cardAuthCode : undefined,
        terminalReference: selectedMethod.includes('card') ? cardTerminalRef : undefined,
        maskedCardNumber: selectedMethod.includes('card') ? `XXXX-XXXX-XXXX-${cardLastFour}` : undefined,
        cardType,
        lankaqrReference: selectedMethod === 'lankaqr' ? lankaqrReference : undefined,
        idempotencyKey: `IDEM-${selectedTicket.invoiceId}-${selectedMethod}-${billAmount}`,
      };

      const res = await PaymentService.processPayment(payload);

      if (res.success && res.payment) {
        playSuccessChime();
        if (selectedMethod === 'cash') {
          setIsDrawerOpen(true);
          setTimeout(() => setIsDrawerOpen(false), 2000);
        }
        setCompletedPayment(res.payment);
        setIsReceiptModalOpen(true);
        showToast(`✅ Payment of LKR ${billAmount.toLocaleString()} confirmed!`);
        loadShiftAndAnalytics();
        loadTransactions();
      } else {
        showToast(`❌ Payment Failed: ${res.error || 'Transaction rejected'}`);
      }
    });
  };

  // Simulate LankaQR Webhook
  const handleSimulateLankaQrPush = () => {
    setIsQrSimulating(true);
    setTimeout(() => {
      setIsQrSimulating(false);
      setLankaqrVerified(true);
      playSuccessChime();
      showToast('⚡ LankaQR Central Bank Confirmation Received!');
    }, 1200);
  };

  // Close Register Shift
  const handleCloseShift = async () => {
    if (!activeShift) return;
    startTransition(async () => {
      const res = await PaymentService.closeShift(activeShift.id, countedCash, shiftNotes);
      if (res.success) {
        showToast(`✅ Register Shift Closed. Discrepancy: LKR ${res.discrepancy}`);
        setIsShiftModalOpen(false);
        loadShiftAndAnalytics();
      } else {
        showToast(`❌ Failed to close shift: ${res.error}`);
      }
    });
  };

  // Void Transaction
  const handleVoidTx = async (txId: string) => {
    const reason = prompt('Please enter reason for voiding transaction:', 'Customer return / Mistake');
    if (!reason) return;
    const res = await PaymentService.voidPayment(txId, reason);
    if (res.success) {
      showToast('⚠️ Transaction voided successfully');
      loadShiftAndAnalytics();
      loadTransactions();
    } else {
      showToast(`❌ Failed: ${res.error}`);
    }
  };

  // Dynamic LankaQR Payload
  const rawQrPayload = generateLankaQrPayload({
    invoiceNumber: selectedTicket?.invoiceNumber || 'INV-2026-000001',
    amount: billAmount || 0,
    salonName: 'Smart Salon LK Ampitiya',
  });

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col font-body pb-12 selection:bg-primary/20">
      {/* ============================================================== */}
      {/* 1. TOP APP BAR & REGISTER STATUS BANNER                        */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-40 bg-surface-container-low/90 backdrop-blur-md border-b border-surface-container-high px-4 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-bold shadow-sm">
              <span className="material-symbols-outlined text-[26px]">point_of_sale</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-title-md font-bold text-primary tracking-tight">Payment Terminal</h1>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md bg-tertiary-container text-tertiary-fixed">
                  FinTech v2.0
                </span>
                {isDrawerOpen && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/20 text-emerald-600 animate-pulse flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">check_circle</span>
                    DRAWER KICK PULSE
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant">
                Smart Salon LK • Kiribathgoda / Ampitiya Main Branch
              </p>
            </div>
          </div>

          {/* Quick Actions & Navigation */}
          <div className="flex items-center gap-2">
            <Link
              href="/pos"
              className="px-3 py-1.5 rounded-xl border border-surface-container-highest hover:bg-surface-container-high text-xs font-semibold flex items-center gap-1 transition"
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              <span>Billing POS</span>
            </Link>

            <Link
              href="/queue"
              className="px-3 py-1.5 rounded-xl border border-surface-container-highest hover:bg-surface-container-high text-xs font-semibold flex items-center gap-1 transition"
            >
              <span className="material-symbols-outlined text-[16px]">hourglass_empty</span>
              <span>Live Queue</span>
            </Link>

            <Link
              href="/reports"
              className="px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold flex items-center gap-1 transition"
              title="Business Intelligence Reports"
            >
              <span className="material-symbols-outlined text-[16px]">monitoring</span>
              <span>Reports</span>
            </Link>

            <Link
              href="/notifications"
              className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1 transition"
              title="WhatsApp Notification Engine"
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
              <span>WhatsApp</span>
            </Link>

            {/* Shift Reconcile Button */}
            <button
              type="button"
              onClick={() => setIsShiftModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
              <span>
                Shift Float: LKR{' '}
                {activeShift?.expectedCash ? activeShift.expectedCash.toLocaleString() : '5,000'}
              </span>
            </button>

            {/* Transactions History Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsHistoryDrawerOpen(true)}
              className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary transition"
              title="Recent Transactions"
            >
              <span className="material-symbols-outlined text-[20px]">history</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. TOAST NOTIFICATION                                         */}
      {/* ============================================================== */}
      {toastMessage && (
        <div className="fixed top-18 right-4 z-50 bg-primary text-on-primary px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-bounce">
          <span className="material-symbols-outlined text-[20px]">verified</span>
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. MAIN COCKPIT VIEW                                          */}
      {/* ============================================================== */}
      <main className="max-w-7xl mx-auto w-full px-4 pt-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ------------------------------------------------------------ */}
        {/* LEFT COLUMN: TICKET SELECTOR & CUSTOMER DETAILS (5 cols)    */}
        {/* ------------------------------------------------------------ */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Active Ticket Selector Ribbon */}
          <div className="bg-surface-container-low rounded-3xl p-5 border border-surface-container-high/60 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">label</span>
                Digital Service Tickets (DST)
              </span>
              <span className="text-[11px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                {SAMPLE_PENDING_TICKETS.length} Pending Checkout
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {SAMPLE_PENDING_TICKETS.map((ticket) => {
                const isSelected = selectedTicket.id === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => handleSelectTicket(ticket)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary shadow-xs'
                        : 'bg-surface hover:bg-surface-container border-surface-container-highest text-on-surface'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isSelected
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        {ticket.dstNumber.split('-').pop()}
                      </div>
                      <div>
                        <div className="font-bold text-sm leading-tight">{ticket.customerName}</div>
                        <div className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                          <span>{ticket.customerPhone}</span>
                          <span>•</span>
                          <span>{ticket.barberName.split(' ')[0]}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                        LKR {ticket.totalAmount.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-on-surface-variant uppercase font-medium">
                        {ticket.invoiceNumber}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Bill Summary Card */}
          <div className="bg-surface-container-low rounded-3xl p-5 border border-surface-container-high/60 shadow-xs flex flex-col justify-between flex-1">
            <div>
              <div className="flex items-center justify-between border-b border-surface-container-high pb-3 mb-4">
                <div>
                  <span className="text-xs text-on-surface-variant font-medium">Ticket Reference</span>
                  <div className="font-title-md font-bold text-primary flex items-center gap-1.5">
                    <span>{selectedTicket.dstNumber}</span>
                    <span className="text-xs text-on-surface-variant font-normal">
                      ({selectedTicket.invoiceNumber})
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-on-surface-variant font-medium">Customer</span>
                  <div className="font-bold text-sm">{selectedTicket.customerName}</div>
                  <div className="text-xs text-on-surface-variant">{selectedTicket.customerPhone}</div>
                </div>
              </div>

              {/* Service Details */}
              <div className="bg-surface p-3.5 rounded-2xl border border-surface-container-high mb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                  Services Executed
                </span>
                <p className="text-sm font-semibold text-on-surface">{selectedTicket.services}</p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-container-high text-xs text-on-surface-variant">
                  <span>Stylist in Attendance</span>
                  <span className="font-medium text-primary">{selectedTicket.barberName}</span>
                </div>
              </div>
            </div>

            {/* Prominent Amount Due Display */}
            <div className="bg-gradient-to-br from-primary/10 via-tertiary-container/20 to-primary/5 p-4 rounded-2xl border border-primary/20 text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-primary block">
                Total Payable Amount • ගෙවිය යුතු මුදල
              </span>
              <div className="font-extrabold text-3xl text-primary mt-1">
                LKR {billAmount.toLocaleString()}
                <span className="text-sm font-normal text-on-surface-variant ml-1">.00</span>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* RIGHT COLUMN: TENDER SELECTOR & TOUCH CONTROLS (7 cols)     */}
        {/* ------------------------------------------------------------ */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Method Tabs Grid (>= 64px Touch Targets) */}
          <div className="bg-surface-container-low rounded-3xl p-5 border border-surface-container-high/60 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-3">
              Select Payment Method • ගෙවීම් ක්‍රමය තෝරන්න
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {PAYMENT_METHODS_CATALOG.map((method) => {
                const isSelected = selectedMethod === method.code;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setSelectedMethod(method.code)}
                    className={`min-h-[72px] p-3 rounded-2xl border flex flex-col items-center justify-center text-center transition-all ${
                      isSelected
                        ? 'bg-primary text-on-primary border-primary shadow-md scale-[1.02]'
                        : 'bg-surface hover:bg-surface-container-high border-surface-container-highest text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[26px] mb-1">{method.icon}</span>
                    <span className="font-bold text-xs leading-tight">{method.name}</span>
                    <span
                      className={`text-[10px] mt-0.5 line-clamp-1 ${
                        isSelected ? 'text-on-primary/80' : 'text-on-surface-variant'
                      }`}
                    >
                      {method.sinhalaName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Tender Content Card */}
          <div className="bg-surface-container-low rounded-3xl p-5 border border-surface-container-high/60 shadow-xs flex-1 flex flex-col justify-between">
            {/* -------------------------------------------------------- */}
            {/* TENDER 1: CASH PAYMENT MODE                              */}
            {/* -------------------------------------------------------- */}
            {selectedMethod === 'cash' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">payments</span>
                    Cash Drawer &amp; Currency Keypad
                  </span>
                  <span className="text-xs text-primary font-bold">LKR Sri Lankan Rupees</span>
                </div>

                {/* Preset Cash Denominations */}
                <div className="grid grid-cols-5 gap-2">
                  {[billAmount, 1000, 2000, 3000, 5000].map((amt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCashTendered(amt)}
                      className={`py-2.5 px-1 rounded-xl border text-xs font-bold transition ${
                        cashTendered === amt
                          ? 'bg-primary/20 border-primary text-primary shadow-xs'
                          : 'bg-surface border-surface-container-highest hover:bg-surface-container'
                      }`}
                    >
                      {idx === 0 ? 'Exact' : `+${amt.toLocaleString()}`}
                    </button>
                  ))}
                </div>

                {/* Tendered Input & Change Box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
                  <div className="bg-surface p-4 rounded-2xl border border-surface-container-high">
                    <label className="text-xs text-on-surface-variant font-medium block mb-1">
                      Cash Received (Tendered)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 font-bold text-sm text-on-surface-variant">
                        Rs.
                      </span>
                      <input
                        type="number"
                        step="50"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(Number(e.target.value))}
                        className="w-full pl-11 pr-3 py-2 bg-surface-container-low rounded-xl border border-surface-container-highest font-mono font-bold text-lg focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div
                    className={`p-4 rounded-2xl border flex flex-col justify-center ${
                      isCashInsufficient
                        ? 'bg-error-container/20 border-error/40 text-error'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider block">
                      {isCashInsufficient ? 'Insufficient Cash' : 'Change Due • ඉතිරි මුදල'}
                    </span>
                    <div className="font-extrabold text-2xl mt-0.5 font-mono">
                      {isCashInsufficient
                        ? `Short by LKR ${(billAmount - cashTendered).toLocaleString()}`
                        : `LKR ${changeDue.toLocaleString()}.00`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* TENDER 2: LANKAQR NATIONAL STANDARD (CBSL)               */}
            {/* -------------------------------------------------------- */}
            {selectedMethod === 'lankaqr' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                    Dynamic LankaQR Standee • EMVCo Compliant
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600 px-2 py-0.5 rounded-full bg-emerald-500/10">
                    CBSL Certified
                  </span>
                </div>

                <div className="bg-surface p-4 rounded-2xl border border-surface-container-high flex flex-col sm:flex-row items-center gap-6">
                  {/* Dynamic QR Code Visual Representation */}
                  <div className="w-36 h-36 bg-white p-2 rounded-2xl border-2 border-primary/30 flex flex-col items-center justify-center relative shadow-sm">
                    {/* LankaQR Header pill */}
                    <div className="bg-orange-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider mb-1">
                      LANKA QR
                    </div>
                    {/* Simulated SVG QR matrix */}
                    <svg viewBox="0 0 100 100" className="w-24 h-24">
                      <rect x="0" y="0" width="100" height="100" fill="#ffffff" />
                      {/* 3 Position Corners */}
                      <rect x="5" y="5" width="28" height="28" fill="#000" />
                      <rect x="9" y="9" width="20" height="20" fill="#fff" />
                      <rect x="13" y="13" width="12" height="12" fill="#000" />

                      <rect x="67" y="5" width="28" height="28" fill="#000" />
                      <rect x="71" y="9" width="20" height="20" fill="#fff" />
                      <rect x="75" y="13" width="12" height="12" fill="#000" />

                      <rect x="5" y="67" width="28" height="28" fill="#000" />
                      <rect x="9" y="71" width="20" height="20" fill="#fff" />
                      <rect x="13" y="75" width="12" height="12" fill="#000" />

                      {/* Random Data Dots */}
                      <rect x="40" y="10" width="8" height="8" fill="#000" />
                      <rect x="50" y="15" width="8" height="8" fill="#000" />
                      <rect x="40" y="30" width="8" height="8" fill="#000" />
                      <rect x="15" y="45" width="8" height="8" fill="#000" />
                      <rect x="30" y="45" width="8" height="8" fill="#000" />
                      <rect x="45" y="45" width="10" height="10" fill="#ff6b00" />
                      <rect x="60" y="45" width="8" height="8" fill="#000" />
                      <rect x="75" y="45" width="8" height="8" fill="#000" />
                      <rect x="40" y="60" width="8" height="8" fill="#000" />
                      <rect x="55" y="65" width="8" height="8" fill="#000" />
                      <rect x="70" y="70" width="8" height="8" fill="#000" />
                      <rect x="85" y="75" width="8" height="8" fill="#000" />
                    </svg>
                    <div className="text-[8px] font-mono font-bold text-gray-800">
                      LKR {billAmount.toLocaleString()}
                    </div>
                  </div>

                  {/* QR Details & Verification status */}
                  <div className="flex-1 flex flex-col gap-2 w-full">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-on-surface-variant">Merchant Reference</span>
                      <span className="font-mono font-bold text-primary">{lankaqrReference}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-on-surface-variant">Central Bank Switch</span>
                      <span className="font-semibold text-emerald-600 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        Listening for App Push
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleSimulateLankaQrPush}
                      disabled={isQrSimulating || lankaqrVerified}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        lankaqrVerified
                          ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                          : 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {lankaqrVerified ? 'task_alt' : 'bolt'}
                      </span>
                      <span>
                        {lankaqrVerified
                          ? 'Payment Verified by Switch!'
                          : isQrSimulating
                          ? 'Querying CBSL Switch...'
                          : 'Simulate Customer App Payment'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* TENDER 3: CARD PAYMENT (CREDIT / DEBIT)                  */}
            {/* -------------------------------------------------------- */}
            {(selectedMethod === 'credit_card' || selectedMethod === 'debit_card') && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">credit_card</span>
                    POS Terminal Integration • Card Settlement
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCardType('credit')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        cardType === 'credit'
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface text-on-surface-variant'
                      }`}
                    >
                      Credit
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardType('debit')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        cardType === 'debit'
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface text-on-surface-variant'
                      }`}
                    >
                      Debit
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-surface p-3 rounded-2xl border border-surface-container-high">
                    <label className="text-[11px] text-on-surface-variant font-medium block mb-1">
                      Terminal ID
                    </label>
                    <input
                      type="text"
                      value={cardTerminalRef}
                      onChange={(e) => setCardTerminalRef(e.target.value)}
                      className="w-full px-3 py-1.5 bg-surface-container-low rounded-xl border border-surface-container-highest font-mono text-sm font-bold"
                    />
                  </div>

                  <div className="bg-surface p-3 rounded-2xl border border-surface-container-high">
                    <label className="text-[11px] text-on-surface-variant font-medium block mb-1">
                      Bank Auth Code
                    </label>
                    <input
                      type="text"
                      value={cardAuthCode}
                      onChange={(e) => setCardAuthCode(e.target.value)}
                      className="w-full px-3 py-1.5 bg-surface-container-low rounded-xl border border-surface-container-highest font-mono text-sm font-bold"
                    />
                  </div>

                  <div className="bg-surface p-3 rounded-2xl border border-surface-container-high">
                    <label className="text-[11px] text-on-surface-variant font-medium block mb-1">
                      Last 4 Digits (PAN)
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={cardLastFour}
                      onChange={(e) => setCardLastFour(e.target.value)}
                      placeholder="4242"
                      className="w-full px-3 py-1.5 bg-surface-container-low rounded-xl border border-surface-container-highest font-mono text-sm font-bold text-center"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* TENDER 4: MULTI-TENDER SPLIT PAYMENT                     */}
            {/* -------------------------------------------------------- */}
            {selectedMethod === 'split' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">call_split</span>
                    Multi-Tender Allocation • මිශ්‍ර ගෙවීම්
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      splitRemaining === 0
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-amber-500/10 text-amber-700'
                    }`}
                  >
                    {splitRemaining === 0
                      ? 'Balanced (100%)'
                      : `Remaining: LKR ${splitRemaining.toLocaleString()}`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Leg 1 */}
                  <div className="bg-surface p-3.5 rounded-2xl border border-surface-container-high">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold">Tender 1</span>
                      <select
                        value={splitLeg1Method}
                        onChange={(e) => setSplitLeg1Method(e.target.value as PaymentMethodCode)}
                        className="text-xs font-bold bg-surface-container-low px-2 py-1 rounded-lg border border-surface-container-highest"
                      >
                        <option value="cash">Cash (මුදල්)</option>
                        <option value="credit_card">Credit Card</option>
                        <option value="debit_card">Debit Card</option>
                      </select>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 font-bold text-xs text-on-surface-variant">
                        Rs.
                      </span>
                      <input
                        type="number"
                        value={splitLeg1Amount}
                        onChange={(e) => setSplitLeg1Amount(Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low rounded-xl border border-surface-container-highest font-mono text-sm font-bold"
                      />
                    </div>
                  </div>

                  {/* Leg 2 */}
                  <div className="bg-surface p-3.5 rounded-2xl border border-surface-container-high">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold">Tender 2</span>
                      <select
                        value={splitLeg2Method}
                        onChange={(e) => setSplitLeg2Method(e.target.value as PaymentMethodCode)}
                        className="text-xs font-bold bg-surface-container-low px-2 py-1 rounded-lg border border-surface-container-highest"
                      >
                        <option value="lankaqr">LankaQR</option>
                        <option value="credit_card">Credit Card</option>
                        <option value="debit_card">Debit Card</option>
                        <option value="frimi">FriMi</option>
                      </select>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 font-bold text-xs text-on-surface-variant">
                        Rs.
                      </span>
                      <input
                        type="number"
                        value={splitLeg2Amount}
                        onChange={(e) => setSplitLeg2Amount(Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low rounded-xl border border-surface-container-highest font-mono text-sm font-bold"
                      />
                    </div>
                  </div>
                </div>

                {splitRemaining !== 0 && (
                  <button
                    type="button"
                    onClick={() => setSplitLeg2Amount(billAmount - splitLeg1Amount)}
                    className="self-end text-xs font-bold text-primary underline"
                  >
                    Auto-balance remaining (LKR {splitRemaining.toLocaleString()}) to Tender 2
                  </button>
                )}
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* TENDER 5: FRIMI / DIGITAL WALLETS                        */}
            {/* -------------------------------------------------------- */}
            {selectedMethod === 'frimi' && (
              <div className="flex flex-col gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  FriMi Digital Wallet Transfer
                </span>
                <div className="bg-surface p-4 rounded-2xl border border-surface-container-high flex items-center justify-between">
                  <div>
                    <span className="text-xs text-on-surface-variant">Smart Salon Merchant ID</span>
                    <div className="font-mono font-bold text-primary">FRIMI-SLK-99012</div>
                  </div>
                  <span className="text-xs font-bold text-amber-600 bg-amber-500/10 px-2 py-1 rounded-lg">
                    Prompt customer to transfer to Salon FriMi ID
                  </span>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* GIANT ACTION CHECKOUT BUTTON (Height >= 64px)             */}
            {/* -------------------------------------------------------- */}
            <div className="mt-6 pt-4 border-t border-surface-container-high">
              <button
                type="button"
                onClick={handleExecutePayment}
                disabled={isPending || isCashInsufficient || (selectedMethod === 'split' && splitRemaining !== 0)}
                className={`w-full min-h-[64px] rounded-2xl font-title-md font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-md active:scale-[0.99] ${
                  isCashInsufficient || (selectedMethod === 'split' && splitRemaining !== 0)
                    ? 'bg-surface-container-highest text-on-surface-variant cursor-not-allowed opacity-70'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                }`}
              >
                <span className="material-symbols-outlined text-[26px]">
                  {selectedMethod === 'cash' ? 'check_circle' : 'security'}
                </span>
                <span>
                  {isPending
                    ? 'RECORDING PAYMENT...'
                    : `CONFIRM & SETTLE • LKR ${billAmount.toLocaleString()}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ============================================================== */}
      {/* 4. PAYMENT RECEIPT MODAL                                      */}
      {/* ============================================================== */}
      {isReceiptModalOpen && completedPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest max-w-md w-full rounded-3xl p-6 border border-surface-container-high shadow-2xl flex flex-col gap-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <span className="material-symbols-outlined text-[32px]">task_alt</span>
              </div>
              <h2 className="font-title-lg font-extrabold text-on-surface">Payment Successful!</h2>
              <p className="text-xs text-on-surface-variant">ගෙවීම සාර්ථකව සම්පූර්ණ කරන ලදී</p>
            </div>

            <div className="bg-surface p-4 rounded-2xl border border-surface-container-high space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Transaction Ref:</span>
                <span className="font-mono font-bold">{completedPayment.referenceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Invoice Number:</span>
                <span className="font-semibold">{completedPayment.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Service Ticket:</span>
                <span className="font-semibold text-primary">{completedPayment.dstNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Customer:</span>
                <span className="font-semibold">{completedPayment.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Payment Tender:</span>
                <span className="font-bold uppercase text-primary">{completedPayment.paymentMethod}</span>
              </div>
              <div className="flex justify-between border-t border-surface-container-high pt-2 font-bold text-sm">
                <span>Amount Settled:</span>
                <span className="text-emerald-600">LKR {completedPayment.amount.toLocaleString()}</span>
              </div>
              {completedPayment.changeDue && completedPayment.changeDue > 0 && (
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>Change Given:</span>
                  <span>LKR {completedPayment.changeDue.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Receipt Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/api/billing/${completedPayment.invoiceId}/thermal`}
                target="_blank"
                className="py-3 px-4 rounded-xl border border-surface-container-highest hover:bg-surface-container-high text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>80mm Thermal</span>
              </Link>

              {completedPayment.customerPhone && (
                <a
                  href={generateWhatsAppReceiptUrl({
                    invoiceNumber: completedPayment.invoiceNumber || 'INV',
                    customerPhone: completedPayment.customerPhone,
                    customerName: completedPayment.customerName || 'Customer',
                    grandTotal: completedPayment.amount,
                    items: [
                      {
                        id: 'item-1',
                        invoiceId: completedPayment.invoiceId,
                        itemName: selectedTicket.services,
                        name: selectedTicket.services,
                        unitPrice: completedPayment.amount,
                        quantity: 1,
                        discount: 0,
                        total: completedPayment.amount,
                        lineTotal: completedPayment.amount,
                      },
                    ],
                    createdAt: completedPayment.createdAt,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  <span>WhatsApp Receipt</span>
                </a>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsReceiptModalOpen(false);
                setCompletedPayment(null);
              }}
              className="w-full py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs font-bold transition"
            >
              Close &amp; Next Customer
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. CASH DRAWER SHIFT RECONCILIATION MODAL                      */}
      {/* ============================================================== */}
      {isShiftModalOpen && activeShift && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-3xl p-6 border border-surface-container-high shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">point_of_sale</span>
                <h3 className="font-title-md font-bold text-on-surface">End of Day Cash Reconciliation</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(false)}
                className="p-1 rounded-lg hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="bg-surface p-4 rounded-2xl border border-surface-container-high space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Shift Reference:</span>
                <span className="font-mono font-bold">{activeShift.shiftCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Register Stylist / Cashier:</span>
                <span className="font-semibold">{activeShift.staffName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Starting Drawer Float:</span>
                <span className="font-semibold">LKR {activeShift.startingFloat.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Cash Sales Collected:</span>
                <span className="font-semibold text-emerald-600">
                  +LKR {activeShift.cashSales.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t border-surface-container-high pt-2 font-bold text-sm">
                <span>System Expected Cash:</span>
                <span className="text-primary">LKR {activeShift.expectedCash.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-on-surface block mb-1">
                  Counted Physical Cash in Drawer (LKR)
                </label>
                <input
                  type="number"
                  value={countedCash}
                  onChange={(e) => setCountedCash(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-xl border border-surface-container-highest font-mono font-bold text-base focus:outline-none focus:border-primary"
                />
              </div>

              {/* Discrepancy Preview */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                  countedCash === activeShift.expectedCash
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                    : countedCash > activeShift.expectedCash
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-600'
                    : 'bg-error-container/20 border-error/40 text-error'
                }`}
              >
                <span>Reconciliation Discrepancy:</span>
                <span>
                  {countedCash === activeShift.expectedCash
                    ? '✓ PERFECT BALANCE (LKR 0.00)'
                    : countedCash > activeShift.expectedCash
                    ? `+ OVERAGE: LKR ${(countedCash - activeShift.expectedCash).toLocaleString()}`
                    : `- SHORTAGE: LKR ${(activeShift.expectedCash - countedCash).toLocaleString()}`}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface block mb-1">
                  Reconciliation Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="e.g. End of morning shift balanced by Master Kavi"
                  className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-surface-container-highest text-xs focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-surface-container-highest text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCloseShift}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-xs font-bold transition"
              >
                {isPending ? 'Closing Shift...' : 'Close & Audit Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. RECENT TRANSACTIONS DRAWER                                 */}
      {/* ============================================================== */}
      {isHistoryDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="bg-surface-container-lowest w-full max-w-md h-full p-5 flex flex-col gap-4 shadow-2xl border-l border-surface-container-high">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">history</span>
                <h3 className="font-title-md font-bold">Recent Payments</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="p-1 rounded-lg hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Search Input */}
            <input
              type="text"
              placeholder="Search by ref, phone, name..."
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-surface-container-highest text-xs"
            />

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {transactions
                .filter((tx) => {
                  if (historyFilterMethod !== 'all' && tx.paymentMethod !== historyFilterMethod)
                    return false;
                  if (historySearchQuery) {
                    const q = historySearchQuery.toLowerCase();
                    return (
                      tx.referenceNumber.toLowerCase().includes(q) ||
                      tx.dstNumber?.toLowerCase().includes(q) ||
                      tx.customerName?.toLowerCase().includes(q) ||
                      tx.customerPhone?.toLowerCase().includes(q)
                    );
                  }
                  return true;
                })
                .map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 bg-surface rounded-2xl border border-surface-container-high text-xs flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-primary">{tx.referenceNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          tx.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-error-container/20 text-error'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>

                    <div className="flex justify-between text-on-surface-variant">
                      <span>{tx.customerName || 'Walk-in'} • {tx.paymentMethod.toUpperCase()}</span>
                      <span className="font-bold text-on-surface">
                        LKR {tx.amount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1 border-t border-surface-container-high/40">
                      <span>{tx.dstNumber || 'Token #'}</span>
                      {tx.status === 'paid' && (
                        <button
                          type="button"
                          onClick={() => handleVoidTx(tx.id)}
                          className="text-error font-semibold hover:underline"
                        >
                          Void Payment
                        </button>
                      )}
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

