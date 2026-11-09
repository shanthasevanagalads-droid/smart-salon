'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { QueueTicketItem, LiveQueueDashboard } from '@/types/queue';
import { QueueService, playSalonChime } from '@/lib/services/queue-service';

interface CustomerQueueLiveViewProps {
  initialTicketCode?: string;
  onCancelTicket?: () => void;
}

export default function CustomerQueueLiveView({
  initialTicketCode = 'LK-20261102-010',
  onCancelTicket,
}: CustomerQueueLiveViewProps) {
  const [dashboard, setDashboard] = useState<LiveQueueDashboard | null>(null);
  const [myTicket, setMyTicket] = useState<QueueTicketItem | null>(null);
  const [searchTicketCode, setSearchTicketCode] = useState(initialTicketCode);
  const [isGracePeriodAdded, setIsGracePeriodAdded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isFullBoardOpen, setIsFullBoardOpen] = useState(false);
  const [lastCalledAlert, setLastCalledAlert] = useState<string | null>(null);

  // Load initial board & subscribe to realtime changes
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      const data = await QueueService.getLiveQueueDashboard();
      setDashboard(data);

      const ticket = await QueueService.getTicketByCode(searchTicketCode);
      if (ticket) setMyTicket(ticket);

      // Subscribe to live realtime updates
      unsubscribe = QueueService.subscribeToLiveQueue(undefined, (updatedDashboard) => {
        setDashboard(updatedDashboard);

        // Check if my ticket status changed
        if (myTicket) {
          const updatedTicket = [
            updatedDashboard.chair1Active,
            updatedDashboard.chair2Active,
            ...updatedDashboard.waitingList,
          ].find((t) => t?.id === myTicket.id || t?.ticketCode === myTicket.ticketCode);

          if (updatedTicket) {
            if (updatedTicket.status === 'called' && myTicket.status !== 'called') {
              playSalonChime('call');
              setLastCalledAlert(
                `🎉 It's your turn! Please proceed to Chair 0${updatedTicket.chairNumber} (${updatedTicket.staffName || 'Your Barber'}).`
              );
            }
            setMyTicket(updatedTicket);
          }
        }
      });
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [searchTicketCode]);

  // Handle Search for different token
  const handleSearchTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTicketCode.trim()) return;

    const t = await QueueService.getTicketByCode(searchTicketCode);
    if (t) {
      setMyTicket(t);
      setToastMessage(`Tracking Token #${t.queueNumber} (${t.ticketCode})`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } else {
      setToastMessage(`Ticket ${searchTicketCode} not found.`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  // Handle Grace Period (+10 mins late)
  const handleRunningLate = async () => {
    if (!myTicket) return;
    try {
      const res = await QueueService.addGracePeriod(myTicket.id, 10);
      setIsGracePeriodAdded(true);
      setMyTicket((prev) => (prev ? { ...prev, estimatedWaitingTime: res.newWaitTime } : null));
      setToastMessage(res.message);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Calculate customers ahead
  const customersAhead = myTicket && dashboard
    ? dashboard.waitingList.filter((t) => t.queueNumber < myTicket.queueNumber).length
    : 0;

  return (
    <div className="flex flex-col w-full pb-28 pt-20 px-4 max-w-lg mx-auto">
      {/* Toast Alert */}
      {showToast && (
        <div className="fixed top-20 right-4 left-4 sm:left-auto z-50 px-4 py-3 rounded-2xl bg-primary text-on-primary font-bold text-xs shadow-xl flex items-center gap-2 animate-bounce border border-surface-container-high">
          <span className="material-symbols-outlined text-[18px]">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Called Banner Alert (Big Audio-Visual Announcement) */}
      {lastCalledAlert && (
        <div className="mb-4 p-4 rounded-3xl bg-amber-400 text-amber-950 shadow-2xl border-2 border-amber-500 animate-pulse flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[32px]">campaign</span>
            <div>
              <p className="font-extrabold text-sm uppercase tracking-wider">NOW CALLING YOU!</p>
              <p className="text-xs font-semibold">{lastCalledAlert}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLastCalledAlert(null)}
            className="p-1.5 rounded-full bg-amber-500/40 hover:bg-amber-500 text-amber-950 font-bold"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Live Operational Status Banner */}
      <div className="flex items-center justify-between bg-surface-container-low px-4 py-2.5 rounded-2xl shadow-xs border border-surface-container-high/60 mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Live Queue • සජීවී පෝලිම
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-on-surface-variant text-[11px] font-semibold">
          <span className="material-symbols-outlined text-[15px] text-secondary animate-spin">sync</span>
          <span>Realtime Sync</span>
        </div>
      </div>

      {/* DUAL-CHAIR NOW SERVING HERO */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Chair 1 Station */}
        <div className="bg-surface-container-lowest rounded-2xl p-3.5 border-2 border-primary/20 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
              Chair 01
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <p className="text-xs font-bold text-on-surface-variant truncate">
            {dashboard?.chair1Active?.staffName || 'Master Kavi'}
          </p>
          <div className="my-1 flex items-baseline gap-1">
            <span className="text-3xl font-black text-primary font-mono tracking-tight">
              {dashboard?.chair1Active ? `#${dashboard.chair1Active.queueNumber}` : 'FREE'}
            </span>
            {dashboard?.chair1Active && (
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Serving</span>
            )}
          </div>
          <p className="text-[11px] text-on-surface-variant truncate">
            {dashboard?.chair1Active?.customerName || 'Chair Open'}
          </p>
        </div>

        {/* Chair 2 Station */}
        <div className="bg-surface-container-lowest rounded-2xl p-3.5 border-2 border-secondary/20 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-secondary">
              Chair 02
            </span>
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          </div>
          <p className="text-xs font-bold text-on-surface-variant truncate">
            {dashboard?.chair2Active?.staffName || 'Sunil Shantha'}
          </p>
          <div className="my-1 flex items-baseline gap-1">
            <span className="text-3xl font-black text-secondary font-mono tracking-tight">
              {dashboard?.chair2Active ? `#${dashboard.chair2Active.queueNumber}` : 'FREE'}
            </span>
            {dashboard?.chair2Active && (
              <span className="text-[10px] font-bold text-blue-600 uppercase">Serving</span>
            )}
          </div>
          <p className="text-[11px] text-on-surface-variant truncate">
            {dashboard?.chair2Active?.customerName || 'Chair Open'}
          </p>
        </div>
      </div>

      {/* MY TICKET CARD */}
      {myTicket ? (
        <div className="bg-primary text-on-primary rounded-3xl p-5 shadow-xl flex flex-col gap-4 relative overflow-hidden mb-4 border border-primary-container">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-on-primary/70">
                ඔබගේ ටෝකන් අංකය
              </span>
              <h2 className="text-sm font-extrabold text-white">YOUR QUEUE TICKET</h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-white/20 text-white uppercase tracking-wider">
              {myTicket.queueType === 'appointment' ? 'Appointment' : 'Walk-in'}
            </span>
          </div>

          {/* Big Number & Ticket Code */}
          <div className="flex items-baseline justify-between py-1 border-y border-white/15">
            <div>
              <span className="text-5xl font-black tracking-tighter text-white font-mono">
                #{myTicket.queueNumber}
              </span>
              <p className="text-xs text-white/75 font-mono">{myTicket.ticketCode}</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[11px] text-white/70">Status</span>
              <span className="text-sm font-extrabold text-amber-300 uppercase tracking-wide">
                {myTicket.status === 'in_service'
                  ? 'IN CHAIR NOW'
                  : myTicket.status === 'called'
                  ? 'CALLED - PLEASE ENTER'
                  : 'WAITING IN LINE'}
              </span>
            </div>
          </div>

          {/* Real-time Wait Metrics */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-white/10 rounded-2xl p-2.5 backdrop-blur-xs">
              <span className="text-[11px] text-white/75 block">Customers Ahead</span>
              <span className="text-2xl font-black text-white">{customersAhead}</span>
              <span className="text-[10px] text-white/60 block">ඉදිරියෙන් සිටින පිරිස</span>
            </div>
            <div className="bg-white/10 rounded-2xl p-2.5 backdrop-blur-xs">
              <span className="text-[11px] text-white/75 block">Est. Waiting Time</span>
              <span className="text-2xl font-black text-amber-300">
                ~{myTicket.estimatedWaitingTime}m
              </span>
              <span className="text-[10px] text-white/60 block">දළ වශයෙන් රැඳීසිටින වේලාව</span>
            </div>
          </div>

          {/* Customer & Service Info */}
          <div className="flex items-center justify-between text-xs text-white/90 pt-1">
            <div className="flex flex-col">
              <span className="text-white/60 text-[10px]">Customer</span>
              <span className="font-bold">{myTicket.customerName}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-white/60 text-[10px]">Service</span>
              <span className="font-bold text-amber-200">{myTicket.serviceName}</span>
            </div>
          </div>

          {/* Action Buttons: Running Late + Cancel */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/15">
            <button
              type="button"
              disabled={isGracePeriodAdded || myTicket.status !== 'waiting'}
              onClick={handleRunningLate}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                isGracePeriodAdded
                  ? 'bg-white/20 text-white/60 cursor-not-allowed'
                  : 'bg-white text-primary hover:bg-white/90 active:scale-95 shadow-md'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">more_time</span>
              <span>{isGracePeriodAdded ? '+10m Grace Added' : "I'm 10 Mins Late"}</span>
            </button>

            {onCancelTicket && (
              <button
                type="button"
                onClick={onCancelTicket}
                className="px-3 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-3xl p-5 border border-surface-container-high shadow-sm text-center mb-4">
          <span className="material-symbols-outlined text-[36px] text-primary mb-1">
            confirmation_number
          </span>
          <p className="text-sm font-bold text-primary">Do you have a Queue Token?</p>
          <p className="text-xs text-on-surface-variant mb-3">
            Enter your token code (e.g. LK-20261102-010) to track your live queue position.
          </p>
          <form onSubmit={handleSearchTicket} className="flex gap-2">
            <input
              type="text"
              placeholder="Enter Token Code..."
              value={searchTicketCode}
              onChange={(e) => setSearchTicketCode(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-surface-container-high bg-surface text-xs font-mono font-bold text-primary focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-xs"
            >
              Track
            </button>
          </form>
        </div>
      )}

      {/* Toggle View: Full Waiting List */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">format_list_numbered</span>
            <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider">
              Waiting Board ({dashboard?.waitingList.length || 0} in line)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsFullBoardOpen(!isFullBoardOpen)}
            className="text-xs text-secondary font-bold hover:underline"
          >
            {isFullBoardOpen ? 'Hide Board' : 'View Full Board'}
          </button>
        </div>

        {isFullBoardOpen && (
          <div className="flex flex-col gap-2 mt-3 max-h-64 overflow-y-auto pr-1">
            {dashboard?.waitingList.map((ticket, idx) => (
              <div
                key={ticket.id}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                  myTicket?.id === ticket.id
                    ? 'bg-primary/10 border-primary font-bold'
                    : 'bg-surface border-surface-container-high/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-surface-container text-primary font-bold flex items-center justify-center font-mono">
                    #{ticket.queueNumber}
                  </span>
                  <div>
                    <p className="font-bold text-primary truncate max-w-[140px]">
                      {ticket.customerName}
                    </p>
                    <p className="text-[10px] text-on-surface-variant">
                      {ticket.serviceName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {ticket.priority === 'vip' && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-500 text-white uppercase">
                      VIP
                    </span>
                  )}
                  {ticket.priority === 'emergency' && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-rose-600 text-white uppercase">
                      EMERGENCY
                    </span>
                  )}
                  <span className="text-[11px] font-mono font-bold text-secondary">
                    ~{ticket.estimatedWaitingTime}m
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Shortcuts */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/"
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-primary transition-colors text-center"
        >
          <span className="material-symbols-outlined text-[16px]">add_circle</span>
          <span>Book New Seat</span>
        </Link>
        <Link
          href="/owner-pos"
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-primary transition-colors text-center"
        >
          <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
          <span>Owner / POS Cockpit</span>
        </Link>
      </div>
    </div>
  );
}

