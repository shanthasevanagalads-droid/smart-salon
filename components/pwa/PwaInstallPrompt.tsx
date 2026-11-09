'use client';

import React, { useState, useEffect } from 'react';
import { usePwa } from '@/lib/pwa/usePwa';

export function PwaInstallPrompt() {
  const {
    isInstallable,
    isInstalled,
    isIos,
    showIosGuide,
    setShowIosGuide,
    promptInstall,
  } = usePwa();

  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('pwa_prompt_dismissed') === 'true';
    if (isDismissed) setDismissed(true);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setShowIosGuide(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  // If already installed or dismissed (unless user clicked install on iOS)
  if (isInstalled || (dismissed && !showIosGuide)) {
    return null;
  }

  // A. iOS Safari "Add to Home Screen" Modal
  if (showIosGuide) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
        <div className="bg-surface-container-low border border-surface-container-high rounded-3xl p-6 max-w-sm w-full shadow-2xl relative">
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1 rounded-full bg-surface-container"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary mb-4">
            <span className="material-symbols-outlined text-[32px]">install_mobile</span>
          </div>

          <h3 className="text-lg font-black text-on-surface mb-1">
            Install on iPhone / iPad
          </h3>
          <p className="text-xs text-primary font-bold mb-4">
            මුල් තිරයට එක් කරන්න (Add to Home Screen)
          </p>

          <div className="space-y-3 text-xs text-on-surface-variant mb-6 bg-surface-container-lowest/80 p-3.5 rounded-xl border border-surface-container-high">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0">
                1
              </span>
              <span>
                Tap the <strong className="text-on-surface">Share button</strong> (
                <span className="inline-block px-1 bg-surface-container rounded font-bold">⎋ / [↑]</span>
                ) in Safari toolbar.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0">
                2
              </span>
              <span>
                Scroll down and select <strong className="text-on-surface">&quot;Add to Home Screen&quot;</strong>.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <span>
                Tap <strong className="text-primary font-bold">Add</strong> at top-right corner.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs"
          >
            Got it (තේරුණා)
          </button>
        </div>
      </div>
    );
  }

  // B. Android / Desktop Chrome Native Install Banner
  if (!isInstallable && !isIos) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 bg-surface-container-low/95 border border-primary/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-slide-up flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-on-primary font-black text-lg shadow-sm">
            ✂️
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-on-surface leading-tight">
              Install Smart Salon LK
            </h4>
            <span className="text-[11px] text-primary font-medium">
              වේගවත් භාවිතය සඳහා යෙදුම ස්ථාපනය කරන්න
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-on-surface-variant hover:text-on-surface p-1"
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <p className="text-xs text-on-surface-variant leading-snug">
        Works offline, launches from home screen, and tracks chair queues without opening a browser.
      </p>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={promptInstall}
          className="flex-1 py-2 px-3 bg-primary text-on-primary rounded-xl font-black text-xs hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          <span>{isIos ? 'Instructions' : 'Install App'}</span>
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="py-2 px-3 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Later
        </button>
      </div>
    </div>
  );
}

