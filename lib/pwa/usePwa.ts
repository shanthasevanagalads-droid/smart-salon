// ========================================================================
// SMART SALON LK - REACT HOOK FOR PWA CAPABILITIES & OFFLINE SYNCHRONIZATION
// ========================================================================

'use client';

import { createContext, useContext } from 'react';

export interface PwaContextValue {
  isOnline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  isIos: boolean;
  showIosGuide: boolean;
  setShowIosGuide: (show: boolean) => void;
  promptInstall: () => Promise<boolean>;
  hasUpdate: boolean;
  applyUpdate: () => void;
  isPushSupported: boolean;
  isPushSubscribed: boolean;
  subscribeToPush: () => Promise<boolean>;
  unsubscribeFromPush: () => Promise<boolean>;
  pendingSyncCount: number;
  isSyncing: boolean;
  flushSync: () => Promise<void>;
}

export const PwaContext = createContext<PwaContextValue | null>(null);

export function usePwa(): PwaContextValue {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
}

