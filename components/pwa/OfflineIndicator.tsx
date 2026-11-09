'use client';

import React, { useState } from 'react';
import { usePwa } from '@/lib/pwa/usePwa';

export function OfflineIndicator() {
  const { isOnline, pendingSyncCount, isSyncing, flushSync } = usePwa();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // If online and zero pending mutations, no indicator needed
  if (isOnline && pendingSyncCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-full shadow-lg border backdrop-blur-md transition-all active:scale-95 ${
            !isOnline
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
              : 'bg-primary/20 border-primary/50 text-primary-fixed'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              !isOnline
                ? 'bg-amber-400 animate-pulse'
                : isSyncing
                ? 'bg-sky-400 animate-ping'
                : 'bg-emerald-400'
            }`}
          />
          <span className="text-xs font-black">
            {!isOnline
              ? 'Offline Mode'
              : isSyncing
              ? 'Syncing Outbox...'
              : `${pendingSyncCount} Pending Sync`}
          </span>
          {pendingSyncCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] font-black flex items-center justify-center">
              {pendingSyncCount}
            </span>
          )}
        </button>
      ) : (
        <div className="bg-surface-container-low border border-surface-container-high rounded-2xl p-4 shadow-2xl backdrop-blur-md w-80 text-left animate-slide-up">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  !isOnline ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                }`}
              />
              <h4 className="text-xs font-black text-on-surface">
                {!isOnline ? 'Offline Continuity Engine' : 'Sync Engine Active'}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-on-surface-variant hover:text-on-surface p-1"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          <p className="text-[11px] text-on-surface-variant mb-3 leading-relaxed">
            {!isOnline
              ? 'Network connection lost. All walk-ins, status updates, and cash sales are safely buffered in local IndexedDB.'
              : 'Connection active. Outbox updates are synchronized to cloud database.'}
          </p>

          <div className="bg-surface-container-lowest/80 p-2.5 rounded-xl border border-surface-container-high mb-3 flex items-center justify-between text-xs">
            <span className="text-on-surface-variant">Un-synced Mutations:</span>
            <span className="font-extrabold text-primary">{pendingSyncCount} items</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSyncing || !isOnline || pendingSyncCount === 0}
              onClick={() => flushSync()}
              className="flex-1 py-1.5 px-3 bg-primary text-on-primary disabled:opacity-40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  isSyncing ? 'animate-spin' : ''
                }`}
              >
                sync
              </span>
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="py-1.5 px-3 bg-surface-container text-on-surface rounded-xl text-xs font-semibold hover:bg-surface-container-high transition-colors"
            >
              Hide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

