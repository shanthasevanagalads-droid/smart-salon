'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { QueueTicketItem, LiveQueueDashboard, QueuePriority } from '@/types/queue';
import { QueueService, playSalonChime } from '@/lib/services/queue-service';

export default function OwnerQueueManager() {
  const [dashboard, setDashboard] = useState<LiveQueueDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isWalkinModalOpen, setIsWalkinModalOpen] = useState(false);

  // Walk-in Quick Form State
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinService, setWalkinService] = useState('adult-cut');
  const [walkinPriority, setWalkinPriority] = useState<QueuePriority>('normal');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load Dashboard and Subscribe to Realtime
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      setIsLoading(true);
      const data = await QueueService.getLiveQueueDashboard();
      setDashboard(data);
      setIsLoading(false);

      unsubscribe = QueueService.subscribeToLiveQueue(undefined, (updatedDashboard) => {
        setDashboard(updatedDashboard);
      });
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Station Actions: Call Next
  const handleCallNext = async (chairNumber: number) => {
    try {
      const res = await QueueService.callNextCustomer(chairNumber);
      showToast(res.message);
      const data = await QueueService.getLiveQueueDashboard();
      setDashboard(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to call next customer');
    }
  };

  // Station Actions: Start Service
  const handleStartService = async (queueId: string) => {
    try {
      const res = await QueueService.startService(queueId);
      showToast(res.message);
      const data = await QueueService.getLiveQueueDashboard();
      setDashboard(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to start service');
    }
  };

  // Station Actions: Complete Service & Bill
  const handleCompleteService = async (queueId: string) => {
    try {
      const res = await QueueService.completeService(queueId);
      showToast(res.message);
      const data = await QueueService.getLiveQueueDashboard();
      setDashboard(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to complete service');
    }
  };

  // Station Actions: Revert/Undo
  const handleRevert = async (queueId: string) => {
    if (!window.confirm('Revert customer back to the waiting queue?')) return;
    try {
      const res = await QueueService.revertCustomer(queueId);
      showToast(res.message);
      const data = await QueueService.getLiveQueueDashboard();
      setDashboard(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to revert customer');
    }
  };

  // Waiting List Actions: Skip Customer
  const handleSkip = async (ticket: QueueTicketItem) => {
    const reason = window.prompt(
      `Mark Token #${ticket.queueNumber} (${ticket.customerName}) as absent / skipped?\nEnter reason:`,
      'Absent when called'
    );
    if (!reason) return;

    try {
      const res = await QueueService.skipCustomer(ticket.id, reason, 10);
      showToast(res.message);
      const data = await QueueService.getLiveQueueDashboard();
      setDashboard(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to skip customer');
    }
  };

  // Priority Change
  const handlePriorityChange = async (ticket: QueueTicketItem, newPriority: QueuePriority) => {
    try {
      const res = await QueueService.setPriority(ticket.id, newPriority);
      showToast(res.message);
      const data = await QueueService.getLiveQueueDashboard();
      setDashboard(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to change priority');
    }
  };

  // Submit Quick Walk-in
  const handleAddWalkinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await QueueService.enqueueCustomer({
        queueType: 'walk_in',
        customerName: walkinName.trim() || 'Walk-in Guest',
        customerPhone: walkinPhone.trim() || undefined,
        serviceId: walkinService,
        priority: walkinPriority,
      });

      showToast(res.message);
      setIsWalkinModalOpen(false);
      setWalkinName('');
      setWalkinPhone('');
      const data = await QueueService.getLiveQueueDashboard();
      setDashboard(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to add walk-in customer');
    }
  };

  return (
    <div className="flex flex-col w-full pb-28 pt-20 px-3 sm:px-6 max-w-7xl mx-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-4 left-4 sm:left-auto z-50 px-4 py-3 rounded-2xl bg-primary text-on-primary font-bold text-xs shadow-xl flex items-center gap-2 animate-bounce border border-surface-container-high">
          <span className="material-symbols-outlined text-[18px]">verified</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Breadcrumb Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/owner-pos"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
            >
              <span className="material-symbols-outlined text-[14px]">arrow_back</span>
              <span>Back to POS</span>
            </Link>
            <span className="text-on-surface-variant text-xs">•</span>
            <span className="text-xs font-semibold text-on-surface-variant">
              Kiribathgoda / Ampitiya Main Station
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary flex items-center gap-2">
            <span>Live Queue Operator Cockpit</span>
            <span className="text-sm font-normal text-on-surface-variant">
              (පෝලිම් පාලක පුවරුව)
            </span>
          </h1>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsWalkinModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary/90 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            <span>+ Add Walk-in</span>
          </button>
          <button
            type="button"
            onClick={() => playSalonChime('call')}
            className="p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary border border-surface-container-high"
            title="Test Salon Chime"
          >
            <span className="material-symbols-outlined text-[20px]">volume_up</span>
          </button>
        </div>
      </div>

      {/* Realtime Live Pulse Banner */}
      <div className="flex items-center justify-between bg-surface-container-low px-4 py-2.5 rounded-2xl shadow-xs border border-surface-container-high/60 mb-5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Realtime WebSocket Engine Active
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold text-on-surface-variant">
          <span>Avg Wait: ~{dashboard?.summary.avgWaitMinutes || 0}m</span>
          <span>•</span>
          <span>Walk-ins: {dashboard?.summary.walkInCount || 0}</span>
          <span>•</span>
          <span>Apts: {dashboard?.summary.appointmentCount || 0}</span>
        </div>
      </div>

      {/* DUAL CHAIR OPERATOR STATIONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* CHAIR 1 STATION (MASTER KAVI) */}
        <StationCockpitCard
          chairNumber={1}
          barberName="Master Kavi (Kavindu Perera)"
          activeTicket={dashboard?.chair1Active || null}
          onCallNext={() => handleCallNext(1)}
          onStartService={handleStartService}
          onCompleteService={handleCompleteService}
          onRevert={handleRevert}
        />

        {/* CHAIR 2 STATION (SUNIL SHANTHA) */}
        <StationCockpitCard
          chairNumber={2}
          barberName="Sunil Shantha"
          activeTicket={dashboard?.chair2Active || null}
          onCallNext={() => handleCallNext(2)}
          onStartService={handleStartService}
          onCompleteService={handleCompleteService}
          onRevert={handleRevert}
        />
      </div>

      {/* NEXT IN LINE & LIVE WAITING LIST */}
      <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high/60 shadow-sm p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container-high pb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">hourglass_top</span>
            </span>
            <div>
              <h2 className="text-base font-extrabold text-primary">
                Live Waiting List ({dashboard?.waitingList.length || 0} Customers)
              </h2>
              <p className="text-xs text-on-surface-variant">
                Intelligently merged appointment and walk-in queue with owner priority overrides.
              </p>
            </div>
          </div>

          {/* Quick Counter Badges */}
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant">
              Served Today: {dashboard?.summary.totalServedToday || 0}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              Skipped: {dashboard?.summary.skippedCount || 0}
            </span>
          </div>
        </div>

        {/* Empty state or Waiting List Table */}
        {dashboard?.waitingList.length === 0 ? (
          <div className="py-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[44px] text-surface-container-highest mb-1">
              done_all
            </span>
            <p className="text-sm font-bold text-primary">All caught up! No customers waiting.</p>
            <p className="text-xs text-on-surface-variant">
              Generate a walk-in ticket or wait for the next scheduled appointment check-in.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {dashboard?.waitingList.map((ticket, idx) => (
              <div
                key={ticket.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high hover:border-primary/40 transition-colors"
              >
                {/* Left: Token Number, Name, Service */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-primary text-on-primary font-mono font-black text-base flex flex-col items-center justify-center shrink-0 shadow-xs">
                    <span className="text-[9px] uppercase tracking-wider opacity-75">TOKEN</span>
                    <span>#{ticket.queueNumber}</span>
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-primary truncate">
                        {ticket.customerName}
                      </span>
                      {ticket.priority === 'emergency' && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-rose-600 text-white uppercase animate-pulse">
                          EMERGENCY
                        </span>
                      )}
                      {ticket.priority === 'vip' && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-500 text-white uppercase">
                          VIP
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container-highest text-on-surface-variant uppercase">
                        {ticket.queueType}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <span className="font-medium text-primary">{ticket.serviceName}</span>
                      <span>•</span>
                      <span className="font-mono text-secondary font-bold">
                        LKR {ticket.servicePriceLkr.toLocaleString()}
                      </span>
                      <span>•</span>
                      <span className="text-[11px] font-semibold text-emerald-600">
                        ~{ticket.estimatedWaitingTime}m wait
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Quick Action Controls */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {/* Call to Chair 1 */}
                  <button
                    type="button"
                    onClick={() => handleCallNext(1)}
                    className="px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all shadow-xs flex items-center gap-1"
                    title="Call directly to Chair 01"
                  >
                    <span className="material-symbols-outlined text-[15px]">call</span>
                    <span>Ch 1</span>
                  </button>

                  {/* Call to Chair 2 */}
                  <button
                    type="button"
                    onClick={() => handleCallNext(2)}
                    className="px-3 py-1.5 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary/90 transition-all shadow-xs flex items-center gap-1"
                    title="Call directly to Chair 02"
                  >
                    <span className="material-symbols-outlined text-[15px]">call</span>
                    <span>Ch 2</span>
                  </button>

                  {/* Priority Bump Dropdown */}
                  <select
                    value={ticket.priority}
                    onChange={(e) =>
                      handlePriorityChange(ticket, e.target.value as QueuePriority)
                    }
                    className="px-2 py-1.5 rounded-xl border border-surface-container-high bg-surface text-xs font-bold text-primary focus:outline-none"
                    title="Adjust Priority"
                  >
                    <option value="normal">Normal</option>
                    <option value="priority">Priority</option>
                    <option value="vip">VIP</option>
                    <option value="emergency">Emergency</option>
                  </select>

                  {/* Skip */}
                  <button
                    type="button"
                    onClick={() => handleSkip(ticket)}
                    className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200"
                    title="Skip Customer"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_off</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QUICK ADD WALK-IN MODAL */}
      {isWalkinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high w-full max-w-md shadow-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div>
                <h3 className="text-base font-extrabold text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[20px]">person_add</span>
                  <span>Instant Walk-in Registration</span>
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Generate ticket code and merge into live queue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWalkinModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddWalkinSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  Customer / Guest Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kasun (or leave default 'Walk-in Guest')"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  Mobile Number (Optional for SMS / WhatsApp chime)
                </label>
                <input
                  type="tel"
                  placeholder="07X XXX XXXX"
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface text-xs font-mono font-bold text-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  Select Grooming Service
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'adult-cut', name: 'Adult Hair Cut', price: 1200 },
                    { id: 'cut-beard', name: 'Hair Cut + Beard', price: 1800 },
                    { id: 'beard-trim', name: 'Beard Trim & Sculpt', price: 800 },
                    { id: 'hair-dye', name: 'Hair Dye & Black Wash', price: 2200 },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setWalkinService(s.id)}
                      className={`p-2 rounded-xl border text-left text-xs transition-all ${
                        walkinService === s.id
                          ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                          : 'bg-surface border-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      <p className="font-bold">{s.name}</p>
                      <p className="text-[10px] text-secondary font-mono">LKR {s.price}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">
                  Queue Priority
                </label>
                <select
                  value={walkinPriority}
                  onChange={(e) => setWalkinPriority(e.target.value as QueuePriority)}
                  className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface text-xs font-bold text-primary focus:outline-none"
                >
                  <option value="normal">Normal Walk-in</option>
                  <option value="priority">Priority (Elder / Child)</option>
                  <option value="vip">VIP Guest</option>
                  <option value="emergency">Emergency / Fast-Track</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setIsWalkinModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface-variant"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:bg-primary/90"
                >
                  Issue Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// SUB-COMPONENT: DUAL-CHAIR OPERATOR COCKPIT CARD
// -------------------------------------------------------------
interface StationCockpitCardProps {
  chairNumber: number;
  barberName: string;
  activeTicket: QueueTicketItem | null;
  onCallNext: () => void;
  onStartService: (queueId: string) => void;
  onCompleteService: (queueId: string) => void;
  onRevert: (queueId: string) => void;
}

function StationCockpitCard({
  chairNumber,
  barberName,
  activeTicket,
  onCallNext,
  onStartService,
  onCompleteService,
  onRevert,
}: StationCockpitCardProps) {
  const isOccupied = activeTicket !== null;
  const isInService = activeTicket?.status === 'in_service';
  const isCalled = activeTicket?.status === 'called';

  return (
    <div className="bg-surface-container-lowest rounded-3xl border-2 border-surface-container-high p-5 shadow-sm flex flex-col justify-between gap-4">
      {/* Header: Chair & Stylist */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shadow-xs ${
              chairNumber === 1
                ? 'bg-primary text-on-primary'
                : 'bg-secondary text-on-secondary'
            }`}
          >
            0{chairNumber}
          </div>
          <div>
            <h3 className="font-extrabold text-primary text-base">Chair 0{chairNumber}</h3>
            <p className="text-xs text-on-surface-variant font-medium">{barberName}</p>
          </div>
        </div>

        {/* Live Status Pill */}
        <span
          className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 border ${
            isInService
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300'
              : isCalled
              ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-300'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isInService ? 'bg-emerald-500 animate-ping' : isCalled ? 'bg-amber-500' : 'bg-slate-400'
            }`}
          />
          <span>{isInService ? 'In Service' : isCalled ? 'Called (Entering)' : 'Station Free'}</span>
        </span>
      </div>

      {/* Hero Display: Active Ticket in Station */}
      {isOccupied && activeTicket ? (
        <div className="bg-surface-container-low rounded-2xl p-4 border border-surface-container-high flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-primary font-mono tracking-tight">
              #{activeTicket.queueNumber}
            </span>
            <span className="text-xs font-bold text-on-surface-variant font-mono">
              {activeTicket.ticketCode}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold text-primary truncate">
              {activeTicket.customerName}
            </p>
            <span className="text-xs font-extrabold text-secondary font-mono">
              LKR {activeTicket.servicePriceLkr.toLocaleString()}
            </span>
          </div>

          <p className="text-xs text-on-surface-variant">{activeTicket.serviceName}</p>
        </div>
      ) : (
        <div className="bg-surface-container-low/50 rounded-2xl p-6 border border-dashed border-surface-container-high text-center text-on-surface-variant flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-[36px] text-surface-container-highest mb-1">
            airline_seat_recline_normal
          </span>
          <p className="text-xs font-bold">Chair 0{chairNumber} is ready for next customer</p>
        </div>
      )}

      {/* Large Mobile/Tablet Touch Buttons (48px+ targets) */}
      <div className="flex flex-col gap-2 pt-2">
        {!isOccupied ? (
          <button
            type="button"
            onClick={onCallNext}
            className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-primary text-on-primary font-extrabold text-sm shadow-md hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">campaign</span>
            <span>CALL NEXT CUSTOMER (කැඳවන්න)</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {isCalled && (
              <button
                type="button"
                onClick={() => onStartService(activeTicket.id)}
                className="min-h-[48px] px-3 py-2.5 rounded-2xl bg-emerald-600 text-white font-extrabold text-xs shadow-md hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                <span>START SERVICE</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onCompleteService(activeTicket.id)}
              className="min-h-[48px] px-3 py-2.5 rounded-2xl bg-secondary text-on-secondary font-extrabold text-xs shadow-md hover:bg-secondary/90 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              <span>COMPLETE &amp; BILL</span>
            </button>

            <button
              type="button"
              onClick={() => onRevert(activeTicket.id)}
              className="min-h-[44px] px-3 py-2 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold text-xs flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">undo</span>
              <span>Revert to Waiting</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

