'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PwaContext, PwaContextValue } from '@/lib/pwa/usePwa';
import {
  subscribeToSync,
  flushOfflineActions,
} from '@/lib/pwa/offline-sync';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  const [isPushSupported, setIsPushSupported] = useState<boolean>(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);

  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 1. ONLINE / OFFLINE DETECTION
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. DETECT INSTALLED STATE & PLATFORM
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isAppleDevice && !isStandalone);

    // Check Push Support
    const pushAvailable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsPushSupported(pushAvailable);
  }, []);

  // 3. SERVICE WORKER REGISTRATION (Works on HTTPS & Localhost)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]';

    if (window.location.protocol !== 'https:' && !isLocalhost) {
      console.warn('[PWA] Service Workers require HTTPS or localhost.');
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered with scope:', reg.scope);

        // Check if an update is already waiting
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          setHasUpdate(true);
        }

        // Detect new worker installing
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (!installingWorker) return;

          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(installingWorker);
              setHasUpdate(true);
            }
          };
        };

        // Check active push subscription
        if (reg.pushManager) {
          reg.pushManager.getSubscription().then((sub) => {
            setIsPushSubscribed(Boolean(sub));
          });
        }
      })
      .catch((err) => {
        console.error('[PWA] Service Worker registration failed:', err);
      });

    // Handle controller change (when SKIP_WAITING activates new SW)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  // 4. CAPTURE NATIVE BEFOREINSTALLPROMPT
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // 5. SUBSCRIBE TO OFFLINE SYNC EVENTS
  useEffect(() => {
    const unsubscribe = subscribeToSync((pending, syncing) => {
      setPendingSyncCount(pending);
      setIsSyncing(syncing);
    });
    return unsubscribe;
  }, []);

  // PROMPT INSTALL
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (isIos) {
      setShowIosGuide(true);
      return false;
    }

    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[PWA] Install prompt failed:', err);
      return false;
    }
  }, [deferredPrompt, isIos]);

  // APPLY UPDATE
  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [waitingWorker]);

  // SUBSCRIBE TO PUSH
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        // Fallback demo / development VAPID public key
        const vapidPublicKey =
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
          'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as unknown as BufferSource,
        });
      }

      // Send to server
      const res = await fetch('/api/pwa/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });

      if (res.ok) {
        setIsPushSubscribed(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[PWA] Push subscription error:', err);
      return false;
    }
  }, [isPushSupported]);

  // UNSUBSCRIBE FROM PUSH
  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported) return false;

    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        setIsPushSubscribed(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[PWA] Push unsubscribe error:', err);
      return false;
    }
  }, [isPushSupported]);

  // MANUAL FLUSH
  const flushSync = useCallback(async () => {
    await flushOfflineActions();
  }, []);

  const value = useMemo<PwaContextValue>(
    () => ({
      isOnline,
      isInstallable,
      isInstalled,
      isIos,
      showIosGuide,
      setShowIosGuide,
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
    }),
    [
      isOnline,
      isInstallable,
      isInstalled,
      isIos,
      showIosGuide,
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
    ]
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

// Utility helper for VAPID key conversion
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

