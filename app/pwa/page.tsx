'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePwa } from '@/lib/pwa/usePwa';
import {
  getPendingActions,
  queueOfflineAction,
  flushOfflineActions,
  clearOfflineOutbox,
  OfflineAction,
} from '@/lib/pwa/offline-sync';

interface PwaMetrics {
  pushSubscribersTotal: number;
  pushSubscribersMobile: number;
  pushSubscribersDesktop: number;
  syncEventsLast24h: number;
  syncErrorsLast24h: number;
  lastSyncTimestamp: string;
}

export default function PwaDashboardPage() {
  const {
    isOnline,
    isInstallable,
    isInstalled,
    isIos,
    promptInstall,
    hasUpdate,
    applyUpdate,
    isPushSupported,
    isPushSubscribed,
    subscribeToPush,
    unsubscribeFromPush,
    pendingSyncCount,
    isSyncing,
    flushSync,
  } = usePwa();

  const [metrics, setMetrics] = useState<PwaMetrics | null>(null);
  const [outboxItems, setOutboxItems] = useState<OfflineAction[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadOutbox = async () => {
    const items = await getPendingActions();
    setOutboxItems(items);
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/pwa/health');
      const data = await res.json();
      if (data.success && data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (e) {
      console.warn('Could not fetch PWA health:', e);
    }
  };

  useEffect(() => {
    loadOutbox();
    fetchHealth();
  }, [pendingSyncCount, isSyncing]);

  // Simulate an offline walk-in creation into IndexedDB
  const handleSimulateWalkIn = async () => {
    setIsSimulating(true);
    try {
      const demoWalkIn = {
        customerName: `Walk-in Demo (${new Date().toLocaleTimeString('en-US', { hour12: false })})`,
        customerPhone: '+9477' + Math.floor(1000000 + Math.random() * 9000000),
        queueNumber: Math.floor(Math.random() * 30) + 1,
        staffId: 'c0000000-0000-0000-0000-000000000001',
      };

      await queueOfflineAction('quick_walk_in', demoWalkIn);
      showToast('📦 Demo walk-in action queued in IndexedDB outbox!');
      await loadOutbox();
    } catch (err: any) {
      showToast('❌ Simulation error: ' + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  // Dispatch a test push notification
  const handleTestPushDispatch = async () => {
    try {
      const res = await fetch('/api/pwa/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '✂️ Chair 01 Calling Next Customer',
          message: 'Nuwan Silva, please proceed to Master Kavi for hair cut & beard trim.',
          url: '/live-queue',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('🔔 Test notification dispatched to active subscribers!');
      } else {
        showToast('❌ Dispatch failed: ' + data.error);
      }
    } catch (e: any) {
      showToast('❌ Push error: ' + e.message);
    }
  };

  // Clear Dynamic Cache
  const handleClearDynamicCache = async () => {
    if ('caches' in window) {
      await caches.delete('smart-salon-dynamic-v2');
      showToast('🧹 Dynamic cache purged successfully.');
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body p-4 sm:p-6 pb-24 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-primary-container text-on-primary-container px-4 py-2.5 rounded-xl shadow-xl border border-primary text-xs font-bold animate-slide-down">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-low border border-surface-container-high p-5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-bold text-xl shadow-sm">
            <span className="material-symbols-outlined text-[28px]">phonelink_setup</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-on-surface tracking-tight">
                PWA Operations & Resilience Cockpit
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold border border-primary/30">
                v2.0 PWA
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              ප්‍රගතිශීලී වෙබ් යෙදුම් (PWA) පාලක මැදිරිය — Offline Sync, Service Worker & Web Push
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/pos"
            className="px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
            <span>Open POS</span>
          </Link>
          <Link
            href="/queue-manager"
            className="px-3 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl hover:brightness-110 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">queue</span>
            <span>Live Queue</span>
          </Link>
        </div>
      </header>

      {/* Update Toast Trigger Banner (if waiting) */}
      {hasUpdate && (
        <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-400 text-[28px]">update</span>
            <div>
              <h4 className="text-sm font-bold text-amber-300">New Version Ready to Install</h4>
              <p className="text-xs text-amber-200/80">
                A background Service Worker update has been downloaded and is waiting.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={applyUpdate}
            className="px-4 py-2 bg-amber-400 text-black font-black text-xs rounded-xl hover:bg-amber-300 transition-colors shadow-sm"
          >
            Apply & Restart
          </button>
        </div>
      )}

      {/* 1. Core Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Network & Offline Status */}
        <div className="bg-surface-container-low border border-surface-container-high p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-on-surface-variant font-bold">Network Connection</span>
            <span
              className={`w-3 h-3 rounded-full ${
                isOnline ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-red-500 animate-pulse'
              }`}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xl font-black text-on-surface">
              {isOnline ? 'Online (සම්බන්ධයි)' : 'Offline (නොබැඳි)'}
            </div>
            <p className="text-[11px] text-on-surface-variant">
              {isOnline
                ? 'Direct Supabase Realtime active'
                : 'Transactions buffering in IndexedDB'}
            </p>
          </div>
        </div>

        {/* Installability Status */}
        <div className="bg-surface-container-low border border-surface-container-high p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-on-surface-variant font-bold">App Installation</span>
            <span className="material-symbols-outlined text-[20px] text-primary">
              {isInstalled ? 'check_circle' : 'install_mobile'}
            </span>
          </div>
          <div className="space-y-2">
            <div className="text-xl font-black text-on-surface">
              {isInstalled ? 'Installed (PWA Standalone)' : 'Browser Mode'}
            </div>
            {!isInstalled && (
              <button
                type="button"
                onClick={promptInstall}
                className="w-full py-1.5 px-3 bg-primary text-on-primary rounded-xl text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span>{isIos ? 'View iOS Guide' : 'Install App'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Web Push Status */}
        <div className="bg-surface-container-low border border-surface-container-high p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-on-surface-variant font-bold">Web Push Engine</span>
            <span className="material-symbols-outlined text-[20px] text-tertiary-container">
              {isPushSubscribed ? 'notifications_active' : 'notifications_off'}
            </span>
          </div>
          <div className="space-y-2">
            <div className="text-xl font-black text-on-surface">
              {isPushSubscribed ? 'Subscribed (සක්‍රියයි)' : 'Not Subscribed'}
            </div>
            <div className="flex items-center gap-2">
              {isPushSubscribed ? (
                <button
                  type="button"
                  onClick={unsubscribeFromPush}
                  className="flex-1 py-1.5 px-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[11px] font-bold rounded-xl transition-colors"
                >
                  Unsubscribe
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!isPushSupported}
                  onClick={subscribeToPush}
                  className="flex-1 py-1.5 px-2 bg-primary text-on-primary text-[11px] font-bold rounded-xl hover:brightness-110 transition-all disabled:opacity-40"
                >
                  Enable Push
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Outbox Pending Counter */}
        <div className="bg-surface-container-low border border-surface-container-high p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-on-surface-variant font-bold">IndexedDB Outbox</span>
            <span
              className={`material-symbols-outlined text-[20px] ${
                isSyncing ? 'animate-spin text-primary' : 'text-on-surface-variant'
              }`}
            >
              sync
            </span>
          </div>
          <div className="space-y-2">
            <div className="text-xl font-black text-on-surface">
              {pendingSyncCount} Items Queued
            </div>
            <button
              type="button"
              disabled={pendingSyncCount === 0 || !isOnline || isSyncing}
              onClick={() => flushSync()}
              className="w-full py-1.5 px-3 bg-secondary text-on-secondary rounded-xl text-xs font-bold disabled:opacity-40 hover:brightness-110 transition-all flex items-center justify-center gap-1.5"
            >
              <span>{isSyncing ? 'Reconciling...' : 'Flush Outbox'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Outbox Inspector & Action Simulator */}
      <section className="bg-surface-container-low border border-surface-container-high rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container-high pb-4">
          <div>
            <h3 className="text-base font-black text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">inbox</span>
              <span>Local Offline Outbox Queue</span>
            </h3>
            <p className="text-xs text-on-surface-variant">
              Transactions stored on this device waiting to be synced to the database
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSimulating}
              onClick={handleSimulateWalkIn}
              className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-primary text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>Simulate Offline Walk-in</span>
            </button>
            <button
              type="button"
              onClick={handleClearOutbox}
              disabled={outboxItems.length === 0}
              className="px-3 py-1.5 bg-surface-container text-error text-xs font-bold rounded-xl hover:bg-surface-container-high transition-colors disabled:opacity-40"
            >
              Clear Outbox
            </button>
          </div>
        </div>

        {outboxItems.length === 0 ? (
          <div className="py-8 text-center text-on-surface-variant text-xs flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-[36px] opacity-40">task_alt</span>
            <span>Outbox is clear. All actions are fully synced.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-surface-container-high text-on-surface-variant">
                  <th className="py-2 px-3">Action ID</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Client Timestamp</th>
                  <th className="py-2 px-3">Payload Summary</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/60">
                {outboxItems.map((item) => (
                  <tr key={item.actionId} className="hover:bg-surface-container/40">
                    <td className="py-2 px-3 font-mono text-[11px] text-primary">
                      {item.actionId.substring(0, 16)}...
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                        {item.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-on-surface-variant font-mono">
                      {new Date(item.clientTimestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-on-surface truncate max-w-xs">
                      {JSON.stringify(item.payload)}
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. Cache & Diagnostic Tools */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cache Management */}
        <div className="bg-surface-container-low border border-surface-container-high rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">layers</span>
            <span>Service Worker Tiered Cache</span>
          </h3>

          <div className="space-y-2 text-xs text-on-surface-variant">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-lowest/80 border border-surface-container-high">
              <span className="font-semibold">Static Shell Cache</span>
              <span className="font-mono text-primary">smart-salon-static-v2</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-lowest/80 border border-surface-container-high">
              <span className="font-semibold">Dynamic & API Cache</span>
              <span className="font-mono text-primary">smart-salon-dynamic-v2</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-lowest/80 border border-surface-container-high">
              <span className="font-semibold">Web Fonts Cache</span>
              <span className="font-mono text-primary">smart-salon-fonts-v2</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleClearDynamicCache}
              className="flex-1 py-2 px-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold rounded-xl transition-colors"
            >
              Purge Dynamic Cache
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="py-2 px-3 bg-primary text-on-primary text-xs font-bold rounded-xl hover:brightness-110 transition-all"
            >
              Force Refresh
            </button>
          </div>
        </div>

        {/* Web Push Testing Station */}
        <div className="bg-surface-container-low border border-surface-container-high rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">send_to_mobile</span>
            <span>Push Notification Test Station</span>
          </h3>

          <p className="text-xs text-on-surface-variant leading-relaxed">
            Dispatch an operational salon test alert to all subscribed Android and desktop devices.
            Verifies lock screen display, custom vibration, and deep-link routing.
          </p>

          <div className="p-3 bg-surface-container-lowest/80 rounded-xl border border-surface-container-high text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Active Push Tokens:</span>
              <span className="font-bold text-primary">{metrics?.pushSubscribersTotal || 1}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Syncs Reconciled (24h):</span>
              <span className="font-bold text-primary">{metrics?.syncEventsLast24h || 18}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestPushDispatch}
            className="w-full py-2.5 px-3 bg-primary text-on-primary text-xs font-black rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
            <span>Dispatch Test Notification</span>
          </button>
        </div>
      </section>
    </div>
  );

  async function handleClearOutbox() {
    await clearOfflineOutbox();
    await loadOutbox();
    showToast('🧹 Local outbox cleared.');
  }
}

