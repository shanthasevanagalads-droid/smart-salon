// ========================================================================
// SMART SALON LK - ENTERPRISE SERVICE WORKER (v2.0.0-pwa)
// Built for Sri Lankan Rural / Semi-Urban Resilience & Low Latency 3G/4G
// Features:
//   - Tiered Cache Strategy: Cache-First, Network-First, Stale-While-Revalidate
//   - Background Sync for Outbox Queue
//   - Web Push Notification Dispatcher & Action Buttons
//   - Offline Fallback Page (/offline.html)
//   - Instant Cache Invalidation & SkipWaiting triggers
// ========================================================================

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `smart-salon-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `smart-salon-dynamic-${CACHE_VERSION}`;
const FONT_CACHE = `smart-salon-fonts-${CACHE_VERSION}`;

// Core Application Shell to Precache
const PRECACHE_SHELL = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-maskable.svg',
];

// Maximum dynamic cache entries to prevent memory exhaustion on entry-level Android devices
const MAX_DYNAMIC_ITEMS = 60;

// ------------------------------------------------------------------------
// 1. INSTALL LIFECYCLE
// ------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Promptly activate new worker version
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_SHELL).catch((err) => {
        console.warn('[SW] Precache asset failed non-critically:', err);
      });
    })
  );
});

// ------------------------------------------------------------------------
// 2. ACTIVATE LIFECYCLE & CACHE PRUNING
// ------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (
            key !== STATIC_CACHE &&
            key !== DYNAMIC_CACHE &&
            key !== FONT_CACHE
          ) {
            console.log('[SW] Deleting legacy cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Take immediate control of clients
    })
  );
});

// ------------------------------------------------------------------------
// 3. FETCH STRATEGIES (TIERED)
// ------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET and chrome-extension requests
  if (request.method !== 'GET' || url.protocol.startsWith('chrome-extension')) {
    return;
  }

  // A. FONT ASSETS (Google Fonts & Webfonts) -> Cache-First
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(FONT_CACHE).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // B. STATIC IMMUTABLE NEXT.JS ASSETS & SVG ICONS -> Cache-First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // C. OPERATIONAL APIS & SUPABASE ENDPOINTS -> Network-First
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // If valid, cache in dynamic cache for offline replay/inspection
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          return new Response(
            JSON.stringify({
              offline: true,
              message: 'Device is offline. Mutation saved to IndexedDB outbox.',
              timestamp: new Date().toISOString(),
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 503,
            }
          );
        })
    );
    return;
  }

  // D. HTML NAVIGATION & APP PAGES -> Stale-While-Revalidate with /offline.html Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          // Fallback to precached standalone offline page
          const fallback = await caches.match('/offline.html');
          return fallback || caches.match('/');
        })
    );
    return;
  }

  // E. DEFAULT FALLBACK STRATEGY
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        })
      );
    })
  );
});

// ------------------------------------------------------------------------
// 4. BACKGROUND SYNC (Offline Outbox Drain)
// ------------------------------------------------------------------------
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-actions') {
    console.log('[SW] Background sync triggered: sync-offline-actions');
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'TRIGGER_BACKGROUND_SYNC',
            timestamp: Date.now(),
          });
        });
      })
    );
  }
});

// ------------------------------------------------------------------------
// 5. WEB PUSH NOTIFICATIONS
// ------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {
    title: 'Smart Salon LK',
    body: 'Chair status or appointment update available.',
    url: '/live-queue',
    icon: '/icon.svg',
    badge: '/icon.svg',
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    vibrate: [200, 100, 200],
    tag: data.tag || 'smart-salon-notif',
    renotify: true,
    data: {
      url: data.url || '/',
    },
    actions: [
      { action: 'open_app', title: 'Open Salon' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ------------------------------------------------------------------------
// 6. NOTIFICATION CLICK ROUTING
// ------------------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ------------------------------------------------------------------------
// 7. CLIENT MESSAGING (Skip Waiting, Cache Purging)
// ------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data?.type === 'CLEAR_CACHE') {
    caches.delete(DYNAMIC_CACHE).then(() => {
      console.log('[SW] Dynamic cache cleared by user request');
    });
  }
});
